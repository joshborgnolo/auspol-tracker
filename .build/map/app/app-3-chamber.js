/* =============================== the chamber ===============================
   The House of Representatives as it sits: a horseshoe opening to the
   Speaker's chair, the government on the Speaker's right (the reader's left,
   the Speaker facing down the page), the opposition across the table, the
   crossbench round the curve. Each member is a chair. Inside each bloc the
   chairs are ordered by the lens, strongest at the Speaker's end, so on the
   two-party lens the House reads as a pendulum bent round the table: the
   seats that would fall first sit nearest the crossbench. The Speaker's own
   seat takes the Speaker's chair. */
const CH = { rows: 5, g: 1.22, r0: 3.55, Ls: 7.4 };
const chGeomCache = new Map();
function chamberGeom(n) {
  if (chGeomCache.has(n)) return chGeomCache.get(n);
  const { rows, g, r0, Ls } = CH;
  const radii = Array.from({ length: rows }, (_, i) => r0 + i * g);
  const lens = radii.map((r) => 2 * Ls + Math.PI * r);
  const tot = sum(lens);
  // seats per row in proportion to the row's length, largest remainders
  const raw = lens.map((L) => (n * L) / tot);
  const cnt = raw.map(Math.floor);
  let left = n - sum(cnt);
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => cnt[i]++);
  const rMid = radii[Math.floor(rows / 2)], a = Ls / (2 * Ls + Math.PI * rMid);
  const seats = [];
  radii.forEach((r, i) => {
    const L = lens[i], k = cnt[i];
    for (let q = 0; q < k; q++) {
      const s = ((q + 0.5) * L) / k;
      let x, y, fa, u;
      if (s <= Ls) { x = -r; y = s; fa = 0; u = a * (y / Ls); }
      else if (s <= Ls + Math.PI * r) { const phi = Math.PI - (s - Ls) / r; x = r * Math.cos(phi); y = Ls + r * Math.sin(phi); fa = phi + Math.PI; u = a + (1 - 2 * a) * ((Math.PI - phi) / Math.PI); }
      else { x = r; y = Ls - (s - Ls - Math.PI * r); fa = Math.PI; u = 1 - a * (y / Ls); }
      seats.push({ x, y, fa, u, row: i, pitch: L / k });
    }
  });
  seats.sort((p, q) => p.u - q.u || p.row - q.row);
  const rOut = radii[rows - 1];
  const geom = { n, seats, radii, rOut, Ls, a, pitch: tot / n,
    box: { x0: -rOut - 0.75, x1: rOut + 0.75, y0: -3.1, y1: Ls + rOut + 0.75 } };
  chGeomCache.set(n, geom);
  return geom;
}

