/* probe: the All polls opened Resolve row carries likeability (appr.alt) as
   its own favourability table beside the performance (approval) one, with
   like-for-like changes. Usage: node ap-resolve-like.mjs OUTDIR [date label] */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = process.env.AP_ROOT || process.cwd();
const OUT = process.argv[2] || ".";
const LABEL = process.argv[3] || "6–10 Oct";
const PORT = 8981;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const VW of [1280, 390]) {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: 1400, deviceScaleFactor: 1, isMobile: VW < 500, hasTouch: VW < 500 });
  await page.goto(`http://127.0.0.1:${PORT}/allpolls/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".rd-ap-tabs", { timeout: 20000 });
  await sleep(600);
  const r = await page.evaluate(async (LABEL) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const tab = [...document.querySelectorAll(".rd-ap-tabs button")].find((b) => /Leader/i.test(b.textContent));
    if (tab) { tab.click(); await sleep(700); }
    const row = [...document.querySelectorAll("[role=row][aria-expanded]")].find((e) => /Resolve/.test(e.textContent) && e.textContent.includes(LABEL));
    if (!row) return { err: "row not found", n: document.querySelectorAll("[role=row][aria-expanded]").length };
    row.scrollIntoView({ block: "start" });
    await sleep(200);
    row.click();
    await sleep(1200);
    const tables = [...document.querySelectorAll(".rd-ldg-ldr")].map((t) => t.innerText.replace(/\t/g, " | "));
    const t0 = document.querySelector(".rd-ldg-ldr");
    if (t0) window.scrollTo(0, window.scrollY + t0.getBoundingClientRect().top - 200);
    const errs = document.querySelectorAll(".rd-err, [data-error]").length;
    return { tables, errs, sw: document.documentElement.scrollWidth, iw: window.innerWidth };
  }, LABEL);
  console.log(VW, JSON.stringify(r, null, 1));
  await sleep(300);
  await page.screenshot({ path: `${OUT}/resolve-like-${VW}.png` });
  await page.close();
}
await browser.close();
server.close();
