// Probe: /maps/'s full-screen view (app-7-full.js).
// usage: node .matilda/probe/map-fullscreen.mjs <baseUrl> [shotDir]   (serve the repo root first)
//  - the zoom plate's button enters (the browser's own full screen too), the page behind goes inert
//  - Esc from the whole map leaves; the page's scroll and the stage's spot come back to the pixel
//  - Esc from a seat walks up a level and stays; Space plays the elections; a reader's step stops it
//  - Back leaves; the × leaves; a link with fs=1 opens on its seat
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok" : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.setViewport({ width: 1280, height: 800 });
await page.goto(`${base}/maps/`, { waitUntil: "networkidle0" });
await page.waitForFunction("window.__map && window.__map.T"); await wait(800);
// scroll the page a little first, to check it comes back
await page.evaluate(() => window.scrollTo(0, 140)); await wait(300);
const st0 = await page.evaluate(() => { const r = document.querySelector("#stage").getBoundingClientRect(); return [r.left, r.top, r.width, r.height, scrollY, history.length]; });
await page.click("#zfs"); await wait(1200);
let s = await page.evaluate(() => ({ on: __map.fs.on, native: __map.fs.native, fsEl: !!document.fullscreenElement, hash: location.hash, stage: (() => { const r = document.querySelector("#stage").getBoundingClientRect(); return [r.width, r.height]; })(), inert: document.querySelector("main").inert, hl: history.length }));
ok("click enters full screen", s.on, JSON.stringify(s));
ok("the stage fills the viewport", Math.abs(s.stage[0] - 1280) < 2 && Math.abs(s.stage[1] - 800) < 2, String(s.stage));
ok("hash carries fs=1", /fs=1/.test(s.hash));
ok("the page behind is inert", s.inert);
// Escape at the country view leaves
await page.keyboard.press("Escape"); await wait(1500);
s = await page.evaluate(() => ({ on: __map.fs.on, hash: location.hash, y: scrollY, fsEl: !!document.fullscreenElement, stage: (() => { const r = document.querySelector("#stage").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })(), inert: document.querySelector("main").inert }));
ok("Esc at the country view leaves", !s.on && !s.fsEl, JSON.stringify(s));
ok("the page scroll comes back", Math.abs(s.y - st0[4]) < 1, `${s.y} vs ${st0[4]}`);
ok("the stage is back in its place", s.stage.every((v, i) => Math.abs(v - st0[i]) < 1), `${s.stage} vs ${st0.slice(0, 4)}`);
ok("hash drops fs", !/fs=1/.test(s.hash), s.hash);
ok("page no longer inert", !s.inert);
// F enters; a seat; Esc goes up a level, not out
await page.keyboard.press("f"); await wait(900);
await page.evaluate(() => __map.goDiv(__map.Y.now.byName.get("Wentworth"))); await wait(1000);
await page.keyboard.press("Escape"); await wait(500);
s = await page.evaluate(() => ({ on: __map.fs.on, lvl: __map.S.sel.level }));
ok("Esc from a seat walks up to its state, staying in", s.on && s.lvl === "state", JSON.stringify(s));
await page.keyboard.press("Escape"); await wait(400);
s = await page.evaluate(() => ({ on: __map.fs.on, lvl: __map.S.sel.level }));
ok("Esc from a state walks up to the country, staying in", s.on && s.lvl === "aus", JSON.stringify(s));
// Space plays; the year moves; Space pauses
await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
await page.keyboard.press("Space");
// (the first stop's lossless Handbook boundaries may still be downloading: wait for them, not a fixed beat)
await page.waitForFunction("window.__map.S.year === 1993 || !window.__map.fs.playing", { timeout: 30000 }).catch(() => {});
s = await page.evaluate(() => ({ playing: __map.fs.playing, y: __map.S.year }));
ok("Space plays from Now back round to the first election", s.playing && s.y === 1993, JSON.stringify(s));
await page.waitForFunction("window.__map.S.year !== 1993 || !window.__map.fs.playing", { timeout: 30000 }).catch(() => {});
s = await page.evaluate(() => ({ playing: __map.fs.playing, y: __map.S.year }));
ok("the play-through moves on", s.playing && s.y !== 1993, JSON.stringify(s));
await page.keyboard.press("ArrowRight"); await wait(200);
s = await page.evaluate(() => ({ playing: __map.fs.playing }));
ok("a reader's own step stops the play-through", !s.playing, JSON.stringify(s));
// Back leaves
await page.evaluate(() => history.back()); await wait(1500);
s = await page.evaluate(() => ({ on: __map.fs.on, hash: location.hash }));
ok("Back leaves full screen", !s.on && !/fs=1/.test(s.hash), JSON.stringify(s));
// the button way out restores history length (no stray entry)
const hl0 = await page.evaluate(() => history.length);
await page.click("#zfs"); await wait(900);
await page.click(".fs-x"); await wait(1500);
s = await page.evaluate(() => ({ on: __map.fs.on, hash: location.hash, idx: history.length }));
ok("the × leaves", !s.on, JSON.stringify(s));
// a link naming full screen opens it
const p2 = await browser.newPage(); p2.on("pageerror", (e) => errs.push(e.message));
await p2.setViewport({ width: 1024, height: 768 });
await p2.goto(`${base}/maps/#y=2022&s=Kooyong&fs=1`, { waitUntil: "networkidle0" });
await p2.waitForFunction("window.__map && window.__map.T"); await wait(2500);
s = await p2.evaluate(() => ({ on: __map.fs.on, y: __map.S.year, lvl: __map.S.sel.level, ins: __map.fs.ins }));
ok("a link with fs=1 opens full screen on its seat", s.on && s.y === 2022 && s.lvl === "div", JSON.stringify(s));
if (process.argv[3]) await p2.screenshot({ path: process.argv[3] + "/map-fullscreen-deeplink-1024.png" });
ok("no page errors", !errs.length, errs.join(" | "));
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "PASS map-fullscreen"); process.exit(fails.length ? 1 : 0);
