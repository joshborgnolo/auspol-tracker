/* render-favicon.mjs – rasterise the masthead glyph for Google Search.

   The tab icon is an SVG data URI in the page, and that is the right thing for
   a browser: it is the live glyph, redrawn from the aggregates on every build,
   it costs no request, and it can never go stale against the data it reports.

   Google Search cannot use it. Its favicon crawler needs a URL to fetch -
   "Googlebot-Image must be able to crawl the favicon file" - and a data URI is
   not one, so there was nothing for it to index and the search result fell
   back to a generic globe. The SVG this build already writes to
   assets/favicon.svg would not have rescued it either: the supported formats
   are BMP, GIF, ICO, PNG, JPEG, PPM and TIFF, and SVG is not among them.

   So the page declares BOTH. The PNG this writes is first in the head and is
   the one Google takes; the data URI follows it, typed image/svg+xml, and is
   the one browsers prefer. Nothing about the browser tab changes.

   Two constraints come from the same doc and are the reason this file exists
   rather than a hashed build artefact:

     - "The favicon URL must be stable (don't change the URL frequently)."
       So the name is fixed. The bytes may change; the URL may not.
     - "we recommend using a favicon that's larger than 48x48px". 192 is the
       next conventional step up and doubles as a home-screen icon.

   Chrome and puppeteer-core are the only things it needs, and neither is a
   build dependency - build.mjs never imports this, exactly as it never imports
   render-card.mjs. The PNG is committed like assets/auspol-card.png is, and
   (like the card) the redraw rides refresh_site() in every data wrapper: the
   gate below hashes the glyph content, so the rasterisation runs only when
   the glyph itself moved - a new poll or a 2PP move shifts the gauge's arcs
   and needle, a copy edit does not - and wrappers with no Chrome skip quietly
   when there is nothing to draw.

     node .build/newtracker/build.mjs           # writes assets/favicon.svg
     node .build/newtracker/render-favicon.mjs  # gated rasterise to the PNG
     node .build/newtracker/build.mjs           # links it (skipped if absent)

   Override the browser with CHROME=/path/to/chrome. */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SRC = path.join(ROOT, "assets", "favicon.svg");
const OUT = path.join(ROOT, "assets", "favicon-192.png");
const STAMP = path.join(ROOT, "assets", "favicon-192.json");
const SIZE = 192;
/* The glyph is dark ink and saturated bars with no ground of its own, which is
   correct on a tab bar and wrong in a search result: Google draws favicons on
   surfaces it chooses, and a transparent needle over a dark one disappears.
   So it gets the site's own paper as a ground - the same --bg the page uses,
   which is why the tile reads as part of the site rather than as a sticker. */
const GROUND = "#faf6f0";

const die = (msg) => { console.error("render-favicon: " + msg); process.exit(1); };

if (!fs.existsSync(SRC)) die("no assets/favicon.svg – run build.mjs first.");
const svg = fs.readFileSync(SRC, "utf8");
const svgSha = createHash("sha256").update(svg).digest("hex");

/* Staleness gate, the same idiom as render-card's: assets/favicon-192.json
   records what the PNG was drawn from, and when that is exactly the glyph on
   disk there is nothing to draw, so we exit before puppeteer or Chrome are
   even probed. A missing or old-format stamp falls through to a draw. */
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const drawn = readJson(STAMP);
if (drawn && drawn.svgSha256 === svgSha && fs.existsSync(OUT)) {
  console.log("favicon current (glyph unchanged) – nothing to do");
  process.exit(0);
}

const require_ = createRequire(path.join(ROOT, "package.json"));
let puppeteer;
try { puppeteer = require_("puppeteer-core"); }
catch { die("puppeteer-core is not installed (npm install)."); }
const CHROME = process.env.CHROME
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) die("no Chrome at " + CHROME + "\n  (set CHROME=/path/to/chrome).");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--force-color-profile=srgb"],
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("  [page] " + e.message));
  /* deviceScaleFactor 1 on a SIZE-square viewport: the screenshot is then
     exactly SIZE x SIZE with no resampling, so the arc keeps the edges the
     browser drew rather than a rescaled approximation of them. */
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">`
    + `<style>html,body{margin:0;padding:0;background:${GROUND}}`
    + `svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>`
    + svg,
    { waitUntil: "load" });
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(OUT, buf);
  fs.writeFileSync(STAMP, JSON.stringify({
    svgSha256: svgSha,
    drawnISO: new Date().toISOString().slice(0, 10),
  }) + "\n");
  console.log(`drew assets/favicon-192.png · ${SIZE}x${SIZE} · `
    + (buf.length / 1024).toFixed(1) + " KB · stamped assets/favicon-192.json");
} finally {
  await browser.close();
}
