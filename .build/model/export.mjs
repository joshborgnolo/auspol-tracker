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
                               time, seat noise by election and the seat terms, the flow calibration and the
                               House flows' drift since 1993, the state and federal backtests (2019-2025 on
                               the Senate ballots; every election 2001-2025 from the one before), the 2025
                               replay, the education test, the run history.
   Run after the model's runs (swing-simulate.mjs nowcast + forecast), then .build/model/assemble.mjs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepInputs, buildSeatsFrom, LEVERS, leverLevels, respondentLevels } from "../analysis/seat-model/seat-inputs.mjs";
import { MIX_FAMS } from "../analysis/seat-model/seat-build.mjs";
import { modelSettings, runMany } from "../analysis/seat-model/model-sim.mjs";
import { count } from "../analysis/seat-model/seat-engine.mjs";
import { pairShare, cohortTable } from "../analysis/seat-model/senate-flows.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
process.chdir(ROOT);
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const r4 = (x) => Math.round(x * 10000) / 10000;

const VOTE = J("data/seat-vote-layer.json"), CAL = J("data/seat-model-calibration.json"), FCAL = J("data/seat-model-flow-calibration.json");
const STATES = J("data/seat-model-backtest-states.json"), FED = J("data/seat-model-backtest.json");
const LONG = fs.existsSync("data/seat-model-backtest-long.json") ? J("data/seat-model-backtest-long.json") : null;
const DRIFTH = fs.existsSync("data/seat-model-flow-drift.json") ? J("data/seat-model-flow-drift.json") : null;
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
// the settings travel without the independents' tables, which both modes share: they ride once in build.ind
// and the worker puts them back (model-sim reads S.ind)
const settings = { nowcast: modelSettings({ VOTE, CAL, FCAL, DRIFT: STATES.drift, mode: "nowcast" }), forecast: modelSettings({ VOTE, CAL, FCAL, DRIFT: STATES.drift, mode: "forecast" }) };
const IREC = fs.existsSync("data/seat-model-independents.json") ? J("data/seat-model-independents.json") : null;
const OVERLAY = J(".build/analysis/seat-model/candidate-overlay-2028.json"), SWST = fs.existsSync("data/seat-model-state-swing.json") ? J("data/seat-model-state-swing.json") : null;

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
  build: { ST: inp.ST, comp: MIX_FAMS.length ? inp.comp : null, hist: { bySeat: histBySeat, mean: inp.hist.mean }, ind: inp.ind ? { years: inp.ind.years, tables: Object.fromEntries(Object.entries(inp.ind.tables).map(([k, t]) => [k, { lv: t.lv, cum: t.cum, central: t.central }])) } : null },
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
/* the long federal backtest (backtest-long.mjs): every election 2001-2025 from the one before, house flows,
   national vote given - the model as run (seat terms, the calibrated noise multiplier) beside the model
   before the seat terms (v21); the 2019-2025 runs on the Senate ballots are the `federal` block */
