/* =============================== the Senate ===============================
   The Senate as it sits today, after the Parliament's Senate seating plan (map/data/senate-now.json
   and the floor it names, senate-floor-<plan>.json, both from .build/map/senate.mjs). It is drawn by
   the House's renderer (drawChamber) on its own floor: the President's chair at the head of the
   table, the leaders at the table's two chairs, three rows of desks down either side and round the
   far curve, the government on the President's right (the reader's left). Seventy-six senators,
   each a chair; a bill needs 39 votes, the President's among them (the President votes, and a tie
   fails). A senator's term is the AEC's: six years from the July after their election for a state,
   to the next election for a territory; a casual senator serves out the term of the one they
   replaced. Only today's Senate is drawn: picking an election on the timeline returns to the House. */
const SEN_LENSES = [
  { id: "party", label: "Party" },
  { id: "term", label: "Next election" },
];
const SU = 38.4; // the plan's units to a chamber unit: the Senate's floor is as wide as the House's
let SENM = null, senFloor = null, senFloorP = null;
const senOn = () => S.view === "chamber" && S.house === "senate" && !!SENM;
// the model the chamber view draws: the House's year, or the Senate
const CM = () => (S.view === "chamber" && S.house === "senate" ? (SENM && senFloor ? SENM : null) : M());
function senateModel(raw) {
  const divs = raw.senators.map((x, i) => ({ i, n: x.n, st: x.st, sen: x, hold: { n: x.n, ab: x.ab, pn: partyName(x.ab), fam: FAM(x.ab) } }));
  const role = (r) => divs.findIndex((d) => d.sen.role === r);
  return {
    house: "senate", year: "now", asOf: raw.asOf, floor: raw.floor, divs, byName: new Map(divs.map((d) => [d.n, d.i])),
    speaker: role("president"), leaders: [role("leader"), role("oppLeader")], gov: "alp",
    seating: { plan: longDate(raw.asOf), at: Object.fromEntries(divs.map((d) => [d.n, d.sen.seat])) },
  };
}
function loadSenate() {
  if (SENM) return Promise.resolve(SENM);
  return getJSON("/map/data/senate-now.json").then((raw) => { SENM = senateModel(raw); recolor(false); return SENM; });
}
function loadSenateFloor() {
  return (senFloorP ??= loadSenate().then((m) => getJSON(`/map/data/${m.floor}`)).then((f) => { senFloor = f; senGeomC = null; senPaths = null; return f; }).catch((e) => { senFloorP = null; throw e; }));
}

