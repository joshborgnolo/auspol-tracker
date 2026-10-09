/* Assert RdConfidence's "Show complete history" toggle against the
   freshly built worktree: toggle on → calendar-year ticks, hist key row,
   "Back to this term" label, no error boundary; toggle back → the
   months-into-term controls return. */
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

const clickButtonMatching = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, "i");
  const btn = [...document.querySelectorAll("button")]
    .find((el) => rx.test(el.textContent.trim()));
  if (btn) btn.click();
  return !!btn;
}, re.source);

const readState = () => page.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find((s) =>
    /Economic sentiment/.test(s.textContent || ""));
  if (!sec) return { found: false };
  const t = sec.innerText;
  return {
    found: true,
    boundary: t.includes("hit an error"),
    histLabel: t.includes("Show complete history"),
    backLabel: t.includes("Back to this term"),
    /* the draw-a-term menu's options carry year text ("1990" is a term
       on file), so the calendar ruler is asked for its OWN tick text */
    tick1990: [...sec.querySelectorAll("svg text")].some((el) => el.textContent.trim() === "1990"),
    drawTerm: !!sec.querySelector("select.rd-confidence-sel"),
    histKey: t.includes("Monthly history back to 1973"),
  };
});

const fails = [];
const check = (name, got, want) => {
  const miss = Object.entries(want).filter(([k, v]) => got[k] !== v);
  if (miss.length) fails.push(`${name}: ${miss.map(([k, v]) => `${k}=${got[k]} want ${v}`).join(", ")}`);
  else console.log(`${name}: ok`);
};

const s0 = await readState();
check("term view", s0, { found: true, boundary: false, histLabel: true, backLabel: false, tick1990: false, drawTerm: true });

const clicked = await clickButtonMatching(/Show complete history/);
if (!clicked) { fails.push("toggle button not found"); }
await new Promise((r) => setTimeout(r, 800));
const s1 = await readState();
check("history view", s1, { found: true, boundary: false, backLabel: true, tick1990: true, drawTerm: false, histKey: true });

/* the complete-history lines answer to the pointer: hover across the deep
   years and expect a guide tooltip titled with a pre-2000 month whose rows
   are the "(monthly history)" lanes */
