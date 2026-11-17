#!/usr/bin/env node
/* calibrate-independents.mjs: the record the seat model draws independents from (independents.mjs says
   how it is used). From the House results 1993-2025 (map/data/res-<year>.json) and the sitting-member
   record (data/house-incumbency.json), for every election E with the election before it, P:

     sitting      every sitting independent who contested E having stood at P: the logit change in their
                  share of the formal vote (from their notional share where boundaries moved)
     transitions  every seat a party held going into E with no sitting independent on the ballot: the
                  strongest losing independent's share at P (tp) and the strongest independent's at E (te),
                  whether that candidate reached the final two and whether they won

   Writes data/seat-model-independents.json: the rows, the fits the 2028 run uses, and the same fits as
   they stood before each election since 2001 (what backtest-long.mjs may use for that election).

   Also the check of what an independent takes of preferences (seat-inputs.mjs certifiedShares: by who else
   is left in the count, measured on the federal 2025 count and Farrer 2026) on counts it was not measured
   on: the SA 2026 districts where an independent reached the final two, counted from their actual
   primaries on the model's flows (state-tables.mjs, as backtest-states.mjs counts them), the take as one
   share per class and by who else is left, against the count (`check.sa26`); and how often an independent's
   first-preference vote became a win at the stores' elections since 2022 (`check.conversion`). */
import { readFileSync, writeFileSync } from "node:fs";
import { IND_K, sittingFit, slotTable, windowYears } from "./independents.mjs";
import { count, FLOW_CLASSES } from "./seat-engine.mjs";
import { routing, subOfName, SUB_CLASS, FAM_OF_GROUP } from "./senate-flows.mjs";
import { stateDistrictTables } from "./state-tables.mjs";
import { settings, flowClassOf, certifiedShares, vsOneNation } from "./seat-inputs.mjs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const YEARS = [1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const RES = Object.fromEntries(YEARS.map((y) => [y, J(`map/data/res-${y}.json`)]));
const INC = J("data/house-incumbency.json").years;
const sum = (a) => a.reduce((s, x) => s + x, 0), logit = (p) => Math.log(p / (1 - p));
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
const pk = (name) => { const nm = String(name).split(" "); return norm(nm[nm.length - 1]) + "|" + norm(nm[0])[0]; };

