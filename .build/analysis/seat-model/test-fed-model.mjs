#!/usr/bin/env node
/* test-fed-model.mjs: the federal model's own stores and inputs hold together (the Victorian run has
   test-vic-model.mjs; the page's copy of the engine has .build/model/test-model-bundle.mjs).
   1. Who sits now: the candidate overlay's by-elections and changes of party agree with the /map/ page's
      record of the House as it stands (map/data/data-now.json) - two hand-kept stores that must not drift -
      and the candidate set carries them.
   2. The seat terms follow: a party that lost its 2025 member gives back the personal vote, a by-election
      winner carries one, a member who changed party and has not said whether they stand is assumed neither way.
   3. Independents drawn from the record: every seat has its sitting independent on the record's drift and
      spread, or exactly one challenge with a valid table from the record's window; a 2025 independent of 5%
      or more is stood in for, not counted twice.
   4. What an independent takes of preferences: the two-case table is complete and in range, its two
      never-counted-in-2025 cases come from the count of an independent against One Nation, and on the SA 2026
      districts it was not measured on it is closer to the count than one share per class was.
   5. The engine: independents' shares are their own (the vote for others does not move them), every
      simulated House has 150 members, and the official runs are this model's.
   6. The backtest store holds both treatments of independents for every election.
   Run from the repo root: node .build/analysis/seat-model/test-fed-model.mjs */
import fs from "node:fs";
import assert from "node:assert/strict";
import { prepInputs, buildSeatsFrom } from "./seat-inputs.mjs";
import { modelSettings, projectOnce, runMany, bucketOf } from "./model-sim.mjs";
import { FLOW_CLASSES } from "./seat-engine.mjs";
import { IND_K, windowYears } from "./independents.mjs";

const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const OVERLAY = J(".build/analysis/seat-model/candidate-overlay-2028.json"), SET = J("data/seat-candidate-set-2028.json"), NOW = J("map/data/data-now.json");
const REC = J("data/seat-model-independents.json"), CAL = J("data/seat-model-calibration.json"), FLOWS = J("data/aec-2025-seat-flows.json");
const setBy = new Map(SET.seats.map((s) => [s.name, s]));

// 1. who sits now
const fam = (ab) => ({ ALP: "alp", LP: "lnp", NP: "lnp", LNP: "lnp", CLP: "lnp", GRN: "grn", ON: "on" }[ab] || "x");   // the crossbench is one family here: a new label is no change of hands
const famG = (g) => (g === "alp" ? "alp" : ["lp", "np", "lnp", "clp"].includes(g) ? "lnp" : g === "grn" ? "grn" : g === "on" ? "on" : "x");
const moved = new Map([...(OVERLAY.byElections || []).map((e) => [e.seat, { name: e.winner.name, group: e.winner.group }]), ...(OVERLAY.defections || []).map((e) => [e.seat, { name: e.member, group: e.to }])]);
for (const [seat, h] of Object.entries(NOW.holders)) {
  const m25 = setBy.get(seat).member2025, changed = h.n !== m25.name || fam(h.ab) !== famG(m25.group);
  if (!changed) { assert.ok(!moved.has(seat), `${seat}: the overlay records a change the House record does not`); continue; }
  assert.ok(moved.has(seat), `${seat}: held now by ${h.n} (${h.ab}) on the /map/ record, absent from candidate-overlay-2028.json`);
  assert.equal(moved.get(seat).name, h.n, `${seat}: the overlay's member is the House record's`);
  assert.equal(famG(moved.get(seat).group), fam(h.ab), `${seat}: the overlay's party is the House record's`);
}
for (const seat of moved.keys()) assert.ok(NOW.holders[seat], `${seat}: in the overlay, absent from the /map/ record of the House as it stands`);
for (const [seat, m] of moved) { const I = setBy.get(seat).incumbent; assert.equal(I.name, m.name); assert.equal(I.group, m.group); assert.ok(["by-election", "defection"].includes(I.how)); }
for (const e of OVERLAY.retirements || []) assert.equal(setBy.get(e.seat).incumbent.recontests, false, `${e.seat}: the member is not standing again`);

