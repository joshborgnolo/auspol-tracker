/* =============================== lens values =============================== */
// the colour a seat wears: in "Now" the Winner lens reads who holds the seat today
function divValue(m, i) {
  const d = m.divs[i];
  switch (S.lens) {
    case "winner": return d.hold.fam;
    case "tpp": return S.tppMode === "swing" ? nn(d.tppSw) : nn(d.tpp);
    case "fp": return S.fpMode === "change" ? fpChange(m, d, S.party) : d.fp[S.party];
    case "flow": return d.classic ? nn(d.flowAlp[S.from]) : null;
    case "informal": return nn(d.infPct);
    case "cls": return d.cls || null;
    case "seifa": return isDemo() ? (d.demo && d.demo[S.index] != null ? 100 * d.demo[S.index] : null) : nn(d.seifa[S.index] && d.seifa[S.index].dec);
  }
  return null;
}
// a party's primary-vote change on the previous election in the same seat
// (the AEC's candidate swing columns, summed by family; null where the family
// didn't stand last time and doesn't now)
function fpChange(m, d, fam) {
  if (d.by) { // the by-election against the seat's 2025 count
    const p = d.by.prev; return d.fp[fam] - p.fp[fam];
  }
  let s = 0, any = false;
  for (const c of d.c) if (c.b === fam && c.sw != null) { s += c.sw; any = true; }
  return any ? s : null;
}
function boothValue(m, j) {
  const b = m.booth;
  switch (S.lens) {
    case "winner": return b.lead[j] ? b.lead[j].fam : null;
    case "tpp": return S.tppMode === "swing" ? nn(b.tppSw[j]) : nn(b.tpp[j]);
    case "fp": {
      if (S.fpMode !== "change") return nn(b.fp[S.party][j]);
      const pf = b.raw.prevFp ? b.raw.prevFp[j] : null;
      if (!pf) return null;
      const v = b.fp[S.party][j];
      return Number.isNaN(v) ? null : v - pf[S.party];
    }
    case "flow": return nn(b.flowAlp[S.from][j]);
    case "informal": return nn(b.infPct[j]);
    case "cls": return m.divs[b.d[j]].cls || null;
    case "seifa": {
      if (isDemo()) { const r = b.raw.demo && b.raw.demo[j]; return r ? 100 * r[DM.indexOf(S.index)] : null; }
      const arr = S.basis === "voters" ? b.raw.vdec[j] : b.raw.dec[j]; return arr ? nn(arr[IX.indexOf(S.index)]) : null;
    }
  }
  return null;
}
const dIdx = (u) => Math.round(clamp(u, -1, 1) * 100) + 100;
function colorOf(v) {
  if (v == null) return null;
  switch (S.lens) {
    case "winner": return TH.party[v];
    case "tpp": return S.tppMode === "swing" ? RAMP.div[dIdx(-v / 10)] : RAMP.div[dIdx((50 - v) / 20)];
    case "fp": return S.fpMode === "change"
      ? (v >= 0 ? RAMP.fp[S.party][Math.round(clamp(v / 15, 0, 1) * 100)] : RAMP.loss[Math.round(clamp(-v / 15, 0, 1) * 100)])
      : RAMP.fp[S.party][Math.round(clamp(v / FPMAX[S.party], 0, 1) * 100)];
    case "flow": return RAMP.div[dIdx((50 - v) / 40)];
    case "informal": return RAMP.inf[Math.round(clamp(v / 12, 0, 1) * 100)];
    case "cls": { const k = CLS.indexOf(v); return k < 0 ? null : TH.cls[k]; }
    case "seifa": {
      if (!isDemo()) return RAMP.seifa[Math.round(((v - 1) / 9) * 100)];
      const [lo, hi] = DM_RANGE[S.index]; return RAMP.demo[S.index][Math.round(clamp((v - lo) / (hi - lo), 0, 1) * 100)];
    }
  }
  return null;
}
const lensNumeric = () => !(S.lens === "winner" || S.lens === "cls");

