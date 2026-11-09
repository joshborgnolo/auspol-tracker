/* Surface describes nearby ordinary polling-place results only. It never
   paints unlocated votes, invents local counts or extrapolates past 25 km.
   See .build/map/surface-audit.md for the audited method and its limits. */
const DRAWS = [["seats", "Seats"], ["balloons", "Balloons"], ["surface", "Surface"], ["areas", "Areas"], ["chart", "Chart"]];
// a seat type belongs to the whole seat, and so does its exhausted share: nothing to blend
function surfaceReason(m) {
  if (S.lens === "seifa") return "Census figures use census areas, not a smoothed polling-place surface. Use Areas or Seats.";
  if (S.lens === "cls" || (S.lens === "informal" && infModeOf(m) === "exhaust")) return "This figure belongs to the whole seat. Use Seats.";
  if ((S.lens === "tpp" && S.tppMode === "swing") || (S.lens === "fp" && S.fpMode === "change") || (S.lens === "senate" && senGap())) return "These changes do not have comparable local count bases for a surface. Use Seats or Balloons.";
  return "";
}
const surfaceFits = (m) => !surfaceReason(m);
// Areas is the Census lens's own drawing: it needs a census pack for the frame's vintage
// and a lane the pack serves (the homeless lane is an SA2 estimate, never an SA1 count)
const areasFits = (m) => {
  if (S.lens !== "seifa" || !m) return false;
  if (AREAS_FILES[areasVintage(m)] == null) return false;
  const lane = areasLane();
  if (!lane || !AREAS_LANES.has(lane)) return false;
  if ((lane === "loinc" || lane === "hiqinc") && !(m.incomeCuts && m.incomeCuts.loCutWeekly > 0 && m.incomeCuts.hiQCutWeekly > 0)) return false;
  return true;
};
// the drawing in force on an election (the chamber and the list keep their seats)
// (Chart lays its own plot over the stage: the map beneath keeps its seats)
const drawOf = (m) => (S.view !== "map" || !m || m.house === "senate" || S.draw === "chart" ? "seats" : S.draw === "surface" && !surfaceFits(m) ? (areasFits(m) ? "areas" : "seats") : S.draw === "areas" && !areasFits(m) ? "seats" : S.draw);

/* ----- the contest -----
   Labor v the Coalition is counted at every polling place. Labor v One Nation and the
   Coalition v One Nation are not, except where a seat's own final two happened to be that
   pair, so everywhere else they are built: the place's House first preferences, with each
   other group's votes shared as that group's voters ranked the two on the Senate ballot.
   Federal frames read those orders polling place by polling place, drawn towards the
   seat's (AXIS_K ballots' worth); state frames, which have no Senate of their own, read
   the state's Senate ballots from the nearest federal election. An election offers the
   contests only where One Nation stood in at least three seats in four, since a place with
   no One Nation candidate would be an estimate of an absent party, and where those orders
   exist: 1998 and 2001 clear the first bar but have no Senate ballots to read, and their
   Senates ran on group tickets. South Australia 2026's Labor v One Nation uses the
   estimates of that election's own splits instead, being the nearer evidence. */
const AXIS_FRAMES = { 2022: 2022, 2025: 2025, now: 2025, qld20: 2019, qld24: 2025, qldnow: 2025, sa26: 2025 };
const AXIS_K = 30;
// the contest's parties as the frame names them: the Coalition, or the Liberals, or the LNP
const axisName = (f, cap) => (f === "alp" ? "Labor" : f === "onp" ? "One Nation" : f === "grn" ? (cap ? "The Greens" : "the Greens") : coalW(cap ? 1 : 0));
// the three Greens pairings are built from the ballot files' own counts, which only the federal
// frames' stores carry; the constant-rate frames have no Greens series to stand on
const AXIS_GREEN_PAIRS = [["GO", "Greens v One Nation"], ["GA", "Greens v Labor"], ["GC", "Greens v the Coalition"]];
const AXIS_GREEN_SET = new Set(AXIS_GREEN_PAIRS.map(([p]) => p));
const axisOpts = (m) => [["AC", `Labor v ${coalW(0)}`], ["AO", "Labor v One Nation"], ["CO", `${coalW(1).replace(/^The /, "")} v One Nation`], ...(m && STATE_YEARS.has(m.year) ? [] : AXIS_GREEN_PAIRS)];
const axisOffers = (m, pair) => SP_PAIRS[pair] != null && (!AXIS_GREEN_SET.has(pair) || !STATE_YEARS.has(m.year));
// the state frames' shares reaching the pair's first-named party (flows.mjs FLOW_HISTORY_SENATE_ON,
// _CON, pinned in test-map-page): Queensland's Senate ballots of 2019 and 2025, South Australia's of
// 2025, and for South Australia 2026's Labor v One Nation Kevin Bonham's estimates of that election's own splits
const AXIS_RATES = {
  qld20: { AO: { lnp: 35.7, grn: 93.5, oth: 37.6 }, CO: { alp: 63.6, grn: 84.0, oth: 46.1 } },
  qld24: { AO: { lnp: 22.8, grn: 94.6, oth: 41.0 }, CO: { alp: 70.7, grn: 77.9, oth: 39.1 } },
  qldnow: { AO: { lnp: 22.8, grn: 94.6, oth: 41.0 }, CO: { alp: 70.7, grn: 77.9, oth: 39.1 } },
  sa26: { AO: { lnp: 33.9, grn: 84.8, oth: 55.9 }, CO: { alp: 79.9, grn: 84.5, oth: 53.7 } },
};
// the site's own table for Labor v One Nation (flows.mjs FP_ON, pinned in test-map-page): the 2025 frames'
// Senate orders keep their pattern from place to place, and are levelled to it as a whole, as /model/ levels its own
const AXIS_LEVEL = { lnp: 27, grn: 91, oth: 55 };
const axisFrame = (m) => (m ? AXIS_FRAMES[m.year] ?? null : null);
// the contest in force: only the Two-party lens's share, only as balloons or a surface
function axisNow(m) {
  if (S.axis === "AC" || S.lens !== "tpp" || S.tppMode === "swing" || S.view !== "map" || S.draw === "seats") return "AC";
  if (axisFrame(m) == null) return "AC";
  return axisOffers(m, S.axis) ? S.axis : "AC";
}
const axisNames = (pair = S.axis) => SP_PAIRS[pair].map((f) => axisName(f));
const axisCap = (pair = S.axis) => SP_PAIRS[pair].map((f) => axisName(f, true));
// how far from even the contest's colours run: to where its places actually spread (the One Nation
// pairings' spreads run longest — the Greens' sweep of them out of town is their mirror)
const axisSpan = (pair = S.axis) => (pair === "CO" || pair === "GO" ? 40 : 30);
const axisRamp = (pair = S.axis) => (pair === "AO" ? RAMP.divOn : pair === "CO" ? RAMP.divCo : pair === "GO" ? RAMP.divGo : pair === "GA" ? RAMP.divGa : pair === "GC" ? RAMP.divGc : RAMP.div);
const logit = (p) => Math.log(p / (1 - p)), expit = (x) => 1 / (1 + Math.exp(-x));
// the shift that carries a group's local rates, votes-weighted, to a whole's level
function levelShift(r, wt, target) {
  let lo = -2.5, hi = 2.5;
  for (let k = 0; k < 26; k++) {
    const d = (lo + hi) / 2; let s = 0, t = 0;
    for (let j = 0; j < r.length; j++) { if (!(wt[j] > 0) || Number.isNaN(r[j])) continue; s += wt[j] * expit(logit(r[j]) + d); t += wt[j]; }
    if (t === 0) return 0;
    if (s / t < target) lo = d; else hi = d;
  }
  return (lo + hi) / 2;
}
// each polling place's share for the pair's first-named party (m._axis[pair]), with what it stands on
function axisOf(m, pair = axisNow(m)) {
  if (pair === "AC") return null;
  const cache = m._axis || (m._axis = {});
  if (cache[pair]) return cache[pair];
  const src = axisFrame(m), fed = !STATE_YEARS.has(m.year), s = fed ? SPD[src] : null;
  if (src == null || (fed && !s)) return null;
  const b = m.booth, n = b.n, [fa, fb] = SP_PAIRS[pair], donors = SP_DONORS[pair];
  const out = { v: new Float32Array(n).fill(NaN), a: new Float32Array(n), t: new Float32Array(n), counted: 0, est: 0, seatSkip: new Uint8Array(m.divs.length) };
  // a seat missing either party, or a by-election's, has nothing to split
  for (const d of m.divs) if (d.by || !(d.fp[fa] > 0) || !(d.fp[fb] > 0)) out.seatSkip[d.i] = 1;
  // each group's rate at each place, at its slot in the file's pair order (SP_PAIRS)
  const k0 = (() => { let k = 0; for (const p of Object.keys(SP_PAIRS)) { if (p === pair) return k; k += SP_DONORS[p].length; } return 0; })();
  const rates = donors.map((f, q) => {
    const r = new Float32Array(n).fill(NaN);
    if (!fed) { r.fill(AXIS_RATES[m.year][pair][f] / 100); return r; }
    const slot = 3 * (k0 + q);
    for (let j = 0; j < n; j++) {
      const D = m.divs[b.d[j]], seat = s.divs[D.n]; if (!seat) continue;
      const sx = seat[slot], sy = seat[slot + 1], rs = sx + sy ? sx / (sx + sy) : 0.5;
      const cell = s.booths[b.id[j]], x = cell ? cell[slot] : 0, y = cell ? cell[slot + 1] : 0;
      r[j] = clamp((x + AXIS_K * rs) / (x + y + AXIS_K), 0.005, 0.995);
    }
    return r;
  });
  if (fed && src === 2025 && pair === "AO") donors.forEach((f, q) => {
    const wt = new Float32Array(n); for (let j = 0; j < n; j++) { if (out.seatSkip[b.d[j]]) continue; wt[j] = groupVotes(b, f, j); }
    const d = levelShift(rates[q], wt, AXIS_LEVEL[f] / 100), r = rates[q];
    for (let j = 0; j < n; j++) if (!Number.isNaN(r[j])) r[j] = expit(logit(r[j]) + d);
  });
  for (let j = 0; j < n; j++) {
    const D = m.divs[b.d[j]]; if (out.seatSkip[D.i]) continue;
    const formal = b.formal[j]; if (!formal) continue;
    const tc = b.raw.tcp[j], fs = [D.A.b, D.B.b];
    // this seat's final two were this pair: its count, not an estimate
    if (tc && tc[0] + tc[1] && fs.includes(fa) && fs.includes(fb) && fa !== fb) {
      const A = fs[0] === fa ? tc[0] : tc[1]; out.a[j] = A; out.t[j] = tc[0] + tc[1]; out.v[j] = (100 * A) / out.t[j]; out.counted += out.t[j]; continue;
    }
    let A = (b.fp[fa][j] / 100) * formal, ok = !Number.isNaN(A);
    donors.forEach((f, q) => { const r = rates[q][j]; if (Number.isNaN(r)) { ok = false; return; } A += r * groupVotes(b, f, j); });
    if (!ok) continue;
    out.a[j] = A; out.t[j] = formal; out.v[j] = (100 * A) / formal; out.est += formal;
  }
  return (cache[pair] = out);
}
// a group's first preferences at a place: "others" is independents and everyone else, as the Senate's cohort is
const groupVotes = (b, f, j) => { const x = (f === "oth" ? (b.fp.ind[j] || 0) + (b.fp.oth[j] || 0) : b.fp[f][j]) * b.formal[j] / 100; return Number.isFinite(x) ? x : 0; };
const axisBooth = (m, j) => { const A = axisOf(m); if (!A) return nn(m.booth.tpp[j]); const v = A.v[j]; return Number.isNaN(v) ? null : v; };
function axisArea(m, idx) {
  const A = axisOf(m); if (!A) return null;
  const b = m.booth; let a = 0, t = 0;
  for (const i of idx) for (const j of b.byDiv[i]) { if (Number.isNaN(A.v[j])) continue; a += A.a[j]; t += A.t[j]; }
  return t ? (100 * a) / t : null;
}
const axisSeat = (m, i) => { const A = axisOf(m); return !A ? nn(m.divs[i].tpp) : A.seatSkip[i] ? null : axisArea(m, [i]); };

