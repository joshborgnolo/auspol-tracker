/* Probe (run: node .matilda/probe/conf-headline.mjs; PAGE=http://… to load
   the webfonts): the All-polls table's per-facet headlines and the phone's
   scrolling facet menu (user call 2026-10-08).

   Until then every facet sat under the 2PP's head and dek, and under 600px
   the menu dropped Confidence (and named Demographics "Groups") so six
   tabs fit. Now:
   1. each facet heads the table with its own head and dek - all seven
      present and distinct, the 2PP's unchanged in shape, the confidence
      facet's chrome ("Economic sentiment" + the trimmed indices meta)
      intact, and the demographics head following the split picker
   2. at 320-760px all seven tabs are in the menu (Demographics in full),
      the strip scrolls sideways inside itself (never the page), its fade
      class marks the hidden edge, and a pick glides its tab into view;
      ?f=c deep-links onto Confidence on a phone and stays there
   3. the fixed view holds: scrolled into the table, a walk through every
      facet (heads of different lengths above it) leaves the search bar /
      table top exactly where it was - the pin ignores drifts under 3px, so
      the probe allows 0.5px */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.resolve(process.cwd(), "index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

const CONF_META = "Every confidence-index release (business and consumer) since the 2025 election";
const LAB = { twopp: "2PP", primary: "Primary", leadership: /^Leader/, direction: "Direction", issues: "Issues", demographics: "Demographics", confidence: "Confidence" };
const IDS = Object.keys(LAB);
const open = async (w, qs = "") => {
  const phone = w <= 760;
  await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.goto(PAGE + qs + "#allpolls", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ap-tabs .rd-tab", { timeout: 30000 });
  await sleep(600);
};
const pick = (id, sel = ".rd-ap-tabs .rd-tab") => page.evaluate((lab, sel) => {
  const re = lab.startsWith("/") ? new RegExp(lab.slice(1, -1)) : null;
  const b = [...document.querySelectorAll(sel)].find((x) => (re ? re.test(x.textContent.trim()) : x.textContent.trim() === lab));
  if (!b) return false;
  b.click();
  return true;
}, String(LAB[id] instanceof RegExp ? LAB[id] : LAB[id]), sel);
const hed = () => page.evaluate(() => ({
  facet: document.querySelector(".rd-ap").dataset.facet,
  head: (document.querySelector(".rd-ap h2.rd-hed") || {}).textContent || null,
  dek: (document.querySelector(".rd-ap p.rd-dek") || {}).textContent || null,
  title: (document.querySelector(".rd-ap h2.rd-title") || {}).textContent || null,
  meta: (document.querySelector(".rd-ap .rd-eyebrow .rd-meta") || {}).textContent || null,
}));

/* 1. a head and dek of its own on every facet */
console.log("== 1. per-facet headlines (1280) ==");
await open(1280);
const seen = {};
for (const id of IDS) {
  check(await pick(id), `tab for ${id} present`);
  await sleep(500);
  const h = await hed();
  seen[id] = h;
  check(h.facet === id && h.head && h.dek, `${id}: head + dek (${JSON.stringify((h.head || "").slice(0, 70))})`);
}
check(seen.twopp.head.startsWith("Labor’s") && seen.twopp.dek.includes("Below is every"), "2PP head keeps its shape");
check(new Set(IDS.map((id) => seen[id].head)).size === IDS.length, "seven distinct heads");
check(new Set(IDS.map((id) => seen[id].dek)).size === IDS.length, "seven distinct deks");
check(/primary vote comes from|primary vote is the trend/.test(seen.primary.head), "Primary head quotes the primary vote");
check(/net (approval|favourability) of/.test(seen.leadership.head), "Leadership head quotes the net rating");
check(/^The net mood of/.test(seen.direction.head), "Direction head quotes the net mood");
check(/issues/.test(seen.issues.head), "Issues head counts the issues");
check(/gauges sit (below|above) neutral/.test(seen.confidence.head), "Confidence head reads the gauges");
check(seen.confidence.title === "Economic sentiment" && seen.confidence.meta === CONF_META, "Confidence chrome intact (title + trimmed meta)");
check(seen.twopp.meta && seen.twopp.meta.includes("poll since"), "poll-facet meta unchanged");
/* the demographics head follows the split picker */
await pick("demographics");
await sleep(400);
const demHeads = [];
for (const s of ["Age", "Gender", "Education", "Place", "Home", "Income"]) {
  const ok = await page.evaluate((s) => { const b = [...document.querySelectorAll(".rd-ap-dpick button")].find((x) => x.textContent.trim() === s); if (b) b.click(); return !!b; }, s);
  if (!ok) continue;
  await sleep(400);
  demHeads.push((await hed()).head);
}
check(demHeads.length >= 5 && new Set(demHeads).size === demHeads.length, `demographics head changes with each split (${demHeads.length})`);

/* 2. the phone menu */
console.log("== 2. phone menu, 320-760 ==");
for (const w of [320, 360, 390, 430, 520, 600, 700, 760]) {
  await open(w);
  const m = await page.evaluate(() => {
    const g = document.querySelector('.rd-ap-tabs > [role="group"]');
    return { labs: [...g.querySelectorAll(".rd-tab")].map((b) => b.textContent.trim()), sw: g.scrollWidth, cw: g.clientWidth, cls: g.className, docW: document.documentElement.scrollWidth, rowH: document.querySelector(".rd-ap-tabs").getBoundingClientRect().height };
  });
  check(m.labs.length === 7 && m.labs.includes("Confidence") && m.labs.includes("Demographics"), `${w}: seven tabs incl. Confidence, Demographics in full`);
  check(m.docW <= w, `${w}: no page overflow (${m.docW})`);
  check(m.rowH === 44, `${w}: tab row 44px (${m.rowH})`);
  if (m.sw > m.cw + 1) check(/\bovf-r\b/.test(m.cls) && !/\bovf-l\b/.test(m.cls), `${w}: strip scrolls, right fade only at the start`);
  await pick("confidence");
  await sleep(900);
  const v = await page.evaluate(() => {
    const g = document.querySelector('.rd-ap-tabs > [role="group"]');
    const a = g.querySelector('[aria-pressed="true"]').getBoundingClientRect(), r = g.getBoundingClientRect();
    return { facet: document.querySelector(".rd-ap").dataset.facet, vis: a.left >= r.left - 1 && a.right <= r.right + 1 };
  });
  check(v.facet === "confidence" && v.vis, `${w}: Confidence opens and its tab is in view`);
}
await open(390, "?f=c");
await sleep(600);
check((await hed()).facet === "confidence", "390: ?f=c deep link stays on Confidence");

/* 3. the fixed view holds through a facet walk */
console.log("== 3. facet walk holds the table ==");
for (const w of [390, 820, 1024, 1180, 1280]) {
  await open(w);
  for (const where of ["mid", "deep"]) {
    await page.evaluate((where) => {
      const t = document.querySelector(".rd-ap-tabs").getBoundingClientRect().top + scrollY;
      window.scrollTo(0, where === "deep" ? t + 1500 : t - 300);
    }, where);
    await sleep(500);
    let worst = 0;
    for (const id of ["primary", "leadership", "direction", "issues", "demographics", "confidence", "twopp", "confidence", "primary", "issues", "twopp"]) {
      const anchor = where === "deep" ? ".rd-ap-table" : ".rd-ap-bar";
      const y0 = await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, anchor);
      const pinned = await page.evaluate(() => !!document.querySelector(".rd-ap-pinbar.on .rd-ap-pint"));
      await pick(id, where === "deep" && pinned ? ".rd-ap-pint" : ".rd-ap-tabs .rd-tab");
      await sleep(1100);
      const y1 = await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, anchor);
      if (Math.abs(y1 - y0) > Math.abs(worst)) worst = y1 - y0;
    }
    check(Math.abs(worst) < 0.5, `${w} ${where}: table held through the walk (worst ${worst.toFixed(2)}px)`);
  }
}

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
