/* Reproduce the reported confidence-history tooltip bounce: sweep the
   pointer left→right over the consumer-view history chart and log where
   the tooltip's computed hover goes (title + series rows + tip x). */
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

/* consumer view is the default; switch history on */
await page.evaluate(() => document.getElementById("confidence").scrollIntoView());
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => /Show complete history/i.test(el.textContent));
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 900));

const rect = await page.evaluate(() => {
  const svg = document.querySelector("#confidence .rd-confidence-chart svg.chart-svg") ||
              document.querySelector("#confidence svg");
  const r = svg.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
console.log("svg rect", JSON.stringify(rect));

/* axis calibration: read the year ticks to map fraction -> approx year */
const ticks = await page.evaluate(() => {
  const svg = document.querySelector("#confidence svg");
  return [...svg.querySelectorAll("text")].filter((t) => /^(19|20)\d\d$/.test(t.textContent.trim()))
    .map((t) => ({ year: t.textContent.trim(), x: t.getBoundingClientRect().left + t.getBoundingClientRect().width / 2 }));
});
console.log("year ticks", JSON.stringify(ticks));

const readTip = () => page.evaluate(() => {
  const tip = document.querySelector("#confidence .tip");
  const out = { tip: null, guideX: null };
  if (tip) {
    const tr = tip.getBoundingClientRect();
    out.tip = {
      cls: tip.className,
      left: Math.round(tr.left * 10) / 10,
      title: (tip.querySelector(".tip-title") || {}).textContent || "",
      rows: [...tip.querySelectorAll(".tip-label")].map((el) => el.textContent).join(" | "),
    };
  }
  /* the spine guide is the vertical hover rule inside the svg */
  const g = document.querySelector("#confidence svg line[stroke-dasharray], #confidence svg .guide-line, #confidence svg line.guide");
  if (g) {
    const b = g.getBoundingClientRect();
    out.guideX = Math.round((b.left + b.width / 2) * 10) / 10;
  }
  return out;
});

/* fine sweep across the OLD years only (left 55% of the axis = pre-2016) */
const samples = [];
for (let i = 0; i <= 110; i++) {
  const px = rect.x + rect.w * (0.02 + (0.53 * i) / 110);
  await page.mouse.move(px, rect.y + rect.h * 0.5);
  await new Promise((r) => setTimeout(r, 45));
  const t = await readTip();
  samples.push({ px: Math.round(px), ...t });
}
/* report: print every sample where the previous sample differs in title or class */
let prev = null;
for (const s of samples) {
  const sig = s.tip ? s.tip.title + "§" + s.tip.cls + "§" + (s.tip.rows.match(/monthly history|Roy Morgan|Westpac|ANZ|NAB/g) || []).join(",") : "null";
  const prevSig = prev && prev.tip ? prev.tip.title + "§" + prev.tip.cls : (prev ? "null" : "none");
  const curSig = s.tip ? s.tip.title + "§" + s.tip.cls : "null";
  if (curSig !== prevSig) {
    console.log(`px=${s.px} tip=${curSig} title="${s.tip ? s.tip.title : "-"}" left=${s.tip ? s.tip.left : "-"} guideX=${s.guideX} rows="${s.tip ? s.tip.rows : ""}"`);
  } else if (s.tip && prev && prev.tip && Math.abs((s.tip.left||0) - (prev.tip.left||0)) > 40) {
    console.log(`px=${s.px} JUMP left ${prev.tip.left}->${s.tip.left} title="${s.tip.title}"`);
  }
  prev = s;
}
if (errors.length) console.log("js errors:", errors.join(" ;; ").slice(0, 400));
await browser.close(); server.close();
console.log("done");
