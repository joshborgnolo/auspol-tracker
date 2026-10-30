/* ===================== South Australia's chambers — and New South Wales' Council =====================
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
   New South Wales' Council uses the same renderer with its own rectangular floor. Its
   proportions and furniture follow the user's four chamber photographs (2026-10-30) and
   Parliament's chamber layout (https://www.parliament.nsw.gov.au/parliamentary-business/legislative-council/the-chamber):
   government on the President's right (drawing left), opposition
   on the left, crossbenches across the entrance end and on the detached inner benches.
   The long table has a broad clerks' head and a rounded entrance end, with three members'
   chairs along each side. The vice-regal chair is behind the President, not a second President
   or deputy. These are schematic member positions, not an assigned seating plan or a count
   of fixed chairs: the leather benches have no individual desks. Party/term sorting is retained.
   @sa-cells-begin – read as is by .build/map/sa_seating.mjs, which checks every desk a plan names
   is one drawn here. SA is measured off the chamber maps' floor images (pixels, x from the centre line,
   y down from the curves' centres), with the Parliament's own desk names; NSW uses schematic ids.
   A side's list reads
   down a column from the chair's end, or round a curve from the side wall to the gangway ("-" is
   no seat: the opposition's front bench has none at the cross-aisle). A room's southern wall
   (room[3]) ends with its seats: the lowest bench's southern edge plus the carpet skirt the
   House floor keeps (4.5 plan points, 5.4 pixels here — the 2026-10-27 substrate trim; test-
   map-page.mjs pins the relation for every floor). */
