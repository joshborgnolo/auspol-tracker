/* pinning probe: the All-polls redesign search field must render at 16px
   under pointer:coarse (iOS zooms a focused sub-16px field and never zooms
   back) and 14px on a fine pointer. Pins the rd.css pointer:coarse block
   alongside template.html's classic .ap-search guard. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8973;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml" };
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
  args: ["--no-sandbox"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, got, want) => {
  const ok = got === want;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: got ${got}, want ${want}`);
  if (!ok) failed++;
};

async function measure(mobile) {
  const page = await browser.newPage();
  await page.setViewport(mobile
    ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:${PORT}/allpolls/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".rd-ap-search input", { timeout: 20000 });
  await sleep(600);
  return page.evaluate(() => ({
    fontSize: getComputedStyle(document.querySelector(".rd-ap-search input")).fontSize,
    coarse: matchMedia("(pointer: coarse)").matches,
  })).then(async (r) => { await page.close(); return r; });
}

const touch = await measure(true);
const desk = await measure(false);

check("touch emulates pointer:coarse", String(touch.coarse), "true");
check("rd-ap-search input font on touch", touch.fontSize, "16px");
check("fine pointer is not coarse", String(desk.coarse), "false");
check("rd-ap-search input font on desktop", desk.fontSize, "14px");

await browser.close();
server.close();
console.log(failed ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(failed ? 1 : 0);
