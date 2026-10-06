/* Probe: the Snapshot's "The economic mood" panel (RdMood, rd-panels.jsx).
   The panel draws FOUR published gauges on one plot (ANZ–Roy Morgan
   consumer weekly, Westpac–MI consumer monthly, Roy Morgan business
   monthly, NAB business monthly) as RAW-PRINT dots plus a render-side
   recency-weighted smooth per series (symmetric half-life kernel, 14d on
   the weekly index, 60d on the monthly ones); NAB is a net balance drawn
   100 points up, and the payload D.mood stays the published readings.

   Asserts headlessly against BASE (repo root or a worktree):
     SOURCES (node-side):
     - rd-panels.jsx carries the smooth() kernel, hl 14/60 on the lanes,
       smoothed sePoints AND the RAW spine/scatter (rawPoints),
     - the Info glossary's "mood" entry explains the smoothing
       (d1a1d215 asset), gen-data §5j's comment promises a raw payload.
     PAYLOAD (page's window.AP.D.mood vs BASE/data/mood.json):
     - the polls are exactly the published rows with date >= 2019-08-13
       (gen-data's coverage clip) - value-for-value, date-for-date,
     - latest == the last printed row on each series.
     RENDER. Scales are fitted FROM THE DOM, not reimplemented (the rd
     engine sizes the viewBox from the measured container width and grows
     the right pad for end labels): y from the gridlines' data-k="y<tick>"
     groups, x from the rd-axis year ticks, pad read back off the grid
     lines. Then:
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
       balance), the key says dot = printed release / line = smoothed
       trend, and the HowTo explains the half-lives and the +100 draw,
     - desktop rungs get one in-chart end label per lane, phone gets none
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

/* The four lanes, mirroring rd-panels.jsx: hl per lane, NAB drawn +100. */
const LANES = [
  { k: "consumer", hl: 14, gate: 0.5, live: true, color: "var(--mood-consumer)", lab: "Consumers" },
  { k: "westpacConsumer", hl: 60, gate: 1.0, live: false, color: "var(--mood-consumer)", lab: "Consumers · Westpac–MI" },
  { k: "business", hl: 60, gate: 1.0, live: true, color: "var(--mood-business)", lab: "Businesses" },
  { k: "nabBusiness", hl: 60, gate: 1.0, live: false, color: "var(--mood-business)", shift: 100, lab: "Businesses · NAB" },
];
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
check(panels.includes("const spine = rawPoints.get(lanes[0].k)"), "the hover spine stays the raw prints");
check(panels.includes("scatter={lanes.flatMap((l) => rawPoints.get(l.k)"), "the scatter dots stay the raw prints");
const glossFile = fs.readdirSync(path.join(BASE, ".build/newtracker/assets")).find((f) => f.startsWith("d1a1d215-") && f.endsWith(".js"));
const gloss = glossFile ? fs.readFileSync(path.join(BASE, ".build/newtracker/assets", glossFile), "utf8") : "";
check(gloss.includes("Smoothed, not averaged across sources."), "glossary 'mood' entry leads with the smoothing note");
check(gloss.includes("recency-weighted kernel (half-life 14 days on the weekly consumer index, 60 days"), "glossary names both half-lives");
check(gloss.includes("NAB is drawn 100 points up."), "glossary discloses the NAB +100 draw");
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
  const out = { x1: D.domain.x1 };
  for (const k of ["consumer", "westpacConsumer", "business", "nabBusiness"]) if (D.mood[k]) out[k] = pick(D.mood[k]);
  return out;
});

