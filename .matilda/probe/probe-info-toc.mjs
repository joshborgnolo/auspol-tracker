/* Probe: the Info tab's redesign anatomy (InfoView in the d1a1d215 asset,
   CSS rd.css's info block + the template's classic keep-alive rules).

   The Info tab takes the same head as every tab (sans kicker "Info · How
   the site works", serif headline, deck), its document heads are serif,
   and its contents list names destinations instead of numbering them:
   a rail beside the text at >=1100px, a pinned "Contents" disclosure under
   that. The panel explainers group under "The panels". The change log
   moved out of About into the ☰ menu's own /changelog/ tab page on
   2026-10-15 (About keeps a one-line signpost to it).

   Asserts headlessly against BASE (repo root or a worktree), served over
   http (the tab documents write urls on navigation):
     - the tab head exists and the headline computes in the serif stack;
     - chapter heads (About / Questions / How the figures are built / The
       panels) and the twelve panel heads carry no .info-num spans and
       compute serif; the body's run-in entries stay sans;
     - 1366px: the rail is a stacked sticky column left of the text, the
       disclosure is hidden, the panels indent under "The panels"; the
       list holds 3 chapters + caption + 12 panels; no 44px hit overlays;
     - the spy lights About at the top, follows a rail pick (scroll,
       aria-current, the inset-bar lit style), and re-lights last at the
       page bottom;
     - 800px and 390px: the rail is hidden, the disclosure is a one-line
       pinned bar carrying the current destination; it opens to the same
       16 entries, a pick jumps and shuts the sheet, the scrim shuts it
       too, and the document never overflows horizontally;
     - About's change log lists at most three entries;
     - no page errors on any rung. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import { readFile } from "node:fs/promises";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }
const BASE = path.resolve(process.cwd(), process.env.BASE || path.join(fileURLToPath(import.meta.url), "../../.."));
const PORT = 8974;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ========================= sources (node-side) ========================= */
console.log("sources:");
const viewsFile = fs.readdirSync(path.join(BASE, ".build/newtracker/assets")).find((f) => f.startsWith("d1a1d215-") && f.endsWith(".js"));
const views = viewsFile ? fs.readFileSync(path.join(BASE, ".build/newtracker/assets", viewsFile), "utf8") : "";
check(!views.includes("secNum"), "the outline numbering (4.1–4.12) is gone from InfoView");
check(views.includes('"info-about", "About"') && views.includes('"info-method", "How the figures are built"'),
  "InfoView lists the chapter entries by name");
check(views.includes('tocBtn(PANELS_ID, "The panels", "info-toc-g")'), "the panel explainers group under The panels caption");
check(views.includes("info-toc-btn") && views.includes("tocOpen"), "the pinned Contents disclosure is stateful");
check(!views.includes('className="info-num"') && !views.includes("info-num"), "no .info-num spans remain in the views asset");
const rd = fs.readFileSync(path.join(BASE, ".build/newtracker/assets/rd.css"), "utf8");
check(/\.info-h \{[^}]*font-family: var\(--serif\)/.test(rd.replace(/\s+/g, " ")) || rd.includes("font-family: var(--serif); font-size: 28px"),
  "chapter heads take the serif display face in rd");
check(rd.includes("grid-template-columns: 204px minmax(0, 1fr)"), "the rail grid sits beside the text at >=1100px");
check(rd.includes(".info-index button::after { content: none; }"), "the 44px hit overlays come off the stacked rail");
check(rd.includes("body.rd .info-toc { display: block; position: sticky"), "the disclosure pins under 1100px");
const tpl = fs.readFileSync(path.join(BASE, ".build/newtracker/template.html"), "utf8");
check(tpl.includes(".info-toc { display: none; }"), "the base template keeps the disclosure out of the classic design");

/* ============================ browser ============================ */
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const body = await readFile(path.join(BASE, p));
    res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

