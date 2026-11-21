// Probe: the vote charts' history (2026-11-22) - the two-party and primary
// vote charts share one window (rd-hero.jsx RdVoteWinBar, the store
// rdVwStore); a window behind this term draws every past term drawn through
// its two counts (gen-data §8v D.voteHistory). Checks, in a real browser
// against a local server (the past polls are a fetched sidecar):
//   1. default: both cards carry the window bar on "This term", six chips,
//      the primary card its strip; no history line drawn
//   2. ‹ on the primary card: BOTH cards name the 2022 term; the primary
//      chart draws its lanes, rings on both counts, the adjusted line ends
//      on the closing count; the past polls' dots arrive from the sidecar
//   3. All: no band behind the past lines (the long-window rule); the note
//      names the unmeasured 1955–69 terms
//   4. Term: back on this term's range state (no history lines)
//   5. ArrowLeft over the primary card steps the window back a term
//   6. /vic/ (when built): the range tabs stay, no window bar
// Run: node .matilda/probe/vote-history.mjs  (serves the tree on :8766)
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
}).listen(8766, "127.0.0.1");
const BASE = "http://127.0.0.1:8766";
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
await page.setViewport({ width: 1280, height: 1000 });
await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#primary-vote .rd-pv-chart", { timeout: 30000 });
await page.waitForFunction(() => window.AUSPOL.voteHistory && window.AUSPOL.voteHistory.terms && window.AUSPOL.voteHistory.terms.length, { timeout: 20000 });
await settle(1200);

const state = () => page.evaluate(() => {
  const bar = (sel) => {
    const r = document.querySelector(sel + " .rd-vwin");
    return r ? { name: r.querySelector(".rd-cwin-name b").textContent, chips: r.querySelectorAll(".rd-cwin-span").length,
                 pressed: [...r.querySelectorAll(".rd-cwin-span")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent) } : null;
  };
  const pv = document.querySelector("#primary-vote .rd-pv-chart");
  return {
    tpp: bar("#two-party"), pv: bar("#primary-vote"),
    strip: !!pv.querySelector(".rd-cstrip"),
    rings: pv.querySelectorAll(".rd-mark").length,
    bands: pv.querySelectorAll("path.ci-band, .ci-band").length,
    dots: pv.querySelectorAll("circle.dot, .scatter circle, circle.rd-dot").length,
    note: (pv.querySelector(".rd-note") || {}).textContent || "",
    tabs: !!document.querySelector("#primary-vote [aria-label='Time range']"),
  };
});

console.log("== 1. default ==");
let s = await state();
check("2PP card carries the window bar on This term", s.tpp && s.tpp.name === "This term", JSON.stringify(s.tpp));
check("primary card carries the window bar on This term", s.pv && s.pv.name === "This term", JSON.stringify(s.pv));
check("six chips, Term pressed", s.pv && s.pv.chips === 6 && s.pv.pressed.join() === "Term");
check("the primary card has its strip", s.strip);
check("no range tabs left on the federal page", !s.tabs);
check("no history note on this term", !/Past terms are drawn/.test(s.note));

console.log("== 2. one term back ==");
await page.evaluate(() => document.querySelector("#primary-vote .rd-cwin-step").click());
await settle(2500);
s = await state();
check("primary bar names the 2022 term", s.pv && s.pv.name === "The 2022 term", s.pv && s.pv.name);
check("2PP bar follows (one shared window)", s.tpp && s.tpp.name === "The 2022 term", s.tpp && s.tpp.name);
check("rings on both counts (5 lanes x 2)", s.rings >= 10, "rings " + s.rings);
check("the history note sits under the chart", /Past terms are drawn through the election results/.test(s.note));
const ends = await page.evaluate(() => {
  const t = window.AUSPOL.voteHistory.terms.find((x) => x.src === 2025);
  return ["alp", "lnp", "grn", "onp", "oth"].map((k) => ({ k, close: t.close[k], last: t.series[k][t.series[k].length - 1], miss: t.miss[k] }));
});
for (const e of ends) {
  // the last month's adjusted figure sits within its own band of the count (it is moved by the whole miss, g = 1 at polling day)
  check(`2022–25 ${e.k}: last month lands near the count`, Math.abs(e.last[1] - e.close) <= Math.max(1.5, e.last[3]), `last ${e.last[1]} (polls ${e.last[2]}) v count ${e.close}`);
}
await page.waitForFunction(() => Object.keys(window.AUSPOL.cycleSource || {}).length > 0, { timeout: 15000 }).catch(() => {});
await settle(800);
const pastDots = await page.evaluate(() => Object.keys(window.AUSPOL.cycleSource || {}).length);
check("the past polls' sidecar loaded for the history window", pastDots > 20, pastDots + " terms");

console.log("== 3. All ==");
await page.evaluate(() => [...document.querySelectorAll("#primary-vote .rd-cwin-span")].find((b) => b.textContent === "All").click());
await settle(2500);
s = await state();
check("bar reads Every year on record", s.pv && s.pv.name === "Every year on record", s.pv && s.pv.name);
check("the note names the unmeasured terms", /1955, 1958, 1961, 1963, 1966 and 1969/.test(s.note), s.note.slice(-160));
check("long window: the note says the bands are off", /bands are left off/.test(s.note));

console.log("== 4. back to Term ==");
await page.evaluate(() => [...document.querySelectorAll("#primary-vote .rd-cwin-span")].find((b) => b.textContent === "Term").click());
await settle(2500);
s = await state();
check("Term from All lands on this term", s.pv && s.pv.name === "This term", s.pv && s.pv.name);
check("and the 2PP card with it", s.tpp && s.tpp.name === "This term");

console.log("== 5. arrow keys ==");
await page.evaluate(() => document.querySelector("#primary-vote .rd-pv-chart").scrollIntoView({ block: "center", behavior: "instant" }));
const box = await page.evaluate(() => { const b = document.querySelector("#primary-vote .rd-pv-chart svg").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 40 }; });
await page.mouse.move(box.x, box.y);
await settle(200);
await page.keyboard.press("ArrowLeft");
await settle(2000);
s = await state();
check("ArrowLeft over the primary card steps back a term", s.pv && s.pv.name === "The 2022 term", s.pv && s.pv.name);

console.log("== 6. /vic/ ==");
if (fs.existsSync(join(ROOT, "vic", "index.html"))) {
  const v = await browser.newPage();
  await v.setViewport({ width: 1280, height: 1000 });
  await v.goto(BASE + "/vic/index.html", { waitUntil: "domcontentloaded" });
  await v.waitForSelector("#primary-vote .rd-pv-chart", { timeout: 30000 }).catch(() => {});
  await settle(1500);
  const vs = await v.evaluate(() => ({ tabs: !!document.querySelector("#primary-vote [aria-label='Time range']"), bar: !!document.querySelector("#primary-vote .rd-vwin"), vh: window.AUSPOL.voteHistory }));
  check("/vic/ keeps its range tabs", vs.tabs && !vs.bar, JSON.stringify({ tabs: vs.tabs, bar: vs.bar }));
  check("/vic/ ships no history", vs.vh == null);
} else console.log("  (no /vic/ build in this tree)");

check("no page errors", errs.length === 0, errs.join(" | "));
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