await page.evaluate(() => document.getElementById("confidence").scrollIntoView());
await new Promise((r) => setTimeout(r, 400));
const rect = await page.evaluate(() => {
  const svg = document.querySelector("#confidence .rd-confidence-chart svg.chart-svg");
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
if (!rect) fails.push("confidence chart svg not found");
else {
  /* the axis runs 1973 → now: sweep fractions across it, reading whichever
     tooltip fires (a dot tip in the live window is fine there - the dots
     cover it; the guide is what the deep lanes rely on) */
  const tips = [];
  for (const fr of [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.93]) {
    await page.mouse.move(rect.x + rect.w * fr, rect.y + rect.h * 0.5);
    await new Promise((r) => setTimeout(r, 250));
    const t = await page.evaluate(() => {
      const tip = document.getElementById("confidence").querySelector(".tip");
      if (!tip) return null;
      return { guide: tip.classList.contains("tip-guide"),
               title: (tip.querySelector(".tip-title") || {}).textContent || "",
               rows: [...tip.querySelectorAll(".tip-label")].map((el) => el.textContent) };
    });
    if (t) tips.push(t);
  }
  const deep = tips.filter((t) => t.guide).find((t) => /\b19\d\d\b/.test(t.title));
  if (!deep) fails.push("no 19xx guide tooltip seen over the deep years: " + JSON.stringify(tips));
  else if (!deep.rows.some((l) => /monthly history/.test(l)))
    fails.push("deep tooltip lacks a monthly-history row: " + JSON.stringify(deep));
  else console.log(`deep-lane tooltip: ok (${deep.title} -> ${deep.rows.join(" | ")})`);
  const recent = tips.find((t) => /20(2[5-9]|3\d)/.test(t.title) || /\b20\d\d/.test(JSON.stringify(t.rows)));
  if (!recent) fails.push("no tooltip (guide or dot) seen in the recent years: " + JSON.stringify(tips));
  else console.log(`recent-window tooltip: ok (${recent.title || recent.rows[0]}, ${recent.guide ? "guide" : "dot"})`);
}

await clickButtonMatching(/^Back to this term$/);
await new Promise((r) => setTimeout(r, 800));
const s2 = await readState();
check("back to term", s2, { found: true, boundary: false, histLabel: true, backLabel: false, tick1990: false, drawTerm: true });

/* ---- draw a past term: EVERY lifted term line renders smoothed (the
   same kernel the monthly gauges get — a curve path, not straight
   segments) and DOTTED in its house's colour; the consumer twin is the
   gold Westpac–MI read of the same year. The business view stays
   single — the term menu draws Roy Morgan alone, no NAB twin. */
const seriesInfo = (id) => page.evaluate((sid) => {
  const sec = document.getElementById("confidence");
  const p = [...sec.querySelectorAll("svg path")].find((el) =>
    el.getAttribute("data-series") === sid && !el.closest(".rd-crossfade-out"));
  return p ? { stroke: p.getAttribute("stroke"), dash: p.getAttribute("stroke-dasharray"),
               curve: /c/i.test(p.getAttribute("d") || "") } : null;
}, id);
/* the draw-a-term menu is a native select (the subpopulation menu's
   control and style): set its value and fire its change to lift a term */
const pickTerm = (yr) => page.evaluate((y) => {
  const sec = document.getElementById("confidence");
  const sel = sec && [...sec.querySelectorAll("select.rd-confidence-sel")]
    .find((el) => !el.closest(".rd-crossfade-out"));
  if (!sel || ![...sel.options].some((o) => o.value === y)) return false;
  sel.value = y;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, String(yr));
const clearGhost = async () => {
  for (let i = 0; i < 20; i++) {
    if (await page.evaluate(() => !document.querySelector(".rd-crossfade-out"))) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  fails.push("crossfade ghost never cleared");
};
if (s2.found && s2.drawTerm) {
  if (await pickTerm(2019)) {
    await new Promise((r) => setTimeout(r, 500));
    const cm = await seriesInfo("conf-term-2019"), ct = await seriesInfo("conf-term-2019-alt");
    if (!cm) fails.push("consumer 2019: main term line missing");
    else {
      if (cm.stroke !== "var(--confidence-main)") fails.push("consumer 2019: main line stroke is " + cm.stroke);
      if (cm.dash !== "0.1 3.6") fails.push("consumer 2019: main line not dotted: dash=" + cm.dash);
      if (!cm.curve) fails.push("consumer 2019: main line not a smoothed curve");
    }
    if (!ct) fails.push("consumer 2019: Westpac–MI dotted twin missing");
    else {
      if (ct.stroke !== "var(--confidence-alt)" || ct.dash !== "0.1 3.6")
        fails.push("consumer 2019: twin is not a gold dotted line: " + JSON.stringify(ct));
      if (ct.stroke === "var(--confidence-alt)" && !ct.curve) fails.push("consumer 2019: twin not a smoothed curve");
    }
    if (cm && ct && cm.dash === "0.1 3.6" && ct.dash === "0.1 3.6" && cm.curve && ct.curve)
      console.log("consumer 2019: plum + gold smoothed curves, both dotted(" + cm.dash + ") — ok");
  } else fails.push("consumer view: 2019 option not offered by the draw-a-term menu");
  await clickButtonMatching(/^Businesses$/);
  await clearGhost();
  await new Promise((r) => setTimeout(r, 400));
  if (await pickTerm(2019)) {
    await new Promise((r) => setTimeout(r, 500));
    const bm = await seriesInfo("conf-term-2019"), bt = await seriesInfo("conf-term-2019-alt");
    if (!bm) fails.push("business 2019: main term line missing");
    else {
      if (bm.stroke !== "var(--confidence-main)") fails.push("business 2019: main line stroke is " + bm.stroke);
      if (bm.dash !== "0.1 3.6") fails.push("business 2019: main line not dotted: dash=" + bm.dash);
      if (!bm.curve) fails.push("business 2019: main line not a smoothed curve");
    }
    if (bt) fails.push("business 2019: unexpected twin (the business view draws no twin)");
    if (bm && !bt && bm.dash === "0.1 3.6" && bm.curve) console.log("business 2019: single dotted smoothed plum term line, no twin — ok");
  } else fails.push("business view: 2019 option not offered by the draw-a-term menu");
}

if (errors.length) fails.push("js errors: " + errors.join(" ;; ").slice(0, 400));
await browser.close(); server.close();
if (fails.length) { console.log("FAIL\n" + fails.join("\n")); process.exit(1); }
console.log("NO BOUNDARY — toggle round-trip verified");