async function open(width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/info/`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("section.info", { timeout: 30000 });
  await sleep(350);
}

const PANEL_TITLES = ["Two-party preferred", "Primary vote", "Latest and next polls", "Leadership",
  "National direction", "Who votes for whom", "Where One Nation’s voters came from", "The issues",
  "Decidedness", "Economic sentiment", "Past cycles", "All polls"];

/* --------------------------- head + heads --------------------------- */
await open(1366, 980);
console.log("tab head + document heads (1366px):");
const head = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const t = q(".info .rd-eyebrow .rd-title"), m = q(".info .rd-eyebrow .rd-meta");
  const hed = q(".info .rd-hed"), dek = q(".info .rd-dek");
  const bodySans = getComputedStyle(q(".rd-title")).fontFamily;
  return {
    title: t && t.textContent, meta: m && m.textContent,
    hed: hed && hed.textContent, hedFont: hed && getComputedStyle(hed).fontFamily,
    dek: dek && dek.textContent, sans: bodySans,
  };
});
check(head.title === "Info" && head.meta === "How the site works", `the sans kicker reads "Info · How the site works" (got "${head.title} · ${head.meta}")`);
check(!!head.hed && head.hedFont !== head.sans && /Crimson|Georgia|serif/.test(head.hedFont),
  `the headline sets in the serif stack (${head.hedFont})`);
check(!!head.dek && head.dek.length > 40, "a deck paragraph follows the headline");

const heads = await page.evaluate(() => {
  const fam = (el) => (el ? getComputedStyle(el).fontFamily : "");
  const h2s = [...document.querySelectorAll("h2.info-h")].map((h) => ({ text: h.textContent.trim(), font: fam(h) }));
  const h3s = [...document.querySelectorAll("h3.info-group")].map((h) => ({ text: h.textContent.trim(), font: fam(h) }));
  const runin = document.querySelector(".info-term .info-t");
  return {
    h2s, h3s,
    nums: document.querySelectorAll(".info .info-num").length,
    runinFont: runin ? fam(runin) : "",
    runinWeight: runin ? getComputedStyle(runin).fontWeight : "",
  };
});
check(heads.h2s.map((h) => h.text).join("|") === "About|Questions|How the figures are built|The panels",
  `the four chapter heads are named, unnumbered (got ${heads.h2s.map((h) => h.text).join(" / ")})`);
check(heads.h3s.length === 12 && heads.h3s.every((h, i) => h.text === PANEL_TITLES[i]),
  "the twelve panel heads name the panels in page order");
check(heads.nums === 0, "no .info-num spans anywhere on the page");
check(heads.h2s.every((h) => h.font === heads.h2s[0].font) && heads.h2s[0].font !== heads.runinFont
  && heads.h3s.every((h) => h.font === heads.h2s[0].font),
  "chapter and panel heads share the serif face, distinct from the body sans");
check(parseInt(heads.runinWeight, 10) >= 600, "the body's run-in labels stay bold");

/* ------------------------------- rail ------------------------------- */
console.log("rail (1366px):");
const rail = await page.evaluate(() => {
  const idx = document.querySelector(".info-index");
  const btns = [...idx.querySelectorAll("button")];
  const col = document.querySelector(".info-cols");
  const about = document.getElementById("info-about");
  const br = (el) => el.getBoundingClientRect();
  const panelBtn = idx.querySelector(".info-toc-p");
  const chapBtn = idx.querySelector(".info-toc-c");
  return {
    colsDisplay: getComputedStyle(col).display,
    idxPos: getComputedStyle(idx).position,
    tops: btns.map((b) => Math.round(br(b).top)),
    stacked: btns.every((b, i) => i === 0 || br(btns[i - 1]).top < br(b).top),
    leftOfText: br(btns[0]).right < br(about).left,
    count: btns.length,
    caption: (idx.querySelector(".info-toc-g") || {}).textContent || "",
    panelPad: Math.round(parseFloat(getComputedStyle(panelBtn).paddingLeft)),
    chapPad: Math.round(parseFloat(getComputedStyle(chapBtn).paddingLeft)),
    hitOverlay: getComputedStyle(btns[5], "::after").content,
    tocHidden: getComputedStyle(document.querySelector(".info-toc")).display === "none",
    labels: btns.map((b) => b.textContent.trim()),
  };
});
check(rail.colsDisplay === "grid", `the page splits into rail + text columns (${rail.colsDisplay})`);
check(rail.idxPos === "sticky", `the rail is pinned (${rail.idxPos})`);
check(rail.stacked && new Set(rail.tops).size === rail.tops.length, "the rail stacks its entries vertically");
check(rail.leftOfText, "the rail sits left of the text column");
check(rail.count === 16, `16 contents entries (3 chapters + caption + 12 panels; got ${rail.count})`);
check(rail.caption === "The panels", `the panel group caption reads "The panels" (got "${rail.caption}")`);
check(rail.panelPad - rail.chapPad >= 10, `the panel entries indent under the caption (+${rail.panelPad - rail.chapPad}px)`);
check(rail.hitOverlay === "none", "the 44px hit overlays are off the stacked rail");
check(rail.tocHidden, "the phone disclosure stays hidden at this width");
check(rail.labels.slice(0, 3).join("|") === "About|Questions|How the figures are built"
  && PANEL_TITLES.every((t, i) => rail.labels[4 + i] === t),
  "every entry lists its name, no numbers");

const litAt = await page.evaluate(() => {
  const b = document.querySelector(".info-index button.on");
  if (!b) return null;
  const cs = getComputedStyle(b);
  return { label: b.textContent.trim(), aria: b.getAttribute("aria-current"),
    weight: cs.fontWeight, shadow: cs.boxShadow };
});
check(!!litAt && litAt.label === "About" && litAt.aria === "true", `About opens lit with aria-current (${litAt && litAt.label})`);
check(!!litAt && parseInt(litAt.weight, 10) >= 600 && /inset/.test(litAt.shadow) && litAt.shadow !== "none",
  `the lit entry carries ink + 600 + the inset bar (${litAt && litAt.weight}, ${litAt && litAt.shadow})`);

console.log("scroll spy (1366px):");
const pickIdx = 12; // "Decidedness" panel entry
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
await sleep(200);
await page.evaluate((i) => document.querySelectorAll(".info-index button")[i].click(), pickIdx);
await sleep(1700); // # intentional-sleep: the jump is a smooth glide; the spy walks with it
const after = await page.evaluate(() => {
  const on = document.querySelector(".info-index button.on");
  const cur = document.querySelector('.info-index [aria-current="true"]');
  return { on: on && on.textContent.trim(), cur: cur && cur.textContent.trim(), y: window.scrollY,
    err: document.elementFromPoint(innerWidth / 2, 70) && document.elementFromPoint(innerWidth / 2, 70).closest(".info-index") ? "rail over text" : "" };
});
check(after.on === "Decidedness", `the lit rail entry walks to the pick (got ${after.on})`);
check(after.cur === "Decidedness", "aria-current moved with it");
check(after.y > 500, `the page scrolled to the panel (scrollY ${after.y.toFixed(0)})`);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await sleep(600);
const lastLit = await page.evaluate(() => (document.querySelector(".info-index button.on:last-of-type") || {}).textContent
  || (document.querySelector(".info-index button.on") || {}).textContent || "");
check(lastLit === "All polls", `the page bottom lights the last panel (got ${lastLit})`);

/* ------------------------- mid-width (800px) ------------------------- */
console.log("disclosure (800px):");
await open(800, 980);
const mid = await page.evaluate(() => {
  const toc = document.querySelector(".info-toc");
  const btn = document.querySelector(".info-toc-btn");
  return {
    tocShown: getComputedStyle(toc).display !== "none" && getComputedStyle(toc).position === "sticky",
    railGone: getComputedStyle(document.querySelector(".info-index")).display === "none",
    oneLine: Math.round(btn.getBoundingClientRect().height),
    hasList: !!document.querySelector(".info-toc-list"),
    on: (document.querySelector(".info-toc-on") || {}).textContent || "",
  };
});
check(mid.tocShown, "the disclosure bar pins below the tab bar");
check(mid.railGone, "the rail is hidden under 1100px");
check(mid.oneLine < 48, `the shut bar is one line high (${mid.oneLine}px)`);
check(!mid.hasList, "the sheet starts shut");
check(mid.on.length > 0, `the shut bar names the current destination ("${mid.on}")`);

/* ----------------------------- phone ----------------------------- */
console.log("phone disclosure (390px):");
await open(390, 780);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
await sleep(300);
await page.evaluate(() => document.querySelector(".info-toc-btn").click());
await sleep(250); // let React render the open sheet
const ph = await page.evaluate(() => {
  const btn = document.querySelector(".info-toc-btn");
  const list = document.querySelector(".info-toc-list");
  return {
    open: !!list,
    expanded: btn.getAttribute("aria-expanded"),
    count: list ? list.querySelectorAll("button").length : 0,
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      || document.body.scrollWidth > document.documentElement.clientWidth,
    caption: list && list.querySelector(".info-toc-g") ? list.querySelector(".info-toc-g").textContent : "",
  };
});
check(ph.open && ph.expanded === "true", "tapping the bar opens the sheet (aria-expanded true)");
check(ph.count === 16, `the sheet lists all 16 entries (${ph.count})`);
check(ph.caption === "The panels", "the sheet groups the panels under the caption");
check(!ph.docOverflow, "the document never overflows horizontally");

const jumped = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".info-toc-list button")];
  const b = btns.find((x) => x.textContent.trim() === "Decidedness");
  b.click();
  return new Promise((r) => setTimeout(() => r({ y: window.scrollY, open: !!document.querySelector(".info-toc-list") }), 1500));
});
check(jumped.y > 500, `a sheet pick jumps the page (scrollY ${jumped.y.toFixed(0)})`);
check(!jumped.open, "the pick shuts the sheet");
const phoneSpy = await page.evaluate(() => ({
  lit: (document.querySelector(".info-toc .info-toc-on") || {}).textContent || "",
}));
check(phoneSpy.lit === "Decidedness", `the shut bar now names the picked section ("${phoneSpy.lit}")`);

/* the scrim shuts a re-opened sheet */
await page.evaluate(() => { document.querySelector(".info-toc-btn").click(); });
await sleep(250);
const scrim = await page.evaluate(() => {
  const before = !!document.querySelector(".info-toc-list");
  if (document.querySelector(".info-toc-scrim")) document.querySelector(".info-toc-scrim").click();
  return { before };
});
await sleep(250);
scrim.after = await page.evaluate(() => !!document.querySelector(".info-toc-list"));
check(scrim.before && !scrim.after, "the scrim shuts the open sheet");

const clog = await page.evaluate(() => document.querySelectorAll(".info-changelog li").length);
check(clog === 0, `About no longer lists change-log entries – they moved to the Changelog menu page (${clog})`);

check(pageErrors.length === 0, `no page errors on any rung${pageErrors.length ? ": " + pageErrors.join(" | ") : ""}`);

await browser.close();
server.close();
if (fails.length) { console.error(`\n${fails.length} FAILURES`); process.exit(1); }
console.log("\nprobe-info-toc: all green");
