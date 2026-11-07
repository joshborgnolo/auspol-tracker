/* =============================== the chart drawing ===============================
   Chart sets the map aside and draws the seats themselves, each a dot placed by its figures
   instead of its ground. Hover, click and the chosen seat work as they do on the map, and
   with the chart focused the arrow keys walk the seats. What it plots follows the lens:
     Census     each seat's census figure (across) against Labor's two-party share (up),
                coloured by who won or holds it, with the least-squares line and its 95%
                confidence band. "By seat type" draws the AEC's four seat types apart,
                since much of a census pattern runs between city and country seats
     Two-party  the seats stacked along their share, a histogram whose blocks are seats; or,
                under "How votes were cast", the closest seats' on-the-day share against their
                final count, or every seat's postal or early-centre share against its
                on-the-day share
     the rest   the seats stacked along the lens's own figure
   Every head is written by rule. A census head claims a correlation only when a permutation
   test finds one: every seat is counted, not sampled, so the question is whether the seats'
   two-party shares, shuffled at random among them, would correlate as strongly with the
   census figure. (A shuffle leaves both spreads alone, so testing the slope and testing
   Pearson's r are one test.) The map beneath keeps drawing seats (drawOf), so nothing the
   other drawings hold is disturbed by a chart. */
const CH = { tpp: "spread", vs: "final", split: false, el: null, key: "", statKey: "", c: null, pts: [], hot: -1, focus: -1 };
const CH_FAMS = ["alp", "grn", "ind", "csa", "oth", "onp", "lnp"];
const CH_NICE = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const CH_NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const CH_R = 2000; // shuffles per test: p resolves to 1 in 2,001
const CH_ALPHA = 0.05;
const CH_VS = { final: ["Final count", "Labor 2PP, final count"], post: ["Postal", "Labor 2PP, postal votes"], ppvc: ["Early centres", "Labor 2PP, early centres"] };
const chartFits = (m) => !!m && m.house !== "senate" && lensNumeric();
const chartOn = (m) => S.view === "map" && S.draw === "chart" && chartFits(m);
const chNum = (n) => (n < CH_NUM.length ? CH_NUM[n] : String(n));
const chList = (a, w = "and") => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} ${w} ${a[a.length - 1]}`);
const chMedian = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
// a quantile by linear interpolation between order statistics (type 7, R's default)
const chQ = (a, p) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return null; const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * (s[Math.min(lo + 1, s.length - 1)] - s[lo]); };
const chShare = (p) => (p && p[0] + p[1] > 0 ? (100 * p[0]) / (p[0] + p[1]) : null);
const chAdd = (...ps) => ps.reduce((t, p) => (p ? [t[0] + p[0], t[1] + p[1]] : t), [0, 0]);
const chR2 = (v) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
const chHeld = (m) => (isNowY(m.year) ? "holds" : "won");
const chPlace = (m) => (STATE_YEARS.has(m.year) ? stNameCap(m.year) : "Australia");
const chShuffled = (p) => (p < 0.001 ? "fewer than 1 time in 1,000" : p < 0.01 ? "under 1% of the time" : `${Math.round(p * 100)}% of the time`);

function chartEl() {
  if (CH.el) return CH.el;
  const el = document.createElement("div");
  el.className = "mp-chart"; el.id = "chartv"; el.hidden = true;
  $("#stage").appendChild(el);
  el.addEventListener("click", chartClick);
  el.addEventListener("pointermove", chartMove);
  el.addEventListener("pointerleave", () => { if (CH.focus < 0) chHover(null); });
  el.addEventListener("keydown", chartKey);
  el.addEventListener("focusout", (e) => { if (!el.contains(e.relatedTarget)) { CH.focus = -1; chHover(null); } });
  new ResizeObserver(() => { CH.key = ""; chartTick(); }).observe(el);
  CH.el = el;
  return el;
}
// the chart's presence, set before the key is measured: the key hides the map's colour
// scale under a chart, so a key measured a frame early would hold the wrong height. It sits
// on the page's root, since full screen parks the key and the zoom plate outside the figure
function chartSync(m) {
  const on = !!m && chartOn(m), v = document.documentElement;
  if (v.classList.contains("ch-on") !== on) v.classList.toggle("ch-on", on);
  return on;
}
// called at the top of every map frame: shows or hides the chart, and redraws it when
// anything it reads has changed (the statistics only when the figures have)
function chartTick() {
  const m = M(), on = chartSync(m), el = chartEl();
  if (el.hidden === on) { el.hidden = !on; updateCanvasVis(); if (!on) chHover(null); }
  if (!on) { CH.key = ""; return; }
  const W = el.clientWidth, H = el.clientHeight;
  if (!W || !H) return;
  const statKey = [legendState(), filtersKey(), CH.tpp, CH.vs, CH.split, W < 520].join("|");
  const key = [statKey, selDiv(), W, H].join("|");
  if (key === CH.key) return;
  CH.key = key;
  renderChart(m, statKey);
}

/* ----- the statistics: least squares, Student's t and the shuffle test ----- */
function chOls(xs, ys) {
  const n = xs.length;
  let mx = 0, my = 0;
  for (let k = 0; k < n; k++) { mx += xs[k]; my += ys[k]; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let k = 0; k < n; k++) { const dx = xs[k] - mx, dy = ys[k] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const b = sxx > 0 ? sxy / sxx : 0, s2 = n > 2 ? Math.max(0, syy - b * sxy) / (n - 2) : 0;
  return { n, a: my - b * mx, b, mx, my, sxx, s2, r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0 };
}
function chSlope(xs, ys) {
  const n = xs.length;
  let mx = 0, my = 0;
  for (let k = 0; k < n; k++) { mx += xs[k]; my += ys[k]; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0;
  for (let k = 0; k < n; k++) { const dx = xs[k] - mx; sxx += dx * dx; sxy += dx * (ys[k] - my); }
  return sxx > 0 ? sxy / sxx : 0;
}
// Student's t, two-sided 95%: the Cornish–Fisher series (within 0.001 from 5 degrees of freedom)
function chT95(df) {
  const z = 1.959964, z3 = z ** 3, z5 = z ** 5, z7 = z ** 7, z9 = z ** 9;
  return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3)
    + (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * df ** 4);
}
function chRng(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
// the share of shuffles (within groups, when given) whose slope is at least as steep either
// way: a seeded shuffle, so a reading never flickers between visits
function chPerm(xs, ys, groups, R = CH_R) {
  const n = xs.length, obs = Math.abs(chSlope(xs, ys)), rnd = chRng(n * 7919 + 17), y = ys.slice();
  const keys = groups ? [...new Set(groups)] : [0];
  const idx = keys.map((g) => ys.map((_, k) => k).filter((k) => !groups || groups[k] === g));
  let hit = 0;
  for (let t = 0; t < R; t++) {
    for (const I of idx) for (let a = I.length - 1; a > 0; a--) { const b = Math.floor(rnd() * (a + 1)), p = I[a], q = I[b], tmp = y[p]; y[p] = y[q]; y[q] = tmp; }
    if (Math.abs(chSlope(xs, y)) >= obs - 1e-12) hit++;
  }
  return (hit + 1) / (R + 1);
}
// the slope within seat types: each seat's figures less its type's averages, so the slope is
// the one left once the types' own levels are set aside; the shuffle stays within type
function chWithin(xs, ys, groups) {
  const mean = new Map();
  groups.forEach((g, k) => { const t = mean.get(g) || [0, 0, 0]; t[0] += xs[k]; t[1] += ys[k]; t[2]++; mean.set(g, t); });
  const dx = xs.map((x, k) => { const t = mean.get(groups[k]); return x - t[0] / t[2]; });
  const dy = ys.map((y, k) => { const t = mean.get(groups[k]); return y - t[1] / t[2]; });
  const f = chOls(dx, dy);
  return { b: f.b, p: chPerm(dx, ys, groups) };
}
// a round step near the seats' interquartile range, for "per 5 years" and the like
function chStep(xs) {
  const iqr = Math.max(1e-9, chQ(xs, 0.75) - chQ(xs, 0.25));
  return CH_NICE.reduce((best, v) => (Math.abs(Math.log(v / iqr)) < Math.abs(Math.log(best / iqr)) ? v : best), 1);
}

/* ----- the national figure, the one the key's "The line marks …" names ----- */
function chCensusNat(m) {
  const aus = m.areas && m.areas.AUS;
  if (!aus || !aus.demo || (m.year !== "now" && m.year < DEMO_FROM) || !isDemo()) return null;
  if (isAge()) {
    if (S.ageMode === "med") return nn(m.ageCuts && m.ageCuts.medAge);
    // the ageCuts record keeps its shares as fractions
    if (["a1824", "a3554", "a75"].includes(S.ageMode)) { const v = m.ageCuts && m.ageCuts[S.ageMode]; return v == null ? null : v <= 1 ? 100 * v : v; }
  }
  if (incMed()) return nn(m.incomeCuts && m.incomeCuts.medWeekly);
  return nn(demoAreaShare(aus.demo));
}
function chNational(m) {
  const aus = m.areas && m.areas.AUS;
  if (!aus) return null;
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? nn(aus.tppSw) : axisNow(m) === "AC" ? nn(aus.tpp) : null;
    case "fp": return S.fpMode === "change" ? nn(aus.fpSw && aus.fpSw[S.party]) : nn(aus.fp && aus.fp[S.party]);
    case "senate": { if (svYear(m.year) == null) return null; const A = senArea(m, aus.idx, S.party); return A ? nn(senGap() ? A.gap : A.sen) : null; }
    case "senpref": { if (spYear(m.year) == null) return null; const A = spArea(m, aus.idx); return A ? nn(A.share) : null; }
    case "informal": return infModeOf(m) === "exhaust" ? nn(aus.exhPct) : nn(aus.infPct);
    case "seifa": return chCensusNat(m);
  }
  return null;
}

/* ----- what the census chart reads across, and how its copy names it ----- */
function chCensusX(m) {
  if (!isDemo()) {
    const nm = IX_NAME[S.index].toLowerCase();
    return {
      get: (d) => { const s = d.seifa && d.seifa[S.index]; return !s ? null : s.pct != null ? 100 * s.pct : s.dec != null ? 10 * s.dec - 5 : null; },
      axis: `Rank among the seats on ${nm}, percentile (0 = least advantaged)`, axisShort: `${IX_NAME[S.index]} rank, percentile`, short: "Rank", fmt: f0, step: 10,
      per: () => `per tenth of the seats further up the ${nm} ranking`, unit: () => "tenth", noun: `the seats’ ${nm} ranking`,
    };
  }
  if (ageMed()) return { get: (d) => divValue(m, d.i), axis: "Median age, years", short: "Median age", fmt: (v) => String(Math.round(v)), per: (s) => `per ${s}-year difference in median age`, unit: (s) => `${s} years`, noun: "median age", jitter: 0.32 };
  if (incMed()) return { get: (d) => divValue(m, d.i), axis: "Median weekly household income", short: "Median income", fmt: mny, per: (s) => `per ${mny(s)}-a-week difference in median household income`, unit: (s) => `${mny(s)} a week`, noun: "median household income" };
  const w = censusWho(m);
  return { get: (d) => divValue(m, d.i), axis: `${lensShort()}, % of ${w.pop}`, short: lensShort(), fmt: (v) => (v < 10 ? f1(v) : f0(v)), per: (s) => `per ${s}-point difference in the share of ${w.phrase}`, unit: (s) => `${s} points`, noun: `the share of ${w.phrase}` };
}

/* ----- the frame: head, controls, plot, note ----- */
function renderChart(m, statKey) {
  const el = CH.el, refocus = el.contains(document.activeElement) && document.activeElement.classList.contains("ch-plot");
  if (statKey !== CH.statKey || !CH.c) {
    CH.statKey = statKey;
    const census = S.lens === "seifa";
    const castOK = S.lens === "tpp" && S.tppMode !== "swing" && axisNow(m) === "AC" && m.res && m.res.divs.some((d) => d.vt2);
    const cast = castOK && CH.tpp === "cast";
    const c = census ? chartCensus(m) : cast ? chartCast(m) : chartDots(m);
    let ctl = c.ctl || "";
    if (castOK) ctl = `<div class="lg-draw ch-ctl" role="group" aria-label="What the chart shows"><span>Show</span><button type="button" data-chtpp="spread" aria-pressed="${!cast}">Seats’ spread</button><button type="button" data-chtpp="cast" aria-pressed="${cast}">How votes were cast</button></div>${ctl}`;
    el.innerHTML = `<div class="ch-head"><div class="ch-hed">${esc(c.head)}</div>${c.dek ? `<p class="ch-dek">${esc(c.dek)}</p>` : ""}<div class="ch-bar">${ctl}${chKey(c.fams || [], c.keyExtra)}</div></div><div class="ch-plot" tabindex="0" role="group" aria-roledescription="chart" aria-label="${esc(`${c.head}. Arrow keys move between the seats; Enter opens one.`)}"></div>${c.notes ? (el.clientWidth < 520 ? `<details class="ch-note ch-fold"><summary>About this chart</summary><span class="ch-ntext">${esc(c.notes)}</span></details>` : `<p class="ch-note"><span class="ch-ntext">${esc(c.notes)}</span></p>`) : ""}<p class="ch-live" aria-live="polite"></p>`;
    CH.c = c;
  }
  const plot = $(".ch-plot", el), w = plot.clientWidth, h = plot.clientHeight;
  CH.hot = -1;
  if (w < 60 || h < 60) { CH.pts = []; plot.innerHTML = ""; return; }
  const out = CH.c.draw(w, h);
  plot.innerHTML = out.svg;
  CH.pts = out.pts;
  if (refocus) plot.focus({ preventScroll: true });
  if (CH.focus >= 0) { const k = CH.pts.findIndex((p) => p.i === CH.focus); if (k >= 0) chHover(CH.pts[k], true); else CH.focus = -1; }
}
function chKey(fams, extra = "") {
  if (!fams.length && !extra) return "";
  return `<span class="ch-key">${CH_FAMS.filter((f) => fams.includes(f)).map((f) => `<span><i style="background:var(--m-${f})"></i>${FAM_NAME[f]}</span>`).join("")}${extra}</span>`;
}

/* ----- the parts of a plot ----- */
function chScale(d0, d1, r0, r1) { const k = (r1 - r0) / (d1 - d0 || 1); return (v) => r0 + (v - d0) * k; }
function chAxes(o) {
  const { X, Y, x0, x1, y0, y1, xt, yt, xfmt, yfmt, xlab, ylab, ylabs = true, xlabs = true } = o;
  let s = `<g class="ch-grid">`;
  for (const v of yt) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`;
  s += `</g><g class="ch-tick">`;
  if (ylabs) for (const v of yt) s += `<text x="${x0 - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(yfmt(v))}</text>`;
  if (xlabs) for (const v of xt) s += `<text x="${X(v).toFixed(1)}" y="${y1 + 15}" text-anchor="middle">${esc(xfmt(v))}</text>`;
  s += `</g><line class="ch-base" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/>`;
  if (xlab) s += `<text class="ch-lab" x="${x1}" y="${y1 + 31}" text-anchor="end">${esc(xlab)}</text>`;
  if (ylab) s += `<text class="ch-lab" x="2" y="${y0 - 9}">${esc(ylab)}</text>`;
  return s;
}
// the national figure, upright, named at its top
function chNatLine(x, y0, y1, label, x0, x1) {
  if (x == null || x < x0 - 0.5 || x > x1 + 0.5) return "";
  const right = x < x1 - 70;
  return `<line class="ch-nat" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y0}" y2="${y1}"/>${label ? `<text class="ch-natlab" x="${(x + (right ? 4 : -4)).toFixed(1)}" y="${y0 + 10}" text-anchor="${right ? "start" : "end"}">${esc(label)}</text>` : ""}`;
}
function chDot(p, r) {
  const cls = `ch-dot${p.pass ? "" : " ch-off"}${p.hollow ? " ch-hollow" : ""}`;
  return p.hollow
    ? `<circle class="${cls}" cx="${p.sx.toFixed(1)}" cy="${p.sy.toFixed(1)}" r="${(r - 0.6).toFixed(1)}" style="stroke:var(--m-${p.fam})"/>`
    : `<circle class="${cls}" cx="${p.sx.toFixed(1)}" cy="${p.sy.toFixed(1)}" r="${r.toFixed(1)}" style="fill:var(--m-${p.fam})"/>`;
}
function chLabel(p, txt, x1, r) {
  const right = p.sx < x1 - 90;
  return `<text class="ch-name" x="${(p.sx + (right ? r + 4 : -r - 4)).toFixed(1)}" y="${(p.sy + 4).toFixed(1)}" text-anchor="${right ? "start" : "end"}">${esc(txt)}</text>`;
}
const chSelRing = (p, r) => `<circle class="ch-sel" cx="${p.sx.toFixed(1)}" cy="${p.sy.toFixed(1)}" r="${(r + 3.5).toFixed(1)}"/>`;
const chHovRing = () => `<circle class="ch-hov" cx="0" cy="0" r="0"/>`;
// the least-squares line and its 95% confidence band, drawn over the seats' own range;
// dashed when the correlation isn't significant
function chFit(f, X, Y, lo, hi, sig) {
  const t = chT95(Math.max(1, f.n - 2)), n = 24, top = [], bot = [];
  for (let k = 0; k <= n; k++) {
    const x = lo + ((hi - lo) * k) / n, y = f.a + f.b * x, e = t * Math.sqrt(f.s2 * (1 / f.n + ((x - f.mx) ** 2) / f.sxx));
    top.push(`${X(x).toFixed(1)},${Y(y + e).toFixed(1)}`); bot.unshift(`${X(x).toFixed(1)},${Y(y - e).toFixed(1)}`);
  }
  return `<polygon class="ch-band" points="${top.join(" ")} ${bot.join(" ")}"/><line class="ch-fit${sig ? "" : " ch-fit-weak"}" x1="${X(lo).toFixed(1)}" y1="${Y(f.a + f.b * lo).toFixed(1)}" x2="${X(hi).toFixed(1)}" y2="${Y(f.a + f.b * hi).toFixed(1)}"/>`;
}
function chSeatTip(m, i, rows) {
  const d = m.divs[i];
  return `<div class="tn">${ds(d.n)}<span>${STATE_SHORT[d.st]}${d.cls ? ` · ${esc(CLS_SHORT[d.cls])}` : ""}</span></div>${rows.map((r, k) => `<div class="${k ? "ts" : "tv"}">${esc(r)}</div>`).join("")}<div class="ts">${esc(ds(d.hold.n))} (${esc(FAM_NAME[holdFam(d.hold)])}) ${chHeld(m)} it</div>`;
}

