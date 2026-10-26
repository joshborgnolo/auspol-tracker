/* sa22_seating.mjs – where each member of South Australia's 47th Parliament sat, from the
   Parliament's archived chamber map.

   Reads map/data/house-seating-plan-sa-2024-12-28.json (written by .build/map/build_sa22_seating.py
   from the Wayback Machine's 28 December 2024 capture of chamber-maps.parliament.sa.gov.au — the
   only archived contentful copy of the floor; the seats the plan prints are the term's end
   arrangement) and seats every member at their desk in the House of Assembly floor the app draws
   (the @sa-cells block of app/app-3c-sa.js, read as is), as sa_seating.mjs does for the live sa26
   frame. The capture's holders are checked against the 2022 results with the term's by-elections
   and Speaker changes written in (Bragg, Dunstan, Black; Cregan stood down as Speaker in April
   2024 for Bignell): a desk the app doesn't draw, a member who isn't the frame's, a party that
   disagrees, a district or desk seated twice or left out, all fail the build. The map's sa22 view
   shows the Parliament as elected: Cregan (Kavel) keeps the chair (SPEAKER_DIV in app-1-base.js)
   and Bignell, the plan's Speaker, takes the free government-side desk off the front bench nearest
   the chair — the 2010 Slipper precedent in .build/map/seating.mjs. Writes
     map/data/seats-sa22.json   { plan, note, source, at: { district: desk } }. Run:
     node .build/map/sa22_seating.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DATA = path.join(ROOT, "map", "data");
const PLAN_DATE = "sa-2024-12-28";
const SPEAKER_DIV = "Kavel"; // app-1-base SPEAKER_DIV.sa22 — the frame's chair holds him
// the plan's chair (desk T1) holds the Speaker who took over mid-term: their division, and the
// side of their party's benches ('L' is the government's, app-3c-sa.js)
const LATER_SPEAKER = { div: "Mawson", member: "Leon Bignell", side: "L" };
// seats whose member changed between election day (19 March 2022) and the capture: the holder the
// archive shows, and the party they sit with
const BYELECTION = { Bragg: ["Jack Batty", "LIB"], Dunstan: ["Cressida O'Hanlon", "ALP"], Black: ["Alex Dighton", "ALP"] };
const SOURCE = "https://chamber-maps.parliament.sa.gov.au/psa1/#floor_2020111280982479";

const plan = JSON.parse(fs.readFileSync(path.join(DATA, `house-seating-plan-${PLAN_DATE}.json`), "utf8"));
const data = JSON.parse(fs.readFileSync(path.join(DATA, "data-sa22.json"), "utf8"));
const won = new Map(data.divs.map((d) => [d.n, d.c.find((c) => c[6] === 1)]));

// the floor, from the app's own geometry
const src = fs.readFileSync(path.join(HERE, "app", "app-3c-sa.js"), "utf8");
const block = src.match(/@sa-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @sa-cells-end \*\//);
if (!block) throw new Error("app-3c-sa.js: no @sa-cells block");
const { SAF, saCells } = new Function(`${block[1]}; return { SAF, saCells };`)();
const drawn = new Map(saCells(SAF.ha).map((c) => [c.id, c]));

const members = [];
let chair = null;
for (const r of plan.rows) for (const s of r.seats) {
  if (s.side === "speaker") { chair = s; continue; }
  members.push(s);
}
if (!chair || chair.division !== LATER_SPEAKER.div || chair.member !== LATER_SPEAKER.member)
  throw new Error(`the plan's chair holds ${chair && chair.member} (${chair && chair.division}), ${LATER_SPEAKER.member} (${LATER_SPEAKER.div}) expected`);
if (members.length !== 46) throw new Error(`${members.length} members at desks, 46 expected`);

const at = {};
const used = new Set();
for (const s of members) {
  const w = won.get(s.division);
  if (!w) throw new Error(`${s.member}'s ${s.division} is not a district of the 2022 election`);
  const by = BYELECTION[s.division];
  if (by) { if (s.member !== by[0] || s.party !== by[1]) throw new Error(`${s.division}: the archive shows ${s.member} (${s.party}), ${by.join(" (")}) expected`); }
  else if (s.member !== w[0]) throw new Error(`${s.division} sits ${s.member}, the results elected ${w[0]}`);
  else if (s.party !== w[1]) throw new Error(`${s.member} sits ${s.party}, elected ${w[1]}`);
  if (s.division === SPEAKER_DIV) continue; // Cregan's desk C1 stays empty: the view keeps him in the chair
  if (!drawn.has(s.seat)) throw new Error(`desk ${s.seat} (${s.member}) is not on the app's floor`);
  if (used.has(s.seat)) throw new Error(`desk ${s.seat} seated twice`);
  used.add(s.seat);
  at[s.division] = s.seat;
}
if (Object.keys(at).length !== 45) throw new Error(`${Object.keys(at).length} seated, 45 plus the late Speaker expected`);
// Bignell: the free bench on his own side, off the front bench, nearest the chair (as 2010's Slipper)
{
  const side = (c) => (LATER_SPEAKER.side === "L" ? c.x < 0 : c.x > 0); // the government's benches are the reader's left
  const gap = (c) => Math.hypot(c.x, c.y - SAF.ha.chair);
  const pick = saCells(SAF.ha).filter((c) => side(c) && c.row > 1 && !used.has(c.id)).sort((a, b) => gap(a) - gap(b))[0];
  if (!pick) throw new Error(`no free government-side bench for ${LATER_SPEAKER.member}`);
  at[LATER_SPEAKER.div] = pick.id;
  if (pick.id !== "C2") throw new Error(`the late Speaker's bench moved: ${pick.id}`);
}
if (SPEAKER_DIV in at) throw new Error(`${SPEAKER_DIV} must be in the chair, not at a desk`);
if (Object.keys(at).length !== data.divs.length - 1) throw new Error(`${Object.keys(at).length} seated of ${data.divs.length - 1}`);

const out = {
  plan: "28 December 2024", // the capture, late in the term — not the April 2022 sitting
  note: "the only archived plan for this Parliament, from late in the term — Bignell, Speaker from April 2024, is placed by the chair on the government benches",
  source: SOURCE,
  at,
};
fs.writeFileSync(path.join(DATA, "seats-sa22.json"), JSON.stringify(out, null, 1) + "\n");
console.log("map/data/seats-sa22.json", Object.keys(at).length, "seated (+ Kavel in the chair)");
