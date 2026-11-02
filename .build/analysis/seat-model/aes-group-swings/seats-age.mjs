#!/usr/bin/env node
/* seats-age.mjs: how much /model/'s age and gender term moves seats, and what two changes to it would do.

   The term (vote-layer.mjs β, seat-inputs.mjs demoPP): Resolve's recent waves against its 2025-05-03
   election-day wave, per age band and gender, in points, self-centred over the population, times each seat's
   census mix (data/census-2021-divisions-2025.json) less the population's. Variants:

     none             no term
     age only         gender's part dropped
     AES baseline     Resolve's election-day gaps swapped for the AES 2025's (aes-cells.json): each cell's β
                      moves by Resolve's gap less the AES's, then re-centred
     AES, gender only the same for gender alone
     logit gaps       β as the change in each cell's logit gap from the population-weighted share (the
                      convention calibrate-education.mjs uses), stored as points at the party's nowcast share.
                      The engine adds the term to a logit swing, which already gives a party rising from a small
                      base more points where it started higher; a points difference-in-differences counts that
                      part again. Cells read from data/seat-vote-layer.json diagnostics.cellDetail.

   2,000 draws a run, the page's default seed; "flips" = seats whose central projection changes party.
   Run from the repo root:
     node .build/analysis/seat-model/aes-group-swings/seats-age.mjs > .build/analysis/seat-model/aes-group-swings/out/seats-age.txt */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankingsFrom } from "../senate-flows.mjs";
import { buildSeatsFrom } from "../seat-build.mjs";
import { projectOnce, runMany, bucketOf } from "../model-sim.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AES = JSON.parse(fs.readFileSync(path.join(HERE, "aes-cells.json"), "utf8")).waves["2025"];
process.chdir(path.resolve(HERE, "..", "..", "..", ".."));
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const I = J("model/data/inputs.json"), V = J("data/seat-vote-layer.json"), C = J("data/census-2021-divisions-2025.json");
const SEN = rankingsFrom(J("data/senate-rankings-2025.json"));
const P5 = ["alp", "lnp", "on", "grn", "oth"], DIMS = ["age", "gender"], PW = V.beta.populationWeights;
const CD = V.diagnostics?.cellDetail;
if (!CD) throw new Error("data/seat-vote-layer.json has no diagnostics.cellDetail - rerun .build/analysis/seat-model/vote-layer.mjs");
const AES_CELL = { age: { "18–34": ["age", "y"], "35–54": ["age", "m"], "55+": ["age", "o"] }, gender: { Men: ["sex", "m"], Women: ["sex", "f"] } };
const AES_PARTY = { alp: "alp", lnp: "lnp", grn: "grn", on: "onp" };
const logit = (p) => Math.log(p / (1 - p));
const cells = (dim) => Object.keys(PW[dim]);
const recentre = (dim, f) => Object.fromEntries(P5.map((p) => { const raw = Object.fromEntries(cells(dim).map((c) => [c, f(c, p)])); const mu = cells(dim).reduce((a, c) => a + PW[dim][c] * raw[c], 0); return [p, Object.fromEntries(cells(dim).map((c) => [c, raw[c] - mu]))]; }));
// β[dim][party][cell], points
const official = Object.fromEntries(DIMS.map((dim) => [dim, Object.fromEntries(P5.map((p) => [p, Object.fromEntries(cells(dim).map((c) => [c, V.beta.dims[dim][c][p].beta]))]))]));
const resolveGap = (dim, c, p) => CD[dim].cells[c][p].yBase - cells(dim).reduce((a, k) => a + PW[dim][k] * CD[dim].cells[k][p].yBase, 0);
const aesGap = (dim, c, p) => { if (!AES_PARTY[p]) return null; const [set, key] = AES_CELL[dim][c]; return 100 * (AES[set][key][AES_PARTY[p]] - AES[set + "_all"][AES_PARTY[p]]); };
const aesBase = Object.fromEntries(DIMS.map((dim) => [dim, recentre(dim, (c, p) => { const a = aesGap(dim, c, p); return official[dim][p][c] + (a == null ? 0 : resolveGap(dim, c, p) - a); })]));
const t = (p) => I.settings.nowcast.now5[P5.indexOf(p)];
const logitGaps = Object.fromEntries(DIMS.map((dim) => [dim, recentre(dim, (c, p) => {
  const m = (k) => cells(dim).reduce((a, x) => a + PW[dim][x] * CD[dim].cells[x][p][k], 0) / 100;
  const y = (k) => CD[dim].cells[c][p][k] / 100;
  return (logit(y("yNow")) - logit(m("yNow")) - (logit(y("yBase")) - logit(m("yBase")))) * 100 * t(p) * (1 - t(p));
})]));
const cen = new Map(C.divisions.map((d) => [d.name, d]));
const mix = (d) => { const a = d.ageCounts, y = 0.4 * a["15_19"] + a["20_24"] + a["25_34"], m = a["35_44"] + a["45_54"], o = a["55_64"] + a["65_74"] + a["75_84"] + a["85ov"], s = y + m + o;
  return { age: { "18–34": y / s, "35–54": m / s, "55+": o / s }, gender: { Men: d.gender.m / (d.gender.m + d.gender.f), Women: d.gender.f / (d.gender.m + d.gender.f) } }; };
