/* site-wide tooltip sweep (2026-10-13, after the user's report of "tooltips
   wider than small screen" in Preference flows, where DemosAU's tips ran
   371-410px on a 390px phone and widened the page). On each tab page, in
   both designs, at phone widths: walk the page once so every lazy section
   mounts, then tap across every chart-sized svg (five points across, two
   down) and fail on any visible tooltip that runs past the screen's edge
   or widens the page. The first sweep found four more: Who votes for
   whom's and Leadership's month readouts (a "95% intervals" row that never
   wrapped: 457px over a 320px plot), and the small multiples of Where One
   Nation's voters are coming from and How much the polls disagree (a readout
   wider than its 150px panel clamped to the panel's centre, 14px off the
   screen). TrendChart, RdDisagree and the Preference flows tips now clamp
   to the screen and cap their width at it.
   A page already wider than the screen before any tap is reported once as
   a note, not a tooltip failure.
   Run over http (fonts load): PAGE_BASE=http://127.0.0.1:8765 node
   .matilda/probe/tip-overflow-sweep.mjs - or against the built tree's
   files by default. Takes a few minutes. */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.PAGE_BASE || "file://" + ROOT;
const PAGES = ["/index.html", "/allpolls/index.html", "/cycles/index.html"];
const DESIGNS = (process.env.DESIGNS || "new,old").split(",");
const WIDTHS = (process.env.WIDTHS || "360,320").split(",").map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const offenders = new Map();
let taps = 0, errors = 0;
for (const design of DESIGNS) for (const p of PAGES) for (const w of WIDTHS) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 760, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(BASE + p + "?design=" + design, { waitUntil: "networkidle0", timeout: 90000 });
  await wait(600);
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); } window.scrollTo(0, 0); });
  await wait(300);
  /* a page already wider than the screen on load is a layout bug of its
     own (the old design's home summary table runs 403px wide at 320 on the
     live site too) - the sweep judges what a TAP adds, against this */
  const base = await page.evaluate(() => document.documentElement.scrollWidth);
  const n = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll("svg")].filter((s) => { const b = s.getBoundingClientRect(); return b.width >= 120 && b.height >= 50 && !s.closest(".tip"); });
    svgs.forEach((s, i) => s.setAttribute("data-sweep", i));
    return svgs.length;
  });
  for (let i = 0; i < n; i++) {
    const box = await page.evaluate((i) => {
      const s = document.querySelector(`svg[data-sweep="${i}"]`);
      if (!s) return null;
      s.scrollIntoView({ block: "center", behavior: "instant" });
      const b = s.getBoundingClientRect();
      const sec = s.closest("[id]");
      return b.width ? { x: b.x, y: b.y, w: b.width, h: b.height, sec: sec ? sec.id : "?" } : null;
    }, i);
    if (!box) continue;
    for (const fx of [0.04, 0.25, 0.5, 0.75, 0.96]) for (const fy of [0.35, 0.65]) {
      const x = box.x + box.w * fx, y = box.y + box.h * fy;
      if (y < 60 || y > 740) continue;
      await page.touchscreen.tap(x, y);
      taps++;
      await wait(110);
      const bad = await page.evaluate((w) => {
        const out = [];
        for (const t of document.querySelectorAll(".tip")) {
          const cs = getComputedStyle(t);
          if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
          const b = t.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          if (b.left < -0.5 || b.right > w + 0.5) out.push({ cls: String(t.className), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), txt: (t.innerText || "").slice(0, 70).replace(/\n/g, " | ") });
        }
        return { out, sw: document.documentElement.scrollWidth };
      }, w);
      /* a page that widens with no tip off the screen is re-measured after
         the readouts' .15s glide and fade, so a transient never counts */
      if (!bad.out.length && bad.sw > Math.max(w, base)) { await wait(400); bad.sw = await page.evaluate(() => document.documentElement.scrollWidth); }
      if (bad.out.length || bad.sw > Math.max(w, base)) {
        const key = design + "|" + p + "|" + box.sec + "|" + (bad.out[0] ? bad.out[0].cls : "page width");
        if (!offenders.has(key)) offenders.set(key, { w, ...bad });
      }
      await page.touchscreen.tap(2, Math.min(740, Math.max(70, y)));
      await wait(60);
    }
  }
  errors += errs.length;
  console.log(`${design} ${p} ${w}: ${n} charts${base > w ? ` (note: the page is ${base}px wide before any tap)` : ""}${errs.length ? ", page errors: " + errs[0] : ""}`);
  await page.close();
}
await browser.close();
for (const [k, v] of offenders) console.log("FAIL " + k + " " + JSON.stringify(v));
console.log(offenders.size || errors ? `tip-overflow-sweep: ${offenders.size} overflowing, ${errors} page errors (${taps} taps)` : `tip-overflow-sweep: ALL CLEAR (${taps} taps)`);
process.exit(offenders.size || errors ? 1 : 0);
