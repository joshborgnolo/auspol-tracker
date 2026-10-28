/* Probe: phone touch-swipe walking on the Public opinion Sort row
   (rd-public-opinion.jsx PubOpSort, registered by data-rd-swipe + __rdSwipe so the
   app's swipe effect treats the row like any tab row, user call
   2026-10-21 "walkable like any other menu bar").
   A right-to-left flick on the row steps issue -> pollster -> recency
   and wraps round; left-to-right walks back. The row's reach covers its
   whole owner section (the Public opinion catalogue), so a flick deep
   in a topic head steps the sort too and the path stays /public-opinion/;
   a flick under the section's end is the plain page turn to the next tab
   document (/changelog/). BASE=<tree> serves another tree's build. */
import puppeteer from "puppeteer-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.env.BASE || decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(b); }); });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0; const fail = (m) => { console.log("FAIL " + m); bad++; };
const W = 390, H = 844;
const x0 = Math.round(W * 0.8), x1 = Math.round(W * 0.15);
const page = await browser.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.setViewport({ width: W, height: H, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(`${base}/public-opinion/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".pubop-sort-g[data-rd-swipe]", { timeout: 20000 }); await sleep(400);
const wired = await page.evaluate(() => typeof document.querySelector(".pubop-sort-g").__rdSwipe === "function");
if (!wired) fail("sort row is marked data-rd-swipe but carries no __rdSwipe handler");
const cdp = await page.createCDPSession();
const flick = async (fx, tx, y) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fx, y, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await sleep(18); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: Math.round(fx + ((tx - fx) * i) / 6), y, id: 1 }] }); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
const state = () => page.evaluate(() => ({ pressed: [...document.querySelectorAll(".pubop-sort-b")].map((b) => b.getAttribute("aria-pressed")).join(), path: location.pathname }));
const expect = async (want, at) => {
  await sleep(450);
  const s = await state();
  if (s.pressed !== want) fail(`${at}: sort state ${s.pressed}, wanted ${want}`);
  if (s.path !== "/public-opinion/") fail(`${at}: path drifted to ${s.path}`);
};
/* six flicks through the row centre: forward wraps recency -> issue,
   backward wraps issue -> recency */
const rowY = async () => {
  await page.evaluate(() => document.querySelector(".pubop-sort").scrollIntoView({ behavior: "instant", block: "center" }));
  await sleep(200);
  return page.evaluate(() => { const r = document.querySelector(".pubop-sort-g").getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
};
const seq = [["false,true,false"], ["false,false,true"], ["true,false,false"], ["false,false,true"], ["false,true,false"], ["true,false,false"]];
for (let i = 0; i < seq.length; i++) {
  const dir = i < 3 ? 1 : -1; const y = await rowY();
  await flick(dir > 0 ? x0 : x1, dir > 0 ? x1 : x0, y); await expect(seq[i][0], `row flick ${i + 1}`);
}
/* just under the row is inside its reach band */
{
  const y = await page.evaluate(() => { const r = document.querySelector(".pubop-sort-g").getBoundingClientRect(); return Math.round(r.bottom + 30); });
  await flick(x0, x1, y); await expect("false,true,false", "flick just under the row");
}
/* deep in the catalogue the row still owns the flick (section reach) */
{
  const deep = await page.evaluate(() => {
    const h = [...document.querySelectorAll(".pubop-mon h3, .pubop-topic h3")][3];
    h.scrollIntoView({ behavior: "instant", block: "center" });
    const r = h.getBoundingClientRect();
    const sec = document.querySelector(".pubop-sort-g").closest("section");
    return { y: Math.round(r.top + r.height / 2), sec: sec ? sec.id || sec.className : "none" };
  });
  await sleep(250);
  await flick(x0, x1, deep.y); await expect("false,false,true", "flick on a group head deep in the catalogue");
  console.log("sort row owner section: " + deep.sec);
}
/* past the section's end the flick is the plain page turn */
{
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(300);
  const foot = await page.evaluate(() => {
    const r = document.querySelector(".pubop-sort-g").closest("section").getBoundingClientRect();
    return { bottom: Math.round(r.bottom), ih: innerHeight };
  });
  if (foot.bottom > foot.ih - 100) fail(`catalogue section runs to the viewport foot (${foot.bottom} of ${foot.ih}); nowhere to flick past the row's reach`);
  else {
    await flick(x0, x1, Math.min(foot.bottom + 40, foot.ih - 60));
    await sleep(700);
    const nav = await page.evaluate(() => ({ path: location.pathname, sort: document.querySelectorAll(".pubop-sort-b").length }));
    if (nav.path !== "/changelog/") fail(`flick under the catalogue turned to ${nav.path}, wanted the next tab document /changelog/`);
    if (nav.sort) fail("sort row still mounted after the page turn");
  }
}
if (errs.length) fail(`page errors ${errs.slice(0, 3)}`);
await browser.close(); server.close();
console.log(bad ? bad + " failure(s)" : "ALL PASS: sort-row swipe walks and wraps, reach covers the catalogue, page turn below it");
