/* Spacebar-flips-the-2PP-contest probe: the Latest-and-next and All-polls
   tables claim the spacebar for their "Labor v X ⇄" matchup toggle while
   they are on screen (viewport claim, twopp facet only). Asserts the flip,
   the facet gate, the out-of-view hand-back, real-focus priority, the
   no-repeat hold, and the no-scroll-while-claimed contract, at desktop and
   phone rungs. Run: node .matilda/probe-space-flip.mjs */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = process.env.PROBE_ROOT || fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9006;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".sass": "text/css", ".mjs": "text/javascript",
               ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2",
               ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv", ".xml": "text/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, label, detail) => { if (!ok) fails.push(label + (detail ? " — " + JSON.stringify(detail) : "")); };

const newPage = async (w, h, hash) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => fails.push("pageerror: " + e.message));
  await page.setViewport({ width: w, height: h });
  await page.goto(`http://127.0.0.1:${PORT}/` + (hash || ""), { waitUntil: "domcontentloaded" });
  return page;
};
const scrollY = (page) => page.evaluate(() => window.scrollY);
const flipText = (page, sec) => page.evaluate((s) => {
  const el = [...document.querySelectorAll(s + " .rd-pl-flip")].find((b) => b.offsetParent);
  return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
}, sec);
const toCentre = async (page, sel) => {
  await page.$eval(sel, (el) => el.scrollIntoView({ block: "center" }));
  await sleep(450);                                  // IntersectionObserver + settle
};
const clickFacet = (page, sec, label) => page.evaluate((s, t) => {
  const b = [...document.querySelectorAll(s + " .rd-tab")].find((e) => e.textContent.trim() === t);
  if (b) { b.click(); return true; }
  return false;
}, sec, label);
const facetOf = (page, sec) => page.$eval(sec, (el) => el.dataset.facet || null);
const blurActive = (page) => page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
const space = async (page) => { await page.keyboard.press("Space"); await sleep(220); };

/* ---------- A. Latest and next polls, desktop -------------------------- */
{
  const page = await newPage(1440, 960, "");
  await page.waitForSelector("#latest-polls .rd-pl-row", { timeout: 20000 });
  await sleep(600);
  await toCentre(page, "#latest-polls");
  const t0 = await flipText(page, "#latest-polls");
  check(!!t0, "A0 latest flip button rendered", t0);
  const y0 = await scrollY(page);
  await space(page);
  const t1 = await flipText(page, "#latest-polls");
  check(t1 && t1 !== t0, "A1 space flips the latest table contest", { t0, t1 });
  check((await scrollY(page)) === y0, "A1 claimed space never scrolls the page", { y0, y: await scrollY(page) });
  await space(page);
  check((await flipText(page, "#latest-polls")) === t0, "A2 second space flips back", { t0 });
  /* hold = one flip, never a scroll */
  await page.evaluate(() => {
    window.__flips = 0;
    const el = [...document.querySelectorAll("#latest-polls .rd-pl-flip")].find((b) => b.offsetParent);
    new MutationObserver(() => window.__flips++).observe(el, { childList: true, subtree: true, characterData: true });
  });
  await page.keyboard.down("Space"); await sleep(650); await page.keyboard.up("Space"); await sleep(150);
  const fh = await page.evaluate(() => window.__flips);
  check(fh === 1, "A3 held space flips exactly once", { flips: fh });
  check((await scrollY(page)) === y0, "A3 held space never scrolls", { y0, y: await scrollY(page) });
  /* real focus on the toggle wins: the keypress is the button's own native
     activation (one flip), the claim stands aside */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("#latest-polls .rd-pl-flip")].find((b) => b.offsetParent);
    el.focus();
  });
  const tf = await flipText(page, "#latest-polls");
  await space(page);
  check(await page.evaluate(() => document.activeElement.tagName) === "BUTTON", "A4 focus stays on the toggle");
  check((await flipText(page, "#latest-polls")) !== tf, "A4 focused space flips once (claim stood aside)", { tf, t: await flipText(page, "#latest-polls") });
  await page.evaluate(() => document.activeElement.blur());
  await sleep(150);
  /* shift+space is not claimed */
  const t5 = await flipText(page, "#latest-polls");
  const ys = await scrollY(page);
  await page.keyboard.down("Shift"); await space(page); await page.keyboard.up("Shift");
  check((await flipText(page, "#latest-polls")) === t5, "A5 shift+space leaves the contest alone", { t5, t: await flipText(page, "#latest-polls") });
  check((await scrollY(page)) < ys, "A5 shift+space keeps its page-up day job", { ys, y: await scrollY(page) });
  /* clicking a facet tab focuses it (rdTabFocus): with the tab focused,
     space is the tab's own native activation, and the claim stands aside */
  await toCentre(page, "#latest-polls");
  check(await clickFacet(page, "#latest-polls", "Primary"), "A6 primary tab clicked");
  await sleep(350);
  check(await page.evaluate(() => document.activeElement && !!document.activeElement.closest(".rd-tab")), "A6 clicked tab holds focus");
  const tfac = await flipText(page, "#latest-polls");
  await space(page);                                             // re-activates the focused tab by native button rules
  check((await facetOf(page, "#latest-polls")) === "primary", "A6 focused tab: space activates the tab, facet stays Primary");
  check((await flipText(page, "#latest-polls")) === tfac, "A6 focused tab: contest untouched", { tfac });
  await page.evaluate(() => document.activeElement.blur());
  await sleep(150);
  const tp = await flipText(page, "#latest-polls");
  const yp = await scrollY(page);
  await space(page);
  check(await scrollY(page) > yp, "A6 primary facet: space scrolls again", { yp, y: await scrollY(page) });
  check((await flipText(page, "#latest-polls")) === tp, "A6 primary facet: contest untouched");
  /* out of view hands the key back too */
  check(await clickFacet(page, "#latest-polls", "2PP"), "A7 back to 2PP");
  await sleep(300);
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
  const toff = await flipText(page, "#latest-polls");
  check(await scrollY(page) === 0, "A7 parked at page top");
  await space(page);
  check(await scrollY(page) > 0, "A7 off-screen table: space scrolls", { y: await scrollY(page) });
  check((await flipText(page, "#latest-polls")) === toff, "A7 off-screen table: contest untouched");
  await page.close();
}