/* ----- places with no figure of their own -----
   The AEC's polling places carry a two-party count from 1996 on, and the state commissions'
   carry none; 1993 and several state elections have no final count by polling place either.
   First preferences are there for every election, so those frames' places are estimated:
   each place's share of its seat's final two, or its two-party share at the table's flows,
   moved together until the seat's places come to the seat's own count (levelShift, a seat at
   a time). The seat's total stays true and the spread inside it is the place's real vote.
   Any other reading with no figure at the places lets each carry its seat's. */
function estBooths(m) {
  if (m._est) return m._est;
  const b = m.booth, n = b.n, a = new Float32Array(n).fill(NaN), t = new Float32Array(n).fill(NaN);
  for (const D of m.divs) {
    const list = b.byDiv[D.i]; if (!list.length) continue;
    const sa = new Float32Array(list.length), st = new Float32Array(list.length), wt = new Float32Array(list.length);
    list.forEach((j, q) => {
      const v = b.raw.v[j] || [], f = b.formal[j], va = v[D.A.k] || 0, vb = v[D.B.k] || 0;
      wt[q] = f;
      sa[q] = clamp((va + 0.5) / (va + vb + 1), 0.01, 0.99);
      st[q] = f ? clamp((groupVotes(b, "alp", j) + 0.88 * groupVotes(b, "grn", j) + 0.26 * groupVotes(b, "onp", j) + 0.55 * groupVotes(b, "oth", j)) / f, 0.01, 0.99) : 0.5;
    });
    const da = levelShift(sa, wt, clamp(D.va / (D.va + D.vb), 0.01, 0.99)), dt = D.tpp != null ? levelShift(st, wt, clamp(D.tpp / 100, 0.01, 0.99)) : 0;
    list.forEach((j, q) => { if (!wt[q]) return; a[j] = expit(logit(sa[q]) + da); t[j] = 100 * expit(logit(st[q]) + dt); });
  }
  return (m._est = { a, t });
}
// does this election lack the reading at its polling places? (A few new places missing a swing isn't that)
function placesLack(m) {
  const b = m.booth; let have = 0;
  if (S.lens === "winner") { for (let j = 0; j < b.n; j++) if (b.raw.tcp[j] && b.raw.tcp[j][0] + b.raw.tcp[j][1]) have++; }
  else for (let j = 0; j < b.n; j++) { const v = boothValue(m, j); if (v != null && !Number.isNaN(v)) have++; }
  return have < 0.1 * b.n;
}
const placesLackMemo = (m) => { const k = readingKey(m); if (m._lack && m._lack.k === k) return m._lack.v; const v = placesLack(m); m._lack = { k, v }; return v; };
// a place's figure as the balloons and the surface read it
function drawValue(m, j) {
  const v = boothValue(m, j);
  if (v != null && !Number.isNaN(v)) return v;
  if (!placesLackMemo(m)) return null;
  const D = m.divs[m.booth.d[j]];
  if (S.lens === "winner") { const a = estBooths(m).a[j]; return Number.isNaN(a) ? null : (a >= 0.5 ? D.A : D.B).fam; }
  if (S.lens === "tpp" && S.tppMode !== "swing") { const t = estBooths(m).t[j]; return Number.isNaN(t) ? null : t; }
  return divValue(m, D.i);
}
// the final two's votes at a place, counted or estimated
function finalVotes(m, j) {
  const b = m.booth, t = b.raw.tcp[j];
  if (t && t[0] + t[1]) return t;
  if (!placesLackMemo(m)) return null;
  const a = estBooths(m).a[j]; return Number.isNaN(a) ? null : [a * b.formal[j], (1 - a) * b.formal[j]];
}

/* ----- the steps -----
   The surface's bands of each reading, in the reading's own units. Where a reading has two
   sides the steps are narrowest at the meeting of the two, and that meeting is the line. */
