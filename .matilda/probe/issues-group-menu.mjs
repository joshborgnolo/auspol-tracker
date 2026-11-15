/* issues-group-menu.mjs — pins the 2026-11-15 "What matters" redesign of
   the issues panel's second view (it replaced the latest-only by-group
   table with trend charts; the probe keeps its old menu-fit duties and
   picks up the new view's contract):
   A. The voters menu reads All voters|Vote|Age|Gender|Education|Place|Home
      ("All" at phone widths), All voters pressed on load.
   B. All voters draws the pooled monthly line, its 95% band and both
      pollsters' dots; issue chips list the full set; an issue switch
      rewrites the chart title; the trend-significance table carries the
      two pollsters.
   C. Vote (or any group set) draws one line per group PLUS the grey
      all-voters reference, end labels readable and non-overlapping, chips
      shrink to the group house's six issues.
   D. The menu FITS: every tab's text sits inside its own slot at every
      rung 320→1280, the row never overflows the card, nothing spills the
      page, and no pageerror ever fires (each page is watched).
   E. An all-voters dot click opens the poll in All polls on the ISSUES
      facet (pollFacet). Dark mode renders the view without a pageerror. */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(1); }
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
let fails = 0;
const ok = (label, cond, detail) => { console.log((cond ? "PASS " : "FAIL ") + label + (detail !== undefined ? `  [${detail}]` : "")); if (!cond) fails++; };

const pageErrors = new Map();   // page → [messages]
const newPage = async (width, height = 1200) => {
  const page = await browser.newPage();
  pageErrors.set(page, []);
  page.on("pageerror", (e) => pageErrors.get(page).push(String(e && e.message || e)));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#issues .rd-is-tabs .rd-tab", { timeout: 30000 });
  await page.evaluate(() => {
    const sec = document.getElementById("issues");
    const b = [...sec.querySelectorAll(".rd-is-tabs .rd-tab")].find((t) => /^\s*what matters\s*$/i.test(t.textContent));
    if (b) b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector("#issues .rd-iw .rd-tab, #issues .rd-iw-chip", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 700));
  return page;
};

const readCard = (page) => page.evaluate(() => {
  const sec = document.getElementById("issues");
  const card = sec.querySelector(".rd-iw");
  const menu = card && card.querySelector(".rd-iw-tabs");
  const out = { pageW: document.documentElement.clientWidth, scrollW: sec.scrollWidth };
  out.hed = (sec.querySelector(".rd-hed") || {}).textContent || "";
  out.dek = (sec.querySelector(".rd-dek") || {}).textContent || "";
  out.head4 = (card.querySelector(".rd-is-chead") || {}).textContent || "";
  out.srcTitle = ((card.querySelector(".rd-iw-src b") || {}).textContent || "").trim();
  out.chips = [...card.querySelectorAll(".rd-iw-chip")].map((c) => c.textContent.trim());
  out.svg = !!card.querySelector("svg");
  out.linePaths = card.querySelectorAll("svg path").length;
  out.legend = [...card.querySelectorAll(".rd-key .rd-key-item")].map((k) => k.textContent.trim());
  out.legendCount = out.legend.length;
  out.dots = [...card.querySelectorAll("svg circle.scatter-dot")].filter((c) => c.getAttribute("fill") !== "var(--chart-bg)").length;
  out.bands = card.querySelectorAll("svg .ci-band, svg path[data-area], svg path.ci-band").length;
  out.endLabels = [...card.querySelectorAll("svg text")].map((t) => t.textContent).filter(Boolean);
  if (!menu) { out.chipsOnly = true; return out; }
  const row = menu.querySelector('[role="group"]');
  const mr = row.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  out.pressed = [...row.querySelectorAll("button")].findIndex((b) => b.getAttribute("aria-pressed") === "true");
  out.row = { l: Math.round(mr.left * 10) / 10, r: Math.round(mr.right * 10) / 10 };
  out.card = { l: Math.round(cr.left * 10) / 10, r: Math.round(cr.right * 10) / 10 };
  out.tabs = [...row.querySelectorAll("button")].map((b) => {
    const r = b.getBoundingClientRect();
    return { label: b.textContent, l: Math.round(r.left * 10) / 10, r: Math.round(r.right * 10) / 10, w: Math.round(r.width * 10) / 10,
             textOverflow: Math.round((b.scrollWidth - b.clientWidth) * 10) / 10,
             insideRow: r.left >= mr.left - 0.6 && r.right <= mr.right + 0.6,
             insideCard: r.right <= cr.right + 0.6 };
  });
  /* end-label collisions in the chart's right-hand label zone (the axis
     ticks live elsewhere): the engine's cluster dodge packs labels with
     hairline glyph-box overlaps by design, so only a vertical overlap
     deeper than 4px (about a third of the line height — where glyphs
     actually touch) counts as a collision */
  {
    const svgR = card.querySelector("svg").getBoundingClientRect();
    const rects = [...card.querySelectorAll("svg text")].map((t) => t.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0 && (r.left + r.right) / 2 > svgR.right - 160);
    let collisions = 0;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 4) collisions++;
    }
    out.labelCollisions = collisions;
  }
  return out;
});

