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

  for (const section of ["#primary-vote", "#two-party"]) {
    const target = await page.evaluate((section) => {
      const svg = document.querySelector(section + " svg.chart-svg");
      const tickAt = [...svg.querySelectorAll("text")].find(t => t.textContent === "2010").getBoundingClientRect();
      const tickBt = [...svg.querySelectorAll("text")].find(t => t.textContent === "2020").getBoundingClientRect();
      const root = svg.getBoundingClientRect();
      const year = 2001.8575342465754;
      const x = (tickAt.x + tickAt.width / 2 + (tickBt.x + tickBt.width / 2 - tickAt.x - tickAt.width / 2) * ((year - 2010) / 10) - root.x) / root.width;
      let marks = [...svg.querySelectorAll(".rd-ring")].filter(c => Math.abs(c.cx.baseVal.value / svg.viewBox.baseVal.width - x) < .002);
      if (section === "#primary-vote") {
        marks = marks.filter(c => c.outerHTML.includes("--oth"));
        if (marks.length !== 2) throw new Error("expected two 2001 Others count-definition rings, got " + marks.length);
      } else if (marks.length !== 1) throw new Error("expected one 2001 two-party ring, got " + marks.length);
      const ring = section === "#primary-vote"
        ? marks.find((c) => c.parentElement.querySelector(".rd-ring-inclusion")?.style.fill === "var(--onp)")
        : marks[0];
      if (!ring) throw new Error("the election ring is missing");
      if (section === "#primary-vote") {
        const dot = ring.parentElement.querySelector(".rd-ring-inclusion");
        if (dot.cx.baseVal.value !== ring.cx.baseVal.value || dot.cy.baseVal.value !== ring.cy.baseVal.value || dot.r.baseVal.value >= ring.r.baseVal.value) {
          throw new Error("the inclusion dot is not centred inside its ring");
        }
      }
      ring.scrollIntoView({ block: "center", behavior: "instant" });
      const r = ring.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, section);
    await page.mouse.move(target.x, target.y);
    await page.waitForFunction((section) => document.querySelector(section + " .tip.tip-guide")?.textContent.includes("The 2001 election"), { timeout: 5000 }, section);
    const visible = () => page.evaluate((section) => document.querySelector(section + " .tip.tip-guide")?.textContent || "", section);
    const hidden = () => page.evaluate((section) => {
      const tip = document.querySelector(section + " .tip.tip-guide");
      return !tip || getComputedStyle(tip).opacity === "0" || getComputedStyle(tip).display === "none";
    }, section);

    await page.evaluate((section) => {
      const ring = document.querySelector(section + " .rd-ring");
      const event = new MouseEvent("mouseout", { relatedTarget: ring, bubbles: true });
      document.querySelector(section + " svg.chart-svg").dispatchEvent(event);
    }, section);
    await new Promise((r) => setTimeout(r, 400));
    assert.match(await visible(), /The 2001 election/, section + ": an internal SVG mouseout cannot clear the election tooltip");

    const minimumOpacity = await page.evaluate(async (section, target) => {
      const svg = document.querySelector(section + " svg.chart-svg");
      const tip = document.querySelector(section + " .tip.tip-guide");
      const opacities = [];
      const timer = setInterval(() => opacities.push(Number(getComputedStyle(tip).opacity)), 5);
      svg.dispatchEvent(new MouseEvent("mouseout", { relatedTarget: null, bubbles: true, clientX: target.x, clientY: target.y }));
      await new Promise((r) => setTimeout(r, 20));
      svg.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: target.x + 0.25, clientY: target.y }));
      await new Promise((r) => setTimeout(r, 180));
      clearInterval(timer);
      return Math.min(...opacities);
    }, section, target);
    assert(minimumOpacity > 0.99, section + ": a spurious null-target exit followed by internal movement cannot flicker the tooltip (minimum opacity " + minimumOpacity + ")");

    await page.evaluate((section) => {
      const event = new MouseEvent("mouseout", { relatedTarget: document.body, bubbles: true });
      document.querySelector(section + " svg.chart-svg").dispatchEvent(event);
    }, section);
    await new Promise((r) => setTimeout(r, 400));
    assert(await hidden(), section + ": an actual SVG exit still clears the tooltip");

    await page.mouse.move(target.x, target.y);
    await page.waitForFunction((section) => document.querySelector(section + " .tip.tip-guide")?.textContent.includes("The 2001 election"), { timeout: 5000 }, section);
    await page.$eval(section + " svg.chart-svg", (svg) => svg.focus());
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 350));
    assert(await hidden(), section + ": Escape still explicitly dismisses the hover");
    console.log("PASS: " + section + " election hover survives an internal mouseout; root departure and Escape clear it");
  }
  await browser.close();
} finally { server.close(); }