/* ---- payload pins against data/mood.json ---- */
console.log("payload:");
const live = [];
for (const lane of LANES) {
  const k = lane.k;
  check(!!(moodJson[k] && P[k]), `${k}: series present in mood.json and the payload`);
  if (!(moodJson[k] && P[k])) continue;
  live.push(lane);
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
const x0 = Math.min(...live.map((l) => P[l.k].polls[0].x)) - 0.04;
const x1 = P.x1;
const fil = {}, exp = {};
for (const l of live) {
  fil[l.k] = P[l.k].polls.filter((p) => p.x >= x0);
  exp[l.k] = smooth(fil[l.k], l.hl).map((p) => ({ x: p.x, y: p.y + (l.shift || 0) }));
}
console.log("kernel: " + live.map((l) => `${l.k} ${exp[l.k].length} pts (hl ${l.hl}d${l.shift ? ", +" + l.shift : ""})`).join(", "));

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
   y: the "y<tick>"-keyed gridline groups. x: the rd-axis year-tick marks
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

  for (const l of live) {
    const k = l.k;
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
      `${k}: line passes through the recomputed kernel smooth${l.shift ? " +" + l.shift : ""} at ${idx.length} sampled dates (worst ${worst.toFixed(4)}u = ${worstPx.toFixed(4)}px${wi >= 0 ? " at " + fil[k][wi].released : ""})`);
    const rawGap = ys ? Math.max(...idx.map((pIdx, j) => Math.abs(ys[j] - sy(fil[k][pIdx].v + (l.shift || 0))))) : 0;
    check(rawGap > 1, `${k}: the line is NOT the raw join-the-dots (departs from a raw print by up to ${rawGap.toFixed(2)}u)`);
  }

  /* dots: colours repeat across lanes (Westpac's twin is dashed ink), so
     assert per expected PRINT by proximity, then totals and opacity */
  const allDots = await page.$$eval(
    "#mood .rd-mood-chart svg.chart-svg circle.scatter-dot",
    (els) => els.map((e) => ({ cx: parseFloat(e.getAttribute("cx")), cy: parseFloat(e.getAttribute("cy")), fill: e.getAttribute("fill"), op: e.getAttribute("fill-opacity") })));
  const totalWant = live.reduce((a, l) => a + fil[l.k].length, 0);
  check(allDots.length === totalWant, `scatter: ${allDots.length} raw-print dots across ${live.length} lanes (${totalWant} readings)`);
  check(allDots.every((d) => d.op === "0.5"), "dots ride the rd 0.5 fill-opacity");
  for (const l of live) {
    const k = l.k;
    const dots = allDots.filter((d) => d.fill === l.color);
    const idx = [];
    const n = fil[k].length, stride = Math.max(1, Math.floor(n / 26));
    for (let i = 0; i < n; i += stride) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    let miss = -1;
    for (const i of idx) {
      const p = fil[k][i], tx = sx(p.x), ty = sy(p.v + (l.shift || 0));
      if (!dots.some((d) => Math.abs(d.cx - tx) < 0.05 && Math.abs(d.cy - ty) < 0.05)) { miss = i; break; }
    }
    check(miss < 0, `${k}: every sampled raw print has a dot at its plotted spot${miss >= 0 ? " (missing " + fil[k][miss].released + ")" : ""}`);
    const last = fil[k][fil[k].length - 1], tx = sx(last.x), ty = sy(last.v + (l.shift || 0));
    const hit = dots.find((d) => Math.abs(d.cx - tx) < 0.02 && Math.abs(d.cy - ty) < 0.02);
    check(!!hit, `${k}: the last print's dot sits exactly on it (${last.released}, ${last.v}${l.shift ? " plotted " + (last.v + l.shift) : ""})`);
  }

  const labels = await texts("#mood svg.chart-svg text.end-label");
  if (rung > 640) {
    check(labels.length === live.length && live.every((l) => labels.includes(l.lab)),
      `one in-chart end label per lane (${labels.join(", ")})`);
  } else {
    check(labels.length === 0, "no in-chart end labels on the phone (the readouts above name them)");
  }
  await checkCopy();
  check(pageErrors.length === 0, `no page errors at ${rung}px${pageErrors.length ? ": " + pageErrors.join(" | ") : ""}`);
  pageErrors = [];
}

