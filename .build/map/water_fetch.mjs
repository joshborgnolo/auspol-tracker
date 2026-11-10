/* water_fetch.mjs – the sources of map/data/water*.json (water_build.mjs), cached.

   Three open datasets, none committed (the cache is gitignored):
     AUS_2021_AUST_SHP_GDA2020.zip  the ABS's Australia (ASGS 2021, CC BY 4.0): its land and
                                    the inland waters its mesh blocks cover, with the open
                                    harbours, bays and estuaries left out. Downloaded once.
     abs-water-mb-2021.geojson      the ABS's 4,412 mesh blocks of category "Water" (lakes,
                                    reservoirs, the river reaches and lagoons the ASGS covers),
                                    from the ABS's own ASGS 2021 map service.
     ga-lakes.geojson               Geoscience Australia's topographic lakes (the 1:5M-1:300k
                                    layer of its Australian Topographic Base Map, CC BY 4.0),
                                    each with its name and perenniality: the salt lakes of the
                                    interior are "Non-perennial", dry most years.
     ga-reservoirs.geojson          its reservoirs (1:250k), and
     ga-watercourse-areas.geojson   its watercourse areas (1:250k, the wide reaches of rivers,
                                    each with its perenniality): with the perennial lakes, what
                                    tells a lasting water from a claypan the ABS also counts as
                                    "Water" (water_build.mjs keeps only the Water mesh blocks
                                    these confirm).
   Run, then node .build/map/water_build.mjs:
     node .build/map/water_fetch.mjs            (only what is missing)
     node .build/map/water_fetch.mjs --force    (all of it again) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WATER_SRC = process.env.WATER_SRC || path.join(path.resolve(ROOT, process.env.WATER_SRC_ROOT || "."), ".build/analysis/seat-model/cache/water");
const FORCE = process.argv.includes("--force");
const UA = { "User-Agent": "Mozilla/5.0 (auspol-tracker map build)" };

const ABS_AUS = "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files/AUS_2021_AUST_SHP_GDA2020.zip";
const ABS_MB = "https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/MB/MapServer/0/query";
const GA_LAKES = "https://services.ga.gov.au/gis/rest/services/Topographic_Base_Map/MapServer/470/query";
const GA_RESERVOIRS = "https://services.ga.gov.au/gis/rest/services/Topographic_Base_Map/MapServer/468/query";
const GA_WATERCOURSE_AREAS = "https://services.ga.gov.au/gis/rest/services/Topographic_Base_Map/MapServer/474/query";

async function get(url, tries = 4) {
  for (let k = 1; ; k++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (k >= tries) throw new Error(`${url.slice(0, 120)}: ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 1500 * k));
    }
  }
}
// an ArcGIS layer's features as one GeoJSON collection, a page at a time
async function layer(base, where, fields, page = 500) {
  const feats = [];
  for (let off = 0; ; off += page) {
    const q = new URLSearchParams({ where, outFields: fields, outSR: "4326", f: "geojson", orderByFields: "objectid", resultOffset: String(off), resultRecordCount: String(page), returnGeometry: "true" });
    const j = await (await get(`${base}?${q}`)).json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    feats.push(...j.features);
    process.stdout.write(`\r  ${feats.length} features`);
    if (j.features.length < page && !j.exceededTransferLimit) break;
  }
  process.stdout.write("\n");
  return { type: "FeatureCollection", features: feats };
}
const want = (f) => FORCE || !fs.existsSync(path.join(WATER_SRC, f));
const save = (f, body) => { fs.writeFileSync(path.join(WATER_SRC, f), body); console.log(f, body.length, "bytes"); };

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "")) {
  fs.mkdirSync(WATER_SRC, { recursive: true });
  if (want("AUS_2021_AUST_SHP_GDA2020.zip")) { console.log("ABS Australia"); save("AUS_2021_AUST_SHP_GDA2020.zip", Buffer.from(await (await get(ABS_AUS)).arrayBuffer())); }
  if (want("abs-water-mb-2021.geojson")) {
    console.log("ABS water mesh blocks");
    save("abs-water-mb-2021.geojson", JSON.stringify(await layer(ABS_MB, "mb_category_2021='Water'", "mb_code_2021,area_albers_sqkm,sa2_name_2021,state_code_2021", 250)));
  }
  if (want("ga-lakes.geojson")) {
    console.log("GA lakes");
    save("ga-lakes.geojson", JSON.stringify(await layer(GA_LAKES, "1=1", "objectid,name,perenniality,featuretype", 250)));
  }
  if (want("ga-reservoirs.geojson")) {
    console.log("GA reservoirs");
    save("ga-reservoirs.geojson", JSON.stringify(await layer(GA_RESERVOIRS, "1=1", "objectid,name,type", 250)));
  }
  if (want("ga-watercourse-areas.geojson")) {
    console.log("GA watercourse areas");
    save("ga-watercourse-areas.geojson", JSON.stringify(await layer(GA_WATERCOURSE_AREAS, "1=1", "objectid,name,perenniality,hierarchy", 250)));
  }
}