function uPoint(geom, u, r) {
  const a = geom.a, Ls = geom.Ls;
  if (u <= a) return [-r, (u / a) * Ls];
  if (u >= 1 - a) return [r, ((1 - u) / a) * Ls];
  const phi = Math.PI - ((u - a) / (1 - 2 * a)) * Math.PI; return [r * Math.cos(phi), Ls + r * Math.sin(phi)];
}
// blocs, in the order they sit from the Speaker's right round to the left
function chamberBlocs(m) {
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp";
  const cross = gov === "alp" ? ["grn", "ind", "oth", "onp"] : ["onp", "oth", "ind", "grn"];
  return { gov, opp, cross };
}
// the lens's ordering key, read from the bloc's own side
function chamberKey(m, d, bloc) {
  const own = (v) => (v == null ? null : bloc === "lnp" ? 100 - v : v);
  switch (S.lens) {
    case "tpp":
      if (S.tppMode === "swing") return d.tppSw == null ? null : bloc === "lnp" ? -d.tppSw : d.tppSw;
      return bloc === "alp" || bloc === "lnp" ? own(d.tpp) : d.winPct;
    case "fp": return divValue(m, d.i);
    case "flow": case "informal": case "seifa": { const v = divValue(m, d.i); return v == null ? null : v + (S.lens === "seifa" && !isDemo() && d.seifa[S.index] ? d.seifa[S.index].pct / 100 : 0); }
    case "cls": return d.cls ? 10 - CLS.indexOf(d.cls) + d.winPct / 1000 : null;
    default: return d.winPct;
  }
}
function chamberOrder(m) {
  const key = `${m.year}|${S.lens}|${S.tppMode}|${S.fpMode}|${S.party}|${S.from}|${S.index}`;
  if (m._chKey === key) return m._ch;
  const { gov, opp, cross } = chamberBlocs(m);
  const members = m.divs.filter((d) => d.i !== m.speaker);
  const byKey = (bloc, dir) => (p, q) => {
    const a = chamberKey(m, p, bloc), b = chamberKey(m, q, bloc);
    if (a == null && b == null) return p.n.localeCompare(q.n);
    if (a == null) return dir > 0 ? -1 : 1;
    if (b == null) return dir > 0 ? 1 : -1;
    return dir < 0 ? b - a : a - b;
  };
  const G = members.filter((d) => d.hold.fam === gov).sort(byKey(gov, -1));
  const O = members.filter((d) => d.hold.fam === opp).sort(byKey(opp, 1));
  const C = [];
  const groups = [];
  for (const f of cross) {
    const xs = members.filter((d) => d.hold.fam === f).sort(byKey(f, -1));
    if (xs.length) groups.push({ fam: f, n: xs.length });
    C.push(...xs);
  }
  const order = [...G, ...C, ...O].map((d) => d.i);
  const sp = m.divs[m.speaker];
  const N = m.divs.length, maj = Math.floor(N / 2) + 1;
  m._ch = { order, gov, opp, nGov: G.length, nCross: C.length, nOpp: O.length, groups, maj,
    majAt: maj - (sp && sp.hold.fam === gov ? 1 : 0) };
  m._chKey = key;
  return m._ch;
}

/* screen placement of the chamber in a w x h box */
function chamberFrame(geom, w, h, pad) {
  const b = geom.box, bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const s = Math.max(0.5, Math.min((w - pad.l - pad.r) / bw, (h - pad.t - pad.b) / bh));
  const ox = pad.l + (w - pad.l - pad.r - bw * s) / 2 - b.x0 * s, oy = pad.t + (h - pad.t - pad.b - bh * s) / 2 - b.y0 * s;
  return { s, ox, oy, X: (x) => ox + x * s, Yp: (y) => oy + y * s };
}

/* gliding between orders: each chair keyed by the seat's name */
let chAnim = null; // { from: Map(name -> [x, y, fa]), t0, dur }
const chLast = new Map();
function chamberPositions(m, geom) {
  const ch = chamberOrder(m);
  const pos = new Map();
  ch.order.forEach((i, k) => { const st = geom.seats[k]; pos.set(m.divs[i].n, [st.x, st.y, st.fa, st.u]); });
  return pos;
}
function startChamberGlide() {
  if (reduceMotion || !chLast.size) return;
  chAnim = { from: new Map(chLast), t0: performance.now(), dur: 680 };
  schedule();
}
const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

function seatPath(g, x, y, fa, w, d, back) {
  // a chair seen from above: the cushion, and a backrest on the side away from the table
  g.save(); g.translate(x, y); g.rotate(fa);
  g.beginPath();
  const r = Math.min(w, d) * 0.22;
  if (g.roundRect) g.roundRect(-d / 2, -w / 2, d, w, r); else g.rect(-d / 2, -w / 2, d, w);
  g.restore();
  if (back) { back.x = x; back.y = y; back.fa = fa; }
}
function drawChair(g, x, y, fa, w, d, fill, backFill, alpha) {
  g.save(); g.translate(x, y); g.rotate(fa); g.globalAlpha = alpha;
  const r = Math.min(w, d) * 0.24;
  g.beginPath(); if (g.roundRect) g.roundRect(-d / 2, -w / 2, d, w, r); else g.rect(-d / 2, -w / 2, d, w);
  g.fillStyle = fill; g.fill();
  // the backrest
  const bd = d * 0.3;
  g.beginPath(); if (g.roundRect) g.roundRect(-d / 2, -w / 2, bd, w, [r, 0, 0, r]); else g.rect(-d / 2, -w / 2, bd, w);
  g.fillStyle = backFill; g.fill();
  g.restore();
}

