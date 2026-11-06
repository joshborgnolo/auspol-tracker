#!/usr/bin/env node
/* urban_build.mjs - map/data/urban.json: the 2021 ABS Urban Centre and Locality (UCL)
   outlines the map draws as a town's white edge when the town is picked.

   One entry per places.json row, in places.json's exact order (the app keys a town to
   its outline by that index): [[ring…], …] per town, ring = delta-coded lon/lat ints
   ×1e-5 degrees ([lon0, lat0, dLon, dLat, …]); a MULTIPOLYGON's parts come through as
   more rings. null where a places row found no UCL in the source (none today).

   The outline's only job is to read as the town's true extent when the flight frames
   it, so each feature is Ramer-Douglas-Peucker simplified to ~1/400 of its extent
   diagonal (clamped 40 m–330 m): the same edge smoothness at whatever size the town
   fits on the screen.

   Source (not in the repo, cached machine-locally at .build/map/src/urban/ucl-2021.geojson,
   fetched on first run): ABS ASGS Edition 3 UCL via the ArcGIS service
     https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/UCL/MapServer/0/query
   GDA2020 to WGS84 passes through unchanged, so the coordinates equal the shapefile
   places_build.py read, and a feature joins its places row by holding the exact same
   extent places.json recorded (the join fails loudly below ~98% matched, never a
   guess at a shifted vintage).

   usage: node .build/map/urban_build.mjs
   then: git add map/data/urban.json && node .build/map/assemble.mjs (the data stamp) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC_DIR = path.join(root, ".build/map/src/urban");
const CACHE = path.join(SRC_DIR, "ucl-2021.geojson");
const URL_ = "https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/UCL/MapServer/0/query?where=1%3D1&outFields=UCL_CODE_2021%2CUCL_NAME_2021%2CSTATE_CODE_2021&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=geojson";
const OUT = path.join(root, "map/data/urban.json");

const SERVICE = (await fetch(CACHE).then((r) => r.ok ? r.json() : fetch(URL_).then((r) => {
  if (!r.ok) throw new Error(`ArcGIS ${r.status}`);
  return r.json();
})).then((d) => { fs.mkdirSync(SRC_DIR, { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(d)); return d; }).catch(() => null))
  ?? JSON.parse(fs.readFileSync(CACHE, "utf8"));

const PLACES = JSON.parse(fs.readFileSync(path.join(root, "map/data/places.json"), "utf8")).p;
const r3 = (v) => Math.round(v * 1000) / 1000;

function* ringsOf(geom) {
  if (!geom) return;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  for (const poly of polys) for (const ring of poly) yield ring;
}

// [w, s, e, n] over a feature's whole geometry (every part and hole), rounded
function extentOf(geom) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity, any = false;
  for (const ring of ringsOf(geom)) for (const [x, y] of ring) {
    any = true;
    if (x < w) w = x; if (x > e) e = x;
    if (y < s) s = y; if (y > n) n = y;
  }
  return any ? [w, s, e, n].map(r3) : null;
}

/* Ramer-Douglas-Peucker, iterative: keep the points that hold the ring's shape
   within tol degrees */
function rdp(pts, tol) {
  const n = pts.length, keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let max = 0, ix = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = Math.hypot(ax + t * dx - px, ay + t * dy - py);
      }
      if (d > max) { max = d; ix = i; }
    }
    if (max > tol) { keep[ix] = 1; stack.push([a, ix], [ix, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// a ring to its delta-coded ints ×1e-5
function packRing(pts) {
  const out = new Array(2 * pts.length);
  let x0 = 0, y0 = 0;
  pts.forEach(([x, y], i) => {
    const qx = Math.round(x * 1e5), qy = Math.round(y * 1e5);
    out[2 * i] = qx - x0; out[2 * i + 1] = qy - y0;
    x0 = qx; y0 = qy;
  });
  return out;
}

const byKey = new Map();
const extents = SERVICE.features.map((f) => extentOf(f.geometry));
SERVICE.features.forEach((f, i) => {
  if (extents[i]) byKey.set(extents[i].join(","), f);
});
// (and the half-precision flips: a box corner rounding halfway by the shapely
// writer's rule and its mirror here land up to 0.001 apart, so a row joins the
// service's feature its extent box sits nearest, well inside two settlements apart)
const ROUND_NOISE = 0.002;
function nearestFeature(bb) {
  let best = null, bd = Infinity;
  SERVICE.features.forEach((f, i) => {
    const e = extents[i];
    if (!e) return;
    const d = Math.max(Math.abs(e[0] - bb[0]), Math.abs(e[1] - bb[1]), Math.abs(e[2] - bb[2]), Math.abs(e[3] - bb[3]));
    if (d < bd) { bd = d; best = f; }
  });
  return bd <= ROUND_NOISE ? best : null;
}

let matched = 0, trimmedIn = 0, trimmedOut = 0;
const misses = [];
const u = PLACES.map((q, i) => {
  const f = byKey.get(q[5].map(r3).join(",")) ?? nearestFeature(q[5]);
  if (!f) { misses.push(`${q[0]} (${q[4]})`); return null; }
  matched++;
  // adaptive tolerance: ~1/400 of the extent's diagonal, 0.0004°…0.003° (≈40–330 m)
  let w = q[5][2] - q[5][0], h = q[5][3] - q[5][1];
  const tol = Math.min(0.003, Math.max(0.0004, Math.hypot(w, h) / 400));
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const out = [];
  for (const poly of polys) {
    const rings = [];
    for (const ring of poly) {
      trimmedIn += ring.length;
      const sm = rdp(ring.map((p) => p), tol);
      trimmedOut += sm.length;
      if (sm.length >= 4) rings.push(packRing(sm));
    }
    if (rings.length) out.push(rings);
  }
  return out.length ? out : null;
});

const share = matched / PLACES.length;
if (share < 0.98) {
  console.error(`urban_build: only ${matched}/${PLACES.length} places rows matched a UCL extent (${misses.join("; ")})`);
  process.exit(1);
}
if (misses.length) console.warn(`urban_build: no UCL for ${misses.length} places rows (null): ${misses.join("; ")}`);
fs.writeFileSync(OUT, JSON.stringify({ src: "ABS 2021 Urban Centres and Localities (ASGS Edition 3, geo.abs.gov.au ArcGIS), simplified per feature ~1/400 of extent; order and nulls follow places.json", u: u }, null, 0));
const mb = fs.statSync(OUT).size / 1048576;
console.log(`${matched}/${PLACES.length} places got an outline; vertices ${trimmedIn} -> ${trimmedOut}; ${mb.toFixed(2)} MB -> ${OUT}`);
