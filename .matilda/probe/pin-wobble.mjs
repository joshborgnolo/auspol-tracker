/* Pinned switches across the site: does the held row (and what sits under
   it) move on screen in any PAINTED frame while a tab, chip or flip switch
   runs on a phone, with the section's head and dek on screen above it?

   rdPinScroll holds the row through the switch. Until 2026-10-05 a head or
   dek above the row still GLIDED to its new height while on screen, and the
   pin, which only corrects whole drifts of 3px or more (the Safari lattice
   rule), let the row ride each frame's growth and snap back: the Who-votes
   dot plot shook ±3px on every group-tab and party-chip switch.

   The sampler is a ResizeObserver made after each tap's pin made its own (a
   window bubble-phase click listener runs after React's handler), so it is
   called after the pin's correction in every frame - its reads are what
   that frame paints. A dummy box wiggled every rAF makes it fire each frame.
   Reads taken in rAF or a later task can catch a commit that landed between
   frames before the next frame's correction - states that never paint.

   Usage: node .matilda/probe/pin-wobble.mjs [chrome|webkit] [width]
   (ROOT=<dir> serves another build; default the repo root). Width 1000+
   clicks with a mouse, where only the `fine` callers pin. Exit 1 if any
   pinned tap moved its held row >= 1px in a painted frame. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.ROOT || fileURLToPath(new URL("../..", import.meta.url));
const ENGINE = process.argv[2] || "chrome";
const W = +(process.argv[3] || 390);
/* 1000px and up is a laptop: mouse clicks, a fine pointer, where only the
   callers that ask for it (fine) pin at all */
const DESK = W >= 1000;
const H = DESK ? 900 : 844;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
               ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "text/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser, page;
if (ENGINE === "webkit") {
  const { webkit } = await import(new URL("./node_modules/playwright-core/index.mjs", import.meta.url));
  browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DESK ? 2 : 3, isMobile: !DESK, hasTouch: !DESK });
  page = await ctx.newPage();
} else {
  const puppeteer = (await import("puppeteer-core")).default;
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
  page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DESK ? 2 : 3, isMobile: !DESK, hasTouch: !DESK });
}
const ev = (fn, arg) => page.evaluate(fn, arg);   // one-arg form: both engines
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await page.waitForSelector("#who-votes", { timeout: 30000 });
await sleep(1200);

/* the painted sampler, installed once */
await ev(() => {
  const dummy = document.createElement("div");
  dummy.style.cssText = "position:fixed;left:0;top:0;height:1px;width:1px;pointer-events:none;opacity:0";
  document.body.appendChild(dummy);
  let wig = 0, ro = null;
  window.__plog = [];
  window.__rec = false;
  window.__watch = [];
  const wiggle = () => { wig ^= 1; dummy.style.width = (1 + wig) + "px"; requestAnimationFrame(wiggle); };
  requestAnimationFrame(wiggle);
  const arm = () => {
    if (ro) ro.disconnect();
    window.__pinned = document.documentElement.style.overflowAnchor === "none";
    ro = new ResizeObserver(() => {
      if (!window.__rec) return;
      window.__plog.push({
        t: performance.now(), y: scrollY,
        tops: window.__watch.map((s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect().top : null; }),
        glides: [...document.querySelectorAll(".rd-glide-in")].filter((i) => i.parentElement && i.parentElement.style.height && !i.parentElement.__rdFrozen).length,
      });
    });
    ro.observe(dummy);
  };
  arm();
  window.addEventListener("click", arm);
});

const TARGETS = [
  { name: "Who votes: group tabs", sec: "who-votes", btn: "#who-votes .rd-wv-tabs [aria-label='Group voters by'] button",
    watch: ["#who-votes .rd-wv-tabs", "#who-votes .rd-wv-dots"] },
  { name: "Who votes: party chips", sec: "who-votes", btn: "#who-votes [aria-label='Party'] button",
    watch: ["#who-votes .rd-wv-tabs", "#who-votes .rd-wv-dots"] },
  { name: "Leadership: rating tabs", sec: "leadership", btn: "#leadership [aria-label='Leader rating'] button",
    watch: ["#leadership [aria-label='Leader rating']"] },
  { name: "Issues: whom group tabs", sec: "issues", pre: "#issues .rd-is-tabs [role=group] button:nth-child(2)", btn: "#issues .rd-iw-tabs button",
    watch: ["#issues .rd-iw-tabs", "#issues .rd-iw-chips"] },
  { name: "Issues: whom issue chips", sec: "issues", btn: "#issues .rd-iw-chips button",
    watch: ["#issues .rd-iw-tabs", "#issues .rd-iw-chips"] },
  { name: "Decidedness: view tabs", sec: "undecided", btn: "#undecided .rd-un-tabs button", watch: ["#undecided .rd-un-tabs"] },
  { name: "Primary: range tabs", sec: "primary-vote", btn: "#primary-vote [aria-label='Time range'] button", watch: ["#primary-vote [aria-label='Time range']"] },
  { name: "2PP: range tabs", sec: "two-party", btn: "#two-party [aria-label='Time range'] button", watch: ["#two-party [aria-label='Time range']"] },
  /* these two hold the table (or All polls' bars) rather than the tab row on
     purpose (rd-polls.jsx pinPl, rd-allpolls.jsx pinAp), so the tab row is
     only reported, not judged */
  { name: "Latest polls: facets", sec: "latest-polls", btn: "#latest-polls [aria-label='Poll table view'] button", watch: ["#latest-polls .rd-pl", "#latest-polls .rd-pl-tabs"] },
  { name: "All polls: facets", sec: "rd-ap-top", btn: "#rd-ap-top .rd-ap-tabs [role=group] button", watch: ["#rd-ap-top .rd-ap-bar", "#rd-ap-top .rd-ap-tabs"] },
  { name: "House lean: matchup flip", sec: "house-lean", btn: "#house-lean .rd-pl-flip", flip: true, watch: ["#house-lean .rd-hl-tabs"] },
  { name: "Cycles: compare", sec: "cyc-summary", btn: "#cyc-summary [aria-label='Compare with'] button", watch: ["#cyc-summary .rd-cc"] },
  { name: "Cycles: measure", sec: "cyc-summary", btn: "#cyc-summary [aria-label='Measure'] button", watch: ["#cyc-summary .rd-cc"] },
];

