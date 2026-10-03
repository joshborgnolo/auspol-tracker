// Pins the 2026-10-03 All-polls head contracts:
//  - issues facet: desktop scale ladder is 0/10/20/30/40(%) again (the
//    "40%" ticker was dropped 2026-10-03 for overflow at desktop widths,
//    then reinstated the same night after the caption's shorten swept to
//    all five drives; phone identical), and BOTH homes read "Best on the
//    top issue".
//  - direction facet: "Right direction or wrong track, %" sits in the TICK
//    lane (bottom of the 38px hpic) on desktop AND phone, not the cap lane.
// Mirrors iss-head-overlap.mjs's harness (file:// build, puppeteer-core).
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
let fails = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) fails++;
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

async function openAt(vw, vh) {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: vw, height: vh });
  await page.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  return { page, errs };
}

async function pickFacet(page, re) {
  await page.evaluate((src) => {
    const want = new RegExp(src);
    const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => want.test(n.textContent.trim()));
    if (!t) throw new Error("facet tab not found: " + src);
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, re.source);
  await new Promise((r) => setTimeout(r, 600));
}

const headInfo = () => {
  const pheadEl = document.querySelector(".rd-ap-phead");
  const hrowEl = document.querySelector(".rd-ap-hrow");
  const head = (pheadEl && getComputedStyle(pheadEl).display !== "none") ? pheadEl : hrowEl;
  const hpic = head && head.querySelector(".rd-ap-hpic");
  const cap = hpic && hpic.querySelector(".rd-ap-cap");
  const rect = (n) => {
    if (!n) return null;
    const b = n.getBoundingClientRect();
    return { top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2), h: +b.height.toFixed(2) };
  };
  const tks = hpic ? [...hpic.querySelectorAll(".rd-ap-tk")].map((t) => ({
    text: (t.textContent || "").trim(), bottom: +t.getBoundingClientRect().bottom.toFixed(2),
  })) : [];
  return {
    which: head ? (head.classList.contains("rd-ap-phead") ? "phead" : "hrow") : "none",
    isDir: !!(hpic && hpic.classList.contains("rd-ap-hdir")),
    hpic: rect(hpic), cap: rect(cap), capText: cap ? (cap.textContent || "").trim() : null, tks,
    minH: hpic ? getComputedStyle(hpic).minHeight : null,
  };
};

// --- desktop 1280 ---------------------------------------------------------
{
  const { page, errs } = await openAt(1280, 900);

  await pickFacet(page, /^Direction$/);
  const d = await page.evaluate(headInfo);
  check("desktop direction: hpic carries the hdir class and the 38px band", d.isDir && d.hpic && Math.abs(d.hpic.h - 38) < 0.51, JSON.stringify({ isDir: d.isDir, hpic: d.hpic, minH: d.minH }));
  check("desktop direction: caption sits in the tick lane (its bottom == hpic bottom)",
    !!d.cap && Math.abs(d.cap.bottom - d.hpic.bottom) < 0.51,
    JSON.stringify({ cap: d.cap, capText: d.capText, bottom: d.hpic.bottom }));
  check("desktop direction: caption not raised toward the cap lane", !!d.cap && d.cap.bottom - d.cap.top < 17, JSON.stringify(d.cap));
  check("desktop direction: caption text", d.capText === "Right direction or wrong track, %", d.capText);
  check("desktop direction: no tick marks", d.tks.length === 0, `${d.tks.length} ticks`);

  await pickFacet(page, /^Issues$/);
  const i = await page.evaluate(headInfo);
  check("desktop issues: caption is the full form", i.capText === "Best on the top issue", i.capText);
  check("desktop issues: ladder is 0/10/20/30/40 with the unit on 40 (the ticker is back)",
    i.tks.length === 5 && i.tks[4].text === "40%" && i.tks.some((t) => t.text === "30"),
    JSON.stringify(i.tks.map((t) => t.text)));
  check("desktop issues: last tick bottom == hpic bottom (lane intact)", i.tks.length === 5 && Math.abs(i.tks[4].bottom - i.hpic.bottom) < 0.51, JSON.stringify(i.tks[4]));

  check("desktop: no page errors", errs.length === 0, errs[0] || "");
  await page.close();
}

// --- phone 390 ------------------------------------------------------------
{
  const { page, errs } = await openAt(390, 844);

  await pickFacet(page, /^Direction$/);
  const d = await page.evaluate(headInfo);
  check("phone direction: 38px band kept (the lane below exists)", d.which === "phead" && d.hpic && Math.abs(d.hpic.h - 38) < 0.51, JSON.stringify({ which: d.which, hpic: d.hpic, minH: d.minH }));
  check("phone direction: caption sits in the tick lane", d.isDir && !!d.cap && Math.abs(d.cap.bottom - d.hpic.bottom) < 0.51, JSON.stringify({ cap: d.cap, bottom: d.hpic && d.hpic.bottom }));

  await pickFacet(page, /^Issues$/);
  const i = await page.evaluate(headInfo);
  check("phone issues: caption gains the article", i.capText === "Best on the top issue", i.capText);
  check("phone issues: ladder keeps 0/10/20/30/40 with the unit on 40",
    i.tks.length === 5 && i.tks[4].text === "40%",
    JSON.stringify(i.tks.map((t) => t.text)));

  check("phone: no page errors", errs.length === 0, errs[0] || "");
  await page.close();
}

await browser.close();
console.log(fails === 0 ? "\nALL CHECKS PASSED" : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
