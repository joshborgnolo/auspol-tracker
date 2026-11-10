// Paint cost of /map/ at a ladder of views, median of drawNow() over a run of paints.
// usage: node .matilda/probe/map-water-perf.mjs <baseUrl> [cpuSlowdown]
import puppeteer from "puppeteer-core";

const base = process.argv[2], slow = +(process.argv[3] || 1);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 180000 });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });
await page.goto(`${base}/map/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction("window.__map && window.__map.T", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
if (slow > 1) { const c = await page.target().createCDPSession(); await c.send("Emulation.setCPUThrottlingRate", { rate: slow }); }
const views = [["home", null, 0], ["syd k6", [151.2, -33.85], 6], ["syd k14", [151.2, -33.85], 14], ["syd k30", [151.22, -33.85], 30], ["syd k54", [151.24, -33.85], 54], ["syd k90", [151.24, -33.85], 90], ["perth k20", [115.85, -32.0], 20], ["eyre k5", [137.3, -28.8], 5]];
for (const [name, ll, k] of views) {
  const r = await page.evaluate(async (ll, k) => {
    if (ll) window.__map.view(ll, k); else window.__map.goAus();
    await new Promise((r) => setTimeout(r, 3000));
    for (let i = 0; i < 4; i++) window.__map.drawNow();
    const t = [];
    for (let i = 0; i < 25; i++) t.push(window.__map.drawNow());
    t.sort((a, b) => a - b);
    return [t[12], t[3], t[21]];
  }, ll, k);
  console.log(`${name.padEnd(10)} median ${r[0].toFixed(2)}ms  (p12 ${r[1].toFixed(2)}, p88 ${r[2].toFixed(2)})`);
}
await browser.close();