/* show the page tab holding the section */
async function reach(sec) {
  const vis = () => ev((id) => { const el = document.getElementById(id); return !!(el && el.getClientRects().length); }, sec);
  if (await vis()) return true;
  const n = await ev(() => document.querySelectorAll(".tabs-list [role=tab]").length);
  for (let i = 0; i < n; i++) {
    await ev((k) => document.querySelectorAll(".tabs-list [role=tab]")[k].click(), i);
    await sleep(900);
    if (await vis()) return true;
  }
  return false;
}
/* the reading position: the section's eyebrow just under the sticky bar,
   then down only as far as the control needs to be on screen */
async function place(t, k) {
  await ev(({ sec, btn, k }) => {
    const el = document.getElementById(sec);
    const bar = document.querySelector(".tabs.sticky");
    const reserve = bar ? bar.getBoundingClientRect().height : 0;
    let y = el.getBoundingClientRect().top + scrollY - reserve - 8;
    window.scrollTo({ top: Math.round(y), behavior: "instant" });
    const b = document.querySelectorAll(btn)[k];
    if (b) {
      const r = b.getBoundingClientRect();
      if (r.bottom > innerHeight - 16) window.scrollTo({ top: Math.round(scrollY + r.bottom - innerHeight + 60), behavior: "instant" });
    }
  }, { sec: t.sec, btn: t.btn, k });
  await sleep(450);
}
const centre = (sel, k) => ev(({ sel, k }) => {
  const b = document.querySelectorAll(sel)[k];
  if (!b) return null;
  const r = b.getBoundingClientRect();
  if (r.width === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: (b.getAttribute("aria-label") || b.textContent).trim().slice(0, 18) };
}, { sel, k });

const rows = [];
let bad = 0;
for (const t of TARGETS) {
  if (!(await reach(t.sec))) { rows.push(t.name.padEnd(30) + " section not reachable"); continue; }
  if (t.pre) { await ev((s) => { const b = document.querySelector(s); if (b) b.click(); }, t.pre); await sleep(700); }
  const n = await ev((s) => document.querySelectorAll(s).length, t.btn);
  if (!n) { rows.push(t.name.padEnd(30) + " no controls"); continue; }
  const order = t.flip ? [0, 0] : [...new Set([1, Math.min(2, n - 1), n - 1, 0])].filter((k) => k < n);
  await ev((w) => { window.__watch = w; }, t.watch);
  await place(t, order[0]);
  for (const k of order) {
    const c = await centre(t.btn, k);
    if (!c || c.y < 0 || c.y > H) { rows.push(t.name.padEnd(30) + " #" + k + " off screen"); continue; }
    await ev(() => { window.__plog = []; window.__rec = true; });
    await sleep(60);
    if (DESK) await page.mouse.click(c.x, c.y); else await page.touchscreen.tap(c.x, c.y);
    await sleep(850);
    const { log, pinned } = await ev(() => { window.__rec = false; return { log: window.__plog, pinned: window.__pinned }; });
    if (log.length < 3) { rows.push(t.name.padEnd(30) + " #" + k + " no frames"); continue; }
    const f0 = log[0];
    /* judged on the held row (watch[0]); the rest are reported */
    let dev = 0, devOther = 0, rev = 0, last = 0, moved = 0, glides = 0;
    for (let i = 1; i < log.length; i++) {
      glides = Math.max(glides, log[i].glides);
      for (let w = 0; w < f0.tops.length; w++) {
        if (f0.tops[w] == null || log[i].tops[w] == null) continue;
        const dv = Math.abs(log[i].tops[w] - f0.tops[w]);
        if (w === 0) dev = Math.max(dev, dv); else devOther = Math.max(devOther, dv);
      }
      const s = log[i].tops[0] - log[i - 1].tops[0];
      if (Math.abs(s) >= 0.5) { moved++; const d = Math.sign(s); if (last && d !== last) rev++; last = d; }
    }
    const land = log[log.length - 1].tops[0] - f0.tops[0];
    const flag = pinned && (dev >= 1 || Math.abs(land) >= 1);
    if (flag) bad++;
    rows.push((flag ? "MOVES " : "ok    ") + t.name.padEnd(30) + (" " + c.label).padEnd(20) + " pin " + (pinned ? "yes" : "no ")
      + " | max " + dev.toFixed(1).padStart(5) + "px, " + String(moved).padStart(2) + " moving frames, " + rev + " reversals, lands " + land.toFixed(1)
      + (f0.tops.length > 1 ? " | others max " + devOther.toFixed(1) : "")
      + " | scroll " + (log[log.length - 1].y - f0.y).toFixed(0) + " | gliding blocks " + glides);
    await sleep(200);
  }
}
console.log(ENGINE + " " + W + "px\n" + rows.join("\n"));
console.log(bad ? bad + " pinned tap(s) moved a watched element" : "every pinned tap held still");
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
