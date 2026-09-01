// Phone-width clearance probe for the .tabs-set gap fix (effective 30px ->
// 18px at <=640px). The phone gap rule only counts if it sits AFTER the base
// .tabs-set rule in the built CSS - an earlier copy ahead of it lost the
// cascade and sat dead for months. Asserts the computed gap at 390px is the
// live 18px, measures live pixel clearance between the last visible tab
// ("All polls") and the docked 2PP score in the show-score state, then
// re-measures at the same scroll position with 30px injected as the
// pre-change reference. Also sweeps 360px for near-overflow. Screenshots the
// bar to /tmp/tab-gap-*.png. Exit 1 on any assertion failure.
import { createRequire } from "node:module";

let puppeteer = null;
for (const r of [
  createRequire(import.meta.url),
  createRequire("/opt/homebrew/lib/node_modules/"),
]) {
  try { puppeteer = r("puppeteer-core"); break; } catch { /* keep looking */ }
}
if (!puppeteer) throw new Error("puppeteer-core not found");

const BASE = process.env.BASE || "http://127.0.0.1:8722";
const CHROME = process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--hide-scrollbars"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();

const results = [];
const fails = [];
const check = (name, cond, detail) => {
  if (!cond) fails.push({ name, detail });
};

async function loadAt(width) {
  await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction(() =>
    document.querySelector("nav.tabs") &&
    (document.querySelector(".hero-gauge") || document.querySelector(".hero-readout")),
    { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(1500); // settle hero layout / lazy media before geometry
}

async function scrollToShowScore() {
  // fresh geometry at decision time; scroll just past the hero readout
  const y = await page.evaluate(() => {
    const g = document.querySelector(".hero-gauge") || document.querySelector(".hero-readout");
    return Math.round(g.getBoundingClientRect().bottom + window.scrollY) + 150;
  });
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await sleep(1000); // IO delivery + score opacity transition (.26/.34s)
}

async function measure(tag) {
  return page.evaluate((tag) => {
    const tabs = [...document.querySelectorAll(".tabs-set .tab")]
      .filter((t) => getComputedStyle(t).display !== "none");
    const last = tabs[tabs.length - 1];
    const lab = last.querySelector(".tab-label");
    const sr = document.querySelector(".tab-score").getBoundingClientRect();
    const lr = (lab || last).getBoundingClientRect();
    return {
      tag,
      width: innerWidth,
      cls: document.querySelector("nav.tabs").className.replace("tabs sticky", "").trim() || "-",
      editorial: document.body.classList.contains("editorial"),
      computedGap: getComputedStyle(document.querySelector(".tabs-set")).columnGap,
      lastTab: lab ? lab.textContent.trim() : "?",
      lastTabRight: +lr.right.toFixed(1),
      scoreLeft: +sr.left.toFixed(1),
      clearance: +(sr.left - lr.right).toFixed(1),
    };
  }, tag);
}

async function shoot(tag) {
  const bar = await page.$("nav.tabs");
  const clip = await bar.boundingBox();
  await page.screenshot({
    path: `/tmp/tab-gap-${tag}.png`,
    clip: { x: 0, y: Math.max(0, clip.y - 4), width: 390, height: Math.min(844, clip.height + 8) },
  });
}

// ---- 390px editorial (default layout) --------------------------------
await loadAt(390);
await scrollToShowScore();
const cur = await measure("show-score-new-18");
check("show-score state", /show-score/.test(cur.cls), cur.cls);
check("editorial default", cur.editorial === true, cur.editorial);
check("computed gap is 18px", cur.computedGap === "18px", cur.computedGap);
check("Info hidden when docked", cur.lastTab === "All polls", cur.lastTab);
check("positive clearance", cur.clearance > 15, cur.clearance);
// pre-change reference at the same scroll position
await page.evaluate(() => {
  const st = document.createElement("style");
  st.id = "ref-gap";
  st.textContent = "@media (max-width: 640px) { .tabs-set { gap: 30px !important; } }";
  document.head.appendChild(st);
});
await sleep(200);
const old = await measure("show-score-old-30");
check("old gap wider", old.clearance < cur.clearance, { old, cur });
await page.evaluate(() => document.getElementById("ref-gap").remove());
await sleep(200);
await shoot("show-score-390");
results.push(cur, old);

// ---- 360px near-overflow sweep ---------------------------------------
await loadAt(360);
await scrollToShowScore();
const small = await measure("show-score-360");
check("360px no overlap", small.lastTabRight < small.scoreLeft, small);
results.push(small);

await browser.close();
console.log(JSON.stringify({ verdict: fails.length ? "FAIL" : "PASS", fails, results }, null, 2));
process.exit(fails.length ? 1 : 0);
