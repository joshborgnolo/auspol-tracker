// Derives the n-YYYY.geojson boundary sources geo_build.mjs builds the map's
// geometry from, for every election 2004-2025 (the set used to live on one
// machine unrecorded; the rebuild for the island-floor change re-created it
// reproducibly). All sources are the AEC's own boundary files:
//   2004, 2007  MapInfo era sets kept in .matilda/seifa-irsad-abs/dl/aec-ced-eras/
//               (one MIF per state; converted by mif2geojson.mjs)
//   2010, 2013  national-esri-16122011.zip   (24.6MB, AEC GIS downloads page)
//   2016        the 2013 national set with NSW, WA and ACT swapped for that
//               year's state files (nsw-esri-06042016, wa-esri-19012016,
//               act-esri-28012016) — the recipe geo_build.mjs's header records
//   2019        national-esri-fe2019.zip
//   2022        2021-Cwlth_electoral_boundaries_ESRI.zip
//   2025        AUS-March-2025-esri.zip
// The downloads live at aec.gov.au/Electorates/gis/gis_datadownload.htm; fetch
// them into <stageDir>/dl first. Every output feature carries only the
// division name as `name`; the output set is gated on exact name equality
// (case/punctuation-insensitive) with that year's map/data/data-YYYY.json
// results, the same join geo_build re-checks. Needs mapshaper on PATH (or
// MAPSHAPER) for the ESRI sources.
// usage: node .build/map/make-boundary-src.mjs <stageDir>
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MS = process.env.MAPSHAPER || "mapshaper";
const MIF2 = REPO + "/.build/map/mif2geojson.mjs";
const ERAS = REPO + "/.matilda/seifa-irsad-abs/dl/aec-ced-eras";
const DATA = REPO + "/map/data";
const stage = process.argv[2];
if (!stage) throw new Error("usage: node make-boundary-src.mjs <stageDir>");
const dl = (f) => path.join(stage, "dl", f);

const key = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const resultNames = (y, st) => JSON.parse(fs.readFileSync(`${DATA}/data-${y}.json`, "utf8")).divs
  .filter((d) => !st || d.st === st).map((d) => d.n);

const ZIPS = {
  n16122011: "national-esri-16122011.zip",
  nsw2016: "nsw-esri-06042016.zip",
  wa2016: "wa-esri-19012016.zip",
  act2016: "act-esri-28012016.zip",
  fe2019: "national-esri-fe2019.zip",
  cwlth2021: "2021-Cwlth_electoral_boundaries_ESRI.zip",
  fe2025: "AUS-March-2025-esri.zip",
};

function unzip(zip) {
  const d = path.join(stage, "x", path.basename(zip, ".zip"));
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
    execFileSync("unzip", ["-oq", zip, "-d", d]);
  }
  let shp = [];
  (function walk(p) { for (const f of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, f.name); if (f.isDirectory()) walk(q); else if (/\.shp$/i.test(f.name)) shp.push(q); } })(d);
  // the 2016 state zips also carry the SA1 statistical layers
  if (shp.length > 1) shp = shp.filter((s) => !/SA1/i.test(path.basename(s)));
  if (shp.length !== 1) throw new Error(`${zip}: expected one .shp, found ${shp.length}`);
  return shp[0];
}

function shpToFc(shp, tag) {
  const out = path.join(stage, "x", `${tag}.geojson`);
  execFileSync(MS, ["-i", shp, "-o", out, "format=geojson"]);
  return JSON.parse(fs.readFileSync(out, "utf8"));
}

function mifsToFc(yearDir, tag) {
  const dir = path.join(ERAS, yearDir);
  const mifs = fs.readdirSync(dir).filter((f) => /\.mif$/i.test(f)).sort().map((f) => path.join(dir, f));
  const out = path.join(stage, "x", `${tag}.geojson`);
  execFileSync(process.execPath, [MIF2, out, ...mifs]);
  return JSON.parse(fs.readFileSync(out, "utf8"));
}

