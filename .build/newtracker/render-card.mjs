/* render-card.mjs – run make-card.js for real, so the share card stops being
   a hand step.

   make-card.js has to execute inside the built page: it reads window.AUSPOL,
   which is what keeps the card from contradicting the page it previews. That
   made regeneration manual – serve the repo, open the page, paste the file
   into the console, save the image – and the card fell behind twice over: it
   kept a github.io footer through a whole domain move, and its figures
   drifted while build.mjs's date check still reported it current.

   So this drives the same file in real Chrome instead of a person doing it. It
   serves the repo on an ephemeral port, opens index.html headless, evaluates
   make-card.js, and photographs the card it builds: one 1200x630 element
   pinned over the page's corner, at a device scale of 1. Nothing about the
   card lives here – make-card.js is still the only place it is designed, and
   it loads and checks its own face (Doto, from .build/newtracker/fonts/).

     node .build/newtracker/render-card.mjs   # rewrites the png and the json
     node .build/newtracker/build.mjs         # re-stamps og:image with the date

   Chrome and puppeteer-core are the only things it needs, and neither is a
   build dependency: the toolchain is plain node and stays that way, so
   build.mjs never imports this. When either is missing this says so and points
   at the console steps in the make-card.js header, which still work. Override
   the browser with CHROME=/path/to/chrome. */

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const CARD = path.join(ROOT, "assets", "auspol-card.png");
const STAMP = path.join(ROOT, "assets", "auspol-card.json");
const LATEST = path.join(ROOT, "assets", "auspol-latest.json");
const CHROME = process.env.CHROME
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const die = (msg) => { console.error("render-card: " + msg); process.exit(1); };

/* Staleness gate, before any dependency probing: drawing again buys nothing
   when the date AND the figures the card shows are both what build.mjs last
   wrote into auspol-latest.json, so exit before puppeteer or Chrome are
   even looked for. That is what lets every wrapper call this unconditionally
   between its builds, and lets machines with no browser skip quietly when
   there is nothing to draw. A stamp without the fig block (pre-gate format)
   and a missing auspol-latest.json both fall through to a draw. */
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const drawn = readJson(STAMP), latestMeta = readJson(LATEST);
if (drawn && latestMeta && drawn.publishedISO === latestMeta.publishedISO
    && drawn.fig && latestMeta.fig
    && JSON.stringify(drawn.fig) === JSON.stringify(latestMeta.fig)) {
  console.log("card current (" + drawn.publishedISO + "; figures unchanged) – nothing to do");
  process.exit(0);
}
console.log("card stale or unstamped – drawing"
  + (drawn && latestMeta && drawn.publishedISO === latestMeta.publishedISO
     ? " (same date; figures moved)" : ""));

/* puppeteer-core is pinned in the root package.json (the repo's one declared
   dependency; the BUILD itself stays dependency-free — build.mjs never
   imports this script, which runs a few times a month). Look for it where a
   machine that has it would have it — npm ci installs to repo node_modules,
   an ad-hoc npm i lands in ~ — and fail helpfully when it is absent. */
const require_ = createRequire(path.join(ROOT, "render-card.mjs"));
const requireHome = createRequire(path.join(os.homedir(), "node_modules", "."));
let puppeteer = null;
for (const r of [require_, requireHome]) {
  try { puppeteer = r("puppeteer-core"); break; } catch { /* keep looking */ }
}
if (!puppeteer) die("puppeteer-core not found (npm i -g puppeteer-core, or draw\n"
  + "  the card by hand – see the TO REGENERATE note in make-card.js).");
if (!fs.existsSync(CHROME)) die("no Chrome at " + CHROME + "\n  (set CHROME=/path/to/chrome).");

const src = fs.readFileSync(path.join(HERE, "make-card.js"), "utf8");
/* The card's design, as a hash of make-card.js and its face, joins the fig
   block in the stamp. Without it a change to how the card looks left the
   figures – and so the staleness gate and the og:image ?v= key – where they
   were: no redraw, and scrapers serving the old design from cache.
   Mirror: build.mjs's CARD_DESIGN hashes the same two files. */
const DESIGN = crypto.createHash("sha1")
  .update(fs.readFileSync(path.join(HERE, "make-card.js")))
  .update(fs.readFileSync(path.join(HERE, "fonts", "doto-card.woff2")))
  .digest("hex").slice(0, 8);
if (!fs.existsSync(path.join(ROOT, "index.html")))
  die("no index.html – run build.mjs first; the card is drawn from the built page.");

/* Same static server as .claude/serve.js, minus the preview niceties, on an
   ephemeral port so it never collides with one the user has running. */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".jpg": "image/jpeg",
};
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = "http://127.0.0.1:" + server.address().port + "/";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
  defaultViewport: { width: 1400, height: 1000 },
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("  [page] " + e.message));

  await page.goto(origin, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction("!!(window.AUSPOL && window.AUSPOL.latest)", { timeout: 60000 });
  await page.evaluate("document.fonts.ready.then(() => 0)");

  /* make-card.js loads its face and refuses to build the card when it cannot:
     a fallback font would put system glyphs on an LED board. That refusal, or
     any other failure, comes back as window.__auspolCard.error. */
  await page.evaluate(src + "\nundefined;");
  await page.waitForFunction("!!window.__auspolCard", { timeout: 60000 });
  const { error, selector, publishedISO, fig } = await page.evaluate("window.__auspolCard");
  if (error) die("make-card.js failed: " + error + "\n  refusing to draw.");

  const card = await page.$(selector);
  const box = card && await card.boundingBox();
  if (!box || Math.round(box.width) !== 1200 || Math.round(box.height) !== 630)
    die("the card is not a 1200x630 element (" + (box ? box.width + "x" + box.height : "missing") + ")");
  const buf = Buffer.from(await card.screenshot({ type: "png" }));
  fs.writeFileSync(CARD, buf);
  /* WhatsApp is reported to skip a link preview whose image is over ~300 KB,
     and the LED texture is the expensive part of this one. Say so loudly
     rather than ship a card one big app won't show. */
  if (buf.length > 300 * 1024) console.warn("  ! the card is " + (buf.length / 1024).toFixed(0)
    + " KB; some chat apps drop og:images over ~300 KB");
  // The fig block is what the staleness gate above compares against
  // build.mjs's auspol-latest.json — it must be written with the date so
  // figure drift (and not just new polls) triggers the next redraw.
  fs.writeFileSync(STAMP, JSON.stringify({ publishedISO, fig: { ...fig, design: DESIGN } }) + "\n");
  console.log("drew assets/auspol-card.png · " + (buf.length / 1024).toFixed(0)
    + " KB · data dated " + publishedISO);
  console.log("stamped assets/auspol-card.json · run build.mjs to re-stamp og:image");
} finally {
  await browser.close();
  server.close();
}