function longEvidence(L, mult) {
  const prodV = mult === 1.3 ? "terms" : `terms-m${mult}`;
  const pick = (E, v) => L.results.find((r) => r.mode === "house" && !r.stateOracle && r.E === E && r.variant === v);
  const tests = [...new Set(L.results.filter((r) => r.mode === "house" && !r.stateOracle && r.variant === prodV).map((r) => r.E))].sort();
  const rows = tests.map((E) => { const a = pick(E, prodV), b = pick(E, "v21"); return { E, seats: a.seats, modalRight: a.modalRight, modalPlain: b?.modalRight ?? null, pairsRight: a.pairsRight, tcpMaePts: a.tcpMaePts, brier: a.brier, brierPlain: b?.brier ?? null, logScore: a.logScore, logPlain: b?.logScore ?? null, expected: a.expected, actual: a.actual, range90: a.range90 }; });
  const pool = (f) => { const cal = {}; for (const E of tests.filter(f)) for (const b of pick(E, prodV).calibration) { const c = (cal[b.bin] = cal[b.bin] || { p: 0, o: 0, n: 0 }); c.p += b.p; c.o += b.o; c.n += b.n; } return cal; };
  const RF = CAL.swing.sigMult?.recentFrom ?? 2016;
  // upsets (a winner given under 10%) from the recent window, and how many were independents or minor-party members
  const ups = tests.filter((E) => E >= RF).flatMap((E) => (pick(E, prodV).upsets || []).map((u) => ({ E, ...u })));
  return { draws: L.draws, variant: prodV, multiplier: mult, rows, calibration: pool(() => true), calibrationEarly: pool((E) => E < RF), calibrationRecent: pool((E) => E >= RF), recentFrom: RF,
    recentUpsets: { n: ups.length, indOth: ups.filter((u) => u.winner === "ind" || u.winner === "oth").length, ind: ups.filter((u) => u.winner === "ind").length } };
}
const flowDrift = DRIFTH ? Object.fromEntries(["GRN|AC", "ON|AC", "OTH-R|AC", "OTH-M|AC", "OTH-L|AC"].filter((k) => DRIFTH.series[k]).map((k) => [k, { rms: DRIFTH.series[k].rms, n: DRIFTH.series[k].n, first: +Object.keys(DRIFTH.series[k].level)[0], last: +Object.keys(DRIFTH.series[k].level).slice(-1)[0], level: DRIFTH.series[k].level }])) : null;
const history = fs.readFileSync("data/seat-model-2028-history.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => ({ date: r.date, engine: r.engine || "W5", expectedSeats: r.expectedSeats, majority: r.majority }));
const evidence = round({
  _about: "What the /model/ page's method and validation sections show (built by .build/model/export.mjs from the calibration and backtest stores in data/).",
  national: { bands: CAL.national.bands, sigma: CAL.national.sigma, bias: CAL.national.bias, n: CAL.national.n, corr: CAL.national.corrFinalMonth, fade: Object.fromEntries(Object.entries(CAL.national.fade).map(([k, v]) => [k, { lambda: v.lambda, se: v.se, n: v.n }])), govt: CAL.national.govt },
  swing: { stateOracle: Object.fromEntries(Object.entries(CAL.swing.stateOracle).map(([k, v]) => [k, { sigmaSeat: v.sigmaSeat, sigmaClass: v.sigmaClass, tDf: v.tDf, maePts: v.maePts, rmsByElection: v.rmsByElection }])), stateDev: CAL.swing.stateDev, sa26: CAL.swing.sa26,
    years: CAL.swing.years || null, terms: CAL.swing.terms || null, oos: CAL.swing.oos || null, sigMult: CAL.swing.sigMult || null,
    plain: CAL.swing.plain ? Object.fromEntries(Object.entries(CAL.swing.plain).map(([k, v]) => [k, { rmsByElection: v.rmsByElection }])) : null },
  education: CAL.education,
  flowDrift,
  flows: { delta: FCAL.same.delta, classPooled: FCAL.same.classPooled, sigmaSame: { u: FCAL.same.sigmaU, v: FCAL.same.sigmaV }, sigmaLag: { u: FCAL.lag.sigmaU, v: FCAL.lag.sigmaV }, combine: FCAL.combine, drift: STATES.drift, rows: FCAL.rows, coalitionLaborOnOffset: inp.ST.delta["COAL|AO"] },
  composition: inp.comp,
  /* the two flows set to the site's tables: the level used, the target, what mixing that party's voters by
     recalled 2025 vote would give (the page says why the model doesn't), and the Coalition's Senate reading */
  compositionUse: (() => {
    const lv = (seatsB, k) => r4(leverLevels(inp.SEN, seatsB)[k]);
    const T = inp.ST.targets || {};
    const one = (k, fam) => ({ used: lv(built, k), target: T[k] ?? null, offset: inp.ST.delta[k],
      ifMixed: lv(buildSeatsFrom(inp, { composition: true, mixFams: [...MIX_FAMS, fam] }), k) });
    return { mixed: MIX_FAMS.map((f) => ["alp", "lnp", "grn", "on"][f]),
      coalLaborOverOn: { ...one("COAL|AO", 1), senate: lv(buildSeatsFrom({ ...inp, ST: { ...inp.ST, delta: { ...inp.ST.delta, "COAL|AO": 0 } } }, { composition: true }), "COAL|AO") },
      onLaborOverCoalition: one("ON|AC", 3) };
  })(),
  /* independents: the record they are drawn from, how the 2028 seats divide, what an independent takes of
     preferences (by who else is left) and its check on SA 2026, and the two treatments scored on 2001-2025 */
  independents: IREC && inp.ind ? (() => {
    const slot = (s) => s.cands.find((c) => c.slot != null), sit = (s) => s.cands.find((c) => c.free && c.slot == null);
    const standing = inp.seats.filter((s) => slot(s)?.was && slot(s).base > 0.001).map((s) => ({ seat: s.name, name: slot(s).was.name, share: slot(s).was.share, ...(({ central, mean, n }) => ({ central, mean, cases: n }))(inp.ind.tables[slot(s).slot]) })).sort((a, b) => b.share - a.share);
    const L = LONG ? (() => {
      const pick = (v) => LONG.results.filter((r) => r.mode === "house" && !r.stateOracle && r.variant === v).sort((a, b) => a.E - b.E);
      const A = pick("terms-ind28"), B = pick("terms-indrec"); if (!A.length || A.length !== B.length) return null;
      const pool = (rs, f) => { const q = rs.filter(f), n = q.reduce((t, r) => t + r.seats, 0); return n ? { elections: q.length, seats: n, brier: q.reduce((t, r) => t + r.brier * r.seats, 0) / n, logScore: q.reduce((t, r) => t + r.logScore * r.seats, 0) / n, modalRight: q.reduce((t, r) => t + r.modalRight, 0), expectedInd: q.reduce((t, r) => t + r.expected.ind, 0), actualInd: q.reduce((t, r) => t + r.actual.ind, 0) } : null; };
      const from = IREC.now.window[0];
      return { recentFrom: from, rows: A.map((a, i) => ({ E: a.E, before: { brier: a.brier, logScore: a.logScore, modalRight: a.modalRight, expectedInd: a.expected.ind }, after: { brier: B[i].brier, logScore: B[i].logScore, modalRight: B[i].modalRight, expectedInd: B[i].expected.ind }, actualInd: a.actual.ind, seats: a.seats })),
        all: { before: pool(A, () => true), after: pool(B, () => true) }, recent: { before: pool(A, (r) => r.E >= from), after: pool(B, (r) => r.E >= from) }, early: { before: pool(A, (r) => r.E < from), after: pool(B, (r) => r.E < from) } };
    })() : null;
    return { settings: IREC.settings, window: IREC.now.window, sitting: { ...IREC.now.sitting, se: IREC.now.se, held: IREC.sitting.filter((r) => r.held).length, first: IREC.sitting[0]?.E, last: IREC.sitting[IREC.sitting.length - 1]?.E },
      byElection: Object.fromEntries(IREC.now.window.map((y) => [y, IREC.byElection[y]])), examples: IREC.now.examples,
      seats: { sitting: inp.seats.filter(sit).length, challenges: inp.seats.filter(slot).length, standing },
      take: { own: inp.capX.own, cross: inp.capX.cross, sib: inp.capX.sib, piles: inp.capX.piles, source: inp.capX.source, vsOneNation: inp.vsOn },
      check: IREC.check, backtest: L };
  })() : null,
  /* the two levels set to the site's tables, against what poll respondents now say of them: the nowcast re-run
     with both levels halfway (on the logit scale) to the respondents' and on the respondents' alone, beside
     the official run (4,000 simulations each, the official run's seed). Absent when no wave in the six weeks
     to the newest poll publishes its respondents' allocation. */
  respondents: (() => {
    const R = respondentLevels(J("data/polls.json")); if (!R) return null;
    const T = inp.ST.targets, lg = (p) => Math.log(p / (1 - p)), il = (x) => 1 / (1 + Math.exp(-x));
    const half = { "COAL|AO": il((lg(T["COAL|AO"]) + lg(R.coal.share)) / 2), "ON|AC": il((lg(T["ON|AC"]) + lg(R.on.share)) / 2) }, all = { "COAL|AO": R.coal.share, "ON|AC": R.on.share };
    const S0 = { ...settings.nowcast, ind: inp.ind };
    const run = (targets) => { const alt = prepInputs({ composition: true, targets }); const r = runMany(buildSeatsFrom(alt, { composition: true }), S0, { draws: 4000, seed: NOW.meta.seed }); return { targets: { coal: r4(targets["COAL|AO"]), on: r4(targets["ON|AC"]) }, expectedSeats: r.expectedSeats, majority: r.majority }; };
    return { from: R.from, to: R.to, polls: R.on.polls.map((q) => `${q.firm} ${q.end}`), counted: { coal: T["COAL|AO"], on: T["ON|AC"] }, said: { coal: r4(R.coal.share), on: r4(R.on.share) },
      official: { expectedSeats: NOW.national.expectedSeats, majority: NOW.national.majority }, halfway: run(half), respondents: run(all), draws: 4000 };
  })(),
  /* what has changed in the House since the 2025 election, as the model holds it (the candidate overlay) */
  changes: { retirements: (OVERLAY.retirements || []).map((e) => ({ seat: e.seat, member: e.member, date: e.date })), byElections: (OVERLAY.byElections || []).map((e) => ({ seat: e.seat, date: e.date, vacatedBy: e.vacatedBy, winner: e.winner })), defections: (OVERLAY.defections || []).map((e) => ({ seat: e.seat, member: e.member, from: e.from, to: e.to, party: e.party, date: e.date, recontests: e.recontests })) },
  /* what a how-to-vote card's reversal moved, as counted (calibrate-state-swing.mjs `card`): the explorer's card button */
  card: SWST?.card ? { with: SWST.card.with, against: SWST.card.against, follow: SWST.card.follow, rows: SWST.card.rows } : null,
  replay2025: { winners: ok, pairs: pairOk, tcpMaePts: Math.round(10000 * tcpE.reduce((a, b) => a + b, 0) / tcpE.length) / 100, misses },
  states: Object.fromEntries(Object.entries(STATES.results).map(([k, v]) => [k, { label: v.label, senate: v.senate, seats: v.seats, actualSeats: v.actualSeats, replay: v.replay, chain: v.chain }])),
  federal: { draws: FED.draws, sigmaMultiplier: FED.sigmaMultiplier, results: FED.results.map((r) => ({ E: r.E, variant: r.variant, stateOracle: r.stateOracle, brier: r.brier, logScore: r.logScore, modalRight: r.modalRight, pairsRight: r.pairsRight, tcpMaePts: r.tcpMaePts, expected: r.expected, actual: r.actual })), calibration: FED.calibrationPooled },
  federalLong: LONG ? longEvidence(LONG, CAL.swing.sigMult?.value ?? 1.3) : null,
  examples: ex,
  history,
});
fs.writeFileSync("model/data/evidence.json", JSON.stringify(evidence));
console.log(`model/data/inputs.json ${fs.statSync("model/data/inputs.json").size} bytes, evidence.json ${fs.statSync("model/data/evidence.json").size} bytes; replay ${ok}/150, ${pairOk} pairs`);
