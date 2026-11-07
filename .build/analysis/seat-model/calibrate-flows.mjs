#!/usr/bin/env node
/* calibrate-flows.mjs: how House preference flows relate to the same voters' Senate rankings.

   Every counted House flow 2016-2025 whose final pair is two of Labor (A), Coalition (C),
   Greens (G), One Nation (O) is set against the same division's Senate ballots for the donor's
   cohort (maps/data/res-<year>.json `fl` rows = the AEC's two-candidate-preferred flow of each
   excluded candidate's own first preferences). On the logit scale,

       logit(House share) - logit(Senate share) = delta[class, pair] + u[election, class] + v

   delta  the chamber offset (how-to-vote cards, the House's compulsory full numbering, ballot
          design), per donor class (ALP, COAL, GRN, ON, OTH-R/-M/-L) and recipient pair, shrunk
          toward the class's pooled offset (pairs with few counts borrow from the class)
   u      how far an election as a whole moves off it (a national flow shock), SD sigmaU
   v      seat-level noise around it, SD sigmaV (net of binomial sampling)

   A second fit uses the PREVIOUS election's Senate ballots (2016 for the 2019 House, ...),
   which is what a forecast has: its sigmas include the drift between elections. The local
   relative-strength term (the two finalists' primary ratio) is tested both within an election and
   as a change between elections. Writes data/seat-model-flow-calibration.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { cohortTable, pairShare, cohortKeyFor, FAM } from "./senate-flows.mjs";
import { loadRankings } from "./senate-io.mjs";

const YEARS = [2016, 2019, 2022, 2025];
const LAG = { 2019: 2016, 2022: 2019, 2025: 2022 };
const CLASSES = ["ALP", "COAL", "GRN", "ON", "OTH-R", "OTH-M", "OTH-L"];
const FAM_OF_BUCKET = { alp: 0, lnp: 1, grn: 2, onp: 3 };
const GROUP_OF = (c) => (c[3] === "alp" ? "alp" : c[3] === "grn" ? "grn" : c[3] === "onp" ? "on"
  : c[3] === "lnp" ? ({ LP: "lp", NP: "np", NAT: "np", LNP: "lnp", LNQ: "lnp", CLP: "clp" }[c[1]] || "lnp") : c[3] === "ind" ? "member" : "oth");
const classOf = (key) => (key.startsWith("COAL") ? "COAL" : key.startsWith("OTH:") ? null : key);
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const clamp = (p) => Math.min(0.995, Math.max(0.005, p));
const R = Object.fromEntries(YEARS.map((y) => [y, loadRankings(y)]));
const SUBCLASS = JSON.parse(readFileSync("data/senate-rankings-2025.json", "utf8")).subClass;
const donorClass = (key) => classOf(key) || "OTH-" + (SUBCLASS[key.slice(4)] || "M");
const CLS = { "Inner Metropolitan": "inner", "Outer Metropolitan": "outer", "Provincial": "prov", "Rural": "rural" };

function rowsFor(E, senYear) {
  const D = JSON.parse(readFileSync(`maps/data/res-${E}.json`, "utf8"));
  const Rs = R[senYear], out = [];
  for (const dv of D.divs) {
    if (!dv.tcp || dv.tcp.length !== 2 || !Rs.div[dv.n]) continue;
    const fins = dv.tcp.map((t) => FAM_OF_BUCKET[dv.c[t[0]][3]]);
    if (fins.some((f) => f == null) || fins[0] === fins[1]) continue;
    const tot = dv.c.reduce((a, c) => a + c[4], 0);
    const prim = fins.map((f, k) => dv.c[dv.tcp[k][0]][4] / tot);
    // canonical direction: share to the lower family index
    const [x, y] = fins[0] < fins[1] ? [fins[0], fins[1]] : [fins[1], fins[0]];
    const xi = fins[0] === x ? 0 : 1;
    const z = logit(prim[xi] / (prim[0] + prim[1]));
    for (const f of dv.fl || []) {
      const c = dv.c[f[0]];
      const n = f[1] + f[2]; if (n < 100) continue;
      const toX = xi === 0 ? f[1] : f[2];
      const key = cohortKeyFor({ group: GROUP_OF(c), party: c[1], partyName: c[2] });
      const cls = donorClass(key);
      // a Coalition partner excluded with its sibling still in (three-cornered contests) flows to the
      // sibling: the engine's sibling rule, not a Senate-calibrated choice, so it is left out here
      if (cls === "COAL" && (x === 1 || y === 1)) continue;
      const p = cohortTable(Rs, dv.n, key);
      const s = pairShare(Rs, p, x, y);
      const h = toX / n;
      out.push({ E, sen: senYear, div: dv.n, st: dv.st, seatCls: CLS[dv.cls], key, cls, pair: FAM[x] + FAM[y], h, s, n, z,
        y: logit(clamp(h)) - logit(clamp(s)), sv: 1 / (n * clamp(h) * (1 - clamp(h))) });
    }
  }
  return out;
}
/* hierarchical fit by moments: delta[class,pair] shrunk to delta[class]; u per election-class; v */
function fit(rows, label) {
  let sigV2 = 0.04, sigU2 = 0.01;
  let delta = {}, dCls = {}, u = {};
  for (let it = 0; it < 30; it++) {
    const w = (r) => 1 / (r.sv + sigV2 + sigU2);
    // class pooled offsets
    dCls = {}; for (const c of CLASSES) { const rs = rows.filter((r) => r.cls === c); if (!rs.length) continue; const W = rs.reduce((a, r) => a + w(r), 0); dCls[c] = rs.reduce((a, r) => a + w(r) * r.y, 0) / W; }
    // pair offsets shrunk toward the class (pseudo-weight K = 25 seat-rows' worth)
    delta = {};
    const K = 25 / (sigV2 + sigU2);
    for (const r of rows) { const k = r.cls + "|" + r.pair; (delta[k] = delta[k] || { W: 0, S: 0, n: 0 }); delta[k].W += w(r); delta[k].S += w(r) * r.y; delta[k].n++; }
    for (const [k, d] of Object.entries(delta)) { const c = k.split("|")[0]; d.v = (d.S + K * dCls[c]) / (d.W + K); }
    // election-class effects u and their variance
    u = {};
    for (const r of rows) { const k = r.E + "|" + r.cls; const res = r.y - delta[r.cls + "|" + r.pair].v; const wv = 1 / (r.sv + sigV2); (u[k] = u[k] || { W: 0, S: 0, n: 0 }); u[k].W += wv; u[k].S += wv * res; u[k].n++; }
    const uk = Object.values(u).filter((d) => d.n >= 8).map((d) => ({ m: d.S / d.W, se2: 1 / d.W }));
    const newU2 = Math.max(0, uk.reduce((a, d) => a + d.m * d.m - d.se2, 0) / Math.max(1, uk.length));
    // seat noise: residual variance net of sampling, after u
    let num = 0, den = 0;
    for (const r of rows) { const d = u[r.E + "|" + r.cls]; const um = d && d.n >= 8 ? d.S / d.W : 0; const e = r.y - delta[r.cls + "|" + r.pair].v - um; num += e * e - r.sv; den++; }
    const newV2 = Math.max(1e-4, num / den);
    if (Math.abs(newU2 - sigU2) < 1e-6 && Math.abs(newV2 - sigV2) < 1e-6) break;
    sigU2 = newU2; sigV2 = newV2;
  }
  const byCls = {};
  for (const c of CLASSES) {
    const uk = Object.entries(u).filter(([k, d]) => k.endsWith("|" + c) && d.n >= 8).map(([k, d]) => ({ E: +k.split("|")[0], m: d.S / d.W, se2: 1 / d.W }));
    const rs = rows.filter((r) => r.cls === c);
    const um = (r) => { const d = u[r.E + "|" + r.cls]; return d && d.n >= 8 ? d.S / d.W : 0; };
    const sv = rs.length ? Math.sqrt(Math.max(1e-4, rs.reduce((a, r) => a + (r.y - delta[r.cls + "|" + r.pair].v - um(r)) ** 2 - r.sv, 0) / rs.length)) : null;
    byCls[c] = { rows: rs.length, sigmaV: sv == null ? null : +sv.toFixed(3), sigmaU: uk.length >= 2 ? Math.sqrt(Math.max(0, uk.reduce((a, d) => a + d.m * d.m - d.se2, 0) / uk.length)) : null, electionShifts: Object.fromEntries(uk.map((d) => [d.E, +d.m.toFixed(3)])) };
  }
  console.log(`\n=== ${label}: ${rows.length} donor-seat rows; sigmaU ${Math.sqrt(sigU2).toFixed(3)}, sigmaV ${Math.sqrt(sigV2).toFixed(3)} (logit) ===`);
  for (const [k, d] of Object.entries(delta).sort()) console.log(`  ${k.padEnd(12)} n ${String(d.n).padStart(4)}  delta ${d.v >= 0 ? "+" : ""}${d.v.toFixed(3)}  (raw ${(d.S / d.W).toFixed(3)})`);
  for (const c of CLASSES) if (byCls[c].rows) console.log(`  class ${c.padEnd(6)} rows ${String(byCls[c].rows).padStart(4)} pooled ${dCls[c]?.toFixed(3)} sigmaV ${byCls[c].sigmaV} sigmaU ${byCls[c].sigmaU?.toFixed(3) ?? "-"} shifts ${JSON.stringify(byCls[c].electionShifts)}`);
  return { sigmaU: Math.sqrt(sigU2), sigmaV: Math.sqrt(sigV2), delta: Object.fromEntries(Object.entries(delta).map(([k, d]) => [k, { v: +d.v.toFixed(4), n: d.n }])), classPooled: Object.fromEntries(Object.entries(dCls).map(([k, v]) => [k, +v.toFixed(4)])), byClass: byCls, u };
}
/* predictive check: same-election leave-one-election-out (offsets from the other elections) */
const prevHouse = {};
function check(rows, label) {
  const out = {};
  for (const E of [...new Set(rows.map((r) => r.E))]) {
    const train = rows.filter((r) => r.E !== E), test = rows.filter((r) => r.E === E);
    if (!train.length) continue;
    const f = fit(train.map((r) => ({ ...r })), `${label} (offsets fitted without ${E})`);
    let eSen = 0, eRaw = 0, eFlat = 0, W = 0;
    const lv = {}; // per class: oracle level-given errors for the Senate pattern, flat, previous House seat flow
    const byC = {}; for (const r of test) (byC[r.cls + "|" + r.pair] = byC[r.cls + "|" + r.pair] || []).push(r);
    for (const [k, rs] of Object.entries(byC)) {
      const c = k.split("|")[0];
      const d = f.delta[k]?.v ?? f.classPooled[c] ?? 0;
      const predL = rs.map((r) => logit(clamp(r.s)) + d);
      // oracle level: shift so the vote-weighted mean logit matches the test election's
      const wsum = rs.reduce((a, r) => a + r.n, 0), my = rs.reduce((a, r) => a + r.n * logit(clamp(r.h)), 0) / wsum;
      const shiftS = my - rs.reduce((a, r, i) => a + r.n * predL[i], 0) / wsum;
      const L = (lv[c] = lv[c] || { sen: 0, flat: 0, prev: 0, prevN: 0, prevFlat: 0, W: 0 });
      rs.forEach((r, i) => {
        L.sen += r.n * Math.abs(ilogit(predL[i] + shiftS) - r.h); L.flat += r.n * Math.abs(ilogit(my) - r.h); L.W += r.n;
        const ph = prevHouse[(r.E - 3) + "|" + r.div + "|" + r.key + "|" + r.pair];
        if (ph != null) { L.prevN += r.n; L.prev += r.n * Math.abs(ph + (my - (prevMean[(r.E - 3) + "|" + k] ?? my)) > 0 ? Math.abs(ilogit(logit(clamp(ph)) + (my - (prevMean[(r.E - 3) + "|" + k] ?? my))) - r.h) : 0); L.prevFlat += r.n * Math.abs(ilogit(my) - r.h); }
      });
    }
    const flatBy = {}; for (const r of train) { const k = r.cls + "|" + r.pair; (flatBy[k] = flatBy[k] || [0, 0]); flatBy[k][0] += r.n * r.h; flatBy[k][1] += r.n; }
    for (const r of test) {
      const d = f.delta[r.cls + "|" + r.pair]?.v ?? f.classPooled[r.cls] ?? 0;
      const pred = ilogit(logit(clamp(r.s)) + d), fb = flatBy[r.cls + "|" + r.pair];
      const flat = fb ? fb[0] / fb[1] : r.s;
      eSen += r.n * Math.abs(pred - r.h); eRaw += r.n * Math.abs(r.s - r.h); eFlat += r.n * Math.abs(flat - r.h); W += r.n;
    }
    out[E] = { senateCalibrated: +(100 * eSen / W).toFixed(2), senateRaw: +(100 * eRaw / W).toFixed(2), flatOtherElections: +(100 * eFlat / W).toFixed(2), rows: test.length,
      levelGiven: Object.fromEntries(Object.entries(lv).map(([c, L]) => [c, { senate: +(100 * L.sen / L.W).toFixed(2), flat: +(100 * L.flat / L.W).toFixed(2),
        prevHouseSeat: L.prevN ? +(100 * L.prev / L.prevN).toFixed(2) : null, flatOnPrevSeats: L.prevN ? +(100 * L.prevFlat / L.prevN).toFixed(2) : null }])) };
  }
  console.log(`\n${label}: vote-weighted MAE (pts), offsets from the OTHER elections:`);
  for (const [E, o] of Object.entries(out)) {
    console.log(`  ${E}: Senate calibrated ${o.senateCalibrated}, raw ${o.senateRaw}, flat ${o.flatOtherElections} (${o.rows} rows)`);
    for (const [c, L] of Object.entries(o.levelGiven)) console.log(`      level given, ${c.padEnd(6)} Senate ${L.senate} | flat ${L.flat}` + (L.prevHouseSeat != null ? ` | seat's previous House flow ${L.prevHouseSeat} (flat on those ${L.flatOnPrevSeats})` : ""));
  }
  return out;
}

