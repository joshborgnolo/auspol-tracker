// Probe: a year loading behind the map never moves what's on it: the page's proj stays the shown
// year's while Handbook years (the heavy, differently fitted ones) load from the timeline's hover.
// Before 2026-11-05 Perth's name sat 54px west, out at sea, for as long as the load ran.
// usage: node .matilda/probe/map-proj-steady.mjs <baseUrl>   (a Node static server: python's drops connections)
import puppeteer from "puppeteer-core";
const base = process.argv[2];
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 120000 });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
page.on("pageerror", (e) => console.log("PAGEERR", e.message));
let bad = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const seq of [["2001"], ["1993"], ["1998", "2001"], ["2001", "2022"], ["1996", "2019", "2001"]]) {
  await page.goto(`${base}/map/`, { waitUntil: "domcontentloaded" }); await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__map && window.__map.T && window.__map.projDrift", { timeout: 40000 });
  await wait(1500);
  const loaded = await page.evaluate(() => Object.keys(window.__map.Y).join());
  const during = [];
  for (const st of seq) { const ok = await page.$(`#time [data-year="${st}"]`); if (!ok) { console.log("no stop", st); continue; } await page.$eval(`#time [data-year="${st}"]`, (e) => e.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))); await wait(170); }
  for (let i = 0; i < 40; i++) { await wait(100); during.push(JSON.stringify(await page.evaluate(() => window.__map.projDrift))); }
  await wait(4000);
  if (during.some((d) => !d.startsWith("[true"))) bad++;
  console.log(seq.join(">"), "| loaded before:", loaded, "| during:", [...new Set(during)].join(" "), "| settled:", JSON.stringify(await page.evaluate(() => window.__map.projDrift)));
}
await browser.close();
console.log(bad ? `FAIL ${bad}` : "PASS map-proj-steady");
process.exit(bad ? 1 : 0);
