// Probe: the /map/ Winner head's sections each close on a double rule —
// two hairlines, tightly spaced (one after Two-party, one after Primaries,
// one closing the Seats block) — and the rules survive a scope change
// without piling up. usage: node .matilda/probe/map-head-separators.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
await page.goto(`${base}/map/#y=2025`, { waitUntil: "networkidle2", timeout: 60000 });
await wait(1500);

// the head's child sequence, separators included
const seps = await page.evaluate(() => document.querySelectorAll(".st-stat > .st-sep").length);
ok("three separators in the head", seps === 3, `got ${seps}`);
const kinds = (await page.evaluate(() => [...document.querySelector(".st-stat").children].map((x) => x.classList.contains("st-sep") ? "SEP" : x.classList.contains("st-lab") ? `LAB(${x.textContent.trim().split(/[ (]/)[0]})` : x.className.split(" ")[0].replace("st-", ""))));
ok("separator after the two-party block, before Primaries", kinds.some((k, i) => k === "SEP" && kinds[i + 1] === "LAB(Primaries)"), JSON.stringify(kinds));
ok("separator after the primary grid, before Seats", kinds.some((k, i) => k === "SEP" && kinds[i + 1] === "LAB(Seats)"), JSON.stringify(kinds));
ok("closing separator last, after Informal", kinds.length > 1 && kinds[kinds.length - 1] === "SEP" && kinds[kinds.length - 2] === "LAB(Informal:)", JSON.stringify(kinds.slice(-3)));

// the rule itself: two 1px hairlines, tightly spaced, full width of the head
const geom = await page.evaluate(() => {
  const head = document.querySelector(".st-stat");
  return [...head.querySelectorAll(".st-sep")].map((s) => {
    const cs = getComputedStyle(s), r = s.getBoundingClientRect(), hr = head.getBoundingClientRect();
    return { top: cs.borderTopWidth, bot: cs.borderBottomWidth, h: r.height, w: r.width, hw: hr.width };
  });
});
ok("every separator is two 1px lines", geom.every((g) => g.top === "1px" && g.bot === "1px"), JSON.stringify(geom.map((g) => [g.top, g.bot])));
ok("the two lines are tightly spaced (4px tall, 2px apart)", geom.every((g) => g.h === 4), JSON.stringify(geom.map((g) => g.h)));
ok("each separator spans the head's width", geom.every((g) => Math.abs(g.w - g.hw) < 1), JSON.stringify(geom.map((g) => `${g.w}/${g.hw}`)));

// a scope swap re-renders the head: still exactly three rules, no duplicates
await page.evaluate(() => {
  document.querySelector("[data-scope-trigger]").click();
  const it = [...document.querySelectorAll(".st-scm [data-scope]")].find((x) => x.dataset.scope.startsWith("cls:"));
  it.click();
});
await wait(400);
const seps2 = await page.evaluate(() => document.querySelectorAll(".st-stat > .st-sep").length);
ok("three separators after a scope change", seps2 === 3, `got ${seps2}`);

// a real election frame: the formed-govt tag rides the two-party block ahead of its rule
await page.goto(`${base}/map/#y=2022`, { waitUntil: "networkidle2", timeout: 60000 });
await wait(1200);
const kinds22 = await page.evaluate(() => [...document.querySelector(".st-stat").children].map((x) => x.classList.contains("st-sep") ? "SEP" : x.classList.contains("st-lab") ? `LAB(${x.textContent.trim().split(/[ (]/)[0]})` : x.className.split(" ")[0].replace("st-", "")));
const iFg = kinds22.indexOf("fg");
ok("2022: formed-govt tag sits inside the two-party block, rule after it", iFg > 0 && kinds22[iFg + 1] === "SEP" && kinds22[iFg + 2] === "LAB(Primaries)", JSON.stringify(kinds22.slice(0, 8)));
ok("2022: three separators too", kinds22.filter((k) => k === "SEP").length === 3, `${kinds22.filter((k) => k === "SEP").length}`);

// phone rung: rules don't add overflow
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await wait(600);
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("no horizontal overflow at 390px", over <= 0, `${over}px`);
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-head-separators: ok");
process.exit(fails.length ? 1 : 0);
