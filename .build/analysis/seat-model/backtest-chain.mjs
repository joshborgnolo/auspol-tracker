#!/usr/bin/env node
/* backtest-chain.mjs: the whole seat chain re-run for 2019, 2022 and 2025 with only what was known
   three years earlier, scored on what happened.

   For test election E (prior P = E-3):
     primaries  each seat's notional P share per party group (the AEC's printed swing column), moved by
                the logit swing to E's ACTUAL totals (state totals, or the national total with state
                shocks drawn) - polling error is out of scope here, the seats-given-the-vote chain is
                the thing tested; within-group splits of several minor candidates use E's shares, and
                One Nation where it did not stand at P starts from its P Senate vote in the division
     flows      P's Senate ballots, calibrated with offsets fitted on elections up to P only, Senate
                weights and House-history weights fitted on elections before E only, and each seat's
                own P House flows
     noise      seat noise sized on elections before E; flow shocks; seat-type/education shocks
   Variants: full model; no seat-level Senate geography and no House history (state tables only);
   Senate geography without House history. Scores: Brier and log score of the seat winner (by
   party group), modal winners right, final pairs right, two-candidate error, expected seats v actual.
   Writes data/seat-model-backtest.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { rng, spreadShares, count, FLOW_CLASSES } from "./seat-engine.mjs";
import { cohortTable, pairShare, routing, cohortKeyFor, FAM_OF_GROUP, FAM } from "./senate-flows.mjs";
import { loadRankings } from "./senate-io.mjs";
import { calibratedTable, houseHistory, flowClassOf, P5_OF } from "./seat-inputs.mjs";

const DRAWS = +(process.env.AUSPOL_BT_DRAWS || 2000);
const SIGMULT = +(process.env.AUSPOL_BT_SIGMULT || 1.3), TDF = +(process.env.AUSPOL_BT_TDF || 5), ONLY = process.env.AUSPOL_BT_ONLY || null;
const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const clamp = (p) => Math.min(0.995, Math.max(0.005, p));
const CAL = J("data/seat-model-calibration.json");
const YEARS = [2016, 2019, 2022, 2025];
const SEN = Object.fromEntries(YEARS.map((y) => [y, loadRankings(y)]));
const RES = Object.fromEntries(YEARS.map((y) => [y, J(`map/data/res-${y}.json`)]));
const GROUP = (c) => (c[3] === "alp" ? "alp" : c[3] === "grn" ? "grn" : c[3] === "onp" ? "on" : c[3] === "lnp" ? ({ LP: "lp", NP: "np", NAT: "np", LNP: "lnp", LNQ: "lnp", CLP: "clp" }[c[1]] || "lnp") : c[3] === "ind" ? "member:" + c[0] : "oth");
const BUCKET = (g) => (g === "alp" ? "alp" : ["lp", "np", "lnp", "clp"].includes(g) ? "lnp" : g === "on" ? "on" : g === "grn" ? "grn" : g.startsWith("member") ? "ind" : "oth");
const BKS = ["alp", "lnp", "on", "grn", "ind", "oth"];
const FAMB = { alp: 0, lnp: 1, grn: 2, onp: 3 };

/* ---- flow calibration rows (as calibrate-flows.mjs) ---- */
function flowRows(E, senYear) {
  const D = RES[E], Rs = SEN[senYear], out = [];
  for (const dv of D.divs) {
    if (!dv.tcp || dv.tcp.length !== 2 || !Rs.div[dv.n]) continue;
    const fins = dv.tcp.map((t) => FAMB[dv.c[t[0]][3]]);
    if (fins.some((f) => f == null) || fins[0] === fins[1]) continue;
    const [x, y] = fins[0] < fins[1] ? [fins[0], fins[1]] : [fins[1], fins[0]], xi = fins[0] === x ? 0 : 1;
    for (const f of dv.fl || []) {
      const c = dv.c[f[0]], n = f[1] + f[2]; if (n < 100) continue;
      const g = GROUP(c), key = cohortKeyFor({ group: g.startsWith("member") ? "member" : g, party: c[1], partyName: c[2] }), cls = flowClassOf(key);
      if (cls === "COAL" && (x === 1 || y === 1)) continue;
      const h = (xi === 0 ? f[1] : f[2]) / n, s = pairShare(Rs, cohortTable(Rs, dv.n, key), x, y);
      out.push({ E, div: dv.n, key, cls, pair: FAM[x] + FAM[y], h, s, n, yv: logit(clamp(h)) - logit(clamp(s)), sv: 1 / (n * clamp(h) * (1 - clamp(h))) });
    }
  }
  return out;
}
function fitDelta(rows) {
  const w = (r) => 1 / (r.sv + 0.12), cls = {}, pr = {};
  for (const r of rows) { (cls[r.cls] = cls[r.cls] || [0, 0]); cls[r.cls][0] += w(r) * r.yv; cls[r.cls][1] += w(r); const k = r.cls + "|" + r.pair; (pr[k] = pr[k] || [0, 0]); pr[k][0] += w(r) * r.yv; pr[k][1] += w(r); }
  const K = 25 / 0.12, d = {};
  for (const [k, a] of Object.entries(pr)) { const c = cls[k.split("|")[0]]; d[k] = (a[0] + K * c[0] / c[1]) / (a[1] + K); }
  return d;
}
function fitWeights(lagRows, prevH, prevM) {
  const out = {};
  const lev = {}; for (const r of lagRows) { const k = r.E + "|" + r.cls + "|" + r.pair; (lev[k] = lev[k] || [0, 0, 0]); lev[k][0] += r.n * logit(clamp(r.h)); lev[k][1] += r.n * logit(clamp(r.s)); lev[k][2] += r.n; }
  for (const cls of FLOW_CLASSES) {
    const rs = lagRows.filter((r) => r.cls === cls); if (rs.length < 20) continue;
    let a = 0, b = 0, c = 0, d = 0, e = 0, aS = 0, dS = 0;
    for (const r of rs) {
      const L = lev[r.E + "|" + r.cls + "|" + r.pair], t = logit(clamp(r.h)) - L[0] / L[2], xS = logit(clamp(r.s)) - L[1] / L[2];
      const ph = prevH[(r.E - 3) + "|" + r.div + "|" + r.key + "|" + r.pair], pm = prevM[(r.E - 3) + "|" + r.cls + "|" + r.pair];
      const xH = ph != null && pm != null ? logit(clamp(ph)) - pm : 0, w = 1 / (r.sv + 0.12);
      a += w * xS * xS; b += w * xS * xH; c += w * xH * xH; d += w * xS * t; e += w * xH * t;
    }
    const det = a * c - b * b;
    out[cls] = { alone: a > 0 ? d / a : 0, S: det > 1e-12 ? (c * d - b * e) / det : (a > 0 ? d / a : 0), H: det > 1e-12 ? (a * e - b * d) / det : 0 };
  }
  return out;
}
const sameRows = Object.fromEntries(YEARS.map((y) => [y, flowRows(y, y)]));
const prevH = {}, prevM = {};
{ const acc = {}; for (const y of YEARS) for (const r of sameRows[y]) { prevH[y + "|" + r.div + "|" + r.key + "|" + r.pair] = r.h; const k = y + "|" + r.cls + "|" + r.pair; (acc[k] = acc[k] || [0, 0]); acc[k][0] += r.n * logit(clamp(r.h)); acc[k][1] += r.n; } for (const [k, a] of Object.entries(acc)) prevM[k] = a[0] / a[1]; }
const lagRows = Object.fromEntries([2019, 2022, 2025].map((E) => [E, flowRows(E, E - 3)]));