/* =============================== colours per year =============================== */
let fade = null, fadeT = 1;
function recolor(animate) {
  for (const m of Object.values(Y)) {
    if (!m.divs) continue;
    if (animate && m.divCol && !reduceMotion) { m.prevDivCol = m.divCol; m.prevBoothCol = m.boothCol; }
    else { m.prevDivCol = null; m.prevBoothCol = null; }
    m.divCol = m.divs.map((d) => colorOf(divValue(m, d.i)));
    const bc = new Array(m.booth.n);
    for (let j = 0; j < m.booth.n; j++) bc[j] = colorOf(boothValue(m, j));
    m.boothCol = bc;
  }
  fade = animate && !reduceMotion ? { t0: performance.now(), dur: 360 } : null;
  schedule();
}
const fillDiv = (m, i) => (fade && m.prevDivCol ? mixC(m.prevDivCol[i], m.divCol[i], fadeT) : m.divCol[i]);
const fillBooth = (m, j) => (fade && m.prevBoothCol ? mixC(m.prevBoothCol[j], m.boothCol[j], fadeT) : m.boothCol[j]);

/* =============================== the stage =============================== */
const canvas = $("#cv"), ctx = canvas.getContext("2d");
const hitCtx = document.createElement("canvas").getContext("2d");
let Wpx = 0, Hpx = 0, dpr = 1, T = d3.zoomIdentity, HOME = d3.zoomIdentity;
const zoom = d3.zoom().scaleExtent([0.5, 2600]).clickDistance(6)
  // the wheel is ours (pan on a trackpad, zoom on a mouse wheel or a pinch)
  .filter((e) => S.view === "map" && e.type !== "wheel" && !e.button && !(e.type === "dblclick"))
  .on("start", (e) => { if (e.sourceEvent && e.sourceEvent.type === "mousedown") canvas.classList.add("grabbing"); })
  .on("zoom", (e) => { T = e.transform; schedule(); updateHint(); legendIfChanged(); })
  .on("end", () => canvas.classList.remove("grabbing"));
d3.select(canvas).call(zoom).on("dblclick.zoom", null);

let hatchCanvas = null;
function hatch() {
  const s = Math.round(7 * dpr);
  if (!hatchCanvas || hatchCanvas._th !== TH || hatchCanvas._dpr !== dpr) {
    hatchCanvas = document.createElement("canvas"); hatchCanvas.width = hatchCanvas.height = s; hatchCanvas._th = TH; hatchCanvas._dpr = dpr;
    const g = hatchCanvas.getContext("2d");
    g.fillStyle = css(TH.nodata); g.fillRect(0, 0, s, s);
    g.strokeStyle = css(TH.hatch); g.lineWidth = Math.max(1, dpr * 0.9);
    g.beginPath(); for (const o of [-s, 0, s]) { g.moveTo(o, s); g.lineTo(o + s, 0); } g.stroke();
  }
  return ctx.createPattern(hatchCanvas, "repeat");
}

function viewBox() { return [-T.x / T.k, -T.y / T.k, (Wpx - T.x) / T.k, (Hpx - T.y) / T.k]; }
const geoOf = (m) => (T.k > K_HI && m.geoHi ? m.geoHi : m.geo);
const selDiv = () => (S.sel.level === "div" || S.sel.level === "booth" ? S.sel.div : null);