const demoOf = (name, B, dims) => { const d = cen.get(name); if (!d) return [0, 0, 0, 0, 0]; const x = mix(d); return P5.map((p) => dims.reduce((v, dim) => v + cells(dim).reduce((a, c) => a + B[dim][p][c] * (x[dim][c] - PW[dim][c]), 0), 0)); };
const check = Math.max(...I.seats.map((s) => Math.max(...demoOf(s.name, official, DIMS).map((v, k) => Math.abs(v - s.demoPP[k])))));
if (check > 1e-9) throw new Error(`official demoPP not reproduced (max ${check})`);

const show = (B, dim) => P5.map((p) => `${p} ` + cells(dim).map((c) => (B[dim][p][c] >= 0 ? "+" : "") + B[dim][p][c].toFixed(1)).join("/")).join("  ");
console.log("β by party, points (age 18–34/35–54/55+; gender men/women):");
for (const [lab, B] of [["official", official], ["AES baseline", aesBase], ["logit gaps", logitGaps]]) console.log(`  ${lab.padEnd(13)} age   ${show(B, "age")}\n  ${"".padEnd(13)} gender ${show(B, "gender")}`);
const spread = (B, dims) => P5.map((p, k) => { const v = I.seats.map((s) => demoOf(s.name, B, dims)[k]); return `${p} ${Math.min(...v).toFixed(2)} to ${Math.max(...v).toFixed(2)}`; }).join("  ");
console.log("\nThe term's range across the 150 seats, points:");
console.log("  official, age      " + spread(official, ["age"]));
console.log("  official, gender   " + spread(official, ["gender"]));
console.log("  AES base, gender   " + spread(aesBase, ["gender"]));
console.log("  logit gaps, age    " + spread(logitGaps, ["age"]));

const VARIANTS = {
  official: (s) => s.demoPP,
  none: () => [0, 0, 0, 0, 0],
  "age only": (s) => demoOf(s.name, official, ["age"]),
  "AES baseline": (s) => demoOf(s.name, aesBase, DIMS),
  "AES, gender only": (s) => demoOf(s.name, { age: official.age, gender: aesBase.gender }, DIMS),
  "logit gaps": (s) => demoOf(s.name, logitGaps, DIMS),
};
for (const mode of ["nowcast", "forecast"]) {
  const S = mode === "nowcast" ? I.settings.nowcast : { ...I.settings.forecast, fade: I.settings.forecast.fade };
  console.log(`\n${mode}: expected seats, Labor majority, central-projection flips`);
  let ref;
  for (const [name, f] of Object.entries(VARIANTS)) {
    const built = buildSeatsFrom({ seats: I.seats.map((s) => ({ ...s, demoPP: f(s) })), hist: I.build.hist, comp: I.build.comp, ST: I.build.ST, SEN, pre: I.pre }, { composition: true });
    const c = projectOnce(built, S), run = runMany(built, S, { draws: 2000 }), e = run.expectedSeats;
    if (!ref) ref = c;
    const flips = c.perSeat.map((p, i) => [p, ref.perSeat[i]]).filter(([p, q]) => bucketOf(p.w) !== bucketOf(q.w)).map(([p, q]) => `${p.name} ${bucketOf(q.w)}→${bucketOf(p.w)}`);
    console.log(`  ${name.padEnd(17)} ALP ${e.alp.toFixed(1)}  L/NP ${e.lnp.toFixed(1)}  ON ${e.on.toFixed(1)}  GRN ${e.grn.toFixed(1)}  IND+OTH ${(e.oth + e.member).toFixed(1)}  majority ${(100 * run.majority.alp).toFixed(1)}%  flips ${flips.length}${flips.length ? ": " + flips.join(", ") : ""}`);
  }
}