const DEFAULT_LAM = { ALP: 0.6, COAL: 0.8, GRN: 0.6, ON: 0.3, "OTH-R": 0.2, "OTH-M": 0.1, "OTH-L": 0.3 };
function settingsFor(E, variant) {
  const delta = fitDelta(YEARS.filter((y) => y <= E - 3).flatMap((y) => sameRows[y]));
  const lagUse = [2019, 2022].filter((y) => y < E).flatMap((y) => lagRows[y]);
  const wts = lagUse.length ? fitWeights(lagUse, prevH, prevM) : {};
  const lamAlone = {}, lamComb = {};
  for (const k of FLOW_CLASSES) {
    lamAlone[k] = variant === "noGeo" ? 0 : (k === "COAL" || k === "ALP") ? DEFAULT_LAM[k] : Math.max(0, Math.min(1, wts[k]?.alone ?? DEFAULT_LAM[k]));
    lamComb[k] = variant === "full" ? (wts[k] ? { S: Math.max(0, Math.min(1, wts[k].S)), H: Math.max(0, Math.min(1, wts[k].H)) } : { S: lamAlone[k], H: 0.5 }) : null;
  }
  delta["COAL|AO"] = 0; // as seat-build.settings: the pair's own counts average about zero
  return { lamAlone, lamComb, delta };
}