/* ---------- B. Latest and next polls, phone ---------------------------- */
{
  const page = await newPage(390, 844, "");
  await page.waitForSelector("#latest-polls .rd-pl-row", { timeout: 20000 });
  await sleep(600);
  await toCentre(page, "#latest-polls");
  const t0 = await flipText(page, "#latest-polls");
  check(!!t0, "B0 phone renders the toggle", t0);
  const y0 = await scrollY(page);
  await space(page);
  check((await flipText(page, "#latest-polls")) !== t0, "B1 phone: space flips at 390px");
  check((await scrollY(page)) === y0, "B1 phone: claimed space never scrolls", { y0, y: await scrollY(page) });
  await page.close();
}

/* ---------- C. All polls ---------------------------------------------- */
{
  const page = await newPage(1440, 960, "allpolls/");
  await page.waitForSelector("#rd-ap-top .rd-ap-table .rd-ap-row, #rd-ap-top .rd-ap-table .rd-ap-card", { timeout: 20000 });
  await sleep(700);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  const t0 = await flipText(page, "#rd-ap-top");
  check(!!t0, "C0 all-polls flip button rendered", t0);
  const y0 = await scrollY(page);
  await space(page);
  const t1 = await flipText(page, "#rd-ap-top");
  check(t1 && t1 !== t0, "C1 space flips the all-polls contest", { t0, t1 });
  check((await scrollY(page)) === y0, "C1 claimed space never scrolls", { y0, y: await scrollY(page) });
  await space(page);
  check((await flipText(page, "#rd-ap-top")) === t0, "C2 second space flips back");
  /* a non-2PP facet hands the key back (blur the clicked tab first — a real
     mouse click leaves focus on it, and the claim rightly stands aside) */
  check(await clickFacet(page, "#rd-ap-top", "Primary"), "C3 primary tab clicked");
  await sleep(400);
  await blurActive(page);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  const yp = await scrollY(page);
  await space(page);
  check(await scrollY(page) > yp, "C3 primary facet: space scrolls", { yp, y: await scrollY(page) });
  /* scrolled past the table, the claim releases */
  check(await clickFacet(page, "#rd-ap-top", "2PP"), "C4 back to 2PP");
  await sleep(300);
  await blurActive(page);
  await page.evaluate(() => {
    const sec = document.getElementById("rd-ap-top");
    window.scrollTo(0, Math.round(sec.offsetTop + sec.offsetHeight + 120));   /* 120px past the table, page still scrollable */
  });
  await sleep(600);
  const below = await page.evaluate(() => document.getElementById("rd-ap-top").getBoundingClientRect().bottom < 0);
  check(below, "C4 table fully above the viewport");
  const toff = await flipText(page, "#rd-ap-top");
  const yoff = await scrollY(page);
  await space(page);
  check(await scrollY(page) > yoff, "C4 off-screen table: space scrolls", { yoff, y: await scrollY(page) });
  check((await flipText(page, "#rd-ap-top")) === toff, "C4 off-screen table: contest untouched");
  await page.close();
}

/* ---------- D. All polls, phone ---------------------------------------- */
{
  const page = await newPage(390, 844, "allpolls/");
  await page.waitForSelector("#rd-ap-top .rd-ap-table .rd-ap-card, #rd-ap-top .rd-ap-table .rd-ap-row", { timeout: 20000 });
  await sleep(700);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  const t0 = await flipText(page, "#rd-ap-top");
  check(!!t0, "D0 phone all-polls renders the toggle", t0);
  if (t0) {
    const y0 = await scrollY(page);
    await space(page);
    check((await flipText(page, "#rd-ap-top")) !== t0, "D1 phone: space flips at 390px");
    check((await scrollY(page)) === y0, "D1 phone: claimed space never scrolls", { y0, y: await scrollY(page) });
  }
  await page.close();
}

await browser.close();
server.close();
if (fails.length) { console.log("FAILS:\n" + fails.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("ALL PASS — spacebar flips the 2PP contest while each table is in view (Latest + All polls, desktop + phone)");