const mirrored = (mid, steps) => [...steps.slice().reverse().map((d) => mid - d), mid, ...steps.map((d) => mid + d)];
const evenly = (lo, hi, n) => Array.from({ length: n - 1 }, (_, k) => lo + ((hi - lo) * (k + 1)) / n);
function surfaceScale(m) {
  const wide = axisNow(m) !== "AC";
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? { lo: -40, hi: 40, edges: mirrored(0, [1, 2.5, 5, 7.5, 10, 15]), line: 0 }
      : { lo: 0, hi: 100, edges: mirrored(50, wide ? [2.5, 5, 10, 15, 20, 30, 40] : [2.5, 5, 7.5, 10, 15, 20]), line: 50 };
    case "fp": if (S.fpMode === "change") return { lo: -60, hi: 60, edges: mirrored(0, [1, 2, 4, 6, 9, 12, 15]), line: 0 };
      return shareScale(FPMAX[S.party]);
    case "senate": if (senGap()) return { lo: -60, hi: 60, edges: mirrored(0, [1, 2, 4, 6, 8, 10]), line: 0 };
      return shareScale(FPMAX[S.party]);
    case "flow": case "senpref": return { lo: 0, hi: 100, edges: mirrored(50, [5, 10, 15, 20, 30, 40]), line: 50 };
    case "informal": return { lo: 0, hi: 30, edges: evenly(0, infHi(m), 10), line: null };
    case "seifa": {
      if (!isDemo()) return { lo: 1, hi: 10, edges: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5], line: null };
      const [lo, hi] = demoRange(), w = hi - lo; return { lo: lo - w, hi: hi + w, edges: evenly(lo, hi, 10), line: null };
    }
  }
  return null;
}
function shareScale(top) { const step = top >= 50 ? 5 : 2.5; const e = []; for (let v = step; v < top; v += step) e.push(v); return { lo: 0, hi: 100, edges: e, line: null }; }
const bandMid = (S0, k) => { const e = S0.edges, n = e.length; return k === 0 ? e[0] - (n > 1 ? (e[1] - e[0]) / 2 : 1) : k === n ? e[n - 1] + (e[n - 1] - e[n - 2]) / 2 : (e[k - 1] + e[k]) / 2; };
// the lead's steps on the Winner lens, in points between the first and second
const LEAD_STEPS = [5, 10, 20, 30, 40, 60];
const LEAD_RAMP_AT = [0.2, 0.31, 0.42, 0.52, 0.61, 0.7, 0.8];
const rgba32 = (c) => ((255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
const readingKey = (m) => [m.year, S.lens, S.tppMode, S.fpMode, S.senMode, S.infMode, S.incMode, S.ageMode, S.eduMode, S.party, S.from, S.vs, S.spPair, S.spFrom, S.index, S.cob, S.rel, S.ten, S.anc, axisNow(m), m.ppl ? 1 : 0, TH.dark].join("|");
// the votes a place counts for in a blend: a group's own where the reading is that group's
function surfaceWeight(m, j) {
  const b = m.booth;
  if (S.lens === "flow") return groupVotes(b, S.from, j);
  if (S.lens === "senpref") { const s = spOf(m), c = s && spCells(s.booths[b.id[j]]); return c ? c.x + c.y : 0; }
  return b.formal[j];
}
/* Nominal positions for Balloons only. Surface never uses these positions. */
function seatSpots(m, i) {
  const c = m._spots || (m._spots = []);
  if (c[i]) return c[i];
  const g = m.geo, bb = g.bb[i], out = [];
  if (bb) {
    const w = bb[1][0] - bb[0][0], h = bb[1][1] - bb[0][1], step = Math.max(w, h) / 6;
    for (let y = bb[0][1] + step / 2; y < bb[1][1]; y += step) for (let x = bb[0][0] + step / 2; x < bb[1][0]; x += step) if (hitCtx.isPointInPath(g.paths[i], x, y)) out.push([x, y]);
    if (!out.length) out.push([(bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2]);
  }
  return (c[i] = out);
}
// a balloon's spot in its seat: scattered, so nothing reads as a place the way a regular grid of dots would
function nominalSpot(m, i, [x, y], k) {
  const bb = m.geo.bb[i], step = Math.max(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1]) / 6;
  const a = ((k + 1) * 0.6180339887) % 1, c = ((k + 1) * 0.7548776662) % 1, jx = x + (a - 0.5) * step * 0.9, jy = y + (c - 0.5) * step * 0.9;
  return hitCtx.isPointInPath(m.geo.paths[i], jx, jy) ? [jx, jy] : [x, y];
}
// a frame's map units to the kilometre, at the middle of its map (each frame's plane has its own scale)
function unitsPerKm(m) {
  const [[x0, y0], [x1, y1]] = homeBox(m), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, a = m.proj.invert([cx, cy]), b = m.proj.invert([cx + 10, cy]);
  const R = Math.PI / 180, dLat = (b[1] - a[1]) * R, dLon = (b[0] - a[0]) * R * Math.cos(a[1] * R);
  return 10 / (6371 * Math.hypot(dLat, dLon));
}
// Surface uses a measure's actual denominator, independently of balloon sizing.
function surfaceDenominator(m, j) {
  const b = m.booth, D = m.divs[b.d[j]], raw = b.raw;
  switch (S.lens) {
    case "winner": { const t = raw.tcp[j]; return t ? t[0] + t[1] : 0; }
    case "tpp": { const A = axisOf(m), t = raw.tpp[j]; return A ? A.t[j] : t ? t[0] + t[1] : 0; }
    case "informal": return b.votes[j];
    case "flow": return (raw.fl[j] || []).reduce((n, [ci, a, c]) => n + (D.c[ci].b === S.from ? a + c : 0), 0);
    case "senate": { const s = svOf(m), row = s && s.booths[b.id[j]]; return row ? row[0] : 0; }
    case "senpref": { const s = spOf(m), c = s && spCells(s.booths[b.id[j]]); return c ? c.x + c.y : 0; }
    case "fp": return b.formal[j];
    default: return 0;
  }
}
function surfaceEligible(m, j) {
  const b = m.booth;
  return b.ty[j] === 1 && Number.isFinite(b.x[j]) && Number.isFinite(b.y[j])
    && Number.isFinite(b.raw.lat[j]) && Math.abs(b.raw.lat[j]) <= 90
    && Number.isFinite(b.raw.lon[j]) && Math.abs(b.raw.lon[j]) <= 180;
}
const SURF_MAX_KM = 25, SURF_MIN_KM = 2, SURF_MIN_MASS = 100, SURF_FADE_MASS = 400;
function surfaceData(m) {
  if (!surfaceFits(m)) return null;
  const b = m.booth, fam = S.lens === "winner", idx = [], vals = [], weights = [];
  const fams = FAMS.slice(), famAt = Object.fromEntries(fams.map((f, k) => [f, k]));
  const seatN = new Int32Array(m.divs.length), seatVotes = new Float64Array(m.divs.length);
  for (let j = 0; j < b.n; j++) {
    if (!surfaceEligible(m, j)) continue;
    const w = surfaceDenominator(m, j); if (!(w > 0) || !Number.isFinite(w)) continue;
    let val;
    if (fam) { const t = b.raw.tcp[j], d = m.divs[b.d[j]]; val = [famAt[d.A.b], famAt[d.B.b], t[0] / w]; }
    else { val = boothValue(m, j); if (!Number.isFinite(val)) continue; }
    idx.push(j); vals.push(val); weights.push(w); seatN[b.d[j]]++; seatVotes[b.d[j]] += b.formal[j];
  }
  if (!idx.length) return null;
  const n = idx.length, x = Float64Array.from(idx, (j) => b.x[j]), y = Float64Array.from(idx, (j) => b.y[j]);
  const p = m.proj, rad = Math.PI / 180, parallels = p.parallels().map((v) => Math.sin(v * rad));
  const pn = (parallels[0] + parallels[1]) / 2, pc = 1 + parallels[0] * (2 * pn - parallels[0]), tr = p.translate();
  const centre = p.center(), cr = Math.sqrt(pc - 2 * pn * Math.sin(centre[1] * rad)) / pn, ct = centre[0] * rad * pn;
  const D = { n, x, y, w: Float64Array.from(weights), lon: Float64Array.from(idx, (j) => b.raw.lon[j]), lat: Float64Array.from(idx, (j) => b.raw.lat[j]),
    projection: { k: p.scale(), tx: tr[0], ty: tr[1], n: pn, c: pc, r0: Math.sqrt(pc) / pn, cx: cr * Math.sin(ct), cy: Math.sqrt(pc) / pn - cr * Math.cos(ct), rotate: p.rotate()[0] },
    u: unitsPerKm(m), maxKm: SURF_MAX_KM, minKm: SURF_MIN_KM, minMass: SURF_MIN_MASS, fadeMass: SURF_FADE_MASS,
    bg: rgba32(TH.nodata), ink: rgba32(TH.ink), boothIndex: idx, seatN, seatVotes };
  if (fam) {
    const used = fams.filter((f, k) => vals.some((q) => q[0] === k || q[1] === k)), remap = fams.map((f) => used.indexOf(f));
    D.ch = used.map(() => new Float64Array(n));
    vals.forEach((q, k) => { D.ch[remap[q[0]]][k] += q[2]; D.ch[remap[q[1]]][k] += 1 - q[2]; });
    const nb = LEAD_STEPS.length + 1;
    D.fam = true; D.nb = nb; D.lo = 0; D.hi = 100;
    D.band = new Uint8Array(4096).map((_, k) => { const v = (100 * k) / 4095; let q = 0; while (q < LEAD_STEPS.length && v >= LEAD_STEPS[q]) q++; return q; });
    D.col = new Uint32Array(used.length * nb);
    used.forEach((f, u) => { for (let q = 0; q < nb; q++) D.col[u * nb + q] = rgba32(RAMP.gain[f][Math.round(LEAD_RAMP_AT[q] * 100)]); });
    D.ids = used;
  } else {
    D.ch = [Float64Array.from(vals)];
    const sc = surfaceScale(m), e = sc.edges;
    D.fam = false; D.lo = sc.lo; D.hi = sc.hi;
    D.band = new Uint8Array(4096).map((_, k) => { const v = sc.lo + ((sc.hi - sc.lo) * k) / 4095; let q = 0; while (q < e.length && v >= e[q]) q++; return q; });
    D.col = Uint32Array.from({ length: e.length + 1 }, (_, k) => rgba32(colorOf(bandMid(sc, k)) || TH.nodata));
  }
  return { D, none: m.divs.map(d => seatN[d.i] === 0) };
}

/* A local descriptive surface, not a model of residents. Distances are great-circle
   kilometres; a compact kernel has exactly zero influence outside its radius.
   Four nearest distinct sites set bandwidth (2–25 km); vote counts set the blend.
   Support is kernel-weighted ballots, not a confidence interval. */
function surfaceEngine() {
  const cache = new WeakMap(), RAD = Math.PI / 180, EARTH = 6371;
  const vector = (D, x, y) => D.projection ? [Math.cos(y * RAD) * Math.cos(x * RAD), Math.cos(y * RAD) * Math.sin(x * RAD), Math.sin(y * RAD)] : [x / D.u, y / D.u, 0];
  const squaredRadius = (D, km) => D.projection ? (2 * Math.sin(km / (2 * EARTH))) ** 2 : km * km;
  const distanceKm = (D, squared) => D.projection ? 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(squared) / 2)) : Math.sqrt(squared);
  function build(D) {
    let c = cache.get(D); if (c) return c;
    const sites = new Map();
    for (let i = 0; i < D.n; i++) {
      if (!(D.w[i] > 0)) continue;
      const x = D.projection ? D.lon[i] : D.x[i], y = D.projection ? D.lat[i] : D.y[i], key = `${x},${y}`;
      if (!sites.has(key)) sites.set(key, { point: vector(D, x, y), indices: [] });
      sites.get(key).indices.push(i);
    }
    function tree(rows, depth) {
      if (!rows.length) return null;
      const axis = depth % (D.projection ? 3 : 2), mid = rows.length >> 1;
      rows.sort((a, b) => a.point[axis] - b.point[axis]);
      return { ...rows[mid], axis, left: tree(rows.slice(0, mid), depth + 1), right: tree(rows.slice(mid + 1), depth + 1) };
    }
    c = tree([...sites.values()], 0); cache.set(D, c); return c;
  }
  // Inverse of the map's unreflected, unrotated-screen conic equal-area projection.
  // Frame fits supply their parallels, longitude rotation, scale and centre offset.
  function lonlat(D, x, y) {
    const p = D.projection;
    if (!p) return [x, y];
    const X = (x - p.tx) / p.k + (p.cx || 0), Y = p.r0 + (y - p.ty) / p.k - (p.cy || 0);
    const theta = Math.atan2(p.n < 0 ? -X : X, p.n < 0 ? -Y : Y);
    const lon = theta / p.n / RAD - p.rotate;
    const lat = Math.asin(Math.max(-1, Math.min(1, (p.c - (X * X + Y * Y) * p.n * p.n) / (2 * p.n)))) / RAD;
    return [lon, lat];
  }
  function sample(D, x, y) {
    const root = build(D), ll = lonlat(D, x, y), point = vector(D, ll[0], ll[1]), max = D.maxKm || 25;
    const max2 = squaredRadius(D, max), nearestFour = [];
    const squaredDistance = (node) => (node.point[0] - point[0]) ** 2 + (node.point[1] - point[1]) ** 2 + (node.point[2] - point[2]) ** 2;
    // Three-dimensional unit-sphere chords preserve great-circle distance order.
    // The spatial tree avoids scanning every booth in a city for every pixel.
    function nearest(node) {
      if (!node) return;
      const d2 = squaredDistance(node), delta = point[node.axis] - node.point[node.axis];
      if (d2 < max2) { nearestFour.push(d2); nearestFour.sort((a, b) => a - b); if (nearestFour.length > 4) nearestFour.pop(); }
      nearest(delta < 0 ? node.left : node.right);
      if (delta * delta < (nearestFour.length === 4 ? nearestFour[3] : max2)) nearest(delta < 0 ? node.right : node.left);
    }
    nearest(root);
    if (!nearestFour.length) return null;
    const radius = nearestFour.length === 4 ? Math.min(max, Math.max(D.minKm || 2, 2 * distanceKm(D, nearestFour[3]))) : max, radius2 = squaredRadius(D, radius);
    const values = new Float64Array(D.ch.length); let mass = 0, count = 0, nearestKm = Infinity;
    function accumulate(node) {
      if (!node) return;
      const d2 = squaredDistance(node), delta = point[node.axis] - node.point[node.axis];
      if (d2 < radius2) {
        const km = distanceKm(D, d2), t = km / radius, kernel = (1 - t) ** 4 * (1 + 4 * t);
        for (const i of node.indices) {
          const w = kernel * D.w[i]; mass += w; count++; nearestKm = Math.min(nearestKm, km);
          for (let q = 0; q < values.length; q++) values[q] += w * D.ch[q][i];
        }
      }
      accumulate(delta < 0 ? node.left : node.right);
      if (delta * delta < radius2) accumulate(delta < 0 ? node.right : node.left);
    }
    accumulate(root);
    if (mass < (D.minMass || 100)) return null;
    for (let q = 0; q < values.length; q++) values[q] /= mass;
    const a = Math.min(1, Math.max(0, (mass - (D.minMass || 100)) / (D.fadeMass || 400)));
    return { values, mass, count, nearest: nearestKm, radius, alpha: a * a * (3 - 2 * a) };
  }
  function at(D, x, y) { return sample(D, x, y); }
  function raster(D, J) {
    const out = new Uint32Array(J.nx * J.ny), { band, col, lo, hi, fam, nb } = D, scale = 4095 / (hi - lo);
    const bg = D.bg || 0xffeeeeee, bandOf = (v) => band[Math.max(0, Math.min(4095, Math.floor((v - lo) * scale)))];
    // Every pixel samples the same field as the tooltip. No interpolating across
    // missing cells: an unsupported pixel stays neutral at every zoom.
    for (let y = 0, o = 0; y < J.ny; y++) for (let x = 0; x < J.nx; x++, o++) {
      const s = sample(D, J.x0 + (x + 0.5) * J.px, J.y0 + (y + 0.5) * J.px);
      if (!s) { out[o] = bg; continue; }
      let color;
      if (fam) {
        let winner = 0, first = -Infinity, second = -Infinity;
        s.values.forEach((v, q) => { if (v > first) { second = first; first = v; winner = q; } else if (v > second) second = v; });
        color = col[winner * nb + bandOf(100 * (first - Math.max(0, second)))];
      } else color = col[bandOf(s.values[0])];
      const a = s.alpha, r = (bg & 255) + a * ((color & 255) - (bg & 255)), g = ((bg >>> 8) & 255) + a * (((color >>> 8) & 255) - ((bg >>> 8) & 255)), b = ((bg >>> 16) & 255) + a * (((color >>> 16) & 255) - ((bg >>> 16) & 255));
      out[o] = (0xff000000 | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
    }
    return { rgba: out.buffer };
  }
  return { at, raster, lonlat };
}

/* ----- the rasters -----
   Two at most: the whole frame, made as soon as a reading is chosen, and the view at the
   screen's own grain once the zoom has outrun it, made a quarter wider than the view all
   round so a pan rarely reaches its edge. Grain moves by half-octaves, so the same raster
   serves through a stretch of zoom; a job asked for while one runs waits for it, and only
   the latest wish is kept. */
const SF = { wk: null, dead: false, key: null, m: null, data: null, none: null, ids: null, busy: false, id: 0, base: null, view: null, old: null, t1: 0, empty: false };
function surfaceWorker() {
  if (SF.wk || SF.dead) return SF.wk;
  try {
    const src = `const E=(${surfaceEngine})();const sets=new Map();onmessage=async(e)=>{const q=e.data;if(q.t==="set"){sets.set(q.key,q.D);while(sets.size>3)sets.delete(sets.keys().next().value);return;}
const D=sets.get(q.key);
if(!D){postMessage({id:q.id,key:q.key,J:q.J,gone:true});return;}
const r=E.raster(D,q.J);let bitmap=null;try{bitmap=await createImageBitmap(new ImageData(new Uint8ClampedArray(r.rgba),q.J.nx,q.J.ny));}catch(x){}
const moved=bitmap?[bitmap]:[r.rgba];postMessage({id:q.id,key:q.key,J:q.J,bitmap,rgba:bitmap?null:r.rgba},moved);};`;
    SF.wk = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    SF.wk.onmessage = (e) => surfaceDone(e.data);
    SF.wk.onerror = () => { SF.dead = true; SF.wk = null; SF.busy = false; SF.sent = null; schedule(); };
  } catch (e) { SF.dead = true; SF.wk = null; }
  return SF.wk;
}
let pageEngineMade = null;
const pageEngine = () => (pageEngineMade ??= surfaceEngine()); // (where no worker will start)
function surfaceJob(J) {
  SF.busy = true;
  const id = ++SF.id, key = SF.key, wk = surfaceWorker();
  if (wk) {
    if (SF.sent !== key) { wk.postMessage({ t: "set", key, D: SF.data }); SF.sent = key; }
    wk.postMessage({ t: "job", id, key, J });
  } else setTimeout(() => { if (key !== SF.key) { SF.busy = false; schedule(); return; } const r = pageEngine().raster(SF.data, J); surfaceDone({ id, key, J, bitmap: null, rgba: r.rgba }); }, 0);
}
async function surfaceDone(q) {
  SF.busy = false;
  if (q.gone || q.key !== SF.key) { if (q.bitmap) q.bitmap.close(); schedule(); return; }
  let src = q.bitmap;
  if (!src) { // no ImageBitmap in the worker, or no worker
    const cv = document.createElement("canvas"); cv.width = q.J.nx; cv.height = q.J.ny;
    cv.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(q.rgba), q.J.nx, q.J.ny), 0, 0); src = cv;
  }
  const J = q.J, pat = ctx.createPattern(src, "no-repeat");
  pat.setTransform(new DOMMatrix([J.px, 0, 0, J.px, J.x0, J.y0]));
  const L = { pat, src, J, x0: J.x0, y0: J.y0, x1: J.x0 + J.nx * J.px, y1: J.y0 + J.ny * J.px };
  const was = J.base ? SF.base : SF.view;
  if (J.base) { SF.base = L; SF.t1 = performance.now(); if (drawFade) drawFade.t0 = SF.t1; } else SF.view = L;
  if (was) closeLayer(was);
  schedule();
}
const closeLayer = (L) => { if (L.src && L.src.close) L.src.close(); };
function surfaceStart(m, key) {
  for (const L of [SF.base, SF.view, ...(SF.old || [])].filter(Boolean)) closeLayer(L);
  SF.old = null; SF.base = SF.view = null;
  SF.key = key; SF.m = m; SF.sent = null; SF.here = null;
  const d = surfaceData(m);
  SF.empty = !d; SF.data = d ? d.D : null; SF.sources = new Set(d ? d.D.boothIndex : []); SF.none = d ? d.none : null; SF.ids = d ? d.D.ids || null : null;
  SF.t1 = performance.now();
}
const SNAP = (v, c) => Math.floor(v / c) * c;
function surfaceTick(m) {
  const key = readingKey(m);
  if (key !== SF.key) surfaceStart(m, key);
  if (!SF.data || SF.busy) return;
  const [[hx0, hy0], [hx1, hy1]] = homeBox(m), hw = hx1 - hx0, hh = hy1 - hy0;
  if (!SF.base) {
    const px = Math.max(hw, hh) / 1500, c = 3 * px, x0 = SNAP(hx0 - 0.08 * hw, c), y0 = SNAP(hy0 - 0.08 * hh, c);
    surfaceJob({ base: true, px, x0, y0, nx: Math.ceil((1.16 * hw) / c + 1) * 3, ny: Math.ceil((1.16 * hh) / c + 1) * 3, lw: 1.5 });
    return;
  }
  // Two CSS pixels are sufficient for the smoothed field; point readings remain exact.
  const q = 0.5, want = 2 ** (Math.round(2 * Math.log2(1 / (T.k * q))) / 2);
  if (want >= SF.base.J.px * 0.8) { if (SF.view) { closeLayer(SF.view); SF.view = null; } return; }
  const [vx0, vy0, vx1, vy1] = viewBox(), V = SF.view;
  if (V && Math.abs(Math.log2(V.J.px / want)) < 0.26 && V.x0 <= vx0 && V.y0 <= vy0 && V.x1 >= vx1 && V.y1 >= vy1) return;
  const vw = vx1 - vx0, vh = vy1 - vy0, c = 3 * want, x0 = SNAP(vx0 - 0.25 * vw, c), y0 = SNAP(vy0 - 0.25 * vh, c);
  surfaceJob({ px: want, x0, y0, nx: Math.ceil((1.5 * vw) / c + 1) * 3, ny: Math.ceil((1.5 * vh) / c + 1) * 3, lw: 1.25 * Math.min(q, 1.5) });
}
// what the seats' fill draws this frame: the layers, under the view's raster where it reaches
function surfaceLook(m, a) {
  surfaceTick(m);
  const now = performance.now(), ls = [];
  let fa = 1;
  if (SF.old) {
    fa = SF.base ? clamp((now - SF.t1) / 340, 0, 1) : 0;
    if (fa < 1) { needFrame = true; for (const L of SF.old) ls.push({ pat: L.pat, a }); }
    else { SF.old.forEach(closeLayer); SF.old = null; }
  }
  const [vx0, vy0, vx1, vy1] = viewBox(), V = SF.view, full = V && V.x0 <= vx0 && V.y0 <= vy0 && V.x1 >= vx1 && V.y1 >= vy1;
  if (SF.base && !full) ls.push({ pat: SF.base.pat, a: a * ease(fa) });
  if (V) ls.push({ pat: V.pat, a: a * ease(fa) });
  if (!ls.length) return { ls: [], top: null, under: true, none: null };
  return { ls, top: ls[ls.length - 1].pat, under: a < 1 || (!SF.old && ls[0].a < 1), none: SF.none };
}
// the field at a spot on the plane: a figure, or who leads there and by how much. It's the one field's
// own value, asked of whoever holds it, so nothing on the screen can touch it
const surfaceWords = (v) => {
  if (!v) return null;
  const support = { count: v.count, nearest: v.nearest, radius: v.radius, mass: v.mass };
  if (!SF.ids) return { v: v.values[0], ...support };
  const r = [...v.values].map((x, k) => [SF.ids[k], x]).sort((p, q) => q[1] - p[1]);
  return { fam: r[0][0], lead: 100 * (r[0][1] - Math.max(r[1] ? r[1][1] : 0, 0)), ...support };
};
// Point queries use the same engine locally, so they never queue behind a raster job.
function surfaceAt(x, y) {
  return Promise.resolve(SF.data ? surfaceWords(pageEngine().at(SF.data, x, y)) : null);
}
// Overlay markers show exactly the input records used for the current field.
const surfacePlaceShown = (m, j) => drawOf(m) !== "surface" || (SF.m === m && SF.key === readingKey(m) && SF.sources && SF.sources.has(j));
// the tooltip's reading: the latest answer for the pointer, the next on its way
function surfaceAsk(x, y) {
  if (SF.asking) { SF.askNext = [x, y]; return; }
  SF.asking = true;
  surfaceAt(x, y).then((a) => {
    SF.asking = false;
    if (!SF.askNext) SF.here = a;
    if (SF.askNext) { const [nx, ny] = SF.askNext; SF.askNext = null; surfaceAsk(nx, ny); }
    tipRefresh();
  });
}

