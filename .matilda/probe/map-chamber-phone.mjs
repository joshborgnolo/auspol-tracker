/* Pins the phone-band label geometry on the /map/ chamber view
   (shipped 2026-10-27 after the user's phone report: nsw23's
   "Crossbench 11" read as overlapping the "Speaker" label at 390px -
   the ship-time baselines y0-46 / y0-34 / y0-12 left a 3px ink gap).
   Contract now pinned, per lower-house frame:
     - the Crossbench label's ink stays >= 2px inside the canvas top
       (the arc chambers pin y0 = 62 at every phone width; y0-50 puts
       its ink top at 3.9);
     - >= 6px of ink gap between Crossbench and the Speaker role line
       and >= 7px between the role and the Speaker's name;
     - where the band is off (wide phones with a side column), whatever
       of the Crossbench/Speaker labels still paints in the top strip
       (the Speaker's role line labels the chair there) stays fully
       in-canvas - band off is a valid state, never a clip.
   Canvas text has no DOM boxes, so every fillText on the stage canvas
   is captured and its ink box rebuilt from measureText with the
   recorded font. Frames: nsw23, sa26 and 2025 (all arc or arc-adjacent
   floors; nsw23's Assembly moved to app-3-chamber.js's NSWB arc idiom
   2026-10-27, retiring the rect floor whose band moved with width).
   Serve another tree with BASE=... for a detached comparison. */
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

/* (frame, widths as [px, bandOn], presiding name prefix) - every lower
   house now draws on an arc-style geometry whose band pins y0 = 62, so
   one band-on rung proves each; nsw23 keeps the 760 rung to pin the
   band-OFF state (side column has room - shared by every idiom now) */
const FRAMES = [
  ["nsw23", [[390, 1], [760, 0]], "Greg Piper"],
  ["sa26", [[390, 1]], "Nat Cook"],
  ["2025", [[390, 1]], "Milton Dick"],
];

for (const [year, widths, pres] of FRAMES) {
  for (const [W, bandOn] of widths) {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: 844, isMobile: true });
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    await page.evaluateOnNewDocument(() => {
      window.__fills = [];
      const P = CanvasRenderingContext2D.prototype;
      const of = P.fillText;
      P.fillText = function (text, x, y, mx) {
        window.__fills.push({ t: String(text), x, y, font: this.font,
                              align: this.textAlign, base: this.textBaseline,
                              cw: this.canvas.clientWidth | 0 });
        return of.call(this, text, x, y, mx);
      };
    });
    await page.goto(base + "/map/", { waitUntil: "load" });
    await page.waitForFunction(() => window.__map && window.__map.S, { timeout: 15000 });
    await page.evaluate(async (y) => {
      await window.__map.setYear(y);
      window.__fills.length = 0;    // chamber-only capture from here
      window.__map.setView("chamber");
    }, year);
    /* the chamber glide settles, then the labelled state draws */
    await new Promise((r) => { setTimeout(r, 2600); });

    const r = await page.evaluate(() => {
      const fills = window.__fills;
      const cv = document.createElement("canvas").getContext("2d");
      const byKey = new Map();
      for (const f of fills) byKey.set(f.t + " " + f.font, f);
      const box = (f) => {
        cv.font = f.font;
        const m = cv.measureText(f.t);
        const px = +(/(\d+)px/.exec(f.font)[1]);
        const w = m.width, a = m.actualBoundingBoxAscent || px * 0.75,
              d = m.actualBoundingBoxDescent || px * 0.25;
        const x0 = f.align === "center" ? f.x - w / 2 : f.align === "right" ? f.x - w : f.x;
        let y0, y1;
        if (f.base === "alphabetic" || f.base === "ideographic") { y0 = f.y - a; y1 = f.y + d; }
        else if (f.base === "middle") { y0 = f.y - (a + d) / 2; y1 = f.y + (a + d) / 2; }
        else if (f.base === "bottom") { y0 = f.y - a - d; y1 = f.y; }
        else { y0 = f.y; y1 = f.y + a + d; }
        return { t: f.t, x0, x1: x0 + w, y0, y1, font: f.font };
      };
      const boxes = [...byKey.values()].map(box);
      const cross = boxes.find((b) => /^Crossbench \d+$/.test(b.t));
      const role = boxes.find((b) => b.t === "Speaker");
      /* the Speaker's NAME is the topmost 12px line under the role line
         (its baseline rides 22px below the role's); the band's bloc
         labels (Government, Opposition) are 12px too and sit lower */
      const name = role && boxes
        .filter((b) => b !== role && b.font.startsWith("12px") &&
                       !/^(Government|Opposition|Crossbench)/.test(b.t) &&
                       b.y0 > role.y0 && b.y0 < role.y0 + 36)
        .sort((a, b) => a.y0 - b.y0)[0];
      const bandZone = boxes.filter((b) => /^(Crossbench \d+|Speaker)$/.test(b.t) && b.y0 < 80);
      return { cross, role, name, bandZone };
    });

    const tag = `${year} @${W}`;
    if (bandOn) {
      check(`${tag} crossbench + speaker band renders`, !!(r.cross && r.role && r.name),
            JSON.stringify({ cross: !!r.cross, role: !!r.role, name: !!r.name }));
      if (r.cross && r.role && r.name) {
        check(`${tag} crossbench ink stays in-canvas`, r.cross.y0 >= 2,
              "ink top " + r.cross.y0.toFixed(1));
        check(`${tag} crossbench -> speaker gap >= 6px`, r.role.y0 - r.cross.y1 >= 6,
              "gap " + (r.role.y0 - r.cross.y1).toFixed(1));
        check(`${tag} speaker -> name gap >= 7px`, r.name.y0 - r.role.y1 >= 7,
              "gap " + (r.name.y0 - r.role.y1).toFixed(1));
        check(`${tag} names the presiding member`, r.name.t.startsWith(pres), JSON.stringify(r.name.t));
      }
    } else {
      check(`${tag} band off: strip labels stay in-canvas`,
            r.bandZone.every((b) => b.y0 >= 2), JSON.stringify(r.bandZone));
    }
    check(`${tag} no page errors`, errors.length === 0, errors.join("; "));
    await page.close();
  }
}

await browser.close();
server.close();
if (fails.length) { console.log("\nFAIL\n  " + fails.join("\n  ")); process.exit(1); }
console.log(`\nALL PASS (${oks.length} checks)`);
