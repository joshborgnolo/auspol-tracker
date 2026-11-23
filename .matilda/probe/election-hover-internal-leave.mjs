import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const server = http.createServer((req, res) => {
  let name = decodeURIComponent(req.url.split("?")[0]);
  if (name.endsWith("/")) name += "index.html";
  fs.readFile(path.join(ROOT, name), (error, body) => {
    if (error) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": name.endsWith(".js") ? "text/javascript" : name.endsWith(".json") ? "application/json" : "text/html" });
    res.end(body);
  });
});
await new Promise((resolve) => server.listen(0, resolve));
try {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
    for (const b of document.querySelectorAll("button")) if (b.textContent.trim() === "All") b.click();
    await new Promise((r) => setTimeout(r, 650));
  });
  const target = await page.evaluate(() => {
    const svg = document.querySelector("#primary-vote svg.chart-svg");
    const tickAt = [...svg.querySelectorAll("text")].find(t => t.textContent === "2010").getBoundingClientRect();
    const tickBt = [...svg.querySelectorAll("text")].find(t => t.textContent === "2020").getBoundingClientRect();
    const root = svg.getBoundingClientRect();
    const year = 2001.8575342465754;
    const x = (tickAt.x + tickAt.width / 2 + (tickBt.x + tickBt.width / 2 - tickAt.x - tickAt.width / 2) * ((year - 2010) / 10) - root.x) / root.width;
    const marks = [...svg.querySelectorAll(".rd-ring")].filter(c => c.outerHTML.includes("--oth") && Math.abs(c.cx.baseVal.value / svg.viewBox.baseVal.width - x) < .002);
    if (marks.length !== 2) throw new Error("expected two 2001 Others count-definition rings, got " + marks.length);
    const ring = marks.find((c) => c.parentElement.querySelector(".rd-ring-inclusion")?.style.fill === "var(--onp)");
    if (!ring) throw new Error("the One-Nation-inclusive ring is missing its orange centre");
    const dot = ring.parentElement.querySelector(".rd-ring-inclusion");
    if (dot.cx.baseVal.value !== ring.cx.baseVal.value || dot.cy.baseVal.value !== ring.cy.baseVal.value || dot.r.baseVal.value >= ring.r.baseVal.value) {
      throw new Error("the inclusion dot is not centred inside its ring");
    }
    ring.scrollIntoView({ block: "center", behavior: "instant" });
    const r = ring.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(target.x, target.y);
  await page.waitForFunction(() => document.querySelector(".tip.tip-guide")?.textContent.includes("The 2001 election"), { timeout: 5000 });
  const visible = () => page.evaluate(() => document.querySelector(".tip.tip-guide")?.textContent || "");
  const overflow = (css) => page.evaluate((css) => {
    const tip = document.querySelector(".tip.tip-guide");
    return !tip || getComputedStyle(tip).opacity === "0" || getComputedStyle(tip).display === "none";
  });

  await page.evaluate(() => {
    const ring = [...document.querySelectorAll("#primary-vote .rd-ring")].find((c) => c.outerHTML.includes("--oth"));
    const event = new MouseEvent("mouseout", { relatedTarget: ring, bubbles: true });
    document.querySelector("#primary-vote svg.chart-svg").dispatchEvent(event);
  });
  await new Promise((r) => setTimeout(r, 400));
  assert.match(await visible(), /The 2001 election/, "an internal SVG mouseout cannot clear the election tooltip");

  await page.evaluate(() => {
    const event = new MouseEvent("mouseout", { relatedTarget: document.body, bubbles: true });
    document.querySelector("#primary-vote svg.chart-svg").dispatchEvent(event);
  });
  await new Promise((r) => setTimeout(r, 400));
  assert(await overflow(), "an actual SVG exit still clears the tooltip");

  await page.mouse.move(target.x, target.y);
  await page.waitForFunction(() => document.querySelector(".tip.tip-guide")?.textContent.includes("The 2001 election"), { timeout: 5000 });
  await page.$eval("#primary-vote svg.chart-svg", (svg) => svg.focus());
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 350));
  assert(await overflow(), "Escape still explicitly dismisses the hover");
  console.log("PASS: both 2001 rings remain with the inclusion dot; internal SVG mouseout preserves hover, root departure and Escape clear it");
  await browser.close();
} finally { server.close(); }
