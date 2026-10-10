/* 'p'-toggles-the-basis probe: the Latest-and-next and All-polls tables
   claim 'p' for their "Show the pollsters’ published figures" switch while
   they are on screen (viewport claim, twopp facet only, the spacebar
   claim's sibling). Asserts the toggle, the facet gate, the out-of-view
   hand-back, real-focus priority, the no-repeat hold, and the shift-P
   variant, at desktop and phone rungs. The observable is the basis word in
   the tab row (", as published" / ", implied flows"; short forms on
   phone). Run: node .matilda/probe/pub-key-flip.mjs */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = process.env.PROBE_ROOT || fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9007;
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
/* "pub"/"imp" from the visible basis word in the tab row (null when the
   control row itself is absent, e.g. a non-2PP facet). */
const basisOf = (page, sec) => page.evaluate((s) => {
  const el = [...document.querySelectorAll(s + " .rd-pl-ctl-l")]
    .find((b) => b.offsetParent && /published|implied/.test(b.textContent));
  if (!el) return null;
  return /implied/.test(el.textContent) ? "imp" : "pub";
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
const blurActive = (page) => page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
const pKey = async (page) => { await page.keyboard.press("KeyP"); await sleep(300); };

/* ---------- A. Latest and next polls, desktop -------------------------- */
{
  const page = await newPage(1440, 960, "");
  await page.waitForSelector("#latest-polls .rd-pl-row", { timeout: 20000 });
  await sleep(600);
  await toCentre(page, "#latest-polls");
  const w0 = await basisOf(page, "#latest-polls");
  check(!!w0, "A0 latest basis word rendered", w0);
  const y0 = await scrollY(page);
  await pKey(page);
  const w1 = await basisOf(page, "#latest-polls");
  check(w1 && w1 !== w0, "A1 p flips the latest table basis", { w0, w1 });
  check((await scrollY(page)) === y0, "A1 claimed p never scrolls the page", { y0, y: await scrollY(page) });
  await pKey(page);
  check((await basisOf(page, "#latest-polls")) === w0, "A2 second p flips back", { w0 });
  /* hold = one toggle, never a scroll */
  await page.evaluate(() => {
    window.__flips = 0;
    const el = [...document.querySelectorAll("#latest-polls .rd-pl-ctl-l")]
      .find((b) => b.offsetParent && /published|implied/.test(b.textContent));
    new MutationObserver(() => window.__flips++).observe(el, { childList: true, subtree: true, characterData: true });
  });
  await page.keyboard.down("KeyP"); await sleep(650); await page.keyboard.up("KeyP"); await sleep(150);
  const fh = await page.evaluate(() => window.__flips);
  check(fh === 1, "A3 held p toggles exactly once", { flips: fh });
  check((await scrollY(page)) === y0, "A3 held p never scrolls", { y0, y: await scrollY(page) });
  /* capital P is the same key */
  const w4 = await basisOf(page, "#latest-polls");
  await page.keyboard.down("Shift"); await page.keyboard.press("KeyP"); await page.keyboard.up("Shift");
  await sleep(300);
  check((await basisOf(page, "#latest-polls")) !== w4, "A4 shift-P flips too", { w4, w: await basisOf(page, "#latest-polls") });
  /* real focus wins: a focused button keeps its p (buttons don't take p
     natively, so nothing happens at all) */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("#latest-polls .rd-pl-flip")].find((b) => b.offsetParent);
    el.focus();
  });
  const w5 = await basisOf(page, "#latest-polls");
  await pKey(page);
  check(await page.evaluate(() => document.activeElement.tagName) === "BUTTON", "A5 focus stays on the button");
  check((await basisOf(page, "#latest-polls")) === w5, "A5 focused button: p stands aside", { w5, w: await basisOf(page, "#latest-polls") });
  await blurActive(page);
  await sleep(150);
  /* primary facet: no claim, and the basis state is untouched */
  check(await clickFacet(page, "#latest-polls", "Primary"), "A6 primary tab clicked");
  await sleep(350);
  await blurActive(page);
  await sleep(150);
  check((await basisOf(page, "#latest-polls")) === null, "A6 primary facet: no basis word");
  await pKey(page);
  check(await clickFacet(page, "#latest-polls", "2PP"), "A6 back to 2PP");
  await sleep(350);
  await blurActive(page);
  await toCentre(page, "#latest-polls");
  check((await basisOf(page, "#latest-polls")) === w5, "A6 primary facet: p left the basis alone", { w5, w: await basisOf(page, "#latest-polls") });
  /* out of view hands the key back */
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
  const w7 = await basisOf(page, "#latest-polls");
  await pKey(page);
  check((await basisOf(page, "#latest-polls")) === w7, "A7 off-screen table: basis untouched", { w7, w: await basisOf(page, "#latest-polls") });
  await page.close();
}

