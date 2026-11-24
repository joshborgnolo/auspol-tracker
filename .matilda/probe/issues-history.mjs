// Probe: the issues on the model with the vote charts' window (2026-11-24) –
// gen-data §7hm (issue-model.mjs), the issues-history sidecar, RdIssues'
// window bars. Checks, in a real browser against a local server:
//   1. default: both issue charts carry the window bar on "This term"; the
//      What-matters chart draws this term's months and its dots
//   2. 10 yrs on the trust card: the sidecar loads, the chart draws Labor and
//      the Coalition only (the long view's two-way), x ticks are years
//   3. All on What matters, Health: the chart reaches back before 2000, its
//      dots are off (a window over twelve years), a dotted bridge is drawn
//   4. All on What matters, Cost of living: the window clamps to the issue's
//      reach (no x before 2009)
//   5. Term: back to this term's view (no long-view lines)
//   6. the old design and /vic/ (when built) render without page errors; /vic/
//      has no issues window bar
// Run: node .matilda/probe/issues-history.mjs  (serves the tree on :8767)
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try { puppeteer = createRequire(join(base, "package.json"))("puppeteer-core"); break; } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable from ~ or cwd"); process.exit(2); }
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = join(ROOT, p);
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(8767, "127.0.0.1");
const BASE = "http://127.0.0.1:8767";
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) passed++; else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await page.setViewport({ width: 1280, height: 1400 });
await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#issues .rd-is-chart", { timeout: 40000 });
await settle(1500);

const view = (v) => page.evaluate((v) => {
  const b = [...document.querySelectorAll("#issues .rd-is-tabs .rd-tab")].find((x) => (v === "trust" ? /trusted/i : /matters/i).test(x.textContent));
  if (b) b.click();
}, v);
const chip = (scope, label) => page.evaluate((scope, label) => {
  const b = [...document.querySelectorAll(`#issues ${scope} .rd-cwin-span`)].find((x) => x.textContent.trim() === label);
  if (b) b.click();
  return !!b;
}, scope, label);
const issue = (label) => page.evaluate((label) => {
  const b = [...document.querySelectorAll("#issues .rd-iw-chip")].find((x) => x.textContent.trim() === label);
  if (b) b.click();
}, label);
const chart = (scope) => page.evaluate((scope) => {
  const root = document.querySelector(`#issues ${scope}`);
  if (!root) return null;
  const bar = root.querySelector(".rd-cwin");
  const ticks = [...root.querySelectorAll("svg text")].map((t) => t.textContent.trim()).filter((t) => /^(19|20)\d\d$/.test(t)).map(Number);
  const ends = [...root.querySelectorAll("svg text")].map((t) => t.textContent.trim()).filter((t) => /^(Labor|Coalition|One Nation)$/.test(t));
  const dots = root.querySelectorAll("svg .scatter-dot").length;
  const dashed = [...root.querySelectorAll("svg path")].some((p) => (p.getAttribute("stroke-dasharray") || "").startsWith("0.5"));
  return { bar: bar ? bar.querySelector(".rd-cwin-name b").textContent : null, ticks, ends, dots, dashed };
}, scope);

console.log("1. default");
await view("trust"); await settle(600);
let t = await chart(".rd-is-chart");
check("trust card carries the window bar on This term", t && t.bar === "This term", t && t.bar);
await view("matters"); await settle(800);
let m = await chart(".rd-iw");
check("What matters carries the window bar on This term", m && m.bar === "This term", m && m.bar);
check("What matters draws this term's dots", m && m.dots >= 10, m && m.dots);

console.log("2. 10 yrs on the trust card");
await view("trust"); await settle(600);
check("10 yrs chip found", await chip(".rd-is-chart", "10 yrs"));
await page.waitForFunction(() => window.AUSPOL.issuesHistory != null, { timeout: 15000 }).catch(() => {});
await settle(1500);
t = await chart(".rd-is-chart");
check("sidecar loaded", await page.evaluate(() => !!(window.AUSPOL.issuesHistory && window.AUSPOL.issuesHistory.issues)));
check("long view names Labor and the Coalition only", t && t.ends.includes("Labor") && t.ends.includes("Coalition") && !t.ends.includes("One Nation"), t && t.ends.join(","));
check("x ticks are years spanning ten", t && t.ticks.length >= 3 && Math.max(...t.ticks) - Math.min(...t.ticks) >= 6, t && t.ticks.join(","));

console.log("3. All, Health");
await view("matters"); await settle(800);
await issue("Health"); await settle(600);
check("All chip found", await chip(".rd-iw", "All"));
await settle(1500);
m = await chart(".rd-iw");
check("reaches back before 2000", m && m.ticks.length && Math.min(...m.ticks) <= 2000, m && m.ticks.join(","));
check("no dots over a window longer than twelve years", m && m.dots === 0, m && m.dots);
check("a dotted bridge is drawn", m && m.dashed);

console.log("4. All, Cost of living");
await issue("Cost of living"); await settle(1200);
m = await chart(".rd-iw");
check("window clamps to the issue's reach", m && m.ticks.length && Math.min(...m.ticks) >= 2009, m && m.ticks.join(","));

console.log("5. Term");
check("Term chip found", await chip(".rd-iw", "Term"));
await settle(1500);
m = await chart(".rd-iw");
check("back on This term", m && m.bar === "This term", m && m.bar);
check("no dotted bridge this term", m && !m.dashed);
check("no page errors", !errs.length, errs.join(" | "));

console.log("6. old design and /vic/");
const p2 = await browser.newPage();
const errs2 = [];
p2.on("pageerror", (e) => errs2.push(String(e).slice(0, 200)));
await p2.setViewport({ width: 1280, height: 1200 });
await p2.goto(BASE + "/index.html?design=old", { waitUntil: "domcontentloaded" });
await settle(6000);
await p2.evaluate(() => { const el = document.getElementById("issues"); if (el) el.scrollIntoView(); });
await settle(1500);
check("old design: no page errors", !errs2.length, errs2.join(" | "));
if (fs.existsSync(join(ROOT, "vic", "index.html"))) {
  const errs3 = [];
  const p3 = await browser.newPage();
  p3.on("pageerror", (e) => errs3.push(String(e).slice(0, 200)));
  await p3.goto(BASE + "/vic/index.html", { waitUntil: "domcontentloaded" });
  await settle(6000);
  check("/vic/: no page errors", !errs3.length, errs3.join(" | "));
  check("/vic/: no issues window bar", await p3.evaluate(() => !document.querySelector("#issues .rd-cwin")));
}
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
