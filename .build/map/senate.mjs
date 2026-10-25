#!/usr/bin/env node
/* The Senate as it sits: map/data/senate-now.json, from the Parliament's Senate seating plan
   (aph.gov.au/About_Parliament/Senate/Seating_Plan, filed in .build/map/src/senate-aph-<date>/:
   the page's own seat-by-seat SVG and the senators.json it fills the seats from) and the AEC's
   Senators Elected lists for 2022 and 2025 (.build/map/src/senate-aec/), which give each senator's
   term. Senators who weren't elected fill a casual vacancy, and serve the rest of the term of the
   senator they replaced: the one elected for the same state and party who no longer sits.

   The seats' geometry is read off the SVG in Chrome (puppeteer-core, as the repo's probes use it):
   each seat's outline is sampled and turned into a chair (centre, the way it faces, its width
   along the bench and its depth), in the plan's own units about the centre of the far curve. The
   furniture keeps its SVG path data, drawn as is by the app.

     node .build/map/senate.mjs            writes map/data/senate-now.json and senate-floor-<date>.json
     SENATE_PLAN=<dir> node …              reads another filed plan */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLAN = process.env.SENATE_PLAN || join(ROOT, ".build/map/src/senate-aph-2026-10-09");
const AS_OF = PLAN.match(/(\d{4}-\d{2}-\d{2})$/)[1];
const require = createRequire(join(ROOT, "package.json"));
const puppeteer = require("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const ST = { "New South Wales": "NSW", Victoria: "VIC", Queensland: "QLD", "Western Australia": "WA", "South Australia": "SA", Tasmania: "TAS", "Australian Capital Territory": "ACT", "Northern Territory": "NT" };
const AB = { "Australian Labor Party": "ALP", "Liberal Party of Australia": "LP", "Liberal National Party of Queensland": "LNP", "The Nationals": "NP", "Australian Greens": "GRN", "Pauline Hanson's One Nation": "ON", Independent: "IND", "Jacqui Lambie Network": "JLN", "Australia's Voice": "AV", "United Australia Party": "UAPP" };
// the AEC's ballot-group codes, as the parties' own: a candidate's group (DAVI, GVIC …) read as their party
const AEC_AB = { DAVI: "IND", GVIC: "GRN", CLP: "CLP", LNP: "LNP", LP: "LP", NP: "NP", ALP: "ALP", GRN: "GRN", ON: "ON", JLN: "JLN", UAPP: "UAPP" };
const TERRITORY = new Set(["ACT", "NT"]);

/* ----- who sits, and for which term ----- */
const sitting = JSON.parse(readFileSync(join(PLAN, "senators.json"), "utf8"));
function elected(event, year) {
  const rows = readFileSync(join(ROOT, `.build/map/src/senate-aec/SenateSenatorsElectedDownload-${event}.csv`), "utf8").trim().split(/\r?\n/).slice(2);
  return rows.map((r) => { const [st, given, sur, , ab, order] = r.split(","); return { st, given, sur: sur.toUpperCase(), ab: AEC_AB[ab] || ab, order: +order, year }; });
}
const ELECTED = [...elected(27966, 2022), ...elected(31496, 2025)];
const key = (s) => s.toUpperCase().replace(/[’']/g, "'");
// a sitting senator's own election: the latest list that names them for their state (a territory
// senator is elected at every election, so the 2025 list wins)
function ownElection(x) {
  const st = ST[x.state], sur = key(x.surname);
  const hits = ELECTED.filter((r) => r.st === st && (sur === r.sur || sur.endsWith(" " + r.sur)));
  return hits.sort((a, b) => b.year - a.year)[0] || null;
}
const claimed = new Set();
const senators = sitting.map((x) => {
  const st = ST[x.state], ab = AB[x.party];
  if (!st || !ab) throw new Error(`unknown state or party: ${x.state} / ${x.party}`);
  const e = ownElection(x);
  if (e) claimed.add(e);
  return { x, st, ab, e };
});
// the vacancies: an elected senator no longer sitting; each casual senator takes the one of their own state and party
const gone = ELECTED.filter((r) => !claimed.has(r) && !(TERRITORY.has(r.st) && r.year === 2022));
// where one state and party had two vacancies, the appointments name whose seat each filled
const CASUAL_FOR = { "Maria Kovacic": "MOLAN", "Dave Sharma": "PAYNE" }; // Molan died in January 2023, Payne resigned in October 2024
for (const s of senators) {
  if (s.e) continue;
  const fam = (ab) => (["LP", "LNP", "NP", "CLP"].includes(ab) ? "COAL" : ab);
  const name = `${s.x.givenName} ${s.x.surname}`;
  const cands = gone.filter((r) => r.st === s.st && fam(r.ab) === fam(s.ab) && (!CASUAL_FOR[name] || r.sur === CASUAL_FOR[name]));
  if (!cands.length) throw new Error(`no vacancy for ${name} (${s.st}, ${s.ab})`);
  // two vacancies a casual senator could have filled, with different terms, need naming
  if (cands.length > 1 && new Set(cands.map((r) => r.year)).size > 1) throw new Error(`${name} could fill ${cands.map((r) => r.sur).join(" or ")}: name it in CASUAL_FOR`);
  if (cands.length > 1 && !CASUAL_FOR[name]) s.casualOf = cands.length;
  s.casual = cands[0];
  gone.splice(gone.indexOf(cands[0]), 1);
}
if (gone.length) throw new Error("elected senators neither sitting nor replaced: " + gone.map((r) => `${r.given} ${r.sur}`).join(", "));
const termOf = (st, year) => (TERRITORY.has(st) ? "next" : year === 2022 ? 2028 : 2031);
const title = (s) => s.charAt(0) + s.slice(1).toLowerCase();

/* ----- the floor, read off the plan's SVG ----- */
const svg = readFileSync(join(PLAN, "seating-plan.svg"), "utf8");
const browser = await puppeteer.launch({ headless: "new", executablePath: CHROME });
let raw;
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><body style="margin:0">${svg.replace("<svg ", '<svg width="734" height="990" ')}</body>`);
  raw = await page.evaluate(() => {
    const root = document.querySelector("svg");
    const P = (el, x, y) => { const m = el.getCTM(), r = root.getCTM().inverse().multiply(m); return [r.a * x + r.c * y + r.e, r.b * x + r.d * y + r.f]; };
    // an outline as points in the plan's units: polygons and rects by their corners, paths sampled
    const outline = (el) => {
      if (el.tagName === "rect") { const x = +el.getAttribute("x"), y = +el.getAttribute("y"), w = +el.getAttribute("width"), h = +el.getAttribute("height"); return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => P(el, a, b)); }
      if (el.tagName === "polygon" || el.tagName === "polyline") return el.getAttribute("points").trim().split(/[\s,]+/).map(Number).reduce((o, v, i, a) => (i % 2 ? o : [...o, P(el, v, a[i + 1])]), []);
      const L = el.getTotalLength(), n = Math.max(24, Math.ceil(L / 2));
      return Array.from({ length: n }, (_, i) => { const p = el.getPointAtLength((i * L) / n); return P(el, p.x, p.y); });
    };
    // a shape as SVG path data in the plan's units (a path keeps its d, shifted by its translate)
    const pathOf = (el) => {
      const t = (el.getAttribute("transform") || "").match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
      if (el.tagName === "path") return { d: el.getAttribute("d"), t: t ? [+t[1], +t[2]] : [0, 0] };
      if (el.tagName === "line") return { d: `M${el.getAttribute("x1")} ${el.getAttribute("y1")}L${el.getAttribute("x2")} ${el.getAttribute("y2")}`, t: [0, 0], open: true };
      const pts = outline(el).map((p) => p.map((v) => +v.toFixed(2)));
      return { d: "M" + pts.map((p) => p.join(" ")).join("L") + (el.tagName === "polyline" ? "" : "Z"), t: [0, 0], open: el.tagName === "polyline" };
    };
    const seats = [...root.querySelectorAll("g.seat")].map((g) => { const el = g.querySelector("polygon,path,rect"); return { id: g.id, kind: el.tagName, pts: outline(el), path: pathOf(el) }; });
    const group = (sel) => [...root.querySelectorAll(`${sel} polygon, ${sel} path, ${sel} rect, ${sel} polyline, ${sel} line`)].map((el) => ({ ...pathOf(el), cls: el.getAttribute("class") || "", pts: outline(el) }));
    return {
      seats,
      table: group("#table"), hansard: group("#hansard"), desk: group("#presidents_desk"), clerks: group("#clerks"),
      advisers: group("#advisor_boxes"), outlines: group("#seat_outlines"),
    };
  });
} finally { await browser.close(); }

// the plan's axis and the far curve's centre: the axis halves the leaders' chairs; the centre is
// where the curve seats' outer edges are most nearly one circle a row
const byId = new Map(raw.seats.map((s) => [s.id, s]));
const mid = (pts) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [(x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0]; };
const CX = (mid(byId.get("leader_of_the_government").pts)[0] + mid(byId.get("leader_of_the_opposition").pts)[0]) / 2;
const curve = raw.seats.filter((s) => s.kind === "path");
let CY = 0, best = Infinity;
for (let cy = 560; cy <= 720; cy += 0.25) {
  let err = 0;
  for (const r of ["A", "B", "C"]) {
    const outer = curve.filter((s) => s.id[0] === r).map((s) => Math.max(...s.pts.map(([x, y]) => Math.hypot(x - CX, y - cy))));
    const m = outer.reduce((a, b) => a + b, 0) / outer.length;
    err += outer.reduce((a, b) => a + (b - m) ** 2, 0);
  }
  if (err < best) { best = err; CY = cy; }
}
const R2 = (v) => Math.round(v * 100) / 100;
// each seat as a chair: it faces the table across the straight benches and the curve's centre round
// the curve; its depth and width are its outline's extents along and across that way
const ROW = { A: 1, B: 2, C: 3 };
function chair(s) {
  const [mx, my] = mid(s.pts);
  const x = mx - CX, y = my - CY;
  let fa;
  if (s.id === "president") fa = Math.PI / 2;
  else if (s.kind === "path") fa = Math.atan2(-y, -x);
  else fa = x < 0 ? 0 : Math.PI;
  const ux = Math.cos(fa), uy = Math.sin(fa);
  let d0 = Infinity, d1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (const [px, py] of s.pts) { const dx = px - CX, dy = py - CY, d = dx * ux + dy * uy, w = -dx * uy + dy * ux; d0 = Math.min(d0, d); d1 = Math.max(d1, d); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
  const dc = (d0 + d1) / 2, wc = (w0 + w1) / 2;
  return { x: R2(dc * ux - wc * uy), y: R2(dc * uy + wc * ux), fa: Math.round(fa * 1000) / 1000, D: R2(d1 - d0), W: R2(w1 - w0) };
}
const seats = raw.seats.map((s) => {
  const c = chair(s);
  const row = s.id === "president" ? -1 : /^leader/.test(s.id) ? 0 : ROW[s.id[0]];
  return { id: s.id, row, ...c, d: s.path.d, t: [R2(s.path.t[0] - CX), R2(s.path.t[1] - CY)] };
});
const shift = (list) => list.map((p) => ({ d: p.d, t: [R2(p.t[0] - CX), R2(p.t[1] - CY)], ...(p.open ? { open: true } : {}), ...(p.cls ? { cls: p.cls } : {}) }));
// the benches' and desks' drawn lines, 1,200 strokes of one weight: one path per shared offset
function merged(list) {
  const by = new Map();
  for (const p of shift(list)) { const k = p.t.join(","); if (!by.has(k)) by.set(k, { t: p.t, d: "" }); by.get(k).d += p.d; }
  return [...by.values()].map((g) => ({ ...g, open: true }));
}
// the officers' chairs, drawn as the app draws every chair: the Clerk and Deputy Clerk either side of
// the Chair of Committees at the table's head, facing down the chamber; Hansard's two reporters at
// its foot, facing up it; Black Rod in the government side's back corner
const at = (pts, k, fa) => { const [x, y, w, h] = mid(pts); return { k, x: R2(x - CX), y: R2(y - CY), fa: Math.round(fa * 1000) / 1000, W: R2(Math.min(w, h)), D: R2(Math.max(w, h)) }; };
const isPath = (p) => /^M/.test(p.d) && p.t[0] !== 0;
const officers = [
  ...raw.clerks.map((p) => at(p.pts, "clerk", Math.PI / 2)),
  ...raw.table.filter((p) => p.cls === "cls-8").map((p) => at(p.pts, "chair", Math.PI / 2)),
  ...raw.hansard.filter(isPath).map((p) => at(p.pts, "hansard", -Math.PI / 2)),
  { ...at(byId.get("C01").pts, "blackRod", 0) },
];
if (officers.length !== 6) throw new Error(`expected six officers' chairs, found ${officers.length}`);
// every outline's extent, for the box the chamber is framed in
let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
for (const list of [raw.seats, raw.table, raw.hansard, raw.desk, raw.clerks, raw.advisers, raw.outlines]) for (const s of list) for (const [x, y] of s.pts) { bx0 = Math.min(bx0, x - CX); bx1 = Math.max(bx1, x - CX); by0 = Math.min(by0, y - CY); by1 = Math.max(by1, y - CY); }

// the floor, one file per plan revision (it changes only when the chamber's furniture does), and who sits now
const FLOOR = `senate-floor-${AS_OF}.json`;
const floor = {
  plan: AS_OF,
  source: "Parliament of Australia, Senate seating plan (aph.gov.au/About_Parliament/Senate/Seating_Plan), its seat-by-seat SVG, as at " + AS_OF,
  units: "the plan's SVG units (viewBox 734 x 990), about the centre of the far curve, y down",
  centre: [R2(CX), R2(CY)],
  box: [R2(bx0), R2(by0), R2(bx1), R2(by1)],
  // Black Rod's chair is a seat of the plan's (C01), left out of the senators' seats
  seats: seats.filter((c) => c.id !== "C01"),
  officers,
  furniture: { table: shift(raw.table.filter((p) => p.cls !== "cls-8")), hansard: shift(raw.hansard.filter((p) => !isPath(p))), desk: shift(raw.desk), advisers: shift(raw.advisers), outlines: merged(raw.outlines.filter((p) => !p.cls.startsWith("label"))) },
};
const out = {
  asOf: AS_OF,
  floor: FLOOR,
  source: "Parliament of Australia, Senate seating plan as at " + AS_OF + "; terms from the AEC's Senators Elected lists, 2022 (event 27966) and 2025 (event 31496)",
  senators: senators.map(({ x, st, ab, e, casual, casualOf }) => {
    const year = e ? e.year : casual.year;
    const o = { seat: x.seatID, n: `${x.givenName} ${x.surname}`, st, ab, term: termOf(st, year) };
    if (e) { o.elected = e.year; if (e.ab !== ab && !(e.ab === "LNP" && ["LP", "NP"].includes(ab)) && !(e.ab === "CLP" && ab === "LP")) o.electedAs = e.ab; }
    else if (casualOf) o.casual = { elected: casual.year };
    else o.casual = { for: `${title(casual.given.split(" ")[0])} ${title(casual.sur).replace(/-(\w)/g, (m, c) => "-" + c.toUpperCase())}`, elected: casual.year };
    if (x.seatID === "president") o.role = "president";
    else if (x.seatID === "leader_of_the_government") o.role = "leader";
    else if (x.seatID === "leader_of_the_opposition") o.role = "oppLeader";
    return o;
  }),
};
const counts = {};
for (const s of out.senators) counts[s.ab] = (counts[s.ab] || 0) + 1;
if (out.senators.length !== 76) throw new Error(`expected 76 senators, have ${out.senators.length}`);
writeFileSync(join(ROOT, "map/data", FLOOR), JSON.stringify(floor) + "\n");
writeFileSync(join(ROOT, "map/data/senate-now.json"), JSON.stringify(out) + "\n");
console.log(`${FLOOR}: ${seats.length} seats, centre ${floor.centre}; senate-now.json: ${out.senators.length} senators, as at ${AS_OF}`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · "));
console.log("casual:", out.senators.filter((s) => s.casual).map((s) => `${s.n} for ${s.casual.for} (${s.term})`).join("; "));
console.log("elected for another party:", out.senators.filter((s) => s.electedAs).map((s) => `${s.n} ${s.electedAs}→${s.ab}`).join("; "));
