#!/usr/bin/env node
/* vic-simulate.mjs: the Victorian election model's official run (28 November 2026, 88 Assembly seats,
   45 for a majority). The federal model's engine and errors on Victoria's base (vic-inputs.mjs says what
   differs). Writes data/seat-model-vic-2026.json, shaped like the federal runs so the /model/ page reads
   both alike, and one line per polling date in data/seat-model-vic-2026-history.jsonl.
   AUSPOL_SIM_DRAWS overrides the 20,000 simulations; AUSPOL_SIM_OUT writes elsewhere (no history line). */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { buildSeatsFrom } from "./seat-build.mjs";
import { runMany, projectOnce, KEYS } from "./model-sim.mjs";
import { VIC, vicVote, prepVic } from "./vic-inputs.mjs";
import { headline } from "../../model/views.mjs";

const DRAWS = +(process.env.AUSPOL_SIM_DRAWS || 20000), SEED = 20261128;
const OUT = process.env.AUSPOL_SIM_OUT || "data/seat-model-vic-2026.json", HIST = "data/seat-model-vic-2026-history.jsonl";
const sha16 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);
const t0 = Date.now();

const vote = await vicVote();
const V = prepVic({ vote });
const seats = buildSeatsFrom({ seats: V.seats, comp: V.comp, ST: V.ST, SEN: V.SEN, pre: V.pre, hist: { bySeat: {}, mean: {} } }, { composition: true });
const res = runMany(seats, V.S, { draws: DRAWS, seed: SEED });
const central = projectOnce(seats, V.S);
const INPUTS = ["data/vic-polls.json", "maps/data/res-vic22.json", "maps/data/res-2025.json", "maps/data/la-seating-plan-vic-2026-08-11.json", "data/senate-rankings-2025.json",
  ".build/aec-flow-src/senate-ballots/booth-rankings-2025.json.gz", "data/seat-model-flow-calibration.json", "data/seat-model-calibration.json", "data/seat-model-backtest-states.json", "data/aec-2025-tcp-flow-by-division.csv", "maps/data/res-2022.json", ".build/aec-flow-src/senate-ballots/booth-rankings-2022.json.gz", "data/senate-rankings-2022.json", ".build/vic/to-main-schema.mjs",
  ".build/analysis/seat-model/seat-engine.mjs", ".build/analysis/seat-model/senate-flows.mjs", ".build/analysis/seat-model/seat-build.mjs", ".build/analysis/seat-model/model-sim.mjs",
  ".build/analysis/seat-model/state-tables.mjs", ".build/analysis/seat-model/vic-inputs.mjs"];
const out = {
  _about: `Victorian election model (.build/analysis/seat-model/vic-simulate.mjs): ${DRAWS.toLocaleString()} simulated elections for ${VIC.electionLabel}, 88 Assembly seats. The federal 2028 model's engine and fitted errors on Victoria's 2022 district counts, the /vic/ polling average, One Nation added in every district at its federal 2025 footprint, preferences from the 2025 Senate ballots at the nearest federal polling place (House-calibrated), each group's Labor-v-Coalition level set to its last measured Victorian count (Greens and minor parties: the 2022 state count; One Nation: the 2025 federal count in Victoria); no federal vote-switching mix. HARD LIMITS: the 2022 candidate field is assumed (plus One Nation); no age/gender term; by-elections and defections since 2022 are not in the base; the Legislative Council is not modelled.`,
  _provenance: { generated: new Date().toISOString().slice(0, 10), engine: "v2.1-vic", inputs: Object.fromEntries(INPUTS.map((f) => [f, sha16(f)])) },
  meta: { mode: "vic", jurisdiction: "vic", seatsTotal: VIC.seats, majority: VIC.majority, election: VIC.election, electionLabel: VIC.electionLabel, draws: DRAWS, seed: SEED,
    nowcast: vote.nowcast, result2022: V.result2022, pollsTo: vote.pollsTo, polls: vote.polls, recentPolls: vote.recent, band: V.S.band,
    sigmaNational: Object.fromEntries(["alp", "lnp", "on", "grn", "oth"].map((p, k) => [p, Math.round(V.S.sigNat[k] * 1e4) / 1e4])), sigmaSeat: res.sigmaSeat,
    calibration: Object.fromEntries(Object.entries(V.calib).map(([k, c]) => [k, { measured2022: c.target, senate2022: Math.round(c.senate * 1e4) / 1e4, logitShift: Math.round(c.shift * 1e4) / 1e4 }])), runtimeMs: Date.now() - t0 },
  national: { expectedSeats: res.expectedSeats, seatDistribution: res.seatDistribution, histogram: res.histogram, majority: res.majority, mostSeats: res.mostSeats,
    finalPairs: res.finalPairs, twoPartyClassic: res.twoPartyClassic, nationalVote: res.nationalVote, central: central.seats },
  seats: res.seats.map((s, i) => ({ ...s, central: { w: central.perSeat[i].w, pair: central.perSeat[i].pair, share: central.perSeat[i].share } })),
};
out.national.headline = headline(out, "vic");
writeFileSync(OUT, JSON.stringify(out) + "\n");
if (!process.env.AUSPOL_SIM_OUT) {
  const rec = { date: vote.pollsTo, expectedSeats: res.expectedSeats, majority: res.majority, seats: Object.fromEntries(res.seats.map((s) => { const top = Object.entries(s.win)[0]; return [s.name, [top[0], top[1]]]; })) };
  const ex = existsSync(HIST) ? readFileSync(HIST, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const same = ex.findIndex((r) => r.date === rec.date);
  if (same >= 0) { ex[same] = rec; writeFileSync(HIST, ex.map((r) => JSON.stringify(r)).join("\n") + "\n"); } else appendFileSync(HIST, JSON.stringify(rec) + "\n");
}
const e = res.expectedSeats, d = res.seatDistribution, m = res.majority;
console.log(`Victorian model - ${DRAWS.toLocaleString()} draws (${((Date.now() - t0) / 1000).toFixed(1)} s), polls to ${vote.pollsTo}: ${JSON.stringify(vote.nowcast)}`);
console.log("expected seats: " + KEYS.map((k) => `${k} ${e[k]} [${d[k].p05}-${d[k].p95}]`).join("  "));
console.log(`majority: ALP ${(100 * m.alp).toFixed(1)}% · Coalition ${(100 * m.coalition).toFixed(1)}% · ON ${(100 * m.on).toFixed(1)}% · none ${(100 * m.noMajority).toFixed(1)}%`);
console.log("central projection: " + KEYS.map((k) => `${k} ${central.seats[k]}`).join(" · "));
console.log("final pairs (avg seats): " + Object.entries(res.finalPairs).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log("headline: " + out.national.headline);
