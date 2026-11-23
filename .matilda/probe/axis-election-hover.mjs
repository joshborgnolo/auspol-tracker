import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OLD_ENGINE = process.env.AXIS_BASELINE ? execFileSync("git", ["show", "HEAD:assets/js/08b413e7-8dbe-49bf-8932-a479f8d98f54.91e68b09.js"], { cwd: ROOT }) : null;
const server = http.createServer((req, res) => {
  let name = decodeURIComponent(req.url.split("?")[0]);
  if (name === "/") name = process.env.AXIS_PREVIEW_FILE || "/axis-preview.html";
  fs.readFile(path.join(ROOT, name), (error, body) => {
    if (error) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": name.endsWith(".js") ? "text/javascript" : name.endsWith(".json") ? "application/json" : "text/html" });
    res.end(OLD_ENGINE && name.endsWith(".91e68b09.js") ? OLD_ENGINE : body);
  });
});
await new Promise((resolve) => server.listen(0, resolve));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle0", timeout: 45000 });
  await page.waitForFunction(() => [...document.querySelectorAll("#two-party svg.chart-svg text")].some((el) => el.textContent === "Election"));
  const point = await page.evaluate(async () => {
    const label = [...document.querySelectorAll("#two-party svg.chart-svg text")].find((el) => el.textContent === "Election");
    label.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((resolve) => setTimeout(resolve, 700));
    const rect = label.getBoundingClientRect();
    window.__axisLabel = label;
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await page.mouse.move(point.x, point.y);
  await page.waitForFunction(() => document.querySelector("#two-party .tip.tip-guide")?.textContent.includes("The election result"));
  const attribute = await page.$eval("#two-party svg.chart-svg text.axis-label.x.strong", (el) => el.getAttribute("data-spine-x"));
  if (!process.env.AXIS_BASELINE) assert(attribute?.startsWith("2025."), "the Election axis label carries its election stop");

  await page.evaluate(({ x, y }) => {
    document.querySelector("#two-party svg.chart-svg").dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: null, clientX: x, clientY: y }));
  }, point);
  await new Promise((resolve) => setTimeout(resolve, 450));
  const held = await page.evaluate(() => {
    const tip = document.querySelector("#two-party .tip.tip-guide");
    return { title: tip?.textContent || "", opacity: tip && getComputedStyle(tip).opacity };
  });
  assert.match(held.title, /The election result/, "an internal null-target leave cannot dismiss the axis tooltip");
  assert.equal(held.opacity, "1", "the axis tooltip must remain visible after the internal leave");
  assert.deepEqual(errors, []);

  await page.evaluate(() => document.querySelector("#two-party svg.chart-svg").dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body, clientX: 0, clientY: 0 })));
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert(await page.evaluate(() => { const tip = document.querySelector("#two-party .tip.tip-guide"); return !tip || getComputedStyle(tip).opacity === "0"; }), "a genuine outside exit still dismisses the tooltip");
  console.log("PASS: axis-label hover holds its election and survives an internal null-target leave; genuine exit still dismisses");
} finally {
  await browser.close();
  server.close();
}
