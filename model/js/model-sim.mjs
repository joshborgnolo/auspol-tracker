/* model-sim.mjs: the seat model's simulation - one election, many elections, and the single
   no-noise projection - over seats built by seat-build.mjs.

   Pure: no node imports. swing-simulate.mjs (node) writes the official runs with it; the /model/
   page's worker runs the same file (copied to model/js/ by .build/model/assemble.mjs) for a reader's
   own settings. The settings object S is plain JSON (modelSettings builds it from the calibration
   files in node; the page reads it from model/data/inputs.json and changes what its controls move).

   One simulated election, in order of random draws (fixed, so a seed reproduces a run exactly):
     1. national vote: the nowcast (or the reader's numbers); in election-day mode minor parties give
        back a share of their logit move since 2025 (fade, drawn uniform lo-hi unless fixed); then a
        correlated, fat-tailed polling error on the logit scale (sigNat x corr, Student-t df)
     2. state shifts (poll deviation + its se + residual), seat-type and education shocks
     3. seat noise per candidate (Student-t), the age/gender terms, then one shift per party solved so
        the national totals hold exactly (seat-engine.spreadShares)
     4. flow shocks: national per donor class and recipient, a shared One Nation acceptability shock,
        and seat-level flow noise
     5. the count in every seat (seat-engine.count) */
import { rng, spreadShares, count, cholesky, drawNational, P5, FLOW_CLASSES } from "./seat-engine.mjs";

const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const r2 = (x) => Math.round(x * 100) / 100, r4 = (x) => Math.round(x * 10000) / 10000;
export const COAL_GROUPS = ["lp", "np", "lnp", "clp"];
export const bucketOf = (g) => (g === "alp" ? "alp" : COAL_GROUPS.includes(g) ? "lnp" : g === "on" ? "on" : g === "grn" ? "grn" : String(g).startsWith("member") || g === "ind-declared" ? "member" : "oth");
export const KEYS = ["alp", "lnp", "on", "grn", "oth", "member"];
const CLASS_IDX = { "Inner Metropolitan": 0, "Outer Metropolitan": 1, "Provincial": 2, "Rural": 3 };

/* ---- settings from the calibration files (node builds this; the page reads it) ---- */
export function modelSettings({ VOTE, CAL, FCAL, DRIFT, mode = "nowcast" }) {
  const nat25 = P5.map((p) => VOTE.national.result2025[p] / 100);
  const v = P5.map((p) => VOTE.national.nowcast[p] / 100), t = v.reduce((a, b) => a + b, 0);
  const now5 = v.map((x) => x / t);
  const band = mode === "forecast" ? "13-20 months" : "final month";
  const sigN = CAL.national.sigma;
  // One Nation's error has five cycles behind it and "others" mix definitions across houses: both are
  // floored at the Greens' value (the best-measured minor party), One Nation capped at its own RMS
  const sigNat = [sigN.alp[band], sigN.lnp[band], Math.min(sigN.onp[band], Math.max(sigN.grn[band], 0.25)), sigN.grn[band], Math.max(sigN.grn[band], 0.25)];
  const corr = [[1, -0.6, -0.15, -0.1, 0], [-0.6, 1, -0.4, 0, 0], [-0.15, -0.4, 1, 0, 0], [-0.1, 0, 0, 1, -0.3], [0, 0, 0, -0.3, 1]];
  const SW = CAL.swing.stateOracle;
  const rmsRecent = (b) => { const xs = [2019, 2022, 2025].map((y) => SW[b]?.rmsByElection?.[y]).filter((x) => x != null); return xs.length ? Math.sqrt(xs.reduce((a, x) => a + x * x, 0) / xs.length) : null; };
  // One Nation: its federal 2022/2025 residuals are a 3-6% party's; at surge size its spread was far
  // more even (SA 2026 from the federal footprint), which is used
  const sig0 = [rmsRecent("alp") ?? 0.21, rmsRecent("lnp") ?? 0.21, CAL.swing.sa26?.onp?.rmsLogit ?? 0.2, rmsRecent("grn") ?? 0.25, 0.35];
  const states = Object.fromEntries(Object.keys(VOTE.states.weights).map((st) => [st, {
    dev: P5.map((p) => VOTE.states.dev[st]?.[p]?.dev ?? 0), se: P5.map((p) => VOTE.states.dev[st]?.[p]?.se ?? 0) }]));
  // national flow shocks: the level drift seen between a Senate election and the next House count,
  // federal 2019-2025 and six state elections (backtest-states.mjs `drift`); Labor's choice, never
  // counted often enough, takes the Coalition's
  const drift = DRIFT || {};
  const flowNat = Object.fromEntries(FLOW_CLASSES.map((k) => [k, drift[k === "ALP" ? "COAL" : k]?.sigma ?? FCAL.lag.byClass[k]?.sigmaU ?? 0.3]));
  const flowSeat = Object.fromEntries(FLOW_CLASSES.map((k) => [k, FCAL.combine?.[k]?.sigmaResid ?? (k === "COAL" ? 0.3 : 0.25)]));
  return {
    mode, nat25, now5, band, sigNat, corr, df: 5, sig0,
    kFall: 0.47,      // SA 2026 Liberals: residual 0.456 logit after a 0.88 logit fall, calm-year 0.20
    sigMult: 1.3,     // the seat-noise scale that maximised the held-out log score (backtest-chain.mjs)
    sigMember: 0.30, sigStateResid: 0.10, sigClass: [0.06, 0.06, 0.09, 0.06, 0.06], sigEdu: 0.06,
    flowNat, flowOn: 0.15, flowSeat, states,
    fade: mode === "forecast" ? { lo: 0, hi: 0.6 } : null,
    polErrMult: 1, seatNoiseMult: 1, flowNoiseMult: 1, uncertainty: true,
  };
}
/* the seat-noise SD per party: fitted calm-year level x sigMult, plus a term that grows with the party's
   fall since 2025 (SA 2026's collapsing Liberals); recomputed from the vote the run starts from */
