#!/usr/bin/env node
/* export.mjs: the /model/ page's data, from the seat model's committed stores and runs.

   Writes
     model/data/inputs.json    everything the page's worker needs to rebuild the seats and re-run the
                               model with a reader's settings: the 2028 seat skeleton (candidates and
                               their 2025 shares, seat terms), the build inputs (calibration offsets,
                               today's-voter mix, House history), both modes' settings, the preference
                               levers and their levels as the model stands. The Senate ranking tables
                               themselves are fetched from /data/senate-rankings-2025.json.
     model/data/evidence.json  what the page's method and validation sections draw: polling error by lead
                               time, seat noise by election, the flow calibration, the state and federal
                               backtests, the 2025 replay, the education test, the run history.
   Run after the model's runs (swing-simulate.mjs nowcast + forecast), then .build/model/assemble.mjs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepInputs, buildSeatsFrom, LEVERS, leverLevels } from "../analysis/seat-model/seat-inputs.mjs";
import { modelSettings } from "../analysis/seat-model/model-sim.mjs";
import { count } from "../analysis/seat-model/seat-engine.mjs";
import { pairShare, cohortTable } from "../analysis/seat-model/senate-flows.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
process.chdir(ROOT);
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const r4 = (x) => Math.round(x * 10000) / 10000;

const VOTE = J("data/seat-vote-layer.json"), CAL = J("data/seat-model-calibration.json"), FCAL = J("data/seat-model-flow-calibration.json");
const STATES = J("data/seat-model-backtest-states.json"), FED = J("data/seat-model-backtest.json");
const NOW = J("data/seat-model-2028-nowcast.json");
const RES = J("map/data/res-2025.json");
const inp = prepInputs({ composition: true });
const built = buildSeatsFrom(inp, { composition: true });

/* the skeleton travels without the tables (the worker rebuilds them from the Senate file) */
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v)));
const seats = inp.seats.map((s, i) => {
  const D = RES.divs.find((d) => d.n === s.name);
  const tcp = D.tcp ? D.tcp.map((t) => ({ name: D.c[t[0]][0], party: D.c[t[0]][2], bucket: D.c[t[0]][3], votes: t[1] })) : null;
  // the seat's key preference choices as the model holds them (today's voters, House-calibrated), for its card
  const tab = (cls) => built[i].cands.find((c) => c.cls === cls)?.table;
  const share = (cls, x, y) => { const t = tab(cls); return t ? r4(pairShare(inp.SEN, t, x, y)) : null; };
  const flows = { coalLaborOverOn: share("COAL", 0, 3), laborCoalitionOverOn: share("ALP", 1, 3), onLaborOverCoalition: share("ON", 0, 1), greensLaborOverCoalition: share("GRN", 0, 1) };
  return { ...s, tcp2025: tcp, flows };
});
const settings = { nowcast: modelSettings({ VOTE, CAL, FCAL, DRIFT: STATES.drift, mode: "nowcast" }), forecast: modelSettings({ VOTE, CAL, FCAL, DRIFT: STATES.drift, mode: "forecast" }) };

/* hist trimmed to the seats and cohorts the skeleton uses */
const used = new Set(seats.flatMap((s) => s.cands.map((c) => s.name + "|" + c.key)));
const histBySeat = {};
for (const [d, keys] of Object.entries(inp.hist.bySeat)) for (const [k, pairs] of Object.entries(keys)) if (used.has(d + "|" + k)) ((histBySeat[d] = histBySeat[d] || {})[k] = pairs);

const inputs = {
  _about: "Inputs for the /model/ page's worker (built by .build/model/export.mjs from the seat model's stores). The worker rebuilds each candidate's preference table from /data/senate-rankings-2025.json with seat-build.mjs and runs model-sim.mjs - the same files the official runs use.",
  generated: new Date().toISOString().slice(0, 10),
  asOf: { pollsTo: VOTE.diagnostics.recentWindow.to, windowFrom: VOTE.diagnostics.recentWindow.from, waves: VOTE.diagnostics.recentWindow.waves, modelRun: NOW._provenance.generated },
  vote: { nowcast: VOTE.national.nowcast, result2025: VOTE.national.result2025 },
  settings,
  build: { ST: inp.ST, comp: inp.comp, hist: { bySeat: histBySeat, mean: inp.hist.mean } },
  levers: Object.fromEntries(Object.entries(LEVERS).map(([k, L]) => [k, { label: L.label, cls: L.cls, x: L.x, y: L.y, also: L.also || null }])),
  leverLevels: Object.fromEntries(Object.entries(leverLevels(inp.SEN, built)).map(([k, v]) => [k, r4(v)])),
  seats,
};
fs.mkdirSync("model/data", { recursive: true });
fs.writeFileSync("model/data/inputs.json", JSON.stringify(inputs));

