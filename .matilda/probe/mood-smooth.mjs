/* Probe: the Snapshot's "The economic mood" panel (RdMood, rd-panels.jsx).
   The WIP converts the panel from join-the-dots lines to RAW-PRINT dots
   plus a render-side recency-weighted smooth (symmetric half-life kernel,
   14d on the weekly consumer index, 60d on the monthly business index);
   the payload D.mood stays the published readings.

   Asserts headlessly against BASE (repo root or a worktree):
     SOURCES (node-side):
     - rd-panels.jsx carries the smooth() kernel, hl 14/60 on the two rows,
       the smoothed series.points AND the RAW spine/scatter,
     - the Info glossary's "mood" entry explains the smoothing
       (d1a1d215 asset), gen-data §5j's comment promises a raw payload.
     PAYLOAD (page's window.AP.D.mood vs BASE/data/mood.json):
     - the polls are exactly the published rows with date >= 2019-08-13
       (gen-data's coverage clip) - value-for-value, date-for-date,
     - latest == the last printed row on each series.
     RENDER. Scales are fitted FROM THE DOM, not reimplemented (the rd
     engine sizes the viewBox from the measured container width and grows
     the right pad for end labels): y from the gridlines' data-k="y50"
     groups, x from the rd-axis year ticks, pad read back off the grid
     lines. Then:
     - viewBox is 0 0 1000 (1000*heightPx/cw) - pins heightPx 340/260,
     - each series-line passes through the recomputed kernel smooth at the
       reading dates (tolerance 0.05 viewBox units), with a vertex count
       equal to the number of readings - so the line is NOT the raw joins,
     - smoothing is live: a healthy share of smoothed values deviate from
       their raw prints (fractions printed, floored at 15%),
     - scatter dots are the raw prints: per-series counts match the
       readings, each series pinned to its row colour, and the LAST dot
       of each series sits at the printed (x, v) exactly,
     - head quotes nothing, dek/readouts quote the RAW latest prints,
       the key says dot = printed release / line = smoothed trend, and
       the HowTo explains the half-lives,
     - desktop rungs 1366/860 get in-chart end labels, phone 390 doesn't
       and stays inside its viewport;
     - #mood renders on the default tab with no interaction, and no
       page errors on any rung. */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }
const BASE = path.resolve(process.cwd(), process.env.BASE || ".");

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ========================= sources (node-side) ========================= */
console.log("sources:");
const panels = fs.readFileSync(path.join(BASE, ".build/newtracker/assets/rd-panels.jsx"), "utf8");
check(panels.includes("const smooth = (polls, halfLifeDays)"), "rd-panels.jsx defines the half-life kernel smooth()");
check(panels.includes('"ANZ–Roy Morgan", hl: 14'), "consumer row carries hl: 14 (weekly index, 14d half-life)");
check(panels.includes('"Roy Morgan", hl: 60'), "business row carries hl: 60 (monthly index, 60d half-life)");
check(panels.includes("points: smooth(r.s.polls.filter((p) => p.x >= x0), r.hl)"), "series points are the smoothed readings");
check(panels.includes('spine={series(C.polls.filter((p) => p.x >= x0), "v")}'), "the hover spine stays the raw prints");
const glossFile = fs.readdirSync(path.join(BASE, ".build/newtracker/assets")).find((f) => f.startsWith("d1a1d215-") && f.endsWith(".js"));
const gloss = glossFile ? fs.readFileSync(path.join(BASE, ".build/newtracker/assets", glossFile), "utf8") : "";
check(gloss.includes("Smoothed, not averaged across sources."), "glossary 'mood' entry leads with the smoothing note");
check(gloss.includes("recency-weighted kernel (half-life 14 days on the weekly consumer index, 60 days"), "glossary names both half-lives");
const genData = fs.readFileSync(path.join(BASE, ".build/newtracker/gen-data.mjs"), "utf8");
check(genData.includes("recency-weighted smoothed trend on top (render"), "gen-data §5j comment still promises the raw payload");

/* the kernel, identical to rd-panels.jsx */
const smooth = (polls, halfLifeDays) => {
  const decay = Math.LN2 / (halfLifeDays / 365.25);
  return polls.map((p) => {
    let wsum = 0, wtot = 0;
    for (const q of polls) {
      const w = Math.exp(-decay * Math.abs(q.x - p.x));
      if (w < 0.02) continue;
      wsum += w;
      wtot += w * q.v;
    }
    return { x: p.x, y: wtot / wsum };
  });
};

const moodJson = JSON.parse(fs.readFileSync(path.join(BASE, "data/mood.json"), "utf8"));