/* ----- the floor ----- */
let senGeomC = null;
function senateGeom() {
  if (senGeomC) return senGeomC;
  const F = senFloor, P = (v) => v / SU;
  const all = F.seats.filter((c) => c.row >= 0).map((c) => {
    // the chair fills its seat's outline, a hair short of its neighbours (the plan's units draw at about
    // 0.7 of the House's points on screen, so the House's chair sizes in these units came out two-thirds
    // the House's area); the curve's long desks hold a chair as big as the straight benches' best
    // (the table's two chairs are drawn narrow on the plan, 25 across: square them up to their depth)
    const D = Math.min(c.D - 2, 32), W = c.row === 0 ? D : Math.min(c.W - 3, 34), back = Math.max(0, (c.D - D) / 2);
    const x = P(c.x - Math.cos(c.fa) * back), y = P(c.y - Math.sin(c.fa) * back);
    return { id: c.id, x, y, fa: c.fa, row: c.row, s: benchS(x, y), W: P(W), D: P(D), raw: c };
  });
  const seats = all.sort((p, q) => p.s - q.s || p.row - q.row);
  const bench = seats.filter((c) => c.row > 0), s0 = bench[0].s, s1 = bench[bench.length - 1].s;
  seats.forEach((c, k) => { c.k = k; c.u = clamp((c.s - s0) / (s1 - s0), 0, 1); });
  const rows = [0, 1, 2, 3].map((r) => seats.filter((c) => c.row === r));
  // the walkways the majority line threads: inside the front row, between rows, outside the back
  // row, on the straight benches (their distance from the centre line) and round the curve (radius)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rowX = [1, 2, 3].map((r) => mean(rows[r].filter((c) => c.y < 0).map((c) => Math.abs(c.x))));
  const rowR = [1, 2, 3].map((r) => mean(rows[r].filter((c) => c.y > 0).map((c) => Math.hypot(c.x, c.y))));
  const walk = (v) => [v[0] - (v[1] - v[0]) / 2, (v[0] + v[1]) / 2, (v[1] + v[2]) / 2, v[2] + (v[2] - v[1]) / 2];
  const GS = walk(rowX), GC = walk(rowR);
  const benchPt = (s, k) => {
    if (s <= 0) return [-GS[k], s];
    if (s >= Math.PI * CHK) return [GS[k], Math.PI * CHK - s];
    const a = s / CHK; return [-GC[k] * Math.cos(a), GC[k] * Math.sin(a)];
  };
  const pres = F.seats.find((c) => c.id === "president");
  const [bx0, by0, bx1, by1] = F.box.map(P);
  senGeomC = {
    seats, rows, nRows: 3, bench, byId: new Map(seats.map((c) => [c.id, c.k])),
    rOut: rowR[2], box: { x0: Math.min(bx0, -bx1), x1: Math.max(bx1, -bx0), y0: by0, y1: by1 },
    arms: false, table: ["leader_of_the_government", "leader_of_the_opposition"],
    chairAt: [P(pres.x), P(pres.y), Math.PI / 2, 0, P(36), P(32)],
    aisle: P(46), yMid: mean(rows[1].filter((c) => c.y < 0).map((c) => c.y)),
    benchPt, benchOut, furniture: drawSenateFurniture,
  };
  return senGeomC;
}
// the floor's outlines as canvas paths, made once
let senPaths = null;
function senateFurniturePaths() {
  if (senPaths) return senPaths;
  const mk = (list) => list.map((p) => ({ p: new Path2D(p.d), t: p.t, cls: p.cls || "" }));
  const F = senFloor.furniture;
  senPaths = { table: mk(F.table), hansard: mk(F.hansard), desk: mk(F.desk), advisers: mk(F.advisers), benches: senBenches() };
  return senPaths;
}
/* the benches as the House draws its own, a bench's colour with a margin round its chairs: down the
   straight sides the seats run in touching pairs, one block a pair; round the curve each desk is a
   block of its own, turned to face the table (the plan's curve desks aren't concentric, so they are
   drawn as they stand, not as sectors of one circle) */
const BENCH_PAD = 2.5;
function senBenches() {
  const all = [...senFloor.seats.filter((c) => c.row > 0), ...senFloor.furniture.blackRod];
  // a column is one x extent; down it, a seat whose top meets the last one's foot joins its block
  const cols = new Map();
  for (const c of all.filter((c) => c.box)) { const k = `${Math.round(c.box[0])}|${Math.round(c.box[2])}`; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(c.box.slice()); }
  const blocks = [];
  for (const list of cols.values()) {
    list.sort((p, q) => p[1] - q[1]);
    let cur = null;
    for (const b of list) { if (cur && b[1] - cur[3] < 3) cur[3] = Math.max(cur[3], b[3]); else blocks.push((cur = b)); }
  }
  const desks = all.filter((c) => !c.box).map((c) => [c.x, c.y, c.fa, c.D, c.W]);
  return { blocks, desks };
}
/* the room, in the House's drawing: the floor, the benches (each seat's own outline on the plan, a
   bench's colour and a line's edge, as the House's blocks), the table with the President's desk at its
   head and Hansard's at its foot, the advisers' boxes as the House's officials' boxes, the officers'
   chairs, and the empty seats (outlined only). The plan's desks are left out, as the House's are */
function drawSenateFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, k = s / SU;
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  const P = senateFurniturePaths();
  // the floor: straight sides down from the President's end, the far curve round the back row
  const FR = Math.max(-geom.box.x0, geom.box.x1, geom.box.y1), top = geom.box.y0;
  g.beginPath(); g.moveTo(X(-FR), Yp(top)); g.lineTo(X(-FR), Yp(0)); g.arc(X(0), Yp(0), FR * s, Math.PI, 0, true); g.lineTo(X(FR), Yp(top)); g.closePath();
  g.fillStyle = css(th.floor); g.fill();
  // the plan's shapes, in its own units
  g.save(); g.translate(X(0), Yp(0)); g.scale(k, k);
  const hair = 1 / k;
  const draw = (list, fill, stroke, lw = hair) => {
    for (const q of list) {
      g.save(); g.translate(q.t[0], q.t[1]);
      if (fill) { g.fillStyle = fill; g.fill(q.p); }
      if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(q.p); }
      g.restore();
    }
  };
  g.lineWidth = hair; g.strokeStyle = css(th.line); g.fillStyle = bench;
  const rb = (x, y, w, h) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 3); else g.rect(x, y, w, h); g.fill(); g.stroke(); };
  const pd = BENCH_PAD;
  for (const [x0, y0, x1, y1] of P.benches.blocks) rb(x0 - pd, y0 - pd, x1 - x0 + 2 * pd, y1 - y0 + 2 * pd);
  for (const [x, y, fa, D, W] of P.benches.desks) { g.save(); g.translate(x, y); g.rotate(fa); rb(-D / 2 - pd, -W / 2 - pd, D + 2 * pd, W + 2 * pd); g.restore(); }
  draw(P.advisers, bench, css(th.line));
  draw(P.table, bench, wood, Math.max(hair, 0.05 * s / k));
  draw(P.desk, wood, css(th.line));
  draw(P.hansard, wood, css(th.line));
  g.restore();
  // the empty seats, outlined only, so they never read as a senator's chair (a dimmed one is filled)
  g.strokeStyle = css(mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24)); g.lineWidth = 1;
  for (const c of geom.seats) {
    if (opts.occupied && opts.occupied.has(c.k)) continue;
    const w = c.W * s, d = c.D * s, r = Math.min(w, d) * 0.24;
    g.save(); g.translate(X(c.x), Yp(c.y)); g.rotate(c.fa);
    g.beginPath(); if (g.roundRect) g.roundRect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1, r); else g.rect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1);
    g.stroke(); g.restore();
  }
  // the officers: the Clerk, the Chair of Committees and the Deputy Clerk; Hansard's reporters; Black Rod
  for (const o of senFloor.officers) {
    const W = (Math.min(o.W, 28) / SU) * s, D = (Math.min(o.D, 24) / SU) * s;
    drawChair(g, X(o.x / SU), Yp(o.y / SU), o.fa, W, D, css(officer), back(officer, 0.18), 1);
  }
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    put("The table", 0, -320 / SU, 110 / SU);
    put("Hansard", 0, -148 / SU, 86 / SU);
  }
}

/* ----- the lenses: party, and who faces the voters next ----- */
const upNext = (d) => d.sen.term !== 2031;
const SEN_STAY = (th) => (th.dark ? lch(0.45, 0.008, 66) : lch(0.83, 0.006, 75));
function senateColor(m, d) {
  const c = TH.party[holdFam(d.hold)];
  if (S.senLens === "term" && !upNext(d)) return SEN_STAY(TH);
  return c;
}
// the sorted chamber's order within a bloc: by party, then (on the term lens) those up next first, then by state
const SEN_PARTY_ORDER = ["ALP", "LP", "LNP", "NP", "CLP", "GRN", "IND", "JLN", "AV", "UAPP", "ON"];
function senateKey(m, d, bloc) {
  const p = SEN_PARTY_ORDER.indexOf(d.hold.ab), st = STATES.indexOf(d.st);
  const term = S.senLens === "term" ? (upNext(d) ? 0 : 1) : 0;
  return -(term * 1000 + (p < 0 ? 99 : p) * 10 + st / 10);
}
const senLensOf = () => SEN_LENSES.find((l) => l.id === S.senLens);