const texts = (sel) => page.$$eval(sel, (els) => els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ")));
/* head verdict, mirroring RdMood's side() ladder over the live lanes */
const sideOf = (name) => {
  const ls = live.filter((l) => l.lab.split(" · ")[0] === name);
  if (!ls.length) return null;
  const neut = (l) => 100 - (l.shift || 0);
  return ls.every((l) => P[l.k].latest.v < neut(l)) ? "under" : ls.every((l) => P[l.k].latest.v >= neut(l)) ? "above" : "split";
};
const cSide = sideOf("Consumers"), bSide = sideOf("Businesses");
const expHead = cSide === "under" && bSide === "under" ? "Confidence is underwater on both counts."
  : cSide === "above" && bSide === "above" ? "Confidence is above water on both counts."
  : cSide === "under" && bSide === "above" ? "Consumers are underwater; businesses aren’t."
  : cSide === "above" && bSide === "under" ? "Businesses are underwater; consumers aren’t."
  : "The gauges disagree on which side of the line the mood sits.";

async function checkCopy() {
  const title = await texts("#mood .rd-title");
  check(title[0] === "The economic mood", `section title "The economic mood" (got "${title[0]}")`);
  const head = await texts("#mood h3.rd-hed");
  check(head[0] === expHead, `headline is the data-composed mood verdict ("${head[0]}")`);
  const dek = (await texts("#mood p.rd-dek"))[0] || "";
  if (P.consumer) check(dek.includes("Consumers at " + P.consumer.latest.v.toFixed(1)), `dek quotes the RAW ANZ–Roy Morgan consumer print (${P.consumer.latest.v.toFixed(1)})`);
  if (P.business) check(dek.includes("Businesses at " + P.business.latest.v.toFixed(1)), `dek quotes the RAW Roy Morgan business print (${P.business.latest.v.toFixed(1)})`);
  if (P.consumer && P.consumer.latest.chg != null && Math.abs(P.consumer.latest.chg) >= 0.05)
    check(dek.includes(" " + NICE(Math.abs(P.consumer.latest.chg)) + " on the week"), "dek carries the printed weekly change");
  if (P.nabBusiness && P.nabBusiness.latest.cond != null)
    check(dek.includes("(conditions " + NICE(P.nabBusiness.latest.cond) + ")"), "dek carries NAB's printed conditions figure");
  const rv = await texts("#mood .rd-un-rv");
  const wantRv = live.map((l) => laneVfmt(l.k)(P[l.k].latest.v));
  check(rv.length === wantRv.length && wantRv.every((w, i) => rv[i] === w),
    `readout figures are the raw prints in lane order (${rv.join(" / ")})`);
  const pt = (await texts("#mood .rd-mood-chart .rd-un-ptitle")).join(" ");
  check(pt.includes("NAB’s net balance drawn 100 points up"), "chart card discloses the NAB +100 draw");
  const who = await texts("#mood .rd-un-rhouse");
  check(live.every((l, i) => ["ANZ–Roy Morgan", "Westpac–MI", "Roy Morgan", "NAB"].includes(who[i])),
    `each read row names its house (${who.join(" / ")})`);
  const key = await texts("#mood .rd-ckey .rd-key-item");
  check(key.some((t) => t === "One release, as printed") && key.some((t) => t === "Smoothed trend of the releases"),
    "key reads dot = one release as printed, line = smoothed trend");
  check(key.some((t) => t === "The Westpac–MI and NAB reads of the same subjects"), "key names the dashed twin gauges");
  const how = (await texts("#mood details.view-how")).join(" ");
  check((await texts("#mood details.view-how summary"))[0] === "How to read this chart", "HowTo summary standard");
  check(how.includes("half-life 14 days") && how.includes("60 days on the monthly"), "HowTo names the half-lives");
  check(how.includes("recency-weighted kernel") && how.includes("raw prints"), "HowTo says kernel-smoothed lines, raw-print figures");
  check(how.includes("100 points up") && how.includes("net balance"), "HowTo discloses NAB's net balance and the +100 draw");
  const foot = (await texts("#mood .rd-foot")).join(" ");
  check(foot.includes("ANZ–Roy Morgan, Westpac–MI, Roy Morgan and NAB") && foot.includes("Context, not a predictor"),
    "foot names the four sources and the context caveat");
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
