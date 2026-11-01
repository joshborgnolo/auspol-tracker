#!/usr/bin/env node
/* swing-simulate.mjs: the 2028 seat model (layers 3-5 of .build/analysis/seat-model-plan.md).
   v2, 2026-11-01. Rebuilt on the design review's findings (.build/analysis/seat-model-design-review.md,
   sections 10 and 12); W5's 2026-10-08 engine is in git history.

   Primaries: logit swing from each seat's certified 2025 vote (seat-engine.mjs), with the vote
   layer's state deviations and age/gender terms, shared shocks by seat type and by education, and
   fat-tailed seat noise whose size was fitted on federal 2007-2025 and grows with a party's fall
   (SA 2026's collapsing Liberals). calibrate-swing.mjs -> data/seat-model-calibration.json.

   Preferences: every candidate's voters rank Labor, the Coalition, the Greens and One Nation as
   that party's Senate voters in the same division did in 2025 (data/senate-rankings-2025.json),
   calibrated to the House (data/seat-model-flow-calibration.json: chamber offsets, Senate-pattern
   weights, the seat's own 2025 House flow where one was counted), with today's voters for each big
   party mixed from their 2025 parties by the vote-switching tables. The count replays those
   rankings exactly at every exclusion (no pairwise flow tables). Sitting independents take their
   2025-counted share of moving piles; an excluded Coalition partner passes its partner its counted
   share.

   Uncertainty per simulated election: national polling error (logit, Student-t, party-correlated,
   sized by calibrate-national.mjs for the lead time), state shifts, seat-type and education shocks,
   seat noise, national flow shocks per donor class plus one shared "One Nation acceptability"
   shock, and seat-level flow noise.

   Modes (AUSPOL_SIM_MODE): nowcast (default; "if held today") -> data/seat-model-2028-nowcast.json
   + one history line per polling window; forecast (election day, ~17 months out: horizon error and
   a minor-party fade drawn from 0-0.6 of the surge) -> data/seat-model-2028-forecast.json;
   replay (the certified 2025 primaries counted on the modelled flows, no noise: the flow layer's
   check, printed). AUSPOL_SIM_DRAWS, AUSPOL_SIM_OUT override. Stage 1: no site files. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rng, spreadShares, count, cholesky, drawNational, P5, FLOW_CLASSES } from "./seat-engine.mjs";
import { buildSeats } from "./seat-inputs.mjs";

const MODE = process.env.AUSPOL_SIM_MODE || (process.env.AUSPOL_SIM_NULL === "1" ? "replay" : "nowcast");
const DRAWS = MODE === "replay" ? 1 : +(process.env.AUSPOL_SIM_DRAWS || 20000);
const SEED = 20261101;
const OUT_PATH = process.env.AUSPOL_SIM_OUT || (MODE === "replay" ? join(tmpdir(), "auspol-sim-replay.json") : MODE === "forecast" ? "data/seat-model-2028-forecast.json" : "data/seat-model-2028-nowcast.json");
const HISTORY_PATH = "data/seat-model-2028-history.jsonl";
const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const sha16 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);
const r2 = (x) => Math.round(x * 100) / 100, r4 = (x) => Math.round(x * 10000) / 10000;
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));

const VOTE = J("data/seat-vote-layer.json");
const CAL = J("data/seat-model-calibration.json");
const FCAL = J("data/seat-model-flow-calibration.json");
const CENSUS = J("data/census-2021-divisions-2025.json");
const RES = J("map/data/res-2025.json");
const { seats, comp } = buildSeats({ composition: MODE !== "replay", replay: MODE === "replay" });

/* ---- settings drawn from the calibration files (each named in meta) ---- */
const nat25 = P5.map((p) => VOTE.national.result2025[p] / 100);
const now5 = (() => { const v = P5.map((p) => VOTE.national.nowcast[p] / 100); const t = v.reduce((a, b) => a + b, 0); return v.map((x) => x / t); })();
const band = MODE === "forecast" ? "13-20 months" : "final month";
const sigN = CAL.national.sigma;
// One Nation's error has five cycles behind it and "others" mix definitions across houses: both
// are floored at the Greens' value (the best-measured minor party) and capped at their own RMS
const SIG_NAT = [sigN.alp[band], sigN.lnp[band], Math.min(sigN.onp[band], Math.max(sigN.grn[band], 0.25)), sigN.grn[band], Math.max(sigN.grn[band], 0.25)];
const CORR = [
  [1, -0.6, -0.15, -0.1, 0], [-0.6, 1, -0.4, 0, 0], [-0.15, -0.4, 1, 0, 0], [-0.1, 0, 0, 1, -0.3], [0, 0, 0, -0.3, 1]];
