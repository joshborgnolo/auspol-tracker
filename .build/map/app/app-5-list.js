/* =============================== filters =============================== */
const MARGINS = { marginal: [0, 6, "Marginal, under 6 points"], fair: [6, 10, "Fairly safe, 6 to 10"], safe: [10, 100, "Safe, over 10"] };
const filtersOn = () => !!(S.f.st || S.f.cls || S.f.win || S.f.margin || (S.f.range && S.f.range.unit === "seats"));
const filtersKey = () => [S.f.st, S.f.cls, S.f.win, S.f.margin, S.f.range && [S.f.range.unit, S.f.range.key, S.f.range.lo, S.f.range.hi].join(":")].join(",");
const inRange = (v, r) => v != null && !Number.isNaN(v) && v >= r.lo - 1e-9 && (r.hiOpen ? true : v < r.hi - 1e-9 || (r.last && v <= r.hi + 1e-9)) && (r.loOpen ? true : true);
function passes(m, i, skipRange) {
  const d = m.divs[i];
  if (S.f.st && d.st !== S.f.st) return false;
  if (S.f.cls && d.cls !== S.f.cls) return false;
  if (S.f.win && holdFam(d.hold) !== S.f.win) return false;
  if (S.f.margin) { const [a, b] = MARGINS[S.f.margin]; if (d.margin < a || d.margin >= b) return false; }
  if (!skipRange && S.f.range && S.f.range.unit === "seats" && !inRange(seatColValue(m, d, S.f.range.key), S.f.range)) return false;
  return true;
}
function filterWords(m) {
  const w = [];
  if (S.f.margin) w.push(MARGINS[S.f.margin][2].split(",")[0].toLowerCase());
  if (S.f.cls) w.push(CLS_SHORT[S.f.cls].toLowerCase());
  if (S.f.win) w.push(`held by ${FAM_PL[S.f.win]}`);
  if (S.f.st) w.push(STATE_SHORT[S.f.st]);
  if (S.f.range) { const c = colByKey(m, S.f.range.unit, S.f.range.key); if (c) w.push(`${c.short || c.label} ${rangeText(S.f.range, c)}`); }
  return w;
}
function rangeText(r, c) { const f = c.fmt || f1; return r.loOpen ? `under ${f(r.hi)}` : r.hiOpen ? `${f(r.lo)} or more` : `${f(r.lo)} to ${f(r.hi)}`; }

/* =============================== columns ===============================
   One definition per measure serves the table, its sort, the column-head
   sparkline, the distribution chart and the range filter. */
