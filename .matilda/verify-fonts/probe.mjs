/* One-shot font pipeline verification for the Merriweather / Plus Jakarta Sans
   swap. Negative oracle is the server-side woff2 request log, not
   fonts.check (which passes on fallback). */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require_ = createRequire(path.join(os.homedir(), "node_modules", "."));
const puppeteer = require_("puppeteer-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const fontReqs = [];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  if (rel.endsWith(".woff2")) fontReqs.push(rel);
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(8711, "127.0.0.1", ok));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  defaultViewport: { width: 1400, height: 1000 } });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.goto("http://127.0.0.1:8711/", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction("!!(window.AUSPOL && window.AUSPOL.latest)", { timeout: 60000 });
  await page.waitForSelector(".tagline", { timeout: 30000 });
  await page.evaluate("document.fonts.ready.then(() => 0)");

  // Force-load every shipped face, including non-preloaded italic
  await page.evaluate(`Promise.all([
    document.fonts.load('400 16px "Merriweather"'),
    document.fonts.load('700 16px "Merriweather"'),
    document.fonts.load('italic 400 16px "Merriweather"'),
    document.fonts.load('400 16px "Plus Jakarta Sans"'),
    document.fonts.load('600 16px "Plus Jakarta Sans"'),
    document.fonts.load('700 16px "Plus Jakarta Sans"'),
    document.fonts.load('400 30px "Source Sans 3"'),
    document.fonts.load('600 15px "Crimson Pro"'),
  ]).then(() => 0)`);
  await page.evaluate("document.fonts.ready.then(() => 0)");

  const checks = await page.evaluate(`({
    serif400: document.fonts.check('400 60px "Merriweather"'),
    serif700: document.fonts.check('700 60px "Merriweather"'),
    serifItalic: document.fonts.check('italic 400 60px "Merriweather"'),
    sans400:  document.fonts.check('400 60px "Plus Jakarta Sans"'),
    sans600:  document.fonts.check('600 60px "Plus Jakarta Sans"'),
    sans700:  document.fonts.check('700 60px "Plus Jakarta Sans"'),
    ss3:      document.fonts.check('400 30px "Source Sans 3"'),
    crimson:  document.fonts.check('600 15px "Crimson Pro"'),
    old_serif_gone: !document.fonts.check('400 60px "Source Serif 4"'),
    old_sans_gone: !document.fonts.check('400 60px "IBM Plex Sans"'),
  })`);
  console.log("font checks:", JSON.stringify(checks));

  // Open the archive tab ("All polls") so the poll table renders rows
  await page.evaluate(`
    ([...document.querySelectorAll('button, a')].find((el) =>
      /all polls/i.test(el.textContent)) || {}).click?.()`);
  await page.waitForSelector("tr.arch-row", { timeout: 30000 });
  await page.evaluate(`document.querySelector('tr.arch-row').click()`);
  await page.waitForSelector(".poll-detail", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 400));

  const computed = await page.evaluate(`
    (() => {
      const pick = (el) => el ? getComputedStyle(el).fontFamily : "(not found)";
      const b = document.querySelector(".poll-detail .pd-w b")
        || document.querySelector(".poll-detail b");
      const wm = document.querySelector(".wm-name") || document.querySelector(".wordmark");
      const tab = document.querySelector(".tab-label");
      return {
        body: getComputedStyle(document.body).fontFamily,
        ledgerB: pick(b),
        wordmark: pick(wm),
        tabLabel: pick(tab),
        tagline: pick(document.querySelector(".tagline")),
        taglineStyle: getComputedStyle(document.querySelector(".tagline")).fontStyle,
      };
    })()`);
  console.log("computed:", JSON.stringify(computed, null, 1));
  console.log("woff2 requests:", JSON.stringify(fontReqs));
} finally {
  await browser.close();
  server.close();
}
