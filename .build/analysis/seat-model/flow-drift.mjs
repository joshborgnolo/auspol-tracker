#!/usr/bin/env node
/* flow-drift.mjs: each donor class's national House preference split, 1993-2025, and how far it moves
   from one federal election to the next - the cross-check on the model's national preference shocks
   (which are sized on the drift from a Senate election to the next count, backtest-states.mjs `drift`).

   From every counted flow in maps/data/res-<year>.json (each excluded candidate's votes split between the
   final two): the vote-weighted share to the first of each pair, per donor class (flowClassOf on the
   candidate's Senate cohort key; the statistics-era files carry party codes, mapped as backtest-long.mjs
   does), kept where at least 5,000 votes moved. Drift = the logit change between consecutive elections.
   Writes data/seat-model-flow-drift.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { cohortKeyFor } from "./senate-flows.mjs";
import { flowClassOf } from "./seat-build.mjs";
import { LONG_YEARS } from "./swing-fit.mjs";

const logit = (p) => Math.log(p / (1 - p));
const CODE_KEY = { DEM: "OTH:DEM", AD: "OTH:DEM", AFI: "OTH:RGT", FST: "OTH:RGT", CTA: "OTH:XTN", CDP: "OTH:XTN", FFP: "OTH:FF", CAP: "OTH:RGT", PUP: "OTH:TOP", UAPP: "OTH:TOP", KAP: "OTH:KAP", LDP: "OTH:LDP", DLP: "OTH:RGT", ASXP: "OTH:REA", SPP: "OTH:SAP", AJP: "OTH:AJP", ASP: "OTH:SFF", SFF: "OTH:SFF", CEC: "OTH:CIT" };
const GROUP = (c) => (c[3] === "alp" ? "alp" : c[3] === "grn" ? "grn" : c[3] === "onp" ? "on" : c[3] === "lnp" ? ({ LP: "lp", NP: "np", LNP: "lnp", LNQ: "lnp", CLP: "clp" }[c[1]] || "lnp") : c[3] === "ind" ? "member" : "oth");
const keyOf = (c) => { const g = GROUP(c); if (g === "oth" && CODE_KEY[c[1]]) return CODE_KEY[c[1]]; return cohortKeyFor({ group: g, party: c[1], partyName: c[2] }); };
const FAMB = { alp: 0, lnp: 1, grn: 2, onp: 3 };
const lev = {};
for (const y of LONG_YEARS) {
  const D = JSON.parse(readFileSync(`maps/data/res-${y}.json`, "utf8"));
  for (const dv of D.divs) {
    if (!dv.tcp || dv.tcp.length !== 2) continue;
    const fins = dv.tcp.map((t) => FAMB[dv.c[t[0]][3]]);
    if (fins.some((f) => f == null) || fins[0] === fins[1]) continue;
    const [x, z] = fins[0] < fins[1] ? [fins[0], fins[1]] : [fins[1], fins[0]], xi = fins[0] === x ? 0 : 1, pair = "ACGO"[x] + "ACGO"[z];
    for (const f of dv.fl || []) {
      const c = dv.c[f[0]], n = f[1] + f[2]; if (n < 50) continue;
      const k = flowClassOf(keyOf(c)) + "|" + pair, h = (xi === 0 ? f[1] : f[2]) / n;
      ((lev[k] = lev[k] || {})[y] = lev[k][y] || [0, 0]); lev[k][y][0] += h * n; lev[k][y][1] += n;
    }
  }
}
const out = { _about: "flow-drift.mjs: national House preference splits by donor class and final pair, 1993-2025 (share to the first family of the pair: A Labor, C Coalition, G Greens, O One Nation), from every counted flow with at least 5,000 votes moving; drift = logit change between consecutive federal elections; rms over all such steps.", series: {} };
for (const [k, L] of Object.entries(lev)) {
  const ys = LONG_YEARS.filter((y) => L[y] && L[y][1] >= 5000);
  if (ys.length < 3) continue;
  const level = Object.fromEntries(ys.map((y) => [y, +(L[y][0] / L[y][1]).toFixed(4)]));
  const steps = [];
  for (let i = 1; i < ys.length; i++) if (LONG_YEARS.indexOf(ys[i]) - LONG_YEARS.indexOf(ys[i - 1]) === 1) steps.push({ from: ys[i - 1], to: ys[i], d: +(logit(level[ys[i]]) - logit(level[ys[i - 1]])).toFixed(3) });
  const rms = steps.length ? +Math.sqrt(steps.reduce((a, s) => a + s.d * s.d, 0) / steps.length).toFixed(3) : null;
  out.series[k] = { level, steps, rms, n: steps.length };
  console.log(`${k.padEnd(9)} rms ${rms} over ${steps.length} steps  ${ys.map((y) => `${y} ${(100 * level[y]).toFixed(1)}`).join(" ")}`);
}
writeFileSync("data/seat-model-flow-drift.json", JSON.stringify(out, null, 1) + "\n");
console.log("wrote data/seat-model-flow-drift.json");
