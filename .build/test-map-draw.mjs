/* test-map-draw.mjs – pins /map/'s drawings (app-2b-draw.js): seats, balloons and the surface.

   - surfaceEngine, the field and its pictures, is a worker's text: it runs here in a bare vm
     context, so anything it reached for outside itself would fail. On small made-up elections
     it must give back what went in: a flat field, a line where two sides meet, the votes'
     weight, and no neighbourhood claimed by a handful of votes.
   - there is one field: what a spot reads can't turn on the zoom, the window or what was
     asked before it, and a picture at any grain shows the same side (a reader found a seat's
     patch flipping sides as they zoomed, and two answers at one zoom, on 2026-11-06).
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
const src = between("function surfaceEngine() {", "\n/* ----- the rasters -----");
const engine = () => vm.runInNewContext(`(${src})()`, {});
const E = engine(), raster = E.raster;
const pts = (list) => {
  const n = list.length, D = { u: 1, n, x: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n), late: new Float32Array(n), bx0: Infinity, by0: Infinity, bx1: -Infinity, by1: -Infinity };
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
const J = { px: 1, x0: 0, y0: 0, nx: 300, ny: 300, lw: 1.5 };
const px = (r, x, y) => new Uint32Array(r.rgba)[y * J.nx + x];
const grid = (fn) => { const l = []; for (let y = 10; y < 300; y += 40) for (let x = 10; x < 300; x += 40) l.push(fn(x, y)); return l; };

{ // the same figure everywhere gives one colour and no line
  const l = grid((x, y) => [x, y, 2000]), D = steps(pts(l), 50); D.ch = [Float32Array.from(l, () => 62)];
  const r = raster(D, J), a = new Uint32Array(r.rgba);
  assert.ok(a.every((c) => c === a[0]), "a flat reading is one colour");
  assert.equal(a[0], D.col[6], "in its own step");
  assert.ok(Math.abs(E.at(D, 150, 150)[0] - 62) < 1e-3, "and reads as itself");
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
  const v = E.at(D, 150, 150)[0];
  assert.ok(Math.abs(v - 40) < 2, `the big place's figure leads (${v.toFixed(1)})`);
}
{ // a handful of votes can't claim a neighbourhood: the level above speaks for it
  const l = [...grid((x, y) => [x, y, 3000]).filter(([x, y]) => Math.hypot(x - 150, y - 150) > 70), [150, 150, 10]];
  const D = steps(pts(l), null); D.ch = [Float32Array.from(l, (q, k) => (k === l.length - 1 ? 95 : 40))];
  const v = E.at(D, 150, 150)[0];
  assert.ok(v < 50, `ten votes at 95 don't move the ground around them (${v.toFixed(1)})`);
}
{ // where nobody voted the field still reaches, smoothly, from the nearest places
  const l = [[20, 150, 9000], [280, 150, 9000]], D = steps(pts(l), null); D.ch = [Float32Array.from([20, 80])];
  const mid = E.at(D, 150, 150)[0];
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

{ // one field: a small town of one side in a big district of the other, as a Hume in Sydney's shadow
  const l = [], at = [];
  for (let y = 10; y < 900; y += 30) for (let x = 10; x < 900; x += 30) { if (Math.hypot(x - 450, y - 450) < 60) continue; l.push([x, y, 9000]); at.push(70); } // the district, at 70
  for (const [x, y] of [[450, 450], [444, 456], [456, 444], [456, 456], [444, 444]]) { l.push([x, y, 3000]); at.push(25); } // the town, at 25
  const D = steps(pts(l), 50); D.ch = [Float32Array.from(at)];
  const read = () => [...E.at(D, 450, 450)], first = read();
  assert.ok(first[0] < 50, `the town keeps its own side (${first[0].toFixed(1)})`);
  // every grain, every window, either way, wide or close, with a stranger's question in between
  const looks = [];
  for (const px of [4, 2.83, 2, 1.41, 1, 0.71, 0.5, 0.25, 0.125, 0.5, 2, 4]) {
    const nx = 3 * Math.ceil(600 / 3), c = 3 * px, x0 = Math.floor((450 - (nx * px) / 2) / c) * c, y0 = Math.floor((450 - (nx * px) / 2) / c) * c;
    const r = raster(D, { px, x0, y0, nx, ny: nx, lw: 1.5 }), a = new Uint32Array(r.rgba);
    looks.push((a[Math.round((450 - y0) / px) * nx + Math.round((450 - x0) / px)] & 255));
    assert.deepEqual(read(), first, `at grain ${px} the spot reads what it read`);
  }
  assert.ok(looks.every((v) => v < 110), `the picture holds the town's side at every grain (its side's steps are under 110): ${looks.join(" ")}`);
  const other = engine(), D2 = steps(pts(l), 50); D2.ch = [Float32Array.from(at)];
  other.at(D2, 10, 10); other.at(D2, 880, 880);
  assert.equal(other.at(D2, 450, 450)[0], first[0], "a fresh engine, asked in another order, gives the same figure to the digit");
}
{ // a frame's scale is in kilometres: the same places at a different scale give the same reading
  const l = [...grid((x, y) => [x, y, 2000]), [150, 150, 9000]], val = l.map(([x], k) => (k === l.length - 1 ? 20 : x < 150 ? 40 : 60));
  const A = steps(pts(l), 50); A.ch = [Float32Array.from(val)];
  const B = steps(pts(l.map(([x, y, w]) => [x * 2, y * 2, w])), 50); B.u = 2; B.ch = [Float32Array.from(val)];
  assert.ok(Math.abs(E.at(A, 150, 150)[0] - E.at(B, 300, 300)[0]) < 0.05, "a kilometre is a kilometre on any frame's plane");
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

/* ----- the Greens pairings ----- */
{ // menued on the federal frames only: they read the ballot files' own tallies (54 counts a row), which the constant-rate state frames' series don't carry
  assert.ok(ui.includes('const AXIS_GREEN_PAIRS = [["GO", "Greens v One Nation"], ["GA", "Greens v Labor"], ["GC", "Greens v the Coalition"]];') || draw.includes('const AXIS_GREEN_PAIRS = [["GO", "Greens v One Nation"], ["GA", "Greens v Labor"], ["GC", "Greens v the Coalition"]];'), "the three Greens pairings are menued: against One Nation, Labor, the Coalition");
  assert.ok(draw.includes("...(m && STATE_YEARS.has(m.year) ? [] : AXIS_GREEN_PAIRS)]"), "the Greens pairings ride only the federal frames' menus");
  assert.ok(draw.includes('const axisOffers = (m, pair) => SP_PAIRS[pair] != null && (!AXIS_GREEN_SET.has(pair) || !STATE_YEARS.has(m.year));'), "a pairing is offered only where its evidence carries it");
  assert.ok(draw.includes('return axisOffers(m, S.axis) ? S.axis : "AC";'), "a pairing the frame can't carry falls back to the count, the choice kept for the walk back");
  assert.ok(draw.includes('pair === "CO" || pair === "GO" ? 40 : 30'), "the One Nation pairings run the long-spread scale, the others' the usual");
  assert.ok(draw.includes('(cap ? "The Greens" : "the Greens")'), "a pairing names its Greens");
  assert.ok(ui.includes("axisOpts(m)"), "the key's contest menu is the frame's own");
  assert.ok(ui.includes("!AXIS_GREEN_SET.has(spp)"), "the Senate preferences lens keeps its own three (a crafted Greens sp address can't reach it)");
  for (const y of [2022, 2025]) {
    const f = JSON.parse(R(`map/data/senate-prefs-${y}.json`));
    assert.deepEqual(f.pairs, ["AC", "AO", "CO", "GO", "GA", "GC"], `senate-prefs-${y}'s slots run AC AO CO GO GA GC, the order the app's k0 walks`);
    assert.ok(f.donors.GO.join() === "alp,lnp,oth" && f.donors.GA.join() === "lnp,onp,oth" && f.donors.GC.join() === "alp,onp,oth", `senate-prefs-${y}: each Greens pairing tallies the three groups whose preferences decide it`);
  }
  // where a seat really ran the pairing, its count stands: Melbourne's 2025 final two were Labor and
  // the Greens, Ryan's the LNP and the Greens
  const core25 = JSON.parse(R("map/data/core-2025.json"));
  const finalFams = (n) => { const d = core25.divs.find((x) => x.n === n); return d.tcp.map(([i]) => d.c[i][3]).sort().join("+"); };
  assert.equal(finalFams("Melbourne"), "alp+grn", "Melbourne 2025's final two were Labor and the Greens, the count Greens v Labor reads there");
  assert.equal(finalFams("Ryan"), "grn+lnp", "Ryan 2025's final two were the LNP and the Greens, the count Greens v the Coalition reads there");
  assert.ok(draw.includes("fs.includes(fa) && fs.includes(fb)"), "a seat whose final two was the pairing keeps its count inside it");
}

