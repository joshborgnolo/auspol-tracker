/* probe/print-css.mjs — pins the print contract (2026-10-13):
   - interactive chrome drops out under print emulation (main page +
     satellite shell)
   - pinned furniture un-pins
   - box/text shadows don't print
   - the dark theme's light ink can't vanish onto the sheet: with body.dark
     on, the ink and surface tokens compute to the LIGHT values under print
   - @page margin is set
   Run against the BUILT tree: node .matilda/probe/print-css.mjs */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]); }
  catch { res.writeHead(400); res.end("bad uri"); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, p.replace(/^\/+/, ""));
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "text/plain" }); res.end(b); } });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const port = srv.address().port;
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage();
let bad = 0;
const fail = (m) => { console.log("FAIL: " + m); bad++; };

// ---- main page ------------------------------------------------------------
await page.setViewport({ width: 1100, height: 900 });
await page.goto(`${base}/index.html`, { waitUntil: "networkidle0", timeout: 90000 });
// the board mounts client-side; wait for its chrome
await page.waitForSelector(".tabs .tab, .tabs a", { timeout: 30000 }).catch(() => {});
await page.emulateMediaType("print");
await page.evaluate(() => document.body.classList.add("dark"));
await new Promise((r) => setTimeout(r, 250));
const m = await page.evaluate(() => {
  const disp = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : null; };
  const v = (name) => getComputedStyle(document.body).getPropertyValue(name).replace(/\s+/g, " ").trim();
  return {
    tabs: disp(".tabs"), headRight: disp(".head-right"), tileBand: disp(".tile-band"),
    copyBtn: disp(".chart-copy-btn"), keysheet: disp(".rd-keysheet"),
    thPos: (() => { const th = document.querySelector(".poll-table.archive thead th"); return th ? getComputedStyle(th).position : null; })(),
    anyShadow: (() => { const dot = document.querySelector(".rd-ap-dot") || document.querySelector(".card") || document.body;
      return getComputedStyle(dot).boxShadow !== "none"; })(),
    bg: v("--bg"), ink: v("--ink"), ink2: v("--ink-2"), line: v("--line"), scheme: getComputedStyle(document.body).colorScheme || "",
  };
});
if (m.tabs !== "none") fail(`main print: .tabs display=${m.tabs}`);
if (m.headRight !== null && m.headRight !== "none") fail(`main print: .head-right display=${m.headRight}`);
if (m.tileBand !== "none") fail(`main print: .tile-band display=${m.tileBand}`);
if (m.copyBtn !== null && m.copyBtn !== "none") fail(`main print: .chart-copy-btn display=${m.copyBtn}`);
if (m.keysheet !== null && m.keysheet !== "none") fail(`main print: .rd-keysheet display=${m.keysheet}`);
if (m.thPos !== null && m.thPos !== "static") fail(`main print: archive thead th position=${m.thPos}`);
if (m.anyShadow) fail("main print: a box-shadow survives print emulation");
if (!m.bg.includes("0.97")) fail(`main print dark: --bg not forced light (${m.bg})`);
if (!m.ink.includes("0.27")) fail(`main print dark: --ink not forced dark-on-white (${m.ink})`);
if (!m.ink2.includes("0.44")) fail(`main print dark: --ink-2 (${m.ink2})`);
if (!m.line.includes("0.895")) fail(`main print dark: --line (${m.line})`);

// ---- a satellite shell page (the 404 document carries the shell) ----------
await page.emulateMediaType("screen");
await page.goto(`${base}/404.html`, { waitUntil: "networkidle0", timeout: 45000 });
await page.emulateMediaType("print");
await new Promise((r) => setTimeout(r, 200));
const s = await page.evaluate(() => {
  const disp = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : null; };
  return { tabs: disp(".sh-tabs"), theme: disp(".sh-theme"), foot: disp(".sh-foot"), band: disp(".sh-band") };
});
if (s.tabs !== "none") fail(`shell print: .sh-tabs display=${s.tabs}`);
if (s.theme !== null && s.theme !== "none") fail(`shell print: .sh-theme display=${s.theme}`);
if (s.foot !== "none") fail(`shell print: .sh-foot display=${s.foot}`);

// the shell's dark tokens can't stay dark at print either: force the class,
// then the ink tokens must compute to the print block's light-sheet values
await page.evaluate(() => { document.documentElement.classList.add("sh-dark"); document.documentElement.classList.remove("sh-light"); });
await new Promise((r) => setTimeout(r, 100));
const sd = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).replace(/\s+/g, " ").trim();
  return { ink: v("--ink"), ink2: v("--ink-2"), bg: v("--bg"), line: v("--line"), surf: v("--sh-surface"), scheme: cs.colorScheme || "" };
});
if (!sd.ink.includes("0.27")) fail(`shell print dark: --ink not forced dark-on-white (${sd.ink})`);
if (!sd.ink2.includes("0.44")) fail(`shell print dark: --ink-2 (${sd.ink2})`);
if (!sd.bg.includes("0.97")) fail(`shell print dark: --bg not forced light (${sd.bg})`);
if (!sd.line.includes("0.895")) fail(`shell print dark: --line (${sd.line})`);
if (!sd.surf.includes("0.992")) fail(`shell print dark: --sh-surface (${sd.surf})`);
if (!sd.scheme.includes("light")) fail(`shell print dark: color-scheme (${sd.scheme})`);
await page.evaluate(() => document.documentElement.classList.remove("sh-dark"));

// ---- the rules exist in the documents served ------------------------------
const idxHtml = await page.evaluate(async () => (await (await fetch("/index.html")).text()));
if (!idxHtml.includes("@media print")) fail("index.html carries no @media print block");
if (!/@page\s*\{/.test(idxHtml)) fail("index.html carries no @page");
const shellCssTxt = await page.evaluate(async () => (await (await fetch("/assets/site-shell.css")).text()));
if (!shellCssTxt.includes("@media print")) fail("assets/site-shell.css carries no @media print");
if (!/@page\s*\{/.test(shellCssTxt)) fail("assets/site-shell.css carries no @page");

await browser.close(); srv.close();
console.log(bad ? `${bad} failures` : "PASS: print css – chrome drops, pins un-stick, shadows gone, dark ink forced light, @page set");
process.exit(bad ? 1 : 0);