/* ----- Census: the seats' census figure against Labor's two-party share ----- */
function chartCensus(m) {
  const X = chCensusX(m), fed = !STATE_YEARS.has(m.year), nat = chCensusNat(m);
  const all = [];
  m.divs.forEach((d, i) => {
    const x = X.get(d), y = nn(d.tpp);
    if (x == null || y == null) return;
    const jit = X.jitter ? (chRng(d.i * 131 + 7)() - 0.5) * 2 * X.jitter : 0;
    all.push({ i, x, xj: x + jit, y, fam: holdFam(d.hold), cls: d.cls, pass: passes(m, i) });
  });
  const inn = all.filter((p) => p.pass);
  const fams = [...new Set(all.map((p) => p.fam))];
  const canSplit = fed && all.length > 0 && all.every((p) => p.cls);
  const split = canSplit && CH.split;
  const ctl = canSplit ? `<div class="lg-draw ch-ctl" role="group" aria-label="Split the seats"><span>Seats</span><button type="button" data-chsplit="0" aria-pressed="${!split}">All together</button><button type="button" data-chsplit="1" aria-pressed="${split}">By seat type</button></div>` : "";
  let head, dek = "", f = null, step = 1, notes = "";
  // the seat types' own slopes, for the dek and the split panels alike (one shuffle each)
  const perType = new Map();
  const typeFit = (c) => {
    if (!perType.has(c)) {
      const q = inn.filter((p) => p.cls === c);
      if (q.length < 12) perType.set(c, null);
      else { const qx = q.map((p) => p.x), qy = q.map((p) => p.y), o = chOls(qx, qy); o.p = chPerm(qx, qy); perType.set(c, o); }
    }
    return perType.get(c);
  };
  if (!all.length) head = `No census figures for this measure at this election`;
  else if (inn.length < 8) head = `Too few seats in view to test a correlation`;
  else {
    const xs = inn.map((p) => p.x), ys = inn.map((p) => p.y);
    f = chOls(xs, ys);
    f.p = chPerm(xs, ys);
    step = X.step || chStep(xs);
    const eff = f.b * step, sig = f.p < CH_ALPHA;
    head = sig
      ? `Labor’s two-party share averages ${f1(Math.abs(eff))} points ${eff < 0 ? "lower" : "higher"} ${X.per(step)}`
      : `No significant correlation between ${X.noun} and Labor’s two-party share`;
    dek = sig ? `Correlation across the ${inn.length} seats: ${chR2(f.r)}.` : `Correlation across the ${inn.length} seats: ${chR2(f.r)}, matched or beaten by random shufflings of the seats ${chShuffled(f.p)}.`;
    if (sig && canSplit && inn.length >= 30) {
      const w = chWithin(xs, ys, inn.map((p) => p.cls)), ratio = w.b / f.b, weff = Math.abs(w.b * step);
      const per = CLS.map((c) => ({ c, o: typeFit(c) })).filter((t) => t.o);
      const nm = (t) => CLS_SHORT[t.c].toLowerCase();
      const part = (ts, word) => (ts.length ? `${chList(ts.map((t, k) => `${f1(Math.abs(t.o.b * step))}${k ? "" : " points"} ${word} in ${nm(t)}`))} seats` : "");
      const sigT = per.filter((t) => t.o.p < CH_ALPHA), flat = per.filter((t) => t.o.p >= CH_ALPHA);
      const types = [part(sigT.filter((t) => t.o.b < 0), "lower"), part(sigT.filter((t) => t.o.b > 0), "higher"), flat.length ? `no significant correlation in ${chList(flat.map(nm), "or")} seats` : ""].filter(Boolean).join("; ");
      const byType = sigT.length ? ` By type, per ${X.unit(step)}: ${types}.` : "";
      const fixed = "Holding the AEC’s seat type fixed";
      if (w.p >= CH_ALPHA) dek += sigT.length ? ` ${fixed}, the slope isn’t consistent. By type, per ${X.unit(step)}: ${types}.` : ` ${fixed}, no significant correlation remains: the pattern runs between seat types, not within them.`;
      else if (ratio < 0) dek += ` ${fixed} reverses the slope, to ${f1(weff)} points ${w.b < 0 ? "lower" : "higher"} per ${X.unit(step)}.${byType}`;
      else if (ratio > 1.25) dek += ` ${fixed} steepens the slope, to ${f1(weff)} points per ${X.unit(step)}.${byType}`;
      else if (ratio < 0.8) { const cut = 1 - ratio; dek += ` ${fixed} ${cut < 0.4 ? "cuts about a third off the slope" : cut < 0.6 ? "roughly halves the slope" : cut < 0.8 ? "cuts about two-thirds off the slope" : "removes most of the slope"}, to ${f1(weff)} points per ${X.unit(step)}.${byType}`; }
      else dek += ` ${fixed} barely changes the slope (${f1(weff)} points per ${X.unit(step)}).${byType}`;
    }
    notes = `Each dot is a seat, coloured by who ${chHeld(m)} it${split ? "; Labor’s two-party share runs up the side" : ""}. The line is the least-squares fit, its band a 95% confidence interval${f.p >= CH_ALPHA || split ? ", dashed where the correlation isn’t significant" : ""}; r is Pearson’s correlation. Every seat is counted, not sampled, so significance is a permutation test: in ${int(CH_R)} random shufflings of the seats’ two-party shares, correlations this strong came up ${chShuffled(f.p)}. Significant means under 1 in 20.${X.jitter ? " Median ages are whole years, so seats sharing one are spread a little sideways." : ""}${nat != null ? ` The upright line marks ${chPlace(m)}.` : ""}`;
  }
  const draw = (w, h) => {
    if (!all.length) return { svg: "", pts: [] };
    const xs = all.map((p) => p.xj), ys = all.map((p) => p.y);
    if (nat != null) xs.push(nat);
    const xsc = d3.scaleLinear().domain(d3.extent(xs)).nice(6), ysc = d3.scaleLinear().domain([Math.min(d3.min(ys), 45), Math.max(d3.max(ys), 55)]).nice(5);
    const [xa, xb] = xsc.domain(), [ya, yb] = ysc.domain();
    const panels = split ? CLS.map((c) => ({ c, pts: all.filter((p) => p.cls === c) })) : [{ c: null, pts: all }];
    // four types always sit two by two: stacked in one column a phone's stage leaves each a sliver
    const cols = split ? 2 : 1, rows = Math.ceil(panels.length / cols), narrow = w < 520;
    const padL = narrow ? 30 : 40, padR = 12, padT = split ? (narrow ? 34 : 30) : 22, padB = split ? 20 : 36, gapX = narrow ? 14 : 26;
    const ph = (h - rows * (padT + padB) - (split ? 16 : 0)) / rows, pw = (w - padL - padR - gapX * (cols - 1)) / cols;
    const r = clamp(Math.min(pw, ph * 1.6) / (split ? 70 : 95), 2.6, 6);
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`;
    const pts = [], sel = selDiv();
    panels.forEach((P, k) => {
      const cx = k % cols, cy = Math.floor(k / cols);
      const x0 = padL + cx * (pw + gapX), x1 = x0 + pw, y0 = padT + cy * (ph + padT + padB), y1 = y0 + ph;
      const Xs = chScale(xa, xb, x0, x1), Ys = chScale(ya, yb, y1, y0);
      const xt = xsc.ticks(Math.max(3, Math.floor(pw / 80))), yt = ysc.ticks(Math.max(3, Math.floor(ph / 45)));
      svg += chAxes({ X: Xs, Y: Ys, x0, x1, y0, y1, xt, yt, xfmt: X.fmt, yfmt: (v) => f0(v), xlab: cy === rows - 1 ? (narrow && X.axisShort ? X.axisShort : X.axis) : "", ylab: !split ? "Labor 2PP" : "", ylabs: cx === 0 });
      svg += `<line class="ch-ref" x1="${x0}" x2="${x1}" y1="${Ys(50).toFixed(1)}" y2="${Ys(50).toFixed(1)}"/>`;
      if (nat != null) svg += chNatLine(Xs(nat), y0, y1, k === 0 || !split ? `${chPlace(m)} ${X.fmt(nat)}` : "", x0, x1);
      const fl = split ? typeFit(P.c) : f;
      if (fl) { const pin = P.pts.filter((p) => p.pass), ex = d3.extent(pin, (p) => p.x); if (pin.length) svg += chFit(fl, Xs, Ys, ex[0], ex[1], fl.p < CH_ALPHA); }
      if (split) {
        const say = !fl ? "too few seats to test" : fl.p < CH_ALPHA ? `${sgn(fl.b * step)} per ${X.unit(step)}${narrow ? "" : ` · r ${chR2(fl.r)}`}` : `r ${chR2(fl.r)}, not significant`;
        svg += narrow
          ? `<text class="ch-ptitle" x="${x0}" y="${y0 - 20}">${esc(CLS_SHORT[P.c])}</text><text class="ch-psub" x="${x0}" y="${y0 - 7}">${esc(say)}</text>`
          : `<text class="ch-ptitle" x="${x0}" y="${y0 - 10}">${esc(CLS_SHORT[P.c])}<tspan class="ch-psub" dx="8">${P.pts.length} seats · ${esc(say)}</tspan></text>`;
      }
      const ord = P.pts.slice().sort((a, b) => (a.pass - b.pass) || (a.i === sel) - (b.i === sel));
      for (const p of ord) { p.sx = Xs(p.xj); p.sy = Ys(p.y); svg += chDot(p, r); }
      // the seats furthest from the line, named (one panel only: four would crowd)
      if (!split && fl) {
        const pin = P.pts.filter((p) => p.pass);
        const far = pin.slice().sort((a, b) => Math.abs(b.y - fl.a - fl.b * b.x) - Math.abs(a.y - fl.a - fl.b * a.x)).slice(0, narrow ? 2 : 4);
        for (const p of far) if (p.i !== sel) svg += chLabel(p, dn(m.divs[p.i].n), x1, r);
      }
      for (const p of P.pts) pts.push({ i: p.i, sx: p.sx, sy: p.sy, r, ord: k * 1e6 + p.sx, tip: [`${X.short}: ${X.fmt(p.x)}`, `Labor 2PP: ${f1(p.y)}`] });
      const sp = P.pts.find((p) => p.i === sel);
      if (sp) svg += chSelRing(sp, r) + chLabel(sp, dn(m.divs[sp.i].n), x1, r + 3);
    });
    return { svg: `${svg}${chHovRing()}</svg>`, pts };
  };
  return { head, dek, ctl, notes, fams, draw };
}

/* ----- Two-party, How votes were cast ----- */
function chCastRows(m, vs) {
  const raw = new Map(m.res.divs.map((d) => [d.n, d]));
  const all = [];
  let miss = 0;
  m.divs.forEach((d, i) => {
    const r = raw.get(d.n), v2 = r && r.vt2;
    if (!v2 || d.tpp == null) { miss++; return; }
    const day = chAdd(v2.day, v2.mob), x = chShare(day);
    const rest = chAdd(...Object.entries(v2).filter(([k]) => k !== "day" && k !== "mob").map(([, p]) => p));
    const pile = vs === "final" ? null : v2[vs];
    const y = vs === "final" ? nn(d.tpp) : pile && pile[0] + pile[1] >= VT_CELL ? chShare(pile) : null;
    if (x == null || y == null) { miss++; return; }
    const pair = new Set([d.win && d.win.fam, d.run && d.run.fam]);
    const classic = pair.has("alp") && pair.has("lnp");
    all.push({ i, x, y, rest: chShare(rest), fam: holdFam(d.hold), classic, hollow: !classic, pass: passes(m, i) });
  });
  return { all, miss };
}
function chartCast(m) {
  const vs = CH_VS[CH.vs] ? CH.vs : "final";
  const { all, miss } = chCastRows(m, vs);
  const inn = all.filter((p) => p.pass && p.classic);
  const fams = [...new Set(all.map((p) => p.fam))];
  const ctl = `<div class="lg-draw ch-ctl" role="group" aria-label="Set against the on-the-day vote"><span>Compare</span>${Object.entries(CH_VS).map(([k, [t]]) => `<button type="button" data-chvs="${k}" aria-pressed="${k === vs}">${t}</button>`).join("")}</div>`;
  const yr = typeof m.year === "number" ? m.year : 2025;
  const missNote = miss ? ` ${miss} seat${miss > 1 ? "s have" : " has"} no ${vs === "final" ? "two-party count split by how votes were cast" : "count for this kind of vote big enough to read"}${yr < 2016 ? " (before 2016 the AEC split only Labor v Coalition final twos)" : ""}.` : "";
  const nm = (p) => dn(m.divs[p.i].n);
  if (vs === "final") return chartClose(m, all, inn, fams, ctl, missNote, nm);
  const word = vs === "post" ? "Postal votes" : "Early-centre votes";
  const gs = inn.map((p) => p.y - p.x), g = chMedian(gs);
  const less = gs.filter((v) => v < 0).length, more = gs.filter((v) => v > 0).length;
  const head = g == null ? `No Labor v Coalition seats to compare` : Math.abs(g) < VT_LEVEL ? `${word} were about as Labor as on-the-day votes in the median seat` : g < 0 ? `${word} were less Labor than on-the-day votes in ${less} of ${gs.length} seats, by a median ${f1(-g)} points` : `${word} were more Labor than on-the-day votes in ${more} of ${gs.length} seats, by a median ${f1(g)} points`;
  const dek = gs.length ? `Counting the ${gs.length} seats whose final two were Labor and the Coalition; the gap ran from ${sgn(d3.min(gs))} to ${sgn(d3.max(gs))} points.` : "";
  const named = new Set();
  const ext = inn.slice().sort((a, b) => (a.y - a.x) - (b.y - b.x));
  [...ext.slice(0, 2), ...ext.slice(-2)].forEach((p) => named.add(p.i));
  const notes = `Labor’s share of the AEC’s Labor v Coalition count, by how votes were cast; on the day includes mobile teams. Hollow dots are seats whose final two weren’t Labor and the Coalition, where this count isn’t the contest: they’re drawn but left out of the head.${missNote}`;
  const draw = (w, h) => {
    if (!all.length) return { svg: "", pts: [] };
    const sc = d3.scaleLinear().domain(d3.extent(all.flatMap((p) => [p.x, p.y]))).nice(6), [lo, hi] = sc.domain();
    const padL = 40, padR = 12, padT = 22, padB = 38;
    const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;
    const Xs = chScale(lo, hi, x0, x1), Ys = chScale(lo, hi, y1, y0);
    const r = clamp(Math.min(x1 - x0, (y1 - y0) * 1.6) / 95, 2.6, 6);
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`;
    svg += chAxes({ X: Xs, Y: Ys, x0, x1, y0, y1, xt: sc.ticks(Math.max(4, Math.floor((x1 - x0) / 80))), yt: sc.ticks(Math.max(3, Math.floor((y1 - y0) / 45))), xfmt: f0, yfmt: f0, xlab: "Labor 2PP, on-the-day votes", ylab: CH_VS[vs][1] });
    svg += `<line class="ch-ref" x1="${Xs(50).toFixed(1)}" x2="${Xs(50).toFixed(1)}" y1="${y0}" y2="${y1}"/><line class="ch-ref" x1="${x0}" x2="${x1}" y1="${Ys(50).toFixed(1)}" y2="${Ys(50).toFixed(1)}"/>`;
    svg += `<line class="ch-diag" x1="${Xs(lo).toFixed(1)}" y1="${Ys(lo).toFixed(1)}" x2="${Xs(hi).toFixed(1)}" y2="${Ys(hi).toFixed(1)}"/><text class="ch-qlab" x="${(Xs(hi) - 4).toFixed(1)}" y="${(Ys(hi) + 14).toFixed(1)}" text-anchor="end">Same as on the day</text>`;
    const sel = selDiv(), pts = [];
    const ord = all.slice().sort((p, q) => (p.pass - q.pass) || (p.i === sel) - (q.i === sel));
    for (const p of ord) { p.sx = Xs(p.x); p.sy = Ys(p.y); svg += chDot(p, r); }
    for (const p of all) if (named.has(p.i) && p.i !== sel) svg += chLabel(p, nm(p), x1, r);
    for (const p of all) pts.push({ i: p.i, sx: p.sx, sy: p.sy, r, ord: p.sx, tip: [`On the day: ${f1(p.x)}`, `${CH_VS[vs][0]}: ${f1(p.y)} (${sgn(p.y - p.x)})`, ...(p.classic ? [] : ["Final two not Labor v Coalition"])] });
    const sp = all.find((p) => p.i === sel);
    if (sp) svg += chSelRing(sp, r) + chLabel(sp, nm(sp), x1, r + 3);
    return { svg: `${svg}${chHovRing()}</svg>`, pts };
  };
  return { head, dek, ctl, notes, fams, draw };
}
// the close seats, each a row: its on-the-day share (open) to its final count (filled). The
// seats the two put on different sides always get a row; the closest seats fill the rest
function chartClose(m, all, inn, fams, ctl, missNote, nm) {
  const L = inn.filter((p) => p.x > 50 && p.y < 50), C = inn.filter((p) => p.x < 50 && p.y > 50);
  const names = (a) => a.map(nm).sort();
  const two = "on-the-day two-party vote";
  let head;
  if (L.length) head = `Labor won the ${two} in ${chNum(L.length)} seat${L.length > 1 ? "s" : ""} it lost${L.length <= 8 ? `: ${chList(names(L))}` : ""}`;
  else if (C.length) head = `The Coalition won the ${two} in ${chNum(C.length)} seat${C.length > 1 ? "s" : ""} it lost${C.length <= 8 ? `: ${chList(names(C))}` : ""}`;
  else head = inn.length ? `Every Labor v Coalition seat went the way of its ${two}` : `No Labor v Coalition seats to compare`;
  let dek = L.length && C.length ? `The Coalition did the same in ${chNum(C.length)}${C.length <= 6 ? `: ${chList(names(C))}` : ""}. ` : "";
  const gs = inn.filter((p) => p.rest != null).map((p) => p.rest - p.x), g = chMedian(gs);
  if (g != null) dek += Math.abs(g) < VT_LEVEL ? `Across the ${gs.length} Labor v Coalition seats, votes cast any other way (at early centres, by post or by declaration) were about as Labor as on-the-day votes in the median seat.` : `Across the ${gs.length} Labor v Coalition seats, votes cast any other way (at early centres, by post or by declaration) were a median ${f1(Math.abs(g))} points ${g < 0 ? "less" : "more"} Labor than on-the-day votes.`;
  const crossed = new Set([...L, ...C].map((p) => p.i));
  let shown = 0;
  const notes = () => `Each row is a seat: ○ Labor’s share of its ${two} (mobile teams included), ● its final count. The ${shown ? `${shown} ` : ""}Labor v Coalition seats closest to 50–50 on the final count are shown, with every seat the two put on different sides. Seats whose final two weren’t Labor and the Coalition are left out: their two-party count isn’t the contest.${missNote}`;
  const keyExtra = `<span class="ch-kmark"><i class="ch-kopen"></i>On the day</span><span class="ch-kmark"><i class="ch-kfill"></i>Final count</span>`;
  const draw = (w, h) => {
    const narrow = w < 520, padL = narrow ? 84 : 112, padR = 14, padT = 8, padB = 34;
    const sel = selDiv();
    const maxRows = clamp(Math.floor((h - padT - padB) / 15), 4, 40);
    const pool = inn.slice().sort((a, b) => Math.abs(a.y - 50) - Math.abs(b.y - 50));
    const pick = new Map();
    for (const p of pool) if (crossed.has(p.i)) pick.set(p.i, p);
    const sp = all.find((p) => p.i === sel && p.classic);
    if (sp) pick.set(sp.i, sp);
    for (const p of pool) { if (pick.size >= maxRows) break; pick.set(p.i, p); }
    const rows = [...pick.values()].sort((a, b) => b.y - a.y);
    shown = rows.length;
    const nt = CH.el && $(".ch-ntext", CH.el);
    if (nt) nt.textContent = notes();
    if (!rows.length) return { svg: "", pts: [] };
    const vals = rows.flatMap((p) => [p.x, p.y]).concat([50]);
    const sc = d3.scaleLinear().domain(d3.extent(vals)).nice(6), [lo, hi] = sc.domain();
    const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;
    const Xs = chScale(lo, hi, x0, x1), rh = Math.min(22, (y1 - y0) / rows.length), r = clamp(rh / 3.2, 2.6, 5.2);
    const top = y0 + ((y1 - y0) - rh * rows.length) / 2;
    const ticks = sc.ticks(Math.max(4, Math.floor((x1 - x0) / 70)));
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><g class="ch-grid">`;
    for (const v of ticks) svg += `<line x1="${Xs(v).toFixed(1)}" x2="${Xs(v).toFixed(1)}" y1="${y0}" y2="${y1}"/>`;
    svg += `</g><g class="ch-tick">`;
    for (const v of ticks) svg += `<text x="${Xs(v).toFixed(1)}" y="${y1 + 15}" text-anchor="middle">${f0(v)}</text>`;
    svg += `</g><line class="ch-base" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/><text class="ch-lab" x="${x1}" y="${y1 + 31}" text-anchor="end">Labor 2PP</text>`;
    svg += `<line class="ch-ref" x1="${Xs(50).toFixed(1)}" x2="${Xs(50).toFixed(1)}" y1="${y0}" y2="${y1}"/>`;
    const pts = [];
    rows.forEach((p, k) => {
      const cy = top + (k + 0.5) * rh, xd = Xs(p.x), xf = Xs(p.y), win = p.y >= 50 ? "alp" : "lnp";
      if (crossed.has(p.i)) svg += `<rect class="ch-xrow" x="2" y="${(cy - rh / 2).toFixed(1)}" width="${x1 - 2}" height="${rh.toFixed(1)}" style="fill:var(--m-${win})"/>`;
      svg += `<text class="ch-rname${crossed.has(p.i) ? " ch-rx" : ""}${p.pass ? "" : " ch-off"}" x="${x0 - 8}" y="${(cy + 4).toFixed(1)}" text-anchor="end">${esc(nm(p))}</text>`;
      svg += `<line class="ch-conn${p.pass ? "" : " ch-off"}" x1="${xd.toFixed(1)}" x2="${xf.toFixed(1)}" y1="${cy.toFixed(1)}" y2="${cy.toFixed(1)}"/>`;
      svg += `<circle class="ch-open${p.pass ? "" : " ch-off"}" cx="${xd.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r - 0.6).toFixed(1)}"/>`;
      p.sx = xf; p.sy = cy;
      svg += chDot(p, r);
      if (p.i === sel) svg += chSelRing(p, r);
      pts.push({ i: p.i, sx: xf, sy: cy, r, ord: k, row: { y: cy, h: rh, x0: 0, x1: w }, tip: [`On the day: ${f1(p.x)}`, `Final count: ${f1(p.y)} (${sgn(p.y - p.x)})`, ...(p.rest != null ? [`Every other vote: ${f1(p.rest)}`] : [])] });
    });
    return { svg: `${svg}${chHovRing()}</svg>`, pts };
  };
  return { head, dek, ctl, notes: notes(), fams, keyExtra, draw };
}

/* ----- every other lens: the seats stacked along the lens's figure ----- */
// what each lens's figure is, as a head's subject, and the unit it's read in
function chNoun(m) {
  const P = famLeg(S.party);
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? ["The two-party swing to Labor", " points"] : ["Labor’s two-party share", "%"];
    case "fp": return S.fpMode === "change" ? [`The change in the ${P} primary vote`, " points"] : [`The ${P} primary vote`, "%"];
    case "senate": return senGap() ? [`The ${P} Senate vote less its House vote`, " points"] : [`The ${P} Senate vote`, "%"];
    case "flow": return [`The share of ${famLeg(S.from)} preferences reaching Labor`, "%"];
    case "senpref": return [lensShort(), "%"];
    case "informal": return infModeOf(m) === "exhaust" ? ["The share of ballots exhausting before the final two", "%"] : ["The informal vote", "%"];
  }
  return [lensShort(), ""];
}
function chartDots(m) {
  const c = colByKey(m, "seats", lensKey());
  const fmt = (c && c.fmt) || f1;
  const all = [];
  let miss = 0;
  m.divs.forEach((d, i) => { const v = c ? nn(c.get(d)) : null; if (v != null) all.push({ i, x: v, fam: holdFam(d.hold), pass: passes(m, i) }); else miss++; });
  const fams = [...new Set(all.map((p) => p.fam))];
  const vin = all.filter((p) => p.pass).map((p) => p.x);
  const lab = lensShort(), nat = chNational(m), [noun, unit] = chNoun(m), fu = (v) => `${fmt(v)}${unit}`;
  let head = `${noun}: no seats in view`, dek = "";
  if (vin.length) {
    const lo = chQ(vin, 0.25), hi = chQ(vin, 0.75), md = chMedian(vin);
    if (S.lens === "tpp" && S.tppMode !== "swing" && axisNow(m) === "AC") head = `Labor was ahead of the Coalition on two-party preferences in ${vin.filter((v) => v > 50).length} of ${vin.length} seats`;
    else if (nat != null) head = `${noun} was above ${chPlace(m)}’s ${fu(nat)} in ${vin.filter((v) => v > nat).length} of ${vin.length} seats`;
    else head = `${noun}: a median ${fu(md)} across the ${vin.length} seats`;
    dek = `The median seat sat at ${fu(md)}; the middle half of the seats ran from ${fu(lo)} to ${fu(hi)}.`;
  }
  const notes = `Each block is a seat, coloured by who ${chHeld(m)} it, stacked by its figure: a histogram whose blocks you can point at.${nat != null ? ` The upright line marks ${chPlace(m)}.` : ""}${miss ? ` ${miss} seat${miss > 1 ? "s have" : " has"} no figure here and ${miss > 1 ? "are" : "is"} left out.` : ""}`;
  const draw = (w, h) => {
    if (!all.length) return { svg: "", pts: [] };
    const padL = 14, padR = 14, padT = 18, padB = 38;
    const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;
    const vals = all.map((p) => p.x);
    let lo = d3.min(vals), hi = d3.max(vals);
    if (c && c.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (nat != null) { lo = Math.min(lo, nat); hi = Math.max(hi, nat); }
    // the finest bins whose stacks still fill most of the height (a flat strip of tiny dots reads as nothing)
    const tryBins = (nbT) => {
      const bw = d3.tickStep(lo, hi, nbT), b0 = Math.floor(lo / bw) * bw, nb = Math.max(1, Math.ceil((hi - b0) / bw + 1e-9));
      const bins = Array.from({ length: nb }, () => []);
      for (const p of all) bins[Math.min(nb - 1, Math.floor((p.x - b0) / bw + 1e-9))].push(p);
      const maxN = d3.max(bins, (b) => b.length) || 1, cw = (x1 - x0) / nb, D = Math.min(cw, (y1 - y0) / maxN, 30);
      return { bw, b0, nb, bins, cw, D, fill: (maxN * D) / (y1 - y0) };
    };
    let best = null;
    for (let nbT = clamp(Math.floor((x1 - x0) / 12), 10, 60); nbT >= 6; nbT--) { const t = tryBins(nbT); if (!best || t.fill > best.fill + 0.02) best = t; if (t.fill >= 0.6) { best = t; break; } }
    const { bw, b0, nb, bins, cw, D } = best, r = Math.max(1.6, D / 2 - 0.6);
    const X = (v) => x0 + ((v - b0) / bw) * cw;
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`;
    svg += `<line class="ch-base" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/><g class="ch-tick">`;
    for (const v of d3.ticks(b0, b0 + nb * bw, Math.max(3, Math.floor((x1 - x0) / 70)))) svg += `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${y1}" y2="${y1 + 4}" class="ch-base"/><text x="${X(v).toFixed(1)}" y="${y1 + 16}" text-anchor="middle">${esc(fmt === f1 && Number.isInteger(v) ? f0(v) : fmt(v))}</text>`;
    svg += `</g><text class="ch-lab" x="${x1}" y="${y1 + 32}" text-anchor="end">${esc(`${lab}, ${unit === "%" ? "%" : "points"}`)}</text>`;
    const ref = S.lens === "tpp" && S.tppMode !== "swing" ? 50 : c && (c.zero || c.diverge) ? 0 : S.lens === "flow" || S.lens === "senpref" ? 50 : null;
    if (ref != null && ref >= b0 && ref <= b0 + nb * bw) svg += `<line class="ch-ref" x1="${X(ref).toFixed(1)}" x2="${X(ref).toFixed(1)}" y1="${y0}" y2="${y1}"/>`;
    if (nat != null) svg += chNatLine(X(nat), y0 - 8, y1, `${chPlace(m)} ${fu(nat)}`, x0, x1);
    const sel = selDiv(), pts = [];
    let sp = null;
    bins.forEach((B, k) => {
      B.sort((a, b) => CH_FAMS.indexOf(a.fam) - CH_FAMS.indexOf(b.fam) || a.x - b.x);
      B.forEach((p, j) => {
        p.sx = x0 + (k + 0.5) * cw; p.sy = y1 - (j + 0.5) * D;
        svg += chDot(p, r);
        if (p.i === sel) sp = p;
        pts.push({ i: p.i, sx: p.sx, sy: p.sy, r, ord: k * 1e4 + j, tip: [`${lab}: ${fu(p.x)}`] });
      });
    });
    if (sp) svg += chSelRing(sp, r) + chLabel(sp, dn(m.divs[sp.i].n), x1, r + 3);
    return { svg: `${svg}${chHovRing()}</svg>`, pts };
  };
  return { head, dek, notes, fams, draw };
}

