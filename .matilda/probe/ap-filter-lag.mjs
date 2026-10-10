/* Filter-responsiveness MEASURER (not an assertion probe: always exit 0,
   like ap-sel-widths). The All-polls filter bar's three action-menu selects
   (Pollster / Time / Includes) were reported 2026-10-09 to sit dead for
   ~2s after a pick before the same select could be pressed again. This
   probe measures the main-thread block from a select change until the
   page is interactive again (last long-task end), at desktop width with
   CPU throttled 4x (an ordinary loaded laptop), and JS-profiles the house
   tick to name the hot functions. A before/after number is the fix's
   receipt.
   Run: node .matilda/probe/ap-filter-lag.mjs ; RATE=1 for unthrottled */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = process.env.ROOT || fileURLToPath(new URL("../..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const URL0 = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await page.evaluateOnNewDocument(() => {
  window.__lt = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, end: e.startTime + e.duration, dur: e.duration });
  }).observe({ entryTypes: ["longtask"] });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RATE = Number(process.env.RATE || 4);

await page.goto("about:blank");
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
await page.emulateCPUThrottling(RATE);
await cdp.send("Profiler.enable");
await page.goto(URL0 + "allpolls/", { waitUntil: "networkidle0" });
await sleep(1500);
await page.evaluate(() => { window.__lt.length = 0; });

const pick = async (cls, value, label, profile) => {
  if (profile) await cdp.send("Profiler.start");
  const r = await page.evaluate(async ({ cls, value }) => {
    const sel = document.querySelector(cls);
    if (!sel) return { err: "no select " + cls };
    const opt = [...sel.options].find((o) => o.value === value);
    if (!opt) return { err: "no option " + value };
    const t0 = performance.now();
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(sel, value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    const free = await new Promise((res) => setTimeout(() => res(performance.now()), 0));
    await new Promise((res) => setTimeout(res, 400));
    const t1 = performance.now();
    const lts = window.__lt.filter((e) => e.end > t0 && e.start < t1);
    const last = lts.length ? Math.max(...lts.map((e) => e.end)) : t0;
    const sum = Math.round(lts.reduce((a, e) => a + e.dur, 0));
    const max = Math.round(lts.length ? Math.max(...lts.map((e) => e.dur)) : 0);
    return { firstYield: Math.round(free - t0), interactiveAt: Math.round(last - t0), ltN: lts.length, ltSum: sum, ltMax: max };
  }, { cls, value });
  console.log(`${label}:`, JSON.stringify(r));
  if (profile) {
    const { profile: prof } = await cdp.send("Profiler.stop");
    /* selftime per function/line from the sampled profile */
    const dt = prof.timeDeltas, nodes = prof.nodes;
    const self = [];
    nodes.forEach((n, i) => {
      const t = (dt[i] || 0) / 1000; // µs→ms
      if (t < 1) return;
      const cf = n.callFrame, name = (cf.functionName || "(anon)") + " @" + cf.url.split("/").pop() + ":" + cf.lineNumber;
      self.push([t, name]);
    });
    self.sort((a, b) => b[0] - a[0]);
    console.log("  profile self-time (ms): total hits " + self.reduce((a, s) => a + s[0], 0).toFixed(0));
    for (const [t, n] of self.slice(0, 18)) console.log("   " + t.toFixed(0).padStart(6) + "  " + n);
  }
  await sleep(300);
  await page.evaluate(() => { window.__lt.length = 0; });
};

console.log("CPU throttle " + RATE + "x, desktop 1366");
await pick(".rd-ap-sel-house", "Fox & Hedgehog", "house tick   ", true);
await pick(".rd-ap-sel-house", "Fox & Hedgehog", "house untick ");
await pick(".rd-ap-sel-time", "6", "time 6mo     ");
await pick(".rd-ap-sel-inc", "aprv", "includes tick");
await pick(".rd-ap-sel-inc", "__clear", "includes clr ");
await browser.close();
server.close();
