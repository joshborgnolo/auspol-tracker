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
   election year the first plan printed after it, as they are filed (add the
   year to SEATED in app/app-1-base.js too). Each page draws the chamber at
   its own size and place, so each plan is fitted to the geometry first. Run:
     node .build/map/seating.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DATA = path.join(ROOT, "map", "data");
const PLANS = { now: "2026-08-13", 2025: "2025-10-27", 2022: "2022-07-29" };

// the seats, from the app's own geometry
const src = fs.readFileSync(path.join(HERE, "app", "app-3-chamber.js"), "utf8");
const block = src.match(/\/\* @cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @cells-end \*\//);
if (!block) throw new Error("app-3-chamber.js: no @cells block");
const { chamberCells, SERJEANT } = new Function(`${block[1]}; return { chamberCells, SERJEANT };`)();
// the 13 August 2026 plan's page is the geometry's frame: the Speaker's label sits 374.6pt above its far curve's centre
const SPEAKER_RISE = 536 - 161.4;

const roster = (key) => {
  const res = JSON.parse(fs.readFileSync(path.join(DATA, `res-${key === "now" ? 2025 : key}.json`), "utf8"));
  return { names: new Set(res.divs.map((d) => d.n)), speaker: res.speaker };
};

for (const [key, date] of Object.entries(PLANS)) {
  const plan = JSON.parse(fs.readFileSync(path.join(DATA, `house-seating-plan-${date}.json`), "utf8"));
  const cells = chamberCells().filter((c) => c.id !== SERJEANT && c.row >= 0);
  const R = roster(key);
  const raw = [];
  let speaker = null;
  for (const r of plan.rows) for (const s of r.seats) {
    if (!R.names.has(s.division)) throw new Error(`${date}: ${s.division} is not a division of ${key}`);
    if (s.side === "speaker") { speaker = s; continue; }
    // the label's middle: about 2.1pt a character across, the name and division lines 16pt deep
    raw.push({ div: s.division, label: s.label, x: s.x + 2.1 * s.label.length, y: s.y + 8 });
  }
  if (!speaker || speaker.division !== R.speaker) throw new Error(`${date}: the plan's Speaker sits for ${speaker && speaker.division}, the data's for ${R.speaker}`);
  // each year's page draws the same chamber at its own size and place: start from its stated
  // centre and the Speaker's height above it, then refit scale and shift to the seats the labels
  // fall in (the front bench's labels sit beside their seats, so they don't count in the fit)
  const c0 = (plan.meta.geometry || "").match(/centre near \(([\d.]+), ([\d.]+)\)/);
  if (!c0) throw new Error(`${date}: the plan's meta.geometry gives no centre`);
  let k = SPEAKER_RISE / (+c0[2] - speaker.y), tx = -k * +c0[1], ty = -k * +c0[2];
  let mem, got;
  const place = () => {
    mem = raw.map((m) => ({ ...m, cx: k * m.x + tx, cy: k * m.y + ty }));
    const pairs = [];
    mem.forEach((m, i) => cells.forEach((c, j) => pairs.push([Math.hypot(m.cx - c.x, m.cy - c.y), i, j])));
    pairs.sort((a, b) => a[0] - b[0]);
    got = new Map();
    const used = new Set();
    for (const [d, i, j] of pairs) { if (got.has(i) || used.has(j)) continue; got.set(i, [j, d]); used.add(j); }
  };
  for (let it = 0; it < 4; it++) {
    place();
    const P = [], C = [];
    mem.forEach((m, i) => { const c = cells[got.get(i)[0]]; if (c.row !== 1 || c.y > 0) { P.push([m.x, m.y]); C.push([c.x, c.y]); } });
    const mean = (A) => [A.reduce((s, a) => s + a[0], 0) / A.length, A.reduce((s, a) => s + a[1], 0) / A.length];
    const pm = mean(P), cm = mean(C);
    let num = 0, den = 0;
    P.forEach((p, i) => { num += (p[0] - pm[0]) * (C[i][0] - cm[0]) + (p[1] - pm[1]) * (C[i][1] - cm[1]); den += (p[0] - pm[0]) ** 2 + (p[1] - pm[1]) ** 2; });
    k = num / den; tx = cm[0] - k * pm[0]; ty = cm[1] - k * pm[1];
  }
  place();
  const at = {};
  let worst = 0;
  mem.forEach((m, i) => {
    const [j, d] = got.get(i);
    if (d > 32) throw new Error(`${date}: ${m.label} (${m.div}) lands ${d.toFixed(1)}pt from seat ${cells[j].id}`);
    worst = Math.max(worst, d);
    at[m.div] = cells[j].id;
  });
  const out = { plan: plan.meta.planDate, source: "https://www.aph.gov.au/About_Parliament/House_of_Representatives/House_of_Representatives_Seating_Plan", at };
  if (process.env.SEATING_FIT) fs.appendFileSync(process.env.SEATING_FIT, JSON.stringify({ key, k, tx, ty }) + "\n");
  const file = path.join(DATA, `seats-${key}.json`);
  fs.writeFileSync(file, JSON.stringify(out) + "\n");
  console.log(`seats-${key}.json: ${mem.length} members from the plan of ${plan.meta.planDate}, worst label ${worst.toFixed(1)}pt from its seat, page scale ${k.toFixed(3)}`);
}
