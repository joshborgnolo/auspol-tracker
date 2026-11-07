/* test-map-areas.mjs – pins the /maps/ Areas drawing's census pack and wiring.

   - the pack (maps/data/areas-sa1-2021.json, built by .build/map/build_areas_sa1.py)
     is nationally complete and honestly encoded: 61,811 SA1s, every lane present,
     lengths aligned, caps sane, and the pooled marks the legend's benchmark lines
     ride recomputed from the bytes themselves.
   - the deep end exists where the census says it does: a lang share over 0.8 must
     ship in the pack (the whole failure the drawing answers: the seats' 60% key
     flattens places like Fairfield).
   - the app's lane table mirrors the pack exactly, and the wiring that makes the
     drawing fire (DRAWS, areasFits/drawOf fallback, the lazy load, the key extents,
     the tooltip's counted figure) is present in the assembled page's own bundle.
   - the income-quarter lanes' cut is always the frame in view's: the bundle reads
     cuts off the frame (m.incomeCuts.loCutWeekly / hiQCutWeekly), never a constant.
   Run: node .build/test-map-areas.mjs
   The browser's side (pixels, tooltips, gating) is .matilda/probe/areas-smoke.mjs. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const PACK_PATH = "maps/data/areas-sa1-2021.json";
const pack = JSON.parse(R(PACK_PATH));
const N = 61811; // national shaped SA1 areas at the 2021 census (33 no-polygon sentinel codes held out)
const ranNum = (s) => (s === null ? null : s);

/* ---------------- pack shape ---------------- */
assert.equal(pack.vintage, 2021, "pack vintage is the 2021 census");
assert.ok(pack.topo && typeof pack.topo === "object", "pack carries the topojson");
const objs = Object.values(pack.topo.objects);
assert.equal(objs.length, 1, "exactly one geometry layer");
const geoms = objs[0].geometries;
assert.equal(geoms.length, N, `${geoms.length} geometries != pin ${N}`);
assert.ok(Array.isArray(pack.topo.arcs) && pack.topo.arcs.length > 100000, "shared arcs present");
assert.ok(pack.topo.transform && pack.topo.transform.scale.every(Number.isFinite), "quantisation transform present");

const codes = geoms.map((g) => g.properties && g.properties.SA1_CODE21);
assert.ok(codes.every((c) => typeof c === "string" && /^\d{11}$/.test(c)), "every area is an 11-digit SA1 code");
assert.equal(new Set(codes).size, N, "SA1 codes unique");

/* ---------------- lanes ---------------- */
const EXPECT_LANES = ["lang", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar", "pt", "noncit", "bigfam", "loinc", "hiqinc", "a65", "a2034", "a1824", "a3554", "a75",
  "rel.norel", "rel.cath", "rel.angl", "rel.unch", "rel.pres", "rel.orth", "rel.budd", "rel.isl", "rel.hind", "rel.jew",
  "ten.mort", "ten.rent", "ten.own", "ten.rentPub",
  "cob.eng", "cob.ind", "cob.chn", "cob.nzl", "cob.phl", "cob.vnm", "cob.zaf", "cob.ita", "cob.lka", "cob.sct",
  "anc.english", "anc.australian", "anc.irish", "anc.scottish", "anc.chinese", "anc.italian", "anc.german", "anc.indian", "anc.filipino", "anc.dutch", "anc.vietnamese", "anc.lebanese",
  "ageMed", "incMed",
  "sf.irsad", "sf.irsd", "sf.ier", "sf.ieo"];
const meta = pack.meta;
// the two income-quarter lanes ship as band masses (computed at the frame's own
// cuts at draw time), so they aren't physical lanes but ARE caps/app lanes
const PHYS_LANES = EXPECT_LANES.filter((k) => k !== "loinc" && k !== "hiqinc");
assert.ok(meta.incBands, "income band masses present (the quartile lanes' source)");
const packLanes = Object.keys(pack.lanes).sort();
assert.deepEqual(packLanes, [...PHYS_LANES].sort(), "the pack's physical lane set minus the cut-relative two");
assert.ok(pack.caps.loinc && pack.caps.hiqinc, "the quartile lanes' key extents ship in caps");
for (const [k, o] of Object.entries(pack.lanes)) {
  if (!["u8x2", "u8", "u8z", "u16"].includes(o.t)) assert.fail(`lane ${k}: unknown encoding ${o.t}`);
}
// the homeless lane stays out by design (an SA2 estimate, never an SA1 count)
assert.ok(!("hl" in pack.lanes), "homeless is not a census-area lane");

