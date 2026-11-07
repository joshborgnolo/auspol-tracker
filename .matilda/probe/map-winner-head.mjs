/* Headless pin for the Winner-lens head work, 2026-11-06:
   1. state election frames gain the two-party change line they lacked
      (agg.ptpp stamped from the shipped previous frame; sa26 stays bare
      because its notional tally covers 28% of the roll v sa22's 88%);
   2. 'now' frames show NO primary or two-party deltas (seats keep theirs);
   3. the winner lens has NO seat legend at all — its title alone opens the
      strip's .lg-head line, the Jump-to cities and the City-names toggle
      ride the strip (off the map's top-left overlay), and the Drawn-as
      switch closes it as the bottom line; the seat tallies stay solely in
      the head's Seats row (2026-11-07);
   4. the winner head retires the duplicate Two-party-preferred hero
      section below it (kept on the tpp lens);
   5. the by-state table is headed "By state or territory". */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.BASE
  ? path.resolve(process.env.BASE)
  : decodeURIComponent(new URL("../../", import.meta.url).pathname);
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

const fails = [], oks = [];
const check = (name, cond, detail) => {
  if (cond) { oks.push(name); console.log(`ok   ${name}`); }
  else { fails.push(`${name}${detail ? " — " + detail : ""}`); console.log(`FAIL ${name}${detail ? " — " + detail : ""}`); }
};

async function open(y, width = 1280) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 950 });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${base}/map/#y=${y}`, { waitUntil: "load", timeout: 30000 });
  const waitA = () => page.waitForFunction(() => window.__map && window.__map.M && window.__map.M(), { timeout: 45000 });
  try { await waitA(); }
  catch (e) {
    const st = await page.evaluate(() => ({ map: !!window.__map, errs: (window.__map, null), len: document.body ? document.body.innerHTML.length : -1 }));
    console.log(`open(${y}) waitA failed; page state`, st, "pageerrors:", page.errors);
    throw e;
  }
  await page.waitForFunction((yy) => window.__map.M() && String(window.__map.M().year) === yy, { timeout: 45000 }, String(y));
  await new Promise((r) => setTimeout(r, 1200)); // SUM lands, story re-renders
  return page;
}
const stat = (page) => page.evaluate(() => {
  const el = document.querySelector(".st-stat");
  if (!el) return null;
  const swingEl = el.querySelector(".st-swing");
  return {
    swing: swingEl ? swingEl.textContent.trim() : null,
    two: el.querySelector(".st-tpp") ? el.querySelector(".st-tpp").textContent.trim() : null,
    seatSmalls: [...el.querySelectorAll(".st-seats small")].map((x) => x.textContent.trim()),
    fpSmalls: [...el.querySelectorAll(".st-fps small")].map((x) => x.textContent.trim()),
    tppHero: [...document.querySelectorAll(".st-sec h3")].some((h) => h.textContent.trim().startsWith("Two-party preferred")),
    byState: [...document.querySelectorAll(".st-sec h3")].map((h) => h.textContent.trim()),
    dek: document.querySelector(".st-dek") ? document.querySelector(".st-dek").textContent : "",
  };
});

