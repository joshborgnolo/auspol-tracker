/* Walk probe: facet-walking the All-polls table must never reflow anything
   ABOVE the element the pin holds. Since 2026-10-18 the head and dek sit
   under the tab row (they used to sit above it, floored at the tallest
   walkable story by .rd-ap-storyvar, which left lines of empty space over
   the table under a short story - user report 2026-10-18):
   - shallow (tab row on screen): the tab row takes the pin, nothing above
     it changes height (the eyebrow floor, .rd-ap-ebvar), so the tab row's
     document top never moves and no scroll is ever issued; the slot holds
     nothing (no min-height) and hugs its story - no void;
   - deep (tab row scrolled away, the pinned pint tabs): the bar/table take
     the pin with the slot above them, so the slot HOLDS its height and only
     ever grows (a taller story than the box), and a scroll correction is
     issued only on a growing hop - shrinking hops reflow nothing; the bar
     and table stay where they were on screen;
   - the next shallow hop releases the hold.
   Without the holds Safari painted each correction a couple of css px off
   and the pinned page crawled on every tab/arrow walk (user report
   2026-10-06). Chrome's own scroll anchoring is switched off (Safari has
   none) so the pin is the only thing holding the page. Serves the built
   site from the repo root (ROOT=<dir> for another build).
   Run: node .matilda/probe/ap-walk-floor.mjs ; WIDTHS=390,1140 for a subset */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = process.env.ROOT || fileURLToPath(new URL("../..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const URL0 = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
let pageErr = 0;
page.on("pageerror", (e) => { pageErr++; console.log("PAGEERROR", String(e).slice(0, 300)); });
await page.evaluateOnNewDocument(() => {
  let n = 0;
  const t = window.scrollTo.bind(window), b = window.scrollBy.bind(window);
  window.scrollTo = (...a) => { n++; return t(...a); };
  window.scrollBy = (...a) => { n++; return b(...a); };
  Object.defineProperty(window, "__sc", { get: () => n });
  document.addEventListener("DOMContentLoaded", () => {
    const st = document.createElement("style");
    st.textContent = "* { overflow-anchor: none !important; }";
    document.head.appendChild(st);
  });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const bad = (W, msg) => { fails.push(`W${W} ${msg}`); console.log(`  FAIL W${W} ${msg}`); };
const widths = (process.env.WIDTHS || "320,360,390,430,640,768,900,1024,1140,1141,1280,1440").split(",").map(Number);
const geo = () => page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
  const slot = document.querySelector(".rd-ap-hedslot");
  /* the slot's content height: its last child's bottom (the dek's margin
     box ends there) against the slot's own top */
  const kids = slot ? [...slot.children].filter((c) => c.getBoundingClientRect().height > 0) : [];
  const sr = slot.getBoundingClientRect();
  const last = kids.length ? kids[kids.length - 1].getBoundingClientRect().bottom : sr.top;
  const tab = r(".rd-ap-tabs"), bar = r(".rd-ap-bar"), tbl = r(".rd-ap-table");
  return {
    y: scrollY, sc: window.__sc, f: document.querySelector(".rd-ap").dataset.facet,
    tabV: tab.top, tabD: tab.top + scrollY, barV: bar.top, tblV: tbl ? tbl.top : null,
    slotH: sr.height, slotVoid: sr.bottom - last, hold: slot.style.minHeight,
  };
});
const click = (id, where) => page.evaluate((id, where) => {
  const lab = { twopp: "2PP", primary: "Primary", leadership: /^Leader/, direction: "Direction", issues: "Issues", demographics: "Demographics", confidence: "Confidence" }[id];
  const m = (b) => (lab instanceof RegExp ? lab.test(b.textContent.trim()) : b.textContent.trim() === lab);
  const pin = document.querySelector(".rd-ap-pinbar.on");
  const sel = where === "deep" && pin && pin.querySelector(".rd-ap-pint") ? ".rd-ap-pint" : ".rd-ap-tabs .rd-tab";
  const b = [...document.querySelectorAll(sel)].find(m);
  if (!b) return false;
  b.click();
  return true;
}, id, where);
const IDS = ["primary", "demographics", "twopp", "confidence", "leadership", "twopp", "issues", "direction", "twopp"];
let grows = 0, shrinks = 0;
for (const W of widths) {
  const phone = W < 700;
  await page.setViewport({ width: W, height: 850, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.goto(URL0 + "allpolls/", { waitUntil: "networkidle0" });
  await sleep(800);
  const stacks = await page.evaluate(() => {
    const out = {};
    for (const cls of [".rd-ap-storyvar", ".rd-ap-ctlvar", ".rd-ap-ebvar"]) {
      const el = document.querySelector(cls);
      if (!el) { out[cls] = "ABSENT"; continue; }
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      out[cls] = cs.visibility + " h" + Math.round(r.height);
    }
    return out;
  });
  if (stacks[".rd-ap-storyvar"] !== "ABSENT" || stacks[".rd-ap-ctlvar"] !== "ABSENT") bad(W, "a retired measurement stack is back " + JSON.stringify(stacks));
  if (!/^hidden h0$/.test(stacks[".rd-ap-ebvar"])) bad(W, "the eyebrow stack paints or holds height " + stacks[".rd-ap-ebvar"]);
  /* shallow: the tab row 300px down the screen */
  await page.evaluate(() => { const t = document.querySelector(".rd-ap-tabs").getBoundingClientRect().top + scrollY; window.scrollTo(0, t - 300); });
  await sleep(500);
  let worstTab = 0, worstVoid = 0, sc0 = (await geo()).sc;
  for (const id of IDS) {
    const a = await geo();
    if (!(await click(id, "shallow"))) { bad(W, "shallow: no tab for " + id); continue; }
    await sleep(900);
    const b = await geo();
    if (b.f !== id) bad(W, `shallow: clicked ${id}, facet is ${b.f}`);
    worstTab = Math.max(worstTab, Math.abs(b.tabD - a.tabD), Math.abs(b.tabV - a.tabV));
    worstVoid = Math.max(worstVoid, b.slotVoid);
    if (b.hold) bad(W, `shallow ${id}: the slot holds ${b.hold}`);
  }
  const shSc = (await geo()).sc - sc0;
  if (worstTab > 0.5) bad(W, `shallow: the tab row moved ${worstTab.toFixed(1)}px`);
  if (worstVoid > 1) bad(W, `shallow: ${worstVoid.toFixed(1)}px of empty slot under the dek`);
  if (shSc) bad(W, `shallow: ${shSc} scroll calls (want 0)`);
  /* deep: 1500px past the tab row, walking the pinned pint tabs */
  let worstDeep = 0, deepScBad = 0, wGrow = 0, wShrink = 0;
  if (W === 320 || W === 390 || W === 768 || W === 1140 || W === 1280 || W === 1440) {
    await page.evaluate(() => { const t = document.querySelector(".rd-ap-tabs").getBoundingClientRect().top + scrollY; window.scrollTo(0, t + 1500); });
    await sleep(600);
    for (const id of IDS) {
      const a = await geo();
      if (!(await click(id, "deep"))) { bad(W, "deep: no tab for " + id); continue; }
      await sleep(1000);
      const b = await geo();
      if (b.f !== id) bad(W, `deep: clicked ${id}, facet is ${b.f}`);
      const grew = b.slotH - a.slotH;
      if (grew < -0.5) bad(W, `deep ${id}: the held slot shrank ${grew.toFixed(1)}px`);
      if (grew > 0.5) wGrow++; else wShrink++;
      const scs = b.sc - a.sc;
      if (grew <= 0.5 && scs) deepScBad++;
      worstDeep = Math.max(worstDeep, Math.abs(b.barV - a.barV), b.tblV != null && a.tblV != null ? Math.abs(b.tblV - a.tblV) : 0);
    }
    if (worstDeep > 1) bad(W, `deep: the bar/table moved ${worstDeep.toFixed(1)}px on screen`);
    if (deepScBad) bad(W, `deep: ${deepScBad} non-growing hops issued a scroll`);
    /* back up: the next hop with the tab row in view lets the hold go */
    await page.evaluate(() => { const t = document.querySelector(".rd-ap-tabs").getBoundingClientRect().top + scrollY; window.scrollTo(0, t - 300); });
    await sleep(500);
    await click("primary", "shallow");
    await sleep(900);
    const r = await geo();
    if (r.hold) bad(W, `release: the slot still holds ${r.hold}`);
    if (r.slotVoid > 1) bad(W, `release: ${r.slotVoid.toFixed(1)}px of empty slot`);
    grows += wGrow; shrinks += wShrink;
  }
  console.log(`W${W} shallow tab-drift ${worstTab.toFixed(1)} void ${worstVoid.toFixed(1)} scrolls ${shSc} · deep screen-drift ${worstDeep.toFixed(1)} hops grew ${wGrow} held ${wShrink}`);
}
console.log(`deep hops: ${grows} grew the slot (one correction each), ${shrinks} held it (no reflow)`);
console.log(fails.length ? `FAIL ${fails.length}` : "ALL PASS");
await browser.close();
server.close();
process.exit(fails.length || pageErr ? 1 : 0);
