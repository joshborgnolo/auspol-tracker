/* =============================== the Senate ===============================
   The Senate as it sits today, after the Parliament's Senate seating plan (map/data/senate-now.json
   and the floor it names, senate-floor-<plan>.json, both from .build/map/senate.mjs). It is drawn by
   the House's renderer (drawChamber) on its own floor: the President's chair at the head of the
   table, the leaders at the table's two chairs, three rows of desks down either side and round the
   far curve, the government on the President's right (the reader's left). Seventy-six senators,
   each a chair; a bill needs 39 votes, the President's among them (the President votes, and a tie
   fails). A senator's term is the AEC's: six years from the July after their election for a state,
   to the next election for a territory; a casual senator serves out the term of the one they
   replaced. Each election on the timeline has its Senate too (map/data/senate-<year>.json, from
   .build/map/senate_past.py and the Parliamentary Handbook): the Senate on the day the election's
   senators took their seats, drawn on the same floor (the chamber's since 1988) and sorted, there
   being no seating plan filed for them. */
const SEN_LENSES = [
  { id: "party", label: "Party" },
  { id: "term", label: "Next election" },
];
const SU = 38.4; // the plan's units to a chamber unit: the Senate's floor is as wide as the House's
// each year's Senate, and the one the timeline is on (SENM)
const SENY = {}, SENP = {};
let SENM = null, senFloor = null, senFloorP = null;
const senOn = () => S.view === "chamber" && S.house === "senate" && !!SENM;
const syncSenate = () => { SENM = SENY[S.year] || null; };
// the model the chamber view draws: the House's year, or the Senate
const CM = () => (S.view === "chamber" && S.house === "senate" ? (SENM && senFloor ? SENM : null) : M());
const SEN_SEATS = 76;
// every year whose upper house is in this lane: the federal elections, and SA's — a state election
// chooses no federal Senate, but SA's own upper house (its 22-member Legislative Council, 11
// elected statewide at each state election) sits in the same chamber view on the sa22/sa26 frames,
// from map/data/senate-sa22.json and senate-sa26.json (.build/map/build_sa22_past.py, build_sa26_past.py)
const SEN_YEARS = YEARS.filter((y) => typeof y === "number" || y === "now" || SA_YEARS.has(y));
const senYearFor = (y) => (SEN_YEARS.includes(y) ? y : [...SEN_YEARS].filter((v) => typeof v === "number" && YEARS.indexOf(v) < YEARS.indexOf(y)).pop());
function senateModel(raw, year) {
  const divs = raw.senators.map((x, i) => ({ i, n: x.n, st: x.st, sen: x, hold: { n: x.n, ab: x.ab, pn: partyName(x.ab, x.pn), fam: FAM(x.ab) } }));
  // the term the election's own senators serve to: those not serving it are up at the next election
  const later = raw.later || Math.max(...raw.senators.map((x) => (typeof x.term === "number" ? x.term : 0)));
  const k = SEN_YEARS.indexOf(year);
  // the 2016 double dissolution (9 May 2016) put every seat to the voters: a Senate whose next election it was
  // had all 76 up, those due to sit to 2017 or 2020 among them
  const nextDD = SEN_YEARS[k + 1] === 2016;
  for (const d of divs) { d.due = d.sen.term !== later; d.up = nextDD || d.due; }
  // an unlisted role is no role: null (a state council file may carry none),
  // never findIndex's -1, which the chamber geometry reads as a member index
  const role = (r) => { const i = divs.findIndex((d) => d.sen.role === r); return i < 0 ? null : i; };
  return {
    house: "senate", year, asOf: raw.asOf, floor: raw.floor, lc: !!raw.lc, src: raw.source || null, divs, byName: new Map(divs.map((d) => [d.n, d.i])), seatsN: raw.seatsN || SEN_SEATS,
    // a state upper house's statewide first-preference tally (the federal files have none)
    votes: raw.votes || null, pvotes: raw.pvotes || null, formal: raw.formal || 0, pformal: raw.pformal || 0, prev: raw.prev || (raw.lc ? 2022 : null),
    speaker: role("president"), leaders: [role("leader"), role("oppLeader")].filter((i) => i != null), gov: GOV[year], later, dd: !!raw.dd, nextDD, vacant: raw.vacant || [],
    // the election after this one, by name ("the 2007 election"), where there has been one
    nextYear: year !== "now" && SEN_YEARS[k + 1] !== "now" ? SEN_YEARS[k + 1] : null,
    // (a council's plan is filed apart, with its own date: seats-<year>-lc.json)
    seating: raw.seating ? { plan: raw.seating.plan, note: raw.seating.note || null, at: raw.seating.at }
      : raw.senators[0] && raw.senators[0].seat ? { plan: longDate(raw.asOf), at: Object.fromEntries(divs.map((d) => [d.n, d.sen.seat])) } : null,
  };
}
/* a council's seating plan (seats-<year>-lc.json, from .build/map/sa_seating.mjs): where each member
   sits, and who holds the chair and leads each side, as the Parliament's chamber map names them */
