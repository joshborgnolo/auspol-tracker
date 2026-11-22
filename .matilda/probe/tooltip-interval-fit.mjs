import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const server = http.createServer((req, res) => {
  let filename = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (filename.endsWith("/")) filename += "index.html";
  const ext = path.extname(filename);
  fs.readFile(path.join(ROOT, filename), (err, body) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": { ".js": "text/javascript", ".json": "application/json", ".css": "text/css" }[ext] || "text/html" });
    res.end(body);
  });
});
await new Promise((resolve) => server.listen(0, resolve));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const url = `http://127.0.0.1:${server.address().port}/`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function chartPage(width) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  page.setDefaultTimeout(5000);
  await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 20)); }
    window.scrollTo(0, 0);
  });
  await wait(500);
  return page;
}

async function inspect(page) {
  return page.evaluate(() => {
    const tip = document.querySelector(".tip.tip-guide");
    if (!tip || +getComputedStyle(tip).opacity === 0) return null;
    const tipBox = tip.getBoundingClientRect();
    const rows = [...tip.querySelectorAll(".tip-row")].map((el) => ({
      label: el.querySelector(".tip-label")?.textContent || "",
      ci: el.querySelector(".tip-ci")?.textContent || null,
      fallback: /^95% intervals?$/.test(el.querySelector(".tip-label")?.textContent || "") ? el.querySelector(".tip-val").textContent : null,
      ciTop: el.querySelector(".tip-ci")?.getBoundingClientRect().top ?? null,
      valueTop: el.querySelector(".tip-val")?.getBoundingClientRect().top ?? null,
    }));
    return { title: tip.querySelector(".tip-title")?.textContent, rows, left: tipBox.left, right: tipBox.right,
      naturalWidth: tip.scrollWidth, clientWidth: tip.clientWidth,
      sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth };
  });
}

async function findGuide(page, mode) {
  let logged = false;
  const svgs = await page.$$("svg");
  for (const svg of svgs) {
    const box = await svg.boundingBox();
    if (!box || box.width < 140 || box.height < 55) continue;
    for (const fraction of [0.77, 0.62, 0.42, 0.91, 0.27]) {
      await svg.scrollIntoView();
      await wait(80);
      const rect = await svg.boundingBox();
      await page.mouse.move(rect.x + rect.width * fraction, rect.y + Math.min(rect.height - 8, rect.height * 0.55));
      await wait(230);
      const found = await inspect(page);
      if (mode === "fallback" && !logged && found) { console.log("narrow diagnostic", JSON.stringify(found)); logged = true; }
      const inline = (found?.rows || []).filter((r) => r.ci);
      const fallbackLen = (found?.rows || []).filter((r) => r.fallback).length;
      if (mode === "inline" && inline.length >= 2) return found;
      if (mode === "single" && inline.length === 1 && fallbackLen === 0) return found;
      if (mode === "fallback" && fallbackLen === 1 && inline.length === 0) return found;
    }
  }
  throw new Error(`no ${mode} interval tooltip found`);
}

function namedInline(rows) {
  return rows.filter((r) => r.ci).map((r) => `${r.label} ${r.ci}`).sort();
}

try {
  const wide = await chartPage(1280);
  const initial = await findGuide(wide, "inline");
  assert(initial.rows.every((r) => !r.fallback), "wide: no grouped fallback is needed");
  assert(initial.rows.every((r) => r.ci == null || Math.abs(r.ciTop - r.valueTop) < 1), "wide: each interval shares the value's own line");
  assert(initial.right >= 0 && initial.right <= 1280 && initial.sw <= 1280, "wide: tooltip and page stay in bounds");

  await wide.setViewport({ width: 390, height: 900 });
  await wide.evaluate(() => window.scrollTo(0, 0));
  await wait(350);
  const small = await findGuide(wide, "fallback");
  assert.equal(small.right <= 390 && small.left >= 0 && small.sw <= 390, true, "narrow: fallback keeps its figures on screen");
  console.log("narrow fallback", JSON.stringify(small, null, 2));
  assert(small.rows.filter((r) => r.fallback).every((r) => !r.fallback.startsWith("±")), "narrow: grouped values name their owners");

  await wide.setViewport({ width: 1280, height: 900 });
  await wide.evaluate(() => window.scrollTo(0, 0));
  await wait(350);
  const restored = await findGuide(wide, "inline");
  const before = namedInline(initial.rows), after = namedInline(restored.rows);
  assert(after.every((item) => before.includes(item)), "resizing back retains the same parties and their own intervals");
  console.log(JSON.stringify({ wide: initial.rows, narrow: small.rows, restored: restored.rows }, null, 2));
  await wide.close();

  const phone = await chartPage(240);
  const baseWidth = await phone.evaluate(() => document.documentElement.scrollWidth);
  const fallback = await findGuide(phone, "fallback");
  const named = fallback.rows.filter((r) => r.fallback);
  assert(named.length === 1 && named.every((r) => !r.fallback.startsWith("±")), "240px: the fallback names each owner");
  assert(fallback.left >= -0.5 && fallback.right <= 240.5 && fallback.sw <= baseWidth, "240px: tooltip stays inside the viewport and adds no document overflow");
  console.log(JSON.stringify({ phoneFallback: fallback.rows }, null, 2));
  await phone.close();
  console.log("PASS: inline intervals inline, labelled fallback on narrow fits, same values after resize");
} finally {
  await browser.close();
  server.close();
}
