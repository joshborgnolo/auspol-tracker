/* =============================== lens values =============================== */
// the colour a seat wears: in "Now" the Winner lens reads who holds the seat today
function divValue(m, i) {
  const d = m.divs[i];
  switch (S.lens) {
    case "winner": return holdFam(d.hold);
    case "tpp": return S.tppMode === "swing" ? nn(d.tppSw) : nn(d.tpp);
    case "fp": return S.fpMode === "change" ? fpChange(m, d, S.party) : d.fp[S.party];
    case "senate": return senDivValue(m, d);
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
  // sa26's chg column is a written zero (the ECSA publishes no previous-election
  // pair to swing against): a zero isn't "no change", it's no source
  if (m.year === "sa26") return null;
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
    case "senate": return senBoothValue(m, j);
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
    // the Senate gap reads as a change does: the party's own ramp above zero, the warm grey of losses below
    case "senate": return senGap()
      ? (v >= 0 ? RAMP.fp[S.party][Math.round(clamp(v / 10, 0, 1) * 100)] : RAMP.loss[Math.round(clamp(-v / 10, 0, 1) * 100)])
      : RAMP.fp[S.party][Math.round(clamp(v / FPMAX[S.party], 0, 1) * 100)];
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
  for (const m of [...Object.values(Y), ...Object.values(SENY)]) {
    if (!m || !m.divs) continue;
    if (animate && m.divCol && !reduceMotion) { m.prevDivCol = m.divCol; m.prevBoothCol = m.boothCol; }
    else { m.prevDivCol = null; m.prevBoothCol = null; }
    if (m.house === "senate") { m.divCol = m.divs.map((d) => senateColor(m, d)); continue; }
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
// touch: a touch scroll belongs to the page where the map can't take it — on
// the chamber always, and on the map while it sits at the whole-country fit.
// Only a zoomed-in map claims finger gestures (pinch, pan) from the page.
function updateTouch() {
  const ta = S.view === "map" && T.k > HOME.k * 1.001 ? "none" : "pan-y";
  if (canvas.style.touchAction !== ta) canvas.style.touchAction = ta;
}
const zoom = d3.zoom().scaleExtent([0.5, 2600]).clickDistance(6)
  // the wheel is ours (pan on a trackpad, zoom on a mouse wheel or a pinch).
  // At the whole-country fit d3 sits touch out entirely — its preventDefault
  // on touchmove would steal the page scroll it can't use; pinch-in from
  // there is the small handler below
  .filter((e) => S.view === "map" && e.type !== "wheel" && !e.button && !(e.type === "dblclick")
    && !(e.type === "touchstart" && T.k <= HOME.k * 1.001))
  .on("start", (e) => { if (e.sourceEvent && e.sourceEvent.type === "mousedown") canvas.classList.add("grabbing"); })
  .on("zoom", (e) => { T = e.transform; schedule(); updateHint(); legendIfChanged(); updateTouch(); })
  .on("end", () => { canvas.classList.remove("grabbing"); homeFromIsland(); });
d3.select(canvas).call(zoom).on("dblclick.zoom", null);
updateTouch();

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
  const all = 0.72 * smooth(K_ALL * 0.75, K_ALL * 1.15, T.k);
  if (i === selDiv()) return Math.max(all, 0.72 * clamp((now - quietSince) / 450, 0, 1));
  return all;
}
// streetA: how strongly the streets show between the fills and the borders
// (only for the year in view; the frame passes it once per paint)
function drawGeo(m, alpha, streetA) {
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
  // the islands where they lie, past the mainland frame: their seat's colour, quieted
  // as it is; plain land in a year no seat holds one
  const isls = (m.isl || []).filter((q) => !(q.mbb[1][0] < x0 || q.mbb[0][0] > x1 || q.mbb[1][1] < y0 || q.mbb[0][1] > y1));
  for (const q of isls) {
    let c = q.owner == null ? th.nodata : fillDiv(m, q.owner);
    const qn = q.owner != null && m === M() ? quietness(q.owner, now) : 0;
    if (c && qn > 0) c = towards(c, th.bg, qn);
    ctx.fillStyle = c ? css(c) : pat; ctx.fill(q.mpath);
    if (filt && q.owner != null && !passes(m, q.owner)) { ctx.fillStyle = css(th.bg, 0.8); ctx.fill(q.mpath); }
  }
  if (streetA > 0) drawStreets(streetA);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = css(th.bg); ctx.lineWidth = Math.min(1.1, 0.35 + T.k * 0.25) / T.k; ctx.stroke(g.meshDiv);
  ctx.lineWidth = 2.2 / T.k; ctx.stroke(g.meshState);
  ctx.strokeStyle = css(th.state, 0.7); ctx.lineWidth = 0.9 / T.k; ctx.stroke(g.meshState);
  ctx.strokeStyle = css(th.coast, 0.55); ctx.lineWidth = 0.7 / T.k; ctx.stroke(g.coast);
  for (const q of isls) ctx.stroke(q.mpath);
  ctx.restore();
}

function drawFocus(m) {
  const g = geoOf(m), th = TH, sd = selDiv();
  ctx.save();
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  const [x0, y0, x1, y1] = viewBox();
  if (sd != null) {
    const v = new Path2D(); v.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); v.addPath(g.paths[sd]);
    for (const q of m.isl || []) if (q.owner === sd) v.addPath(q.mpath);
    ctx.fillStyle = css(th.bg, th.veil); ctx.fill(v, "evenodd");
  } else if (S.sel.level === "state") {
    ctx.fillStyle = css(th.bg, th.veil * 0.85);
    for (const d of m.divs) if (d.st !== S.sel.st) ctx.fill(g.paths[d.i]);
    for (const q of m.isl || []) if (q.owner == null || m.divs[q.owner].st !== S.sel.st) ctx.fill(q.mpath);
  }
  // a seat's outline takes in its islands
  const outline = (i) => { ctx.stroke(g.paths[i]); for (const q of m.isl || []) if (q.owner === i) ctx.stroke(q.mpath); };
  const h = S.hover;
  if (h && h.kind === "div" && h.i !== sd) { ctx.strokeStyle = css(th.ink, 0.9); ctx.lineWidth = 1.6 / T.k; outline(h.i); }
  if (sd != null) { ctx.strokeStyle = css(th.ink); ctx.lineWidth = 2.2 / T.k; outline(sd); }
  ctx.restore();
}

// A booth's dot. Its size is a 1,000-vote booth's radius times the square
// root of its votes over 1,000 (area true), damped to a fourth root past
// 4,000 so the biggest early-voting centres stay on the map, capped at 2.5x
// (9,800 votes). That base radius tracks how far apart the inner cities'
// booths sit on screen (BOOTH_GAP, the 2025 inner-metropolitan median
// distance to the nearest booth, in map units): small dots at city zoom,
// where the booths crowd, growing to 9px from suburb zoom in. Below city
// zoom only an opened seat's booths show, with room to spare, so the floors
// rise there and a rural seat's small booths stay visible.
const BOOTH_GAP = 0.158;
const roomy = () => 1 - smooth(K_ALL * 0.4, K_ALL * 0.9, T.k);
const dotBase = () => Math.min(9, Math.max(2.6 + 1.9 * roomy(), 0.34 * BOOTH_GAP * T.k));
const voteScale = (v) => Math.min(2.5, v <= 4000 ? Math.sqrt(v / 1000) : 2 * Math.pow(v / 4000, 0.25));
const rad = (votes) => Math.max(1.6 + 0.6 * roomy(), dotBase() * voteScale(votes));
// the paper ring that parts overlapping dots, thinner on the small ones
const halo = (r) => clamp(0.18 * r + 0.5, 0.8, 1.6);
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
    boothShape(ctx, b.ty[j], x, y, r + halo(r)); ctx.fillStyle = css(th.bg); ctx.fill();
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
  const th = TH, placed = islDrawn.map((c) => c.box), now = performance.now();
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
    const j = S.sel.booth; put(dn(b.name[j]), b.x[j] * T.k + T.x, b.y[j] * T.k + T.y - rad(b.votes[j]) - 13, 13, 600, groundOf(sd), th.ink, true);
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
    for (const c of cand) put(dn(c.d.n), c.x, c.y, c.d.i === sd ? 13.5 : 12, c.d.i === sd ? 600 : 500, groundOf(c.d.i), sd != null && c.d.i !== sd ? th.ink3 : th.ink2);
  }
  // an island where it lies: its name over its north coast once it shows (under
  // its south coast where the way back holds the top)
  for (const el of [backBtn, $("#credit")]) if (!el.hidden) placed.push([el.offsetLeft - 4, el.offsetTop - 4, el.offsetLeft + el.offsetWidth + 4, el.offsetTop + el.offsetHeight + 4]);
  for (const q of m.isl || []) {
    const x0 = q.mbb[0][0] * T.k + T.x, x1 = q.mbb[1][0] * T.k + T.x, y0 = q.mbb[0][1] * T.k + T.y, y1 = q.mbb[1][1] * T.k + T.y;
    if (x1 - x0 < 30 || x1 < 0 || x0 > Wpx || y0 > Hpx) continue;
    // clear of the island's own polling places (which stay free for their own names)
    const n0 = placed.length;
    for (const j of q.booths) { if (Number.isNaN(b.x[j])) continue; const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(b.votes[j]) + 2; placed.push([x - r, y - r, x + r, y + r]); }
    const on = put(q.name, (x0 + x1) / 2, Math.max(y0 - 13, 12), 13, 600, th.bg, th.ink2) || put(q.name, (x0 + x1) / 2, Math.min(y1 + 13, Hpx - 12), 13, 600, th.bg, th.ink2);
    placed.splice(n0, placed.length - n0 - (on ? 1 : 0));
  }
  if (m._vis && m._vis.length && T.k > K_BLAB) {
    let n = 0;
    for (const j of m._vis) {
      if (n > 120) break;
      if (S.sel.level === "booth" && j === S.sel.booth) continue;
      const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y;
      if (x < 0 || y < 0 || x > Wpx || y > Hpx) continue;
      if (put(dn(b.name[j].replace(" early voting centre", " (early)")), x, y - rad(b.votes[j]) - 9, 11, 400, groundOf(b.d[j]), sd != null && b.d[j] !== sd ? th.faint : th.ink2)) n++;
    }
  }
  // the streets' own names last, clear of every label above and every booth
  const sA = streetK();
  if (sA > 0.02 && streetDrawn.length) {
    const obst = [];
    for (const j of m._vis || []) {
      const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(b.votes[j]) + 2;
      if (x > -r && y > -r && x < Wpx + r && y < Hpx + r) obst.push([x - r, y - r, x + r, y + r]);
    }
    drawStreetNames(placed, obst, sA);
  }
  ctx.restore();
}

