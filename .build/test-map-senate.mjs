/* test-map-senate.mjs – pins the Election map's Senate (2026-10-26): today's Senate in the chamber
   view, from the Parliament's Senate seating plan and the AEC's Senators Elected lists
   (.build/map/senate.mjs). It checks
   - the senators: 76, twelve a state and two a territory, each in a seat of the filed floor, one
     President and the two leaders at the table, a term every one (the 2022 class to 2028, the 2025
     class to 2031, the territories to the next election), casual senators traced to a vacancy;
   - the floor: the plan's 90 senators' seats in three rows with the table's two chairs, the
     President's chair and six officers' chairs (Black Rod's among them);
   - the app: the Senate's part assembled into map.js, one renderer for both chambers, and the
     Senate only ever today's.
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
assert.ok(js.includes('if (S.house === "senate" && y !== "now") { S.house = "reps";'), "an election on the timeline returns to the House");
assert.ok(js.includes('if (p.get("c") === "senate" && S.year === "now")'), "a Senate URL is today's alone");
assert.ok(js.includes("loadSenate(),"), "the senators load with the key's measures, so the switch moves nothing");
console.log(`test-map-senate: ok – ${S.length} senators as at ${now.asOf}, floor ${floor.plan}`);
