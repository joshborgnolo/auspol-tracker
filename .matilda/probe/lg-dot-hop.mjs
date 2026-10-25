/* Probe: the 2PP hero's lead-gauge dot - its click hop and its one-in-150
   parachute jump (rd-hero.jsx: rdHopKeys, rdChute).
   Usage: node .build/newtracker/build.mjs && node .matilda/probe/lg-dot-hop.mjs
          VW=390 VH=844 MOBILE=1 node .matilda/probe/lg-dot-hop.mjs
          PAGE=/vic/ node .matilda/probe/lg-dot-hop.mjs   (after npm run build:vic)
   Checks: a click plays one WAAPI hop that ends on the dot's own transform; a
   click in mid-air is ignored and one after the landing starts afresh; Enter
   and Space hop and keep focus; the forced jump hides the dot under the
   figure's head, ignores clicks, lands the head back on the slot (after a
   mid-flight scroll too) and removes its overlay; reduced motion does
   nothing. Exits 1 on any failure. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8977;
const VW = Number(process.env.VW || 1280), VH = Number(process.env.VH || 900), MOBILE = !!process.env.MOBILE;
const PAGE = process.env.PAGE || "/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (ok, what, got) => { if (!ok) fails.push(what + (got !== undefined ? " - got " + JSON.stringify(got) : "")); };

async function open(reduce) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewport({ width: VW, height: VH, isMobile: MOBILE, hasTouch: MOBILE });
  if (reduce) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`http://127.0.0.1:${PORT}${PAGE}`, { waitUntil: "load" });
  await page.waitForSelector(".rd-lg-dot", { timeout: 20000 });
  await sleep(1200);
  const tap = async () => {
    const b = await page.evaluate(() => { const r = document.querySelector(".rd-lg-dot").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (MOBILE) await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  };
  return { page, errors, tap };
}

/* ---- the hop ---- */
{
  const { page, errors, tap } = await open(false);
  await page.evaluate(() => { Math.random = () => 0.5; });
  await tap();
  const a = await page.evaluate(() => {
    const an = document.querySelector(".rd-lg-dot").getAnimations();
    window.__a0 = an[0];
    const kf = an[0] ? an[0].effect.getKeyframes() : [];
    return { n: an.length, ms: an[0] && an[0].effect.getTiming().duration, keys: kf.length,
             first: kf[0] && [kf[0].translate, kf[0].scale],
             top: Math.min(...kf.map((k) => { const v = String(k.translate).trim().split(/\s+/); return v.length > 1 ? parseFloat(v[1]) : 0; })) };
  });
  check(a.n === 1, "a click plays one hop animation", a.n);
  check(a.keys > 60 && a.ms > 600 && a.ms < 1200, "the hop is a dense keyframe track under 1.2s", a);
  check(a.top < -14 && a.top > -20, "the hop peaks 14-20px up", a.top);
  await sleep(150); await tap();
  const spam = await page.evaluate(() => document.querySelector(".rd-lg-dot").getAnimations()[0] === window.__a0);
  check(spam, "a click in mid-air is ignored");
  await sleep(450); await tap();
  const fresh = await page.evaluate(() => { const an = document.querySelector(".rd-lg-dot").getAnimations(); return an.length === 1 && an[0] !== window.__a0; });
  check(fresh, "a click after the landing starts a fresh hop");
  await sleep(1100);
  const rest = await page.evaluate(() => { const el = document.querySelector(".rd-lg-dot"); return { n: el.getAnimations().length, tf: getComputedStyle(el).transform, scale: getComputedStyle(el).scale, tr: getComputedStyle(el).translate }; });
  check(rest.n === 0 && rest.tf === "matrix(1, 0, 0, 1, -8, 0)" && rest.scale === "none" && rest.tr === "none", "the hop ends on the dot's own transform", rest);
  if (!MOBILE) {
    await page.focus(".rd-lg-dot");
    for (const key of ["Enter", " "]) {
      await page.keyboard.press(key);
      const k = await page.evaluate(() => ({ n: document.querySelector(".rd-lg-dot").getAnimations().length,
        focus: document.activeElement === document.querySelector(".rd-lg-dot"), y: window.scrollY }));
      check(k.n === 1 && k.focus && k.y === 0, "the " + (key === " " ? "Space" : key) + " key hops and keeps focus", k);
      await sleep(1000);
    }
  }
  check(errors.length === 0, "no page errors (hop)", errors);
  await page.close();
}