const same = YEARS.flatMap((E) => rowsFor(E, E));
const prevMean = {};
{ const acc = {}; for (const r of same) { prevHouse[r.E + "|" + r.div + "|" + r.key + "|" + r.pair] = r.h; const k = r.E + "|" + r.cls + "|" + r.pair; (acc[k] = acc[k] || [0, 0]); acc[k][0] += r.n * logit(clamp(r.h)); acc[k][1] += r.n; }
  for (const [k, a] of Object.entries(acc)) prevMean[k] = a[0] / a[1]; }
const lag = Object.entries(LAG).flatMap(([E, s]) => rowsFor(+E, s));
const fSame = fit(same.map((r) => ({ ...r })), "same-election Senate");
const fLag = fit(lag.map((r) => ({ ...r })), "previous-election Senate");
const cSame = check(same, "same-election"), cLag = check(lag, "previous-election");

// relative strength: within-election (residual on z) and between elections (residual on change in z)
function slope(rows, xk) {
  const ok = rows.filter((r) => Number.isFinite(r[xk]));
  const w = ok.map((r) => 1 / (r.sv + fSame.sigmaV ** 2)); const W = w.reduce((a, b) => a + b, 0);
  const mx = ok.reduce((a, r, i) => a + w[i] * r[xk], 0) / W, my = ok.reduce((a, r, i) => a + w[i] * r.res, 0) / W;
  const b = ok.reduce((a, r, i) => a + w[i] * (r[xk] - mx) * (r.res - my), 0) / ok.reduce((a, r, i) => a + w[i] * (r[xk] - mx) ** 2, 0);
  const se = Math.sqrt(1 / ok.reduce((a, r, i) => a + w[i] * (r[xk] - mx) ** 2, 0));
  return { b: +b.toFixed(3), se: +se.toFixed(3), n: ok.length };
}
for (const r of same) { const d = fSame.delta[r.cls + "|" + r.pair].v; const um = fSame.u[r.E + "|" + r.cls]; r.res = r.y - d - (um && um.n >= 8 ? um.S / um.W : 0); r.zc = r.z; }
const zPrev = {}; for (const r of same) zPrev[r.E + "|" + r.div + "|" + r.pair] = r.z;
for (const r of lag) { const d = fLag.delta[r.cls + "|" + r.pair].v; const um = fLag.u[r.E + "|" + r.cls]; r.res = r.y - d - (um && um.n >= 8 ? um.S / um.W : 0); const zp = zPrev[r.sen + "|" + r.div + "|" + r.pair]; r.dz = zp == null ? NaN : r.z - zp; }
const strength = { withinElection: slope(same, "zc"), changeBetweenElections: slope(lag, "dz") };
console.log("\nrelative strength (logit flow per logit of the finalists' primary ratio): " + JSON.stringify(strength));

