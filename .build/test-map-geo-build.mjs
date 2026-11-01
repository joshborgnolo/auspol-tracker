/* test-map-geo-build.mjs – pins the Election map's arc-once geometry build
   (2026-11-01, the /map/ speed pass) to what d3.geoPath draws.

   buildGeo (app-1-base.js, the geo-core block) projects each topology
   arc once through the projection's own stream and draws a seat's rings, its
   bounds and the three meshes from those arcs end to end, where d3.geoPath
   used to walk every arc four to six times. This test runs that block in node
   against d3.geoPath on every frame's lo and hi topology, under the frame's
   own projection (loadYear's fit), and requires every seat path, every seat's
   bounds and the meshDiv/meshState/coast paths, and a sample of coastOf/edgeOf,
   to issue the same moveTo/lineTo/closePath commands at the same points (to
   1e-9 of a plane unit; topojson's degenerate-ring padding aside, which draws
   nothing). The lossless Handbook frames (buildHandbookGeo) are held to the
   same standard against the drawing they had before: the old handbookFeature
   (copied below as the reference: 0.05° pieces, d3.geoArea winding) through
   d3.geoPath, seat by seat, with bounds.
   Run after editing the geometry build or rebuilding map/data:
     node .build/test-map-geo-build.mjs [--years=2025,sa26] */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, ".build/map/app/app-1-base.js"), "utf8");
const m0 = src.indexOf("/*@geo-core:begin*/"), m1 = src.indexOf("/*@geo-core:end*/");
assert.ok(m0 > 0 && m1 > m0, "the geo-core markers are in app-1-base.js");

// a Path2D that records what it is told
class Rec {
  constructor() { this.c = []; }
  addPath(q) { for (const v of q.c) this.c.push(v); }
  moveTo(x, y) { this.c.push(0, x, y); }
  lineTo(x, y) { this.c.push(1, x, y); }
  closePath() { this.c.push(2, 0, 0); }
}
// d3 and topojson-client from the copies the page itself ships (CI's npm ci installs neither)
const ctx = vm.createContext({ Path2D: Rec, performance, setTimeout });
for (const f of ["map/vendor/d3-7.9.0.min.js", "map/vendor/topojson-client-3.1.0.min.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx);
vm.runInContext(src.slice(m0, m1) + "\nthis.geoSteps = geoSteps;", ctx);
// the Handbook build: its ring helpers and the async two-pass build, under a proj of its own
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, `found ${a}`); return src.slice(i, j); };
vm.runInContext("var proj = null;\n" + cut("const hbPairs", "function handbookRings") + cut("function handbookRings", "/* a frame's seats") + cut("async function buildHandbookGeo", "/* the islands off") + "\nthis.buildHandbookGeo = buildHandbookGeo;", ctx);
const { d3, topojson } = ctx;
const build = (topo, m, P) => { const it = ctx.geoSteps(topo, m, P); for (;;) { const r = it.next(); if (r.done) return r.value; } };

// what d3.geoPath draws, as commands: topojson's padding of a ring under four points
// (a repeated first point) is dropped, as a stroke or fill of it is empty either way
const ref = (P, g) => { const p = new Rec(); d3.geoPath(P, p)(g); return p.c; };
const sameCmds = (a, b, what) => {
  const strip = (c) => { // drop zero-length lineTos (a ring padded by repeating its first point)
    const o = [];
    for (let i = 0; i < c.length; i += 3) {
      if (c[i] === 1 && o.length && Math.abs(o[o.length - 2] - c[i + 1]) < 1e-12 && Math.abs(o[o.length - 1] - c[i + 2]) < 1e-12) continue;
      o.push(c[i], c[i + 1], c[i + 2]);
    }
    return o;
  };
  const x = strip(a), y = strip(b);
  assert.equal(x.length, y.length, `${what}: ${x.length / 3} commands, d3 draws ${y.length / 3}`);
  for (let i = 0; i < x.length; i += 3) {
    assert.equal(x[i], y[i], `${what}: command ${i / 3} differs`);
    assert.ok(Math.abs(x[i + 1] - y[i + 1]) < 1e-9 && Math.abs(x[i + 2] - y[i + 2]) < 1e-9, `${what}: point ${i / 3} at ${x[i + 1]},${x[i + 2]} v d3 ${y[i + 1]},${y[i + 2]}`);
  }
};

