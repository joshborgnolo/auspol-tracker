// Manual regression probe for the Winner head's figures menu and the cls
// lens's figures controls, across year switches and lens switches.
//
// UNIFICATION (2026-11-07): a state named in the menu and a state selected on
// the map are ONE slice — the menu's pick selects the state on the map (no
// camera move), the whole-frame layout keeps the head title in the state's
// name, the "All seats" way out above it, and the state selected in the map.
// "All seats" (goAus) clears the slice — so year() must NOT reset the
// navigation after each year, or the persistence this probe pins never fires.
//
// AXIS SPLIT (2026-11-08, user call): the state/territory dropdown and the
// seat-type row are separate homes on separate lenses — the dropdown names
// only state/territory wherever it sits ("Filter by state/territory" /
// "Change filter"), and on the cls lens it stacks ABOVE the types toggle row.
// A seat type filters on the cls lens alone; the two axes compound wherever
// the state is selected (a class named inside it, or a state named beside the
// class — the pair pools their intersection). "All seats" leaves its own axis.
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
  await labelIs(page, "Filter by state/territory", "the dropdown invites by its one axis, on every frame");
  // the now view carries the base election's swings (user call, 2026-11-07)
  const nowSw = await page.evaluate(() => ({
    swing: document.querySelector("#story .st-stat .st-swing")?.textContent.trim() ?? null,
    smalls: [...document.querySelectorAll("#story .st-fps small")].length,
  }));
  assert.ok(nowSw.swing && /swing$/.test(nowSw.swing), `the now view's head shows its swing: ${nowSw.swing}`);
  assert.ok(nowSw.smalls > 0, "…and its primaries row carries change smalls");
  const menuNow = await menuLabels(page);
  assert.ok(menuNow.some((l) => l.startsWith("aus = National")) && menuNow.some((l) => l.startsWith("st:NSW = NSW"))
    && menuNow.some((l) => l.startsWith("st:VIC = Victoria")) && menuNow.some((l) => l.startsWith("st:QLD = Queensland"))
    && menuNow.some((l) => l.startsWith("st:WA = Western Australia")) && menuNow.some((l) => l.startsWith("st:SA = South Australia"))
    && menuNow.some((l) => l.startsWith("st:TAS = Tasmania")) && !menuNow.some((l) => l.startsWith("cls:")), `the Now menu items are states alone: ${menuNow.join(" | ")}`);
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
  assert.equal(await headTitle(page), "New South Wales · 2025", "the filtered head's title carries the middot year on an election frame");
  const menu25 = await menuLabels(page);
  assert.ok(menu25.some((l) => l.startsWith("aus = National")) && menu25.some((l) => l.startsWith("st:NSW = NSW")) && !menu25.some((l) => l.endsWith("figures")), `the 2025 menu names itself plainly: ${menu25.join(" | ")}`);
  const nswFig = await page.$eval("#story .st-stat", (e) => e.textContent);
  assert.ok(!/NaN|undefined|Infinity/.test(nswFig), `2025 NSW-scoped head figures clean: ${nswFig.slice(0, 160)}`);
  await year(page, 2022);
  await pressedIs(page, "st:NSW = NSW", "NSW survives 2025 → 2022");

  // …falls back where a frame has no such scope, and returns when one does
  await year(page, "vic22");
  await labelIs(page, "Filter by state/territory", "a state election frame falls back to unfiltered — the inviter returns");
  await pressedIs(page, "aus = Victoria", "…its pressed item the frame's own jurisdiction, plain");
  assert.equal((await selLevel(page)).level, "aus", "a frame that can't show the slice carries no map selection");
  assert.equal(await headTitle(page), "Victorian election", "…and the head is the frame's own, unmarked by the dormant pick");
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

  // the cls lens: the type chips compound with a selected state (2026-11-08).
  // The probe arrives with NSW already selected on the map from the state runs.
  await page.evaluate(() => __map.setLens("cls"));
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
  await labelIs(page, "Change filter", "the cls lens's dropdown wears the state its run carried in");
  const stacked = await page.evaluate(() => {
    const wrap = document.querySelector("#story .st-clsmeta"); if (!wrap) return "missing";
    const a = wrap.querySelector(".st-scwrap"), b = wrap.querySelector(".lg-types.st-typefilters");
    return a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? "dropdown-above" : "misplaced";
  });
  assert.equal(stacked, "dropdown-above", "…and the dropdown stacks above the types toggle");
  assert.deepEqual(await chipsRow(page), ["Inner metro", "Outer metro", "Provincial", "Rural"], "…whose row names the four types");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "…and NSW comes along from the state runs");
  const ruralNSW = await page.evaluate(() => __map.Y.now.divs.filter((d) => d.st === "NSW" && d.cls === "Rural").length);
  const imNSW = await page.evaluate(() => __map.Y.now.divs.filter((d) => d.st === "NSW" && d.cls === "Inner Metropolitan").length);
  const ruralAus = await page.evaluate(() => __map.Y.now.divs.filter((d) => d.cls === "Rural").length);

  // the pair forms: Rural inside New South Wales
  await chipPick(page, "Rural");
  assert.equal(await chipPressed(page), "Rural", "the Rural chip presses");
  assert.equal(await label(page), "Change filter", "…with the state's changer beside it");
  assert.equal(await headTitle(page), "New South Wales", "…while the state keeps its head title over the pair");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "…selected beside it");
  assert.equal(await seatLabN(page), ruralNSW, `the seats pool IS the rurals of New South Wales (${ruralNSW})`);
  assert.ok(await noteShown(), "NSW's rural pair names both One Nation seats");
  const geo = await page.evaluate(() => document.querySelector("#story .vt-skew-head")?.textContent.trim() ?? "");
  assert.ok(geo.includes("in NSW"), `the cast chart reads its pool's place (${geo.slice(0, 46)})`);
  assert.equal(await upLabel(page), "All seats", "…and the state's way out sits above");

  // the pair rides frames; on a frame with no types the class pips sleep
  await year(page, 2025);
  assert.equal(await chipPressed(page), "Rural", "the Rural chip rides Now → 2025");
  assert.equal(await headTitle(page), "New South Wales · 2025", "…and the state's middot year heads the pair");
  const pair25 = await page.evaluate(() => __map.Y[2025].divs.filter((d) => d.st === "NSW" && d.cls === "Rural").length);
  assert.equal(await seatLabN(page), pair25, `its seats row names the intersection's own count (${pair25})`);
  const ruralSmalls = await seatSmalls();
  assert.ok(ruralSmalls.length && ruralSmalls.every((t) => /[−+\d]/.test(t)), `the pair carries the frame's seat deltas of these seats: ${ruralSmalls.join(" ")}`);
  assert.equal(ruralSmalls.map((t) => Number(t.replace("−", "-"))).filter((n) => !Number.isNaN(n)).reduce((x, v) => x + v, 0), 0, "…summing to zero inside the scope");
  await year(page, "vic22");
  await labelIs(page, "Filter by state/territory", "a state election frame falls back to unfiltered — the inviter returns");
  assert.deepEqual(await chipsRow(page), [], "…and the types' own chips don't live on its frame");
  assert.equal((await selLevel(page)).level, "aus", "the state axis sleeps with it");
  await year(page, 2025);
  assert.equal(await chipPressed(page), "Rural", "the Rural chip returns on the federal frame");
  assert.equal(await headTitle(page), "Rural · 2025", "…and the class names the head alone again");
  assert.equal((await selLevel(page)).level, "aus", "…the state doesn't resurrect from a frame that dropped it");
  await year(page, "now");
  assert.equal(await headTitle(page), "Rural", "…and the class-its-own head back on Now");
  assert.equal(await seatLabN(page), ruralAus, `its pool back to the frame's rurals (${ruralAus})`);

  // the class survives its own axis's moves but clears with its lens
  await page.evaluate(() => __map.goAus({ fly: false }));
  assert.equal(await chipPressed(page), "Rural", "clearing the map leaves the class alone");
  await page.evaluate(() => __map.setLens("winner"));
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
  assert.equal(await chipPressed(page), null, "…and going home evicts the type");
  await labelIs(page, "Filter by state/territory", "…with Winner's own one-axis invitation up");

  assert.deepEqual(errors, [], "no page exceptions");
  console.log("PASS: the dropdown names only state/territory on both lenses (Filter by state/territory / Change filter), the cls lens's types are a chip row beneath it, the pairs compound, each axis survives only its own moves");
  await page.close();
} finally { await browser.close(); }