const out = {
  _about: "House-v-Senate preference-flow calibration for the seat model (calibrate-flows.mjs). logit(House flow share) - logit(same cohort's Senate share in that division) = delta[donor class|pair] + election shift (SD sigmaU) + seat noise (SD sigmaV). `same` uses the same election's Senate ballots, `lag` the previous election's (what a forecast has). Pairs read as the share to the first family: A Labor, C Coalition, G Greens, O One Nation. Rows: every counted 2016-2025 House flow whose final pair is two of those four families.",
  same: { sigmaU: +fSame.sigmaU.toFixed(4), sigmaV: +fSame.sigmaV.toFixed(4), delta: fSame.delta, classPooled: fSame.classPooled, byClass: fSame.byClass, check: cSame },
  lag: { sigmaU: +fLag.sigmaU.toFixed(4), sigmaV: +fLag.sigmaV.toFixed(4), delta: fLag.delta, classPooled: fLag.classPooled, byClass: fLag.byClass, check: cLag },
  strength,
  rows: { same: same.length, lag: lag.length, pairs: [...new Set(same.map((r) => r.cls + "|" + r.pair))].sort() },
  _provenance: { generated: new Date().toISOString().slice(0, 10), senate: YEARS.map((y) => `data/senate-rankings-${y}.json`), house: YEARS.map((y) => `maps/data/res-${y}.json`) },
};
writeFileSync("data/seat-model-flow-calibration.json", JSON.stringify(out, null, 1) + "\n");
console.log("\nwrote data/seat-model-flow-calibration.json");

