/* vic_lc_plan.mjs – build map/data/lc-seating-plan-vic-2026-10-27.json, the 60th
   Parliament's Legislative Council seating plan, from the Parliament's own
   councilseatingplan page.

   The page (mirrored read-only at .build/map/src/vic22-lc-plan/
   councilseatingplan-2026-10-27.html, fetched from
   https://www.parliament.vic.gov.au/councilseatingplan on 27 October 2026) is a
   Vue island whose server-rendered markup carries the plan in two complete forms:
     - the <seating-plan :seat-data> attribute: every desk's member record (Pims
       id, title, name, party, region, ministry/committee positions) as a
       JSON string; and
     - the chamber's <svg viewBox="0 0 1160 1910">: every desk's own rounded-
       square art as <g id="seat-<n>"> groups, with the room's furniture rects
       (Level 2 floor, Centre table, Clerk's table, President's desk) alongside.
   Nothing is re-fetched here: the snapshot is the record, and this script is the
   deterministic extraction of it. A plan rebuild = a fresh committed snapshot,
   then this script again (see ./vic_lc_seating.mjs for the seats-vic22-lc.json
   side and map/data/lc-seating-plan-vic-2026-10-27.md for provenance).

   The desk art is the 58x58 rounded square at the group; its centre is what the
   plan binds a member to. The plan's own desk numbers (the seat-N ids) are kept
   as the desks' ids end to end; the two "Government Advisor" staff spots the
   feed prints on the back row are recorded separate from members.

   Since polling day 26 November 2022, three changes are on file for the roster
   check in vic_lc_seating.mjs: Anasina Gray-Barberio (Greens) holds Samantha
   Ratnam's seat (Ratnam resigned; joint sitting of 13 November 2024 chose her);
   Moira Deeming (elected Liberal) joined Family First (announced 9-10 September
   2026); Adem Somyurek (elected Democratic Labour) resigned that party in
   March 2024 and sits independent.

     node .build/map/vic_lc_plan.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SRC = path.join(HERE, "src", "vic22-lc-plan", "councilseatingplan-2026-10-27.html");
const OUT = path.join(ROOT, "map", "data", "lc-seating-plan-vic-2026-10-27.json");
const CAPTURED = "27 October 2026";
const URL = "https://www.parliament.vic.gov.au/councilseatingplan";

// the 60th Parliament's council as the plan must seat it: 15 ALP, 11 Liberal,
// 2 Nationals, 4 Greens, 2 Legalise Cannabis, 1 each of Animal Justice,
// Libertarian, Shooters, Family First, One Nation and an independent
const TALLY = { ALP: 15, LP: 11, NAT: 2, GRN: 4, LC: 2, AJP: 1, Libertarian: 1, SFFP: 1, "Family First": 1, "One Nation": 1, Ind: 1 };
// the plan numbers desks 1 (the President) through 53; 6 and 22 are unbuilt ids.
// Desks 2 and 3 (flanking the clerks' table), 14 and 15 (the back row's two
// "Government Advisor" staff spots) and 0 (the Governor's ceremonial chair) are
// not members' desks
const STAFF = new Set([-2, -1, 0, 2, 3, 14, 15]);

const html = fs.readFileSync(SRC, "utf8");

// ---- the member records ----
const m0 = html.match(/<seating-plan :seat-data='JSON\.parse\("([\s\S]*?)"\)'/);
if (!m0) throw new Error("no :seat-data JSON in the page");
const membersRaw = JSON.parse(m0[1].replace(/\\u0022/g, '"'));
const members = {}, advisers = [];
for (const [key, d] of Object.entries(membersRaw)) {
  const seat = +key.replace(/.*:/, "");
  if (d.IsCustom) {
    if (!String(d.LastName).includes("Advisor")) throw new Error(`custom seat ${seat} is not an adviser spot (${d.LastName})`);
    advisers.push(seat);
    continue;
  }
  const rec = {
    m: `${d.Preferred} ${d.LastName}`,
    p: d.PartyAbr,
    region: (d.ElectorateNames || [])[0],
    pimsId: d.PimsId,
  };
  if ((d.PositionNames || []).length) rec.positions = d.PositionNames;
  members[seat] = rec;
}
const tally = {};
for (const r of Object.values(members)) tally[r.p] = (tally[r.p] || 0) + 1;
const want = Object.entries(TALLY).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}:${n}`).join(" ");
const got = Object.entries(tally).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}:${n}`).join(" ");
if (got !== want) throw new Error(`party tally ${got}, ${want} expected`);
for (const s of advisers) if (!STAFF.has(s)) throw new Error(`adviser desk ${s} is not a staff seat`);
// the council's own roles, as the plan's position strings name them (exact
// match — the Deputy President and Deputy Leaders carry the longer strings)
const role = (title) => {
  const hit = Object.values(members).filter((r) => (r.positions || []).some((p) => p.toLowerCase() === title));
  return hit.length === 1 ? hit[0].m : null;
};
const roles = {
  president: role("president of the legislative council"),
  leader: role("leader of the government in the legislative council"),
  oppLeader: role("leader of the opposition in the legislative council"),
};
if (!roles.president || !roles.leader || !roles.oppLeader) throw new Error(`roles off: ${JSON.stringify(roles)}`);
if (roles.president !== members[1]?.m) throw new Error(`the President is not at desk 1`);

// ---- the chamber svg ----
const svg = html.match(/<svg width="1160" height="1910" viewBox="0 0 1160 1910"[\s\S]*?<\/svg>/);
if (!svg) throw new Error("no chamber svg in the page");
const seats = {};
for (const g of svg[0].matchAll(/<g id="seat-(\d+)"[^>]*>([\s\S]*?)<\/g>/g)) {
  const n = +g[1], r = g[2].match(/<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);
  if (!r) throw new Error(`seat ${n}: no desk art`);
  seats[n] = { x: (+r[1] + +r[3] / 2).toFixed(1) - 0, y: (+r[2] + +r[4] / 2).toFixed(1) - 0 };
}
const ROOMS = {};
for (const [id, key] of [["Level 2", "floor"], ["Centre table", "centreTable"], ["Clerk&#39;s table", "clerkTable"], ["President&#39;s desk", "presidentDesk"]]) {
  const r = svg[0].match(new RegExp(`<rect id="${id}"[^>]*x="([\\d.]+)"[^>]*y="([\\d.]+)"[^>]*width="([\\d.]+)"[^>]*height="([\\d.]+)"`));
  if (!r) throw new Error(`no ${id} rect`);
  ROOMS[key] = [+r[1], +r[2], +r[3], +r[4]];
}
// every member's desk must be drawn; every drawn desk must be a member's or a
// known staff/vacant spot
for (const s of Object.keys(members)) if (!seats[s]) throw new Error(`member desk ${s} has no art`);
const drawn = Object.keys(seats).map(Number);
if (Math.min(...drawn) !== 0 || Math.max(...drawn) !== 53) throw new Error(`desks drawn [${Math.min(...drawn)}..${Math.max(...drawn)}], 0..53 expected`);

const out = {
  captured: CAPTURED,
  url: URL,
  source: "the Parliament of Victoria's councilseatingplan page, captured 27 October 2026 (.build/map/src/vic22-lc-plan/, the page's server-rendered seat-data and chamber svg)",
  chambers: "Legislative Council of the 60th Parliament",
  rooms: ROOMS,
  seats,
  advisers: advisers.sort((a, b) => a - b),
  members,
  roles,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(OUT.split("map/")[1]);
console.log(`${Object.keys(members).length} members (${got}); desks 0..53 drawn; advisers at ${advisers.join(",")}`);
console.log(`roles: ${roles.president} / ${roles.leader} / ${roles.oppLeader}`);
