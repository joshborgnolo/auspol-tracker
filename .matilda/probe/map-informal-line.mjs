// Probe: /map/'s Informal figure hangs as a label line UNDER the margin list
// at the foot of the winner story (moved out of the winner head 2026-11-07 —
// it closed the head before; followed How-votes-were-cast until 2026-11-08 —
// user call: it belongs below "Most marginal seats"). The figure keeps the
// head's figures scope, verified against the raw 2025 data — pooled
// nationally, and per seat class under the scope menu.
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
  const byCls = {}, byStateCls = {};
  for (const d of j.divs) {
    const cls = d.cls; if (!cls) continue;
    for (const [store, k] of [[byCls, cls], [byStateCls, `${d.st}|${cls}`]]) {
      const t = (store[k] = store[k] || { inf: 0, formal: 0 });
      t.inf += d.inf || 0; for (const c of d.c) t.formal += c[4];
    }
  }
  const rates = (o) => Object.fromEntries(Object.entries(o).map(([k, t]) => [k, (100 * t.inf) / (t.formal + t.inf)]));
  return { aus: pool(j.divs), byCls: rates(byCls), byStateCls: rates(byStateCls) };
});

const inf = () => page.evaluate(() => {
  const el = document.querySelector(".st-inf");
  if (!el) return { found: false };
  const heads = [...document.querySelectorAll("#story > .st-sec > h3")];
  const close = heads.find((h) => /^(Most marginal|Safest) seats/.test(h.textContent));
  const listSec = close ? close.parentElement : null;
  return {
    found: true,
    count: document.querySelectorAll(".st-inf").length,
    text: el.textContent.trim(),
    inHead: !!el.closest(".st-stat"),
    prev: el.previousElementSibling ? el.previousElementSibling.className.split(" ")[0] : null,
    prevH3: el.previousElementSibling ? (el.previousElementSibling.querySelector("h3") || {}).textContent || "" : "",
    next: el.nextElementSibling ? el.nextElementSibling.className.split(" ")[0] : null,
    // air below the last row, out to informal's own rule
    ruleGap: listSec ? Math.round((el.getBoundingClientRect().top - listSec.getBoundingClientRect().bottom) * 2) / 2 : null,
  };
});
let t = await inf();
ok("informal line exists, once, outside the head", t.found && t.count === 1 && t.inHead === false, JSON.stringify(t));
ok("one-decimal figure", !!t.text && /^Informal votes: \d+\.\d%$/.test(t.text), t.text);
ok("figure matches pooled 2025 rate", t.text === `Informal votes: ${f1(expect.aus)}%`, `${t.text} vs Informal votes: ${f1(expect.aus)}%`);
// centred inside its twin-rule pair: the gap above its text matches the gap below
const centred = await page.evaluate(() => {
  const inf = document.querySelector(".st-inf"), next = inf && inf.nextElementSibling;
  if (!inf || !next) return {};
  const padUp = parseFloat(getComputedStyle(inf).paddingTop);
  const dn = next.getBoundingClientRect().top - inf.getBoundingClientRect().bottom;
  return { padUp, dn: Math.round(dn * 2) / 2, nextRule: parseFloat(getComputedStyle(next).borderTopWidth) };
});
ok("informal line centred in its rule pair", centred.padUp && centred.padUp >= 9 && Math.abs(centred.padUp - centred.dn) <= 3, JSON.stringify(centred));
ok("directly under the margin-list section", t.prev === "st-sec" && /^(Most marginal|Safest) seats/.test(t.prevH3 || ""), `prev: ${t.prev} (h3: ${t.prevH3})`);
ok("last row sits 16px off informal's rule", Math.abs((t.ruleGap ?? 0) - 16) <= 1.5, `${t.ruleGap}px`);
ok("the credit line follows informal", t.next === "st-foot", t.next);

// it used to live in the head — make sure the head left nothing behind
const headGhost = await page.evaluate(() => [...document.querySelectorAll(".st-stat .st-lab")].some((x) => /^Informal votes:/.test(x.textContent)));
ok("no Informal label left in the winner head", headGhost === false);
const stale = await page.evaluate(() => [...document.querySelectorAll("#story .st-sec h3")].some((h) => /^Informal(\s|$)/.test(h.textContent)));
ok("no standalone Informal section either", !stale);

// a class pick compounds a sliced state (the menu offers states first, then
// seat types over the slice): the figure pools that class-within-the-state
const pickScope = (prefix) => page.evaluate((pfx) => {
  const trig = document.querySelector("[data-scope-trigger]"); if (!trig) return null;
  trig.click();
  const menu = trig.parentElement.querySelector(".st-scm");
  if (menu && menu.hasAttribute("hidden")) return "closed";
  const it = [...trig.parentElement.querySelectorAll("[data-scope]")].find((x) => x.dataset.scope.startsWith(pfx));
  if (!it) return "none";
  it.click();
  return it.dataset.scope;
}, prefix);
const stPick = await pickScope("st:");
ok("scope menu offers states", !!stPick && stPick.startsWith("st:"), String(stPick));
await wait(500);
const clsPick = stPick && stPick.startsWith("st:") ? await pickScope("cls:") : null;
ok("sliced menu offers seat types", !!clsPick && clsPick.startsWith("cls:"), String(clsPick));
await wait(500);
if (clsPick && clsPick.startsWith("cls:")) {
  const stCode = stPick.slice(3), clsCode = clsPick.slice(4), want = expect.byStateCls[`${stCode}|${clsCode}`];
  t = await inf();
  ok("class pick pools the class within the state, outside the head", want != null && t.text === `Informal votes: ${f1(want)}%` && t.inHead === false, `${t.text} vs Informal votes: ${f1(want ?? 0)}% for ${stCode}|${clsCode}`);
  if (t.text) ok("the pick genuinely moves the figure", t.text !== `Informal votes: ${f1(expect.aus)}%`, `${t.text} vs national Informal votes: ${f1(expect.aus)}%`);
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
