/* Probe: the Snapshot's "Economic confidence" panel (RdMood, rd-panels.jsx).
   The panel's FOUR published gauges sit in TWO views switched by the
   tabs over the chart card — Consumers (ANZ–Roy Morgan's weekly index
   with Westpac–MI's monthly as its dashed twin) opens first; Businesses
   (Roy Morgan's monthly index with the NAB survey as its dashed twin) is
   the other tab. Each view draws only its own pair as RAW-PRINT dots
   plus a render-side recency-weighted smooth per series (symmetric
   half-life kernel, 14d on the weekly index, 60d on the monthly ones)
   and prices its own y-domain; NAB is a net balance drawn 100 points up,
   and the payload D.confidence stays the published readings.
   The plot's x is MONTHS SINCE the 3 May 2025 election: the panel
   anchors x0 = 2025 + 122/365 (gen-data's dx counting) and converts
   every year-fraction x with toM = (x - x0) * 12, so the term window
   is [0, xMax] with xMax = max(36, ceil(nowM)) + 0.6 and the ruler
   reads Election / 1 yr / 2 yrs / 3 yrs plus a Now tick where the
   sitting term stands. The payload keeps the full on-file history,
   off-screen, so the payload pins below still run to the 2019-08-13
   coverage clip while the render expectations window at x0.
   "Show complete history" remounts the chart on the calendar ruler
   (its own probe, conf-history.mjs, pins that window); EVERY check
   here is the term window, years converted with the panel's own toM.

   Asserts headlessly against BASE (repo root or a worktree):
     SOURCES (node-side):
     - rd-panels.jsx carries the smooth() kernel, hl 14/60 on the lanes,
       smoothed sePoints AND the RAW spine/scatter (rawPoints),
     - the Info glossary's "confidence" entry explains the smoothing
       (d1a1d215 asset), gen-data §5j's comment promises a raw payload.
     PAYLOAD (page's window.AP.D.confidence vs BASE/data/confidence.json):
     - the polls are exactly the published rows with date >= 2019-08-13
       (gen-data's coverage clip) - value-for-value, date-for-date,
     - latest == the last printed row on each series.
     RENDER. Scales are fitted FROM THE DOM, not reimplemented (the rd
     engine sizes the viewBox from the measured container width and grows
     the right pad for end labels): y from the gridlines' data-k="y<tick>"
     groups, x from the rd-axis tick marks against the known [0, xMax]
     months window - the axis carries the panel's own month ruler
     (Election/1 yr/2 yrs/3 yrs + Now where it fits; the engine sorts the
     tick list before drawing, so on phone the Now mark sits between the
     milestones). pad read back off the grid lines. Then:
     - viewBox is 0 0 1000 (1000*heightPx/cw) - pins heightPx 340/260,
     - each series-line passes through the recomputed kernel smooth at the
       reading dates (tolerance priced in screen px), with a vertex count
       equal to the number of readings - so the line is NOT the raw joins,
     - smoothing is live on the two long-running index series: a healthy
       share of smoothed values deviate from their raw prints (the short
       NAB run and the quiet Westpac read are reported, not gated),
     - scatter dots are the raw prints: total count matches the readings,
       the 0.5 fill-opacity rides, and every lane's LAST print has a dot
       at its exact (x, plotted y) - NAB's at v + 100,
     - head is the data-composed verdict from the four latest prints,
       dek/readouts quote the RAW latest prints (NAB's as its own net
       balance), each read row names its HOUSE, the key says dot =
       printed release / line = smoothed trend, and the HowTo explains
       the half-lives and the +100 draw,
     - the window's major events less the party-politics changes of
       hand (both Coalition splits, Joyce to One Nation, Taylor's
       leadership stay off; the Hormuz crisis, the 2026 budget and the
       RBA's September rise ride) ride the chart as ruled
       g.evt marks; a phone numbers them with the names folded out
       under the chart, a desktop labels them on the plot,
     - desktop rungs get one in-chart end label per lane, phone gets none
       and stays inside its viewport;
     - #confidence renders on the default tab with no interaction, and no
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

/* The four lanes, mirroring rd-panels.jsx: hl per lane, NAB drawn +100;
   each lane belongs to exactly one of the two tab-switched views, and
   the hues run main/alt BY VIEW (the view's index is --confidence-main,
   its dashed twin --confidence-alt) with the twins keeping their dashes
   off too since the palette split. */
