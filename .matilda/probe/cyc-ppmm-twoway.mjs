/* cyc-ppmm-twoway: the sitting term's Past-cycles preferred-PM lead is a
   TWO-WAY measure. gen-data's current-cycle ppmm line and its now-figure
   (ppmMarginNow) take rows with NO three-way (han==null, aan main reading)
   only - a three-way prompt is a different question (RedBridge's Albanese
   31 / Taylor 15 sat masked +16 against YouGov's two-way +1, and the mixed
   pool read the now-figure +9.6 against the two-way +2.3, Oct 2026).
   Recomputes the expected line from data/polls.json under exactly that rule
   (monthly sample-weighted means, fillSeries gaps, the SPARSE six-week
   nowcast for the latest point) and asserts the page's current-cycle ppmm
   series, obs flags, ppmEras end and the summary row's Now cell all equal
   it. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = "/Users/joshuaborgnolo/auspol tracker";
const PORT = 8973;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  try {
    let p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
    if (p.endsWith("/")) p += "index.html";   // before extname: a dir URL must not answer application/octet-stream
    const body = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails++;
};

/* --- node-side expected series, gen-data's arithmetic replicated -------- */
const D = JSON.parse(await readFile(join(ROOT, "data/polls.json"), "utf8"));
const LATEST_ISO = D.polls.map((p) => p.date).sort().pop();
const refNow = new Date(LATEST_ISO).getTime();
const LN2 = Math.log(2), SW = 42, SH = 14, ST = 28;   // SPARSE_K
const kw = (d) => Math.exp(-LN2 * d / SH) * (d <= ST ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - ST) / (SW - ST))));
const rowN = (p) => (p && p.sampleEff != null ? p.sampleEff * 1.6 : Math.min((p && p.sample) || 1200, 3000));
const PBY = new Map(D.polls.map((p) => [p.date + "|" + p.pollster, p]));
const ppmN = (r) => rowN(PBY.get(r.date + "|" + r.firm));
const MS_MONTH = 365.25 / 12;
const eDate = "2025-05-03";                             // current term's election day
const mSince = (iso) => (new Date(iso) - new Date(eDate)) / 86400000 / MS_MONTH;
const r1 = (v) => Math.round(v * 10) / 10;
const TAYLOR_FROM = "2026-02-13";
const twoWay = D.ppm.filter((p) => p.han == null && p.alb != null && p.opp != null);
const buckets = {};
for (const p of twoWay) { const k = Math.round(mSince(p.date)); (buckets[k] ||= []).push(p); }
const known = {};
for (const k of Object.keys(buckets)) {
  const waves = new Map();
  for (const p of buckets[k]) waves.set(p.firm, (waves.get(p.firm) || 0) + 1);
  let sw = 0, swx = 0;
  for (const p of buckets[k]) { const w = ppmN(p) / Math.sqrt(waves.get(p.firm)); sw += w; swx += w * (p.alb - p.opp); }
  known[k] = swx / sw;
}
const firstK = Math.min(...Object.keys(known).map(Number));
const lastK = Math.round(mSince(LATEST_ISO));
const months = []; for (let i = 0; i <= lastK; i++) months.push(i);
const fill = months.map((i) => {
  if (known[i] != null) return known[i];
  const ks = months.filter((j) => known[j] != null);
  const lo = ks.filter((k) => k < i).pop(), hi = ks.find((k) => k > i);
  if (lo == null) return known[hi];
  if (hi == null) return known[lo];
  const t = (i - lo) / (hi - lo);
  return known[lo] + (known[hi] - known[lo]) * t;
});
/* the nowcast margin over the two-way, Taylor-era window */
const pts = twoWay.filter((p) => p.date >= TAYLOR_FROM)
  .map((p) => ({ firm: p.firm, mid: new Date(p.date).getTime(), x: p.alb - p.opp, n: ppmN(p) }))
  .map((a) => ({ ...a, d: (refNow - a.mid) / 86400000 })).filter((a) => a.d >= 0 && a.d <= SW);
