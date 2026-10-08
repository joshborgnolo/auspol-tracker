/* Probe (run: node .matilda/probe/ap-split-picker-width.mjs): the All-polls
   demographics facet's split picker gained a seventh button (Birth country,
   2026-10-09, Roy Morgan finding 10341's one-off birth-country cut), moving
   the row's fit again: the ctlNarrow handoff, which moves the picker to its
   own strip, was re-measured that day at 1240px (the row fits from ~1221px
   up with the 513px picker; rd-allpolls.jsx ctlNarrow comment). Asserts the
   row still holds: on the demographics facet above 1240px the tab row
   carries the picker with no horizontal document overflow, below/incl.
   1240px it rides its own strip, and prints the picker's measured width so
   the comment's figure stays honest if it drifts. */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.resolve(process.cwd(), "index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

const gotoGroups = async (w) => {
  await page.setViewport({ width: w, height: 980, deviceScaleFactor: 1 });
  await page.goto(PAGE + "#allpolls", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ap-tabs .rd-tab", { timeout: 30000 });
  await page.evaluate(() => {
    const t = [...document.querySelectorAll(".rd-ap-tabs .rd-tab")].find((el) => /^(Demographics|Groups)$/.test(el.textContent.trim()));
    if (t) t.click();
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll(".rd-ap-tabs .rd-tab")].some((el) => /^(Demographics|Groups)$/.test(el.textContent.trim()) && el.getAttribute("aria-pressed") === "true"),
    { timeout: 10000 });
};

/* on-row at 1241px+ and in its own strip at/below 1240px */
let measured = null;
for (const w of [1241, 1260, 1300, 1366]) {
  await gotoGroups(w);
  await page.waitForSelector(".rd-ap-dpick button", { timeout: 20000 }).catch(() => {});
  const m = await page.evaluate(() => {
    const pick = document.querySelector(".rd-ap-dpick");
    const btns = pick ? [...pick.querySelectorAll("button")].map((b) => b.textContent.trim()) : [];
    return {
      buttons: btns,
      pickerW: pick ? Math.round(pick.getBoundingClientRect().width) : 0,
      ownRow: pick ? !pick.closest(".rd-ap-tabs") : null, // strip mode when not glued to the tab row
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
  const over = m.scrollW - m.clientW;
  if (measured == null) measured = m.pickerW;
  check(m.buttons.length === 7 && m.buttons[m.buttons.length - 1] === "Birth country",
    `${w}px: seven split buttons ending in Birth country (${m.buttons.join(" · ")})`);
  check(m.ownRow === false, `${w}px: picker glued to the tab row (${m.ownRow === null ? "NO PICKER" : m.ownRow ? "ON OWN STRIP" : "on row"})`);
  check(over <= 1, `${w}px: no horizontal overflow with the picker on the tab row (scrollWidth-clientWidth=${over}, picker ~${m.pickerW}px)`);
}
/* the handoff below the cut: picker in its own row, no overflow either */
for (const w of [900, 1000, 1140, 1200, 1240]) {
  await gotoGroups(w);
  const m = await page.evaluate(() => ({
    inPctl: !!document.querySelector(".rd-ap-pctl .rd-ap-dpick"),
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  check(m.inPctl && m.scrollW - m.clientW <= 1, `${w}px: picker in its own strip, no overflow (${m.inPctl ? "strip" : "ON ROW"}, over=${m.scrollW - m.clientW})`);
}
console.log(`measured picker width: ~${measured}px (was 341 with five buttons, 412 with six; measured 513 with seven)`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