// Where booths are on screen they carry the colour, so the areas behind them
// fade to a quiet tint: everywhere once every booth shows (city zoom), and
// the opened seat as soon as it is chosen.
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let quietSince = 0, needFrame = false;
function quietness(i, now) {
  const all = 0.72 * smooth(K_ALL * 0.85, K_ALL * 1.7, T.k);
  if (i === selDiv()) return Math.max(all, 0.72 * clamp((now - quietSince) / 450, 0, 1));
  return all;
}
function drawGeo(m, alpha) {
  const g = geoOf(m), th = TH, now = performance.now();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  const [x0, y0, x1, y1] = viewBox();
  const pat = hatch(); pat.setTransform(new DOMMatrix().scale(1 / (dpr * T.k)));
  const filt = filtersOn();
  for (let i = 0; i < m.divs.length; i++) {
    const b = g.bb[i];
    if (!b || b[1][0] < x0 || b[0][0] > x1 || b[1][1] < y0 || b[0][1] > y1) continue;
    let c = fillDiv(m, i);
    const qn = m === M() ? quietness(i, now) : 0;
    if (c && qn > 0) c = towards(c, th.bg, qn);
    if (qn > 0 && qn < 0.72 && i === selDiv()) needFrame = true;
    ctx.fillStyle = c ? css(c) : pat;
    ctx.fill(g.paths[i]);
    if (filt && !passes(m, i)) { ctx.fillStyle = css(th.bg, 0.8); ctx.fill(g.paths[i]); }
  }
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = css(th.bg); ctx.lineWidth = Math.min(1.1, 0.35 + T.k * 0.25) / T.k; ctx.stroke(g.meshDiv);
  ctx.lineWidth = 2.2 / T.k; ctx.stroke(g.meshState);
  ctx.strokeStyle = css(th.state, 0.7); ctx.lineWidth = 0.9 / T.k; ctx.stroke(g.meshState);
  ctx.strokeStyle = css(th.coast, 0.55); ctx.lineWidth = 0.7 / T.k; ctx.stroke(g.coast);
  ctx.restore();
}

function drawFocus(m) {
  const g = geoOf(m), th = TH, sd = selDiv();
  ctx.save();
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  const [x0, y0, x1, y1] = viewBox();
  if (sd != null) {
    const v = new Path2D(); v.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); v.addPath(g.paths[sd]);
    ctx.fillStyle = css(th.bg, th.veil); ctx.fill(v, "evenodd");
  } else if (S.sel.level === "state") {
    ctx.fillStyle = css(th.bg, th.veil * 0.85);
    for (const d of m.divs) if (d.st !== S.sel.st) ctx.fill(g.paths[d.i]);
  }
  const h = S.hover;
  if (h && h.kind === "div" && h.i !== sd) { ctx.strokeStyle = css(th.ink, 0.9); ctx.lineWidth = 1.6 / T.k; ctx.stroke(g.paths[h.i]); }
  if (sd != null) { ctx.strokeStyle = css(th.ink); ctx.lineWidth = 2.2 / T.k; ctx.stroke(g.paths[sd]); }
  ctx.restore();
}

const zf = () => clamp(0.66 + 0.12 * Math.log2(Math.max(T.k, 1) / 12), 0.6, 1.3);
const rad = (votes) => clamp(1.5 + 0.2 * Math.sqrt(votes), 2.4, 17) * zf();
function visibleBooths(m) {
  const b = m.booth, out = [], sd = selDiv();
  if (sd == null && T.k < K_ALL) return out;
  const [x0, y0, x1, y1] = viewBox(), pad = 24 / T.k;
  if (sd != null) for (const j of b.byDiv[sd]) if (!Number.isNaN(b.x[j])) out.push(j);
  if (T.k >= K_ALL) for (let j = 0; j < b.n; j++) {
    if (b.d[j] === sd || b.ty[j] !== 1) continue;
    const x = b.x[j], y = b.y[j];
    if (Number.isNaN(x) || x < x0 - pad || x > x1 + pad || y < y0 - pad || y > y1 + pad) continue;
    out.push(j);
  }
  out.sort((a, c) => b.votes[c] - b.votes[a]);
  return out;
}
function boothShape(g, ty, x, y, r) {
  g.beginPath();
  if (ty === 5) { const s = r * 0.92; if (g.roundRect) g.roundRect(x - s, y - s, 2 * s, 2 * s, s * 0.32); else g.rect(x - s, y - s, 2 * s, 2 * s); }
  else g.arc(x, y, r, 0, Math.PI * 2);
}
function drawBooths(m) {
  const list = visibleBooths(m); m._vis = list;
  if (!list.length) return;
  const b = m.booth, th = TH, sd = selDiv();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pat = hatch(); pat.setTransform(new DOMMatrix().scale(1 / dpr));
  const rf = S.f.range && S.listUnit === "booths" ? S.f.range : null;
  for (const j of list) {
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(b.votes[j]);
    if (x < -r || y < -r || x > Wpx + r || y > Hpx + r) continue;
    let a = sd != null && b.d[j] !== sd ? 0.5 : 1;
    if (rf && !inRange(boothColValue(m, j, rf.key), rf)) a *= 0.2;
    ctx.globalAlpha = a;
    boothShape(ctx, b.ty[j], x, y, r + 1.6); ctx.fillStyle = css(th.bg); ctx.fill();
    const c = fillBooth(m, j);
    boothShape(ctx, b.ty[j], x, y, r); ctx.fillStyle = c ? css(c) : pat; ctx.fill();
  }
  ctx.globalAlpha = 1;
  const ring = (j, w, col) => { const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(b.votes[j]); boothShape(ctx, b.ty[j], x, y, r + 2.4); ctx.lineWidth = w; ctx.strokeStyle = css(col); ctx.stroke(); };
  if (S.hover && S.hover.kind === "booth") ring(S.hover.i, 1.6, th.ink);
  if (S.sel.level === "booth" && !Number.isNaN(b.x[S.sel.booth])) ring(S.sel.booth, 2.4, th.ink);
  ctx.restore();
}

