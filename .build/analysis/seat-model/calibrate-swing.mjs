#!/usr/bin/env node
/* calibrate-swing.mjs: how far seats stray from a logit swing, fitted on past elections.

   For every federal election 2007-2025, each seat's primary for each party group is predicted
   from its notional previous-election share (the AEC's printed swing column) by a logit shift
   that reproduces the party's ACTUAL state total (oracle state totals, so nothing here is
   polling error). The leftover per seat, on the logit scale, is split into
     - a shock shared by seats of the same AEC class in that election (sigmaClass)
     - seat noise (sigmaSeat), with its tail weight measured as excess kurtosis -> Student-t df
   A second pass with only the NATIONAL total oracle measures how far states stray (sigmaState).
   SA 2026 (One Nation's surge, the Liberal collapse) is scored the same way from each district's
   federal-2025 booth footprint, as the realignment check.
   Writes the `swing` block of data/seat-model-calibration.json. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const YEARS = [2007, 2010, 2013, 2016, 2019, 2022, 2025];
const GROUPS = ["alp", "lnp", "grn", "onp"];
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const load = (f) => JSON.parse(readFileSync(f, "utf8"));
const sum = (a) => a.reduce((s, x) => s + x, 0);
function shift(xs, ws, target) { // logit shift c so the weighted mean of ilogit(x+c) hits target
  let c = 0;
  for (let it = 0; it < 60; it++) {
    let f = 0, d = 0, W = 0;
    for (let i = 0; i < xs.length; i++) { const p = ilogit(xs[i] + c); f += ws[i] * p; d += ws[i] * p * (1 - p); W += ws[i]; }
    const g = f / W - target; if (Math.abs(g) < 1e-10) break; c -= g / (d / W);
  }
  return c;
}
const rows = []; // {E, b, st, cls, w, x (base logit), y (actual logit)}
for (const E of YEARS) {
  const D = load(`map/data/res-${E}.json`);
  for (const dv of D.divs) {
    const tot = sum(dv.c.map((c) => c[4]));
    for (const b of GROUPS) {
      const cs = dv.c.filter((c) => c[3] === b);
      if (!cs.length || cs.some((c) => c[5] == null)) continue;
      const share = sum(cs.map((c) => c[4])) / tot, base = share - sum(cs.map((c) => c[5])) / 100;
      if (share < 0.01 || base < 0.01) continue;
      rows.push({ E, b, div: dv.n, st: dv.st, cls: dv.cls, w: tot, x: logit(base), y: logit(share) });
    }
  }
}
function resid(byState) {
  const out = [];
  for (const E of YEARS) for (const b of GROUPS) {
    const rs = rows.filter((r) => r.E === E && r.b === b);
    if (rs.length < 20) continue;
    const groups = byState ? [...new Set(rs.map((r) => r.st))] : [null];
    for (const g of groups) {
      const gr = byState ? rs.filter((r) => r.st === g) : rs;
      const target = sum(gr.map((r) => r.w * ilogit(r.y))) / sum(gr.map((r) => r.w));
      const c = shift(gr.map((r) => r.x), gr.map((r) => r.w), target);
      for (const r of gr) out.push({ ...r, e: r.y - (r.x + c), p: ilogit(r.x + c) });
    }
  }
  return out;
}
function decompose(res, label) {
  const out = {};
  for (const b of GROUPS) {
    const rs = res.filter((r) => r.b === b);
    // class shock: mean residual per election x class
    const cm = {}; for (const r of rs) { const k = r.E + "|" + r.cls; (cm[k] = cm[k] || []).push(r.e); }
    const means = Object.values(cm).filter((a) => a.length >= 5);
    const within = sum(rs.map((r) => (r.e - sum(cm[r.E + "|" + r.cls]) / cm[r.E + "|" + r.cls].length) ** 2)) / rs.length;
    const between = sum(means.map((a) => (sum(a) / a.length) ** 2)) / means.length;
    const sigClass = Math.sqrt(Math.max(0, between - within / (rs.length / means.length)));
    const sigSeat = Math.sqrt(within);
    const z = rs.map((r) => (r.e - sum(cm[r.E + "|" + r.cls]) / cm[r.E + "|" + r.cls].length) / sigSeat);
    const kurt = sum(z.map((v) => v ** 4)) / z.length - 3;
    const df = kurt > 0.05 ? Math.max(3, Math.min(30, 4 + 6 / kurt)) : 30;
    const ptsMAE = sum(rs.map((r) => Math.abs(ilogit(r.y) - r.p))) / rs.length * 100;
    const byE = {}; for (const E of YEARS) { const e = rs.filter((r) => r.E === E); if (e.length) byE[E] = +Math.sqrt(sum(e.map((r) => r.e * r.e)) / e.length).toFixed(3); }
    out[b] = { n: rs.length, sigmaSeat: +sigSeat.toFixed(3), sigmaClass: +sigClass.toFixed(3), excessKurtosis: +kurt.toFixed(2), tDf: +df.toFixed(1), maePts: +ptsMAE.toFixed(2), rmsByElection: byE };
    console.log(`  ${label} ${b.padEnd(4)} n ${String(rs.length).padStart(4)}  seat ${sigSeat.toFixed(3)}  class ${sigClass.toFixed(3)}  kurtosis ${kurt.toFixed(2)} (t df ${df.toFixed(1)})  MAE ${ptsMAE.toFixed(2)} pts  RMS by election ${JSON.stringify(byE)}`);
  }
  return out;
}
console.log("Seat residuals from a logit swing with ORACLE STATE totals (logit units):");
const st = decompose(resid(true), "state-oracle");
console.log("\nSame with only the NATIONAL total known (adds state deviations):");
const nat = decompose(resid(false), "nat-oracle ");
// state deviations: SD of state-level mean residual under the national oracle
const resN = resid(false), sdev = {};
for (const b of GROUPS) {
  const m = {}; for (const r of resN.filter((r) => r.b === b)) { const k = r.E + "|" + r.st; (m[k] = m[k] || [0, 0]); m[k][0] += r.w * r.e; m[k][1] += r.w; }
  const v = Object.values(m).filter((a) => a[1] > 0).map((a) => a[0] / a[1]);
  sdev[b] = +Math.sqrt(sum(v.map((x) => x * x)) / v.length).toFixed(3);
}
console.log("\nState deviation SD (logit), national oracle: " + JSON.stringify(sdev));

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
    sa[g] = { n: rs.length, rmsLogit: +Math.sqrt(sum(e.map((v) => v * v)) / e.length).toFixed(3), maePts: +(100 * sum(rs.map((r, i) => Math.abs(ilogit(r.y) - ilogit(r.x + c)))) / rs.length).toFixed(2) };
  }
  console.log("\nSA 2026 from the federal-2025 footprint, statewide oracle (logit RMS, pts MAE): " + JSON.stringify(sa));
}
const path = "data/seat-model-calibration.json";
const cal = existsSync(path) ? load(path) : {};
cal.swing = { _about: "calibrate-swing.mjs: seat residuals from a logit swing with oracle state totals, federal 2007-2025 (logit units). sigmaSeat = within election x class; sigmaClass = shared by AEC class within an election; tDf from excess kurtosis; stateDev = SD of state deviations with only the national total known; sa26 = realignment check from the federal-2025 footprint.", stateOracle: st, nationalOracle: nat, stateDev: sdev, sa26: sa };
writeFileSync(path, JSON.stringify(cal, null, 1) + "\n");
console.log("\nwrote " + path + " (swing)");
