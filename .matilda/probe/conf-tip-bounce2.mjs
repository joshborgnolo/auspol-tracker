/* Decisive bounce probe: sweep the FULL consumer history axis at fine
   granularity. The hover is monotone-following, so the spine month must
   never DECREASE as the pointer moves right. Flag every decrease, and
   every tooltip-title jump > 18 months (a far-point bounce). */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto(base + "/", { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => document.getElementById("confidence").scrollIntoView());
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => /Show complete history/i.test(el.textContent));
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 900));
const rect = await page.evaluate(() => {
  const svg = document.querySelector("#confidence .rd-confidence-chart svg.chart-svg") || document.querySelector("#confidence svg");
  const r = svg.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const toM = (t) => {
  const m = /^([A-Z][a-z]{2}) (\d{4})/.exec(t || "");
  return m ? (+m[2]) * 12 + MONTHS[m[1]] : null;
};
const readTip = () => page.evaluate(() => {
  const tip = document.querySelector("#confidence .tip");
  if (!tip) return null;
  return { cls: tip.className.includes("tip-guide") ? "guide" : "dot",
           title: (tip.querySelector(".tip-title") || {}).textContent || "",
           rows: [...tip.querySelectorAll(".tip-label")].map((el) => el.textContent).join(" | ") };
});
const anomalies = [];
let prev = null;
for (let px = Math.round(rect.x) + 2; px < rect.x + rect.w - 2; px += 4) {
  await page.mouse.move(px, rect.y + rect.h * 0.5);
  await new Promise((r) => setTimeout(r, 26));
  const t = await readTip();
  if (!t) { prev = null; continue; }
  const mNow = t.cls === "guide" ? toM(t.title) : null;
  const mPrev = prev && prev.cls === "guide" ? toM(prev.title) : null;
  if (mNow != null && mPrev != null) {
    if (mNow < mPrev) anomalies.push({ px, kind: "DECREASE", from: prev.title, to: t.title, rows: t.rows });
    else if (mNow - mPrev > 18) anomalies.push({ px, kind: "JUMP>18mo", from: prev.title, to: t.title, rows: t.rows });
  }
  if (prev && prev.cls !== t.cls) anomalies.push({ px, kind: "MODE-FLIP " + prev.cls + "->" + t.cls, from: prev.title, to: t.title, rows: t.rows });
  prev = t;
}
console.log(JSON.stringify(anomalies, null, 1).slice(0, 6000));
console.log("anomalies:", anomalies.length);
if (errors.length) console.log("js errors:", errors.join(" ;; ").slice(0, 300));
await browser.close(); server.close();
