/* Probe: the glyph player (wm-story.jsx, reimagined 2026-10-04) - the
   masthead dial's replay of the term, as a contract rather than a look.

   Interaction, in full AND reduced motion: it opens with focus on
   play/pause (on a focused close button the Space a reader presses to
   pause would shut it); the masthead dial goes dark while the dial is away
   and is lit again after the return; Space pauses; End rests on the live
   reading, which must quote the same figures as the masthead; arrows step
   whole months; Home lands on election day; a timeline drag settles on a
   month; the month reel takes the wheel; R replays; Escape closes and hands
   focus back to the masthead dial. Layout: at each viewport the controls
   stay on screen, bar readings stay clear of the month and on screen, and
   the caption block stays clear of the timeline (a screen under 560px tall
   scrolls by design, so it is skipped).

   Serves the BUILT site from the repo root - run the build first. */
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

const state = (page) => page.evaluate(() => {
  const root = document.querySelector(".gp");
  const dial = document.querySelector("button.wm-glyph .wm-dial");
  const active = document.activeElement ? String(document.activeElement.className) : "";
  if (!root) return { open: false, glyphOp: dial.style.opacity, active };
  const t = document.querySelector(".gp-time");
  return { open: true, vt: t.getAttribute("aria-valuetext"), now: +t.getAttribute("aria-valuenow"),
           play: document.querySelector(".gp-play").getAttribute("aria-label"),
           cls: root.className, active, glyphOp: dial.style.opacity };
});
// the live reading the masthead quotes, read off the hero's implied figures
const liveQuote = (page) => page.evaluate(() => {
  const L = window.AP.tppLatest("alp_lnp", "imp"), O = window.AP.tppLatest("alp_on", "imp");
  const top = O && O.b > L.b ? { a: O.a, b: O.b, n: "One Nation" } : { a: L.a, b: L.b, n: "Coalition" };
  return "Now: Labor " + top.a.toFixed(1) + ", " + top.n + " " + top.b.toFixed(1);
});

for (const reduce of [false, true]) {
  console.log(`--- interaction, ${reduce ? "reduced motion" : "full motion"}`);
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setViewport({ width: 1280, height: 800 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }]);
  await page.goto(base + "/", { waitUntil: "networkidle0" });
  await wait(600);
  const quote = await liveQuote(page);
  await page.click("button.wm-glyph");
  await wait(reduce ? 300 : 450);
  let s = await state(page);
  ok(s.open && s.active.includes("gp-play"), "opens with focus on play/pause");
  ok(reduce ? s.glyphOp === "" : s.glyphOp === "0", reduce ? "masthead dial stays lit (no flight)" : "masthead dial goes dark while the dial is away");
  if (!reduce) {
    ok(s.play === "Pause", "running from the first frame: the button offers Pause");
    await page.keyboard.press("Space"); await wait(300);
    s = await state(page); ok(s.open && s.play === "Play", "Space pauses and leaves it open");
  } else ok(s.play === "Play" && s.vt.startsWith("Now:"), "opens paused on the live reading");
  await page.keyboard.press("End"); await wait(reduce ? 200 : 900);
  s = await state(page); ok(s.vt.startsWith(quote), `End rests on the masthead's figures (${s.vt} vs ${quote})`);
  const last = s.now;
  for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowLeft"); await wait(80); }
  await wait(reduce ? 200 : 1100);
  s = await state(page); ok(s.now === last - 3, `three arrow steps move three months (${last} -> ${s.now})`);
  await page.keyboard.press("Home"); await wait(reduce ? 200 : 1300);
  s = await state(page); ok(s.now === 0 && /^May 2025:/.test(s.vt), "Home lands on election day: " + s.vt);
  const box = await page.evaluate(() => { const r = document.querySelector(".gp-time").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(box.l + box.w * 0.2, box.t + box.h * 0.5);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) { await page.mouse.move(box.l + box.w * (0.2 + 0.05 * k), box.t + box.h * 0.5); await wait(16); }
  await wait(150); await page.mouse.up(); await wait(reduce ? 300 : 1400);
  s = await state(page); ok(s.now > 2 && s.now < last - 2 && /\d{4}: Labor/.test(s.vt), "a timeline drag settles on a month: " + s.vt);
  const reel = await page.evaluate(() => { const r = document.querySelector(".gp-when").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const before = s.now;
  await page.mouse.move(reel.x, reel.y);
  await page.mouse.wheel({ deltaY: 60 }); await wait(140); await page.mouse.wheel({ deltaY: 60 });
  await wait(reduce ? 300 : 1100);
  s = await state(page); ok(s.now === before + 2, `two wheel notches on the month reel move two months (${before} -> ${s.now})`);
  await page.keyboard.press("r"); await wait(reduce ? 1500 : 600);
  s = await state(page); ok(reduce ? s.now >= 1 : /gp-rw|gp-run/.test(s.cls), "R replays");
  await page.keyboard.press("Escape"); await wait(reduce ? 400 : 1300);
  s = await state(page);
  ok(!s.open, "Escape closes it");
  ok(s.glyphOp === "", "the masthead dial is lit again after the return");
  ok(/wm-glyph/.test(s.active), "focus goes back to the masthead dial");
  ok(!errs.length, "no page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
  await page.close();
}

console.log("--- layout, paused on the live reading");
for (const sz of ["1440x900", "1280x720", "1024x768", "860x1000", "768x1024", "960x600", "390x844", "375x667"]) {
  const [w, h] = sz.split("x").map(Number), mobile = w < 700;
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await page.goto(base + "/", { waitUntil: "networkidle0" });
  await wait(500);
  await page.click("button.wm-glyph");
  await wait(250);
  await page.keyboard.press("Space");
  await wait(1500);
  const m = await page.evaluate(() => {
    const R = (sel) => document.querySelector(sel).getBoundingClientRect();
    const labels = [...document.querySelectorAll(".gp-bl")].map((el) => el.getBoundingClientRect());
    return { vw: innerWidth, vh: innerHeight, ctlB: R(".gp-ctl").bottom, whenB: R(".gp-when").bottom,
             beatB: R(".gp-beat").bottom, timeT: R(".gp-time").top, dialW: R(".gp-dbox").width,
             lTop: Math.min(...labels.map((r) => r.top)), lL: Math.min(...labels.map((r) => r.left)), lR: Math.max(...labels.map((r) => r.right)) };
  });
  const bad = [];
  if (m.ctlB > m.vh + 0.5) bad.push(`controls off screen by ${Math.round(m.ctlB - m.vh)}px`);
  if (m.lTop < m.whenB - 2) bad.push("a bar reading rises into the month");
  if (m.lL < 0 || m.lR > m.vw) bad.push("a bar reading runs off screen");
  if (m.beatB > m.timeT + 2) bad.push("the caption block overlaps the timeline");
  ok(!bad.length, `${sz} (dial ${Math.round(m.dialW)}px)` + (bad.length ? ": " + bad.join("; ") : ""));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `${fails} CHECK(S) FAILED` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
