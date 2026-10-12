import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]); }
  catch { res.writeHead(400); res.end("bad uri"); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, p.replace(/^\/+/, ""));
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "text/plain" }); res.end(b); } });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage();
const WIDTHS = [320, 641, 700, 748, 1200, 1440];
const PAGES = ["/preference-flows/", "/prediction/", "/changelog/", "/atlas/", "/feedback/"];
let bad = 0;
for (const pg of PAGES) {
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${port}${pg}`, { waitUntil: "networkidle0", timeout: 45000 });
  const rows = [];
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 900 });
    await new Promise((r) => setTimeout(r, 120));
    const m = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth;
      let mainW = null, mainML = null;
      const el = document.querySelector("main.frame-wrap");
      if (el) { mainW = Math.round(el.getBoundingClientRect().width * 10) / 10; mainML = getComputedStyle(el).marginLeft; }
      return { sw, mainW, mainML };
    });
    if (m.sw !== w) bad++;
    rows.push(`${w}: scrollW=${m.sw}${m.sw !== w ? "  << OVERFLOW" : ""} mainW=${m.mainW} ml=${m.mainML}`);
  }
  console.log(`${pg}\n  ${rows.join("\n  ")}`);
}
await browser.close(); srv.close();
console.log(bad ? `FAIL: ${bad} overflows` : "PASS: no document overflow on any satellite");
process.exit(bad ? 1 : 0);
