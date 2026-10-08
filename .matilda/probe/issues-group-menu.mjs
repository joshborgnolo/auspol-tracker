/* issues-group-menu.mjs — pins the 2026-09-30 issues-panel grouping switcher:
   A. The "What matters to whom" grouping menu reads Vote, Age, Gender,
      Education, Place, Home on EVERY rung (ISSUE_GROUP_SETS reordered).
   B. On a tablet or phone (<=1000px) the grouping is the menu (rd-tabs),
      NOT the chip cloud - same control the laptop shows, and the one
      who votes for whom uses on a phone; the Issue row stays chips.
   C. The menu FITS: every tab's text sits inside its own slot at 390 and
      320, the row never overflows the card, and nothing spills the page.
   D. The menu still switches the list (click re-reads the rows); the
      laptop desktop layout (ctl row) is untouched at 1280.
   E. A dot click on the trust chart opens the poll in All polls on the
      ISSUES facet (`pollFacet="issues"` — was wrongly "primary", so a
      click landed on the Primary facet instead). */
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

const WANT = ["Vote", "Age", "Gender", "Education", "Place", "Home"];

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

const load = async (width, height = 1200) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#issues .rd-is-tabs .rd-tab", { timeout: 30000 });
  /* switch to the whom view */
  await page.evaluate(() => {
    const sec = document.getElementById("issues");
    const b = [...sec.querySelectorAll(".rd-is-tabs .rd-tab")].find((t) => /matters to whom/i.test(t.textContent));
    if (b) b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector("#issues .rd-iw .rd-tab, #issues .rd-iw-chip", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 600));
  return page;
};

const readMenu = (page) => page.evaluate(() => {
  const sec = document.getElementById("issues");
  const card = sec.querySelector(".rd-iw");
  const menu = card && card.querySelector(".rd-iw-tabs");
  const out = { pageW: document.documentElement.clientWidth, scrollW: sec.scrollWidth };
  if (!menu) { const chips = card && card.querySelector(".rd-iw-chips"); out.chipsOnly = !!chips; return out; }
  const row = menu.querySelector('[role="group"]');
  const mr = row.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  out.row = { l: Math.round(mr.left * 10) / 10, r: Math.round(mr.right * 10) / 10 };
  out.card = { l: Math.round(cr.left * 10) / 10, r: Math.round(cr.right * 10) / 10 };
  out.tabs = [...row.querySelectorAll("button")].map((b) => {
    const r = b.getBoundingClientRect();
    return { label: b.textContent, l: Math.round(r.left * 10) / 10, r: Math.round(r.right * 10) / 10, w: Math.round(r.width * 10) / 10,
             textOverflow: Math.round((b.scrollWidth - b.clientWidth) * 10) / 10,
             insideRow: r.left >= mr.left - 0.6 && r.right <= mr.right + 0.6,
             insideCard: r.right <= cr.right + 0.6 };
  });
  out.menuTop = Math.round(mr.top - card.getBoundingClientRect().top);
  /* the Issue chips row sits DIRECTLY under the grouping menu with no
     kicker of its own (3cc1b40 dropped the redundant "Issue" label) */
  const chips = menu.nextElementSibling;
  out.issueChips = !!(chips && chips.classList.contains("rd-iw-chips") && chips.getAttribute("aria-label") === "Issue");
  return out;
});

/* ---- phone 390 ---------------------------------------------------------- */
{
  const page = await load(390, 844);
  const m = await readMenu(page);
  ok("390: menu exists, no legacy chips switcher", !m.chipsOnly && m.tabs && m.tabs.length === 6, m.chipsOnly ? "chips still render" : `${m.tabs && m.tabs.length} tabs`);
  if (m.tabs) {
    ok("390: menu order Vote Age Gender Education Place Home", m.tabs.map((t) => t.label).join("|") === WANT.join("|"), m.tabs.map((t) => t.label).join("|"));
    const maxOver = Math.max(...m.tabs.map((t) => t.textOverflow));
    ok("390: no tab's text overflows its slot", maxOver <= 0.5, `worst overflow ${maxOver}px (${m.tabs.map((t) => `${t.label}:${t.w}/${t.textOverflow}`).join(" ")})`);
    ok("390: every tab inside row and card", m.tabs.every((t) => t.insideRow && t.insideCard));
  }
  ok("390: no horizontal page spill", m.scrollW <= m.pageW + 1, `scrollW ${m.scrollW} vs ${m.pageW}`);
  ok("390: Issue row stays chips", m.issueChips === true);
  /* switching through the menu changes the list */
  const sw = await page.evaluate(() => {
    const sec = document.getElementById("issues");
    const card = sec.querySelector(".rd-iw");
    const before = [...card.querySelectorAll(".rd-iw-lrow")].map((r) => r.querySelector("[role=rowheader]").textContent).join("|");
    const tab = [...card.querySelectorAll(".rd-iw-tabs .rd-tab")].find((t) => t.textContent === "Gender");
    tab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return { before };
  });
  await page.waitForFunction(() => {
    const sec = document.getElementById("issues");
    const b = [...sec.querySelectorAll(".rd-iw-tabs .rd-tab")].find((t) => t.textContent === "Gender");
    return b && b.getAttribute("aria-pressed") === "true";
  }, { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 300));
  const after = await page.evaluate(() => {
    const card = document.querySelector("#issues .rd-iw");
    return { rows: [...card.querySelectorAll(".rd-iw-lrow")].map((r) => r.querySelector("[role=rowheader]").textContent).join("|"),
             pressed: [...card.querySelectorAll(".rd-iw-tabs .rd-tab")].findIndex((t) => t.getAttribute("aria-pressed") === "true") };
  });
  ok("390: clicking Gender re-reads the rows", after.rows !== sw.before && /Men|Women/.test(after.rows), `${sw.before.slice(0, 60)} → ${after.rows.slice(0, 60)}`);
  ok("390: pressed state moved to Gender", after.pressed === 2, `pressed index ${after.pressed}`);
  await page.close();
}

