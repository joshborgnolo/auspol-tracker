import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const puppeteer = createRequire(process.cwd() + "/package.json")("puppeteer-core");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
let server = null;
const PAGE = process.env.PAGE || await (async () => {
  const { createServer } = await import("node:http");
  const fs = await import("node:fs");
  const { resolve, extname, sep } = await import("node:path");
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = resolve(ROOT, "." + p);
    if (!file.startsWith(resolve(ROOT) + sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader("Content-Type", { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[extname(file)] || "application/octet-stream");
    fs.createReadStream(file).on("error", () => { res.writeHead(404); res.end(); }).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}/dawn/mood/`;
})();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/opt/homebrew/bin/chromium", headless: "new" });
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  for (const width of [1366, 390]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewport({ width, height: 900 });
    await page.goto(PAGE, { waitUntil: "networkidle0", timeout: 60000 });
    for (const id of ["direction", "trust"]) {
      const initial = await page.$eval(`#${id}-svg`, (svg) => ({ events: svg.querySelectorAll(".evr").length, shading: svg.querySelectorAll('rect[fill-opacity=".075"]').length }));
      assert.ok(initial.events > 0, `${id}: the default current-term events still draw at ${width}`);
      for (const range of ["10", "20", "all"]) {
        const count = await page.$$eval(`#${id} button[data-w]`, (els) => els.length);
        const enabled = await page.$$eval(`#${id} button[data-w="${range}"]`, (els) => els.filter((el) => !el.disabled).length);
        assert.ok(count > 0 && enabled, `${id}: ${range} range enabled at ${width}`);
        await page.$$eval(`#${id} button[data-w="${range}"]`, (els) => els[0].click());
        await settle(250);
        const result = await page.$eval(`#${id}-svg`, (svg) => ({
          events: [...svg.querySelectorAll(".evr")].map((line) => ({ top: +line.getAttribute("y1"), bottom: +line.getAttribute("y2") })),
          labels: [...svg.querySelectorAll(".el")].map((el) => el.textContent),
          shading: [...svg.querySelectorAll('rect[fill-opacity=".075"]')].map((el) => ({ top: +el.getAttribute("y"), height: +el.getAttribute("height") })),
          height: svg.getAttribute("height"),
        }));
        assert.ok(result.events.length > 0, `${id}: the ${range} range now has event rules at ${width}`);
        assert.ok(result.events.every((r) => Number.isFinite(r.top) && r.bottom > r.top && r.bottom <= +result.height), `${id}: ${range} event rules are inside the plot, not outside its frame`);
        assert.ok(result.shading.length > 0 && result.shading.every((r) => r.height > 0), `${id}: ${range} keeps the government shading at ${width}`);
        if (width > 1000) assert.ok(result.labels.some((label) => / election$/.test(label)), `${id}: election names are not hidden by government labels on ${range}`);
      }
    }
    assert.deepEqual(errors, [], `no JavaScript errors at ${width}: ${errors.join(" | ")}`);
    await page.close();
  }
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
console.log("PASS: Direction and Trust render election/event rules on 10-, 20-year and all views, preserving government shading and current-term events");
