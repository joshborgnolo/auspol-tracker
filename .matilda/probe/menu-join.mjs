/* Probe: the ☰ menu's join on a phone (user report 2026-10-27: "misaligned,
   stutters, glitchy, including in the animation from non-sticky to sticky").
   Opens the menu on the unpinned bar, then scrolls the bar into its pin and
   back, logging every painted frame: the paper tab's edges against the
   sheet's opening (--gap-a/--gap-b) and the sheet's top against the tab's
   foot. The join holds when they agree on every frame, mid-transition too.
   The tab is read as it paints (clipped).
   Run after a build: node .matilda/probe/menu-join.mjs [W] */
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? " ok  " : "FAIL ") + msg); if (!cond) fails++; };
const widths = process.argv[2] ? [Number(process.argv[2])] : [320, 375, 390, 430, 600, 800, 1000, 1280];
/* the main page and a satellite (site-shell.js carries the same folder) */
const sites = [
  { url: "/#allpolls", nav: ".tabs", btn: ".tab.tab-menu", paper: ".tab-menu-paper", pop: ".tab-menu-pop" },
  { url: "/feedback/", nav: ".sh-tabs", btn: ".sh-menu-btn", paper: ".sh-menu-paper", pop: "#sh-menu" },
];
for (const S of sites) for (const W of widths) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 844, isMobile: W < 700, hasTouch: W < 700, deviceScaleFactor: 2 });
  await page.goto(base + S.url, { waitUntil: "load" }); await wait(1400);
  /* sit just above the pin, menu open */
  const pinAt = await page.evaluate((sel) => {
    const n = document.querySelector(sel);
    return Math.round(n.getBoundingClientRect().top + scrollY);
  }, S.nav);
  await page.evaluate((y) => window.scrollTo({ top: y - 40, behavior: "instant" }), pinAt); await wait(500);
  await page.click(S.btn); await wait(400);
  /* every frame for the run: scroll past the pin, rest, then back above it */
  const log = await page.evaluate(async (y, S) => {
    const out = [];
    const t0 = performance.now();
    const snap = (tag) => {
      const pp = document.querySelector(S.paper), pop = document.querySelector(S.pop);
      if (!pp || !pop || pop.hidden) { out.push({ tag, gone: true }); return; }
      /* the tab as it paints: clipped by any ancestor that hides overflow
         (.tabs-inner clips at the bar's ends - the 2026-10-27 report was a
         tab whose right side the clip cut 3px short of the sheet's) */
      const r0 = pp.getBoundingClientRect(), a = { left: r0.left, right: r0.right, bottom: r0.bottom };
      for (let e = pp.parentElement; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.overflowX === "visible") continue;
        const c = e.getBoundingClientRect();
        a.left = Math.max(a.left, c.left); a.right = Math.min(a.right, c.right);
      }
      const b = pop.getBoundingClientRect();
      const ga = parseFloat(pop.style.getPropertyValue("--gap-a")) || 0, gb = parseFloat(pop.style.getPropertyValue("--gap-b")) || 0;
      out.push({ tag, t: Math.round(performance.now() - t0),
        sL: +b.left.toFixed(2), sR: +b.right.toFixed(2),
        dTop: +(b.top - a.bottom).toFixed(2),           // sheet top v tab foot
        dL: +((b.left + ga - 1) - a.left).toFixed(2),   // opening's left v tab's left
        dR: +((b.left + gb + 1) - a.right).toFixed(2),  // opening's right v tab's right
        pinned: document.querySelector(S.nav).classList.contains("pinned") });
    };
    /* read after the frame's callbacks have all run (a task queued from
       rAF), so the probe sees what painted, not its own place in the queue */
    const frames = (n, tag) => new Promise((r) => { let k = 0; const f = () => setTimeout(() => { snap(tag); if (++k < n) requestAnimationFrame(f); else r(); }, 0); requestAnimationFrame(f); });
    for (let i = 1; i <= 8; i++) { window.scrollTo(0, y - 40 + i * 12); await frames(1, "down"); }
    await frames(40, "rest-pinned");
    for (let i = 1; i <= 8; i++) { window.scrollTo(0, y + 56 - i * 12); await frames(1, "up"); }
    await frames(40, "rest-unpinned");
    return out;
  }, pinAt, S);
  const bad = log.filter((r) => !r.gone && (Math.abs(r.dTop) > 0.75 || Math.abs(r.dL) > 0.75 || Math.abs(r.dR) > 0.75));
  const gone = log.filter((r) => r.gone).length;
  const last = (tag) => log.filter((r) => r.tag === tag).pop();
  ok(gone === 0, `${S.url} ${W}px: the menu stays open through the pin (${gone} closed frames)`);
  ok(bad.length === 0, `${S.url} ${W}px: tab and sheet joined on every frame (${bad.length}/${log.length} off)`
     + (bad.length ? "\n      " + bad.slice(0, 6).map((r) => `${r.tag}@${r.t} top${r.dTop} L${r.dL} R${r.dR}${r.pinned ? " P" : ""}`).join("\n      ") : ""));
  /* the sheet's own edges move one way through each glide: straight to where
     the tab will rest, never past it and back (user report 2026-10-27: on
     unpinning, the right edge went "inwards a little too far and then ...
     back out") */
  const oneWay = (tags, k) => {
    const v = log.filter((r) => !r.gone && tags.includes(r.tag)).map((r) => r[k]);
    let dir = 0, turns = 0;
    for (let i = 1; i < v.length; i++) {
      const d = v[i] - v[i - 1];
      if (Math.abs(d) < 0.25) continue;
      if (dir && Math.sign(d) !== dir) turns++;
      dir = Math.sign(d);
    }
    return { turns, from: v[0], to: v[v.length - 1], min: Math.min(...v), max: Math.max(...v) };
  };
  for (const [ph, tags] of [["pinning", ["down", "rest-pinned"]], ["unpinning", ["up", "rest-unpinned"]]]) for (const k of ["sL", "sR"]) {
    const o = oneWay(tags, k);
    ok(o.turns === 0 && o.min >= Math.min(o.from, o.to) - 0.25 && o.max <= Math.max(o.from, o.to) + 0.25,
       `${S.url} ${W}px: ${ph}, the sheet's ${k === "sL" ? "left" : "right"} edge moves one way (${o.from} → ${o.to}, range ${o.min}–${o.max}, ${o.turns} turns)`);
  }
  const rp = last("rest-pinned"), ru = last("rest-unpinned");
  ok(rp && !rp.gone && Math.abs(rp.dL) < .75 && Math.abs(rp.dR) < .75 && Math.abs(rp.dTop) < .75, `${S.url} ${W}px: at rest pinned ${JSON.stringify(rp)}`);
  ok(ru && !ru.gone && Math.abs(ru.dL) < .75 && Math.abs(ru.dR) < .75 && Math.abs(ru.dTop) < .75, `${S.url} ${W}px: at rest unpinned ${JSON.stringify(ru)}`);
  await page.close();
}
await browser.close(); server.close();
console.log(fails ? `${fails} FAIL` : "all ok");
process.exit(fails ? 1 : 0);
