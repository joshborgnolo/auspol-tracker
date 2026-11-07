// Probe: the census lenses' "Across the seats" side chart, ranked into tenths —
//   1. a census view (median age, born overseas…) shows TEN bars of near-equal
//      total height, stacked by holder, with the tenths note and boundary
//      value ticks (no "%" on a median, "%" on a share);
//   2. the SEIFA decile views keep their contract (the data's own deciles,
//      "least advantaged" note, 1/5/10 ticks);
//   3. phone widths don't overflow.
// usage: node .matilda/probe/map-census-tenths.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8141"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const netMiss = [];
page.on("requestfailed", (r) => netMiss.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) netMiss.push(`${r.status()}: ${r.url()}`); });
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });

const read = () => page.evaluate(() => {
  const sec = [...document.querySelectorAll(".st-sec")].find((s) => (s.querySelector("h3") || {}).textContent && s.querySelector("h3").textContent.includes("Across the seats"));
  if (!sec) return { found: false, secs: [...document.querySelectorAll(".st-sec h3")].map((h) => h.textContent.trim()) };
  const svg = sec.querySelector("svg");
  const note = sec.querySelector(".st-note");
  const bins = new Map();
  if (svg) for (const r of svg.querySelectorAll("rect[data-bin]")) {
    const k = r.dataset.bin, y = parseFloat(r.getAttribute("y")), h = parseFloat(r.getAttribute("height"));
    const b = bins.get(k) || { pieces: 0, top: null, bottom: 0 };
    b.pieces++; b.top = b.top == null ? y : Math.min(b.top, y); b.bottom = Math.max(b.bottom, y + h); b.fills = b.fills || new Set(); b.fills.add(r.getAttribute("fill"));
    bins.set(k, b);
  }
  const ticks = svg ? [...svg.querySelectorAll("text")].map((t) => t.textContent) : [];
  const hl = sec.querySelector("h3");
  return {
    found: true,
    head: hl ? hl.textContent.trim() : "",
    note: note ? note.textContent : "",
    ticks,
    nBins: bins.size,
    heights: [...bins.entries()].map(([k, b]) => +(b.bottom - (b.top ?? b.bottom)).toFixed(1)),
    pieces: [...bins.values()].map((b) => b.pieces),
  };
});
const show = async (url) => { await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }); await page.reload({ waitUntil: "networkidle2" }); await wait(1600); };

// median age: ten stacked tenths, year tick labels, no % suffix
await show(`${base}/map/#y=2025&l=seifa&i=age`);
let d = await read();
ok("age: Across-the-seats section rendered", d.found, (d.secs || []).join("|"));
ok("age: ten bins", d.nBins === 10, String(d.nBins));
ok("age: bars stacked by holder", d.pieces.length === 10 && d.pieces.some((p) => p > 1), String(d.pieces));
ok("age: tenths near-equal in height", d.heights.length === 10 && Math.max(...d.heights) - Math.min(...d.heights) <= 8, String(d.heights));
ok("age: tenths note", /Each bar is a tenth of the 150 seats/.test(d.note), d.note);
ok("age: not the SEIFA wording", !/least advantaged/.test(d.note), d.note);
ok("age: year ticks at the ends and the mid cut, no %", d.ticks.length === 3 && !d.ticks.some((t) => t.includes("%")), d.ticks.join(","));

// born overseas (a share): ten tenths, percent-suffixed top tick
await show(`${base}/map/#y=2025&l=seifa&i=fborn`);
d = await read();
ok("fborn: ten stacked tenths", d.nBins === 10 && d.pieces.some((p) => p > 1), `${d.nBins} bins, ${d.pieces}`);
ok("fborn: tenths near-equal in height", d.heights.length === 10 && Math.max(...d.heights) - Math.min(...d.heights) <= 8, String(d.heights));
ok("fborn: share ticks, top end carries %", d.ticks.length === 3 && d.ticks[2].endsWith("%"), d.ticks.join(","));

// SEIFA decile lens unchanged: data deciles, its own note, 1/5/10 ticks
await show(`${base}/map/#y=2025&l=seifa&i=ieo`);
d = await read();
ok("ieo: decile ticks 1/5/10", d.ticks.join(",") === "1,5,10", d.ticks.join(","));
ok("ieo: the SEIFA wording stands", /least advantaged/.test(d.note), d.note);

// a state frame: SA 2026's 47 districts still rank into ten tenths
await show(`${base}/map/#y=sa26&l=seifa&i=fborn`);
d = await read();
ok("sa26 fborn: ten bins", d.nBins === 10, String(d.nBins));
ok("sa26 fborn: tenths note with its own seat count", /a tenth of the 47 seats/.test(d.note), d.note);

// phone width: no page overflow from the compact chart
await show(`${base}/map/#y=2025&l=seifa&i=age`);
for (const w of [390, 320]) {
  await page.setViewport({ width: w, height: 844, deviceScaleFactor: 2 });
  await wait(500);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`no horizontal overflow at ${w}px`, over <= 0, `${over}px`);
}
ok("no page errors", errs.length === 0, errs[0] || "");
if (netMiss.length) console.log(`note: network misses: ${netMiss.join(" | ")}`);
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-census-tenths: ok");
process.exit(fails.length ? 1 : 0);
