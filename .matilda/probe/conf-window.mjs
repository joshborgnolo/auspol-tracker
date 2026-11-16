/* Economic sentiment's time window (rd-panels.jsx RdConfWinBar /
   RdConfStrip / RdMacro), driven against a built tree:
     node .matilda/probe/conf-window.mjs [root] [--shots dir]
   Asserts, on Consumers, Businesses and Inflation & growth:
     - the bar opens on "This term", › disabled, ‹ steps to "The 2022
       term" and back, and the window holds across a tab switch;
     - Term / 10 yrs / 25 yrs / All set the window ("The last 10 years");
     - ‹ on a span pages it back its own width;
     - dragging the strip's window (a term) snaps to the term it lands
       on; brushing open strip draws a custom window; a tap on open strip
       jumps to the term tapped;
     - the guide readout carries rows in a past term (consumer chart) and
       on every macro panel;
     - the macro view draws seven panels, numbered events only in the
       sitting term, and its "This term" ends at now;
     - the seven panels name their lanes (productivity, earnings and the
       OECD medians beside them), with their latest figures read off the
       page's own macro rows;
     - the step glide moves the lines mid-flight (the x window travels);
     - no page errors.
   --shots dir saves a frame strip of the glide. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const ROOT = path.resolve(args.find((a) => !a.startsWith("--")) || decodeURIComponent(new URL("../../", import.meta.url).pathname));
const SHOTS = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
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
await page.setViewport({ width: 1280, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto(base + "/", { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 1800));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (name, cond, info) => { if (cond) console.log("ok   " + name); else { fails.push(name + (info ? " — " + info : "")); console.log("FAIL " + name + (info ? " — " + info : "")); } };

const state = () => page.evaluate(() => {
  const sec = document.getElementById("confidence");
  const name = sec.querySelector(".rd-cwin-name");
  const steps = [...sec.querySelectorAll(".rd-cwin-step")];
  return {
    view: [...sec.querySelectorAll(".rd-confidence-tabs button")].find((b) => b.getAttribute("aria-pressed") === "true").textContent.trim(),
    head: name ? name.querySelector("b").textContent : null,
    sub: name && name.querySelector("span") ? name.querySelector("span").textContent : "",
    prevOff: steps[0] ? steps[0].disabled : null, nextOff: steps[1] ? steps[1].disabled : null,
    span: (sec.querySelector(".rd-cwin-span[aria-pressed=true]") || {}).textContent || null,
    panels: sec.querySelectorAll(".rd-xf-now .rd-mp").length,
    badges: sec.querySelectorAll(".rd-xf-now .rd-badge").length,
    boundary: /hit an error/.test(sec.innerText),
  };
});
const tab = async (v) => { await page.evaluate((v) => [...document.querySelectorAll("#confidence .rd-confidence-tabs button")].find((x) => x.textContent.trim() === v).click(), v); await wait(700); };
const chip = async (lab) => { await page.evaluate((lab) => [...document.querySelectorAll("#confidence .rd-cwin-span")].find((x) => x.textContent.trim() === lab).click(), lab); await wait(700); };
const step = async (i) => { await page.evaluate((i) => document.querySelectorAll("#confidence .rd-cwin-step")[i].click(), i); await wait(700); };
await page.evaluate(() => document.getElementById("confidence").scrollIntoView({ behavior: "instant" }));
await wait(500);

/* ---- the bar */
let s = await state();
ok("opens on This term", s.head === "This term" && s.view === "Consumers" && s.nextOff === true && s.prevOff === false && s.span === "Term", JSON.stringify(s));
await step(0);
s = await state();
ok("‹ steps to the 2022 term", s.head === "The 2022 term" && /May 2022 – May 2025/.test(s.sub) && s.nextOff === false, JSON.stringify(s));
await tab("Inflation & growth");
s = await state();
ok("window holds across a tab switch", s.head === "The 2022 term" && s.panels === 7 && s.badges === 0, JSON.stringify(s));
/* the seven panels, their added lanes by name, and the lanes' latest
   figures straight off the page's own data */
