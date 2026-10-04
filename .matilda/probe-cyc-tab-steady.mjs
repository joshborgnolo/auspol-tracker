import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = process.env.PROBE_ROOT || fileURLToPath(new URL("..", import.meta.url));
const PORT = 9031;
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

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960 });
// Past cycles view toggles hold still on a switch: every tab's box and the
// row's separator keep their x through each Compare and Measure pick.
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [w, h, touch] of [[1440, 960, false], [1024, 800, false], [768, 900, false], [390, 844, true]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch });
  await page.goto(`http://127.0.0.1:${PORT}/index.html#cycles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[aria-label='Compare with'] .rd-tab", { timeout: 20000 });
  await sleep(700);
  const geo = () => page.evaluate(() => [...document.querySelectorAll(".rd-cc-row")].map((row) =>
    [...row.querySelectorAll(".rd-tab, .rd-cc-sep")].map((el) => {
      const r = el.getBoundingClientRect(); return [Math.round(r.left * 100) / 100, Math.round(r.width * 100) / 100];
    })));
  const base = JSON.stringify(await geo());
  const picks = [["Compare with", 1], ["Compare with", 2], ["Measure", 1], ["Compare with", 0], ["Measure", 0]];
  for (const [grp, i] of picks) {
    await page.evaluate((grp, i) => document.querySelectorAll(`[aria-label='${grp}']`)[0].querySelectorAll(".rd-tab")[i].click(), grp, i);
    await sleep(500);
    const now = JSON.stringify(await geo());
    if (now !== base) fails.push(`${w}: ${grp}#${i} moved\n  ${base}\n  ${now}`);
  }
  console.log(w, base);
  await page.close();
}
await browser.close(); server.close();
console.log(fails.length ? "FAIL\n" + fails.join("\n") : "ALL PASS");
process.exit(fails.length ? 1 : 0);
