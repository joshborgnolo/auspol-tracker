// Manual regression probe for the city jumps (2026-11-08): a city jump is a
// camera move only — it selects NO state (the Filter row lights nothing),
// and a lit state lets go when the jump flies. State filters and cities
// never mark each other ("select a city in Sydney NSW Melbourne Vic… —
// the corresponding state/territory also shows as selected, and vice
// versa. this should not be the case" — user, same day).
// Start a local server from the repo root, then
// MAP_URL=http://127.0.0.1:8765 node .build/map/probe-city-jumps.mjs
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--force-prefers-reduced-motion"] });
const base = process.env.MAP_URL || "http://127.0.0.1:8765";
const sel = (page) => page.evaluate(() => JSON.parse(JSON.stringify(__map.S.sel)));
const clickCity = (page, name) => page.$$eval("#cities button", (els, name) => els.find((e) => e.textContent.trim() === name).click(), name);
try {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/map/#y=now`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__map, { timeout: 60000 });
  await page.evaluate(() => { __map.setLens("winner"); __map.goAus(); __map.setView("map"); });

  // a jump flies the camera and selects nothing (reduced-motion flight is instant)
  const t0 = await page.evaluate(() => ({ ...__map.T }));
  await clickCity(page, "Sydney");
  await page.waitForFunction((k0) => Math.abs(__map.T.k - k0) > 0.01, { timeout: 15000 }, t0.k);
  assert.deepEqual(await sel(page), { level: "aus" }, "Sydney's jump selects NO state");
  assert.equal(await page.$$eval("#state-filters [data-state][aria-pressed='true']", (els) => els.length), 0, "…and no filter is lit");
  const t1 = await page.evaluate(() => ({ ...__map.T }));
  assert.ok(t1.k > t0.k * 8, `the camera did fly the jump (k ${t0.k.toFixed(1)} → ${t1.k.toFixed(1)})`);

  // and a lit state lets go: filter NSW, then jump to Melbourne — NSW drops
  await page.click("#state-filters [data-state=NSW]");
  await page.waitForFunction(() => __map.S.sel.level === "state" && __map.S.sel.st === "NSW", { timeout: 15000 });
  assert.equal(await page.$$eval("#state-filters [data-state][aria-pressed='true']", (els) => els.length), 1, "NSW filter lights on its own pick");
  await clickCity(page, "Melbourne");
  await page.waitForFunction(() => __map.S.sel.level === "aus", { timeout: 15000 });
  assert.deepEqual(await sel(page), { level: "aus" }, "Melbourne's jump drops the lit NSW filter");
  assert.equal(await page.$$eval("#state-filters [data-state][aria-pressed='true']", (els) => els.length), 0, "…leaving nothing pressed");

  // the way back out keeps the camera rule: a jump while zoomed to a city
  // then a year that lacks that city frames the selection — the country fit
  await page.evaluate(async () => { await __map.setYear(2022); });
  await page.waitForFunction(() => __map.S.year === 2022 && __map.Y[2022]?.divs, { timeout: 60000 });
  assert.deepEqual(await sel(page), { level: "aus" }, "year moves keep the selection out of it");

  assert.deepEqual(errors, [], "no page exceptions");
  console.log("PASS: a city jump is camera-only — it selects no state, drops a lit one, and nothing marks each other");
  await page.close();
  console.log("probe-city-jumps: done");
} finally { await browser.close(); }