function drawLabels(m) {
  const th = TH, placed = [], now = performance.now();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  // ground = the colour the label sits on: light ground takes ink with a soft
  // paper halo, dark ground takes near-white with a faint shadow
  const put = (txt, x, y, size, weight, ground, tone, force) => {
    ctx.font = `${weight} ${size}px ${SANS}`;
    const w = ctx.measureText(txt).width, r = [x - w / 2 - 3, y - size / 2 - 2, x + w / 2 + 3, y + size / 2 + 2];
    if (!force) {
      if (r[0] < 2 || r[2] > Wpx - 2 || r[1] < 2 || r[3] > Hpx - 2) return false;
      for (const q of placed) if (!(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3])) return false;
    }
    placed.push(r);
    const dark = lumL(ground) < 0.6;
    if (dark) { ctx.lineWidth = 2.4; ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.strokeText(txt, x, y); ctx.fillStyle = "rgba(255,255,255,0.96)"; }
    else { ctx.lineWidth = 2.6; ctx.strokeStyle = css(ground, 0.85); ctx.strokeText(txt, x, y); ctx.fillStyle = css(tone || th.ink2); }
    ctx.fillText(txt, x, y);
    return true;
  };
  const sd = selDiv(), b = m.booth;
  const groundOf = (i) => { const c = fillDiv(m, i); if (!c) return th.nodata; let g = towards(c, th.bg, quietness(i, now)); if (sd != null && i !== sd) g = towards(g, th.bg, th.veil); return g; };
  if (S.sel.level === "booth" && !Number.isNaN(b.x[S.sel.booth])) {
    const j = S.sel.booth; put(b.name[j], b.x[j] * T.k + T.x, b.y[j] * T.k + T.y - rad(b.votes[j]) - 13, 13, 600, groundOf(sd), th.ink, true);
  }
  if (T.k >= 2.3) {
    const g = geoOf(m), cand = [];
    for (const d of m.divs) {
      if (d.i === sd && T.k > 20) continue;
      if (S.sel.level === "state" && d.st !== S.sel.st) continue;
      const bb = g.bb[d.i]; if (!bb) continue;
      const w = (bb[1][0] - bb[0][0]) * T.k, h = (bb[1][1] - bb[0][1]) * T.k;
      if (w < 52 || h < 20) continue;
      const x = d.lpx * T.k + T.x, y = d.lpy * T.k + T.y;
      if (x < -60 || x > Wpx + 60 || y < -30 || y > Hpx + 30) continue;
      cand.push({ d, x, y, a: w * h });
    }
    cand.sort((p, q) => (q.d.i === sd) - (p.d.i === sd) || q.a - p.a);
    for (const c of cand) put(c.d.n, c.x, c.y, c.d.i === sd ? 13.5 : 12, c.d.i === sd ? 600 : 500, groundOf(c.d.i), sd != null && c.d.i !== sd ? th.ink3 : th.ink2);
  }
  if (m._vis && m._vis.length && T.k > K_BLAB) {
    let n = 0;
    for (const j of m._vis) {
      if (n > 120) break;
      if (S.sel.level === "booth" && j === S.sel.booth) continue;
      const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y;
      if (x < 0 || y < 0 || x > Wpx || y > Hpx) continue;
      if (put(b.name[j].replace(" early voting centre", " (early)"), x, y - rad(b.votes[j]) - 9, 11, 400, groundOf(b.d[j]), sd != null && b.d[j] !== sd ? th.faint : th.ink2)) n++;
    }
  }
  ctx.restore();
}

