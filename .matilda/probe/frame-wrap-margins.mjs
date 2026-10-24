/* frame-wrap-margins.mjs — why does main.frame-wrap stick 4-7px past the
   viewport right edge on archive pages at 641-700px? */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".csv": "text/csv" };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "text/plain" }); res.end(b); } });
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const d of ["/provenance/", "/archives/trove/"]) for (const w of [620, 636, 640, 641, 660, 700, 760, 900]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 800 });
  await page.goto(`http://127.0.0.1:${port}${d}`, { waitUntil: "networkidle0", timeout: 45000 }).catch(() => {});
  await page.waitForSelector("main.frame-wrap", { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 900));
  const o = await page.evaluate(() => {
    const mains = [...document.querySelectorAll("main")].map((x) => x.className || "(none)");
    const m = document.querySelector("main.frame-wrap");
    if (!m) return { sw: document.documentElement.scrollWidth, mains, noFrame: true };
    const cs = getComputedStyle(m);
    const root = getComputedStyle(document.documentElement);
    return {
      sw: document.documentElement.scrollWidth,
      l: Math.round(m.getBoundingClientRect().left),
      ml: cs.marginLeft, mr: cs.marginRight, pl: cs.paddingLeft, pr: cs.paddingRight,
      gutter: root.getPropertyValue("--sh-gutter"), maxw: root.getPropertyValue("--sh-maxw"),
    };
  });
  console.log(d, w, JSON.stringify(o));
  await page.close();
}
await browser.close();
srv.close();
process.exit(0);
