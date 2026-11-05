/* test-map-draw.mjs – pins /map/'s drawings (app-2b-draw.js): seats, balloons and the surface.

   - surfaceRaster, the field and its picture, is a worker's text: it runs here in a bare vm
     context, so anything it reached for outside itself would fail. On small made-up elections
     it must give back what went in: a flat field, a line where two sides meet, the votes'
     weight, and no neighbourhood claimed by a handful of votes.
   - the contests' numbers are the site's: FP_ON and the Senate tables in flows.mjs.
   - the contests are offered where the data says they should be: One Nation in three seats
     in four, with Senate orders to read.
   - the wiring that a screenshot through the URL can't see: the buttons reach their handler
     (they once didn't), the URL carries both choices both ways, the key holds its height
     through every drawing.
   Run: node .build/test-map-draw.mjs
   The browser's side is in .matilda/probe/map-draw.mjs <baseUrl>. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { FP_ON, FLOW_HISTORY_SENATE_ON as ON, FLOW_HISTORY_SENATE_CON as CON } from "./newtracker/flows.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const draw = R(".build/map/app/app-2b-draw.js"), ui = R(".build/map/app/app-6-ui.js");
const between = (a, b) => { const i = draw.indexOf(a), j = draw.indexOf(b, i); assert.ok(i >= 0 && j > i, a); return draw.slice(i, j); };

/* ----- the raster, alone ----- */
const src = between("function surfaceRaster(D, J) {", "\n/* ----- the rasters -----");
const raster = vm.runInNewContext(`(${src})`, {});
const pts = (list) => {
  const n = list.length, D = { n, x: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n), late: new Float32Array(n), bx0: Infinity, by0: Infinity, bx1: -Infinity, by1: -Infinity };
  list.forEach(([x, y, w], k) => { D.x[k] = x; D.y[k] = y; D.w[k] = w; D.bx0 = Math.min(D.bx0, x); D.bx1 = Math.max(D.bx1, x); D.by0 = Math.min(D.by0, y); D.by1 = Math.max(D.by1, y); });
  return D;
};
// ten steps across 0..100, each its own colour, the ink apart from them all
const steps = (D, line = null) => {
  D.lo = 0; D.hi = 100; D.line = line; D.fam = false; D.M0 = 3500; D.ink = 0xff010203;
  D.band = new Uint8Array(4096).map((_, k) => Math.min(9, Math.floor(((100 * k) / 4095) / 10)));
  D.col = Uint32Array.from({ length: 10 }, (_, k) => (0xff000000 | (k * 20 + 10)) >>> 0);
  return D;
};
const J = { px: 1, x0: 0, y0: 0, nx: 300, ny: 300, floor: 8, lw: 1.5 };
const px = (r, x, y) => new Uint32Array(r.rgba)[y * J.nx + x];
const fieldAt = (r, x, y) => { const g = r.grid, i = Math.round(x / g.c) - g.ix, j = Math.round(y / g.c) - g.iy; return r.f[0][j * g.nx + i]; };
const grid = (fn) => { const l = []; for (let y = 10; y < 300; y += 40) for (let x = 10; x < 300; x += 40) l.push(fn(x, y)); return l; };

{ // the same figure everywhere gives one colour and no line
  const l = grid((x, y) => [x, y, 2000]), D = steps(pts(l), 50); D.ch = [Float32Array.from(l, () => 62)];
  const r = raster(D, J), a = new Uint32Array(r.rgba);
  assert.ok(a.every((c) => c === a[0]), "a flat reading is one colour");
  assert.equal(a[0], D.col[6], "in its own step");
  assert.ok(Math.abs(fieldAt(r, 150, 150) - 62) < 1e-3, "and reads as itself");
}
{ // two sides: each keeps its figure, and the line runs between them
  const l = grid((x, y) => [x, y, 2000]), D = steps(pts(l), 50); D.ch = [Float32Array.from(l, ([x]) => (x < 150 ? 35 : 75))];
  const r = raster(D, J), a = new Uint32Array(r.rgba);
  assert.equal(px(r, 40, 150), D.col[3], "the left side reads its own step");
  assert.equal(px(r, 260, 150), D.col[7], "the right side reads its own");
  const xs = [];
  // (the line is antialiased, so a pixel of it is never quite the ink; this field's steps run from 70 to 150, so under 60 is line)
  const dark = (c) => (c & 255) < 60;
  let rows = 0;
  for (let y = 0; y < 300; y += 10) { let hit = false; for (let x = 0; x < 300; x++) if (dark(a[y * J.nx + x])) { hit = true; xs.push(x); } if (hit) rows++; }
  assert.equal(rows, 30, `the line is drawn all the way down (${rows} of 30 rows)`);
  assert.ok(xs.every((x) => x > 120 && x < 180), "and only between the two sides");
}
{ // votes weigh: a big place outweighs a small one beside it
  const l = [[140, 150, 40000], [160, 150, 400]], D = steps(pts([...l, [10, 10, 1], [290, 290, 1]]), null); D.ch = [Float32Array.from([40, 60, 50, 50])];
  const r = raster(D, J);
  assert.ok(Math.abs(fieldAt(r, 150, 150) - 40) < 2, `the big place's figure leads (${fieldAt(r, 150, 150).toFixed(1)})`);
}
{ // a handful of votes can't claim a neighbourhood: the level above speaks for it
  const l = [...grid((x, y) => [x, y, 3000]).filter(([x, y]) => Math.hypot(x - 150, y - 150) > 70), [150, 150, 10]];
  const D = steps(pts(l), null); D.ch = [Float32Array.from(l, (q, k) => (k === l.length - 1 ? 95 : 40))];
  const r = raster(D, J);
  assert.ok(fieldAt(r, 150, 150) < 50, `ten votes at 95 don't move the ground around them (${fieldAt(r, 150, 150).toFixed(1)})`);
}
{ // where nobody voted the field still reaches, smoothly, from the nearest places
  const l = [[20, 150, 9000], [280, 150, 9000]], D = steps(pts(l), null); D.ch = [Float32Array.from([20, 80])];
  const r = raster(D, J), mid = fieldAt(r, 150, 150);
  assert.ok(mid > 30 && mid < 70, `the empty middle lies between its two towns (${mid.toFixed(1)})`);
}
{ // who leads: two groups, each ahead on its own ground, deeper as the lead grows, a line where they meet
  const l = grid((x, y) => [x, y, 2000]), D = pts(l);
  D.ch = [Float32Array.from(l, ([x]) => (x < 150 ? 0.7 : 0.375)), Float32Array.from(l, ([x]) => (x < 150 ? 0.3 : 0.625))];
  Object.assign(D, { fam: true, nb: 4, lo: 0, hi: 100, line: 1, M0: 3500, ink: 0xff010203, band: new Uint8Array(4096).map((_, k) => Math.min(3, Math.floor((100 * k) / 4095 / 10))), col: Uint32Array.from({ length: 8 }, (_, k) => (0xff000000 | (k * 25 + 20)) >>> 0) });
  const r = raster(D, J);
  assert.equal(px(r, 40, 150), D.col[0 * 4 + 3], "the first leads the left by forty");
  assert.equal(px(r, 260, 150), D.col[1 * 4 + 2], "the second leads the right by twenty-five");
}