export function seatSigmas(S, base5) {
  return P5.map((p, k) => { const d = logit(base5[k]) - logit(S.nat25[k]); return S.seatNoiseMult * Math.sqrt((S.sigMult * S.sig0[k]) ** 2 + (d < 0 ? (S.kFall * d) ** 2 : 0)); });
}

/* ---- one election ---- */
export function simulateOnce(seats, S, R, L, sigSeat) {
  const unc = S.uncertainty !== false;
  let base = S.now5.slice();
  if (S.fade) {
    const lam = S.fade.fixed != null ? S.fade.fixed : S.fade.lo + (S.fade.hi - S.fade.lo) * R.u01();
    for (const k of [2, 3, 4]) base[k] = ilogit(logit(base[k]) - lam * (logit(base[k]) - logit(S.nat25[k])));
    const room = 1 - base[2] - base[3] - base[4], maj = S.now5[0] + S.now5[1];
    base[0] = room * S.now5[0] / maj; base[1] = room * S.now5[1] / maj;
  }
  const targets = unc && S.polErrMult > 0 ? drawNational(base, S.sigNat.map((x) => x * S.polErrMult), L, R, S.df) : base;
  const toLogit = (pp, k) => pp / (100 * targets[k] * (1 - targets[k]));
  const stateShift = {};
  for (const [st, d] of Object.entries(S.states)) stateShift[st] = P5.map((p, k) => toLogit(d.dev[k] + (unc ? R.norm() * d.se[k] : 0), k) + (unc ? R.norm() * S.sigStateResid : 0));
  const classShock = [0, 1, 2, 3].map(() => P5.map((p, k) => (unc ? R.norm() * S.sigClass[k] : 0)));
  const eduSlope = P5.map(() => (unc ? R.norm() * S.sigEdu : 0));
  const dev = (i, j) => {
    const s = seats[i], c = s.cands[j], k = c.p5;
    const noise = unc ? R.t(S.df) * (c.isInd ? S.sigMember * S.seatNoiseMult : sigSeat[k]) : 0;
    return (stateShift[s.st]?.[k] ?? 0) + toLogit(s.demoPP?.[k] ?? 0, k) + classShock[CLASS_IDX[s.cls] ?? 1][k] + eduSlope[k] * (s.z || 0) + noise;
  };
  const shares = spreadShares(seats, targets, dev, R);
  let shock = null;
  if (unc && S.flowNoiseMult > 0) {
    shock = new Float64Array(FLOW_CLASSES.length * 4);
    const onAcc = R.norm() * S.flowOn * S.flowNoiseMult;
    FLOW_CLASSES.forEach((k, ci) => { for (let y = 0; y < 4; y++) shock[ci * 4 + y] = R.norm() * S.flowNat[k] * S.flowNoiseMult / Math.SQRT2 + (y === 3 && k !== "ON" ? onAcc : 0); });
  }
  const winners = [], finals = [], tcpAlp = [], prim = [];
  seats.forEach((s, i) => {
    let ss = null;
    if (shock) { ss = new Float64Array(FLOW_CLASSES.length * 4); FLOW_CLASSES.forEach((k, ci) => { for (let y = 0; y < 4; y++) ss[ci * 4 + y] = R.norm() * S.flowSeat[k] * S.flowNoiseMult / Math.SQRT2; }); }
    const fin = count(s, shares[i], shock, ss);
    const w = s.cands[fin[0][0]], o = s.cands[fin[1][0]];
    winners.push(w.group);
    finals.push({ pair: [w.group, o.group].sort(), share: fin[0][1] / (fin[0][1] + fin[1][1]), w: w.group, o: o.group });
    if ((w.group === "alp" && COAL_GROUPS.includes(o.group)) || (o.group === "alp" && COAL_GROUPS.includes(w.group))) tcpAlp.push(w.group === "alp" ? fin[0][1] / (fin[0][1] + fin[1][1]) : fin[1][1] / (fin[0][1] + fin[1][1]));
    prim.push(shares[i]);
  });
  return { winners, finals, tcpAlp, targets, prim };
}

