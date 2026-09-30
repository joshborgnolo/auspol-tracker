import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8971;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2" };
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
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#who-votes", { timeout: 15000 });

/* click helper: the party chip whose label matches */
const clickChip = (label) => page.evaluate((lab) => {
  const sec = document.querySelector("#who-votes");
  const b = [...sec.querySelectorAll("button")].find((x) => (x.textContent || "").trim().toLowerCase().includes(lab));
  if (b) { b.click(); return true; }
  return false;
}, label);

const readDek = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const sec = document.querySelector("#who-votes");
  const subs = [...sec.querySelectorAll("[class*='rd-sub']")].map((e) => (e.textContent || "").trim()).filter((t) => t.includes("Since "));
  resolve(subs.join("\n---\n"));
}))));

const out = {};
out.alp = (await clickChip("labor")) && await readDek();
out.lnp = (await clickChip("coalition")) && await readDek();
out.oth = (await clickChip("one nation")) && (await clickChip("others")) && await readDek();
console.log(JSON.stringify(out, null, 2));

await browser.close();
server.close();
