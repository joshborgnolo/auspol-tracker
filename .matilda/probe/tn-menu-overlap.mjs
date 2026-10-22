// Next-polls strip vs a menu page's tab: open each ☰ menu page by the
// menu + its number key (the user's path, 2026-10-23: refresh, More, 4)
// and check the visible "Next polls" strip never overlaps the tab set.
// Before the fix the strip's fit pass never re-ran when the menu tab's
// label grew to the page name, so it drew over "Preference flows
// explained". Run: node .matilda/probe/tn-menu-overlap.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = process.env.ROOT || fileURLToPath(new URL("../..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  try { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 9241);
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, checks = 0;
for (const w of [900, 1024, 1100, 1180, 1280, 1440]) {
  for (let n = 1; n <= 6; n++) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0" });
    await sleep(600);
    await page.click(".tab-menu");
    await sleep(200);
    await page.keyboard.press(String(n));
    await sleep(900);
    const r = await page.evaluate(() => {
      const tn = document.querySelector(".tab-next");
      const set = document.querySelector(".tabs-set");
      const lab = document.querySelector(".tab-menu");
      if (!tn || !set) return { skip: true };
      const vis = getComputedStyle(tn).visibility !== "hidden" && !tn.classList.contains("tn-none") && tn.getBoundingClientRect().width > 0;
      const tabsRight = Math.max(...[...set.querySelectorAll(".tab")].map((t) => t.getBoundingClientRect().right));
      return { vis, tabsRight, tnLeft: tn.getBoundingClientRect().left, label: lab && lab.textContent.trim() };
    });
    await page.close();
    if (r.skip || !r.vis) { console.log(`ok   ${w}px #${n} strip hidden/absent`); checks++; continue; }
    checks++;
    const gap = r.tnLeft - r.tabsRight;
    const bad = gap < 8;
    if (bad) fails++;
    console.log(`${bad ? "FAIL" : "ok  "} ${w}px #${n} "${r.label}" gap ${gap.toFixed(1)}px`);
  }
}
await browser.close(); server.close();
console.log(`${checks - fails}/${checks} green`);
process.exit(fails ? 1 : 0);