// ---- 1. nsw23 gains the swing line; old hero gone
{
  const p = await open("nsw23");
  const s = await stat(p);
  check("nsw23 two-party swing line", s.swing && s.swing.includes("+5.7"), JSON.stringify(s.swing));
  check("nsw23 seat deltas present", s.seatSmalls.some((t) => /[0-9]/.test(t)), JSON.stringify(s.seatSmalls));
  check("nsw23 primary deltas present", s.fpSmalls.some((t) => /[0-9]/.test(t)), JSON.stringify(s.fpSmalls));
  check("no duplicate 2PP hero under the winner head", s.tppHero === false);
  await p.close();
}
// ---- qld24 signs correctly (a Coalition-ward swing)
{
  const p = await open("qld24");
  const s = await stat(p);
  check("qld24 two-party swing line", s.swing && /\+6\.[56]/.test(s.swing), JSON.stringify(s.swing));
  await p.close();
}
// ---- vic22 also signs correctly
{
  const p = await open("vic22");
  const s = await stat(p);
  check("vic22 two-party swing line", s.swing && /\+2\.[34]/.test(s.swing), JSON.stringify(s.swing));
  await p.close();
}
// ---- nsw15 (a row's first stop) and sa26 (coverage-guarded) stay bare
{
  const p = await open("nsw15");
  const s = await stat(p);
  check("nsw15 has no two-party swing (row's first stop)", s.swing === null, JSON.stringify(s.swing));
  check("nsw15 has no primary deltas either", s.fpSmalls.length === 0, JSON.stringify(s.fpSmalls));
  await p.close();
}
{
  const p = await open("sa26");
  const s = await stat(p);
  check("sa26 has no two-party swing (coverage guard)", s.swing === null, JSON.stringify(s.swing));
  check("sa26 still gets its primary deltas", s.fpSmalls.some((t) => /[0-9]/.test(t)), JSON.stringify(s.fpSmalls));
  await p.close();
}
// ---- federal 2025 keeps its own stored swing; by-state heading renamed
{
  const p = await open("2025");
  const s = await stat(p);
  check("2025 keeps its recorded swing", s.swing && s.swing.includes("+3.1"), JSON.stringify(s.swing));
  check("2025 winner head retires the old 2PP hero", s.tppHero === false);
  check('the table now says "By state or territory"', s.byState.includes("By state or territory"), s.byState.join("|"));
  await p.close();
}
// ---- the tpp lens keeps the hero section
{
  const p = await open("2025");
  await p.evaluate(() => window.__map.setLens("tpp"));
  await new Promise((r) => setTimeout(r, 600));
  const hero = await p.evaluate(() => [...document.querySelectorAll(".st-sec h3")].some((h) => h.textContent.trim().startsWith("Two-party preferred")));
  check("tpp lens still shows the two-party hero section", hero === true);
  await p.close();
}
// ---- now frame: figures stay, vote deltas vanish, seat deltas remain
{
  const p = await open("now");
  const s = await stat(p);
  check("now: two-party figures still shown", s.two && /55\.\d/.test(s.two), JSON.stringify(s.two));
  check("now: no two-party swing line", s.swing === null, JSON.stringify(s.swing));
  check("now: no primary deltas", s.fpSmalls.length === 0, JSON.stringify(s.fpSmalls));
  check("now: seat deltas remain", s.seatSmalls.length === 3 && s.seatSmalls.some((t) => t === "+2"), JSON.stringify(s.seatSmalls));
  check("now: winner head also retires the 2PP hero", s.tppHero === false);
  await p.close();
}
// ---- winner legend: title alone up top; the Jump-to cities and the City-names
// toggle ride the strip (off the map's top-left overlay); Drawn-as closes the
// section as its bottom line, spanning full width and sat left
{
  const p = await open("now");
  const strip = await p.evaluate(() => {
    const legend = document.querySelector("#legend");
    const hd = legend.querySelector(".lg-head");
    const jump = legend.querySelector(".lg-jump");
    const draw = [...legend.children].filter((c) => c.classList.contains("lg-draw"));
    const d = draw[0];
    return {
      title: hd ? hd.querySelector(".lg-t").textContent.trim() : null,
      headChildren: hd ? [...hd.children].map((c) => c.className.split(" ")[0]) : null,
      headInLeft: !!(hd && hd.closest(".lg-left")),
      cats: legend.querySelectorAll(".lg-cats").length,
      mpCitiesGone: !document.querySelector(".mp-cities"),
      citiesInOverlay: !document.querySelector(".mp-tl #cities"),
      jumpId: jump ? jump.id : null,
      jumpLabel: jump ? jump.querySelector("b").textContent.trim() : null,
      jumpChips: jump ? jump.querySelectorAll(".mp-ca").length : 0,
      hintId: legend.querySelector(".lg-hint") ? legend.querySelector(".lg-hint").id : null,
      hintText: legend.querySelector(".lg-hint") ? legend.querySelector(".lg-hint").textContent.trim() : null,
      hintNotOnStage: !document.querySelector(".mp-tl #hint"),
      toggleText: jump ? jump.querySelector("[data-towns]").textContent.trim() : null,
      togglePressed: jump ? jump.querySelector("[data-towns]").getAttribute("aria-pressed") : null,
      drawCount: draw.length,
      drawIsLast: d ? legend.children[legend.children.length - 1] === d : null,
      drawCol: d ? getComputedStyle(d).gridColumn : null,
      drawButtons: d ? [...d.querySelectorAll("button")].map((b) => b.textContent.trim()).join(",") : "",
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  check("legend: title alone in the head line, outside lg-left, no seat legend", strip.headInLeft === false && strip.headChildren.length === 1 && strip.headChildren[0] === "lg-t" && strip.cats === 0, JSON.stringify(strip));
  check("legend: the old top-left cities overlay is gone", strip.mpCitiesGone && strip.citiesInOverlay);
  check("legend: the Jump-to row rides the strip with all eight capital cities", strip.jumpId === "cities" && strip.jumpLabel === "Jump to:" && strip.jumpChips === 8, JSON.stringify(strip));
  check("legend: the zoom hint rides the strip too, its overlay gone", strip.hintId === "hint" && /Zoom in, or choose a seat/.test(strip.hintText) && strip.hintNotOnStage, JSON.stringify(strip));
  check("legend: starter City names toggle, pressed (names on)", strip.toggleText === "City names" && strip.togglePressed === "true", JSON.stringify(strip));
  check("legend: Drawn-as closes the section, its own last row at full width", strip.drawCount === 1 && strip.drawIsLast === true && strip.drawCol === "1 / -1" && strip.drawButtons === "Seats,Balloons,Surface,Areas", JSON.stringify(strip));
  check("legend: no horizontal overflow", strip.over <= 0, String(strip.over));
  // the Title on the Zoom-selected frame later keeps this shape; first the toggle works
  const shotOn = await p.evaluate(() => document.querySelector("#cv").toDataURL().length);
  await p.evaluate(() => document.querySelector("[data-towns]").click());
  await new Promise((r) => setTimeout(r, 900));
  const toggled = await p.evaluate(() => ({ aria: document.querySelector("[data-towns]").getAttribute("aria-pressed"), shot: document.querySelector("#cv").toDataURL().length }));
  check("the City-names toggle flips its pressed state", toggled.aria === "false", toggled.aria);
  check("hiding names repaints the canvas differently", toggled.shot !== shotOn, `${shotOn} → ${toggled.shot}`);
  await p.evaluate(() => document.querySelector("[data-towns]").click());
  await new Promise((r) => setTimeout(r, 300));
  await p.evaluate(() => window.__map.setDraw("balloons"));
  await new Promise((r) => setTimeout(r, 700));
  const balloons = await p.evaluate(() => ({
    cats: document.querySelectorAll(".lg-cats").length,
    bal: !!document.querySelector(".lg-bal"),
    chips: document.querySelectorAll(".lg-jump .mp-ca").length,
    drawIsLast: document.querySelector("#legend").lastElementChild.classList.contains("lg-draw"),
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check("over booths too: no seat legend, jump row stands, draw closes the strip", balloons.cats === 0 && balloons.bal && balloons.chips === 8 && balloons.drawIsLast && balloons.over <= 0, JSON.stringify(balloons));
  await p.evaluate(() => { window.__map.setDraw("seats"); window.__map.setYear(2025); });
  await new Promise((r) => setTimeout(r, 900));
  const y2025 = await p.evaluate(() => ({
    headText: (document.querySelector(".lg-head .lg-t") || {}).textContent || "",
    chips: document.querySelectorAll(".lg-jump .mp-ca").length,
  }));
  check("2025: head names the election, the jump row holds", y2025.chips === 8 && /Who won each seat in 2025/.test(y2025.headText), JSON.stringify(y2025));
  await p.close();
}

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} FAILED` : `\nall ${oks.length} checks passed`);
process.exit(fails.length ? 1 : 0);
