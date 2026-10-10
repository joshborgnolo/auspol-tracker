// Pins the 2026-10-04 facet-parity fix behind the Latest-and-next-polls
// fixed view: a facet hop may reflow NOTHING above or inside the table,
// because rdPinScroll deliberately keeps any drift under 3px (its Safari
// lattice rule) - so a 1-2px reflow is never corrected, it shows. Two
// reflows did exactly that on every hop into 2PP (user: "the slightest
// nudge downward upon switching to the two-party preferred facet"):
//  - desktop: the 2PP-only .rd-pl-ctl in the tab row stood 44px (the
//    flip's tap height) against the tabs' 43 (44 less their -1px foot), so
//    the row ran 45px on 2PP and 44 elsewhere and the table dropped 1px.
//    rd.css gives .rd-tabs > .rd-pl-ctl the tabs' -1px foot; the same
//    controls ride the All-polls and House-lean tab rows, asserted here too.
//  - phone (<=900px): 2PP's figures stack (17px line at 1.45 + 2px gap +
//    12px sub at 1.35 = 42.83) stood 2.9px over the name stack (39.94) that
//    sets Primary's line, so each row below the first slid 2.9px further.
//    rd.css floors the row's first track at that stack.
// Leadership and narrow-phone Primary joined the contract the same day:
// their wider figures squeezed the name column so client/cadence lines
// wrapped in those facets only (now one line, ellipsized), and the 901-1100px
// band wrapped Leadership's labelled net line (the label now hides under
// the column head on desktop).
// Mirrors ap-phcard-heights.mjs's harness (file:// build, puppeteer-core).
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try {
    puppeteer = createRequire(join(base, "package.json"))("puppeteer-core");
    break;
  } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable"); process.exit(2); }

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.LIVE ? "https://auspoltracker.com/" : `file://${ROOT}/index.html`;
const APAGE = PAGE.endsWith("/") ? PAGE + "allpolls/" : PAGE.replace(/index\.html$/, "allpolls/index.html");
let fails = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) fails++;
};
const EPS = 0.05;
const spread = (xs) => Math.max(...xs) - Math.min(...xs);
const fmt = (xs) => xs.map((x) => +x.toFixed(2)).join("/");

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

/* every facet of one tab row: the row's height, the doc-top of the box the
   pin holds, and the row heights beneath it */
async function walk(page, tabsSel, heldSel, rowSel) {
  const n = await page.evaluate((s) => document.querySelectorAll(s + " [role='group'] button").length, tabsSel);
  const out = [];
  for (let k = 0; k < n; k++) {
    await page.evaluate((s, k) => document.querySelectorAll(s + " [role='group'] button")[k].click(), tabsSel, k);
    await new Promise((r) => setTimeout(r, 600));
    out.push(await page.evaluate((s, h, rs) => {
      const tabs = document.querySelector(s), held = h && document.querySelector(h);
      return {
        label: tabs.querySelector("[aria-pressed='true']").textContent.trim(),
        tabsH: tabs.getBoundingClientRect().height,
        heldTop: held ? held.getBoundingClientRect().top + window.scrollY : null,
        rows: rs ? [...document.querySelectorAll(rs)].map((r) => r.getBoundingClientRect().height) : [],
      };
    }, tabsSel, heldSel, rowSel));
  }
  return out;
}

async function rung(vw, vh, touch) {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: vw, height: vh, hasTouch: touch, isMobile: touch });
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#latest-polls .rd-pl-row", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  const pl = await walk(page, ".rd-pl-tabs", ".rd-pl", "#latest-polls .rd-pl-item > .rd-pl-row");
  const [tpp, pri, lead] = pl;
  if (vw > 900) {
    check(`${vw}px Latest tab row one height on every facet`, spread(pl.map((f) => f.tabsH)) < EPS, fmt(pl.map((f) => f.tabsH)));
    check(`${vw}px Latest table at one doc-top on every facet`, spread(pl.map((f) => f.heldTop)) < EPS, fmt(pl.map((f) => f.heldTop)));
  }
  const worst = Math.max(...tpp.rows.map((h, i) => Math.abs(h - pri.rows[i])));
  check(`${vw}px Latest rows: 2PP and Primary heights match row for row`, tpp.rows.length > 5 && worst < EPS,
        `${tpp.rows.length} rows, worst ${worst.toFixed(3)}px (2PP ${fmt(tpp.rows.slice(0, 3))}, Primary ${fmt(pri.rows.slice(0, 3))})`);
  const worstL = Math.max(...tpp.rows.map((h, i) => Math.abs(h - lead.rows[i])));
  check(`${vw}px Latest rows: Leadership matches too`, worstL < EPS, `worst ${worstL.toFixed(3)}px`);
  if (vw > 1000) {
    await page.goto(`${APAGE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
    await page.waitForSelector(".rd-hl-tabs button", { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    const ap = await walk(page, ".rd-ap-tabs", ".rd-ap-bar", null);
    check(`${vw}px All-polls tab row one height on every facet`, spread(ap.map((f) => f.tabsH)) < EPS, fmt(ap.map((f) => f.tabsH)));
    check(`${vw}px All-polls filter bar at one doc-top on every facet`, spread(ap.map((f) => f.heldTop)) < EPS, fmt(ap.map((f) => f.heldTop)));
    const hl = await walk(page, ".rd-hl-tabs", ".rd-hl-ct", null);
    check(`${vw}px House-lean tab row one height on every view`, spread(hl.map((f) => f.tabsH)) < EPS, fmt(hl.map((f) => f.tabsH)));
  }
  check(`${vw}px no page errors`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await page.close();
}

for (const [vw, vh, touch] of [[1440, 900, false], [1000, 900, false], [820, 1180, true], [430, 932, true], [390, 844, true], [375, 812, true], [360, 780, true], [320, 640, true]]) {
  await rung(vw, vh, touch);
}
await browser.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