/* ----- framing ----- */
function stagePads() {
  const phone = isPhone();
  return { t: phone ? 12 : 36, b: phone ? 12 : 18, l: phone ? 8 : 12, r: phone ? 44 : 50 };
}
function fitTransform(bb, maxK) {
  const p = stagePads();
  const [[x0, y0], [x1, y1]] = bb;
  const w = Math.max(x1 - x0, 0.05), h = Math.max(y1 - y0, 0.05);
  const k = Math.min((Wpx - p.l - p.r) / w, (Hpx - p.t - p.b) / h, maxK || 2400);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return d3.zoomIdentity.translate(p.l + (Wpx - p.l - p.r) / 2 - cx * k, p.t + (Hpx - p.t - p.b) / 2 - cy * k).scale(k);
}
function unionBB(list) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const b of list) { if (!b) continue; x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); } return [[x0, y0], [x1, y1]]; }
function homeBox(m) { return unionBB(m.geo.bb); }
// the map may pan anywhere inside the frame of the whole-country view, and no
// further out: at that zoom nothing moves, so a scroll there scrolls the page
function setExtent() {
  const m = M(); if (!m || !Wpx) return;
  HOME = fitTransform(homeBox(m));
  zoom.translateExtent([[-HOME.x / HOME.k, -HOME.y / HOME.k], [(Wpx - HOME.x) / HOME.k, (Hpx - HOME.y) / HOME.k]])
    .scaleExtent([HOME.k, 2600]).extent([[0, 0], [Wpx, Hpx]]);
}
function selectionBox() {
  const m = M(), g = m.geo;
  switch (S.sel.level) {
    case "aus": return homeBox(m);
    case "state": return unionBB(m.areas[S.sel.st].idx.map((i) => g.bb[i]));
    case "div": return g.bb[S.sel.div];
    case "booth": {
      const b = m.booth, j = S.sel.booth;
      if (Number.isNaN(b.x[j])) return g.bb[S.sel.div];
      const k0 = fitTransform(g.bb[S.sel.div]).k;
      const k = clamp(k0 * 1.7, 80, 900), half = Math.min(Wpx, Hpx) / k / 2;
      return [[b.x[j] - half, b.y[j] - half], [b.x[j] + half, b.y[j] + half]];
    }
  }
}
// the last view the page framed by itself, to tell it from one the reader has moved
let lastFit = null;
const atLastFit = () => lastFit && Math.abs(T.k / lastFit.k - 1) < 0.01 && Math.hypot(T.x - lastFit.x, T.y - lastFit.y) < 2;
function fitSelection(dur) {
  if (!M() || !Wpx || S.view !== "map") return;
  const t = fitTransform(selectionBox());
  lastFit = t;
  const s = d3.select(canvas);
  if (!dur || reduceMotion) { s.interrupt(); s.call(zoom.transform, t); }
  else s.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, t);
}
function flyToCity(k) {
  const [, st, ll] = CITIES[k];
  const a = proj(ll[0]), b = proj(ll[1]);
  select({ level: "state", st }, { fly: false });
  const t = fitTransform([[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]]);
  lastFit = t;
  const s = d3.select(canvas);
  if (reduceMotion) s.call(zoom.transform, t); else s.transition().duration(900).ease(d3.easeCubicInOut).call(zoom.transform, t);
}
function zoomBy(f) { if (S.view === "map") d3.select(canvas).transition().duration(reduceMotion ? 0 : 280).call(zoom.scaleBy, f); }

/* ----- the wheel, the trackpad and the pinch -----
   Two fingers on a trackpad pan the map in any direction; a pinch zooms; a
   notched mouse wheel zooms. Where the map can't move any further (the whole
   country already in view, or an edge reached) a vertical scroll passes
   through to the page, so the map never traps it. */