function seatsFor(E, variant) {
  const P = E - 3, Rs = SEN[P], D = RES[E], ST = settingsFor(E, variant);
  const hist = variant === "full" ? houseHistory(RES[P], Rs) : { bySeat: {}, mean: {} };
  // One Nation's House/Senate vote ratio at P where it stood for the House
  let hon = 0, son = 0;
  for (const dv of RES[P].divs) { const t = dv.c.reduce((a, c) => a + c[4], 0); const h = dv.c.filter((c) => c[3] === "onp").reduce((a, c) => a + c[4], 0); const sd = Rs.div[dv.n]; if (h > 0 && sd?.t.ON) { hon += h / t; son += sd.t.ON.reduce((a, b) => a + b, 0) / sd.n; } }
  const kON = son > 0 ? hon / son : 0.8;
  const seats = [];
  for (const dv of D.divs) {
    const tot = dv.c.reduce((a, c) => a + c[4], 0);
    const byB = {}; for (const c of dv.c) { const b = BUCKET(GROUP(c)); (byB[b] = byB[b] || { share: 0, base: 0 }); byB[b].share += c[4] / tot; byB[b].base += c[5] == null ? 0 : c[4] / tot - c[5] / 100; }
    const cands = dv.c.map((c) => {
      const g = GROUP(c), b = BUCKET(g), sh = c[4] / tot;
      let base = byB[b].base > 0.002 ? byB[b].base * sh / byB[b].share : 0;
      if (base <= 0.002 && b === "on") { const sd = Rs.div[dv.n]; base = sd?.t.ON ? kON * sd.t.ON.reduce((a, x) => a + x, 0) / sd.n : 0.02; }
      if (base <= 0.002) base = b === "ind" ? 0.01 : 0.004;
      const key = cohortKeyFor({ group: g.startsWith("member") ? "member" : g, party: c[1], partyName: c[2] }), cls = flowClassOf(key);
      return { label: c[0], group: g, p5: P5_OF(g.startsWith("member") ? "oth" : g), fam: FAM_OF_GROUP[g] ?? -1, isInd: g.startsWith("member"), base, key, cls, clsIdx: FLOW_CLASSES.indexOf(cls) };
    });
    const tables = {};
    for (const c of cands) { const p = (tables[c.key] = tables[c.key] || calibratedTable(Rs, ST, { st: dv.st }, dv.n, c.key, hist)); c.route = routing(Rs, p); }
    seats.push({ name: dv.n, st: dv.st, cls: dv.cls, w: tot, uni: dv.demo?.uni ?? null, cands, iota: { ALP: 0.73, COAL: 0.73, GRN: 0.49, ON: 0.28, "OTH-R": 0.23, "OTH-M": 0.23, "OTH-L": 0.23, _: 0.23 }, sib: 0.72,
      actual: (() => { const w = dv.c.find((c) => c[6] === 1); const tcp = dv.tcp.map((t) => BUCKET(GROUP(dv.c[t[0]]))).sort().join("|"); const ws = dv.tcp.find((t) => dv.c[t[0]] === w); return { w: BUCKET(GROUP(w)), pair: tcp, share: ws ? ws[1] / (dv.tcp[0][1] + dv.tcp[1][1]) : null }; })() });
  }
  const us = seats.map((s) => s.uni).filter((v) => v != null), mu = us.reduce((a, b) => a + b, 0) / us.length, sd = Math.sqrt(us.reduce((a, b) => a + (b - mu) ** 2, 0) / us.length);
  for (const s of seats) s.z = s.uni == null ? 0 : (s.uni - mu) / sd;
  return { seats, ST };
}

