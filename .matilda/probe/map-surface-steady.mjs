// Probe: a surface reads the same at the same zoom, however the reader got there (app-2b-draw.js, surfaceTick).
// usage: node .matilda/probe/map-surface-steady.mjs <baseUrl>
// The surface was once smoothed by the screen, so a spot read differently at each zoom, and a view raster
// served a band of zooms, so its reading turned on which end the reader came in from: on 2026-11-06, at The
// Oaks in Hume at the same zoom, Labor by 13.4 up from below and Coalition by 7.6 down from above.
// Now there is one field. Each spot here is read at a zoom reached from the bottom of its band and from
// the top, at two screen densities, again after a pan that brings a new raster, and across the zooms.
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SPOTS = [["The Oaks, Hume", 861.68, 650.66], ["Inner Melbourne", null, null], ["Toowoomba way", null, null]];
const errs = [];
for (const dsf of [2, 1]) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: dsf });
  await page.goto(`${base}/maps/#draw=surface`, { waitUntil: "networkidle2", timeout: 60000 });
  for (let i = 0; i < 80; i++) { if (await page.evaluate("!!(window.__map && window.__map.SF && window.__map.SF.base)")) break; await wait(250); }
  await wait(2500);
  await page.evaluate(() => document.querySelector("#stage").scrollIntoView({ block: "center", behavior: "instant" })); await wait(300);
  // two more spots, from the seats themselves
  const seatSpot = (n) => page.evaluate((n) => { const m = window.__map.M(), bb = m.geo.bb[m.byName.get(n)]; return [(bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2]; }, n);
  SPOTS[1].splice(1, 2, ...(await seatSpot("Melbourne")));
  SPOTS[2].splice(1, 2, ...(await seatSpot("Groom")));
  const q = Math.min(dsf, 1.5);
  const to = (k, X, Y) => page.evaluate(({ k, X, Y }) => {
    const M = window.__map, T = M.T, c = document.querySelector("#cv"), r = c.getBoundingClientRect();
    c.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 * Math.log(k / T.k), deltaMode: 0, ctrlKey: true, clientX: r.left + X * T.k + T.x, clientY: r.top + Y * T.k + T.y, bubbles: true, cancelable: true }));
  }, { k, X, Y });
  const read = (X, Y) => page.evaluate(async ({ X, Y }) => { const M = window.__map, a = await M.surfaceAt(X, Y); return a ? { who: a.fam, by: +a.lead.toFixed(1) } : null; }, { X, Y });
  for (const [name, X, Y] of SPOTS) for (const k of [0.6, 2.2, 3.9, 5.2, 9, 21, 60]) {
    const n = Math.round(2 * Math.log2(1 / (k * q))), lo = 2 ** (-(n + 0.5) / 2) / q, hi = 2 ** (-(n - 0.5) / 2) / q;
    const path = async (edge) => { await page.evaluate(() => window.__map.goAus({ dur: 0 })); await wait(700); await to(edge, X, Y); await wait(800); await to(k, X, Y); await wait(700); return read(X, Y); };
    const a = await path(lo * 1.004), b = await path(hi * 0.996);
    ok(`dpr ${dsf}, ${name}, k ${k}: the same up and down`, a && b && a.who === b.who && Math.abs(a.by - b.by) < 0.01, `${JSON.stringify(a)} v ${JSON.stringify(b)}`);
    // a pan that makes a new raster leaves the reading where it was
    await page.evaluate(() => { const c = document.querySelector("#cv"), r = c.getBoundingClientRect(); for (let i = 0; i < 6; i++) c.dispatchEvent(new WheelEvent("wheel", { deltaX: 90, deltaY: 40, deltaMode: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true })); });
    await wait(800);
    const c = await read(X, Y);
    if (c) ok(`dpr ${dsf}, ${name}, k ${k}: the same after a pan`, a && c.who === a.who && Math.abs(c.by - a.by) < 0.01, `${JSON.stringify(a)} v ${JSON.stringify(c)}`);
  }
  // one field: a spot's reading is the same at every zoom, not only at one
  for (const [name, X, Y] of SPOTS) {
    const seen = [];
    for (const k of [0.6, 2.2, 5.2, 21, 60, 3.2, 0.9]) { await to(k, X, Y); await wait(500); seen.push(await read(X, Y)); }
    ok(`dpr ${dsf}, ${name}: the one reading at every zoom`, seen.every((a) => a && seen[0] && a.who === seen[0].who && a.by === seen[0].by), JSON.stringify(seen[0]));
  }
  await page.close();
}
ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall ok");
process.exit(fails.length ? 1 : 0);