function seatColValue(m, d, key) { const c = colByKey(m, "seats", key); return c ? c.get(d) : null; }
function boothColValue(m, j, key) { const c = colByKey(m, "booths", key); return c ? c.get(j) : null; }
// the informal lens rides its own column until the exhausted-ballot view takes over, then the generic lens column carries the district figure
const lensKey = () => (S.lens === "tpp" ? (S.tppMode === "swing" ? "swing" : "tpp") : S.lens === "informal" ? (infModeOf(M()) === "exhaust" ? "lens" : "inf") : S.lens === "winner" ? "win" : S.lens === "cls" ? "cls" : "lens");
function lensColumn(get, colOf) {
  const lab = lensShort();
  const dec = S.lens === "seifa" && !isDemo();
  // the income lens's median view prices column cells in weekly dollars
  const dol = S.lens === "seifa" && incMed();
  // the age lens's median view prices column cells in years
  const yr = S.lens === "seifa" && ageMed();
  // a signed lens (a primary's change, the Senate's gap on the House) reads as a change: diverging, no bar
  const signed = (S.lens === "fp" && S.fpMode === "change") || (S.lens === "senate" && senGap());
  const scale = S.lens === "fp" || S.lens === "senate" ? (signed ? null : FPMAX[S.party]) : S.lens === "flow" ? 100 : S.lens === "seifa" ? (dec ? 10 : demoRange()[1]) : null;
  return { key: "lens", label: lensHead(), short: lab, get, num: S.lens !== "cls", txt: S.lens === "cls", w: "minmax(120px,1fr)", lens: true, dist: S.lens !== "cls",
    fmt: dol ? (v) => mny(v) : yr ? (v) => String(Math.round(v)) : dec ? (v) => String(Math.round(v)) : signed ? (v) => sgn(v) : f1,
    color: (v) => colorOf(v), decile: dec, diverge: signed,
    html: (r) => { const v = get(r); if (v == null || Number.isNaN(v)) return `<span class="c2">–</span>`; if (S.lens === "cls") return esc(CLS_SHORT[v]); const w = scale ? clamp((100 * v) / scale, 3, 100) : 100; return `<div class="lv">${scale ? `<i style="width:${0.6 * w}px;background:${colCss(colorOf(v))}"></i>` : `<i style="width:9px;height:9px;background:${colCss(colorOf(v))}"></i>`}<span>${dol ? mny(v) : yr ? Math.round(v) : dec ? v : signed ? sgn(v) : f1(v)}</span></div>`; } };
}
const fig2 = (a, af, b, bf) => `<span class="fig"><span class="${tx(af)}">${f1(a)}</span><span style="color:var(--ink-faint)"> – </span><span class="${tx(bf)}">${f1(b)}</span></span>`;
function seatCols(m) {
  const now = m.year === "now";
  const cols = [
    { key: "name", label: "Seat", get: (d) => d.n, txt: true, w: "minmax(140px,1.25fr)", html: (d) => `<span class="c1">${ds(d.n)}</span><span class="c2">${STATE_SHORT[d.st]}${d.cls ? " · " + esc(CLS_SHORT[d.cls]) : ""}</span>` },
    { key: "win", label: now ? "Held by" : "Won by", get: (d) => holdFam(d.hold) + d.hold.n, txt: true, w: "minmax(150px,1.35fr)", cat: true, html: (d) => `<span class="c1"><span class="sw" style="${swc(holdFam(d.hold))}"></span>${ds(d.hold.n)}</span><span class="c2">${ds(leaderName(d.hold))}${now && (d.hold.n !== d.win.n || d.hold.ab !== d.win.ab) ? (d.by ? " · by-election" : " · changed party") : ""}</span>` },
    { key: "final", label: "Final count", short: "Winning share", get: (d) => d.winPct, num: true, w: "112px", dist: true, fmt: f1, html: (d) => `${fig2(d.winPct, d.win.fam, 100 - d.winPct, d.run.fam)}<span class="c2">${ds(surname(d.win.n))} v ${ds(surname(d.run.n))}</span>` },
    { key: "tpp", label: "Labor 2PP", get: (d) => nn(d.tpp), num: true, w: "86px", dist: true, fmt: f1, color: (v) => RAMP.div[dIdx((50 - v) / 20)], ref: (a) => a.tpp, html: (d) => d.tpp == null ? `<span class="c2">–</span>` : `<span class="fig ${d.tpp >= 50 ? "t-alp" : "t-lnp"}">${f1(d.tpp)}</span>` },
    { key: "swing", label: "Swing", short: "Swing to Labor", get: (d) => nn(d.tppSw), num: true, w: "78px", dist: true, fmt: sgn, color: (v) => RAMP.div[dIdx(-v / 10)], ref: (a) => a.tppSw, zero: true, html: (d) => d.tppSw == null ? `<span class="c2">–</span>` : `<span class="fig ${d.tppSw >= 0 ? "t-alp" : "t-lnp"}">${sgn(d.tppSw)}</span>` },
  ];
  const lk = lensKey();
  if (lk === "lens" || lk === "cls") cols.push(lensColumn((d) => divValue(m, d.i)));
  if (lk === "tpp" || lk === "swing") cols.find((c) => c.key === lk).lens = true;
  if (lk === "win") cols.find((c) => c.key === "win").lens = true;
  cols.push({ key: "inf", label: "Informal", get: (d) => nn(d.infPct), num: true, w: "78px", dist: true, fmt: f1, color: (v) => RAMP.inf[Math.round(clamp(v / 12, 0, 1) * 100)], ref: (a) => a.infPct, lens: lk === "inf", html: (d) => `<span class="fig">${f1(d.infPct)}</span>` });
  return cols;
}
function boothCols(m) {
  const b = m.booth;
  const cols = [
    { key: "name", label: "Polling place", get: (j) => b.name[j], txt: true, w: "minmax(170px,1.6fr)", html: (j) => `<span class="c1">${ds(b.name[j])}</span><span class="c2">${ds([b.prem[j], b.sub[j]].filter(Boolean).join(", ") || TYPE[b.ty[j]] || "")}</span>` },
    { key: "seat", label: "Seat", get: (j) => m.divs[b.d[j]].n, txt: true, w: "minmax(96px,0.8fr)", html: (j) => `<span class="c1" style="font-weight:500">${ds(m.divs[b.d[j]].n)}</span><span class="c2">${STATE_SHORT[m.divs[b.d[j]].st]}</span>` },
    { key: "votes", label: "Votes", get: (j) => b.votes[j], num: true, w: "72px", dist: true, fmt: (v) => int(v), html: (j) => `<span class="fig" style="font-weight:500">${int(b.votes[j])}</span>` },
    { key: "lead", label: "Led", short: "Leader’s share", get: (j) => nn(b.leadPct[j]), num: true, w: "112px", dist: true, fmt: f1, html: (j) => { const ld = b.lead[j]; if (!ld) return `<span class="c2">–</span>`; const D = m.divs[b.d[j]]; return `<span class="c1" style="font-weight:500"><span class="sw" style="${swc(ld.fam)}"></span>${ds(pairNames(ld, ld === D.A ? D.B : D.A)[0])}</span><span class="c2">${f1(b.leadPct[j])}%</span>`; } },
    { key: "tpp", label: "Labor 2PP", get: (j) => nn(b.tpp[j]), num: true, w: "86px", dist: true, fmt: f1, color: (v) => RAMP.div[dIdx((50 - v) / 20)], ref: (a) => a.tpp, html: (j) => Number.isNaN(b.tpp[j]) ? `<span class="c2">–</span>` : `<span class="fig ${b.tpp[j] >= 50 ? "t-alp" : "t-lnp"}">${f1(b.tpp[j])}</span>` },
    { key: "swing", label: "Swing", short: "Swing to Labor", get: (j) => nn(b.tppSw[j]), num: true, w: "78px", dist: true, fmt: sgn, color: (v) => RAMP.div[dIdx(-v / 10)], ref: (a) => a.tppSw, zero: true, html: (j) => Number.isNaN(b.tppSw[j]) ? `<span class="c2">–</span>` : `<span class="fig ${b.tppSw[j] >= 0 ? "t-alp" : "t-lnp"}">${sgn(b.tppSw[j])}</span>` },
  ];
  const lk = lensKey();
  if (lk === "lens" || lk === "cls") cols.push(lensColumn((j) => boothValue(m, j)));
  if (lk === "tpp" || lk === "swing") cols.find((c) => c.key === lk).lens = true;
  if (lk === "win") cols.find((c) => c.key === "lead").lens = true;
  cols.push({ key: "inf", label: "Informal", get: (j) => nn(b.infPct[j]), num: true, w: "78px", dist: true, fmt: f1, color: (v) => RAMP.inf[Math.round(clamp(v / 12, 0, 1) * 100)], ref: (a) => a.infPct, lens: lk === "inf", html: (j) => `<span class="fig">${f1(nn(b.infPct[j]))}</span>` });
  return cols;
}
// at phone width the list keeps two columns: the place (with its holder or seat beneath) and the lens's figure
const narrowList = () => { const el = $("#list"); return (el && el.clientWidth ? el.clientWidth : innerWidth) < 600; };
function compactCols(m, unit, cols) {
  const lensCol = cols.find((c) => c.lens && c.num) || cols.find((c) => c.key === (unit === "seats" ? "final" : "lead"));
  const b = m.booth;
  const first = unit === "seats"
    ? { ...cols[0], w: "minmax(0,1fr)", html: (d) => `<span class="c1"><span class="sw" style="${swc(holdFam(d.hold))}"></span>${ds(d.n)}</span><span class="c2">${STATE_SHORT[d.st]} · ${ds(d.hold.n)}, ${esc(partyShort(d.hold.ab, d.hold.pn))}</span>` }
    : { ...cols[0], w: "minmax(0,1fr)", html: (j) => `<span class="c1">${ds(b.name[j])}</span><span class="c2">${ds(m.divs[b.d[j]].n)} · ${int(b.votes[j])} votes</span>` };
  return [first, { ...lensCol, w: "104px" }];
}
const colsFor = (m, unit, full) => { const c = unit === "seats" ? seatCols(m) : boothCols(m); return !full && narrowList() ? compactCols(m, unit, c) : c; };
function colByKey(m, unit, key) { return colsFor(m, unit, true).find((c) => c.key === key) || null; }

