/* water_build.mjs – map/data/water.json and water-<city>.json: the harbours, rivers and
   lakes the seats are drawn across, and the salt lakes that are dry most years.

   The AEC draws its divisions across the water: Sydney Harbour, Botany Bay, the
   Parramatta and the Swan lie inside seats (Western Port too from 2019; Moreton Bay and
   the Torres Strait in Queensland's own districts), so the map painted them in a seat's
   colour until street zoom, where Esri's sea cuts them back (prepStreets, laySea).
   These files let the map show that water at every zoom it can be seen at:

     water    the water inside the seats: every frame's seats (the federal 2004-2025
              and state frames, hi detail) merged, less the ABS's land (the ASGS 2021
              Australia less the "Water" mesh blocks a lasting water confirms: step 0)
              and less the dry lakes below. What is left is the harbours, bays and
              estuaries the ASGS leaves out of its coverage, and the lakes, reservoirs
              and river reaches its confirmed Water mesh blocks hold. A piece is kept
              when it is over PIECE_MIN km2 and wide enough to be water rather than the
              gap between two coastlines: 2 x area / perimeter (its mean width) at least
              WIDTH_MIN metres. Each piece carries the frames whose seats cover at least
              COVER_MIN of it (f, a bit per entry of the file's frames list): a frame
              cuts only its own pieces and strokes only their shores, so a frame whose
              coast already follows the land never gets a second coastline beside its own.
     shore    each kept piece's outline where it meets land: the coast the map strokes
     mouth    the rest of its outline, where it meets the seats' outer edge (the line
              across a harbour's mouth): the map rubs out the seats' coast stroke there,
              whose outer half would otherwise be left on the water
     dry      Geoscience Australia's non-perennial lakes over DRY_MIN km2 (Kati Thanda-
              Lake Eyre, Torrens, Gairdner, Mackay, Amadeus...), named: drawn as dry
              lakes over the seats' colour, never cut to water
     lp       (water.json) a land point for each seat whose name stood on its own water
              (step 6): Kingsford Smith's in Botany Bay, Redcliffe's in Moreton Bay

   water.json holds what the country and state views can show (water pieces over LO_MIN
   km2 and dry lakes over LO_DRY_MIN, to LO_TOL / LO_DRY_TOL metres), the city files'
   bounds and the label points, and loads with the map (the page's head warms it).
   water-<city>.json holds all of it round one capital (each piece goes to the capital
   nearest the middle of its bounds), the water to HI_TOL and the dry lakes to DRY_TOL
   metres, fetched as a city view first nears it. Each file is two lon/lat TopoJSON
   topologies, { water, dry }.

   The Handbook years (1993-2001) are tested for cover like the rest but stay out of
   the merge: their digitised coasts sit too far from the ASGS's to difference cleanly.

   Sources: node .build/map/water_fetch.mjs (cached, gitignored). Then (about 6 minutes,
   most of it the cover step; WATER_RESUME=<the kept work folder> reruns steps 4-6 only):
     node .build/map/water_build.mjs && node .build/map/assemble.mjs
   test-map-water.mjs checks the files, known waters and land, and the label points.
   Re-run when a frame is added (the test fails until then). */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as topojson from "topojson-client";
import polylabel from "polylabel";
import { WATER_SRC } from "./water_fetch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MS = path.join(ROOT, "node_modules", ".bin", "mapshaper-xl");
export const WIDTH_MIN = 80, PIECE_MIN = 0.1, HOLE_MIN = 0.01, COVER_MIN = 0.3, WET_MIN = 0.25, DRY_MIN = 8, DRY_HOLE = 1;
export const LO_MIN = 5, LO_DRY_MIN = 100, LO_TOL = 500, LO_DRY_TOL = 600, HI_TOL = 25, DRY_TOL = 100;
// (WATER_RESUME=<a kept work folder>: steps 1-3 skipped, their files read from it)
const RESUME = process.env.WATER_RESUME || "";
const TMP = RESUME || fs.mkdtempSync(path.join(process.env.WATER_TMP || os.tmpdir(), "water-"));
const tmp = (f) => path.join(TMP, f);
const ms = (...args) => {
  const t0 = Date.now();
  execFileSync(MS, args.flat(), { stdio: ["ignore", "ignore", "inherit"], maxBuffer: 1 << 30 });
  console.log(`  mapshaper ${((Date.now() - t0) / 1000).toFixed(1)}s`);
};
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// every frame's seats as one outline (a frame is the key its geometry files carry)
const files = fs.readdirSync(path.join(ROOT, "map/data")).filter((f) => /^geo-.*-hi\.json$/.test(f)).sort();
const frames = [], merged = [], all = [];
for (const f of files) {
  const t = readJSON(path.join(ROOT, "map/data", f)), key = f.slice(4, -8);
  const feat = { type: "Feature", properties: { frame: key }, geometry: topojson.merge(t, t.objects.divs.geometries) };
  frames.push(key); all.push(feat);
  if (!t.handbook) merged.push(feat);
}
console.log(`frames: ${frames.join(" ")}`);
fs.writeFileSync(tmp("aec.geojson"), JSON.stringify({ type: "FeatureCollection", features: merged }));
fs.writeFileSync(tmp("frames.geojson"), JSON.stringify({ type: "FeatureCollection", features: all }));

