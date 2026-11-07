// Probe: which towns /maps/ names at each frame's home view (collisions included), via __map.townsDrawn.
// usage: node .matilda/probe/map-town-labels.mjs <baseUrl> [width height]   (serve the repo root first)
import puppeteer from "puppeteer-core";
const [, , base, w = "1400", h = "1000"] = process.argv;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 90000 });
const fails = [];
for (const y of ["now", "sa26", "wa25", "qld24", "vic22", "nsw23"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => { if (!/Failed to fetch/.test(e.message)) { console.log("PAGEERR", y, e.message); fails.push(y); } });
  await page.goto(`${base}/maps/#y=${y}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction("window.__map && window.__map.T", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));
  const names = await page.evaluate(() => { window.__map.drawNow(); return window.__map.townsDrawn; });
  console.log(y, names.length, names.join(", "));
  if (process.env.SHOT) await (await page.$("#cv")).screenshot({ path: `${process.env.SHOT}-${y}.png` });
  if (y === "now") for (const st of ["NT", "WA", "SA", "QLD"]) {
    const nm = await page.evaluate(async (st) => { window.__map.goState(st, { dur: 0 }); await new Promise((r) => setTimeout(r, 900)); window.__map.drawNow(); return window.__map.townsDrawn; }, st);
    console.log(`  now ${st}`, nm.length, nm.join(", "));
  }
  await page.close();
}
await browser.close();
process.exit(fails.length ? 1 : 0);