const clickTab = (page, label) => page.evaluate((lab) => {
  const sec = document.getElementById("issues");
  const b = [...sec.querySelectorAll(".rd-iw-tabs .rd-tab")].find((t) => t.textContent.trim() === lab);
  if (!b) return false;
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
}, label);

const clickChip = (page, label) => page.evaluate((lab) => {
  const b = [...document.querySelectorAll("#issues .rd-iw-chip")].find((t) => new RegExp("^" + lab, "i").test(t.textContent.trim()));
  if (!b) return false;
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
}, label);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- A/B: all voters at 1280 --------------------------------------------- */
{
  const page = await newPage(1280);
  const m = await readCard(page);
  ok("A: menu reads All voters then the six group sets",
     m.tabs && m.tabs.map((t) => t.label).join("|") === "All voters|Vote|Age|Gender|Education|Place|Home",
     m.tabs && m.tabs.map((t) => t.label).join("|"));
  ok("A: All voters pressed on load", m.pressed === 0, `pressed ${m.pressed}`);
  ok("B: head and dek generated", /tops what matters/.test(m.hed) && m.dek.length > 30, m.hed);
  ok("B: all-voters chart: line, band and both pollsters' dots", m.svg && m.linePaths >= 2 && m.bands >= 1 && m.dots >= 15, `lines ${m.linePaths} bands ${m.bands} dots ${m.dots}`);
  ok("B: every tracked issue is a chip", m.chips.length >= 8, m.chips.join("|"));
  ok("B: no end-label collisions", m.labelCollisions === 0, `${m.labelCollisions}`);
  /* switch the issue */
  const picked = await clickChip(page, "Immigration");
  await sleep(700);
  const m2 = await readCard(page);
  ok("B: clicking Immigration rewrites the chart title", picked && /Immigration/.test(m2.srcTitle), m2.srcTitle);
  ok("B: chart keeps its lines and band through the morph", m2.svg && m2.linePaths >= 2 && m2.bands >= 1);
  /* the all-voters trend table names the two pollsters */
  const tsig = await page.evaluate(() => {
    const d = document.querySelector("#issues .rd-iw details.rd-tsig");
    return d ? { text: d.textContent, rows: d.querySelectorAll("tbody tr").length, head: (d.querySelector("thead th") || {}).textContent || "" } : null;
  });
  ok("B: trend table names both pollsters", !!tsig && /Pollster/.test(tsig.head) && /Ipsos/.test(tsig.text) && /RedBridge/.test(tsig.text) && tsig.rows === 2,
     tsig ? `${tsig.rows} rows, head ${tsig.head.slice(0, 20)}` : "no fold");
  /* into a group set */
  ok("click Vote", await clickTab(page, "Vote"), "Vote tab present");
  await sleep(700);
  const g = await readCard(page);
  ok("C: chips shrink to the group house's six issues", g.chips.length === 6, g.chips.join("|"));
  ok("C: one line per group plus the grey all-voters reference", g.svg && g.linePaths >= 8, `lines ${g.linePaths}`);
  /* every line is identified by the legend whatever the engine does with
     end labels; live lines carry their labels where the stack fits */
  ok("C: legend names every line incl. All voters", g.legendCount >= 8 && g.legend.some((t) => /All voters/.test(t)) && g.legend.some((t) => /Labor/.test(t)), g.legend.join("|"));
  ok("C: live lines carry end labels where the stack fits", g.endLabels.some((t) => /All voters/.test(t)) && g.endLabels.filter((t) => !/^[\d%’ ]+$/.test(t)).length >= 2,
     g.endLabels.filter((t) => !/^[\d%’ ]+$/.test(t)).join("|"));
  ok("C: no end-label collisions", g.labelCollisions === 0, `${g.labelCollisions}`);
  const gTsig = await page.evaluate(() => {
    const d = document.querySelector("#issues .rd-iw details.rd-tsig");
    return d ? { text: d.textContent, head: (d.querySelector("thead th") || {}).textContent || "" } : null;
  });
  ok("C: trend table switches to groups", !!gTsig && /Group/.test(gTsig.head) && /One Nation/.test(gTsig.text), gTsig && gTsig.head.slice(0, 20));
  ok("no pageerrors (all-voters + vote)", (pageErrors.get(page) || []).length === 0, (pageErrors.get(page) || []).join("; ").slice(0, 200));
  await page.close();
}