/* ----- the streets -----
   Esri's World_Basemap_v2 vector tiles show the streets through the seat
   fills from suburb zoom in. Each PBF tile is read once, drawn to a tile
   canvas in the palette the old grey-canvas sheets carried, and from there
   the pipeline is the raster one: Web Mercator affine-fitted through the
   conic projection, plain land taken to nothing, then multiplied on paper
   and screened on the dark page - so the seat colours stay where they were
   and only the streets, blocks and water mark them. */
const STREETS = { k0: 45, k1: 110, zMin: 3, zMax: 17, live: 12 };
// the plain land of each sheet, taken to white (paper) or black (dark page)
const STREET_LAND = { light: 239, dark: 71 };
// tile artworks render at one 256-px block per dpr step so they stay sharp
// on retina (the raster sheets were fixed 256 and blurred there); dpr is a
// boot-time value, so both read live
const tilePx = () => Math.max(256, Math.min(512, Math.round(256 * dpr)));
const streetCap = () => (tilePx() > 256 ? 220 : 360);
const SVC_T = "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile";
const streetK = () => smooth(STREETS.k0, STREETS.k1, T.k);
const tiles = new Map();
let streetCv = null, streetUse = 0, streetLive = 0;
// the tiles laid at the view's own zoom on the last paint, for the names
const streetDrawn = [];
// lon/lat to Web Mercator's unit square, and back
const merc = (ll) => { const s = Math.sin((ll[1] * Math.PI) / 180); return [(ll[0] + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]; };
const unmerc = (x, y) => [x * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI];
function tileAt(dark, z, x, y, want) {
  const key = (dark ? "d" : "l") + z + "/" + x + "/" + y;
  let t = tiles.get(key);
  if (!t && want && streetLive < STREETS.live) {
    t = { cv: null, ready: 0, failed: false, used: 0 };
    tiles.set(key, t); streetLive++;
    fetch(`${SVC_T}/${z}/${y}/${x}.pbf`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => { const pr = mvtParse(new Uint8Array(b)); t.cv = renderTile(pr, dark, z, tilePx()); t.names = pr.names; t.spots = pr.spots; t.ready = performance.now(); })
      .catch(() => { t.failed = true; })
      .finally(() => { streetLive--; schedule(); });
    if (tiles.size > streetCap()) pruneTiles();
  }
  if (t) t.used = streetUse;
  return t;
}
function pruneTiles() {
  const old = [...tiles].filter(([, t]) => (t.ready || t.failed) && t.used < streetUse).sort((a, b) => a[1].used - b[1].used);
  for (const [k] of old.slice(0, tiles.size - Math.round(streetCap() * 0.75))) tiles.delete(k);
}
/* the tile reaches us as a protobuf of layers of tagged line/polygon
   geometry (the Mapbox vector-tile layout): varint-framed fields, packed
   zig-zag coordinate deltas against a 4096 extent. mvtParse keeps only the
   layers the street sheet draws. */
const TXT = new TextDecoder();
// the label layers read for names: a road's label class to its rank (0 the
// freeways, 4 the lanes; Esri's classes as its own style sorts them), and
// the point layers that name parks and water
const ROAD_RANK = { 0: 0, 1: 0, 75: 0, 2: 1, 3: 1, 150: 1, 4: 2, 10: 3, 5: 3, 12: 4, 6: 4 };
const SPOT_OF = (n) => (n === "Park or farming/label" ? "park" : n === "Water point" || /^(Water area|Marine area|Marine waterbody)(\/| ).*label/.test(n) ? "water" : null);
function mvtParse(buf) {
  const vint = (b, st) => { let x = 0, s = 0; for (;;) { const v = b[st.i++]; x += (v & 127) * 2 ** s; s += 7; if (!(v & 128)) return x; } };
  const packed = (b) => { const st = { i: 0 }, out = []; while (st.i < b.length) out.push(vint(b, st)); return out; };
  const out = { roads: [], tuns: [], rail: [], waterL: [], fills: { urban: [], park: [], water: [] }, names: [], spots: [] };
  for (let i = 0; i <= 10; i++) { out.roads.push([]); out.tuns.push([]); }
  const FILL_OF = { "Urban area": "urban", "Park or farming": "park", "Golf course": "park", Airport: "park", Zoo: "park", "Marine area": "water", "Water area": "water" };
  const root = { i: 0 };
  while (root.i < buf.length) {
    const tag = vint(buf, root), no = tag >> 3, wire = tag & 7;
    if (wire === 2) { const n = vint(buf, root); const layer = buf.subarray(root.i, root.i + n); root.i += n; if (no === 3) mvtLayer(layer); }
    else if (wire === 0) vint(buf, root);
    else break;
  }
  return out;
  function mvtLayer(lb) {
    const st = { i: 0 };
    const L = { name: "", keys: [], valsr: [], extent: 4096, raw: [] };
    while (st.i < lb.length) {
      const tag = vint(lb, st), no = tag >> 3, wire = tag & 7;
      if (wire === 2) { const n = vint(lb, st), v = lb.subarray(st.i, st.i + n); st.i += n;
        if (no === 1) L.name = TXT.decode(v); else if (no === 2) L.raw.push(v); else if (no === 3) L.keys.push(TXT.decode(v)); else if (no === 4) L.valsr.push(v);
      } else if (wire === 0) { const n = vint(lb, st); if (no === 5) L.extent = n; }
    }
    const kind = FILL_OF[L.name], isRoad = L.name === "Road" || L.name === "Road tunnel";
    const spot = SPOT_OF(L.name);
    if (!kind && !isRoad && !spot && L.name !== "Road/label" && L.name !== "Railroad" && L.name !== "Water line") return;
    const vals = L.valsr.map((v) => {
      const vs = { i: 0 }; let o = null;
      while (vs.i < v.length) { const t = vint(v, vs), no = t >> 3, w = t & 7;
        if (w === 2) { const n = vint(v, vs); const s = v.subarray(vs.i, vs.i + n); vs.i += n; if (no === 1) o = TXT.decode(s); }
        else if (w === 0) { const n = vint(v, vs); o = no === 7 ? !!n : n; }
        else if (w === 1) vs.i += 8; else if (w === 5) vs.i += 4; }
      return o;
    });
    for (const fb of L.raw) {
      const f = { tags: [], geom: [], type: 0 };
      const fs = { i: 0 };
      while (fs.i < fb.length) { const t = vint(fb, fs), no = t >> 3, w = t & 7;
        if (w === 2) { const n = vint(fb, fs), v = fb.subarray(fs.i, fs.i + n); fs.i += n;
          if (no === 2) f.tags = packed(v); else if (no === 4) f.geom = packed(v); }
        else if (w === 0) { const v = vint(fb, fs); if (no === 3) f.type = v; } }
      const tags = {};
      for (let i = 0; i + 1 < f.tags.length; i += 2) tags[L.keys[f.tags[i]]] = vals[f.tags[i + 1]];
      const parts = decodeParts(f.geom);
      if (!parts.length) continue;
      if (kind) { out.fills[kind].push({ ext: L.extent, parts }); continue; }
      // names: a road's along its label line (route shields carry only _name - left out),
      // a park's or a water's at its label point
      if (L.name === "Road/label") {
        const name = tags._name_global;
        if (name && f.type === 2 && tags.Viz !== 3) for (const pt of parts) out.names.push({ name, rank: /\b(Lane|Place|Mews)\b/.test(name) ? 4 : ROAD_RANK[tags._label_class] ?? 3, ext: L.extent, pts: pt });
        continue;
      }
      if (spot) {
        const name = tags._name_global || tags._name;
        if (name && f.type === 1) for (const pt of parts) out.spots.push({ name, kind: spot, ext: L.extent, x: pt[0], y: pt[1] });
        continue;
      }
      if (L.name === "Railroad") { out.rail.push({ ext: L.extent, parts }); continue; }
      if (L.name === "Water line") { out.waterL.push({ ext: L.extent, parts }); continue; }
      if (tags.Viz === 3) continue; // Esri's suppression lane
      const cls = typeof tags._symbol === "number" ? tags._symbol >> 1 : -1;
      if (cls < 0 || cls > 10 || (tags._symbol & 1)) continue;
      (L.name === "Road" ? out.roads : out.tuns)[cls].push({ ext: L.extent, parts });
    }
  }
}
// command streams to flat [x0,y0,x1,y1,...] parts; rings remembered as closed
const zig = (v) => (v >> 1) ^ -(v & 1);
function decodeParts(geom) {
  const parts = []; let x = 0, y = 0, i = 0, cur = null;
  while (i < geom.length) {
    const cmd = geom[i++], id = cmd & 7, n = cmd >> 3;
    if (id === 7) { if (cur) cur.closed = true; continue; }
    for (let k = 0; k < n; k++) {
      x += zig(geom[i++]); y += zig(geom[i++]);
      if (id === 1) { cur = [x, y]; parts.push(cur); } else if (cur) cur.push(x, y);
    }
  }
  return parts;
}
/* and the sheet back out of it: grey-canvas colours measured off the raster
   sheets themselves (land exactly STREET_LAND so the land-lift still reads
   plain land), road width by class against zoom in tile-256 px */
const SHEET = {
  // (on paper the built-up tint is left out: under a multiply it greyed every
  // city seat's colour for no information the streets don't already give)
  light: { land: "#efefef", urban: "#efefef", water: "#d0cfd4", park: "#e3e8e2", line: "#ffffff", case: "#d3d4d6", tcase: "#dedfe1", tline: "#fcfcfc", rail: "#c9cacc", railBox: "#f7f7f7" },
  dark: { land: "#474749", urban: "#505052", water: "#232227", park: "#4a4c4b", line: "#666668", case: "#3a3b3d", tcase: "#434446", tline: "#5c5c5f", rail: "#5e5e60", railBox: "#383839" },
};
// fwy, hwy, fwy-ramp, major, major-ramp, minor, minor-ramp, local, service, walking, 4wd
const RW = [
  [[12, 1.0], [14, 2.8], [16, 5.5], [18, 16]], [[12, 0.9], [14, 2.6], [16, 5.0], [18, 15]],
  [[12, 0.5], [14, 1.4], [16, 2.8], [18, 8]], [[12, 0.8], [14, 2.4], [16, 4.6], [18, 13]],
  [[12, 0.5], [14, 1.2], [16, 2.4], [18, 7]], [[12, 0.6], [14, 2.0], [16, 3.8], [18, 11]],
  [[12, 0.4], [14, 1.0], [16, 2.0], [18, 6]], [[13, 0.6], [15, 1.6], [16, 2.4], [18, 9]],
  [[14, 0.6], [16, 1.6], [18, 6]], [[15, 0.8], [16, 1.2], [18, 5]], [[14, 0.5], [16, 1.2], [18, 4]],
];
const ROAD_ORDER = [10, 9, 8, 7, 6, 5, 4, 3, 1, 0, 2]; // the little roads go under the big ones
const SWT = (stops, z) => {
  if (z <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) { const [z1, w1] = stops[i], [z0, w0] = stops[i - 1]; if (z <= z1) return w0 + ((w1 - w0) * (z - z0)) / (z1 - z0); }
  return stops[stops.length - 1][1];
};
function renderTile(parsed, dark, z, px) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const g = cv.getContext("2d"), pal = dark ? SHEET.dark : SHEET.light, W256 = px / 256;
  g.lineJoin = g.lineCap = "round";
  g.fillStyle = pal.land; g.fillRect(0, 0, px, px);
  const fillParts = (bkt) => {
    const k = px / bkt.ext;
    g.beginPath();
    for (const r of bkt.parts) { g.moveTo(r[0] * k, r[1] * k); for (let i = 2; i < r.length; i += 2) g.lineTo(r[i] * k, r[i + 1] * k); g.closePath(); }
    g.fill();
  };
  const strokeParts = (bkt, w) => {
    const k = px / bkt.ext;
    g.lineWidth = w;
    g.beginPath();
    for (const r of bkt.parts) { g.moveTo(r[0] * k, r[1] * k); for (let i = 2; i < r.length; i += 2) g.lineTo(r[i] * k, r[i + 1] * k); if (r.closed) g.closePath(); }
    g.stroke();
  };
  for (const key of ["urban", "park", "water"]) { g.fillStyle = pal[key]; for (const bkt of parsed.fills[key]) fillParts(bkt); }
  if (parsed.waterL.length) { g.strokeStyle = pal.water; for (const bkt of parsed.waterL) strokeParts(bkt, Math.max(0.8 * W256, SWT([[11, 1], [14, 1.4], [17, 2.5]], z) * W256)); }
  if (parsed.rail.length) {
    g.strokeStyle = pal.railBox; for (const bkt of parsed.rail) strokeParts(bkt, SWT([[11, 1.2], [14, 1.8], [18, 3]], z) * W256);
    g.strokeStyle = pal.rail; for (const bkt of parsed.rail) strokeParts(bkt, SWT([[11, 0.7], [14, 0.9], [18, 1.2]], z) * W256);
  }
  for (const cls of ROAD_ORDER) { // tunnels first, every casing under every line
    const w = SWT(RW[cls], z); if (w <= 0) continue;
    g.strokeStyle = pal.tcase; for (const bkt of parsed.tuns[cls]) strokeParts(bkt, (w + 1.6) * W256);
  }
  for (const cls of ROAD_ORDER) {
    const w = SWT(RW[cls], z); if (w <= 0) continue;
    g.strokeStyle = pal.tline; for (const bkt of parsed.tuns[cls]) strokeParts(bkt, w * W256);
  }
  for (const cls of ROAD_ORDER) {
    const w = SWT(RW[cls], z); if (w <= 0) continue;
    g.strokeStyle = pal.case; for (const bkt of parsed.roads[cls]) strokeParts(bkt, (w + (cls <= 8 ? 1.6 : 0)) * W256);
  }
  for (const cls of ROAD_ORDER) {
    const w = SWT(RW[cls], z); if (w <= 0) continue;
    g.strokeStyle = pal.line; for (const bkt of parsed.roads[cls]) strokeParts(bkt, w * W256);
  }
  return cv;
}
// a tile's corners on the canvas, in device pixels: top-left, top-right, bottom-left, bottom-right
function tileQuad(z, x, y) {
  const n = 2 ** z, out = [];
  for (const [u, v] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) {
    const p = proj(unmerc(u / n, v / n));
    out.push([(p[0] * T.k + T.x) * dpr, (p[1] * T.k + T.y) * dpr]);
  }
  return out;
}
// an image (or the part of it at sx, sy, sw square) laid on a quad by the
// affine that best fits its four corners, half a pixel over its edges so no
// seam opens between neighbours
function drawQuad(g, img, sx, sy, sw, q, alpha) {
  const [a, b, c, d] = q;
  const B = [(b[0] - a[0] + d[0] - c[0]) / 2, (b[1] - a[1] + d[1] - c[1]) / 2];
  const C = [(c[0] - a[0] + d[0] - b[0]) / 2, (c[1] - a[1] + d[1] - b[1]) / 2];
  const o = [(a[0] + b[0] + c[0] + d[0]) / 4 - (B[0] + C[0]) / 2, (a[1] + b[1] + c[1] + d[1]) / 4 - (B[1] + C[1]) / 2];
  const e = 0.5 / Math.max(1, Math.min(Math.hypot(B[0], B[1]), Math.hypot(C[0], C[1])));
  g.globalAlpha = alpha;
  g.setTransform(B[0], B[1], C[0], C[1], o[0], o[1]);
  g.drawImage(img, sx, sy, sw, sw, -e, -e, 1 + 2 * e, 1 + 2 * e);
}
function drawStreets(alpha) {
  streetDrawn.length = 0;
  if (!proj || alpha <= 0.004) return;
  const dark = TH.dark, W = canvas.width, H = canvas.height, now = performance.now();
  streetUse++;
  const inv = (sx, sy) => merc(proj.invert([(sx - T.x) / T.k, (sy - T.y) / T.k]));
  // the zoom whose pixels match the screen's, read at the middle of the view
  const m0 = inv(Wpx / 2, Hpx / 2), m1 = inv(Wpx / 2 + 64, Hpx / 2);
  const per = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) / 64;
  // z against the tile's CSS size (256): per-tile art is tilePx() wide so the
  // 512-px artwork still meets the screen 1:1 on a dpr-2 display
  const z = clamp(Math.round(-Math.log2(per * 256) - 0.2), STREETS.zMin, STREETS.zMax), n = 2 ** z;
  // the tiles under the view: its rim carried into Mercator
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [u, v] of [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]]) {
    const p = inv(u * Wpx, v * Hpx);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  const tx0 = Math.floor(x0 * n), tx1 = Math.floor(x1 * n), ty0 = Math.floor(y0 * n), ty1 = Math.floor(y1 * n);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 400) return; // never at these zooms; a guard
  if (!streetCv) streetCv = document.createElement("canvas");
  if (streetCv.width !== W || streetCv.height !== H) { streetCv.width = W; streetCv.height = H; }
  const g = streetCv.getContext("2d"), land = dark ? STREET_LAND.dark : STREET_LAND.light;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  g.fillStyle = `rgb(${land},${land},${land})`; g.fillRect(0, 0, W, H);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const q = tileQuad(z, tx, ty);
    if (Math.max(q[0][0], q[1][0], q[2][0], q[3][0]) < 0 || Math.min(q[0][0], q[1][0], q[2][0], q[3][0]) > W
      || Math.max(q[0][1], q[1][1], q[2][1], q[3][1]) < 0 || Math.min(q[0][1], q[1][1], q[2][1], q[3][1]) > H) continue;
    const t = tileAt(dark, z, tx, ty, true);
    const f = t && t.ready ? clamp((now - t.ready) / 200, 0, 1) : 0;
    if (f < 1) {
      // until it arrives (and while it fades in): the nearest coarser tile on hand,
      // else the finer ones of the zoom just left
      let held = false;
      for (let up = 1; up <= 6 && z - up >= STREETS.zMin && !held; up++) {
        const s = 2 ** up, px = tx >> up, py = ty >> up, pt = tileAt(dark, z - up, px, py, false);
        if (pt && pt.ready) { const w = pt.cv.width / s; drawQuad(g, pt.cv, (tx - px * s) * w, (ty - py * s) * w, w, q, 1); held = true; }
      }
      if (!held && z < STREETS.zMax) for (let k = 0; k < 4; k++) {
        const cx = 2 * tx + (k & 1), cy = 2 * ty + (k >> 1), ct = tileAt(dark, z + 1, cx, cy, false);
        if (ct && ct.ready) drawQuad(g, ct.cv, 0, 0, ct.cv.width, tileQuad(z + 1, cx, cy), 1);
      }
      if (t && t.ready) needFrame = true;
    }
    if (f > 0) { drawQuad(g, t.cv, 0, 0, t.cv.width, q, f); streetDrawn.push({ t, z, tx, ty, f }); }
  }
  // the plain land to nothing: lifted to white on paper, differenced to black on the dark page
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.globalCompositeOperation = dark ? "difference" : "lighter";
  const lift = dark ? land : 255 - land;
  g.fillStyle = `rgb(${lift},${lift},${lift})`; g.fillRect(0, 0, W, H);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // on paper the streets come in at half strength over a seat's opening view
  // and reach full strength at street zoom, so a city seat still reads as its
  // colour first; on the dark page they are quiet already
  ctx.globalAlpha = alpha * (dark ? 0.85 : 0.5 + 0.5 * smooth(300, 1000, T.k));
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";
  ctx.drawImage(streetCv, 0, 0);
  ctx.restore();
}
/* the names: streets along their own line, parks and water level, read from
   the same tiles and set on the screen after the map's own labels, so a seat,
   booth or dot never gives way to one. A street's name turns with the street
   as it lies on this map, and a park's sits level - the sheet's lettering
   never rides the tile's tilt through the projection. */
