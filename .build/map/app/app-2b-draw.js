/* =============================== how the map is drawn ===============================
   A lens says what each place reads; the drawing says how that reaches the page.
     Seats     every seat filled with its own figure (the map as it has always been)
     Balloons  a circle at every polling place, its area the votes behind the reading
               (a lead for a lead, a party's votes for a party's share), so a big safe
               booth outweighs a marginal one and an empty seat holds no ink
     Surface   the polling places' figures blended into one continuous field, in steps,
               with a line where the two sides meet. No seat's boundary shapes it

   Both read the lens through boothValue, so every lens's own colours, keys and tooltips
   carry over. They apply to the map view alone: the chamber and the list keep their seats.

   The surface's field is an estimate at every point and says so in its key. It comes from
   the polling places' votes on a pyramid of grids (surfaceEngine): each level, coarser
   than the last, holds the votes and the vote-weighted figure within a cell or so of each
   node; walking back down, a node keeps its own level's figure where enough votes stand
   behind it and otherwise takes the level above's, smoothly (cubic B-spline subdivision).
   So a suburb reads its own booths while the Simpson Desert reads the nearest towns a
   long way off, and the whole costs a pass over the grid, not over booths times pixels.
   There is one field for a reading, set in kilometres: the zoom never enters into it, so
   zooming magnifies a place and can't change what it reads. (It used to be smoothed by the
   screen, seven pixels' worth, and a spot read differently at every zoom and even, by the
   way a raster was reused, at the same zoom by the way the reader came to it.)

   Colour is decided a cell at a time: a cell whose corners share a step is filled flat,
   and only the few cells a step's edge crosses are worked out pixel by pixel, antialiased,
   which is what keeps a screen of this cheap enough to redo as the reader zooms.
   The raster comes back through a worker and is laid on as a canvas pattern through the
   seats' own fill paths (drawGeo), so the coast, the sea cut, the islands, the filters and
   the veil over an opened seat all work on it as they do on a flat fill. */

const DRAWS = [["seats", "Seats"], ["balloons", "Balloons"], ["surface", "Surface"]];
// a seat type belongs to the whole seat, and so does its exhausted share: nothing to blend
const surfaceFits = (m) => !(S.lens === "cls" || (S.lens === "informal" && infModeOf(m) === "exhaust"));
// the drawing in force on an election (the chamber and the list keep their seats)
const drawOf = (m) => (S.view !== "map" || !m || m.house === "senate" ? "seats" : S.draw === "surface" && !surfaceFits(m) ? "seats" : S.draw);

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
const axisName = (f, cap) => (f === "alp" ? "Labor" : f === "onp" ? "One Nation" : coalW(cap ? 1 : 0));
const axisOpts = () => [["AC", `Labor v ${coalW(0)}`], ["AO", "Labor v One Nation"], ["CO", `${coalW(1).replace(/^The /, "")} v One Nation`]];
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
  return axisFrame(m) == null ? "AC" : S.axis;
}
const axisNames = (pair = S.axis) => SP_PAIRS[pair].map((f) => axisName(f));
const axisCap = (pair = S.axis) => SP_PAIRS[pair].map((f) => axisName(f, true));
// how far from even the contest's colours run: to where its places actually spread (the Coalition's lead over One Nation runs longest)
const axisSpan = (pair = S.axis) => (pair === "CO" ? 40 : 30);
const axisRamp = (pair = S.axis) => (pair === "AO" ? RAMP.divOn : pair === "CO" ? RAMP.divCo : RAMP.div);
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
  // each group's rate at each place
  const k0 = (() => { let k = 0; for (const p of ["AC", "AO", "CO"]) { if (p === pair) return k; k += SP_DONORS[p].length; } return 0; })();
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
/* places with no spot on the map: the remote and mobile teams above all (Lingiari's 35 in 2025
   took 13,984 votes, 81.5% Labor, in communities right across the seat), and most of a
   frame's places before the AEC's coordinates begin. We know the seat, not the spot: so a
   seat's unplaced votes are shared evenly over its land, which is where they were cast, or
   the surface would read the seat from its towns alone. */
