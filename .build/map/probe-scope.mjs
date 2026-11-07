// Manual regression probe for the Winner head's figures-scope menu surviving a
// year switch (2026-11-07): a pick ("NSW figures", a seat type) is one store
// shared across frames; a frame that can't express it (a state frame shown a
// federal state pick) shows its own jurisdiction figures until one can.
// Start a local server from the repo root, then
// MAP_URL=http://127.0.0.1:8765 node .build/map/probe-scope.mjs
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--force-prefers-reduced-motion"] });
const base = process.env.MAP_URL || "http://127.0.0.1:8765";
const label = (page) => page.$eval("#story .st-scwrap [data-scope-trigger]", (e) => e.textContent.trim());
const menuLabels = (page) => page.$$eval("#story .st-scwrap [data-scope]", (els) => els.map((e) => `${e.dataset.scope} = ${e.textContent.trim()}${e.getAttribute("aria-pressed") ? " [pressed]" : ""}`));
// pick a menu item by its data-scope value, through the real trigger-open click chain
async function pick(page, scope) {
  await page.click("#story .st-scwrap [data-scope-trigger]");
  await page.click(`#story .st-scwrap [data-scope="${scope}"]`);
  await page.waitForFunction((s) => document.querySelector(`#story .st-scwrap [data-scope="${s}"]`)?.getAttribute("aria-pressed") === "true", { timeout: 15000 }, scope);
}
async function year(page, y) {
  await page.evaluate(async (y) => { await __map.setYear(y); __map.goAus(); __map.setView("map"); }, y);
  await page.waitForFunction((y) => __map.S.year === y && __map.Y[y]?.divs, { timeout: 60000 }, y);
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
}
async function labelIs(page, want, ctx) {
  await page.waitForFunction((w) => document.querySelector("#story .st-scwrap [data-scope-trigger]")?.textContent.trim() === w, { timeout: 15000 }, want);
  const got = await label(page);
  assert.equal(got, want, ctx);
}
try {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => console.log("requestfailed:", r.url(), r.failure()?.errorText));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/map/#y=now`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__map, { timeout: 60000 });
  await page.evaluate(() => { __map.setLens("winner"); __map.goAus(); __map.setView("map"); });
  await labelIs(page, "Nationwide figures", "default scope on the Now frame");

  // a federal state pick rides across federal years…
  await pick(page, "st:NSW");
  assert.equal(await label(page), "NSW figures", "picked NSW figures on Now");
  await year(page, 2025);
  await labelIs(page, "NSW figures", "NSW figures survives Now → 2025");
  const nswFig = await page.$eval("#story .st-stat", (e) => e.textContent);
  assert.ok(!/NaN|undefined|Infinity/.test(nswFig), `2025 NSW-scoped head figures clean: ${nswFig.slice(0, 160)}`);
  await year(page, 2022);
  await labelIs(page, "NSW figures", "NSW figures survives 2025 → 2022");

  // …falls back where a frame has no such scope, and returns when one does
  await year(page, "vic22");
  await labelIs(page, "Victoria figures", "a state frame falls back to its own jurisdiction figures");
  console.log("vic22 menu:", (await menuLabels(page)).join(" | "));
  await year(page, 2025);
  await labelIs(page, "NSW figures", "back on a federal frame the pick returns");

  // a seat-type pick rides across years too
  const clsScope = await page.$eval('#story .st-scwrap [data-scope^="cls:"]', (e) => e.dataset.scope);
  const clsLabel = await page.$eval(`#story .st-scwrap [data-scope="${clsScope}"]`, (e) => e.textContent.trim());
  await pick(page, clsScope);
  assert.equal(await label(page), clsLabel, `picked ${clsLabel} on 2025`);
  await year(page, "now");
  await labelIs(page, clsLabel, `${clsLabel} survives 2025 → Now`);
  await year(page, "vic22");
  await labelIs(page, "Victoria figures", "a seat-type pick falls back on a state frame too");
  await year(page, 2025);
  await labelIs(page, clsLabel, "and returns on a federal frame");

  assert.deepEqual(errors, [], "no page exceptions");
  console.log("PASS: the figures-scope pick survives year switches, falls back on state frames, and returns");
  await page.close();
} finally { await browser.close(); }