const sitting = [], transitions = [];
for (let yi = 1; yi < YEARS.length; yi++) {
  const E = YEARS[yi], P = YEARS[yi - 1];
  for (const dv of RES[E].divs) {
    const dp = RES[P].divs.find((d) => d.n === dv.n); if (!dp) continue;
    const totE = sum(dv.c.map((c) => c[4])), totP = sum(dp.c.map((c) => c[4])), sitE = INC[E][dv.n]?.sit || [];
    const tcp = dv.tcp ? dv.tcp.map((t) => t[0]) : [];
    // sitting independents contesting E
    dv.c.forEach((c, i) => {
      if (c[3] !== "ind" || sitE[i] !== 1) return;
      const j = dp.c.findIndex((x) => x[3] === "ind" && pk(x[0]) === pk(c[0])); if (j < 0) return;
      const share = c[4] / totE, prev = dp.c[j][4] / totP, notional = c[5] != null ? share - c[5] / 100 : null;
      const base = notional != null && notional > 0.005 ? notional : prev;
      if (base < 0.03) return;
      sitting.push({ E, div: dv.n, name: c[0], base: r4(base), share: r4(share), d: r4(logit(share) - logit(base)), held: c[6] === 1 });
    });
    // party-held seats: no sitting independent on E's ballot, none elected at P
    if (dv.c.some((c, i) => c[3] === "ind" && sitE[i] === 1) || dp.c.some((c) => c[3] === "ind" && c[6] === 1)) continue;
    const tp = Math.max(0, ...dp.c.filter((c) => c[3] === "ind").map((c) => c[4] / totP));
    const top = dv.c.map((c, i) => ({ c, i })).filter((x) => x.c[3] === "ind").sort((a, b) => b.c[4] - a.c[4])[0];
    transitions.push({ E, div: dv.n, tp: r4(tp), te: r4(top ? top.c[4] / totE : 0), fin: !!top && tcp.includes(top.i), won: !!top && top.c[6] === 1, ...(top && top.c[4] / totE >= 0.1 ? { name: top.c[0] } : {}) });
  }
}
const ELECTIONS = YEARS.slice(1);
const fitAt = (before) => {
  const ds = sitting.filter((r) => r.E < before).map((r) => r.d), f = sittingFit(ds);
  const ys = windowYears(ELECTIONS, before);
  return { sitting: { n: f.n, mean: r4(f.mean ?? 0), sig: f.sig == null ? null : r4(f.sig) }, window: ys };
};
const byElection = Object.fromEntries(ELECTIONS.map((E) => {
  const t = transitions.filter((r) => r.E === E), strong = t.filter((r) => r.tp >= 0.1), fresh = t.filter((r) => r.tp < 0.1);
  return [E, { seats: t.length, standing: strong.length, standingKept: strong.filter((r) => r.te >= r.tp / 2).length, standingWon: strong.filter((r) => r.won).length,
    fresh: fresh.length, freshSerious: fresh.filter((r) => r.te >= IND_K.serious).length, freshFinal: fresh.filter((r) => r.fin).length, freshWon: fresh.filter((r) => r.won).length }];
}));
const now = fitAt(Infinity), full = sittingFit(sitting.map((r) => r.d));
// what the 2028 run's tables look like at a few previous shares (the page prints them)
const examples = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map((tp) => {
  const t = slotTable(transitions, now.window, tp), pooled = slotTable(transitions, now.window, tp);
  // pooled chances over the window: weight each election equally, as the simulation does
  const p = (lo) => sum(t.lv.map((lv, y) => sum(lv.map((l, i) => (l >= lo ? t.cum[y][i] - (i ? t.cum[y][i - 1] : 0) : 0))))) / t.lv.length;
  return { tp, cases: pooled.n, none: r4(1 - p(0.0001)), p10: r4(p(0.1)), p20: r4(p(0.2)), p30: r4(p(0.3)), central: t.central, mean: t.mean };
});
/* ---- the take of preferences, checked on SA 2026 ---- */
function checkSA26() {
  const ST = settings(J("data/seat-model-flow-calibration.json"));
  const { SEN, sd, tables } = stateDistrictTables({ sen: 2025, st: "SA", res: "res-sa26", ST });
  const x = certifiedShares(J("data/aec-2025-seat-flows.json"), vsOneNation(J("map/data/data-now.json"))).capX;
  const FLAT = { ALP: 0.73, COAL: 0.73, GRN: 0.49, ON: 0.28, "OTH-R": 0.23, "OTH-M": 0.23, "OTH-L": 0.23, _: 0.23 };  // the one share per class every state test has counted with
  const rows = [];
  sd.divs.forEach((dv, i) => {
    if (!dv.tcp || !dv.tcp.some((t) => dv.c[t[0]][3] === "ind")) return;
    const tot = sum(dv.c.map((c) => c[4]));
    const cands = dv.c.map((c) => {
      const b = c[3], g = b === "alp" ? "alp" : b === "lnp" ? "lp" : b === "grn" ? "grn" : b === "onp" ? "on" : b === "ind" ? "member:" + c[0] : "oth";
      const key = g === "alp" ? "ALP" : g === "lp" ? "COAL" : g === "grn" ? "GRN" : g === "on" ? "ON" : g.startsWith("member") ? "OTH-M" : (() => { const k = subOfName(c[2]); return k.startsWith("OTH:") ? "OTH-" + (SUB_CLASS[k.slice(4)] || "M") : "OTH-M"; })();
      const cls = flowClassOf(key);
      return { label: c[0], group: g, fam: FAM_OF_GROUP[g] ?? -1, isInd: g.startsWith("member"), base: c[4] / tot, key, cls, clsIdx: FLOW_CLASSES.indexOf(cls), route: routing(SEN, tables[i][cls]) };
    });
    const ti = dv.tcp.findIndex((t) => dv.c[t[0]][3] === "ind"), name = dv.c[dv.tcp[ti][0]][0];
    const run = (extra) => { const fin = count({ name: dv.n, cands, iota: FLAT, sib: 0.72, ...extra }, cands.map((c) => c.base), null, null), k = fin.findIndex((f) => cands[f[0]].label === name); return k < 0 ? null : r4(fin[k][1] / (fin[0][1] + fin[1][1])); };
    rows.push({ district: dv.n, independent: name, primary: r4(dv.c[dv.tcp[ti][0]][4] / tot), against: dv.c[dv.tcp[1 - ti][0]][3], actual: r4(dv.tcp[ti][1] / (dv.tcp[0][1] + dv.tcp[1][1])), flat: run({}), byWhoIsLeft: run({ iotaX: { own: x.own, cross: x.cross, sib: x.sib } }) });
  });
  const mae = (k) => { const r = rows.filter((q) => q[k] != null); return r.length ? r4(sum(r.map((q) => Math.abs(q[k] - q.actual))) / r.length) : null; };
  return { _about: "SA 2026 districts where an independent reached the final two, counted from the actual primaries on the model's flows: the independent's two-candidate share with its take of preferences as one share per class (flat) and by who else is left (byWhoIsLeft), against the count. null = the model's count left the independent out of the final two.", rows, meanAbsError: { flat: mae("flat"), byWhoIsLeft: mae("byWhoIsLeft") } };
}
/* ---- how often an independent's first-preference vote became a win, election by election ----
   The stores' elections since 2022, federal and South Australian: every independent on 15% or more, and how
   many won, by band. SA 2026 is the one election here with a field as split as today's polls (One Nation
   above 20%, a major party under 20%). */