const SPOT_MIN = 0.02;   // of a seat's placed votes: under this its unplaced votes change nothing
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
// polling places, in the pyramid's terms
function surfaceData(m) {
  const b = m.booth, fam = S.lens === "winner", n = b.n;
  const idx = [], vals = [], seatN = new Int32Array(m.divs.length), placed = new Float64Array(m.divs.length), loose = new Map();
  const fams = FAMS.slice(), famAt = Object.fromEntries(fams.map((f, k) => [f, k]));
  const A = fam ? null : axisOf(m);
  for (let j = 0; j < n; j++) {
    const w = surfaceWeight(m, j); if (!(w > 0)) continue;
    let val;
    if (fam) {
      const tc = finalVotes(m, j), D = m.divs[b.d[j]]; if (!tc || !(tc[0] + tc[1])) continue;
      val = tc[0] / (tc[0] + tc[1]);
      if (!Number.isNaN(b.x[j])) vals.push([famAt[D.A.b], famAt[D.B.b], val]);
    } else {
      val = drawValue(m, j); if (val == null || Number.isNaN(val)) continue;
      if (!Number.isNaN(b.x[j])) vals.push(val);
    }
    if (Number.isNaN(b.x[j])) { const i = b.d[j], q = loose.get(i) || { w: 0, s: 0 }; q.w += w; q.s += val * w; loose.set(i, q); continue; }
    idx.push(j); seatN[b.d[j]]++; placed[b.d[j]] += w;
  }
  if (idx.length < 12) return null;
  const extra = [];
  for (const [i, q] of loose) {
    if (q.w < SPOT_MIN * placed[i]) continue;
    const spots = seatSpots(m, i), v = q.s / q.w, D = m.divs[i];
    for (const [sx, sy] of spots) extra.push([sx, sy, q.w / spots.length, fam ? [famAt[D.A.b], famAt[D.B.b], v] : v]);
    seatN[i]++;
  }
  const c = idx.length + extra.length, x = new Float32Array(c), y = new Float32Array(c), w = new Float32Array(c), late = new Float32Array(c);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  const u = unitsPerKm(m), lateAt = SURF_LATE * u;
  idx.forEach((j, k) => {
    x[k] = b.x[j]; y[k] = b.y[j]; w[k] = surfaceWeight(m, j);
    // an early voting centre takes its votes from across a district, so it joins from the coarser levels only
    late[k] = b.ty[j] === 5 ? lateAt : 0;
    bx0 = Math.min(bx0, x[k]); bx1 = Math.max(bx1, x[k]); by0 = Math.min(by0, y[k]); by1 = Math.max(by1, y[k]);
  });
  extra.forEach(([sx, sy, sw, sv], e) => { const k = idx.length + e; x[k] = sx; y[k] = sy; w[k] = sw; late[k] = lateAt; vals.push(sv); });
  const none = m.divs.map((d) => seatN[d.i] === 0);
  const th = TH, D = { n: c, x, y, w, late, bx0, by0, bx1, by1, u, M0: SURF_M0, ink: rgba32(th.ink) };
  if (fam) {
    // only the groups that lead somewhere, or finish in anyone's two, get a channel of their own
    const used = fams.filter((f, k) => vals.some((q) => q[0] === k || q[1] === k));
    const remap = fams.map((f) => used.indexOf(f));
    D.ch = used.map(() => new Float32Array(c));
    vals.forEach((q, k) => { D.ch[remap[q[0]]][k] += q[2]; D.ch[remap[q[1]]][k] += 1 - q[2]; });
    const nb = LEAD_STEPS.length + 1;
    D.fam = true; D.nb = nb; D.lo = 0; D.hi = 100;
    D.band = new Uint8Array(4096).map((_, k) => { const v = (100 * k) / 4095; let q = 0; while (q < LEAD_STEPS.length && v >= LEAD_STEPS[q]) q++; return q; });
    D.col = new Uint32Array(used.length * nb);
    used.forEach((f, u) => { for (let q = 0; q < nb; q++) D.col[u * nb + q] = rgba32(RAMP.gain[f][Math.round(LEAD_RAMP_AT[q] * 100)]); });
    D.line = 1; D.ids = used;
  } else {
    D.ch = [Float32Array.from(vals)];
    const sc = surfaceScale(m), e = sc.edges;
    D.fam = false; D.lo = sc.lo; D.hi = sc.hi; D.line = sc.line;
    D.band = new Uint8Array(4096).map((_, k) => { const v = sc.lo + ((sc.hi - sc.lo) * k) / 4095; let q = 0; while (q < e.length && v >= e[q]) q++; return q; });
    D.col = Uint32Array.from({ length: e.length + 1 }, (_, k) => { const c1 = colorOf(bandMid(sc, k)); return rgba32(c1 || th.nodata); });
  }
  return { D, none };
}
const SURF_M0 = 6000;     // votes: under this a level's figure gives way to the level above
const SURF_LATE = 7;      // km: the cell at which an early voting centre joins