const L = cholesky(CORR);
const DF = 5;
// seat noise: fitted 2019-2025 level per party, plus a term that grows with the party's fall (SA 2026)
const SW = CAL.swing.stateOracle;
const rmsRecent = (b) => { const v = [2019, 2022, 2025].map((y) => SW[b]?.rmsByElection?.[y]).filter((x) => x != null); return v.length ? Math.sqrt(v.reduce((a, x) => a + x * x, 0) / v.length) : null; };
// One Nation: its federal 2022/2025 residuals are a 3-6% party's (candidate noise on a small base);
// at surge size its spread was far more even (SA 2026 from the federal footprint: 0.164), which is used
const SIG0 = [rmsRecent("alp") ?? 0.21, rmsRecent("lnp") ?? 0.21, CAL.swing.sa26?.onp?.rmsLogit ?? 0.2, rmsRecent("grn") ?? 0.25, 0.35];
const K_FALL = 0.47; // SA 2026 Liberals: residual 0.456 logit after a 0.88 logit fall, calm-year 0.20
// x1.3: the scale that maximised the held-out log score in backtest-chain.mjs (2019-2025, t df 5)
const SIG_MULT = 1.3;
const SIG_SEAT = P5.map((p, k) => { const d = logit(now5[k]) - logit(nat25[k]); return Math.sqrt((SIG_MULT * SIG0[k]) ** 2 + (d < 0 ? (K_FALL * d) ** 2 : 0)); });
const SIG_MEMBER = 0.30, SIG_STATE_RESID = 0.10, SIG_CLASS = [0.06, 0.06, 0.09, 0.06, 0.06], SIG_EDU = 0.06;
// flow shocks (logit): national per donor class (previous-election fit), shared ON acceptability, seat-level
const SIG_FLOW_NAT = Object.fromEntries(FLOW_CLASSES.map((k) => [k, Math.min(0.35, FCAL.lag.byClass[k]?.sigmaU ?? 0.2)]));
const SIG_FLOW_ON = 0.15;
const SIG_FLOW_SEAT = Object.fromEntries(FLOW_CLASSES.map((k) => [k, FCAL.combine?.[k]?.sigmaResid ?? (k === "COAL" ? 0.3 : 0.25)]));

/* ---- per-seat fixed terms: vote layer's age/gender differential (pp -> logit at the national share) */
const censusBy = new Map(CENSUS.divisions.map((d) => [d.name, d]));
const PW = VOTE.beta.populationWeights;
const demoPP = seats.map((s) => {
  const d = censusBy.get(s.name); if (!d) return [0, 0, 0, 0, 0];
  const a = d.ageCounts, a1834 = 0.4 * a["15_19"] + a["20_24"] + a["25_34"], a3554 = a["35_44"] + a["45_54"], a55 = a["55_64"] + a["65_74"] + a["75_84"] + a["85ov"], t = a1834 + a3554 + a55;
  const X = { age: { "18–34": a1834 / t, "35–54": a3554 / t, "55+": a55 / t }, gender: { Men: d.gender.m / (d.gender.m + d.gender.f), Women: d.gender.f / (d.gender.m + d.gender.f) } };
  return P5.map((p) => { let v = 0; for (const dim of ["age", "gender"]) for (const cell of Object.keys(PW[dim])) v += VOTE.beta.dims[dim][cell][p].beta * (X[dim][cell] - PW[dim][cell]); return v; });
});
const classIdx = { "Inner Metropolitan": 0, "Outer Metropolitan": 1, "Provincial": 2, "Rural": 3 };
const R = rng(SEED);