/* ============================ browser ============================ */
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
let pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

async function open(width) {
  await page.setViewport({ width, height: 980, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector('#mood .rd-mood-chart svg.chart-svg path.series-line[data-series="consumer"]', { timeout: 30000 });
}

/* first open: pull the payload the page actually rendered */
await open(1366);
const P = await page.evaluate(() => {
  const D = window.AP.D;
  const pick = (s) => ({ polls: s.polls.map((p) => ({ x: p.x, v: p.v, ym: p.ym, released: p.released })), latest: s.latest });
  return { x1: D.domain.x1, consumer: pick(D.mood.consumer), business: pick(D.mood.business) };
});

/* ---- payload pins against data/mood.json ---- */
console.log("payload:");
for (const k of ["consumer", "business"]) {
  const want = moodJson[k].rows.filter((r) => r.date >= "2019-08-13").sort((a, b) => a.date < b.date ? -1 : 1);
  const got = P[k].polls;
  check(got.length === want.length, `${k}: ${got.length} readings emitted (mood.json has ${want.length} since 2019-08-13)`);
  const same = got.length === want.length && got.every((p, i) => p.released === want[i].date && p.v === want[i].v);
  check(same, `${k}: every emitted reading IS the printed row (date and figure, unsmoothed)`);
  const last = want[want.length - 1];
  check(P[k].latest && P[k].latest.v === last.v && P[k].latest.released === last.date,
    `${k}: latest is the last printed row (${last.date}, ${last.v})`);
}

/* ---- expectations recomputed from the payload ---- */
const x0 = Math.min(P.consumer.polls[0].x, P.business.polls[0].x) - 0.04;
const x1 = P.x1;
const fil = { consumer: P.consumer.polls.filter((p) => p.x >= x0), business: P.business.polls.filter((p) => p.x >= x0) };
const exp = { consumer: smooth(fil.consumer, 14), business: smooth(fil.business, 60) };
console.log(`kernel: consumer ${exp.consumer.length} pts (hl 14d), business ${exp.business.length} pts (hl 60d)`);

for (const k of ["consumer", "business"]) {
  const devs = exp[k].map((s, i) => Math.abs(s.y - fil[k][i].v));
  const gate = k === "consumer" ? 0.5 : 1.0;
  const frac = devs.filter((d) => d > gate).length / devs.length;
  const mean = devs.reduce((a, b) => a + b, 0) / devs.length;
  check(frac >= 0.15, `${k}: smoothing is live - ${(frac * 100).toFixed(0)}% of readings move >${gate}pt (mean |move| ${mean.toFixed(2)})`);
}

/* ---- scales fitted from the DOM (never reimplemented) ----
   y: the "y50"-keyed gridline groups. x: the rd-axis year-tick marks
   (the first rd-base line is the baseline rule, the rest are integer-year
   ticks, ascending). pad read straight off the gridline x1/x2. */
const fitScales = () => page.evaluate(() => {
  const root = document.querySelector("#mood .rd-mood-chart svg.chart-svg");
  if (!root) return null;
  const ys = [...root.querySelectorAll('g[data-k^="y"] line.grid')].map((l) => ({
    t: parseFloat(l.closest("g").getAttribute("data-k").slice(1)),
    y: parseFloat(l.getAttribute("y1")),
    x1: parseFloat(l.getAttribute("x1")), x2: parseFloat(l.getAttribute("x2")),
  })).filter((d) => isFinite(d.t) && isFinite(d.y));
  const xt = [...root.querySelectorAll("g.rd-axis line.rd-base")]
    .map((l) => ({ x1: parseFloat(l.getAttribute("x1")), x2: parseFloat(l.getAttribute("x2")) }));
  const ticks = xt.filter((d) => d.x1 === d.x2).map((d) => d.x1);
  const vb = root.viewBox.baseVal;
  const rect = root.getBoundingClientRect();
  return { ys, ticks, vbW: vb.width, vbH: vb.height, cw: rect.width };
});
const linfit = (pts) => { // pts [[x,y]] -> {a, b, res}: y = a + b*x
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) * (x - mx); }
  const b = sxy / sxx, a = my - b * mx;
  const res = Math.max(...pts.map(([x, y]) => Math.abs(y - (a + b * x))));
  return { a, b, res };
};

const knotYs = (sel, xs) => page.evaluate(([s, arr]) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const L = el.getTotalLength();
  return arr.map((xu) => {
    let lo = 0, hi = L;
    for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (el.getPointAtLength(m).x < xu) lo = m; else hi = m; }
    return el.getPointAtLength((lo + hi) / 2).y;
  });
}, [sel, xs]);