function run(E, variant, stateOracle) {
  const { seats } = seatsFor(E, variant);
  const D = RES[E];
  const shareP5 = (divs) => { const v = [0, 0, 0, 0, 0]; let t = 0; for (const dv of divs) for (const c of dv.c) { const g = GROUP(c); v[P5_OF(g.startsWith("member") ? "oth" : g)] += c[4]; t += c[4]; } return v.map((x) => x / t); };
  const natT = shareP5(D.divs);
  const groups = stateOracle ? [...new Set(seats.map((s) => s.st))].map((st) => ({ idx: seats.map((s, i) => (s.st === st ? i : -1)).filter((i) => i >= 0), targets: shareP5(D.divs.filter((d) => d.st === st)) })) : null;
  const sw = CAL.swing.stateOracle, years = [2007, 2010, 2013, 2016, 2019, 2022].filter((y) => y < E);
  const rmsB = (b) => Math.sqrt(years.map((y) => sw[b]?.rmsByElection?.[y]).filter((x) => x != null).reduce((a, x, _, arr) => a + x * x / arr.length, 0));
  const SIG = [rmsB("alp"), rmsB("lnp"), rmsB("onp") || 0.33, rmsB("grn"), 0.35];
  const stateSD = CAL.swing.stateDev;
  const R = rng(1000 + E);
  const win = seats.map(() => ({})), pairs = seats.map(() => ({})), shareW = seats.map(() => []);
  const tallies = []; const expSeats = Object.fromEntries(BKS.map((b) => [b, 0]));
  for (let d = 0; d <= DRAWS; d++) {
    const det = d === DRAWS; // last pass: deterministic (no noise) for modal accuracy
    const stShift = {}; for (const st of new Set(seats.map((s) => s.st))) stShift[st] = det || stateOracle ? [0, 0, 0, 0, 0] : [stateSD.alp, stateSD.lnp, stateSD.onp, stateSD.grn, 0.15].map((s) => R.norm() * s);
    const cl = {}; for (const c of ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"]) cl[c] = [0, 1, 2, 3, 4].map(() => (det ? 0 : R.norm() * 0.04));
    const edu = [0, 1, 2, 3, 4].map(() => (det ? 0 : R.norm() * 0.04));
    const dev = (i, j) => { if (det) return 0; const s = seats[i], c = s.cands[j], k = c.p5; return stShift[s.st][k] + (cl[s.cls]?.[k] ?? 0) + edu[k] * s.z + R.t(TDF) * (c.isInd ? 0.3 : SIG[k]) * SIGMULT; };
    const sh = spreadShares(seats, natT, dev, R, groups);
    let shock = null;
    if (!det) { shock = new Float64Array(FLOW_CLASSES.length * 4); FLOW_CLASSES.forEach((k, ci) => { for (let y = 0; y < 4; y++) shock[ci * 4 + y] = R.norm() * (k === "ON" ? 0.25 : 0.15) / Math.SQRT2; }); }
    const t = Object.fromEntries(BKS.map((b) => [b, 0]));
    seats.forEach((s, i) => {
      let ss = null; if (!det) { ss = new Float64Array(FLOW_CLASSES.length * 4); for (let k = 0; k < ss.length; k++) ss[k] = R.norm() * 0.25 / Math.SQRT2; }
      const fin = count(s, sh[i], shock, ss);
      const wb = BUCKET(s.cands[fin[0][0]].group), pb = [wb, BUCKET(s.cands[fin[1][0]].group)].sort().join("|");
      if (det) { s.det = { w: wb, pair: pb, share: fin[0][1] / (fin[0][1] + fin[1][1]) }; return; }
      win[i][wb] = (win[i][wb] || 0) + 1; pairs[i][pb] = (pairs[i][pb] || 0) + 1; t[wb]++;
    });
    if (!det) { tallies.push(t); for (const b of BKS) expSeats[b] += t[b] / DRAWS; }
  }
  // scores
  let brier = 0, logs = 0, modal = 0, detOk = 0, pairOk = 0, tcpE = [], n = 0;
  const actualSeats = Object.fromEntries(BKS.map((b) => [b, 0]));
  seats.forEach((s, i) => {
    const a = s.actual.w; actualSeats[a]++;
    const p = Object.fromEntries(BKS.map((b) => [b, (win[i][b] || 0) / DRAWS]));
    brier += BKS.reduce((acc, b) => acc + (p[b] - (b === a ? 1 : 0)) ** 2, 0);
    logs += Math.log(Math.max(p[a], 0.002));
    const top = Object.entries(p).sort((x, y) => y[1] - x[1])[0][0]; if (top === a) modal++;
    if (s.det.w === a) detOk++;
    if (s.det.pair === s.actual.pair) { pairOk++; if (s.actual.share != null) tcpE.push(Math.abs((s.det.w === a ? s.det.share : 1 - s.det.share) - s.actual.share)); }
    n++;
  });
  // calibration: predicted probability of each seat's eventual winner-or-not, binned
  const bins = [[0, 0.1], [0.1, 0.3], [0.3, 0.5], [0.5, 0.7], [0.7, 0.9], [0.9, 1.01]].map(([lo, hi]) => ({ lo, hi, p: 0, o: 0, n: 0 }));
  seats.forEach((s, i) => { for (const b of BKS) { const p = (win[i][b] || 0) / DRAWS; if (p === 0 && s.actual.w !== b) continue; const bin = bins.find((x) => p >= x.lo && p < x.hi); bin.p += p; bin.o += s.actual.w === b ? 1 : 0; bin.n++; } });
  const q = (b, pp) => { const xs = tallies.map((t) => t[b]).sort((x, y) => x - y); return xs[Math.floor(pp * (xs.length - 1))]; };
  const cover = Object.fromEntries(["alp", "lnp", "on", "grn", "ind"].map((b) => [b, actualSeats[b] >= q(b, 0.05) && actualSeats[b] <= q(b, 0.95)]));
  return { E, variant, stateOracle, brier: +(brier / n).toFixed(4), logScore: +(logs / n).toFixed(4), modalRight: modal, deterministicRight: detOk, pairsRight: pairOk, tcpMaePts: +(100 * tcpE.reduce((a, b) => a + b, 0) / tcpE.length).toFixed(2),
    expected: Object.fromEntries(BKS.map((b) => [b, +expSeats[b].toFixed(1)])), actual: actualSeats, in90: cover,
    calibration: bins.filter((b) => b.n).map((b) => ({ bin: `${b.lo}-${Math.min(1, b.hi)}`, meanP: +(b.p / b.n).toFixed(3), observed: +(b.o / b.n).toFixed(3), n: b.n })) };
}

const results = [];
for (const E of [2019, 2022, 2025]) for (const stateOracle of [true, false]) for (const variant of ["full", "noHist", "noGeo"]) {
  if (ONLY && variant !== ONLY) continue;
  const r = run(E, variant, stateOracle); results.push(r);
  console.log(`${E} ${stateOracle ? "state totals " : "nation total "} ${variant.padEnd(6)} Brier ${r.brier.toFixed(4)} log ${r.logScore.toFixed(3)} | winners ${r.modalRight}/150 (no-noise ${r.deterministicRight}) pairs ${r.pairsRight} TCP ${r.tcpMaePts} | exp ALP ${r.expected.alp} L/NP ${r.expected.lnp} ON ${r.expected.on} GRN ${r.expected.grn} IND ${r.expected.ind} v actual ${r.actual.alp}/${r.actual.lnp}/${r.actual.on}/${r.actual.grn}/${r.actual.ind} | in 90%: ${Object.entries(r.in90).filter(([, v]) => !v).map(([k]) => k).join(",") || "all"}`);
}
console.log("\ncalibration, full model, national totals only, pooled 2019-2025 (mean predicted v observed):");
const pool = {}; for (const r of results.filter((r) => r.variant === "full" && !r.stateOracle)) for (const b of r.calibration) { (pool[b.bin] = pool[b.bin] || { p: 0, o: 0, n: 0 }); pool[b.bin].p += b.meanP * b.n; pool[b.bin].o += b.observed * b.n; pool[b.bin].n += b.n; }
for (const [k, v] of Object.entries(pool)) console.log(`  ${k.padEnd(8)} predicted ${(v.p / v.n).toFixed(3)}  observed ${(v.o / v.n).toFixed(3)}  (n ${v.n})`);
if (!process.env.AUSPOL_BT_NOWRITE) writeFileSync("data/seat-model-backtest.json", JSON.stringify({ sigmaMultiplier: SIGMULT, tDf: TDF, _about: "backtest-chain.mjs: seat noise scale 1.3 (chosen by held-out log score over 1.0/1.3/1.6 x t df 4/5). the seat chain for 2019, 2022 and 2025 from what was known three years earlier, with the actual vote totals given (state totals, or national with state shocks). Variants: full (Senate geography + House history), noHist (Senate geography only), noGeo (state-level Senate tables only). Brier/log score of the seat winner by party group; winners right by modal and no-noise prediction; pairs right; TCP MAE where the pair is right.", draws: DRAWS, results, calibrationPooled: pool }, null, 1) + "\n");
console.log("wrote data/seat-model-backtest.json");