let wheelMode = null, wheelAt = 0;
function classifyWheel(e) {
  if (e.deltaMode !== 0) return "zoom";
  if (e.deltaX !== 0) return "pan";
  const w = e.wheelDeltaY;
  if (w !== undefined && w !== 0) {
    if (Math.abs(Math.abs(w) - Math.abs(e.deltaY) * 3) < 1.5) return "pan";
    if (w % 120 === 0) return "zoom";
  }
  return Math.abs(e.deltaY) < 50 ? "pan" : "zoom";
}
function zoomAt(px, py, factor) {
  d3.select(canvas).interrupt();
  zoom.scaleTo(d3.select(canvas), T.k * factor, [px, py]);
}
function panPx(dx, dy) {
  d3.select(canvas).interrupt();
  const before = T;
  zoom.translateBy(d3.select(canvas), dx / T.k, dy / T.k);
  return [T.x - before.x, T.y - before.y];
}
canvas.addEventListener("wheel", (e) => {
  if (S.view !== "map") { if (e.ctrlKey) e.preventDefault(); return; }
  const now = performance.now();
  if (now - wheelAt > 180) wheelMode = null;
  wheelAt = now;
  const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  if (e.ctrlKey) { // a trackpad pinch arrives as a ctrl-wheel
    e.preventDefault();
    zoomAt(px, py, Math.pow(2, -e.deltaY * 0.012));
    return;
  }
  // a notched wheel announces itself (line deltas, or whole multiples of 120); it
  // overrides a running trackpad gesture, which otherwise keeps its reading so
  // momentum scrolling never flips into zoom
  const notch = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && (e.wheelDeltaY ? e.wheelDeltaY % 120 === 0 : Number.isInteger(e.deltaY)));
  if (notch) wheelMode = "zoom";
  else if (!wheelMode) wheelMode = classifyWheel(e);
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? Hpx : 1;
  if (wheelMode === "pan") {
    const [mx, my] = panPx(-e.deltaX * unit, -e.deltaY * unit);
    const vertical = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
    if (vertical && Math.abs(my) < 0.5 && Math.abs(mx) < 0.5) return; // nothing moved: let the page scroll
    e.preventDefault();
  } else {
    const atMin = T.k <= HOME.k * 1.001 && e.deltaY > 0;
    if (atMin) return; // zoomed right out: scrolling on goes to the page
    e.preventDefault();
    zoomAt(px, py, Math.pow(2, -e.deltaY * unit * 0.002));
  }
}, { passive: false });
// Safari's own pinch events
let gestureK = 1;
canvas.addEventListener("gesturestart", (e) => { e.preventDefault(); gestureK = T.k; });
canvas.addEventListener("gesturechange", (e) => {
  e.preventDefault(); if (S.view !== "map") return;
  const r = canvas.getBoundingClientRect();
  d3.select(canvas).interrupt();
  zoom.scaleTo(d3.select(canvas), gestureK * e.scale, [e.clientX - r.left, e.clientY - r.top]);
});
canvas.addEventListener("gestureend", (e) => e.preventDefault());

/* ----- hit testing ----- */
function hitTest(px, py) {
  const m = M(); if (!m) return null;
  if (S.view === "chamber") return chamberHit(m, px, py);
  if (S.view !== "map") return null;
  const b = m.booth; let bj = null, bd = Infinity;
  for (const j of m._vis || []) {
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, dd = Math.hypot(px - x, py - y);
    if (dd <= Math.max(rad(b.votes[j]) + 3, 8) && dd < bd) { bd = dd; bj = j; }
  }
  if (bj != null) return { kind: "booth", i: bj };
  const g = geoOf(m), bx = (px - T.x) / T.k, by = (py - T.y) / T.k;
  for (let i = 0; i < m.divs.length; i++) {
    const q = g.bb[i]; if (!q || bx < q[0][0] || bx > q[1][0] || by < q[0][1] || by > q[1][1]) continue;
    if (hitCtx.isPointInPath(g.paths[i], bx, by)) return { kind: "div", i };
  }
  return null;
}