// 2. the seat terms
const inp = prepInputs({ composition: true }), by = new Map(inp.seats.map((s) => [s.name, s]));
const T = CAL.swing.terms, onTerm = (T.alp.incE + T.lnp.incE) / 2;
const adjOf = (seat, pred) => by.get(seat).cands.filter(pred).map((c) => c.adj || 0);
const coal = (c) => ["lp", "np", "lnp", "clp"].includes(c.group);
for (const e of OVERLAY.byElections || []) {
  const g = e.winner.group, own = adjOf(e.seat, (c) => c.group === g);
  assert.ok(own.length === 1 && own[0] > 0, `${e.seat}: the by-election winner carries a sitting member's personal vote`);
  if (g === "on") assert.ok(Math.abs(own[0] - onTerm) < 5e-4, `${e.seat}: One Nation's sitting member takes the major parties' average (${own[0]} v ${onTerm})`);
  const lost = setBy.get(e.seat).member2025.group;
  for (const a of adjOf(e.seat, (c) => famG(c.group) === famG(lost))) assert.ok(a < 0, `${e.seat}: the party that held it in 2025 has lost its member's personal vote`);
  assert.equal(by.get(e.seat).held.member, e.winner.name); assert.equal(by.get(e.seat).won2025.name, e.vacatedBy);
}
for (const e of OVERLAY.defections || []) {
  for (const a of adjOf(e.seat, (c) => famG(c.group) === famG(e.from))) assert.ok(a < 0, `${e.seat}: the party left behind has lost its member's personal vote`);
  const to = adjOf(e.seat, (c) => c.group === e.to);
  if (e.recontests !== true) assert.ok(to.every((a) => a === 0), `${e.seat}: no sitting-member term for a member who has not said they stand`);
  else assert.ok(to.some((a) => a > 0), `${e.seat}: the member standing for their new party carries a personal vote`);
}
for (const e of OVERLAY.retirements || []) for (const a of adjOf(e.seat, (c) => famG(c.group) === famG(setBy.get(e.seat).member2025.group))) assert.ok(a < 0, `${e.seat}: a retiring member's party gives back the personal vote`);
// a seat nothing has happened in: its sitting party is not marked down
assert.ok(adjOf("Banks", (c) => c.group === "alp")[0] > -0.02 && coal(by.get("Banks").cands.find(coal)), "Banks: an ordinary sitting member");

// 3. independents drawn from the record
assert.deepEqual(REC.now.window, windowYears(REC.elections), "the record's window is its last elections");
assert.equal(REC.now.window.length, IND_K.window);
assert.ok(REC.sitting.length >= 20 && REC.now.sitting.sig > 0.1 && REC.now.sitting.sig < 0.6 && Math.abs(REC.now.sitting.mean) < 0.5, "sitting independents' record in range");
assert.deepEqual(inp.ind.years, REC.now.window);
let sitting = 0, challenges = 0, standing = 0;
for (const s of inp.seats) {
  const sit = s.cands.filter((c) => c.free && c.slot == null), slot = s.cands.filter((c) => c.slot != null);
  assert.equal(slot.length + (sit.length ? 1 : 0), 1, `${s.name}: a sitting independent or one challenge, never both or neither`);
  for (const c of sit) { sitting++; assert.ok(c.group.startsWith("member:") && c.isInd); assert.equal(c.free.drift, REC.now.sitting.mean); assert.equal(c.free.sig, REC.now.sitting.sig); }
  if (!slot.length) continue;
  challenges++;
  const c = slot[0], t = inp.ind.tables[c.slot];
  assert.ok(c.isInd && c.free === true && c.group === "member:challenge" && t, `${s.name}: the challenge has a table`);
  assert.equal(t.lv.length, inp.ind.years.length);
  t.lv.forEach((lv, y) => {
    assert.equal(lv.length, t.cum[y].length); assert.equal(t.cum[y][lv.length - 1], 1, `${s.name}: the table's weights reach 1`);
    for (let i = 0; i < lv.length; i++) { assert.ok(lv[i] >= 0 && lv[i] < 0.9); if (i) { assert.ok(lv[i] > lv[i - 1] && t.cum[y][i] >= t.cum[y][i - 1]); } }
  });
  // the 2025 field's strongest independent: stood in for from 5% up, left in the field below
  const F = FLOWS.seats.find((q) => q.name === s.name), tot = F.candidates.reduce((a, q) => a + q.votes, 0);
  const top = F.candidates.filter((q) => q.party === "IND" && q.group === "oth").sort((a, b) => b.votes - a.votes)[0], tp = top ? top.votes / tot : 0;
  if (tp >= IND_K.replace) { standing++; assert.ok(Math.abs(c.base - tp) < 1e-12, `${s.name}: the challenge starts at ${top.name}'s 2025 vote`); assert.ok(!s.cands.some((q) => q.label === top.name), `${s.name}: ${top.name} is not counted twice`); assert.ok(c.slot !== "_new"); }
  else { assert.equal(c.base, 1e-4, `${s.name}: a challenge added to the field starts from nothing`); for (const lv of t.lv) assert.ok(lv.every((l) => l === 0 || l >= IND_K.serious), `${s.name}: only a serious challenger is added`); }
  assert.ok(Math.abs(s.cands.reduce((a, q) => a + q.base, 0) - 1) < 2e-3 || s.cands.some((q) => q.label === "One Nation (assumed)"), `${s.name}: the field's 2025 shares sum to one`);
}
assert.equal(sitting, 12, "twelve sitting independents"); assert.equal(challenges, 138); assert.ok(standing >= 20 && standing <= 60, `${standing} seats with a 2025 independent of 5% or more`);

