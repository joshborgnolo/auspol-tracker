#!/usr/bin/env node
/* test-vic-model.mjs: the Victorian model's own stores and inputs hold together.
   1. data/vic-candidates-2026.json: the VEC's field - 88 districts, 734 candidates, one Labor, one Greens and
      one One Nation candidate in each, a Coalition candidate in each, names and parties only (no contact details).
   2. data/vic-htv-2026.json: every card read is a full order of its district's ballot or an open card.
   3. vic-field.mjs / prepVic: every candidate starts above zero; the sitting-member terms land where the
      stores say (a member standing again; a 2022 winner gone from the ticket); the levels with no Victorian
      count sit between the federal reading and the respondents; card moves stay inside (0, 1).
   4. the state-election fits the run borrows are present and sane.
   5. the official run is the model's: its vote, field tallies and central projection reproduce.
   Run from the repo root: node .build/analysis/seat-model/test-vic-model.mjs */
import fs from "node:fs";
import assert from "node:assert/strict";
import { prepVic, RESPONDENT_WEIGHT } from "./vic-inputs.mjs";
import { buildSeatsFrom, leverLevels } from "./seat-build.mjs";
import { projectOnce, runMany } from "./model-sim.mjs";
import { displayName } from "./vic-field.mjs";

const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const NOM = J("data/vic-candidates-2026.json"), HTV = J("data/vic-htv-2026.json"), RUN = J("data/seat-model-vic-2026.json");
// 1. the field
const D = NOM.districts, names = Object.keys(D);
assert.equal(names.length, 88, "88 districts nominated");
assert.equal(Object.values(D).reduce((a, v) => a + v.length, 0), 734, "734 candidates");
assert.equal(NOM.candidates, 734);
for (const [d, cs] of Object.entries(D)) {
  const n = (rx) => cs.filter((c) => c.party && rx.test(c.party)).length;
  assert.equal(n(/^Australian Labor Party/), 1, `${d}: one Labor candidate`);
  assert.equal(n(/^Australian Greens/), 1, `${d}: one Greens candidate`);
  assert.equal(n(/^One Nation/), 1, `${d}: one One Nation candidate`);
  assert.ok(n(/^(Liberal Party|National Party)/) >= 1, `${d}: a Coalition candidate`);
  for (const c of cs) { assert.deepEqual(Object.keys(c).sort(), ["name", "party"], `${d}: names and parties only`); assert.match(c.name, /^[^,]+(, \S.*)?$/, `${d}: "SURNAME, Given", or one name as the VEC prints it (${c.name})`); }
  assert.equal(new Set(cs.map((c) => c.name)).size, cs.length, `${d}: no duplicate names`);
}
assert.equal(displayName("McKEEMAN, Lachie"), "Lachie McKeeman"); assert.equal(displayName("MCGRATH, Mark"), "Mark McGrath"); assert.equal(displayName("O'NEILL, G. Daniel"), "G. Daniel O'Neill"); assert.equal(displayName("BRENNAN-JONES, Taylah"), "Taylah Brennan-Jones");
// 2. the cards
assert.deepEqual(Object.keys(HTV.districts).sort(), names.slice().sort(), "a card record for every district");
let orders = 0, open = 0;
for (const [d, H] of Object.entries(HTV.districts)) {
  assert.ok(H.alp && H.on, `${d}: Labor's and One Nation's cards`);
  for (const [k, e] of Object.entries(H)) {
    if (e.open) { open++; continue; }
    assert.deepEqual(e.order.slice().sort(), D[d].map((c) => c.name).sort(), `${d} ${k}: the card orders the whole ballot`); orders++;
    const own = { alp: /^Australian Labor Party/, lib: /^Liberal Party/, nat: /^National Party/, on: /^One Nation/ }[k];
    assert.match(D[d].find((c) => c.name === e.order[0]).party || "", own, `${d} ${k}: the card's first preference is its own candidate`);
  }
}
assert.ok(orders >= 250 && open >= 1, `${orders} full cards, ${open} open`);
// 3. the inputs
const V = prepVic({ vote: { nowcast: RUN.meta.nowcast } });
assert.equal(V.seats.length, 88);
let rec = 0, n = 0;
for (const s of V.seats) {
  for (const c of s.cands) { n++; assert.ok(c.base >= 0.003 && c.base < 1, `${s.name} ${c.label}: starts at ${c.base}`); assert.ok(c.clsIdx >= 0 && c.p5 >= 0); if (c.sig != null) assert.ok(c.isInd && c.src === "median", `${s.name} ${c.label}: only a new independent carries its own spread`); }
  assert.equal(new Set(s.cands.map((c) => c.group)).size >= 4, true);
  const m = s.cands.filter((c) => c.member);
  assert.equal(m.length, s.held.standing ? 1 : 0, `${s.name}: one sitting member on the ballot, or none`);
  if (m.length) { rec++; assert.equal(m[0].label, s.held.as); assert.ok(m[0].adj != null && Math.abs(m[0].adj - V.errors.terms.rec) < 1e-9 || !s.member2022.standing, `${s.name}: a 2022 winner standing again carries rec alone`); }
  if (!s.member2022.standing) { const b = s.member2022.bucket, of = (c) => (c.group === "alp" ? "alp" : ["lp", "np"].includes(c.group) ? "lnp" : c.group === "grn" ? "grn" : "x"); for (const c of s.cands) if (of(c) === b) assert.ok(c.adj != null && c.adj < (c.member ? V.errors.terms.rec : 0) + 1e-9, `${s.name}: ${c.label}'s party lost its 2022 member`); }
}
assert.equal(n, 734); assert.equal(rec, V.field.tallies.standingAgain); assert.equal(rec + V.field.tallies.memberGone, 88);
for (const k of ["on", "coalOn", "grnOn", "othOn"]) {
  const c = V.calib[k]; if (c.respondents == null) continue;
  const lo = Math.min(c.federal, c.respondents), hi = Math.max(c.federal, c.respondents);
  assert.ok(c.target > lo - 1e-9 && c.target < hi + 1e-9, `${k}: the level sits between the federal reading and the respondents`);
  const lg = (p) => Math.log(p / (1 - p)); assert.ok(Math.abs(lg(c.target) - ((1 - RESPONDENT_WEIGHT) * lg(c.federal) + RESPONDENT_WEIGHT * lg(c.respondents))) < 1e-6, `${k}: halfway on the logit scale`);
}
const seats = buildSeatsFrom({ seats: V.seats, comp: V.comp, ST: V.ST, SEN: V.SEN, pre: V.pre, hist: { bySeat: {}, mean: {} } }, { composition: true });
const lv = leverLevels(V.SEN, seats);
for (const [k, v] of Object.entries(lv)) assert.ok(v > 0.02 && v < 0.98, `${k} level ${v}`);
for (const row of Object.values(V.pre)) for (const t of Object.values(row)) assert.ok(t.every((x) => x >= 0 && Number.isFinite(x)), "tables are probabilities");
// 4. the state-election fits
const SW = J("data/seat-model-state-swing.json"), SP = J("data/seat-model-state-polls.json");
assert.ok(SW.pooled.rec > 0 && SW.pooled.ret < 0 && SW.pooled.n.rec > 200 && SW.pooled.n.ret > 40, "sitting-member terms");
assert.ok(SW.card.follow > 0.3 && SW.card.follow < 0.6 && SW.card.with > SW.card.against, "card follow rate");
assert.ok(SP.elections.length >= 15 && SP.all.n.alp === SP.elections.length, "state polling record");
for (const k of ["alp", "lnp", "grn", "oth"]) assert.ok(SP.all.sigma[k] > 0.04 && SP.all.sigma[k] < 0.4, `${k} polling error ${SP.all.sigma[k]}`);
assert.deepEqual([V.S.sigNat[0], V.S.sigNat[1], V.S.sigNat[3], V.S.sigNat[4]], [SP.all.sigma.alp, SP.all.sigma.lnp, SP.all.sigma.grn, SP.all.sigma.oth], "the run draws the state polling error");
assert.equal(V.S.majority, 45);
// 5. the official run
assert.equal(RUN._provenance.engine, "v2.3-vic");
assert.equal(RUN.meta.field.candidates, 734); assert.equal(RUN.seats.length, 88);
assert.deepEqual(projectOnce(seats, V.S).seats, RUN.national.central, "the official central projection reproduces");
const r = runMany(seats, V.S, { draws: 200, seed: 3 });
assert.ok(Math.abs(Object.values(r.expectedSeats).reduce((a, b) => a + b, 0) - 88) < 0.05, "88 seats in every simulation (averages rounded to two places)");
console.log(`Victorian model OK: 734 candidates in 88 districts, ${orders} cards read in full and ${open} open, ${rec} sitting members standing, levels and fits in range, the official central projection reproduces`);