/* ---- the parachute jump, with a scroll partway down ---- */
{
  const { page, errors, tap } = await open(false);
  await page.evaluate(() => { let n = 0; Math.random = () => (n++ === 0 ? 0 : 0.99); });
  await page.evaluate(() => {
    window.__iv = []; let last = performance.now(); window.__ivOn = true;
    const f = (now) => { window.__iv.push(now - last); last = now; if (window.__ivOn) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  await tap();
  const s0 = await page.evaluate(() => {
    const h = document.querySelector(".rd-chute-head"), d = document.querySelector(".rd-lg-dot");
    if (!h) return null;
    const a = h.getBoundingClientRect(), b = d.getBoundingClientRect();
    return { dx: a.left + a.width / 2 - (b.left + b.width / 2), dy: a.top + a.height / 2 - (b.top + b.height / 2), op: d.style.opacity,
             z: getComputedStyle(document.querySelector(".rd-chute")).zIndex };
  });
  check(!!s0, "a forced jump opens the overlay");
  if (s0) check(Math.abs(s0.dx) < 0.6 && Math.abs(s0.dy) < 0.6 && s0.op === "0", "the figure's head starts on the hidden dot", s0);
  await sleep(1500);
  const top = await page.evaluate(() => { const r = document.querySelector(".rd-chute-head").getBoundingClientRect(); return r.top; });
  check(top < VH * 0.45, "the jump climbs well up the viewport", top);
  await sleep(1000);
  await page.evaluate(() => document.querySelector(".rd-lg-dot").click());
  const busy = await page.evaluate(() => ({ overlays: document.querySelectorAll(".rd-chute").length, anims: document.querySelector(".rd-lg-dot").getAnimations().length }));
  check(busy.overlays === 1 && busy.anims === 0, "a click during the jump is ignored", busy);
  const canopy = await page.evaluate(() => { const c = document.querySelector(".rd-chute-can"); return c && c.style.display !== "none" ? c.getBoundingClientRect().width : 0; });
  check(canopy > 30, "the canopy is open", canopy);
  await page.evaluate(() => window.scrollBy(0, 200));
  const t0 = Date.now();
  let last = null, ms = 0;
  while (Date.now() - t0 < 10000) {
    const st = await page.evaluate(() => {
      const h = document.querySelector(".rd-chute-head");
      if (!h) return null;
      const a = h.getBoundingClientRect(), b = document.querySelector(".rd-lg-dot").getBoundingClientRect();
      return { dx: a.left + a.width / 2 - (b.left + b.width / 2), dy: a.top + a.height / 2 - (b.top + b.height / 2), w: a.width, h: a.height };
    });
    if (!st) { ms = Date.now() - t0; break; }
    last = st;
    await sleep(30);
  }
  check(ms > 0, "the overlay is removed when the figure is home");
  check(last && Math.abs(last.dx) < 0.6 && Math.abs(last.dy) < 0.6 && Math.abs(last.w - 16) < 0.6, "the head lands back on the slot after a scroll", last);
  const end = await page.evaluate(() => ({ op: document.querySelector(".rd-lg-dot").style.opacity, overlays: document.querySelectorAll(".rd-chute").length }));
  check(end.op === "" && end.overlays === 0, "the dot is shown again", end);
  await page.evaluate(() => { window.__ivOn = false; });
  const iv = (await page.evaluate(() => window.__iv.slice(1))).sort((x, y) => x - y);
  const p95 = iv[Math.floor(iv.length * 0.95)];
  check(p95 < 20, "the jump holds the frame rate (p95 rAF interval)", p95);
  await page.evaluate(() => { Math.random = () => 0.5; });
  await sleep(300); await tap();
  const again = await page.evaluate(() => document.querySelector(".rd-lg-dot").getAnimations().length);
  check(again === 1, "the dot hops again after the jump", again);
  check(errors.length === 0, "no page errors (jump)", errors);
  await page.close();
}

/* ---- reduced motion: nothing moves ---- */
{
  const { page, errors, tap } = await open(true);
  await page.evaluate(() => { Math.random = () => 0; });
  await tap();
  const r = await page.evaluate(() => ({ anims: document.querySelector(".rd-lg-dot").getAnimations().length, overlay: !!document.querySelector(".rd-chute") }));
  check(r.anims === 0 && !r.overlay, "reduced motion: no hop, no jump", r);
  check(errors.length === 0, "no page errors (reduced motion)", errors);
  await page.close();
}

await browser.close();
server.close();
console.log(fails.length ? "FAIL\n  " + fails.join("\n  ") : `ok - lg-dot hop and jump on ${PAGE} at ${VW}x${VH}${MOBILE ? " (touch)" : ""}`);
process.exit(fails.length ? 1 : 0);