/* ---- many elections, tallied as the official files and the page read them ---- */
export function runMany(seats, S, { draws = 2000, seed = 20261101, onProgress = null, progressEvery = 100 } = {}) {
  const R = rng(seed), L = cholesky(S.corr);
  const sigSeat = seatSigmas(S, S.now5);
  const n = seats.length;
  const seatWin = seats.map(() => ({})), seatFinal = seats.map(() => ({})), pairShare = seats.map(() => ({}));
  const primSum = seats.map((s) => new Float64Array(s.cands.length));
  const tallies = Object.fromEntries(KEYS.map((k) => [k, new Int16Array(draws)]));
  const hist = Object.fromEntries(KEYS.map((k) => [k, new Int32Array(n + 1)]));
  const maj = { alp: 0, coalition: 0, on: 0, none: 0 }, most = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const tcpSamples = [], natDraws = [], pairTally = {};
  for (let d = 0; d < draws; d++) {
    const sim = simulateOnce(seats, S, R, L, sigSeat);
    const t = Object.fromEntries(KEYS.map((k) => [k, 0]));
    for (let i = 0; i < n; i++) {
      const g = sim.winners[i]; seatWin[i][g] = (seatWin[i][g] || 0) + 1; t[bucketOf(g)]++;
      const f = sim.finals[i], pk = f.pair.join("|");
      seatFinal[i][pk] = (seatFinal[i][pk] || 0) + 1;
      const first = f.pair[0], firstShare = f.w === first ? f.share : 1 - f.share;
      pairShare[i][pk] = (pairShare[i][pk] || 0) + firstShare;
      const pb = f.pair.map(bucketOf).sort().join(" v "); pairTally[pb] = (pairTally[pb] || 0) + 1;
      const ps = sim.prim[i]; for (let j = 0; j < ps.length; j++) primSum[i][j] += ps[j];
    }
    for (const k of KEYS) { tallies[k][d] = t[k]; hist[k][t[k]]++; }
    if (t.alp >= 76) maj.alp++; else if (t.lnp >= 76) maj.coalition++; else if (t.on >= 76) maj.on++; else maj.none++;
    const top = Math.max(...KEYS.map((k) => t[k])); const leaders = KEYS.filter((k) => t[k] === top); for (const k of leaders) most[k] += 1 / leaders.length;
    tcpSamples.push(sim.tcpAlp.length ? sim.tcpAlp.reduce((a, b) => a + b, 0) / sim.tcpAlp.length : null);
    if (d < 2000) natDraws.push(sim.targets);
    if (onProgress && (d + 1) % progressEvery === 0) onProgress((d + 1) / draws);
  }
  const q = (xs, p) => { const s = Array.from(xs).sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
  const tcpVals = tcpSamples.filter((v) => v != null);
  return {
    draws, seed,
    expectedSeats: Object.fromEntries(KEYS.map((k) => [k, r2(tallies[k].reduce((a, b) => a + b, 0) / draws)])),
    seatDistribution: Object.fromEntries(KEYS.map((k) => [k, { p05: q(tallies[k], 0.05), p25: q(tallies[k], 0.25), p50: q(tallies[k], 0.5), p75: q(tallies[k], 0.75), p95: q(tallies[k], 0.95) }])),
    histogram: Object.fromEntries(KEYS.map((k) => { const h = Array.from(hist[k]); let last = h.length - 1; while (last > 0 && !h[last]) last--; return [k, h.slice(0, last + 1)]; })),
    majority: { alp: r4(maj.alp / draws), coalition: r4(maj.coalition / draws), on: r4(maj.on / draws), noMajority: r4(maj.none / draws) },
    mostSeats: Object.fromEntries(KEYS.map((k) => [k, r4(most[k] / draws)])),
    finalPairs: Object.fromEntries(Object.entries(pairTally).map(([k, v]) => [k, r2(v / draws)]).sort((a, b) => b[1] - a[1])),
    twoPartyClassic: tcpVals.length ? { meanAlp: r2(100 * tcpVals.reduce((a, b) => a + b, 0) / tcpVals.length), p10: r2(100 * q(tcpVals, 0.1)), p90: r2(100 * q(tcpVals, 0.9)), coverage: r2(100 * tcpVals.length / draws) } : null,
    nationalVote: Object.fromEntries(P5.map((p, k) => [p, { p10: r2(100 * q(natDraws.map((v) => v[k]), 0.1)), p50: r2(100 * q(natDraws.map((v) => v[k]), 0.5)), p90: r2(100 * q(natDraws.map((v) => v[k]), 0.9)) }])),
    sigmaSeat: Object.fromEntries(P5.map((p, k) => [p, r4(sigSeat[k])])),
    seats: seats.map((s, i) => ({
      name: s.name, state: s.st,
      win: Object.fromEntries(Object.entries(seatWin[i]).map(([g, c]) => [g, r4(c / draws)]).sort((a, b) => b[1] - a[1])),
      finalPairs: Object.fromEntries(Object.entries(seatFinal[i]).map(([k, c]) => [k, r4(c / draws)]).sort((a, b) => b[1] - a[1])),
      pairShare: Object.fromEntries(Object.entries(pairShare[i]).map(([k, v]) => [k, r4(v / seatFinal[i][k])])),
      primary: byGroup(s, Array.from(primSum[i]).map((v) => v / draws)),
    })),
  };
}
/* a seat's shares summed by candidate group (several minor candidates share "oth") */
function byGroup(s, shares) {
  const o = {};
  s.cands.forEach((c, j) => { o[c.group] = (o[c.group] || 0) + shares[j]; });
  for (const k of Object.keys(o)) o[k] = r4(o[k]);
  return o;
}

/* ---- the single no-noise projection: the central estimate, seat by seat ---- */
export function projectOnce(seats, S) {
  const R = rng(1), L = cholesky(S.corr);
  const sim = simulateOnce(seats, { ...S, uncertainty: false, fade: S.fade ? { fixed: S.fade.fixed ?? (S.fade.lo + S.fade.hi) / 2 } : null }, R, L, seatSigmas(S, S.now5));
  const t = Object.fromEntries(KEYS.map((k) => [k, 0]));
  for (const g of sim.winners) t[bucketOf(g)]++;
  return { seats: t, perSeat: seats.map((s, i) => ({ name: s.name, w: sim.winners[i], pair: sim.finals[i].pair, share: r4(sim.finals[i].share), primary: byGroup(s, sim.prim[i]) })), targets: sim.targets };
}