function withCouncilPlan(raw, plan) {
  if (!plan) return raw;
  const role = new Map(Object.entries(plan.roles || {}).map(([r, n]) => [n, r]));
  return { ...raw, seating: { plan: plan.plan, note: plan.note, at: plan.at }, senators: raw.senators.map((x) => (role.has(x.n) && !x.role ? { ...x, role: role.get(x.n) } : x)) };
}
function loadSenate(year = S.year) {
  if (SENY[year]) return Promise.resolve(SENY[year]);
  const plan = SEATED_LC.has(year) ? getJSON(`/map/data/seats-${year}-lc.json`).catch(() => null) : null;
  return (SENP[year] ??= Promise.all([getJSON(`/map/data/senate-${year}.json`), plan]).then(([raw, p]) => { SENY[year] = senateModel(withCouncilPlan(raw, p), year); syncSenate(); recolor(false); return SENY[year]; })
    .catch((e) => { delete SENP[year]; throw e; }));
}
// every election's Senate, for the timeline's make-up glyphs (about 7KB each)
function loadSenates() {
  return Promise.all(SEN_YEARS.map((y) => loadSenate(y).catch(() => null))).then(() => renderTimeline());
}
// the floor is today's plan's, the chamber the same since 1988
function loadSenateFloor() {
  return (senFloorP ??= loadSenate("now").then((m) => getJSON(`/map/data/${m.floor}`)).then((f) => { senFloor = f; senGeomC = null; senPaths = null; return f; }).catch((e) => { senFloorP = null; throw e; }));
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
  // (a floor filed before Black Rod's bench was drawn has none)
  const all = [...senFloor.seats.filter((c) => c.row > 0), ...(senFloor.furniture.blackRod || [])];
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
const upNext = (d) => d.up;
const SEN_STAY = (th) => (th.dark ? lch(0.45, 0.008, 66) : lch(0.83, 0.006, 75));
function senateColor(m, d) {
  const c = TH.party[holdFam(d.hold)];
  if (S.senLens === "term" && !upNext(d)) return SEN_STAY(TH);
  return c;
}
// the sorted chamber's order within a bloc: by party, then (on the term lens) those up next first, then by state
const SEN_PARTY_ORDER = ["ALP", "LP", "LNP", "NP", "CLP", "GRN", "AD", "XEN", "CA", "FFP", "DLP", "PUP", "LDP", "AMEP", "DHJP", "AC", "IND", "JLN", "AV", "UAPP", "KAP", "APA", "SAB", "FGA", "ON", "ONP"];
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
    if (!by.has(k)) by.set(k, { k, fam: f, n: 0, names: [], pn: d.hold.pn });
    const g = by.get(k); g.n++; g.names.push(d.n);
  }
  return [...by.values()].sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
}
// (a party by its name of the day: 2016's Nick Xenophon Team, 2019's Centre Alliance)
const crossName = (g) => (g.k === "IND" ? (g.n === 1 ? "an independent" : "independents") : g.k === "GRN" ? "the Greens" : g.k === "JLN" ? "the Jacqui Lambie Network" : theParty(g.k, g.pn));
const crossPoss = (g) => (g.k === "IND" ? `the ${words(g.n)} independents’` : g.k === "GRN" ? "the Greens’" : g.k === "JLN" ? "the Lambie Network’s" : `${theParty(g.k, g.pn)}’s`);

/* ----- the copy's tense and terms: today's Senate in the present; an election's in the past, but for
   what was still to come (its next election, a term not yet run) ----- */
const senNow = (m) => m.year === "now";
const tv = (m, now, past) => (senNow(m) ? now : past);
// the election a Senate's up-next half faced: "the 2007 election", or for today's and 2025's, "the next election"
const nextEl = (m) => (m.nextYear ? `the ${m.nextYear} election` : m.lc ? `the ${m.later - 4} state election` : "the next election");
const nv = (m, still, done) => (m.nextYear ? done : still); // a verb about the next election: still to come, or past
const termWords = (m, d) => (d.sen.term === "next" ? nextEl(m) : m.lc ? `the ${d.sen.term} election` : `30 June ${d.sen.term}`);
const TERRITORIES = new Set(["ACT", "NT"]);
// the election the up-next half of the states was chosen at (2016's short-term half at the double dissolution)
function upClass(m) {
  const c = {};
  for (const d of m.divs) if (d.up && !TERRITORIES.has(d.st) && d.sen.elected) c[d.sen.elected] = (c[d.sen.elected] || 0) + 1;
  const y = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  return y ? +y : null;
}
const upClassWords = (m) => (upClass(m) === 2016 && m.year !== 2016 ? "each state’s six elected last in 2016" : m.dd ? "each state’s six elected last" : `each state’s six elected in ${upClass(m)}`);
// the election that chose a Senate's own new half
const ownElection = (m) => (senNow(m) ? 2025 : m.year);
// the upper house as this frame's copy names it: the Senate federally, SA's council on the SA frames
const coThe = (m) => (m.lc ? "the Legislative Council" : "the Senate");
const coTheC = (m) => (m.lc ? "The Legislative Council" : "The Senate");
// a member of it in copy: a senator, or a councillor (an MLC)
const coSeat = (m) => (m.lc ? "the council" : "the Senate");
// the title over a member (search, the member's own story): Senator federally
const coTitle = (m) => (m.lc ? "Member of the Legislative Council" : "Senator");
const coMember = (m) => (m.lc ? "member" : "senator");

