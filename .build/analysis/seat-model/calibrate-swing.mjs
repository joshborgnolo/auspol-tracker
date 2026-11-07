#!/usr/bin/env node
/* calibrate-swing.mjs: how seats move against a logit swing, fitted on every federal election 1996-2025.

   For every election, each seat's primary for each party group is predicted from its notional
   previous-election share (the AEC's printed swing column) by a logit shift per election x state x party
   that reproduces the ACTUAL state total (oracle state totals, so nothing here is polling error), plus the
   seat terms of swing-fit.mjs: the sitting member's personal vote (gained when the party's candidate is the
   sitting member, lost when the previous one is gone), defections, and the share of a seat's previous
   surprise it carries forward (reversion). Sitting members: data/house-incumbency.json
   (extract-incumbency.mjs). The leftover per seat, on the logit scale, is split into
     - a shock shared by seats of the same AEC class in that election (sigmaClass)
     - seat noise (sigmaSeat), with its tail weight measured as excess kurtosis -> Student-t df
   A second pass with only the NATIONAL total oracle measures how far states stray (stateDev).
   Out of sample: every term refitted on the elections before each of 2001-2025 and scored on it.
   SA 2026 (One Nation's surge, the Liberal collapse) is scored from each district's federal-2025 booth
   footprint, as the realignment check; the Coalition's 1998 fall to One Nation is the federal one.
   The noise multiplier is the one backtest-long.mjs scores best (data/seat-model-backtest-long.json).
   Writes the `swing` block of data/seat-model-calibration.json (keys read by model-sim.mjs and the /model/
   page are kept: stateOracle[b].rmsByElection, sa26[b].rmsLogit, stateDev). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadHistory, historyRows, fitTerms, residualize, stateDeviation, rmsOf, LONG_YEARS, PREV_OF, GROUPS } from "./swing-fit.mjs";

const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const load = (f) => JSON.parse(readFileSync(f, "utf8"));
const sum = (a) => a.reduce((s, x) => s + x, 0);
const r3 = (x) => (x == null ? null : +x.toFixed(3));
const H = loadHistory(), ROWS = historyRows(H);
const FIT_YEARS = LONG_YEARS.filter((y) => y >= 1996);
const fit = fitTerms(ROWS, FIT_YEARS);
const zero = { incE: 0, incP: 0, defect: 0, rho: 0 };

console.log("Seat terms, 1996-2025 (logit; Huber-weighted, state totals given):");
for (const [b, t] of Object.entries(fit.terms)) console.log(`  ${b.padEnd(4)} sitting member ${t.incE.toFixed(3)}  previous member gone ${t.incP.toFixed(3)}  defection ${t.defect.toFixed(3)}  reversion ${t.rho.toFixed(3)}`);
const eras = {};
for (const [lo, hi] of [[1996, 2007], [2010, 2025]]) {
  const f = fitTerms(ROWS, FIT_YEARS.filter((y) => y >= lo && y <= hi));
  eras[`${lo}-${hi}`] = Object.fromEntries(Object.entries(f.terms).filter(([b]) => b !== "onp").map(([b, t]) => [b, { incE: r3(t.incE), incP: r3(t.incP), defect: r3(t.defect), rho: r3(t.rho) }]));
  console.log(`  ${lo}-${hi}: ${JSON.stringify(eras[`${lo}-${hi}`])}`);
}

/* decomposition of the leftover (with the terms), per party */
function decompose(rs, label, years) {
  const out = {};
  for (const b of GROUPS) {
    const xs = rs.filter((r) => r.b === b && years.includes(r.E));
    if (xs.length < 30) continue;
    const cm = {}; for (const r of xs) { const k = r.E + "|" + r.cls; (cm[k] = cm[k] || []).push(r.e); }
    const means = Object.values(cm).filter((a) => a.length >= 5);
    const dm = (r) => r.e - sum(cm[r.E + "|" + r.cls]) / cm[r.E + "|" + r.cls].length;
    const within = sum(xs.map((r) => dm(r) ** 2)) / xs.length;
    const between = sum(means.map((a) => (sum(a) / a.length) ** 2)) / means.length;
    const sigClass = Math.sqrt(Math.max(0, between - within / (xs.length / means.length)));
    const sigSeat = Math.sqrt(within);
    const z = xs.map((r) => dm(r) / sigSeat);
    const kurt = sum(z.map((v) => v ** 4)) / z.length - 3;
    const df = kurt > 0.05 ? Math.max(3, Math.min(30, 4 + 6 / kurt)) : 30;
    const ptsMAE = sum(xs.map((r) => Math.abs(ilogit(r.y) - ilogit(r.pred)))) / xs.length * 100;
    const byE = {}; for (const E of years) { const e = xs.filter((r) => r.E === E); if (e.length >= 10) byE[E] = r3(rmsOf(e.map((r) => r.e))); }
    out[b] = { n: xs.length, sigmaSeat: r3(sigSeat), sigmaClass: r3(sigClass), excessKurtosis: +kurt.toFixed(2), tDf: +df.toFixed(1), maePts: +ptsMAE.toFixed(2), rmsByElection: byE };
    console.log(`  ${label} ${b.padEnd(4)} n ${String(xs.length).padStart(4)}  seat ${sigSeat.toFixed(3)}  class ${sigClass.toFixed(3)}  kurtosis ${kurt.toFixed(2)} (t df ${df.toFixed(1)})  MAE ${ptsMAE.toFixed(2)} pts  RMS by election ${JSON.stringify(byE)}`);
  }
  return out;
}
console.log("\nSeat residuals with the terms, state totals given (logit):");
const st = decompose(fit.rows, "terms", FIT_YEARS);
const plainRows = []; for (const b of GROUPS) { const rs = ROWS.filter((r) => r.b === b && FIT_YEARS.includes(r.E)).map((r) => ({ ...r })); residualize(rs, () => 0); plainRows.push(...rs); }
console.log("\nThe same without the terms (the model before this calibration):");
const plain = decompose(plainRows, "plain", FIT_YEARS);
const recent = decompose(fit.rows, "2010-25", FIT_YEARS.filter((y) => y >= 2010));
const sdev = Object.fromEntries(Object.entries(stateDeviation(fit.rows, FIT_YEARS, fit.terms)).map(([b, v]) => [b, r3(v)]));
console.log("\nState deviation SD (logit), national total only: " + JSON.stringify(sdev));