/* ---- combining the two seat signals a forecast has: the previous election's Senate ballots and
   the seat's own previous House flow. With the national level of each class|pair given (it is a
   separate shock in the simulation), fit per class
       logit(h_E) - level = lamS * (Senate_{E-3} dev) + lamH * (House_{E-3} seat residual)
   by weighted least squares (weights 1/(binomial + residual variance)), then score each
   election with weights fitted on the other two. */
function combine(rows) {
  const keyOf = (r) => r.cls + "|" + r.pair;
  const lev = {}; for (const r of rows) { const k = r.E + "|" + keyOf(r); (lev[k] = lev[k] || [0, 0, 0, 0]); lev[k][0] += r.n * logit(clamp(r.h)); lev[k][1] += r.n; lev[k][2] += r.n * logit(clamp(r.s)); }
  for (const r of rows) {
    const L = lev[r.E + "|" + keyOf(r)];
    r.t = logit(clamp(r.h)) - L[0] / L[1];
    r.xS = logit(clamp(r.s)) - L[2] / L[1];
    const ph = prevHouse[(r.E - 3) + "|" + r.div + "|" + r.key + "|" + r.pair];
    const pm = prevMean[(r.E - 3) + "|" + keyOf(r)];
    r.xH = ph != null && pm != null ? logit(clamp(ph)) - pm : 0; r.hasH = ph != null ? 1 : 0;
  }
  const wls = (rs, sig2) => {
    // 2x2 normal equations, no intercept (deviations)
    let a = 0, b = 0, c = 0, d = 0, e = 0;
    for (const r of rs) { const w = 1 / (r.sv + sig2); a += w * r.xS * r.xS; b += w * r.xS * r.xH; c += w * r.xH * r.xH; d += w * r.xS * r.t; e += w * r.xH * r.t; }
    const det = a * c - b * b;
    if (a < 1e-12) return { lamS: 0, lamH: c > 0 ? e / c : 0 };
    if (c < 1e-12) return { lamS: d / a, lamH: 0 };
    if (Math.abs(det) < 1e-12) return { lamS: d / a, lamH: 0 };
    return { lamS: (c * d - b * e) / det, lamH: (a * e - b * d) / det };
  };
  const out = {};
  for (const cls of CLASSES) {
    const rs = rows.filter((r) => r.cls === cls && Number.isFinite(r.t));
    if (rs.length < 20) continue;
    let sig2 = 0.1, f;
    for (let it = 0; it < 20; it++) { f = wls(rs, sig2); const res = rs.reduce((acc, r) => acc + (r.t - f.lamS * r.xS - f.lamH * r.xH) ** 2 - r.sv, 0) / rs.length; sig2 = Math.max(0.005, res); }
    // election-out scores (pts, vote-weighted), level given
    const sc = { combo: 0, senate: 0, house: 0, flat: 0, W: 0 };
    for (const E of [...new Set(rs.map((r) => r.E))]) {
      const tr = rs.filter((r) => r.E !== E), te = rs.filter((r) => r.E === E);
      const g = wls(tr, sig2);
      const gs = wls(tr.map((r) => ({ ...r, xH: 0 })), sig2), gh = wls(tr.map((r) => ({ ...r, xS: 0 })), sig2);
      for (const r of te) {
        const base = logit(clamp(r.h)) - r.t; // the oracle level
        const P = (x) => Math.abs(ilogit(base + x) - r.h);
        sc.combo += r.n * P(g.lamS * r.xS + g.lamH * r.xH); sc.senate += r.n * P(gs.lamS * r.xS); sc.house += r.n * P(gh.lamH * r.xH); sc.flat += r.n * P(0); sc.W += r.n;
      }
    }
    const fs1 = wls(rs.map((r) => ({ ...r, xH: 0 })), sig2), fh1 = wls(rs.map((r) => ({ ...r, xS: 0 })), sig2);
    out[cls] = { alone: { lamS: +fs1.lamS.toFixed(3), lamH: +fh1.lamH.toFixed(3) }, rows: rs.length, withHouseHistory: rs.filter((r) => r.hasH).length, lamS: +f.lamS.toFixed(3), lamH: +f.lamH.toFixed(3), sigmaResid: +Math.sqrt(sig2).toFixed(3),
      electionOutMAE: { combined: +(100 * sc.combo / sc.W).toFixed(2), senateOnly: +(100 * sc.senate / sc.W).toFixed(2), houseOnly: +(100 * sc.house / sc.W).toFixed(2), flat: +(100 * sc.flat / sc.W).toFixed(2) } };
  }
  console.log("\nForecast-style combination (previous election's Senate + seat's previous House flow, national level given):");
  for (const [c, o] of Object.entries(out)) console.log(`  ${c.padEnd(6)} rows ${String(o.rows).padStart(4)} (house history ${o.withHouseHistory})  lamS ${o.lamS}  lamH ${o.lamH}  resid SD ${o.sigmaResid} (alone: lamS ${o.alone.lamS}, lamH ${o.alone.lamH}) | election-out MAE: combined ${o.electionOutMAE.combined}, Senate only ${o.electionOutMAE.senateOnly}, House only ${o.electionOutMAE.houseOnly}, flat ${o.electionOutMAE.flat}`);
  return out;
}
const comb = combine(lag);
const calPath = "data/seat-model-flow-calibration.json";
const cal = JSON.parse(readFileSync(calPath, "utf8"));
cal.combine = { _about: "Forecast weights: logit flow deviation = lamS x (previous-election Senate deviation) + lamH x (seat's previous House residual), national level per class|pair separate; resid SD = seat-level flow noise left over (logit).", ...comb };
writeFileSync(calPath, JSON.stringify(cal, null, 1) + "\n");
