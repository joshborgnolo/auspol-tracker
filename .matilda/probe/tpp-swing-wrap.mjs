/* tpp-swing-wrap.mjs — the 2PP hero's "▼ n.n since the <year> election"
   tail (p.rd-tpp-change .rd-tpp-swing) is ONE unbreakable clause: on a
   narrow screen it drops to a line of its own whole, never splitting
   "… since the / <year> election" across the wrap, and never overflowing
   the document. On the desktop rung it still sits inline behind the
   month-change clause.

   The clause rides the real Labor v Coalition matchup only (the modelled
   pairings have no election count to swing against), so each rung first
   switches to that contest through the "Switch 2PP" chip; the default
   contest is currently Labor v One Nation. Its |swing| ≥ 0.05 gate is
   data-pinned — the implied-basis swing has been several points for all
   of the term so far, and if the clause ever genuinely vanishes the
   probe fails loudly rather than re-basing the contract.

   Serves the repo on an ephemeral port; headless Chrome via puppeteer-core. */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHROME = process.env.CHROME
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(1); }
const require = createRequire(import.meta.url);
const puppeteer = require.resolve("puppeteer-core")
  ? require("puppeteer-core") : require("/Users/joshuaborgnolo/auspol tracker/node_modules/puppeteer-core");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));

let fails = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "  ok  " : " FAIL ") + name + (detail ? "  — " + detail : ""));
  if (!ok) fails++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RUNGS = [
  { w: 1280, h: 900, wantInline: true },   // desktop: stays behind the month clause
  { w: 700, h: 900, wantInline: null },    // tablet: free either way
  { w: 390, h: 844, wantInline: null },
  { w: 360, h: 800, wantInline: null },
  { w: 320, h: 800, wantInline: null },    // narrowest phone rung
];

const ensureCoalitionContest = async () => page.evaluate(() => {
  const current = document.querySelector("section.rd-tpp .rd-tpp-side.rd-b .rd-tpp-name");
  if (current && current.textContent.trim() === "Coalition") return "already";
  const chip = [...document.querySelectorAll("section.rd-tpp button.rd-chip")]
    .find((b) => /Coalition/.test(b.textContent));
  if (!chip) return false;
  chip.click();
  return "clicked";
});

const sample = () => page.evaluate(() => {
  const p = document.querySelector(".rd-tpp-change");
  if (!p) return { missing: "rd-tpp-change" };
  const s = p.querySelector(".rd-tpp-swing");
  if (!s) return { absent: true };
  const t0 = [...p.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  const head = document.createRange();
  head.setStart(t0, 0);
  head.setEnd(t0, Math.min(2, t0.length));
  const hr = head.getBoundingClientRect();
  const sr = s.getBoundingClientRect();
  const tops = [...s.getClientRects()].map((r) => Math.round(r.top));
  return {
    inline: Math.abs(sr.top - hr.top) < 4,           // same line as the month clause
    lines: new Set(tops).size,                       // >1 means the clause split mid-wrap
    nowrap: getComputedStyle(s).whiteSpace === "nowrap",
    text: s.textContent.trim(),
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    spanBeyondRight: sr.right - document.documentElement.clientWidth,
  };
});

const assertSwing = (label, s, wantInline) => {
  check(`${label}: clause is white-space:nowrap`, s.nowrap);
  check(`${label}: clause sits on exactly one rendered line (never splits mid-wrap)`, s.lines === 1, `lines=${s.lines} text="${s.text}"`);
  check(`${label}: no document overflow`, s.over <= 0, `over=${s.over}px`);
  check(`${label}: clause stays inside the viewport`, s.spanBeyondRight <= 0, `right overshoot=${s.spanBeyondRight.toFixed(1)}px`);
  if (wantInline === true) check(`${label}: desktop keeps the clause inline behind the month clause`, s.inline);
  else console.log(`  (i) ${label}: landed on ${s.inline ? "the first" : "its own"} line`);
};

for (const r of RUNGS) {
  await page.setViewport({ width: r.w, height: r.h });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-tpp-change", { timeout: 30000 });
  const sw = await ensureCoalitionContest();
  if (sw === false) { check(`${r.w}px: the Coalition contest is reachable`, false, "no Switch-2PP chip naming Coalition"); continue; }
  if (sw === "clicked") await sleep(1000);   // outlast the 320ms matchup morph
  const s0 = await sample();
  if (s0.absent) { check(`${r.w}px implied: the swing clause renders`, false, "swing within ±0.05 in the current data - the clause is genuinely absent"); continue; }
  assertSwing(`${r.w}px implied`, s0, r.wantInline);
  // flip to the pollsters' published basis through the "?" popover's switch
  // (never re-click the "?" - a second press toggles the popover SHUT)
  await page.evaluate(() => document.querySelector("section.rd-tpp .rd-qbtn").click());
  await sleep(300);
  const flipped = await page.evaluate(() => {
    const sw = document.querySelector("section.rd-tpp .rd-qpanel .rd-switch");
    if (!sw) return false;
    sw.click();
    return true;
  });
  if (!flipped) { check(`${r.w}px: the basis switch is reachable`, false, "no .rd-qpanel .rd-switch"); continue; }
  await sleep(900);   // outlast the 320ms basis morph
  const s1 = await sample();
  if (!s1.absent) assertSwing(`${r.w}px published`, s1, r.wantInline);
  else console.log(`  (i) ${r.w}px published: swing clause absent on this basis - skipped`);
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} FAIL` : "\nall ok");
process.exit(fails ? 1 : 0);