const LANES = [
  { k: "consumer", view: "consumer", hl: 14, gate: 0.5, live: true, color: "var(--confidence-main)", by: "ANZ–Roy Morgan" },
  { k: "westpacConsumer", view: "consumer", hl: 60, gate: 1.0, live: false, color: "var(--confidence-alt)", by: "Westpac–MI" },
  { k: "business", view: "business", hl: 60, gate: 1.0, live: true, color: "var(--confidence-main)", by: "Roy Morgan" },
  { k: "nabBusiness", view: "business", hl: 60, gate: 1.0, live: false, color: "var(--confidence-alt)", shift: 100, by: "NAB" },
];
const VIEW_TAB = { consumer: "Consumers", business: "Businesses" };
const VIEW_HOUSES = { consumer: ["ANZ–Roy Morgan", "Westpac–MI"], business: ["Roy Morgan", "NAB"] };
const VIEW_DASHKEY = {
  consumer: "The Westpac–MI monthly read of the same household mood",
  business: "NAB’s net-balance read, drawn 100 points up",
};
/* the per-view card note (rd-panels.jsx vc.title / vc.note) */
const VIEW_PTITLE = { consumer: "Consumer confidence", business: "Business confidence" };
const VIEW_NOTE = {
  consumer: "100 = neutral on both gauges",
  business: "100 = neutral on the index; NAB’s net balance drawn 100 points up",
};
const NICE = (v) => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
const laneVfmt = (k) => (k === "nabBusiness" ? NICE : (v) => v.toFixed(1));

/* ========================= sources (node-side) ========================= */
console.log("sources:");
const panels = fs.readFileSync(path.join(BASE, ".build/newtracker/assets/rd-panels.jsx"), "utf8");
check(panels.includes("const smooth = (polls, halfLifeDays)"), "rd-panels.jsx defines the half-life kernel smooth()");
check(panels.includes('"ANZ–Roy Morgan", hl: 14'), "consumer lane carries hl: 14 (weekly index, 14d half-life)");
check(panels.includes('"Roy Morgan", hl: 60'), "business lane carries hl: 60 (monthly index, 60d half-life)");
check(panels.includes('"Westpac–MI", hl: 60'), "Westpac–MI lane carries hl: 60");
check(panels.includes('"NAB", hl: 60'), "NAB lane carries hl: 60");
check(panels.includes("smooth(rows.get(l.k), l.hl)"), "series points are the smoothed readings");
check(panels.includes("const spine = histOn ? histSpine : rawPoints.get(viewLanes[0].k)"), "the term window's hover spine stays the view's raw prints (the history window rides its own histSpine)");
check(panels.includes("const chartRaw = histOn ? wideRaw : rawPoints"), "the term window's dots stay the raw prints (the history window re-dots the whole release file)");
check(panels.includes("scatter={viewLanes.flatMap((l) => chartRaw.get(l.k)"), "the scatter dots come from the chart's raw map");
check(panels.includes('useState("consumer")'), "the view tabs open on the consumer pair by default");
check(panels.includes('className="rd-confidence-tabs"'), "the consumer/business views ride the shared RdTabs row");
check(panels.includes('key={"rd-confidence-" + view + (histOn ? "-hist" : "")}'), "the chart remounts per view, and again into the history window (its own ruler)");
const glossFile = fs.readdirSync(path.join(BASE, ".build/newtracker/assets")).find((f) => f.startsWith("d1a1d215-") && f.endsWith(".js"));
const gloss = glossFile ? fs.readFileSync(path.join(BASE, ".build/newtracker/assets", glossFile), "utf8") : "";
const glossFlat = gloss.replace(/\s+/g, " "); /* the JSX source wraps its prose across lines */
check(glossFlat.includes("Smoothed, not averaged across sources."), "glossary 'confidence' entry leads with the smoothing note");
check(glossFlat.includes("recency-weighted kernel (half-life 14 days on the weekly consumer index, 60 days"), "glossary names both half-lives");
check(glossFlat.includes("NAB is drawn 100 points up."), "glossary discloses the NAB +100 draw");
check(glossFlat.includes("The chart opens at the May 2025 election"), "glossary dates the chart window to the May 2025 election");
check(glossFlat.includes("sit in two views, switched by the tabs over the chart — the consumer pair opens first"),
  "glossary names the two tab-switched views and the consumer default");
check(panels.includes("const x0 = 2025 + 122 / 365"), "the panel anchors its x at the 2025 election (x0 = 2025 + 122/365)");
check(panels.includes("const toM = (x) => (x - x0) * 12"), "every year-fraction x is converted to MONTHS since the election (toM)");
check(panels.includes("const xMax = Math.max(36, Math.ceil(nowM)) + 0.6"), "the term window runs [0, xMax] - 36 months or the sitting term's age, plus margin");
check(panels.includes('{ x: 0, label: "Election" }') && panels.includes('{ x: 36, label: "3 yrs" }') && panels.includes('label: "Now"'),
  "the x axis is the months ruler (Election / 1 yr / 2 yrs / 3 yrs + Now), not rdElectionTicks");
