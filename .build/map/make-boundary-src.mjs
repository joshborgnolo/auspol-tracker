// Derives the n-YYYY.geojson boundary sources geo_build.mjs builds the map's
// geometry from, for every election 2004-2025 (the 2004-2025 set used to live
// on one machine unrecorded; the rebuild for the island-floor change re-created
// it reproducibly). All sources are the their-agency boundary files:
//   1993-2001   use handbook_geo.mjs instead: original Handbook polygons.
//               The former ABS 2001 fallback displaced remote shared borders.
//   2004, 2007  MapInfo era sets kept in .matilda/seifa-irsad-abs/dl/aec-ced-eras/
//               (one MIF per state; converted by mif2geojson.mjs)
//   2010        national-esri-2010.zip (AEC's election-specific archive)
//   2013        national-esri-16122011.zip (includes post-2010 VIC/SA changes)
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
// 2004's QLD MIF carries a defect geo_build cannot see: Kennedy's upper
// meridian edge is a synthetic 258km line at a constant 138.0012E, ~460m east
// of the surveyed border Lingiari's ring carries (~137.996E, where the
// 2007-era file puts it too), so the two share no arcs and the map drew no
// NT/QLD border between the Gulf coast and -18.87. repairKennedy2004 below
// grafts Lingiari's surveyed meridian into Kennedy's ring.
// usage: node .build/map/make-boundary-src.mjs <stageDir> [--years=2004,2007]
//        (--years regenerates only those eras, incl. their dependencies:
//        2016 rides 2013 and its state zips — for a repair pass
//        after the big AEC downloads have been cleaned off the machine)
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import crypto from "node:crypto";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MS = process.env.MAPSHAPER || "mapshaper";
const MIF2 = REPO + "/.build/map/mif2geojson.mjs";
const ERAS = REPO + "/.matilda/seifa-irsad-abs/dl/aec-ced-eras";
const DATA = REPO + "/map/data";
const stage = process.argv[2];
if (!stage) throw new Error("usage: node make-boundary-src.mjs <stageDir> [--years=...]");
const dl = (f) => path.join(stage, "dl", f);
const onlyArg = process.argv.find((a) => a.startsWith("--years="));
const only = onlyArg ? new Set(onlyArg.slice("--years=".length).split(",").map(Number)) : null;
if (only?.has(2001)) throw new Error("2001 uses the lossless Handbook build: node .build/map/handbook_geo.mjs --years=2001 --fetch");
const need = (y) => !only || only.has(y);
fs.mkdirSync(path.join(stage, "x"), { recursive: true });

const key = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const resultNames = (y, st) => JSON.parse(fs.readFileSync(`${DATA}/res-${y}.json`, "utf8")).divs
  .filter((d) => !st || d.st === st).map((d) => d.n);

