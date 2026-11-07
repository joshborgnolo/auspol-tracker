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
// the 46th Parliament's earliest archived plan is March 2021's (none survives from 2019)
const PLANS = { now: "2026-08-13", 2025: "2025-10-27", 2022: "2022-07-29", 2019: "2021-03", 2016: "2016-08-31", 2013: "2013-11-12", 2010: "2012-02-27" };
// what the legend adds after the plan's date, where the plan isn't the term's first
const NOTES = { 2019: "the earliest archived for this Parliament",
  2010: "the earliest archived for this Parliament; Slipper, then Speaker, is placed on the opposition benches" };
// a plan printed after the Speaker changed: its chair holds a member who, as elected, sat on the
// benches. The map's view keeps the elected Speaker in the chair (their printed bench seat left
// empty) and places the plan's Speaker in the free seat on their own side, off the front bench,
// nearest the chair
const LATER_SPEAKER = { 2010: { div: "Fisher", side: "R" } };

// the seats, from the app's own geometry
const src = fs.readFileSync(path.join(HERE, "app", "app-3-chamber.js"), "utf8");
const block = src.match(/\/\* @cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @cells-end \*\//);
if (!block) throw new Error("app-3-chamber.js: no @cells block");
const { chamberCells, SERJEANT } = new Function(`${block[1]}; return { chamberCells, SERJEANT };`)();
// the 13 August 2026 plan's page is the geometry's frame (its far curve's centre at 297.6, 536):
// there the printed SPEAKER under the chair sits at (285.6, 194.4), the Serjeant-at-Arms at y 802.2
const REF = { chairX: 285.6 - 297.6, chairY: 194.4 - 536, span: 802.2 - 194.4 };

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
    // a plan printed for the sitting that elects the Speaker (12 November 2013) has nobody at the
    // chair and lists the Speaker-to-be on the benches; the map puts them in the chair
    if (s.division === R.speaker) continue;
    // the label's middle: about 2.1pt a character across, the name and division lines 16pt deep
    raw.push({ div: s.division, label: s.label, row: r.row, x: s.x + 2.1 * s.label.length, y: s.y + 8 });
  }
  const later = LATER_SPEAKER[key];
  if (speaker && speaker.division !== R.speaker && !(later && later.div === speaker.division)) throw new Error(`${date}: the plan's Speaker sits for ${speaker.division}, the data's for ${R.speaker}`);
  const chair = plan.officials && plan.officials.speakerChair, serj = plan.officials && plan.officials.serjeantAtArms;
  if (!chair || !serj) throw new Error(`${date}: the plan's officials give no Speaker's chair or Serjeant-at-Arms to place the page by`);
  // each year's page draws the same chamber at its own size and place: start from the printed
  // chair and Serjeant-at-Arms, the chamber's top and foot, then refit scale and shift to the seats
  // the labels fall in (the front bench's labels sit beside their seats, so they don't count)
  let k = REF.span / (serj.y - chair.y), tx = REF.chairX - k * chair.x, ty = REF.chairY - k * chair.y;
  let mem, got;
  const isArm = (c) => /^[LR]a\d/.test(c.id);
  const place = () => {
    mem = raw.map((m) => ({ ...m, cx: k * m.x + tx, cy: k * m.y + ty }));
    got = new Map();
    const used = new Set();
    // the front bench's arms are one long bench each, its names printed close together: the
    // front row's names beside an arm (the plan's row 1, above the curve, off the table) take its
    // places in their printed order (the alignment with the least total shift), so a crowded arm
    // can't push a name past its neighbour
    for (const side of ["L", "R"]) {
      const A = cells.map((c, j) => j).filter((j) => isArm(cells[j]) && cells[j].id[0] === side).sort((a, b) => cells[a].y - cells[b].y);
      const M = mem.map((m, i) => i).filter((i) => mem[i].row === 1 && mem[i].cy < -15 && Math.abs(mem[i].cx) > 75 && (mem[i].cx < 0) === (side === "L")).sort((a, b) => mem[a].cy - mem[b].cy);
      if (M.length > A.length) throw new Error(`${date}: ${M.length} names on the ${side} arm, room for ${A.length}`);
      // dp[a][b]: least shift placing the first a names in the first b places
      const dp = Array.from({ length: M.length + 1 }, () => new Array(A.length + 1).fill(Infinity));
      for (let b = 0; b <= A.length; b++) dp[0][b] = 0;
      for (let a = 1; a <= M.length; a++) for (let b = a; b <= A.length; b++)
        dp[a][b] = Math.min(dp[a][b - 1], dp[a - 1][b - 1] + Math.abs(mem[M[a - 1]].cy - cells[A[b - 1]].y));
      for (let a = M.length, b = A.length; a > 0; b--) {
        if (dp[a][b] === dp[a][b - 1]) continue;
        const i = M[a - 1], j = A[b - 1];
        got.set(i, [j, Math.hypot(mem[i].cx - cells[j].x, mem[i].cy - cells[j].y)]); used.add(j); a--;
      }
    }
    // everyone else: the nearest free seat, nearest pairs first
    const pairs = [];
    mem.forEach((m, i) => { if (!got.has(i)) cells.forEach((c, j) => { if (!isArm(c)) pairs.push([Math.hypot(m.cx - c.x, m.cy - c.y), i, j]); }); });
    pairs.sort((a, b) => a[0] - b[0]);
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
    const lim = isArm(cells[j]) ? 40 : 32; // a front-bench label prints beside its bench
    if (d > lim && process.env.SEATING_FIT) console.log(`  far: ${m.label} (${m.div}) ${d.toFixed(1)}pt from ${cells[j].id}`);
    else if (d > lim) throw new Error(`${date}: ${m.label} (${m.div}) lands ${d.toFixed(1)}pt from seat ${cells[j].id}`);
    worst = Math.max(worst, d);
    at[m.div] = cells[j].id;
  });
  if (later) {
    const used = new Set(Object.values(at));
    const chairAt = [0, -365], gap = (c) => Math.hypot(c.x - chairAt[0], c.y - chairAt[1]);
    const free = cells.filter((c) => c.id[0] === later.side && c.row > 1 && !used.has(c.id)).sort((a, b) => gap(a) - gap(b));
    if (!free.length) throw new Error(`${date}: no free seat for ${later.div}`);
    at[later.div] = free[0].id;
  }
  const out = { plan: plan.meta.planDate, ...(NOTES[key] ? { note: NOTES[key] } : {}), source: "https://www.aph.gov.au/About_Parliament/House_of_Representatives/House_of_Representatives_Seating_Plan", at };
  if (process.env.SEATING_FIT) fs.appendFileSync(process.env.SEATING_FIT, JSON.stringify({ key, k, tx, ty }) + "\n");
  const file = path.join(DATA, `seats-${key}.json`);
  fs.writeFileSync(file, JSON.stringify(out) + "\n");
  console.log(`seats-${key}.json: ${mem.length} members from the plan of ${plan.meta.planDate}, worst label ${worst.toFixed(1)}pt from its seat, page scale ${k.toFixed(3)}`);
}
