/* headless probe of the All-polls Preference flows highlight (#flow-drift's
   "Highlight a pollster" menu). Since the 2026-10-13 rebuild (design B: one
   contest per tab) the section draws ONE drift chart, the tab's contest's,
   and the menu sits in that chart's own head - a native select targeted by
   its aria-label (the region menu rides the same .rd-fl-sel sizing idiom in
   the ledger's head). It lists the tab's contest's pollsters; the Coalition
   v One Nation tab draws no drift chart and so no menu. With nothing picked
   there are NO per-house month rings (.rd-fl-vhit) and no pick line - an
   unseen hover target is not a mark the key can name. Picking a pollster:
     - draws one .rd-fl-pick line,
     - lays one .rd-fl-vhit ring at each of its months (payload's houses),
     - brings its waves forward (.rd-fl-wdot.on, one per payload wave) and
       sends the rest back (.off),
     - adds "<pollster>, month by month" to the key,
     - and a pointer on its line reads THAT pollster, never a faded
       neighbour: paint order is hit order, so the faded waves go down
       first, then the line's month rings, then the pollster's own waves
       (2026-10-12 - a phone tap on RedBridge/Accent's March mark had read
       a faded Freshwater dot painted over it).
   A pick that the next tab's contest also carries stays picked there.
   Run against a built tree: node .matilda/probe/flow-pick.mjs */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.join(ROOT, "allpolls", "index.html");
const PICK = process.env.PICK || "RedBridge/Accent";
const SEL = '#flow-drift select[aria-label="Highlight a pollster"]';
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
  await page.waitForSelector(SEL, { timeout: 30000 });
  const tab = async (i) => { await page.evaluate((i) => document.querySelectorAll("#flow-drift .rd-fl-tabs .rd-tab")[i].click(), i); await wait(250); };
  const exp = await page.evaluate((pick) => {
    const D = window.AUSPOL, from = "2025-06";
    return {
      wC: D.flowDrift.polls.filter((p) => p.pollster === pick && p.released >= from).length,
      wO: D.flowDriftOn.polls.filter((p) => p.pollster === pick && p.released >= from).length,
      vC: (D.flowDrift.houses[pick] || []).filter((d) => d.ym >= from).length,
      vO: (D.flowDriftOn.houses[pick] || []).filter((d) => d.ym >= from).length,
      hC: Object.keys(D.flowDrift.houses).sort(), hO: Object.keys(D.flowDriftOn.houses).sort(),
    };
  }, PICK);
  const state = () => page.evaluate((SEL) => {
    const ch = document.querySelector("#flow-drift .rd-fl-chart");
    const s = document.querySelector(SEL);
    return {
      sels: document.querySelectorAll(SEL).length,
      inHead: !!document.querySelector("#flow-drift .rd-fl-dhead " + SEL.replace("#flow-drift ", "")),
      charts: document.querySelectorAll("#flow-drift .rd-fl-chart").length,
      opts: s ? [...s.options].slice(1).map((o) => o.value) : [],
      value: s ? s.value : null,
      first: s ? s.options[0].text : null,
      on: ch ? ch.querySelectorAll(".rd-fl-wdot.on").length : 0,
      off: ch ? ch.querySelectorAll(".rd-fl-wdot.off").length : 0,
      vhit: ch ? ch.querySelectorAll(".rd-fl-vhit").length : 0,
      pick: ch ? ch.querySelectorAll(".rd-fl-pick").length : 0,
      key: [...document.querySelectorAll("#flow-drift .rd-fl-key .rd-key-item")].map((k) => k.textContent.trim()),
      sw: document.documentElement.scrollWidth, iw: innerWidth,
    };
  }, SEL);
  let s = await state();
  check(s.sels === 1 && s.inHead && s.charts === 1, `${w}: one highlight menu, in the one drift chart's head (${s.sels}, ${s.inHead}, ${s.charts})`);
  check(s.opts.join() === exp.hC.join(), `${w}: the menu lists Labor v Coalition's pollsters (${s.opts.length})`);
  check(s.vhit === 0 && s.pick === 0 && s.on + s.off === 0, `${w}: nothing picked - no month rings, no pick line, no faded dots (${s.vhit}/${s.pick}/${s.on + s.off})`);
  await page.select(SEL, PICK);
  await wait(250);
  s = await state();
  check(s.on === exp.wC, `${w}: the pick's waves come forward (${s.on} vs ${exp.wC})`);
  check(s.off > 0, `${w}: every other wave recedes (${s.off})`);
  check(s.vhit === exp.vC, `${w}: one month ring per picked month (${s.vhit} vs ${exp.vC})`);
  check(s.pick === 1, `${w}: one pick line (${s.pick})`);
  check(s.key.includes(PICK + ", month by month"), `${w}: the key names the pick`);
  check(s.first === "No highlight", `${w}: the menu's first option clears the pick ("${s.first}")`);
  check(s.sw <= s.iw, `${w}: no sideways overflow (${s.sw}/${s.iw})`);
  /* every month ring: a pointer at its centre must read the picked
     pollster (its month tip, or its own wave sitting on the mark), never a
     faded neighbour */
  const n = s.vhit;
  const wrong = [];
  for (let i = 0; i < n; i++) {
    const pt = await page.evaluate((i) => {
      const r = document.querySelector("#flow-drift .rd-fl-chart").querySelectorAll(".rd-fl-vhit")[i];
      r.scrollIntoView({ block: "center", behavior: "instant" });
      const b = r.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, i);
    await wait(60);
    if (w < 700) await page.touchscreen.tap(pt.x, pt.y);
    else await page.mouse.move(pt.x, pt.y, { steps: 2 });
    await wait(120);
    const t = await page.evaluate(() => {
      const el = document.querySelector("#flow-drift .rd-fl-chart .tip .tip-title");
      return el ? el.textContent : null;
    });
    if (t !== PICK) wrong.push(i + ":" + t);
    if (w < 700) { await page.touchscreen.tap(5, 5); await wait(80); }
    else { await page.mouse.move(2, 2); await wait(60); }
  }
  check(n > 0 && wrong.length === 0, `${w}: all ${n} month rings read ${PICK}${wrong.length ? " - misses " + wrong.join(", ") : ""}`);
  /* the next contest carries the pick when its pollsters include it */
  await tab(1);
  s = await state();
  check(s.opts.join() === exp.hO.join(), `${w}: on Labor v One Nation the menu lists that contest's pollsters (${s.opts.length})`);
  check(s.value === PICK && s.on === exp.wO && s.vhit === exp.vO && s.pick === 1, `${w}: the pick carries over (${s.value}: ${s.on} waves, ${s.vhit} rings)`);
  await tab(2);
  s = await state();
  check(s.sels === 0 && s.charts === 0, `${w}: Coalition v One Nation draws no drift chart and so no menu`);
  await tab(0);
  s = await state();
  check(s.value === PICK && s.pick === 1, `${w}: back on Labor v Coalition the pick still stands`);
  check(errs.length === 0, `${w}: no page errors${errs.length ? " (" + errs[0].slice(0, 160) + ")" : ""}`);
  await page.close();
}
await browser.close();
console.log(fails ? `flow-pick: ${fails} FAILED` : "flow-pick: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