/* out of sample: terms refitted before each election, scored on it */
const oos = {};
for (const b of ["alp", "lnp", "grn"]) {
  const per = {}; let s0 = 0, s1 = 0, n = 0;
  for (const E of FIT_YEARS.filter((y) => y >= 2001)) {
    const f = fitTerms(ROWS, FIT_YEARS.filter((y) => y < E));
    const t = f.terms[b] || zero;
    // E's rows: stage-1 residuals at P with the trained coefficients feed the reversion term
    const P = PREV_OF[E];
    const pre = ROWS.filter((r) => r.b === b && r.E === P).map((r) => ({ ...r }));
    residualize(pre, (r) => t.incE * r.incE + t.incP * r.incP + t.defect * r.defect);
    const eP = new Map(pre.map((r) => [r.div, r.e]));
    const test = ROWS.filter((r) => r.b === b && r.E === E).map((r) => ({ ...r }));
    const base = test.map((r) => ({ ...r }));
    residualize(base, () => 0);
    residualize(test, (r) => t.incE * r.incE + t.incP * r.incP + t.defect * r.defect + t.rho * (r.hasP ? eP.get(r.div) ?? 0 : 0));
    const a = rmsOf(base.map((r) => r.e)), c = rmsOf(test.map((r) => r.e));
    const mae = (rs) => 100 * sum(rs.map((r) => Math.abs(ilogit(r.y) - ilogit(r.pred)))) / rs.length;
    per[E] = { plain: r3(a), terms: r3(c), maePlain: +mae(base).toFixed(2), maeTerms: +mae(test).toFixed(2) };
    s0 += a * a * base.length; s1 += c * c * test.length; n += base.length;
  }
  oos[b] = { rmsPlain: r3(Math.sqrt(s0 / n)), rmsTerms: r3(Math.sqrt(s1 / n)), byElection: per };
  console.log(`out of sample ${b}: RMS ${oos[b].rmsPlain} -> ${oos[b].rmsTerms}; ${Object.entries(per).map(([E, v]) => `${E} ${v.plain}->${v.terms}`).join("  ")}`);
}

