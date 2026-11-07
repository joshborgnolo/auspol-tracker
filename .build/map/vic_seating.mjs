/* vic_seating.mjs – where each member of Victoria's 60th Parliament sits, from the
   Parliament's own Legislative Assembly seating plan of 11 August 2026.

   Reads map/data/la-seating-plan-vic-2026-08-11.json (built by .matilda/vic-seating from
   the 60th-parliament-la-seating-plan-gallery-perspective-combined-11-august-2026.pdf linked
   from parliament.vic.gov.au/assembly — mirrored at
   .build/map/src/vic22-seating/la-seating-2026-08-11.pdf, method and provenance in the
   data file's companion .md) and walks its members onto the Assembly floor the app draws
   (the @vic-cells block of app/app-3-chamber.js, read as is): the six the plan seats at the
   table take the table's chairs, the rest fill the benches in chamber order — the
   government down its side from the chair's end in the plan's own desk order, the
   crossbench after it, the opposition home from the other end, as the House's sorted fill
   does. The plan's members are checked against the 2022 results with the term's
   by-elections and party moves written in (Mulgrave, Warrandyte, Werribee, Prahran and
   Nepean; Ringwood and South Barwon to the crossbench): a member who isn't the frame's, a
   party that disagrees, a district or desk seated twice or left out, all fail the build.
   The Speaker (Maree Edwards, Bendigo West) keeps the chair. Writes
     map/data/seats-vic22.json   { plan, note, source, at: { district: desk } }. Run:
     node .build/map/vic_seating.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DATA = path.join(ROOT, "map", "data");
const SPEAKER_DIV = "Bendigo West"; // app-1-base SPEAKER_DIV.vic22 — the frame's chair holds her
const SPEAKER = { member: "Maree Edwards", party: "ALP" };
// members whose holder or party moved after election day (26 November 2022): five by-elections
// (the 2026 wave was Nepean in May 2026), and two who left their party for the crossbench
const BYELECTION = {
  Mulgrave: ["Eden Foster", "ALP"], Warrandyte: ["Nicole Werner", "L/N"], Werribee: ["John Lister", "ALP"],
  Prahran: ["Rachel Westaway", "L/N"], Nepean: ["Anthony Marsh", "L/N"],
};
const PARTY_MOVES = { Ringwood: ["Will Fowles"], "South Barwon": ["Darren Cheeseman"] };
// the six the plan seats at the table, from the chair's end down: the Premier, the Leader of the
// House and the Deputy Premier against the Opposition Leader, the Deputy Leader of the
// Opposition and the Nationals' leader (the plan's own order along its front benches)
const LEAD = { Niddrie: "Lt0", Kew: "Rt0", Ivanhoe: "Lt1", Caulfield: "Rt1", Dandenong: "Lt2", "Gippsland South": "Rt2" };
const SOURCE = "https://www.parliament.vic.gov.au/assembly";

const plan = JSON.parse(fs.readFileSync(path.join(DATA, "la-seating-plan-vic-2026-08-11.json"), "utf8"));
const res = JSON.parse(fs.readFileSync(path.join(DATA, "res-vic22.json"), "utf8"));
const won = new Map(res.divs.map((d) => [d.n, d.c.find((c) => c[6] === 1)]));

// the floor, from the app's own geometry
const src = fs.readFileSync(path.join(HERE, "app", "app-3-chamber.js"), "utf8");
const block = src.match(/@vic-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @vic-cells-end \*\//);
if (!block) throw new Error("app-3-chamber.js: no @vic-cells block");
const { vicCells, VIC_SERJEANT } = new Function(`${block[1]}; return { vicCells, VIC_SERJEANT };`)();
const cells = vicCells();
const drawn = new Map(cells.map((c) => [c.id, c]));

// the benches in chamber order (down the government's side, round the curve, up the
// opposition's): position along the walk as the app's benchS scores it, in chamber units
const CU = 30, CHK = 6;
const sOf = (c) => { const x = c.x / CU, y = c.y / CU; return y > 0 ? Math.atan2(y, -x) * CHK : x < 0 ? y : Math.PI * CHK - y; };
const bench = cells.filter((c) => c.row > 0 && c.id !== VIC_SERJEANT).sort((p, q) => sOf(p) - sOf(q) || p.row - q.row);

// the plan's roster, checked name and party against the election's own
const divs = plan.divisions;
if (Object.keys(divs).length !== 88) throw new Error(`the plan seats ${Object.keys(divs).length} divisions, 88 expected`);
if (!divs[SPEAKER_DIV] || divs[SPEAKER_DIV].m !== SPEAKER.member || divs[SPEAKER_DIV].p !== SPEAKER.party || !divs[SPEAKER_DIV].speaker)
  throw new Error(`the chair is not ${SPEAKER.member} of ${SPEAKER_DIV}`);
for (const [name, need] of Object.entries(LEAD))
  if (!divs[name] || !divs[name].role) throw new Error(`${name} should hold a table seat under the plan`);
for (const [div, r] of Object.entries(divs)) {
  if (div === SPEAKER_DIV) continue;
  const w = won.get(div);
  if (!w) throw new Error(`${div} is not a district of the 2022 election`);
  const by = BYELECTION[div];
  if (by) { if (r.m !== by[0] || r.p !== by[1]) throw new Error(`${div}: the plan seats ${r.m} (${r.p}), ${by.join(" (")}) expected`); continue; }
  const mv = PARTY_MOVES[div];
  if (mv) { if (r.m !== mv[0] || r.p !== "IND") throw new Error(`${div}: the plan seats ${r.m} (${r.p}), ${mv[0]} (IND) expected`); continue; }
  if (r.m !== w[0]) throw new Error(`${div} sits ${r.m}, the results elected ${w[0]}`);
  const fam = w[1] === "LIB" || w[1] === "NAT" ? "L/N" : w[1];
  if (r.p !== fam) throw new Error(`${r.m} sits ${r.p}, elected ${fam}`);
}

// walk the plan onto the floor: leaders to the table, then each bloc by its plan desk order
// (the desk's distance down the page from the chair — the plan's y), government then crossbench
// then opposition
const at = {};
const used = new Set();
const sit = (div, desk) => {
  if (!drawn.has(desk)) throw new Error(`desk ${desk} (${div}) is not on the app's floor`);
  if (used.has(desk)) throw new Error(`desk ${desk} seated twice`);
  used.add(desk);
  at[div] = desk;
};
for (const [div, desk] of Object.entries(LEAD)) sit(div, desk);
const rest = Object.entries(divs).filter(([d]) => d !== SPEAKER_DIV && !(d in LEAD));
const byPlanOrder = (a, b) => a[1].desk[1] - b[1].desk[1];
const G = rest.filter(([, r]) => r.p === "ALP").sort(byPlanOrder);
const CR = rest.filter(([, r]) => r.p === "GRN" || r.p === "IND").sort(byPlanOrder);
const O = rest.filter(([, r]) => r.p === "L/N").sort(byPlanOrder);
if (G.length !== 50 || CR.length !== 5 || O.length !== 26)
  throw new Error(`blocs off the floor: government ${G.length}, crossbench ${CR.length}, opposition ${O.length} (50, 5 and 26 expected)`);
let gi = 0, oi = bench.length - 1;
for (const [div] of G) sit(div, bench[gi++].id);
for (const [div] of CR) sit(div, bench[gi++].id);
for (const [div] of O.reverse()) sit(div, bench[oi--].id);
if (Object.keys(at).length !== 87) throw new Error(`${Object.keys(at).length} seated, 87 expected`);
if (SPEAKER_DIV in at) throw new Error(`${SPEAKER_DIV} must be in the chair, not at a desk`);

const out = {
  plan: "11 August 2026",
  note: "the earliest plan of this term — the six at the table are its own leadership seats",
  source: SOURCE,
  at,
};
fs.writeFileSync(path.join(DATA, "seats-vic22.json"), JSON.stringify(out, null, 1) + "\n");
console.log("map/data/seats-vic22.json", Object.keys(at).length, "seated (+ Bendigo West in the chair)");
