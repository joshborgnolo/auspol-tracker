/* Probe: screenshots of the main page and every satellite page – the top and
   the foot, at W (default 1280) – for comparing their chrome. OUT=dir. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const OUT = process.env.OUT || "/tmp", W = +(process.env.W || 1280);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".csv": "text/csv" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(b); });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const pages = (process.env.PAGES || "/,/preference-flows/,/prediction/,/atlas/,/provenance/,/archives/newspoll/,/feedback/").split(",");
for (const u of pages) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: W < 600 ? 844 : 900, deviceScaleFactor: 1, isMobile: W < 600 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  try { await page.goto(base + u, { waitUntil: "networkidle0", timeout: 30000 }); } catch (e) { console.log(u, "load:", e.message); }
  await new Promise((r) => setTimeout(r, 1200));
  const tag = (u.replace(/\//g, "_").replace(/^_|_$/g, "") || "home") + (W < 600 ? "-phone" : "");
  await page.screenshot({ path: path.join(OUT, tag + "-top.png") });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, tag + "-foot.png") });
  const info = await page.evaluate(() => ({ title: document.title, h: document.body.scrollHeight,
    font: getComputedStyle(document.body).fontFamily.slice(0, 60), bg: getComputedStyle(document.body).backgroundColor,
    links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => /^\/|^\.\.|^https:\/\/auspoltracker/.test(h)).slice(0, 12) }));
  console.log(u, JSON.stringify(info));
  await page.close();
}
await browser.close(); server.close();
