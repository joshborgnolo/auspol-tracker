/* build-vote-history.mjs – the primary vote's past terms on the site's model.

   The vote charts' history (gen-data §8v) draws every past term, 1943–2025,
   through the counts at both ends. This fits each term's primaries with the
   same model as the sitting term (primary-model.mjs fitPrimary: each
   pollster's drifting lean, the term's regular pollsters averaging zero, a
   damped trend, the term opening on the count), from the term's polls in
   data/polls.json cyclePolls, and then moves the line toward the closing
   count by §8v's own rule – the polls' polling-day miss e (the model's
   consensus there less the count) applied in part, g = 0.4 + 0.6·f of it
   at the share f of the term elapsed – but on the model's log-ratio scale,
   so no share can be moved below zero (the monthly averages' point
   correction pushed the 1950s' small Others under it). The band is the
   model's own 95% interval with the doubt about the bias left once the
   count is known added, V·g(1 − g) (V the lane's mean squared miss over
   the record), as §8v's. A term with no dated poll in its last three weeks
   has no measured miss: its line is the polls alone, its band
   the unmeasured bias's own, V·g.
   Lanes as §8v's: Labor, the Coalition, the Greens or One Nation where the
   closing count lists the party and two in five of the term's polls do;
   everyone else is others. Rows that kept undecided voters in the base are
   put on a decided basis first.
   The 2PP (1987 on, where the opening election's flows are on file,
   FLOW_LEF): Labor's share read through those flows from each of the
   model's draws, exactly Past cycles' construction (impliedLefAlp2pp) on
   the model's shares; moved toward the counted 2PP by the same rule on the
   logit scale, its band the draws' interval plus the bias doubt. Earlier
   terms keep gen-data's 2PP lane (their rows already carry an implied 2PP).
   Writes data/vote-history-model.json, stamped with a hash of its inputs.
     node .build/build-vote-history.mjs */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { fitPrimary, drawsAt, anchorFrom, categoriesOf, stepOf, softmaxAlr, alrOf, mean, quant, PRIM_MISS } from "./newtracker/primary-model.mjs";
import { FLOW_LEF, impliedLefAlp2pp } from "./newtracker/flows.mjs";
import { nestCoords, nestJac } from "./newtracker/group-span.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W0 = 0.4, SEP = ["alp", "lnp", "grn", "onp"], DEFF = 1.6;
const day = (iso) => Math.floor(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / 864e5);
const r2 = (v) => Math.round(v * 100) / 100;
const dx = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const doy = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000;
  const yrLen = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365;
  return y + doy / yrLen;
};
const mx = (ym) => { const [y, m] = ym.split("-").map(Number); return y + (m - 1 + 0.5) / 12; };

/* weekly (optional): filled with each term's week-by-week readings, for the
   /dawn/ past cycles page – Labor, the Coalition and (from 1987) the 2PP at
   each week after the opening election, up to WEEKS, moved toward the count
   by the same rule. Their draws are apart (drawsAt, their own seed), so the
   monthly figures are untouched. */
