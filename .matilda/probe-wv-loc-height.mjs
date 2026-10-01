/* Probe: on laptop, the Who-votes "Place" tab's By-location chart plot runs
   the full height of the 2x2 state grid beside it (rd-panels.jsx measures
   .rd-wv-panels and sizes the location TrendChart to grid + its t/b pads,
   pads t12+b30 = 42px). Asserts at 1440 and 820:
     - the two cards sit side by side (same row),
     - the location svg height == grid height + 42 (+-1.5px rounding),
     - the svg is noticeably taller than the old fixed 260px;
   and at 390 (phone) the cards stack and the chart keeps its fixed 240px.
   Also re-asserts the desktop equality after a party-chip morph (ALP). */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }
const BASE = process.env.BASE || process.cwd();

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails.push(msg); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();

async function openPlace(width) {
  await page.setViewport({ width, height: 950, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#who-votes .rd-wv-tabs .rd-tab", { timeout: 30000 });
  await page.evaluate(() => {
    const t = [...document.querySelectorAll("#who-votes .rd-wv-tabs .rd-tab")].find((b) => b.textContent.trim() === "Place");
    t.scrollIntoView(); t.click();
  });
  await page.waitForSelector(".rd-wv-panels", { timeout: 15000 });
  // a beat for the chart ResizeObservers and the grid measure to settle
  await new Promise((r) => setTimeout(r, 400)); // intentional-sleep: RO-driven heights settle after mount
}

const measure = () => page.evaluate(() => {
  const cards = [...document.querySelectorAll("#who-votes .rd-wv-chart")];
  const state = cards.find((el) => el.querySelector(".rd-wv-panels"));
  const loc = cards.find((el) => !el.querySelector(".rd-wv-panels"));
  if (!state || !loc) return { missing: true };
  const grid = state.querySelector(".rd-wv-panels").getBoundingClientRect();
  const svg = loc.querySelector("svg.chart-svg").getBoundingClientRect();
  const s = state.getBoundingClientRect(), l = loc.getBoundingClientRect();
  return { gridH: grid.height, svgH: svg.height, sTop: s.top, lTop: l.top, sBottom: s.bottom, lLeft: l.left, sRight: s.right };
});

console.log("desktop 1440:");
await openPlace(1440);
let m = await measure();
check(!m.missing, "both Place cards render");
check(Math.abs(m.sTop - m.lTop) <= 2, `cards share a row (tops ${m.sTop?.toFixed(1)} vs ${m.lTop?.toFixed(1)})`);
check(Math.abs(m.svgH - (m.gridH + 42)) <= 1.5, `location svg ${m.svgH?.toFixed(1)} == grid ${m.gridH?.toFixed(1)} + 42 pads`);
check(m.svgH > 300, `svg actually stretched (${m.svgH?.toFixed(1)} > 300, was 260)`);

// party morph keeps the contract
await page.evaluate(() => {
  const chip = document.querySelectorAll("#who-votes .rd-chips .rd-chip")[1]; // Labor
  chip.scrollIntoView(); chip.click();
});
await new Promise((r) => setTimeout(r, 700)); // intentional-sleep: party morph runs ~320ms, then RO re-measures
m = await measure();
check(Math.abs(m.svgH - (m.gridH + 42)) <= 1.5, `after party switch: svg ${m.svgH?.toFixed(1)} == grid ${m.gridH?.toFixed(1)} + 42`);

console.log("desktop 820:");
await openPlace(820);
m = await measure();
check(!m.missing, "both Place cards render at 820");
check(Math.abs(m.sTop - m.lTop) <= 2, `cards share a row at 820 (tops ${m.sTop?.toFixed(1)} vs ${m.lTop?.toFixed(1)})`);
check(Math.abs(m.svgH - (m.gridH + 42)) <= 1.5, `at 820 svg ${m.svgH?.toFixed(1)} == grid ${m.gridH?.toFixed(1)} + 42`);

console.log("phone 390:");
await openPlace(390);
m = await measure();
check(!m.missing, "both Place cards render at 390");
check(m.lTop > m.sBottom - 1, `cards stack at 390 (loc top ${m.lTop?.toFixed(1)} below state bottom ${m.sBottom?.toFixed(1)})`);
check(Math.abs(m.svgH - 240) <= 1.5, `phone keeps fixed 240px chart (${m.svgH?.toFixed(1)})`);

await browser.close();
if (fails.length) { console.error("\n" + fails.length + " FAILURES"); process.exit(1); }
console.log("\nALL PASS");
