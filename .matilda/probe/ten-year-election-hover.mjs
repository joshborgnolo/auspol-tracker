import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let server;
if (!process.env.TEN_URL) {
  server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const relative = url === "/" ? "index.html" : url.slice(1);
    fs.readFile(path.join(ROOT, relative), (error, body) => {
      if (error) { res.writeHead(404); res.end(); return; }
      const type = relative.endsWith(".js") ? "text/javascript" : relative.endsWith(".json") ? "application/json" : relative.endsWith(".woff2") ? "font/woff2" : "text/html";
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(response.status() + " " + response.url()); });
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(process.env.TEN_URL || `http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle0", timeout: 45000 });
  await page.waitForSelector("#two-party svg.chart-svg");
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("#two-party button")].find((el) => el.textContent.trim() === "10 yrs");
    if (!button) return false;
    button.click();
    return true;
  });
  assert(clicked, "the 10 yrs control is available");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const point = await page.evaluate(async () => {
    const line = document.querySelector("#two-party .evt-line");
    line.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((resolve) => setTimeout(resolve, 700));
    const rect = line.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  const samples = [];
  for (const [i, dx] of [0, .2, -.2, 0, .2, -.2, 0, .2, -.2, 0, .2, 0].entries()) {
    await page.mouse.move(point.x + dx, point.y);
    await new Promise((resolve) => setTimeout(resolve, i === 0 ? 600 : 100));
    samples.push(await page.evaluate(() => [...document.querySelectorAll("#two-party .tip")].map((tip) => ({
      class: tip.className, text: tip.textContent, opacity: getComputedStyle(tip).opacity,
    }))));
  }
  assert.equal(samples.length, 12);
  for (const sample of samples) {
    assert.equal(sample.length, 1, "the event tooltip must remain mounted");
    assert.match(sample[0].class, /tip-evt/);
    assert.match(sample[0].text, /2019 federal election/);
    assert.equal(sample[0].opacity, "1");
  }
  assert.deepEqual(errors, []);
  console.log("PASS: 2019 election event tooltip stays rendered and readable in 10 yrs view");
} finally {
  await browser.close();
  if (server) server.close();
}