// the property column most like the year's division names, and a state column
// if the file carries one (used to split the 2013 national set for 2016)
function columns(fc, year, st) {
  const names = resultNames(year, st);
  const want = new Set(names.map(key));
  const keys = Object.keys(fc.features[0].properties);
  let bestName = null, best = -1;
  for (const c of keys) {
    const s = fc.features.filter((f) => want.has(key(String(f.properties[c] ?? "")))).length;
    if (s > best) { best = s; bestName = c; }
  }
  if (bestName == null || best < names.length - 2) {
    const sets = keys.map((c) => `${c} (${fc.features.filter((f) => want.has(key(String(f.properties[c] ?? "")))).length})`).join(", ");
    throw new Error(`year ${year}: no name column reaches the results (${sets}); need ${names.length}`);
  }
  let stateCol = null;
  for (const c of keys) {
    const vals = new Set(fc.features.map((f) => String(f.properties[c] ?? "").toUpperCase()));
    const flat = [...vals].join("").replace(/[^A-Z]/g, "");
    if (vals.size >= 6 && vals.size <= 9 && /^(NSW|VIC|QLD|SA|WA|TAS|ACT|NT|AUSTRALIA)+$/.test(flat)) stateCol = c;
  }
  return { nameCol: bestName, stateCol };
}

function reduce(fc, year, st) {
  const { nameCol, stateCol } = columns(fc, year, st);
  const feats = fc.features.map((f) => {
    const p = { name: String(f.properties[nameCol]).trim() };
    if (stateCol) p.st = String(f.properties[stateCol]).toUpperCase();
    return { type: "Feature", properties: p, geometry: f.geometry };
  });
  return { fc: { type: "FeatureCollection", features: feats }, stateCol };
}

function write(fc, year, stateCol) {
  // gate: the same name-set equality geo_build.mjs enforces downstream
  const want = new Map(resultNames(year).map((n) => [key(n), n]));
  const got = new Set(fc.features.map((f) => key(f.properties.name)));
  const missing = [...want.values()].filter((n) => !got.has(key(n)));
  const extra = [...got].filter((k) => !want.has(k));
  if (missing.length || extra.length) {
    const miss = missing.map((n) => "-" + n).join(" ");
    const ex = extra.map((k) => "+" + k).join(" ");
    throw new Error(`n-${year}: name join fails — missing: ${miss || "none"}; extra: ${ex || "none"}`);
  }
  fs.writeFileSync(path.join(stage, `n-${year}.geojson`), JSON.stringify(fc));
  console.log(`n-${year}.geojson`, fc.features.length, "divisions" + (stateCol ? ` (state column ${stateCol})` : ""));
}

const r = {};
r[2010] = reduce(shpToFc(unzip(dl(ZIPS.n16122011)), "n16122011"), 2010);
r[2004] = reduce(mifsToFc("2004", "mif2004"), 2004);
r[2007] = reduce(mifsToFc("2007", "mif2007"), 2007);
r[2019] = reduce(shpToFc(unzip(dl(ZIPS.fe2019)), "fe2019"), 2019);
r[2022] = reduce(shpToFc(unzip(dl(ZIPS.cwlth2021)), "cwlth2021"), 2022);
r[2025] = reduce(shpToFc(unzip(dl(ZIPS.fe2025)), "fe2025"), 2025);

// 2013: the same national file as 2010 (the comment's recipe)
r[2013] = { fc: r[2010].fc, stateCol: r[2010].stateCol };

// 2016: the 2013 national set minus NSW/WA/ACT, plus that year's state files
if (!r[2013].stateCol) throw new Error("the 2013 national set has no state column; cannot split it for 2016");
const kept = r[2013].fc.features.filter((f) => !["NSW", "WA", "ACT"].includes(f.properties.st));
const st16 = [];
for (const [tag, zip, st] of [["nsw2016", ZIPS.nsw2016, "NSW"], ["wa2016", ZIPS.wa2016, "WA"], ["act2016", ZIPS.act2016, "ACT"]]) {
  const r16 = reduce(shpToFc(unzip(dl(zip)), tag), 2016, st);
  st16.push(...r16.fc.features);
}
r[2016] = { fc: { type: "FeatureCollection", features: [...kept, ...st16] }, stateCol: null };

for (const y of [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) write(r[y].fc, y, r[y].stateCol);
console.log("all boundary sources written to", stage);