/* ----- the Areas drawing: the census's own areas, painted as counted -----
   Seats rolls the census up to each seat; Areas uses the finest geography this
   pack carries: the SA1 areas,
   each painted with the figure the census counted there — a counted figure at every
   point the census counted people, paper where it counted none (empty land) and where
   the ABS suppresses a figure. The whole Census lens carries over — every People
   measure, every Advantage index — read off one lazy pack per census vintage
   (.build/map/build_areas_sa1.py): the 2021 pack is 61,811 areas over about sixty
   lanes plus the shape itself, fetched the first time a frame wants them. The income
   quartile lanes ride the frame in view's own incomeCuts over the pack's sixteen
   adults-basis band masses per area, exactly as its seat stores compute them.
   The drawing runs the surface's own bookkeeping: a whole-frame raster at the frame's
   home zoom, a view raster on settle once the zoom outruns it, both composited through
   the seats' fill paths in drawGeo, so the coast cut, the islands, the filters and the
   veil work as they do on a surface. Mid-gesture the last raster just takes the new
   transform. The key runs each lane's own extents from the pack (a population-weighted
   99.5th percentile, rounded up), so only the lanes whose areas really reach ~100%
   run that far — never the seats' 60% that flattens a Fairfield. */
const AREAS_FILES = { 2021: "areas-sa1-2021" };
// the frame's census vintage: its own demoYear, and a blend's nearest single side
const areasVintage = (m) => (m ? m.demoInterp ? m.demoInterp.nearestSide : (m.demoYear == null ? 2021 : m.demoYear) : null);
// the pack's lane for the Census lens's current measure (mirrors demoRamp's family map)
function areasLane() {
  if (S.lens !== "seifa") return null;
  if (!isDemo()) return `sf.${S.index}`;
  if (isCob()) return `cob.${S.cob}`;
  if (isRel()) return `rel.${S.rel}`;
  if (isTen()) return `ten.${S.ten}`;
  if (isAnc()) return `anc.${S.anc}`;
  if (isInc()) return S.incMode === "med" ? "incMed" : S.incMode === "lo" ? "loinc" : "hiqinc";
  if (isAge()) return S.ageMode === "med" ? "ageMed" : S.ageMode;
  if (isEdu()) return S.eduMode;
  return S.index;
}
// the 2021 pack's lanes (AREA_LANES pinned in test-map-areas.mjs against the pack)
const AREAS_LANES = new Set(["lang", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar", "pt", "noncit", "bigfam", "loinc", "hiqinc", "a65", "a2034", "a1824", "a3554", "a75",
  "rel.norel", "rel.cath", "rel.angl", "rel.unch", "rel.pres", "rel.orth", "rel.budd", "rel.isl", "rel.hind", "rel.jew",
  "ten.mort", "ten.rent", "ten.own", "ten.rentPub",
  "cob.eng", "cob.ind", "cob.chn", "cob.nzl", "cob.phl", "cob.vnm", "cob.zaf", "cob.ita", "cob.lka", "cob.sct",
  "anc.english", "anc.australian", "anc.irish", "anc.scottish", "anc.chinese", "anc.italian", "anc.german", "anc.indian", "anc.filipino", "anc.dutch", "anc.vietnamese", "anc.lebanese",
  "ageMed", "incMed",
  "sf.irsad", "sf.irsd", "sf.ier", "sf.ieo"]);
// gcp_newlanes.INC_BANDS, verbatim: the weekly income bands the masses follow
const AREAS_INC_BANDS = [[1, 149], [150, 299], [300, 399], [400, 499], [500, 649], [650, 799], [800, 999], [1000, 1249], [1250, 1499], [1500, 1749], [1750, 1999], [2000, 2499], [2500, 2999], [3000, 3499], [3500, 3999], [4000, null]];

const AR = { packs: {}, pack: null, packOf: null, proj: null, projs: new WeakMap(),
             vintage: null, m: null, key: null, lane: null, vals: null, pal: null, palRaw: null,
             base: null, view: null, old: null, t1: 0, id: 0, busy: false, wantJ: null,
             askedShow: false, here: null };

function loadAreas(vin) {
  if (AREAS_FILES[vin] == null) return null;
  const got = AR.packs[vin];
  if (got) return got.pack || got.P;
  const P = getJSON(`/map/data/${AREAS_FILES[vin]}.json`)
    .then((D) => {
      const pack = areasUnpack(D);
      AR.packs[vin] = { pack };
      const m = M(), want = m && drawOf(m) === "areas" && areasVintage(m) === vin;
      AR.key = null; schedule();
      if (want) renderLegend();
      showLoading(false);
      return pack;
    })
    .catch((e) => { delete AR.packs[vin]; console.error(e); showLoading(false); return null; });
  AR.packs[vin] = { P };
  return P;
}
/* one national unpack: lane buffers decoded, geometries readied (projection is per
   frame, made lazily and cached on the frame itself) */