/* a party's seat noise when it falls: the residual RMS against its own calm level */
const natShare = (y, b) => { let v = 0, t = 0; for (const dv of H.RES[y].divs) for (const c of dv.c) { t += c[4]; if (c[3] === b) v += c[4]; } return v / t; };
const moves = [];
for (const b of GROUPS) for (const E of FIT_YEARS) {
  const e = fit.rows.filter((r) => r.b === b && r.E === E).map((r) => r.e); if (e.length < 40) continue;
  const sP = natShare(PREV_OF[E], b), sE = natShare(E, b); if (sP < 0.005) continue;
  moves.push({ E, b, move: r3(logit(sE) - logit(sP)), rms: r3(rmsOf(e)), n: e.length });
}
const calm = (b, E) => { const ys = moves.filter((m) => m.b === b && m.E !== E && Math.abs(m.move) < 0.15 && Math.abs(m.E - E) <= 9).map((m) => m.rms); return ys.length ? rmsOf(ys) : null; };
const falls = moves.filter((m) => m.move < -0.2).map((m) => { const c = calm(m.b, m.E); const k = c != null && m.rms > c ? Math.sqrt(m.rms ** 2 - c ** 2) / -m.move : 0; return { ...m, calm: r3(c), k: r3(k) }; });
console.log("\nfalls of more than 0.2 logit (residual RMS v the party's calm years within 9 years; k = extra / fall):");
for (const f of falls) console.log(`  ${f.E} ${f.b.padEnd(4)} fall ${f.move}  RMS ${f.rms} v calm ${f.calm}  k ${f.k}`);

// ---- SA 2026: district primaries from the federal-2025 booth footprint, statewide oracle
function boothRows(D) {
  const B = D.booths, out = [];
  for (let i = 0; i < B.id.length; i++) {
    const dv = D.divs[B.d[i]], v = B.v[i]; if (!v || B.lat[i] == null) continue;
    const tot = sum(v); if (tot <= 0) continue;
    const sh = {}; v.forEach((x, j) => { const c = dv.c[j]; if (c) sh[c[3]] = (sh[c[3]] || 0) + x / tot; });
    out.push({ d: B.d[i], st: dv.st, lat: B.lat[i], lon: B.lon[i], tot, sh });
  }
  return out;
}
function shift(xs, ws, target) { let c = 0; for (let it = 0; it < 60; it++) { let f = 0, d = 0, W = 0; for (let i = 0; i < xs.length; i++) { const p = ilogit(xs[i] + c); f += ws[i] * p; d += ws[i] * p * (1 - p); W += ws[i]; } const g = f / W - target; if (Math.abs(g) < 1e-10) break; c -= g / (d / W); } return c; }
const km = (a, b) => { const R = 6371, r = Math.PI / 180; const x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return R * Math.sqrt(x * x + y * y); };
const sa = {};
if (existsSync("map/data/res-sa26.json")) {
  const fed = load("map/data/res-2025.json"), s26 = load("map/data/res-sa26.json");
  const fb = boothRows(fed).filter((b) => b.st === "SA" && b.tot >= 30), tb = boothRows(s26);
  const foot = s26.divs.map(() => ({ w: 0 }));
  for (const b of tb) { let best = null, bd = 1e9; for (const f of fb) { const d = km(b, f); if (d < bd) { bd = d; best = f; } } if (!best || bd > 25) continue; const F = foot[b.d]; F.w += b.tot; for (const g of GROUPS) F[g] = (F[g] || 0) + b.tot * (best.sh[g] || 0); }
  for (const g of GROUPS) {
    const rs = [];
    s26.divs.forEach((dv, i) => { const tot = sum(dv.c.map((c) => c[4])); const sh = sum(dv.c.filter((c) => c[3] === g).map((c) => c[4])) / tot; const base = foot[i].w ? foot[i][g] / foot[i].w : null; if (sh > 0.01 && base > 0.005) rs.push({ w: tot, x: logit(base), y: logit(sh) }); });
    const target = sum(rs.map((r) => r.w * ilogit(r.y))) / sum(rs.map((r) => r.w));
    const c = shift(rs.map((r) => r.x), rs.map((r) => r.w), target);
    const e = rs.map((r) => r.y - r.x - c);
    sa[g] = { n: rs.length, rmsLogit: r3(Math.sqrt(sum(e.map((v) => v * v)) / e.length)), maePts: +(100 * sum(rs.map((r) => Math.abs(ilogit(r.y) - ilogit(r.x + c)))) / rs.length).toFixed(2) };
  }
  console.log("\nSA 2026 from the federal-2025 footprint, statewide oracle (logit RMS, pts MAE): " + JSON.stringify(sa));
}

