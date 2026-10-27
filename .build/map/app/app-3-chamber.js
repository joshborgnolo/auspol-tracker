/* =============================== the chamber ===============================
   The House of Representatives as the chamber is built, after the
   Parliament's seating plan (aph.gov.au): the Speaker's chair on its dais at
   the head of the table, the Clerk and Deputy Clerk below it, the T-shaped
   table with two chairs a side, Hansard's desk at its foot. The front benches
   run down either side of the table; behind them four rows of two-seat
   blocks, then five rows round the far curve, cut by aisles. The government
   sits on the Speaker's right (the reader's left, the Speaker facing down
   the page). Where a seating plan is filed (map/data/seats-<year>.json, from
   .build/map/seating.mjs) every member sits where the plan puts them;
   otherwise each bloc fills the benches from its Speaker's end in the lens's
   order, so on the two-party lens the House reads as a pendulum bent round
   the table. Each member is a chair; empty seats stay empty. The Speaker's
   own seat takes the Speaker's chair. */
const CU = 30; // plan points to a chamber unit
/* @cells-begin – shared with .build/map/seating.mjs, which reads this block as is.
   The chamber's seats in plan points about the centre of the far curve (y down,
   the government's side at negative x), each { id, x, y, fa (the way it faces),
   row (0 the table, 1 the front bench … 5), w (its room along the bench) }. Ids: side L|R, then a<i> the
   front bench's straight arm, t<i> the table, b<row><slot> the side blocks,
   c<row><sector><i> round the curve. */
const CHB = {
  // the front bench's straight arm is one long bench; 20 places along it, room for the most a
  // plan has seated there (19, the opposition in March 2021)
  arm: { x: 110, y0: -362, pitch: 16.9, n: 20 },
  table: { x: 49.6, ys: [-182, -142] },
  blockX: [138, 181, 223, 264], // rows 2 to 5
  tierY: [[-282, -256], [-214, -188], [-146, -120], [-68, -42]], // two seats a block
  R: [91, 138, 180, 222, 264], // the curve's rows
  // each row's sectors round a quarter of the curve: [from, to] degrees below the horizontal, seats
  sectors: [[[4, 82, 6]], [[4, 42, 3], [47, 83, 3]],
    [[3, 22, 2], [25, 43, 2], [47.5, 65.5, 2], [68, 86, 2]],
    [[3, 22, 2], [25, 43, 2], [47.5, 65.5, 2], [68, 86, 2]],
    [[3, 22, 3], [25, 43, 3], [47.5, 65.5, 3], [68, 86, 3]]],
};
function chamberCells() {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, P = side ? "R" : "L", fa = side ? Math.PI : 0;
    for (let i = 0; i < CHB.arm.n; i++) cells.push({ id: `${P}a${i}`, x: sx * CHB.arm.x, y: CHB.arm.y0 + CHB.arm.pitch * i, fa, row: 1, w: CHB.arm.pitch });
    CHB.table.ys.forEach((y, i) => cells.push({ id: `${P}t${i}`, x: sx * CHB.table.x, y, fa, row: 0, w: 26 }));
    CHB.blockX.forEach((bx, k) => CHB.tierY.flat().forEach((y, j) => cells.push({ id: `${P}b${k + 2}${j}`, x: sx * bx, y, fa, row: k + 2, w: 26 })));
    CHB.sectors.forEach((secs, k) => secs.forEach(([a0, a1, n], q) => {
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + 0.5) * (a1 - a0)) / n) * D, r = CHB.R[k];
        const x = sx * r * Math.cos(a), y = r * Math.sin(a);
        cells.push({ id: `${P}c${k + 1}${"abcd"[q]}${i}`, x, y, fa: Math.atan2(-y, -x), row: k + 1, w: ((a1 - a0) * D * r) / n });
      }
    }));
  }
  return cells;
}
const SERJEANT = "Rc5d1"; // the Serjeant-at-Arms's chair, in the curve's last row by the centre aisle
/* @cells-end */
/* Victoria's Legislative Assembly in the federal chamber's idiom (the 60th Parliament's
   own plan — map/data/la-seating-plan-vic-2026-08-11.json — seats members on it): the
   same Speaker's dais and T-table, but three chairs a side at the table (Premier,
   Leader of the House, Deputy Premier against the Opposition Leader, the Deputy
   Leader of the Opposition and the Nationals' leader), three clerks at its head, a
   shorter front bench and one block column fewer — 93 desks and the chair.
   @vic-cells-begin – read as is by .build/map/vic_seating.mjs. */
const VCHB = {
  arm: { x: 110, y0: -362, pitch: 16.9, n: 8 },
  table: { x: 49.6, ys: [-196, -156, -116] },
  blockX: [138, 181, 223],
  tierY: [[-282, -256], [-214, -188], [-146, -120], [-68, -42]],
  R: [91, 138, 180, 222, 264],
  sectors: [[[4, 42, 1], [44, 82, 1]], [[4, 42, 1], [44, 82, 1]], [[4, 42, 1], [44, 82, 1]],
    [[4, 29, 1], [31, 56, 1], [58, 83, 1]], [[4, 29, 1], [31, 56, 1], [58, 83, 1]]],
};
const VIC_SERJEANT = "Rc5c0"; // the Serjeant-at-Arms, at the curve's back by the centre
function vicCells() {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, P = side ? "R" : "L", fa = side ? Math.PI : 0;
    for (let i = 0; i < VCHB.arm.n; i++) cells.push({ id: `${P}a${i}`, x: sx * VCHB.arm.x, y: VCHB.arm.y0 + VCHB.arm.pitch * i, fa, row: 1, w: VCHB.arm.pitch });
    VCHB.table.ys.forEach((y, i) => cells.push({ id: `${P}t${i}`, x: sx * VCHB.table.x, y, fa, row: 0, w: 26 }));
    VCHB.blockX.forEach((bx, k) => VCHB.tierY.flat().forEach((y, j) => cells.push({ id: `${P}b${k + 2}${j}`, x: sx * bx, y, fa, row: k + 2, w: 26 })));
    VCHB.sectors.forEach((secs, k) => secs.forEach(([a0, a1, n], q) => {
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + 0.5) * (a1 - a0)) / n) * D, r = VCHB.R[k];
        const x = sx * r * Math.cos(a), y = r * Math.sin(a);
        cells.push({ id: `${P}c${k + 1}${"abcd"[q]}${i}`, x, y, fa: Math.atan2(-y, -x), row: k + 1, w: ((a1 - a0) * D * r) / n });
      }
    }));
  }
  return cells;
}
/* @vic-cells-end */
/* New South Wales' Legislative Assembly in the same idiom (the 1843 chamber is Victoria's
   sister: a horseshoe of benches about a central table) — but Sydney's table is one long
   rectangle, no T head, no Hansard desk at its foot, and no members sit at it at all: two
   clerks alone chair at its head, Speaker-side (the parliament's own chamber layout,
   parliament.nsw.gov.au's the-chamber page and seating-layout diagram). The floor's benches
   as the chamber's own seating plan draws them (2026-10-27, the user's pass over the plan):
   NO row runs up beside the Speaker's dais — each side has TWO straight files of twelve
   running parallel to the table from its shoulders down, the Premier and the Leader of the
   Opposition heading the inner one (nothing sits level with the dais), and the far end turns
   in THREE curved rows of 6, 9 and 6 a side. 92 desks for the 92 members exactly; the
   Serjeant-at-Arms's chair stands centred behind the curve, "the chair separating the
   benches" (the parliament's own description).
   @nsw-cells-begin */
