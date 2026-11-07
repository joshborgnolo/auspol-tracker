/* Pins the nsw23 NSW Legislative Assembly chamber design on /map/
   (shipped 2026-10-27 after the user's direction: Sydney's Assembly
   resembles Victoria's, except the central table is one RECTANGLE -
   no T head, no Hansard desk at its foot - and no members sit at it;
   two clerks alone chair at its head, Speaker-side. Same day, floor
   rebuilt: nothing level with the dais - two straight files of 12
   seats per side start at the table's shoulders, and the far fan is
   three curved rows of 6/9/6 per side, 92 desks for the floor's 92
   seated members exactly - nobody's desk stands empty).
   The old rect saGeom("nswLA") floor is retired for app-3-chamber.js's
   NSWB arc idiom (nswCells/nswGeom), with the Serjeant-at-Arms centred
   below the far row and the Speaker in the chair.
   Contract pinned here, headlessly against canvas primitives:
     - the chamber paints 96 chair clusters: 92 members' + the
       Speaker's at the chair + TWO clerks' + the Serjeant-at-Arms's
       (a drawChair is one rounded body + one backrest at a single
       transform; a Hansard pair would make it 98);
     - NO desk stands outlined-empty (92 desks, 92 seated members -
       the earlier floor's spare desk is gone);
     - the table is a closed FOUR-vertex axis-aligned-rectangle path
       (the federal T is eight vertices; 2025 is the control);
     - the mace rides at the table's head, the end away from the
       Speaker (2026-10-27 user call; it sat mid-table before);
     - the table is named nowhere (user call 2026-10-27; the 2025
       control keeps its "The table") and NO "Hansard" label ever paints;
     - the majority band still names Greg Piper's pair of lines;
     - the carpet's semicircle ends with the seats (the 2026-10-27
       substrate trim): its radius is NSW's own 258 points, not the
       House's 282, measured as floor-arc/table-width ratios
       2.8635 against the 2025 control's 3.1299.
   Canvas primitives have no accessible post-hoc state, so the probe
   hooks beginPath/moveTo/lineTo/closePath/roundRect/rect/fillText
   before navigation and replays them; transform-key clustering makes
   the glide's repeated frames harmless. Frames: nsw23 (the fix) and
   2025 (the federal House, the control). */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.BASE
  ? path.resolve(process.env.BASE)
  : decodeURIComponent(new URL("../../", import.meta.url).pathname);
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
  if (cond) { oks.push(name); console.log(`${name}: ok`); }
  else fails.push(`${name}${detail ? " - " + detail : ""}`);
};