const firstYear = Math.ceil(x0);
const hpPx = (rung) => (rung > 640 ? 340 : 260);
const padPxL = (rung) => (rung > 640 ? 40 : 34);
const padPxR = (rung) => (rung > 640 ? 16 : 8);

async function checkChart(rung) {
  const fit = await fitScales();
  check(!!fit, "chart svg measurable at " + rung + "px");
  if (!fit) return;
  /* viewBox: W is always 1000 units; H follows the measured container
     width (k0 = cw/1000; H = heightPx / k0) - pins heightPx per rung */
  check(fit.vbW === 1000, `viewBox width is the fixed 1000 units (got ${fit.vbW})`);
  const expH = 1000 * hpPx(rung) / fit.cw;
  check(Math.abs(fit.vbH - expH) < 2, `viewBox height ${fit.vbH.toFixed(1)} = 1000 × heightPx ${hpPx(rung)} / cw ${fit.cw.toFixed(0)} (${expH.toFixed(1)})`);
  check(fit.ys.length >= 6, `${fit.ys.length} y-gridlines to fit on`);
  const fy = linfit(fit.ys.map((d) => [d.t, d.y]));
  check(fy.res < 0.01, `y-scale linear across the gridlines (residual ${fy.res.toFixed(4)}u)`);
  const sy = (v) => fy.a + fy.b * v;
  const yrs = fit.ticks.map((p, i) => [firstYear + i, p]);
  const fx = linfit(yrs);
  check(fit.ticks.length >= 6 && fx.res < 0.01, `x-scale linear across ${fit.ticks.length} year ticks from ${firstYear} (residual ${fx.res.toFixed(4)}u)`);
  const sx = (x) => fx.a + fx.b * x;
  /* pad read back: left pad is untouched by the end-label growth, right
     pad must be at least padPx.r worth of units (labels may grow it) */
  const k0 = fit.cw / 1000;
  const padL = fit.ys[0].x1, padR = fit.vbW - fit.ys[0].x2;
  check(Math.abs(padL - padPxL(rung) / k0) < 0.3, `left pad is padPx ${padPxL(rung)} (${padL.toFixed(2)}u vs ${(padPxL(rung) / k0).toFixed(2)})`);
  check(padR >= padPxR(rung) / k0 - 0.01, `right pad >= padPx ${padPxR(rung)} (${padR.toFixed(2)}u, label room may grow it)`);

  check(await page.evaluate(() => {
    const el = document.querySelector("#mood");
    return !!el && el.getBoundingClientRect().width > 0;
  }), "#mood renders on the default tab with no interaction");

  for (const k of ["consumer", "business"]) {
    const sel = `#mood .rd-mood-chart svg.chart-svg path.series-line[data-series="${k}"]`;
    const d = await page.$eval(sel, (el) => el.getAttribute("d")).catch(() => null);
    check(!!d, `${k} series line drawn`);
    if (!d) continue;
    const verts = 1 + (d.match(/ C /g) || []).length + (d.match(/ L /g) || []).length;
    check(verts === exp[k].length, `${k}: ${verts} path vertices, one per reading (${exp[k].length}) - not a sparse resample`);
    const idx = [];
    const n = exp[k].length, stride = Math.max(1, Math.floor(n / 26));
    for (let i = 0; i < n; i += stride) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    const xs = idx.map((i) => sx(exp[k][i].x));
    const ys = await knotYs(sel, xs);
    let worst = 0, wi = -1;
    if (ys) idx.forEach((pIdx, j) => {
      const e = Math.abs(ys[j] - sy(exp[k][pIdx].y));
      if (e > worst) { worst = e; wi = pIdx; }
    });
    /* units scale with the rung's viewBox height, so price the residual in
       SCREEN px (k0 = cw/1000): it is binary-search noise on the monotone
       path, worst on the near-vertical COVID cliff */
    const worstPx = worst * (fit.cw / 1000);
    check(ys && worstPx <= 0.06,
      `${k}: line passes through the recomputed kernel smooth at ${idx.length} sampled dates (worst ${worst.toFixed(4)}u = ${worstPx.toFixed(4)}px${wi >= 0 ? " at " + fil[k][wi].released : ""})`);
    const rawGap = ys ? Math.max(...idx.map((pIdx, j) => Math.abs(ys[j] - sy(fil[k][pIdx].v)))) : 0;
    check(rawGap > 1, `${k}: the line is NOT the raw join-the-dots (departs from a raw print by up to ${rawGap.toFixed(2)}u)`);
  }

  for (const k of ["consumer", "business"]) {
    const fill = k === "consumer" ? "var(--ink)" : "var(--ink-2)";
    const dots = await page.$$eval(
      `#mood .rd-mood-chart svg.chart-svg circle.scatter-dot[fill="${fill}"]`,
      (els) => els.map((e) => ({ cx: parseFloat(e.getAttribute("cx")), cy: parseFloat(e.getAttribute("cy")), op: e.getAttribute("fill-opacity") })));
    check(dots.length === fil[k].length, `${k}: ${dots.length} raw-print dots on the ${fill} series (${fil[k].length} readings)`);
    if (!dots.length) continue;
    check(dots.every((d) => d.op === "0.5"), `${k}: dots ride the rd 0.5 fill-opacity`);
    const last = fil[k][fil[k].length - 1], d = dots[dots.length - 1];
    check(Math.abs(d.cx - sx(last.x)) < 0.02 && Math.abs(d.cy - sy(last.v)) < 0.02,
      `${k}: the last dot sits exactly on the raw print (${last.released}, ${last.v})`);
  }

  const labels = await texts("#mood svg.chart-svg text.end-label");
  if (rung > 640) {
    check(labels.includes("Consumers") && labels.includes("Businesses"), `end labels name both series (${labels.join(", ")})`);
  } else {
    check(!labels.includes("Consumers") && !labels.includes("Businesses"), "no in-chart end labels on the phone (the readouts above name them)");
  }
  await checkCopy();
  check(pageErrors.length === 0, `no page errors at ${rung}px${pageErrors.length ? ": " + pageErrors.join(" | ") : ""}`);
  pageErrors = [];
}