/* ----- the wiring ----- */
assert.ok(/closest\("[^"]*\[data-draw\][^"]*"\)/.test(ui), "the page's click handler listens for the drawing's buttons");
assert.ok(ui.includes('if (t.dataset.draw) { setDraw(t.dataset.draw); return; }'), "and acts on them");
assert.ok(ui.includes('p.set("draw", S.draw)') && ui.includes('p.get("draw")'), "the URL carries the drawing both ways");
assert.ok(ui.includes('p.set("ax", S.axis)') && ui.includes('p.get("ax")'), "the URL carries the contest both ways");
assert.ok(!/for \(const dw of S\.view === "map" \? DRAWS\.map/.test(ui) && /for \(const dw of \[S\.draw\]\)/.test(ui), "the key holds only the current drawing's booth faces, so slimmer views stop inheriting taller surfaces' peaks");
assert.ok(ui.includes('recolor(false);\n  $$(".mp-views .rd-tab")'), "leaving the map for the chamber or the list drops a built contest's colours");
const index = R("map/index.html");
assert.ok(index.includes("Labor v One Nation, the Coalition v One Nation, and the Greens v One Nation, Labor and the Coalition are not counted"), "the page's notes name the built contests, the Greens pairings among them");

/* ----- the zoom carries on past the gesture, the same in every browser -----
   (it went missing in Chrome and Firefox for ten days: their pinch sends no lift, so it had been
   switched off for them. The pace rule runs here on made-up streams; real input is in
   .matilda/probe/map-zoom-residual.mjs) */
const mapSrc = R(".build/map/app/app-2-map.js");
const rule = /function pinchPace\(ss, beat\) \{[\s\S]*?\n\}\n/.exec(mapSrc)[0];
const consts = /Z_NOW = (\d+)[\s\S]*?Z_BEFORE = (\d+)/.exec(mapSrc);
const pinchPace = vm.runInNewContext(`const Z_NOW = ${consts[1]}, Z_BEFORE = ${consts[2]}; const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }; (${rule.trim()})`, { Math });
const stream = (ds, beat = 16) => ds.map((d, i) => [i * beat, d]);
const flat = (n, d) => Array.from({ length: n }, () => d);
assert.ok(Math.abs(pinchPace(stream(flat(26, 0.087)), 16) - 5.4) < 0.3, "lifted in motion, it carries on at that pace");
assert.ok(Math.abs(pinchPace(stream(flat(26, -0.087)), 16) + 5.4) < 0.3, "out as well as in");
assert.ok(Math.abs(pinchPace(stream(flat(20, 0.087), 65), 65) - 1.34) < 0.1, "at a busy map's slow beat too");
assert.ok(pinchPace(stream([...flat(22, 0.087), ...[0.9, 0.8, 0.7, 0.6, 0.55, 0.5].map((f) => 0.087 * f)]), 16) > 2, "slowing but still moving at the lift, it carries on");
assert.ok(pinchPace(stream([...flat(22, 0.087), ...[1, 0.8, 0.6, 0.42, 0.28, 0.17, 0.09, 0.04].map((f) => 0.087 * f)]), 16) < 0.6, "coming to rest, it doesn't");
assert.equal(pinchPace(stream([0.087, 0.087]), 16), 0, "a twitch has no pace to read");
assert.ok(mapSrc.includes("pinchStep(px, py, -e.deltaY / (100 * Math.LN2), e.timeStamp);"), "a ctrl-wheel pinch (Chrome, Firefox) feeds the release");
assert.equal((mapSrc.match(/zoomRelease\(/g) || []).length, 3, "the one release rule serves the ctrl-wheel pinch, Safari's and a phone's");
assert.ok(!/navigator\.userAgent|isSafari|isChrome|isFirefox/.test(mapSrc), "nothing in the map turns on the browser");

console.log("test-map-draw: ok");