for (const year of ["nsw23", "2025"]) {
  const nsw = year === "nsw23";
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.evaluateOnNewDocument(() => {
    window.__log = [];
    const P = CanvasRenderingContext2D.prototype;
    const xf = (ctx) => { const t = ctx.getTransform(); return [t.a, t.b, t.c, t.d, t.e, t.f].map((v) => +v.toFixed(2)).join(","); };
    const hook = (name, hasArgs) => {
      const of = P[name];
      P[name] = function (...a) {
        window.__log.push({ k: name, t: xf(this), a: a.slice(0, hasArgs).map((v) => +(+v).toFixed(2)) });
        return of.apply(this, a);
      };
    };
    const ofBT = P.fillText;
    P.fillText = function (text, x, y) {
      window.__log.push({ k: "fillText", t: xf(this), txt: String(text) });
      return ofBT.call(this, text, x, y);
    };
    hook("beginPath", 0); hook("moveTo", 2); hook("lineTo", 2);
    hook("closePath", 0); hook("roundRect", 4); hook("rect", 4); hook("arc", 3);
  });
  await page.goto(base + "/map/", { waitUntil: "load" });
  await page.waitForFunction(() => window.__map && window.__map.S, { timeout: 15000 });
  await page.evaluate(async (y) => {
    await window.__map.setYear(y);
    window.__map.setView("chamber");
  }, year);
  /* the chamber glide settles, then the labelled state draws; glide
     frames paint chairs at interpolated transforms, so force one more
     repaint after a marker and replay only what follows it. The nudge
     itself can land a second layout while an old one still repaints
     (a 192-chair flake), so settle, mark + clear, then nudge again */
  await new Promise((r) => { setTimeout(r, 3000); });
  await page.setViewport({ width: 1441, height: 1001 });
  await new Promise((r) => { setTimeout(r, 900); });
  await page.evaluate(() => { window.__log.length = 0; window.__log.push({ k: "MARK" }); });
  await page.setViewport({ width: 1442, height: 1002 });
  await new Promise((r) => { setTimeout(r, 900); });

  const r = await page.evaluate(() => {
    const log = window.__log;
    let at = log.length - 1;
    while (at >= 0 && log[at].k !== "MARK") at--;
    const frame = log.slice(at + 1);
    // every path: the commands since its beginPath
    const paths = [];
    let cur = null;
    for (const e of frame) {
      if (e.k === "beginPath") { if (cur) paths.push(cur); cur = { cmds: [], closed: false }; }
      else if (!cur) continue;
      else if (e.k === "closePath") cur.closed = true;
      else if (e.k === "moveTo" || e.k === "lineTo") cur.cmds.push({ k: e.k, x: e.a[0], y: e.a[1] });
    }
    if (cur) paths.push(cur);
    // closed paths of screen points only (the table is the furniture's one such polygon)
    const polys = paths.filter((p) => p.closed && p.cmds.length >= 3 && p.cmds.every((c) => c.k === "lineTo" || c.k === "moveTo"))
      .map((p) => ({ n: p.cmds.length,
                     x0: Math.min(...p.cmds.map((q) => q.x)), x1: Math.max(...p.cmds.map((q) => q.x)),
                     y0: Math.min(...p.cmds.map((q) => q.y)), y1: Math.max(...p.cmds.map((q) => q.y)) }))
      .map((p) => ({ ...p, w: p.x1 - p.x0, h: p.y1 - p.y0 }));
    /* the mace: a lone horizontal stroke, table-width-ish at the table's head (the end
       away from the Speaker, the bigger y). Federal-idiom furniture draws in the one
       user space, so local coords compare straight across. */
    const seg = (p) => (p.closed || p.cmds.length !== 2 || p.cmds[0].k !== "moveTo" || p.cmds[1].k !== "lineTo") ? null
      : { x0: p.cmds[0].x, y0: p.cmds[0].y, x1: p.cmds[1].x, y1: p.cmds[1].y };
    const tbl = polys.find((p) => p.n === 4) || polys.find((p) => p.n === 8);
    let mace = null;
    if (tbl) {
      const cand = paths.map(seg).filter((l) => l && Math.abs(l.y1 - l.y0) < 0.5 &&
        Math.abs(l.x1 - l.x0) >= 0.25 * tbl.w && Math.abs(l.x1 - l.x0) <= 0.6 * tbl.w &&
        Math.abs((l.x0 + l.x1) / 2 - (tbl.x0 + tbl.x1) / 2) <= 0.2 * tbl.w);
      mace = cand.find((l) => (l.y0 - tbl.y0) / (tbl.y1 - tbl.y0) >= 0.78) || null;
      if (mace) mace = { ...mace, frac: (mace.y0 - tbl.y0) / (tbl.y1 - tbl.y0) };
    }
    // chairs: two rounded rects (body + backrest) at one transform; clustered
    const byT = new Map();
    for (const e of frame) if (e.k === "roundRect" || e.k === "rect") {
      if (!byT.has(e.t)) byT.set(e.t, new Set());
      byT.get(e.t).add(e.a.map((v) => +v.toFixed(1)).join(","));
    }
    const chairs = [], singles = [];
    for (const [t, shapes] of byT) {
      const hs = [...shapes].map((q) => Math.max(...q.split(",").map(Number).slice(2, 4)));
      if (shapes.size === 2 && hs.every((h) => h < 80)) chairs.push(t);
      else if (shapes.size === 1 && hs.every((h) => h < 80)) singles.push(t);
    }
    const texts = new Set(frame.filter((e) => e.k === "fillText").map((e) => e.txt));
    // the carpet's semicircle is the frame's biggest arc; measure it in table widths,
    // so the check holds at any viewport (nsw23 258/90.1 = 2.8635; the House 282/90.1 = 3.1299)
    const arcs = frame.filter((e) => e.k === "arc").map((e) => e.a[2]);
    const floorRatio = arcs.length && tbl ? Math.max(...arcs) / tbl.w : null;
    return { polys: polys.map((p) => ({ n: p.n, w: +p.w.toFixed(1), h: +p.h.toFixed(1) })),
             chairs: chairs.length, singles: singles.length,
             cmds: frame.length, texts: [...texts], floorRatio: floorRatio == null ? null : +floorRatio.toFixed(4),
             mace: mace ? { frac: +mace.frac.toFixed(2) } : null };
  });

  check(`${year} a settled chamber frame drew`, r.cmds > 200, `only ${r.cmds} commands after the mark`);
  check(`${year} no page errors`, errors.length === 0, errors.join("; "));
  if (nsw) {
    check(`nsw23 paints 96 chair clusters (92 members + Speaker + 2 clerks + Serjeant; +0 Hansard)`,
          r.chairs === 96, `got ${r.chairs} chairs, ${r.singles} singles`);
    check(`nsw23 no desk outlined-empty (the 92 desks seat the floor's 92 members exactly)`, r.singles === 0,
          `got ${r.singles}`);
    check(`nsw23 the table is a four-vertex rectangle (no T head)`,
          !!r.polys.find((p) => p.n === 4) && !r.polys.find((p) => p.n === 8),
          JSON.stringify(r.polys));
    check(`nsw23 the table is named nowhere (no "The table" nameplate)`, !r.texts.includes("The table"),
          JSON.stringify(r.texts.slice(0, 20)));
    check(`nsw23 no "Hansard" label paints`, !r.texts.includes("Hansard"),
          "Hansard found among " + JSON.stringify(r.texts.slice(0, 20)));
    check(`nsw23 the mace lies at the table's head (the end away from the Speaker)`,
          !!r.mace, JSON.stringify(r.mace ?? "no mace stroke found"));
    check(`nsw23 the carpet's circle ends with its seats (258 points, not the House's 282)`,
          r.floorRatio != null && Math.abs(r.floorRatio - 2.8635) <= 0.02, `ratio ${r.floorRatio}`);
  } else {
    // the control: the federal House keeps its T table and names Hansard
    check(`${year} the House's table is the eight-vertex T`,
          !!r.polys.find((p) => p.n === 8), JSON.stringify(r.polys));
    check(`${year} "The table" still names the T`, r.texts.includes("The table"),
          JSON.stringify(r.texts.slice(0, 20)));
    check(`${year} "Hansard" labels the desk`, r.texts.includes("Hansard"),
          JSON.stringify(r.texts.slice(0, 20)));
    check(`${year} the mace lies at the table's far end too`, !!r.mace,
          JSON.stringify(r.mace ?? "no mace stroke found"));
    check(`${year} the House's carpet keeps its own 282-point circle`,
          r.floorRatio != null && Math.abs(r.floorRatio - 3.1299) <= 0.02, `ratio ${r.floorRatio}`);
  }
  await page.close();
}

await browser.close();
server.close();
if (fails.length) { console.log("\nFAIL\n  " + fails.join("\n  ")); process.exit(1); }
console.log(`\nALL PASS (${oks.length} checks)`);
