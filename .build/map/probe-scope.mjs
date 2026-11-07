// Manual regression probe for the Winner head's figures-scope menu surviving a
// year switch (2026-11-07): a pick ("NSW", a seat type) is one store shared
// across frames; a frame that can't express it (a state frame shown a federal
// state pick) shows its own jurisdiction until one can. The wording stays
// PLAIN on the menu's items ("National", "NSW", "Victoria", "Inner metro") —
// the midday "… figures" compounds all died by user call on 2026-11-07 — and
// the menu's TRIGGER names its JOB, not the pick: "Filter seats" by default,
// "Change filter" once a pick is on (later the same day, user call). The
// persistence assertions below therefore read the PRESSED ITEM, not the
// trigger.
//
// UNIFICATION (also 2026-11-07): a state named in the menu and a state
// selected on the map are ONE slice — the menu's pick selects the state on
// the map (no camera move), the map's pick re-stamps the store, and the
// whole-frame layout keeps only three state marks: the head title in the
// state's name, the "All seats" way out above it, and the state selected in
// the map. "All seats" (goAus) clears the slice — so year() below must NOT
// reset the navigation after each year, or the persistence this probe pins
// never gets exercised.
// Start a local server from the repo root, then
// MAP_URL=http://127.0.0.1:8765 node .build/map/probe-scope.mjs
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--force-prefers-reduced-motion"] });
const base = process.env.MAP_URL || "http://127.0.0.1:8765";
const label = (page) => page.$eval("#story .st-scwrap [data-scope-trigger]", (e) => e.textContent.trim());
const menuLabels = (page) => page.$$eval("#story .st-scwrap [data-scope]", (els) => els.map((e) => `${e.dataset.scope} = ${e.textContent.trim()}${e.getAttribute("aria-pressed") ? " [pressed]" : ""}`));
const pressedItem = (page) => page.$eval(`#story .st-scwrap [data-scope][aria-pressed="true"]`, (e) => `${e.dataset.scope} = ${e.textContent.trim()}`);
const selLevel = (page) => page.evaluate(() => ({ ...__map.S.sel }));
const headTitle = (page) => page.$eval("#story .st-head h2", (e) => e.textContent.trim());
const upLabel = (page) => page.$eval("#story .st-up", (e) => e.textContent.trim()).catch(() => null);
// pick a menu item by its data-scope value, through the real trigger-open click chain
async function pick(page, scope) {
  await page.click("#story .st-scwrap [data-scope-trigger]");
  await page.click(`#story .st-scwrap [data-scope="${scope}"]`);
  await page.waitForFunction((s) => document.querySelector(`#story .st-scwrap [data-scope="${s}"]`)?.getAttribute("aria-pressed") === "true", { timeout: 15000 }, scope);
}
async function year(page, y) {
  await page.evaluate(async (y) => { await __map.setYear(y); __map.setView("map"); }, y);
  await page.waitForFunction((y) => __map.S.year === y && __map.Y[y]?.divs, { timeout: 60000 }, y);
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
}
async function labelIs(page, want, ctx) {
  await page.waitForFunction((w) => document.querySelector("#story .st-scwrap [data-scope-trigger]")?.textContent.trim() === w, { timeout: 15000 }, want);
  const got = await label(page);
  assert.equal(got, want, ctx);
}
async function pressedIs(page, want, ctx) {
  const v = want.split(" = ")[0];
  await page.waitForFunction((v) => { const el = document.querySelector(`#story .st-scwrap [data-scope="${v}"]`); return el?.getAttribute("aria-pressed") === "true"; }, { timeout: 15000 }, v);
  const got = await pressedItem(page);
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
  await labelIs(page, "Filter seats", "the trigger invites the filter by default, on every frame");
  const menuNow = await menuLabels(page);
  assert.ok(menuNow.some((l) => l.startsWith("aus = National")) && menuNow.some((l) => l.startsWith("st:NSW = NSW"))
    && menuNow.some((l) => l.startsWith("st:VIC = Victoria")) && menuNow.some((l) => l.startsWith("st:QLD = Queensland"))
    && menuNow.some((l) => l.startsWith("st:WA = Western Australia")) && menuNow.some((l) => l.startsWith("st:SA = South Australia"))
    && menuNow.some((l) => l.startsWith("st:TAS = Tasmania")), `the Now menu items keep their plain names: ${menuNow.join(" | ")}`);
  const noteShown = () => page.evaluate(() => !!document.querySelector("#story .st-seat-note"));
  assert.ok(await noteShown(), "the moved-seats note shows at National");

  // a federal state pick rides across federal years, its pressed item following the frame…
  await pick(page, "st:NSW");
  assert.equal(await label(page), "Change filter", "a picked filter turns the trigger into its changer");
  // the unification: a menu pick IS a map selection — the state is selected
  // (no camera move), the head is its name, and "All seats" sits above it
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "picking NSW in the menu selects NSW in the map");
  assert.equal(await headTitle(page), "New South Wales", "the head titles itself by the state");
  assert.equal(await upLabel(page), "All seats", "the 'All seats' way out sits above the head");
  assert.ok(await noteShown(), "NSW keep the note — New England and Farrer are NSW seats");
  await year(page, 2025);
  await labelIs(page, "Change filter", "the trigger's job wording rides Now → 2025");
  await pressedIs(page, "st:NSW = NSW", "the pressed item is NSW on the election frame");
  const menu25 = await menuLabels(page);
  assert.ok(menu25.some((l) => l.startsWith("aus = National")) && menu25.some((l) => l.startsWith("st:NSW = NSW")) && !menu25.some((l) => l.endsWith("figures")), `the 2025 menu names itself plainly: ${menu25.join(" | ")}`);
  const nswFig = await page.$eval("#story .st-stat", (e) => e.textContent);
  assert.ok(!/NaN|undefined|Infinity/.test(nswFig), `2025 NSW-scoped head figures clean: ${nswFig.slice(0, 160)}`);
  await year(page, 2022);
  await pressedIs(page, "st:NSW = NSW", "NSW survives 2025 → 2022");

  // …falls back where a frame has no such scope, and returns when one does
  await year(page, "vic22");
  await labelIs(page, "Filter seats", "a state election frame falls back to unfiltered — the inviter returns");
  await pressedIs(page, "aus = Victoria", "…its pressed item the frame's own jurisdiction, plain");
  assert.equal((await selLevel(page)).level, "aus", "a frame that can't show the slice carries no map selection");
  console.log("vic22 menu:", (await menuLabels(page)).join(" | "));
  await year(page, 2025);
  await pressedIs(page, "st:NSW = NSW", "back on a federal frame the pick's item returns");
  await labelIs(page, "Change filter", "…and the trigger is its changer again");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "the slice re-selects itself on a frame that has it");
  await year(page, "now");
  await pressedIs(page, "st:NSW = NSW", "and the pick's item survives back to Now");

  // a scoped Now seats row keeps its change line (the coalition's NSW losses)
  const seatSmalls = () => page.$$eval("#story .st-seats small", (els) => els.map((e) => e.textContent.trim()));
  const nswSmalls = await seatSmalls();
  assert.ok(nswSmalls.length && nswSmalls.some((t) => /[−+][1-9]/.test(t)), `NSW carry the Now seat deltas: ${nswSmalls.join(" ")}`);
  assert.equal(nswSmalls.map((t) => Number(t.replace("−", "-"))).filter((n) => !Number.isNaN(n)).reduce((x, v) => x + v, 0), 0, "scoped seat changes conserve");

  // a seat-type pick rides across years too
  const clsScope = await page.$eval('#story .st-scwrap [data-scope^="cls:"]', (e) => e.dataset.scope);
  const CLS_SHORT = { "Inner Metropolitan": "Inner metro", "Outer Metropolitan": "Outer metro", Provincial: "Provincial", Rural: "Rural" };
  const clsElection = CLS_SHORT[clsScope.slice(4)];
  assert.ok(clsElection, `a seat-type scope is on the menu: ${clsScope}`);
  await pick(page, clsScope);
  assert.equal(await label(page), "Change filter", `picked ${clsElection} on Now`);
  await pressedIs(page, `${clsScope} = ${clsElection}`, "its item pressed, plainly named");
  assert.equal((await selLevel(page)).level, "aus", "a seat-type pick steps the state selection out");
  assert.ok(!(await noteShown()), `${clsElection} drops the note — its seats aren't in this class`);
  await year(page, 2025);
  await pressedIs(page, `${clsScope} = ${clsElection}`, `${clsElection} — plain — survives Now → 2025`);
  await year(page, "vic22");
  await labelIs(page, "Filter seats", "a seat-type pick falls back on a state frame too");
  await year(page, 2025);
  await pressedIs(page, `${clsScope} = ${clsElection}`, "and returns on the federal election frame");

  // Rural keeps the Now deltas as well (both coalition losses are rural seats) —
  // and the note follows its seats: no Queensland view, back on the Rural one
  await year(page, "now");
  await pick(page, "st:QLD");
  assert.deepEqual(await selLevel(page), { level: "state", st: "QLD" }, "Queensland selects in the map too");
  assert.ok(!(await noteShown()), "Queensland drop the One Nation note");
  // "All seats" clears the slice from whichever side named it: store, map and head return together
  await page.click("#story .st-up");
  await labelIs(page, "Filter seats", "the 'All seats' way out drops back to the inviter");
  assert.deepEqual(await selLevel(page), { level: "aus" }, "…and clears the map's selection");
  assert.equal(await headTitle(page), "The House today", "…and the head is the frame's own again");
  assert.equal(await upLabel(page), null, "…with no way further out");
  await pick(page, "cls:Rural");
  await labelIs(page, "Change filter", "a fresh filter re-arms the trigger");
  const ruralSmalls = await seatSmalls();
  assert.ok(ruralSmalls.length && ruralSmalls.some((t) => /[−+][1-9]/.test(t)), `Rural on Now carries the seat deltas: ${ruralSmalls.join(" ")}`);
  assert.ok(await noteShown(), "Rural on Now keeps the One Nation note");

  assert.deepEqual(errors, [], "no page exceptions");
  console.log("PASS: the trigger invites (Filter seats) or offers its changer (Change filter); the pick rides frames as the pressed item, plainly named; the slice stays unified");
  await page.close();
} finally { await browser.close(); }