const waves = new Map();
for (const p of pts) waves.set(p.firm, (waves.get(p.firm) || 0) + 1);
let sw = 0, swx = 0;
for (const p of pts) { const w = (p.n * kw(p.d)) / Math.sqrt(waves.get(p.firm)); sw += w; swx += w * p.x; }
const nowV = r1(swx / sw);
const expected = months.map((m, i) => (m < firstK ? null : r1(fill[i])));
expected[expected.length - 1] = nowV;

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/cycles/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#cyc-primary .rd-cyc-chart", { timeout: 45000 });
    // the cycles payload rides the lazily fetched cycle-source hash file
    await page.waitForFunction(() => window.AP && AP.D && Array.isArray(AP.D.cycles) && AP.D.cycles.some((c) => c.current), { timeout: 30000 });

    const got = await page.evaluate(() => {
      const cur = window.AP.D.cycles.find((c) => c.current);
      const rows = [...document.querySelectorAll("#cyc-summary .rd-cs-row")].map((r) => ({
        name: r.querySelector(".rd-cs-name b").textContent.trim(),
        now: r.querySelector(".rd-cs-now").textContent.trim(),
      }));
      // the cycle payload's series live under raw.* (raw.ppmPair is the
      // term's BASELINE pairing; the current pairing is the last ppmEra's name)
      return { ppmm: cur.raw.ppmm, obs: cur.raw.obs.ppmm, months: cur.raw.months,
               ppmEras: (cur.raw.ppmEras || []).map((e) => ({ name: e.name, vals: e.vals })),
               ppmRowNow: (rows.filter((r) => r.name === "Preferred PM, lead")[0] || {}).now || null };
    });

    check("page rendered clean", pageErrors.length === 0, pageErrors[0] || "");
    check("month grid matches", JSON.stringify(got.months) === JSON.stringify(months),
          `page ${got.months.join("/")} vs expected ${months.join("/")}`);
    const bad = [];
    for (let i = 0; i < months.length; i++)
      if (got.ppmm[i] !== expected[i]) bad.push(`m${i}: page ${got.ppmm[i]} != expected ${expected[i]}`);
    check("current ppmm series equals the two-way-only recompute", bad.length === 0, bad.slice(0, 4).join("; "));
    check("latest point is the two-way nowcast", got.ppmm[got.ppmm.length - 1] === nowV,
          `page ${got.ppmm[got.ppmm.length - 1]} expected ${nowV}`);
    const badObs = [];
    for (let i = 0; i < months.length; i++) if (got.obs[i] !== (known[i] != null)) badObs.push(`m${i}`);
    check("obs flags mark exactly the months with a two-way reading", badObs.length === 0, badObs.join(","));
    const eraEnd = got.ppmEras.length ? got.ppmEras[got.ppmEras.length - 1].vals.filter((v) => v != null).pop() : null;
    check("the last ppmEra run ends on the same two-way figure", eraEnd === nowV, `saw ${eraEnd}`);
    check("current pairing is PM v opposition leader", got.ppmEras.length && got.ppmEras[got.ppmEras.length - 1].name === "Albanese v Taylor",
          `saw ${got.ppmEras.length ? got.ppmEras[got.ppmEras.length - 1].name : "(none)"}`);
    check("summary Now cell prints the two-way figure", got.ppmRowNow === (nowV > 0 ? "+" : "") + nowV.toFixed(1),
          `cell ${got.ppmRowNow}`);
    /* non-vacuity: the terms this probe stands guard over must contain
       two-way rows in the window and three-way rows somewhere this term */
    check("window holds two-way readings (non-vacuous nowcast)", pts.length > 0, `${pts.length} readings`);
    check("term holds excluded three-way rows (the rule has work to do)",
      D.ppm.some((p) => p.han != null && p.date >= TAYLOR_FROM), "");
  } finally { await browser.close(); server.close(); }
  if (fails) { console.error(fails + " CHECK(S) FAILED"); process.exit(1); }
  console.log("ALL CHECKS PASSED");
})();