/* ----- the counts the legend and the story read ----- */
function senCounts(m, pred = () => true) {
  const c = {};
  for (const d of m.divs) if (pred(d)) { const f = holdFam(d.hold); c[f] = (c[f] || 0) + 1; }
  return c;
}
const SEN_FAMS = ["alp", "lnp", "grn", "onp", "ind", "oth"];
// the crossbench by party, the way a sentence names them: "the Greens’ 10", "One Nation’s four"
function senCross(m) {
  const by = new Map();
  for (const d of m.divs) {
    const f = holdFam(d.hold); if (f === "alp" || f === "lnp") continue;
    const k = f === "ind" ? "IND" : d.hold.ab;
    if (!by.has(k)) by.set(k, { k, fam: f, n: 0, names: [] });
    const g = by.get(k); g.n++; g.names.push(d.n);
  }
  return [...by.values()].sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
}
const crossName = (g) => (g.k === "IND" ? (g.n === 1 ? "an independent" : "independents") : g.k === "GRN" ? "the Greens" : g.k === "JLN" ? "the Jacqui Lambie Network" : partyName(g.k));
const crossPoss = (g) => (g.k === "IND" ? `the ${words(g.n)} independents’` : g.k === "GRN" ? "the Greens’" : g.k === "JLN" ? "the Lambie Network’s" : `${partyName(g.k)}’s`);

/* ----- the key ----- */
function houseSwitchHTML() {
  return `<div class="lg-house" role="group" aria-label="Which chamber"><button type="button" data-house="reps" data-t="House of Representatives" aria-pressed="${S.house !== "senate"}">House of Representatives</button><button type="button" data-house="senate" data-t="Senate" aria-pressed="${S.house === "senate"}">Senate</button></div>`;
}
function senateLegendHTML(m) {
  const cats = (cnt, list) => `<div class="lg-cats">${list.filter((f) => cnt[f]).map((f) => `<span><i style="${swc(f)}"></i>${FAM_LEG[f]} <b>${cnt[f]}</b></span>`).join("")}`;
  let h = houseSwitchHTML();
  if (S.senLens === "term") {
    const up = senCounts(m, upNext), stay = m.divs.filter((d) => !upNext(d)).length;
    h += `<div class="lg-t">Who faces the voters at the next election</div>`;
    h += `${cats(up, SEN_FAMS)}<span><i style="background:${css(SEN_STAY(TH))}"></i>Sits until 2031 <b>${stay}</b></span></div>`;
    h += `<div class="lg-note">Each state elects half its 12 senators at a time; the territories’ four are elected every time.</div>`;
  } else {
    h += `<div class="lg-t">Who sits in the Senate today</div>`;
    h += `${cats(senCounts(m), SEN_FAMS)}</div>`;
  }
  const md = seatMode(m);
  h += `<div class="lg-seat" role="group" aria-label="How the chamber is arranged"><button type="button" data-seat="plan" aria-pressed="${md === "plan"}">As seated</button><button type="button" data-seat="sort" aria-pressed="${md === "sort"}">Sorted</button><span>${md === "plan" ? `From the Parliament’s Senate seating plan of ${m.seating.plan}.` : `By ${S.senLens === "term" ? "who is up next, then party" : "party"}, each side from the President’s end.`}</span></div>`;
  return h;
}

