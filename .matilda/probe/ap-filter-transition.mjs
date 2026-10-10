/* Functional receipt for the All-polls filter-transition fix (2026-10-09):
   the three select filters now apply inside React.startTransition. Asserts
   a pick still lands (pill + count change + select snaps back to its label),
   the pill's × removes it, and Clear all empties the pills row. Exit 1 on
   any failure. */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
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
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${server.address().port}/allpolls/`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));

const pick = (cls, value) => page.evaluate(({ cls, value }) => {
  const sel = document.querySelector(cls);
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  setter.call(sel, value);
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}, { cls, value });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => page.evaluate(() => ({
  pills: [...document.querySelectorAll(".rd-ap-active .rd-ap-pill")].map((p) => p.textContent.trim()),
  count: (document.querySelector(".rd-ap-count b") || {}).textContent,
  houseLab: document.querySelector(".rd-ap-sel-house").value,
  timeLab: document.querySelector(".rd-ap-sel-time").value,
  url: location.search,
}));

let fail = 0;
const ok = (cond, label, extra) => { console.log((cond ? "PASS " : "FAIL ") + label + (extra !== undefined ? " — " + JSON.stringify(extra) : "")); if (!cond) fail = 1; };
const sleepWhile = async (fn, n = 40) => { for (let i = 0; i < n; i++) { if (await fn()) return true; await sleep(50); } return fn(); };

const before = await state();
await pick(".rd-ap-sel-house", "Fox & Hedgehog");
const applied = await sleepWhile(async () => (await state()).pills.some((p) => p.startsWith("Fox & Hedgehog")));
const after = await state();
ok(applied, "house pick applies (transition lands)", after.pills);
ok(after.count !== before.count, "row count moves", { before: before.count, after: after.count });
ok(after.houseLab === "", "select snaps back to label");
ok(after.url.includes("w="), "URL carries the filter", after.url);

await page.evaluate(() => [...document.querySelectorAll(".rd-ap-active .rd-ap-pill button")].find((b) => b.parentElement.textContent.startsWith("Fox")).click());
const removed = await sleepWhile(async () => !(await state()).pills.some((p) => p.startsWith("Fox & Hedgehog")));
ok(removed, "pill × removes the filter");

await pick(".rd-ap-sel-time", "6");
await pick(".rd-ap-sel-inc", "aprv");
const both = await sleepWhile(async () => { const s = await state(); return s.pills.length >= 2; });
ok(both, "time + includes picks both land", (await state()).pills);
await page.evaluate(() => [...document.querySelectorAll(".rd-ap-active button")].find((b) => b.textContent.trim() === "Clear all").click());
const cleared = await sleepWhile(async () => (await state()).pills.length === 0);
ok(cleared, "Clear all empties the filters", (await state()).pills);

await browser.close();
server.close();
process.exit(fail);