/* ----- the key ----- */
function houseSwitchHTML() {
  const sa = SA_YEARS.has(S.year);
  return `<div class="lg-house" role="group" aria-label="Which chamber"><button type="button" data-house="reps" data-t="${sa ? "House of Assembly" : "House of Representatives"}" aria-pressed="${S.house !== "senate"}">${sa ? "House of Assembly" : "House of Representatives"}</button><button type="button" data-house="senate" data-t="${sa ? "Legislative Council" : "Senate"}" aria-pressed="${S.house === "senate"}">${sa ? "Legislative Council" : "Senate"}</button></div>`;
}
function senateLegendHTML(m) {
  const cats = (cnt, list) => `<div class="lg-cats">${list.filter((f) => cnt[f]).map((f) => `<span><i style="${swc(f)}"></i>${famLeg(f)} <b>${cnt[f]}</b></span>`).join("")}`;
  let h = houseSwitchHTML();
  if (S.senLens === "term") {
    const up = senCounts(m, upNext), stay = m.divs.filter((d) => !upNext(d)).length;
    h += `<div class="lg-t">${nv(m, "Who faces", "Who faced")} the voters at ${nextEl(m)}</div>`;
    h += `${cats(up, SEN_FAMS)}${stay ? `<span><i style="background:${css(SEN_STAY(TH))}"></i>Term to ${m.lc ? `the ${m.later} election` : m.later} <b>${stay}</b></span>` : ""}</div>`;
    h += `<div class="lg-note">${m.lc ? "Eleven of the council’s 22 members are elected as one statewide electorate at each state election; the rest sit until the next one." : m.nextDD ? "The double dissolution of 9 May 2016 put all 76 seats to the voters." : m.dd ? "The double dissolution elected all 76: each state’s last six elected, and the territories’ four, faced the voters again in 2019." : "Each state elects half its 12 senators at a time; the territories’ four are elected every time."}</div>`;
  } else {
    h += `<div class="lg-t">${senNow(m) ? "Who sits in the Senate today" : m.lc ? `The Legislative Council after ${yearLabel(m.year)}` : `The Senate after the ${m.year} election`}</div>`;
    h += `${cats(senCounts(m), SEN_FAMS)}</div>`;
  }
  const md = seatMode(m);
  if (m.seating) h += `<div class="lg-seat" role="group" aria-label="How the chamber is arranged"><button type="button" data-seat="plan" aria-pressed="${md === "plan"}">As seated</button><button type="button" data-seat="sort" aria-pressed="${md === "sort"}">Sorted</button><span>${md === "plan" ? `From the Parliament’s ${m.lc ? "chamber map" : "Senate seating plan"} of ${m.seating.plan}.` : `By ${S.senLens === "term" ? "who is up next, then party" : "party"}, each side from the President’s end.`}</span></div>`;
  else h += `<div class="lg-note">Sorted by ${S.senLens === "term" ? "who was up next, then party" : "party"}, each side from the President’s end; no seating plan is filed for ${m.lc ? "this council" : "this Senate"}.</div>`;
  return h;
}

/* ----- the story ----- */
function senUpLink() {
  const s = S.ssel, m = SENM; if (s.level === "aus") return "";
  const label = s.level === "state" || m.lc ? coTheC(m) : STATE_TITLE[s.st];
  const go = s.level === "state" || m.lc ? "aus" : `state:${s.st}`;
  return `<button type="button" class="st-up" data-sgo="${go}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6 2.2 3.8 6l3.8 3.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(label)}</button>`;
}
function senHead(title, meta, hed, dek) {
  return `${senUpLink()}<div class="st-head"><h2>${ds(title)}</h2><span class="rd-meta">${meta}</span></div><h3 class="st-hed">${hed}</h3>${dek ? `<p class="st-dek">${dek}</p>` : ""}`;
}
/* the balance of power, in rules: how many votes the government is short of the 39, which crossbench
   groups could supply them alone, and what it would take without them */
