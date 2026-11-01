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
import { simulateOnce, runMany } from "../analysis/seat-model/model-sim.mjs";
import { rng, cholesky } from "../analysis/seat-model/seat-engine.mjs";
import { VIC_FLOWS } from "../vic/to-main-schema.mjs";
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
/* what the preferences imply statewide at the central primaries (Labor v the Coalition), against the same
   primaries read with Victoria's 2022 flow table (the /vic/ page's) */
const cen = simulateOnce(built, { ...V.S, uncertainty: false }, rng(1), cholesky(V.S.corr), [0, 0, 0, 0, 0]);
let W2 = 0, tpp = 0; built.forEach((s2, i) => { s2.cands.forEach((c, j) => { const p = cen.prim[i][j]; tpp += s2.w * p * (c.p5 === 0 ? 1 : c.p5 === 1 ? 0 : pairShare(V.SEN, c.table, 0, 1)); }); W2 += s2.w; });
const n5 = vote.nowcast, tpp22 = (n5.alp + VIC_FLOWS.grn * n5.grn + VIC_FLOWS.onp * n5.on + VIC_FLOWS.oth * n5.oth) / (n5.alp + n5.lnp + n5.grn + n5.on + n5.oth);
/* One Nation's split, the assumption that moves most seats: as the federal model has it (its switching mix),
   and as the Victorian polls' own two-party figures imply (each recent poll publishing one, the 2022 flows
   for the Greens and others; the median) */
const fedOn = J("model/data/inputs.json").leverLevels["ON|AC"];
const pollOn = (() => { const xs = J("data/vic-polls.json").polls.filter((p) => p.tpp2 && p.tpp2.alp != null && p.primary && p.primary.onp).slice(-8)
  .map((p) => { const q = p.primary, oth = (q.oth || 0) + (q.ind || 0); return (p.tpp2.alp - q.alp - VIC_FLOWS.grn * q.grn - VIC_FLOWS.oth * oth) / q.onp; }).sort((a, b) => a - b);
  return xs.length ? { share: xs[Math.floor(xs.length / 2)], polls: xs.length } : null; })();
const lv0 = leverLevels(V.SEN, built)["ON|AC"], L = (to) => Math.log(to / (1 - to)) - Math.log(lv0 / (1 - lv0));
const sens = [["federal", fedOn], ...(pollOn ? [["polls", Math.min(0.6, Math.max(0.05, pollOn.share))]] : [])].map(([k, to]) => {
  const r = runMany(buildSeatsFrom({ ...build, seats: V.seats, SEN: V.SEN, pre: V.pre }, { composition: true, levers: { "ON|AC": L(to) } }), V.S, { draws: 4000, seed: 11 });
  return { k, onToLabor: r4(to), expected: r.expectedSeats, majority: r.majority };
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
    calibration: V.calib, tppModel: r4(tpp / W2), tpp2022Flows: r4(tpp22), pollOn, sens,
  },
  seats,
};
fs.mkdirSync("model/data", { recursive: true });
fs.writeFileSync("model/data/inputs-vic.json", JSON.stringify(out));
console.log(`model/data/inputs-vic.json ${fs.statSync("model/data/inputs-vic.json").size} bytes; ${seats.length} districts, One Nation added in ${out.evidence.onAdded}`);