/* =============================== distributions ===============================
   A column chart of how one measure spreads across the rows in view: one bar
   per bin, coloured by the map's own scale where the measure has one, the
   country's figure marked, the chosen seat or place marked. A bar (or a drag
   across several) filters the list to that range, and the map and chamber
   dim everything outside it. */
const NICE = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
function binsFor(vals, c, target) {
  if (c.decile) return { lo: 0.5, hi: 10.5, w: 1, n: 10, decile: true };
  const sorted = [...vals].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  let lo = sorted.length > 400 ? q(0.005) : sorted[0], hi = sorted.length > 400 ? q(0.995) : sorted[sorted.length - 1];
  if (c.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  let w = NICE[NICE.length - 1];
  for (const x of NICE) if ((hi - lo) / x <= target) { w = x; break; }
  lo = Math.floor(lo / w) * w; hi = Math.ceil(hi / w) * w; if (hi <= lo) hi = lo + w;
  return { lo, hi, w, n: Math.round((hi - lo) / w), loOpen: sorted[0] < lo - 1e-9, hiOpen: sorted[sorted.length - 1] > hi + 1e-9 };
}
function distData(m, unit, rows, key, target) {
  const c = colByKey(m, unit, key);
  if (!c || !c.num) return null;
  const vals = [], ids = [];
  for (const r of rows) { const v = c.get(r); if (v != null && !Number.isNaN(v)) { vals.push(v); ids.push(r); } }
  if (vals.length < 3) return { c, vals, empty: true };
  const B = binsFor(vals, c, target || (unit === "seats" ? 22 : 44));
  const counts = new Array(B.n).fill(0), members = Array.from({ length: B.n }, () => []);
  vals.forEach((v, k) => { const bi = clamp(Math.floor((v - B.lo) / B.w + 1e-9), 0, B.n - 1); counts[bi]++; members[bi].push(ids[k]); });
  return { c, B, counts, members, vals, ids, unit };
}
let distSeq = 0;
const distReg = new Map(); // id -> { m, unit, key, rows, d, opts }
function distSVG(D, W, H, opts) {
  const { c, B, counts } = D;
  const padL = 2, padR = 2, padT = opts.compact ? 6 : 14, padB = opts.compact ? 18 : 22;
  const x = (v) => padL + ((v - B.lo) / (B.hi - B.lo)) * (W - padL - padR);
  const max = Math.max(...counts, 1);
  const y = (n) => H - padB - (n / max) * (H - padT - padB);
  const bw = (W - padL - padR) / B.n, gap = bw > 6 ? 2 : bw > 3 ? 1 : 0;
  const r = S.f.range && S.f.range.unit === D.unit && S.f.range.key === c.key ? S.f.range : null;
  let s = "";
  const stack = D.unit === "seats" && c.decile;
  for (let k = 0; k < B.n; k++) {
    const n = counts[k]; if (!n) continue;
    const v0 = B.lo + k * B.w, mid = v0 + B.w / 2;
    const col = c.color ? c.color(mid) : null;
    const on = !r || (mid >= r.lo && mid <= r.hi);
    const bx = (x(v0) + gap / 2).toFixed(1), bwd = Math.max(1, bw - gap).toFixed(1);
    if (stack) {
      // a tenth of the seats each, so the bar's height is fixed: who holds them is the reading
      let acc = H - padB;
      for (const f of ["alp", "grn", "ind", "csa", "oth", "onp", "lnp"]) {
        const nf = D.members[k].filter((d) => holdFam(d.hold) === f).length; if (!nf) continue;
        const hh = (nf / max) * (H - padT - padB);
        acc -= hh;
        s += `<rect x="${bx}" y="${acc.toFixed(1)}" width="${bwd}" height="${Math.max(0.5, hh - 1).toFixed(1)}" fill="var(--m-${f})" opacity="${on ? 1 : 0.22}" data-bin="${k}"/>`;
      }
      continue;
    }
    const top = y(n), hgt = H - padB - top;
    s += `<rect x="${bx}" y="${top.toFixed(1)}" width="${bwd}" height="${Math.max(1, hgt).toFixed(1)}" rx="${Math.min(2, (bw - gap) / 3).toFixed(1)}" fill="${col ? css(col) : "var(--ink-faint)"}" opacity="${on ? 1 : 0.22}" data-bin="${k}"/>`;
  }
  // the baseline and ticks
  s += `<line x1="${padL}" x2="${W - padR}" y1="${H - padB + 0.5}" y2="${H - padB + 0.5}" stroke="var(--ink-faint)" stroke-width="1"/>`;
  const ticks = B.decile ? [1, 5, 10] : d3.ticks(B.lo, B.hi, opts.compact ? 4 : 7).filter((t) => t >= B.lo && t <= B.hi);
  const fmt = c.fmt || f1;
  ticks.forEach((t, k) => { const tx0 = B.decile ? x(t) : x(t); const anchor = tx0 < 14 ? "start" : tx0 > W - 14 ? "end" : "middle"; s += `<line x1="${tx0}" x2="${tx0}" y1="${H - padB}" y2="${H - padB + 4}" stroke="var(--ink-faint)"/><text x="${tx0}" y="${H - padB + 15}" text-anchor="${anchor}" font-size="11" fill="var(--ink-3)">${B.decile ? t : t === 0 && c.zero ? "0" : fmt(t).replace(/\.0$/, "")}${!B.decile && k === ticks.length - 1 && /tpp|inf|final|lens|lead/.test(c.key) && !c.diverge && c.key !== "votes" ? "%" : ""}</text>`; });
  // the country's figure
  const ref = c.ref ? c.ref(M().areas[S.sel.level === "aus" || !S.sel.st ? "AUS" : S.sel.st]) : c.key === "lens" ? lensRef() : null;
  if (ref != null && ref >= B.lo && ref <= B.hi) {
    const rx = x(ref);
    s += `<line x1="${rx}" x2="${rx}" y1="${padT - (opts.compact ? 4 : 8)}" y2="${H - padB}" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 3"/>`;
    if (!opts.compact) s += `<text x="${rx + (rx > W - 120 ? -5 : 5)}" y="${padT - 2}" text-anchor="${rx > W - 120 ? "end" : "start"}" font-size="11.5" font-weight="600" fill="var(--ink-2)">${S.sel.level === "aus" || !S.sel.st ? "Australia" : STATE_SHORT[S.sel.st]} ${fmt(ref)}</text>`;
  }
  // the chosen seat or place
  const selId = D.unit === "seats" ? selDiv() : S.sel.level === "booth" ? S.sel.booth : null;
  if (selId != null) {
    const v = c.get(D.unit === "seats" ? M().divs[selId] : selId);
    if (v != null && !Number.isNaN(v)) {
      const vx = x(clamp(v, B.lo, B.hi));
      s += `<path d="M${vx - 5},${H - padB + 9} L${vx},${H - padB + 3} L${vx + 5},${H - padB + 9} Z" fill="var(--ink)"/>`;
    }
  }
  // a drag-brush layer
  s += `<rect class="dist-hit" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="display:block;overflow:visible">${s}</svg>`;
}
function lensRef() {
  const m = M(), a = m.areas[S.sel.level === "aus" || !S.sel.st ? "AUS" : S.sel.st];
  if (S.lens === "fp") return S.fpMode === "change" ? a.fpSw[S.party] : a.fp[S.party];
  if (S.lens === "senate") { const r = senArea(m, a.idx, S.party); return r ? (senGap() ? r.gap : r.sen) : null; }
  if (S.lens === "seifa" && isDemo()) return demoAreaShare(a.demo);
  if (S.lens === "flow") { let toA = 0, tot = 0; for (const i of a.idx) { const d = m.divs[i]; if (!flowSeat(d)) continue; for (const f of d.flows) if (f.cand.b === S.from) { toA += d.alpSide === 0 ? f.ta : f.tb; tot += f.ta + f.tb; } } return tot ? (100 * toA) / tot : null; }
  return null;
}
// a placeholder the story or the list fills once laid out (the chart needs its width)
function distBlock(m, unit, rows, opts) {
  const key = opts.key || (lensKey() === "lens" ? "lens" : lensKey() === "inf" ? "inf" : lensKey() === "swing" ? "swing" : "tpp");
  const id = "dist" + ++distSeq;
  distReg.set(id, { m, unit, key, rows, opts });
  return `<div class="dist${opts.compact ? " compact" : ""}" id="${id}" data-dist-id="${id}"></div>`;
}
function hydrateDists() {
  for (const [id, r] of distReg) {
    const el = document.getElementById(id);
    if (!el) { distReg.delete(id); continue; }
    const D = distData(r.m, r.unit, r.rows, r.key, r.opts.compact ? (r.unit === "seats" ? 18 : 24) : null);
    r.D = D;
    if (!D || D.empty) { el.innerHTML = `<p class="st-note">Not enough values to chart.</p>`; continue; }
    const W = Math.max(200, el.clientWidth || 300), H = r.opts.compact ? 74 : 150;
    const n = D.vals.length, unitWord = r.unit === "seats" ? plural(n, "seat") : plural(n, "polling place");
    const stacked = r.unit === "seats" && D.c.decile;
    el.innerHTML = distSVG(D, W, H, r.opts) + (r.opts.compact ? `<p class="st-note">${stacked ? `Each bar is a tenth of the ${n} seats, from the least advantaged on the left, split by who ${M().year === "now" ? "holds" : "won"} them` : `${n.toLocaleString("en-AU")} ${unitWord}. Each bar counts the ${r.unit === "seats" ? "seats" : "places"} in its range`}; choose one to pick them out${S.view === "list" ? "" : " on the " + (S.view === "chamber" ? "chamber" : "map")}.</p>` : "");
  }
}
// hover, click and drag on any distribution chart
(() => {
  let drag = null;
  const binAt = (el, r, clientX) => { const svg = el.querySelector("svg"); const bb = svg.getBoundingClientRect(); const D = r.D; if (!D || !D.B) return null; const fx = (clientX - bb.left) / bb.width; return clamp(Math.floor(fx * D.B.n), 0, D.B.n - 1); };
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest("[data-dist-id]");
    if (!el) { if (distTipOn) { hideTip(); distTipOn = false; } return; }
    const r = distReg.get(el.dataset.distId); if (!r || !r.D || !r.D.B) return;
    const k = binAt(el, r, e.clientX); if (k == null) return;
    if (drag && drag.el === el) { drag.k1 = k; previewDrag(el, r, drag); }
    const D = r.D, B = D.B, n = D.counts[k], v0 = B.lo + k * B.w, v1 = v0 + B.w;
    const fmt = D.c.fmt || f1, unitWord = r.unit === "seats" ? plural(n, "seat") : plural(n, "polling place");
    const names = D.members[k].slice(0, 4).map((id) => (r.unit === "seats" ? M().divs[id.i].n : M().booth.name[id])).map(esc).join(", ");
    const range = B.decile ? `decile ${k + 1}` : k === 0 && B.loOpen ? `under ${fmt(v1)}` : k === B.n - 1 && B.hiOpen ? `${fmt(v0)} or more` : `${fmt(v0)} to ${fmt(v1)}`;
    showTipAt(`<div class="tn">${n} ${unitWord}<span>${esc(D.c.short || D.c.label)} ${range}</span></div>${n ? `<div class="ts">${names}${n > 4 ? `, and ${n - 4} more` : ""}</div>` : ""}<div class="ts">${S.f.range && S.f.range.key === D.c.key ? "Click again to clear" : "Click, or drag across bars, to pick them out"}</div>`, e.clientX, e.clientY);
    distTipOn = true;
  });
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest && e.target.closest("[data-dist-id]");
    if (!el || e.button) return;
    const r = distReg.get(el.dataset.distId); if (!r || !r.D || !r.D.B) return;
    const k = binAt(el, r, e.clientX); if (k == null) return;
    drag = { el, r, k0: k, k1: k };
    e.preventDefault();
  });
  document.addEventListener("pointerup", () => {
    if (!drag) return;
    const { r, k0, k1 } = drag; drag = null;
    const D = r.D, B = D.B, a = Math.min(k0, k1), b = Math.max(k0, k1);
    const lo = B.lo + a * B.w, hi = B.lo + (b + 1) * B.w;
    const cur = S.f.range;
    if (cur && cur.unit === r.unit && cur.key === D.c.key && Math.abs(cur.lo - lo) < 1e-9 && Math.abs(cur.hi - hi) < 1e-9) S.f.range = null;
    else S.f.range = { unit: r.unit, key: D.c.key, lo, hi, loOpen: a === 0 && B.loOpen, hiOpen: b === B.n - 1 && B.hiOpen, last: b === B.n - 1 };
    if (r.unit === "booths" && S.listUnit !== "booths") S.listUnit = "booths";
    filtersChanged();
  });
})();
let distTipOn = false;
function previewDrag(el, r, drag) {
  const a = Math.min(drag.k0, drag.k1), b = Math.max(drag.k0, drag.k1);
  el.querySelectorAll("rect[data-bin]").forEach((rc) => { const k = +rc.dataset.bin; rc.setAttribute("opacity", k >= a && k <= b ? "1" : "0.22"); });
}

