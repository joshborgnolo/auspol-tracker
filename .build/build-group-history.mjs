/* build-group-history.mjs – the primary vote by group through the past terms.

   For each past term (election to election, 2004–2025) it fits
     - the national primaries with the site's model (primary-model.mjs
       fitPrimary: each pollster's drifting lean, the term's regular
       pollsters averaging zero, a damped trend, jumps at leader changes, the
       term opening on the count moved by the polls' average miss), from
       data/history-polls-2004-2025.json;
     - each group's gap from all voters (fitSet: a slow random walk, each
       pollster's own reading of it), from the term's published crosstabs
       (data/group-history-waves.json, read through demo-groups.mjs as the
       sitting term's are) and the Australian Election Study at both of the
       term's elections (data/aes-groups-history.json), read on each polling
       day as one more instrument with its own reading of every gap;
   and draws each group's shares as the national draws moved by its gap
   draws, month by month. A term whose opening count had One Nation folded
   into others (to 2013) is modelled with four parties, One Nation null.
   Writes data/group-history-model.json, stamped with a hash of its inputs
   so test-group-history.mjs can tell it is current.
     node .build/build-group-history.mjs */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { fitPrimary, fitSet, anchorFrom, categoriesOf, stepOf, softmaxAlr, alrOf, mean, quant, PRIM_MISS } from "./newtracker/primary-model.mjs";
import { harmonize, DEMO_SETS, DEMO_SHARE } from "./newtracker/demo-groups.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rdTxt = (f) => fs.readFileSync(path.join(ROOT, "data", f), "utf8");
const day = (iso) => Math.floor(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / 864e5);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const DEFF = 1.6, KEYS = ["alp", "lnp", "onp", "grn", "oth"];   // the monthly rows' order (demographics.json's)
/* changes of prime minister or opposition leader, by term (the jump days) */
const JUMPS = {
  2007: ["2005-01-28", "2006-12-04"], 2010: ["2007-12-03", "2008-09-16", "2009-12-01", "2010-06-24"],
  2013: ["2013-06-26"], 2016: ["2015-09-14"], 2019: ["2018-08-24"], 2022: ["2019-05-30"], 2025: ["2022-05-30"],
};
const FIELD_DAYS = { Newspoll: 3, Essential: 7, "Roy Morgan": 10, Galaxy: 2, ReachTEL: 1, Ipsos: 3, Nielsen: 3, Resolve: 5, YouGov: 5, Freshwater: 3, RedBridge: 5 };