function senBalance(m) {
  const N = m.seatsN, maj = Math.floor(N / 2) + 1, cnt = senCounts(m);
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp", G = cnt[gov] || 0, O = cnt[opp] || 0;
  const cross = senCross(m), C = m.divs.length - G - O, need = maj - G;
  const enough = cross.filter((g) => g.n >= need);
  return { N, maj, G, O, C, need, cross, enough, gov, opp };
}
function senHedDek(m) {
  // the government as a sentence opens with it ("The Coalition held …")
  const b = senBalance(m), GN = b.gov === "lnp" ? "The Coalition" : "Labor", oppThe = b.opp === "lnp" ? (m.lc ? "the Liberals" : "the Coalition") : "Labor";
  const pres = m.speaker != null ? m.divs[m.speaker] : null, presOwn = pres && holdFam(pres.hold) === b.gov;
  const has = tv(m, "holds", "held"), needs = tv(m, "needs", "needed"), opposes = tv(m, "opposes", "opposed");
  const holds = `${GN} ${has} ${b.G} of the ${b.N} seats${presOwn ? ", the President’s among them" : ""}`;
  const tail = `${cap(oppThe)} ${has} ${b.O}`;
  const vacant = m.vacant.length ? ` ${cap(words(m.vacant.length))} ${STATE_NAME[m.vacant[0].st]} seat ${m.vacant.length > 1 ? "were" : "was"} vacant that day, until ${longDate(m.vacant[0].filled)}.` : "";
  if (b.need <= 0) return { hed: `${GN} ${has} a majority in ${coThe(m)}`, dek: `${holds}, ${b.G === b.maj ? "exactly" : `${words(b.G - b.maj)} more than`} the ${b.maj} a bill ${needs}. ${tail}; the crossbench ${b.C}.${vacant}` };
  const short = `${words(b.need)} short of the ${b.maj} votes a bill ${needs}`;
  if (b.enough.length === 1) {
    const g = b.enough[0], rest = b.cross.filter((x) => x !== g), restN = rest.reduce((a, x) => a + x.n, 0);
    const hed = `${GN} ${needs} ${crossName(g)} to pass a bill ${oppThe} ${opposes}`;
    let dek = `${holds}, ${short}. ${cap(crossPoss(g))} ${words(g.n)} ${tv(m, "take", "took")} it to ${b.G + g.n}. `;
    if (restN >= b.need) {
      // a party of several by its count, everyone else (independents among them) by name
      const who = [...rest.filter((x) => x.n > 1 && x.k !== "IND").map((x) => `${crossPoss(x)} ${words(x.n)}`), ...rest.filter((x) => x.n === 1 || x.k === "IND").flatMap((x) => x.names)];
      dek += `Without them it ${tv(m, "would need", "would have needed")} ${restN === b.need ? `all ${words(restN)} other crossbenchers` : `${words(b.need)} of the other ${words(restN)} crossbenchers`}: ${listAnd(who)}.`;
    } else dek += `No mix of the other ${words(restN)} crossbenchers ${tv(m, "is", "was")} enough without them.`;
    return { hed, dek: dek.trim() + ` ${tail}.${vacant}` };
  }
  if (b.enough.length > 1) {
    const names = b.enough.map(crossName);
    return { hed: `${GN} ${tv(m, "can", "could")} pass a bill with ${listAnd(names).replace(/ and /, " or ")}`, dek: `${holds}, ${short}. ${tail}; the crossbench ${b.C}.${vacant}` };
  }
  // no one crossbench party is enough: every crossbencher, where it takes them all; else the largest
  // party and how many more, named from the rest
  const everyone = (gs) => [...gs.filter((x) => x.n > 1 && x.k !== "IND").map((x) => `${crossPoss(x)} ${words(x.n)}`), ...gs.filter((x) => x.n === 1 || x.k === "IND").flatMap((x) => x.names)];
  if (b.C < b.need) return { hed: `${GN} ${tv(m, "can’t", "couldn’t")} pass a bill ${oppThe} ${opposes}, whatever the crossbench ${tv(m, "does", "did")}`, dek: `${holds}, ${short}, and the crossbench ${has} only ${words(b.C)}. ${tail}.${vacant}` };
  if (b.C === b.need) return { hed: `${GN} ${needs} every crossbencher to pass a bill ${oppThe} ${opposes}`, dek: `${holds}, ${short}: all ${words(b.C)} crossbenchers, ${listAnd(everyone(b.cross))}. ${tail}.${vacant}` };
  const g1 = b.cross[0], r = b.need - g1.n, rest = b.cross.slice(1), restN = rest.reduce((a, x) => a + x.n, 0);
  return { hed: `${GN} ${needs} ${crossName(g1)} and ${words(r)} more ${r === 1 ? "crossbencher" : "crossbenchers"} to pass a bill ${oppThe} ${opposes}`,
    dek: `${holds}, ${short}. ${cap(crossPoss(g1))} ${words(g1.n)} ${tv(m, "take", "took")} it to ${b.G + g1.n}; the last ${r === 1 ? "vote" : `${words(r)} votes`} ${tv(m, "have", "had")} to come from ${r === restN ? "all" : "among"} the other ${words(restN)}: ${listAnd(everyone(rest))}. ${tail}.${vacant}` };
}
// the 76 as one bar, the government first and the opposition last, the 39 marked
function senBar(m) {
  const b = senBalance(m), cnt = senCounts(m);
  const order = [b.gov, ...chamberBlocs(m).cross, b.opp].filter((f) => cnt[f]);
  let acc = 0;
  const segs = order.map((f) => { const x = (100 * acc) / b.N, w = (100 * cnt[f]) / b.N; acc += cnt[f]; return `<i style="left:${x}%;width:${w}%;${swc(f)}" title="${famLeg(f)} ${cnt[f]}"></i>`; }).join("");
  const mx = (100 * b.maj) / b.N;
  const lab = order.map((f) => `<span><i style="${swc(f)}"></i>${famLeg(f)} <b>${cnt[f]}</b></span>`).join("") + (m.vacant.length ? `<span><i style="background:var(--line-2)"></i>Vacant <b>${m.vacant.length}</b></span>` : "");
  return `<div class="sn-bar" role="img" aria-label="${order.map((f) => `${famLeg(f)} ${cnt[f]}`).join(", ")}; ${b.maj} for a majority"><div class="sn-track">${segs}<span class="sn-maj" style="left:${mx}%"></span></div><div class="sn-majlab" style="left:${mx}%">${b.maj} to pass a bill</div></div><div class="counts">${lab}</div>`;
}
function storySenate(m) {
  const s = S.ssel;
  if (s.level === "sen") return storySenator(m, s.i);
  // (the council is one statewide electorate: its "state" story is the chamber's)
  if (s.level === "state" && !m.lc) return storySenState(m, s.st);
  const { hed, dek } = senHedDek(m);
  let h = senHead(m.lc ? `The Legislative Council after ${yearLabel(m.year)}` : senNow(m) ? "The Senate today" : `The Senate after ${m.year}`, m.lc ? `The council as the new term began, ${longDate(m.asOf)}` : senNow(m) ? `Senators as at ${longDate(m.asOf)}` : `From ${longDate(m.asOf)}, as the ${m.dd ? "double dissolution’s" : "election’s"} senators took their seats`, hed, dek);
  h += `<div class="st-sec"><h3>The balance of power <small>${senBalance(m).maj} of ${m.seatsN} votes pass a bill</small></h3>${senBar(m)}</div>`;
  // who faces the voters next
  const up = m.divs.filter(upNext), upC = senCounts(m, upNext), stayC = senCounts(m, (d) => !upNext(d));
  const nUp = up.length, nTerr = up.filter((d) => TERRITORIES.has(d.st)).length;
  const upOrder = SEN_FAMS.filter((f) => upC[f] || stayC[f]);
  if (m.lc) {
    h += `<div class="st-sec"><h3>At ${nextEl(m)} <small>${nUp} seats up, ${m.divs.length - nUp} with terms to the ${m.later} election</small></h3><p class="st-p">${cap(nextEl(m))} ${nv(m, "fills", "filled")} ${words(nUp)} of the council’s ${m.seatsN} seats; the other ${words(m.divs.length - nUp)} ${tv(m, "have", "had")} terms to the ${m.later} election. ${lcDefends(m)}</p><table class="tbl"><thead><tr><th>Party</th><th>Up next</th><th>To ${m.later}</th></tr></thead><tbody>${upOrder.map((f) => `<tr><td><i class="sw" style="${swc(f)}"></i>${famLeg(f)}</td><td>${upC[f] || 0}</td><td>${stayC[f] || 0}</td></tr>`).join("")}</tbody></table></div>`;
    // the statewide vote, this election and the last stored one
    if (m.votes && m.pvotes) {
      const rows = {};
      for (const [ab, v] of Object.entries(m.votes)) { const f = FAM(ab); rows[f] = rows[f] || { v: 0, pv: 0 }; rows[f].v += v; }
      for (const [ab, v] of Object.entries(m.pvotes)) { const f = FAM(ab); rows[f] = rows[f] || { v: 0, pv: 0 }; rows[f].pv += v; }
      const share = (v, tot) => (100 * v) / tot;
      const order2 = SEN_FAMS.filter((f) => rows[f]).sort((a, b) => rows[b].v - rows[a].v);
      h += `<div class="st-sec"><h3>First preferences <small>statewide</small></h3><table class="tbl"><thead><tr><th>Party</th><th>${yearLabel(m.year)}</th><th>${m.prev}</th><th>Change</th></tr></thead><tbody>${order2.map((f) => { const r = rows[f], cur = share(r.v, m.formal), prev = r.pv ? share(r.pv, m.pformal) : null; return `<tr><td><i class="sw" style="${swc(f)}"></i>${famLeg(f)}</td><td>${f1(cur)}</td><td>${prev != null ? f1(prev) : "—"}</td><td>${prev != null ? sgn(cur - prev) : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
    }
    // the chamber's members, the new cohort first
    const row2 = (d) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt"><i class="sw" style="${swc(holdFam(d.hold))}"></i></span><span class="tx"><b>${ds(d.n)}</b> ${esc(partyName(d.hold.ab, d.hold.pn))}</span></button>`;
    const newC = m.divs.filter((d) => !upNext(d)), oldC = m.divs.filter(upNext);
    h += `<div class="st-sec"><h3>Elected at ${yearLabel(m.year)} <small>terms to the ${m.later} election</small></h3><div class="changes sn-list">${newC.sort(senOrder).map(row2).join("")}</div></div>`;
    h += `<div class="st-sec"><h3>Carried over <small>terms to the ${m.later - 4} election</small></h3><div class="changes sn-list">${oldC.sort(senOrder).map(row2).join("")}</div></div>`;
    const moved = m.divs.filter((d) => d.sen.electedAs);
    if (moved.length) h += `<div class="st-sec"><h3>Not as elected</h3><div class="changes">${moved.map((d) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt">${STATE_SHORT[d.st]}</span><span class="tx"><b>${ds(d.n)}.</b> Elected for ${theParty(d.sen.electedAs)} in ${d.sen.elected}; she carried the seat into her own party, ${esc(partyName(d.hold.ab, d.hold.pn))}.</span></button>`).join("")}</div></div>`;
    h += senFoot(m);
    return h;
  }
  if (m.nextDD) {
    const dueC = senCounts(m, (d) => d.due);
    h += `<div class="st-sec"><h3>At the 2016 election <small>all ${SEN_SEATS} seats, a double dissolution</small></h3><p class="st-p">The double dissolution of 9 May 2016 ended every senator’s term: all ${SEN_SEATS} seats were filled at the 2016 election, the ${m.divs.filter((d) => !d.due).length} due to sit to ${m.later} among them. ${senDefends(m, upC)}</p><table class="tbl"><thead><tr><th>Party</th><th>Seats</th><th>Due anyway</th></tr></thead><tbody>${upOrder.map((f) => `<tr><td><i class="sw" style="${swc(f)}"></i>${famLeg(f)}</td><td>${upC[f] || 0}</td><td>${dueC[f] || 0}</td></tr>`).join("")}</tbody></table></div>`;
  } else h += `<div class="st-sec"><h3>At ${nextEl(m)} <small>${nUp} seats up, ${m.divs.length - nUp} with terms to ${m.later}</small></h3><p class="st-p">${cap(nextEl(m))} ${nv(m, "fills", "filled")} ${nUp} seats: ${upClassWords(m)} and the ${words(nTerr)} territory senators. ${senDefends(m, upC)}</p><table class="tbl"><thead><tr><th>Party</th><th>Up next</th><th>To ${m.later}</th></tr></thead><tbody>${upOrder.map((f) => `<tr><td><i class="sw" style="${swc(f)}"></i>${famLeg(f)}</td><td>${upC[f] || 0}</td><td>${stayC[f] || 0}</td></tr>`).join("")}</tbody></table></div>`;
  // the states
  h += `<div class="st-sec"><h3>By state <small>12 senators a state, two a territory</small></h3><table class="tbl"><thead><tr><th>State</th><th>Senators</th><th>Up next</th></tr></thead><tbody>${STATES.map((st) => {
    const sens = m.divs.filter((d) => d.st === st), c = {}; for (const d of sens) { const f = holdFam(d.hold); c[f] = (c[f] || 0) + 1; }
    const bar = ["alp", "grn", "ind", "oth", "onp", "lnp"].filter((f) => c[f]).map((f) => `<i style="width:${(100 * c[f]) / (TERRITORIES.has(st) ? 2 : 12)}%;${swc(f)}"></i>`).join("");
    return `<tr data-sgo="state:${st}"><td>${STATE_TITLE[st].replace("Australian Capital Territory", "ACT").replace("Northern Territory", "NT")}</td><td>${sens.length}<span class="seatbar">${bar}</span></td><td>${sens.filter(upNext).length}</td></tr>`;
  }).join("")}</tbody></table></div>`;
  // since the elections: changes of party, casual vacancies and the High Court's recounts
  const moved = m.divs.filter((d) => d.sen.electedAs), filled = m.divs.filter((d) => d.sen.casual || d.sen.recount);
  if (moved.length || filled.length) {
    const row = (d, tx) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt">${STATE_SHORT[d.st]}</span><span class="tx"><b>${ds(d.n)}.</b> ${esc(tx)}.</span></button>`;
    h += `<div class="st-sec"><h3>Not as elected <small>${moved.length} changed party, ${filled.length} filled a vacancy</small></h3><div class="changes">${moved.map((d) => row(d, `Elected for ${theParty(d.sen.electedAs)}${d.sen.elected ? ` in ${d.sen.elected}` : ""}; ${senMoved(m, d)}`)).join("")}${filled.map((d) => row(d, senFilled(m, d))).join("")}</div></div>`;
  }
  h += senFoot(m);
  return h;
}
// "now sits for Labor", or for an election's Senate, "sat for Labor by July 2019"
const senMoved = (m, d) => `${tv(m, "now", "by " + monthYear(m.asOf) + ",")} ${d.hold.fam === "ind" ? tv(m, "sits as an independent", "sat as an independent") : `${tv(m, "sits", "sat")} for ${theParty(d.hold.ab)}`}`;
function senFilled(m, d) {
  const x = d.sen, to = termWords(m, d);
  if (x.recount) return `Declared elected by the High Court in ${x.recount.for}’s place on ${shortDate(x.recount.date)}, to ${to}`;
  return x.casual.for ? `Filled ${x.casual.for}’s vacancy for ${theParty(d.hold.ab)}${x.casual.date ? ` on ${shortDate(x.casual.date)}` : ""}, to ${to}` : `Filled a ${partyName(d.hold.ab, d.hold.pn)} vacancy, to ${to}`;
}
// "…": the council's up-next half defended party by party (never "the Coalition": SA's is the Liberals)
function lcDefends(m) {
  const by = new Map();
  for (const d of m.divs.filter(upNext)) {
    const ab = d.hold.ab;
    if (!by.has(ab)) by.set(ab, { n: 0, pn: d.hold.pn });
    by.get(ab).n++;
  }
  const parts = [...by.entries()].sort((a, b) => b[1].n - a[1].n || SEN_PARTY_ORDER.indexOf(a[0]) - SEN_PARTY_ORDER.indexOf(b[0]));
  if (!parts.length) return "";
  return `${listAnd(parts.map(([ab, g], k) => `${k ? theParty(ab, g.pn) : cap(theParty(ab, g.pn))} ${tv(m, "defends", "defended")} ${words(g.n)}`))}.`;
}
// "Labor defends 15 of them, the Coalition 15, the Greens six …"
function senDefends(m, upC) {
  const parts = SEN_FAMS.filter((f) => upC[f]).sort((a, b) => upC[b] - upC[a]);
  if (!parts.length) return "";
  const [first, ...rest] = parts;
  return `${cap(FAM_PL[first])} ${nv(m, "defends", "defended")} ${words(upC[first])} of them${rest.length ? `, ${listAnd(rest.map((f) => `${FAM_PL[f]} ${words(upC[f])}`))}` : ""}.`;
}
function storySenState(m, st) {
  const sens = m.divs.filter((d) => d.st === st), c = {}; for (const d of sens) { const f = holdFam(d.hold); c[f] = (c[f] || 0) + 1; }
  const order = SEN_FAMS.filter((f) => c[f]).sort((a, b) => c[b] - c[a]);
  const top = order[0], tie = order[1] && c[order[1]] === c[top];
  const terr = TERRITORIES.has(st), seats = terr ? 2 : 12, has = tv(m, "holds", "held");
  const hed = tie ? `${cap(FAM_PL[top])} and ${FAM_PL[order[1]]} ${tv(m, "hold", "held")} ${words(c[top])} seats each` : `${cap(FAM_PL[top])} ${has} ${words(c[top])} of ${STATE_POSS[st]} ${words(seats)} seats`;
  const up = sens.filter(upNext), cls = upClass(m);
  const vac = m.vacant.filter((v) => v.st === st).length;
  const dek = terr ? `Territory senators ${tv(m, "serve", "served")} until the next election, so both seats ${nv(m, "are", "were")} up at ${nextEl(m)}.`
    : m.nextDD ? `The double dissolution of 9 May 2016 put all ${words(seats)} seats to the voters at the 2016 election.${vac ? ` ${cap(words(vac))} ${vac > 1 ? "seats were" : "seat was"} vacant that day.` : ""}`
    : `${cap(words(up.length))} of the ${words(seats)}${m.dd ? ", the last six elected" : cls ? `, elected in ${cls}` : ""}, ${nv(m, "are", "were")} up at ${nextEl(m)}; the other ${words(seats - up.length)} ${tv(m, "have", "had")} terms to ${m.later}.${vac ? ` ${cap(words(vac))} ${vac > 1 ? "seats were" : "seat was"} vacant that day.` : ""}`;
  let h = senHead(STATE_TITLE[st], `${sens.length} senators${senNow(m) ? "" : `, ${monthYear(m.asOf)}`}`, hed, dek);
  sens.sort(senOrder);
  const row = (d) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt"><i class="sw" style="${swc(holdFam(d.hold))}"></i></span><span class="tx"><b>${ds(d.n)}</b> ${esc(partyName(d.hold.ab, d.hold.pn))}${d.sen.role ? ` · ${ROLE_NAME[d.sen.role]}` : ""}</span></button>`;
  if (!terr) {
    // (before the double dissolution the halves are the terms due, though every seat was up)
    const dueUp = sens.filter((d) => d.due), stays = sens.filter((d) => !d.due);
    h += `<div class="st-sec"><h3>${m.nextDD ? `Due at ${nextEl(m)}` : `Up at ${nextEl(m)}`} <small>${dueUp.length}${m.dd ? ", the last six elected" : cls ? `, elected in ${cls}` : ""}</small></h3><div class="changes sn-list">${dueUp.map(row).join("")}</div></div>`;
    h += `<div class="st-sec"><h3>Terms to ${m.later} <small>${stays.length}, elected ${m.dd ? "first" : "in"} ${ownElection(m)}</small></h3><div class="changes sn-list">${stays.map(row).join("")}</div></div>`;
  } else h += `<div class="st-sec"><h3>Senators <small>elected in ${ownElection(m)}</small></h3><div class="changes sn-list">${sens.map(row).join("")}</div></div>`;
  h += senFoot(m);
  return h;
}
// a list of senators: those up next first, then by party, then by name
const senOrder = (a, b) => (upNext(b) - upNext(a)) || SEN_PARTY_ORDER.indexOf(a.hold.ab) - SEN_PARTY_ORDER.indexOf(b.hold.ab) || a.n.localeCompare(b.n);
const ROLE_NAME = { president: "President of the Senate", leader: "Leader of the Government in the Senate", oppLeader: "Leader of the Opposition in the Senate" };
function storySenator(m, i) {
  const d = m.divs[i], x = d.sen, party = partyName(d.hold.ab, d.hold.pn);
  const hed = x.role ? ROLE_NAME[x.role] : m.lc ? (d.hold.fam === "ind" ? `Independent MLC` : `${party} in ${coSeat(m)}`) : d.hold.fam === "ind" ? `Independent senator for ${STATE_NAME[x.st]}` : `${party} senator for ${STATE_NAME[x.st]}`;
  const terr = TERRITORIES.has(x.st), is = nv(m, "is", "was");
  let dek;
  if (m.lc) dek = `Elected${x.electedAs ? ` for ${theParty(x.electedAs)}` : ""} in ${x.elected}, to a term running to the ${x.term} election${d.up ? `: the seat ${is} up at ${nextEl(m)}` : `, so the seat ${nv(m, "sits", "sat")} out ${nextEl(m)}`}.`;
  else if (x.casual || x.recount) dek = `${senFilled(m, d)}.`;
  else if (terr) dek = `Elected in ${x.elected}. A territory senator’s term runs with the House’s, so the seat ${is} up at ${nextEl(m)}.`;
  else if (x.term === 2017 || x.term === 2020) dek = `Elected${x.electedAs ? ` for ${theParty(x.electedAs)}` : ""} in ${x.elected}, to a term due to end on 30 June ${x.term}; the double dissolution ended it on 9 May 2016.`;
  else dek = `Elected${x.electedAs ? ` for ${theParty(x.electedAs)}` : ""} in ${x.elected}, to a term that ${x.term <= 2026 ? "ended" : "ends"} on 30 June ${x.term}${d.up ? `: the seat ${is} up at ${nextEl(m)}` : `, so the seat ${nv(m, "sits", "sat")} out ${nextEl(m)}`}.`;
  if (x.electedAs && !m.lc) dek += ` ${cap(senMoved(m, d))}.`;
  if (x.role) dek = `${party} senator for ${STATE_NAME[x.st]}. ${dek}`;
  let h = senHead(d.n, m.lc ? `${coTitle(m)}${senNow(m) ? "" : `, ${monthYear(m.asOf)}`}` : `Senator for ${STATE_TITLE[x.st]}${senNow(m) ? "" : `, ${monthYear(m.asOf)}`}`, hed, dek);
  const mates = m.divs.filter((y) => y.st === x.st && y.i !== i).sort(senOrder);
  const row = (y) => `<button type="button" data-sgo="sen:${y.i}"><span class="dt"><i class="sw" style="${swc(holdFam(y.hold))}"></i></span><span class="tx"><b>${ds(y.n)}</b> ${esc(partyName(y.hold.ab, y.hold.pn))}${upNext(y) ? "" : ` · to ${m.lc ? `the ${m.later} election` : m.later}`}</span></button>`;
  h += `<div class="st-sec"><h3>${m.lc ? "The other members" : `${STATE_POSS[x.st].replace(/^the /, "The ")} other senators`} <small>${mates.length}</small></h3><div class="changes sn-list">${mates.map(row).join("")}</div></div>`;
  h += senFoot(m);
  return h;
}
function senFoot(m) {
  return m.lc ? `<p class="st-foot">${m.src}. ${m.seating ? `Seats from the Parliament of South Australia’s chamber map, ${m.seating.plan}.` : "Drawn on the council’s own floor, sorted — no seating plan is filed for this council."}</p>`
    : senNow(m) ? `<p class="st-foot">The Parliament’s Senate seating plan as at ${longDate(m.asOf)}; terms from the AEC’s Senators Elected lists for 2022 and 2025.</p>`
    : `<p class="st-foot">The Parliamentary Handbook: senators’ terms of service, parties and changes of party; the Senate on ${longDate(m.asOf)}. Drawn on today’s floor, sorted.</p>`;
}