/* ----- the contests' numbers ----- */
const num = (name) => vm.runInNewContext(`(${between(`const ${name} = {`, "\n};").replace(`const ${name} = `, "")}})`, {});
const level = vm.runInNewContext(`(${/const AXIS_LEVEL = (\{[^}]*\})/.exec(draw)[1]})`, {});
for (const f of ["lnp", "grn", "oth"]) assert.equal(level[f], Math.round(FP_ON[f] * 100), `AXIS_LEVEL.${f} is flows.mjs FP_ON`);
const rates = JSON.parse(JSON.stringify(num("AXIS_RATES"))); // (out of its vm context: strict equality reads the prototype too)
const at = (T, st, y, k) => T.states[st][k][T.years.indexOf(y)];
for (const [frame, st, y] of [["qld20", "qld", 2019], ["qld24", "qld", 2025], ["qldnow", "qld", 2025]]) {
  assert.deepEqual(rates[frame].AO, { lnp: at(ON, st, y, "coal"), grn: at(ON, st, y, "grn"), oth: at(ON, st, y, "oth") }, `${frame}: Labor v One Nation is ${st}'s ${y} Senate ballots`);
}
for (const [frame, st, y] of [["qld20", "qld", 2019], ["qld24", "qld", 2025], ["qldnow", "qld", 2025], ["sa26", "sa", 2025]]) {
  assert.deepEqual(rates[frame].CO, { alp: at(CON, st, y, "alp"), grn: at(CON, st, y, "grn"), oth: at(CON, st, y, "oth") }, `${frame}: the Coalition v One Nation is ${st}'s ${y} Senate ballots`);
}

/* ----- where the contests are offered ----- */
const frames = vm.runInNewContext(`(${/const AXIS_FRAMES = (\{[^}]*\})/.exec(draw)[1]})`, {});
const stood = (y) => { const d = JSON.parse(R(`map/data/core-${y}.json`)).divs; return d.filter((x) => x.c.some((c) => c[3] === "onp")).length / d.length; };
const NOW_OF = { now: "2025", qldnow: "qld24" };
for (const f of Object.keys(frames)) assert.ok(stood(NOW_OF[f] || f) >= 0.75, `${f}: One Nation stood in three seats in four`);
for (const f of fs.readdirSync(path.join(ROOT, "map/data")).filter((n) => /^core-\w+\.json$/.test(n)).map((n) => n.slice(5, -5))) {
  // (1998 and 2001 qualify on candidates but have no Senate ballots to read)
  if (frames[f] == null && f !== "1998" && f !== "2001") assert.ok(stood(f) < 0.75, `${f}: One Nation stood widely, so it should offer the contests`);
}
for (const y of new Set(Object.entries(frames).filter(([f]) => !/^(qld|sa)/.test(f)).map(([, v]) => v))) assert.ok(fs.existsSync(path.join(ROOT, `map/data/senate-prefs-${y}.json`)), `${y}'s Senate orders are on file`);

/* ----- the wiring ----- */
assert.ok(/closest\("[^"]*\[data-draw\][^"]*"\)/.test(ui), "the page's click handler listens for the drawing's buttons");
assert.ok(ui.includes('if (t.dataset.draw) { setDraw(t.dataset.draw); return; }'), "and acts on them");
assert.ok(ui.includes('p.set("draw", S.draw)') && ui.includes('p.get("draw")'), "the URL carries the drawing both ways");
assert.ok(ui.includes('p.set("ax", S.axis)') && ui.includes('p.get("ax")'), "the URL carries the contest both ways");
assert.ok(/for \(const dw of S\.view === "map" \? DRAWS\.map/.test(ui), "the key holds the height of its tallest drawing, so a change of drawing moves no stage");
assert.ok(ui.includes('recolor(false);\n  $$(".mp-views .rd-tab")'), "leaving the map for the chamber or the list drops a built contest's colours");
const index = R("map/index.html");
assert.ok(index.includes("Labor v One Nation and the Coalition v One Nation are not counted"), "the page's notes say what the built contests are");

console.log("test-map-draw: ok");