/* ---- one election ---- */
function simulate() {
  let targets;
  if (MODE === "replay") targets = null;
  else {
    let base = now5.slice();
    if (MODE === "forecast") {
      // minor parties give back a share (0-0.6, uniform) of their logit move since 2025; majors fill in
      const lam = 0.6 * R.u01();
      for (const k of [2, 3, 4]) base[k] = ilogit(logit(base[k]) - lam * (logit(base[k]) - logit(nat25[k])));
      const room = 1 - base[2] - base[3] - base[4], maj = now5[0] + now5[1];
      base[0] = room * now5[0] / maj; base[1] = room * now5[1] / maj;
    }
    targets = drawNational(base, SIG_NAT, L, R, DF);
  }
  const sh5 = targets || nat25;
  const toLogit = (pp, k) => pp / (100 * sh5[k] * (1 - sh5[k]));
  const stateShift = {};
  for (const st of Object.keys(VOTE.states.weights)) stateShift[st] = P5.map((p, k) => {
    const d = VOTE.states.dev[st]?.[p];
    return MODE === "replay" ? 0 : toLogit(d ? d.dev + R.norm() * d.se : 0, k) + R.norm() * SIG_STATE_RESID;
  });
  const classShock = [0, 1, 2, 3].map(() => P5.map((p, k) => (MODE === "replay" ? 0 : R.norm() * SIG_CLASS[k])));
  const eduSlope = P5.map(() => (MODE === "replay" ? 0 : R.norm() * SIG_EDU));
  const dev = (i, j) => {
    if (MODE === "replay") return 0;
    const s = seats[i], c = s.cands[j], k = c.p5;
    const noise = R.t(DF) * (c.isInd ? SIG_MEMBER : SIG_SEAT[k]);
    return stateShift[s.st][k] + toLogit(demoPP[i][k], k) + classShock[classIdx[s.cls] ?? 1][k] + eduSlope[k] * s.z + noise;
  };
  const shares = MODE === "replay" ? seats.map((s) => s.cands.map((c) => c.base)) : spreadShares(seats, targets, dev, R);
  // flow shocks: national (per donor class x recipient) and per seat
  let shock = null;
  if (MODE !== "replay") {
    shock = new Float64Array(FLOW_CLASSES.length * 4);
    const onAcc = R.norm() * SIG_FLOW_ON;
    FLOW_CLASSES.forEach((k, ci) => { for (let y = 0; y < 4; y++) shock[ci * 4 + y] = R.norm() * SIG_FLOW_NAT[k] / Math.SQRT2 + (y === 3 && k !== "ON" ? onAcc : 0); });
  }
  const winners = [], finals = [], tcpAlp = [];
  seats.forEach((s, i) => {
    let ss = null;
    if (shock) { ss = new Float64Array(FLOW_CLASSES.length * 4); FLOW_CLASSES.forEach((k, ci) => { for (let y = 0; y < 4; y++) ss[ci * 4 + y] = R.norm() * SIG_FLOW_SEAT[k] / Math.SQRT2; }); }
    const fin = count(s, shares[i], shock, ss);
    const w = s.cands[fin[0][0]], o = s.cands[fin[1][0]];
    winners.push(w.group);
    finals.push({ pair: [w.group, o.group].sort(), share: fin[0][1] / (fin[0][1] + fin[1][1]), w: w.group });
    const coal = ["lp", "np", "lnp", "clp"];
    if ((w.group === "alp" && coal.includes(o.group)) || (o.group === "alp" && coal.includes(w.group))) tcpAlp.push(w.group === "alp" ? fin[0][1] / (fin[0][1] + fin[1][1]) : fin[1][1] / (fin[0][1] + fin[1][1]));
  });
  return { winners, finals, tcpAlp, targets };
}

const bucket = (g) => (g === "alp" ? "alp" : ["lp", "np", "lnp", "clp"].includes(g) ? "lnp" : g === "on" ? "on" : g === "grn" ? "grn" : g.startsWith("member") ? "member" : "oth");
const t0 = Date.now();

if (MODE === "replay") {
  const sim = simulate();
  let ok = 0, pairOk = 0; const tcpErr = [], miss = [];
  seats.forEach((s, i) => {
    const D = RES.divs.find((d) => d.n === s.name);
    const winC = D.c.find((c) => c[6] === 1), tcp = D.tcp.map((t) => D.c[t[0]]);
    const want = bucket(groupOfRes(winC, D, s)), got = bucket(sim.winners[i]);
    const pairWant = tcp.map((c) => bucket(groupOfRes(c, D, s))).sort().join("|"), pairGot = sim.finals[i].pair.map(bucket).sort().join("|");
    if (want === got || (want === "member" && sim.winners[i].startsWith("member"))) ok++; else miss.push(`${s.name} (${want}->${got})`);
    if (pairWant === pairGot) { pairOk++; const wv = D.tcp.find((t) => D.c[t[0]] === winC)[1], tv = D.tcp[0][1] + D.tcp[1][1]; tcpErr.push(Math.abs((want === got ? sim.finals[i].share : 1 - sim.finals[i].share) - wv / tv)); }
  });
  console.log(`REPLAY 2025 on modelled flows — winners reproduced: ${ok}/150; final pair right in ${pairOk}/150; TCP MAE where the pair is right ${(100 * tcpErr.reduce((a, b) => a + b, 0) / tcpErr.length).toFixed(2)} pts`);
  if (miss.length) console.log("misses: " + miss.join(", "));
  writeFileSync(OUT_PATH, JSON.stringify({ mode: "replay", winnersReproduced: ok, pairsRight: pairOk, tcpMaePts: r2(100 * tcpErr.reduce((a, b) => a + b, 0) / tcpErr.length), misses: miss }, null, 1) + "\n");
  process.exit(0);
}
function groupOfRes(c, D, s) {
  if (c[3] === "alp") return "alp"; if (c[3] === "grn") return "grn"; if (c[3] === "onp") return "on";
  if (c[3] === "lnp") return ({ LP: "lp", NP: "np", LNP: "lnp", CLP: "clp" }[c[1]] || "lnp");
  const m = s.cands.find((x) => x.label === c[0]); return m ? m.group : "oth";
}

