/* map-chart.mjs – the browser's side of /map/'s Chart drawing (node .build/test-map-chart.mjs pins
   the rest). Serve the repo root first (python3 -m http.server 8147), then:
     node .matilda/probe/map-chart.mjs http://localhost:8147 [shotsDir]
   Checks, at 1440, 1024, 820 and 390 wide, light and dark: every chart view draws dots and a head
   with no page errors; the key holds no slack under a chart (the white space a reader found under
   Informal, 2026-11-08); the street credit, the zoom buttons and the colour scale hide; the rail's
   Across-the-seats histogram steps aside; the arrow keys walk the seats and Enter opens one; the
   switches ride the URL; full screen seats the chart inside its plates; state frames and older
   years draw. With a shots dir it saves each chart for a look. WebKit (Safari's engine) draws the
   census chart too, through the Playwright under .matilda/probe/node_modules. */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const req = createRequire(path.resolve("package.json"));
const puppeteer = req("puppeteer-core");
const base = process.argv[2] || "http://localhost:8147", shots = process.argv[3] || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const fail = [];
const check = (ok, msg) => { if (!ok) { fail.push(msg); console.log("FAIL", msg); } };
const VIEWS = [
  ["age", "y=2025&l=seifa&i=age"], ["age-type", "y=2025&l=seifa&i=age&cs=type"], ["onepar", "y=2025&l=seifa&i=onepar"],
  ["ieo", "y=2025&l=seifa&i=ieo"], ["ten", "y=2025&l=seifa&i=ten&tn=mort"], ["spread", "y=2025&l=tpp"], ["close", "y=2025&l=tpp&cv=final"],
  ["postal", "y=2025&l=tpp&cv=post"], ["swing", "y=2025&l=tpp&m=swing"], ["fp-onp", "y=2025&l=fp&p=onp"], ["informal", "y=2025&l=informal"],
  ["flow", "y=2025&l=flow&p=grn"], ["senate", "y=2025&l=senate&p=grn"], ["vic22-fborn", "y=vic22&l=seifa&i=fborn"], ["sa26-tpp", "y=sa26&l=tpp"],
  ["close-2013", "y=2013&l=tpp&cv=final"], ["close-2004", "y=2004&l=tpp&cv=final"], ["now-age", "l=seifa&i=age"],
];
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
const go = async (hash) => { await page.goto(`${base}/map/?r=${Math.random().toString(36).slice(2)}#${hash}`, { waitUntil: "networkidle0" }); await page.waitForSelector("#chartv:not([hidden]) .ch-plot svg circle", { timeout: 20000 }).catch(() => {}); await new Promise((r) => setTimeout(r, 500)); };
const read = () => page.evaluate(() => {
  const c = document.querySelector("#chartv"), lg = document.querySelector("#legend"), vis = (e) => !!e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0;
  let bot = lg.getBoundingClientRect().top;
  for (const e of lg.querySelectorAll("*")) { const b = e.getBoundingClientRect(); if (b.height && vis(e) && getComputedStyle(e).visibility !== "hidden") bot = Math.max(bot, b.bottom); }
  const svg = c && c.querySelector(".ch-plot svg"), cb = c && c.getBoundingClientRect(), sb = svg && svg.getBoundingClientRect();
  const over = svg ? [...svg.querySelectorAll("text")].filter((t) => { const b = t.getBoundingClientRect(); return b.width && (b.right > cb.right + 2 || b.left < cb.left - 2); }).map((t) => t.textContent) : [];
  return {
    on: !!c && !c.hidden, head: c && c.querySelector(".ch-hed")?.textContent, dots: svg ? svg.querySelectorAll(".ch-dot").length : 0,
    slack: Math.round(lg.getBoundingClientRect().bottom - bot), credit: vis(document.querySelector("#credit")), ramp: vis(lg.querySelector(".lg-ramp")),
    zoomIn: vis(document.querySelector("#zin")), across: [...document.querySelectorAll("#story h3")].some((h) => /Across the seats/.test(h.textContent)),
    fits: !!sb && sb.height > 60 && sb.bottom <= cb.bottom + 1, over, url: location.hash,
  };
});
for (const dark of [false, true]) {
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }]);
  for (const [W, H] of dark ? [[1440, 1000], [390, 844]] : [[1440, 1000], [1024, 768], [820, 1180], [390, 844]]) {
    await page.setViewport({ width: W, height: H, deviceScaleFactor: shots ? 2 : 1 });
    for (const [name, hash] of VIEWS) {
      if (dark && !["age", "close", "spread"].includes(name)) continue;
      await go(`${hash}&draw=chart`);
      let r = await read();
      if (!r.on || !r.dots) { await new Promise((res) => setTimeout(res, 4000)); r = await read(); } // a cold first load
      const tag = `${name}@${W}${dark ? " dark" : ""}`;
      check(r.on && r.dots > 0, `${tag}: chart draws dots`);
      check(!!r.head && !/clear line|undefined|NaN/.test(r.head), `${tag}: head reads (${r.head})`);
      check(r.slack <= 16, `${tag}: key slack ${r.slack}px`);
      check(!r.credit && !r.ramp && !r.zoomIn, `${tag}: map furniture hidden`);
      check(!r.across, `${tag}: no Across-the-seats repeat`);
      check(r.fits, `${tag}: plot fits the stage`);
      check(!r.over.length, `${tag}: labels inside the chart (${r.over.join(", ")})`);
      if (shots && r.on) { const el = await page.$("#chartv"); await el.screenshot({ path: path.join(shots, `${name}-${W}${dark ? "-dark" : ""}.png`) }); }
    }
  }
}
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
// a frame without the measure says so in its head (Victoria 2022's census has no median age)
await go("y=vic22&l=seifa&i=age&draw=chart");
check(/^No census figures/.test(await page.$eval("#chartv .ch-hed", (e) => e.textContent).catch(() => "")), "a measure the frame lacks says so");
// a phone's close-seats chart has room beyond the six crossers, with the note folded
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await go("y=2025&l=tpp&draw=chart&cv=final");
const rowsN = await page.$$eval("#chartv .ch-rname", (e) => e.length);
check(rowsN >= 10, `phone close seats show ${rowsN} rows`);
check(await page.evaluate(() => !!document.querySelector("#chartv details.ch-fold:not([open])")), "phone note folds");
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
// the seats map still shows the rail's histogram (it steps aside only under a chart)
await go("y=2025&l=seifa&i=age");
check((await read()).across, "Seats drawing keeps Across the seats");
// keys: focus the plot, walk three seats, open the third
await go("y=2025&l=seifa&i=age&draw=chart");
await page.focus("#chartv .ch-plot");
for (let k = 0; k < 3; k++) await page.keyboard.press("ArrowRight");
const live = await page.$eval("#chartv .ch-live", (e) => e.textContent);
check(/:/.test(live) && !(await page.$eval("#tip", (e) => e.hidden)), `arrow keys light a seat (${live})`);
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 600));
check(await page.evaluate(() => !!document.querySelector("#chartv .ch-sel")), "Enter opens the seat (ring drawn)");
check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("ch-plot")), "focus stays on the chart");
// the switches ride the URL
await go("y=2025&l=tpp&draw=chart");
await page.click("[data-chtpp=cast]"); await new Promise((r) => setTimeout(r, 400));
await page.click("[data-chvs=post]"); await new Promise((r) => setTimeout(r, 400));
check(/cv=post/.test(await page.evaluate(() => location.hash)), "the vote-type switch writes cv=post");
await go("y=2025&l=seifa&i=age&draw=chart");
await page.click("[data-chsplit='1']"); await new Promise((r) => setTimeout(r, 400));
check(/cs=type/.test(await page.evaluate(() => location.hash)), "the seat-type split writes cs=type");
// full screen: the chart sits inside the plates
for (const [W, H] of [[1440, 1000], [390, 844]]) {
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await go("y=2025&l=seifa&i=age&draw=chart");
  await page.click("#fsgo");
  await new Promise((r) => setTimeout(r, 1200));
  const fs1 = await page.evaluate(() => {
    const c = document.querySelector("#chartv").getBoundingClientRect(), svg = document.querySelector("#chartv .ch-plot svg"), vis = (e) => !!e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0;
    return { w: Math.round(c.width), h: Math.round(c.height), fs: document.documentElement.classList.contains("mp-fs") || !!document.querySelector(".fs"), svg: svg ? Math.round(svg.getBoundingClientRect().height) : 0, zoom: vis(document.querySelector("#zin")), hint: vis(document.querySelector("#hint")) && !!document.querySelector("#hint").textContent.trim(), cities: vis(document.querySelector("#cities")) };
  });
  check(fs1.fs && fs1.w > 200 && fs1.svg > 60, `full screen @${W}: chart drawn (${JSON.stringify(fs1)})`);
  check(!fs1.zoom && !fs1.hint && !fs1.cities, `full screen @${W}: map furniture hidden (${JSON.stringify(fs1)})`);
  if (shots) await page.screenshot({ path: path.join(shots, `fullscreen-${W}.png`) });
  await page.keyboard.press("Escape");
}
// (the head's data-warm prefetch rejects when a load is cut short by the next one: the probe's pace, not the page's)
const realErrs = errs.filter((e) => !/Failed to fetch/.test(e));
check(!realErrs.length, `page errors: ${[...new Set(realErrs)].join(" | ")}`);
await browser.close();
// WebKit: Safari's engine draws the census chart and the close seats without errors
try {
  const pwAt = [path.resolve(".matilda/probe/node_modules/playwright-core"), path.join(process.env.HOME || "", ".matilda-tooling/pw/node_modules/playwright-core")].find((d) => fs.existsSync(d));
  const pw = req(pwAt);
  const wk = await pw.webkit.launch();
  const p = await wk.newPage({ viewport: { width: 1280, height: 900 } });
  const we = [];
  p.on("pageerror", (e) => we.push(String(e)));
  for (const [name, hash] of [["age", "y=2025&l=seifa&i=age&draw=chart"], ["close", "y=2025&l=tpp&draw=chart&cv=final"]]) {
    await p.goto(`${base}/map/?r=${Math.random()}#${hash}`, { waitUntil: "networkidle" });
    await p.waitForSelector("#chartv:not([hidden]) .ch-plot svg circle", { timeout: 20000 }).catch(() => {});
    const n = await p.$$eval("#chartv .ch-dot", (d) => d.length);
    check(n > 0, `WebKit ${name}: ${n} dots`);
    if (shots) await (await p.$("#chartv")).screenshot({ path: path.join(shots, `webkit-${name}.png`) });
  }
  check(!we.length, `WebKit page errors: ${we.join(" | ")}`);
  await wk.close();
} catch (e) { console.log("WebKit skipped:", e.message.split("\n")[0]); }
console.log(fail.length ? `map-chart: ${fail.length} failed` : "map-chart: ok");
process.exit(fail.length ? 1 : 0);
