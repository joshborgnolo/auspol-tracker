/* Prove the causal chain for the tide flash: the boot script applies
   body.js (summary invisible + #root pulled up by --ss-h) and THEN renders
   React asynchronously. In the gap, #root is empty so the document
   collapses to ~the 400px tile band, and the html canvas — whose tide art
   repeats on both axes — is exposed over the rest of the viewport.
   Reproduce that exact state deterministically: load the page, empty
   #root (as it is before React commits), and check (a) document height
   collapses, (b) tide-slate pixels cover the lower viewport. */
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
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8741/", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".poll-table", { timeout: 30000 });

  const before = await page.evaluate(`document.documentElement.scrollHeight`);
  await page.evaluate(`window.scrollTo(0, 0); document.getElementById("root").replaceChildren();`);
  await new Promise((r) => setTimeout(r, 200));
  const after = await page.evaluate(`({
    docH: document.documentElement.scrollHeight,
    bandTop: document.querySelector(".tile-band").getBoundingClientRect().top,
  })`);
  console.log(`scrollHeight: mounted=${before}  root-emptied=${after.docH}  band top=${Math.round(after.bandTop)}`);

  // screenshot at scroll 0 and count tide-slate pixels in the viewport's lower half
  const shot = await page.screenshot({ encoding: "base64" });
  const result = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = dataUrl; });
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    const slate = (r, g, b) => Math.abs(r - 102) < 30 && Math.abs(g - 119) < 30 && Math.abs(b - 155) < 30;
    let lower = 0, lowerN = 0, upper = 0, upperN = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x += 2) {
      const i = (y * cv.width + x) * 4;
      if (y > cv.height / 2) { lowerN++; if (slate(d[i], d[i+1], d[i+2])) lower++; }
      else { upperN++; if (slate(d[i], d[i+1], d[i+2])) upper++; }
    }
    return { lowerPct: 100 * lower / lowerN, upperPct: 100 * upper / upperN };
  }, "data:image/png;base64," + shot);
  console.log(`tide-slate pixel share — upper half: ${result.upperPct.toFixed(2)}%  lower half: ${result.lowerPct.toFixed(2)}%`);
  console.log(after.docH < 800 && result.lowerPct > 1
    ? "CONFIRMED: empty-#root window collapses the document and the tide art surfaces in the exposed viewport"
    : "not confirmed — geometry does not expose the canvas art");
} finally {
  await browser.close();
  server.close();
}
