/* RdNowNav, the Now tab's topic strip (shipped 2026-11-09, replacing the
   rd-snap-nav eyebrow sentence links). Asserts, headlessly and by geometry:
   - strip exists on the Now tab, is sticky, holds one 44px row at every width
     (360, 390, 561..700 head band, 760, 1080, 1280, 1440) with no document
     horizontal overflow;
   - phone rung: sideways scroll only - no vertical slack (the y-wobble trap);
   - a chip click scrolls its section to the top and the scroll-spy's
     aria-current follows; at the page foot the last chip wears it;
   - the old .rd-snap-nav is gone from the DOM. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8963;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
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

let failures = 0;
const expect = (cond, msg, ctx) => {
  if (!cond) { failures++; console.log(`FAIL ${ctx}: ${msg}`); }
};

const measure = () => page.evaluate(() => {
  const nav = document.querySelector(".rd-nownav");
  if (!nav) return { nav: false };
  const n = nav.getBoundingClientRect();
  const cs = getComputedStyle(nav);
  let settableY = null, hEq = null;
  try { nav.scrollTop = 40; settableY = nav.scrollTop; nav.scrollTop = 0; } catch (e) {}
  hEq = nav.scrollHeight === nav.clientHeight;
  return {
    nav: true,
    chips: [...nav.querySelectorAll(".rd-nownav-c")].map((b) => b.textContent),
    current: (nav.querySelector('[aria-current="true"]') || {}).textContent || null,
    top: Math.round(n.top),
    height: Math.round(n.height),
    position: cs.position,
    ovX: cs.overflowX, ovY: cs.overflowY,
    settableY,
    scrollEq: hEq,
    docWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    scrollY: Math.round(window.scrollY),
  };
});

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#two-party", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));

const widths = [[1440, 900], [1280, 900], [1080, 800], [760, 800], [700, 800], [660, 800], [641, 800], [640, 800], [620, 800], [600, 800], [590, 800], [570, 800], [561, 800], [390, 844], [360, 800]];
for (const [w, h] of widths) {
  await page.setViewport({ width: w, height: h });
  await new Promise((r) => setTimeout(r, 300));
  const m = await measure();
  const ctx = `${w}x${h}`;
  expect(m.nav, "strip missing from DOM", ctx);
  if (!m.nav) { console.log(JSON.stringify(m)); continue; }
  expect(m.position === "sticky", `position ${m.position} (want sticky)`, ctx);
  expect(m.docWidth <= m.innerWidth, `document overflows horizontally (${m.docWidth} > ${m.innerWidth})`, ctx);
  expect(m.height <= 46, `strip is ${m.height}px tall (a second row formed)`, ctx);
  expect(m.chips.length === 8 && m.chips.join() === "Vote,Latest polls,Leaders,Mood,Voters,Issues,Decided,Economy", `chips ${JSON.stringify(m.chips)}`, ctx);
  expect(m.scrollEq, `vertical slack: scrollHeight != clientHeight`, ctx);
  expect(m.settableY === 0, `scrollTop took ${m.settableY} (vertical wobble)`, ctx);
}

/* phone rung: the strip sticks to the top once scrolled */
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 250));
await page.evaluate(() => window.scrollTo(0, 3000));
await new Promise((r) => setTimeout(r, 300));
{
  const m = await measure();
  expect(m.top === 0, `not stuck: strip top ${m.top} after scrolling (want 0)`, "phone390 stuck");
  console.log("phone390 stuck:", JSON.stringify({ top: m.top, current: m.current }));
}

/* a chip click scrolls its section up and the spy follows */
await page.setViewport({ width: 1280, height: 900 });
await new Promise((r) => setTimeout(r, 250));
await page.evaluate(() => window.scrollTo(0, 0));
const jump = await page.evaluate(() => new Promise((res) => {
  const b = [...document.querySelectorAll(".rd-nownav-c")].find((x) => x.textContent === "Issues");
  if (!b) return res({ jump: "no Issues chip" });
  b.click();
  setTimeout(() => {
    const el = document.getElementById("issues");
    const cur = (document.querySelector('.rd-nownav-c[aria-current="true"]') || {}).textContent || null;
    res({ scrollY: Math.round(window.scrollY), issuesTop: el ? Math.round(el.getBoundingClientRect().top) : null, cur });
  }, 1800);
}));
expect(jump.scrollY > 100, `Issues click did not scroll (scrollY ${jump.scrollY})`, "click");
expect(jump.issuesTop != null && jump.issuesTop <= 70, `#issues landed at top ${jump.issuesTop} (want <=70px, the strip + scroll-margin)`, "click");
expect(jump.cur === "Issues", `spy current ${jump.cur} after clicking Issues`, "click");
console.log("click issues:", JSON.stringify(jump));

/* the foot of the page: the last chip wears the current mark */
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await new Promise((r) => setTimeout(r, 400));
{
  const m = await measure();
  expect(m.current === "Economy", `at the foot, current chip is ${m.current} (want Economy)`, "foot");
  console.log("foot:", JSON.stringify({ current: m.current, scrollY: m.scrollY }));
}

/* the retired sentence-nav stayed retired */
{
  const old = await page.evaluate(() => !!document.querySelector(".rd-snap-nav"));
  expect(!old, ".rd-snap-nav is still in the DOM", "retired");
  const oldCss = await page.evaluate(() => {
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules || []) if (r.selectorText && r.selectorText.includes("rd-snap-nav")) return true;
    }
    return false;
  });
  expect(!oldCss, "an rd-snap-nav rule survived in the built CSS", "retired-css");
}

/* doesn't leak onto another tab */
await page.goto(`http://127.0.0.1:${PORT}/allpolls/index.html`, { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 1800));
{
  const leaked = await page.evaluate(() => !!document.querySelector(".rd-nownav"));
  expect(!leaked, "strip rendered on the All polls tab", "other-tab");
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CHECKS PASSED");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