const SAF = {
  ha: {
    room: [-360, -700, 360, 246], chair: -649.5, officers: [-553.5, 70], table: [-527, -484, 92], mace: true, lead: ["A1", "F1"],
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
    room: [-350, -690, 350, 235], chair: -630.5, officers: [-526.5, 56], table: [-500, -458, 78], mace: false, lead: ["A1", "D1"],
    straight: [
      { row: 1, x: 131, ys: [-303, -205, -141, -77], L: "A1 B1 B2 B3", R: "D1 C1 C2 C3" },
      { row: 2, x: 235, ys: [-433, -369.5, -303, -205, -141, -77], L: "E1 E2 E3 F1 F2 F3", R: "L1 L2 L3 K1 K2 K3" },
    ],
    arcs: [{ row: 2, a: 125, y: 0, r: 97, phi: [11, 40, 70], L: "G3 G2 G1", R: "J3 J2 J1" }],
    // a lone seat either side of the gangway, beyond the curves, facing the chair
    singles: [{ row: 2, x: 170, y: 201, L: "H1", R: "I1" }],
  },
  // NSW Council: long rectangular room, two facing rows on each side, divided inner
  // benches at the entrance end. The government side stops short of the rear wall.
  // The rear left long bench and the two short benches beside the central gate face
  // the President. Gallery furniture is neutral and never counted as members.
  nswLC: {
    room: [-320.4, -650, 320.4, 318.4], chair: -510, chairW: 38, chairD: 36,
    seat: { W: 35, D: 38 },
    officers: [-391, 65], mace: false, lead: ["T1", "U1"],
    plat: { w: 88, y0: -625, y1: -448, regal: -588 },
    presidentDesk: { x: 62, y0: -484, y1: -458 },
    headBenches: { x0: 110, x1: 293, ys: [-602, -558], depth: 28 },
    ltable: { x: 65, hx: 110, hd: 68, y0: -360, y1: 165, cx: 99, chairs: [-236, -110, 16], rod: 134 },
    transverse: { y0: 293, y1: 313, half: 315, gap: 30 },
    gang: 130, usher: 201,
    vacant: ["C7", "C8", "C9", "D7", "D8", "D9"],
    // Six of the 48 schematic member positions are at the table, not on the benches.
    tableSeats: { L: "T1 T2 T3", R: "U1 U2 U3" },
    blocs: {
      gov: "T1 T2 T3 A1 C1 A2 C2 A3 C3 A4 C4 A5 C5 A6 C6",
      opp: "U1 U2 U3 B1 D1 B2 D2 B3 D3 B4 D4 B5 D5 B6 D6",
      cross: "A7 A8 X4 X3 X2 X1 Y2 Y1 E1 E2 B8 B7",
    },
    straight: [
      { row: 1, x: 180, ys: [-440, -358, -276, -194, -112, -30, 104, 154], breakAfter: [5], L: "A1 A2 A3 A4 A5 A6 A7 A8", R: "" },
      { row: 1, x: 180, ys: [-440, -350, -260, -170, -80, 10, 164, 214], breakAfter: [5], L: "", R: "B1 B2 B3 B4 B5 B6 B7 B8" },
      { row: 2, x: 270, ys: [-440, -365, -290, -215, -140, -65, 10, 85, 160], L: "C1 C2 C3 C4 C5 C6 C7 C8 C9", R: "" },
      { row: 2, x: 270, ys: [-440, -358, -276, -194, -112, -30, 52, 134, 216], L: "", R: "D1 D2 D3 D4 D5 D6 D7 D8 D9" },
    ],
    singles: [
      { row: 2, x: 52, y: 270, L: "Y1", bench: "left-pair" },
      { row: 2, x: 99, y: 270, L: "Y2", bench: "left-pair" },
      { row: 2, x: 151, y: 270, L: "X1", bench: "left-long" },
      { row: 2, x: 198, y: 270, L: "X2", bench: "left-long" },
      { row: 2, x: 245, y: 270, L: "X3", bench: "left-long" },
      { row: 2, x: 292, y: 270, L: "X4", bench: "left-long" },
      { row: 2, x: 52, y: 270, R: "E1", bench: "right-pair" },
      { row: 2, x: 99, y: 270, R: "E2", bench: "right-pair" },
    ],
    arcs: [],
  },
};
// every seat on a floor: { id, x, y (pixels), fa (the way it faces), row, arc? }
function saCells(F) {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, key = side ? "R" : "L";
    // a side's seat list may be "" (its floor runs no bench on that row's side) or hold "-" blanks
    for (const b of F.straight) b[key].split(" ").forEach((id, j) => { if (id && id !== "-") cells.push({ id, x: sx * b.x, y: b.ys[j], fa: side ? Math.PI : 0, row: b.row }); });
    for (const b of F.arcs) b[key].split(" ").forEach((id, j) => {
      if (!id || id === "-") return;
      const p = b.phi[j] * D, x = sx * (b.a + b.r * Math.cos(p)), y = b.y + b.r * Math.sin(p);
      cells.push({ id, x, y, fa: Math.atan2(b.y - y, sx * b.a - x), row: b.row, arc: b });
    });
    for (const b of F.singles || []) if (b[key]) cells.push({ id: b[key], x: sx * b.x, y: b.y, fa: -Math.PI / 2, row: b.row });
    if (F.tableSeats) F.tableSeats[key].split(" ").forEach((id, j) => cells.push({ id, x: sx * F.ltable.cx, y: F.ltable.chairs[j], fa: side ? Math.PI : 0, row: 0 }));
  }
  return cells;
}
/* @sa-cells-end */
const SAU = 36; // the floor images' pixels to a chamber unit
const SA_SEAT = { W: 46, D: 50 }; // a chair, in pixels: along its bench, and deep
const SA_PAD = 4; // a bench's margin round its chairs
const saGeomC = {};
// the chamber the year's House or council is drawn in (nsw23's Assembly never reaches here:
// chamberGeom routes it to app-3-chamber.js's nswGeom first)
const saFloorOf = (m) => (m.year === "nsw23" ? "nswLC" : m.house === "senate" ? "lc" : "ha");
function saGeom(key) {
  if (saGeomC[key]) return saGeomC[key];
  const F = SAF[key], P = (v) => v / SAU;
  // a floor may carry a room-sized chair of its own (Sydney's Council draws a smaller seat for
  // its small room — never the shared 46x50, which reads oversized beside the other houses)
  const seat = F.seat ?? SA_SEAT;
  // the curves' common centre, each side's (half the gap between them), for the order along the
  // benches (Sydney's Council has no curves — its gangway width stands in)
  const A = P(F.arcs.length ? F.arcs.reduce((t, b) => t + b.a, 0) / F.arcs.length : F.gang ?? 0);
  // the order along the benches: down the government's side, round its curve, across the gangway
  // (its own stretch, 2A long), round the opposition's curve and up its side. A curve seat goes by
  // its angle about its own curve's centre, held to its own side of the gangway
  const Q = (Math.PI / 2) * CHK, GAP = 2 * A, D2R = Math.PI / 180;
  const sideS = (c, x, y) => {
    const right = c.x > 0;
    if (!c.arc && y <= 0) return right ? 2 * Q + GAP - y : y;
    const ang = c.arc ? c.arc.phi[c.arc[right ? "R" : "L"].split(" ").indexOf(c.id)] * D2R : Math.atan2(y, Math.abs(x) - A);
    return right ? 2 * Q + GAP - Math.min(ang, Math.PI / 2) * CHK : Math.min(ang, Math.PI / 2) * CHK;
  };
  const all = saCells(F).map((c) => {
    const x = P(c.x), y = P(c.y);
    // seg: which stretch of bench it's on (a side's straight, its curve, a lone seat), where a row breaks off
    const seg = (c.x > 0 ? 3 : 0) + (c.arc ? 1 : y > 0 ? 2 : 0);
    // (pad: the bench order's clearance past it, for the majority line — round a curve, by its radius)
    const pad = c.arc ? (P(seat.W / 2 + 10) / P(c.arc.r)) * CHK : P(seat.W / 2 + 10);
    return { id: c.id, x, y, fa: c.fa, row: c.row, s: sideS(c, x, y), seg, pad, W: P(seat.W - 4), D: P(seat.D - 6), raw: c };
  });
  const seats = all.sort((p, q) => p.s - q.s || p.row - q.row);
  seats.forEach((c, k) => { c.k = k; });
  const s0 = seats[0].s, s1 = seats[seats.length - 1].s;
  seats.forEach((c) => { c.u = clamp((c.s - s0) / (s1 - s0), 0, 1); });
  const byId = new Map(seats.map((c) => [c.id, c.k]));
  // the ledger's spare desks (Sydney's Council keeps more seats than members): their k's, so the
  // bench fill walks past and they draw as empty outlined seats
  const vacant = new Set((F.vacant ?? []).map((id) => byId.get(id)).filter((k) => k != null));
  const nRows = Math.max(...seats.map((c) => c.row));
  const rows = Array.from({ length: nRows + 1 }, (_, r) => seats.filter((c) => c.row === r));
  // the walkways the majority line threads: inside the front row, between rows, outside the back
  // row, on the straight benches (their distance from the centre line) and round the curves (their
  // radius about the side's centre; the front bench doesn't curve, so round the curves it stands a
  // chair inside the row behind it, and the line runs just inside the inner curve's chairs)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rowX = rows.slice(1).map((r) => mean(r.filter((c) => !c.raw.arc && c.y < 0).map((c) => Math.abs(c.x))));
  const rowR = rows.slice(1).map((r) => { const a = r.filter((c) => c.raw.arc); return a.length ? mean(a.map((c) => P(c.raw.arc.r))) : null; });
  for (let j = rowR.length - 2; j >= 0; j--) if (rowR[j] == null) rowR[j] = rowR[j + 1] - P(seat.D + 14);
  // a floor with no curves (Sydney's Council): the walkways run with the rows' own bookshelves
  if (rowR.every((v) => v == null)) for (let j = 0; j < rowR.length; j++) rowR[j] = rowX[j];
  const walk = (v) => { const w = [v[0] - (v.length > 1 ? (v[1] - v[0]) / 2 : 0.7)]; for (let j = 1; j < v.length; j++) w.push((v[j - 1] + v[j]) / 2); w.push(v[v.length - 1] + 0.75); return w.map((x) => Math.max(0.15, x)); };
  const GS = walk(rowX), GC = walk(rowR);
  const benchPt = (s, k) => {
    if (s <= 0) return [-GS[k], s];
    if (s >= 2 * Q + GAP) return [GS[k], 2 * Q + GAP - s];
    if (s > Q && s < Q + GAP) return [s - Q - A, GC[k]];
    const a = (s < Q ? s : s - GAP) / CHK, c = Math.cos(a);
    return [(s < Q ? -A : A) - GC[k] * c, GC[k] * Math.sin(a)];
  };
  const benchOut = (s) => {
    if (s <= 0) return [-1, 0];
    if (s >= 2 * Q + GAP) return [1, 0];
    if (s > Q && s < Q + GAP) return [0, 1];
    const a = (s < Q ? s : s - GAP) / CHK; return [-Math.cos(a), Math.sin(a)];
  };
  const [rx0, ry0, rx1, ry1] = F.room.map(P);
  saGeomC[key] = {
    key, seats, rows, nRows, bench: seats.filter((c) => c.row > 0 || F.tableSeats), byId, vacant,
    blocSeats: F.blocs ? Object.fromEntries(Object.entries(F.blocs).map(([bloc, ids]) => [bloc, ids.split(" ").map((id) => byId.get(id))])) : null,
    // the bloc labels hang just outside the room's walls
    rOut: rx1 - 0.6, box: { x0: rx0, x1: rx1, y0: ry0, y1: ry1 }, rect: true, cutPad: P(seat.W / 2 + 10),
    arms: false, table: F.lead, chairAt: [0, P(F.chair), Math.PI / 2, 0, P(F.chairW ?? 40), P(F.chairD ?? 38)],
    aisle: P((F.officers[0] + F.straight[0].ys[0]) / 2 + 40), yMid: mean(rows[1].filter((c) => c.y < 0).map((c) => c.y)),
    // the stretch of bench a position along it falls on, as seats' seg (the gangway's -1; a lone seat's curve)
    segAt: (s) => (s <= 0 ? 0 : s < Q ? 1 : s <= Q + GAP ? -1 : s < 2 * Q + GAP ? 4 : 3),
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
  // the room's own chair where the ledger carries one (Sydney's Council's smaller seat)
  const seat = SF.seat ?? SA_SEAT, hw = seat.W / 2 + SA_PAD, hd = seat.D / 2 + SA_PAD;
  for (const side of [-1, 1]) {
    const key = side > 0 ? "R" : "L";
    // down the straight: a run of seats closer than a seat and a half apart is one bench
    for (const r of SF.straight) {
      const ys = r[key].split(" ").map((id, j) => (id && id !== "-" ? r.ys[j] : null));
      const pitch = Math.min(...r.ys.slice(1).map((y, j) => y - r.ys[j]).filter((d) => d > 0));
      let run = null;
      const flush = () => { if (run) rb(side * r.x - hd, run[0] - hw, 2 * hd, run[1] - run[0] + 2 * hw); run = null; };
      for (const [j, y] of ys.entries()) { if (y == null) { flush(); continue; } if (run && (r.breakAfter ? !r.breakAfter.includes(j - 1) : y - run[1] <= pitch * 1.5)) run[1] = y; else { flush(); run = [y, y]; } }
      flush();
    }
    // round the curves: each run a sector of its curve, about that side's own centre — a
    // side's "-" keys stop that side's bench short, as on the straights
    for (const a of SF.arcs) {
      const step = Math.min(...a.phi.slice(1).map((p, j) => p - a.phi[j]));
      const runs = [];
      for (const p of a[key].split(" ").map((id, j) => (id === "-" ? null : a.phi[j]))) { if (p === null) continue; const last = runs[runs.length - 1]; if (last && p - last[1] <= step * 1.5) last[1] = p; else runs.push([p, p]); }
      for (const [p0, p1] of runs) {
        const half = (hw / a.r) / D2R, c = side * a.a;
        // canvas angles: the opposition's quarter runs from the horizontal down; the government's mirrors it
        const A0 = (side > 0 ? p0 - half : 180 - p0 + half) * D2R, A1 = (side > 0 ? p1 + half : 180 - p1 - half) * D2R;
        g.beginPath(); g.arc(c, a.y, a.r + hd, A0, A1, side < 0); g.arc(c, a.y, a.r - hd, A1, A0, side > 0); g.closePath(); g.fill(); g.stroke();
      }
    }
    const rearRuns = new Map();
    for (const q of SF.singles || []) if (q[key]) {
      if (!q.bench) rb(side * q.x - hw, q.y - hd, 2 * hw, 2 * hd);
      else { const run = rearRuns.get(q.bench) || []; run.push(q); rearRuns.set(q.bench, run); }
    }
    for (const run of rearRuns.values()) {
      const xs = run.map((q) => side * q.x), x0 = Math.min(...xs) - hw, x1 = Math.max(...xs) + hw;
      rb(x0, run[0].y - hd, x1 - x0, 2 * hd);
    }
    if (SF.headBenches) {
      const H = SF.headBenches;
      for (const y of H.ys) rb(side > 0 ? H.x0 : -H.x1, y, H.x1 - H.x0, H.depth);
    }
  }
  // the dais, raised above the floor, its step drawn inside — Sydney's Council instead keeps a
  // shallow closed platform at the President's end (its own plan and the chamber photographs:
  // no open U), one piece with its front lip
  if (SF.plat) {
    const { w: pw, y0: py0, y1: py1 } = SF.plat;
    g.beginPath(); if (g.roundRect) g.roundRect(-pw, py0, 2 * pw, py1 - py0, 8); else g.rect(-pw, py0, 2 * pw, py1 - py0);
    g.fillStyle = wood; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-pw + 8, py1 - 10); g.lineTo(pw - 8, py1 - 10); g.stroke();
    const desk = SF.presidentDesk;
    if (desk) { g.fillStyle = bench; rb(-desk.x, desk.y0, 2 * desk.x, desk.y1 - desk.y0, 3); }
  } else {
    const dais = (inset) => { const w = 52 - inset, yt = SF.room[1] + 6 + inset, yc = SF.chair + 12; g.beginPath(); g.moveTo(-w, yt); g.lineTo(w, yt); g.lineTo(w, yc); g.arc(0, yc, w, 0, Math.PI); g.closePath(); };
    dais(0); g.fillStyle = wood; g.fill(); g.stroke();
    dais(7); g.fillStyle = bench; g.fill();
  }
  // the table below it, the officers' chairs at its head; the Mace on the Assembly's — Sydney's
  // Council keeps no clerks' desk by the dais (2026-10-28: its three clerks chair the table's head)
  const [t0, t1, tw] = SF.table ?? [0, 0, 0];
  if (SF.table) {
    g.lineWidth = Math.max(hair, (0.05 * s) / k); g.strokeStyle = wood; g.fillStyle = bench;
    rb(-tw, t0, 2 * tw, t1 - t0, 3);
    g.lineWidth = hair; g.strokeStyle = css(th.line);
  }
  // Sydney's Council's long table: a T the federal House's way but with the wide speaker-side head
  // drawn a touch stronger (hx deep hd), the stem narrowing south and its bar end rounded, a
  // timber rim about a dark burgundy inset, the Black Rod lying across inside the rounded end
  if (SF.ltable) {
    const L = SF.ltable;
    const tPath = (inset) => {
      const r = L.x - inset, hx = L.hx - inset, cy = L.y1 - L.x, y0 = L.y0 + inset, shoulder = L.y0 + L.hd - inset;
      g.beginPath(); g.moveTo(-hx, y0); g.lineTo(hx, y0); g.lineTo(hx, shoulder);
      g.lineTo(r, shoulder); g.lineTo(r, cy); g.arc(0, cy, r, 0, Math.PI); g.lineTo(-r, shoulder);
      g.lineTo(-hx, shoulder); g.closePath();
    };
    const burg = css(mixC(th.floor, [104, 28, 38], th.dark ? 0.55 : 0.78));
    tPath(0); g.fillStyle = wood; g.fill(); g.stroke();
    tPath(6); g.fillStyle = burg; g.fill();
    // Keep only the clerks' raised book rack across the President's end.
    g.fillStyle = wood;
    rb(-L.hx + 12, L.y0 + L.hd - 22, 2 * (L.hx - 12), 13, 2);
    g.strokeStyle = css(th.faint); g.lineWidth = Math.max(hair, (0.05 * s) / k); g.lineCap = "round";
    g.beginPath(); g.moveTo(-24, L.rod); g.lineTo(24, L.rod); g.stroke();
    g.lineCap = "butt"; g.lineWidth = hair; g.strokeStyle = css(th.line);
  }
  // the far wall's transverse backing: straight sections split at the bar, outline only —
  // a physical-layout note, never a member's seat
  if (SF.transverse) {
    const T = SF.transverse;
    for (const [x0, x1] of [[-T.half, -T.gap], [T.gap, T.half]]) {
      g.beginPath(); if (g.roundRect) g.roundRect(x0, T.y0, x1 - x0, T.y1 - T.y0, 4); else g.rect(x0, T.y0, x1 - x0, T.y1 - T.y0);
      g.stroke();
    }
  }
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
  // the officers: the Clerk on the chair's right, the Chairman of Committees, the Deputy Clerk —
  // Sydney's Council chairs its three at the long table's head between platform and table, facing
  // the bar (their short desk by the dais is gone)
  const [oy, odx] = SF.officers, W = P(30) * s, Dp = P(28) * s;
  for (const ox of SF.twoOfficers ? [-odx, odx] : [-odx, 0, odx]) drawChair(g, X(P(ox)), Yp(P(oy)), Math.PI / 2, W, Dp, css(officer), back(officer, 0.18), 1);
  // Sydney's Council keeps the Usher of the Black Rod at the long table's rounded end, on his own chair facing back to the President
  if (SF.usher != null) drawChair(g, X(0), Yp(P(SF.usher)), -Math.PI / 2, W, Dp, css(officer), back(officer, 0.18), 1);
  // The ceremonial vice-regal chair stands behind the President's working chair.
  // A named President, when available in the model, is painted at SF.chair by drawChamber.
  if (SF.plat) {
    drawChair(g, X(0), Yp(P(SF.chair)), Math.PI / 2, P(SF.chairW ?? 40) * s, P(SF.chairD ?? 38) * s, css(officer), back(officer, 0.18), 1);
    drawChair(g, X(0), Yp(P(SF.plat.regal)), Math.PI / 2, P(48) * s, P(48) * s, css(officer), back(officer, 0.18), 1);
  }
  // three neutral chairs down each of the long table's flanks, evenly spaced, facing the table
  if (SF.ltable && !SF.tableSeats) {
    const L = SF.ltable, cw = P(20) * s, cd = P(26) * s;
    for (const cx of [-L.cx, L.cx]) for (const cy of L.chairs) drawChair(g, X(P(cx)), Yp(P(cy)), cx < 0 ? 0 : Math.PI, cw, cd, css(officer), back(officer, 0.18), 1);
  }
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  // (no furniture labels: the Council's furniture shows through its shapes — the political
  // labels are the only text on its floor)
}
