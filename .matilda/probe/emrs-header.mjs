import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" }[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1280, height: 1000 });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.AP?.openPoll && window.AUSPOL?.individualPolls?.length, { timeout: 30000 });
const wave = await page.evaluate(() => {
  const p = window.AUSPOL.individualPolls.filter((p) => p.pollster === "EMRS (Tas)" && p.sample === 978).at(-1);
  if (!p) return null;
  window.AP.openPoll(window.AP.pollRowKey(p));
  return { house: p.pollster, date: p.released, field: p.field, sample: p.sample };
});
await page.waitForFunction(() => [...document.querySelectorAll(".rd-ldg-sent")].some((el) => el.textContent.includes("Tasmanian sample")), { timeout: 15000 });
const header = await page.evaluate(() => [...document.querySelectorAll(".rd-ldg-sent")].find((el) => el.textContent.includes("Tasmanian sample"))?.textContent.replace(/\s+/g, " ").trim() || null);
const expected = "Conducted on 11–12 Nov from a Tasmanian sample of 978 (eff. ~610), published by EMRS on Sat 21 Nov";
console.log(JSON.stringify({ wave, header, errors }, null, 2));
assert.equal(header, expected, "EMRS header uses the Tasmanian sample wording and short house name");
assert.deepEqual(errors, [], "No page errors while opening the EMRS wave");
await browser.close(); server.close();
console.log("EMRS header: exact sentence passed");