/* ---------- B. Latest and next polls, phone ---------------------------- */
{
  const page = await newPage(390, 844, "");
  await page.waitForSelector("#latest-polls .rd-pl-row", { timeout: 20000 });
  await sleep(600);
  await toCentre(page, "#latest-polls");
  const w0 = await basisOf(page, "#latest-polls");
  check(!!w0, "B0 phone renders the basis word", w0);
  if (w0) {
    await pKey(page);
    check((await basisOf(page, "#latest-polls")) !== w0, "B1 phone: p flips the basis at 390px", { w0, w: await basisOf(page, "#latest-polls") });
  }
  await page.close();
}

/* ---------- C. All polls ----------------------------------------------- */
{
  const page = await newPage(1440, 960, "allpolls/");
  await page.waitForSelector("#rd-ap-top .rd-ap-table .rd-ap-row, #rd-ap-top .rd-ap-table .rd-ap-card", { timeout: 20000 });
  await sleep(700);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  const w0 = await basisOf(page, "#rd-ap-top");
  check(!!w0, "C0 all-polls basis word rendered", w0);
  await pKey(page);
  const w1 = await basisOf(page, "#rd-ap-top");
  check(w1 && w1 !== w0, "C1 p flips the all-polls basis", { w0, w1 });
  await pKey(page);
  check((await basisOf(page, "#rd-ap-top")) === w0, "C2 second p flips back");
  /* a non-2PP facet hands the key back and leaves the basis alone */
  check(await clickFacet(page, "#rd-ap-top", "Primary"), "C3 primary tab clicked");
  await sleep(400);
  await blurActive(page);
  await sleep(150);
  check((await basisOf(page, "#rd-ap-top")) === null, "C3 primary facet: no basis word");
  await pKey(page);
  check(await clickFacet(page, "#rd-ap-top", "2PP"), "C3 back to 2PP");
  await sleep(400);
  await blurActive(page);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  check((await basisOf(page, "#rd-ap-top")) === w0, "C3 primary facet: p left the basis alone", { w0, w: await basisOf(page, "#rd-ap-top") });
  /* scrolled past the table, the claim releases */
  await page.evaluate(() => {
    const sec = document.getElementById("rd-ap-top");
    window.scrollTo(0, Math.round(sec.offsetTop + sec.offsetHeight + 120));   /* 120px past the table, page still scrollable */
  });
  await sleep(600);
  const below = await page.evaluate(() => document.getElementById("rd-ap-top").getBoundingClientRect().bottom < 0);
  check(below, "C4 table fully above the viewport");
  const woff = await basisOf(page, "#rd-ap-top");
  await pKey(page);
  check((await basisOf(page, "#rd-ap-top")) === woff, "C4 off-screen table: basis untouched", { woff, w: await basisOf(page, "#rd-ap-top") });
  await page.close();
}

/* ---------- D. All polls, phone ---------------------------------------- */
{
  const page = await newPage(390, 844, "allpolls/");
  await page.waitForSelector("#rd-ap-top .rd-ap-table .rd-ap-card, #rd-ap-top .rd-ap-table .rd-ap-row", { timeout: 20000 });
  await sleep(700);
  await toCentre(page, "#rd-ap-top .rd-ap-table");
  const w0 = await basisOf(page, "#rd-ap-top");
  check(!!w0, "D0 phone all-polls renders the basis word", w0);
  if (w0) {
    await pKey(page);
    check((await basisOf(page, "#rd-ap-top")) !== w0, "D1 phone: p flips the basis at 390px", { w0, w: await basisOf(page, "#rd-ap-top") });
  }
  await page.close();
}

/* ---------- E. The spacebar claim still works beside p ------------------ */
{
  const page = await newPage(1440, 960, "");
  await page.waitForSelector("#latest-polls .rd-pl-row", { timeout: 20000 });
  await sleep(600);
  await toCentre(page, "#latest-polls");
  const t0 = await page.evaluate(() => {
    const el = [...document.querySelectorAll("#latest-polls .rd-pl-flip")].find((b) => b.offsetParent);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  });
  await page.keyboard.press("Space"); await sleep(250);
  const t1 = await page.evaluate(() => {
    const el = [...document.querySelectorAll("#latest-polls .rd-pl-flip")].find((b) => b.offsetParent);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  });
  check(t0 && t1 && t0 !== t1, "E1 space still flips the contest beside p", { t0, t1 });
  await page.close();
}

await browser.close();
server.close();
if (fails.length) { console.log("FAILS:\n" + fails.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("ALL PASS — p toggles the published/implied basis while each table is in view (Latest + All polls, desktop + phone), space claim intact");