const dec = (o) => Buffer.from(o.b, "base64");
for (const [k, o] of Object.entries(pack.lanes)) {
  const bytes = dec(o).length;
  const want = o.t === "u16" ? N * 2 : N;
  assert.equal(bytes, want, `lane ${k}: ${bytes} bytes != ${want}`);
}
assert.equal(dec(meta.pop).length, N * 4, "pop meta length");
assert.equal(dec(meta.area).length, N * 4, "area meta length");
assert.equal(dec(meta.sa2i).length, N * 2, "sa2 index meta length");
assert.equal(dec(meta.incBands).length, N * 32, "income band masses length (16 × uint16)");
assert.ok(Array.isArray(meta.sa2names) && meta.sa2names.length > 2000 && new Set(meta.sa2names).size === meta.sa2names.length, "SA2 names deduped");

/* ---------------- caps and marks ---------------- */
const SHARE_LANES = EXPECT_LANES.filter((k) => !k.startsWith("sf.") && k !== "ageMed" && k !== "incMed");
for (const k of EXPECT_LANES) {
  const c = pack.caps[k];
  assert.ok(c, `caps note ${k} present`);
  const [lo, hi] = c;
  if (k.startsWith("sf.")) assert.deepEqual(c, [1, 10], `${k} decile extent`);
  else if (k === "ageMed") assert.ok(lo >= 0 && lo < 45 && hi > 50 && hi <= 110, `ageMed extent ${c}`);
  else if (k === "incMed") assert.ok(lo >= 0 && hi >= 2000 && hi <= 10000, `incMed extent ${c}`);
  else { assert.equal(lo, 0, `${k} share extent starts at 0`); assert.ok(hi >= 3 && hi <= 100, `${k} share extent ${c} in range`); }
}
// the Fairfield problem, answered: the language lane's key runs within reach of 100%
assert.ok(pack.caps.lang[1] >= 85, `the language key reaches ${pack.caps.lang[1]}% (the seats' 60% flat line is gone)`);
// and the benchmark marks a reader crosses against
const marks = pack.marks;
assert.ok(marks.lang.AUS > 0.2 && marks.lang.AUS < 0.27, `national language mark ${marks.lang.AUS} (other-language share, 2021 census)`);
assert.ok(marks.fborn.AUS > 0.24 && marks.fborn.AUS < 0.34, `national overseas-born mark ${marks.fborn.AUS}`);
for (const k of ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT", "AUS"]) {
  for (const lane of ["lang", "uni"]) assert.ok(marks[lane][k] > 0 && marks[lane][k] < 1, `mark ${lane}/${k} sane`);
}
// income marks sit about a quarter each way in every universe's own cut
for (const k of ["AUS", "NSW", "SA"]) assert.ok(marks.loinc[k] > 0.21 && marks.loinc[k] < 0.3, `loinc mark ${k} ${marks.loinc[k]} ≈ a quarter`);

/* ---------------- decode spots ---------------- */
const words = (o) => dec(o);
const lang = words(pack.lanes.lang);
assert.equal(lang.length, N);
const popRaw = words(meta.pop);
const popAt = (i) => popRaw.readUInt32LE(4 * i);
let nullLang = 0, popSum = 0, maxLang = 0;
for (let i = 0; i < N; i++) {
  const v = lang[i];
  if (v === 255) { nullLang++; continue; }
  if (v > maxLang) maxLang = v;
  popSum += popAt(i);
}
assert.ok(maxLang >= 166, `deepest lang area ${maxLang / 2}% – a Fairfield-class deep end exists (>83%)`);
assert.ok(popSum > 24_500_000 && popSum < 26_000_000, `national persons ${popSum} ≈ 2021 census`);
assert.ok(nullLang < N * 0.05, `lang nulls ${nullLang} small`);
// seifa lanes: deciles stay 1..10 with 0 for none
for (const k of EXPECT_LANES.filter((x) => x.startsWith("sf."))) {
  const a = words(pack.lanes[k]);
  for (let i = 0; i < N; i += 997) assert.ok(a[i] <= 10, `${k} value ${a[i]} within 1..10 or none`);
}
// income bands: the 16-band adult masses sum to plausible adults and are all-zero
// only for unpopulated areas
const bandRaw = words(meta.incBands);
let zeroCells = 0;
for (let i = 0; i < N; i++) {
  let s = 0;
  for (let j = 0; j < 16; j++) s += bandRaw.readUInt16LE(32 * i + 2 * j);
  if (!s) zeroCells++;
  else if (s > 60000) assert.fail(`SA1 ${i}: ${s} income adults implausible`);
}
assert.ok(zeroCells > 1000 && zeroCells < N * 0.08, `income-null SA1s ${zeroCells} in the empty-land band`);