const NSWB = {
  leadY: -268.2, // the leaders' desks, heading the inner straight row at the table's shoulder
  arm: { x: 130, y0: -250, pitch: 18.2, n: 12 }, // the inner straight row, continuing the inner curve's radius
  row2X: 172, // the outer straight row, continuing the middle curve's radius (2026-10-27 user call)
  R: [130, 172, 214], // the curve's three rows
  sectors: [[[6, 84, 6]], [[5, 85, 9]], [[7, 83, 6]]],
};
const NSW_SERJEANT = "Rsj0"; // the Serjeant-at-Arms, centred at the curve's back
function nswCells() {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, P = side ? "R" : "L", fa = side ? Math.PI : 0;
    cells.push({ id: `${P}t0`, x: sx * NSWB.arm.x, y: NSWB.leadY, fa, row: 1, w: NSWB.arm.pitch });
    for (let i = 0; i < NSWB.arm.n; i++) cells.push({ id: `${P}a${i}`, x: sx * NSWB.arm.x, y: NSWB.arm.y0 + NSWB.arm.pitch * i, fa, row: 1, w: NSWB.arm.pitch });
    for (let i = 0; i < NSWB.arm.n; i++) cells.push({ id: `${P}b${i}`, x: sx * NSWB.row2X, y: NSWB.arm.y0 + NSWB.arm.pitch * i, fa, row: 2, w: NSWB.arm.pitch });
    NSWB.sectors.forEach((secs, k) => secs.forEach(([a0, a1, n], q) => {
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + 0.5) * (a1 - a0)) / n) * D, r = NSWB.R[k];
        const x = sx * r * Math.cos(a), y = r * Math.sin(a);
        cells.push({ id: `${P}c${k + 3}${"abcd"[q]}${i}`, x, y, fa: Math.atan2(-y, -x), row: k + 3, w: ((a1 - a0) * D * r) / n });
      }
    }));
  }
  cells.push({ id: NSW_SERJEANT, x: 0, y: 242, fa: -Math.PI / 2, row: 5, w: 26 });
  return cells;
}
/* @nsw-cells-end */

// position along the benches: down the government's side, round the curve, up the opposition's
// (a chamber whose two curves each turn about their own side's centre, a out from the middle, as
// South Australia's do, measures each round its own)
const CHK = 6;
const benchS = (x, y, a = 0) => (y > 0 ? Math.atan2(y, -(x < 0 ? x + a : x - a)) * CHK : x < 0 ? y : Math.PI * CHK - y);
/* a chamber's geometry: its seats in bench order (s, then row), its rows, the box it's framed in,
   and what differs between the House and the Senate — the presiding officer's chair, the table's
   two chairs, the walkways the majority line threads, the furniture. The Senate's comes from
   senateGeom (app-3b-senate.js), South Australia's two chambers and New South Wales' Council
   from saGeom (app-3c-sa.js) */
let chGeomC = null, vicGeomC = null, nswGeomC = null;
const chamberGeom = (m) => (m && m.year === "vic22" ? vicGeom() : m && m.year === "nsw23" && m.house !== "senate" ? nswGeom() : m && STATE_YEARS.has(m.year) ? saGeom(saFloorOf(m)) : m && m.house === "senate" ? senateGeom() : houseGeom());
// the House's layout builder, shared by Victoria's and New South Wales' variants: the extra block
// carries what differs — the table's chairs, the head clerks, and for Spring Street the clean
// table, for Macquarie Street the rectangular one with no Hansard
function geomFor(cellsOf, serjeantId, B, extra) {
  const all = cellsOf().map((c) => {
    const x = c.x / CU, y = c.y / CU;
    const s = benchS(x, y);
    // each chair as wide as its seat allows (3pt clear of the next), as deep as its bench
    const W = clamp(c.w - 3, 13.5, 30) / CU, D = (c.row === 1 && y < 0 ? 24 : 23) / CU;
    return { id: c.id, x, y, fa: c.fa, row: c.row, s, W, D };
  });
  const seats = all.filter((c) => c.id !== serjeantId).sort((p, q) => p.s - q.s || p.row - q.row);
  const s0 = seats[0].s, s1 = seats[seats.length - 1].s;
  seats.forEach((c, k) => { c.k = k; c.u = (c.s - s0) / (s1 - s0); });
  const rows = [0, 1, 2, 3, 4, 5].map((r) => seats.filter((c) => c.row === r));
  return { seats, rows, nRows: 5, bench: seats.filter((c) => c.row > 0), byId: new Map(seats.map((c) => [c.id, c.k])),
    serjeant: all.find((c) => c.id === serjeantId), rOut: B.R[4] / CU, src: B,
    box: { x0: -9.55, x1: 9.55, y0: -13.25, y1: 9.55 },
    arms: true, ...extra, chairAt: SPEAKER_AT, aisle: CH_AISLE, yMid: -6.6,
    benchPt, benchOut, furniture: drawChamberFurniture };
}
function houseGeom() {
  if (!chGeomC) chGeomC = geomFor(chamberCells, SERJEANT, CHB, { table: ["Lt0", "Rt0"], officers: [[-19, -285.5, Math.PI / 2], [18, -285.5, Math.PI / 2]] });
  return chGeomC;
}
function vicGeom() {
  if (!vicGeomC) vicGeomC = geomFor(vicCells, VIC_SERJEANT, VCHB, { table: ["Lt0", "Rt0", "Lt1", "Rt1", "Lt2", "Rt2"], vic: true,
    officers: [[-24, -285.5, Math.PI / 2], [0, -285.5, Math.PI / 2], [24, -285.5, Math.PI / 2]] });
  return vicGeomC;
}
function nswGeom() {
  // no table chairs (its leaders top the front benches); the two clerks chair at the table's head
  if (!nswGeomC) nswGeomC = geomFor(nswCells, NSW_SERJEANT, NSWB, { table: ["Lt0", "Rt0"], nsw: true,
    rOut: NSWB.R[2] / CU, // the outer of its three curve rows (geomFor reads R[4], a House index)
    officers: [[-19, -285.5, Math.PI / 2], [18, -285.5, Math.PI / 2]] });
  return nswGeomC;
}
// the walkways between rows (0 inside the front bench, 5 outside the back row), on the straight and round the curve
const CH_GS = [96, 124, 159.5, 202, 243.5, 279].map((v) => v / CU);
const CH_GC = [77, 114.5, 159, 201, 243, 279].map((v) => v / CU);
function benchPt(s, k) {
  if (s <= 0) return [-CH_GS[k], s];
  if (s >= Math.PI * CHK) return [CH_GS[k], Math.PI * CHK - s];
  const a = s / CHK; return [-CH_GC[k] * Math.cos(a), CH_GC[k] * Math.sin(a)];
}
// outward from the benches at position s
function benchOut(s) {
  if (s <= 0) return [-1, 0];
  if (s >= Math.PI * CHK) return [1, 0];
  const a = s / CHK; return [-Math.cos(a), Math.sin(a)];
}

