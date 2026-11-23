import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" }[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => { errors.push(e.message); console.log("PAGEERROR", e.message); });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text()); });
page.on("requestfailed", (r) => console.log("REQUESTFAILED", r.url(), r.failure()));
await page.setViewport({ width: 1440, height: 1000 });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle0" });
await page.waitForSelector("#undecided .rd-un-p-und svg", { timeout: 30000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(900);
const fails = [];
const check = (value, label, detail) => {
  console.log((value ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " — " + JSON.stringify(detail)));
  if (!value) fails.push(label);
};
await page.evaluate(() => {
  [...document.querySelectorAll("#undecided .rd-cwin-span")].find((b) => b.textContent.trim() === "10 yrs")?.click();
});
await sleep(900);

for (const key of ["und", "soft"]) {
  const selector = `#undecided .rd-un-p-${key}`;
  const { target, earliest, early, debug } = await page.evaluate((selector) => {
    const svg = document.querySelector(selector + " .chart > svg.chart-svg");
    svg.scrollIntoView({ block: "center" });
    const k = Object.getOwnPropertyNames(svg).find((k) => k.startsWith("__reactFiber$"));
    let f = svg[k];
    while (f && !(f.memoizedProps && f.memoizedProps.spine && f.memoizedProps.xDomain)) f = f.return;
    if (!f) return { target: null, earliest: null, early: 0 };
    const p = f.memoizedProps;
    const stop = p.spine.find((q) => q.x < 2025.34);
    const index = p.spine.indexOf(stop);
    const r = svg.getBoundingClientRect();
    const x0 = p.xDomain[0], x1 = p.xDomain[1];
    const target = stop ? {
      x: r.x + (36 + (stop.x - x0) / (x1 - x0) * 954) / 1000 * r.width,
      y: r.y + 24,
    } : { x: r.x + r.width / 2, y: r.y + 24 };
    return { target, earliest: stop ? { x: stop.x, title: p.tooltipTitle(index) } : null,
      early: p.spine.filter((q) => q.x < 2025.34).length,
      debug: { domain: p.xDomain, spineFirst: p.spine[0], spineLast: p.spine[p.spine.length - 1], titleFn: String(p.tooltipTitle), series: p.series.map((s) => ({ id: s.id, lo: s.points[0]?.x, hi: s.points[s.points.length - 1]?.x })) },
    };
  }, selector);
  console.log(key, { early, domain: debug.domain });
  check(earliest && yearOf(earliest.title) < 2025, `${key}: historical month title is available`, earliest);
  if (!target) continue;
  await page.mouse.move(target.x, target.y);
  await sleep(180);
  const tip = await page.evaluate((selector) => {
    const t = [...document.querySelectorAll(selector + " .tip.tip-guide")].find((t) => +getComputedStyle(t).opacity > 0.05);
    return t ? { title: t.querySelector(".tip-title")?.textContent || "", text: t.textContent.replace(/\s+/g, " ").trim(), rows: t.querySelectorAll(".tip-row").length } : null;
  }, selector);
  check(tip && yearOf(tip.title) < 2025, `${key}: historical month guide opens before May 2025`, tip);
}
check(errors.length === 0, "No browser errors", errors);
await browser.close(); server.close();
if (fails.length) { console.log(`${fails.length} check(s) failed`); process.exit(1); }

function yearOf(title) {
  const m = title && title.match(/(\d{4})/);
  return m ? +m[1] : null;
}