/* ----- selection, search and the tooltip ----- */
function selectSen(sel) {
  S.ssel = sel; S.hover = null; hideTip();
  renderStory(true); renderTimeline(); writeURL(); schedule();
}
function senTip(m, i) {
  const d = m.divs[i], x = d.sen;
  const term = m.lc ? (d.up ? `Up at the ${m.later - 4} state election` : `Term to the ${m.later} election`) : d.up ? (x.term === "next" ? `Up at ${nextEl(m)}` : `Up at ${nextEl(m)} (term to ${x.term})`) : `Term to ${x.term}`;
  return `<div class="tn">${ds(d.n)}<span>${STATE_SHORT[x.st]}${x.role === "president" ? " · President" : ""}</span></div><div class="tv">${esc(partyName(d.hold.ab, d.hold.pn))}</div><div class="ts">${esc(cap(term))}</div>`;
}
function senSearchItems(m) {
  const items = [];
  for (const st of STATES) { const n = m.divs.filter((d) => d.st === st).length; if (n) items.push({ k: "state", st, t: STATE_TITLE[st], s: `${n} ${m.lc ? "members" : "senators"}`, h: norm(STATE_TITLE[st] + " " + st), rank: 0 }); }
  for (const d of m.divs) items.push({ k: "sen", i: d.i, t: d.n, s: m.lc ? `${coTitle(m)}, ${partyName(d.hold.ab, d.hold.pn)}` : `Senator for ${STATE_SHORT[d.st]}, ${partyName(d.hold.ab, d.hold.pn)}`, h: norm(d.n), rank: 1 });
  return items;
}