function areasUnpack(D) {
  const U8 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const lanes = {}, types = {};
  for (const [k, o] of Object.entries(D.lanes)) {
    types[k] = o.t;
    if (o.t === "u16") lanes[k] = new Uint16Array(U8(o.b).buffer);
    else lanes[k] = U8(o.b);
  }
  const { scale, translate } = D.topo.transform;
  const arcs = D.topo.arcs.map((a) => {
    const o = new Float64Array(a.length * 2);
    let x = 0, y = 0;
    for (let i = 0; i < a.length; i++) {
      x += a[i][0]; y += a[i][1];
      o[2 * i] = x * scale[0] + translate[0]; o[2 * i + 1] = y * scale[1] + translate[1];
    }
    return o;
  });
  const geoms = D.topo.objects[Object.keys(D.topo.objects)[0]].geometries.map((g) => {
    const rings = g.type === "Polygon" ? g.arcs : g.type === "MultiPolygon" ? g.arcs.flat() : [];
    return { r: rings, bb: [Infinity, Infinity, -Infinity, -Infinity] };
  });
  const codes = D.topo.objects[Object.keys(D.topo.objects)[0]].geometries.map(g => g.properties.SA1_CODE21);
  const n = geoms.length, decN = (o) => new Uint16Array(U8(o.b).buffer), dec32 = (o) => new Uint32Array(U8(o.b).buffer);
  const incBands = decN(D.meta.incBands), pop = dec32(D.meta.pop), area = dec32(D.meta.area), sa2i = decN(D.meta.sa2i);
  for (const [k, arr] of Object.entries(lanes)) if (arr.length !== n) throw new Error(`areas pack lane ${k} length ${arr.length} != ${n}`);
  if (incBands.length !== n * 16 || pop.length !== n || area.length !== n || sa2i.length !== n) throw new Error("areas pack meta length drift");
  return { vintage: D.vintage, caps: D.caps, marks: D.marks, sa2names: D.meta.sa2names, codes, lanes, types, geoms, arcs, incBands, pop, area, sa2i };
}
// the income-quartile shares at the frame's own cuts: the builder's walk, verbatim
function areasIncShare(P, m, i, lane) {
  const b = P.incBands, o = i * 16;
  let tot = 0;
  for (let k = 0; k < 16; k++) tot += b[o + k];
  if (!tot) return null;
  const cut = lane === "loinc" ? m.incomeCuts.loCutWeekly : m.incomeCuts.hiQCutWeekly;
  if (!(cut > 0)) return null;
  let mass = lane === "loinc" ? 0 : tot;
  for (let k = 0; k < 16; k++) {
    const [lo, hi] = AREAS_INC_BANDS[k], w = b[o + k];
    if (cut <= lo) { if (lane === "loinc") continue; break; }
    if (hi != null && cut > hi) { mass += lane === "loinc" ? w : -w; continue; }
    mass += (lane === "loinc" ? 1 : -1) * (w * (cut - lo)) / (hi - lo + 1);
    break;
  }
  return mass / tot;
}
// a lane's display figure at area i, in the key's own units (percent for shares,
// years/dollars the medians, deciles the indexes; null = nothing published there)
function areasValue(P, m, i, lane) {
  const inc = lane === "loinc" || lane === "hiqinc";
  if (inc) { const v = areasIncShare(P, m, i, lane); return v == null ? null : 100 * v; }
  const L = P.lanes[lane], t = P.types[lane];
  if (!L) return null;
  const v = L[i];
  if (t === "u8x2") return v === 255 ? null : v / 2;
  if (t === "u8z") return v === 0 ? null : v;
  if (t === "u8") return v === 255 ? null : v;
  if (t === "u16") return v === 65535 ? null : v;
  return null;
}
const AR_NULLI = 251;
// the reading's per-area key-line indexes over the pack (0..240 into AR.pal; 251 = none)
function areasVals(P, m, lane) {
  const n = P.geoms.length, vals = new Uint8Array(n).fill(AR_NULLI);
  const [lo, hi] = P.caps[lane];
  for (let i = 0; i < n; i++) {
    const v = areasValue(P, m, i, lane);
    if (v != null) vals[i] = Math.min(240, Math.max(0, Math.round(((v - lo) / (hi - lo)) * 240)));
  }
  return vals;
}
// the key's palette, raw and stringed (the density fade needs the numbers)
function areasPalette(lane) {
  const ramp = lane.startsWith("sf.") ? RAMP.seifa : demoRamp(), pal = new Array(241), raw = new Array(241);
  for (let k = 0; k <= 240; k++) raw[k] = ramp[Math.round((k / 240) * 100)];
  for (let k = 0; k <= 240; k++) pal[k] = css(raw[k]);
  return { pal, raw };
}
// the frame's projection of every arc, the areas' projected bounds, and the tooltip's
// spatial grid — made once, kept on the frame it belongs to
function areasProj(m, vin) {
  let pr = AR.projs.get(m);
  if (pr && pr.vin === vin) return pr;
  const P = AR.packs[vin] && AR.packs[vin].pack;
  if (!P) return null;
  const arcsXY = P.arcs.map((a) => {
    const o = new Float32Array(a.length);
    for (let i = 0; i < a.length; i += 2) {
      const p = m.proj([a[i], a[i + 1]]);
      o[i] = p ? p[0] : NaN;
      o[i + 1] = p ? p[1] : NaN;
    }
    return o;
  });
  const bb = P.geoms.map(() => [Infinity, Infinity, -Infinity, -Infinity]);
  P.geoms.forEach((g, gi) => {
    const b = bb[gi];
    for (const ring of g.r) {
      for (const aid of ring) {
        const A = arcsXY[aid < 0 ? ~aid : aid];
        for (let k = 0; k < A.length; k += 2) {
          const x = A[k], y = A[k + 1];
          if (!(x === x)) continue;
          if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y;
          if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
        }
      }
    }
  });
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const b of bb) { if (b[0] === Infinity) continue; if (b[0] < X0) X0 = b[0]; if (b[1] < Y0) Y0 = b[1]; if (b[2] > X1) X1 = b[2]; if (b[3] > Y1) Y1 = b[3]; }
  const span = Math.max(X1 - X0, 1e-6), cell = span / 160, W = Math.ceil((X1 - X0) / cell) + 1, H = Math.ceil((Y1 - Y0) / cell) + 1;
  const grid = new Array(W * H).fill(null);
  P.geoms.forEach((g, gi) => {
    const b = bb[gi];
    if (b[0] === Infinity) return;
    const c0 = clamp(Math.floor((b[0] - X0) / cell), 0, W - 1), c1 = clamp(Math.floor((b[2] - X0) / cell), 0, W - 1);
    const d0 = clamp(Math.floor((b[1] - Y0) / cell), 0, H - 1), d1 = clamp(Math.floor((b[3] - Y0) / cell), 0, H - 1);
    for (let d = d0; d <= d1; d++) for (let c = c0; c <= c1; c++) {
      const o = d * W + c;
      (grid[o] || (grid[o] = [])).push(gi);
    }
  });
  pr = { vin, arcsXY, bb, grid, X0, Y0, cell, W, H };
  AR.projs.set(m, pr);
  return pr;
}
// odd-even ray cast over all of an area's rings at once (ring-agnostic: holes fall out)
function areasInside(pr, g, x, y) {
  let odd = false;
  for (const ring of g.r) {
    let fx = 0, fy = 0, lx = 0, ly = 0, first = true, px = 0, py = 0;
    const visit = (qx, qy) => {
      if (first) { fx = qx; fy = qy; first = false; }
      else if ((py > y) !== (qy > y) && x < px + ((qx - px) * (y - py)) / (qy - py)) odd = !odd;
      px = qx; py = qy;
    };
    for (const aid0 of ring) {
      const A = pr.arcsXY[aid0 < 0 ? ~aid0 : aid0], n = A.length;
      if (aid0 < 0) { for (let k = n - 2; k >= 0; k -= 2) visit(A[k], A[k + 1]); }
      else { for (let k = 0; k < n; k += 2) visit(A[k], A[k + 1]); }
    }
    // close the ring if the topology left it open
    if (!first && (px !== fx || py !== fy) && (py > y) !== (fy > y) && x < px + ((fx - px) * (y - py)) / (fy - py)) odd = !odd;
  }
  return odd;
}
// the area under a point on the frame's plane: the tooltip's ground truth
function areasHit(m, x, y) {
  const pr = m ? areasProj(m, areasVintage(m)) : null;
  if (!pr || !AR.pack) return null;
  const c = Math.floor((x - pr.X0) / pr.cell), d = Math.floor((y - pr.Y0) / pr.cell);
  if (c < 0 || d < 0 || c >= pr.W || d >= pr.H) return null;
  const cell2 = pr.grid[d * pr.W + c];
  if (!cell2) return null;
  for (const gi of cell2) {
    const b = pr.bb[gi];
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    if (areasInside(pr, AR.pack.geoms[gi], x, y)) return { i: gi, code: AR.pack.codes[gi], sa2: AR.pack.sa2names[AR.pack.sa2i[gi]], pop: AR.pack.pop[gi] };
  }
  return null;
}

function areasStart(m, key) {
  const old = [AR.base, AR.view].filter(Boolean);
  AR.old = AR.m === m ? old : null;   // a change of reading fades the old rasters out
  AR.base = AR.view = null;
  AR.key = key; AR.m = m; AR.vintage = areasVintage(m); AR.lane = areasLane();
  AR.busy = false; AR.wantJ = null; AR.id++;
  AR.vals = null; AR.proj = null;
  AR.askedShow = false;
  AR.t1 = performance.now();
}
// pack, projection, values and palette in place for this frame's reading
function areasEnsure(m) {
  const vin = AR.vintage, got = AR.packs[vin] && AR.packs[vin].pack;
  if (!got) {
    const P = loadAreas(vin);
    if (P && P.then && !AR.askedShow) { AR.askedShow = true; showLoading(true, "Loading the census areas…"); }
    return false;
  }
  if (AR.vals && AR.packOf === vin) return true;
  AR.pack = got; AR.packOf = vin;
  AR.proj = areasProj(m, vin);
  AR.vals = areasVals(got, m, AR.lane);
  const { pal, raw } = areasPalette(AR.lane);
  AR.pal = pal; AR.palRaw = raw;
  AR.base = AR.view = null;
  return true;
}
/* the raster job: draws the window's visible areas in slices, so a whole-country
   settle never long-tasks the page; the last finished raster keeps taking the
   transform while the reader is mid-gesture */
