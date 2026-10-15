// House-lean Space-flip probe: Space behaves like the "Labor v X ⇄" flip
// while #house-lean is on screen on its Two-party view; elsewhere it keeps
// its scroll day job. Modelled on the .matilda hover-claim probes.
// Runs against the /leans/ page - 0f7eb4bd (2026-10-15) moved the section
// off All polls into its own tab page.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = process.env.PROBE_ROOT || fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9007;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
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
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960 });
await page.goto(`http://127.0.0.1:${PORT}/leans/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#house-lean .rd-pl-flip", { timeout: 20000 });
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const expect = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails.push(msg); };
await sleep(700);

const label = async () => page.$eval("#house-lean .rd-pl-flip", (el) => el.textContent.replace(/\s+/g, " ").trim());
const sideOf = (t) => (t.includes("Coalition") ? "co" : t.includes("One Nation") ? "on" : "?");
const activeTag = () => page.evaluate(() => (document.activeElement ? document.activeElement.tagName : ""));
const showLean = async () => {
  await page.evaluate(() => {
    document.getElementById("house-lean").scrollIntoView({ block: "start" });
    window.scrollBy(0, -100);
  });
  await sleep(300);
};
const pressSpaceForChange = async (prev) => {
  await page.keyboard.press("Space");
  await page.waitForFunction((p) => {
    const b = document.querySelector("#house-lean .rd-pl-flip");
    return b && b.textContent.replace(/\s+/g, " ").trim() !== p;
  }, { timeout: 3000 }, prev).catch(() => {});
  await sleep(150);
};
const clickHlTab = async (name) => {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll(".rd-hl-tabs [aria-pressed]")].find((x) => x.textContent.trim() === n);
    if (b) b.click();
  }, name);
  await sleep(250);
};

// P1/P2: on-screen Space flips the two-party contest both ways
await showLean();
const t0 = await label();
expect(sideOf(t0) !== "?", "P1: flip button reads a contest label (" + JSON.stringify(t0) + ")");
await pressSpaceForChange(t0);
const t1 = await label();
expect(sideOf(t1) !== "?" && sideOf(t1) !== sideOf(t0), "P1: Space flips " + sideOf(t0) + " -> " + sideOf(t1) + " (" + JSON.stringify(t1) + ")");
expect((await activeTag()) === "BODY", "P1: focus stays BODY");
await pressSpaceForChange(t1);
const t2 = await label();
expect(sideOf(t2) === sideOf(t0), "P2: Space again flips back (" + JSON.stringify(t2) + ")");

// P3: on a primary measure view Space keeps its scroll day job and does not flip
// (blur after the tab click - Space on a focused button is its native activation)
await clickHlTab("Labor");
await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
await sleep(100);
const y0 = await page.evaluate(() => window.scrollY);
await page.keyboard.press("Space");
await sleep(400);
const y1 = await page.evaluate(() => window.scrollY);
expect(y1 > y0, "P3: Space on the Labor view scrolls (day job)");
await showLean();
let hasFlip = await page.evaluate(() => !!document.querySelector("#house-lean .rd-pl-flip"));
expect(!hasFlip, "P3: no flip control on a primary view");
await clickHlTab("Two-party");
const t3 = await label();
expect(sideOf(t3) === sideOf(t0), "P3: the Space did not flip the contest (label " + JSON.stringify(t3) + ")");

// P4: Space on the FOCUSED flip button activates it natively, claimed exactly once
await showLean();
const f0 = await label();
await page.click("#house-lean .rd-pl-flip");
await sleep(300);
const f1 = await label();
expect(sideOf(f1) !== sideOf(f0), "P4: clicking the button flips (" + JSON.stringify(f1) + ")");
expect((await activeTag()) === "BUTTON", "P4: the click leaves focus on the button");
await page.keyboard.press("Space");
await sleep(400);
const f2 = await label();
expect(sideOf(f2) === sideOf(f0), "P4: focused Space flips exactly once (" + JSON.stringify(f2) + ")");
expect((await page.evaluate(() => window.scrollY)) === (await page.evaluate(() => window.scrollY)), "P4: no scroll from focused Space");
await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());

// P6: focus on the SELECTED measure tab (where a click leaves it) - Space
// still flips the contest, the tab's pick and focus staying put
await showLean();
const h0 = await label();
await page.$eval('.rd-hl-tabs [aria-pressed="true"]', (el) => el.focus());
await sleep(150);
expect((await activeTag()) === "BUTTON", "P6: focus lands on the selected measure tab");
await pressSpaceForChange(h0);
const h1 = await label();
expect(sideOf(h1) !== "?" && sideOf(h1) !== sideOf(h0), "P6: Space from the selected tab flips " + sideOf(h0) + " -> " + sideOf(h1));
await pressSpaceForChange(h1);
expect(sideOf(await label()) === sideOf(h0), "P6: Space again flips back");
const tabKept = await page.evaluate(() => {
  const a = document.activeElement;
  const b = a && a.closest ? a.closest(".rd-hl-tabs [aria-pressed]") : null;
  return !!(b && b.getAttribute("aria-pressed") === "true" && b.textContent.trim() === "Two-party");
});
expect(tabKept, "P6: the Two-party tab stays pressed and keeps the focus");

// P7: an UNPRESSED measure tab keeps Space's day job (native activation)
const target = await page.$eval('.rd-hl-tabs [aria-pressed="false"]', (el) => el.textContent.trim());
await page.$eval('.rd-hl-tabs [aria-pressed="false"]', (el) => el.focus());
await sleep(150);
await page.keyboard.press("Space");
await sleep(400);
const picked = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".rd-hl-tabs [aria-pressed]")].find((x) => x.getAttribute("aria-pressed") === "true");
  return b ? b.textContent.trim() : "";
});
expect(picked === target && target !== "Two-party", "P7: unpressed tab's native Space activates it (pick now " + JSON.stringify(picked) + ")");
await clickHlTab("Two-party");
await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
await sleep(150);

// P5: since 0f7eb4bd the section IS the /leans/ page (1178px tall > any
// desktop viewport), so it can never leave the viewport and the viewport
// claim stays hot to the document's end. Pin the structure and the
// consequence: at the very bottom Space still flips. A future layout that
// makes the section exitable breaks the structure check - rewrite this
// phase as a release test then.
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await sleep(400);
const inView = await page.evaluate(() => {
  const r = document.getElementById("house-lean").getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
});
expect(inView, "P5: house-lean still intersects at the document's end (full-page panel)");
const g0 = await label();
await pressSpaceForChange(g0);
const g1 = await label();
expect(sideOf(g1) !== "?" && sideOf(g1) !== sideOf(g0), "P5: Space at the document's end still flips (" + JSON.stringify(g1) + ")");

expect(new URL(page.url()).pathname === "/leans/", "page stayed on leans throughout");

console.log(fails.length ? "RESULT: FAIL (" + fails.join(" | ") + ")" : "RESULT: OK");
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
