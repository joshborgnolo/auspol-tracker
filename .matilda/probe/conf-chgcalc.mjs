/* Probe (run: node .matilda/probe/conf-chgcalc.mjs; PAGE=http://… to load
   the webfonts): the Confidence facet's calculated-change fallback (user
   call 2026-10-22, "push when fixed").

   Roy Morgan's "virtually unchanged" consumer waves print no numeric
   change, so the facet's printed-only law showed "Change not printed" on
   the 2026-10-20 release (67.7, versus 68.0 the wave before). gen-data
   now emits chgCalc (figure minus the lane's previous term release) and
   every surface shows it FLAGGED calculated, never as the house's print:
   1. desktop (?f=c): the 2026-10-20 consumer row draws "−0.3" with an
      asterisk and the calculated tooltip, the 2026-10-13 printed wave
      (68, +0.9) stays unmarked, the lane's chgCalc row count matches the
      dataset's, and the Change head's title explains the asterisk
   2. phone (390): the newest ANZ–Roy Morgan card's sub reads
      "Change −0.3 on last release (calculated)", the +0.9 card has no
      marker, and a first-release row keeps "first release" copy elsewhere
   3. the opened detail's ledger line carries
      "(calculated – the release printed no change)" on the 20 Oct wave
      and the bare printed clause on the +0.9 wave */
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
  check(/−0\.3/.test(latest.val || "") && latest.hasSup, `20 Oct cell: −0.3 with the asterisk (${JSON.stringify(latest.val)})`);
  check(latest.valTitle === "Calculated from the gauge’s previous release - the release printed no change", "20 Oct cell carries the calculated tooltip");
  check(latest.aria.includes("calculated - the release printed no change"), "20 Oct strip aria names the change calculated");
}
const printed = rs.find((x) => x.aria.startsWith("Consumer confidence, 68,"));
check(!!printed, "the 2026-10-13 consumer row (68) is on the table");
if (printed) {
  check(/\+0\.9/.test(printed.val || "") && !printed.hasSup, `13 Oct cell: +0.9 unmarked (${JSON.stringify(printed.val)})`);
  check(!printed.valTitle && !printed.aria.includes("calculated"), "13 Oct keeps its printed-change face");
}
const calcN = rs.filter((x) => x.aria.includes("calculated -")).length;
const supN = rs.filter((x) => x.hasSup).length;
console.log(`     consumer lane: ${rs.length} rows, ${calcN} calculated by aria, ${supN} by asterisk`);
check(calcN > 0 && calcN === supN, "every calculated aria is asterisked and vice versa");
const thTitle = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".rd-ap-th")].find((x) => x.textContent.includes("Change"));
  return b ? b.title : null;
});
check(/an asterisk marks one calculated/.test(thTitle || ""), "Change head explains the asterisk");

/* 2. the phone card */
console.log("== 2. phone card (390, ?f=c) ==");
await open(390);
rs = await rows(".rd-ap-pic");
const pLatest = rs.find((x) => x.aria.startsWith("Consumer confidence, 67.7"));
check(!!pLatest && /Change\s+−0\.3\s+on last release \(calculated\)/.test(pLatest.sub || ""), `newest card sub: "…(calculated)" (${JSON.stringify(pLatest && pLatest.sub)})`);
const pPrinted = rs.find((x) => x.aria.startsWith("Consumer confidence, 68,"));
check(!!pPrinted && /Change\s+\+0\.9\s+on last release$/.test((pPrinted.sub || "").trim()), `printed card sub unmarked (${JSON.stringify(pPrinted && pPrinted.sub)})`);
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
check(!!conf && /down 0\.3/.test(conf) && conf.includes("(calculated – the release printed no change)"), `20 Oct ledger flags the calculated fall (${JSON.stringify(conf)})`);
await openRow("Consumer confidence, 67.7"); /* close it */
await sleep(400);
check(await openRow("Consumer confidence, 68,"), "13 Oct row opens");
await sleep(700);
conf = await page.evaluate(() => (document.querySelector(".rd-ldg-conf") || {}).textContent || null);
check(!!conf && /up 0\.9/.test(conf) && !conf.includes("calculated"), `13 Oct ledger reads the bare printed rise (${JSON.stringify(conf)})`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
