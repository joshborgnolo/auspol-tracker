/* follow-up to cyc-chip-realclick (which proved the chip wins its hit
   test when centred): sweep every scroll offset where the chip is
   on-screen, and at each ask elementFromPoint(chip centre) who owns
   the pixel. Goal: find a scroll window where something parked above
   the chip eats the laptop click (rdPinScroll glide, sticky header,
   etc.) while the phone rung stays clean. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9012;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
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

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, detail) => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : "")); if (!ok) fails.push(name); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function run(W, H, touch) {
  const tag = W + "px" + (touch ? "-touch" : "");
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, hasTouch: touch });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/cycles/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[aria-label="Compare with"]', { timeout: 20000 });
  await sleep(900);

  /* chip's document position */
  const geo = await page.evaluate(() => {
    const chip = document.querySelector("#cyc-tpp .rd-cyc-chipmove .rd-chip");
    const r = chip.getBoundingClientRect();
    const y = r.top + window.scrollY;
    return { docX: r.left + r.width / 2, docY: y + r.height / 2 };
  });

  /* sweep scrollY across the full on-screen window of the chip. The one
     legitimate blind window: while the chip scrolls under the pinned top
     tab bar, the bar owns the chip's pixel (the reader can't click what
     they can't see - measured live per offset, never hardcoded). Blind
     offsets below the bar are the failures that would eat a real click. */
  const blind = [];
  const covered = [];
  const maxY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const first = Math.max(0, Math.floor(geo.docY - H) - 40);
  const last = Math.min(maxY, Math.ceil(geo.docY) + 40);
  for (let y = first; y <= last; y += 40) {
    const hit = await page.evaluate((yy, gx, gy) => new Promise((res) => {
      window.scrollTo(0, yy);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const vy = gy - window.scrollY;
        if (vy < 0 || vy > window.innerHeight) { res(null); return; }
        const el = document.elementFromPoint(gx, vy);
        const tabs = document.querySelector(".tabs");
        res({ y: yy, vy: Math.round(vy),
              tabsB: tabs ? Math.round(tabs.getBoundingClientRect().bottom) : 0,
              top: el ? String(el.className || el.tagName).slice(0, 80) : "(none)",
              isChip: !!(el && el.closest && el.closest("#cyc-tpp .rd-cyc-chipmove .rd-chip")) });
      }));
    }), y, geo.docX, geo.docY);
    if (!hit) continue;
    if (hit.isChip) continue;
    if (hit.vy < hit.tabsB) covered.push(hit); else blind.push(hit);
  }
  console.log(`  [${tag}] swept scrollY ${first}..${last}; blind below the tab bar: ${blind.length}; covered by pinned tabs (chip not clickable anyway): ${covered.length}`);
  blind.slice(0, 12).forEach((b) => console.log(`    scrollY=${b.y} chipVy=${b.vy} top="${b.top}"`));
  check(`[${tag}] chip wins the hit test at every clickable scroll offset`, blind.length === 0,
    blind.length ? `${blind.length} blind offsets, e.g. ${JSON.stringify(blind[0])}` : "clean");

  check(`[${tag}] no page errors`, pageErrors.length === 0, pageErrors[0] || "");
  await page.close();
}

try {
  await run(1440, 960, false);
  await run(390, 844, true);
} finally { await browser.close(); server.close(); }
console.log(fails.length === 0 ? "ALL GREEN" : `${fails.length} FAILURES`);
process.exit(fails.length === 0 ? 0 : 1);
