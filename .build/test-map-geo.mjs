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
   Run after any geometry rebuild: node .build/test-map-geo.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as topojson from "topojson-client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];

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
console.log("PASS: map geometry – per-level island floor, Craggy Island restored at hi 2007+ in Bass, low-zoom floor untouched, division sets exact");
