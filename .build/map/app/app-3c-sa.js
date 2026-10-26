/* =============================== South Australia's chambers ===============================
   The House of Assembly and the Legislative Council as they are built, after the Parliament of
   South Australia's chamber maps (chamber-maps.parliament.sa.gov.au): two rooms of the same size,
   the Speaker's (the President's) chair on its dais at the northern end, the table below it with
   the Clerk, the Chairman of Committees and the Deputy Clerk, then a wide open floor. Down either
   side run the benches: the front bench, and two rows behind it in the Assembly (one in the
   Council), each cut by a cross-aisle; at the southern end each side's back rows curve round its
   own centre to meet the gangway, so the two curves never join. The government sits on the
   presiding officer's right (the reader's left). The Assembly seats 61 and its Speaker, the Council
   28 and its President. Drawn by the House's renderer (drawChamber) like the Senate's floor; where
   a plan is filed (map/data/seats-<year>.json, seats-<year>-lc.json, from .build/map/sa_seating.mjs)
   each member sits at their desk, otherwise each bloc fills the benches from the chair's end.
   @sa-cells-begin – read as is by .build/map/sa_seating.mjs, which checks every desk a plan names
   is one drawn here. Measured off the chamber maps' floor images (pixels, x from the centre line,
   y down from the curves' centres), seat ids the Parliament's own desk names; a side's list reads
   down a column from the chair's end, or round a curve from the side wall to the gangway ("-" is
   no seat: the opposition's front bench has none at the cross-aisle). */