/* ---- narrow phone rungs: containment ------------------------------------ */
for (const vw of [320, 360, 375]) {
  const page = await load(vw, 700);
  const m = await readMenu(page);
  ok(`${vw}: six tabs render`, !!m.tabs && m.tabs.length === 6);
  if (m.tabs) {
    const maxOver = Math.max(...m.tabs.map((t) => t.textOverflow));
    ok(`${vw}: no tab's text overflows its slot`, maxOver <= 0.5, `worst ${maxOver}px (${m.tabs.map((t) => `${t.label}:${t.w}`).join(" ")})`);
    ok(`${vw}: every tab inside row and card`, m.tabs.every((t) => t.insideRow && t.insideCard),
       `row ${JSON.stringify(m.row)} card ${JSON.stringify(m.card)} tabs ${m.tabs.map((t) => `${t.label}[${t.l}→${t.r}]`).join(" ")}`);
  }
  ok(`${vw}: no horizontal page spill`, m.scrollW <= m.pageW + 1, `scrollW ${m.scrollW} vs ${m.pageW}`);
  await page.close();
}

/* ---- laptop 1280 --------------------------------------------------------- */
{
  const page = await load(1280);
  const m = await page.evaluate(() => {
    const sec = document.getElementById("issues");
    const ctl = sec.querySelector(".rd-iw-ctl");
    if (!ctl) return null;
    const menu = ctl.querySelector(".rd-iw-tabs");
    return { ctl: true, labels: [...menu.querySelectorAll("button")].map((b) => b.textContent),
             byLabel: (ctl.querySelector(".rd-iw-by") || {}).textContent || "" };
  });
  ok("1280: desktop control row intact", !!m && (/Group voters by/.test(m ? m.byLabel : "")), m && m.byLabel);
  if (m) ok("1280: menu order Vote Age Gender Education Place Home", m.labels.join("|") === WANT.join("|"), m.labels.join("|"));
  /* the table still sits under it */
  const tbl = await page.evaluate(() => !!document.querySelector("#issues .rd-iw-table"));
  ok("1280: desktop table beneath", tbl);
  await page.close();
}

/* ---- E: trust-chart dot click opens the poll on the ISSUES facet ------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1200, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#issues .rd-is-chart svg", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  const dot = await page.evaluate(() => {
    const svg = document.querySelector("#issues .rd-is-chart svg");
    svg.scrollIntoView({ block: "center" });
    /* solid scatter dots only - the tail circle is a hollow ring mark
       (fill var(--chart-bg)) with no poll row behind it */
    const cs = [...svg.querySelectorAll("circle.scatter-dot")].filter((c) => c.getAttribute("fill") !== "var(--chart-bg)");
    if (!cs.length) return null;
    const r = cs[cs.length - 1].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, n: cs.length };
  });
  ok("E: trust chart renders poll dots", !!dot && dot.n > 2, dot && `${dot.n} solid dots`);
  if (dot) {
    await page.mouse.move(dot.x - 30, dot.y - 30);
    await new Promise((r) => setTimeout(r, 150));
    await page.mouse.move(dot.x, dot.y);
    await new Promise((r) => setTimeout(r, 300));
    await page.mouse.click(dot.x, dot.y);
    let landed = null;
    try {
      await page.waitForFunction(() => location.hash === "#allpolls" && document.querySelector(".rd-ap-tabs button"), { timeout: 10000 });
      landed = await page.evaluate(() => {
        const active = ([...document.querySelectorAll(".rd-ap-tabs button")].find((b) => b.getAttribute("aria-pressed") === "true") || {}).textContent || null;
        return { active, open: !!document.querySelector(".rd-ap-open"), issTbl: !!document.querySelector(".rd-apd-isr") };
      });
    } catch {}
    ok("E: dot click lands in All polls on the Issues facet", !!landed && landed.active === "Issues", landed && `facet: ${landed.active}`);
    ok("E: the clicked poll opens (issues issue-by-issue table)", !!landed && landed.open && landed.issTbl,
      landed && `open=${landed.open} issTbl=${landed.issTbl}`);
  }
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} FAIL` : "\nALL PASS");
process.exit(fails ? 1 : 0);