/* the noise multiplier, from backtest-long.mjs (house flows, national vote given). Seat noise has grown
   election by election, so the rule reads the elections in today's noise regime (2016-2025) and scores them
   by Brier score, ties (within 0.0005) going to the smaller multiplier. Not by log score: from 1.3 up it
   keeps rising only through a handful of wins no starting point foresees - new independents (Curtin 2022:
   0.0000 -> 0.0010), Mayo 2016 - which more noise everywhere "buys" at a cost in 522 of the 602 recent
   seats (checked with AUSPOL_BL_DUMP). The whole 2001-2025 record is kept beside it. */
let sigMult = null;
if (existsSync("data/seat-model-backtest-long.json")) {
  const BL = load("data/seat-model-backtest-long.json");
  const multOf = (v) => (v === "terms" ? 1.3 : /^terms-m([\d.]+)$/.test(v) ? +v.match(/^terms-m([\d.]+)$/)[1] : null);
  const rs = BL.results.filter((r) => r.mode === "house" && !r.stateOracle && multOf(r.variant) != null);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const mults = [...new Set(rs.map((r) => multOf(r.variant)))].sort((a, b) => a - b);
  const grid = mults.map((m) => { const all = rs.filter((r) => multOf(r.variant) === m), rec = all.filter((r) => r.E >= 2016); return { mult: m, brierRecent: +mean(rec.map((r) => r.brier)).toFixed(4), logRecent: +mean(rec.map((r) => r.logScore)).toFixed(4), brierAll: +mean(all.map((r) => r.brier)).toFixed(4), logAll: +mean(all.map((r) => r.logScore)).toFixed(4), elections: all.length }; });
  if (grid.length) {
    const best = Math.min(...grid.map((g) => g.brierRecent));
    const pick = grid.find((g) => g.brierRecent <= best + 0.0005);
    const bestAll = [...grid].sort((a, b) => a.brierAll - b.brierAll)[0];
    sigMult = { value: pick.mult, bestAll: bestAll.mult, recentFrom: 2016, grid, rule: "smallest multiplier within 0.0005 of the best mean Brier score over 2016-2025 (house flows, national vote given); bestAll = best mean Brier over 2001-2025" };
    console.log(`\nnoise multiplier: ${pick.mult} (best over 2001-2025: ${bestAll.mult}); ${JSON.stringify(grid)}`);
  }
}

const path = "data/seat-model-calibration.json";
const cal = existsSync(path) ? load(path) : {};
cal.swing = {
  _about: "calibrate-swing.mjs: seat residuals from a logit swing with oracle state totals, federal 1996-2025 (logit units), after the seat terms (sitting members, defections, reversion; swing-fit.mjs). sigmaSeat = within election x class; sigmaClass = shared by AEC class within an election; tDf from excess kurtosis; stateDev = SD of state deviations with only the national total known; plain = the same with no seat terms; oos = the terms refitted before each election 2001-2025 and scored on it; falls = residual RMS when a party fell more than 0.2 logit, against its calm years (k = extra noise per unit fall, the model's kFall); sa26 = realignment check from the federal-2025 footprint; sigMult = backtest-long.mjs's best noise multiplier.",
  years: FIT_YEARS,
  terms: Object.fromEntries(Object.entries(fit.terms).filter(([b]) => b !== "onp").map(([b, t]) => [b, { incE: r3(t.incE), incP: r3(t.incP), defect: r3(t.defect), rho: r3(t.rho), ...(t.borrowed ? { borrowed: true } : {}) }])),
  termsByEra: eras,
  stateOracle: st, plain, recent: recent, nationalOracle: undefined, stateDev: sdev, oos, falls, sa26: sa,
  ...(sigMult ? { sigMult } : {}),
};
delete cal.swing.nationalOracle;
writeFileSync(path, JSON.stringify(cal, null, 1) + "\n");
console.log("\nwrote " + path + " (swing)");
