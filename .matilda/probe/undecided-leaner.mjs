import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname } from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const MIME = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "text/html" });
    res.end(await readFile(`.${p}`));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const pageErrors = [];

try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.waitForSelector("#undecided .rd-un-panel", { timeout: 45000 });
  const views = await page.evaluate(() => [...document.querySelectorAll("#undecided .rd-un-panel")].map((panel) => ({
    title: panel.querySelector(".rd-un-rtop b")?.textContent,
    body: panel.innerText,
    rows: [...panel.querySelectorAll(".rd-un-read")].map((row) => ({
      label: row.querySelector(".rd-un-rtop b")?.textContent,
      value: row.querySelector(".rd-un-rv")?.textContent,
      margin: row.querySelector(".rd-un-rci")?.textContent || null,
      note: row.querySelector("p")?.textContent,
    })),
  })));
  const file = (await readdir(".build/newtracker/assets")).find((f) => f.startsWith("9f09dca2-"));
  const w = {};
  new Function("window", await readFile(`.build/newtracker/assets/${file}`, "utf8"))(w);
  const main = views.find((v) => v.rows.some((r) => r.label === "First preference"));
  const lean = main.rows.find((r) => r.label === "After leaner");
  const footerText = await page.evaluate(() => document.getElementById("undecided").textContent);
  assert.ok(lean, "the after-leaner row renders in the undecided chart");
  const data = w.AUSPOL.undecided.series.find((s) => s.id === "leaner");
  const first = w.AUSPOL.undecided.series.find((s) => s.id === "first");
  const current = data.now || data.latest;
  assert.equal(lean.value, current.v.toFixed(1) + "%");
  assert.equal(lean.margin, "±" + (data.now ? data.now.ci95.toFixed(1) : ""));
  assert.match(lean.note, /Still undecided after the leaner, excluded from the published voting figures/);
  assert.match(lean.note, /Newspoll/);
  assert.match(lean.note, /RedBridge/);
  const existing = main.rows.find((r) => r.label === "First preference");
  assert.equal(existing.value, (first.now || first.latest).v.toFixed(1) + "%", "the original first-preference reading stays intact");
  assert.match(footerText, /None of the four has changed significantly on the previous period:[\s\S]*after leaner/);
  assert.deepEqual(pageErrors, [], "the chart renders without JavaScript errors");
  console.log(`PASS: after leaner chart ${lean.value} ${lean.margin}, separate sources, period changes and intact first-preference reading`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
