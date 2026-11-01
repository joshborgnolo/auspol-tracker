#!/usr/bin/env node
/* export-vic.mjs: the /model/ page's Victorian data, from the Victorian run (vic-simulate.mjs).

   Writes model/data/inputs-vic.json: what the page shows beside the run (each district's 2022 count,
   who holds it now, its preference choices) and everything its worker needs to re-run the model on a
   reader's settings - the district skeleton, the districts' Senate tables already read and calibrated
   (`pre`, the same rounded tables the official run used), the settings, the levers and their levels -
   plus the evidence the Victorian method notes quote (the Victoria 2022 replay, the SA 2026 surge test).
   Run after vic-simulate.mjs, then .build/model/assemble.mjs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeatsFrom, LEVERS, leverLevels } from "../analysis/seat-model/seat-build.mjs";
import { pairShare } from "../analysis/seat-model/senate-flows.mjs";
import { VIC, vicVote, prepVic } from "../analysis/seat-model/vic-inputs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(HERE, "..", ".."));
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const r4 = (x) => Math.round(x * 10000) / 10000;

const RUN = J("data/seat-model-vic-2026.json"), STATES = J("data/seat-model-backtest-states.json");
const vote = await vicVote();
if (JSON.stringify(vote.nowcast) !== JSON.stringify(RUN.meta.nowcast)) throw new Error("the Victorian run is not on the current polls: re-run vic-simulate.mjs first");
const V = prepVic({ vote });
const build = { ST: V.ST, comp: V.comp, hist: { bySeat: {}, mean: {} } };
const built = buildSeatsFrom({ ...build, seats: V.seats, SEN: V.SEN, pre: V.pre }, { composition: true });
const seats = V.seats.map((s, i) => {
  const tab = (cls) => built[i].cands.find((c) => c.cls === cls)?.table;
  const share = (cls, x, y) => { const t = tab(cls); return t ? r4(pairShare(V.SEN, t, x, y)) : null; };
  return { ...s, flows: { coalLaborOverOn: share("COAL", 0, 3), laborCoalitionOverOn: share("ALP", 1, 3), onLaborOverCoalition: share("ON", 0, 1), greensLaborOverCoalition: share("GRN", 0, 1) } };
});
const v22 = STATES.results.vic22, sa26 = STATES.results.sa26;
const out = {
  _about: "Inputs for the /model/ page's Victorian view (built by .build/model/export-vic.mjs). The worker builds each candidate's table from `pre` (each district's 2025 Senate tables, read at the nearest federal polling places and House-calibrated, state-tables.mjs) with seat-build.mjs and runs model-sim.mjs - the files the official run uses.",
  generated: new Date().toISOString().slice(0, 10),
  asOf: { pollsTo: vote.pollsTo, polls: vote.polls, recent: vote.recent, modelRun: RUN._provenance.generated, election: VIC.election, electionLabel: VIC.electionLabel },
  vote: { nowcast: vote.nowcast, result2022: V.result2022 },
  settings: { vic: V.S },
  build,
  pre: V.pre,
  levers: Object.fromEntries(Object.entries(LEVERS).map(([k, L]) => [k, { label: L.label, cls: L.cls, x: L.x, y: L.y, also: L.also || null }])),
  leverLevels: Object.fromEntries(Object.entries(leverLevels(V.SEN, built)).map(([k, v]) => [k, r4(v)])),
  evidence: {
    vic22: { seats: v22.seats, actualSeats: v22.actualSeats, replay: v22.replay },
    sa26chain: sa26.chain, sa26: { seats: sa26.seats, actualSeats: sa26.actualSeats },
    onAdded: seats.filter((s) => s.cands.some((c) => c.added)).length,
  },
  seats,
};
fs.mkdirSync("model/data", { recursive: true });
fs.writeFileSync("model/data/inputs-vic.json", JSON.stringify(out));
console.log(`model/data/inputs-vic.json ${fs.statSync("model/data/inputs-vic.json").size} bytes; ${seats.length} districts, One Nation added in ${out.evidence.onAdded}`);
