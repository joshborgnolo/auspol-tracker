#!/usr/bin/env node
/* vic-simulate.mjs: the Victorian election model's official run (28 November 2026, 88 Assembly seats,
   45 for a majority). The federal model's engine on Victoria's base: the VEC's 2026 candidates, sitting
   members, errors fitted on state elections and preferences set to Victoria's own evidence (vic-inputs.mjs
   says what is Victoria's and what is borrowed). Writes data/seat-model-vic-2026.json, shaped like the
   federal runs so the /model/ page reads both alike, and one line per polling date in
   data/seat-model-vic-2026-history.jsonl.
   AUSPOL_SIM_DRAWS overrides the 20,000 simulations; AUSPOL_SIM_OUT writes elsewhere (no history line). */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { buildSeatsFrom } from "./seat-build.mjs";
import { runMany, projectOnce, KEYS } from "./model-sim.mjs";
import { VIC, vicVote, prepVic, vicRespondents } from "./vic-inputs.mjs";
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
const INPUTS = ["data/vic-polls.json", "data/vic-candidates-2026.json", "data/vic-htv-2026.json", "data/vic-lc-2022-by-district.json", "data/seat-model-state-swing.json", "data/seat-model-state-polls.json",
  "map/data/res-vic22.json", "map/data/res-vic18.json", "map/data/res-vic14.json", "map/data/res-2025.json", "map/data/la-seating-plan-vic-2026-08-11.json", "data/senate-rankings-2025.json",
  ".build/aec-flow-src/senate-ballots/booth-rankings-2025.json.gz", "data/seat-model-flow-calibration.json", "data/seat-model-calibration.json", "data/seat-model-backtest-states.json", "data/aec-2025-tcp-flow-by-division.csv", "map/data/res-2022.json", ".build/aec-flow-src/senate-ballots/booth-rankings-2022.json.gz", "data/senate-rankings-2022.json", ".build/vic/to-main-schema.mjs",
  ".build/analysis/seat-model/seat-engine.mjs", ".build/analysis/seat-model/senate-flows.mjs", ".build/analysis/seat-model/seat-build.mjs", ".build/analysis/seat-model/model-sim.mjs",
  ".build/analysis/seat-model/state-tables.mjs", ".build/analysis/seat-model/vic-field.mjs", ".build/analysis/seat-model/vic-inputs.mjs"];
const r4 = (x) => (x == null ? null : Math.round(x * 1e4) / 1e4);
const out = {
  _about: `Victorian election model (.build/analysis/seat-model/vic-simulate.mjs): ${DRAWS.toLocaleString()} simulated elections for ${VIC.electionLabel}, 88 Assembly seats. The federal 2028 model's engine on Victoria's base: the /vic/ polling average; the VEC's ${V.field.tallies.candidates} nominated candidates, each starting from its party's or its own 2022 vote in the district (One Nation: its federal 2025 footprint; a party with no 2022 Assembly vote there: its 2022 Council vote; a candidate new to the ballot: the 2022 median); sitting-member terms, polling error and district noise fitted on state elections; preferences from the 2025 Senate ballots at the nearest federal polling place (House-calibrated), the Greens' and minor parties' Labor-v-Coalition levels set to Victoria's 2022 count, every level involving One Nation moved halfway from the federal reading to Victorian poll respondents' own allocation, and the registered how-to-vote cards read district by district. HARD LIMITS: no age/gender term; by-elections since 2022 change who sits, not the starting vote; candidates disendorsed after nominations closed are counted as their party's; the Legislative Council is not modelled.`,
  _provenance: { generated: new Date().toISOString().slice(0, 10), engine: "v2.3-vic", inputs: Object.fromEntries(INPUTS.map((f) => [f, sha16(f)])) },
  meta: { mode: "vic", jurisdiction: "vic", seatsTotal: VIC.seats, majority: VIC.majority, election: VIC.election, electionLabel: VIC.electionLabel, draws: DRAWS, seed: SEED,
    nowcast: vote.nowcast, result2022: V.result2022, pollsTo: vote.pollsTo, polls: vote.polls, recentPolls: vote.recent, band: V.S.band,
    sigmaNational: Object.fromEntries(["alp", "lnp", "on", "grn", "oth"].map((p, k) => [p, Math.round(V.S.sigNat[k] * 1e4) / 1e4])), sigmaSeat: res.sigmaSeat,
    sigmaNationalSource: "state elections' final-month polls (data/seat-model-state-polls.json); One Nation: the federal floor",
    field: { asAt: V.field.asAt, ...V.field.tallies, medianIndependent: r4(V.field.record.medianIndependent), sigIndependent: r4(V.field.record.sigIndependent), medianMinor: r4(V.field.record.medianMinor) },
    terms: { rec: V.errors.terms.rec, ret: V.errors.terms.ret },
    respondents: vicRespondents(),   // the readings the run used: refresh.mjs re-runs when they move (a wave's allocation can land after its primaries)
    calibration: Object.fromEntries(Object.entries(V.calib).filter(([, c]) => c.shift != null).map(([k, c]) => [k, { senate: r4(c.senate), ...(c.federal != null ? { federal: r4(c.federal), respondents: r4(c.respondents) } : {}), target: r4(c.target), logitShift: r4(c.shift) }])),
    cards: { tally: V.cardTally, districts: Object.fromEntries(Object.entries(V.cards).map(([k, c]) => [k, c.text])) }, runtimeMs: Date.now() - t0 },
  national: { expectedSeats: res.expectedSeats, seatDistribution: res.seatDistribution, histogram: res.histogram, majority: res.majority, mostSeats: res.mostSeats,
    finalPairs: res.finalPairs, twoPartyClassic: res.twoPartyClassic, nationalVote: res.nationalVote, central: central.seats },
  seats: res.seats.map((s, i) => ({ ...s, central: { w: central.perSeat[i].w, pair: central.perSeat[i].pair, share: central.perSeat[i].share } })),
};
out.national.headline = headline(out, "vic");
writeFileSync(OUT, JSON.stringify(out) + "\n");
if (!process.env.AUSPOL_SIM_OUT) {
  const rec = { date: vote.pollsTo, engine: out._provenance.engine, expectedSeats: res.expectedSeats, majority: res.majority, seats: Object.fromEntries(res.seats.map((s) => { const top = Object.entries(s.win)[0]; return [s.name, [top[0], top[1]]]; })) };
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