/* the surface: one field for a reading, made once, and pictures of it. Self-contained: a worker runs
   this very text. D is a reading's places; the field is a function of the spot alone, so a view, a zoom
   and a screen only choose where to look at it (what the map is for: zooming in magnifies a place, it
   doesn't ask a different question of it).
   A lattice in kilometres, never in pixels. The whole frame comes first (build), every 8km (C0, D.u being
   map units a kilometre), filled from a pyramid above it. Finer levels, to 1km, are only worth having where
   votes stand behind them, so they live in tiles made as a view first needs them (tile): a level's figure
   counts where its votes reach M0 and otherwise gives way to the level above, smoothly (cubic B-spline
   subdivision). Sampling is a cubic B-spline too, so the field is smooth at any magnification. A view too
   wide to show a tile's finest lattice reads its mip, the average of the field over that coarser cell, and
   one as wide as the frame's own 8km reads the frame: the whole country needs no tiles at all, so a
   reading's first picture is quick, and the tiles a closer view asks for are made once and kept. */
function surfaceEngine() {
  const CELL = 3, PAD = 3, KA = 7, TN = 128, MG = 20, FINE = 3, built = new WeakMap(), wx = new Float64Array(4), wy = new Float64Array(4);
  // [1 4 6 4 1]/16 each way, on a whole grid
  const blur = (a, nx, ny) => {
    const t = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) { const o = j * nx; for (let i = 0; i < nx; i++) {
      const i1 = i > 0 ? i - 1 : 0, i2 = i > 1 ? i - 2 : 0, i3 = i < nx - 1 ? i + 1 : i, i4 = i < nx - 2 ? i + 2 : nx - 1;
      t[o + i] = (a[o + i2] + 4 * a[o + i1] + 6 * a[o + i] + 4 * a[o + i3] + a[o + i4]) / 16;
    } }
    for (let j = 0; j < ny; j++) {
      const j1 = (j > 0 ? j - 1 : 0) * nx, j2 = (j > 1 ? j - 2 : 0) * nx, j3 = (j < ny - 1 ? j + 1 : j) * nx, j4 = (j < ny - 2 ? j + 2 : ny - 1) * nx, o = j * nx;
      for (let i = 0; i < nx; i++) a[o + i] = (t[j2 + i] + 4 * t[j1 + i] + 6 * t[o + i] + 4 * t[j3 + i] + t[j4 + i]) / 16;
    }
  };
  // a coarse level's nodes fall on every second node of the one below it: the cubic B-spline's rule
  const subdivide = (a, Co, Fi) => {
    const ox = Fi.ix - 2 * Co.ix, oy = Fi.iy - 2 * Co.iy, cnx = Co.nx, cny = Co.ny;
    const tmp = new Float32Array(Fi.nx * cny), out = new Float32Array(Fi.nx * Fi.ny);
    for (let j = 0; j < cny; j++) { const o = j * cnx, t = j * Fi.nx;
      for (let i = 0; i < Fi.nx; i++) {
        const u = i + ox, h = u >> 1, i0 = h < 0 ? 0 : h >= cnx ? cnx - 1 : h, i1 = i0 + 1 < cnx ? i0 + 1 : i0, im = i0 > 0 ? i0 - 1 : 0;
        tmp[t + i] = u & 1 ? (a[o + i0] + a[o + i1]) / 2 : (a[o + im] + 6 * a[o + i0] + a[o + i1]) / 8;
      }
    }
    for (let j = 0; j < Fi.ny; j++) {
      const u = j + oy, h = u >> 1, j0 = h < 0 ? 0 : h >= cny ? cny - 1 : h, j1 = j0 + 1 < cny ? j0 + 1 : j0, jm = j0 > 0 ? j0 - 1 : 0, o = j * Fi.nx;
      const r0 = j0 * Fi.nx, r1 = j1 * Fi.nx, rm = jm * Fi.nx;
      if (u & 1) for (let i = 0; i < Fi.nx; i++) out[o + i] = (tmp[r0 + i] + tmp[r1 + i]) / 2;
      else for (let i = 0; i < Fi.nx; i++) out[o + i] = (tmp[rm + i] + 6 * tmp[r0 + i] + tmp[r1 + i]) / 8;
    }
    return out;
  };
  // a level's votes and vote-weighted figures, within a cell or so of its nodes
  const pile = (D, G, on) => {
    const { n, x, y, w, late, ch } = D, nc = ch.length, { c, ix, iy, nx, ny } = G, W = new Float32Array(nx * ny), N = ch.map((_, q) => (!on || on[q] ? new Float32Array(nx * ny) : null));
    for (let k = 0; k < n; k++) {
      if (c < late[k]) continue;
      const gx = x[k] / c - ix, gy = y[k] / c - iy, i = Math.floor(gx), j = Math.floor(gy);
      if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1) continue;
      const fx = gx - i, fy = gy - j, o = j * nx + i, wa = w[k] * (1 - fx) * (1 - fy), wb = w[k] * fx * (1 - fy), wc = w[k] * (1 - fx) * fy, wd = w[k] * fx * fy;
      W[o] += wa; W[o + 1] += wb; W[o + nx] += wc; W[o + nx + 1] += wd;
      for (let q = 0; q < nc; q++) { const A = N[q]; if (!A) continue; const v = ch[q][k]; A[o] += wa * v; A[o + 1] += wb * v; A[o + nx] += wc * v; A[o + nx + 1] += wd * v; }
    }
    blur(W, nx, ny); for (let q = 0; q < nc; q++) if (N[q]) blur(N[q], nx, ny);
    G.W = W; G.N = N;
  };
  // a level's figures over the one above it, where its votes reach
  const settle = (D, G, U, q) => {
    const W = G.W, A = G.N[q], M2 = D.M0 * D.M0;
    for (let k = 0; k < U.length; k++) { const wv = W[k]; if (!(wv > 1e-3)) continue; const m = wv * KA, t = (m * m) / (m * m + M2); U[k] += t * (A[k] / wv - U[k]); }
    return U;
  };
  // the whole frame, every 8km
  function build(D) {
    let S = built.get(D);
    if (S) return S;
    const { n, w, ch } = D, nc = ch.length, C0 = 8 * D.u, CF = C0 / 2 ** FINE, pad = 8 * C0;
    const x0 = D.bx0 - pad, y0 = D.by0 - pad, x1 = D.bx1 + pad, y1 = D.by1 + pad, ext = Math.max(x1 - x0, y1 - y0);
    let top = 0; while (C0 * 2 ** top < ext / 3) top++;
    const Ls = [];
    for (let l = 0; l <= top; l++) {
      const c = C0 * 2 ** l, ix = Math.floor(x0 / c) - PAD, iy = Math.floor(y0 / c) - PAD, G = { c, ix, iy, nx: Math.ceil(x1 / c) + PAD - ix + 1, ny: Math.ceil(y1 / c) + PAD - iy + 1 };
      pile(D, G); Ls.push(G);
    }
    let sw = 0; const sn = new Float64Array(nc);
    for (let k = 0; k < n; k++) { sw += w[k]; for (let q = 0; q < nc; q++) sn[q] += w[k] * ch[q][k]; }
    const T0 = Ls[top], F = [];
    for (let q = 0; q < nc; q++) { const a = new Float32Array(T0.nx * T0.ny), mean = sn[q] / sw; for (let k = 0; k < a.length; k++) a[k] = T0.W[k] > 1e-3 ? T0.N[q][k] / T0.W[k] : mean; F.push(a); }
    for (let l = top - 1; l >= 0; l--) { for (let q = 0; q < nc; q++) F[q] = settle(D, Ls[l], subdivide(F[q], Ls[l + 1], Ls[l]), q); if (l) Ls[l].W = Ls[l].N = null; }
    // the tiles worth making: where a fine level's votes could reach M0, and a little round
    const G = Ls[0], want = new Set(), span = TN * CF, reach = 2 * C0, floorM = 0.5 * D.M0;
    for (let j = 0, o = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++, o++) {
      if (G.W[o] * KA < floorM) continue;
      const x = (G.ix + i) * C0, y = (G.iy + j) * C0;
      for (const dx of [-reach, reach]) for (const dy of [-reach, reach]) want.add(Math.floor((x + dx) / span) * 65536 + Math.floor((y + dy) / span));
    }
    G.W = G.N = null;
    S = { C0, CF, span, G, F, want, tiles: new Map(), nc };
    built.set(D, S);
    return S;
  }
  // a tile: its lattice's finest levels over the frame's, and each coarser cell's average for a wide view
  function tile(D, S, tx, ty) {
    const key = tx * 65536 + ty;
    let t = S.tiles.get(key);
    if (t !== undefined) return t;
    if (!S.want.has(key)) { S.tiles.set(key, null); return null; }
    const ix0 = tx * TN - MG, iy0 = ty * TN - MG, ix1 = ix0 + TN + 2 * MG, iy1 = iy0 + TN + 2 * MG, Ls = [];
    for (let l = 0; l <= FINE; l++) { const s = 2 ** l, ix = Math.floor(ix0 / s) - PAD, iy = Math.floor(iy0 / s) - PAD; Ls.push({ c: S.CF * s, ix, iy, nx: Math.ceil(ix1 / s) + PAD - ix + 1, ny: Math.ceil(iy1 / s) + PAD - iy + 1 }); }
    // (a group with nothing here stays at nothing: most tiles need two or three of a Winner field's six)
    const Top = Ls[FINE], g = S.G, on = new Array(S.nc).fill(false), F = S.F.map((A, q) => { const a = new Float32Array(Top.nx * Top.ny); for (let j = 0, o = 0; j < Top.ny; j++) { const v = Math.max(0, Math.min(g.ny - 1, Top.iy + j - g.iy)); for (let i = 0; i < Top.nx; i++, o++) { const s = A[v * g.nx + Math.max(0, Math.min(g.nx - 1, Top.ix + i - g.ix))]; a[o] = s; if (s > 1e-3) on[q] = true; } } return a; });
    if (!D.fam) on.fill(true);
    for (let l = 0; l < FINE; l++) pile(D, Ls[l], on);
    for (let l = FINE - 1; l >= 0; l--) { for (let q = 0; q < S.nc; q++) F[q] = on[q] ? settle(D, Ls[l], subdivide(F[q], Ls[l + 1], Ls[l]), q) : null; Ls[l].W = Ls[l].N = null; }
    const G0 = Ls[0], mips = [{ G: G0, F }];
    for (let m = 1; m <= FINE; m++) {
      const P = mips[m - 1], g0 = P.G, ix = Math.ceil(g0.ix / 2) + 1, iy = Math.ceil(g0.iy / 2) + 1, nx = Math.floor((g0.ix + g0.nx - 2) / 2) - ix + 1, ny = Math.floor((g0.iy + g0.ny - 2) / 2) - iy + 1, G = { c: g0.c * 2, ix, iy, nx, ny };
      const down = P.F.map((A) => {
        if (!A) return null;
        const a = new Float32Array(nx * ny), r = g0.nx;
        for (let j = 0, o = 0; j < ny; j++) { const c = (2 * (iy + j) - g0.iy) * r; for (let i = 0; i < nx; i++, o++) { const k = c + 2 * (ix + i) - g0.ix; a[o] = (4 * A[k] + 2 * (A[k - 1] + A[k + 1] + A[k - r] + A[k + r]) + A[k - r - 1] + A[k - r + 1] + A[k + r - 1] + A[k + r + 1]) / 16; } }
        return a;
      });
      mips.push({ G, F: down });
    }
    S.tiles.set(key, (t = mips));
    return t;
  }
  // the field at a spot, off a lattice: a cubic B-spline of its four nearest nodes each way
  function read(G, F, x, y, out) {
    const u = x / G.c - G.ix, v = y / G.c - G.iy, i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, nx = G.nx, ny = G.ny;
    const a2 = a * a, a3 = a2 * a, b2 = b * b, b3 = b2 * b;
    wx[0] = (1 - 3 * a + 3 * a2 - a3) / 6; wx[1] = (4 - 6 * a2 + 3 * a3) / 6; wx[2] = (1 + 3 * a + 3 * a2 - 3 * a3) / 6; wx[3] = a3 / 6;
    wy[0] = (1 - 3 * b + 3 * b2 - b3) / 6; wy[1] = (4 - 6 * b2 + 3 * b3) / 6; wy[2] = (1 + 3 * b + 3 * b2 - 3 * b3) / 6; wy[3] = b3 / 6;
    const inner = i >= 1 && j >= 1 && i < nx - 2 && j < ny - 2;
    for (let q = 0; q < F.length; q++) {
      const A = F[q];
      if (!A) { out[q] = 0; continue; }
      let s = 0;
      if (inner) {
        for (let dj = 0, o = (j - 1) * nx + i - 1; dj < 4; dj++, o += nx) s += wy[dj] * (wx[0] * A[o] + wx[1] * A[o + 1] + wx[2] * A[o + 2] + wx[3] * A[o + 3]);
      } else for (let dj = 0; dj < 4; dj++) {
        const jj = j + dj - 1, r = (jj < 0 ? 0 : jj >= ny ? ny - 1 : jj) * nx; let row = 0;
        for (let di = 0; di < 4; di++) { const ii = i + di - 1; row += wx[di] * A[r + (ii < 0 ? 0 : ii >= nx ? nx - 1 : ii)]; }
        s += wy[dj] * row;
      }
      out[q] = s;
    }
  }
  let lastKey = null, lastTile = null, lastS = null;
  function sample(D, S, x, y, mip, out) {
    if (mip >= FINE) { read(S.G, S.F, x, y, out); return; }
    const tx = Math.floor(x / S.span), ty = Math.floor(y / S.span), key = tx * 65536 + ty;
    if (S !== lastS || key !== lastKey) { lastS = S; lastKey = key; lastTile = tile(D, S, tx, ty); }
    const t = lastTile;
    if (t) read(t[mip].G, t[mip].F, x, y, out); else read(S.G, S.F, x, y, out);
  }
  // the reading at a spot, whatever is on the screen
  function at(D, x, y) {
    const S = build(D), out = new Float64Array(S.nc);
    sample(D, S, x, y, 0, out);
    return out;
  }
  // the picture of a window J of the field
  function raster(D, J) {
    const S = build(D), nc = S.nc, p = J.px, c0 = CELL * p, W = J.nx, H = J.ny, cw = Math.ceil(W / CELL), chh = Math.ceil(H / CELL), row = cw + 1;
    const mip = Math.max(0, Math.min(FINE, Math.round(Math.log2(c0 / S.CF)))), F = Array.from({ length: nc }, () => new Float32Array(row * (chh + 1))), v = new Float64Array(nc);
    for (let j = 0, o = 0; j <= chh; j++) for (let i = 0; i <= cw; i++, o++) { sample(D, S, J.x0 + i * c0, J.y0 + j * c0, mip, v); for (let q = 0; q < nc; q++) F[q][o] = v[q]; }
    const out = new Uint32Array(W * H);
    const { band, col, lo, hi, line, fam, nb, ink } = D, sc = 4095 / (hi - lo);
    const bandOf = (s) => { const k = ((s - lo) * sc) | 0; return band[k < 0 ? 0 : k > 4095 ? 4095 : k]; };
    const CL = new Int16Array(row * (chh + 1)), SD = new Int8Array(row * (chh + 1));
    const lead = (at2) => { let a = 0, b = -1, va = -1, vb = -1; for (let q = 0; q < nc; q++) { const s = at2(q); if (s > va) { vb = va; b = a; va = s; a = q; } else if (s > vb) { vb = s; b = q; } } return [a, b, va, vb < 0 ? 0 : vb]; };
    for (let o = 0; o < CL.length; o++) {
      if (fam) { let a = 0, va = -1, vb = -1; for (let q = 0; q < nc; q++) { const s = F[q][o]; if (s > va) { vb = va; va = s; a = q; } else if (s > vb) vb = s; } CL[o] = a * nb + bandOf(100 * (va - Math.max(vb, 0))); SD[o] = a; }
      else { const s = F[0][o]; CL[o] = bandOf(s); SD[o] = line != null && s >= line ? 1 : 0; }
    }
    // flat cells, edge cells, and those the line crosses or nearly does
    const FL = new Uint8Array(cw * chh);
    for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      if (CL[a] !== CL[b] || CL[a] !== CL[c] || CL[a] !== CL[d]) FL[j * cw + i] = 1;
      if (line != null && (SD[a] !== SD[b] || SD[a] !== SD[c] || SD[a] !== SD[d])) FL[j * cw + i] = 2;
    }
    if (line != null) for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      if (FL[j * cw + i] !== 2) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ni = i + di, nj = j + dj; if (ni >= 0 && nj >= 0 && ni < cw && nj < chh && FL[nj * cw + ni] < 2) FL[nj * cw + ni] = 3; }
    }
    const LN = CELL + 1, lc = new Int32Array(LN * LN), ls = new Float32Array(LN * LN), lw = J.lw;
    const inkR = ink & 255, inkG = (ink >> 8) & 255, inkB = (ink >> 16) & 255;
    for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      const f = FL[j * cw + i], px0 = i * CELL, py0 = j * CELL;
      if (!f) {
        const c = col[CL[j * row + i]], xe = Math.min(W, px0 + CELL), ye = Math.min(H, py0 + CELL);
        for (let yy = py0; yy < ye; yy++) { const o = yy * W; for (let xx = px0; xx < xe; xx++) out[o + xx] = c; }
        continue;
      }
      const k00 = j * row + i, k10 = k00 + 1, k01 = k00 + row, k11 = k01 + 1, lineOn = line != null && f >= 2;
      let ta = 0, tb = 1;
      if (fam) { const r = lead((q) => (F[q][k00] + F[q][k10] + F[q][k01] + F[q][k11]) / 4); ta = r[0]; tb = r[1] < 0 ? r[0] : r[1]; }
      for (let b = 0, o = 0; b < LN; b++) { const t = b / CELL; for (let a = 0; a < LN; a++, o++) {
        const u = a / CELL, w00 = (1 - u) * (1 - t), w10 = u * (1 - t), w01 = (1 - u) * t, w11 = u * t;
        if (fam) {
          let ia = 0, va = -1, vb = -1;
          for (let q = 0; q < nc; q++) { const A = F[q], s = A[k00] * w00 + A[k10] * w10 + A[k01] * w01 + A[k11] * w11; if (s > va) { vb = va; va = s; ia = q; } else if (s > vb) vb = s; }
          lc[o] = col[ia * nb + bandOf(100 * (va - Math.max(vb, 0)))];
          const A = F[ta], B = F[tb]; ls[o] = (A[k00] - B[k00]) * w00 + (A[k10] - B[k10]) * w10 + (A[k01] - B[k01]) * w01 + (A[k11] - B[k11]) * w11;
        } else {
          const A = F[0], s = A[k00] * w00 + A[k10] * w10 + A[k01] * w01 + A[k11] * w11;
          lc[o] = col[bandOf(s)]; if (lineOn) ls[o] = s - line;
        }
      } }
      for (let b = 0; b < CELL; b++) { const yy = py0 + b; if (yy >= H) break; for (let a = 0; a < CELL; a++) {
        const xx = px0 + a; if (xx >= W) break;
        const o = b * LN + a, c0a = lc[o], c1 = lc[o + 1], c2 = lc[o + LN], c3 = lc[o + LN + 1];
        let R = ((c0a & 255) + (c1 & 255) + (c2 & 255) + (c3 & 255)) / 4, G = (((c0a >> 8) & 255) + ((c1 >> 8) & 255) + ((c2 >> 8) & 255) + ((c3 >> 8) & 255)) / 4, B = (((c0a >> 16) & 255) + ((c1 >> 16) & 255) + ((c2 >> 16) & 255) + ((c3 >> 16) & 255)) / 4;
        if (lineOn) {
          const s0 = ls[o], s1 = ls[o + 1], s2 = ls[o + LN], s3 = ls[o + LN + 1], m = (s0 + s1 + s2 + s3) / 4, gx = (s1 + s3 - s0 - s2) / 2, gy = (s2 + s3 - s0 - s1) / 2, g = Math.sqrt(gx * gx + gy * gy);
          const dist = g > 1e-6 ? Math.abs(m) / g : 9, cov = dist >= lw / 2 + 0.5 ? 0 : dist <= lw / 2 - 0.5 ? 1 : lw / 2 + 0.5 - dist;
          if (cov > 0) { R += (inkR - R) * cov; G += (inkG - G) * cov; B += (inkB - B) * cov; }
        }
        out[yy * W + xx] = ((255 << 24) | (B << 16) | (G << 8) | (R | 0)) >>> 0;
      } }
    }
    return { rgba: out.buffer };
  }
  return { at, raster };
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
if(q.t==="at"){if(D)postMessage({t:"at",key:q.key,id:q.id,x:q.x,y:q.y,v:E.at(D,q.x,q.y)});return;}
if(!D){postMessage({id:q.id,key:q.key,J:q.J,gone:true});return;}
const r=E.raster(D,q.J);let bitmap=null;try{bitmap=await createImageBitmap(new ImageData(new Uint8ClampedArray(r.rgba),q.J.nx,q.J.ny));}catch(x){}
const moved=bitmap?[bitmap]:[r.rgba];postMessage({id:q.id,key:q.key,J:q.J,bitmap,rgba:bitmap?null:r.rgba},moved);};`;
    SF.wk = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    SF.wk.onmessage = (e) => (e.data.t === "at" ? surfaceHeard(e.data) : surfaceDone(e.data));
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
  // the reading before crossfades away, carried onto this election's plane; another jurisdiction's just goes
  const old = [SF.base, SF.view].filter(Boolean);
  if (SF.old) SF.old.forEach(closeLayer);
  SF.old = null; SF.base = SF.view = null;
  if (old.length && SF.m === m) SF.old = old;
  else if (old.length && SF.m && !reduceMotion && jurOf(SF.m.year) === jurOf(m.year)) {
    const A = frameMap(SF.m, m);
    old.forEach((L) => L.pat.setTransform(new DOMMatrix([A.a * L.J.px, 0, 0, A.a * L.J.px, A.a * L.J.x0 + A.bx, A.a * L.J.y0 + A.by])));
    SF.old = old;
  } else old.forEach(closeLayer);
  SF.key = key; SF.m = m; SF.sent = null; SF.here = null;
  const d = surfaceData(m);
  SF.empty = !d; SF.data = d ? d.D : null; SF.none = d ? d.none : null; SF.ids = d ? d.D.ids || null : null;
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
  const q = Math.min(dpr, 1.5), want = 2 ** (Math.round(2 * Math.log2(1 / (T.k * q))) / 2);
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
  if (!ls.length) return null;
  return { ls, top: ls[ls.length - 1].pat, under: a < 1 || (!SF.old && ls[0].a < 1), none: SF.none };
}
// the field at a spot on the plane: a figure, or who leads there and by how much. It's the one field's
// own value, asked of whoever holds it, so nothing on the screen can touch it
const surfaceWords = (v) => {
  if (!SF.ids) return { v: v[0] };
  const r = [...v].map((x, k) => [SF.ids[k], x]).sort((p, q) => q[1] - p[1]);
  return { fam: r[0][0], lead: 100 * (r[0][1] - Math.max(r[1] ? r[1][1] : 0, 0)) };
};
let askId = 0;
const askWaiting = new Map();
function surfaceAt(x, y) {
  return new Promise((done) => {
    if (!SF.data) { done(null); return; }
    if (!SF.wk) { done(surfaceWords(pageEngine().at(SF.data, x, y))); return; }
    if (SF.sent !== SF.key) { SF.wk.postMessage({ t: "set", key: SF.key, D: SF.data }); SF.sent = SF.key; }
    const id = ++askId; askWaiting.set(id, done);
    SF.wk.postMessage({ t: "at", key: SF.key, id, x, y });
  });
}
function surfaceHeard(q) {
  const done = askWaiting.get(q.id); askWaiting.delete(q.id);
  if (done) done(q.key === SF.key ? surfaceWords(q.v) : null);
}
// the tooltip's reading: the latest answer for the pointer, the next on its way
function surfaceAsk(x, y) {
  if (SF.asking) { SF.askNext = [x, y]; return; }
  SF.asking = true;
  surfaceAt(x, y).then((a) => {
    SF.asking = false; SF.here = a;
    if (SF.askNext) { const [nx, ny] = SF.askNext; SF.askNext = null; surfaceAsk(nx, ny); }
    tipRefresh();
  });
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
  const surf = (d === "surface" ? e : 0) + (from === "surface" && d !== "surface" ? 1 - e : 0), ball = (d === "balloons" ? e : 0) + (from === "balloons" && d !== "balloons" ? 1 - e : 0);
  return { surf, ball, sf: surf > 0 && m.booth.n ? surfaceLook(m, surf) : null };
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
function drawRowHTML(m) {
  const on = S.draw, fits = surfaceFits(m);
  return `<div class="lg-draw" role="group" aria-label="Draw the map as"><span>Drawn as</span>${DRAWS.map(([k, t]) => { const no = k === "surface" && !fits; return `<button type="button" data-draw="${k}" aria-pressed="${on === k && !no}"${no ? ` disabled title="${S.lens === "cls" ? "A seat type belongs to the whole seat, so there is nothing to blend" : "This is a whole seat’s figure, so there is nothing to blend"}"` : ""}>${t}</button>`; }).join("")}</div>`;
}
/* ----- what the balloons and the surface leave out -----
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
  if (d === "seats") return "";
  const est = !m.standIn && placesLackMemo(m);
  if (d === "balloons") return balloonKey(m, est) + undrawnHTML(m, est);
  if (axisNow(m) !== "AC") return `<div class="lg-note">Built from first preferences and ${axisByBonham(m, axisNow(m)) ? "estimated flows" : "Senate ballots"}.</div>${undrawnHTML(m, est)}`;
  const off = S.axis !== "AC" && S.lens === "tpp" && S.tppMode !== "swing" && axisFrame(m) == null;
  return `<div class="lg-note">${off ? "One Nation stood too thinly here for its contests." : est ? "Smoothed, from first preferences: an estimate." : S.lens === "winner" ? "A smoothed estimate. Deeper means a bigger lead." : "A smoothed estimate, not a count."}</div>${undrawnHTML(m, est)}`;
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
