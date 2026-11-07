// Probe: /map/'s Informal figure hangs as a label line UNDER the How-votes-
// were-cast section (moved out of the winner head 2026-11-07 — it closed the
// head before; user call: it belongs with the count's cast-type story). The
// figure keeps the head's figures scope, verified against the raw 2025 data
// — pooled nationally, and per seat class under the scope menu.
// usage: node .matilda/probe/map-informal-line.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const f1 = (v) => (v == null || Number.isNaN(v) ? "–" : v.toFixed(1));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
await page.goto(`${base}/map/#y=2025`, { waitUntil: "networkidle2", timeout: 60000 });
await wait(1500);

// what the raw data says the rates are, pooled the way the app pools them
const expect = await page.evaluate(async () => {
  const r = await fetch("/map/data/core-2025.json"), j = await r.json();
  const pool = (rows) => {
    let inf = 0, formal = 0;
    for (const d of rows) { inf += d.inf || 0; for (const c of d.c) formal += c[4]; }
    return (100 * inf) / (formal + inf);
  };
  const byCls = {};
  for (const d of j.divs) {
    const cls = d.cls; if (!cls) continue;
    const t = (byCls[cls] = byCls[cls] || { inf: 0, formal: 0 });
    t.inf += d.inf || 0; for (const c of d.c) t.formal += c[4];
  }
  return { aus: pool(j.divs), byCls: Object.fromEntries(Object.entries(byCls).map(([k, t]) => [k, (100 * t.inf) / (t.formal + t.inf)])) };
});

const inf = () => page.evaluate(() => {
  const el = document.querySelector(".st-inf");
  if (!el) return { found: false };
  const heads = [...document.querySelectorAll("#story > .st-sec > h3")];
  const vt = heads.find((h) => /^How votes were cast/.test(h.textContent));
  const close = heads.find((h) => /^Closest seats/.test(h.textContent));
  const secs = heads.map((h) => h.textContent.trim().split(" ")[0]);
  return {
    found: true,
    count: document.querySelectorAll(".st-inf").length,
    text: el.textContent.trim(),
    inHead: !!el.closest(".st-stat"),
    prev: el.previousElementSibling ? el.previousElementSibling.className.split(" ")[0] : null,
    prevH3: el.previousElementSibling ? (el.previousElementSibling.querySelector("h3") || {}).textContent || "" : "",
    storyOrder: { vt: vt ? secs.indexOf(vt.textContent.trim().split(" ")[0]) : -1, close: close ? secs.indexOf(close.textContent.trim().split(" ")[0]) : -1 },
    topAboveVt: vt ? el.getBoundingClientRect().top >= vt.parentElement.getBoundingClientRect().bottom - 1 : null,
    aboveClosest: close ? el.getBoundingClientRect().bottom <= close.parentElement.getBoundingClientRect().top + 1 : null,
  };
});
let t = await inf();
ok("informal line exists, once, outside the head", t.found && t.count === 1 && t.inHead === false, JSON.stringify(t));
ok("one-decimal figure", !!t.text && /^Informal: \d+\.\d%$/.test(t.text), t.text);
ok("figure matches pooled 2025 rate", t.text === `Informal: ${f1(expect.aus)}%`, `${t.text} vs Informal: ${f1(expect.aus)}%`);
ok("directly under the How-votes-were-cast section", t.prev === "st-sec" && /^How votes were cast/.test(t.prevH3), `prev: ${t.prev} (h3: ${t.prevH3})`);
ok("and before the Closest seats section", t.topAboveVt === true && t.aboveClosest === true, JSON.stringify(t));

// it used to live in the head — make sure the head left nothing behind
const headGhost = await page.evaluate(() => [...document.querySelectorAll(".st-stat .st-lab")].some((x) => /^Informal:/.test(x.textContent)));
ok("no Informal label left in the winner head", headGhost === false);
const stale = await page.evaluate(() => [...document.querySelectorAll("#story .st-sec h3")].some((h) => /^Informal(\s|$)/.test(h.textContent)));
ok("no standalone Informal section either", !stale);

// a seat-class scope: the figure must pool that class's rate too, not sit on the national one
const picked = await page.evaluate(() => {
  const trig = document.querySelector("[data-scope-trigger]"); if (!trig) return null;
  trig.click();
  const menu = document.querySelector(".st-scm"); if (menu && menu.hasAttribute("hidden")) return "closed";
  const items = [...document.querySelectorAll(".st-scm [data-scope]")];
  const cls = items.find((it) => it.dataset.scope.startsWith("cls:"));
  if (!cls) return "none";
  cls.click();
  return cls.dataset.scope.slice(4) + "|" + cls.textContent.trim();
});
ok("scope menu offers seat classes", !!picked && !["closed", "none"].includes(picked), String(picked));
if (picked && !["closed", "none"].includes(picked)) {
  await wait(400);
  t = await inf();
  const vals = Object.values(expect.byCls).map((v) => `Informal: ${f1(v)}%`);
  ok("class scope pools its own rate, still outside the head", !!t.text && vals.includes(t.text) && t.inHead === false, `${t.text} (class rates ${vals.join(", ")})`);
  if (t.text && vals.length > 1) ok("class rates genuinely differ from national", t.text !== `Informal: ${f1(expect.aus)}%`, `${t.text} vs national Informal: ${f1(expect.aus)}%`);
}

// phone rung: the line fits, no new horizontal overflow
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await wait(600);
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("no horizontal overflow at 390px", over <= 0, `${over}px`);
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-informal-line: ok");
process.exit(fails.length ? 1 : 0);