// blocs, in the order they sit from the Speaker's right round to the left
function chamberBlocs(m) {
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp";
  const cross = gov === "alp" ? ["grn", "ind", "csa", "oth", "onp"] : ["onp", "oth", "csa", "ind", "grn"];
  return { gov, opp, cross };
}
// the lens's ordering key, read from the bloc's own side
function chamberKey(m, d, bloc) {
  const own = (v) => (v == null ? null : bloc === "lnp" ? 100 - v : v);
  switch (S.lens) {
    case "tpp":
      if (S.tppMode === "swing") return d.tppSw == null ? null : bloc === "lnp" ? -d.tppSw : d.tppSw;
      return bloc === "alp" || bloc === "lnp" ? own(d.tpp) : d.winPct;
    case "fp": case "senate": return divValue(m, d.i);
    case "flow": case "informal": case "seifa": { const v = divValue(m, d.i); return v == null ? null : v + (S.lens === "seifa" && !isDemo() && d.seifa[S.index] ? d.seifa[S.index].pct / 100 : 0); }
    case "cls": return d.cls ? 10 - CLS.indexOf(d.cls) + d.winPct / 1000 : null;
    default: return d.winPct;
  }
}
/* the Prime Minister and the Leader of the Opposition sit at the table, government side and
   opposition side, as the House sat after each election (the 2013 and 2016 plans print them on the
   front bench instead and leave the table's chairs empty; March 2021's has only Morrison there) */
const LEADERS = { 2004: ["Bennelong", "Werriwa"], 2007: ["Griffith", "Bradfield"], 2010: ["Lalor", "Warringah"],
  2013: ["Warringah", "Maribyrnong"], 2016: ["Wentworth", "Maribyrnong"], 2019: ["Cook", "Grayndler"],
  2022: ["Grayndler", "Dickson"], 2025: ["Grayndler", "Farrer"], now: ["Grayndler", "Hume"],
  // South Australia's Premier and Leader of the Opposition, at the front benches' seats nearest the Speaker
  sa22: ["Croydon", "Black"], sa26: ["Croydon", "Schubert"],
  // New South Wales' (Minns at Kogarah, Speakman at Cronulla)
  nsw23: ["Kogarah", "Cronulla"],
  // Victoria's, three a side at the table in the 60th Parliament's plan: the Premier, the Leader
  // of the House and the Deputy Premier facing the Opposition Leader, the Deputy Leader of the
  // Opposition and the Nationals' leader (Carroll, Carbines, Williams against Wilson, Southwick, O'Brien)
  vic22: ["Niddrie", "Kew", "Ivanhoe", "Caulfield", "Dandenong", "Gippsland South"] };
/* seating plan or sorted: a year with a filed plan opens on it under the Winner lens and
   sorted under the others, until the reader picks one (S.seat) */
const seatMode = (m) => (!m.seating ? "sort" : S.seat || ((m.house === "senate" ? S.senLens === "party" : S.lens === "winner") ? "plan" : "sort"));
function chamberOrder(m) {
  const plan = seatMode(m) === "plan" ? m.seating : null;
  const key = plan ? `${m.year}|plan` : m.house === "senate" ? `${m.year}|${S.senLens}` : `${m.year}|${S.lens}|${S.tppMode}|${S.fpMode}|${S.party}|${S.from}|${S.vs}|${S.index}`;
  if (m._chKey === key) return m._ch;
  const geom = chamberGeom(m);
  const keyOf = m.house === "senate" ? senateKey : chamberKey;
  const { gov, opp, cross } = chamberBlocs(m);
  const members = m.divs.filter((d) => d.i !== m.speaker);
  const byKey = (bloc) => (p, q) => {
    const a = keyOf(m, p, bloc), b = keyOf(m, q, bloc);
    if (a == null && b == null) return p.n.localeCompare(q.n);
    if (a == null) return 1;
    if (b == null) return -1;
    return b - a;
  };
  const G = members.filter((d) => holdFam(d.hold) === gov).sort(byKey(gov));
  const O = members.filter((d) => holdFam(d.hold) === opp).sort(byKey(opp));
  const C = [];
  const groups = [];
  for (const f of cross) {
    const xs = members.filter((d) => holdFam(d.hold) === f).sort(byKey(f));
    if (xs.length) groups.push({ fam: f, n: xs.length });
    C.push(...xs);
  }
  // the leaders, each at their side's table chair (when they lead the bloc on that side)
  const table = geom.table.map((id) => geom.byId.get(id));
  const lead = (m.leaders || LEADERS[m.year] || []).map((n, s) => { const i = typeof n === "number" ? n : m.byName.get(n); return i != null && holdFam(m.divs[i].hold) === (s < table.length / 2 ? gov : opp) ? i : null; });
  // each member's seat (an index into geom.seats)
  const at = new Map();
  if (plan) {
    const taken = new Set();
    for (const d of members) { const k = geom.byId.get(plan.at[d.n]); if (k != null && !taken.has(k)) { at.set(d.i, k); taken.add(k); } }
    // anyone the plan doesn't seat takes the first free bench seat from their side's Speaker end
    const B = geom.bench;
    for (const d of members) if (!at.has(d.i)) {
      const back = holdFam(d.hold) === opp;
      for (let j = 0; j < B.length; j++) { const c = B[back ? B.length - 1 - j : j]; if (!taken.has(c.k)) { at.set(d.i, c.k); taken.add(c.k); break; } }
    }
    // a leader the plan prints on the bench moves to their table chair, if the plan left it empty
    lead.forEach((i, s) => { if (i != null && at.get(i) !== table[s] && !taken.has(table[s])) at.set(i, table[s]); });
  } else {
    // no plan: the government from its Speaker's end, the crossbench after it, the opposition from
    // the other end; the empty seats fall between the crossbench and the opposition, so the
    // majority line never has to cross them
    // the leaders at the table
    // (the states' table chairs are desks on the front bench: a leader's is theirs alone)
    const held = new Set(lead.map((i, s) => (i != null ? table[s] : null)));
    const B = geom.bench.filter((c) => !held.has(c.k)), onBench = (d) => !lead.includes(d.i);
    lead.forEach((i, s) => { if (i != null) at.set(i, table[s]); });
    const Gb = G.filter(onBench), Ob = O.filter(onBench);
    Gb.forEach((d, k) => at.set(d.i, B[k].k));
    C.forEach((d, k) => at.set(d.i, B[Gb.length + k].k));
    Ob.forEach((d, k) => at.set(d.i, B[B.length - 1 - k].k));
  }
  const order = [...G, ...C, ...O].map((d) => d.i);
  const sp = m.divs[m.speaker];
  // (the Senate counts its 76 seats, a vacant one among them)
  const N = m.seatsN || m.divs.length, maj = Math.floor(N / 2) + 1;
  m._ch = { order, at, gov, opp, nGov: G.length, nCross: C.length, nOpp: O.length, groups, maj, plan: !!plan,
    majAt: maj - (sp && holdFam(sp.hold) === gov ? 1 : 0) };
  m._chKey = key;
  return m._ch;
}
/* the majority line: the first majAt members along the benches (front row first where rows sit
   level) hold the government's majority; in each row the line passes through the gap after the
   last of them, so it runs between chairs, never across one. Returns each row's cut position. */
