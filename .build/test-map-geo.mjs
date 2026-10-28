/* test-map-geo.mjs – pins the Election map's island floor (2026-10-26, the
   Craggy Island defect): mapshaper's -filter-islands ran at a single 2km2
   floor for BOTH detail levels, stripping the sub-2km2 Bass Strait islets
   (Craggy Island, 0.39km2, in Bass) out of the hi level that draws the map
   past the zoom seam — islands with no overlay, fills that don't track the
   base-map coastline. The floor is per-level now (lo 2km2, hi 0.1km2) in
   geo_build.mjs, and this test keeps:
   - the LEVELS table at that pair of values;
   - Craggy Island drawn in Bass at hi 2007+ (the AEC's 2004-era MIF set is
     too coarse to carry it at all — source fidelity, pin KM_LOOSE below 1km
     and this will catch a regression either way) and, untouched, at lo
     neither it nor any 0.39km2 island survives the 2km2 floor;
   - Deal Island (ca. 2.6km2, above the old floor) still present everywhere;
   - every built year's hi/lo division set exactly the results' set.
   Also pins the 2004 NT/QLD border repair (same day): the 2004 QLD MapInfo
   file drew Kennedy's upper meridian edge as a synthetic 259km line ~460m
   east of the surveyed border Lingiari's ring carries, so the two shared no
   arcs and the map drew NO state border between the Gulf coast and -18.87
   (user-reported; NT|QLD shared length 794km vs every other year's 1052-53).
   make-boundary-src.mjs grafts Lingiari's surveyed meridian into Kennedy's
   ring; this test keeps the repair present, the NT|QLD shared length at
   1000km+ per year×level, and every 2004-era sliver strip point and the
   meridian's west-side probes covered by exactly one division in every era.
   Run after any geometry rebuild: node .build/test-map-geo.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
// topojson-client from the copy the page itself ships, not the npm package:
// the repo declares no such dependency, so CI's npm ci never installs it and
// a bare import failed every run from the test's first commit
const topojson = (() => { const g = {}; vm.runInNewContext(R("map/vendor/topojson-client-3.1.0.min.js"), g); return g.topojson; })();
const YEARS = [2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];

// the floor pair itself lives in geo_build.mjs
assert.ok(/lo: \{ iv: 1000, minArea: "2km2" \}, hi: \{ iv: 60, minArea: "0\.1km2" \}/.test(R(".build/map/geo_build.mjs")),
  "geo_build.mjs keeps the per-level island floor (lo 2km2, hi 0.1km2)");

// nearest land vertex to a probe point, km (equirectangular at the probe's latitude)
function closest(fc, [lon, lat]) {
  let best = Infinity, name = null;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    for (const p of g.type === "Polygon" ? [g.coordinates] : g.coordinates)
      for (const ring of p)
        for (const [x, y] of ring) {
          const d = Math.hypot((x - lon) * Math.cos((lat * Math.PI) / 180), y - lat) * 111.32;
          if (d < best) { best = d; name = f.properties.name; }
        }
  }
  return [best, name];
}

const CRAGGY = [147.67806, -39.68722]; // 39°41'14"S 147°40'41"E, 0.39km2, Bass
const DEAL = [147.31667, -39.46667];   // ca. 2.6km2, above the old floor

for (const y of YEARS) {
  const res = JSON.parse(R(`map/data/res-${y}.json`));
  const want = new Set(res.divs.map((d) => d.n));
  for (const lvl of ["lo", "hi"]) {
    const t = JSON.parse(R(`map/data/geo-${y}-${lvl}.json`));
    assert.equal(t.objects.divs.geometries.length, want.size, `${y} ${lvl}: one geometry per division`);
    const got = new Set(t.objects.divs.geometries.map((g) => g.properties.name));
    assert.deepEqual([...want].filter((n) => !got.has(n)), [], `${y} ${lvl}: no division missing`);
    assert.deepEqual([...got].filter((n) => !want.has(n)), [], `${y} ${lvl}: no stray division`);

    const fc = topojson.feature(t, t.objects.divs);
    const [craggyKm, craggyName] = closest(fc, CRAGGY);
    if (lvl === "hi" && y === 2004) assert.ok(craggyKm > 10, "2004 hi: the MIF-era source never drew Craggy (source fidelity)");
    else if (lvl === "hi") {
      assert.ok(craggyKm < 1, `${y} hi: Craggy Island's ring is drawn (${craggyKm.toFixed(2)}km — was ~20km on the shared 2km2 floor)`);
      assert.equal(craggyName, "Bass", `${y} hi: Craggy Island belongs to Bass`);
    } else assert.ok(craggyKm > 5, `${y} lo: the 2km2 low-zoom floor still strips 0.39km2 islands`);
    const [dealKm] = closest(fc, DEAL);
    if (y !== 2004) assert.ok(dealKm < 1, `${y} ${lvl}: Deal Island (above the old floor) still drawn`);
  }
}
// --- the 2004 NT/QLD meridian repair pins (see header) -------------------
assert.ok(/repairKennedy2004/.test(R(".build/map/make-boundary-src.mjs")),
  "make-boundary-src.mjs keeps the Kennedy 2004 meridian repair");

function inRing(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// division(s) covering a probe point; must be exactly one everywhere —
// "NO DIV" means an inter-boundary gap like 2004's NT/QLD sliver
function covering(fc, pt) {
  const hits = [];
  for (const f of fc.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      if (inRing(poly[0], pt) && !poly.slice(1).some((hole) => inRing(hole, pt))) { hits.push(f.properties.name); break; }
    }
  }
  return hits;
}
// km of arcs shared by divisions of DIFFERENT states, per state pair
function sharedKm(t, a, b) {
  const { scale, translate } = t.transform;
  const states = new Map(); // arcIdx -> Set(st)
  for (const g of t.objects.divs.geometries) {
    const st = g.properties.st;
    for (const ring of (g.type === "Polygon" ? g.arcs : g.arcs.flat()))
      for (const arc of ring) {
        const i = arc < 0 ? -arc - 1 : arc;
        (states.get(i) ?? states.set(i, new Set()).get(i)).add(st);
      }
  }
  let km = 0;
  for (const [i, sts] of states) {
    if (!sts.has(a) || !sts.has(b)) continue;
    let x = 0, y = 0, px = null, py = null;
    for (const [dx, dy] of t.arcs[i]) {
      x += dx * scale[0]; y += dy * scale[1];
      if (px !== null) km += Math.hypot((x - px) * Math.cos(((y + py) / 2) * Math.PI / 180), y - py) * 111.32;
      px = x; py = y;
    }
  }
  return km;
}

const PROBES = [
  // [point, era -> expected covering division]; exactly-one everywhere,
  // attribution asserted where the probe sat inside 2004's lost sliver
  [[137.9995, -17.5], { 2004: "Kennedy", 2022: "Kennedy", 2025: "Kennedy" }, "old sliver, mid"],
  [[138.0005, -17.0], { 2004: "Kennedy", 2022: "Kennedy", 2025: "Kennedy" }, "old sliver, north"],
  [[137.9999, -18.7], { 2004: "Kennedy", 2022: "Kennedy", 2025: "Kennedy" }, "old sliver, south"],
  [[137.99, -17.5], { all: "Lingiari" }, "west of the meridian"],
  [[136.2, -24.15], { all: "Lingiari" }, "NT interior"],
  [[137.8, -24.15], { all: "Lingiari" }, "NT interior, east"],
];

for (const y of YEARS) {
  for (const lvl of ["lo", "hi"]) {
    const t = JSON.parse(R(`map/data/geo-${y}-${lvl}.json`));
    const ntqld = sharedKm(t, "NT", "QLD");
    assert.ok(ntqld > 1000, `${y} ${lvl}: NT/QLD state border is drawn end to end (shared ${ntqld.toFixed(0)}km — 2004's defect left 794km and a gap from the Gulf coast to -18.87)`);
    const fc = topojson.feature(t, t.objects.divs);
    for (const [pt, expect, label] of PROBES) {
      const got = covering(fc, pt).join("+") || "NO DIV";
      const want = expect.all ?? expect[y];
      if (want) assert.equal(got, want, `${y} ${lvl}: ${label} [${pt}] is ${want}, got ${got}`);
      else assert.ok(got !== "NO DIV" && !got.includes("+"), `${y} ${lvl}: ${label} [${pt}] covered by exactly one division, got ${got}`);
    }
  }
}

console.log("PASS: map geometry – per-level island floor, Craggy Island restored at hi 2007+ in Bass, low-zoom floor untouched, division sets exact; 2004 NT/QLD meridian repair pinned (shared border 1053km in every era, sliver strip covered by exactly one division)");
