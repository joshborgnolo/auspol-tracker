import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
const ROOT = "/Users/joshuaborgnolo/auspol tracker";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "text/plain" }); res.end(b); } });
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage();
// emulate the 404 at an arbitrary deep path, like GitHub Pages does
const base = `http://127.0.0.1:${port}`;
let bad = 0;
const fail = (m) => { console.log("FAIL: " + m); bad++; };
for (const w of [320, 390, 641, 700, 1200]) {
  await page.setViewport({ width: w, height: 900 });
  await page.goto(`${base}/404.html`, { waitUntil: "networkidle0", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 200));
  const m = await page.evaluate(() => {
    const h1 = document.querySelector("main h1")?.textContent.trim();
    const tabs = [...document.querySelectorAll(".sh-tabs .sh-tab")].map((t) => t.getAttribute("href"));
    const ways = [...document.querySelectorAll(".ways a")].map((a) => a.textContent.trim());
    const headShell = !!document.querySelector('link[href^="/assets/site-shell.css"]');
    const footer = !!document.querySelector(".sh-foot .sh-lede");
    return { sw: document.documentElement.scrollWidth, h1, tabs, ways, headShell, footer };
  });
  if (m.sw !== w) fail(`w=${w} scrollW=${m.sw}`);
  if (m.h1 !== "Page not found") fail(`w=${w} h1="${m.h1}"`);
  if (w === 320) {
    if (m.tabs.length !== 4 || m.tabs[0] !== "/") fail(`tabs ${JSON.stringify(m.tabs)}`);
    if (!m.headShell) fail("no site-shell.css link");
    if (!m.footer) fail("no shell footer");
    if (!m.ways.includes("Every poll")) fail(`ways ${JSON.stringify(m.ways)}`);
    const links = await page.$$eval("a", (as) => as.filter((a) => /^(?!https?:|\/|#|mailto:)/.test(a.getAttribute("href") || "")).map((a) => a.getAttribute("href")));
    if (links.length) fail(`relative links survive: ${JSON.stringify(links)}`);
  }
}
await browser.close(); srv.close();
console.log(bad ? `${bad} failures` : "PASS: 404 page renders with shell, absolute links, no overflow");
process.exit(bad ? 1 : 0);
