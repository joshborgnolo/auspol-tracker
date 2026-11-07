// Manual regression probe for the Winner head's figures-filter menu and the
// cls lens's companion row, across year switches and lens switches.
//
// UNIFICATION (2026-11-07): a state named in the menu and a state selected on
// the map are ONE slice — the menu's pick selects the state on the map (no
// camera move), the whole-frame layout keeps the head title in the state's
// name, the "All seats" way out above it, and the state selected in the map.
//
// MENU-AS-OPEN-AXIS (2026-11-08, user calls): the dropdown always offers the
// axis that is OPEN — unsliced, the states ("Filter by state/territory"); a
// sliced state's menu is the SEAT TYPES ("Filter by seat type", since changing
// the state needs no menu), the trigger NAMING the pick once one compounds.
// The cls lens mirrors this beside its own chips row. A class pick only ever
// filters where the page can show it: sliced, or on its own lens —
// elsewhere it reads as National and wakes the moment a state slices. "All
// seats" ejects both axes.
// Start a local server from the repo root, then
// MAP_URL=http://127.0.0.1:8765 node .build/map/probe-scope.mjs
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--force-prefers-reduced-motion"] });
const base = process.env.MAP_URL || "http://127.0.0.1:8765";
const label = (page) => page.$eval("#story .st-scwrap [data-scope-trigger]", (e) => e.textContent.replace(/\s+/g, " ").trim());
const menuLabels = (page) => page.$$eval("#story .st-scwrap [data-scope]", (els) => els.map((e) => `${e.dataset.scope} = ${e.textContent.trim()}${e.getAttribute("aria-pressed") ? " [pressed]" : ""}`));
const pressedItem = (page) => page.$eval(`#story .st-scwrap [data-scope][aria-pressed="true"]`, (e) => `${e.dataset.scope} = ${e.textContent.trim()}`);
const selLevel = (page) => page.evaluate(() => ({ ...__map.S.sel }));
const headTitle = (page) => page.$eval("#story .st-head h2", (e) => e.textContent.trim());
// the Seats figure block's own label line (the "Seats (Labor won 71.4% of N)"
// line sits beside the figures grid, not inside it)
const seatLabN = (page) => page.evaluate(() => {
  const lab = [...document.querySelectorAll("#story .st-lab")].find((e) => e.textContent.startsWith("Seats ("));
  const mm = lab && lab.textContent.match(/of (\d+)/);
  return mm && Number(mm[1]);
});
const upLabel = (page) => page.$eval("#story .st-up", (e) => e.textContent.trim()).catch(() => null);
const chipsRow = (page) => page.$$eval(`#story .lg-types.st-typefilters [data-scope]`, (els) => els.map((e) => e.textContent.trim()));
const chipPressed = (page) => page.$eval(`#story .lg-types.st-typefilters [aria-pressed="true"]`, (e) => e.textContent.trim()).catch(() => null);
async function chipPick(page, name) {
  await page.evaluate((name) => { const el = [...document.querySelectorAll(`#story .lg-types.st-typefilters [data-scope^="cls:"]`)].find((e) => e.textContent.trim() === name); if (el) el.click(); }, name);
  await page.waitForFunction(() => document.querySelector(`#story .lg-types.st-typefilters [aria-pressed="true"]`), { timeout: 15000 });
}
// pick a menu item by its data-scope value, through the real trigger-open click
// chain. A state pick swaps the menu to the types alongside it (its own item
// leaves the list), so its landing is the SELECTION, not a pressed item
async function pick(page, scope) {
  await page.click("#story .st-scwrap [data-scope-trigger]");
  await page.click(`#story .st-scwrap [data-scope="${scope}"]`);
  if (scope.startsWith("cls:")) await page.waitForFunction((s) => document.querySelector(`#story .st-scwrap [data-scope="${s}"]`)?.getAttribute("aria-pressed") === "true", { timeout: 15000 }, scope);
  else await page.waitForFunction((s) => __map.S.sel.level === (s === "aus" ? "aus" : "state"), { timeout: 15000 }, scope);
}
async function year(page, y) {
  await page.evaluate(async (y) => { await __map.setYear(y); __map.setView("map"); }, y);
  await page.waitForFunction((y) => __map.S.year === y && __map.Y[y]?.divs, { timeout: 60000 }, y);
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
}
async function labelIs(page, want, ctx) {
  await page.waitForFunction((w) => document.querySelector("#story .st-scwrap [data-scope-trigger]")?.textContent.includes(w), { timeout: 15000 }, want);
  const got = await label(page);
  assert.equal(got, want, ctx);
}
async function pressedIs(page, want, ctx) {
  const v = want.split(" = ")[0];
  await page.waitForFunction((v) => { const el = document.querySelector(`#story .st-scwrap [data-scope="${v}"]`); return el?.getAttribute("aria-pressed") === "true"; }, { timeout: 15000 }, v);
  const got = await pressedItem(page);
  assert.equal(got, want, ctx);
}
async function clsItemsAreTypes(page, ctx) {
  const menu = await menuLabels(page);
  assert.deepEqual(menu.map((l2) => l2.split(" = ")[0]), ["cls:Inner Metropolitan", "cls:Outer Metropolitan", "cls:Provincial", "cls:Rural"], ctx + `: ${menu.join(" | ")}`);
}
try {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => console.log("requestfailed:", r.url(), r.failure()?.errorText));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/map/#y=now`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__map, { timeout: 60000 });
  await page.evaluate(() => { __map.setLens("winner"); __map.goAus(); __map.setView("map"); });
  await labelIs(page, "Filter by state/territory", "the trigger invites by the state axis");
  // the now view carries the base election's swings (user call, 2026-11-07)
  const nowSw = await page.evaluate(() => ({
    swing: document.querySelector("#story .st-stat .st-swing")?.textContent.trim() ?? null,
    smalls: [...document.querySelectorAll("#story .st-fps small")].length,
  }));
  assert.ok(nowSw.swing && /swing$/.test(nowSw.swing), `the now view's head shows its swing: ${nowSw.swing}`);
  assert.ok(nowSw.smalls > 0, "…and its primaries row carries change smalls");
  const menuNow = await menuLabels(page);
  assert.ok(menuNow.some((l) => l.startsWith("aus = National [pressed]")) && menuNow.some((l) => l.startsWith("st:NSW = NSW"))
    && menuNow.some((l) => l.startsWith("st:VIC = Victoria")) && menuNow.some((l) => l.startsWith("st:QLD = Queensland"))
    && menuNow.some((l) => l.startsWith("st:WA = Western Australia")) && menuNow.some((l) => l.startsWith("st:SA = South Australia"))
    && menuNow.some((l) => l.startsWith("st:TAS = Tasmania")) && !menuNow.some((l) => l.startsWith("cls:")), `the unsliced menu is the states, plainly named: ${menuNow.join(" | ")}`);
  const noteShown = () => page.evaluate(() => !!document.querySelector("#story .st-seat-note"));
  assert.ok(await noteShown(), "the moved-seats note shows at National");

  // a state pick goes on the map and flips the menu to the OTHER axis: the types
  await pick(page, "st:NSW");
  await labelIs(page, "Filter by seat type", "a sliced state's trigger offers to add the type axis");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "picking NSW in the menu selects NSW in the map");
  assert.equal(await headTitle(page), "New South Wales", "the head titles itself by the state");
  assert.equal(await upLabel(page), "All seats", "the 'All seats' way out sits above the head");
  assert.ok(await noteShown(), "NSW keep the note — New England and Farrer are NSW seats");
  await clsItemsAreTypes(page, "the sliced menu is the seat types, plainly named");
  assert.ok(!(await menuLabels(page)).some((l) => l.endsWith("[pressed]")), "…with nothing pressed until a type is on");

  // the slice rides federal years, falls back on a state frame, and returns
  await year(page, 2025);
  await labelIs(page, "Filter by seat type", "the type offer rides Now → 2025");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "NSW lives on the election frame too");
  assert.equal(await headTitle(page), "New South Wales · 2025", "the filtered head's title carries the middot year on an election frame");
  const nswFig = await page.$eval("#story .st-stat", (e) => e.textContent);
  assert.ok(!/NaN|undefined|Infinity/.test(nswFig), `2025 NSW-scoped head figures clean: ${nswFig.slice(0, 160)}`);
  await year(page, 2022);
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "NSW survives 2025 → 2022");
  await year(page, "vic22");
  await labelIs(page, "Filter by state/territory", "a state frame falls back — the invite returns");
  await pressedIs(page, "aus = Victoria", "…its pressed jurisdiction item, plainly named");
  assert.equal((await selLevel(page)).level, "aus", "a frame that can't show the slice carries no map selection");
  assert.equal(await headTitle(page), "Victorian election", "…and the head is the frame's own, unmarked by the dormant pick");
  await year(page, 2025);
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "back on a federal frame the slice re-selects itself");
  await labelIs(page, "Filter by seat type", "…and the type offer returns with it");
  await year(page, "now");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "and rides back to Now");

  // the NSW Now seats line carries the coalition's losses, and conserves them
  const seatSmalls = () => page.$$eval("#story .st-seats small", (els) => els.map((e) => e.textContent.trim()));
  const nswSmalls = await seatSmalls();
  assert.ok(nswSmalls.length && nswSmalls.some((t) => /[−+][1-9]/.test(t)), `NSW carry the Now seat deltas: ${nswSmalls.join(" ")}`);
  assert.equal(nswSmalls.map((t) => Number(t.replace("−", "-"))).filter((n) => !Number.isNaN(n)).reduce((x, v) => x + v, 0), 0, "scoped seat changes conserve");

  // type compounds INSIDE the slice: the pool is New South Wales's inner metros
  const pairN = await page.evaluate(() => __map.Y.now.divs.filter((d) => d.st === "NSW" && d.cls === "Inner Metropolitan").length);
  assert.ok(pairN > 5 && pairN < 25, `New South Wales's inner-metropolitan seats: ${pairN}`);
  await pick(page, "cls:Inner Metropolitan");
  await labelIs(page, "Inner metro", "a type on the sliced state names itself on the trigger");
  await pressedIs(page, "cls:Inner Metropolitan = Inner metro", "…its item pressed, plainly named");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "…and NSW stays selected beside it");
  assert.equal(await headTitle(page), "New South Wales", "the state keeps its head title over the pair");
  assert.equal(await seatLabN(page), pairN, `the seats pool IS the inner-metros of New South Wales (${pairN})`);
  assert.ok(!(await noteShown()), "NSW's inner-metro pair names no such seats — the note drops");
  const compSmalls = await seatSmalls();
  assert.equal(compSmalls.map((t) => Number(t.replace("−", "-"))).filter((n) => !Number.isNaN(n)).reduce((x, v) => x + v, 0), 0, "…and the pair's changes conserve");

  // the pair rides years; a state frame ejects both axes for good
  await year(page, 2025);
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "the pair — state and type — rides Now → 2025");
  assert.equal(await headTitle(page), "New South Wales · 2025", "…titled by the state with the middot year");
  assert.equal(await seatLabN(page), await page.evaluate(() => __map.Y[2025].divs.filter((d) => d.st === "NSW" && d.cls === "Inner Metropolitan").length), "its seats row names the same intersection");
  await year(page, "vic22");
  await labelIs(page, "Filter by state/territory", "a state frame drops both axes");
  assert.equal((await selLevel(page)).level, "aus", "…and the state doesn't resurrect (a compound keeps no ride-home)");
  await year(page, "now");
  assert.equal((await selLevel(page)).level, "aus", "…nor on Now after the fallback took them");
  await labelIs(page, "Filter by state/territory", "…the page back at the invite, a settled compound reads National there");

  // the compound wakes when a state slices again (the pick survived the fallback)
  await page.evaluate(() => __map.goState("NSW", { fly: false }));
  await page.waitForFunction(() => __map.S.sel.level === "state", { timeout: 15000 });
  await labelIs(page, "Inner metro", "a slice re-wakes the settled compound");
  await pressedIs(page, "cls:Inner Metropolitan = Inner metro", "…its own pick still pressed");
  await page.click("#story .st-up");
  await labelIs(page, "Filter by state/territory", "…and 'All seats' evicts it");

  // a fresh pair from the map side: New South Wales, then Rural over it
  await page.evaluate(() => __map.goState("NSW", { fly: false }));
  await page.waitForFunction(() => __map.S.sel.level === "state", { timeout: 15000 });
  await labelIs(page, "Filter by seat type", "…with the offer arming clean each time");
  await pick(page, "cls:Rural");
  const ruralSmalls = await seatSmalls();
  assert.ok(ruralSmalls.length && ruralSmalls.some((t) => /[−+][1-9]/.test(t)), `NSW's rural pair carries the deltas: ${ruralSmalls.join(" ")}`);
  assert.ok(await noteShown(), "NSW's rural pair keeps the One Nation note");
  await page.click("#story .st-up");
  await labelIs(page, "Filter by state/territory", "'All seats' ejects both axes");
  assert.deepEqual(await selLevel(page), { level: "aus" }, "…and the map is out of it too");
  assert.equal(await headTitle(page), "The House today", "…with the head the frame's own again");
  assert.equal(await upLabel(page), null, "…and nothing left to step out from");

  // the cls lens's types are chips; its dropdown joins the same sliced family
  await page.evaluate(() => { __map.setLens("cls"); __map.goState("NSW", { fly: false }); });
  await page.waitForFunction(() => __map.S.lens === "cls" && __map.S.sel.level === "state", { timeout: 15000 });
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
  await labelIs(page, "Filter by seat type", "the cls lens's sliced state arms the same offer");
  const stacked = await page.evaluate(() => {
    const wrap = document.querySelector("#story .st-clsmeta"); if (!wrap) return "missing";
    const a = wrap.querySelector(".st-scwrap"), b = wrap.querySelector(".lg-types.st-typefilters");
    return a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? "dropdown-above" : "misplaced";
  });
  assert.equal(stacked, "dropdown-above", "…and the dropdown stacks above the types toggle");
  assert.deepEqual(await chipsRow(page), ["Inner metro", "Outer metro", "Provincial", "Rural"], "…whose row names the four types");
  await clsItemsAreTypes(page, "…and its sliced menu the types too");
  const ruralNSW = await page.evaluate(() => __map.Y.now.divs.filter((d) => d.st === "NSW" && d.cls === "Rural").length);
  const ruralAus = await page.evaluate(() => __map.Y.now.divs.filter((d) => d.cls === "Rural").length);

  // the pair forms from the chip row: Rural inside New South Wales
  await chipPick(page, "Rural");
  assert.equal(await chipPressed(page), "Rural", "the Rural chip presses");
  await labelIs(page, "Rural", "…and the sliced trigger names the pick");
  assert.equal(await headTitle(page), "New South Wales", "…while the state keeps its head title over the pair");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "…selected beside it");
  assert.equal(await seatLabN(page), ruralNSW, `the seats pool IS the rurals of New South Wales (${ruralNSW})`);
  assert.ok(await noteShown(), "NSW's rural pair names both One Nation seats");
  assert.equal(await upLabel(page), "All seats", "…and the state's way out sits above");

  // the cls pair rides federal years; a state frame's frame lacks the types' chips
  await year(page, 2025);
  assert.equal(await chipPressed(page), "Rural", "the Rural chip rides Now → 2025");
  assert.equal(await headTitle(page), "New South Wales · 2025", "…and the state's middot year heads the pair");
  assert.equal(await seatLabN(page), await page.evaluate(() => __map.Y[2025].divs.filter((d) => d.st === "NSW" && d.cls === "Rural").length), "its election seats row is the same intersection");
  await year(page, "vic22");
  await labelIs(page, "Filter by state/territory", "a state frame drops both axes — the invite returns");
  assert.deepEqual(await chipsRow(page), [], "…and the types' own chips don't live on its frame");
  assert.equal((await selLevel(page)).level, "aus", "the state axis sleeps with it");
  await year(page, "now");
  assert.equal(await chipPressed(page), "Rural", "the Rural chip returns on Now");
  assert.equal(await headTitle(page), "Rural", "…and names the head alone");
  assert.equal(await seatLabN(page), ruralAus, `its pool back to the frame's rurals (${ruralAus})`);

  // leaving the cls lens evicts the type — a pick never reads invisible
  await page.evaluate(() => __map.setLens("winner"));
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
  assert.equal(await chipPressed(page), null, "…and going home evicts the type");
  await labelIs(page, "Filter by state/territory", "…with Winner's own one-axis invitation up");

  assert.deepEqual(errors, [], "no page exceptions");
  console.log("PASS: unsliced, the menu is the states; sliced, it's the types (Filter by seat type, then the trigger names the pick); pairs compound and ride frames; a class never filters where nothing marks it; 'All seats' ejects both axes");
  await page.close();
} finally { await browser.close(); }
