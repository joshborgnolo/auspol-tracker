/* vic-overflow-641.mjs — find the element(s) causing horizontal overflow on
   vic pages at width 641 (federal pages are clean at the same width). */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || "/").split("?")[0]); }
  catch { res.writeHead(400); return res.end("bad uri"); }
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, p.replace(/^\/+/, ""));
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("forbidden"); }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "text/plain" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

let fails = 0;
for (const width of [641, 660, 700, 768]) {
  const pg = await browser.newPage();
  await pg.setViewport({ width, height: 900 });
  await pg.goto(`http://127.0.0.1:${port}/vic/`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 600));
  const out = await pg.evaluate((w) => {
    const bad = [];
    const doc = document.documentElement;
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > doc.scrollWidth - 1 || r.right > w + 1) && r.left >= -1) {
        const cs = getComputedStyle(el);
        bad.push({
          tag: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").join(".") : ""),
          left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
          text: (el.childNodes.length && el.children.length === 0) ? (el.textContent || "").slice(0, 60) : "",
        });
      }
    }
    return { scrollW: doc.scrollWidth, bad: bad.slice(0, 12) };
  }, width);
  if (out.scrollW !== width) fails++;
  console.log(`\nw=${width} scrollW=${out.scrollW}${out.scrollW !== width ? "  << OVERFLOW" : ""}`);
  for (const b of out.bad) console.log(" ", JSON.stringify(b));
  await pg.close();
}
await browser.close();
server.close();
console.log(fails ? `FAIL: document overflow at ${fails} width(s)` : "PASS: vic pages – no document overflow at 641–768");
process.exit(fails ? 1 : 0);