// 0. the ABS's Water mesh blocks a lasting water confirms: a quarter of the block or more under
// one of Geoscience Australia's perennial lakes, reservoirs or perennial watercourse areas. The
// rest - the claypans and salt pans of the interior, the fringes of the salt lakes the ABS draws
// a little wider than GA's lakes - count as land (the dry lakes are drawn from GA's own outlines)
if (!RESUME) {
console.log("confirmed waters");
ms("-i", path.join(WATER_SRC, "abs-water-mb-2021.geojson"), "name=wmb", "-each", "target=wmb", "a0=this.area",
  "-i", path.join(WATER_SRC, "ga-lakes.geojson"), "name=pl", "-filter", "target=pl", "perenniality=='Perennial'",
  "-i", path.join(WATER_SRC, "ga-reservoirs.geojson"), "name=rs",
  "-i", path.join(WATER_SRC, "ga-watercourse-areas.geojson"), "name=wc", "-filter", "target=wc", "perenniality=='Perennial'",
  "-merge-layers", "target=pl,rs,wc", "force", "name=wet",
  "-dissolve", "target=wet",
  "-clip", "target=wmb", "wet", "+", "name=wmbc",
  "-each", "target=wmbc", "a1=this.area",
  "-filter-fields", "target=wmbc", "mb_code_2021,a0,a1",
  "-o", "target=wmbc", "format=csv", tmp("wmb-wet.csv"));
const confirmed = new Set(fs.readFileSync(tmp("wmb-wet.csv"), "utf8").trim().split("\n").slice(1).map((r) => r.split(",")).filter(([, a0, a1]) => +a1 / +a0 >= WET_MIN).map(([c]) => c.replace(/"/g, "")));
const wmbAll = readJSON(path.join(WATER_SRC, "abs-water-mb-2021.geojson"));
const wmbKept = wmbAll.features.filter((f) => confirmed.has(String(f.properties.mb_code_2021)));
console.log(`  ${wmbKept.length} of ${wmbAll.features.length} Water mesh blocks confirmed (${(wmbKept.reduce((s, f) => s + (f.properties.area_albers_sqkm || 0), 0)).toFixed(0)} of ${(wmbAll.features.reduce((s, f) => s + (f.properties.area_albers_sqkm || 0), 0)).toFixed(0)} km2)`);
fs.writeFileSync(tmp("wmb.geojson"), JSON.stringify({ type: "FeatureCollection", features: wmbKept }));
}

// 1. the water in the seats, and the seats' land beside it
if (!RESUME) {
console.log("water in the seats");
ms("-i", tmp("aec.geojson"), "name=aec",
  "-dissolve", "target=aec",
  "-i", path.join(WATER_SRC, "AUS_2021_AUST_SHP_GDA2020.zip"), "name=aus",
  "-i", tmp("wmb.geojson"), "name=wmb",
  "-i", path.join(WATER_SRC, "ga-lakes.geojson"), "name=lakes",
  "-filter", "target=lakes", "perenniality=='Non-perennial'",
  "-each", "target=lakes", "nm=name.trim(), area=this.area",
  "-filter-fields", "target=lakes", "nm,area",
  "-filter", "target=lakes", `area > ${DRY_MIN * 1e6}`, "+", "name=drawn",
  "-filter-slivers", "target=drawn", `min-area=${DRY_HOLE}km2`,
  "-o", "target=drawn", tmp("dry.geojson"), "precision=0.000001",
  "-erase", "target=aus", "wmb", "name=land0",
  // (a dry lake's islands stay land too, though the ABS counts some as water)
  "-drop", "holes", "target=lakes",
  "-merge-layers", "target=land0,lakes", "force", "name=land",
  "-dissolve", "target=land",
  "-erase", "target=aec", "land", "+", "name=water",
  "-clip", "target=aec", "land", "+", "name=aecland",
  "-explode", "target=water",
  "-filter", "target=water", `this.area > ${PIECE_MIN * 1e6}`,
  // (an islet under HOLE_MIN in a piece goes under its water, shore and all)
  "-filter-slivers", "target=water", `min-area=${HOLE_MIN}km2`,
  "-each", "target=water", "kind='w', wid=this.id, area=this.area, per=this.perimeter",
  "-each", "target=aecland", "kind='l'",
  "-filter-fields", "target=aecland", "kind",
  "-o", "target=water", tmp("water.geojson"), "precision=0.000001",
  "-o", "target=aecland", tmp("aecland.geojson"), "precision=0.000001");

// 2. each piece's outline split into shore (against the seats' land) and mouth (against nothing)
console.log("shore and mouth");
ms("-i", tmp("water.geojson"), tmp("aecland.geojson"), "combine-files", "snap",
  "-merge-layers", "force", "name=both",
  "-lines", "where=A.kind=='w' || (!!B && B.kind=='w')", "each=wid = A.kind=='w' ? A.wid : B.wid, shore = !!B && (A.kind != B.kind)",
  "-filter-fields", "wid,shore",
  "-o", tmp("edges.geojson"), "precision=0.000001");

// 3. how much of each piece each frame's seats cover
console.log("cover");
ms("-i", tmp("frames.geojson"), "name=frames", "-i", tmp("water.geojson"), "name=water",
  ...frames.flatMap((f, k) => [
    "-filter", "target=frames", `frame=='${f}'`, "+", `name=f${k}`,
    "-clip", "target=water", `f${k}`, "+", `name=c${k}`,
    "-each", `target=c${k}`, "a=this.area",
    "-filter-fields", `target=c${k}`, "wid,a",
    "-o", `target=c${k}`, "format=csv", tmp(`cover-${k}.csv`)]));
}

// 4. which pieces are water: wide enough, and covered by some frame
const W = readJSON(tmp("water.geojson")).features;
const by = new Map(W.map((f) => [f.properties.wid, { ...f.properties, f: 0, cover: {} }]));
frames.forEach((fr, k) => {
  const rows = fs.readFileSync(tmp(`cover-${k}.csv`), "utf8").trim().split("\n").slice(1);
  for (const r of rows) {
    const [wid, a] = r.split(",").map(Number), p = by.get(wid);
    if (!p || !(a > 0)) continue;
    p.cover[fr] = a / p.area;
    if (a / p.area >= COVER_MIN) p.f |= 1 << k;
  }
});
const kept = new Set();
for (const [wid, p] of by) {
  p.width = (2 * p.area) / Math.max(1, p.per);
  if (p.width >= WIDTH_MIN && p.f) kept.add(wid);
}
const keptArea = [...kept].reduce((s, w) => s + by.get(w).area, 0) / 1e6;
console.log(`pieces: ${by.size}, kept ${kept.size} (${keptArea.toFixed(0)} km2)`);
for (const [k, fr] of frames.entries()) {
  const ps = [...kept].filter((w) => by.get(w).f & (1 << k));
  console.log(`  ${fr.padEnd(7)} ${String(ps.length).padStart(5)} pieces ${(ps.reduce((s, w) => s + by.get(w).area, 0) / 1e6).toFixed(0).padStart(7)} km2`);
}
if (process.env.WATER_DEBUG) fs.writeFileSync(process.env.WATER_DEBUG, JSON.stringify([...by].map(([wid, p]) => ({ wid, ...p, kept: kept.has(wid) }))));

// 5. the files. water.json, loaded with the map: what the country and state views show,
// and the city files' bounds. water-<city>.json, fetched as a city view first needs it: all
// of it near that capital (each piece goes to the capital nearest the middle of its bounds)
const CAPS = { syd: [151.21, -33.87], mel: [144.96, -37.81], bne: [153.03, -27.47], per: [115.86, -31.95], adl: [138.6, -34.93], hob: [147.33, -42.88], cbr: [149.13, -35.28], drw: [130.84, -12.46] };
const CAP_I = Object.fromEntries(Object.keys(CAPS).map((c, k) => [c, k]));
const dist = ([x0, y0], [x1, y1]) => { const dx = (x1 - x0) * Math.cos(((y0 + y1) / 2) * rad), dy = y1 - y0; return dx * dx + dy * dy; };
const bboxOf = (g) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const walk = (c) => { if (typeof c[0] === "number") { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(walk); };
  walk(g.coordinates);
  return [x0, y0, x1, y1];
};
const capOf = (b) => Object.entries(CAPS).sort((p, q) => dist(p[1], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]) - dist(q[1], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]))[0][0];
const rad = Math.PI / 180;
for (const f of W) { const p = by.get(f.properties.wid); if (!f.geometry) { kept.delete(p.wid); continue; } p.bb = bboxOf(f.geometry); p.cap = capOf(p.bb); }
const D = readJSON(tmp("dry.geojson")).features.filter((f) => f.geometry);
D.forEach((f, k) => { f.properties.did = k; f.properties.bb = bboxOf(f.geometry); f.properties.cap = capOf(f.properties.bb); });
fs.writeFileSync(tmp("dry2.geojson"), JSON.stringify({ type: "FeatureCollection", features: D }));

// one topology of the chosen pieces (with their frames' bits), their shore and mouth lines,
// simplified to tol; and one of the chosen dry lakes (with their names), to dtol
function topo(ids, dids, tol, dtol, q) {
  const fOf = JSON.stringify(Object.fromEntries(ids.map((w) => [w, by.get(w).f]))), dSet = JSON.stringify(Object.fromEntries(dids.map((d) => [d, 1])));
  const cOf = Object.fromEntries(ids.map((w) => [w, CAP_I[by.get(w).cap]]));
  ms("-i", tmp("water.geojson"), tmp("edges.geojson"), "combine-files", "snap",
    "-rename-layers", "water,edges",
    "-each", "target=water,edges", `f = (${fOf})[wid] || 0, c = (${JSON.stringify(cOf)})[wid]`,
    "-filter", "target=water,edges", "f > 0",
    "-filter", "target=edges", "shore", "+", "name=shore",
    "-filter", "target=edges", "!shore", "name=mouth",
    "-simplify", `interval=${tol}`, "keep-shapes",
    "-o", "target=water,shore,mouth", "format=topojson", `quantization=${q}`, tmp("w.json"));
  ms("-i", tmp("dry2.geojson"), "name=dry",
    "-filter", `(${dSet})[did] === 1`,
    "-simplify", `interval=${dtol}`, "keep-shapes",
    "-o", "format=topojson", `quantization=${q}`, tmp("d.json"));
  const w = readJSON(tmp("w.json")), d = readJSON(tmp("d.json"));
  // (each piece and line keeps its frames' bits and its city; each dry lake its name and city)
  // (a feature the simplification emptied goes)
  for (const o of [...Object.values(w.objects), d.objects.dry]) o.geometries = o.geometries.filter((g) => g.type && g.arcs);
  for (const [k, o] of Object.entries(w.objects)) for (const g of o.geometries) { g.properties = { f: g.properties.f, c: g.properties.c }; delete g.id; }
  for (const g of d.objects.dry.geometries) { g.properties = { nm: g.properties.nm, c: CAP_I[g.properties.cap] }; delete g.id; }
  const pts = (t) => t.arcs.reduce((s, a) => s + a.length, 0);
  return { water: w, dry: d, pts: pts(w) + pts(d) };
}
const write = (file, body, pts) => {
  fs.writeFileSync(path.join(ROOT, "map/data", file), JSON.stringify(body));
  console.log(`${file.padEnd(16)} ${String(fs.statSync(path.join(ROOT, "map/data", file)).size).padStart(8)} bytes ${String(pts).padStart(7)} points; water ${body.water.objects.water.geometries.length}, dry ${body.dry.objects.dry.geometries.length}`);
};
const union = (bbs) => bbs.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])], [Infinity, Infinity, -Infinity, -Infinity]).map((v) => +v.toFixed(4));
const tiles = {};
for (const cap of Object.keys(CAPS)) {
  const ids = [...kept].filter((w) => by.get(w).cap === cap), dids = D.filter((f) => f.properties.cap === cap).map((f) => f.properties.did);
  if (!ids.length && !dids.length) continue;
  const t = topo(ids, dids, HI_TOL, DRY_TOL, 1000000);
  tiles[cap] = union([...ids.map((w) => by.get(w).bb), ...dids.map((k) => D[k].properties.bb)]);
  write(`water-${cap}.json`, { frames, cap, water: t.water, dry: t.dry }, t.pts);
}
// 6. a seat whose name stood on the water it is drawn across (its results' label point in one of
// its frame's pieces: Kingsford Smith in Botany Bay, Redcliffe in Moreton Bay) gets a point on
// its land instead: the pole of inaccessibility (polylabel, as geo_build.mjs anchors every seat)
// of the piece of its land, the water taken away, where most of its votes were cast - so
// Redcliffe's name goes to its peninsula, not to Moreton Island, the bigger piece it holds
// across the bay. The map moves the name there once water.json is in (applyWaterLabels)
console.log("label points");
const lps = {};
// (even-odd over every ring: mapshaper's GeoJSON winds its rings the other way to d3's)
const inside = (g, [x, y]) => {
  let c = false;
  for (const poly of g.type === "Polygon" ? [g.coordinates] : g.coordinates) for (const r of poly)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
};
const ringArea = (r, k) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * k * (r[j][1] + r[i][1]); return Math.abs(a / 2); };
const geoW = new Map(W.filter((f) => f.geometry && kept.has(f.properties.wid)).map((f) => [f.properties.wid, f]));
for (const [k, fr] of frames.entries()) {
  const resF = ["core", "res"].map((p) => path.join(ROOT, `map/data/${p}-${fr}.json`)).find((p) => fs.existsSync(p));
  if (!resF) continue;
  const res = readJSON(resF), mine = [...kept].filter((w) => by.get(w).f & (1 << k)).map((w) => geoW.get(w)).filter(Boolean);
  const wet = res.divs.filter((d) => d.lp && mine.some((f) => { const b = by.get(f.properties.wid).bb; return d.lp[0] >= b[0] && d.lp[0] <= b[2] && d.lp[1] >= b[1] && d.lp[1] <= b[3] && inside(f.geometry, d.lp); }));
  if (!wet.length) continue;
  const t = readJSON(path.join(ROOT, `map/data/geo-${fr}-hi.json`));
  const seats = wet.map((d) => ({ type: "Feature", properties: { n: d.n }, geometry: topojson.merge(t, t.objects.divs.geometries.filter((q) => q.properties.name === d.n)) }));
  fs.writeFileSync(tmp("lp-seats.geojson"), JSON.stringify({ type: "FeatureCollection", features: seats }));
  fs.writeFileSync(tmp("lp-water.geojson"), JSON.stringify({ type: "FeatureCollection", features: mine }));
  ms("-i", tmp("lp-seats.geojson"), "name=seats", "-i", tmp("lp-water.geojson"), "name=water",
    "-erase", "target=seats", "water", "-explode", "target=seats", "-o", "target=seats", tmp("lp-pieces.geojson"));
  // each piece's votes: its own seat's polling places, where the results place them
  const B = res.booths || {}, idx = new Map(res.divs.map((d, i) => [d.n, i])), votesAt = [];
  for (let j = 0; j < (B.d || []).length; j++) if (B.lat && B.lat[j] != null && B.lon[j] != null) {
    const v = B.v && B.v[j], n = Array.isArray(v) ? v.reduce((s, x) => s + (x || 0), 0) : +v || 0;
    votesAt.push([B.d[j], [B.lon[j], B.lat[j]], n]);
  }
  const pieces = readJSON(tmp("lp-pieces.geojson")).features.filter((f) => f.geometry);
  lps[fr] = {};
  for (const d of wet) {
    const i = idx.get(d.n), mineP = pieces.filter((f) => f.properties.n === d.n);
    if (!mineP.length) continue;
    const kx = Math.cos((d.lp[1] * Math.PI) / 180);
    const scored = mineP.map((f) => ({ f, v: votesAt.filter(([di, ll]) => di === i && inside(f.geometry, ll)).reduce((s, q) => s + q[2], 0), a: ringArea(f.geometry.coordinates[0], kx) }));
    scored.sort((p, q) => q.v - p.v || q.a - p.a);
    const pl = polylabel(scored[0].f.geometry.coordinates.map((r) => r.map(([x, y]) => [x * kx, y])), 1e-4);
    lps[fr][d.n] = [+(pl[0] / kx).toFixed(5), +pl[1].toFixed(5)];
  }
  console.log(`  ${fr.padEnd(7)} ${Object.keys(lps[fr]).join(", ")}`);
}
const lo = topo([...kept].filter((w) => by.get(w).area > LO_MIN * 1e6), D.filter((f) => f.properties.area > LO_DRY_MIN * 1e6).map((f) => f.properties.did), LO_TOL, LO_DRY_TOL, 100000);
write("water.json", { frames, caps: Object.keys(CAPS), tiles, lp: lps, water: lo.water, dry: lo.dry }, lo.pts);
if (process.env.WATER_DEBUG || RESUME) console.log("kept", TMP); else fs.rmSync(TMP, { recursive: true, force: true });
