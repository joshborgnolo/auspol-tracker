/* headless probe of the All-polls Preference flows highlight (#flow-drift,
   the two drift charts' "Highlight a pollster" menu, reshaped 2026-10-11):
   the menu is ONE native select (.rd-fl-sel) over both charts, present at
   every width (the old popover sat in the first chart's title row and a
   phone never got it). With nothing picked there are NO per-house month
   rings (.rd-fl-vhit) and no pick line - an unseen hover target is not a
   mark the key can name. Picking a pollster:
     - draws one .rd-fl-pick line per chart,
     - lays one .rd-fl-vhit ring at each of its months (payload's houses),
     - brings its waves forward (.rd-fl-wdot.on, one per payload wave) and
       sends the rest back (.off),
     - adds "<pollster>, month by month" to the key,
     - and a pointer on its line reads THAT pollster, never a faded
       neighbour: paint order is hit order, so the faded waves go down
       first, then the line's month rings, then the pollster's own waves
       (2026-10-12 - a phone tap on RedBridge/Accent's March mark had read
       a faded Freshwater dot painted over it).
   Run against a built tree: node .matilda/probe/flow-pick.mjs */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.join(ROOT, "allpolls", "index.html");
const PICK = process.env.PICK || "RedBridge/Accent";
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
for (const w of [1440, 390]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: w < 700 ? 2600 : 1700, deviceScaleFactor: 1, hasTouch: w < 700, isMobile: w < 700 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(PAGE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#flow-drift select.rd-fl-sel", { timeout: 30000 });
  const exp = await page.evaluate((pick) => {
    const D = window.AUSPOL, from = "2025-06";
    return {
      wC: D.flowDrift.polls.filter((p) => p.pollster === pick && p.released >= from).length,
      wO: D.flowDriftOn.polls.filter((p) => p.pollster === pick && p.released >= from).length,
      vC: (D.flowDrift.houses[pick] || []).filter((d) => d.ym >= from).length,
      vO: (D.flowDriftOn.houses[pick] || []).filter((d) => d.ym >= from).length,
    };
  }, PICK);
  const before = await page.evaluate(() => ({
    sels: document.querySelectorAll("#flow-drift select.rd-fl-sel").length,
    vhit: document.querySelectorAll("#flow-drift .rd-fl-vhit").length,
    pick: document.querySelectorAll("#flow-drift .rd-fl-pick").length,
    faded: document.querySelectorAll("#flow-drift .rd-fl-wdot.on, #flow-drift .rd-fl-wdot.off").length,
  }));
  check(before.sels === 1, `${w}: one highlight menu for both charts (${before.sels})`);
  check(before.vhit === 0 && before.pick === 0 && before.faded === 0,
    `${w}: nothing picked - no month rings, no pick line, no faded dots (${before.vhit}/${before.pick}/${before.faded})`);
  await page.select("#flow-drift select.rd-fl-sel", PICK);
  await wait(250);
  const after = await page.evaluate((pick) => {
    const halves = [...document.querySelectorAll("#flow-drift .rd-fl-chart")];
    const s = document.querySelector("#flow-drift select.rd-fl-sel");
    return {
      on: halves.map((h) => h.querySelectorAll(".rd-fl-wdot.on").length),
      off: halves.map((h) => h.querySelectorAll(".rd-fl-wdot.off").length),
      vhit: halves.map((h) => h.querySelectorAll(".rd-fl-vhit").length),
      pick: halves.map((h) => h.querySelectorAll(".rd-fl-pick").length),
      key: [...document.querySelectorAll("#flow-drift .rd-fl-key .rd-key-item")].map((k) => k.textContent.trim()),
      reset: s.options[0].text,
      sw: document.documentElement.scrollWidth, iw: innerWidth,
    };
  }, PICK);
  check(after.on[0] === exp.wC && after.on[1] === exp.wO, `${w}: the pick's waves come forward (${after.on} vs ${exp.wC},${exp.wO})`);
  check(after.off.every((n) => n > 0), `${w}: every other wave recedes (${after.off})`);
  check(after.vhit[0] === exp.vC && after.vhit[1] === exp.vO, `${w}: one month ring per picked month (${after.vhit} vs ${exp.vC},${exp.vO})`);
  check(after.pick.every((n) => n === 1), `${w}: one pick line per chart (${after.pick})`);
  check(after.key.includes(PICK + ", month by month"), `${w}: the key names the pick`);
  check(after.reset === "No highlight", `${w}: the menu's first option clears the pick ("${after.reset}")`);
  check(after.sw <= after.iw, `${w}: no sideways overflow (${after.sw}/${after.iw})`);
  /* every month ring on the first chart: a pointer at its centre must read
     the picked pollster (its month tip, or its own wave sitting on the
     mark), never a faded neighbour */
  const n = after.vhit[0];
  let wrong = [];
  for (let i = 0; i < n; i++) {
    const pt = await page.evaluate((i) => {
      const r = document.querySelectorAll("#flow-drift .rd-fl-chart")[0].querySelectorAll(".rd-fl-vhit")[i];
      r.scrollIntoView({ block: "center", behavior: "instant" });
      const b = r.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, i);
    await wait(60);
    if (w < 700) await page.touchscreen.tap(pt.x, pt.y);
    else await page.mouse.move(pt.x, pt.y, { steps: 2 });
    await wait(120);
    const t = await page.evaluate(() => {
      const el = document.querySelectorAll("#flow-drift .rd-fl-chart")[0].querySelector(".tip .tip-title");
      return el ? el.textContent : null;
    });
    if (t !== PICK) wrong.push(i + ":" + t);
    if (w < 700) { await page.touchscreen.tap(5, 5); await wait(80); }
    else { await page.mouse.move(2, 2); await wait(60); }
  }
  check(n > 0 && wrong.length === 0, `${w}: all ${n} month rings read ${PICK}${wrong.length ? " - misses " + wrong.join(", ") : ""}`);
  check(errs.length === 0, `${w}: no page errors${errs.length ? " (" + errs[0].slice(0, 160) + ")" : ""}`);
  await page.close();
}
await browser.close();
console.log(fails ? `flow-pick: ${fails} FAILED` : "flow-pick: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
