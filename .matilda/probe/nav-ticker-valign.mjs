/* nav-ticker-valign.mjs — the next-polls countdown (.tab-next) sits on the
   tab row's own line at ≥1100px, in both bar states. Born 2026-10-13 when
   the pinned laptop bar's countdown floated ~5px high of the condensed
   labels: the tab set condenses by a 0.85 transform (the bar's box never
   moves) while the ticker's absolute seat off its bottom padding stayed at
   the resting 14px. rd.css now re-seats a pinned .tab-next at 9px.
   Asserted here against the LIVE neighbours, not fixed pixels, so a later
   bar-height change moves the contract with it:
     unpinned  – the countdown's text box tracks the tab labels' (±2px)
     pinned    – the countdown's text box tracks the label line (±1.5px)
   Usage: node .matilda/probe/nav-ticker-valign.mjs */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(join(HERE, "../.."));
const PORT = 8955;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".css": "text/css" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
let fails = 0;
const ok = (cond, msg) => { console.log(` ${cond ? "ok " : "FAIL"} ${msg}`); if (!cond) fails++; };

const read = () => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return { t: b.top, b: b.bottom, h: b.height };
  };
  const bar = document.querySelector(".tabs-inner").getBoundingClientRect();
  const air = (b) => b ? { above: +(b.t - bar.top).toFixed(1), below: +(bar.bottom - b.b).toFixed(1) } : null;
  return {
    pinned: document.querySelector(".tabs").classList.contains("pinned"),
    lab: air(box(".tab-label")),
    tn: air(box(".tn-lab")),
    bar: { t: bar.top, b: bar.bottom },
  };
};
const fn = `(${read.toString()})()`;

for (const vw of [1280, 1440]) {
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: 900, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0", timeout: 60000 });
  try { await page.waitForSelector(".tab-next", { timeout: 25000 }); }
  catch { console.log(`${vw}px | no ticker`); fails++; await page.close(); continue; }
  await new Promise((r) => setTimeout(r, 700));

  const geo = () => page.evaluate(fn);

  console.log(`-- ${vw}px`);
  const a = await geo();
  ok(a.tn && a.lab, "ticker + tab labels rendered");
  ok(!a.pinned, "starts unpinned");
  ok(a.tn && Math.abs(a.tn.above - a.lab.above) <= 2,
    `unpinned: countdown tracks the label line (tn ${JSON.stringify(a.tn)} vs lab ${JSON.stringify(a.lab)})`);

  await page.evaluate(() => window.scrollTo(0, window.scrollY + 1200));
  await new Promise((r) => setTimeout(r, 900));
  const b = await geo();
  ok(b.pinned, "bar pins on scroll");
  ok(b.tn && Math.abs(b.tn.above - b.lab.above) <= 1.5 && Math.abs(b.tn.below - b.lab.below) <= 1.5,
    `pinned: countdown rides the condensed label line (tn ${JSON.stringify(b.tn)} vs lab ${JSON.stringify(b.lab)})`);
  await page.close();
}
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nthe countdown sits on the tab row's line, both bar states");
process.exit(fails ? 1 : 0);
