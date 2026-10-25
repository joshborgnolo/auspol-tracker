// The external territories and outlying islands with polling places, for the
// map's inset boxes. geo_build.mjs clips every seat to the mainland frame, so
// Norfolk Island (Canberra 2016, Bean from 2019), Lord Howe Island (Sydney),
// Christmas Island and the Cocos (Keeling) Islands (Lingiari) never reach
// the map's own shapes; this writes their coasts once and, per election, the
// seat each belongs to, as map/data/islands.json.
//  - shape: the rings of the 2025 boundary file lying wholly inside the
//    island's frame (the frame leaves out Ball's Pyramid and North Keeling,
//    uninhabited and tens of km off), Douglas-Peucker simplified to TOL
//    metres, rocks under MIN_AREA dropped;
//  - owner: the seat whose boundary holds the island in that year's file.
//    The 2016 file has no Norfolk Island (its ACT part is the ACT's own 2016
//    file, drawn without it), but from 2016 the island was in Canberra by
//    law (Norfolk Island Legislation Amendment Act 2015), hence OWNER_FIX.
//    In 2010 and 2013 Norfolk Islanders could enrol in Canberra without the
//    island being in it: no owner, and the page reads the booths' seat.
// usage: node .build/map/islands_build.mjs <srcDir with n-YYYY.geojson> map/data
import fs from "fs";

const [, , srcDir, outDir] = process.argv;
const YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const ISLANDS = [
  { key: "norfolk", name: "Norfolk Island", box: [167.9, -29.14, 168.02, -28.98] },
  { key: "lordhowe", name: "Lord Howe Island", box: [159.03, -31.6, 159.13, -31.49] },
  { key: "christmas", name: "Christmas Island", box: [105.52, -10.59, 105.73, -10.39] },
  { key: "cocos", name: "Cocos (Keeling) Islands", box: [96.8, -12.22, 96.95, -12.06] },
];
const OWNER_FIX = { 2016: { norfolk: "Canberra" } };
const TOL = 25, MIN_AREA = 2e4; // metres, square metres

const inBox = (r, b) => r.every(([x, y]) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
const polysOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
// local metres about the island's frame centre (an island is a few km across)
const metres = (b) => { const k = Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180) * 111320; return ([x, y]) => [x * k, y * 110574]; };
function area(r, m) { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [x0, y0] = m(r[j]), [x1, y1] = m(r[i]); s += x0 * y1 - x1 * y0; } return Math.abs(s / 2); }
function simplify(r, m) {
  const P = r.map(m), keep = new Uint8Array(r.length);
  keep[0] = keep[r.length - 1] = 1;
  const st = [[0, r.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let best = -1, bd = TOL;
    const [ax, ay] = P[a], [bx, by] = P[b], L = Math.hypot(bx - ax, by - ay);
    for (let i = a + 1; i < b; i++) {
      const [px, py] = P[i];
      const d = L ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L : Math.hypot(px - ax, py - ay);
      if (d > bd) { bd = d; best = i; }
    }
    if (best > 0) { keep[best] = 1; st.push([a, best], [best, b]); }
  }
  return r.filter((_, i) => keep[i]);
}
const round = (v) => Math.round(v * 1e5) / 1e5;

const owner = {}, shapes = {};
for (const y of YEARS) {
  const fc = JSON.parse(fs.readFileSync(`${srcDir}/n-${y}.geojson`, "utf8"));
  owner[y] = {};
  for (const isl of ISLANDS) {
    for (const f of fc.features) {
      const rings = polysOf(f.geometry).map((p) => p[0]).filter((r) => inBox(r, isl.box));
      if (!rings.length) continue;
      if (owner[y][isl.key]) throw new Error(`${y} ${isl.key}: in both ${owner[y][isl.key]} and ${f.properties.name}`);
      owner[y][isl.key] = f.properties.name;
      if (y === 2025) shapes[isl.key] = rings;
    }
  }
  Object.assign(owner[y], OWNER_FIX[y] || {});
}
const out = {
  islands: ISLANDS.map((isl) => {
    const m = metres(isl.box), src = shapes[isl.key];
    if (!src) throw new Error(`${isl.key}: no 2025 shape`);
    // a ring is closed (first point = last); simplify each half so the seam stays put
    const rings = src.filter((r) => area(r, m) >= MIN_AREA).map((r) => {
      const h = Math.floor(r.length / 2);
      const a = simplify(r.slice(0, h + 1), m), b = simplify(r.slice(h), m);
      return [...a, ...b.slice(1)].map(([x, y]) => [round(x), round(y)]);
    }).filter((r) => r.length >= 4);
    return { key: isl.key, name: isl.name, box: isl.box, rings };
  }),
  owner,
};
fs.writeFileSync(`${outDir}/islands.json`, JSON.stringify(out));
for (const i of out.islands) console.log(i.key, i.rings.length, "rings", i.rings.reduce((s, r) => s + r.length, 0), "points");
for (const y of YEARS) console.log(y, JSON.stringify(owner[y]));