/* ---- DRAWS elections ---- */
const seatWin = seats.map(() => ({})), seatFinal = seats.map(() => ({})), seatMargin = seats.map(() => []);
const KEYS = ["alp", "lnp", "on", "grn", "oth", "member"];
const tallies = Object.fromEntries(KEYS.map((k) => [k, []]));
const maj = { alp: 0, coalition: 0, on: 0, none: 0 }, most = Object.fromEntries(KEYS.map((k) => [k, 0]));
const tcpSamples = [], natDraws = [];
const pairTally = {};
for (let d = 0; d < DRAWS; d++) {
  const sim = simulate();
  const t = Object.fromEntries(KEYS.map((k) => [k, 0]));
  seats.forEach((s, i) => {
    const g = sim.winners[i]; seatWin[i][g] = (seatWin[i][g] || 0) + 1; t[bucket(g)]++;
    const pk = sim.finals[i].pair.join("|"); seatFinal[i][pk] = (seatFinal[i][pk] || 0) + 1;
    const pb = sim.finals[i].pair.map(bucket).sort().join(" v "); pairTally[pb] = (pairTally[pb] || 0) + 1;
  });
  for (const k of KEYS) tallies[k].push(t[k]);
  if (t.alp >= 76) maj.alp++; else if (t.lnp >= 76) maj.coalition++; else if (t.on >= 76) maj.on++; else maj.none++;
  const top = Math.max(...KEYS.map((k) => t[k])); const leaders = KEYS.filter((k) => t[k] === top); for (const k of leaders) most[k] += 1 / leaders.length;
  tcpSamples.push(sim.tcpAlp.length ? sim.tcpAlp.reduce((a, b) => a + b, 0) / sim.tcpAlp.length : null);
  if (d < 2000) natDraws.push(sim.targets);
}
const q = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const tcpVals = tcpSamples.filter((v) => v != null);
const expected = Object.fromEntries(KEYS.map((k) => [k, r2(tallies[k].reduce((a, b) => a + b, 0) / DRAWS)]));
const dist = Object.fromEntries(KEYS.map((k) => [k, { p05: q(tallies[k], 0.05), p25: q(tallies[k], 0.25), p50: q(tallies[k], 0.5), p75: q(tallies[k], 0.75), p95: q(tallies[k], 0.95) }]));
const INPUTS = ["data/seat-vote-layer.json", "data/aec-2025-seat-flows.json", "data/seat-candidate-set-2028.json", "data/census-2021-divisions-2025.json", "data/senate-rankings-2025.json",
  "data/seat-model-flow-calibration.json", "data/seat-model-calibration.json", "data/vote-switching.json", "map/data/res-2025.json",
  ".build/analysis/seat-model/seat-engine.mjs", ".build/analysis/seat-model/seat-inputs.mjs", ".build/analysis/seat-model/senate-flows.mjs"];
