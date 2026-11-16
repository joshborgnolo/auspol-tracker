#!/usr/bin/env node
/* export-vic.mjs: the /model/ page's Victorian data, from the Victorian run (vic-simulate.mjs).

   Writes model/data/inputs-vic.json: what the page shows beside the run (each district's 2026 candidates
   and where each starts, who holds it now and whether they stand, its preference choices, its notes) and
   everything its worker needs to re-run the model on a reader's settings - the district skeleton, the
   districts' Senate tables already read and calibrated (`pre`, the same rounded tables the official run
   used), the settings, the levers and their levels - plus the evidence the Victorian method notes quote:
   the field, the state-election fits, the preference levels and what moved them, the how-to-vote cards,
   the Victoria 2022 replay, the SA 2026 surge test, and two comparison runs (the federal preference
   readings alone; Victorian respondents alone).
   Run after vic-simulate.mjs, then .build/model/assemble.mjs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeatsFrom, LEVERS, leverLevels } from "../analysis/seat-model/seat-build.mjs";
import { pairShare } from "../analysis/seat-model/senate-flows.mjs";
import { simulateOnce, runMany } from "../analysis/seat-model/model-sim.mjs";
import { rng, cholesky } from "../analysis/seat-model/seat-engine.mjs";
import { VIC_FLOWS } from "../vic/to-main-schema.mjs";
import { VIC, vicVote, prepVic, RESPONDENT_WEIGHT } from "../analysis/seat-model/vic-inputs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(HERE, "..", ".."));
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const r4 = (x) => (x == null ? null : Math.round(x * 10000) / 10000);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

const RUN = J("data/seat-model-vic-2026.json"), STATES = J("data/seat-model-backtest-states.json");
const vote = await vicVote();
if (JSON.stringify(vote.nowcast) !== JSON.stringify(RUN.meta.nowcast)) throw new Error("the Victorian run is not on the current polls: re-run vic-simulate.mjs first");
const V = prepVic({ vote });
const build = { ST: V.ST, comp: V.comp, hist: { bySeat: {}, mean: {} } };
const buildOf = (P) => buildSeatsFrom({ ...build, seats: P.seats, SEN: P.SEN, pre: P.pre }, { composition: true });
const built = buildOf(V);
const memberWord = (h) => ({ alp: "Labor", lp: "Liberal", np: "Nationals", grn: "Greens" }[h.group] || "independent");
const seats = V.seats.map((s, i) => {
  const tab = (cls) => built[i].cands.find((c) => c.cls === cls)?.table;
  const share = (cls, x, y) => { const t = tab(cls); return t ? r4(pairShare(V.SEN, t, x, y)) : null; };
  // the district's notes: its sitting member, and any card that departs from the federal pattern
  const h = s.held, notes = [];
  notes.push(`${h.member}, the sitting ${memberWord(h)} member, ${h.standing ? "stands again" : "is not standing"}.`);
  for (const t of V.cards[s.name]?.text || []) notes.push(t + ".");
  return { ...s, notes,
    flows: { coalLaborOverOn: share("COAL", 0, 3), laborCoalitionOverOn: share("ALP", 1, 3), onLaborOverCoalition: share("ON", 0, 1), greensLaborOverCoalition: share("GRN", 0, 1) } };
});
/* what the preferences imply statewide at the central primaries: Labor v the Coalition and Labor v One
   Nation, beside the same primaries read with Victoria's 2022 flow table (the /vic/ page's) and the polls'
   own published figures over the six weeks to the newest poll */
const implied = (B, P) => {
  const cen = simulateOnce(B, { ...P.S, uncertainty: false }, rng(1), cholesky(P.S.corr), [0, 0, 0, 0, 0]);
  let W = 0, a = 0, b = 0; B.forEach((s2, i) => { s2.cands.forEach((c, j) => { const p = cen.prim[i][j]; a += s2.w * p * (c.p5 === 0 ? 1 : c.p5 === 1 ? 0 : pairShare(P.SEN, c.table, 0, 1)); b += s2.w * p * (c.p5 === 0 ? 1 : c.p5 === 2 ? 0 : pairShare(P.SEN, c.table, 0, 3)); }); W += s2.w; });
  return { coalition: r4(a / W), on: r4(b / W) };
};
const tpp = implied(built, V);
const n5 = vote.nowcast, tpp22 = (n5.alp + VIC_FLOWS.grn * n5.grn + VIC_FLOWS.onp * n5.on + VIC_FLOWS.oth * n5.oth) / (n5.alp + n5.lnp + n5.grn + n5.on + n5.oth);
const RC = V.calib.respondents, polls = J("data/vic-polls.json").polls.filter((p) => p.fwEnd >= RC.from && p.fwEnd <= RC.to);
const pub = (f) => { const xs = polls.map(f).filter((x) => x != null); return xs.length ? { median: median(xs), polls: xs.length, lo: Math.min(...xs), hi: Math.max(...xs) } : null; };
const published = { from: RC.from, to: RC.to, coalition: pub((p) => p.tpp2?.alp), on: pub((p) => p.alt?.alpVOnp) };
/* the two ends of the judgement on One Nation's cells: the federal readings alone, the respondents alone */
const sens = [["federal", 0], ["respondents", 1]].map(([k, w]) => {
  const P = prepVic({ vote, respondentWeight: w }), B = buildOf(P), r = runMany(B, P.S, { draws: 4000, seed: 11 });
  return { k, weight: w, onToLabor: r4(P.calib.on.target), coalToLaborOverOn: r4(P.calib.coalOn.target), tpp: implied(B, P), expected: r.expectedSeats, majority: r.majority };
});
/* the first Victorian reading of One Nation's voters, to set beside the count it followed: the page says
   respondents matched the count only if they did */