/* ---- D: phone 390 --------------------------------------------------------- */
{
  const page = await newPage(390, 844);
  const m = await readCard(page);
  ok("390: menu reads All then the six group sets", m.tabs && m.tabs.map((t) => t.label).join("|") === "All|Vote|Age|Gender|Education|Place|Home",
     m.tabs && m.tabs.map((t) => t.label).join("|"));
  if (m.tabs) {
    const maxOver = Math.max(...m.tabs.map((t) => t.textOverflow));
    ok("390: no tab's text overflows its slot", maxOver <= 0.5, `worst ${maxOver}px (${m.tabs.map((t) => `${t.label}:${t.w}/${t.textOverflow}`).join(" ")})`);
    ok("390: every tab inside row and card", m.tabs.every((t) => t.insideRow && t.insideCard),
       `row ${JSON.stringify(m.row)} card ${JSON.stringify(m.card)}`);
  }
  ok("390: no horizontal page spill", m.scrollW <= m.pageW + 1, `scrollW ${m.scrollW} vs ${m.pageW}`);
  ok("390: all-voters chart renders", m.svg && m.dots >= 15, `dots ${m.dots}`);
  ok("390: Age switches to groups", await clickTab(page, "Age"), "Age tab present");
  await sleep(700);
  const m2 = await readCard(page);
  ok("390: group view draws its lines", m2.svg && m2.linePaths >= 5, `lines ${m2.linePaths}`);
  ok("390: the legend identifies every line (labels may all drop at phone height)", m2.legendCount >= 5 && m2.legend.some((t) => /All voters/.test(t)), m2.legend.join("|"));
  ok("390: no end-label collisions", m2.labelCollisions === 0, `${m2.labelCollisions}`);
  ok("390: back to All restores the pooled chart", await clickTab(page, "All"), "All tab present");
  await sleep(700);
  const m3 = await readCard(page);
  ok("390: all-voters state back", m3.pressed === 0 && m3.dots >= 15, `dots ${m3.dots}`);
  ok("no pageerrors (390)", (pageErrors.get(page) || []).length === 0, (pageErrors.get(page) || []).join("; ").slice(0, 200));
  await page.close();
}

