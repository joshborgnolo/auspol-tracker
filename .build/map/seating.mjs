/* seating.mjs – where each member sits, from the Parliament's seating plans.

   Reads map/data/house-seating-plan-<date>.json (each plan's printed labels:
   surname, division, the label's north-west corner in page points) and seats
   every member in the chamber's physical seats, the chamberCells() block of
   app/app-3-chamber.js: each label goes to the nearest free seat, nearest
   pairs first. A label is printed inside its seat round the curve and in the
   side blocks, and beside it along the front bench, so the front bench's
   labels sit some 20pt off their seats; anything further off fails the build.
   Writes map/data/seats-<key>.json: { plan, source, at: { division: seat id } }.
   PLANS says which plan each view of the map uses: "now" the latest; an
   election year the first plan printed after it, as they are filed. Run:
     node .build/map/seating.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DATA = path.join(ROOT, "map", "data");
const PLANS = { now: "2026-08-13" };

// the seats, from the app's own geometry
const src = fs.readFileSync(path.join(HERE, "app", "app-3-chamber.js"), "utf8");
const block = src.match(/\/\* @cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @cells-end \*\//);
if (!block) throw new Error("app-3-chamber.js: no @cells block");
const { chamberCells, SERJEANT } = new Function(`${block[1]}; return { chamberCells, SERJEANT };`)();
const ORIGIN = [297.6, 536]; // the far curve's centre on the plan's A4 page, in points

const roster = (key) => {
  const res = JSON.parse(fs.readFileSync(path.join(DATA, `res-${key === "now" ? 2025 : key}.json`), "utf8"));
  return { names: new Set(res.divs.map((d) => d.n)), speaker: res.speaker };
};

for (const [key, date] of Object.entries(PLANS)) {
  const plan = JSON.parse(fs.readFileSync(path.join(DATA, `house-seating-plan-${date}.json`), "utf8"));
  const cells = chamberCells().filter((c) => c.id !== SERJEANT && c.row >= 0);
  const R = roster(key);
  const mem = [];
  let speaker = null;
  for (const r of plan.rows) for (const s of r.seats) {
    if (!R.names.has(s.division)) throw new Error(`${date}: ${s.division} is not a division of ${key}`);
    if (s.side === "speaker") { speaker = s.division; continue; }
    // the label's middle: about 2.1pt a character across, the name and division lines 16pt deep
    mem.push({ div: s.division, label: s.label, x: s.x + 2.1 * s.label.length - ORIGIN[0], y: s.y + 8 - ORIGIN[1] });
  }
  if (speaker !== R.speaker) throw new Error(`${date}: the plan's Speaker sits for ${speaker}, the data's for ${R.speaker}`);
  const pairs = [];
  mem.forEach((m, i) => cells.forEach((c, j) => pairs.push([Math.hypot(m.x - c.x, m.y - c.y), i, j])));
  pairs.sort((a, b) => a[0] - b[0]);
  const got = new Map(), used = new Set();
  for (const [d, i, j] of pairs) { if (got.has(i) || used.has(j)) continue; got.set(i, [j, d]); used.add(j); }
  const at = {};
  let worst = 0;
  mem.forEach((m, i) => {
    const [j, d] = got.get(i);
    if (d > 32) throw new Error(`${date}: ${m.label} (${m.div}) lands ${d.toFixed(1)}pt from seat ${cells[j].id}`);
    worst = Math.max(worst, d);
    at[m.div] = cells[j].id;
  });
  const out = { plan: plan.meta.planDate, source: "https://www.aph.gov.au/About_Parliament/House_of_Representatives/House_of_Representatives_Seating_Plan", at };
  const file = path.join(DATA, `seats-${key}.json`);
  fs.writeFileSync(file, JSON.stringify(out) + "\n");
  console.log(`seats-${key}.json: ${mem.length} members from the plan of ${plan.meta.planDate}, worst label ${worst.toFixed(1)}pt from its seat`);
}
