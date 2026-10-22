/* Probe (run: node .matilda/probe/conf-chgcalc.mjs; PAGE=http://… to load
   the webfonts): the Confidence facet's calculated-change fallback (user
   call 2026-10-22, "push when fixed"; display call 2026-10-23,
   "invisible to the user").

   Roy Morgan's "virtually unchanged" consumer waves print no numeric
   change, so the facet's printed-only law showed "Change not printed" on
   the 2026-10-20 release (67.7, versus 68.0 the wave before). gen-data
   emits chgCalc (figure minus the lane's previous term release) and every
   surface shows it EXACTLY AS A PRINTED MOVE — no asterisk, no tooltip,
   no aria suffix, no "(calculated)" flag anywhere:
   1. desktop (?f=c): the 2026-10-20 consumer row draws "−0.3" bare (no
      asterisk, no title), the strip's aria names no calculation, the
      2026-10-13 printed wave (68, +0.9) renders identically in form, and
      the Change head's title is the plain pre-flag one
   2. phone (390): the newest ANZ–Roy Morgan card's sub reads
      "Change −0.3 on last release" unflagged, like the +0.9 card
   3. the opened detail's ledger line carries the bare "down 0.3 on the
      week" clause, identical in form to a printed move, with no
      calculated clause — and "Change not printed" appears nowhere */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.resolve(process.cwd(), "index.html");
const APAGE = PAGE.endsWith("/") ? PAGE + "allpolls/" : PAGE.replace(/index\.html$/, "allpolls/index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

const open = async (w) => {
  const phone = w <= 760;
  await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.goto(APAGE + "?f=c", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ap-tabs .rd-tab", { timeout: 30000 });
  await sleep(900);
};
/* slices of the confidence table keyed by the strip's aria-label */
const rows = (sel) => page.evaluate((sel) => {
  const rowOf = (el) => el.closest(".rd-ap-row, .rd-ap-card");
  return [...document.querySelectorAll(sel)].map((pic) => {
    const r = rowOf(pic);
    return {
      aria: pic.getAttribute("aria-label"),
      val: (r.querySelector(".rd-ap-val") || {}).textContent || null,
      valTitle: (r.querySelector(".rd-ap-val") || {}).title || null,
      hasSup: !!r.querySelector(".rd-ap-val sup"),
      sub: (r.querySelector(".rd-ap-csub") || {}).textContent || null,
    };
  }).filter((x) => x.aria && x.aria.startsWith("Consumer confidence"));
}, sel);
const openRow = (frag) => page.evaluate((frag) => {
  const pic = [...document.querySelectorAll(".rd-ap-pic")].find((p) => (p.getAttribute("aria-label") || "").startsWith(frag));
  const r = pic && pic.closest(".rd-ap-row, .rd-ap-card");
  if (!r) return false;
  r.click();
  return true;
}, frag);

/* 1. desktop rows */
console.log("== 1. desktop table (1280, ?f=c) ==");
await open(1280);
let rs = await rows(".rd-ap-pic");
const latest = rs.find((x) => x.aria.startsWith("Consumer confidence, 67.7"));
check(!!latest, "the 2026-10-20 consumer row (67.7) is on the table");
if (latest) {
  check(/^−0\.3$/.test((latest.val || "").trim()) && !latest.hasSup, `20 Oct cell: −0.3 bare, no asterisk (${JSON.stringify(latest.val)})`);
  check(!latest.valTitle, "20 Oct cell carries no title");
  check(/−0\.3/.test(latest.aria) && !latest.aria.includes("calculated") && latest.aria.includes("on the gauge’s previous release"),
    "20 Oct strip aria names the change, no calculated rider");
}
const printed = rs.find((x) => x.aria.startsWith("Consumer confidence, 68,"));
check(!!printed, "the 2026-10-13 consumer row (68) is on the table");
if (printed) {
  check(/^\+0\.9$/.test((printed.val || "").trim()) && !printed.hasSup, `13 Oct cell: +0.9 bare (${JSON.stringify(printed.val)})`);
  check(!printed.valTitle && !printed.aria.includes("calculated"), "13 Oct's face is the same bare form");
}
const supN = rs.filter((x) => x.hasSup).length;
const markN = rs.filter((x) => x.hasSup || x.valTitle || (x.aria || "").includes("calculated")).length;
console.log(`     consumer lane: ${rs.length} rows, ${supN} asterisked, ${markN} carrying any calculated tell`);
check(markN === 0, "no confidence row carries a calculated tell");
const thTitle = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".rd-ap-th")].find((x) => x.textContent.includes("Change"));
  return b ? b.title : null;
});
check(thTitle === "Change on the gauge’s own previous release", `Change head's title is the plain one (${JSON.stringify(thTitle)})`);

/* 2. the phone card */
console.log("== 2. phone card (390, ?f=c) ==");
await open(390);
rs = await rows(".rd-ap-pic");
const pLatest = rs.find((x) => x.aria.startsWith("Consumer confidence, 67.7"));
check(!!pLatest && /Change\s+−0\.3\s+on last release$/.test((pLatest.sub || "").trim()), `newest card sub: bare "Change −0.3 on last release" (${JSON.stringify(pLatest && pLatest.sub)})`);
const pPrinted = rs.find((x) => x.aria.startsWith("Consumer confidence, 68,"));
check(!!pPrinted && /Change\s+\+0\.9\s+on last release$/.test((pPrinted.sub || "").trim()), `printed card sub, the identical form (${JSON.stringify(pPrinted && pPrinted.sub)})`);
const firsts = rs.filter((x) => /first release/.test(x.sub || "")).length;
check(firsts <= 1, `at most one first-release row stands (${firsts})`);
const notPrinted = rs.filter((x) => /Change not printed/.test(x.sub || "")).length;
check(notPrinted === 0, `no card still claims "Change not printed" (${notPrinted})`);

/* 3. the opened detail's ledger line */
console.log("== 3. detail ledger (1280) ==");
await open(1280);
check(await openRow("Consumer confidence, 67.7"), "20 Oct row opens");
await sleep(700);
let conf = await page.evaluate(() => (document.querySelector(".rd-ldg-conf") || {}).textContent || null);
check(!!conf && /down 0\.3 on the week/.test(conf) && !conf.includes("calculated") && !conf.includes("printed"), `20 Oct ledger: the bare calculated fall (${JSON.stringify(conf)})`);
await openRow("Consumer confidence, 67.7"); /* close it */
await sleep(400);
check(await openRow("Consumer confidence, 68,"), "13 Oct row opens");
await sleep(700);
conf = await page.evaluate(() => (document.querySelector(".rd-ldg-conf") || {}).textContent || null);
check(!!conf && /up 0\.9 on the week/.test(conf) && !conf.includes("calculated"), `13 Oct ledger: the same bare form on the printed rise (${JSON.stringify(conf)})`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
