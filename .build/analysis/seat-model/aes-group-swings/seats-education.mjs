#!/usr/bin/env node
/* seats-education.mjs: what an education term would do to /model/'s seats.

   The official inputs (model/data/inputs.json, as the page's worker runs them) with a fixed term added to each
   seat's demographic offset: the change in a party's graduate gap (logit) times the seat's university share
   (res demo `uni`) less the vote-weighted mean, stored as points at the party's nowcast share (the offset's
   unit; the engine turns points back into logit at each draw's own national share, so forecast-mode runs see
   it slightly rescaled). Gap changes, all read from the stores:

     same-house   calibrate-education.mjs's within-house change since each house's first post-election
                  crosstabs (data/seat-model-calibration.json education.estimate)
     AES baseline poll-gaps.mjs: the polls' late window against the AES 2025, mean across houses

   2,000 draws a run, the page's default seed, nowcast and election-day forecast. "flips" = seats whose central
   projection (no noise) changes party.

   Run from the repo root:
     node .build/analysis/seat-model/aes-group-swings/seats-education.mjs > .build/analysis/seat-model/aes-group-swings/out/seats-education.txt */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankingsFrom } from "../senate-flows.mjs";
import { buildSeatsFrom } from "../seat-build.mjs";
import { projectOnce, runMany, bucketOf } from "../model-sim.mjs";
import { pollGaps } from "./poll-gaps.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(HERE, "..", "..", "..", ".."));
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const I = J("model/data/inputs.json"), CAL = J("data/seat-model-calibration.json").education.estimate, SEN = rankingsFrom(J("data/senate-rankings-2025.json"));
const P5 = ["alp", "lnp", "on", "grn", "oth"], AES_KEY = { alp: "alp", lnp: "lnp", grn: "grn", on: "onp" };
const now5 = I.settings.nowcast.now5;
const W = I.seats.reduce((a, s) => a + s.w, 0), ubar = I.seats.reduce((a, s) => a + s.w * s.uni, 0) / W;
const sd = Math.sqrt(I.seats.reduce((a, s) => a + s.w * (s.uni - ubar) ** 2, 0) / W);
const G = pollGaps().lateVsAes;
const same = (k) => CAL[AES_KEY[k]].gapChange, aes = (k) => G[AES_KEY[k]].mean;
const VARIANTS = {
  "official": {},
  "Coalition, same-house": { lnp: same("lnp") },
  "all four, same-house": { alp: same("alp"), lnp: same("lnp"), grn: same("grn"), on: same("on") },
  "Coalition, AES baseline": { lnp: aes("lnp") },
  "Coalition+Greens, AES": { lnp: aes("lnp"), grn: aes("grn") },
  "all four, AES baseline": { alp: aes("alp"), lnp: aes("lnp"), grn: aes("grn"), on: aes("on") },
};
const withTerm = (dg) => I.seats.map((s) => ({ ...s, demoPP: s.demoPP.map((v, k) => v + (dg[P5[k]] || 0) * (s.uni - ubar) * 100 * now5[k] * (1 - now5[k])) }));
const r2 = (x) => (x >= 0 ? "+" : "") + x.toFixed(2);
console.log(`University share across the seats: mean ${ubar.toFixed(3)}, SD ${sd.toFixed(3)}, ${Math.min(...I.seats.map((s) => s.uni)).toFixed(2)}-${Math.max(...I.seats.map((s) => s.uni)).toFixed(2)}. The model's random education shock: SD ${I.settings.nowcast.sigEdu} logit per SD of it = ${(I.settings.nowcast.sigEdu / sd).toFixed(2)} per unit share.`);
console.log("Gap changes tested (logit per unit university share): " + Object.entries(VARIANTS).slice(1).map(([k, v]) => `${k}: ` + Object.entries(v).map(([p, x]) => `${p} ${r2(x)}`).join(" ")).join("; "));
for (const mode of ["nowcast", "forecast"]) {
  const S = mode === "nowcast" ? I.settings.nowcast : { ...I.settings.forecast, fade: I.settings.forecast.fade };
  console.log(`\n${mode}: expected seats, Labor majority, central-projection flips`);
  let ref;
  for (const [name, dg] of Object.entries(VARIANTS)) {
    const built = buildSeatsFrom({ seats: withTerm(dg), hist: I.build.hist, comp: I.build.comp, ST: I.build.ST, SEN, pre: I.pre }, { composition: true });
    const c = projectOnce(built, S), run = runMany(built, S, { draws: 2000 }), e = run.expectedSeats;
    if (!ref) ref = c;
    const flips = c.perSeat.map((p, i) => [p, ref.perSeat[i]]).filter(([p, q]) => bucketOf(p.w) !== bucketOf(q.w)).map(([p, q]) => `${p.name} ${bucketOf(q.w)}→${bucketOf(p.w)}`);
    console.log(`  ${name.padEnd(24)} ALP ${e.alp.toFixed(1)}  L/NP ${e.lnp.toFixed(1)}  ON ${e.on.toFixed(1)}  GRN ${e.grn.toFixed(1)}  IND+OTH ${(e.oth + e.member).toFixed(1)}  majority ${(100 * run.majority.alp).toFixed(1)}%  flips ${flips.length}${flips.length ? ": " + flips.join(", ") : ""}`);
  }
}