function majorityCuts(ch, geom) {
  const sat = [...ch.at.values()].map((k) => geom.seats[k]).sort((p, q) => p.s - q.s || p.row - q.row);
  if (ch.majAt <= 0 || ch.majAt >= sat.length) return null;
  const inside = new Set(sat.slice(0, ch.majAt).map((c) => c.k)), sStar = sat[ch.majAt - 1].s;
  const cuts = [], free = [];
  // (past a row's end, clear of its last chair: the House's chairs are smaller than the states')
  const pad = geom.cutPad || 0.4;
  for (let r = 1; r <= geom.nRows; r++) {
    const row = geom.rows[r];
    let L = -1;
    row.forEach((c, j) => { if (inside.has(c.k)) L = j; });
    if (L < 0) row.forEach((c, j) => { if (c.s < sStar) L = j; });
    let a = row[L], b = row[L + 1];
    // on the states' floors a row breaks off (a front bench that doesn't curve, a straight bench
    // meeting its curve, the gangway between the curves): where the cut falls in such a break it
    // crosses open floor, so it may sit anywhere in it, and goes where the rows with chairs at the
    // line put it
    // line put it (a curve's chairs clear by their own pad: the same gap is more of the angle on a
    // tight curve)
    if (geom.rect && (!a || !b || a.seg !== b.seg)) { free.push([cuts.length, a ? a.s + (a.pad || pad) : -Infinity, b ? b.s - (b.pad || pad) : Infinity]); cuts.push(null); continue; }
    cuts.push(a && b ? (a.s + b.s) / 2 : a ? a.s + pad : b.s - pad);
  }
  const tight = cuts.filter((c) => c != null), to = tight.length ? tight.reduce((x, y) => x + y, 0) / tight.length : sStar;
  for (const [r, lo, hi] of free) cuts[r] = clamp(to, lo, hi);
  // front rows with no chairs where the line falls (a front bench that stops short of the curves)
  // it doesn't cross at all: it starts behind them
  // (a lone seat counts with its side's curve; the gangway runs between the curves)
  const stretch = (g) => g - (g % 3 === 2 ? 1 : 0);
  const meets = (row, s) => { const at = geom.segAt(s); return row.some((c) => (at < 0 ? stretch(c.seg) % 3 === 1 : stretch(c.seg) === at)); };
  if (geom.rect) for (let r = 0; r < cuts.length - 1 && !meets(geom.rows[r + 1], cuts[r]); r++) cuts[r] = null;
  return cuts;
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
  const arms = { L: [], R: [] };
  for (const [i, k] of ch.at) {
    const st = geom.seats[k];
    if (geom.arms && /^[LR]a\d/.test(st.id)) { arms[st.id[0]].push([i, st]); continue; }
    pos.set(m.divs[i].n, [st.x, st.y, st.fa, st.u, st.W, st.D]);
  }
  // the front bench's arm is one long bench: whoever sits there spreads evenly along it, in order,
  // each chair as wide as the share allows, as the plans print them
  const A = geom.src ? geom.src.arm : CHB.arm, top = A.y0 - A.pitch / 2, len = A.pitch * A.n;
  for (const list of Object.values(arms)) {
    list.sort((a, b) => a[1].y - b[1].y);
    const p = len / Math.max(list.length, 1), W = clamp(p - 3, 13.5, 21) / CU;
    list.forEach(([i, st], j) => pos.set(m.divs[i].n, [st.x, (top + p * (j + 0.5)) / CU, st.fa, st.u, W, st.D]));
  }
  return pos;
}
function startChamberGlide() {
  if (reduceMotion || !chLast.size) return;
  chAnim = { from: new Map(chLast), t0: performance.now(), dur: 680 };
  schedule();
}
const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

function drawChair(g, x, y, fa, w, d, fill, backFill, alpha) {
  g.save(); g.translate(x, y); g.rotate(fa); g.globalAlpha *= alpha;
  const r = Math.min(w, d) * 0.24;
  g.beginPath(); if (g.roundRect) g.roundRect(-d / 2, -w / 2, d, w, r); else g.rect(-d / 2, -w / 2, d, w);
  g.fillStyle = fill; g.fill();
  // the backrest
  const bd = d * 0.3;
  g.beginPath(); if (g.roundRect) g.roundRect(-d / 2, -w / 2, bd, w, [r, 0, 0, r]); else g.rect(-d / 2, -w / 2, bd, w);
  g.fillStyle = backFill; g.fill();
  g.restore();
}
// the open aisle on the centre line, between the Hansard desk and the back rows' inner ends
const CH_AISLE = 52 / CU;
const SPEAKER_AT = [0, -365 / CU, Math.PI / 2, 0, 27 / CU, 24 / CU];