check(panels.includes("xTicks={histOn ? histTicks : xTicks}"), "the term window takes the months ruler; the history window takes histTicks' calendar years");
check(panels.includes("const evs = rdChartEvents(D.events, x0, x1).filter((e) => !CONF_OFF.includes(e.date))"), "the panel marks the window's major events (rdChartEvents over x0..x1, less CONF_OFF)");
check(panels.includes(".map((e) => ({ ...e, x: toM(e.x) }))"), "the marked events convert to the months ruler with toM");
/* the party-politics events kept off this chart, mirroring rd-panels.jsx */
const CONF_OFF = ["2025-05-28", "2025-12-08", "2026-01-22", "2026-02-12"];
check(panels.includes('const CONF_OFF = ["2025-05-28", "2025-12-08", "2026-01-22", "2026-02-12"]'), "CONF_OFF names both Coalition splits, Joyce to ONP and Taylor's leadership");
check(panels.includes('rdEventBadges("confidence", evs, 0, xMax)'), "a phone's events ride as numbered badges on the months ruler (0..xMax) under the \"confidence\" key");
check(panels.includes("events={histOn ? [] : (badges ? badges.events : evs)}"), "the term window's chart takes the events; the history window draws none");
check(panels.includes("evt={histOn ? null : evtOpen} onEvt={setEvtOpen}"), "the term window rides the controlled evt/onEvt pair");
const genData = fs.readFileSync(path.join(BASE, ".build/newtracker/gen-data.mjs"), "utf8");
check(genData.includes("draws a recency-weighted smoothed trend on top"), "gen-data §5j comment still promises the raw payload with the render-side smooth");

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

const confJson = JSON.parse(fs.readFileSync(path.join(BASE, "data/confidence.json"), "utf8"));

/* ============================ browser ============================ */
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
let pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

