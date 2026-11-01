#!/usr/bin/env node
/* test-model-bundle.mjs: the /model/ page runs the official engine, not a copy of it.
   1. model/js/ holds byte-identical copies of the pure modules in .build/analysis/seat-model/
      (assemble.mjs writes them; editing either side without re-running it fails here).
   2. Seats rebuilt the browser's way - model/data/inputs.json + /data/senate-rankings-2025.json through
      the copied modules - simulate EXACTLY as the node pipeline's do, draw for draw, at a fixed seed.
   3. The bundle's settings are the ones the official nowcast ran with.
   Run from the repo root: node .build/model/test-model-bundle.mjs */
import fs from "node:fs";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const MODS = ["seat-engine.mjs", "senate-flows.mjs", "seat-build.mjs", "model-sim.mjs"];
for (const m of MODS) {
  const src = fs.readFileSync(`.build/analysis/seat-model/${m}`, "utf8");
  assert.ok(fs.existsSync(`model/js/${m}`), `model/js/${m} exists (node .build/model/assemble.mjs)`);
  assert.equal(fs.readFileSync(`model/js/${m}`, "utf8"), src, `model/js/${m} is current (node .build/model/assemble.mjs)`);
}
const imp = (p) => import(pathToFileURL(p).href);
const B = await imp("model/js/seat-build.mjs"), F = await imp("model/js/senate-flows.mjs"), M = await imp("model/js/model-sim.mjs");
const N = await imp(".build/analysis/seat-model/seat-inputs.mjs"), NM = await imp(".build/analysis/seat-model/model-sim.mjs");
const inputs = JSON.parse(fs.readFileSync("model/data/inputs.json", "utf8"));
const SEN = F.rankingsFrom(JSON.parse(fs.readFileSync("data/senate-rankings-2025.json", "utf8")));
const browserSeats = B.buildSeatsFrom({ seats: inputs.seats, hist: inputs.build.hist, comp: inputs.build.comp, ST: inputs.build.ST, SEN }, { composition: true });
const nodeInp = N.prepInputs({ composition: true });
const nodeSeats = N.buildSeatsFrom(nodeInp, { composition: true });
const S = inputs.settings.nowcast;
const a = M.runMany(browserSeats, S, { draws: 300, seed: 7 });
const b = NM.runMany(nodeSeats, S, { draws: 300, seed: 7 });
assert.deepEqual(a.expectedSeats, b.expectedSeats, "same expected seats");
assert.deepEqual(a.seats, b.seats, "same seat-by-seat results");
assert.deepEqual(M.projectOnce(browserSeats, S).perSeat, NM.projectOnce(nodeSeats, S).perSeat, "same central projection");
// levers reach the routing: a big Coalition->Labor shift must add Labor seats in the central projection
const lev = B.buildSeatsFrom({ seats: inputs.seats, hist: inputs.build.hist, comp: inputs.build.comp, ST: inputs.build.ST, SEN }, { composition: true, levers: { "COAL|AO": 1.5 } });
assert.ok(M.projectOnce(lev, S).seats.alp > M.projectOnce(browserSeats, S).seats.alp, "the Coalition-card lever moves seats to Labor");
// the bundle's nowcast settings are the official run's
const off = JSON.parse(fs.readFileSync("data/seat-model-2028-nowcast.json", "utf8"));
assert.deepEqual(Object.values(off.meta.sigmaNational), S.sigNat.map((x) => Math.round(x * 10000) / 10000), "bundle polling error = the official run's");
assert.deepEqual(off.meta.nowcast, inputs.vote.nowcast, "bundle nowcast = the official run's");
console.log(`model bundle OK: ${MODS.length} modules identical, browser rebuild reproduces the node engine draw for draw (300 draws, ${browserSeats.length} seats), levers live`);