/* the room: the floor, the benches and their empty seats, the dais, the table, the officers' chairs */
function drawChamberFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, P = (v) => v / CU;
  const rr = (x0, y0, x1, y1, r) => { g.beginPath(); if (g.roundRect) g.roundRect(X(P(x0)), Yp(P(y0)), P(x1 - x0) * s, P(y1 - y0) * s, r); else g.rect(X(P(x0)), Yp(P(y0)), P(x1 - x0) * s, P(y1 - y0) * s); };
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  // the floor
  const FR = P(282), top = P(-380);
  g.beginPath(); g.moveTo(X(-FR), Yp(top)); g.lineTo(X(-FR), Yp(0)); g.arc(X(0), Yp(0), FR * s, Math.PI, 0, true); g.lineTo(X(FR), Yp(top)); g.closePath();
  g.fillStyle = css(th.floor); g.fill();
  // the benches (the House's plan, or Victoria's of it; Macquarie Street's pairs of
  // straight files flank the table and three curved rows close the floor, nothing between
  // them and the dais)
  g.fillStyle = bench;
  const B = geom.src, D = Math.PI / 180;
  for (const sx of [-1, 1]) {
    const lo = (a, b) => [Math.min(a, b), Math.max(a, b)];
    { const [x0, x1] = lo(sx * (B.arm.x - 13), sx * (B.arm.x + 13)); rr(x0, B.arm.y0 - 12, x1, B.arm.y0 + B.arm.pitch * (B.arm.n - 1) + 12, 2); g.fill(); g.stroke(); }
    if (B.row2X !== undefined) { const [x0, x1] = lo(sx * (B.row2X - 13), sx * (B.row2X + 13)); rr(x0, B.arm.y0 - 12, x1, B.arm.y0 + B.arm.pitch * (B.arm.n - 1) + 12, 2); g.fill(); g.stroke(); }
    for (const bx of B.blockX ?? []) for (const [t0, t1] of B.tierY) { const [x0, x1] = lo(sx * (bx - 13.5), sx * (bx + 13.5)); rr(x0, t0 - 14, x1, t1 + 14, 2); g.fill(); g.stroke(); }
    B.sectors.forEach((secs, k) => secs.forEach(([a0, a1]) => {
      const r0 = P(B.R[k] - 13.5) * s, r1 = P(B.R[k] + 13.5) * s;
      // angles on the canvas: the government's quarter runs from pi back towards pi/2, the opposition's from 0 to pi/2
      const A0 = sx < 0 ? Math.PI - a0 * D : a0 * D, A1 = sx < 0 ? Math.PI - a1 * D : a1 * D;
      g.beginPath(); g.arc(X(0), Yp(0), r1, A0, A1, sx < 0); g.arc(X(0), Yp(0), r0, A1, A0, sx > 0); g.closePath(); g.fill(); g.stroke();
    }));
    // the officials' boxes behind the front bench, on a rail
    for (const cx of [222.9, 189.6, 147.7]) { const [x0, x1] = lo(sx * (cx - 12), sx * (cx + 12)); rr(x0, -373, x1, -322, 2); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(X(P(sx * 236)), Yp(P(-318))); g.lineTo(X(P(sx * 121)), Yp(P(-318))); g.lineWidth = Math.max(1, s * 0.07); g.strokeStyle = wood; g.stroke(); g.lineWidth = 1; g.strokeStyle = css(th.line);
  }
  // the Speaker's dais, raised above the floor, its step drawn inside
  const dais = (inset) => { const w = 34 - inset, yt = -393 + inset, yc = -349; g.beginPath(); g.moveTo(X(P(-w)), Yp(P(yt))); g.lineTo(X(P(w)), Yp(P(yt))); g.lineTo(X(P(w)), Yp(P(yc))); g.arc(X(0), Yp(P(yc)), P(w) * s, 0, Math.PI); g.closePath(); };
  dais(0); g.fillStyle = wood; g.fill(); g.stroke();
  dais(5); g.fillStyle = bench; g.fill();
  // the table: a T, the wider head towards the Speaker; its panels, and the mace at the far
  // end (at Sydney's Assembly the table's head lies away from the Speaker) — New South
  // Wales' Assembly's is one clean rectangle (no T head), and its Hansard sits nowhere near it
  g.beginPath();
  for (const [x, y] of (geom.nsw ? [[-45.8, -268.6], [44.3, -268.6], [44.3, -110], [-45.8, -110]]
    : [[-45.8, -268.6], [44.3, -268.6], [44.3, -215.2], [35, -215.2], [35, -110], [-36.6, -110], [-36.6, -215.2], [-45.8, -215.2]])) g.lineTo(X(P(x)), Yp(P(y)));
  g.closePath(); g.fillStyle = bench; g.fill(); g.lineWidth = Math.max(1, s * 0.05); g.strokeStyle = wood; g.stroke();
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  // the House's table is panelled and grooved for the mace; Spring Street's and Macquarie
  // Street's tops are one clean sheet
  if (!geom.vic && !geom.nsw) {
    g.beginPath();
    for (const x of [-15.5, 14.5]) { g.moveTo(X(P(x)), Yp(P(-266))); g.lineTo(X(P(x)), Yp(P(-218))); }
    g.moveTo(X(P(-0.8)), Yp(P(-212))); g.lineTo(X(P(-0.8)), Yp(P(-113)));
    for (const y of [-180, -145]) { g.moveTo(X(P(-34)), Yp(P(y))); g.lineTo(X(P(32.5)), Yp(P(y))); }
    g.stroke();
  }
  if (s > 9) {
    const my = -123;
    g.strokeStyle = css(th.faint); g.lineWidth = Math.max(1, s * 0.07); g.lineCap = "round";
    g.beginPath(); g.moveTo(X(P(-19)), Yp(P(my))); g.lineTo(X(P(17)), Yp(P(my))); g.stroke();
    g.beginPath(); g.arc(X(P(-19)), Yp(P(my)), s * 0.12, 0, Math.PI * 2); g.fillStyle = css(th.faint); g.fill();
    g.lineCap = "butt"; g.lineWidth = 1; g.strokeStyle = css(th.line);
  }
  // Hansard's desk at the table's foot (the Assembly in Sydney has none)
  if (!geom.nsw) { rr(-31.5, -63, 31.5, -34, 2); g.fillStyle = wood; g.fill(); g.stroke(); }
  // the empty seats, outlined only, so they never read as a member's chair (a dimmed one is filled)
  g.strokeStyle = css(mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24)); g.lineWidth = 1;
  for (const c of geom.seats) {
    // the front bench's arms are one long bench, not places: only the seats elsewhere stand empty
    if ((opts.occupied && opts.occupied.has(c.k)) || /^[LR]a\d/.test(c.id)) continue;
    const w = c.W * s, d = c.D * s, r = Math.min(w, d) * 0.24;
    g.save(); g.translate(X(c.x), Yp(c.y)); g.rotate(c.fa);
    g.beginPath(); if (g.roundRect) g.roundRect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1, r); else g.rect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1);
    g.stroke(); g.restore();
  }
  g.strokeStyle = css(th.line);
  const W = (20 / CU) * s, Dp = (18 / CU) * s;
  // the officers: the Clerks at the table's head (two of the House and of Sydney's Assembly,
  // three of Spring Street's), Hansard's two reporters, the Serjeant-at-Arms
  const sj = geom.serjeant;
  for (const [x, y, fa] of [...geom.officers, ...(geom.nsw ? [] : [[-19.7, -21.5, -Math.PI / 2], [18.2, -21.5, -Math.PI / 2]]), [sj.x * CU, sj.y * CU, sj.fa]])
    drawChair(g, X(P(x)), Yp(P(y)), fa, W, Dp, css(officer), back(officer, 0.18), 1);
  // the furniture's names, where they fit
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    put("The table", 0, P(geom.nsw ? -189 : -196), P(66));
    if (!geom.nsw) put("Hansard", 0, P(-48.5), P(58));
  }
}