async function open(width) {
  await page.setViewport({ width, height: 980, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg path.series-line", { timeout: 30000 });
}

/* walk the tabs over the card to a view; wait until its pair is drawn
   and the other view's lines have left the plot (the crossfade settles) */
async function switchView(view) {
  await page.evaluate((tab) => {
    const t = [...document.querySelectorAll("#confidence .rd-confidence-tabs .rd-tab")].find((b) => (b.textContent || "").trim() === tab);
    if (t) t.click();
  }, VIEW_TAB[view] || view);
  await page.waitForFunction((v) => {
    const svg = document.querySelector("#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg");
    if (!svg) return false;
    const here = v === "business" ? ["business", "nabBusiness"] : ["consumer", "westpacConsumer"];
    const gone = v === "business" ? ["consumer", "westpacConsumer"] : ["business", "nabBusiness"];
    return here.every((k) => svg.querySelector(`path.series-line[data-series="${k}"]`))
      && gone.every((k) => !svg.querySelector(`path.series-line[data-series="${k}"]`));
  }, { timeout: 15000 }, view);
  /* the outgoing card lives on as the crossfade's .rd-xf-was ghost for
     MORPH_MS+40; every chart query is already scoped to .rd-xf-now, and
     the switch is only done once the ghost has fully left the DOM */
  await page.waitForFunction(() => !document.querySelector("#confidence .rd-xf-was"), { timeout: 15000 });
}

/* first open: pull the payload the page actually rendered */
await open(1366);
const P = await page.evaluate(() => {
  const D = window.AP.D;
  const pick = (s) => ({ polls: s.polls.map((p) => ({ x: p.x, v: p.v, ym: p.ym, released: p.released })), latest: s.latest });
  const out = { x1: D.domain.x1 };
  for (const k of ["consumer", "westpacConsumer", "business", "nabBusiness"]) if (D.confidence[k]) out[k] = pick(D.confidence[k]);
  return out;
});

/* ---- payload pins against data/confidence.json ---- */
console.log("payload:");
const live = [];
for (const lane of LANES) {
  const k = lane.k;
  check(!!(confJson[k] && P[k]), `${k}: series present in confidence.json and the payload`);
  if (!(confJson[k] && P[k])) continue;
  live.push(lane);
  const want = confJson[k].rows.filter((r) => r.date >= "2019-08-13").sort((a, b) => a.date < b.date ? -1 : 1);
  const got = P[k].polls;
  check(got.length === want.length, `${k}: ${got.length} readings emitted (confidence.json has ${want.length} since 2019-08-13)`);
  const same = got.length === want.length && got.every((p, i) => p.released === want[i].date && p.v === want[i].v);
  check(same, `${k}: every emitted reading IS the printed row (date and figure, unsmoothed)`);
  const last = want[want.length - 1];
  check(P[k].latest && P[k].latest.v === last.v && P[k].latest.released === last.date,
    `${k}: latest is the last printed row (${last.date}, ${last.v})`);
}

/* ---- expectations recomputed from the payload ----
   x0 is the panel's election anchor constant (source-pinned above) and
   every x the chart draws is MONTHS since it (the panel's own toM,
   mirrored here on the same constant); the kernel always runs on
   year-fraction x, so fil stays years and exp converts. The term window
   is [0, xMax]; the payload pins stay on the full on-file history. */
const x0 = 2025 + 122 / 365;
const x1 = P.x1;
const toM = (x) => (x - x0) * 12;
const nowM = toM(x1);
const xMax = Math.max(36, Math.ceil(nowM)) + 0.6;
const fil = {}, exp = {};
for (const l of live) {
  fil[l.k] = P[l.k].polls.filter((p) => p.x >= x0);
  exp[l.k] = smooth(fil[l.k], l.hl).map((p) => ({ x: toM(p.x), y: p.y + (l.shift || 0) }));
}
console.log("kernel: " + live.map((l) => `${l.k} ${exp[l.k].length} pts (hl ${l.hl}d${l.shift ? ", +" + l.shift : ""})`).join(", ") + `; window months 0..${xMax.toFixed(1)} (Now at ${nowM.toFixed(1)})`);

/* the window's marked events: the page's own rdChartEvents and
   rdEventBadges (the same machinery the panel rides) - selected on the
   year-fraction window, converted to months with toM exactly as the
   panel does, and passed 0..xMax to the badges */
const expEvs = await page.evaluate(([ex, ex1, off]) =>
  rdChartEvents(window.AP.D.events, ex, ex1).filter((e) => !off.includes(e.date)).map((e) => ({ date: e.date, label: e.label })), [x0, x1, CONF_OFF]);
const offEvs = await page.evaluate(([ex, ex1, off]) =>
  rdChartEvents(window.AP.D.events, ex, ex1).filter((e) => off.includes(e.date)).map((e) => ({ date: e.date, label: e.label })), [x0, x1, CONF_OFF]);
const expList = await page.evaluate(([ex, ex1, off, mx]) => {
  const toM = (x) => (x - ex) * 12;
  const evs = rdChartEvents(window.AP.D.events, ex, ex1).filter((e) => !off.includes(e.date))
    .map((e) => ({ ...e, x: toM(e.x) }));
  const b = rdEventBadges("confidence", evs, 0, mx);
  return b.list.map((l) => ({ n: l.n, t: l.labels.join(", ") }));
}, [x0, x1, CONF_OFF, xMax]);
console.log("events: " + expEvs.map((e) => e.date).join(", ") + " (" + expEvs.length + ")");

for (const l of live) {
  const devs = exp[l.k].map((s, i) => Math.abs((s.y - (l.shift || 0)) - fil[l.k][i].v));
  const frac = devs.filter((d) => d > l.gate).length / devs.length;
  const mean = devs.reduce((a, b) => a + b, 0) / devs.length;
  if (l.live)
    check(frac >= 0.15, `${l.k}: smoothing is live - ${(frac * 100).toFixed(0)}% of readings move >${l.gate}pt (mean |move| ${mean.toFixed(2)})`);
  else
    console.log(`  .. ${l.k}: ${(frac * 100).toFixed(0)}% of readings move >${l.gate}pt (mean |move| ${mean.toFixed(2)}) - reported, not gated (short/quiet series)`);
}

/* ---- scales fitted from the DOM (never reimplemented) ----
   y: the "y<tick>"-keyed gridline groups. x: the term window is the
   months ruler [0, xMax], so the scale is READ off the measured plot
   insets (the gridlines' x1/x2 give the exact plot box) against that
   known domain, with the tick marks cross-checked against the panel's
   own ruler list (the first rd-base line is the baseline rule, the
   rest are tick marks, ascending; the axis-label texts come along for
   the name checks). pad read straight off the gridline x1/x2. */
const fitScales = () => page.evaluate(() => {
  const root = document.querySelector("#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg");
  if (!root) return null;
  const ys = [...root.querySelectorAll('g[data-k^="y"] line.grid')].map((l) => ({
    t: parseFloat(l.closest("g").getAttribute("data-k").slice(1)),
    y: parseFloat(l.getAttribute("y1")),
    x1: parseFloat(l.getAttribute("x1")), x2: parseFloat(l.getAttribute("x2")),
  })).filter((d) => isFinite(d.t) && isFinite(d.y));
  const xt = [...root.querySelectorAll("g.rd-axis line.rd-base")]
    .map((l) => ({ x1: parseFloat(l.getAttribute("x1")), x2: parseFloat(l.getAttribute("x2")) }));
  const ticks = xt.filter((d) => d.x1 === d.x2).map((d) => d.x1);
  const labels = [...root.querySelectorAll("text.axis-label.x")].map((t) => ({
    t: (t.textContent || "").trim().replace(/\s+/g, " "), x: parseFloat(t.getAttribute("x")),
  }));
  const vb = root.viewBox.baseVal;
  const rect = root.getBoundingClientRect();
  return { ys, ticks, labels, vbW: vb.width, vbH: vb.height, cw: rect.width };
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

const hpPx = (rung) => (rung > 640 ? 340 : 260);
const padPxL = (rung) => (rung > 640 ? 40 : 34);
const padPxR = (rung) => (rung > 640 ? 16 : 8);

async function checkChart(rung, viewKey) {
  const vl = live.filter((l) => l.view === viewKey);
  const fit = await fitScales();
  check(!!fit, "chart svg measurable at " + rung + "px");
  if (!fit) return;
  /* viewBox: W is always 1000 units; H follows the measured container
     width (k0 = cw/1000; H = heightPx / k0) - pins heightPx per rung */
  check(fit.vbW === 1000, `viewBox width is the fixed 1000 units (got ${fit.vbW})`);
  const expH = 1000 * hpPx(rung) / fit.cw;
  check(Math.abs(fit.vbH - expH) < 2, `viewBox height ${fit.vbH.toFixed(1)} = 1000 × heightPx ${hpPx(rung)} / cw ${fit.cw.toFixed(0)} (${expH.toFixed(1)})`);
  /* the election window narrows the decade gridlines (e.g. 80-110 = 4);
     three or more still pins the fit plus residual */
  check(fit.ys.length >= 3, `${fit.ys.length} y-gridlines to fit on`);
  const fy = linfit(fit.ys.map((d) => [d.t, d.y]));
  check(fy.res < 0.01, `y-scale linear across the gridlines (residual ${fy.res.toFixed(4)}u)`);
  const sy = (v) => fy.a + fy.b * v;
  /* pad read back: left pad is untouched by the end-label growth, right
     pad must be at least padPx.r worth of units (labels may grow it) */
  const k0 = fit.cw / 1000;
  const padL = fit.ys[0].x1, padR = fit.vbW - fit.ys[0].x2;
  check(Math.abs(padL - padPxL(rung) / k0) < 0.3, `left pad is padPx ${padPxL(rung)} (${padL.toFixed(2)}u vs ${(padPxL(rung) / k0).toFixed(2)})`);
  check(padR >= padPxR(rung) / k0 - 0.01, `right pad >= padPx ${padPxR(rung)} (${padR.toFixed(2)}u, label room may grow it)`);
  /* x: the plot box maps linearly onto the known [0, xMax] months
     domain, and the axis carries the panel's own ruler - Election /
     1 yr / 2 yrs / 3 yrs, plus Now where the sitting term stands and
     it fits (the engine sorts ticks before drawing, so Now's mark can
     sit between the milestones; every drawn mark must sit exactly on a
     ruler position, every label on one, the election tick is pinned by
     its name, and Now rides only where the ruler's own rule keeps it) */
  const sx = (m) => padL + m * ((fit.vbW - padR - padL) / xMax);
  const expTicks = [{ x: 0, label: "Election" }, { x: 12, label: "1 yr" }, { x: 24, label: "2 yrs" }, { x: 36, label: "3 yrs" }];
  if (nowM < xMax - 1.4) expTicks.push({ x: +nowM.toFixed(1), label: "Now" });
  const expXs = expTicks.map((t) => sx(t.x)).sort((a, b) => a - b);
  const ticks = [...fit.ticks].sort((a, b) => a - b);
  check(ticks.length === expXs.length && ticks.every((t, i) => Math.abs(t - expXs[i]) < 0.01),
    `${ticks.length} axis tick marks sit exactly on the months ruler (${expTicks.map((t) => t.label).join(", ")})`);
  const expLab = (x) => { const m = expTicks.find((t) => Math.abs(sx(t.x) - x) < 0.05); return m ? m.label : null; };
  check(fit.labels.every((t) => expLab(t.x) != null), `every axis label sits on a ruler milestone (${fit.labels.length} labels)`);
  const electX = sx(0);
  const firstLab = fit.labels.find((t) => Math.abs(t.x - electX) < 0.05);
  check(!!firstLab && firstLab.t === "Election",
    `the ${rung}px axis pins the Election tick at month 0, 3 May 2025 (got ${firstLab ? '"' + firstLab.t + '"' : "none"})`);
  const nowX = nowM < xMax - 1.4 ? sx(+nowM.toFixed(1)) : null;
  const nowLab = nowX == null ? null : fit.labels.find((t) => Math.abs(t.x - nowX) < 0.05);
  check(nowX == null || (!!nowLab && nowLab.t === "Now"),
    `the sitting term's age rides as the Now tick at month ${nowM.toFixed(1)}${nowLab ? "" : " (label dropped at this width)"}`);
  check(fit.labels.length >= 3, `${fit.labels.length} axis labels rendered`);

  check(await page.evaluate(() => {
    const el = document.querySelector("#confidence");
    return !!el && el.getBoundingClientRect().width > 0;
  }), "#confidence renders on the default tab with no interaction");

  /* the tabs state: exactly the pair, the current view's pressed; and the
     plot draws ONLY this view's series lines */
  const tabState = await page.$$eval("#confidence .rd-confidence-tabs .rd-tab", (els) => els.map((e) => ({ t: (e.textContent || "").trim(), on: e.getAttribute("aria-pressed") })));
  check(tabState.length === 2 && (tabState.find((x) => x.t === VIEW_TAB[viewKey]) || {}).on === "true"
    && tabState.every((x) => x.t === VIEW_TAB[viewKey] || x.on === "false"),
    `"${VIEW_TAB[viewKey]}" is the pressed tab of the pair (${tabState.map((x) => x.t + " " + x.on).join(", ")})`);
  for (const o of live.filter((l) => l.view !== viewKey)) {
    check(!(await page.$(`#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg path.series-line[data-series="${o.k}"]`)),
      `the other view's ${o.k} line stays off the plot`);
  }

  for (const l of vl) {
    const k = l.k;
    const sel = `#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg path.series-line[data-series="${k}"]`;
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
      `${k}: line passes through the recomputed kernel smooth${l.shift ? " +" + l.shift : ""} at ${idx.length} sampled dates (worst ${worst.toFixed(4)}u = ${worstPx.toFixed(4)}px${wi >= 0 ? " at " + fil[k][wi].released : ""})`);
    const rawGap = ys ? Math.max(...idx.map((pIdx, j) => Math.abs(ys[j] - sy(fil[k][pIdx].v + (l.shift || 0))))) : 0;
    check(rawGap > 1, `${k}: the line is NOT the raw join-the-dots (departs from a raw print by up to ${rawGap.toFixed(2)}u)`);
  }

  /* dots: the two hues split main gauge from twin within the view
     (--confidence-main vs --confidence-alt), so attribute per lane by
     fill, then assert totals, opacity and per-print proximity */
  const allDots = await page.$$eval(
    "#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg circle.scatter-dot",
    (els) => els.map((e) => ({ cx: parseFloat(e.getAttribute("cx")), cy: parseFloat(e.getAttribute("cy")), fill: e.getAttribute("fill"), op: e.getAttribute("fill-opacity") })));
  const totalWant = vl.reduce((a, l) => a + fil[l.k].length, 0);
  check(allDots.length === totalWant, `scatter: ${allDots.length} raw-print dots across the view's ${vl.length} lanes (${totalWant} readings)`);
  check(allDots.every((d) => d.op === "0.5"), "dots ride the rd 0.5 fill-opacity");
  for (const l of vl) {
    const k = l.k;
    const dots = allDots.filter((d) => d.fill === l.color);
    const idx = [];
    const n = fil[k].length, stride = Math.max(1, Math.floor(n / 26));
    for (let i = 0; i < n; i += stride) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    let miss = -1;
    for (const i of idx) {
      const p = fil[k][i], tx = sx(toM(p.x)), ty = sy(p.v + (l.shift || 0));
      if (!dots.some((d) => Math.abs(d.cx - tx) < 0.05 && Math.abs(d.cy - ty) < 0.05)) { miss = i; break; }
    }
    check(miss < 0, `${k}: every sampled raw print has a dot at its plotted spot${miss >= 0 ? " (missing " + fil[k][miss].released + ")" : ""}`);
    const last = fil[k][fil[k].length - 1], tx = sx(toM(last.x)), ty = sy(last.v + (l.shift || 0));
    const hit = dots.find((d) => Math.abs(d.cx - tx) < 0.02 && Math.abs(d.cy - ty) < 0.02);
    check(!!hit, `${k}: the last print's dot sits exactly on it (${last.released}, ${last.v}${l.shift ? " plotted " + (last.v + l.shift) : ""})`);
  }

  const labels = await texts("#confidence .rd-xf-now svg.chart-svg text.end-label");
  if (rung > 640) {
    check(labels.length === vl.length && vl.every((l) => labels.includes(l.by)),
      `one in-chart end label per lane of the view, named by house (${labels.join(", ")})`);
  } else {
    check(labels.length === 0, "no in-chart end labels on the phone (the readouts above name them)");
  }

  /* the marked events: every windowed major (and the two changes of
     hand) carries a ruled g.evt[role=img] whose aria names it; the
     triple this panel was asked to mark - Hormuz, the 2026 budget, the
     RBA hike - ride among them. A desktop's LABEL pass draws a second
     aria-hidden g.evt per named event (the redesign sets every name
     after every rule), so the count pins the ruled role="img" groups.
     A phone numbers them and folds the names out under the chart */
  const evArias = await page.$$eval('#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg g.evt[role="img"]', (els) => els.map((el) => el.getAttribute("aria-label") || ""));
  check(expEvs.length > 0 && evArias.length === expEvs.length, `${expEvs.length} marked events ride the chart (${evArias.length} rules)`);
  check(expEvs.every((e) => evArias.some((a) => a.startsWith(e.label))),
    `every windowed event carries its own rule (${expEvs.map((e) => e.date).join(", ")})`);
  check(offEvs.length === 4 && offEvs.every((e) => !evArias.some((a) => a.startsWith(e.label))),
    `the four party-politics events stay off the chart (${offEvs.map((e) => e.date).join(", ")})`);
  for (const d of ["2026-03-02", "2026-05-12", "2026-09-29"]) {
    const ev = expEvs.find((e) => e.date === d);
    check(ev && evArias.some((a) => a.startsWith(ev.label)), `the ${d} event rides the chart ("${ev ? ev.label : "?"}")`);
  }
  if (rung > 640) {
    check((await page.$$eval("#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg g.rd-badge circle", (els) => els.length)) === 0,
      "no phone badge row on desktop (the events label themselves)");
    check((await texts("#confidence .rd-xf-now .rd-evdrop")).length === 0, "no events list on desktop");
  } else {
    const circles = await page.$$eval("#confidence .rd-xf-now .rd-confidence-chart svg.chart-svg g.rd-badge circle", (els) => els.length);
    check(circles === expEvs.length, `${expEvs.length} numbered event badges ride above the plot (${circles} circles)`);
    check((await texts("#confidence .rd-xf-now .rd-evdrop summary"))[0] === "The marked events", 'the events fold opens with "The marked events"');
    const lis = await texts("#confidence .rd-xf-now .rd-evdrop li");
    check(lis.length === expEvs.length, `${expEvs.length} events listed under the chart (${lis.length} rows)`);
    check(expList.every((l) => lis.some((t) => t.includes(l.t))), "each numbered badge's name is in the list");
  }
  await checkCopy(viewKey);
  check(pageErrors.length === 0, `no page errors at ${rung}px${pageErrors.length ? ": " + pageErrors.join(" | ") : ""}`);
  pageErrors = [];
}

const texts = (sel) => page.$$eval(sel, (els) => els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ")));
/* head verdict, mirroring RdMood's side() ladder over the live lanes */
const sideOf = (v) => {
  const ls = live.filter((l) => l.view === v);
  if (!ls.length) return null;
  const neut = (l) => 100 - (l.shift || 0);
  return ls.every((l) => P[l.k].latest.v < neut(l)) ? "under" : ls.every((l) => P[l.k].latest.v >= neut(l)) ? "above" : "split";
};
const cSide = sideOf("consumer"), bSide = sideOf("business");
const expHead = cSide === "under" && bSide === "under" ? "Confidence is underwater on both counts."
  : cSide === "above" && bSide === "above" ? "Confidence is above water on both counts."
  : cSide === "under" && bSide === "above" ? "Consumers are underwater; businesses aren’t."
  : cSide === "above" && bSide === "under" ? "Businesses are underwater; consumers aren’t."
  : "The gauges disagree on which side of the line the confidence sits.";

async function checkCopy(viewKey) {
  const vl = live.filter((l) => l.view === viewKey);
  const title = await texts("#confidence .rd-title");
  check(title[0] === "Economic sentiment", `section title "Economic sentiment" (got "${title[0]}")`);
  const head = await texts("#confidence h3.rd-hed");
  check(head[0] === expHead, `headline is the data-composed confidence verdict ("${head[0]}")`);
  const dek = (await texts("#confidence p.rd-dek"))[0] || "";
  if (P.consumer) check(dek.includes("Consumers at " + P.consumer.latest.v.toFixed(1)), `dek quotes the RAW ANZ–Roy Morgan consumer print (${P.consumer.latest.v.toFixed(1)})`);
  if (P.business) check(dek.includes("Businesses at " + P.business.latest.v.toFixed(1)), `dek quotes the RAW Roy Morgan business print (${P.business.latest.v.toFixed(1)})`);
  if (P.consumer && P.consumer.latest.chg != null && Math.abs(P.consumer.latest.chg) >= 0.05)
    check(dek.includes(" " + NICE(Math.abs(P.consumer.latest.chg)) + " on the week"), "dek carries the printed weekly change");
  if (P.nabBusiness && P.nabBusiness.latest.cond != null)
    check(dek.includes("(conditions " + NICE(P.nabBusiness.latest.cond) + ")"), "dek carries NAB's printed conditions figure");
  /* everything below the tabs speaks for the view's own pair alone */
  const pt = (await texts("#confidence .rd-xf-now .rd-confidence-chart .rd-un-ptitle")).join(" ");
  check(pt.includes(VIEW_PTITLE[viewKey]) && pt.includes(VIEW_NOTE[viewKey]),
    `card title is "${VIEW_PTITLE[viewKey]}" with its pair's note (got "${pt.slice(0, 110)}")`);
  const rn = await texts("#confidence .rd-xf-now .rd-confidence-chart .rd-un-rtop b");
  check(rn.length === vl.length && VIEW_HOUSES[viewKey].every((h, i) => rn[i] === h),
    `each read row names its house (${rn.join(" / ")})`);
  const rv = await texts("#confidence .rd-xf-now .rd-un-rv");
  const wantRv = vl.map((l) => laneVfmt(l.k)(P[l.k].latest.v));
  check(rv.length === wantRv.length && wantRv.every((w, i) => rv[i] === w),
    `readout figures are the view's raw prints in lane order (${rv.join(" / ")})`);
  const key = await texts("#confidence .rd-xf-now .rd-ckey .rd-key-item");
  check(key.some((t) => t === "One release, as printed") && key.some((t) => t === "Smoothed trend of the releases"),
    "key reads dot = one release as printed, line = smoothed trend");
  check(key.some((t) => t === VIEW_DASHKEY[viewKey]), "key names the view's dashed twin gauge");
  const how = (await texts("#confidence details.view-how")).join(" ");
  check((await texts("#confidence details.view-how summary"))[0] === "How to read this chart", "HowTo summary standard");
  check(how.includes("split into two views") && how.includes("switched by the tabs"), "HowTo says the gauges split into two tab-switched views");
  check(how.includes("half-life 14 days") && how.includes("60 days on the monthly"), "HowTo names the half-lives");
  check(how.includes("recency-weighted kernel") && how.includes("raw prints"), "HowTo says kernel-smoothed lines, raw-print figures");
  check(how.includes("100 points up") && how.includes("net balance"), "HowTo discloses NAB's net balance and the +100 draw");
  check(how.includes("from the 2025 election on"), "HowTo dates the chart window to the 2025 election");
  const foot = (await texts("#confidence .rd-foot")).join(" ");
  check(foot.includes("ANZ–Roy Morgan, Westpac–MI, Roy Morgan and NAB") && foot.includes("Context, not a predictor"),
    "foot names the four sources and the context caveat");
}

/* each rung: the page opens on the consumer default; then the tabs walk
   to the business view and the same checks run against its own pair */
console.log("desktop 1366 consumers:");
await checkChart(1366, "consumer");
console.log("desktop 1366 businesses:");
await switchView("business");
await checkChart(1366, "business");
console.log("desktop 860 consumers:");
await open(860);
await checkChart(860, "consumer");
console.log("desktop 860 businesses:");
await switchView("business");
await checkChart(860, "business");
console.log("phone 390 consumers:");
await open(390);
await checkChart(390, "consumer");
console.log("phone 390 businesses:");
await switchView("business");
await checkChart(390, "business");
await page.setViewport({ width: 390, height: 520, deviceScaleFactor: 1 });
await sleep(250); // intentional-sleep: media-query hooks settle after resize
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check(!overflow, "no horizontal page overflow at 390px");
check(pageErrors.length === 0, "no page errors on the phone resize");

await browser.close();
if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); }
console.log("\nALL PASS");