// draw the whole chamber into a context already scaled to CSS pixels
function drawChamber(g, m, w, h, opts) {
  const geom = chamberGeom(m.divs.length - (m.speaker != null ? 1 : 0));
  const pad = opts.pad || { t: 8, r: 8, b: 8, l: 8 };
  const F = chamberFrame(geom, w, h, pad);
  const th = TH, s = F.s, now = performance.now();
  const ch = chamberOrder(m);
  const target = chamberPositions(m, geom);
  // animation progress
  let t = 1;
  if (chAnim) { t = clamp((now - chAnim.t0) / chAnim.dur, 0, 1); if (t >= 1) chAnim = null; else needFrame = true; }
  const pos = (name) => {
    const to = target.get(name); if (!to) return null;
    if (!chAnim || !chAnim.from.has(name)) return to;
    const fr = chAnim.from.get(name);
    const lag = clamp(Math.abs(to[3] - (fr[3] ?? to[3])) * 0.35, 0, 0.35);
    const q = easeOut(clamp((t - lag * 0.5) / (1 - lag * 0.5), 0, 1));
    return [lerp(fr[0], to[0], q), lerp(fr[1], to[1], q), angLerp(fr[2], to[2], q), to[3]];
  };
  // the floor, the benches, the table
  const X = F.X, Yp = F.Yp, rO = geom.rOut, Ls = geom.Ls;
  g.save();
  g.globalAlpha = opts.alpha ?? 1;
  const U = (r, y0) => { // a U-shaped path at radius r, from the top left round to the top right
    g.moveTo(X(-r), Yp(y0)); g.lineTo(X(-r), Yp(Ls)); g.arc(X(0), Yp(Ls), r * s, Math.PI, 0, true); g.lineTo(X(r), Yp(y0));
  };
  g.beginPath(); U(rO + 0.72, -0.5); g.closePath(); g.fillStyle = css(th.floor); g.fill();
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  for (let i = 0; i <= CH.rows; i++) { const r = CH.r0 + (i - 0.52) * CH.g; g.beginPath(); U(r, -0.1); g.stroke(); }
  // the table, its despatch boxes and the mace
  const tw = CH.r0 - 1.15;
  g.beginPath(); if (g.roundRect) g.roundRect(X(-tw), Yp(0.45), 2 * tw * s, (Ls + CH.r0 * 0.5 - 0.45) * s, 0.5 * s); else g.rect(X(-tw), Yp(0.45), 2 * tw * s, (Ls + CH.r0 * 0.5 - 0.45) * s);
  g.fillStyle = css(mixC(th.floor, th.ink, th.dark ? 0.06 : 0.035)); g.fill(); g.stroke();
  g.fillStyle = css(th.line);
  for (const sx of [-1, 1]) { g.beginPath(); if (g.roundRect) g.roundRect(X(sx * (tw - 0.95) - 0.42), Yp(1.15), 0.84 * s, 0.62 * s, 0.12 * s); else g.rect(X(sx * (tw - 0.95) - 0.42), Yp(1.15), 0.84 * s, 0.62 * s); g.fill(); }
  if (s > 9) {
    g.strokeStyle = css(th.faint); g.lineWidth = Math.max(1, s * 0.08); g.lineCap = "round";
    g.beginPath(); g.moveTo(X(0), Yp(Ls * 0.42)); g.lineTo(X(0), Yp(Ls * 0.42 + 2.2)); g.stroke();
    g.beginPath(); g.arc(X(0), Yp(Ls * 0.42), s * 0.2, 0, Math.PI * 2); g.fillStyle = css(th.faint); g.fill();
  }
  // the chairs
  const filt = filtersOn(), sd = opts.sel, hv = opts.hover, stSel = opts.state;
  const pat = opts.pattern;
  const chairW = geom.pitch * 0.8 * s, chairD = CH.g * 0.74 * s;
  const backOf = (c) => towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22);
  const drawn = [];
  const paint = (i, x, y, fa, scale, sp) => {
    const d = m.divs[i];
    let c = fillDiv(m, i);
    let a = 1;
    if (filt && !passes(m, i)) a = 0.16;
    if (stSel && d.st !== stSel) a = Math.min(a, 0.2);
    if (opts.only != null && i !== opts.only) a = Math.min(a, 0.22);
    const W = chairW * scale, D = chairD * scale;
    if (!c) { drawChair(g, x, y, fa, W, D, pat || css(th.nodata), css(th.hatch), a); }
    else drawChair(g, x, y, fa, W, D, css(c), css(backOf(c)), a);
    drawn.push({ i, x, y, r: Math.max(W, D) * 0.62, fa, W, D, sp });
  };
  ch.order.forEach((i) => {
    const p = pos(m.divs[i].n); if (!p) return;
    paint(i, X(p[0]), Yp(p[1]), p[2], 1);
  });
  // the Speaker's chair, at the head of the table, facing down the chamber
  if (m.speaker != null) paint(m.speaker, X(0), Yp(-1.75), Math.PI / 2, 1.42, true);
  // rings for the hovered and chosen seats
  const ring = (i, lw) => { const q = drawn.find((x) => x.i === i); if (!q) return; g.save(); g.translate(q.x, q.y); g.rotate(q.fa); g.beginPath(); const pd = 2.2; if (g.roundRect) g.roundRect(-q.D / 2 - pd, -q.W / 2 - pd, q.D + 2 * pd, q.W + 2 * pd, 3); else g.rect(-q.D / 2 - pd, -q.W / 2 - pd, q.D + 2 * pd, q.W + 2 * pd); g.lineWidth = lw; g.strokeStyle = css(th.ink); g.stroke(); g.restore(); };
  if (hv != null && hv !== sd) ring(hv, 1.4);
  if (sd != null) ring(sd, 2.2);
  // every label drawn round the horseshoe claims its box, so the chosen seat's name can find a free spot
  const occ = (opts.keepOut || []).slice();
  const claim = (x, y, wd, ht, align, base) => {
    const x0 = align === "right" ? x - wd : align === "center" ? x - wd / 2 : x;
    const y0 = base === "top" ? y : base === "middle" ? y - ht / 2 : y - ht;
    occ.push({ x0, y0, x1: x0 + wd, y1: y0 + ht });
  };
  // the majority line: the seat that gives the government its 76th vote
  if (opts.labels !== false && ch.majAt > 0 && ch.majAt < geom.seats.length) {
    const a0 = geom.seats[ch.majAt - 1], a1 = geom.seats[ch.majAt];
    const um = (a0.u + a1.u) / 2;
    const at = (r) => { // the point at "angle" um on radius r
      const a = geom.a;
      if (um <= a) return [-r, (um / a) * Ls];
      if (um >= 1 - a) return [r, ((1 - um) / a) * Ls];
      const phi = Math.PI - ((um - a) / (1 - 2 * a)) * Math.PI; return [r * Math.cos(phi), Ls + r * Math.sin(phi)];
    };
    const p0 = at(CH.r0 - 0.62 * CH.g), p1 = at(rO + 0.62 * CH.g + (opts.big ? 0.5 : 0.15));
    g.strokeStyle = css(th.ink); g.lineWidth = opts.big ? 1.5 : 1.2; g.setLineDash(opts.big ? [4, 3] : [3, 2]);
    g.beginPath(); g.moveTo(X(p0[0]), Yp(p0[1])); g.lineTo(X(p1[0]), Yp(p1[1])); g.stroke(); g.setLineDash([]);
    if (!opts.big && s > 6) {
      const p2 = at(rO + 1.2);
      g.font = `600 11px ${SANS}`; g.fillStyle = css(th.ink2); g.textAlign = "center"; g.textBaseline = "top";
      g.fillText(`${ch.maj} for a majority`, X(p2[0]), Yp(p2[1]) + 2);
    }
    if (opts.big) {
      const p2 = at(rO + 1.35);
      g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2);
      const below = p2[1] > Ls + 1;
      g.textAlign = p2[0] < -0.5 ? "right" : p2[0] > 0.5 ? "left" : below ? "right" : "center"; g.textBaseline = below ? "top" : "middle";
      const mt = `${ch.maj} for a majority`, mx = X(p2[0]) + (below && Math.abs(p2[0]) <= 0.5 ? -6 : 0), my = Yp(p2[1]) + (below ? 4 : 0);
      g.fillText(mt, mx, my);
      claim(mx, my, g.measureText(mt).width, 16, g.textAlign, g.textBaseline);
      // the dashed line itself
      occ.push({ x0: Math.min(X(p0[0]), X(p1[0])) - 3, y0: Math.min(Yp(p0[1]), Yp(p1[1])) - 3, x1: Math.max(X(p0[0]), X(p1[0])) + 3, y1: Math.max(Yp(p0[1]), Yp(p1[1])) + 3 });
    }
  }
  // the blocs' names and numbers, outside the horseshoe
  if (opts.big) {
    const fig = (txt, col, x, y, align) => { g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `500 30px ${SANS}`; g.fillStyle = css(col); g.fillText(txt, x, y); };
    const lab = (txt, x, y, align) => { g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `600 13px ${SANS}`; g.fillStyle = css(th.ink); g.fillText(txt, x, y); };
    const govName = blocName(m, ch.gov), oppName = blocName(m, ch.opp);
    const yMid = Yp(Ls * 0.42);
    const room = X(-rO - 0.8);
    if (room > 70) {
      const blocLabel = (name, n, fam, role, x, align) => {
        lab(name, x, yMid - 34, align); fig(n, th.party[fam], x, yMid, align);
        g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = align; g.fillText(role, x, yMid + 18);
        g.font = `600 13px ${SANS}`; let wd = g.measureText(name).width;
        g.font = `500 30px ${SANS}`; wd = Math.max(wd, g.measureText(n).width);
        g.font = `400 12px ${SANS}`; wd = Math.max(wd, g.measureText(role).width);
        claim(x, yMid - 48, wd, 72, align, "top");
      };
      const spFam = m.divs[m.speaker] && m.divs[m.speaker].hold.fam;
      blocLabel(govName, String(ch.nGov + (spFam === ch.gov ? 1 : 0)), ch.gov, "Government", X(-rO - 0.95), "right");
      blocLabel(oppName, String(ch.nOpp + (spFam === ch.opp ? 1 : 0)), ch.opp, "Opposition", X(rO + 0.95), "left");
    }
    if (ch.nCross) {
      // the crossbench's name and make-up beside its chairs, outside the curve
      const um = (ch.nGov + ch.nCross / 2) / geom.seats.length;
      const pt = uPoint(geom, um, rO + 1.25);
      // never centred: at the foot of the horseshoe the majority label takes the left, this the right
      const side = pt[0] < -1.2 ? "right" : "left";
      const bx = X(pt[0]) + (side === "left" ? (Math.abs(pt[0]) <= 1.2 ? 16 : 4) : -4), by = Yp(pt[1]) + (pt[1] > Ls + rO * 0.6 ? 6 : 0);
      // no room beside the horseshoe on a narrow screen: the key below gives the counts
      const room = side === "left" ? w - bx >= 150 : bx >= 150;
      if (room) {
      g.textAlign = side; g.textBaseline = "top";
      g.font = `600 13px ${SANS}`; g.fillStyle = css(th.ink);
      g.fillText(`Crossbench ${ch.nCross}`, bx, by);
      g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3);
      const parts = crossParts(m, ch).split(" · ");
      const maxW = side === "center" ? 360 : Math.max(120, side === "left" ? F.ox + (geom.box.x1 + 6) * s - bx : bx - 10);
      let line = "", ly = by + 17, wMax = g.measureText(`Crossbench ${ch.nCross}`).width + 10;
      for (const p of parts) {
        const t = line ? line + " · " + p : p;
        if (g.measureText(t).width > maxW && line) { g.fillText(line, bx, ly); wMax = Math.max(wMax, g.measureText(line).width); ly += 15; line = p; } else line = t;
      }
      if (line) { g.fillText(line, bx, ly); wMax = Math.max(wMax, g.measureText(line).width); }
      claim(bx, by, wMax, ly + 15 - by, side, "top");
      }
    }
    // the Speaker
    const sp = m.divs[m.speaker];
    if (sp) {
      g.textAlign = "left"; g.textBaseline = "middle"; g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2);
      g.fillText("Speaker", X(1.35), Yp(-1.75) - 7);
      g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3);
      const spt = `${speakerName(m)}, ${sp.n}`;
      g.fillText(spt, X(1.35), Yp(-1.75) + 8);
      claim(X(1.35), Yp(-1.75) - 15, g.measureText(spt).width, 31, "left", "top");
    }
    // the chosen seat's name, out beyond the benches on a leader line, at the nearest free spot
    if (sd != null) {
      const q = drawn.find((x) => x.i === sd);
      if (q && !q.sp) labelChosen(q, m.divs[sd].n);
    }
  }
  g.restore();
  finishChamber();
  return { drawn, F, geom };
  function labelChosen(q, txt) {
    const cx = (q.x - F.ox) / s, cy = (q.y - F.oy) / s;
    // outward: sideways off the straight benches, along the radius round the curve
    let dx, dy;
    if (cy <= Ls) { dx = cx < 0 ? -1 : 1; dy = 0; } else { const l = Math.hypot(cx, cy - Ls) || 1; dx = cx / l; dy = (cy - Ls) / l; }
    // the name hangs where the bloc labels do, just beyond the benches
    const R = rO + 0.95, Rk = rO + 0.6;
    const ax = X(dx * R), ay = cy <= Ls ? q.y : Yp(Ls + dy * R);
    const kx = X(dx * Rk), ky = cy <= Ls ? q.y : Yp(Ls + dy * Rk);
    g.font = `600 13px ${SANS}`;
    const tw = g.measureText(txt).width, th2 = 16;
    const side = Math.abs(dx) >= 0.42;
    const align = side ? (dx < 0 ? "right" : "left") : "center";
    const floorR = rO + 0.5; // the outer chairs' backs
    const onFloor = (px, py) => { const u = (px - F.ox) / s, v = (py - F.oy) / s; return v <= Ls ? v >= -0.6 && Math.abs(u) <= floorR : Math.hypot(u, v - Ls) <= floorR; };
    const boxAt = (lx, ly) => {
      const x0 = align === "right" ? lx - 6 - tw : align === "center" ? lx - tw / 2 : lx + 6;
      const y0 = side ? ly - th2 / 2 : ly + 5;
      return { x0, y0, x1: x0 + tw, y1: y0 + th2 };
    };
    const free = (b) => b.x0 >= 4 && b.x1 <= w - 4 && b.y0 >= 0 && b.y1 <= h - 2
      && !occ.some((o) => b.x0 < o.x1 + 4 && b.x1 > o.x0 - 4 && b.y0 < o.y1 + 3 && b.y1 > o.y0 - 3)
      && ![[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1], [(b.x0 + b.x1) / 2, b.y0], [(b.x0 + b.x1) / 2, b.y1]].some(([px, py]) => onFloor(px, py));
    let box = boxAt(ax, ay), found = free(box);
    for (let k = 1; k <= 24 && !found; k++) {
      const off = Math.ceil(k / 2) * 9 * (k % 2 ? 1 : -1);
      // beside the straight benches, step up or down; round the curve, along it and outward
      const b = side ? boxAt(ax, ay + off * 2) : boxAt(ax + off * 2.2, ay + Math.ceil(k / 2) * 3);
      if (free(b)) { box = b; found = true; }
    }
    const my = (box.y0 + box.y1) / 2;
    g.save();
    g.textAlign = "left"; g.textBaseline = "middle";
    if (!found) {
      // no free room outside the benches (a phone): the name sits on a plate above its chair
      box = { x0: clamp(q.x - tw / 2, 4, w - 4 - tw), y0: Math.max(2, q.y - q.r - 22) };
      g.fillStyle = css(th.bg, 0.92);
      g.beginPath(); if (g.roundRect) g.roundRect(box.x0 - 5, box.y0 - 1, tw + 10, 18, 4); else g.rect(box.x0 - 5, box.y0 - 1, tw + 10, 18); g.fill();
      g.fillStyle = css(th.ink); g.fillText(txt, box.x0, box.y0 + 8);
      g.restore();
      return;
    }
    // the leader: from the chair's edge out past the benches, then to the name; beside the
    // straight benches it turns square, so it never crosses the bloc's label
    const ex = q.x + dx * q.r * 0.7, ey = q.y + dy * q.r * 0.7;
    const tx = align === "right" ? box.x1 + 4 : align === "left" ? box.x0 - 4 : (box.x0 + box.x1) / 2, ty = side ? my : box.y0 - 3;
    g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(ex, ey); g.lineTo(kx, ky);
    if (side && cy <= Ls) g.lineTo(kx, ty);
    g.lineTo(tx, ty);
    g.lineWidth = 3.4; g.strokeStyle = css(th.floor); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = css(th.ink); g.stroke();
    g.lineWidth = 4; g.strokeStyle = css(th.bg); g.strokeText(txt, box.x0, my);
    g.fillStyle = css(th.ink); g.fillText(txt, box.x0, my);
    g.restore();
  }
  // remember where every chair was drawn, for the next glide and for hit tests
  function finishChamber() {
    if (!chAnim) for (const [k, v] of target) chLast.set(k, v);
    else for (const q of drawn) { const nm = m.divs[q.i].n; const p = pos(nm); if (p) chLast.set(nm, p); }
  }
}
const blocName = (m, fam) => (fam === "alp" ? "Labor" : "Coalition");
function crossParts(m, ch) {
  const cnt = {};
  for (const i of ch.order) { const d = m.divs[i]; if (d.hold.fam === ch.gov || d.hold.fam === ch.opp) continue; const k = crossLabel(d.hold); cnt[k] = (cnt[k] || 0) + 1; }
  return Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`).join(" · ");
}
function crossLabel(h) {
  if (h.ab === "CSA") return "Community Strong";
  const f = h.fam;
  if (f === "ind") return "Independents";
  if (f === "grn") return "Greens";
  if (f === "onp") return "One Nation";
  return partyShort(h.ab, h.pn);
}
const SPEAKERS = { 2004: "David Hawker", 2007: "Harry Jenkins", 2010: "Harry Jenkins", 2013: "Bronwyn Bishop", 2016: "Tony Smith", 2019: "Tony Smith", 2022: "Milton Dick", 2025: "Milton Dick", now: "Milton Dick" };
const speakerName = (m) => SPEAKERS[m.year];

let chMain = null; // the last full-size draw: chairs on screen, for hit tests and the morph
function chamberHit(m, px, py) {
  if (!chMain) return null;
  let best = null, bd = Infinity;
  for (const q of chMain.drawn) { const d = Math.hypot(px - q.x, py - q.y); if (d < q.r + 3 && d < bd) { bd = d; best = q.i; } }
  return best == null ? null : { kind: "div", i: best };
}
function chamberPads() { return isPhone() ? { t: 30, r: 10, b: 52, l: 10 } : { t: 24, r: 150, b: 66, l: 150 }; }
function drawChamberMain(m, alpha) {
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sd = selDiv();
  chMain = drawChamber(ctx, m, Wpx, Hpx, { big: true, alpha, sel: sd, hover: S.hover && S.hover.kind === "div" ? S.hover.i : null,
    state: S.sel.level === "state" ? S.sel.st : null, pad: chamberPads(), pattern: (() => { const p = hatch(); p.setTransform(new DOMMatrix().scale(1 / dpr)); return p; })() });
  ctx.restore();
}

/* ----- the morph between the map and the chamber ----- */
let morph = null; // { to: "chamber" | "map", t0, dur }
function drawMorph(m, p) {
  const th = TH;
  const geom = chamberGeom(m.divs.length - 1);
  const F = chamberFrame(geom, Wpx, Hpx, chamberPads());
  const target = chamberPositions(m, geom);
  // the map recedes, the chamber's furniture arrives
  if (p < 0.55) { drawGeo(m, 1 - p / 0.55, (1 - p / 0.55) * streetK()); }
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (p > 0.45) {
    ctx.globalAlpha = clamp((p - 0.45) / 0.55, 0, 1);
    drawChamberFurniture(ctx, m, F, geom);
  }
  ctx.restore();
  const g = geoOf(m);
  const chairW = geom.pitch * 0.8 * F.s, chairD = CH.g * 0.74 * F.s;
  for (const d of m.divs) {
    const tgt = d.i === m.speaker ? [0, -1.75, Math.PI / 2] : target.get(d.n);
    if (!tgt) continue;
    const gx = d.lpx * T.k + T.x, gy = d.lpy * T.k + T.y;
    const cx = F.X(tgt[0]), cy = F.Yp(tgt[1]);
    const dist = Math.hypot(cx - gx, cy - gy) / Math.max(Wpx, Hpx);
    const q = clamp((p - dist * 0.22) / (1 - 0.22), 0, 1), e = ease(q);
    const x = lerp(gx, cx, e), y = lerp(gy, cy, e);
    const c = fillDiv(m, d.i) || th.nodata;
    // the seat's shape shrinks onto its chair...
    const sc = Math.pow(1 - e, 2.2);
    if (sc > 0.01 && g.paths[d.i]) {
      ctx.save();
      ctx.setTransform(dpr * T.k * sc, 0, 0, dpr * T.k * sc, dpr * (x - d.lpx * T.k * sc), dpr * (y - d.lpy * T.k * sc));
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(c); ctx.fill(g.paths[d.i]);
      ctx.restore();
    }
    // ...and the chair grows in its place
    const cs = smooth(0.35, 1, e);
    if (cs > 0.01) {
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sp = d.i === m.speaker ? 1.42 : 1;
      drawChair(ctx, x, y, lerp(0, tgt[2], e), chairW * sp * cs, chairD * sp * cs, css(c), css(towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22)), 1);
      ctx.restore();
    }
  }
}
function drawChamberFurniture(g, m, F, geom) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, rO = geom.rOut, Ls = geom.Ls;
  const U = (r, y0) => { g.moveTo(X(-r), Yp(y0)); g.lineTo(X(-r), Yp(Ls)); g.arc(X(0), Yp(Ls), r * s, Math.PI, 0, true); g.lineTo(X(r), Yp(y0)); };
  g.beginPath(); U(rO + 0.72, -0.5); g.closePath(); g.fillStyle = css(th.floor); g.fill();
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  for (let i = 0; i <= CH.rows; i++) { const r = CH.r0 + (i - 0.52) * CH.g; g.beginPath(); U(r, -0.1); g.stroke(); }
  const tw = CH.r0 - 1.15;
  g.beginPath(); if (g.roundRect) g.roundRect(X(-tw), Yp(0.45), 2 * tw * s, (Ls + CH.r0 * 0.5 - 0.45) * s, 0.5 * s); else g.rect(X(-tw), Yp(0.45), 2 * tw * s, (Ls + CH.r0 * 0.5 - 0.45) * s);
  g.fillStyle = css(mixC(th.floor, th.ink, th.dark ? 0.06 : 0.035)); g.fill(); g.stroke();
}

/* ----- the small chamber in the story column ----- */
const miniCh = { canvas: null, drawn: null, F: null };
function paintMiniChamber() {
  const c = $("#minich"); if (!c) { miniCh.canvas = null; return; }
  const m = M(); if (!m) return;
  const w = c.clientWidth || 300;
  const geom = chamberGeom(m.divs.length - 1);
  const pad = { t: 4, r: 4, b: 22, l: 4 };
  const bw = geom.box.x1 - geom.box.x0, bh = geom.box.y1 - geom.box.y0;
  const h = Math.round(((w - 8) * bh) / bw + 26);
  const r = Math.min(window.devicePixelRatio || 1, 2);
  if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); c.style.height = h + "px"; }
  const g = c.getContext("2d");
  g.setTransform(r, 0, 0, r, 0, 0);
  g.clearRect(0, 0, w, h);
  const sd = selDiv();
  const out = drawChamber(g, m, w, h, { big: false, sel: sd, hover: miniCh.hover ?? null, state: S.sel.level === "state" ? S.sel.st : null, pad, labels: true });
  miniCh.canvas = c; miniCh.drawn = out.drawn;
}
function miniHit(px, py) {
  if (!miniCh.drawn) return null;
  let best = null, bd = Infinity;
  for (const q of miniCh.drawn) { const d = Math.hypot(px - q.x, py - q.y); if (d < q.r + 2 && d < bd) { bd = d; best = q.i; } }
  return best;
}
