/* Walk-floor probe: facet-walking the All-polls table (tabs and the pinned
   pint tabs) must NOT move anything above or around the table - the head/dek
   slot, the <=1140px control row and the eyebrow strip are floored by
   invisible measurement stacks (.rd-ap-storyvar/.rd-ap-ctlvar/.rd-ap-ebvar),
   so a hop rewrites words only and pinAp never has to correct a scroll.
   Without the floors Safari painted each correction a couple of css px off
   and the pinned page crawled on every tab/arrow walk (user report
   2026-10-06). Serves the built site from the repo root (ROOT=<dir> for
   another build); walks 2PP/primary/demographics/confidence/issues at 12
   widths from a tabs-mid and a deep scroll anchor, asserting every anchor's
   document-top drift stays 0 and window.scrollTo/scrollBy are never called,
   and that the measurement stacks never paint or hold height.
   Run: node .matilda/probe/ap-walk-floor.mjs ; WIDTHS=390,1140 for a subset */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = process.env.ROOT || fileURLToPath(new URL("../..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const URL0 = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
let pageErr = 0;
page.on("pageerror", (e) => { pageErr++; console.log("PAGEERROR", String(e).slice(0, 300)); });
await page.evaluateOnNewDocument(() => {
  let n = 0;
  const t = window.scrollTo.bind(window), b = window.scrollBy.bind(window);
  window.scrollTo = (...a) => { n++; return t(...a); };
  window.scrollBy = (...a) => { n++; return b(...a); };
  Object.defineProperty(window, "__sc", { get: () => n });
});
let overall = 0, scrolls = 0, stackBad = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const widths = (process.env.WIDTHS || "320,360,390,430,640,768,900,1024,1140,1141,1280,1440").split(",").map(Number);
for (const W of widths) {
  const phone = W < 700;
  await page.setViewport({ width: W, height: 850, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.goto(URL0 + "allpolls/", { waitUntil: "networkidle0" });
  await sleep(800);
  // hidden measurement stacks must never paint or hold height
  const vis = await page.evaluate(() => {
    const out = {};
    for (const cls of [".rd-ap-storyvar", ".rd-ap-ctlvar", ".rd-ap-ebvar"]) {
      const el = document.querySelector(cls);
      if (!el) { out[cls] = "ABSENT"; continue; }
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      out[cls] = cs.visibility + " h" + Math.round(r.height) + " " + cs.overflowY;
    }
    return out;
  });
  for (const [cls, v] of Object.entries(vis)) {
    if (v !== "ABSENT" && !String(v).startsWith("hidden h0 ")) stackBad++;
    if (cls === ".rd-ap-storyvar" && v === "ABSENT") stackBad++;
  }
  const anchors = W === 320 || W === 390 || W === 1140 || W === 1280 ? ["tabs-mid", "deep"] : ["tabs-mid"];
  let worst = 0, scCalls = 0;
  for (const where of anchors) {
    await page.evaluate((where) => {
      const t = document.querySelector(".rd-ap-tabs").getBoundingClientRect().top + scrollY;
      window.scrollTo(0, where === "deep" ? t + 1500 : t - 300);
    }, where);
    await sleep(500);
    const base = await page.evaluate(() => window.__sc);
    const ids = ["primary", "demographics", "twopp", "confidence", "demographics", "twopp", "issues", "twopp"];
    for (const id of ids) {
      const before = await page.evaluate(() => {
        const q = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; };
        return { bar: q(".rd-ap-bar"), tab: q(".rd-ap-tabs"), tbl: q(".rd-ap-table") };
      });
      await page.evaluate((id, where) => {
        const lab = { twopp: "2PP", primary: "Primary", leadership: /^Leader/, direction: "Direction", issues: "Issues", demographics: "Demographics", confidence: "Confidence" }[id];
        const m = (b) => (lab instanceof RegExp ? lab.test(b.textContent.trim()) : b.textContent.trim() === lab);
        const pin = document.querySelector(".rd-ap-pinbar.on");
        const sel = where === "deep" && pin && pin.querySelector(".rd-ap-pint") ? ".rd-ap-pint" : ".rd-ap-tabs .rd-tab";
        [...document.querySelectorAll(sel)].find(m).click();
      }, id, where);
      await sleep(900);
      const after = await page.evaluate(() => {
        const q = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; };
        return { bar: q(".rd-ap-bar"), tab: q(".rd-ap-tabs"), tbl: q(".rd-ap-table"), f: document.querySelector(".rd-ap").dataset.facet };
      });
      for (const k of ["bar", "tab", "tbl"]) {
        const d = Math.abs((after[k] - before[k]));
        if (d > worst) worst = d;
      }
    }
    scCalls += (await page.evaluate(() => window.__sc)) - base;
  }
  if (worst > overall) overall = worst;
  scrolls += scCalls;
  console.log(`W${W} worst-drift ${worst.toFixed(1)} scrolls ${scCalls} stacks ${JSON.stringify(vis)}`);
}
console.log("OVERALL worst drift", overall, "(want 0) · scroll corrections", scrolls, "(want 0) · stack violations", stackBad, "(want 0)");
await browser.close();
server.close();
process.exit(overall > 0.5 || scrolls > 0 || stackBad > 0 || pageErr > 0 ? 1 : 0);