// the tile zoom each road rank is named from: nothing at a seat's opening
// view (z13 for a city seat), where the booths' names already fill it
const NAME_Z = [14, 14, 15, 15, 17];
const NAME_GAP = 240; // px between two labels of one name
function tileLabels(e) {
  const t = e.t;
  if (t.lab) return t.lab;
  const n = 2 ** e.z, at = (px, py, ext) => proj(unmerc((e.tx + px / ext) / n, (e.ty + py / ext) / n));
  const roads = (t.names || []).map((r) => {
    const q = new Float64Array(r.pts.length);
    for (let i = 0; i < r.pts.length; i += 2) { const p = at(r.pts[i], r.pts[i + 1], r.ext); q[i] = p[0]; q[i + 1] = p[1]; }
    return { name: r.name, rank: r.rank, q };
  });
  const spots = (t.spots || []).map((s) => { const p = at(s.x, s.y, s.ext); return { name: s.name, kind: s.kind, x: p[0], y: p[1] }; });
  return (t.lab = { roads, spots });
}
function drawStreetNames(placed, obst, alpha) {
  if (!proj || alpha <= 0.02 || !streetDrawn.length) return;
  const th = TH, dark = th.dark, z = streetDrawn[0].z, seen = new Map();
  const hits = (r) => { for (const q of placed) if (!(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3])) return true; for (const q of obst) if (!(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3])) return true; return false; };
  const near = (name, x, y) => { const l = seen.get(name); if (!l) return false; for (const [a, b] of l) if (Math.hypot(a - x, b - y) < NAME_GAP) return true; return false; };
  const note = (name, x, y) => { if (!seen.has(name)) seen.set(name, []); seen.get(name).push([x, y]); };
  const roads = [], spots = [];
  for (const e of streetDrawn) {
    const lab = tileLabels(e);
    for (const r of lab.roads) if (z >= NAME_Z[r.rank]) roads.push({ r, f: e.f });
    for (const s of lab.spots) spots.push({ s, f: e.f });
  }
  roads.sort((a, b) => a.r.rank - b.r.rank || b.r.q.length - a.r.q.length);
  ctx.lineJoin = "round"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const ink = css(th.ink3), halo = dark ? "rgba(0,0,0,0.4)" : css(th.bg, 0.8);
  const draw = (txt, x, y, ang, f) => {
    ctx.save();
    ctx.globalAlpha = alpha * f;
    ctx.translate(x, y); if (ang) ctx.rotate(ang);
    ctx.lineWidth = 2.6; ctx.strokeStyle = halo; ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = ink; ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  // a street: the straightest run of its line at its middle (or a third of the
  // way either side) long enough for the name, the text turned to it and kept
  // reading left to right; its room is a row of squares along it
  let n = 0;
  for (const { r, f } of roads) {
    if (n >= 48) break;
    ctx.font = `${r.rank <= 1 ? 600 : 500} ${r.rank <= 1 ? 10.5 : 10}px ${SANS}`;
    const w = ctx.measureText(r.name).width, h = 12, q = r.q, m = q.length / 2;
    if (m < 2) continue;
    const X = new Float64Array(m), Yp = new Float64Array(m), L = new Float64Array(m);
    for (let i = 0; i < m; i++) { X[i] = q[2 * i] * T.k + T.x; Yp[i] = q[2 * i + 1] * T.k + T.y; if (i) L[i] = L[i - 1] + Math.hypot(X[i] - X[i - 1], Yp[i] - Yp[i - 1]); }
    const len = L[m - 1];
    if (len < w + 16) continue;
    const ptAt = (d) => { let i = 1; while (i < m - 1 && L[i] < d) i++; const u = (d - L[i - 1]) / (L[i] - L[i - 1] || 1); return [X[i - 1] + (X[i] - X[i - 1]) * u, Yp[i - 1] + (Yp[i] - Yp[i - 1]) * u]; };
    for (const at of [0.5, 0.3, 0.7]) {
      const c = len * at; if (c - w / 2 < 0 || c + w / 2 > len) continue;
      const a = ptAt(c - w / 2), b = ptAt(c + w / 2);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < w * 0.96) continue;
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      if (cx < 4 || cy < 4 || cx > Wpx - 4 || cy > Hpx - 4) continue;
      if (near(r.name, cx, cy)) break;
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
      const k = Math.max(1, Math.ceil(w / h)), boxes = [];
      for (let j = 0; j < k; j++) { const d = ((j + 0.5) / k - 0.5) * w, x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d; boxes.push([x - h / 2, y - h / 2, x + h / 2, y + h / 2]); }
      if (boxes.some((bx) => bx[0] < 2 || bx[1] < 2 || bx[2] > Wpx - 2 || bx[3] > Hpx - 2 || hits(bx))) continue;
      placed.push(...boxes); note(r.name, cx, cy); n++;
      draw(r.name, cx, cy, ang, f);
      break;
    }
  }
  // parks and water: level, italic, from the same zoom as the minor roads
  if (z >= NAME_Z[2]) for (const { s, f } of spots) {
    const x = s.x * T.k + T.x, y = s.y * T.k + T.y;
    if (x < 0 || y < 0 || x > Wpx || y > Hpx || near(s.name, x, y)) continue;
    ctx.font = `italic ${s.kind === "water" ? 500 : 400} 10.5px ${SANS}`;
    const w = ctx.measureText(s.name).width, bx = [x - w / 2 - 2, y - 7, x + w / 2 + 2, y + 7];
    if (bx[0] < 2 || bx[2] > Wpx - 2 || bx[1] < 2 || bx[3] > Hpx - 2 || hits(bx)) continue;
    placed.push(bx); note(s.name, x, y);
    draw(s.name, x, y, 0, f);
  }
}
let creditOn = false;
function showCredit(on) {
  if (on === creditOn) return;
  creditOn = on; $("#credit").hidden = !on;
}