const yf = process.argv.find((a) => a.startsWith("--years="));
const DATA = path.join(ROOT, "map/data");
let years = fs.readdirSync(DATA).map((f) => /^geo-(\w+)-lo\.json$/.exec(f)).filter(Boolean).map((r) => r[1]);
if (yf) years = yf.slice(8).split(",");
let frames = 0, seats = 0;
// the Handbook drawing before 2026-11-01, verbatim: the reference
function oldHandbookFeature(f) {
  const ps = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  f.geometry = { type: "MultiPolygon", coordinates: ps.filter(p => p[0].some(([x,y]) => x >= 112 && x <= 154.5 && y >= -44.5 && y <= -9)).map(p => p.map((ring, ri) => {
    const r = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i+1], n = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / .05));
      for (let j = 0; j < n; j++) r.push([a[0]+(b[0]-a[0])*j/n, a[1]+(b[1]-a[1])*j/n]);
    }
    r.push(r[0]);
    if ((d3.geoArea({type:"Polygon", coordinates:[r]}) > 2*Math.PI) === (ri === 0)) r.reverse();
    return r;
  })) };
  return f;
}
for (const y of years) {
  const lo = JSON.parse(fs.readFileSync(path.join(DATA, `geo-${y}-lo.json`), "utf8"));
  if (lo.handbook) {
    const o = lo.objects.divs, names = [...new Set(o.geometries.map((g) => g.properties.name))];
    const m = { divs: names.map((n) => ({ n })), byName: new Map(names.map((n, i) => [n, i])) };
    const g = await ctx.buildHandbookGeo(lo, m), P = m.proj, gen = d3.geoPath(P);
    for (const gm of o.geometries) {
      const i = m.byName.get(gm.properties.name);
      if (o.geometries.filter((q) => q.properties.name === gm.properties.name).length > 1) continue;
      const f = oldHandbookFeature(topojson.feature(lo, gm));
      sameCmds(g.paths[i].c, ref(P, f), `${y} ${gm.properties.name} path`);
      const b = gen.bounds(f);
      for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) assert.ok(Math.abs(g.bb[i][k][j] - b[k][j]) < 1e-9, `${y} ${gm.properties.name} bounds`);
      seats++;
    }
    frames++;
    continue;
  }
  // loadYear's projection: the conic fitted to the frame's lo seats
  const P = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], topojson.feature(lo, lo.objects.divs));
  for (const lvl of ["lo", "hi"]) {
    const topo = lvl === "lo" ? lo : JSON.parse(fs.readFileSync(path.join(DATA, `geo-${y}-hi.json`), "utf8"));
    const o = topo.objects.divs, names = [...new Set(o.geometries.map((g) => g.properties.name))];
    const m = { divs: names.map((n) => ({ n })), byName: new Map(names.map((n, i) => [n, i])) };
    const g = build(topo, m, P);
    const fc = topojson.feature(topo, o), gen = d3.geoPath(P);
    const seen = new Set();
    for (const f of fc.features) {
      const i = m.byName.get(f.properties.name);
      if (seen.has(i)) continue; // a name twice: the build keeps the last; d3 compare only singletons
      seen.add(i);
      if (o.geometries.filter((q) => q.properties.name === f.properties.name).length > 1) continue;
      sameCmds(g.paths[i].c, ref(P, f), `${y} ${lvl} ${f.properties.name} path`);
      const b = gen.bounds(f);
      for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) assert.ok(Math.abs(g.bb[i][k][j] - b[k][j]) < 1e-9, `${y} ${lvl} ${f.properties.name} bounds`);
      seats++;
    }
    const at = (q) => m.byName.get(q.properties.name);
    sameCmds(g.meshDiv.c, ref(P, topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st === b.properties.st)), `${y} ${lvl} meshDiv`);
    sameCmds(g.meshState.c, ref(P, topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st !== b.properties.st)), `${y} ${lvl} meshState`);
    sameCmds(g.coast.c, ref(P, topojson.mesh(topo, o, (a, b) => a === b)), `${y} ${lvl} coast`);
    for (const i of [0, Math.floor(names.length / 2), names.length - 1]) {
      sameCmds(g.coastOf(i).c, ref(P, topojson.mesh(topo, o, (a, b) => a === b && at(a) === i)), `${y} ${lvl} coastOf ${names[i]}`);
      sameCmds(g.edgeOf(i).c, ref(P, topojson.mesh(topo, o, (a, b) => a !== b && (at(a) === i || at(b) === i))), `${y} ${lvl} edgeOf ${names[i]}`);
    }
    frames++;
  }
}
assert.ok(frames >= 2, "some frames were checked");
console.log(`test-map-geo-build: ok – ${frames} frame levels, ${seats} seat paths draw what d3.geoPath draws`);
