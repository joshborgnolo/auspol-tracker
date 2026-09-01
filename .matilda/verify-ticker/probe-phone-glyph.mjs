// Phone-width probe for the tab-bar glyph placeholder (the masthead dial
// warming the 2PP score's seat before the score docks):
//   top                -> bar unpinned, no glyph
//   pinned, hero on    -> glyph visible in the right seat, no docked score
//   show-score         -> glyph gone, 2PP score docked
// and back up reverses it. Also guards the masthead lockup the dial was
// extracted out of: exactly one .wordmark button, exactly one .wm-dial
// (the tab-bar copy is .tab-glyph, never .wm-dial), and clicking the
// wordmark text still flies the story overlay out of the masthead dial.
import { createRequire } from "node:module";

let puppeteer = null;
for (const r of [
  createRequire(import.meta.url),
  createRequire("/opt/homebrew/lib/node_modules/"),
]) {
  try { puppeteer = r("puppeteer-core"); break; } catch { /* keep looking */ }
}
if (!puppeteer) throw new Error("puppeteer-core not found");

const BASE = process.env.BASE || "http://127.0.0.1:8710";
const CHROME = process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--hide-scrollbars"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(BASE + "/index.html", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(() =>
  document.querySelector("nav.tabs") &&
  (document.querySelector(".hero-gauge") || document.querySelector(".hero-readout")),
  { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await sleep(1200);

const masthead = await page.evaluate(() => ({
  lockupButtons: document.querySelectorAll(".wordmark button").length,
  wmDials: document.querySelectorAll(".wm-dial").length,
  tabGlyphs: document.querySelectorAll(".tab-glyph").length,
}));
const geom = await page.evaluate(() => {
  const s = document.querySelector(".tabs-sentinel");
  const g = document.querySelector(".hero-gauge") || document.querySelector(".hero-readout");
  return {
    Y_SENT: Math.round(s.getBoundingClientRect().top + window.scrollY),
    Y_GAUGE: Math.round(g.getBoundingClientRect().bottom + window.scrollY),
  };
});

async function sample(y, tag) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await sleep(900); // IO delivery + opacity transitions (.26/.34s)
  return page.evaluate((tag) => {
    const glyph = document.querySelector(".tab-glyph");
    const score = document.querySelector(".tab-score");
    const gr = glyph.getBoundingClientRect();
    const gcs = getComputedStyle(glyph);
    return {
      tag,
      y: Math.round(window.scrollY),
      cls: document.querySelector("nav.tabs").className.replace("tabs sticky", "").trim() || "-",
      glyphOpacity: +gcs.opacity,
      glyphW: +gr.width.toFixed(1),
      glyphRight: Math.round(innerWidth - gr.right),
      glyphEvents: gcs.pointerEvents,
      scoreOpacity: +getComputedStyle(score).opacity,
    };
  }, tag);
}

const samples = [];
samples.push(await sample(0, "top"));
samples.push(await sample(geom.Y_SENT + 15, "pinned-hero-on"));
samples.push(await sample(geom.Y_GAUGE + 150, "past-hero"));
samples.push(await sample(geom.Y_SENT + 15, "back-pinned-hero-on"));
samples.push(await sample(0, "back-top"));

// story overlay still flies out of the masthead wordmark (glyphRef intact)
await page.evaluate(() => {
  document.querySelector(".wm-name").dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }));
});
await sleep(900);
const story = await page.evaluate(() => ({
  frame: !!document.querySelector(".dl-frame"),
  backdrop: !!document.querySelector(".dl-backdrop"),
}));
await browser.close();

const [a, b, c, d, e] = samples;
const checks = {
  oneLockupButton: masthead.lockupButtons === 1,
  oneWmDial: masthead.wmDials === 1,
  oneTabGlyph: masthead.tabGlyphs === 1,
  topGlyphHidden: a.glyphOpacity < 0.05,
  pinnedHeroOnGlyphShown: /pinned/.test(b.cls) && !/show-score/.test(b.cls)
    && b.glyphOpacity > 0.95,
  pinnedHeroOnNoScore: b.scoreOpacity < 0.05,
  glyphSized: b.glyphW > 25 && b.glyphW < 45,
  // the seat is .tabs-inner-relative: 5px rule + the row's 16px wrap padding
  // = 21px from the viewport edge, one seat over .tab-score's 17
  glyphSeatedRight: b.glyphRight >= 15 && b.glyphRight <= 30,
  glyphNeverInteractive: samples.every((s) => s.glyphEvents === "none"),
  pastHeroGlyphGone: /show-score/.test(c.cls) && c.glyphOpacity < 0.05,
  pastHeroScoreDocked: c.scoreOpacity > 0.95,
  reentryGlyphShown: d.glyphOpacity > 0.95,
  backTopGlyphHidden: e.glyphOpacity < 0.05,
  storyOpensFromWordmark: story.frame || story.backdrop,
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ verdict: ok ? "PASS" : "FAIL", masthead, geom, samples, story, checks }, null, 2));
process.exit(ok ? 0 : 1);