/* ----- the islands -----
   Norfolk, Lord Howe, Christmas and the Cocos (Keeling) Islands lie hundreds
   to thousands of km past the mainland frame the seats are clipped to, so
   each is drawn in a box of its own, north up at its own scale, the way
   printed maps inset them. At the country view a box sits in the sea on its
   own side of the continent (the Indian Ocean pair off the north-west, the
   Tasman pair off the south-east) and moves with the map. When the selection
   holds its seat (Bean, Sydney or Lingiari, or their state) the box docks,
   larger, beside the seat in room the fit keeps clear, with its polling
   places drawn and live; it glides between the two, and fades as the reader
   zooms well past the docked fit. A box is a way there, too: a click on it,
   or zooming in on it, flies the map out to the island where it lies, coast,
   streets and polling places at any zoom, with a way back to its seat; the
   box itself steps aside while the island shows. */
// the boxes at sea go in two pairs, each a diagonal as the islands lie (Christmas
// north-east of Cocos, Norfolk north-east of Lord Howe), the pair's middle at a
// fraction of the home box: in the sea inside it where the stage is wider than
// the map (side), else in the room the stage leaves above and below the map
// (stacked) - off the north-west and south-east coasts either way
const ISL_PAIRS = [["christmas", "cocos"], ["norfolk", "lordhowe"]];
const ISL_AT = { side: [[0.14, 0.145], [1.015, 0.78]], stacked: [[0.2, -0.15], [0.86, 1.07]] };
const ISL_SHORT = { cocos: "Cocos Islands" };
// the caption's line under a box at sea, and its band inside a docked box; the room between docked boxes
const ISL_CAP = 15, ISL_DCAP = 20, ISL_GAP = 10;
const islSea = () => clamp(HOME.k * 96, 42, 64);
const islDock = () => (isPhone() ? 92 : 124);
let dock = null; // { side: "left" | "bottom", k }: the docked fit fitSelection last made, else null
const islAnim = new Map();
let islDrawn = [];
// the island the camera is out at (its key), else null: only then does the pan reach past the mainland frame
let away = null;
const islOf = (m, key) => (m && m.isl ? m.isl.find((q) => q.key === key) || null : null);
// the island the selection is out at: one opened by name, or the island of a chosen polling place
function selIsland() {
  const m = M(); if (!m || !m.isl) return null;
  if (S.sel.isl) return islOf(m, S.sel.isl);
  if (S.sel.level === "booth" && m.booth.isl[S.sel.booth] >= 0) return m.isl[m.booth.isl[S.sel.booth]];
  return null;
}
// out to an island: its seat opened (an island in no seat that year opens alone)
function goIsland(key, o) {
  const m = M(), q = islOf(m, key); if (!q) return;
  const i = q.seat;
  select(i != null ? { level: "div", st: m.divs[i].st, div: i, isl: key } : { level: "aus", isl: key }, { dur: 1300, ...o });
}
// on screen as land, big enough to read: its box then steps aside
const islShows = (q) => { const x0 = q.mbb[0][0] * T.k + T.x, x1 = q.mbb[1][0] * T.k + T.x, y0 = q.mbb[0][1] * T.k + T.y, y1 = q.mbb[1][1] * T.k + T.y; return x1 - x0 > 30 && x1 > 0 && x0 < Wpx && y1 > 0 && y0 < Hpx; };
// the islands the selection holds: its seat's, or (a state) its seats'
function heldIslands(m) {
  if (!m || !m.isl) return [];
  const sd = selDiv();
  if (selIsland()) return [];
  if (sd != null) return m.isl.filter((s) => s.seat === sd);
  if (S.sel.level === "state") return m.isl.filter((s) => s.seat != null && m.divs[s.seat].st === S.sel.st);
  return [];
}
// docked boxes: a column up from the stage's foot at its left, or a row along the foot
function dockRects(n, side) {
  const p = stagePads(), D = islDock(), out = [];
  for (let i = 0; i < n; i++) {
    const h = D + ISL_DCAP;
    if (side === "left") out.push({ x: p.l, y: Hpx - p.b - h - (n - 1 - i) * (h + ISL_GAP), w: D, h });
    else out.push({ x: p.l + i * (D + ISL_GAP), y: Hpx - p.b - h, w: D, h });
  }
  return out;
}
// the fit of a selection that holds islands keeps their docked boxes clear,
// in a column at the left or a row along the foot, whichever leaves the seat larger
function dockedFit(box, n) {
  const D = islDock(), p = stagePads(), opts = [];
  if (n * (D + ISL_DCAP) + (n - 1) * ISL_GAP <= Hpx - p.t - p.b) opts.push(["left", fitTransform(box, 0, { l: D + ISL_GAP + 4 })]);
  if (n * D + (n - 1) * ISL_GAP <= Wpx - p.l - p.r) opts.push(["bottom", fitTransform(box, 0, { b: D + ISL_DCAP + ISL_GAP })]);
  if (!opts.length) return { t: fitTransform(box), side: null };
  opts.sort((a, b) => b[1].k - a[1].k);
  return { t: opts[0][1], side: opts[0][0] };
}
// each box's centre at the country fit, in stage px: a pair's two boxes a box
// and a caption apart down the diagonal, the pair shifted whole onto the stage
// (captions and all) and below the cities and the hint over its top. The
// stacked places once the stage leaves the pair room above the map
// (the hint empties and the cities hide once a seat is chosen, so their foot is
// measured while they show and remembered for the stage's width)
let seaMemo = null, seaTop = { w: 0, top: 4 };
function seaSpots(m, hb, A, p) {
  const cities = $("#cities"), hint = $("#hint");
  if (cities && !cities.hidden && hint && hint.textContent) {
    const st = $("#stage").getBoundingClientRect();
    let top = 4;
    for (const el of [cities, hint]) if (el.offsetHeight) top = Math.max(top, el.getBoundingClientRect().bottom - st.top + 6);
    seaTop = { w: Wpx, top };
  }
  const top = seaTop.w === Wpx ? seaTop.top : isPhone() ? 4 : p.t + 22;
  const memo = [m.year, Wpx, Hpx, HOME.k, HOME.x, HOME.y, top].join();
  if (seaMemo && seaMemo.memo === memo) return seaMemo.out;
  const room = Hpx - p.t - p.b - (hb[1][1] - hb[0][1]) * HOME.k, at = ISL_AT[room >= 2 * (A + ISL_CAP + 8) ? "stacked" : "side"];
  const dx = A * 0.62, dy = (A + ISL_CAP) / 2 + 4, out = {};
  ctx.font = `400 10.5px ${SANS}`;
  ISL_PAIRS.forEach(([ne, sw], k) => {
    const f = at[k], mx = (hb[0][0] + f[0] * (hb[1][0] - hb[0][0])) * HOME.k + HOME.x, my = (hb[0][1] + f[1] * (hb[1][1] - hb[0][1])) * HOME.k + HOME.y;
    const c = { [ne]: [mx + dx, my - dy], [sw]: [mx - dx, my + dy] };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const key of [ne, sw]) {
      const isl = m.isl.find((q) => q.key === key), name = ISL_SHORT[key] || (isl ? isl.name : "");
      const [x, y] = c[key], half = Math.max(A, ctx.measureText(name).width + 6) / 2;
      x0 = Math.min(x0, x - half); x1 = Math.max(x1, x + half); y0 = Math.min(y0, y - A / 2); y1 = Math.max(y1, y + A / 2 + ISL_CAP);
    }
    const sx = x0 < 4 ? 4 - x0 : x1 > Wpx - 4 ? Wpx - 4 - x1 : 0, sy = y0 < top ? top - y0 : y1 > Hpx - 4 ? Hpx - 4 - y1 : 0;
    for (const key of [ne, sw]) out[key] = [c[key][0] + sx, c[key][1] + sy];
  });
  seaMemo = { memo, out };
  return out;
}
function islandCards(m) {
  if (!m.isl || !m.isl.length || !Wpx) return [];
  const held = heldIslands(m), now = performance.now(), out = [], A = islSea(), hb = homeBox(m), p = stagePads();
  const docked = dock && held.length ? dockRects(held.length, dock.side) : null;
  const sea = seaSpots(m, hb, A, p);
  const dockA = dock ? 1 - smooth(2.2, 3.6, T.k / dock.k) : 1;
  for (const s of m.isl) {
    if (away === s.key || islShows(s)) { islAnim.delete(s.key); continue; } // back without a glide
    const hi = docked ? held.indexOf(s) : -1, mode = hi >= 0 ? "dock" : "sea";
    let r;
    if (hi >= 0) r = docked[hi];
    else {
      // placed at the country fit and carried by the map from there
      const [hx, hy] = sea[s.key] || [Wpx / 2, Hpx / 2];
      const cx = ((hx - HOME.x) / HOME.k) * T.k + T.x, cy = ((hy - HOME.y) / HOME.k) * T.k + T.y;
      r = { x: cx - A / 2, y: cy - A / 2, w: A, h: A };
    }
    // the glide between the sea and the dock, from no further out than just off the stage
    let a = islAnim.get(s.key);
    if (!a || a.mode !== mode) {
      const l = a && a.last;
      a = { mode, t0: now, from: l && !reduceMotion ? { ...l, x: clamp(l.x, -l.w, Wpx), y: clamp(l.y, -l.h, Hpx) } : null };
      islAnim.set(s.key, a);
    }
    if (a.from) {
      const u = clamp((now - a.t0) / 650, 0, 1), e = ease(u);
      if (u < 1) { needFrame = true; r = { x: lerp(a.from.x, r.x, e), y: lerp(a.from.y, r.y, e), w: lerp(a.from.w, r.w, e), h: lerp(a.from.h, r.h, e) }; }
      else a.from = null;
    }
    a.last = r;
    const alpha = mode === "dock" ? dockA : 1;
    if (alpha <= 0.01 || r.x > Wpx || r.y > Hpx || r.x + r.w < 0 || r.y + r.h + ISL_CAP < 0) continue;
    out.push({ s, r, docked: mode === "dock", alpha });
  }
  return out;
}
function drawIslands(m, alpha = 1) {
  const cards = islandCards(m);
  islDrawn = [];
  if (!cards.length) return;
  const th = TH, sd = selDiv(), b = m.booth, now = performance.now(), pat = hatch();
  const rf = S.f.range && S.listUnit === "booths" ? S.f.range : null;
  ctx.save();
  ctx.lineJoin = "round";
  for (const c of cards) {
    const { s, r } = c, a = alpha * c.alpha, own = s.owner;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = a;
    // the box: paper over whatever lies under it, a hairline frame
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 3); else ctx.rect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.fillStyle = css(th.bg); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = css(th.ink3, 0.32); ctx.stroke();
    // the island, north up, filling the box less a margin; its seat's colour,
    // quieted, veiled and filtered as the map's own shapes are (an island in no
    // seat that year is plain land)
    // (a docked box's name heads it, so the island sits under that band)
    const pad = c.docked ? 9 : Math.max(4, r.w * 0.09), top = c.docked ? ISL_DCAP - 4 : 0;
    const k = Math.min((r.w - 2 * pad) / s.w, (r.h - top - 2 * pad) / s.h);
    const ox = r.x + (r.w - s.w * k) / 2, oy = r.y + top + (r.h - top - s.h * k) / 2;
    const places = c.docked && sd != null && s.seat === sd && s.booths.length > 0;
    let col = own == null ? th.nodata : fillDiv(m, own);
    if (col && own != null) {
      if (own === sd) col = towards(col, th.bg, quietness(own, now));
      if (sd != null && own !== sd) col = towards(col, th.bg, th.veil);
      else if (S.sel.level === "state" && m.divs[own].st !== S.sel.st) col = towards(col, th.bg, th.veil * 0.85);
      if (filtersOn() && !passes(m, own)) col = towards(col, th.bg, 0.8);
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); ctx.clip();
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    if (col) ctx.fillStyle = css(col);
    else { pat.setTransform(new DOMMatrix().scale(1 / (dpr * k))); ctx.fillStyle = pat; }
    ctx.fill(s.path);
    ctx.strokeStyle = css(th.coast, 0.55); ctx.lineWidth = 0.7 / k; ctx.stroke(s.path);
    const hov = own != null && S.hover && S.hover.kind === "div" && S.hover.i === own;
    if (own != null && (own === sd || hov)) { ctx.strokeStyle = css(th.ink, own === sd ? 1 : 0.9); ctx.lineWidth = (own === sd ? 1.8 : 1.4) / k; ctx.stroke(s.path); }
    ctx.restore();
    // the polling places, biggest first; two at one spot (a polling place and
    // its early-voting centre) sit side by side
    const dots = [];
    if (places) {
      for (const j of s.booths.slice().sort((p, q) => b.votes[q] - b.votes[p])) {
        const rr = clamp(3.4 * voteScale(b.votes[j]), 2.6, 8);
        let x = ox + (b.raw.lon[j] - s.lon0) * s.cos * k, y = oy + (s.lat1 - b.raw.lat[j]) * k;
        for (const d of dots) if (Math.hypot(d.x - x, d.y - y) < d.r + rr) x = d.x + d.r + rr + 2;
        dots.push({ j, x: clamp(x, r.x + rr + 3, r.x + r.w - rr - 3), y: clamp(y, r.y + rr + 3, r.y + r.h - rr - 3), r: rr });
      }
      pat.setTransform(new DOMMatrix().scale(1 / dpr));
      for (const d of dots) {
        ctx.globalAlpha = a * (rf && !inRange(boothColValue(m, d.j, rf.key), rf) ? 0.2 : 1);
        boothShape(ctx, b.ty[d.j], d.x, d.y, d.r + halo(d.r)); ctx.fillStyle = css(th.bg); ctx.fill();
        const bc = fillBooth(m, d.j);
        boothShape(ctx, b.ty[d.j], d.x, d.y, d.r); ctx.fillStyle = bc ? css(bc) : pat; ctx.fill();
      }
      ctx.globalAlpha = a;
      for (const d of dots) {
        const on = S.sel.level === "booth" && S.sel.booth === d.j, hv = S.hover && S.hover.kind === "booth" && S.hover.i === d.j;
        if (on || hv) { boothShape(ctx, b.ty[d.j], d.x, d.y, d.r + 2.4); ctx.lineWidth = on ? 2.4 : 1.6; ctx.strokeStyle = css(th.ink); ctx.stroke(); }
      }
    }
    // the name: heading a docked box, under a box at sea
    ctx.textBaseline = "middle";
    if (c.docked) {
      ctx.font = `500 11px ${SANS}`;
      const name = ctx.measureText(s.name).width > r.w - 16 && ISL_SHORT[s.key] ? ISL_SHORT[s.key] : s.name;
      ctx.textAlign = "left"; ctx.fillStyle = css(th.ink2); ctx.fillText(name, r.x + 8, r.y + 12);
      islDrawn.push({ s, r, dots, box: [r.x, r.y, r.x + r.w, r.y + r.h] });
    } else {
      const name = ISL_SHORT[s.key] || s.name, cx = r.x + r.w / 2, cy = r.y + r.h + 8.5;
      ctx.font = `400 10.5px ${SANS}`; ctx.textAlign = "center";
      ctx.lineWidth = 2.6; ctx.strokeStyle = css(th.bg, 0.85); ctx.strokeText(name, cx, cy);
      ctx.fillStyle = css(th.ink3); ctx.fillText(name, cx, cy);
      const tw = ctx.measureText(name).width / 2 + 3;
      islDrawn.push({ s, r, dots, box: [Math.min(r.x, cx - tw), r.y, Math.max(r.x + r.w, cx + tw), cy + 7] });
    }
  }
  ctx.restore();
}

