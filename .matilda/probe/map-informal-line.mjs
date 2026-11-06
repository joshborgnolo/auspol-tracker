// Probe: /map/'s Informal figure is a label line under the Seats row in the
// Winner head (no more standalone st-sec), pooled from counts — verified
// against the raw 2025 data, and pooled per seat class under the scope menu.
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

const labs = () => page.evaluate(() => [...document.querySelectorAll(".st-stat .st-lab")].map((x) => x.textContent.trim()));
let ls = await labs();
const inf = ls.find((t) => /^Informal:/.test(t));
ok("informal label line exists in the head", !!inf, JSON.stringify(ls));
ok("one-decimal figure", !!inf && /^Informal: \d+\.\d%$/.test(inf), inf);
ok("figure matches pooled 2025 rate", !!inf && inf === `Informal: ${f1(expect.aus)}%`, `${inf} vs Informal: ${f1(expect.aus)}%`);
const iInf = ls.findIndex((t) => /^Informal:/.test(t)), iSeats = ls.findIndex((t) => /^Seats/.test(t));
ok("informal sits under Seats", iInf > iSeats && iInf === ls.length - 1, `${iInf} after seats ${iSeats}`);
const stale = await page.evaluate(() => [...document.querySelectorAll("#story .st-sec h3")].some((h) => /^Informal(\s|$)/.test(h.textContent)));
ok("standalone Informal section is gone", !stale);

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
  ls = await labs();
  const inf2 = ls.find((t) => /^Informal:/.test(t));
  const vals = Object.values(expect.byCls).map((v) => `Informal: ${f1(v)}%`);
  ok("class scope pools its own rate", !!inf2 && vals.includes(inf2), `${inf2} (class rates ${vals.join(", ")})`);
  if (inf2 && vals.length > 1) ok("class rates genuinely differ from national", inf2 !== `Informal: ${f1(expect.aus)}%`, `${inf2} vs national Informal: ${f1(expect.aus)}%`);
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