function areasJob(J) {
  if (AR.busy) { AR.wantJ = J; return; }
  AR.busy = true; AR.wantJ = null;
  const P = AR.pack, pr = AR.proj;
  if (!P || !pr) { AR.busy = false; return; }
  const id = ++AR.id;
  const cv = document.createElement("canvas");
  cv.width = Math.max(2, Math.ceil(J.nx)); cv.height = Math.max(2, Math.ceil(J.ny));
  const c2 = cv.getContext("2d");
  c2.setTransform(1 / J.px, 0, 0, 1 / J.px, -J.x0 / J.px, -J.y0 / J.px);
  const x1 = J.x0 + cv.width * J.px, y1 = J.y0 + cv.height * J.px;
  const m = AR.m, u = unitsPerKm(m), fadeAmt = smooth(0.09, 0.03, J.px / u); // a city-and-closer density fade
  const vals = AR.vals, pal = AR.pal, raw = AR.palRaw, nodata = css(TH.nodata), paper = TH.bg;
  const popD = P.pop, areaD = P.area, geoms = P.geoms, bb = pr.bb, arcsXY = pr.arcsXY;
  c2.lineJoin = "round"; c2.lineWidth = 0.8 * J.px;
  let last = null;
  const mixes = new Map();
  const fadeCss = (slot, qq) => {
    const key = slot * 32 + Math.round(qq * 8);
    let got = mixes.get(key);
    if (!got) { got = css(towards(raw[slot], paper, Math.min(1, Math.max(0, qq)))); mixes.set(key, got); }
    return got;
  };
  const setCss = (i) => {
    const slot = vals[i];
    if (slot === AR_NULLI) { if (last !== nodata) { c2.fillStyle = c2.strokeStyle = last = nodata; } return; }
    let cssv = pal[slot];
    if (fadeAmt > 0) {
      const dens = (popD[i] * 100) / Math.max(areaD[i], 1);   // persons per km²
      const t = clamp(Math.log10(Math.max(dens, 1e-3)) / 2, 0, 1);
      const qq = fadeAmt * (1 - (0.06 + 0.94 * t));
      cssv = qq < 0.02 ? pal[slot] : fadeCss(slot, qq);
    }
    if (cssv !== last) { c2.fillStyle = c2.strokeStyle = last = cssv; }
  };
  const SUB = 1.4, N = geoms.length;
  let gi = 0;
  const step = () => {
    if (id !== AR.id) return;
    const tend = performance.now() + 26;
    for (; gi < N; gi++) {
      const b = bb[gi];
      if (b[0] > x1 || b[2] < J.x0 || b[1] > y1 || b[3] < J.y0) continue;
      setCss(gi);
      const w = (b[2] - b[0]) / J.px, h = (b[3] - b[1]) / J.px;
      if (w < SUB && h < SUB) { c2.fillRect(b[0], b[1], J.px * 1.3, J.px * 1.3); continue; }
      const g = geoms[gi];
      c2.beginPath();
      for (const ring of g.r) {
        let first = true;
        for (const aid0 of ring) {
          const A = arcsXY[aid0 < 0 ? ~aid0 : aid0], n = A.length;
          if (aid0 < 0) {
            for (let k = n - 2; k >= 0; k -= 2) { if (first) { c2.moveTo(A[k], A[k + 1]); first = false; } else c2.lineTo(A[k], A[k + 1]); }
          } else {
            for (let k = 0; k < n; k += 2) { if (first) { c2.moveTo(A[k], A[k + 1]); first = false; } else c2.lineTo(A[k], A[k + 1]); }
          }
        }
        c2.closePath();
      }
      c2.fill("evenodd");
      c2.stroke();
      if ((gi & 1023) === 0 && performance.now() > tend) { setTimeout(step, 0); return; }
    }
    AR.busy = false;
    if (J.base) AR.base = { cv, J, pat: null };
    else AR.view = { cv, J, pat: null };
    AR.t1 = performance.now();
    schedule();
    if (AR.wantJ) areasJob(AR.wantJ);
  };
  setTimeout(step, 0);
}
function areasTick(m) {
  if (!AR.vals || !AR.proj) return;
  const [[hx0, hy0], [hx1, hy1]] = homeBox(m), hw = hx1 - hx0, hh = hy1 - hy0;
  if (!AR.base) {
    const px = Math.max(hw, hh) / 1500;
    areasJob({ base: true, px, x0: hx0 - 0.08 * hw, y0: hy0 - 0.08 * hh, nx: (1.16 * hw) / px, ny: (1.16 * hh) / px });
    return;
  }
  // Two CSS pixels are sufficient for the smoothed field; point readings remain exact.
  const q = 0.5, want = 2 ** (Math.round(2 * Math.log2(1 / (T.k * q))) / 2);
  if (want >= AR.base.J.px * 0.8) { AR.view = null; return; }
  const [vx0, vy0, vx1, vy1] = viewBox(), V = AR.view;
  if (V && Math.abs(Math.log2(V.J.px / want)) < 0.26 && V.J.x0 <= vx0 && V.J.y0 <= vy0 && V.J.x0 + V.J.nx * V.J.px >= vx1 && V.J.y0 + V.J.ny * V.J.px >= vy1) return;
  const vw = vx1 - vx0, vh = vy1 - vy0;
  areasJob({ base: false, px: want, x0: vx0 - 0.25 * vw, y0: vy0 - 0.25 * vh, nx: (1.5 * vw) / want, ny: (1.5 * vh) / want });
}
function areasPattern(L) {
  if (!L.pat) {
    L.pat = ctx.createPattern(L.cv, "no-repeat");
    L.pat.setTransform(new DOMMatrix([L.J.px, 0, 0, L.J.px, L.J.x0, L.J.y0]));
  }
  return L.pat;
}
// the areas layers the seats' fill draws this frame, in the surface's own shape
function areasLook(m) {
  const key = readingKey(m) + "|a" + areasVintage(m);
  if (key !== AR.key) areasStart(m, key);
  if (!areasEnsure(m)) { areasTick(m); return { ls: [], top: null, under: true, none: null }; }
  areasTick(m);
  const now = performance.now(), ls = [], fa = AR.base ? clamp((now - AR.t1) / 340, 0, 1) : 0;
  if (AR.old) {
    if (fa < 1) { needFrame = true; for (const L of AR.old) ls.push({ pat: areasPattern(L), a: 1 - ease(fa) }); }
    else AR.old = null;
  }
  const [vx0, vy0, vx1, vy1] = viewBox(), V = AR.view, full = V && V.J.x0 <= vx0 && V.J.y0 <= vy0 && V.J.x0 + V.J.nx * V.J.px >= vx1 && V.J.y0 + V.J.ny * V.J.px >= vy1;
  if (AR.base && !full) ls.push({ pat: areasPattern(AR.base), a: AR.view ? 1 : ease(Math.max(fa, 0.05)) });
  if (V) ls.push({ pat: areasPattern(V), a: 1 });
  if (!ls.length) return { ls: [], top: null, under: true, none: null };
  return { ls, top: ls[ls.length - 1].pat, under: false, none: null };
}

/* ----- the change of drawing: a crossfade of the fills under the balloons' rise ----- */
let drawFade = null, ballNow = 0;
const DRAW_MS = 420;
function setDraw(d) {
  if (d === S.draw || !DRAWS.some(([k]) => k === d)) return;
  const m = M(), from = drawOf(m);
  S.draw = d;
  if (drawOf(m) !== from && !reduceMotion) drawFade = { from, t0: performance.now() };
  afterDrawChange();
}
function afterDrawChange() {
  const m = M();
  if (m) { for (const y of Object.values(Y)) if (y && y.divs) y._bal = null; recolor(false); }
  renderLegend(); renderStory(true); updateHint(); writeURL(); schedule();
}
function setAxis(a) {
  if (a === S.axis || !SP_PAIRS[a]) return;
  const m = M(), src = axisFrame(m);
  if (a !== "AC" && src != null && !STATE_YEARS.has(m.year) && !SPD[src]) {
    showLoading(true);
    loadSenatePrefs(src).then(() => { showLoading(false); setAxis(a); }).catch(() => showLoading(true, "The Senate’s ballots didn’t load. Try again."));
    return;
  }
  S.axis = a; afterDrawChange();
}
// how far the fills have gone over: the drawing in force, and the one it is leaving
function drawLook(m) {
  const d = drawOf(m), now = performance.now();
  let e = 1, from = d;
  if (drawFade) { const t = clamp((now - drawFade.t0) / DRAW_MS, 0, 1); if (t < 1) { needFrame = true; e = ease(t); from = drawFade.from; } else drawFade = null; }
  const surf = (d === "surface" ? e : 0) + (from === "surface" && d !== "surface" && surfaceFits(m) ? 1 - e : 0), ball = (d === "balloons" ? e : 0) + (from === "balloons" && d !== "balloons" ? 1 - e : 0);
  const are = (d === "areas" ? e : 0) + (from === "areas" && d !== "areas" ? 1 - e : 0);
  return { surf, ball, sf: surf > 0 ? surfaceLook(m, surf) : null, are, ar: are > 0 ? areasLook(m) : null };
}

/* ----- the balloons -----
   Area true to the votes behind the reading, on one scale for every place, election and
   lens; the scale grows more slowly than the map as the reader zooms in, so balloons part.
   Where they would still lie on one another they join: a capital is a few pixels wide at
   the whole country, and a thousand booths stacked there would hide each other, the big
   Labor lead of a city vanishing under its last-drawn dots while a country seat's booths
   spread out to be counted. So places share a balloon by hexagonal cell of the screen's
   size (BAL_CELL, doubling in map units as the zoom halves), and a shared balloon's area is
   its places' net: one side's lead less the other's, so the ink on the map stays true to
   the votes at every zoom. An opened seat's places are always their own. */