/* ----- framing ----- */
function stagePads() {
  const phone = isPhone();
  return { t: phone ? 12 : 36, b: phone ? 12 : 18, l: phone ? 8 : 12, r: phone ? 44 : 50 };
}
// res: room kept clear at the stage's left (l) or foot (b), for docked island
// boxes, or its top (t), for the way back from an island and its name
function fitTransform(bb, maxK, res) {
  const p = stagePads();
  if (res) { p.l += res.l || 0; p.b += res.b || 0; p.t += res.t || 0; }
  const [[x0, y0], [x1, y1]] = bb;
  const w = Math.max(x1 - x0, 0.05), h = Math.max(y1 - y0, 0.05);
  const k = Math.min((Wpx - p.l - p.r) / w, (Hpx - p.t - p.b) / h, maxK || 2400);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return d3.zoomIdentity.translate(p.l + (Wpx - p.l - p.r) / 2 - cx * k, p.t + (Hpx - p.t - p.b) / 2 - cy * k).scale(k);
}
function unionBB(list) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const b of list) { if (!b) continue; x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); } return [[x0, y0], [x1, y1]]; }
function homeBox(m) {
  const b = unionBB(m.geo.bb);
  // sa26's whole-state home view sits 8% further out (user calls 2026-10-26):
  // the districts fill the frame a touch tighter than the federal elections read
  if (m.year === "sa26") {
    const [[x0, y0], [x1, y1]] = b, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, z = 1.08;
    return [[cx + (x0 - cx) * z, cy + (y0 - cy) * z], [cx + (x1 - cx) * z, cy + (y1 - cy) * z]];
  }
  return b;
}
// the map may pan anywhere inside the frame of the whole-country view, and no
// further out: at that zoom nothing moves, so a scroll there scrolls the page
function setExtent() {
  const m = M(); if (!m || !Wpx) return;
  // outside the map view the transform always rides the whole-country fit:
  // the insets grow the box after the first draw, and a transform pinned to
  // the early smaller box would later open the map on the north-west corner
  const rides = S.view !== "map";
  HOME = fitTransform(homeBox(m));
  // (out at an island, the frame stretches to take it in, some way of sea around it)
  let [[ex0, ey0], [ex1, ey1]] = [[-HOME.x / HOME.k, -HOME.y / HOME.k], [(Wpx - HOME.x) / HOME.k, (Hpx - HOME.y) / HOME.k]];
  const q = islOf(m, away);
  if (q) { const pad = 12; ex0 = Math.min(ex0, q.mbb[0][0] - pad); ey0 = Math.min(ey0, q.mbb[0][1] - pad); ex1 = Math.max(ex1, q.mbb[1][0] + pad); ey1 = Math.max(ey1, q.mbb[1][1] + pad); }
  zoom.translateExtent([[ex0, ey0], [ex1, ey1]])
    .scaleExtent([HOME.k, 2600]).extent([[0, 0], [Wpx, Hpx]]);
  if (rides) { lastFit = HOME; d3.select(canvas).call(zoom.transform, HOME); }
  updateTouch();
}
function selectionBox() {
  const m = M(), g = m.geo;
  if (S.sel.isl && S.sel.level !== "booth") { const q = islOf(m, S.sel.isl); if (q) return q.mbb; }
  switch (S.sel.level) {
    case "aus": return homeBox(m);
    case "state": return unionBB(m.areas[S.sel.st].idx.map((i) => g.bb[i]));
    case "div": return g.bb[S.sel.div];
    case "booth": {
      const b = m.booth, j = S.sel.booth;
      if (Number.isNaN(b.x[j])) return g.bb[S.sel.div];
      const ik = b.isl[j], k0 = fitTransform(ik >= 0 ? m.isl[ik].mbb : g.bb[S.sel.div]).k;
      const k = clamp(k0 * 1.7, 80, 900), half = Math.min(Wpx, Hpx) / k / 2;
      return [[b.x[j] - half, b.y[j] - half], [b.x[j] + half, b.y[j] + half]];
    }
  }
}
// the last view the page framed by itself, to tell it from one the reader has moved
let lastFit = null;
const atLastFit = () => lastFit && Math.abs(T.k / lastFit.k - 1) < 0.01 && Math.hypot(T.x - lastFit.x, T.y - lastFit.y) < 2;
// the page's own flight to a fit, while it lasts: its redo frames it again. A
// first seat chosen from the country view grows the key mid-flight, and the
// stage's resize must take that for the page's view, not one the reader moved
let flight = null;
function fly(t, dur, redo) {
  const s = d3.select(canvas), me = { redo, isl: away };
  flight = me;
  s.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, t)
    .on("end.flight interrupt.flight", () => { if (flight === me) flight = null; });
}
function fitSelection(dur, force) {
  if (!M() || !Wpx || (S.view !== "map" && !force)) return;
  const q = selIsland();
  if ((q ? q.key : null) !== away) { away = q ? q.key : null; setExtent(); }
  const n = heldIslands(M()).length;
  let t;
  if (n) { const f = dockedFit(selectionBox(), n); t = f.t; dock = f.side ? { side: f.side, k: t.k } : null; }
  else { t = fitTransform(selectionBox(), 0, q && S.sel.level !== "booth" ? { t: isPhone() ? 64 : 46 } : null); dock = null; }
  lastFit = t;
  const s = d3.select(canvas);
  if (!dur || reduceMotion) { flight = null; s.interrupt(); s.call(zoom.transform, t); }
  else fly(t, dur, () => fitSelection(Math.min(dur, 320)));
}
function flyToCity(k) {
  const [, st, ll] = CITIES[k];
  const a = proj(ll[0]), b = proj(ll[1]);
  // a year whose jurisdiction holds no seats there (sa26: South Australia only,
  // so Adelaide alone flies)
  if (!M() || !M().areas[st]) return;
  select({ level: "state", st }, { fly: false });
  dock = null; // a city's view keeps no room for its state's islands
  const go = (dur) => {
    const t = fitTransform([[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]]);
    lastFit = t;
    if (reduceMotion) { flight = null; d3.select(canvas).call(zoom.transform, t); } else fly(t, dur, () => go(320));
  };
  go(900);
}
// zoomed right out from an island, the reader is home: the selection keeps its
// seat but leaves the island, and the frame shrinks back to the mainland's
function homeFromIsland() {
  if (!away || flight || T.k > HOME.k * 1.02) return;
  const m = M(), s = S.sel;
  away = null;
  if (s.isl) { const { isl, ...rest } = s; select(rest, { fly: false }); }
  else if (s.level === "booth" && m.booth.isl[s.booth] >= 0) select({ level: "div", st: s.st, div: s.div }, { fly: false });
  setExtent();
  lastFit = HOME;
  d3.select(canvas).transition().duration(reduceMotion ? 0 : 300).call(zoom.transform, HOME);
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
  // zooming in on an island's box flies out to the island; the flight takes no wheel
  if (flight && flight.isl) { e.preventDefault(); return; }
  if (e.deltaY < 0 && (e.ctrlKey || e.deltaMode !== 0 || wheelMode === "zoom" || (!wheelMode && classifyWheel(e) === "zoom"))) {
    const c = islDrawn.find((q) => px >= q.r.x && px <= q.r.x + q.r.w && py >= q.r.y && py <= q.r.y + q.r.h);
    if (c) { e.preventDefault(); goIsland(c.s.key); return; }
  }
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
// pinch-in from the whole-country fit, where d3's touch sits out so a lone
// finger scrolls the page: two fingers still zoom the map
let homePinch = null;
canvas.addEventListener("touchstart", (e) => {
  if (S.view !== "map" || T.k > HOME.k * 1.001) return;
  if (e.touches.length !== 2) { homePinch = null; return; }
  // from the second finger on, the gesture is the map's: cancel the page
  // actions up front or the first move under touch-action: pan-y can start a
  // scroll the touchmove preventDefault then can't take back
  if (e.cancelable) e.preventDefault();
  const p = e.touches[0], q = e.touches[1];
  homePinch = { d: Math.hypot(p.clientX - q.clientX, p.clientY - q.clientY), k: T.k };
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  if (!homePinch || S.view !== "map" || e.touches.length !== 2) return;
  const p = e.touches[0], q = e.touches[1];
  const d = Math.hypot(p.clientX - q.clientX, p.clientY - q.clientY);
  if (!d || !homePinch.d) return;
  if (e.cancelable) e.preventDefault();
  const r = canvas.getBoundingClientRect(), mx = (p.clientX + q.clientX) / 2 - r.left, my = (p.clientY + q.clientY) / 2 - r.top;
  d3.select(canvas).interrupt();
  zoom.scaleTo(d3.select(canvas), homePinch.k * d / homePinch.d, [mx, my]);
}, { passive: false });
canvas.addEventListener("touchend", (e) => { if (e.touches.length < 2) homePinch = null; });
canvas.addEventListener("touchcancel", () => { homePinch = null; });
// a swipe anywhere in the map figure — the canvas, its overlays, the
// timeline, the story — cycles the years: on the chamber always, on the map
// at the whole-country fit (a zoomed-in map pans instead). Native controls
// keep their own gestures (zoom and city buttons, form fields, links), and
// the list view's own rows
swipeWatch($(".mp-fig"), (dir, y) => { if (S.view === "chamber" || (S.view === "map" && T.k <= HOME.k * 1.001)) { walkAim(y); walkYear(dir, true); } }, (t) => !t.closest("button, a, input, select, textarea, .mp-list"));
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
  if (S.view === "chamber") { const c = CM(); return c ? chamberHit(c, px, py) : null; }
  if (S.view !== "map") return null;
  // an island's box is on top of the map: its places, else its seat (an island in no seat is nobody's)
  for (let k = islDrawn.length - 1; k >= 0; k--) {
    const c = islDrawn[k], r = c.r;
    if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) continue;
    let cj = null, cd = Infinity;
    for (const d of c.dots) { const dd = Math.hypot(px - d.x, py - d.y); if (dd <= Math.max(d.r + 3, 8) && dd < cd) { cd = dd; cj = d.j; } }
    if (cj != null) return { kind: "booth", i: cj };
    return c.s.owner != null ? { kind: "div", i: c.s.owner, isl: c.s.name, go: c.s.key } : { kind: "isl", go: c.s.key, isl: c.s.name };
  }
  const b = m.booth; let bj = null, bd = Infinity;
  for (const j of m._vis || []) {
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, dd = Math.hypot(px - x, py - y);
    if (dd <= Math.max(rad(b.votes[j]) + 3, 8) && dd < bd) { bd = dd; bj = j; }
  }
  if (bj != null) return { kind: "booth", i: bj };
  const g = geoOf(m), bx = (px - T.x) / T.k, by = (py - T.y) / T.k;
  for (const q of m.isl || []) {
    const r = q.mbb; if (q.owner == null || bx < r[0][0] || bx > r[1][0] || by < r[0][1] || by > r[1][1]) continue;
    if (hitCtx.isPointInPath(q.mpath, bx, by)) return { kind: "div", i: q.owner, isl: q.name };
  }
  for (let i = 0; i < m.divs.length; i++) {
    const q = g.bb[i]; if (!q || bx < q[0][0] || bx > q[1][0] || by < q[0][1] || by > q[1][1]) continue;
    if (hitCtx.isPointInPath(g.paths[i], bx, by)) return { kind: "div", i };
  }
  return null;
}
