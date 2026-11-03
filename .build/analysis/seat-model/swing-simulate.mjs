#!/usr/bin/env node
/* swing-simulate.mjs: the 2028 seat model's official runs (layers 3-5 of .build/analysis/seat-model-plan.md).
   v2, 2026-11-01; v2.1 the same day (shared pure modules for the /model/ page, national flow shocks
   sized on observed drift, the Coalition's Labor-v-One Nation offset set from its own counts); v2.2
   the same night (seat terms fitted on every election 1996-2025 - sitting members, defections, reversion
   of each seat's 2025 surprise - and the seat noise and its multiplier tested on 2001-2025, swing-fit.mjs,
   calibrate-swing.mjs, backtest-long.mjs).
   Design and evidence: .build/analysis/seat-model-design-review.md, sections 12-14.

   The model itself lives in pure modules the /model/ page runs too (one implementation):
     seat-engine.mjs   logit spread, the count
     senate-flows.mjs  Senate-ballot ranking tables and the routing they give
     seat-build.mjs    every candidate's table: House-calibrated, national levels set to the site's tables, levers
     model-sim.mjs     one election, many elections, the no-noise projection
   This file is the node side: it prepares the seat skeleton from the committed stores
   (seat-inputs.mjs), takes the settings from the calibration files (model-sim.modelSettings) and
   writes the runs.

   Modes (AUSPOL_SIM_MODE): nowcast (default; "if held today") -> data/seat-model-2028-nowcast.json
   + one history line per polling window; forecast (election day, ~17 months out) ->
   data/seat-model-2028-forecast.json; replay (the certified 2025 primaries counted on the modelled
   flows, no noise: the flow layer's check, printed). AUSPOL_SIM_DRAWS, AUSPOL_SIM_OUT override. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { count, P5 } from "./seat-engine.mjs";
import { prepInputs, buildSeatsFrom } from "./seat-inputs.mjs";
import { modelSettings, runMany, projectOnce, bucketOf, KEYS } from "./model-sim.mjs";
import { headline } from "../../model/views.mjs";

const MODE = process.env.AUSPOL_SIM_MODE || (process.env.AUSPOL_SIM_NULL === "1" ? "replay" : "nowcast");
const DRAWS = +(process.env.AUSPOL_SIM_DRAWS || 20000);
const SEED = 20261101;
const OUT_PATH = process.env.AUSPOL_SIM_OUT || (MODE === "replay" ? join(tmpdir(), "auspol-sim-replay.json") : MODE === "forecast" ? "data/seat-model-2028-forecast.json" : "data/seat-model-2028-nowcast.json");
const HISTORY_PATH = "data/seat-model-2028-history.jsonl";
const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const sha16 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);
const r2 = (x) => Math.round(x * 100) / 100, r4 = (x) => Math.round(x * 10000) / 10000;
const t0 = Date.now();

const VOTE = J("data/seat-vote-layer.json");
const CAL = J("data/seat-model-calibration.json");
const FCAL = J("data/seat-model-flow-calibration.json");
const DRIFT = J("data/seat-model-backtest-states.json").drift;
const inputs = prepInputs({ composition: MODE !== "replay", replay: MODE === "replay" });
const seats = buildSeatsFrom(inputs, { composition: MODE !== "replay" });

if (MODE === "replay") {
  const RES = J("map/data/res-2025.json");
  const groupOfRes = (c, s) => {
    if (c[3] === "alp") return "alp"; if (c[3] === "grn") return "grn"; if (c[3] === "onp") return "on";
    if (c[3] === "lnp") return ({ LP: "lp", NP: "np", LNP: "lnp", CLP: "clp" }[c[1]] || "lnp");
    const m = s.cands.find((x) => x.label === c[0]); return m ? m.group : "oth";
  };
  let ok = 0, pairOk = 0; const tcpErr = [], miss = [];
  for (const s of seats) {
    const fin = count(s, s.cands.map((c) => c.base), null, null);
    const wg = s.cands[fin[0][0]].group, og = s.cands[fin[1][0]].group, share = fin[0][1] / (fin[0][1] + fin[1][1]);
    const D = RES.divs.find((d) => d.n === s.name);
    const winC = D.c.find((c) => c[6] === 1), want = bucketOf(groupOfRes(winC, s)), got = bucketOf(wg);
    const pairWant = D.tcp.map((t) => bucketOf(groupOfRes(D.c[t[0]], s))).sort().join("|"), pairGot = [wg, og].map(bucketOf).sort().join("|");
    if (want === got) ok++; else miss.push(`${s.name} (${want}->${got})`);
    if (pairWant === pairGot) { pairOk++; const wv = D.tcp.find((t) => D.c[t[0]] === winC)[1], tv = D.tcp[0][1] + D.tcp[1][1]; tcpErr.push(Math.abs((want === got ? share : 1 - share) - wv / tv)); }
  }
  const mae = r2(100 * tcpErr.reduce((a, b) => a + b, 0) / tcpErr.length);
  console.log(`REPLAY 2025 on modelled flows — winners reproduced: ${ok}/150; final pair right in ${pairOk}/150; TCP MAE where the pair is right ${mae} pts`);
  if (miss.length) console.log("misses: " + miss.join(", "));
  writeFileSync(OUT_PATH, JSON.stringify({ mode: "replay", winnersReproduced: ok, pairsRight: pairOk, tcpMaePts: mae, misses: miss }, null, 1) + "\n");
  process.exit(0);
}

const S = modelSettings({ VOTE, CAL, FCAL, DRIFT, mode: MODE });
const res = runMany(seats, S, { draws: DRAWS, seed: SEED });
const central = projectOnce(seats, S);
const INPUTS = ["data/seat-vote-layer.json", "data/aec-2025-seat-flows.json", "data/seat-candidate-set-2028.json", "data/census-2021-divisions-2025.json", "data/senate-rankings-2025.json",
  "data/seat-model-flow-calibration.json", "data/seat-model-calibration.json", "data/seat-model-backtest-states.json", "data/vote-switching.json", "map/data/res-2025.json",
  "data/house-incumbency.json", "map/data/res-2022.json",
  ".build/analysis/seat-model/seat-engine.mjs", ".build/analysis/seat-model/senate-flows.mjs", ".build/analysis/seat-model/seat-build.mjs", ".build/analysis/seat-model/model-sim.mjs", ".build/analysis/seat-model/seat-inputs.mjs",
  ".build/analysis/seat-model/swing-fit.mjs", ".build/newtracker/flows.mjs"];
const out = {
  _about: `2028 seat model v2.2 (.build/analysis/seat-model/swing-simulate.mjs), mode ${MODE}: ${DRAWS.toLocaleString()} simulated elections. Logit swing from 2025 with seat terms fitted on 1996-2025 (sitting members, defections, reversion of each seat's 2025 surprise); preferences replayed on each division's 2025 Senate rankings (House-calibrated; the Coalition's Labor-v-One Nation and One Nation's Labor-v-Coalition levels set to the site's flow tables); fitted polling, state, seat-type, education, seat and flow errors. ${MODE === "forecast" ? "Election-day forecast ~17 months out: 13-20-month polling error and a minor-party fade of 0-60% of the logit surge since 2025." : "Nowcast: an election held now, final-month polling error, no fade."} HARD LIMITS: the 2025 candidate field is assumed (W6); independents' votes carry over with noise; how-to-vote decisions are not modelled beyond the 2025 Senate-to-House offsets (a Coalition card putting Labor above One Nation would move many seats); intervals are floor, not ceiling.`,
  _provenance: { generated: new Date().toISOString().slice(0, 10), engine: "v2.2", inputs: Object.fromEntries(INPUTS.map((f) => [f, sha16(f)])) },
  meta: { mode: MODE, draws: DRAWS, seed: SEED, nowcast: VOTE.national.nowcast, window: VOTE.diagnostics.recentWindow, band: S.band,
    sigmaNational: Object.fromEntries(P5.map((p, k) => [p, r4(S.sigNat[k])])), corr: S.corr, tDf: S.df,
    sigmaSeat: res.sigmaSeat, sigmaSeatMultiplier: S.sigMult, kFall: S.kFall, sigmaMember: S.sigMember, sigmaStateResid: S.sigStateResid, sigmaClass: S.sigClass, sigmaEdu: S.sigEdu,
    flowShock: { national: S.flowNat, onAcceptability: S.flowOn, seat: S.flowSeat }, fade: S.fade, composition: inputs.comp, runtimeMs: Date.now() - t0 },
  national: { expectedSeats: res.expectedSeats, seatDistribution: res.seatDistribution, histogram: res.histogram, majority: res.majority, mostSeats: res.mostSeats,
    finalPairs: res.finalPairs, twoPartyClassic: res.twoPartyClassic, nationalVote: res.nationalVote, central: central.seats },
  seats: res.seats.map((s, i) => ({ ...s, central: { w: central.perSeat[i].w, pair: central.perSeat[i].pair, share: central.perSeat[i].share } })),
};
// the run's headline, by the /model/ page's own rules (.build/model/views.mjs) - the More menu quotes it
out.national.headline = headline(out, MODE);
writeFileSync(OUT_PATH, JSON.stringify(out) + "\n");
if (MODE === "nowcast" && !process.env.AUSPOL_SIM_OUT) {
  const rec = { date: VOTE.diagnostics.recentWindow.to, engine: "v2.2", expectedSeats: res.expectedSeats, majority: res.majority,
    seats: Object.fromEntries(res.seats.map((s) => { const top = Object.entries(s.win)[0]; return [s.name, [top[0], top[1]]]; })) };
  const existing = existsSync(HISTORY_PATH) ? readFileSync(HISTORY_PATH, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const same = existing.findIndex((r) => r.date === rec.date);
  if (same >= 0) { existing[same] = rec; writeFileSync(HISTORY_PATH, existing.map((r) => JSON.stringify(r)).join("\n") + "\n"); }
  else appendFileSync(HISTORY_PATH, JSON.stringify(rec) + "\n");
}
const e = res.expectedSeats, d = res.seatDistribution, m = res.majority;
console.log(`seat model v2.2, ${MODE} — ${DRAWS.toLocaleString()} draws (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log("expected seats: " + KEYS.map((k) => `${k} ${e[k]} [${d[k].p05}-${d[k].p95}]`).join("  "));
console.log(`majority: ALP ${(100 * m.alp).toFixed(1)}% · Coalition ${(100 * m.coalition).toFixed(1)}% · ON ${(100 * m.on).toFixed(1)}% · none ${(100 * m.noMajority).toFixed(1)}%`);
console.log("most seats: " + KEYS.map((k) => `${k} ${(100 * res.mostSeats[k]).toFixed(1)}%`).join(" · "));
console.log("central projection: " + KEYS.map((k) => `${k} ${central.seats[k]}`).join(" · "));
console.log("final pairs (avg seats): " + Object.entries(res.finalPairs).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log(`wrote ${OUT_PATH}`);