function conversion() {
  return [["2022", "res-2022", "Federal 2022"], ["2025", "res-2025", "Federal 2025"], ["sa22", "res-sa22", "SA 2022"], ["sa26", "res-sa26", "SA 2026"]].map(([id, file, label]) => {
    const R = J(`map/data/${file}.json`), bands = { "15-20": [0, 0], "20-30": [0, 0], "30+": [0, 0] }, t5 = { alp: 0, lnp: 0, onp: 0, grn: 0 }; let T = 0;
    for (const dv of R.divs) {
      const tot = sum(dv.c.map((c) => c[4])); T += tot;
      for (const c of dv.c) { if (t5[c[3]] != null) t5[c[3]] += c[4]; if (c[3] !== "ind") continue; const sh = c[4] / tot; if (sh < 0.15) continue; const b = bands[sh < 0.2 ? "15-20" : sh < 0.3 ? "20-30" : "30+"]; b[0]++; if (c[6] === 1) b[1]++; }
    }
    const all = Object.values(bands);
    return { id, label, vote: Object.fromEntries(Object.entries(t5).map(([k, v]) => [k, r4(v / T)])), bands: Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, { n: v[0], won: v[1] }])), n: sum(all.map((v) => v[0])), won: sum(all.map((v) => v[1])) };
  });
}
const check = { sa26: checkSA26(), conversion: conversion() };
const out = {
  _about: "calibrate-independents.mjs: the record the seat model draws independents from (independents.mjs). sitting = sitting independents contesting the next election, logit change in their share; transitions = seats a party held with no sitting independent on the ballot: the strongest losing independent's share at the election before (tp) and the strongest independent's at this one (te). settings = the kernel and thresholds; now = the fits the 2028 run uses; before = the same as they stood before each election (the backtest's); byElection = the record tallied (standing: tp of 10% or more; fresh: under 10%; serious: te of 10% or more).",
  settings: IND_K, elections: ELECTIONS,
  now: { ...now, robustSd: r4(full.robustSd), se: r4(full.sig / Math.sqrt(full.n)), examples },
  before: Object.fromEntries(ELECTIONS.filter((E) => E >= 2001).map((E) => [E, fitAt(E)])),
  byElection, check, sitting, transitions,
};
writeFileSync("data/seat-model-independents.json", JSON.stringify(out) + "\n");
console.log(`sitting independents: ${sitting.length} contests, mean logit change ${now.sitting.mean} (se ${out.now.se}), spread ${now.sitting.sig} (robust ${out.now.robustSd})`);
console.log(`transitions: ${transitions.length} seat-elections; the 2028 window ${now.window.join(", ")}`);
console.log("election | seats | standing challenge (10%+ last time): n, kept half or more, won | fresh: n, serious (10%+), final two, won");
for (const [E, b] of Object.entries(byElection)) console.log(`  ${E} | ${b.seats} | ${b.standing}, ${b.standingKept}, ${b.standingWon} | ${b.fresh}, ${b.freshSerious}, ${b.freshFinal}, ${b.freshWon}`);
console.log("a seat's challenge by its independent's previous share: cases near | none | 10%+ | 20%+ | 30%+ | central | mean");
for (const e of examples) console.log(`  ${(100 * e.tp).toFixed(0).padStart(3)}% | ${String(e.cases).padStart(6)} | ${(100 * e.none).toFixed(1).padStart(5)} | ${(100 * e.p10).toFixed(1).padStart(5)} | ${(100 * e.p20).toFixed(1).padStart(5)} | ${(100 * e.p30).toFixed(1).padStart(5)} | ${(100 * e.central).toFixed(1).padStart(5)} | ${(100 * e.mean).toFixed(1)}`);
console.log("SA 2026, an independent in the final two (two-candidate share): district | actual | one share per class | by who is left");
for (const q of check.sa26.rows) console.log(`  ${q.district.padEnd(14)} v ${q.against.padEnd(4)} | ${(100 * q.actual).toFixed(1)} | ${q.flat == null ? "out" : (100 * q.flat).toFixed(1)} | ${q.byWhoIsLeft == null ? "out" : (100 * q.byWhoIsLeft).toFixed(1)}`);
console.log(`  mean absolute error: ${(100 * check.sa26.meanAbsError.flat).toFixed(1)} -> ${(100 * check.sa26.meanAbsError.byWhoIsLeft).toFixed(1)} points`);
console.log("independents on 15% or more who won: " + check.conversion.map((e) => `${e.label} ${e.won} of ${e.n} (15-30%: ${e.bands["15-20"].won + e.bands["20-30"].won} of ${e.bands["15-20"].n + e.bands["20-30"].n})`).join("; "));
console.log("wrote data/seat-model-independents.json");
