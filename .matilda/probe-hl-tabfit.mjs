/* Probe: the House-lean tab row's Greens / Others joiners fit.
   Pass 1 (MODE=measure): renders the row at a spread of viewports (both
   joiner gates permissive in the build), prices each tab + the two-party
   switch chip in px, and prints the viewport widths at which the row
   holds 6 tabs (…+Greens) and 7 (+Others) with the Two-party switch chip
   in the row (its widest case). The gates in rd-allpolls.jsx RdHouseLean
   are set from this.
   Pass 2 (default): asserts the shipped contract -
     - TABFIT.grn / TABFIT.oth are the gates in the JSX,
     - at every probed width the row never overflows (scrollWidth <= clientWidth),
     - the joiner tabs are present exactly above/under their gates,
     - opening Greens/Others draws the lean board with rows,
     - the phone (390) shows the standing five and the row fits. */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }
const BASE = process.env.BASE || process.cwd();

/* the gates FORCED in rd-allpolls.jsx RdHouseLean (max-width: N-1px means
   "no room at <= N-1", so the tab appears from N up). Measured 2026-10-02 on
   the pad+2 build: 6-tab group (…/Greens) natural 612.6px, 7-tab natural
   680.0px, row min = group + 8 gap + 12.4 chip, container cw = vw - 76 below
   1280 -> Greens clears at cw 633.0 (vw 911.6, matches the measured last-
   clip 911) and Others at cw 700.4 (vw 984.1, last clip 984). */
const TABFIT = { grn: 912, oth: 985 };

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails.push(msg); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();

async function open(width) {
  await page.setViewport({ width, height: 950, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#tab-allpolls", { timeout: 30000 });
  await page.click("#tab-allpolls");
  await page.waitForSelector("#house-lean .rd-hl-tabs .rd-tab", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 250)); // intentional-sleep: media-query hooks settle after mount
}

const measure = () => page.evaluate(() => {
  const row = document.querySelector("#house-lean .rd-hl-tabs");
  if (!row) return { missing: true };
  const kids = [...row.children].map((el) => ({
    label: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 26),
    cls: el.className, w: Math.round(el.getBoundingClientRect().width * 10) / 10 }));
  const cs = getComputedStyle(row);
  return { vw: window.innerWidth, cw: row.clientWidth, sw: row.scrollWidth,
           gap: parseFloat(cs.columnGap || cs.gap || "0"),
           tabs: [...row.querySelectorAll(".rd-tab")].map((t) => (t.textContent || "").trim()),
           ctl: !!row.querySelector(".rd-pl-ctl"), kids };
});

if (process.env.MODE === "measure") {
  await open(1600);
  const m0 = await measure();
  console.log("1600px row:", JSON.stringify(m0, null, 1));
  const tw = await page.evaluate(() => {
    const row = document.querySelector("#house-lean .rd-hl-tabs");
    const group = row.querySelector("[role=group]");
    return { tabs: [...group.querySelectorAll(".rd-tab")].map((t) => ({ label: t.textContent.trim(), w: Math.round(t.getBoundingClientRect().width * 10) / 10 })),
             groupNat: Math.round(group.scrollWidth * 10) / 10 };
  });
  console.log("per-tab widths:", JSON.stringify(tw, null, 1));
  console.log("\ncontainer width vs viewport:");
  for (let w = 760; w <= 1600; w += 20) {
    await open(w);
    const m = await measure();
    const k = m.kids.map((x) => `${x.label.slice(0, 12)}:${x.w}`).join(" | ");
    console.log(`  vw ${w}  client ${m.cw}  scroll ${m.sw}${m.sw > m.cw ? "  OVERFLOW" : ""}  ctl=${m.ctl}  [${k}]`);
  }
  await browser.close();
  process.exit(0);
}

const assertTabFit = async (w, expect) => {
  await open(w);
  const m = await measure();
  check(!m.missing, `row renders at ${w}`);
  check(m.sw <= m.cw, `row fits at ${w} (scroll ${m.sw} <= client ${m.cw})`);
  const want = ["Two-party", "Labor", "Coalition", "One Nation"];
  if (expect.grn) want.push("Greens");
  if (expect.oth) want.push("Others");
  want.push("One Nation v Coalition");
  check(JSON.stringify(m.tabs) === JSON.stringify(want), `tabs at ${w} are ${JSON.stringify(m.tabs)}`);
  check(m.ctl === (w >= 1021), `two-party switch ${w >= 1021 ? "in" : "out of"} the row at ${w} (narrowBar 1020)`);
  return m;
};

console.log(`gate at ${TABFIT.grn + 20} (above Greens gate, below Others gate):`);
await assertTabFit(TABFIT.grn + 20, { grn: true, oth: false });
console.log(`gate at ${TABFIT.grn} (Greens clears):`);
await assertTabFit(TABFIT.grn, { grn: true, oth: false });
console.log(`gate at ${Math.max(TABFIT.grn - 20, TABFIT.oth === TABFIT.grn ? 0 : 761)} (Greens gate under):`);
if (TABFIT.grn - 20 > 760) await assertTabFit(TABFIT.grn - 20, { grn: false, oth: false });
console.log(`wide at ${TABFIT.oth} (Others clears):`);
await assertTabFit(TABFIT.oth, { grn: true, oth: true });
console.log("wide at 1440:");
await assertTabFit(1440, { grn: true, oth: true });

// opening a joiner measure draws the board
console.log("open Greens at 1440:");
await open(1440);
await page.evaluate(() => {
  const t = [...document.querySelectorAll("#house-lean .rd-hl-tabs .rd-tab")].find((b) => b.textContent.trim() === "Greens");
  t.click();
});
await new Promise((r) => setTimeout(r, 300)); // intentional-sleep: board re-renders on view change
const grn = await page.evaluate(() => {
  const sec = document.getElementById("house-lean");
  const title = (sec.querySelector(".rd-hl-ct") || {}).textContent || "";
  const rows = sec.querySelectorAll(".rd-hl-row").length;
  return { title, rows };
});
check(/Greens’ primary/.test(grn.title), `Greens board titles the measure (${JSON.stringify(grn.title)})`);
check(grn.rows > 3, `Greens board draws ${grn.rows} pollster rows`);

console.log("open Others at 1440:");
await page.evaluate(() => {
  const t = [...document.querySelectorAll("#house-lean .rd-hl-tabs .rd-tab")].find((b) => b.textContent.trim() === "Others");
  t.click();
});
await new Promise((r) => setTimeout(r, 300)); // intentional-sleep: board re-renders on view change
const oth = await page.evaluate(() => {
  const sec = document.getElementById("house-lean");
  const title = (sec.querySelector(".rd-hl-ct") || {}).textContent || "";
  const rows = sec.querySelectorAll(".rd-hl-row").length;
  return { title, rows };
});
check(/others’ primary/i.test(oth.title), `Others board titles the measure (${JSON.stringify(oth.title)})`);
check(oth.rows > 3, `Others board draws ${oth.rows} pollster rows`);

console.log("phone 390:");
await open(390);
const ph = await measure();
check(JSON.stringify(ph.tabs) === JSON.stringify(["Two-party", "Labor", "Coalition", "One Nation", "Split"]),
  `phone keeps its five (${JSON.stringify(ph.tabs)})`);
check(ph.sw <= ph.cw, `phone row fits (scroll ${ph.sw} <= client ${ph.cw})`);

await browser.close();
if (fails.length) { console.error("\n" + fails.length + " FAILURES"); process.exit(1); }
console.log("\nALL PASS");