const WEEKS = 160;
export function buildVoteHistory({ log = () => {}, weekly = null } = {}) {
  const src = fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8");
  const D = JSON.parse(src);
  const inputs = JSON.stringify({ e: D.elections, c: D.cyclePolls, b: D.cyclePollBases });
  const E = Object.entries(D.elections).filter(([, e]) => e.date).map(([k, e]) => ({ year: +k.slice(1), ...e })).sort((a, b) => (a.date < b.date ? -1 : 1));
  const BASES = D.cyclePollBases || {}, CYC = D.cyclePolls || {};
  const LANES_ALL = ["alp", "lnp", "grn", "onp", "oth", "dem", "dlp"];
  const terms = [];
  for (let i = 1; i < E.length; i++) {
    const O = E[i - 1], C = E[i];
    const tO = day(O.date), tC = day(C.date);
    const polls = (CYC[C.year] || []).filter((p) => p.firm !== "Election" && !/exit/i.test(p.firm || "") && p.firm !== "YouGov MRP" && p.alp != null && p.lnp != null)
      .filter((p) => { const t = day(p.date); return t > tO && t <= tC; });
    if (!polls.length) continue;
    const lanes = SEP.filter((k) => k === "alp" || k === "lnp" || (C[k] > 0 && polls.filter((p) => p[k] != null).length >= 0.4 * polls.length));
    const parties = lanes.concat(["oth"]), P = parties.length, Dd = P - 1;
    const count = (e) => { const o = {}; for (const k of lanes) o[k] = e[k] > 0 || k === "alp" || k === "lnp" ? e[k] : 0; o.oth = r2(100 - lanes.reduce((s, q) => s + (e[q] || 0), 0)); return o; };
    const open = count(O), close = count(C);
    const readings = [];
    polls.forEach((p, idx) => {
      const sum = LANES_ALL.reduce((s, k) => s + (p[k] ?? 0), 0), b = BASES[C.year + "|" + p.firm];
      const und = Math.abs(sum - 100) > 2 && b && b.undecided && sum < 100 ? 100 - sum : null;
      const kk = und != null ? 100 / (100 - und) : 1;
      const y = {};
      for (const k of lanes) y[k] = p[k] != null ? p[k] * kk : null;
      /* a poll that doesn't name a lane (One Nation before its founding,
         the Greens in some early-1990s polls) folds it into everyone else
         (categoriesOf), rather than being dropped: dropping them started
         the 1993 and 1996 terms months after their first polls */
      y.oth = 100 - lanes.reduce((s, k) => s + (y[k] ?? 0), 0);
      if (!(y.oth > 0.2)) y.oth = 0.2;
      const c = categoriesOf(y, parties);
      if (!c) return;
      const e = day(p.date);
      readings.push({ house: p.firm, idx, day: e - 2, end: e, approx: !!p.dateApprox, n: 1200 / DEFF, cats: c.cats, vals: c.vals, full: c.full, step: stepOf(c.vals), ym: p.date.slice(0, 7) });
    });
    if (readings.length < 2) continue;
    readings.sort((a, b) => a.day - b.day);
    /* the month points: one per month the term polled in, mid-month unless
       that falls the far side of an election (then at the month's polls) */
    const yms = [...new Set(readings.map((r) => r.ym))].sort();
    const xO = dx(O.date), xC = dx(C.date);
    const months = yms.map((ym) => {
      const inM = readings.filter((r) => r.ym === ym);
      let x = mx(ym), dd = Math.min(Math.max(day(ym + "-15"), tO + 1), tC);
      if (x > xC - 1 / 365 || x < xO + 1 / 365) { dd = Math.round(inM.reduce((s, r) => s + r.day, 0) / inM.length); dd = Math.min(Math.max(dd, tO + 1), tC); x = Math.min(xC - 0.5 / 365, Math.max(xO + 0.5 / 365, dx(new Date(dd * 864e5).toISOString().slice(0, 10)))); }
      return { ym, x: +x.toFixed(4), day: dd, k: inM.length };
    });
    const miss = Object.fromEntries(parties.map((k) => [k, PRIM_MISS[k] || PRIM_MISS.oth]));
    const fit = fitPrimary(readings, { t0: tO, t1: tC, anchor: anchorFrom(open, miss, parties), jumps: new Set(), parties,
      days: months.map((m) => m.day), trend: true, nDraw: 600, M: 8, seed: 20261201 + C.year, minCore: 4 });
    const alrDraws = (d) => { const sh = fit.shares(d), n = sh.length / P; return Array.from({ length: n }, (_, j) => alrOf(sh.subarray(j * P, j * P + P))); };
    /* the polls' polling-day miss: measured where a dated poll falls in the
       last three weeks (§8v's rule); the band's scale V counts only terms
       with two or more there */
    const lateN = readings.filter((r) => !r.approx && tC - r.end <= 21).length;
    const endD = alrDraws(tC);
    const cAlr = alrOf(parties.map((k) => Math.max(close[k], 0.2) / 100));
    const eAlr = lateN >= 1 ? Array.from({ length: Dd }, (_, k) => mean(endD.map((e) => e[k])) - cAlr[k]) : null;
    const endSh = parties.map((_, q) => mean(endD.map((e) => 100 * softmaxAlr(e)[q])));
    const out = { year: O.year, src: C.year, a: xO, b: xC, lanes: parties, open, close, miss: {}, n: polls.length, lateN, series: {} };
    /* the vote-by-group model's base (gen-data §7gm): each month's adjusted
       draws on its nested log-ratio scale (group-span.mjs), mean and
       covariance – Labor, the Coalition, then the Greens and One Nation
       where the term draws them apart (a term drawing One Nation but not the
       Greens apart has no such scale) */
    const nestOK = !(parties.includes("onp") && !parties.includes("grn"));
    const lev = parties.length - 1;
    if (nestOK) { out.days = [tO, tC]; out.nest = []; }
    /* the 2PP through the opening election's flows, draw by draw */
    const LEF = FLOW_LEF[O.year];
    const tppOf = (sh) => { const q = Object.fromEntries(parties.map((k, i) => [k, 100 * sh[i]])); return impliedLefAlp2pp(LEF, { alp: q.alp, lnp: q.lnp, grn: q.grn ?? null, onp: q.onp ?? null, oth: q.oth }); };
    const lg = (v) => Math.log(v / (100 - v));
    let eT = null;
    if (LEF && C.tpp_alp != null) {
      const endT = endD.map((e) => tppOf(softmaxAlr(e)));
      eT = lateN >= 1 ? lg(mean(endT)) - lg(C.tpp_alp) : null;
      out.open.tpp = O.tpp_alp ?? null; out.close.tpp = C.tpp_alp; out.miss.tpp = eT == null ? null : r2(mean(endT) - C.tpp_alp);
      out.series.tpp = [];
    }
    parties.forEach((k, q) => { out.miss[k] = eAlr ? r2(endSh[q] - close[k]) : null; out.series[k] = []; });
    for (const m of months) {
      const f = Math.min(1, Math.max(0, (m.x - xO) / (xC - xO))), g = W0 + (1 - W0) * f;
      const dr = alrDraws(m.day), raw = parties.map(() => []), adj = parties.map(() => []);
      for (const e of dr) {
        const s0 = softmaxAlr(e), s1 = eAlr ? softmaxAlr(e.map((v, k) => v - eAlr[k] * g)) : s0;
        parties.forEach((_, q) => { raw[q].push(100 * s0[q]); adj[q].push(100 * s1[q]); });
      }
      if (nestOK) {
        const cs = adj[0].map((_, j) => nestCoords(parties.map((__, q) => Math.max(adj[q][j], 1e-4) / 100)));
        const mu = Array.from({ length: lev }, (_, a) => mean(cs.map((c) => c[a])));
        const C = [];
        for (let a = 0; a < lev; a++) for (let b = a; b < lev; b++) C.push(cs.reduce((s, c) => s + (c[a] - mu[a]) * (c[b] - mu[b]), 0) / (cs.length - 1));
        out.nest.push({ day: m.day, m: mu, C, sh: parties.map((_, q) => mean(adj[q]) / 100), g, measured: !!eAlr });
      }
      parties.forEach((k, q) => {
        const lo = quant(adj[q], 0.025), hi = quant(adj[q], 0.975);
        const rlo = quant(raw[q], 0.025), rhi = quant(raw[q], 0.975);
        out.series[k].push({ x: m.x, adj: mean(adj[q]), raw: mean(raw[q]), sd: (hi - lo) / 3.92, rawSd: (rhi - rlo) / 3.92, k: m.k, g, measured: !!eAlr });
      });
      if (out.series.tpp) {
        const rawT = dr.map((e) => tppOf(softmaxAlr(e)));
        const adjT = eT == null ? rawT : rawT.map((v) => { const z = lg(v) - eT * g; return 100 / (1 + Math.exp(-z)); });
        const lo = quant(adjT, 0.025), hi = quant(adjT, 0.975);
        const rlo = quant(rawT, 0.025), rhi = quant(rawT, 0.975);
        out.series.tpp.push({ x: m.x, adj: mean(adjT), raw: mean(rawT), sd: (hi - lo) / 3.92, rawSd: (rhi - rlo) / 3.92, k: m.k, g, measured: eT != null });
      }
    }
    if (weekly) {
      const wdays = [];
      for (let w = 1; w <= WEEKS && tO + 7 * w <= tC; w++) wdays.push(tO + 7 * w);
      const drawn = drawsAt(fit, wdays, { seed: 20261301 + C.year });
      const lanesW = { alp: [open.alp], lnp: [open.lnp], ...(out.series.tpp ? { tpp: [O.tpp_alp ?? null] } : {}) };
      for (const d of wdays) {
        const sh = drawn.get(d), n = sh.length / P, f = (d - tO) / (tC - tO), g = W0 + (1 - W0) * f;
        const adjusted = Array.from({ length: n }, (_, j) => alrOf(sh.subarray(j * P, j * P + P))).map((e) => softmaxAlr(eAlr ? e.map((v, k) => v - eAlr[k] * g) : e));
        for (const k of ["alp", "lnp"]) { const q = parties.indexOf(k); lanesW[k].push(r2(mean(adjusted.map((a) => 100 * a[q])))); }
        if (lanesW.tpp) {
          const t = Array.from({ length: n }, (_, j) => tppOf(sh.subarray(j * P, j * P + P).slice()));
          lanesW.tpp.push(r2(mean(eT == null ? t : t.map((v) => 100 / (1 + Math.exp(-(lg(v) - eT * g)))))));
        }
      }
      weekly.push({ year: O.year, first: Math.min(...readings.map((r) => r.day)) - tO, len: tC - tO, lanes: lanesW });
    }
    if (out.series.tpp) out.lanes = parties.concat(["tpp"]);
    terms.push(out);
    log(`  ${O.year}–${C.year}: ${readings.length} polls, lanes ${parties.join("/")}, miss ${eAlr ? parties.map((k) => k + " " + out.miss[k]).join(" ") : "unmeasured"}`);
  }
  /* V: each lane's mean squared miss over the measured terms (points²) */
  const V = {};
  for (const k of ["alp", "lnp", "grn", "onp", "oth", "tpp"]) {
    const es = terms.filter((t) => t.miss[k] != null && t.lateN >= 2).map((t) => t.miss[k]);
    V[k] = es.length ? es.reduce((s, e) => s + e * e, 0) / es.length : null;
  }
  for (const t of terms) {
    for (const k of t.lanes) {
      const Vk = V[k] ?? V.oth;
      t.series[k] = t.series[k].map((m) => {
        const biasVar = m.measured ? Vk * m.g * (1 - m.g) : Vk * m.g;
        const ci = Math.min(1.96 * Math.sqrt(m.sd * m.sd + biasVar), m.adj);   // the band stops at zero
        const rawCi = Math.min(1.96 * m.rawSd, m.raw);
        return [m.x, r2(m.adj), r2(m.raw), r2(ci), m.k, r2(rawCi)];
      });
    }
    /* the nested moments with the doubt about the bias left once the count
       is known added in share space (each lane's V·g(1 − g), or V·g
       unmeasured) and read through the scale's Jacobian at the month's mean
       shares: rows [day, mean…, covariance's upper triangle…] */
    if (t.nest) {
      const lev = t.lanes.filter((k) => k !== "tpp").length - 1, lanes = t.lanes.filter((k) => k !== "tpp"), P = lev + 1;
      t.nest = t.nest.map((r) => {
        const bv = lanes.map((k) => { const Vk = V[k] ?? V.oth; return (r.measured ? Vk * r.g * (1 - r.g) : Vk * r.g) / 1e4; });
        const J = nestJac(r.sh), C = r.C.slice();
        let u = 0;
        for (let a = 0; a < lev; a++) for (let b = a; b < lev; b++) { let s = 0; for (let i = 0; i < P; i++) s += J[a * P + i] * bv[i] * J[b * P + i]; C[u++] += s; }
        return [r.day, ...r.m.map((v) => +v.toFixed(5)), ...C.map((v) => +v.toPrecision(5))];
      });
    }
    delete t.lateN;
  }
  return {
    _about: "Generated by .build/build-vote-history.mjs from data/polls.json (cyclePolls, elections, cyclePollBases) – do not edit. Each past term's primaries on the site's model, moved toward the closing count on the log-ratio scale; series rows are [x, adjusted, the model's consensus, inferred 95% half-width, polls that month, unadjusted 95% half-width], gen-data §8v's shape.",
    input: createHash("sha1").update(inputs).digest("hex").slice(0, 12), w0: W0,
    rms: Object.fromEntries(Object.entries(V).map(([k, v]) => [k, v == null ? null : r2(Math.sqrt(v))])), terms,
  };
}
if (process.argv[1] && path.basename(process.argv[1]) === "build-vote-history.mjs") {
  const t = Date.now();
  const weekly = [];
  const m = buildVoteHistory({ log: console.log, weekly });
  fs.writeFileSync(path.join(ROOT, "data", "vote-history-model.json"), JSON.stringify(m) + "\n");
  fs.writeFileSync(path.join(ROOT, "data", "vote-history-weekly.json"), JSON.stringify({
    _about: "Generated by .build/build-vote-history.mjs beside vote-history-model.json – do not edit. Each past term's Labor, Coalition and (from 1987) two-party figures at each week after its opening election (index = week; 0 is the count), for /dawn/past-cycles/.",
    input: m.input, terms: weekly }) + "\n");
  console.log(`vote history: ${m.terms.length} terms → data/vote-history-model.json (input ${m.input}) in ${((Date.now() - t) / 1000).toFixed(0)}s; rms ${JSON.stringify(m.rms)}`);
}
