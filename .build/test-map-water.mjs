/* test-map-water.mjs – the electoral map's water in the seats (water_build.mjs; app-2-map.js,
   "the water in the seats").
   - map/data/water.json and every water-<city>.json are TopoJSON pairs (the water: pieces,
     shores, mouths; the dry lakes) built for the frames the map has now: a frame added
     since needs the files rebuilt (node .build/map/water_build.mjs);
   - known waters are water for the frames whose seats are drawn across them (Port Jackson,
     Botany Bay, the Swan, Western Port from 2019, Lake Argyle, Lake Alexandrina; Moreton Bay
     for Queensland's own districts only), known land is never cut, the big salt lakes are dry lakes and never
     water, at both levels of detail;
   - the files stay inside their budgets, and the city files' bounds hold their contents;
   - the paint: the cut runs after the fills and before Esri's sea (laySea), again after a
     year morph's fills, the dry lakes stay out of Esri's sea mask, the veil and outlines know
     the water.
   node .build/test-map-water.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoContains } from "d3-geo";
import * as topojson from "topojson-client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const map2 = R(".build/map/app/app-2-map.js");

const frames = fs.readdirSync(path.join(ROOT, "map/data")).filter((f) => /^geo-.*-hi\.json$/.test(f)).map((f) => f.slice(4, -8)).sort();
const lo = JSON.parse(R("map/data/water.json"));
assert.deepEqual(lo.frames, frames, "water.json was built for the frames the map has (node .build/map/water_build.mjs, then assemble.mjs)");
assert.ok(lo.caps && lo.tiles && Object.keys(lo.tiles).length >= 6, "water.json names its city files and their bounds");
const files = { lo };
for (const cap of Object.keys(lo.tiles)) {
  const t = JSON.parse(R(`map/data/water-${cap}.json`));
  assert.deepEqual(t.frames, frames, `water-${cap}.json was built with water.json`);
  assert.equal(t.cap, cap);
  files[cap] = t;
}
// (no stray city file left behind by an older build)
for (const f of fs.readdirSync(path.join(ROOT, "map/data")).filter((f) => /^water-.*\.json$/.test(f))) assert.ok(f.slice(6, -5) in lo.tiles, `${f} is one of water.json's city files`);

for (const [name, t] of Object.entries(files)) {
  for (const k of ["water", "shore", "mouth"]) assert.ok(t.water.objects[k], `${name}: the water topology holds ${k}`);
  assert.ok(t.dry.objects.dry, `${name}: the dry lakes`);
  for (const o of [...Object.values(t.water.objects), t.dry.objects.dry]) assert.ok(o.geometries.every((g) => g.type && g.arcs), `${name}: no emptied feature left in`);
  for (const k of ["water", "shore", "mouth"]) for (const g of t.water.objects[k].geometries) {
    assert.ok(Number.isInteger(g.properties.f) && g.properties.f > 0 && g.properties.f < 2 ** frames.length, `${name} ${k}: a frames' bit mask on each`);
    assert.ok(Number.isInteger(g.properties.c) && g.properties.c >= 0 && g.properties.c < lo.caps.length, `${name} ${k}: a city on each`);
  }
  for (const g of t.dry.objects.dry.geometries) assert.ok(typeof g.properties.nm === "string", `${name}: each dry lake carries its name (blank where Geoscience Australia has none)`);
  const size = R(`map/data/${name === "lo" ? "water" : `water-${name}`}.json`).length;
  assert.ok(size < (name === "lo" ? 320e3 : 1.6e6), `${name}: inside its budget (${size} bytes)`);
}

// each file's features as GeoJSON, with the frames that cut them
const feats = (t, k, topoKey = "water") => t[topoKey].objects[k].geometries.map((g) => ({ f: topojson.feature(t[topoKey], g), p: g.properties }));
const wet = Object.fromEntries(Object.entries(files).map(([n, t]) => [n, feats(t, "water")]));
const dry = Object.fromEntries(Object.entries(files).map(([n, t]) => [n, feats(t, "dry", "dry")]));
const bitOf = (fr) => 1 << frames.indexOf(fr);
const wetFor = (n, fr, ll) => wet[n].some(({ f, p }) => (p.f & bitOf(fr)) && geoContains(f, ll));
const wetAny = (n, ll) => wet[n].some(({ f }) => geoContains(f, ll));
const dryAt = (n, ll) => dry[n].find(({ f }) => geoContains(f, ll));

// the waters the seats are drawn across: [where, the point, its city file, the country file too?, cut for, not cut for]
const WATERS = [
  ["Port Jackson by Shark Island", [151.258, -33.853], "syd", true, ["2025", "2016", "2004", "nsw23"], ["qld24"]],
  ["Botany Bay", [151.19, -33.98], "syd", true, ["2025", "2010", "nsw19"], []],
  ["the Parramatta River under Gladesville Bridge", [151.147, -33.842], "syd", false, ["2025", "2001"], []],
  ["Perth Water on the Swan", [115.86, -31.97], "per", true, ["2025", "2010"], ["wa25"]],
  ["Western Port", [145.25, -38.35], "mel", true, ["2025", "2019"], ["2016"]],
  ["Lake Argyle", [128.75, -16.3], "drw", true, ["2025", "wa21"], []],
  ["Lake Alexandrina", [139.15, -35.45], "adl", true, ["2025", "sa26"], []],
  ["Moreton Bay", [153.2, -27.45], "bne", true, ["qld24", "qld17"], ["2025"]],
];
for (const [name, ll, cap, inLo, yes, no] of WATERS) {
  for (const fr of yes) {
    assert.ok(wetFor(cap, fr, ll), `${name} is water in water-${cap}.json for ${fr}`);
    if (inLo) assert.ok(wetFor("lo", fr, ll), `${name} is water in water.json for ${fr}`);
  }
  for (const fr of no) assert.ok(!wetFor(cap, fr, ll), `${name} is not cut for ${fr}, whose seats don't cover it`);
}
// land, never cut, at either level of detail
// (a point within the country file's 500 m of a shore is checked in the city files only: that
// file is drawn only where a pixel is more than WATER_MPP[1] metres)
const LAND = [["Sydney's CBD", [151.207, -33.868], true], ["Parramatta", [151.003, -33.815], true], ["Perth's CBD", [115.86, -31.952], true], ["Adelaide", [138.6, -34.93], true], ["Hobart", [147.327, -42.882], true], ["Brisbane's CBD", [153.026, -27.469], true], ["Garden Island, Sydney", [151.228, -33.864], false], ["Cockatoo Island", [151.172, -33.847], false]];
for (const [name, ll, alsoLo] of LAND) for (const n of Object.keys(files)) if (n !== "lo" || alsoLo) assert.ok(!wetAny(n, ll), `${name} is land in ${n === "lo" ? "water.json" : `water-${n}.json`}`);
// the salt lakes: dry lakes at both levels, never water
// (each point is mapshaper's -points inner of Geoscience Australia's own polygon; a lake's city
// file is whichever capital is nearest the middle of its bounds, so any city file may hold it)
const cities = Object.keys(lo.tiles);
for (const [name, ll] of [["Kati Thanda-Lake Eyre North", [137.301, -28.398]], ["Lake Torrens", [137.85, -31.002]], ["Lake Gairdner", [135.988, -31.638]], ["Lake Frome", [139.813, -30.73]], ["Lake Mackay", [128.819, -22.436]], ["Lake Amadeus", [130.976, -24.81]]]) {
  assert.ok(dryAt("lo", ll), `${name} is a dry lake in water.json`);
  assert.ok(cities.some((c) => dryAt(c, ll)), `${name} is a dry lake in a city file`);
  for (const n of Object.keys(files)) assert.ok(!wetAny(n, ll), `${name} is never cut to water (${n})`);
}
// the seats whose names stood on their water: each moved name stands inside its own seat, on land
// (even-odd over the seat's rings: the Handbook years' digitised rings aren't wound as d3 reads them)
const evenOdd = (g, [x, y]) => {
  let c = false;
  for (const poly of g.type === "Polygon" ? [g.coordinates] : g.coordinates) for (const r of poly)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
};
assert.ok(lo.lp && lo.lp["2025"] && lo.lp["2025"]["Kingsford Smith"] && lo.lp.qld24 && lo.lp.qld24.Redcliffe, "water.json moves the names that stood on the water (Kingsford Smith, Redcliffe)");
for (const [fr, seats] of Object.entries(lo.lp)) {
  assert.ok(frames.includes(fr), `water.json's label points are for a frame (${fr})`);
  const t = JSON.parse(R(`map/data/geo-${fr}-hi.json`)), res = JSON.parse(R(fs.existsSync(path.join(ROOT, `map/data/core-${fr}.json`)) ? `map/data/core-${fr}.json` : `map/data/res-${fr}.json`));
  const names = new Set(res.divs.map((d) => d.n));
  for (const [n, ll] of Object.entries(seats)) {
    assert.ok(names.has(n), `${fr}: ${n} is one of the frame's seats`);
    const seat = topojson.merge(t, t.objects.divs.geometries.filter((g) => g.properties.name === n));
    assert.ok(evenOdd(seat, ll), `${fr}: ${n}'s moved name stands inside the seat`);
    assert.ok(!cities.some((c) => wetFor(c, fr, ll)), `${fr}: ${n}'s moved name stands on land, not water`);
  }
}
// a city file's bounds hold all it has (water.json's tiles decide when a city file is fetched)
for (const [cap, bb] of Object.entries(lo.tiles)) {
  const t = files[cap];
  for (const [topoKey, k] of [["water", "water"], ["dry", "dry"]]) for (const g of t[topoKey].objects[k].geometries) {
    const b = topojson.feature(t[topoKey], g);
    const c = b.geometry.type === "Polygon" ? b.geometry.coordinates[0][0] : b.geometry.coordinates[0][0][0];
    assert.ok(c[0] >= bb[0] - 1e-3 && c[0] <= bb[2] + 1e-3 && c[1] >= bb[1] - 1e-3 && c[1] <= bb[3] + 1e-3, `water-${cap}.json: its ${k} lie within its bounds in water.json`);
  }
}

// ---- the paint
const fnBody = (name) => { const a = map2.indexOf(`function ${name}(`); assert.ok(a >= 0, `app-2-map.js has ${name}`); const b = map2.indexOf("\nfunction ", a + 10); return map2.slice(a, b < 0 ? undefined : b); };
const geo = fnBody("drawGeo");
assert.ok(geo.indexOf("drawWater(m, alpha, st, sa)") > geo.indexOf("layStreets(st)") && geo.indexOf("drawWater(m, alpha, st, sa)") < geo.indexOf("laySea(m, st"), "drawGeo: the water is cut after the fills and streets, before Esri's sea");
assert.ok(/drawWater\(m, 1, null, 0\)/.test(fnBody("drawYearMorph")), "drawYearMorph: the new election's seats are cut too");
assert.ok(/dryInView\(M\(\)\)/.test(fnBody("prepStreets")) && /destination-out/.test(fnBody("prepStreets")), "prepStreets: the dry lakes are cut back out of Esri's sea, so they stay land");
const focus = fnBody("drawFocus");
assert.ok(/waterWet\(m\)/.test(focus) && /clip\(land, "evenodd"\)/.test(focus), "drawFocus: the veil lies on the water and the outlines keep to the land");
const mpp = map2.match(/const WATER_MPP = \[(\d+), (\d+)\], WATER_PREFETCH = (\d+)/), floor = map2.match(/const WATER_LO_FLOOR = \[(\d+), (\d+)\]/);
assert.ok(mpp && +mpp[1] < +mpp[2] && +mpp[3] > +mpp[2], "a city file is asked for before it takes over, and takes over across a stretch of zoom");
// (where the two blend, the country file's LO_TOL must be under a pixel: no half-cut edge)
assert.ok(+mpp[1] >= 500, "the country and city files blend only where the country file's 500 m is under a pixel");
assert.ok(floor && +floor[2] <= +mpp[1] && +floor[1] < +floor[2], "the country file's shapes stop short of the city views");
assert.ok(/for \(const \[L, it, w\] of mouths\) \{ g\.globalAlpha = w; g\.stroke/.test(map2), "drawWater: the mouths are rubbed out with the pieces, in one cut");
const dw = fnBody("drawWater");
assert.ok(/Lr\.globalAlpha = sa; Lr\.globalCompositeOperation = "destination-out"; Lr\.fill\(st\.known\)/.test(dw) && /destination-in"; S2\.drawImage\(seaCv/.test(dw), "drawWater: the handover to Esri's sea keeps the water whole (full where Esri's sea lies too, 1 - sa elsewhere)");
console.log("test-map-water: ok");