export function buildGroupHistory({ log = () => {} } = {}) {
  const srcs = ["history-polls-2004-2025.json", "group-history-waves.json", "aes-groups-history.json", "age-dist.json"].map(rdTxt);
  const [HP, GW, AE, AGE] = srcs.map((t) => JSON.parse(t));
  const E = JSON.parse(rdTxt("polls.json")).elections;
  const elections = Object.values(E).filter((e) => e.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const polls = HP.polls || HP;
  const waves = GW.waves || [];
  const terms = [];
  for (let i = 1; i < elections.length; i++) {
    const prev = elections[i - 1], cur = elections[i];
    if (prev.date < "2004-10-09" || cur.date > "2025-05-03") continue;
    terms.push({ prev, cur, year: +cur.date.slice(0, 4) });
  }
  const out = [];
  for (const T of terms) {
    const parties = T.prev.onp ? ["alp", "lnp", "grn", "onp", "oth"] : ["alp", "lnp", "grn", "oth"], P = parties.length, D = P - 1;
    const fold = (o) => {                    // { alp, lnp, grn, onp, oth } → the term's party array
      if (!o) return null;
      const oth = o.oth == null ? null : P === 4 ? o.oth + (o.onp || 0) : o.oth;
      return parties.map((k) => (k === "oth" ? oth : o[k] == null ? null : +o[k]));
    };
    const t0 = day(T.prev.date), t1 = day(T.cur.date);
    /* national readings */
    const readings = [];
    polls.forEach((r, idx) => {
      if (!r.end || r.end <= T.prev.date || r.end >= T.cur.date || r.alp == null || r.lnp == null) return;
      const y = { alp: r.alp, lnp: r.lnp, grn: r.grn, onp: r.onp, oth: r.oth };
      if (P === 4) { if (y.onp != null && y.oth != null) y.oth += y.onp; delete y.onp; }
      const c = categoriesOf(y, parties);
      if (!c) return;
      const e = day(r.end), s = r.start ? day(r.start) : e - (FIELD_DAYS[r.house] ?? 3) + 1;
      const rowN = r.nEff != null ? r.nEff * DEFF : Math.min(r.n || 1200, 3000);
      const und = (r.base === "D" || r.base === "A") && r.und > 0 && r.und < 30 ? r.und : 0;
      readings.push({ house: r.house + (r.method ? " · " + r.method : ""), idx, day: Math.round((s + e) / 2), n: (rowN / DEFF) * (1 - und / 100) * (r.rolling2wk ? 0.5 : 1),
        cats: c.cats, vals: c.vals, full: c.full, step: stepOf(c.vals) });
    });
    readings.sort((a, b) => a.day - b.day);
    const months = [];
    for (let d = new Date(T.prev.date.slice(0, 7) + "-01T00:00:00Z"); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
      const ym = d.toISOString().slice(0, 7);
      if (day(ym + "-01") > t1) break;
      const mid = Math.min(Math.max(day(ym + "-15"), t0 + 1), t1);
      months.push({ ym, day: mid });
    }
    const prevRes = Object.fromEntries(parties.map((k) => [k, k === "oth" && P === 4 ? T.prev.oth + (T.prev.onp || 0) : T.prev[k]]));
    const miss = Object.fromEntries(parties.map((k) => [k, PRIM_MISS[k]]));
    const nat = fitPrimary(readings, { t0, t1, anchor: anchorFrom(prevRes, miss, parties), jumps: new Set((JUMPS[T.year] || []).map(day)), parties,
      days: months.map((m) => m.day), trend: true, nDraw: 1000, M: 8, seed: 20261129 + T.year });
    const natDraws = new Map(months.map((m) => { const sh = nat.shares(m.day), n = sh.length / P; return [m.day, Array.from({ length: n }, (_, i) => alrOf(sh.subarray(i * P, i * P + P)))]; }));
    const sumRow = (ym, cols) => {
      const v = {}, ci = {};
      parties.forEach((k, q) => { const c = cols[q]; v[k] = mean(c); ci[k] = (quant(c, 0.975) - quant(c, 0.025)) / 2; });
      return [ym, ...KEYS.map((k) => r1(v[k] ?? null)), ...KEYS.map((k) => r1(ci[k] ?? null))];
    };
    const national = months.map((m) => { const dr = natDraws.get(m.day), cols = parties.map(() => new Float64Array(dr.length)); dr.forEach((e, i) => { const sh = softmaxAlr(e); for (let q = 0; q < P; q++) cols[q][i] = 100 * sh[q]; }); return sumRow(m.ym, cols); });
    /* group readings: the term's crosstabs and the AES at both elections */
    const raw = [];
    for (const w of waves) {
      if (!w.date || w.date <= T.prev.date || w.date >= T.cur.date) continue;
      const tot = fold(w.total);
      if (!tot || tot.some((v) => v == null)) continue;
      const h = harmonize(w, { ageDist: AGE });
      const e = day(w.date), s = w.dateStart ? day(w.dateStart) : e - 3, n = Math.min(w.sample || 1000, 3000) / DEFF;
      for (const set of DEMO_SETS) for (const group of set.groups) {
        const g = h[set.id] && h[set.id][group] && fold(h[set.id][group]);
        if (!g || g.some((v) => v == null)) continue;
        raw.push({ set: set.id, group, house: w.pollster, day: Math.round((s + e) / 2), n: n * DEMO_SHARE[group], s: DEMO_SHARE[group], g, t: tot, src: "poll" });
      }
    }
    for (const [yr, d0] of [[T.prev.date.slice(0, 4), t0 + 1], [T.cur.date.slice(0, 4), t1]]) {
      const A = AE.elections[yr];
      if (!A || !A.all) continue;
      const tot = fold(A.all);
      if (!tot || tot.some((v) => v == null)) continue;
      for (const set of DEMO_SETS) for (const group of set.groups) {
        const c = A.sets && A.sets[set.id] && A.sets[set.id][group];
        const g = c && fold(c);
        if (!g || g.some((v) => v == null) || !(c.n >= 30)) continue;
        raw.push({ set: set.id, group, house: "AES", day: d0, n: c.n / (A.weighted ? 1.5 : 1.2), s: DEMO_SHARE[group], g, t: tot, src: "aes" });
      }
    }
    const sets = {};
    for (const setId of [...new Set(raw.map((r) => r.set))]) {
      const fit = fitSet(raw.filter((r) => r.set === setId), { t0, t1, days: months.map((m) => m.day), nDraw: 1000, seed: 20261130 + T.year });
      for (const [group, g] of fit.groups) {
        const a = g.obs[0].day, b = g.obs[g.obs.length - 1].day;
        const rows = months.filter((m) => m.day >= a - 20 && m.day <= b + 20).map((m) => {
          const gd = g.draws.get(m.day), dr = natDraws.get(m.day);
          if (!gd) return null;
          const n = Math.min(dr.length, gd.length / D), cols = parties.map(() => new Float64Array(n));
          for (let i = 0; i < n; i++) { const e = dr[i].map((v, k) => v + gd[i * D + k]), sh = softmaxAlr(e); for (let q = 0; q < P; q++) cols[q][i] = 100 * sh[q]; }
          return sumRow(m.ym, cols);
        }).filter(Boolean);
        if (rows.length >= 2) (sets[setId] ||= {})[group] = { months: rows, houses: g.houses, n: g.obs.length, aes: g.obs.filter((o) => o.src.src === "aes").length };
      }
    }
    log(`  ${T.year}: national ${readings.length} polls; groups ${Object.values(sets).reduce((a, s) => a + Object.keys(s).length, 0)} from ${raw.filter((r) => r.src === "poll").length} crosstab readings and ${raw.filter((r) => r.src === "aes").length} AES cells`);
    out.push({ year: T.year, from: T.prev.date, to: T.cur.date, parties, national, sets });
  }
  return {
    _about: "Generated by .build/build-group-history.mjs – do not edit. Each past term's national primaries and each group's (months: [ym, alp, lnp, onp, grn, oth, then each one's 95% half-width]; One Nation null where the term folds it into others), from the site's primary and group models.",
    input: createHash("sha1").update(srcs.join("\u0000")).digest("hex").slice(0, 12), terms: out,
  };
}
if (process.argv[1] && path.basename(process.argv[1]) === "build-group-history.mjs") {
  const t = Date.now();
  const m = buildGroupHistory({ log: console.log });
  fs.writeFileSync(path.join(ROOT, "data", "group-history-model.json"), JSON.stringify(m) + "\n");
  console.log(`group history: ${m.terms.length} terms → data/group-history-model.json (input ${m.input}) in ${((Date.now() - t) / 1000).toFixed(0)}s`);
}