const firstOn = J("data/vic-polls.json").polls.filter((p) => p.tpp_split && p.tpp_split.onp != null && p.fwEnd).sort((a, b) => a.fwEnd.localeCompare(b.fwEnd))[0];
const cells = Object.fromEntries(["on", "coalOn", "grnOn", "othOn"].map((k) => { const c = V.calib[k]; return [k, { federal: r4(c.federal), federalSource: c.federalSource, respondents: r4(c.respondents), respondentPolls: c.respondentPolls, model: r4(c.target) }]; }));
const v22 = STATES.results.vic22, sa26 = STATES.results.sa26;
const zOf = (k) => { const s = V.errors.polls.sigma[k], b = V.errors.polls.bias[k], n = V.errors.polls.elections; const sd = Math.sqrt(Math.max(1e-9, s * s - b * b)); return r4(b / (sd / Math.sqrt(n))); };
const SP = J("data/seat-model-state-polls.json");
const above = (k) => SP.elections.filter((e) => e.err[k] != null && e.err[k] > 0).length;
const members = { standing: seats.filter((s) => s.held.standing).length, gone: seats.filter((s) => !s.held.standing).map((s) => ({ district: s.name, member: s.held.member, party: s.held.party })) };
const inds = seats.flatMap((s) => s.cands.filter((c) => c.isInd).map((c) => ({ district: s.name, name: c.label, base: c.base, known: c.src === "2022" })));
const out = {
  _about: "Inputs for the /model/ page's Victorian view (built by .build/model/export-vic.mjs). The worker builds each candidate's table from `pre` (each district's 2025 Senate tables, read at the nearest federal polling places, House-calibrated and set to Victoria's levels and cards, vic-inputs.mjs) with seat-build.mjs and runs model-sim.mjs - the files the official run uses.",
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
    field: { asAt: V.field.asAt, source: V.field.source, candidates: V.field.tallies.candidates, src: V.field.tallies.src, medianMinor: r4(V.field.record.medianMinor), medianIndependent: r4(V.field.record.medianIndependent), sigIndependent: r4(V.field.record.sigIndependent), independents2022: V.field.record.independents,
      independents: { all: inds.length, known: inds.filter((x) => x.known).map((x) => ({ district: x.district, name: x.name, base: r4(x.base) })), districts: new Set(inds.map((x) => x.district)).size },
      members, threeCornered: seats.filter((s) => s.cands.filter((c) => ["lp", "np"].includes(c.group)).length > 1).map((s) => s.name), noLiberal: seats.filter((s) => !s.cands.some((c) => c.group === "lp")).length },
    terms: V.errors.terms, districts: V.errors.districts,
    polls: { elections: V.errors.polls.elections, sigma: V.errors.polls.sigma, bias: V.errors.polls.bias, z: { alp: zOf("alp"), lnp: zOf("lnp"), grn: zOf("grn") }, above: { alp: above("alp"), lnp: above("lnp"), grn: above("grn") }, federal: V.errors.polls.federal, federalBias: Object.fromEntries(["alp", "lnp", "grn"].map((k) => [k, J("data/seat-model-calibration.json").national.bias[k]["final month"]])), onpLarge: V.errors.polls.onpLarge, from: SP.elections.map((e) => e.date).sort()[0].slice(0, 4), to: SP.elections.map((e) => e.date).sort().pop().slice(0, 4) },
    calibration: { grn: V.calib.grn, oth: V.calib.oth }, cells, respondents: { from: RC.from, to: RC.to, weight: RESPONDENT_WEIGHT, first: firstOn ? { end: firstOn.fwEnd, firm: firstOn.firmRaw, on: firstOn.tpp_split.onp / 100 } : null },
    cards: { listed: J("data/vic-htv-2026.json").listed, follow: V.errors.card.follow, against: V.errors.card.against, with: V.errors.card.with, tally: V.cardTally,
      open: Object.entries(V.cards).flatMap(([d, c]) => c.notes.filter((n) => n.kind === "open").map((n) => ({ district: d, party: n.party }))),
      flip: Object.entries(V.cards).flatMap(([d, c]) => c.notes.filter((n) => n.kind === "flip").map((n) => ({ district: d, party: n.party }))),
      missing: Object.entries(V.cards).flatMap(([d, c]) => c.missing.map((p) => ({ district: d, party: p }))) },
    tppModel: tpp.coalition, tppOnModel: tpp.on, tpp2022Flows: r4(tpp22), published, sens,
  },
  seats,
};
fs.mkdirSync("model/data", { recursive: true });
fs.writeFileSync("model/data/inputs-vic.json", JSON.stringify(out));
console.log(`model/data/inputs-vic.json ${fs.statSync("model/data/inputs-vic.json").size} bytes; ${seats.length} districts, ${out.evidence.field.candidates} candidates; implied Labor two-party ${(100 * tpp.coalition).toFixed(1)} v the Coalition, ${(100 * tpp.on).toFixed(1)} v One Nation`);
for (const s of sens) console.log(`  ${s.k} readings alone: One Nation to Labor ${(100 * s.onToLabor).toFixed(0)}%, Coalition to Labor over One Nation ${(100 * s.coalToLaborOverOn).toFixed(0)}% -> ` + Object.entries(s.expected).map(([k, v]) => `${k} ${v}`).join(" ") + ` | Coalition majority ${(100 * s.majority.coalition).toFixed(0)}%`);
