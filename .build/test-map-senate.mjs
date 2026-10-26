/* test-map-senate.mjs – pins the Election map's Senate (2026-10-26): today's Senate in the chamber
   view, from the Parliament's Senate seating plan and the AEC's Senators Elected lists
   (.build/map/senate.mjs). It checks
   - the senators: 76, twelve a state and two a territory, each in a seat of the filed floor, one
     President and the two leaders at the table, a term every one (the 2022 class to 2028, the 2025
     class to 2031, the territories to the next election), casual senators traced to a vacancy;
   - the floor: the plan's 90 senators' seats in three rows with the table's two chairs, the
     President's chair and six officers' chairs (Black Rod's among them);
   - each election's Senate (map/data/senate-<year>.json, .build/map/senate_past.py): 76 seats, twelve a
     state and two a territory (a vacant seat counted), one President and the two leaders, every term
     either the election's own (six years on) or up at the next;
   - the app: the Senate's part assembled into map.js, one renderer for both chambers, the Senate
     following the timeline.
   Run: node .build/test-map-senate.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const now = JSON.parse(R("map/data/senate-now.json"));
const floor = JSON.parse(R(`map/data/${now.floor}`));

// ---- the senators
const S = now.senators;
assert.equal(S.length, 76, "76 senators");
const per = {};
for (const s of S) per[s.st] = (per[s.st] || 0) + 1;
for (const st of ["NSW", "VIC", "QLD", "WA", "SA", "TAS"]) assert.equal(per[st], 12, `${st} has 12 senators`);
for (const st of ["ACT", "NT"]) assert.equal(per[st], 2, `${st} has 2 senators`);
assert.equal(new Set(S.map((s) => s.n)).size, 76, "every senator named once (names key the chairs)");
assert.equal(new Set(S.map((s) => s.seat)).size, 76, "every senator in a seat of their own");
const seatIds = new Set(floor.seats.map((c) => c.id));
for (const s of S) assert.ok(seatIds.has(s.seat), `${s.n}'s seat ${s.seat} is on the floor`);
for (const [role, seat] of [["president", "president"], ["leader", "leader_of_the_government"], ["oppLeader", "leader_of_the_opposition"]]) {
  const x = S.filter((s) => s.role === role);
  assert.equal(x.length, 1, `one ${role}`);
  assert.equal(x[0].seat, seat, `the ${role} sits in ${seat}`);
}
for (const s of S) {
  const terr = s.st === "ACT" || s.st === "NT";
  if (terr) assert.equal(s.term, "next", `${s.n}: a territory senator's term ends at the next election`);
  else if (s.elected) assert.equal(s.term, s.elected === 2022 ? 2028 : 2031, `${s.n}: term from their election`);
  else assert.ok(s.casual && s.term === (s.casual.elected === 2022 ? 2028 : 2031), `${s.n}: a casual senator serves out the vacancy's term`);
}
assert.equal(S.filter((s) => s.term !== 2031).length, 40, "40 seats up at the next election: 36 from 2022, 4 territory");

// ---- the floor
const rows = [1, 2, 3].map((r) => floor.seats.filter((c) => c.row === r).length);
assert.equal(rows.reduce((a, b) => a + b, 0), 89, "89 senators' seats on the benches (the plan's 90, Black Rod's C01 apart)");
assert.ok(!seatIds.has("C01"), "Black Rod's chair is not a senator's seat");
assert.equal(floor.seats.filter((c) => c.row === 0).length, 2, "the table's two chairs");
assert.equal(floor.seats.filter((c) => c.row === -1).length, 1, "the President's chair");
assert.deepEqual(floor.officers.map((o) => o.k).sort(), ["blackRod", "chair", "clerk", "clerk", "hansard", "hansard"], "the officers' six chairs");
for (const c of floor.seats) assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.fa) && c.W > 0 && c.D > 0 && /^M/.test(c.d), `seat ${c.id} has a chair and an outline`);
for (const c of floor.seats.filter((c) => c.row > 0 && c.fa % Math.PI === 0)) assert.ok(c.box && c.box.length === 4, `straight bench seat ${c.id} has its box, for the benches`);
assert.ok(floor.furniture.blackRod.length === 1 && floor.furniture.blackRod[0].box, "Black Rod's bench");
assert.ok(!floor.furniture.outlines, "the plan's line work left out, as the House's drawing leaves out its desks");

// ---- the app
const js = R("map/map.js");
const part = R(".build/map/app/app-3b-senate.js");
assert.ok(js.includes(part.trim()), "map.js carries app-3b-senate.js as is (run node .build/map/assemble.mjs)");
assert.ok(js.includes('const chamberGeom = (m) => (m && m.house === "senate" ? senateGeom() : houseGeom());'), "one renderer, the chamber's geometry chosen by the model");
assert.ok(js.includes("loadSenate(y) : null"), "an election on the timeline loads its Senate in the Senate's chamber");
assert.ok(js.includes('if (p.get("c") === "senate") {'), "a Senate URL may name any election");
assert.ok(js.includes('loadSenate("now"),'), "today's senators load with the key's measures, so the switch moves nothing");

// ---- each election's Senate
for (const y of [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) {
  const p = JSON.parse(R(`map/data/senate-${y}.json`)), ss = p.senators, vac = p.vacant || [];
  assert.equal(ss.length + vac.length, 76, `${y}: 76 seats`);
  const by = {};
  for (const s of [...ss, ...vac]) by[s.st] = (by[s.st] || 0) + 1;
  for (const st of ["NSW", "VIC", "QLD", "WA", "SA", "TAS"]) assert.equal(by[st], 12, `${y}: ${st} has 12 seats`);
  for (const st of ["ACT", "NT"]) assert.equal(by[st], 2, `${y}: ${st} has 2 seats`);
  for (const r of ["president", "leader", "oppLeader"]) assert.equal(ss.filter((s) => s.role === r).length, 1, `${y}: one ${r}`);
  assert.equal(p.later, +p.asOf.slice(0, 4) + 6, `${y}: the election's own senators sit six years`);
  for (const s of ss) assert.ok(s.term === "next" ? s.st === "ACT" || s.st === "NT" : s.term === p.later || s.term === +p.asOf.slice(0, 4) + 3, `${y}: ${s.n}'s term`);
  assert.equal(ss.filter((s) => s.term !== p.later).length, 40, `${y}: 40 seats up at the next election`);
  assert.equal(new Set(ss.map((s) => s.n)).size, ss.length, `${y}: names key the chairs`);
}
// the Handbook's totals, checked by the builder; the new Senates it can be held to exactly
const coal = (y) => JSON.parse(R(`map/data/senate-${y}.json`)).senators.filter((s) => ["LP", "NP", "LNP", "CLP"].includes(s.ab)).length;
assert.deepEqual([2004, 2016, 2019, 2022, 2025].map(coal), [39, 30, 35, 32, 27], "the Coalition's seats: 2005's majority, then as the Handbook gives each new Senate");
// ---- the Senate lens: each seat's and polling place's Senate vote (.build/map/senate_vote.py)
for (const y of [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) {
  const sv = JSON.parse(R(`map/data/senate-vote-${y}.json`)), res = JSON.parse(R(`map/data/res-${y}.json`));
  assert.deepEqual(sv.fams, ["alp", "lnp", "grn", "onp", "ind", "oth"], `${y}: the families in the map's order`);
  for (const d of res.divs) assert.ok(sv.divs[d.n], `${y}: ${d.n} has its Senate vote`);
  for (const [n, r] of Object.entries(sv.divs)) assert.equal(r.slice(1).reduce((a, b) => a + b, 0), r[0], `${y}: ${n}'s families add to its formal votes`);
  const ids = res.booths.id.map(String), hit = ids.filter((i) => sv.booths[i]).length;
  if (y === 2004) assert.equal(Object.keys(sv.booths).length, 0, "2004: no Senate counts by polling place (the AEC never served them)");
  else assert.ok(hit / ids.length > 0.97, `${y}: ${hit} of ${ids.length} House polling places have a Senate count`);
}
assert.ok(js.includes('{ id: "senate", label: "Senate" }'), "the Senate is a lens");
assert.ok(js.includes("getJSON(`/map/data/senate-vote-${k}.json`)"), "the lens loads each election's Senate votes");

console.log(`test-map-senate: ok – ${S.length} senators as at ${now.asOf}, floor ${floor.plan}`);
