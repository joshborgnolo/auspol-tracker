// Boundaries + label anchors for every election the page loads.
// (The islands that frame leaves out - Norfolk, Lord Howe, Christmas, Cocos -
// are drawn in inset boxes from map/data/islands.json, islands_build.mjs.)
//  1. mapshaper: clip to the mainland frame, simplify to two absolute
//     tolerances (lo for the country, hi once zoomed past a state), drop
//     specks, write TopoJSON (object "divs", properties name, st). The
//     island floor is per-level: lo keeps only islands of minArea or
//     larger (they are sub-pixel at country zoom), hi keeps every real
//     island down to a tenth of a square kilometre — a shared 2km2 cut
//     had stripped Bass Strait's islets (Craggy Island, in Bass) out of
//     the map at every zoom. (Smaller specks the AEC never draws at all —
//     Rodondo south of Wilsons Prom — stay absent: source fidelity, not
//     the filter);
//  2. names joined to the results' division names exactly (the gate: the
//     two sets must be equal), the state attached from the results;
//  3. a label anchor per division (polylabel of its largest part, in
//     projected space) written into the result file as lp.
// The boundaries are the AEC's own files for each election, kept out of the
// repo for their size (about 500MB): 2004 and 2007 from the MapInfo eras in
// .matilda/seifa-irsad-abs/dl/aec-ced-eras (mif2geojson.mjs), 2010
// (national-esri-2010), 2013 (national-esri-16122011), 2019, 2022 and 2025 from the national files at
// aec.gov.au/electorates/gis, and 2016 as the 2013 file with that year's
// NSW, WA and ACT files swapped in; each reduced to a name per feature as
// n-YYYY.geojson. From the 2017 redistribution the AEC draws Queensland's
// coastal seats out to sea (Leichhardt's west edge a straight line down the
// Gulf, Dawson and Capricornia far onto the reef), so in SEA_YEARS the
// Queensland seats are clipped to the land of the 2013 file (one national
// file, so no slivers between states, and the same Queensland coast as
// 2004-16); the other states' coasts already match and stay as drawn. Needs mapshaper on PATH (or MAPSHAPER) and the npm
// packages topojson-client, d3 and polylabel.
// usage: node .build/map/geo_build.mjs <srcDir with n-YYYY.geojson> <dataDir with data-YYYY.json> map/data
//        [--years=sa26] to run a non-federal set (the SA 2026 state map:
//        n-sa26.geojson + data-sa26.json; 2013 land dissolve skipped)
import fs from "fs";
import { execFileSync } from "child_process";
import * as topojson from "topojson-client";
import * as d3 from "d3";
import polylabel from "polylabel";

const [, , srcDir, dataDir, outDir, ...rest] = process.argv;
const MS = process.env.MAPSHAPER || "mapshaper";
const flag = rest.find((a) => a.startsWith("--years="));
const YEARS = flag ? flag.slice("--years=".length).split(",") : [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
if (YEARS.some(y=>Number(y)<=2001)) throw new Error('1993–2001 use handbook_geo.mjs; do not simplify or overwrite the original Handbook geometry');
const LEVELS = { lo: { iv: 1000, minArea: "2km2" }, hi: { iv: 60, minArea: "0.1km2" } };
const SEA_YEARS = new Set([2019, 2022, 2025]);
const key = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

const land = `${outDir}/tmp-land.json`;
const needsLand = YEARS.some((y) => SEA_YEARS.has(Number(y)));
if (needsLand) execFileSync(MS, ["-i", `${srcDir}/n-2013.geojson`, "snap-interval=0.00002", "-clean", "-dissolve", "-clean", "gap-fill-area=100km2", "-o", land, "format=geojson"], { stdio: ["ignore", "ignore", "pipe"] });

for (const y of YEARS) {
  const data = JSON.parse(fs.readFileSync(`${dataDir}/data-${y}.json`, "utf8"));
  const byKey = new Map(data.divs.map((d) => [key(d.n), d]));
  const qld = JSON.stringify(data.divs.filter((d) => d.st === "QLD").map((d) => key(d.n)));
  const toLand = SEA_YEARS.has(Number(y)) ? ["-each", `q=${qld}.indexOf(name.toLowerCase().replace(/[^a-z]/g, "")) > -1`, "-split", "q",
    "-clip", land, "target=true", "-merge-layers", "target=*", "force", "name=divs", "-drop", "fields=q"] : [];
  let topoLo = null;
  for (const [lvl, lv] of Object.entries(LEVELS)) {
    const tmp = `${outDir}/tmp-${y}-${lvl}.json`;
    execFileSync(MS, ["-i", `${srcDir}/n-${y}.geojson`, "name=divs", "snap-interval=0.00002", "-clean", "gap-fill-area=0.5km2", ...toLand, "-clip", "bbox=112,-44.5,154.5,-9",
      "-simplify", "weighted", `interval=${lv.iv}`, "keep-shapes", "-filter-islands", `min-area=${lv.minArea}`, "remove-empty",
      "-rename-layers", "divs", "-o", tmp, "format=topojson", "quantization=100000"], { stdio: ["ignore", "ignore", "pipe"] });
    const topo = JSON.parse(fs.readFileSync(tmp, "utf8"));
    fs.unlinkSync(tmp);
    const geoms = topo.objects.divs.geometries;
    const seen = new Set();
    for (const g of geoms) {
      const d = byKey.get(key(g.properties.name));
      if (!d) throw new Error(`${y} ${lvl}: boundary "${g.properties.name}" has no result`);
      if (seen.has(d.n)) throw new Error(`${y} ${lvl}: two boundaries for ${d.n}`);
      seen.add(d.n);
      g.properties = { name: d.n, st: d.st };
    }
    const missing = data.divs.filter((d) => !seen.has(d.n)).map((d) => d.n);
    if (missing.length) throw new Error(`${y} ${lvl}: no boundary for ${missing.join(", ")}`);
    fs.writeFileSync(`${outDir}/geo-${y}-${lvl}.json`, JSON.stringify(topo));
    if (lvl === "lo") topoLo = topo;
  }
  // label anchors
  const fc = topojson.feature(topoLo, topoLo.objects.divs);
  const proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], fc);
  const path = d3.geoPath(proj);
  const lp = {};
  for (const f of fc.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let best = null, bestA = -1;
    for (const p of polys) { const a = path.area({ type: "Polygon", coordinates: p }); if (a > bestA) { bestA = a; best = p; } }
    const projected = best.map((ring) => ring.map((pt) => proj(pt)));
    const p = polylabel(projected, 0.5);
    const ll = proj.invert(p);
    lp[f.properties.name] = [Math.round(ll[0] * 1e4) / 1e4, Math.round(ll[1] * 1e4) / 1e4];
  }
  for (const d of data.divs) d.lp = lp[d.n];
  if (Number(y) === 2010) data.boundarySource = 'AEC national-esri-2010.zip: boundaries for the 21 August 2010 election. The later VIC (24 December 2010) and SA (16 December 2011) determinations apply from 2013.';
  fs.writeFileSync(`${outDir}/res-${y}.json`, JSON.stringify(data));
  const sz = (f) => fs.statSync(`${outDir}/${f}`).size;
  console.log(y, "lo", sz(`geo-${y}-lo.json`), "hi", sz(`geo-${y}-hi.json`), "res", sz(`res-${y}.json`));
}
if (needsLand) fs.unlinkSync(land);