const BAL_S = 0.048;    // px per root-vote at a frame's home view
const BAL_CELL = 14;    // px: the cell across, at its finest
const BAL_MAX = 80;     // px: no balloon wider than this, a capital's whole lead close in
const balScale = () => BAL_S * Math.min(9, Math.pow(Math.max(1, T.k / HOME.k), 0.5));
function balloonVotes(m, j) {
  const b = m.booth, formal = b.formal[j];
  const ofShare = (v) => (v == null || Number.isNaN(v) ? 0 : (Math.abs(v) / 100) * formal);
  switch (S.lens) {
    case "winner": { const t = finalVotes(m, j); return t ? Math.abs(t[0] - t[1]) : 0; }
    case "tpp": {
      const v = drawValue(m, j);
      if (S.tppMode === "swing") return ofShare(v);
      const A = axisOf(m); if (A) return Number.isNaN(A.v[j]) ? 0 : Math.abs(2 * A.a[j] - A.t[j]);
      const t = b.raw.tpp[j]; return t && t[0] + t[1] ? Math.abs(t[0] - t[1]) : v == null ? 0 : (Math.abs(2 * v - 100) / 100) * formal;
    }
    case "fp": case "senate": return ofShare(drawValue(m, j));
    case "flow": return drawValue(m, j) == null ? 0 : groupVotes(b, S.from, j);
    case "senpref": return drawValue(m, j) == null ? 0 : surfaceWeight(m, j);
    case "informal": { if (infModeOf(m) === "exhaust") return ofShare(drawValue(m, j)); const v = b.votes[j]; return Number.isFinite(v) ? Math.max(0, v - formal) : 0; }
    default: return drawValue(m, j) == null ? 0 : formal;
  }
}
// the middle of a two-sided reading, and its half-range
function twoSided(m) {
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? [0, 10] : [50, axisNow(m) !== "AC" ? axisSpan() : 20];
    case "fp": return S.fpMode === "change" ? [0, 15] : null;
    case "senate": return senGap() ? [0, 10] : null;
    case "flow": case "senpref": return [50, 40];
  }
  return null;
}
// a balloon's size says how much: its colour needs only say which side, and strongly enough to read against the land
function balloonColor(m, v) {
  if (S.lens === "winner") return TH.party[v] || null;
  if (S.lens === "cls") return colorOf(v);
  const two = twoSided(m);
  if (!two) {
    if (S.lens === "fp" || S.lens === "senate") return colorOf(Math.max(v, 0.32 * FPMAX[S.party]));
    if (S.lens === "informal") return colorOf(Math.max(v, 0.35 * infHi(m)));
    return colorOf(v);
  }
  const [mid, R] = two, d = v - mid;
  return colorOf(mid + (d < 0 ? -1 : 1) * R * (0.6 + 0.4 * Math.min(1, Math.abs(d) / R)));
}
// the places a balloon can stand for: not the islands, whose boxes are their own, nor a place with no spot on
// the land, as most hospital teams are; remote and mobile teams are shared over their seat's
const balloonPlace = (b, j) => b.isl[j] < 0 && (!Number.isNaN(b.x[j]) || b.ty[j] === 3 || b.ty[j] === 4);
// each place's part in a balloon: its votes, its figure, and whether a shared balloon nets it off or adds it up
function balloonSet(m) {
  const key = readingKey(m);
  if (m._bal && m._bal.key === key) return m._bal;
  if (m._bal && fade && !reduceMotion) balOld = { m, B: m._bal, t0: performance.now(), A: { a: 1, bx: 0, by: 0 } };
  const b = m.booth, n = b.n, J = [], C = [], W = [], V = [], X = [], Y2 = [], two = twoSided(m), taken = new Map();
  const cat = S.lens === "winner" || S.lens === "cls", net = (two && S.lens !== "flow" && S.lens !== "senpref") || S.lens === "winner";
  for (let j = 0; j < n; j++) {
    if (!balloonPlace(b, j)) continue;
    // a remote or mobile team has no spot of its own: it takes its turn on its seat's land (seatSpots)
    let x = b.x[j], y = b.y[j];
    if (Number.isNaN(x)) {
      const spots = seatSpots(m, b.d[j]), k = taken.get(b.d[j]) || 0; if (!spots.length) continue;
      taken.set(b.d[j], k + 1); [x, y] = nominalSpot(m, b.d[j], spots[(k * 7) % spots.length], k);
    }
    const v = drawValue(m, j); if (v == null || Number.isNaN(v)) continue;
    const c = balloonVotes(m, j); if (!(c > 0)) continue;
    J.push(j); C.push(c); W.push(surfaceWeight(m, j) || c); V.push(v); X.push(x); Y2.push(y);
  }
  return (m._bal = { key, n: J.length, J, C, W, V, X, Y: Y2, cat, net, mid: two ? two[0] : 0, levels: new Map() });
}
// a level's balloons, biggest first (a key on what the seat and filters leave out)
function balloonLevel(m, B, L) {
  const sd = selDiv(), fk = filtersOn() || (S.f.range && S.f.range.unit === "booths") ? filtersKey() : "", key = `${L}|${sd}|${fk}`;
  let P = B.levels.get(key); if (P) return P;
  const b = m.booth, cell = 2 ** L, rowH = cell * 0.866, groups = new Map(), out = [];
  const rf = S.f.range && S.f.range.unit === "booths" ? S.f.range : null, filt = filtersOn();
  const add = (g, a) => {
    const j = B.J[a], w = B.W[a], c = B.C[a], v = B.V[a], px = B.X[a], py = B.Y[a];
    g.n++; g.w += w; g.x += px * w; g.y += py * w; g.ids.push(j);
    g.x0 = Math.min(g.x0, px); g.x1 = Math.max(g.x1, px); g.y0 = Math.min(g.y0, py); g.y1 = Math.max(g.y1, py);
    if (B.cat) g.cats.set(v, (g.cats.get(v) || 0) + c);
    else { g.v += v * w; g.c += B.net ? (v >= B.mid ? c : -c) : c; }
  };
  const fresh = () => ({ n: 0, w: 0, x: 0, y: 0, v: 0, c: 0, ids: [], cats: B.cat ? new Map() : null, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const singles = [];
  for (let a = 0; a < B.n; a++) {
    const j = B.J[a];
    if (filt && !passes(m, b.d[j])) continue;
    if (rf && !inRange(boothColValue(m, j, rf.key), rf)) continue;
    if (sd != null && b.d[j] === sd) { const g = fresh(); add(g, a); singles.push(g); continue; }
    const r = Math.floor(B.Y[a] / rowH), q = Math.floor(B.X[a] / cell + (r & 1) / 2), k = r * 1e6 + q;
    let g = groups.get(k); if (!g) groups.set(k, (g = fresh()));
    add(g, a);
  }
  // a group's size and spot as they stand
  const sized = (g) => {
    if (B.cat) { const r = [...g.cats].sort((p, q) => q[1] - p[1]); g.size = r.length ? (B.net ? r[0][1] - (r[1] ? r[1][1] : 0) : r[0][1]) : 0; g.top = r.length ? r[0][0] : null; }
    else g.size = Math.abs(g.c);
    g.q = Math.sqrt(g.size); g.cx = g.x / g.w; g.cy = g.y / g.w;
  };
  // the cells' lattice is blind to the balloons' own size: a big one takes in its own side's
  // balloons that would lie inside it, so a city reads as one and not as rings within rings.
  // Never the other side's: a country town's Coalition lead beside a Labor city stands on its own
  const sideOf = (g) => (B.cat ? g.top : g.c >= 0);
  let cells = [...groups.values()]; cells.forEach(sized);
  if (cells.length < 900) {
    const s = BAL_S * Math.min(9, Math.pow(Math.max(1, (BAL_CELL / cell) / HOME.k), 0.5)) / (BAL_CELL / cell); // map units per root-vote, at this level's zoom
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      cells.sort((p, q) => q.size - p.size);
      for (let i = 0; i < cells.length; i++) {
        const G = cells[i]; if (G.gone) continue;
        const R = 0.75 * G.q * s, side = sideOf(G);
        for (let k = i + 1; k < cells.length; k++) {
          const q = cells[k]; if (q.gone || sideOf(q) !== side) continue;
          const dx = q.cx - G.cx, dy = q.cy - G.cy;
          if (dx * dx + dy * dy > R * R) continue;
          G.n += q.n; G.w += q.w; G.x += q.x; G.y += q.y; G.v += q.v; G.c += q.c; for (const j of q.ids) G.ids.push(j);
          G.x0 = Math.min(G.x0, q.x0); G.x1 = Math.max(G.x1, q.x1); G.y0 = Math.min(G.y0, q.y0); G.y1 = Math.max(G.y1, q.y1);
          if (B.cat) for (const [f, c] of q.cats) G.cats.set(f, (G.cats.get(f) || 0) + c);
          q.gone = true; moved = true;
        }
        sized(G);
      }
      cells = cells.filter((q) => !q.gone);
      if (!moved) break;
    }
  }
  singles.forEach(sized);
  const colours = new Map();
  for (const g of [...cells, ...singles]) {
    if (!(g.size >= 1)) continue;
    const v = B.cat ? g.top : g.v / g.w;
    g.x = g.cx; g.y = g.cy; g.val = v;
    const ck = B.cat ? v : Math.round(v * 4);
    let col = colours.get(ck); if (col === undefined) { const c = balloonColor(m, v); col = c ? css(c) : null; colours.set(ck, col); }
    if (col) { g.col = col; out.push(g); }
  }
  out.sort((p, q) => q.q - p.q);
  P = out; B.levels.set(key, P);
  if (B.levels.size > 12) B.levels.delete(B.levels.keys().next().value);
  return P;
}
let balOld = null; // the reading or election just left, fading as this one comes up
function paintBalloons(m, list, alpha, grow, s0) {
  const s = s0 * grow, ring = css(TH.bg, 0.6), sd = selDiv(), b = m.booth;
  let last = null, cut = null;
  ctx.lineWidth = 0.7;
  for (const g of list) {
    const r = Math.min(BAL_MAX, Math.max(0.6, g.q * s)), x = g.x * T.k + T.x, y = g.y * T.k + T.y;
    if (x < -r || y < -r || x > Wpx + r || y > Hpx + r) continue;
    const a = 0.88 * alpha * (sd != null && b.d[g.ids[0]] !== sd ? 0.35 : 1);
    if (a !== cut) { ctx.globalAlpha = a; cut = a; }
    if (g.col !== last) { ctx.fillStyle = g.col; last = g.col; }
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    if (r > 2) { ctx.strokeStyle = ring; ctx.stroke(); }
  }
}
// the level for this zoom: held until the zoom has gone well past it, so a level is never
// half-shown at rest, and a change of level is a short crossfade in time, not a stretch of zoom
const balLvl = { L: null, from: null, t0: 0 };
function balloonLevelNow() {
  const l = Math.log2(BAL_CELL / T.k);
  if (balLvl.L == null) { balLvl.L = Math.round(l); return; }
  if (Math.abs(l - balLvl.L) > 0.62) { const to = Math.round(l); balLvl.from = balLvl.L; balLvl.L = to; balLvl.t0 = performance.now(); }
}
function drawBalloons(m, ball) {
  const B = balloonSet(m), th = TH, s = balScale();
  balloonLevelNow();
  const n = balLvl.L;
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let e = 1;
  if (balOld) {
    const t = clamp((performance.now() - balOld.t0) / 380, 0, 1); e = ease(t);
    if (t >= 1) balOld = null;
    else {
      needFrame = true;
      const O = balOld;
      if (O.A) withT(viaFrame(T, O.A), () => paintBalloons(O.m, balloonLevel(O.m, O.B, n), 1 - e, 1, s));
    }
  }
  const a = e * Math.min(1, ball * 1.4), grow = 0.4 + 0.6 * ball, now = balloonLevel(m, B, n);
  let w = 1;
  if (balLvl.from != null) {
    w = reduceMotion ? 1 : clamp((performance.now() - balLvl.t0) / 220, 0, 1);
    if (w >= 1) balLvl.from = null; else { needFrame = true; paintBalloons(m, balloonLevel(m, B, balLvl.from), a * (1 - ease(w)), grow, s); }
  }
  paintBalloons(m, now, a * ease(w), grow, s);
  m._balNow = now;
  ctx.globalAlpha = 1;
  const ringAt = (x, y, r, wd, col) => { ctx.beginPath(); ctx.arc(x * T.k + T.x, y * T.k + T.y, r, 0, 6.2832); ctx.lineWidth = wd; ctx.strokeStyle = css(col); ctx.stroke(); };
  const rOf = (g) => Math.min(BAL_MAX, Math.max(0.6, g.q * s)) + 1.6;
  const h = S.hover;
  if (h && h.kind === "bal" && h.g) ringAt(h.g.x, h.g.y, rOf(h.g), 1.6, th.ink);
  if (h && h.kind === "booth" && now) { const g = now.find((q) => q.n === 1 && q.ids[0] === h.i); if (g) ringAt(g.x, g.y, rOf(g), 1.6, th.ink); }
  if (S.sel.level === "booth" && now) { const g = now.find((q) => q.n === 1 && q.ids[0] === S.sel.booth); if (g) ringAt(g.x, g.y, rOf(g), 2.4, th.ink); }
  ctx.restore();
}
// the smallest balloon under the pointer: small ones lie on top
function balloonHit(m, px, py) {
  const list = m._balNow; if (!list) return null;
  const s = balScale();
  for (let k = list.length - 1; k >= 0; k--) {
    const g = list[k], r = Math.max(3, Math.min(BAL_MAX, g.q * s)), dx = px - (g.x * T.k + T.x), dy = py - (g.y * T.k + T.y);
    if (dx * dx + dy * dy <= r * r) return g.n === 1 ? { kind: "booth", i: g.ids[0] } : { kind: "bal", i: g.ids[0], g };
  }
  return null;
}
// a shared balloon in the tooltip: what its places come to together, and which seats they're in
function balloonTip(m, g) {
  const b = m.booth, seats = new Map();
  for (const j of g.ids) { const d = b.d[j]; seats.set(d, (seats.get(d) || 0) + b.formal[j]); }
  const top = [...seats].sort((p, q) => q[1] - p[1]).map(([d]) => ds(m.divs[d].n)), more = top.length - 2;
  const where = more > 0 ? `${top[0]}, ${top[1]} and ${more} other ${more === 1 ? "seat" : "seats"}` : top.join(" and ");
  const read = S.lens === "winner" ? `${FAM_NAME[g.top]} ahead by ${int(g.size)} votes` : S.lens === "cls" ? valueText(g.top, "div", { m, d: null }) : valueText(g.val, "div", { m, d: null });
  const size = S.lens === "winner" ? "" : ` · ${balloonWord(m)}: ${int(g.size)}`;
  return `<div class="tn">${int(g.n)} polling places</div><div class="tv">${esc(read)}</div><div class="ts">${where}${size}</div><div class="ts">Click to part them</div>`;
}
// zoom in on a shared balloon until it comes apart
function goBalloon(g) {
  const pad = 0.15 * Math.max(g.x1 - g.x0, g.y1 - g.y0, 0.6);
  const t = fitTransform([[g.x0 - pad, g.y0 - pad], [g.x1 + pad, g.y1 + pad]]);
  fly(t.k > T.k * 1.5 ? t : d3.zoomIdentity.translate(Wpx / 2 - g.x * T.k * 2.2, Hpx / 2 - g.y * T.k * 2.2).scale(T.k * 2.2), reduceMotion ? 0 : 700, () => {});
}
// the election being left, when the map changes year under the balloons
function balloonsLeave(a, b) {
  if (reduceMotion || !a || !a._bal || drawOf(b) !== "balloons") { balOld = null; return; }
  balOld = { m: a, B: a._bal, t0: performance.now(), A: jurOf(a.year) === jurOf(b.year) ? frameMap(a, b) : null };
}

// what a built contest stands on, for the key and the story
const axisByBonham = (m, pair) => m.year === "sa26" && pair === "AO";
function axisHow(m, pair, idx) {
  if (axisByBonham(m, pair)) return "splits other parties’ votes by estimates of how they flowed at this election";
  return `splits other parties’ votes by how ${STATE_YEARS.has(m.year) ? `${STATE_POSS[m.divs[idx[0]].st]} voters` : "their voters"} ranked the two on the Senate ballot`;
}

/* ----- the story of a built contest -----
   Every line says what the figure is: no election ran this contest but in the seats that
   drew it, so nothing here reads as a result. */
function axisHedDek(m, idx, where) {
  const pair = axisNow(m), [a, b] = axisNames(pair), [Ac, Bc] = axisCap(pair), A = axisOf(m), v = axisArea(m, idx), B = m.booth;
  if (!A || v == null) return { hed: `${Ac} and ${b} didn’t both stand${where}`, dek: "So this contest can’t be built here." };
  const lead = v >= 50, hi = Math.max(v, 100 - v);
  let n = 0, k = 0, finals = 0;
  for (const i of idx) { const d = m.divs[i]; if ([d.A.b, d.B.b].includes(SP_PAIRS[pair][0]) && [d.A.b, d.B.b].includes(SP_PAIRS[pair][1])) finals++; for (const j of B.byDiv[i]) { const x = A.v[j]; if (Number.isNaN(x)) continue; n++; if ((x >= 50) !== lead) k++; } }
  const hed = `${lead ? Ac : Bc} would lead ${lead ? b : a} ${f1(hi)} to ${f1(100 - hi)}${where}`;
  const other = lead ? b : a, pct = (100 * k) / n;
  const places = k === 0 ? `${cap(other)} would lead at no polling place.` : pct < 1 ? `${cap(other)} would lead at only ${int(k)} of ${int(n)} polling places.` : `${cap(other)} would lead at ${f0(pct)}% of polling places.`;
  const seen = finals ? ` ${cap(words(finals))} ${finals === 1 ? "seat" : "seats"} really had this final two, and ${finals === 1 ? "its" : "their"} own ${finals === 1 ? "count stands" : "counts stand"}.` : "";
  return { hed, dek: `That’s an estimate, not a result: this contest never ran${where}. It takes each polling place’s first preferences and ${axisHow(m, pair, idx)}. ${places}${seen}` };
}
function axisSeatHedDek(m, d) {
  const pair = axisNow(m), [fa, fb] = SP_PAIRS[pair], [a, b] = axisNames(pair), [Ac, Bc] = axisCap(pair), A = axisOf(m), v = A && !A.seatSkip[d.i] ? axisArea(m, [d.i]) : null;
  if (v == null) return { hed: `${Ac} and ${b} didn’t both stand in ${ds(d.n)}`, dek: "So this contest can’t be built here." };
  const lead = v >= 50, hi = Math.max(v, 100 - v), real = [d.A.b, d.B.b].includes(fa) && [d.A.b, d.B.b].includes(fb);
  if (real) return { hed: `${lead ? Ac : Bc} won ${f1(hi)}% against ${lead ? b : a} in ${ds(d.n)}`, dek: "This seat’s final two really were these two, so that’s its count at the polling places." };
  return { hed: `${lead ? Ac : Bc} would lead ${lead ? b : a} ${f1(hi)} to ${f1(100 - hi)} in ${ds(d.n)}`, dek: `That’s an estimate, not a result: the seat’s final two were ${ds(d.A.n)} and ${ds(d.B.n)}. It takes the polling places’ first preferences and ${axisHow(m, pair, [d.i])}.` };
}

/* ----- the key's own lines ----- */
// what the size of a balloon counts
function balloonWord(m) {
  const two = axisNow(m) !== "AC";
  switch (S.lens) {
    case "winner": return "Lead, votes";
    case "tpp": return S.tppMode === "swing" ? "Votes that moved" : two ? "Estimated lead, votes" : "Two-party lead, votes";
    case "fp": return S.fpMode === "change" ? "Votes gained or lost" : `Votes for ${FAM_PL[S.party]}`;
    case "senate": return senGap() ? "Votes between Senate and House" : `Senate votes for ${FAM_PL[S.party]}`;
    case "flow": return "Preferences to split";
    case "senpref": return "Ballots ranking either";
    case "informal": return infModeOf(m) === "exhaust" ? "Ballots exhausted" : "Informal votes";
    default: return "Votes cast";
  }
}
function balloonKey(m, est) {
  const s = balScale(), nice = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
  const big = nice.filter((v) => Math.sqrt(v) * s <= 9.5).pop() || 50, list = [big, nice[Math.max(0, nice.indexOf(big) - 2)], nice[Math.max(0, nice.indexOf(big) - 4)]].filter((v, k, a) => a.indexOf(v) === k);
  const R = Math.sqrt(big) * s, H = Math.ceil(2 * R + 2);
  let x = 0, circles = "", labels = "";
  for (const v of list) { const r = Math.max(0.8, Math.sqrt(v) * s); circles += `<circle cx="${(x + r + 1).toFixed(1)}" cy="${(H - 1 - r).toFixed(1)}" r="${r.toFixed(1)}"/>`; x += 2 * r + 2; labels += `${labels ? ", " : ""}${int(v)}`; }
  return `<div class="lg-bal"><svg width="${Math.ceil(x + 2)}" height="${H}" viewBox="0 0 ${Math.ceil(x + 2)} ${H}" aria-hidden="true">${circles}</svg><span>${est && (S.lens === "winner" || S.lens === "tpp") ? "Estimated lead, votes" : balloonWord(m)}: ${labels}</span></div>`;
}
/* each drawing, and why this frame and lens can't draw it where they can't — one
   list for the strip's Draw chips and the phone panel's Draw menu */
function drawOpts(m) {
  const fits = surfaceFits(m);
  const areasNo = areasFits(m) ? "" : S.lens !== "seifa" ? "Areas paints the census’s own areas — pick the Census lens" : S.index === "hl" ? "The homeless lane stays as seats: the census counts that one per SA2 estimate, never as a share of every census area" : "No census-areas pack reads this frame’s census yet";
  return DRAWS.map(([k, t]) => ({ k, t, why: k === "chart" && !chartFits(m) ? "Chart plots a figure: pick Two-party, Primary, Census or another lens with numbers"
    : k === "surface" && !fits ? surfaceReason(m)
    : k === "areas" && areasNo ? areasNo : "" }));
}
function drawRowHTML(m) {
  const on = S.draw === "chart" ? "chart" : drawOf(m);
  return `<div class="lg-draw" role="group" aria-label="Draw the map as"><span>Draw</span>${drawOpts(m).map(({ k, t, why }) => `<button type="button" data-draw="${k}" aria-pressed="${on === k && !why}"${why ? ` disabled title="${why}"` : ""}><span class="tw" data-t="${t}">${t}</span></button>`).join("")}</div>`;
}
/* ----- what the balloons leave out -----
   Postal, absent and declaration votes are counted by seat, not at a place, so neither
   drawing has anywhere to put them; nor have the places with no spot (balloonPlace). The key
   says how many votes that is in the place chosen and, where the balloons read the two-party
   lead, which way they went. That lead is each seat's count less the lead its balloons draw,
   so the key and the balloons add up exactly to the real result. A seat with a drawn place
   that has no two-party figure (some of 1998's) leaves it unsaid. */
function undrawnBySeat(m) {
  if (m._undrawn) return m._undrawn;
  const b = m.booth, N = m.divs.length, off = new Float64Array(N), drawn = new Float64Array(N), gap = new Uint8Array(N);
  for (let j = 0; j < b.n; j++) {
    const i = b.d[j], t = b.raw && b.raw.tpp && b.raw.tpp[j];
    if (!balloonPlace(b, j)) off[i] += b.formal[j] || 0;
    else if (t) drawn[i] += t[0] - t[1];
    else gap[i] = 1;
  }
  return (m._undrawn = m.divs.map((d, i) => {
    const v = d.vt, r = m.res.divs[i];
    if (!v) return null;
    return { n: (v.pre || 0) + (v.post || 0) + (v.abs || 0) + (v.prov || 0) + off[i], lead: r && r.tpp && !gap[i] ? r.tpp[0] - r.tpp[1] - drawn[i] : null };
  }));
}
function undrawnOf(m) {
  const by = undrawnBySeat(m), sd = selDiv(), st = S.sel.level === "state" ? S.sel.st : null;
  let n = 0, lead = 0;
  for (let i = 0; i < by.length; i++) {
    if (!by[i] || (sd != null ? i !== sd : st && m.divs[i].st !== st)) continue;
    n += by[i].n; lead = lead == null || by[i].lead == null ? null : lead + by[i].lead;
  }
  return n ? { n, lead } : null;
}
// to three figures, which is all the key needs: 3.2m, 242,000, 21,300
function roughly(v) {
  if (v >= 999500) return `${(v / 1e6).toFixed(1)}m`;
  const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, v))) - 2);
  return int(Math.round(v / p) * p);
}
function undrawnHTML(m, est) {
  if (STATE_YEARS.has(m.year)) return "";
  // an election not yet loaded holds the room for its line
  const u = m.standIn ? { n: 3.2e6, lead: -242000 } : undrawnOf(m);
  if (!u) return "";
  const led = S.lens === "tpp" && S.tppMode !== "swing" && axisNow(m) === "AC" && !est && u.lead != null;
  const lead = !led ? "" : Math.abs(u.lead) < 0.5 ? ", level" : `, ${u.lead > 0 ? "Labor" : "Coalition"} by ${roughly(Math.abs(u.lead))}`;
  return `<div class="lg-undrawn">Not drawn: ${roughly(u.n)} postal and other votes${lead}</div>`;
}
// the note under the drawing's name: what the picture is, and for a built contest what it stands on
function drawNoteHTML(m) {
  const d = drawOf(m);
  if (d === "seats") return S.draw === "surface" ? `<div class="lg-note">${esc(surfaceReason(m))}</div>` : "";
  const est = !m.standIn && placesLackMemo(m);
  if (d === "balloons") return balloonKey(m, est) + undrawnHTML(m, est);
  if (d === "areas") {
    const vin = areasVintage(m), got = AR.packs[vin] && AR.packs[vin].pack, near = m.demoInterp && m.demoInterp.nearestSide === vin;
    return `${S.draw === "surface" ? `<div class="lg-note">Census figures are shown as Areas; Surface is unavailable for this measure.</div>` : ""}<div class="lg-note">${got ? `The census’s ${int(got.geoms.length)} census areas, each as counted at the ${vin} census${near ? ` — the nearest single census, ${vin}, since this frame blends two` : ""}. Empty land stays paper, and so does any area the ABS suppresses a figure for.` : "Loading the census areas…"}</div>`;
  }
  const modelled = axisNow(m) !== "AC";
  const selected = selDiv(), st = S.sel.level === "state" ? S.sel.st : null;
  const data = SF.m === m && SF.key === readingKey(m) ? SF.data : null;
  let total = 0, included = 0, sites = 0;
  for (const d of m.divs) {
    if (selected != null ? d.i !== selected : st && d.st !== st) continue;
    total += d.formal;
    if (data) { included += data.seatVotes[d.i]; sites += data.seatN[d.i]; }
  }
  const coverage = data ? `${int(sites)} polling places · ${f0(total ? 100 * included / total : 0)}% of this selection’s formal House votes.` : SF.m === m && SF.empty ? "No eligible local results for this measure. Choose Seats or Balloons." : "Loading local results…";
  return `<div class="lg-note">${modelled ? "Modelled contest, smoothed from ordinary polling places." : "Nearby ordinary polling-place results, smoothed."} Within 25 km. Pale edges mean less local support; neutral land has no estimate. This describes where votes were cast, not where voters live.</div><div class="lg-undrawn">${coverage} Early centres, mobile teams and unlocated votes remain in seat totals, outside the surface.</div>`;
}
// the key's ramp in the surface's steps
function surfaceRampCss(m) {
  const sc = surfaceScale(m), R = RANGE(); if (!sc || !R) return null;
  const rev = S.lens === "tpp" || S.lens === "flow" || S.lens === "senpref", [lo, hi] = R, e = sc.edges, st = [];
  const pos = (v) => { const t = (100 * (clamp(v, lo, hi) - lo)) / (hi - lo); return rev ? 100 - t : t; };
  for (let k = 0; k <= e.length; k++) {
    const a = k === 0 ? lo : e[k - 1], b = k === e.length ? hi : e[k];
    if (b <= lo || a >= hi) continue;
    const c = colorOf(bandMid(sc, k)); if (!c) continue;
    st.push([pos(a), pos(b), css(c)]);
  }
  if (rev) st.reverse();
  return `linear-gradient(90deg, ${st.map(([p, q, c]) => `${c} ${Math.min(p, q).toFixed(2)}%, ${c} ${Math.max(p, q).toFixed(2)}%`).join(",")})`;
}