/* =============================== the Senate lens ===============================
   Each seat's and polling place's Senate vote (map/data/senate-vote-<year>.json, .build/map/senate_vote.py):
   a party's share of the Senate's first preferences there, or (the lens's opening reading) that share less
   its House share, the split ticket: above zero where it polled better in the Senate. The gap is drawn only
   where the party stood for the House; the 2026 Farrer by-election had no Senate vote; the AEC served no
   Senate counts by polling place for 2004; a state election (SA 2026) has no Senate. Loaded with the lens. */
const SV = {}, SVP = {};
const svYear = (y) => (y === "now" ? 2025 : typeof y === "number" ? y : null);
function loadSenateVote(y) {
  const k = svYear(y);
  if (k == null) return Promise.resolve(null);
  if (SV[k]) return Promise.resolve(SV[k]);
  return (SVP[k] ??= getJSON(`/map/data/senate-vote-${k}.json`).then((j) => (SV[k] = j)).catch((e) => { delete SVP[k]; throw e; }));
}
const svOf = (m) => SV[svYear(m.year)] || null;
const svShare = (r, fam) => (r && r[0] ? (100 * r[1 + FAMS.indexOf(fam)]) / r[0] : null);
const senGap = () => S.senMode !== "share";
const stoodFor = (d, fam) => d.c.some((c) => c.b === fam);
function senDivValue(m, d) {
  if (d.by) return null; // the by-election had no Senate vote
  const s = svOf(m), v = s && svShare(s.divs[d.n], S.party);
  if (v == null) return null;
  return !senGap() ? v : stoodFor(d, S.party) ? v - d.fp[S.party] : null;
}
function senBoothValue(m, j) {
  const s = svOf(m), D = m.divs[m.booth.d[j]];
  if (!s || D.by) return null;
  const v = svShare(s.booths[m.booth.id[j]], S.party);
  if (v == null) return null;
  if (!senGap()) return v;
  const h = m.booth.fp[S.party][j];
  return stoodFor(D, S.party) && !Number.isNaN(h) ? v - h : null;
}
// an area's Senate share, its House share and the gap, over its seats (the by-election left out: no Senate vote)
function senArea(m, idx, fam) {
  const s = svOf(m); if (!s) return null;
  let sv = 0, sf = 0, hv = 0, hf = 0, stood = 0, n = 0;
  for (const i of idx) {
    const d = m.divs[i], r = s.divs[d.n]; if (d.by || !r) continue;
    sv += r[1 + FAMS.indexOf(fam)]; sf += r[0]; hv += (d.fp[fam] * d.formal) / 100; hf += d.formal; n++;
    if (stoodFor(d, fam)) stood++;
  }
  if (!sf) return null;
  return { sen: (100 * sv) / sf, house: (100 * hv) / hf, gap: (100 * sv) / sf - (100 * hv) / hf, stood, n };
}
// why a seat or place has no figure
function senNoValue(m, kind, d) {
  if (svYear(m.year) == null) return "A state election has no Senate";
  if (d && d.by) return "No Senate vote at the by-election";
  if (kind === "booth" && svYear(m.year) === 2004) return "No Senate count by polling place in 2004";
  if (senGap() && d && !stoodFor(d, S.party)) return "Didn’t stand for the House here";
  return "No Senate count here";
}
// "polled 3.2 points higher in the Senate than in the House"; under a quarter point, about the same (the
// figures beside it, at a decimal place, can differ by a tenth)
const senGapWords = (g) => (Math.abs(g) < 0.25 ? "polled about the same in the Senate as in the House" : `polled ${pts(g)} ${g > 0 ? "higher" : "lower"} in the Senate than in the House`);
// a family as the copy refers back to it: the parties singular, independents and other candidates plural
const senPron = (fam) => (fam === "ind" || fam === "oth" ? { it: "they", its: "their", It: "They", Its: "Their" } : { it: "it", its: "its", It: "It", Its: "Its" });
