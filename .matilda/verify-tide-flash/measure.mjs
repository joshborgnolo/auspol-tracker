/* Measure the pre-React document: how tall is the page with JS disabled
   (static summary + tile band only), and at what point during a real load
   is the body shorter than the viewport? If the pre-app document is
   shorter than a laptop viewport, the html canvas (which tiles the tide
   art on both axes) fills the rest of the screen with wave art until React
   mounts — matching the user's "line art all over the screen on refresh". */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require_ = createRequire(path.join(os.homedir(), "node_modules", "."));
const puppeteer = require_("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(8741, "127.0.0.1", ok));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  defaultViewport: { width: 1280, height: 800 } });
try {
  // (a) JS off: the document's static height at laptop viewport sizes
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  for (const h of [700, 800, 900, 1000, 1100]) {
    await page.setViewport({ width: 1280, height: h });
    await page.goto("http://127.0.0.1:8741/", { waitUntil: "networkidle0", timeout: 60000 });
    const m = await page.evaluate(`({
      docH: document.documentElement.scrollHeight,
      bodyH: document.body.getBoundingClientRect().height,
      bandTop: document.querySelector(".tile-band").getBoundingClientRect().top,
      innerH: innerHeight,
    })`);
    console.log(`viewport 1280x${h}: doc=${m.docH} body=${Math.round(m.bodyH)} bandTop=${Math.round(m.bandTop)}` +
      (m.docH < m.innerH ? "  <-- DOCUMENT SHORTER THAN VIEWPORT: tide-lined canvas fills the rest" : ""));
  }
  await page.close();

  // (b) real load with JS on: sample document height + body height over time
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1280, height: 900 });
  const samples = [];
  const t0 = Date.now();
  let done = false;
  p2.goto("http://127.0.0.1:8741/", { waitUntil: "networkidle0", timeout: 60000 })
    .then(() => { done = true; }).catch(() => { done = true; });
  while (Date.now() - t0 < 12000 && !done) {
    try {
      const m = await p2.evaluate(`({
        docH: document.documentElement.scrollHeight,
        bodyH: document.body ? Math.round(document.body.getBoundingClientRect().height) : -1,
        rootKids: document.getElementById("root") ? document.getElementById("root").childElementCount : -1,
        ssH: getComputedStyle(document.body).getPropertyValue("--ss-h"),
      })`);
      samples.push({ t: Date.now() - t0, ...m });
    } catch (e) { /* navigation/context churn */ }
    await new Promise((r) => setTimeout(r, 50));
  }
  console.log("\nload timeline (ms, docH/bodyH, root children, --ss-h):");
  for (const s of samples) console.log(`  ${String(s.t).padStart(5)}  doc=${s.docH} body=${s.bodyH} rootKids=${s.rootKids} ss-h=${(s.ssH || "").trim() || "(unset)"}`);
} finally {
  await browser.close();
  server.close();
}