/* the 2025 replay (the flow layer's own check), recomputed here so the page quotes the run it ships with */
const rep = prepInputs({ composition: false, replay: true }), repSeats = buildSeatsFrom(rep, { composition: false });
const B = (g) => (g === "alp" ? "alp" : ["lp", "np", "lnp", "clp"].includes(g) ? "lnp" : g === "on" ? "on" : g === "grn" ? "grn" : String(g).startsWith("member") ? "member" : "oth");
const gRes = (c, s) => { if (c[3] === "alp") return "alp"; if (c[3] === "grn") return "grn"; if (c[3] === "onp") return "on"; if (c[3] === "lnp") return "lnp"; const m = s.cands.find((x) => x.label === c[0]); return m ? m.group : "oth"; };
let ok = 0, pairOk = 0; const tcpE = [], misses = [];
for (const s of repSeats) {
  const fin = count(s, s.cands.map((c) => c.base), null, null), wg = s.cands[fin[0][0]].group, og = s.cands[fin[1][0]].group, share = fin[0][1] / (fin[0][1] + fin[1][1]);
  const D = RES.divs.find((d) => d.n === s.name), winC = D.c.find((c) => c[6] === 1);
  const want = B(gRes(winC, s)), got = B(wg);
  if (want === got) ok++; else misses.push(s.name);
  if (D.tcp.map((t) => B(gRes(D.c[t[0]], s))).sort().join("|") === [wg, og].map(B).sort().join("|")) { pairOk++; const wv = D.tcp.find((t) => D.c[t[0]] === winC)[1]; tcpE.push(Math.abs((want === got ? share : 1 - share) - wv / (D.tcp[0][1] + D.tcp[1][1]))); }
}
/* three worked examples of the Senate ballots the preferences come from */
const ex = ["Hunter", "Dickson", "Kooyong"].map((n) => {
  const t = (k) => cohortTable(inp.SEN, n, k);
  return { seat: n, coalitionLaborOverOn: r4(pairShare(inp.SEN, t("COAL"), 0, 3)), onLaborOverCoalition: r4(pairShare(inp.SEN, t("ON"), 0, 1)), greensLaborOverCoalition: r4(pairShare(inp.SEN, t("GRN"), 0, 1)), laborCoalitionOverOn: r4(pairShare(inp.SEN, t("ALP"), 1, 3)) };
});
const history = fs.readFileSync("data/seat-model-2028-history.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => ({ date: r.date, engine: r.engine || "W5", expectedSeats: r.expectedSeats, majority: r.majority }));
const evidence = round({
  _about: "What the /model/ page's method and validation sections show (built by .build/model/export.mjs from the calibration and backtest stores in data/).",
  national: { bands: CAL.national.bands, sigma: CAL.national.sigma, bias: CAL.national.bias, n: CAL.national.n, corr: CAL.national.corrFinalMonth, fade: Object.fromEntries(Object.entries(CAL.national.fade).map(([k, v]) => [k, { lambda: v.lambda, se: v.se, n: v.n }])), govt: CAL.national.govt },
  swing: { stateOracle: Object.fromEntries(Object.entries(CAL.swing.stateOracle).map(([k, v]) => [k, { sigmaSeat: v.sigmaSeat, sigmaClass: v.sigmaClass, tDf: v.tDf, maePts: v.maePts, rmsByElection: v.rmsByElection }])), stateDev: CAL.swing.stateDev, sa26: CAL.swing.sa26 },
  education: CAL.education,
  flows: { delta: FCAL.same.delta, classPooled: FCAL.same.classPooled, sigmaSame: { u: FCAL.same.sigmaU, v: FCAL.same.sigmaV }, sigmaLag: { u: FCAL.lag.sigmaU, v: FCAL.lag.sigmaV }, combine: FCAL.combine, drift: STATES.drift, rows: FCAL.rows, coalitionLaborOnOffset: inp.ST.delta["COAL|AO"] },
  composition: inp.comp,
  replay2025: { winners: ok, pairs: pairOk, tcpMaePts: Math.round(10000 * tcpE.reduce((a, b) => a + b, 0) / tcpE.length) / 100, misses },
  states: Object.fromEntries(Object.entries(STATES.results).map(([k, v]) => [k, { label: v.label, senate: v.senate, seats: v.seats, actualSeats: v.actualSeats, replay: v.replay, chain: v.chain }])),
  federal: { draws: FED.draws, sigmaMultiplier: FED.sigmaMultiplier, results: FED.results.map((r) => ({ E: r.E, variant: r.variant, stateOracle: r.stateOracle, brier: r.brier, logScore: r.logScore, modalRight: r.modalRight, pairsRight: r.pairsRight, tcpMaePts: r.tcpMaePts, expected: r.expected, actual: r.actual })), calibration: FED.calibrationPooled },
  examples: ex,
  history,
});
fs.writeFileSync("model/data/evidence.json", JSON.stringify(evidence));
console.log(`model/data/inputs.json ${fs.statSync("model/data/inputs.json").size} bytes, evidence.json ${fs.statSync("model/data/evidence.json").size} bytes; replay ${ok}/150, ${pairOk} pairs`);