// 4. what an independent takes of preferences
const X = inp.ST.iotaX;
for (const ctx of ["own", "cross"]) for (const k of FLOW_CLASSES) assert.ok(X[ctx][k] > 0.03 && X[ctx][k] < 0.98, `${ctx}.${k} = ${X[ctx][k]}`);
assert.ok(X.sib > 0 && X.sib < 0.4, "a Coalition partner's pile mostly goes to the partner");
for (const k of ["ALP", "COAL", "GRN", "ON"]) assert.ok(X.cross[k] > X.own[k], `${k}: more to the independent once the voters' own side is out`);
assert.equal(inp.vsOn.counts.length >= 1, true, "a count of an independent against One Nation");
assert.ok(Math.abs(X.own.COAL - inp.vsOn.COAL.share) < 5e-5, "Coalition voters with One Nation standing: that count's");
assert.equal(inp.capX.source["own.COAL"], "v One Nation");
const seats = buildSeatsFrom(inp, { composition: true });
for (const s of seats) { assert.ok(s.iotaX && s.iotaX.own && s.iotaX.cross, `${s.name}: counts by who else is left`); for (const ctx of ["own", "cross"]) for (const k of FLOW_CLASSES) assert.ok(s.iotaX[ctx][k] >= 0 && s.iotaX[ctx][k] <= 1); }
const CK = REC.check.sa26;
assert.ok(CK.rows.length >= 3 && CK.meanAbsError.byWhoIsLeft < CK.meanAbsError.flat, `SA 2026: by who is left ${CK.meanAbsError.byWhoIsLeft} v one share ${CK.meanAbsError.flat}`);

// 5. the engine and the official runs
const NOWRUN = J("data/seat-model-2028-nowcast.json"), FC = J("data/seat-model-2028-forecast.json"), VOTE = J("data/seat-vote-layer.json");
const S = modelSettings({ VOTE, CAL, FCAL: J("data/seat-model-flow-calibration.json"), DRIFT: J("data/seat-model-backtest-states.json").drift, mode: "nowcast", IND: inp.ind });
const central = projectOnce(seats, S);
assert.deepEqual(central.seats, NOWRUN.national.central, "the official central projection reproduces");
// the vote for others does not move an independent: halve it and every sitting independent's share is the same
const half = S.now5.map((v, k) => (k === 4 ? v / 2 : v)), tt = half.reduce((a, b) => a + b, 0), c2 = projectOnce(seats, { ...S, now5: half.map((v) => v / tt) });
seats.forEach((s, i) => { const g = s.cands.find((c) => c.free && c.slot == null); if (g) assert.equal(central.perSeat[i].primary[g.group], c2.perSeat[i].primary[g.group], `${s.name}: ${g.label}'s vote is their own record's`); });
const r = runMany(seats, S, { draws: 200, seed: 5 });
assert.ok(Math.abs(Object.values(r.expectedSeats).reduce((a, b) => a + b, 0) - 150) < 0.05, "150 seats in every simulation");
for (const [k, key] of [["alp", "alp"], ["lnp", "lnp"], ["on", "on"], ["grn", "grn"], ["oth", "oth"]]) assert.ok(Math.abs(r.nationalVote[k].p50 - VOTE.national.nowcast[key]) < 1.2, `${k}: the simulated national vote centres on the polls`);
assert.ok(r.expectedSeats.member > 10 && r.expectedSeats.member < 30, `independents average ${r.expectedSeats.member} seats`);
for (const R of [NOWRUN, FC]) {
  assert.equal(R._provenance.engine, "v2.3"); assert.equal(R.seats.length, 150);
  assert.deepEqual(R.meta.independents.window, REC.now.window); assert.equal(R.meta.independents.sitting, 12); assert.equal(R.meta.independents.challenges, 138);
  assert.ok(Math.abs(Object.values(R.national.expectedSeats).reduce((a, b) => a + b, 0) - 150) < 0.05);
  for (const s of R.seats) assert.ok(Math.abs(Object.values(s.win).reduce((a, b) => a + b, 0) - 1) < 2e-3, `${s.name}: the chances sum to one`);
}
const farrer = NOWRUN.seats.find((s) => s.name === "Farrer");
assert.ok(Object.keys(farrer.win).every((g) => ["on", "lp", "np", "alp", "grn", "oth", "member:challenge"].includes(g) || bucketOf(g) !== "member"), "Farrer has no sitting independent");

// 6. the backtest's two treatments
const LONG = J("data/seat-model-backtest-long.json");
for (const v of ["terms-ind28", "terms-indrec"]) assert.equal(LONG.results.filter((q) => q.variant === v && q.mode === "house" && !q.stateOracle).length, 9, `${v}: every election 2001-2025`);

console.log(`federal model OK: ${moved.size} seats changed hands since 2025 and ${(OVERLAY.retirements || []).length} retirement on the record, ${sitting} sitting independents and ${challenges} challenges (${standing} standing in for a 2025 independent) drawn from the ${REC.now.window.join("/")} record, preferences by who else is left (SA 2026: ${(100 * CK.meanAbsError.byWhoIsLeft).toFixed(1)} v ${(100 * CK.meanAbsError.flat).toFixed(1)} points), the official central projection reproduces`);