const SAF = {
  ha: {
    room: [-360, -700, 360, 261], chair: -649.5, officers: [-553.5, 70], table: [-527, -484, 92], mace: true, lead: ["A1", "F1"],
    straight: [
      { row: 1, x: 140, ys: [-461.3, -410.3, -359.3, -308.3, -257.3, -206.3, -155.3, -104.3, -53.3], L: "A1 A2 A3 A4 A5 B1 B2 B3 B4", R: "F1 F2 F3 F4 - E1 E2 E3 E4" },
      { row: 2, x: 231, ys: [-459.8, -383.8, -307.8, -205.8, -129.8, -53.8], L: "G1 G2 G3 H1 H2 H3", R: "J1 J2 J3 I1 I2 I3" },
      { row: 3, x: 323, ys: [-459.8, -383.8, -307.8, -205.8, -129.8, -53.8], L: "K1 K2 K3 L1 L2 L3", R: "Q1 Q2 Q3 P1 P2 P3" },
    ],
    // each curve: its centre (a out from the centre line, y), radius, and seats by degrees below the horizontal
    arcs: [
      { row: 2, a: 105, y: 2.5, r: 112.5, phi: [13, 38.3, 63.3, 88], L: "C4 C3 C2 C1", R: "D1 D2 D3 D4" },
      { row: 3, a: 97.3, y: -1.4, r: 213, phi: [13.6, 26.3, 39.2, 59.3, 72, 84.6], L: "M3 M2 M1 N3 N2 N1", R: "R1 R3 R2 O2 O1 O3" },
    ],
  },
  lc: {
    room: [-350, -690, 350, 258], chair: -630.5, officers: [-526.5, 56], table: [-500, -458, 78], mace: false, lead: ["A1", "D1"],
    straight: [
      { row: 1, x: 131, ys: [-303, -205, -141, -77], L: "A1 B1 B2 B3", R: "D1 C1 C2 C3" },
      { row: 2, x: 235, ys: [-433, -369.5, -303, -205, -141, -77], L: "E1 E2 E3 F1 F2 F3", R: "L1 L2 L3 K1 K2 K3" },
    ],
    arcs: [{ row: 2, a: 125, y: 0, r: 97, phi: [11, 40, 70], L: "G3 G2 G1", R: "J3 J2 J1" }],
    // a lone seat either side of the gangway, beyond the curves, facing the chair
    singles: [{ row: 2, x: 170, y: 201, L: "H1", R: "I1" }],
  },
};
// every seat on a floor: { id, x, y (pixels), fa (the way it faces), row, arc? }
function saCells(F) {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, key = side ? "R" : "L";
    for (const b of F.straight) b[key].split(" ").forEach((id, j) => { if (id !== "-") cells.push({ id, x: sx * b.x, y: b.ys[j], fa: side ? Math.PI : 0, row: b.row }); });
    for (const b of F.arcs) b[key].split(" ").forEach((id, j) => {
      const p = b.phi[j] * D, x = sx * (b.a + b.r * Math.cos(p)), y = b.y + b.r * Math.sin(p);
      cells.push({ id, x, y, fa: Math.atan2(b.y - y, sx * b.a - x), row: b.row, arc: b });
    });
    for (const b of F.singles || []) cells.push({ id: b[key], x: sx * b.x, y: b.y, fa: -Math.PI / 2, row: b.row });
  }
  return cells;
}
/* @sa-cells-end */
const SAU = 36; // the floor images' pixels to a chamber unit
const SA_SEAT = { W: 46, D: 50 }; // a chair, in pixels: along its bench, and deep
const SA_PAD = 4; // a bench's margin round its chairs
const saGeomC = {};
// the chamber the year's House or council is drawn in
const saFloorOf = (m) => (m.house === "senate" ? "lc" : "ha");
function saGeom(key) {
  if (saGeomC[key]) return saGeomC[key];
  const F = SAF[key], P = (v) => v / SAU;
  // the curves' common centre, each side's (half the gap between them), for the order along the benches
  const A = P(F.arcs.reduce((t, b) => t + b.a, 0) / F.arcs.length);
  const all = saCells(F).map((c) => {
    const x = P(c.x), y = P(c.y);
    return { id: c.id, x, y, fa: c.fa, row: c.row, s: benchS(x, y, A), W: P(SA_SEAT.W - 4), D: P(SA_SEAT.D - 6), raw: c };
  });
  const seats = all.sort((p, q) => p.s - q.s || p.row - q.row);
  seats.forEach((c, k) => { c.k = k; });
  const s0 = seats[0].s, s1 = seats[seats.length - 1].s;
  seats.forEach((c) => { c.u = clamp((c.s - s0) / (s1 - s0), 0, 1); });
  const nRows = Math.max(...seats.map((c) => c.row));
  const rows = Array.from({ length: nRows + 1 }, (_, r) => seats.filter((c) => c.row === r));
  // the walkways the majority line threads: inside the front row, between rows, outside the back
  // row, on the straight benches (their distance from the centre line) and round the curves (their
  // radius about the side's centre; the front bench doesn't curve, so round the curves it stands a
  // chair inside the row behind it, and the line runs just inside the inner curve's chairs)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rowX = rows.slice(1).map((r) => mean(r.filter((c) => !c.raw.arc && c.y < 0).map((c) => Math.abs(c.x))));
  const rowR = rows.slice(1).map((r) => { const a = r.filter((c) => c.raw.arc); return a.length ? mean(a.map((c) => P(c.raw.arc.r))) : null; });
  for (let j = rowR.length - 2; j >= 0; j--) if (rowR[j] == null) rowR[j] = rowR[j + 1] - P(SA_SEAT.D + 14);
  const walk = (v) => { const w = [v[0] - (v.length > 1 ? (v[1] - v[0]) / 2 : 0.7)]; for (let j = 1; j < v.length; j++) w.push((v[j - 1] + v[j]) / 2); w.push(v[v.length - 1] + 0.75); return w.map((x) => Math.max(0.15, x)); };
  const GS = walk(rowX), GC = walk(rowR);
  const benchPt = (s, k) => {
    if (s <= 0) return [-GS[k], s];
    if (s >= Math.PI * CHK) return [GS[k], Math.PI * CHK - s];
    const a = s / CHK, c = Math.cos(a);
    return [(c >= 0 ? -A : A) - GC[k] * c, GC[k] * Math.sin(a)];
  };
  const benchOut = (s) => {
    if (s <= 0) return [-1, 0];
    if (s >= Math.PI * CHK) return [1, 0];
    const a = s / CHK; return [-Math.cos(a), Math.sin(a)];
  };
  const [rx0, ry0, rx1, ry1] = F.room.map(P);
  saGeomC[key] = {
    key, seats, rows, nRows, bench: seats.filter((c) => c.row > 0), byId: new Map(seats.map((c) => [c.id, c.k])),
    // the bloc labels hang just outside the room's walls
    rOut: rx1 - 0.6, box: { x0: rx0, x1: rx1, y0: ry0, y1: ry1 }, rect: true, cutPad: P(SA_SEAT.W / 2 + 10),
    arms: false, table: F.lead, chairAt: [0, P(F.chair), Math.PI / 2, 0, P(40), P(38)],
    aisle: P((F.officers[0] + F.straight[0].ys[0]) / 2 + 40), yMid: mean(rows[1].filter((c) => c.y < 0).map((c) => c.y)),
    benchPt, benchOut, furniture: drawSAFurniture,
  };
  return saGeomC[key];
}
// a point on the room's floor (chamber units), for keeping labels off it
const saOnFloor = (geom, u, v, pad = 0) => u >= geom.box.x0 - pad && u <= geom.box.x1 + pad && v >= geom.box.y0 - pad && v <= geom.box.y1 + pad;

/* the room, in the House's drawing: the floor, the benches (a bench's colour with a margin round its
   chairs: the front bench and each three-seat block one bench down the straight, each run of a curve
   one bench round it), the Speaker's dais, the table with the Mace (the Assembly's), the officers'
   chairs, and the empty seats (outlined only) */
function drawSAFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, P = (v) => v / SAU, k = s / SAU, D2R = Math.PI / 180;
  const SF = SAF[geom.key];
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  // the floor
  const b = geom.box;
  g.fillStyle = css(th.floor); g.fillRect(X(b.x0), Yp(b.y0), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s);
  // the rest in the plan's pixels
  g.save(); g.translate(X(0), Yp(0)); g.scale(k, k);
  const hair = 1 / k;
  g.lineWidth = hair; g.strokeStyle = css(th.line); g.fillStyle = bench;
  const rb = (x, y, w, h, r = 4) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); g.stroke(); };
  const hw = SA_SEAT.W / 2 + SA_PAD, hd = SA_SEAT.D / 2 + SA_PAD;
  for (const side of [-1, 1]) {
    const key = side > 0 ? "R" : "L";
    // down the straight: a run of seats closer than a seat and a half apart is one bench
    for (const r of SF.straight) {
      const ys = r[key].split(" ").map((id, j) => (id === "-" ? null : r.ys[j]));
      const pitch = Math.min(...r.ys.slice(1).map((y, j) => y - r.ys[j]));
      let run = null;
      const flush = () => { if (run) rb(side * r.x - hd, run[0] - hw, 2 * hd, run[1] - run[0] + 2 * hw); run = null; };
      for (const y of ys) { if (y == null) { flush(); continue; } if (run && y - run[1] <= pitch * 1.5) run[1] = y; else { flush(); run = [y, y]; } }
      flush();
    }
    // round the curves: each run a sector of its curve, about that side's own centre
    for (const a of SF.arcs) {
      const step = Math.min(...a.phi.slice(1).map((p, j) => p - a.phi[j]));
      const runs = [];
      for (const p of a.phi) { const last = runs[runs.length - 1]; if (last && p - last[1] <= step * 1.5) last[1] = p; else runs.push([p, p]); }
      for (const [p0, p1] of runs) {
        const half = (hw / a.r) / D2R, c = side * a.a;
        // canvas angles: the opposition's quarter runs from the horizontal down; the government's mirrors it
        const A0 = (side > 0 ? p0 - half : 180 - p0 + half) * D2R, A1 = (side > 0 ? p1 + half : 180 - p1 - half) * D2R;
        g.beginPath(); g.arc(c, a.y, a.r + hd, A0, A1, side < 0); g.arc(c, a.y, a.r - hd, A1, A0, side > 0); g.closePath(); g.fill(); g.stroke();
      }
    }
    for (const q of SF.singles || []) rb(side * q.x - hw, q.y - hd, 2 * hw, 2 * hd);
  }
  // the dais, raised above the floor, its step drawn inside
  const dais = (inset) => { const w = 52 - inset, yt = SF.room[1] + 6 + inset, yc = SF.chair + 12; g.beginPath(); g.moveTo(-w, yt); g.lineTo(w, yt); g.lineTo(w, yc); g.arc(0, yc, w, 0, Math.PI); g.closePath(); };
  dais(0); g.fillStyle = wood; g.fill(); g.stroke();
  dais(7); g.fillStyle = bench; g.fill();
  // the table below it, the officers' chairs at its head; the Mace on the Assembly's
  const [t0, t1, tw] = SF.table;
  g.lineWidth = Math.max(hair, (0.05 * s) / k); g.strokeStyle = wood; g.fillStyle = bench;
  rb(-tw, t0, 2 * tw, t1 - t0, 3);
  g.lineWidth = hair; g.strokeStyle = css(th.line);
  if (SF.mace && s > 9) {
    const my = t1 - 11, mx = tw * 0.45;
    g.strokeStyle = css(th.faint); g.lineWidth = Math.max(hair, (0.07 * s) / k); g.lineCap = "round";
    g.beginPath(); g.moveTo(-mx, my); g.lineTo(mx, my); g.stroke();
    g.beginPath(); g.arc(-mx, my, (0.12 * s) / k, 0, Math.PI * 2); g.fillStyle = css(th.faint); g.fill();
    g.lineCap = "butt"; g.lineWidth = hair; g.strokeStyle = css(th.line);
  }
  g.restore();
  // the empty seats, outlined only, so they never read as a member's chair (a dimmed one is filled)
  g.strokeStyle = css(mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24)); g.lineWidth = 1;
  for (const c of geom.seats) {
    if (opts.occupied && opts.occupied.has(c.k)) continue;
    const w = c.W * s, d = c.D * s, r = Math.min(w, d) * 0.24;
    g.save(); g.translate(X(c.x), Yp(c.y)); g.rotate(c.fa);
    g.beginPath(); if (g.roundRect) g.roundRect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1, r); else g.rect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1);
    g.stroke(); g.restore();
  }
  // the officers: the Clerk on the chair's right, the Chairman of Committees, the Deputy Clerk
  const [oy, odx] = SF.officers, W = P(30) * s, Dp = P(28) * s;
  for (const ox of [-odx, 0, odx]) drawChair(g, X(P(ox)), Yp(P(oy)), Math.PI / 2, W, Dp, css(officer), back(officer, 0.18), 1);
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    put("The table", 0, P((t0 + t1) / 2 - (SF.mace ? 5 : 0)), P(2 * tw - 16));
  }
}