/* ----- the story ----- */
const TERM_END = { 2028: "30 June 2028", 2031: "30 June 2031" };
function senUpLink() {
  const s = S.ssel; if (s.level === "aus") return "";
  const label = s.level === "state" ? "The Senate" : STATE_TITLE[s.st];
  const go = s.level === "state" ? "aus" : `state:${s.st}`;
  return `<button type="button" class="st-up" data-sgo="${go}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6 2.2 3.8 6l3.8 3.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(label)}</button>`;
}
function senHead(title, meta, hed, dek) {
  return `${senUpLink()}<div class="st-head"><h2>${esc(title)}</h2><span class="rd-meta">${meta}</span></div><h3 class="st-hed">${hed}</h3>${dek ? `<p class="st-dek">${dek}</p>` : ""}`;
}
/* the balance of power, in rules: how many votes the government is short of the 39, which crossbench
   groups could supply them alone, and what it would take without them */
function senBalance(m) {
  const N = m.divs.length, maj = Math.floor(N / 2) + 1, cnt = senCounts(m);
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp", G = cnt[gov] || 0, O = cnt[opp] || 0;
  const cross = senCross(m), C = N - G - O, need = maj - G;
  const enough = cross.filter((g) => g.n >= need);
  return { N, maj, G, O, C, need, cross, enough, gov, opp };
}
function senHedDek(m) {
  const b = senBalance(m), GN = blocName(m, b.gov), ON = blocName(m, b.opp), oppThe = b.opp === "lnp" ? "the Coalition" : "Labor";
  const pres = m.divs[m.speaker], presOwn = holdFam(pres.hold) === b.gov;
  const holds = `${GN} holds ${b.G} of the ${b.N} seats${presOwn ? ", the President’s among them" : ""}`;
  if (b.need <= 0) return { hed: `${GN} holds a majority in the Senate`, dek: `${holds}, ${b.G - b.maj + 1 > 1 ? `${words(b.G - b.maj + 1)} more than` : "one more than"} the ${b.maj} a bill needs. ${cap(oppThe)} holds ${b.O}; the crossbench ${b.C}.` };
  const short = `${words(b.need)} short of the ${b.maj} votes a bill needs`;
  if (b.enough.length === 1) {
    const g = b.enough[0], rest = b.cross.filter((x) => x !== g), restN = rest.reduce((a, x) => a + x.n, 0);
    const name = crossName(g);
    const hed = `${GN} needs ${name} to pass a bill ${oppThe} opposes`;
    let dek = `${holds}, ${short}. ${cap(crossPoss(g))} ${words(g.n)} take it to ${b.G + g.n}. `;
    if (restN >= b.need) {
      // a party of several by its count, everyone else (independents among them) by name
      const who = [...rest.filter((x) => x.n > 1 && x.k !== "IND").map((x) => `${crossPoss(x)} ${words(x.n)}`), ...rest.filter((x) => x.n === 1 || x.k === "IND").flatMap((x) => x.names)];
      dek += `Without them it would need ${restN === b.need ? `all ${words(restN)} other crossbenchers` : `${words(b.need)} of the other ${words(restN)} crossbenchers`}: ${listAnd(who)}.`;
    } else dek += `No mix of the other ${words(restN)} crossbenchers is enough without them.`;
    return { hed, dek: dek.trim() + ` ${cap(oppThe)} holds ${b.O}.` };
  }
  if (b.enough.length > 1) {
    const names = b.enough.map(crossName);
    return { hed: `${GN} can pass a bill with ${listAnd(names).replace(/ and /, " or ")}`, dek: `${holds}, ${short}. ${cap(oppThe)} holds ${b.O}; the crossbench ${b.C}.` };
  }
  return { hed: `${GN} needs two or more crossbench parties to pass a bill ${oppThe} opposes`, dek: `${holds}, ${short}; no single crossbench party has ${words(b.need)}. ${cap(oppThe)} holds ${b.O}; the crossbench ${b.C}.` };
}
// the 76 as one bar, the government first and the opposition last, the 39 marked
function senBar(m) {
  const b = senBalance(m), cnt = senCounts(m);
  const order = [b.gov, ...chamberBlocs(m).cross, b.opp].filter((f) => cnt[f]);
  let acc = 0;
  const segs = order.map((f) => { const x = (100 * acc) / b.N, w = (100 * cnt[f]) / b.N; acc += cnt[f]; return `<i style="left:${x}%;width:${w}%;${swc(f)}" title="${FAM_LEG[f]} ${cnt[f]}"></i>`; }).join("");
  const mx = (100 * b.maj) / b.N;
  const lab = order.map((f) => `<span><i style="${swc(f)}"></i>${FAM_LEG[f]} <b>${cnt[f]}</b></span>`).join("");
  return `<div class="sn-bar" role="img" aria-label="${order.map((f) => `${FAM_LEG[f]} ${cnt[f]}`).join(", ")}; ${b.maj} for a majority"><div class="sn-track">${segs}<span class="sn-maj" style="left:${mx}%"></span></div><div class="sn-majlab" style="left:${mx}%">${b.maj} to pass a bill</div></div><div class="counts">${lab}</div>`;
}
function storySenate(m) {
  const s = S.ssel;
  if (s.level === "sen") return storySenator(m, s.i);
  if (s.level === "state") return storySenState(m, s.st);
  const { hed, dek } = senHedDek(m);
  let h = senHead("The Senate today", `Senators as at ${longDate(m.asOf)}`, hed, dek);
  h += `<div class="st-sec"><h3>The balance of power <small>${senBalance(m).maj} of ${m.divs.length} votes pass a bill</small></h3>${senBar(m)}</div>`;
  // who faces the voters next
  const up = m.divs.filter(upNext), upC = senCounts(m, upNext), stayC = senCounts(m, (d) => !upNext(d));
  const nUp = up.length, nTerr = up.filter((d) => d.sen.term === "next").length;
  const upOrder = SEN_FAMS.filter((f) => upC[f] || stayC[f]);
  h += `<div class="st-sec"><h3>At the next election <small>${nUp} seats up, ${m.divs.length - nUp} sit to 2031</small></h3><p class="st-p">The next election fills ${nUp} seats: each state’s six elected in 2022 and the ${words(nTerr)} territory senators. ${senDefends(m, upC)}</p><table class="tbl"><thead><tr><th>Party</th><th>Up next</th><th>To 2031</th></tr></thead><tbody>${upOrder.map((f) => `<tr><td><i class="sw" style="${swc(f)}"></i>${FAM_LEG[f]}</td><td>${upC[f] || 0}</td><td>${stayC[f] || 0}</td></tr>`).join("")}</tbody></table></div>`;
  // the states
  h += `<div class="st-sec"><h3>By state <small>12 senators a state, two a territory</small></h3><table class="tbl"><thead><tr><th>State</th><th>Senators</th><th>Up next</th></tr></thead><tbody>${STATES.map((st) => {
    const ds = m.divs.filter((d) => d.st === st), c = {}; for (const d of ds) { const f = holdFam(d.hold); c[f] = (c[f] || 0) + 1; }
    const bar = ["alp", "grn", "ind", "oth", "onp", "lnp"].filter((f) => c[f]).map((f) => `<i style="width:${(100 * c[f]) / ds.length}%;${swc(f)}"></i>`).join("");
    return `<tr data-sgo="state:${st}"><td>${STATE_TITLE[st].replace("Australian Capital Territory", "ACT").replace("Northern Territory", "NT")}</td><td>${ds.length}<span class="seatbar">${bar}</span></td><td>${ds.filter(upNext).length}</td></tr>`;
  }).join("")}</tbody></table></div>`;
  // since the elections: changes of party, and casual vacancies
  const moved = m.divs.filter((d) => d.sen.electedAs), casual = m.divs.filter((d) => d.sen.casual);
  if (moved.length || casual.length) {
    const row = (d, tx) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt">${STATE_SHORT[d.st]}</span><span class="tx"><b>${esc(d.n)}.</b> ${esc(tx)}.</span></button>`;
    h += `<div class="st-sec"><h3>Not as elected <small>${moved.length} changed party, ${casual.length} filled a vacancy</small></h3><div class="changes">${moved.map((d) => row(d, `Elected for ${theParty(d.sen.electedAs)} in ${d.sen.elected}; now ${d.hold.fam === "ind" ? "sits as an independent" : `sits for ${theParty(d.hold.ab)}`}`)).join("")}${casual.map((d) => row(d, d.sen.casual.for ? `Filled ${d.sen.casual.for}’s vacancy for ${theParty(d.hold.ab)}, to ${termWords(d)}` : `Filled a ${partyName(d.hold.ab)} vacancy, to ${termWords(d)}`)).join("")}</div></div>`;
  }
  h += senFoot(m);
  return h;
}
const termWords = (d) => (d.sen.term === "next" ? "the next election" : TERM_END[d.sen.term]);
// "Labor defends 15 of them, the Coalition 15, the Greens six …"
function senDefends(m, upC) {
  const parts = SEN_FAMS.filter((f) => upC[f]).sort((a, b) => upC[b] - upC[a]);
  if (!parts.length) return "";
  const [first, ...rest] = parts;
  return `${cap(FAM_PL[first])} defends ${words(upC[first])} of them${rest.length ? `, ${listAnd(rest.map((f) => `${FAM_PL[f]} ${words(upC[f])}`))}` : ""}.`;
}
function storySenState(m, st) {
  const ds = m.divs.filter((d) => d.st === st), c = {}; for (const d of ds) { const f = holdFam(d.hold); c[f] = (c[f] || 0) + 1; }
  const order = SEN_FAMS.filter((f) => c[f]).sort((a, b) => c[b] - c[a]);
  const top = order[0], tie = order[1] && c[order[1]] === c[top];
  const terr = st === "ACT" || st === "NT";
  const hed = tie ? `${cap(FAM_PL[top])} and ${FAM_PL[order[1]]} hold ${words(c[top])} seats each` : `${cap(FAM_PL[top])} holds ${words(c[top])} of ${STATE_POSS[st]} ${words(ds.length)} seats`;
  const up = ds.filter(upNext);
  const dek = terr ? `Territory senators serve until the next election, so both seats are up then.` : `${cap(words(up.length))} of the ${words(ds.length)}, elected in 2022, are up at the next election; the other ${words(ds.length - up.length)} sit until 2031.`;
  let h = senHead(STATE_TITLE[st], `${ds.length} senators`, hed, dek);
  ds.sort(senOrder);
  const row = (d) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt"><i class="sw" style="${swc(holdFam(d.hold))}"></i></span><span class="tx"><b>${esc(d.n)}</b> ${esc(partyName(d.hold.ab))}${d.sen.role ? ` · ${ROLE_NAME[d.sen.role]}` : ""}</span></button>`;
  if (!terr) {
    h += `<div class="st-sec"><h3>Up at the next election <small>${up.length}, elected in 2022</small></h3><div class="changes sn-list">${up.map(row).join("")}</div></div>`;
    h += `<div class="st-sec"><h3>Sitting until 2031 <small>${ds.length - up.length}, elected in 2025</small></h3><div class="changes sn-list">${ds.filter((d) => !upNext(d)).map(row).join("")}</div></div>`;
  } else h += `<div class="st-sec"><h3>Senators <small>elected in 2025</small></h3><div class="changes sn-list">${ds.map(row).join("")}</div></div>`;
  h += senFoot(m);
  return h;
}
// a list of senators: those up next first, then by party, then by name
const senOrder = (a, b) => (upNext(b) - upNext(a)) || SEN_PARTY_ORDER.indexOf(a.hold.ab) - SEN_PARTY_ORDER.indexOf(b.hold.ab) || a.n.localeCompare(b.n);
const ROLE_NAME = { president: "President of the Senate", leader: "Leader of the Government in the Senate", oppLeader: "Leader of the Opposition in the Senate" };
function storySenator(m, i) {
  const d = m.divs[i], x = d.sen, party = partyName(d.hold.ab);
  const hed = x.role ? ROLE_NAME[x.role] : d.hold.fam === "ind" ? `Independent senator for ${STATE_NAME[x.st]}` : `${party} senator for ${STATE_NAME[x.st]}`;
  const terr = x.term === "next";
  let dek;
  if (x.casual) dek = `${x.casual.for ? `Filled ${x.casual.for}’s vacancy` : "Filled a casual vacancy"} for the rest of a term ${x.term === 2031 ? "won at the 2025 election" : "won at the 2022 election"}, which ends on ${TERM_END[x.term]}.`;
  else if (terr) dek = `Elected in 2025. A territory senator’s term runs with the House’s, so the seat is up at the next election.`;
  else dek = `Elected${x.electedAs ? ` for ${theParty(x.electedAs)}` : ""} in ${x.elected}, to a term that ends on ${TERM_END[x.term]}${x.term === 2028 ? ": the seat is up at the next election" : ", so the seat sits out the next election"}.`;
  if (x.electedAs) dek += ` Now ${d.hold.fam === "ind" ? "sits as an independent" : `sits for ${theParty(d.hold.ab)}`}.`;
  if (x.role) dek = `${party} senator for ${STATE_NAME[x.st]}. ${dek}`;
  let h = senHead(d.n, `Senator for ${STATE_TITLE[x.st]}`, hed, dek);
  const mates = m.divs.filter((y) => y.st === x.st && y.i !== i).sort(senOrder);
  const row = (y) => `<button type="button" data-sgo="sen:${y.i}"><span class="dt"><i class="sw" style="${swc(holdFam(y.hold))}"></i></span><span class="tx"><b>${esc(y.n)}</b> ${esc(partyName(y.hold.ab))}${upNext(y) ? "" : " · to 2031"}</span></button>`;
  h += `<div class="st-sec"><h3>${STATE_POSS[x.st].replace(/^the /, "The ")} other senators <small>${mates.length}</small></h3><div class="changes sn-list">${mates.map(row).join("")}</div></div>`;
  h += senFoot(m);
  return h;
}
function senFoot(m) {
  return `<p class="st-foot">The Parliament’s Senate seating plan as at ${longDate(m.asOf)}; terms from the AEC’s Senators Elected lists for 2022 and 2025.</p>`;
}

/* ----- selection, search and the tooltip ----- */
function selectSen(sel) {
  S.ssel = sel; S.hover = null; hideTip();
  renderStory(true); renderTimeline(); writeURL(); schedule();
}
function senTip(m, i) {
  const d = m.divs[i], x = d.sen;
  const term = x.term === "next" ? "Up at the next election" : x.term === 2028 ? "Up at the next election (term to 2028)" : "Sits until 2031";
  return `<div class="tn">${esc(d.n)}<span>${STATE_SHORT[x.st]}${x.role === "president" ? " · President" : ""}</span></div><div class="tv">${esc(partyName(d.hold.ab))}</div><div class="ts">${esc(term)}</div>`;
}
function senSearchItems(m) {
  const items = [];
  for (const st of STATES) items.push({ k: "state", st, t: STATE_TITLE[st], s: `${m.divs.filter((d) => d.st === st).length} senators`, h: norm(STATE_TITLE[st] + " " + st), rank: 0 });
  for (const d of m.divs) items.push({ k: "sen", i: d.i, t: d.n, s: `Senator for ${STATE_SHORT[d.st]}, ${partyName(d.hold.ab)}`, h: norm(d.n), rank: 1 });
  return items;
}