/* ----- pointing, keys and the chart's own switches ----- */
function chNear(e) {
  const svg = CH.el && $(".ch-plot svg", CH.el);
  if (!svg) return null;
  const b = svg.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
  const row = CH.pts.find((p) => p.row && Math.abs(y - p.row.y) <= p.row.h / 2 && x >= p.row.x0 && x <= p.row.x1);
  if (row) return row;
  let best = null, bd = 14 * 14;
  for (const p of CH.pts) { const d2 = (p.sx - x) ** 2 + (p.sy - y) ** 2; if (d2 < bd) { bd = d2; best = p; } }
  return best;
}
// one seat lit: the ring over its dot, its tip, and (from the keys) the live region's words
function chHover(p, fromKeys) {
  const svg = CH.el && $(".ch-plot svg", CH.el), ring = svg && $(".ch-hov", svg), m = M();
  if (!p || !m || !svg) { CH.hot = -1; if (ring) ring.setAttribute("r", "0"); hideTip(); return; }
  CH.hot = p.i;
  if (ring) { ring.setAttribute("cx", p.sx.toFixed(1)); ring.setAttribute("cy", p.sy.toFixed(1)); ring.setAttribute("r", (p.r + 3.5).toFixed(1)); }
  const b = svg.getBoundingClientRect();
  showTipAt(chSeatTip(m, p.i, p.tip), b.left + p.sx, b.top + p.sy);
  if (fromKeys) { const live = $(".ch-live", CH.el); if (live) live.textContent = `${dn(m.divs[p.i].n)}: ${p.tip.join("; ")}`; }
}
function chartMove(e) {
  if (e.target.closest("button")) { chHover(null); return; }
  const p = chNear(e);
  CH.el.classList.toggle("ch-point", !!p);
  if (!p) { if (CH.focus < 0) chHover(null); return; }
  CH.focus = -1;
  if (p.i !== CH.hot || tip.hidden) chHover(p);
  else showTipAt(chSeatTip(M(), p.i, p.tip), e.clientX, e.clientY);
}
function chartKey(e) {
  if (!e.target.classList.contains("ch-plot") || e.metaKey || e.ctrlKey || e.altKey) return;
  const order = CH.pts.slice().sort((a, b) => a.ord - b.ord || a.sy - b.sy);
  if (!order.length) return;
  const at = order.findIndex((p) => p.i === CH.focus);
  let k = null;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") k = at < 0 ? 0 : Math.min(order.length - 1, at + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") k = at < 0 ? order.length - 1 : Math.max(0, at - 1);
  else if (e.key === "Home") k = 0;
  else if (e.key === "End") k = order.length - 1;
  else if ((e.key === "Enter" || e.key === " ") && at >= 0) { e.preventDefault(); e.stopPropagation(); goDiv(order[at].i, { fly: false }); return; }
  if (k == null) return;
  e.preventDefault(); e.stopPropagation();
  CH.focus = order[k].i;
  chHover(order[k], true);
}
function chartClick(e) {
  const t = e.target.closest("[data-chtpp],[data-chvs],[data-chsplit]");
  if (t) {
    if (t.dataset.chtpp) CH.tpp = t.dataset.chtpp;
    if (t.dataset.chvs) CH.vs = t.dataset.chvs;
    if (t.dataset.chsplit) CH.split = t.dataset.chsplit === "1";
    const sel = t.dataset.chtpp ? `[data-chtpp="${CH.tpp}"]` : t.dataset.chvs ? `[data-chvs="${CH.vs}"]` : `[data-chsplit="${CH.split ? 1 : 0}"]`;
    CH.key = ""; CH.statKey = ""; writeURL(); chartTick();
    $(sel, CH.el)?.focus({ preventScroll: true });
    return;
  }
  const p = chNear(e);
  if (p) { if (selDiv() === p.i) goAus({ fly: false }); else goDiv(p.i, { fly: false }); }
}
