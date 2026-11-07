// Manual regression probe for the Winner head's figures-scope menu surviving a
// year switch (2026-11-07): a pick ("NSW", a seat type) is one store shared
// across frames; a frame that can't express it (a state frame shown a federal
// state pick) shows its own jurisdiction until one can. The wording stays
// PLAIN on the menu's items ("National", "NSW", "Victoria", "Inner metro") —
// the midday "… figures" compounds all died by user call on 2026-11-07 — and
// the menu's TRIGGER names its JOB, not the pick: "Filter by state/territory and seat type" by default,
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
// the Seats figure block's own label line (the "Seats (Labor won 71.4% of N)"
// line sits beside the figures grid, not inside it)
const seatLabN = (page) => page.evaluate(() => {
  const lab = [...document.querySelectorAll("#story .st-lab")].find((e) => e.textContent.startsWith("Seats ("));
  const mm = lab && lab.textContent.match(/of (\d+)/);
  return mm && Number(mm[1]);
});
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
  await labelIs(page, "Filter by state/territory and seat type", "the trigger invites the filter by its axes, on every frame");
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
  assert.equal(await headTitle(page), "New South Wales · 2025", "the filtered head's title carries the middot year on an election frame");
  const menu25 = await menuLabels(page);
  assert.ok(menu25.some((l) => l.startsWith("aus = National")) && menu25.some((l) => l.startsWith("st:NSW = NSW")) && !menu25.some((l) => l.endsWith("figures")), `the 2025 menu names itself plainly: ${menu25.join(" | ")}`);
  const nswFig = await page.$eval("#story .st-stat", (e) => e.textContent);
  assert.ok(!/NaN|undefined|Infinity/.test(nswFig), `2025 NSW-scoped head figures clean: ${nswFig.slice(0, 160)}`);
  await year(page, 2022);
  await pressedIs(page, "st:NSW = NSW", "NSW survives 2025 → 2022");

  // …falls back where a frame has no such scope, and returns when one does
  await year(page, "vic22");
  await labelIs(page, "Filter by state/territory and seat type", "a state election frame falls back to unfiltered — the inviter returns");
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

  // a seat-type pick rides across years too
  const clsScope = await page.$eval('#story .st-scwrap [data-scope^="cls:"]', (e) => e.dataset.scope);
  const CLS_SHORT = { "Inner Metropolitan": "Inner metro", "Outer Metropolitan": "Outer metro", Provincial: "Provincial", Rural: "Rural" };
  const clsElection = CLS_SHORT[clsScope.slice(4)];
  assert.ok(clsElection, `a seat-type scope is on the menu: ${clsScope}`);
  await pick(page, clsScope);
  assert.equal(await label(page), "Change filter", `picked ${clsElection} on Now`);
  await pressedIs(page, `${clsScope} = ${clsElection}`, "its item pressed, plainly named");
  // since 2026-11-08 the type COMPOUNDS the selected state — the probe rode in
  // on an NSW slice, so the pair is what every line below asserts
  assert.equal(await headTitle(page), "New South Wales", "the type compounds the selected state instead of ejecting it");
  assert.equal(await upLabel(page), "All seats", "…and the pair's way out sits above");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "…with the state still selected beside it");
  assert.ok(!(await noteShown()), "NSW's inner-metro pair names no such seats — the note drops");
  await year(page, 2025);
  await pressedIs(page, `${clsScope} = ${clsElection}`, "the pair — state and type — rides Now → 2025");
  assert.equal(await headTitle(page), "New South Wales · 2025", "the state's middot-year title heads the pair on the election frame");
  const pairN = await page.evaluate(() => __map.Y[2025].divs.filter((d) => d.st === "NSW" && d.cls === "Inner Metropolitan").length);
  const pairLab = await seatLabN(page);
  assert.equal(pairLab, pairN, `its seats row names the intersection's own count (${pairLab})`);
  const clsSmalls = await seatSmalls();
  assert.ok(clsSmalls.length && clsSmalls.every((t) => /[−+\d]/.test(t)), `the pair on an election frame carries seat deltas of these seats: ${clsSmalls.join(" ")}`);
  assert.equal(clsSmalls.map((t) => Number(t.replace("−", "-"))).filter((n) => !Number.isNaN(n)).reduce((x, v) => x + v, 0), 0, "…summing to zero inside the scope");
  await year(page, "vic22");
  await labelIs(page, "Filter by state/territory and seat type", "a seat-type pick falls back on a state frame too");
  assert.equal((await selLevel(page)).level, "aus", "the state axis sleeps on a frame that can't hold it");
  await year(page, 2025);
  await pressedIs(page, `${clsScope} = ${clsElection}`, "the type returns on the federal election frame");
  assert.equal(await headTitle(page), `${clsElection} · 2025`, "…and with no state left, its title is the class's own middot year");
  assert.equal((await selLevel(page)).level, "aus", "…the state doesn't resurrect from a frame that dropped it");

  // Rural keeps the Now deltas as well (both coalition losses are rural seats) —
  // and the note follows its seats: no Queensland view, back on the Rural one.
  // (The probe comes here with the class filter still on: naming a state
  // composes on the map side rather than replacing the class.)
  await year(page, "now");
  await page.click("#story .st-scwrap [data-scope-trigger]");
  await page.click(`#story .st-scwrap [data-scope="st:QLD"]`);
  await page.waitForFunction(() => __map.S.sel.level === "state" && __map.S.sel.st === "QLD", { timeout: 15000 });
  assert.equal(await headTitle(page), "Queensland", "a state named beside an active class filter composes on the map side");
  await pressedIs(page, `${clsScope} = ${clsElection}`, "…and the class filter survives the state's move");
  assert.ok(!(await noteShown()), "Queensland drop the One Nation note");
  // "All seats" clears the slice from whichever side named it: store, map and head return together
  await page.click("#story .st-up");
  await labelIs(page, "Filter by state/territory and seat type", "the 'All seats' way out drops back to the inviter");
  assert.deepEqual(await selLevel(page), { level: "aus" }, "…and clears the map's selection");
  assert.equal(await headTitle(page), "The House today", "…and the head is the frame's own again");
  assert.equal(await upLabel(page), null, "…with no way further out");
  await pick(page, "cls:Rural");
  await labelIs(page, "Change filter", "a fresh filter re-arms the trigger");
  const ruralSmalls = await seatSmalls();
  assert.ok(ruralSmalls.length && ruralSmalls.some((t) => /[−+][1-9]/.test(t)), `Rural on Now carries the seat deltas: ${ruralSmalls.join(" ")}`);
  assert.ok(await noteShown(), "Rural on Now keeps the One Nation note");
  // a seat-type filter's "All seats" clears through the menu's store too
  assert.equal(await upLabel(page), "All seats", "Rural shows its own way out");
  await page.click("#story .st-up");
  await labelIs(page, "Filter by state/territory and seat type", "…and 'All seats' clears a seat-type filter as well");
  assert.equal(await headTitle(page), "The House today", "…with the head back to the frame's own");
  assert.equal(await upLabel(page), null, "…and nothing left to step out from");

  // the cls lens tells the Winner story; its types sit as a toggle row of chips
  // sharing the one scope store (controls unified later on 2026-11-08)
  async function chipPressed(page) { return page.$eval(`#story .lg-types.st-typefilters [aria-pressed="true"]`, (e) => e.textContent.trim()).catch(() => null); }
  async function chipPick(page, name) {
    await page.evaluate((name) => { const el = [...document.querySelectorAll(`#story .lg-types.st-typefilters [data-scope^="cls:"]`)].find((e) => e.textContent.trim() === name); if (el) el.click(); }, name);
    await page.waitForFunction(() => document.querySelector(`#story .lg-types.st-typefilters [aria-pressed="true"]`), { timeout: 15000 });
  }
  await page.evaluate(() => __map.setLens("cls"));
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
  assert.ok(!(await page.$(`#story .st-scwrap [data-scope-trigger]`)), "the cls lens carries no dropdown — its types are a chip row");
  const chips = await page.$$eval(`#story .lg-types.st-typefilters [data-scope]`, (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(chips, ["Inner metro", "Outer metro", "Provincial", "Rural"], "…its four types sit as chips");
  const clsHed = await page.evaluate(() => ({
    aria: document.querySelector("#story .st-stat")?.getAttribute("aria-label") ?? null,
    hero: !document.querySelector("#story .hero"),
  }));
  assert.ok(clsHed.aria && /holds \d+ of the \d+ seats/.test(clsHed.aria), `its story is the winner design's (${clsHed.aria?.slice(0, 70)})`);
  assert.ok(clsHed.hero, "…and the two-party hero folds into the head, winner-style");
  await chipPick(page, clsElection);
  assert.equal(await chipPressed(page), clsElection, "its chip presses");
  assert.equal(await headTitle(page), clsElection, "…its title names the pick too (bare on Now)");
  assert.equal(await upLabel(page), "All seats", "…and earns the type's way out");
  await page.click("#story .st-up");
  await page.waitForFunction(() => !document.querySelector(`#story .lg-types.st-typefilters [aria-pressed="true"]`), { timeout: 15000 });
  assert.equal(await upLabel(page), null, "…'All seats' clears the row too");
  await page.evaluate(() => __map.setLens("winner"));
  await page.waitForNetworkIdle({ idleTime: 200, timeout: 15000 });
  await labelIs(page, "Filter by state/territory and seat type", "…and the winner lens's invitation is its own two axes");

  // the two axes compound (2026-11-08): a menu class pick narrows INSIDE the
  // map's own state selection rather than ejecting it
  await pick(page, "st:NSW");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "NSW named and selected");
  const imN = await page.evaluate(() => __map.Y.now.divs.filter((d) => d.st === "NSW" && d.cls === "Inner Metropolitan").length);
  assert.ok(imN > 5 && imN < 25, `New South Wales's inner-metropolitan seats: ${imN}`);
  await pick(page, "cls:Inner Metropolitan");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "…and NSW stays selected when the type comes in");
  assert.equal(await headTitle(page), "New South Wales", "the state keeps its head title over the pair");
  assert.equal(await label(page), "Change filter", "the trigger is the changer of the pair");
  await pressedIs(page, "cls:Inner Metropolitan = Inner metro", "the class item marks the figures axis");
  const compN = await seatLabN(page);
  assert.equal(compN, imN, `the seats pool IS the inner-metros of New South Wales (${compN})`);
  const compGeo = await page.evaluate(() => document.querySelector("#story .vt-skew-head")?.textContent.trim() ?? "");
  assert.ok(compGeo.includes("in NSW"), `the cast chart reads its pool's place (${compGeo.slice(0, 46)})`);
  await page.click("#story .st-up");
  await labelIs(page, "Filter by state/territory and seat type", "'All seats' ejects both axes");
  assert.deepEqual(await selLevel(page), { level: "aus" }, "…and the map is out of it too");

  // …and the same pair forms from the cls lens's side, chips included
  await page.evaluate(() => __map.setLens("cls"));
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 });
  await page.evaluate(() => __map.goState("NSW", { fly: false }));
  await page.waitForFunction(() => __map.S.sel.level === "state", { timeout: 15000 });
  assert.ok(await page.$("#story .lg-types.st-typefilters"), "and the type row is on hand beside a state");
  await chipPick(page, "Rural");
  assert.equal(await chipPressed(page), "Rural", "the type pairs down beside the state");
  assert.deepEqual(await selLevel(page), { level: "state", st: "NSW" }, "…with the state still selected");
  const ruralN = await page.evaluate(() => __map.Y.now.divs.filter((d) => d.st === "NSW" && d.cls === "Rural").length);
  const compN2 = await seatLabN(page);
  assert.equal(compN2, ruralN, "cls lens compounds its pools the same way");
  await page.evaluate(() => __map.goAus({ fly: false }));
  await page.evaluate(() => __map.setLens("winner"));
  await page.waitForNetworkIdle({ idleTime: 200, timeout: 15000 });

  assert.deepEqual(errors, [], "no page exceptions");
  console.log("PASS: the trigger invites (Filter by state/territory and seat type; the cls lens's types are a chip row); the pick rides frames as the pressed item, plainly named; the slice stays unified; state and type compound");
  await page.close();
} finally { await browser.close(); }