// draw the whole chamber into a context already scaled to CSS pixels
function drawChamber(g, m, w, h, opts) {
  const geom = chamberGeom(m);
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
    return [lerp(fr[0], to[0], q), lerp(fr[1], to[1], q), angLerp(fr[2], to[2], q), to[3], lerp(fr[4] ?? to[4], to[4], q), lerp(fr[5] ?? to[5], to[5], q)];
  };
  const X = F.X, Yp = F.Yp, rO = geom.rOut;
  g.save();
  g.globalAlpha = opts.alpha ?? 1;
  geom.furniture(g, F, geom, { ...opts, occupied: chAnim ? null : new Set(ch.at.values()) });
  // the chairs
  // the list's filters are the House's seats'; the Senate answers only to the chosen state
  const filt = m.house !== "senate" && filtersOn(), sd = opts.sel, hv = opts.hover, stSel = opts.state;
  const pat = opts.pattern;
  const backOf = (c) => towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22);
  const drawn = [];
  const paint = (i, x, y, fa, W, D, sp) => {
    const d = m.divs[i];
    let c = fillDiv(m, i);
    let a = 1;
    if (filt && !passes(m, i)) a = 0.16;
    if (stSel && d.st !== stSel) a = Math.min(a, 0.2);
    if (opts.only != null && i !== opts.only) a = Math.min(a, 0.22);
    if (!c) { drawChair(g, x, y, fa, W, D, pat || css(th.nodata), css(th.hatch), a); }
    else drawChair(g, x, y, fa, W, D, css(c), css(backOf(c)), a);
    drawn.push({ i, x, y, r: Math.max(W, D) * 0.62, fa, W, D, sp });
  };
  ch.order.forEach((i) => {
    const p = pos(m.divs[i].n); if (!p) return;
    paint(i, X(p[0]), Yp(p[1]), p[2], p[4] * s, p[5] * s);
  });
  // the Speaker's (the President's) chair, at the head of the table, facing down the chamber
  const CA = geom.chairAt;
  if (m.speaker != null) paint(m.speaker, X(CA[0]), Yp(CA[1]), CA[2], CA[4] * s, CA[5] * s, true);
  // rings for the hovered and chosen seats
  const ring = (i, lw) => { const q = drawn.find((x) => x.i === i); if (!q) return; g.save(); g.translate(q.x, q.y); g.rotate(q.fa); g.beginPath(); const pd = 2.2; if (g.roundRect) g.roundRect(-q.D / 2 - pd, -q.W / 2 - pd, q.D + 2 * pd, q.W + 2 * pd, 3); else g.rect(-q.D / 2 - pd, -q.W / 2 - pd, q.D + 2 * pd, q.W + 2 * pd); g.lineWidth = lw; g.strokeStyle = css(th.ink); g.stroke(); g.restore(); };
  if (hv != null && hv !== sd) ring(hv, 1.4);
  if (sd != null) ring(sd, 2.2);
  // every label drawn round the chamber claims its box, so the chosen seat's name can find a free spot
  const occ = (opts.keepOut || []).slice();
  const claim = (x, y, wd, ht, align, base) => {
    const x0 = align === "right" ? x - wd : align === "center" ? x - wd / 2 : x;
    const y0 = base === "top" ? y : base === "middle" ? y - ht / 2 : y - ht;
    occ.push({ x0, y0, x1: x0 + wd, y1: y0 + ht });
  };
  // the majority line, threaded between the chairs from the front bench to the back row; only
  // when sorted, where it marks the seats that would fall first (in the seating plan it would
  // only count round from the Speaker's end)
  const cuts = opts.labels !== false && !ch.plan ? majorityCuts(ch, geom) : null;
  if (cuts) {
    const pts = [];
    cuts.forEach((c, k) => {
      if (c == null) return;
      if (cuts[k - 1] != null) { const cp = cuts[k - 1], n = Math.max(2, Math.ceil(Math.abs(c - cp) * 3)); for (let j = 1; j <= n; j++) pts.push(geom.benchPt(lerp(cp, c, j / n), k)); }
      else pts.push(geom.benchPt(c, k));
      pts.push(geom.benchPt(c, k + 1));
    });
    const c5 = cuts[cuts.length - 1], o = geom.benchOut(c5), e = geom.benchPt(c5, geom.nRows), ext = opts.big ? 0.45 : 0.2;
    pts.push([e[0] + o[0] * ext, e[1] + o[1] * ext]);
    g.strokeStyle = css(th.ink); g.lineWidth = opts.big ? 1.5 : 1.2; g.setLineDash(opts.big ? [4, 3] : [3, 2]); g.lineJoin = "round";
    g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(X(x), Yp(y)) : g.moveTo(X(x), Yp(y)))); g.stroke(); g.setLineDash([]);
    const p2 = [e[0] + o[0] * (opts.big ? 0.8 : 0.45), e[1] + o[1] * (opts.big ? 0.8 : 0.45)];
    const below = p2[1] > 1;
    if (!opts.big && s > 6) {
      g.font = `600 11px ${SANS}`; g.fillStyle = css(th.ink2);
      g.textAlign = p2[0] < -0.5 ? "right" : p2[0] > 0.5 ? "left" : "center"; g.textBaseline = below ? "top" : "middle";
      // a chamber filling the width (a phone): shift sideways to stay on the canvas
      const mt = `${ch.maj} for a majority`, tw = g.measureText(mt).width;
      let mx = X(p2[0]);
      if (g.textAlign === "left") mx = Math.min(mx, w - 4 - tw);
      else if (g.textAlign === "right") mx = Math.max(mx, 4 + tw);
      else mx = Math.min(Math.max(mx, 4 + tw / 2), w - 4 - tw / 2);
      g.fillText(mt, mx, Yp(p2[1]));
    }
    if (opts.big) {
      g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2);
      g.textAlign = p2[0] < -0.5 ? "right" : p2[0] > 0.5 ? "left" : below ? "right" : "center"; g.textBaseline = below ? "top" : "middle";
      const mt = `${ch.maj} for a majority`, tw = g.measureText(mt).width;
      let mx = X(p2[0]) + (below && Math.abs(p2[0]) <= 0.5 ? -6 : 0), my = Yp(p2[1]);
      // a chamber filling the width (a phone): kept on screen, slid down off the floor
      const x0 = () => (g.textAlign === "right" ? mx - tw : g.textAlign === "center" ? mx - tw / 2 : mx);
      if (x0() < 4) {
        mx += 4 - x0();
        const floor = (px, py) => { const u = (px - F.ox) / s, v = (py - F.oy) / s; return geom.rect ? saOnFloor(geom, u, v) : v > 0 && Math.hypot(u, v) <= rO + 0.5; };
        const top = g.textBaseline === "top" ? 0 : -8;
        while (my < h - 18 && [x0(), x0() + tw / 2, x0() + tw].some((px) => floor(px, my + top) || floor(px, my + top + 15))) my += 2;
      }
      g.fillText(mt, mx, my);
      claim(mx, my, tw, 16, g.textAlign, g.textBaseline);
      // the dashed line itself, beyond the benches
      const ex = X(e[0]), ey = Yp(e[1]), fx = X(p2[0]), fy = Yp(p2[1]);
      occ.push({ x0: Math.min(ex, fx) - 3, y0: Math.min(ey, fy) - 3, x1: Math.max(ex, fx) + 3, y1: Math.max(ey, fy) + 3 });
    }
  }
  // the blocs' names and numbers, outside the benches
  if (opts.big) {
    const fig = (txt, col, x, y, align) => { g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `500 30px ${SANS}`; g.fillStyle = css(col); g.fillText(txt, x, y); };
    const lab = (txt, x, y, align) => { g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `600 13px ${SANS}`; g.fillStyle = css(th.ink); g.fillText(txt, x, y); };
    const govName = blocName(m, ch.gov), oppName = blocName(m, ch.opp);
    const yMid = Yp(geom.yMid);
    const room = X(-rO - 0.8);
    // no room beside the benches: the blocs head the chamber, either side of the Speaker
    let bandRoom = null;
    const band = room <= 70 && F.oy + geom.box.y0 * s >= 59;
    if (band) {
      const y0 = Yp(geom.box.y0);
      const spFam = m.divs[m.speaker] && holdFam(m.divs[m.speaker].hold);
      // the roles go first when the Speaker's name would touch them
      g.font = `400 12px ${SANS}`;
      const half = X(0) - X(geom.box.x0), need = (g.measureText(presiding(m).name || "").width) / 2 + 10;
      const nGov = String(ch.nGov + (spFam === ch.gov ? 1 : 0)), nOpp = String(ch.nOpp + (spFam === ch.opp ? 1 : 0));
      g.font = `500 24px ${SANS}`; const wNum = Math.max(g.measureText(nGov).width, g.measureText(nOpp).width);
      g.font = `400 12px ${SANS}`; const withRole = half - wNum - 5 - g.measureText("Government").width >= need;
      const bandLabel = (name, n, fam, role, x, align) => {
        if (!withRole) role = "";
        lab(name, x, y0 - 34, align);
        g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `500 24px ${SANS}`; g.fillStyle = css(th.party[fam]); g.fillText(n, x, y0 - 9);
        const wn = g.measureText(n).width;
        g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3); g.fillText(role, align === "left" ? x + wn + 5 : x - wn - 5, y0 - 9);
        const wr = g.measureText(role).width;
        g.font = `600 13px ${SANS}`; const wd = Math.max(g.measureText(name).width, wn + 5 + wr);
        claim(x, y0 - 48, wd, 44, align, "top");
        return wd;
      };
      const wl = bandLabel(govName, nGov, ch.gov, "Government", X(geom.box.x0), "left");
      const wr = bandLabel(oppName, nOpp, ch.opp, "Opposition", X(geom.box.x1), "right");
      bandRoom = Math.min(X(0) - X(geom.box.x0) - wl, X(geom.box.x1) - X(0) - wr) * 2 - 16;
      // the phone band holds no side column: name the crossbench over the Speaker's block —
      // it can outnumber the opposition and the key below was never meant to carry it alone
      if (ch.nCross) {
        const ct = `Crossbench ${ch.nCross}`;
        g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.font = `600 11px ${SANS}`; g.fillStyle = css(th.ink2);
        // it shares the band with the Speaker's two lines below: at y0-46 its ink
        // bottom sat 3px off the Speaker's cap line and the pair read as one - lift
        // it (the arc chambers' y0 is a fixed 62, so the top stays in-canvas)
        g.fillText(ct, X(0), y0 - 50);
        claim(X(0), y0 - 60, Math.max(g.measureText(ct).width, 40), 14, "center", "top");
      }
    }
    if (room > 70) {
      const blocLabel = (name, n, fam, role, x, align) => {
        lab(name, x, yMid - 34, align); fig(n, th.party[fam], x, yMid, align);
        g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = align; g.fillText(role, x, yMid + 18);
        g.font = `600 13px ${SANS}`; let wd = g.measureText(name).width;
        g.font = `500 30px ${SANS}`; wd = Math.max(wd, g.measureText(n).width);
        g.font = `400 12px ${SANS}`; wd = Math.max(wd, g.measureText(role).width);
        claim(x, yMid - 48, wd, 72, align, "top");
      };
      const spFam = m.divs[m.speaker] && holdFam(m.divs[m.speaker].hold);
      blocLabel(govName, String(ch.nGov + (spFam === ch.gov ? 1 : 0)), ch.gov, "Government", X(-rO - 0.95), "right");
      blocLabel(oppName, String(ch.nOpp + (spFam === ch.opp ? 1 : 0)), ch.opp, "Opposition", X(rO + 0.95), "left");
    }
    if (ch.nCross) {
      // the crossbench's name and make-up in the column beside the chamber, on the side its chairs
      // lean to, under that side's bloc label; never under the chamber, so where they sit can't
      // change the room the chamber is drawn in
      let mx = 0, my = 0, n = 0;
      for (const i of ch.order) { const d = m.divs[i]; if (holdFam(d.hold) === ch.gov || holdFam(d.hold) === ch.opp) continue; const c = geom.seats[ch.at.get(i)]; mx += c.x; my += c.y; n++; }
      mx /= n; my /= n;
      const side0 = mx < 0 ? "right" : "left";
      // wrap the make-up to the room on that side, and find where the block's box falls
      const lay = (side, by, mode) => {
        const bx = X(side === "left" ? rO + 0.95 : -rO - 0.95);
        const maxW = Math.max(120, side === "left" ? w - bx - 4 : bx - 4);
        g.font = `400 12px ${SANS}`;
        // one middot-joined line if the whole make-up fits; otherwise a
        // stacked list, one party to a line — packing two to a line leaves a
        // ragged ladder ("Centre Alliance 1 · Greens 1" under two lone lines),
        // so it's the last resort, for when the stack is too tall to fit
        const parts = crossParts(m, ch);
        const one = parts.join(" · ");
        let lines;
        if (mode === "one") lines = g.measureText(one).width <= maxW ? [one] : null;
        else if (mode === "stack") lines = parts.length > 1 ? parts : null;
        else {
          lines = []; let line = "";
          for (const p of parts) { const t = line ? line + " · " + p : p; if (g.measureText(t).width > maxW && line) { lines.push(line); line = p; } else line = t; }
          if (line) lines.push(line);
          if (lines.length < 2 || lines.length >= parts.length) lines = null;
        }
        if (!lines) return null;
        let wMax = 0;
        for (const l of lines) wMax = Math.max(wMax, g.measureText(l).width);
        g.font = `600 13px ${SANS}`; wMax = Math.max(wMax, g.measureText(`Crossbench ${ch.nCross}`).width + 10);
        const x0 = side === "left" ? bx : bx - wMax, ht = 17 + lines.length * 15;
        // no room beside the chamber on a narrow screen: the key below gives the counts
        const room = (side === "left" ? w - bx : bx) >= wMax + 4;
        // clear of the other labels, and off the chamber's floor (a phone has no room beside it)
        const onFloor = (px, py) => { const u = (px - F.ox) / s, v = (py - F.oy) / s; return geom.rect ? saOnFloor(geom, u, v) : v <= 0 ? v >= geom.box.y0 && Math.abs(u) <= rO + 0.5 : Math.hypot(u, v) <= rO + 0.5; };
        const clear = by + ht <= h - 2 && !occ.some((o) => x0 < o.x1 + 4 && x0 + wMax > o.x0 - 4 && by < o.y1 + 3 && by + ht > o.y0 - 3)
          && ![[x0, by], [x0 + wMax, by], [x0, by + ht], [x0 + wMax, by + ht], [x0 + wMax / 2, by], [x0, by + ht / 2], [x0 + wMax, by + ht / 2]].some(([px, py]) => onFloor(px, py));
        return { side, bx, by, lines, wMax, ht, room, clear };
      };
      // level with its chairs, but no higher than just under the bloc label; nudged up or down if
      // the majority label is in the way, else the other side
      const top = yMid + 40, by0 = Math.max(Yp(my) - 8, top);
      const other = side0 === "left" ? "right" : "left";
      const steps = [0, -1, 1, -2, 2, -3, 3, -4, 4, 5, 6].map((k) => by0 + k * 18).filter((by) => by >= top);
      const spots = [...steps.map((by) => [side0, by]), ...steps.map((by) => [other, by])];
      const tries = ["one", "stack", "pack"].flatMap((mode) => spots.map(([sd, by]) => lay(sd, by, mode))).filter(Boolean);
      const L = tries.find((c) => c.room && c.clear);
      if (L) {
        g.textAlign = L.side; g.textBaseline = "top";
        g.font = `600 13px ${SANS}`; g.fillStyle = css(th.ink);
        g.fillText(`Crossbench ${ch.nCross}`, L.bx, L.by);
        g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3);
        L.lines.forEach((l, j) => g.fillText(l, L.bx, L.by + 17 + j * 15));
        claim(L.bx, L.by, L.wMax, L.ht, L.side, "top");
      }
    }
    // the Speaker (the President), named above the chair
    const sp = m.divs[m.speaker], pr = presiding(m);
    if (sp && bandRoom != null) {
      // between the blocs' labels: two lines, the seat dropped if the name alone fits
      const y = Yp(geom.box.y0);
      g.textBaseline = "alphabetic"; g.textAlign = "center";
      g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2); g.fillText(pr.role, X(0), y - 32);
      g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3);
      const full = `${pr.name}, ${pr.place}`, nm = g.measureText(full).width <= bandRoom ? full : pr.name;
      g.fillText(nm, X(0), y - 10);
      claim(X(0), y - 46, Math.max(g.measureText(nm).width, 50), 44, "center", "top");
    } else if (sp) {
      const a = pr.role, b = `  ${pr.name}, ${pr.place}`, y = Yp(geom.box.y0) - 9;
      g.textBaseline = "middle"; g.textAlign = "left";
      g.font = `600 12px ${SANS}`; const wa = g.measureText(a).width;
      g.font = `400 12px ${SANS}`; const wb = g.measureText(b).width;
      const x0 = X(0) - (wa + wb) / 2;
      g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2); g.fillText(a, x0, y);
      g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3); g.fillText(b, x0 + wa, y);
      claim(x0, y - 8, wa + wb, 16, "left", "top");
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
    if (cy <= 0) { dx = cx < 0 ? -1 : 1; dy = 0; } else { const l = Math.hypot(cx, cy) || 1; dx = cx / l; dy = cy / l; }
    // the name hangs where the bloc labels do, just beyond the benches
    const R = rO + 0.95, Rk = rO + 0.6;
    const ax = X(dx * R), ay = cy <= 0 ? q.y : Yp(dy * R);
    const kx = X(dx * Rk), ky = cy <= 0 ? q.y : Yp(dy * Rk);
    g.font = `600 13px ${SANS}`;
    const tw = g.measureText(txt).width, th2 = 16;
    const side = Math.abs(dx) >= 0.42;
    const align = side ? (dx < 0 ? "right" : "left") : "center";
    const floorR = rO + 0.5; // the outer chairs' backs
    const onFloor = (px, py) => { const u = (px - F.ox) / s, v = (py - F.oy) / s; return geom.rect ? saOnFloor(geom, u, v) : v <= 0 ? v >= geom.box.y0 && Math.abs(u) <= floorR : Math.hypot(u, v) <= floorR; };
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
    if (side && cy <= 0) g.lineTo(kx, ty);
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
const blocName = (m, fam) => (fam === "alp" ? "Labor" : STATE_YEARS.has(m.year) ? "Liberals" : "Coalition");
function crossParts(m, ch) {
  const cnt = {};
  for (const i of ch.order) { const d = m.divs[i]; if (d.hold.fam === ch.gov || d.hold.fam === ch.opp) continue; const k = crossLabel(d.hold); cnt[k] = (cnt[k] || 0) + 1; }
  return Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`);
}
function crossLabel(h) {
  if (h.ab === "CSA") return "Community Strong";
  const f = h.fam;
  if (f === "ind") return "Independents";
  if (f === "grn") return "Greens";
  if (f === "onp") return "One Nation";
  return partyShort(h.ab, h.pn);
}
const SPEAKERS = { 2004: "David Hawker", 2007: "Harry Jenkins", 2010: "Harry Jenkins", 2013: "Bronwyn Bishop", 2016: "Tony Smith", 2019: "Tony Smith", 2022: "Milton Dick", 2025: "Milton Dick", now: "Milton Dick",
  sa22: "Dan Cregan", sa26: "Nat Cook", nsw23: "Greg Piper", vic22: "Maree Edwards" };
const speakerName = (m) => SPEAKERS[m.year];
// the chair's occupant as the chamber names them: the Speaker and their seat, the President and their state
const presiding = (m) => (m.house === "senate" ? (m.speaker != null ? { role: "President", name: m.divs[m.speaker].n, place: STATE_SHORT[m.divs[m.speaker].st] } : { role: "President", name: "", place: "" }) : { role: "Speaker", name: speakerName(m), place: m.divs[m.speaker] && m.divs[m.speaker].n });

let chMain = null; // the last full-size draw: chairs on screen, for hit tests and the morph
function chamberHit(m, px, py) {
  if (!chMain) return null;
  let best = null, bd = Infinity;
  for (const q of chMain.drawn) { const d = Math.hypot(px - q.x, py - q.y); if (d < q.r + 3 && d < bd) { bd = d; best = q.i; } }
  return best == null ? null : { kind: m.house === "senate" ? "sen" : "div", i: best };
}
// a phone has no room beside the chamber: it fills the width, its bloc labels in a band above
function chamberPads(w = Wpx) { return isPhone() ? (w < 600 ? { t: 62, r: 3, b: 24, l: 3 } : { t: 30, r: 10, b: 36, l: 10 }) : { t: 34, r: 150, b: 36, l: 150 }; }
function drawChamberMain(m, alpha) {
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sen = m.house === "senate", sel = sen ? S.ssel : S.sel;
  chMain = drawChamber(ctx, m, Wpx, Hpx, { big: true, alpha, sel: sen ? (sel.level === "sen" ? sel.i : null) : selDiv(), hover: S.hover && S.hover.kind === (sen ? "sen" : "div") ? S.hover.i : null,
    state: sel.level === "state" ? sel.st : null, pad: chamberPads(), pattern: (() => { const p = hatch(); p.setTransform(new DOMMatrix().scale(1 / dpr)); return p; })() });
  ctx.restore();
}

/* ----- the morph between the map and the chamber ----- */
let morph = null; // { to: "chamber" | "map", t0, dur }
function drawMorph(m, p) {
  const th = TH;
  const geom = chamberGeom(m);
  const F = chamberFrame(geom, Wpx, Hpx, chamberPads());
  const target = chamberPositions(m, geom);
  // the map recedes, the chamber's furniture arrives
  if (p < 0.55) { drawGeo(m, 1 - p / 0.55, (1 - p / 0.55) * streetK()); drawIslands(m, 1 - p / 0.55); }
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (p > 0.45) {
    ctx.globalAlpha = clamp((p - 0.45) / 0.55, 0, 1);
    geom.furniture(ctx, F, geom);
  }
  ctx.restore();
  const g = geoOf(m);
  for (const d of m.divs) {
    const tgt = d.i === m.speaker ? geom.chairAt : target.get(d.n);
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
      drawChair(ctx, x, y, lerp(0, tgt[2], e), tgt[4] * F.s * cs, tgt[5] * F.s * cs, css(c), css(towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22)), 1);
      ctx.restore();
    }
  }
}
/* ----- the small chamber in the story column ----- */
const miniCh = { canvas: null, drawn: null, F: null };
function paintMiniChamber() {
  const c = $("#minich"); if (!c) { miniCh.canvas = null; return; }
  const m = M(); if (!m) return;
  const w = c.clientWidth || 300;
  const geom = chamberGeom(m);
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
