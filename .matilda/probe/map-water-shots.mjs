// Screenshots of /map/'s water in the seats at a ladder of zooms (review aid, not a test).
// usage: node .matilda/probe/map-water-shots.mjs <baseUrl> <outDir> [dark] [width]
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const [base, out, theme, width] = [process.argv[2], process.argv[3], process.argv[4] || "light", +(process.argv[5] || 1200)];
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 120000 });
const page = await browser.newPage();
await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme === "dark" ? "dark" : "light" }]);
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.goto(`${base}/map/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction("window.__map && window.__map.T", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
const shot = async (name, year, ll, k, extra) => {
  await page.evaluate(async (year, ll, k, extra) => {
    if (year && String(window.__map.S ? window.__map.S.year : "") !== String(year)) { window.__map.setYear(year); await new Promise((r) => setTimeout(r, 3000)); }
    if (extra) eval(extra);
    window.__map.view(ll, k);
    await new Promise((r) => setTimeout(r, 2500));
    window.__map.drawNow();
    await new Promise((r) => setTimeout(r, 400));
    window.__map.drawNow();
  }, year, ll, k, extra || null);
  const el = await page.$("#stage");
  await el.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
};
const plan = JSON.parse(process.env.SHOTS || "null") || [
  ["syd-k1", 2025, [151.2, -33.85], 1],
  ["syd-k6", 2025, [151.2, -33.85], 6],
  ["syd-k14", 2025, [151.2, -33.85], 14],
  ["syd-k30", 2025, [151.22, -33.85], 30],
  ["syd-k44", 2025, [151.24, -33.85], 44],
  ["syd-k54", 2025, [151.24, -33.85], 54],
  ["syd-k80", 2025, [151.24, -33.85], 80],
  ["perth-k20", 2025, [115.85, -32.0], 20],
  ["sharkbay-k6", 2025, [113.7, -25.9], 6],
  ["eyre-k1", 2025, [137.5, -28.5], 1.6],
  ["eyre-k5", 2025, [137.3, -28.8], 5],
  ["argyle-k6", 2025, [128.75, -16.3], 6],
  ["coorong-k6", 2025, [139.3, -35.7], 6],
];
for (const [name, year, ll, k, extra] of plan) await shot(name, year, ll, k, extra);
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no page errors");
await browser.close();