const texts = (sel) => page.$$eval(sel, (els) => els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ")));
const cUnder = P.consumer.latest.v < 100, bUnder = P.business.latest.v < 100;
const expHead = cUnder && bUnder ? "Confidence is underwater on both counts."
  : !cUnder && !bUnder ? "Confidence is above water on both counts."
  : (cUnder ? "Consumers are underwater; businesses aren’t." : "Businesses are underwater; consumers aren’t.");

async function checkCopy() {
  const title = await texts("#mood .rd-title");
  check(title[0] === "The economic mood", `section title "The economic mood" (got "${title[0]}")`);
  const head = await texts("#mood h3.rd-hed");
  check(head[0] === expHead, `headline is the data-composed mood verdict ("${head[0]}")`);
  const dek = (await texts("#mood p.rd-dek"))[0] || "";
  check(dek.includes("Consumers at " + P.consumer.latest.v.toFixed(1)), `dek quotes the RAW consumer print (${P.consumer.latest.v.toFixed(1)})`);
  check(dek.includes("Businesses at " + P.business.latest.v.toFixed(1)), `dek quotes the RAW business print (${P.business.latest.v.toFixed(1)})`);
  if (Math.abs(P.consumer.latest.chg) >= 0.05)
    check(dek.includes(" " + Math.abs(P.consumer.latest.chg).toFixed(1) + " on the week"), "dek carries the printed weekly change");
  const rv = await texts("#mood .rd-un-rv");
  check(rv.length === 2 && rv[0] === P.consumer.latest.v.toFixed(1) && rv[1] === P.business.latest.v.toFixed(1),
    `readout figures are the raw prints (${rv.join(" / ")})`);
  const key = await texts("#mood .rd-ckey .rd-key-item");
  check(key.some((t) => t === "One release, as printed") && key.some((t) => t === "Smoothed trend of the releases"),
    "key reads dot = one release as printed, line = smoothed trend");
  const how = (await texts("#mood details.view-how")).join(" ");
  check((await texts("#mood details.view-how summary"))[0] === "How to read this chart", "HowTo summary standard");
  check(how.includes("half-life 14 days") && how.includes("60 on the monthly"), "HowTo names the half-lives");
  check(how.includes("recency-weighted kernel") && how.includes("raw prints"), "HowTo says kernel-smoothed lines, raw-print figures");
  const foot = (await texts("#mood .rd-foot")).join(" ");
  check(foot.includes("term-long record behind"), "foot keeps the Roy Morgan provenance line");
}

console.log("desktop 1366:");
await checkChart(1366);
console.log("desktop 860:");
await open(860);
await checkChart(860);
console.log("phone 390:");
await open(390);
await checkChart(390);
await page.setViewport({ width: 390, height: 520, deviceScaleFactor: 1 });
await sleep(250); // intentional-sleep: media-query hooks settle after resize
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check(!overflow, "no horizontal page overflow at 390px");
check(pageErrors.length === 0, "no page errors on the phone resize");

await browser.close();
if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); }
console.log("\nALL PASS");
