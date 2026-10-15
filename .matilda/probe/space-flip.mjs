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
    if (p.endsWith("/")) p += "index.html";
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
  /* clicking a facet tab focuses it (rdTabFocus): with an INACTIVE tab
     focused, space is still the tab's own native activation - the claim
     only takes Space on the tab row when the focused tab is the selected
     one (where native activation would be a no-op). */
  await toCentre(page, "#latest-polls");
  check(await clickFacet(page, "#latest-polls", "Primary"), "A6 primary tab clicked");
  await sleep(350);
  check(await page.evaluate(() => document.activeElement && !!document.activeElement.closest(".rd-tab")), "A6 clicked tab holds focus");
  /* ...but the PRIMARY facet's tab is now the selected one, and on the
     twopp-only card primary has no flip, so Space there only makes sense
     as native tab re-activation: contest untouched, facet stays. */
  const tfac = await flipText(page, "#latest-polls");
  await space(page);
  check((await facetOf(page, "#latest-polls")) === "primary", "A6 focused selected primary tab Space: facet stays Primary (no flip exists)");
  check((await flipText(page, "#latest-polls")) === tfac, "A6 primary facet: contest untouched", { tfac });
  /* back on 2PP, which is the facet whose claim lives: clicking the 2PP
     tab focuses the SELECTED tab, and Space there flips the contest —
     the Selected-tab-owns-Space contract (user call 2026-10-15) */
  check(await clickFacet(page, "#latest-polls", "2PP"), "A6b back to 2PP");
  await sleep(350);
  await toCentre(page, "#latest-polls");
  const tsel = await flipText(page, "#latest-polls");
  const ysel = await scrollY(page);
  await space(page);
  check((await flipText(page, "#latest-polls")) !== tsel, "A6b selected 2PP tab owns Space: contest flips", { tsel, t: await flipText(page, "#latest-polls") });
  check((await scrollY(page)) === ysel, "A6b selected-tab Space never scrolls", { ysel, y: await scrollY(page) });
  await page.evaluate(() => document.activeElement.blur());
  await sleep(150);
  /* out of view, the table's own claim releases. The snapshot page's
     claims are stacked back-to-back (the hero matchup card claims Space
     while it intersects), so bare "space scrolls" never fires at the page
     top - the assertion is EXACTLY ONE flip per keypress: were the
     off-screen table's claim still live alongside the hero's, the
     matchup would flip twice and land back on the original text. */
  const toff = await flipText(page, "#latest-polls");
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  check(await scrollY(page) === 0, "A7 parked at page top");
  check(await page.evaluate(() => {
    const r = document.getElementById("latest-polls").getBoundingClientRect();
    return r.bottom <= 0 || r.top >= innerHeight;
  }), "A7 table fully out of view at page top");
  const ytop = await scrollY(page);
  await space(page);
  check((await scrollY(page)) === ytop, "A7 stacked page-top claims still never scroll", { ytop, y: await scrollY(page) });
  check((await flipText(page, "#latest-polls")) !== toff, "A7 exactly one flip: off-screen table's claim released its turn", { toff, t: await flipText(page, "#latest-polls") });
  await space(page);
  check((await flipText(page, "#latest-polls")) === toff, "A7 second space flips back once");
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
  /* a facet with nothing to step hands the key back (blur the clicked tab
     first — a real mouse click leaves focus on it) */
  check(await clickFacet(page, "#rd-ap-top", "Leadership"), "C3 leadership tab clicked");
  await sleep(400);
  await blurActive(page);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  const yp = await scrollY(page);
  await space(page);
  check(await scrollY(page) > yp, "C3 no-step facet: space scrolls", { yp, y: await scrollY(page) });
  /* the PRIMARY facet's selected tab owns Space too — intention ⇄
     consideration, the user's "same for Vote:" half of the contract.
     (Re-centre first: the claim is viewport-gated, and facet clicks don't
     scroll.) */
  check(await clickFacet(page, "#rd-ap-top", "Primary"), "C3b primary tab clicked (focused, selected)");
  await sleep(400);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  const tc0 = await flipText(page, "#rd-ap-top");
  const yc = await scrollY(page);
  await space(page);
  const tc1 = await flipText(page, "#rd-ap-top");
  check(!!tc1 && tc1 !== tc0, "C3b selected primary tab owns Space: intention ⇄ consideration flips", { tc0, tc1 });
  check((await scrollY(page)) === yc, "C3b claimed space never scrolls", { yc, y: await scrollY(page) });
  await blurActive(page);
  /* the selected 2PP tab owns Space in All polls too */
  check(await clickFacet(page, "#rd-ap-top", "2PP"), "C3c 2PP tab clicked (focused, selected)");
  await sleep(400);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  const tz0 = await flipText(page, "#rd-ap-top");
  const yz = await scrollY(page);
  await space(page);
  check((await flipText(page, "#rd-ap-top")) !== tz0, "C3c selected 2PP tab owns Space: contest flips", { tz0, t: await flipText(page, "#rd-ap-top") });
  check((await scrollY(page)) === yz, "C3c claimed space never scrolls", { yz, y: await scrollY(page) });
  await blurActive(page);
  /* scrolled past the table, the claim releases */
  await page.evaluate(() => {
    const sec = document.getElementById("rd-ap-top");
    window.scrollTo(0, Math.round(sec.offsetTop + sec.offsetHeight + 120));   /* 120px past the table, page still scrollable */
  });
  await sleep(600);
  const below = await page.evaluate(() => document.getElementById("rd-ap-top").getBoundingClientRect().bottom < 0);
  check(below, "C4 table fully above the viewport");
  /* 120px below the table sits inside the stacked claims that follow it
     (poll-disagreement, house-lean): house-lean's own Space claim is live
     there, so the assertion is EXACTLY ONE flip per keypress - were the
     off-screen table's claim still live too, the matchup would flip
     twice and land back on the original text. */
  const toff = await flipText(page, "#rd-ap-top");
  const yoff = await scrollY(page);
  await space(page);
  check((await scrollY(page)) === yoff, "C4 stacked claims below the table never scroll", { yoff, y: await scrollY(page) });
  check((await flipText(page, "#rd-ap-top")) !== toff, "C4 exactly one flip: off-screen table's claim released its turn", { toff, t: await flipText(page, "#rd-ap-top") });
  await space(page);
  check((await flipText(page, "#rd-ap-top")) === toff, "C4 second space flips back once");
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
