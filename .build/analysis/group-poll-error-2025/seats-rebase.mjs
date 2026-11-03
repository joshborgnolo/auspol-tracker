#!/usr/bin/env node
/* seats-rebase.mjs: what house-baselines.mjs's rebased state deviations would do to /model/'s seats.

   The official inputs (model/data/inputs.json, as the page's worker runs them) against the same inputs with the
   five mainland states' deviations moved by house-baselines' change (rebased − current, both pooled and shrunk
   the layer's way; standard errors from the rebased pool). Tasmania, the NT and the ACT are untouched (their
   cells are composites the rebase can't reach). 2,000 draws a run, the page's default seed, nowcast and
   election-day forecast; "flips" = seats whose central projection changes party.

   Run from the repo root:
     node .build/analysis/group-poll-error-2025/seats-rebase.mjs > .build/analysis/group-poll-error-2025/out/seats-rebase.txt */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { rebase } from "./house-baselines.mjs";
import { rankingsFrom } from "../seat-model/senate-flows.mjs";
import { buildSeatsFrom } from "../seat-model/seat-build.mjs";
import { projectOnce, runMany, bucketOf } from "../seat-model/model-sim.mjs";

process.chdir(ROOT);
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const I = J("model/data/inputs.json"), SEN = rankingsFrom(J("data/senate-rankings-2025.json"));
const P5 = ["alp", "lnp", "on", "grn", "oth"];
const R = rebase();
const rebasedStates = (states) => Object.fromEntries(Object.entries(states).map(([st, d]) => {
  if (!R.shrunk.rebased[st]) return [st, d];
  return [st, { dev: d.dev.map((x, k) => x + R.shrunk.rebased[st][P5[k]].dev - R.shrunk.now[st][P5[k]].dev), se: P5.map((p) => R.shrunk.rebased[st][p].se) }];
}));
const f = (x) => (x >= 0 ? "+" : "") + x.toFixed(2);
console.log("Mainland state deviations, official → rebased (points; alp lnp on grn oth):");
for (const st of Object.keys(R.shrunk.rebased)) console.log(`  ${st.padEnd(4)} ` + I.settings.nowcast.states[st].dev.map((x, k) => `${P5[k]} ${f(x)}→${f(rebasedStates(I.settings.nowcast.states)[st].dev[k])}`).join("  "));
const built = buildSeatsFrom({ seats: I.seats, hist: I.build.hist, comp: I.build.comp, ST: I.build.ST, SEN, pre: I.pre }, { composition: true });
for (const mode of ["nowcast", "forecast"]) {
  const base = mode === "nowcast" ? I.settings.nowcast : I.settings.forecast;
  console.log(`\n${mode}: expected seats, Labor majority, central-projection flips`);
  let ref;
  for (const [name, S] of [["official", base], ["rebased states", { ...base, states: rebasedStates(base.states) }]]) {
    const c = projectOnce(built, S), run = runMany(built, S, { draws: 2000 }), e = run.expectedSeats;
    if (!ref) ref = c;
    const flips = c.perSeat.map((p, i) => [p, ref.perSeat[i]]).filter(([p, q]) => bucketOf(p.w) !== bucketOf(q.w)).map(([p, q]) => `${p.name} ${bucketOf(q.w)}→${bucketOf(p.w)}`);
    console.log(`  ${name.padEnd(16)} ALP ${e.alp.toFixed(1)}  L/NP ${e.lnp.toFixed(1)}  ON ${e.on.toFixed(1)}  GRN ${e.grn.toFixed(1)}  IND+OTH ${(e.oth + e.member).toFixed(1)}  majority ${(100 * run.majority.alp).toFixed(1)}%  flips ${flips.length}${flips.length ? ": " + flips.join(", ") : ""}`);
  }
}