const out = {
  _about: `2028 seat model v2 (.build/analysis/seat-model/swing-simulate.mjs), mode ${MODE}: ${DRAWS.toLocaleString()} simulated elections. Logit swing from 2025; preferences replayed on each division's 2025 Senate rankings (House-calibrated, today's voters mixed from their 2025 parties); fitted polling, state, seat-type, education, seat and flow errors. ${MODE === "forecast" ? "Election-day forecast ~17 months out: 13-20-month polling error and a minor-party fade of 0-60% of the logit surge since 2025." : "Nowcast: an election held now, final-month polling error, no fade."} HARD LIMITS: the 2025 candidate field is assumed (W6); independents' votes carry over with noise; how-to-vote decisions are not modelled beyond the 2025 Senate-to-House offsets (a Coalition card putting Labor above One Nation would move many seats); intervals are floor, not ceiling.`,
  _provenance: { generated: new Date().toISOString().slice(0, 10), engine: "v2", inputs: Object.fromEntries(INPUTS.map((f) => [f, sha16(f)])) },
  meta: { mode: MODE, draws: DRAWS, seed: SEED, nowcast: VOTE.national.nowcast, window: VOTE.diagnostics.recentWindow, sigmaNational: Object.fromEntries(P5.map((p, k) => [p, r4(SIG_NAT[k])])), band, corr: CORR, tDf: DF,
    sigmaSeat: Object.fromEntries(P5.map((p, k) => [p, r4(SIG_SEAT[k])])), sigmaSeatMultiplier: SIG_MULT, kFall: K_FALL, sigmaMember: SIG_MEMBER, sigmaStateResid: SIG_STATE_RESID, sigmaClass: SIG_CLASS, sigmaEdu: SIG_EDU,
    flowShock: { national: SIG_FLOW_NAT, onAcceptability: SIG_FLOW_ON, seat: SIG_FLOW_SEAT }, composition: comp, runtimeMs: Date.now() - t0 },
  national: {
    expectedSeats: expected, seatDistribution: dist,
    majority: { alp: r4(maj.alp / DRAWS), coalition: r4(maj.coalition / DRAWS), on: r4(maj.on / DRAWS), noMajority: r4(maj.none / DRAWS) },
    mostSeats: Object.fromEntries(KEYS.map((k) => [k, r4(most[k] / DRAWS)])),
    finalPairs: Object.fromEntries(Object.entries(pairTally).map(([k, v]) => [k, r2(v / DRAWS)]).sort((a, b) => b[1] - a[1])),
    twoPartyClassic: { meanAlp: r2(100 * tcpVals.reduce((a, b) => a + b, 0) / tcpVals.length), p10: r2(100 * q(tcpVals, 0.1)), p90: r2(100 * q(tcpVals, 0.9)), coverage: r2(100 * tcpVals.length / DRAWS), note: "mean ALP share over the draw's Labor-v-Coalition finals; coverage = % of draws with at least one" },
    nationalVote: Object.fromEntries(P5.map((p, k) => [p, { p10: r2(100 * q(natDraws.map((v) => v[k]), 0.1)), p50: r2(100 * q(natDraws.map((v) => v[k]), 0.5)), p90: r2(100 * q(natDraws.map((v) => v[k]), 0.9)) }])),
  },
  seats: seats.map((s, i) => ({
    name: s.name, state: s.st,
    win: Object.fromEntries(Object.entries(seatWin[i]).map(([g, n]) => [g, r4(n / DRAWS)]).sort((a, b) => b[1] - a[1])),
    finalPairs: Object.fromEntries(Object.entries(seatFinal[i]).map(([k, n]) => [k, r4(n / DRAWS)]).sort((a, b) => b[1] - a[1])),
  })),
};
writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + "\n");
if (MODE === "nowcast" && !process.env.AUSPOL_SIM_OUT) {
  const rec = { date: VOTE.diagnostics.recentWindow.to, engine: "v2", expectedSeats: expected, majority: out.national.majority,
    seats: Object.fromEntries(out.seats.map((s) => { const top = Object.entries(s.win)[0]; return [s.name, [top[0], top[1]]]; })) };
  const existing = existsSync(HISTORY_PATH) ? readFileSync(HISTORY_PATH, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const same = existing.findIndex((r) => r.date === rec.date);
  if (same >= 0) { existing[same] = rec; writeFileSync(HISTORY_PATH, existing.map((r) => JSON.stringify(r)).join("\n") + "\n"); }
  else appendFileSync(HISTORY_PATH, JSON.stringify(rec) + "\n");
}
console.log(`seat model v2, ${MODE} — ${DRAWS.toLocaleString()} draws (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log("expected seats: " + KEYS.map((k) => `${k} ${expected[k]} [${dist[k].p05}-${dist[k].p95}]`).join("  "));
console.log(`majority: ALP ${(100 * maj.alp / DRAWS).toFixed(1)}% · Coalition ${(100 * maj.coalition / DRAWS).toFixed(1)}% · ON ${(100 * maj.on / DRAWS).toFixed(1)}% · none ${(100 * maj.none / DRAWS).toFixed(1)}%`);
console.log("most seats: " + KEYS.map((k) => `${k} ${(100 * most[k] / DRAWS).toFixed(1)}%`).join(" · "));
console.log("final pairs (avg seats): " + Object.entries(out.national.finalPairs).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log(`wrote ${OUT_PATH}`);