const macroAudit = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("#confidence .rd-xf-now .rd-mp")];
  const titles = cards.map((c) => c.querySelector(".rd-mp-t").textContent.trim());
  const keys = cards.map((c) => [...c.querySelectorAll(".rd-mp-kn")].map((k) => k.textContent.trim()));
  const vals = cards.map((c) => [...c.querySelectorAll(".rd-mp-kv")].map((k) => k.textContent.trim()));
  const M = window.AP.D.macro;
  const lat = (k) => M[k].rows[M[k].rows.length - 1];
  return { titles, keys, vals, prod: lat("prod"), awe: lat("aweReal"), med: lat("oecdUnempMed"), giniMed: lat("oecdGiniMed") };
});
ok("panels: infl/gap/growth/prod/earn/unemp/gini", JSON.stringify(macroAudit.titles) === JSON.stringify(["Inflation", "Inflation against target", "Growth per person", "Productivity", "Earnings", "Unemployment", "Income inequality"]), JSON.stringify(macroAudit.titles));
ok("growth panel keeps its per-person family", macroAudit.keys[2].includes("GDP per person") && macroAudit.keys[2].includes("National income per person") && macroAudit.keys[2].includes("Household income per person") && macroAudit.keys[2].includes("OECD median GDP per person"), JSON.stringify(macroAudit.keys[2]));
ok("productivity panel pairs GDP per hour with the OECD median per worker", macroAudit.keys[3].includes("GDP per hour worked") && macroAudit.keys[3].includes("OECD median per worker"), JSON.stringify(macroAudit.keys[3]));
ok("earnings panel pairs AWE with the OECD median wage", macroAudit.keys[4].includes("Full-time adult weekly earnings") && macroAudit.keys[4].includes("OECD median wage"), JSON.stringify(macroAudit.keys[4]));
ok("unemployment panel carries the OECD median", macroAudit.keys[5].includes("OECD median"), JSON.stringify(macroAudit.keys[5]));
ok("gini panel carries the OECD median country", macroAudit.keys[6].includes("OECD median country"), JSON.stringify(macroAudit.keys[6]));
const N = (s) => (s || "").replace(/\u2212/g, "-");   /* the page prints a typographic minus */
{
  const pr = macroAudit.keys[3].indexOf("GDP per hour worked");
  ok("productivity panel's latest figure is the file's newest print", N(macroAudit.vals[3][pr]) === macroAudit.prod.v.toFixed(1) + "%", N(macroAudit.vals[3][pr]) + " vs file " + macroAudit.prod.v);
  const w = macroAudit.keys[4].indexOf("Full-time adult weekly earnings");
  ok("earn panel's latest figure is the file's newest real-earnings print", N(macroAudit.vals[4][w]) === macroAudit.awe.v.toFixed(1) + "%", N(macroAudit.vals[4][w]) + " vs file " + macroAudit.awe.v);
  const u = macroAudit.keys[5].indexOf("OECD median");
  ok("unemp panel's median figure is the file's newest median", N(macroAudit.vals[5][u]) === macroAudit.med.v.toFixed(1) + "%", N(macroAudit.vals[5][u]) + " vs file " + macroAudit.med.v);
  const gi = macroAudit.keys[6].indexOf("OECD median country");
  ok("gini panel's median figure reads the coefficient and its year", N(macroAudit.vals[6][gi]) === macroAudit.giniMed.v.toFixed(3) + " (" + macroAudit.giniMed.date.slice(0, 4) + ")", N(macroAudit.vals[6][gi]) + " vs file " + JSON.stringify(macroAudit.giniMed));
}
await step(1);
s = await state();
ok("› back to This term (macro: events numbered)", s.head === "This term" && s.badges > 0, JSON.stringify(s));
const macroEnd = await page.evaluate(() => {
  const D = window.AP.D;
  const t = [...document.querySelectorAll("#confidence .rd-xf-now .rd-mp")][0].querySelectorAll(".axis-label.x");
  return { last: t.length ? t[t.length - 1].textContent : null, x1: D.domain.x1 };
});
ok("macro This term ends at now", macroEnd.last === "Now", JSON.stringify(macroEnd));

/* ---- span chips and paging */
await chip("10 yrs");
s = await state();
ok("10 yrs: the last ten years", s.head === "The last 10 years" && s.span === "10 yrs" && s.nextOff === true, JSON.stringify(s));
await step(0);
s = await state();
ok("‹ pages a span back its width", /^[A-Z][a-z]{2} \d{4} – [A-Z][a-z]{2} \d{4}$/.test(s.head) && s.span === "10 yrs", JSON.stringify(s));
await chip("All");
s = await state();
ok("All: every year on record", s.head === "Every year on record" && /^Sep 1949 – now$/.test(s.sub) && s.prevOff && s.nextOff, JSON.stringify(s));
await tab("Businesses");
s = await state();
ok("All clamps to the business run", s.head === "Every year on record" && /^Mar 1997 – now$/.test(s.sub), JSON.stringify(s));
await chip("Term");
s = await state();
ok("Term from All lands on the sitting term", s.head === "This term", JSON.stringify(s));