// the marks are what the bytes say: recompute pooled national lanes and agree
const pooledOf = (k, basisSumFn) => {
  const a = words(pack.lanes[k]);
  let num = 0, den = 0;
  for (let i = 0; i < N; i++) {
    const v = a[i];
    if (v === 255) continue;
    const p = popAt(i);
    num += (v / 200) * p;
    den += p;
  }
  return num / den;
};
const pooledLang = pooledOf("lang");
assert.ok(Math.abs(pooledLang - marks.lang.AUS) < 0.008, `pooled lang ${pooledLang} ≈ mark ${marks.lang.AUS}`);
const pooledUni = pooledOf("uni");
assert.ok(Math.abs(pooledUni - marks.uni.AUS) < 0.008, `pooled uni ${pooledUni} ≈ mark ${marks.uni.AUS}`);

// the sa26 store is the pack's own oracle: pooled marks must sit on it too
const sa26 = JSON.parse(R("data/sa26-demo.json")).demo;
const sasum = (lane) => {
  let num = 0, den = 0;
  for (const t of Object.values(sa26)) {
    if (t[lane] != null && t.p > 0) { num += t[lane] * t.p; den += t.p; }
  }
  return num / den;
};
assert.ok(Math.abs(sasum("lang") - marks.lang.SA) < 0.01, `pooled SA lang ${sasum("lang")} ≈ pack mark ${marks.lang.SA}`);

/* ---------------- app wiring ---------------- */
const js = R("maps/map.js");
const src = R(".build/map/app/app-2b-draw.js");
// the drawing's own row and its fallback to seats
assert.ok(js.includes('["areas", "Areas"]'), "DRAWS carries Areas (its fourth button)");
assert.ok(js.includes("areasFits") && js.includes("areasVintage"), "areasFits and the vintage map present");
// the pack's lanes table in the app mirrors a literal the same test asserts above
const appSet = src.match(/const AREAS_LANES = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(appSet, "AREAS_LANES literal found in app-2b-draw.js");
const appLanes = [...appSet[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
assert.deepEqual(appLanes, [...EXPECT_LANES].sort(), "the app's AREAS_LANES mirrors the pack's lane set");
// the lazy load asks for the pack by its stamped name pattern every other file uses
assert.ok(js.includes("areas-sa1-"), "the fetch name pattern is in the bundle");
assert.ok(src.includes("/maps/data/${AREAS_FILES[vin]}.json"), "the pack is fetched as data, on demand");
// the income-quarter lanes read the frame in view's cuts, never a constant
assert.ok(src.includes("m.incomeCuts.loCutWeekly") && src.includes("m.incomeCuts.hiQCutWeekly"), "quartile lanes ride the frame's own cuts");
assert.ok(!src.includes("loinc: 10") && !src.includes("1079"), "no national-income constant leaked into the app");
// the key extents come from the pack, the seats' from the legend's own range
assert.ok(src.includes("P.caps[lane]"), "the key-line normalisation reads the pack's caps");
// the blurbs: the drawing says what it is, and the blend frames say so
assert.ok(src.includes("census areas, each as counted at the ${") || src.includes("census areas, each as counted"), "the draw note names the areas-as-counted basis");
assert.ok(src.includes("nearest single census"), "blend frames name the nearest single census");
assert.ok(src.includes("Empty land stays paper"), "the note admits empty land reads as paper");
// the homeless lane explains itself on the button
assert.ok(src.includes("homeless lane stays as seats"), "the disabled reason for the homeless lane is kept");
// the tooltip reads the area, not the smoothed spot
assert.ok(R(".build/map/app/app-6-ui.js").includes("areasHit("), "hover hits a census area");
const tip = R(".build/map/app/app-6-ui.js");
assert.ok(tip.includes("as counted at the ${areasVintage(m)} census"), "the tooltip counts its census");
// the legend sells its own key, not the seats' (caps swap), and the histogram stays seats
assert.ok(tip.includes("arCap") && tip.includes("!arOn"), "the legend swaps in the pack's caps and parks the seats' histogram");
// the frame's gating stays honest: senate and house-of-reps only
assert.ok(js.includes("m.house === \"senate\""), "drawing gating still keys the house");
// and the stamp ledger carries the pack (it never goes missing behind a cache)
const stampsMatch = js.match(/"areas-sa1-2021\.json"/);
assert.ok(stampsMatch, "map.js's data stamps carry the pack");

/* ---------------- builder provenance ---------------- */
const builder = R(".build/map/build_areas_sa1.py");
assert.ok(builder.includes("GCP_ROWS = 61844"), "the builder pins the GCP row count");
assert.ok(builder.includes('build_areas_sa1'), "the builder names itself");
assert.ok(builder.includes("sa26") && builder.includes("cross-check"), "the sa26 cross-check stays in the pipeline");
// src records let a follow-up compare vintages
assert.ok(pack.src && pack.src.seifa && pack.src.sa1Shp && pack.src.gcpRows === 61844, "source records kept");

console.log("PASS: areas pack — 2021 census as-counted conformance, caps/marks, deep end, wiring");
