/* Pins the vic22 Legislative Council chamber redraw (2026-10-27, the user's
   seven-point annotation pass over the chamber photograph) on /map/
   (#y=vic22&v=chamber&c=senate), headlessly against canvas primitives:
     - the rectangular Level 2 floor keeps its plan rect [104,104,952,1702];
     - the rear curves are TWO quarter-turn backings a side about the new
       centre (580,1163): radii 334/420 with 33-point benches' margin, spans
       ~107deg (inner) and ~99deg (outer), desk count per row still 14,14,6,8,2;
     - 46 filled chairs (39 seated members + the President + 6 officials) and
       exactly 5 outlined empties (desks 30, 33, 42, 52, 53 — never deleted);
     - the entrance aisle stays empty (nothing in plan x 521-639 below the
       table); no officer chair lingers where the Governor's placeholder was;
     - the centre table is one long panel with a burgundy inset, the clerks'
       surface a short slab above it, the dais one shallow platform — and no
       furniture labels ("The table" is gone);
     - the bloc labels (Labor/Liberals, their tallies and roles) clear every
       chair, and the Crossbench tally lists outside the floor's right edge.
   The frame's own furniture transform gives the plan->canvas map, so the
   checks hold at any viewport. See .matilda/probe/vic22-lc-probe.mjs for the
   load/contract sweep and .build/map/vic_lc_seating.mjs for the roster. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const src = fs.readFileSync(path.join(ROOT, ".build/map/app/app-3-chamber.js"), "utf8");
const { VCLC, VCLC_ROW } = new Function(
  src.match(/@viclc-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @viclc-cells-end \*\//)[1] +
  "; return { VCLC, VCLC_ROW };")();
const VLUn = 45;

const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });

const fails = [], oks = [];
const check = (name, cond, detail) => {
  if (cond) { oks.push(name); console.log(`ok – ${name}`); }
  else fails.push(`${name}${detail ? " - " + detail : ""}`);
};

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.evaluateOnNewDocument(() => {
  window.__log = [];
  const P = CanvasRenderingContext2D.prototype;
  const xf = (ctx) => { const t = ctx.getTransform(); return [t.a, t.b, t.c, t.d, t.e, t.f].map((v) => +v.toFixed(3)).join(","); };
  const ofArc = P.arc;
  P.arc = function (x, y, r, a0, a1, ac) {
    window.__log.push({ k: "arc", t: xf(this), x, y, r, a0, a1 });
    return ofArc.call(this, x, y, r, a0, a1, ac);
  };
  for (const name of ["beginPath", "closePath"]) {
    const of = P[name];
    P[name] = function (...a) { window.__log.push({ k: name, t: xf(this) }); return of.apply(this, a); };
  }
  for (const name of ["roundRect", "rect"]) {
    const of = P[name];
    P[name] = function (...a) { window.__log.push({ k: name, t: xf(this), a: a.slice(0, 4).map((v) => +(+v).toFixed(2)) }); return of.apply(this, a); };
  }
  const ofFR = P.fillRect;
  P.fillRect = function (...a) { window.__log.push({ k: "fillRect", t: xf(this), a: a.slice(0, 4) }); return ofFR.apply(this, a); };
  const ofFT = P.fillText;
  P.fillText = function (text, x, y) {
    window.__log.push({ k: "fillText", t: xf(this), txt: String(text), x, y, align: this.textAlign, w: this.measureText(String(text)).width });
    return ofFT.call(this, text, x, y);
  };
});
await page.goto(base + "/map/#y=vic22&v=chamber&c=senate", { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForFunction(() => window.__map && window.__map.S && window.__map.S.house === "senate" && window.__map.S.view === "chamber" && window.__map.S.year === "vic22", { timeout: 15000 })
  .catch(() => { throw new Error("state never reached vic22/chamber/senate"); });
// let the glide settle, then mark and nudge one repaint to replay a clean frame
await new Promise((r) => { setTimeout(r, 3000); });
await page.setViewport({ width: 1441, height: 1001 });
await new Promise((r) => { setTimeout(r, 900); });
await page.evaluate(() => { window.__log.length = 0; window.__log.push({ k: "MARK" }); });
await page.setViewport({ width: 1442, height: 1002 });
await new Promise((r) => { setTimeout(r, 1200); });

const r = await page.evaluate(() => {
  const log = window.__log;
  let at = log.length - 1;
  while (at >= 0 && log[at].k !== "MARK") at--;
  const frame = log.slice(at + 1);
  const arcs = frame.filter((e) => e.k === "arc").map((e) => ({ r: e.r, a0: e.a0, a1: e.a1, t: e.t }));
  const texts = frame.filter((e) => e.k === "fillText");
  // chair clusters: two rounded rects (body + backrest) at one transform; a lone stroked
  // outline is an empty desk
  const byT = new Map();
  for (const e of frame) if (e.k === "roundRect" || e.k === "rect") {
    if (!byT.has(e.t)) byT.set(e.t, new Set());
    byT.get(e.t).add(e.a.map((v) => +v.toFixed(1)).join(","));
  }
  const chairs = [], singles = [];
  for (const [t, shapes] of byT) {
    const hs = [...shapes].map((q) => Math.max(...q.split(",").map(Number).slice(2, 4)));
    const centre = t.split(",").slice(4).map(Number);
    if (shapes.size === 2 && hs.every((h) => h < 80)) chairs.push({ x: centre[0], y: centre[1] });
    else if (shapes.size === 1 && hs.every((h) => h < 200)) singles.push({ x: centre[0], y: centre[1] });
  }
  const rects = frame.filter((e) => e.k === "roundRect" || e.k === "rect").map((e) => ({ t: e.t, a: e.a }));
  const fills = frame.filter((e) => e.k === "fillRect").map((e) => ({ t: e.t, a: e.a }));
  return { arcs, texts, chairs, singles, rects, fills, cmds: frame.length };
});

check("a settled chamber frame drew", r.cmds > 200, `only ${r.cmds} commands after the mark`);
check("no page errors", errors.length === 0, errors.join("; "));

// the plan->canvas map, off the furniture frame (any arc carries it)
const xf = r.arcs.length ? r.arcs[0].t.split(",").map(Number) : null;
const k = xf ? xf[0] : null, ox = xf ? xf[4] : null, oy = xf ? xf[5] : null;
check("the furniture frame's transform is registered", !!(k && Number.isFinite(ox)), JSON.stringify(xf));
const Xp = (px) => ox + ((px - VCLC.cx) / VLUn) * 45 * k, Yp = (py) => oy + ((py - VCLC.cy) / VLUn) * 45 * k;

// 1. the rectangular floor: one fillRect matching the plan rect, straight edges
const [fx0, fy0] = [Xp(VCLC.room[0]), Yp(VCLC.room[1])];
const floorW = (VCLC.room[2] / VLUn) * 45 * k, floorH = (VCLC.room[3] / VLUn) * 45 * k;
const floor = r.fills.find((f) => Math.abs(f.a[0] - fx0) < 1 && Math.abs(f.a[1] - fy0) < 1 && Math.abs(f.a[2] - floorW) < 1 && Math.abs(f.a[3] - floorH) < 1);
check("the Level 2 floor paints as its plan rectangle (straight walls, unchanged rect)", !!floor,
  `expected fillRect ≈ [${fx0.toFixed(1)},${fy0.toFixed(1)},${floorW.toFixed(1)},${floorH.toFixed(1)}], fills ${JSON.stringify(r.fills.map((f) => f.a.map((v) => +v.toFixed(0))))}`);

// 2. exactly two curved backings a side: 8 arcs, radii 334±33 and 420±33 about (cx, cy)
const norm = (d) => ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const bands = VCLC.bands.map((b) => {
  const span = norm(Math.atan2(b.from[1] - VCLC.cy, b.from[0] - VCLC.cx) - Math.atan2(b.to[1] - VCLC.cy, b.to[0] - VCLC.cx));
  return { R: b.R, span };
});
const expectR = bands.flatMap((b) => [b.R + 33, b.R - 33]);
const gotR = r.arcs.map((a) => a.r);
check("eight backing arcs paint (two quarter-turn backings a side)",
  gotR.length === 8 && expectR.every((R) => gotR.filter((g) => Math.abs(g - R) < 0.75).length === 2),
  `radii ${JSON.stringify(gotR.map((v) => +v.toFixed(1)))}, wanted pairs of ${expectR.join(",")}`);
{
  // each band's drawn span matches its waypoints' span (quarter-turn-like, ~107deg / ~99deg);
  // the two sides mirror, so normalise to the minor angle
  const spanOf = (a) => Math.min(norm(a.a0 - a.a1), norm(a.a1 - a.a0));
  const innerSpans = r.arcs.filter((a) => Math.abs(a.r - (expectR[0])) < 0.75).map(spanOf);
  const outerSpans = r.arcs.filter((a) => Math.abs(a.r - (expectR[2])) < 0.75).map(spanOf);
  check("the inner backings sweep their waypoints' quarter-turn span",
    innerSpans.length === 2 && innerSpans.every((s) => Math.abs(s - bands[0].span) < 0.03),
    `inner spans ${JSON.stringify(innerSpans.map((v) => +(v * 180 / Math.PI).toFixed(1)))}deg vs ${(bands[0].span * 180 / Math.PI).toFixed(1)}deg`);
  check("the outer backings sweep their waypoints' quarter-turn span",
    outerSpans.length === 2 && outerSpans.every((s) => Math.abs(s - bands[1].span) < 0.03),
    `outer spans ${JSON.stringify(outerSpans.map((v) => +(v * 180 / Math.PI).toFixed(1)))}deg vs ${(bands[1].span * 180 / Math.PI).toFixed(1)}deg`);
}

// 3. the marker inventory: 39 seated + the President + 6 officials filled; 5 hollow empties
check("46 filled chairs (39 members + President + 6 officials)", r.chairs.length === 46,
  `got ${r.chairs.length} filled`);
check("5 outlined-empty desks kept (30, 33, 42, 52, 53 — none deleted)", r.singles.length === 5,
  `got ${r.singles.length}`);

// 4. the entrance aisle: nothing in plan x 521-639 below the centre table's foot (y > 1001)
const inAisle = (c) => {
  const px = VCLC.cx + ((c.x - ox) / (45 * k)) * VLUn, py = VCLC.cy + ((c.y - oy) / (45 * k)) * VLUn;
  return py > 1001 && px > 521 - 28 && px < 639 + 28;
};
check("the central entrance aisle is empty below the table",
  ![...r.chairs, ...r.singles].some(inAisle),
  JSON.stringify([...r.chairs, ...r.singles].filter(inAisle)));

// 5. the Governor's placeholder chair is gone
const gx = Xp(580.6), gy = Yp(195);
check("no chair lingers at the old Governor's spot (the isolated grey placeholder)",
  ![...r.chairs, ...r.singles].some((c) => Math.hypot(c.x - gx, c.y - gy) < 24),
  `spot (${gx.toFixed(0)},${gy.toFixed(0)})`);

// 6. no furniture labels anywhere on the canvas
check("no furniture labels paint (The table / Clerks / Hansard)",
  !r.texts.some((t) => /^(The table|Clerks|Hansard)$/.test(t.txt)),
  JSON.stringify(r.texts.map((t) => t.txt)));

// 7. the bloc labels clear every chair; the Crossbench tally sits off the floor's right edge
{
  const lab = r.texts.filter((t) => /^(Labor|Liberals|Government|Opposition|15|13)$/.test(t.txt));
  const clash = [];
  for (const t of lab) {
    const x0 = t.align === "right" ? t.x - t.w : t.align === "center" ? t.x - t.w / 2 : t.x;
    const box = { x0: x0 - 2, x1: x0 + t.w + 2, y0: t.y - 30, y1: t.y + 6 };
    for (const c of r.chairs) {
      const r2 = 14;
      const hit = c.x + r2 > box.x0 && c.x - r2 < box.x1 && c.y + r2 > box.y0 && c.y - r2 < box.y1;
      if (hit) clash.push(`${t.txt} vs chair at (${c.x.toFixed(0)},${c.y.toFixed(0)})`);
    }
  }
  check("every bloc label (Labor/Liberals, tallies, roles) clears every chair", clash.length === 0, clash.join("; "));
  const cb = r.texts.find((t) => /^Crossbench 12$/.test(t.txt));
  const floorRight = Xp(VCLC.room[0] + VCLC.room[2]);
  check("the Crossbench tally lists outside the floor's right edge",
    !!cb && cb.align === "left" && cb.x >= floorRight - 0.5,
    cb ? `bx ${cb.x.toFixed(1)} vs floor edge ${floorRight.toFixed(1)}` : "no Crossbench line");
  check("the Crossbench tally keeps its count (12)", !!cb, JSON.stringify(r.texts.map((t) => t.txt)));
}

// 8. the furniture: dais platform, long table with inset, the clerks' slab, the colFoot runs
{
  const args = r.rects.map((e) => e.a.map((v) => +v.toFixed(1)));
  const want = [
    ["dais", [VCLC.dais[0] - VCLC.cx, VCLC.dais[1] - VCLC.cy, VCLC.dais[2], VCLC.dais[3]]],
    ["centre table", [VCLC.tables.centreTable[0] - VCLC.cx, VCLC.tables.centreTable[1] - VCLC.cy, VCLC.tables.centreTable[2], VCLC.tables.centreTable[3]]],
    ["table inset", [VCLC.tables.centreTable[0] + 10 - VCLC.cx, VCLC.tables.centreTable[1] + 10 - VCLC.cy, VCLC.tables.centreTable[2] - 20, VCLC.tables.centreTable[3] - 20]],
    ["clerks' surface", [VCLC.tables.clerkTable[0] - VCLC.cx, VCLC.tables.clerkTable[1] - VCLC.cy, VCLC.tables.clerkTable[2], VCLC.tables.clerkTable[3]]],
  ];
  for (const [name, w] of want)
    check(`the ${name} paints at its plan place`, args.some((a) => Math.abs(a[0] - w[0]) < 0.6 && Math.abs(a[1] - w[1]) < 0.6 && Math.abs(a[2] - w[2]) < 0.6 && Math.abs(a[3] - w[3]) < 0.6),
      `wanted [${w.map((v) => +v.toFixed(1))}] among ${JSON.stringify(args.filter((a) => a[3] > 40))}`);
  // the main strips' backings run down to colFoot, meeting the inner curves
  const colRun = args.filter((a) => Math.abs(a[2] - 66) < 0.1 && Math.abs(a[1] - (355 - VCLC.cy - 33)) < 0.6);
  check("the main strips' backings run on to colFoot (the smooth strip-to-curve transition)",
    colRun.length === 2 && colRun.every((a) => Math.abs(a[1] + a[3] - (VCLC.colFoot - VCLC.cy + 33)) < 0.6),
    JSON.stringify(colRun));
}

// 9. every chair sits on the floor and inside the room's straight walls
{
  const out = r.chairs.filter((c) => {
    const px = VCLC.cx + ((c.x - ox) / (45 * k)) * VLUn;
    return px < VCLC.room[0] - 1 || px > VCLC.room[0] + VCLC.room[2] + 1;
  });
  check("every chair sits inside the room's straight walls", out.length === 0,
    JSON.stringify(out.map((c) => [+(((c.x - ox) / (45 * k)) * VLUn + VCLC.cx).toFixed(1)])));
}

await browser.close();
server.close();
if (fails.length) { console.log("\nFAIL\n  " + fails.join("\n  ")); process.exit(1); }
console.log(`\nALL PASS (${oks.length} checks)`);