/* ---- the strip: drag the term window, brush, tap */
const strip = () => page.evaluate(() => {
  const sv = document.querySelector("#confidence .rd-xf-now .rd-cstrip-svg");
  const r = sv.getBoundingClientRect(), w = sv.querySelector(".rd-cstrip-win").getBoundingClientRect();
  return { l: r.left, t: r.top, w: r.width, h: r.height, wl: w.left, wr: w.right };
});
await page.evaluate(() => document.querySelector("#confidence .rd-xf-now .rd-cstrip").scrollIntoView({ behavior: "instant", block: "center" }));
await wait(400);
let g = await strip();
const midY = g.t + 18;
await page.mouse.move((g.wl + g.wr) / 2, midY);
await page.mouse.down();
for (let k = 1; k <= 12; k++) { await page.mouse.move((g.wl + g.wr) / 2 - k * 6, midY); await wait(16); }
const carried = await state();
await page.mouse.up();
await wait(700);
s = await state();
ok("dragging a term window names the term under it", /term$/.test(carried.head) && carried.head !== "This term", JSON.stringify(carried));
ok("…and snaps to a term on release", /^The \d{4} term$/.test(s.head) && s.span === "Term", JSON.stringify(s));
g = await strip();
await page.mouse.move(g.l + g.w * 0.1, midY);
await page.mouse.down();
for (let k = 1; k <= 10; k++) { await page.mouse.move(g.l + g.w * 0.1 + k * g.w * 0.02, midY); await wait(16); }
await page.mouse.up();
await wait(700);
s = await state();
ok("brushing open strip draws a custom window", s.span === null && / – /.test(s.head), JSON.stringify(s));
await chip("Term");
g = await strip();
await page.mouse.click(g.l + g.w * 0.3, midY);
await wait(700);
s = await state();
ok("a tap on open strip jumps to the term tapped", /^The \d{4} term$/.test(s.head), JSON.stringify(s));

/* ---- readouts: reset to the sitting term first — the strip tap lands
   on any past term its x maps to, and a Term re-click doesn't reset from
   a term-active window (that's why All goes in between); hovers are then
   exercised in a term every panel's record holds */
await tab("Consumers");
await chip("All");
await chip("Term");
await step(0);
const hoverRows = async (sel) => {
  const box = await page.evaluate((sel) => { const el = document.querySelector(sel); el.scrollIntoView({ behavior: "instant", block: "center" }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  await wait(300);
  await page.mouse.move(box.x + box.w * 0.45, box.y + box.h * 0.5);
  await wait(120);
  await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
  await wait(250);
  return page.evaluate((sel) => { const tip = document.querySelector(sel).closest(".chart").querySelector(".tip"); return tip ? { title: (tip.querySelector(".tip-title") || {}).textContent, rows: tip.querySelectorAll(".tip-row").length } : null; }, sel);
};
let tip = await hoverRows("#confidence .rd-xf-now .rd-confidence-chart .chart svg");
ok("past-term consumer readout has rows", tip && tip.rows >= 2, JSON.stringify(tip));
await tab("Inflation & growth");
for (let i = 0; i < 4; i++) {
  tip = await hoverRows(`#confidence .rd-xf-now .rd-mp:nth-of-type(${i + 1}) .chart svg`);
  ok("macro panel " + (i + 1) + " readout has rows", tip && tip.rows >= 1 && tip.title, JSON.stringify(tip));
}
await page.mouse.move(5, 5);

/* ---- the glide: mid-flight the first panel's Australia line has moved but not landed */
await chip("Term");
await page.evaluate(() => document.querySelector("#confidence .rd-xf-now .rd-mp").scrollIntoView({ behavior: "instant", block: "center" }));
await wait(500);
const pathOf = () => page.evaluate(() => document.querySelector("#confidence .rd-xf-now .rd-mp .series-line").getAttribute("d").slice(0, 60));
const d0 = await pathOf();
const frames = [];
await page.evaluate(() => document.querySelectorAll("#confidence .rd-cwin-step")[0].click());
for (let k = 0; k < 6; k++) {
  await wait(55);
  frames.push(await pathOf());
  if (SHOTS) {
    /* captureBeyondViewport off (a default capture re-lays the page out
       mid-glide), clip still in document coordinates */
    const r = await page.evaluate(() => { const r = document.querySelector("#confidence .rd-xf-now .rd-mp-grid").getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: Math.min(r.height, 420) }; });
    await page.screenshot({ path: path.join(SHOTS, `glide-${k}.png`), captureBeyondViewport: false, clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
  }
}
await wait(500);
const d1 = await pathOf();
const mid = frames.filter((f) => f !== d0 && f !== d1).length;
ok("the step glides (frames between the two windows)", mid >= 2, mid + " in-between frames");

ok("no error boundary", !(await state()).boundary);
ok("no page errors", errors.length === 0, errors.join(" | "));
console.log(fails.length ? `\n${fails.length} failure(s)` : "\nall conf-window checks passed");
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
