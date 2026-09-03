/* Tide-flash fix verification at the paint-cadence level.
   The bug: the boot script added body.js BEFORE createRoot().render().
   React commits asynchronously, so every frame painted between the class
   change and the first commit showed the static article transparent,
   #root empty and pulled up by --ss-h — the page collapsed to the tide
   band floating at the top of a blank screen. The user saw that frame on
   refresh as "the line art all over the screen for a moment".
   The fix: body.js is added by App's first-commit layout effect, so the
   class change and the first tree paint together.

   Asserted invariant (sampled via a requestAnimationFrame chain installed
   at document-start, i.e. one sample per painted frame):
     javascript-mounted class "js" on <body>  =>  #root has children
   Before the fix (MODE=before serves HEAD's index.html) frames with
   js=true and an empty #root MUST appear; after the fix none may.
   Also recorded per frame: document height and the tide band's top edge,
   to show the collapse geometry. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require_ = createRequire(path.join(os.homedir(), "node_modules", "."));
const puppeteer = require_("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BEFORE = process.env.MODE === "before";
const RUNS = 3;

const indexBuf = BEFORE
  ? execFileSync("git", ["show", "HEAD:index.html"], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  : null;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexBuf || fs.readFileSync(path.join(ROOT, "index.html")));
    return;
  }
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(8741, "127.0.0.1", ok));

const INSTRUMENT = `
  window.__frames = [{ boot: "assigned", t: performance.now() }];
  window.addEventListener("error", (e) => window.__frames.push({ err: String(e.message) }));
  (function tick() {
    try {
      const root = document.getElementById("root");
      const band = document.querySelector(".tile-band");
      window.__frames.push({
        t: performance.now(),
        js: document.body ? document.body.classList.contains("js") : false,
        kids: root ? root.childElementCount : -1,
        docH: document.documentElement ? document.documentElement.scrollHeight : -1,
        bandTop: band ? Math.round(band.getBoundingClientRect().top) : null,
        sy: window.scrollY,
      });
    } catch (e) {
      window.__frames.push({ boom: String(e) });
    }
    if (window.__frames.length < 600) requestAnimationFrame(tick);
  })();
`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  defaultViewport: { width: 1280, height: 800 } });

let violations = 0, framesSeen = 0;
try {
  for (let run = 0; run < RUNS; run++) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(INSTRUMENT);
    await page.goto("http://127.0.0.1:8741/", { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForSelector(".poll-table", { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));
    const frames = await page.evaluate("window.__frames");
    if (run === 0) console.log("first frames:", JSON.stringify(frames.slice(0, 4)),
      "\nlast frames:", JSON.stringify(frames.slice(-2)));
    await page.close();
    framesSeen += frames.length;
    const bad = frames.filter((f) => f.js && f.kids === 0);
    violations += bad.length;
    const firstMount = frames.find((f) => f.kids > 0);
    console.log(`run ${run}: ${frames.length} frames sampled; mount at t=${firstMount ? Math.round(firstMount.t) : "?"}ms` +
      `; js-with-empty-root frames: ${bad.length}`);
    for (const f of bad.slice(0, 6)) {
      console.log(`   t=${Math.round(f.t)}ms js=${f.js} kids=${f.kids} docH=${f.docH} bandTop=${f.bandTop} scrollY=${Math.round(f.sy)}  <-- COLLAPSED FRAME`);
    }
  }
  console.log(`\n${violations} collapsed frames across ${framesSeen} sampled (${BEFORE ? "HEAD control — expect >0" : "fixed tree — expect 0"})`);
  process.exitCode = BEFORE ? (violations > 0 ? 0 : 1) : (violations === 0 ? 0 : 1);
} finally {
  await browser.close();
  server.close();
}