/* ---- D: narrow rungs 320/341/360/400 ------------------------------------- */
for (const vw of [320, 341, 360, 400]) {
  const page = await newPage(vw, 700);
  const m = await readCard(page);
  ok(`${vw}: seven tabs render`, !!m.tabs && m.tabs.length === 7, m.tabs && m.tabs.length);
  if (m.tabs) {
    const maxOver = Math.max(...m.tabs.map((t) => t.textOverflow));
    ok(`${vw}: no tab's text overflows its slot`, maxOver <= 0.5, `worst ${maxOver}px (${m.tabs.map((t) => `${t.label}:${t.w}`).join(" ")})`);
    ok(`${vw}: every tab inside row and card`, m.tabs.every((t) => t.insideRow && t.insideCard),
       `tabs ${m.tabs.map((t) => `${t.label}[${t.l}→${t.r}]`).join(" ")}`);
  }
  ok(`${vw}: no horizontal page spill`, m.scrollW <= m.pageW + 1, `scrollW ${m.scrollW} vs ${m.pageW}`);
  ok(`no pageerrors (${vw})`, (pageErrors.get(page) || []).length === 0, (pageErrors.get(page) || []).join("; ").slice(0, 200));
  await page.close();
}

/* ---- E: dark mode --------------------------------------------------------- */
{
  const page = await browser.newPage();
  pageErrors.set(page, []);
  page.on("pageerror", (e) => pageErrors.get(page).push(String(e && e.message || e)));
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#issues .rd-is-tabs .rd-tab", { timeout: 30000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("#issues .rd-is-tabs .rd-tab")].find((t) => /^\s*what matters\s*$/i.test(t.textContent));
    if (b) b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await sleep(800);
  const m = await readCard(page);
  ok("dark: all-voters chart renders", m.svg && m.dots >= 15, `dots ${m.dots}`);
  await clickTab(page, "Vote");
  await sleep(700);
  const m2 = await readCard(page);
  ok("dark: group lines render", m2.svg && m2.linePaths >= 8, `lines ${m2.linePaths}`);
  ok("dark: no pageerrors", (pageErrors.get(page) || []).length === 0, (pageErrors.get(page) || []).join("; ").slice(0, 200));
  await page.close();
}

/* ---- E: dot click opens the poll on the ISSUES facet ---------------------- */
{
  const page = await browser.newPage();
  pageErrors.set(page, []);
  page.on("pageerror", (e) => pageErrors.get(page).push(String(e && e.message || e)));
  await page.setViewport({ width: 1280, height: 1200, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#issues .rd-is-tabs .rd-tab", { timeout: 30000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("#issues .rd-is-tabs .rd-tab")].find((t) => /^\s*what matters\s*$/i.test(t.textContent));
    if (b) b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector("#issues .rd-iw svg", { timeout: 15000 });
  await sleep(800);
  const dot = await page.evaluate(() => {
    const svg = document.querySelector("#issues .rd-iw svg");
    svg.scrollIntoView({ block: "center" });
    const cs = [...svg.querySelectorAll("circle.scatter-dot")].filter((c) => c.getAttribute("fill") !== "var(--chart-bg)");
    if (!cs.length) return null;
    const r = cs[cs.length - 1].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, n: cs.length };
  });
  ok("E: all-voters chart renders poll dots", !!dot && dot.n > 2, dot && `${dot.n} solid dots`);
  if (dot) {
    await page.mouse.move(dot.x - 30, dot.y - 30);
    await sleep(150);
    await page.mouse.move(dot.x, dot.y);
    await sleep(300);
    await page.mouse.click(dot.x, dot.y);
    let landed = null;
    try {
      await page.waitForFunction(() => location.pathname === "/allpolls/" && document.querySelector(".rd-ap-tabs button"), { timeout: 10000 });
      landed = await page.evaluate(() => {
        const active = ([...document.querySelectorAll(".rd-ap-tabs button")].find((b) => b.getAttribute("aria-pressed") === "true") || {}).textContent || null;
        return { active, open: !!document.querySelector(".rd-ap-open") };
      });
    } catch {}
    ok("E: dot click lands in All polls on the Issues facet", !!landed && landed.active === "Issues", landed && `facet: ${landed.active}`);
    ok("E: the clicked poll opens", !landed || landed.open === true, landed && `open: ${landed.open}`);
  }
  ok("E: no pageerrors", (pageErrors.get(page) || []).length === 0, (pageErrors.get(page) || []).join("; ").slice(0, 200));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILURES` : "ALL OK — issues what-matters probe");
process.exit(fails ? 1 : 0);
