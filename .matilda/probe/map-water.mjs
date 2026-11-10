// Probe: /map/'s water in the seats (app-2-map.js "the water in the seats"), read off the canvas.
// usage: node .matilda/probe/map-water.mjs <baseUrl>   (serve the repo root first)
//  1. known harbours read as the sea's pale blue at every zoom from the city views through Esri's
//     handover (k 40-80 federal): never the seat's colour, never part-tinted mid-handover
//  2. known land beside them keeps its seat's colour at the same zooms (the cut never takes land)
//  3. a dry lake is neither water nor plain seat colour at country zoom: its wash and dashes show
//  4. no page errors through a year walk and a trip to the chamber and back at city zoom
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8131"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 180000 });
const fails = [];
const ok = (name, cond, detail = "") => { console.log(`${cond ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); if (!cond) fails.push(name); };
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`${base}/map/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction("window.__map && window.__map.T", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
// the canvas pixel at the stage's middle (where __map.view puts the point)
const at = (ll, k, wait = 3000) => page.evaluate(async (ll, k, wait) => {
  window.__map.view(ll, k);
  await new Promise((r) => setTimeout(r, wait));
  window.__map.drawNow();
  const cv = document.querySelector("#cv"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
  return [...g.getImageData(W >> 1, H >> 1, 1, 1).data];
}, ll, k, wait);
// the sea's paper: pale, its green well over its red (T.sea, lch(0.945, 0.024, 230)), whatever
// the grain - a quieted Coalition seat is as pale and as blue, but its green sits on its red
const sea = (c) => c[3] > 200 && c[2] >= 235 && c[1] - c[0] >= 10 && c[0] >= 190;
const notSea = (c) => !sea(c);
const ladder = [8, 14, 22, 30, 40, 46, 50, 55, 60, 66, 80];
// (each from the zoom where it is a few pixels across: Port Jackson by Shark Island is ~700 m, the
// river at Gladesville ~350 m)
for (const [name, ll, k0] of [["Port Jackson by Shark Island", [151.258, -33.853], 14], ["Botany Bay", [151.19, -33.98], 8], ["the Parramatta River under Gladesville Bridge", [151.147, -33.842], 30]]) {
  const bad = [];
  for (const k of ladder) { if (k < k0) continue; const c = await at(ll, k); if (!sea(c)) bad.push(`k${k} ${c}`); }
  ok(`${name} reads as sea from the city views through the handover`, !bad.length, bad.join("; "));
}
for (const [name, ll] of [["Mosman (land)", [151.243, -33.829]], ["Balmain (land)", [151.18, -33.857]], ["Sans Souci (land)", [151.133, -33.993]], ["Rockdale (land)", [151.138, -33.953]]]) {
  const bad = [];
  for (const k of ladder) { const c = await at(ll, k); if (sea(c)) bad.push(`k${k} ${c}`); }
  ok(`${name} keeps its seat's colour at every zoom`, !bad.length, bad.join("; "));
}
// 3. Lake Eyre North at country zoom: the dry lake's wash lifts the seat's blue toward the sea's
{
  const lake = await at([137.301, -28.398], 1.6), land = await at([136.4, -28.6], 1.6);
  ok("Lake Eyre North is drawn as a dry lake (washed paler than the seat round it, not cut to sea)", lake[0] > land[0] + 25 && notSea(lake), `lake ${lake}, land ${land}`);
}
// 4. a year walk and the chamber at city zoom
await page.evaluate(async () => {
  window.__map.view([151.2, -33.87], 30); await new Promise((r) => setTimeout(r, 2000));
  for (const y of [2022, 2019, 2001, 2025]) { window.__map.setYear(y); await new Promise((r) => setTimeout(r, 2500)); }
  window.__map.setView("chamber"); await new Promise((r) => setTimeout(r, 2000));
  window.__map.setView("map"); await new Promise((r) => setTimeout(r, 2000));
});
ok("no page errors through a year walk and the chamber at city zoom", !errs.length, errs.join(" | "));
await browser.close();
console.log(fails.length ? `${fails.length} FAILED` : "all ok");
process.exit(fails.length ? 1 : 0);
