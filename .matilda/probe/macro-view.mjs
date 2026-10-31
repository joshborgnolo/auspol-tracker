/* Assert the Economic sentiment panel's "Inflation & growth" view against
   the freshly built worktree (run after node .build/newtracker/build.mjs):
   the third tab swaps views with no error boundary, the read rows carry
   the file's own newest figures, the RBA target band and the OECD context
   lines draw, and the "Show complete history" chip stretches the ruler
   onto the calendar (and back). Clean asserts at desktop and phone. */
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
/* confidence sits in the staged tail; scroll it into being first */
await page.evaluate(() => document.getElementById("confidence") && document.getElementById("confidence").scrollIntoView());
await new Promise((r) => setTimeout(r, 1200));

const MACRO = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "macro.json"), "utf8"));
const clickText = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, "i");
  const el = [...document.querySelectorAll("button")].find((b) => rx.test(b.textContent.trim()));
  if (el) el.click();
  return !!el;
}, re.source);

const readState = () => page.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find((s) => /Economic sentiment/.test(s.textContent || ""));
  if (!sec) return { found: false };
  const t = sec.innerText;
  const q = (sel) => [...sec.querySelectorAll(sel)];
  return {
    found: true,
    boundary: t.includes("hit an error"),
    tabInflation: q(".rd-confidence-tabs button").some((b) => /Inflation & growth/i.test(b.textContent)),
    ptitle: t.includes("Inflation & growth") && t.includes("annual change, per cent"),
    oecdRow: t.includes("OECD average inflation"),
    g20Row: t.includes("G20 average inflation"),
    rbaBand: q("svg .rba-band").length > 0,
    histChip: t.includes("Show complete history"),
    backLabel: t.includes("Back to this term"),
    eventNow: q("svg text").some((el) => el.textContent.trim() === "Now"),
    tick1960: q("svg text").some((el) => el.textContent.trim() === "1960"),
    head: t.includes("Inflation runs at"),
    figs: [...sec.querySelectorAll(".rd-un-read .rd-un-rv")].map((el) => el.textContent.trim()),
    dots: q("svg circle").length,
    lines: q("svg path").length,
  };
});
const fails = [];
const check = (name, got, want) => {
  const miss = Object.entries(want).filter(([k, v]) => got[k] !== v);
  if (miss.length) fails.push(`${name}: ${miss.map(([k, v]) => `${k}=${JSON.stringify(got[k])} want ${v}`).join(", ")}`);
  else console.log(`${name}: ok`);
};

/* file-grounded expectations: the read rows must quote macro.json's own
   newest figures, never a recalculation (lane order: AU solid lanes,
   then OECD CPI, G20 CPI, OECD GDP) */
const expectedFigs = [
  MACRO.cpiMonthly.rows.at(-1).v.toFixed(1) + "%",
  MACRO.gdppc.rows.at(-1).v.toFixed(1) + "%",
  MACRO.oecdCpi.rows.at(-1).v.toFixed(1) + "%",
  MACRO.g20Cpi.rows.at(-1).v.toFixed(1) + "%",
];

const s0 = await readState();
check("consumer view opens", s0, { found: true, boundary: false, tabInflation: true });

// enter the macro view
if (!(await clickText(/Inflation & growth/))) fails.push("no Inflation & growth tab to click");
await new Promise((r) => setTimeout(r, 800));
const s1 = await readState();
check("macro term view", s1, {
  found: true, boundary: false, ptitle: true, oecdRow: true, g20Row: true,
  rbaBand: true, histChip: true, backLabel: false, eventNow: true, tick1960: false, head: true,
});
if (s1.figs.length >= 4) {
  expectedFigs.forEach((want, i) => {
    if (s1.figs[i] !== want) fails.push(`read row ${i + 1} shows ${s1.figs[i]}, want the file's own ${want}`);
    else console.log(`read row ${i + 1}: ok (${s1.figs[i]})`);
  });
} else fails.push(`expected read-row figures, got ${JSON.stringify(s1.figs)}`);

// history mode: the calendar ruler
if (!(await clickText(/Show complete history/))) fails.push("no history chip");
await new Promise((r) => setTimeout(r, 900));
const s2 = await readState();
check("macro history view", s2, { found: true, boundary: false, backLabel: true, tick1960: true, rbaBand: true });
if (!(await clickText(/^Back to this term$/))) fails.push("no back-to-term chip");
await new Promise((r) => setTimeout(r, 900));
check("back to term", await readState(), { boundary: false, histChip: true, backLabel: false, tick1960: false });

// phone: the tab row and controls must not push the document wide
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 700));
const over390 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (over390 > 1) fails.push("390px rung overflows by " + over390 + "px");
else console.log("390px rung: ok");
await page.setViewport({ width: 320, height: 700 });
await new Promise((r) => setTimeout(r, 700));
const over320 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (over320 > 1) fails.push("320px rung overflows by " + over320 + "px");
else console.log("320px rung: ok");

if (errors.length) fails.push("page errors: " + errors.join(" | "));
await browser.close();
server.close();
if (fails.length) { console.error("\nFAIL:\n" + fails.map((f) => "  " + f).join("\n")); process.exit(1); }
console.log("macro-view probe: OK");