const ZIPS = {
  n2010: "national-esri-2010.zip",
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

// Graft Lingiari's surveyed meridian (and its border/coast junction vertex)
// into Kennedy's ring in place of the synthetic 138.0012E run — see the
// header. The anchors are the MIF's own coordinates; any of them missing
// means the source set changed and the repair must be re-probed, not guessed.
function repairKennedy2004(fc) {
  const findNamed = (n) => fc.features.find((f) => key(f.properties.name) === key(n));
  const rings = (g) => g.type === "Polygon" ? g.coordinates
    : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
  const idxNear = (ring, pt) => {
    let bi = -1, bd = 1e-6; // ~110m at this latitude; the anchors are exact MIF vertices
    ring.forEach((p, i) => { const d = (p[0] - pt[0]) ** 2 + (p[1] - pt[1]) ** 2; if (d < bd) { bd = d; bi = i; } });
    return bi;
  };
  const kennedy = findNamed("Kennedy"), lingiari = findNamed("Lingiari");
  if (!kennedy || !lingiari) throw new Error("2004 repair: Kennedy/Lingiari not in the set");
  const KA = [138.00118, -16.546509];  // Kennedy's last true coast vertex
  const KB = [137.996616, -18.868219]; // Kennedy meridian vertex to keep
  const LJ = [137.996232, -16.540101]; // Lingiari's border/coast junction
  const kr = rings(kennedy.geometry).find((r) => idxNear(r, KA) >= 0 && idxNear(r, KB) >= 0);
  const lr = rings(lingiari.geometry).find((r) => idxNear(r, LJ) >= 0 && r.some((p) => p[0] > 137.9 && p[0] < 138.01 && p[1] <= -25.9));
  if (!kr || !lr) throw new Error("2004 repair: the MIF geometry no longer matches the diagnosed defect; re-probe");
  const ia = idxNear(kr, KA), ib = idxNear(kr, KB);
  if (!(ia < ib) || ib - ia < 10 || ib - ia > 200) throw new Error(`2004 repair: unexpected Kennedy anchors ${ia}..${ib}`);
  // the stretch between must be exactly the synthetic vertical run and
  // nothing else — a real boundary vertex must never be dropped
  for (let i = ia + 1; i < ib; i++) {
    if (Math.abs(kr[i][0] - 138.00118) > 5e-5) throw new Error(`2004 repair: Kennedy vertex ${i} off the synthetic line (${kr[i]}); re-probe`);
  }
  const ij = idxNear(lr, LJ);
  let ie = ij;
  while (ie > 0 && lr[ie][1] > KB[1]) ie--; // first Lingiari vertex at/below KB's latitude
  const spliced = [[...lr[ij]]];
  for (let i = ij - 1; i > ie; i--) spliced.push([...lr[i]]);
  const newRing = [...kr.slice(0, ia + 1), ...spliced, ...kr.slice(ib)];
  const polys = kennedy.geometry.type === "Polygon" ? [kennedy.geometry.coordinates] : kennedy.geometry.coordinates;
  const poly = polys.find((p) => p.includes(kr));
  if (!poly) throw new Error("2004 repair: Kennedy ring not found within its own geometry");
  poly[poly.indexOf(kr)] = newRing;
  const km = (a, b) => Math.hypot((b[0] - a[0]) * 111.32 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180), (b[1] - a[1]) * 111.32);
  let dropKm = 0;
  for (let i = ia; i < ib; i++) dropKm += km(kr[i], kr[i + 1]);
  let graftKm = 0;
  for (let i = ia; i < ia + spliced.length + 1; i++) graftKm += km(newRing[i], newRing[i + 1]);
  console.log(`2004 repair: dropped Kennedy's synthetic ${ib - ia - 1}-vertex ${dropKm.toFixed(0)}km run; grafted Lingiari's meridian (${spliced.length} vertices, ${graftKm.toFixed(0)}km) between ${KA} and ${KB}`);
}

const r = {};
if (need(2010)) {
  const file = dl(ZIPS.n2010);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (sha !== 'eecefadcfe7d2eab56af53768918573b8ef691f68f7bfc9bd8b10eae0c834c52') throw new Error('AEC 2010 archive changed; re-audit its election vintage');
  r[2010] = reduce(shpToFc(unzip(file), "n2010"), 2010);
}
if (need(2013) || need(2016)) r[2013] = reduce(shpToFc(unzip(dl(ZIPS.n16122011)), "n16122011"), 2013);
if (need(2004)) {
  r[2004] = reduce(mifsToFc("2004", "mif2004"), 2004);
  repairKennedy2004(r[2004].fc);
}
if (need(2007)) r[2007] = reduce(mifsToFc("2007", "mif2007"), 2007);
if (need(2019)) r[2019] = reduce(shpToFc(unzip(dl(ZIPS.fe2019)), "fe2019"), 2019);
if (need(2022)) r[2022] = reduce(shpToFc(unzip(dl(ZIPS.cwlth2021)), "cwlth2021"), 2022);
if (need(2025)) r[2025] = reduce(shpToFc(unzip(dl(ZIPS.fe2025)), "fe2025"), 2025);

// 2016: the 2013 national set minus NSW/WA/ACT, plus that year's state files
if (need(2016)) {
  if (!r[2013].stateCol) throw new Error("the 2013 national set has no state column; cannot split it for 2016");
  const kept = r[2013].fc.features.filter((f) => !["NSW", "WA", "ACT"].includes(f.properties.st));
  const st16 = [];
  for (const [tag, zip, st] of [["nsw2016", ZIPS.nsw2016, "NSW"], ["wa2016", ZIPS.wa2016, "WA"], ["act2016", ZIPS.act2016, "ACT"]]) {
    const r16 = reduce(shpToFc(unzip(dl(zip)), tag), 2016, st);
    st16.push(...r16.fc.features);
  }
  r[2016] = { fc: { type: "FeatureCollection", features: [...kept, ...st16] }, stateCol: null };
}

for (const y of [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) if (r[y] && need(y)) write(r[y].fc, y, r[y].stateCol);
console.log("boundary sources written to", stage);
