// Diagnostic: measure the Issues facet column-head geometry across
// rungs. Mirrors iss-facet.mjs's harness. Reports, per viewport:
// hpic rect, cap rect, first/last tick rects, "Best on it" head rect,
// and whether the caption intersects any tick or the next column head.
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
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

async function pickFacet(page, label) {
  await page.evaluate(() => {
    const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => /^Issues$/.test(n.textContent.trim()));
    if (!t) throw new Error("facet tab Issues not found");
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await new Promise((r) => setTimeout(r, 800));
}

const measure = (page, sel) => page.evaluate((s) => {
  const r = (n) => {
    if (!n) return null;
    const b = n.getBoundingClientRect();
    return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  };
  // The pinned phone head is a different container from the desktop hrow;
  // measure whichever is visible.
  const pheadEl = document.querySelector(".rd-ap-phead");
  const hrowEl = document.querySelector(".rd-ap-hrow");
  const head = (pheadEl && getComputedStyle(pheadEl).display !== "none") ? pheadEl : hrowEl;
  const hpic = head && head.querySelector(".rd-ap-hpic");
  const cap = hpic && hpic.querySelector(".rd-ap-cap");
  const tks = hpic ? [...hpic.querySelectorAll(".rd-ap-tk")] : [];
  const ths = head ? [...head.querySelectorAll(".rd-ap-th")] : [];
  const best = ths.find((n) => /Party in first/i.test(n.textContent));
  const lastTh = ths[ths.length - 1] || null;
  const style = hpic ? getComputedStyle(hpic) : {};
  const csCap = cap ? getComputedStyle(cap) : {};
  const csTk = tks.length ? getComputedStyle(tks[0]) : {};
  return {
    which: head && head.classList.contains("rd-ap-phead") ? "phead" : "hrow",
    headCls: head ? head.className : null,
    hpic: r(hpic), cap: r(cap),
    tk0: r(tks[0]), tkLast: r(tks[tks.length - 1]), nTks: tks.length,
    best: r(best), lastTh: r(lastTh),
    csHpic: { pos: style.position, disp: style.display, alignSelf: style.alignSelf, minH: style.minHeight, h: style.height },
    csCap: { pos: csCap.position, top: csCap.top, ws: csCap.whiteSpace },
    csTk: { pos: csTk.position, bottom: csTk.bottom },
  };
}, sel);

const inter = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const [vw, vh] of [[1440, 900], [1100, 800], [1000, 800], [820, 800], [390, 844]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: vh });
  await page.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  await pickFacet(page);
  await new Promise((r) => setTimeout(r, 400));
  const m = await measure(page, null);
  console.log(`\n== ${vw}x${vh} (${m.which}) ==`);
  console.log(" head class:", m.headCls);
  console.log(" hpic:", JSON.stringify(m.hpic), JSON.stringify(m.csHpic));
  console.log(" cap :", JSON.stringify(m.cap), JSON.stringify(m.csCap));
  console.log(" tk0 :", JSON.stringify(m.tk0), "tkLast:", JSON.stringify(m.tkLast), "nTks:", m.nTks, JSON.stringify(m.csTk));
  console.log(" best:", JSON.stringify(m.best), "lastTh:", JSON.stringify(m.lastTh));
  console.log(" cap∩tk0:", inter(m.cap, m.tk0), " cap∩tkLast:", inter(m.cap, m.tkLast), " cap∩best:", inter(m.cap, m.best), " cap∩lastTh:", inter(m.cap, m.lastTh));
  await page.close();
}
await browser.close();
