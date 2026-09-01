/* render-card.mjs – run make-card.js for real, so the share card stops being
   a hand step.

   make-card.js has to execute inside the built page: it reads window.AUSPOL,
   which is what keeps the card from contradicting the page it previews, and it
   draws with the site's own webfonts, which canvas text picks up only from a
   document that has already loaded them. That made regeneration manual – serve
   the repo, open the page, paste the file into the console, move the download
   – and the card fell behind twice over: it kept a github.io footer through a
   whole domain move, and its figures drifted while build.mjs's date check
   still reported it current.

   So this drives the same file in real Chrome instead of a person doing it. It
   serves the repo on an ephemeral port, opens index.html headless, evaluates
   make-card.js with its download tail neutered, and lifts the PNG back out of
   window.__auspolCard. Nothing about the drawing lives here – make-card.js is
   still the only place the card is designed.

     node .build/newtracker/render-card.mjs   # rewrites the png and the json
     node .build/newtracker/build.mjs         # re-stamps og:image with the date

   Chrome and puppeteer-core are the only things it needs, and neither is a
   build dependency: the toolchain is plain node and stays that way, so
   build.mjs never imports this. When either is missing this says so and points
   at the console steps in the make-card.js header, which still work. Override
   the browser with CHROME=/path/to/chrome. */

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
const CHROME = process.env.CHROME
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const die = (msg) => { console.error("render-card: " + msg); process.exit(1); };

/* There is no package.json to declare puppeteer-core in, and adding one to pull
   a browser driver into a build that is otherwise dependency-free is a bad
   trade for a script that runs a few times a month. So look for it where a
   machine that has it would have it, and fail helpfully when it is absent. */
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

  /* The whole reason the card is drawn in the page rather than rasterised from
     an SVG is the typefaces; a run that silently fell back to system fonts
     would reintroduce exactly the off-brand drift this replaced.

     Ask for them explicitly before checking - make-card.js names the SHIPPED
     faces directly rather than going through --serif/--sans, so the canvas
     draw gets the webfont even if the page above the fold hasn't yet asked
     for the weight or style the card needs. A file that genuinely cannot
     load fails the check below. */
  const FACES = ["Source Serif 4", "IBM Plex Sans", "Source Sans 3"]; // SS3: the wordmark only
  await page.evaluate(`Promise.all(${JSON.stringify(FACES)}.flatMap(
    (f) => ["400", "600", "700"].map((w) => document.fonts.load(w + ' 60px "' + f + '"'))
  )).then(() => 0)`);
  const missing = await page.evaluate(`${JSON.stringify(FACES)}
    .filter(f => !document.fonts.check('400 60px "' + f + '"'))`);
  if (missing.length) die("webfont not loaded: " + missing.join(", ")
    + "\n  refusing to draw – the card would fall back to system fonts.");

  /* make-card.js ends by clicking a download link, which is the right ending
     for a human at a console and the wrong one here. */
  await page.evaluate("HTMLAnchorElement.prototype.click = function () {};\n"
    + src + "\nundefined;");
  await page.waitForFunction("!!window.__auspolCard", { timeout: 60000 });
  const { png, publishedISO } = await page.evaluate("window.__auspolCard");

  const buf = Buffer.from(png.replace(/^data:image\/png;base64,/, ""), "base64");
  fs.writeFileSync(CARD, buf);
  fs.writeFileSync(STAMP, JSON.stringify({ publishedISO }) + "\n");
  console.log("drew assets/auspol-card.png · " + (buf.length / 1024).toFixed(0)
    + " KB · data dated " + publishedISO);
  console.log("stamped assets/auspol-card.json · run build.mjs to re-stamp og:image");
} finally {
  await browser.close();
  server.close();
}