/* =============================== the list view =============================== */
/* booth rows are taller: their names wrap to two lines (.ls-row.booths in page.css) */
const ROW_H = (u) => (u === "booths" ? 58 : 52);
/* the list's proper-name cells use the shared ds (esc + curly apostrophes) */
function listRows(m) {
  const q = S.q.trim() && S.view === "list" ? norm(S.q.trim()).split(/\s+/).filter(Boolean) : null;
  const hit = (h) => !q || q.every((t) => h.includes(t));
  if (S.listUnit === "seats") return m.divs.filter((d) => passes(m, d.i) && hit(norm(d.n + " " + d.hold.n + " " + d.win.n + " " + d.st + " " + STATE_TITLE[d.st]))).map((d) => d);
  const b = m.booth, sd = selDiv();
  const out = [];
  const r = S.f.range && S.f.range.unit === "booths" ? S.f.range : null;
  const loop = (j) => {
    const D = m.divs[b.d[j]];
    if (sd == null && S.f.st && D.st !== S.f.st) return;
    if (sd == null && (S.f.cls || S.f.win || S.f.margin) && !passes(m, D.i, true)) return;
    if (r && !inRange(boothColValue(m, j, r.key), r)) return;
    if (hit(norm(b.name[j] + " " + (b.sub[j] || "") + " " + (b.pc[j] || "") + " " + D.n))) out.push(j);
  };
  if (sd != null) b.byDiv[sd].forEach(loop); else for (let j = 0; j < b.n; j++) loop(j);
  return out;
}
let listCache = null;
function renderList(keepScroll) {
  const m = M(); if (!m || S.view !== "list") return;
  const el = $("#list");
  const unit = S.listUnit, sd = selDiv();
  const cols = colsFor(m, unit);
  const rows = listRows(m);
  // sort: the lens column by default, highest first
  const lc = cols.find((c) => c.lens && c.num);
  const sk = S.sort && cols.find((c) => c.key === S.sort.key) ? S.sort : lc ? { key: lc.key, dir: -1 } : { key: "name", dir: 1 };
  const sc = cols.find((c) => c.key === sk.key);
  rows.sort((a, b) => { const x = sc.get(a), y = sc.get(b); const xn = x == null || Number.isNaN(x), yn = y == null || Number.isNaN(y); if (xn && yn) return 0; if (xn) return 1; if (yn) return -1; return (typeof x === "string" ? x.localeCompare(y) : x - y) * sk.dir; });
  const total = unit === "seats" ? m.divs.length : sd != null ? m.booth.byDiv[sd].length : m.booth.n;
  const sel = (name, k, opts, cur) => `<select class="ls-sel${cur ? " on" : ""}" data-fsel="${k}" aria-label="${name}"><option value="">${name}</option>${opts.map(([v, t]) => `<option value="${v}"${cur === v ? " selected" : ""}>${cur === v ? "✓ " : ""}${t}</option>`).join("")}</select>`;
  let bar = `<div class="ls-unit" role="tablist" aria-label="Rows"><button type="button" class="rd-tab" role="tab" data-unit="seats" aria-selected="${unit === "seats"}"><span class="tw" data-t="Seats">Seats</span></button><button type="button" class="rd-tab" role="tab" data-unit="booths" aria-selected="${unit === "booths"}"><span class="tw" data-t="Polling places">Polling places</span></button></div>`;
  if (unit === "booths" && sd != null) bar += `<button type="button" class="ls-chip" data-unseat title="Show every polling place">In ${ds(m.divs[sd].n)} ✕</button>`;
  else {
    bar += sel("State", "st", STATES.map((s) => [s, STATE_TITLE[s]]), S.f.st);
    bar += sel(m.year === "now" ? "Held by" : "Won by", "win", ["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => m.divs.some((d) => holdFam(d.hold) === f)).map((f) => [f, famLeg(f)]), S.f.win);
    bar += sel("Seat type", "cls", CLS.map((c) => [c, CLS_SHORT[c]]), S.f.cls);
    bar += sel("Margin", "margin", Object.entries(MARGINS).map(([k, v]) => [k, v[2]]), S.f.margin);
  }
  if (S.f.range) { const c = colByKey(m, S.f.range.unit, S.f.range.key); if (c) bar += `<button type="button" class="ls-chip" data-unrange title="Clear this range">${esc(c.short || c.label)} ${esc(rangeText(S.f.range, c))} ✕</button>`; }
  bar += `<span class="ls-count"><b>${rows.length.toLocaleString("en-AU")}</b> of ${total.toLocaleString("en-AU")} ${unit === "seats" ? "seats" : "places"}</span>`;
  // the distribution chart, for whichever column is chosen
  const dk = S.dist && cols.find((c) => c.key === S.dist && c.num) ? S.dist : null;
  const distHtml = dk ? `<div class="ls-dist"><div class="ls-dist-h"><b>${esc((cols.find((c) => c.key === dk).short || cols.find((c) => c.key === dk).label))}</b><span>across ${unit === "seats" ? "these seats" : "these polling places"}</span><button type="button" data-distclose aria-label="Close the distribution">✕</button></div>${distBlock(m, unit, rowsForDist(m, unit), { key: dk })}</div>` : "";
  const tmpl = cols.map((c) => c.w).join(" ");
  const sparkFor = (c) => c.num && c.dist ? `<span class="ls-spark" data-dist="${c.key}" role="button" tabindex="0" aria-label="Show how ${esc(c.label)} is distributed" title="Show the distribution">${sparkSVG(m, unit, rowsForDist(m, unit), c)}</span>` : "";
  const headHtml = `<div class="ls-head" role="row" style="grid-template-columns:${tmpl}">${cols.map((c) => `<div role="columnheader" class="ls-hc${c.num ? " r" : ""}${c.key === dk ? " dist-on" : ""}"${c.key === sk.key ? ` aria-sort="${sk.dir > 0 ? "ascending" : "descending"}"` : ""}>${sparkFor(c)}<button type="button" data-sort="${c.key}" class="${c.num ? "r" : ""}"${c.key === sk.key ? ` aria-sort="${sk.dir > 0 ? "ascending" : "descending"}"` : ""}>${esc(c.label)}<span class="ar">${c.key === sk.key ? (sk.dir > 0 ? "▲" : "▼") : "▾"}</span></button></div>`).join("")}</div>`;
  const grid = el.querySelector(".ls-grid");
  const prevTop = keepScroll && grid ? grid.scrollTop : 0;
  el.innerHTML = `<div class="ls-bar">${bar}</div>${distHtml}<div class="ls-grid" role="table" aria-rowcount="${rows.length}">${headHtml}${rows.length ? `<div class="ls-pad" style="height:${rows.length * ROW_H(unit)}px;position:relative"></div>` : `<div class="ls-empty">Nothing matches. Clear the search or a filter.</div>`}</div>`;
  listCache = { rows, cols, tmpl, unit };
  const g2 = el.querySelector(".ls-grid");
  g2.scrollTop = prevTop;
  g2.addEventListener("scroll", () => requestAnimationFrame(paintRows), { passive: true });
  paintRows();
  hydrateDists();
}
// the distribution reads every row the other filters let through, so its own range doesn't hide the rest of the spread
function rowsForDist(m, unit) {
  const saved = S.f.range; S.f.range = saved && saved.unit !== unit ? saved : null;
  const unitSaved = S.listUnit; S.listUnit = unit;
  const rows = listRows(m);
  S.f.range = saved; S.listUnit = unitSaved;
  return rows;
}
function sparkSVG(m, unit, rows, c) {
  const D = distData(m, unit, rows, c.key, 12);
  if (!D || D.empty) return "";
  const W = 46, H = 13, max = Math.max(...D.counts, 1), bw = W / D.B.n;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${D.counts.map((n, k) => (n ? `<rect x="${(k * bw + 0.5).toFixed(1)}" y="${(H - (n / max) * H).toFixed(1)}" width="${Math.max(0.8, bw - 1).toFixed(1)}" height="${((n / max) * H).toFixed(1)}" fill="${c.color ? css(c.color(D.B.lo + (k + 0.5) * D.B.w)) : "var(--ink-faint)"}"/>` : "")).join("")}</svg>`;
}
function paintRows() {
  if (!listCache) return;
  const grid = $("#list .ls-grid"), pad = grid && grid.querySelector(".ls-pad"); if (!pad) return;
  const { rows, cols, tmpl, unit } = listCache;
  const headH = grid.querySelector(".ls-head").offsetHeight;
  const top = Math.max(0, grid.scrollTop - headH), h = grid.clientHeight;
  const rh = ROW_H(unit);
  const a = Math.max(0, Math.floor(top / rh) - 6), z = Math.min(rows.length, Math.ceil((top + h) / rh) + 6);
  const s = S.sel;
  let html = "";
  for (let k = a; k < z; k++) {
    const r = rows[k];
    const on = unit === "seats" ? (s.level === "div" || s.level === "booth") && s.div === r.i : s.level === "booth" && s.booth === r;
    html += `<div class="ls-row${unit === "booths" ? " booths" : ""}${on ? " on" : ""}" role="row" data-go="${unit === "seats" ? "div:" + r.i : "booth:" + r}" style="top:${k * rh}px;height:${rh}px;grid-template-columns:${tmpl}">${cols.map((c) => `<div role="cell" class="${c.num ? "r" : ""}">${c.html(r)}</div>`).join("")}</div>`;
  }
  pad.innerHTML = html;
}
