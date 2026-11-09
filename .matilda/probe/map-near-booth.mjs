// Probe: the "km to the nearest polling place" note on /map/ (app-2d-near.js).
// usage: node .matilda/probe/map-near-booth.mjs <baseUrl>   (serve the repo root first; SHOT=<prefix> saves stage shots)
// Checks: hidden at home and in a city; shown in the Simpson Desert and at sea, arrow towards the dot,
// distance near the haversine of the probe's own reading; pressing it selects that place; phone + full screen fit.
import puppeteer from "puppeteer-core";
const [, , base] = process.argv;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 90000 });
const fails = [], fail = (s) => { console.log("FAIL", s); fails.push(s); };
const read = (page) => page.evaluate(() => {
  window.__map.drawNow();
  const e = document.querySelector(".mp-near"), st = document.querySelector("#stage").getBoundingClientRect();
  if (!e || e.hidden) return null;
  const r = e.getBoundingClientRect();
  return { t: e.textContent, title: e.title, rot: e.querySelector("svg").style.transform, box: [r.left - st.left, r.top - st.top, r.right - st.left, r.bottom - st.top], sw: st.width };
});
for (const [w, h, label] of [[1400, 1000, "desktop"], [390, 800, "phone"]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
  page.on("pageerror", (e) => { if (!/Failed to fetch/.test(e.message)) fail(`${label} pageerror ${e.message}`); });
  await page.goto(`${base}/map/`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction("window.__map && window.__map.T && window.__map.M() && window.__map.M().booth", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  if (await read(page)) fail(`${label}: shown at home`);
  const spots = [["Sydney CBD", [151.207, -33.868], 120, false], ["Simpson Desert", [137.0, -25.6], 40, true], ["Bass Strait", [146.2, -39.6], 60, true], ["Great Sandy Desert", [124.5, -20.5], 30, true]];
  for (const [nm, ll, k, want] of spots) {
    await page.evaluate((ll, k) => window.__map.view(ll, k), ll, k);
    await new Promise((r) => setTimeout(r, 400));
    const got = await read(page);
    console.log(label, nm, got ? `${got.t} | ${got.title} | ${got.rot} | box ${got.box.map(Math.round)}` : "hidden");
    if (!!got !== want) fail(`${label} ${nm}: expected ${want ? "shown" : "hidden"}`);
    if (got && (got.box[0] < 0 || got.box[2] > got.sw)) fail(`${label} ${nm}: off the stage`);
    if (process.env.SHOT && got) await (await page.$("#stage")).screenshot({ path: `${process.env.SHOT}-${label}-${nm.replace(/\s/g, "")}.png` });
  }
  // pressing it goes to the place
  await page.evaluate(() => window.__map.view([137.0, -25.6], 40));
  await new Promise((r) => setTimeout(r, 300)); await read(page);
  const want = await page.evaluate(() => document.querySelector(".mp-near").title.replace(/^Go to /, ""));
  await page.click(".mp-near"); await new Promise((r) => setTimeout(r, 2500));
  const sel = await page.evaluate(() => { const s = window.__map.S.sel, m = window.__map.M(); return s.level === "booth" ? m.booth.name[s.booth].replace(/'/g, "’") : s.level; });
  console.log(label, "pressed →", sel);
  if (sel !== want) fail(`${label}: press selected ${sel}, wanted ${want}`);
  if (await read(page)) fail(`${label}: still shown at the place`);
  await page.close();
}
// other frames: an older federal year and a state frame read their own polling places
for (const [y, ll, k] of [["2001", [137.0, -25.6], 40], ["wa25", [124.5, -20.5], 30], ["sa26", [137.0, -28.5], 40]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => { if (!/Failed to fetch/.test(e.message)) fail(`${y} pageerror ${e.message}`); });
  await page.goto(`${base}/map/#y=${y}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction("window.__map && window.__map.M() && window.__map.M().booth && window.__map.M().booth.n > 0", { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate((ll, k) => window.__map.view(ll, k), ll, k);
  await new Promise((r) => setTimeout(r, 500));
  const got = await read(page);
  console.log(y, got ? `${got.t} | ${got.title} | ${got.rot}` : "hidden");
  if (!got) fail(`${y}: hidden in empty country`);
  await page.close();
}
await browser.close();
console.log(fails.length ? `${fails.length} failure(s)` : "ok");
process.exit(fails.length ? 1 : 0);
