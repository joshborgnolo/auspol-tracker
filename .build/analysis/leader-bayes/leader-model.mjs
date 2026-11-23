/* The leadership model (prototype 2026-11-23, .build/analysis/leader-bayes/).

   WHAT IT ESTIMATES. One line per SERIES – a leader in an office (Hawke as
   prime minister, Peacock's second stint as opposition leader) for a rating,
   or a pairing (Keating v Hewson) for preferred PM – day by day, for the
   average regular pollster. A rating series can carry a SECOND line: the
   same leader's favourability, a different question whose movements are
   correlated with approval's (ρ) and scaled (k). The series of one family
   share their settings; leans are each series' own.

   ONE SERIES
     state  x_t = [m_t (, f_t), z…, g…]
            m    the series' figure for the average regular pollster
            f    (ratings with favourability readings) the average regular
                 favourability pollster's figure
            z    each line's regular houses' leans, sum-to-zero (Helmert)
            g    other houses' leans, prior N(0, WIDE²)
     drift  (m, f) move N(0, Σ) a day, Σ = ω²[[1, ρk],[ρk, k²]]; the same
            shape scaled by J² on an election day inside the series; every
            lean drifts N(0, δ²) a day
     prior  each line starts at its first reading (/ c), sd P0; leans N(0, s²)
     poll   y = c_h·(m or f) + lean_h + e,  e ~ N(0, κ_h·v + τ²)
   Kalman filter: exact posterior and likelihood for fixed settings; settings
   on a grid (pooled likelihood), κ by penalised maximum likelihood; draws by
   forward-filter backward-sample, seeded. */

export const WIDE = { net: 0.15, logit: 0.5 };

/* ------------------------------------------------------------ small linalg */
function helmert(K) {
  const B = Array.from({ length: K }, () => new Float64Array(Math.max(0, K - 1)));
  for (let k = 1; k < K; k++) { const s = 1 / Math.sqrt(k * (k + 1)); for (let j = 0; j < k; j++) B[j][k - 1] = s; B[k][k - 1] = -k * s; }
  return B;
}
function cholFlat(A, N, Lo) {
  for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * N + j];
    for (let k = 0; k < j; k++) s -= Lo[i * N + k] * Lo[j * N + k];
    if (i === j) Lo[i * N + i] = Math.sqrt(Math.max(s, 1e-14)); else Lo[i * N + j] = s / Lo[j * N + j];
  }
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) Lo[i * N + j] = 0;
}
function cholSolveFlat(Lo, B, N, X, tmp) {
  for (let c = 0; c < N; c++) {
    for (let i = 0; i < N; i++) { let s = B[i * N + c]; for (let k = 0; k < i; k++) s -= Lo[i * N + k] * tmp[k]; tmp[i] = s / Lo[i * N + i]; }
    for (let i = N - 1; i >= 0; i--) { let s = tmp[i]; for (let k = i + 1; k < N; k++) s -= Lo[k * N + i] * X[k * N + c]; X[i * N + c] = s / Lo[i * N + i]; }
  }
}
export function makeRng(seed) {
  let s = seed >>> 0, spare = null;
  const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, normal() { if (spare != null) { const v = spare; spare = null; return v; } let a, b, r; do { a = 2 * u() - 1; b = 2 * u() - 1; r = a * a + b * b; } while (r >= 1 || r === 0); const f = Math.sqrt(-2 * Math.log(r) / r); spare = b * f; return a * f; } };
}
export const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
export const quant = (a, q) => { const s = Float64Array.from(a).sort(); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };

/* ------------------------------------------------------------- one series
   obs: [{ t, y, v, house, c?, lv? (0 main line, 1 favourability line) }];
   core: houses that set the main line's zero; core2: the second line's. */
export function makeSeries(id, obs, { core, core2 = new Set(), jumps = new Set(), wide = WIDE.net, p0 = 0.2, outDays = [] }) {
  const o = obs.map((r, i) => ({ ...r, c: r.c ?? 1, lv: r.lv ?? 0, i: r.i ?? i })).sort((a, b) => a.t - b.t || a.i - b.i);
  const Lv = o.some((r) => r.lv === 1) ? 2 : 1;
  const cnt = {}, lvOf = {};
  for (const r of o) { cnt[r.house] = (cnt[r.house] || 0) + 1; lvOf[r.house] = r.lv; }
  const houses = [...new Set(o.map((r) => r.house))];
  const c0 = houses.filter((h) => lvOf[h] === 0 && core.has(h)), c1 = houses.filter((h) => lvOf[h] === 1 && core2.has(h));
  const isCore = (h) => c0.includes(h) || c1.includes(h);
  const lone = new Set(houses.filter((h) => !isCore(h) && cnt[h] === 1));
  const other = houses.filter((h) => !isCore(h) && !lone.has(h));
  const K0 = c0.length, K1 = c1.length;
  const off0 = Lv, off1 = Lv + Math.max(0, K0 - 1), offQ = off1 + Math.max(0, K1 - 1);
  const N = offQ + other.length, B0 = helmert(K0), B1 = helmert(K1);
  const lean = new Map(), coreIdx = new Set();
  c0.forEach((h, j) => { const v = new Float64Array(N); for (let k = 0; k < K0 - 1; k++) { v[off0 + k] = B0[j][k]; coreIdx.add(off0 + k); } lean.set(h, v); });
  c1.forEach((h, j) => { const v = new Float64Array(N); for (let k = 0; k < K1 - 1; k++) { v[off1 + k] = B1[j][k]; coreIdx.add(off1 + k); } lean.set(h, v); });
  other.forEach((h, q) => { const v = new Float64Array(N); v[offQ + q] = 1; lean.set(h, v); });
  for (const h of lone) lean.set(h, new Float64Array(N));
  for (const r of o) { const h = Float64Array.from(lean.get(r.house)); h[r.lv] = r.c; r.h = h; r.lone = lone.has(r.house); }
  const t0 = o.length ? o[0].t : 0, t1 = o.length ? o[o.length - 1].t : 0;
  const first = (lv) => o.find((r) => r.lv === lv);
  const m0 = [first(0) || first(1), first(1)].map((r) => (r ? r.y / r.c : 0));
  return { id, obs: o, houses, core: c0, core2: c1, other, lone, Lv, N, lean, coreIdx, jumps, wide, p0, m0, t0, t1, cnt, lvOf,
    outDays: [...new Set(outDays)].sort((a, b) => a - b) };
}

function eventsOf(S, extra = []) {
  const ev = new Set(S.obs.map((r) => r.t));
  for (const d of S.jumps) if (d > S.t0 && d <= S.t1) ev.add(d);
  for (const d of S.outDays) if (d >= S.t0) ev.add(d);
  for (const d of extra) if (d >= S.t0) ev.add(d);
  return [...ev].sort((a, b) => a - b);
}
/* process noise over a step: q = [m var, m·f cov, f var, lean var] */
function stepQ(S, th, dt, jmp) {
  const k = th.kf ?? 1, rho = th.rho ?? 1, w2 = th.w * th.w * dt + (jmp ? th.J * th.J : 0);
  return [w2, S.Lv === 2 ? rho * k * w2 : 0, S.Lv === 2 ? k * k * w2 : 0, dt * th.d * th.d];
}
function addQ(P, S, q) {
  const N = S.N;
  P[0] += q[0];
  if (S.Lv === 2) { P[1] += q[1]; P[N] += q[1]; P[N + 1] += q[2]; }
  for (let i = S.Lv; i < N; i++) P[i * N + i] += q[3];
}

export function runFilter(S, th, kappa, opts = {}) {
  const { N } = S, NN = N * N;
  const events = opts.events || eventsOf(S);
  const x = new Float64Array(N), P = new Float64Array(NN);
  for (let l = 0; l < S.Lv; l++) { x[l] = S.m0[l]; P[l * N + l] = S.p0 * S.p0; }
  for (let i = S.Lv; i < N; i++) P[i * N + i] = (S.coreIdx.has(i) ? th.s : S.wide) ** 2;
  const tau2 = th.tau * th.tau, wide2 = S.wide * S.wide;
  const store = !!opts.store;
  const xs = store ? new Float64Array(events.length * N) : null, Ps = store ? new Float64Array(events.length * NN) : null, qs = store ? new Float64Array(events.length * 4) : null;
  const pred = opts.pred ? new Map() : null;
  const Ph = new Float64Array(N);
  let ll = 0, prev = null, oi = 0;
  const obs = S.obs;
  for (let ev = 0; ev < events.length; ev++) {
    const t = events[ev];
    let q = [0, 0, 0, 0];
    if (prev != null) {
      let jmp = false; for (const jd of S.jumps) if (jd > prev && jd <= t) jmp = true;
      q = stepQ(S, th, t - prev, jmp); addQ(P, S, q);
    }
    while (oi < obs.length && obs[oi].t === t) {
      const o = obs[oi++], h = o.h;
      let Sv = o.v * (kappa.get(o.house) ?? 1) + tau2 + (o.lone ? wide2 : 0), mu = 0;
      for (let i = 0; i < N; i++) { let s = 0; const r = i * N; for (let j = 0; j < N; j++) s += P[r + j] * h[j]; Ph[i] = s; }
      for (let i = 0; i < N; i++) { Sv += h[i] * Ph[i]; mu += h[i] * x[i]; }
      if (pred) pred.set(o.i, { mu, S: Sv, level: x[o.lv], levelV: P[o.lv * N + o.lv] });
      const v = o.y - mu;
      ll += -0.5 * (Math.log(2 * Math.PI * Sv) + (v * v) / Sv);
      for (let i = 0; i < N; i++) x[i] += (Ph[i] / Sv) * v;
      for (let i = 0; i < N; i++) { const a = Ph[i] / Sv, r = i * N; for (let j = 0; j < N; j++) P[r + j] -= a * Ph[j]; }
    }
    if (store) { xs.set(x, ev * N); Ps.set(P, ev * NN); qs.set(q, ev * 4); }
    prev = t;
  }
  return { ll, events, xs, Ps, qs, pred, x: Float64Array.from(x), P: Float64Array.from(P) };
}
const qAt = (f, k) => f.qs.subarray(k * 4, k * 4 + 4);

export function smooth(f, S) {
  const N = S.N, E = f.events.length, NN = N * N;
  const xs = new Float64Array(E * N), Ps = new Float64Array(E * NN), G = new Float64Array(E * NN);
  xs.set(f.xs.subarray((E - 1) * N, E * N), (E - 1) * N); Ps.set(f.Ps.subarray((E - 1) * NN, E * NN), (E - 1) * NN);
  const Pp = new Float64Array(NN), Lc = new Float64Array(NN), X = new Float64Array(NN), tmp = new Float64Array(N), T = new Float64Array(NN);
  for (let k = E - 2; k >= 0; k--) {
    const Pf = f.Ps.subarray(k * NN, (k + 1) * NN);
    Pp.set(Pf); addQ(Pp, S, qAt(f, k + 1));
    cholFlat(Pp, N, Lc); cholSolveFlat(Lc, Pf, N, X, tmp);
    const o = k * NN;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) G[o + i * N + j] = X[j * N + i];
    const xf = f.xs.subarray(k * N, (k + 1) * N), xn = xs.subarray((k + 1) * N, (k + 2) * N);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += G[o + i * N + j] * (xn[j] - xf[j]); xs[k * N + i] = xf[i] + s; }
    const Pn = Ps.subarray((k + 1) * NN, (k + 2) * NN);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += G[o + i * N + l] * (Pn[l * N + j] - Pp[l * N + j]); T[i * N + j] = s; }
    for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) { let s = 0; for (let l = 0; l < N; l++) s += T[i * N + l] * G[o + j * N + l]; const v = Pf[i * N + j] + s; Ps[o + i * N + j] = v; Ps[o + j * N + i] = v; }
  }
  return { xs, Ps, G, E, N };
}

export function ffbs(f, S, nDraw, keep, rng, rec) {
  const N = S.N, E = f.events.length, NN = N * N;
  const Gf = new Float64Array(E * NN), Cf = new Float64Array(E * NN);
  const Pp = new Float64Array(NN), Lc = new Float64Array(NN), X = new Float64Array(NN), cov = new Float64Array(NN), Lv = new Float64Array(NN), tmp = new Float64Array(N);
  for (let k = 0; k < E - 1; k++) {
    const Pf = f.Ps.subarray(k * NN, (k + 1) * NN);
    Pp.set(Pf); addQ(Pp, S, qAt(f, k + 1));
    cholFlat(Pp, N, Lc); cholSolveFlat(Lc, Pf, N, X, tmp);
    const o = k * NN;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) Gf[o + i * N + j] = X[j * N + i];
    for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) { let s = 0; for (let m = 0; m < N; m++) s += Gf[o + i * N + m] * Pf[m * N + j]; const v = Pf[i * N + j] - s; cov[i * N + j] = v; cov[j * N + i] = v; }
    cholFlat(cov, N, Lv); Cf.set(Lv, o);
  }
  const Cl = new Float64Array(NN); cholFlat(f.Ps.subarray((E - 1) * NN, E * NN), N, Cl);
  const z = new Float64Array(N), cur = new Float64Array(N), nxt = new Float64Array(N), dif = new Float64Array(N);
  for (let d = 0; d < nDraw; d++) {
    for (let i = 0; i < N; i++) z[i] = rng.normal();
    for (let i = 0; i < N; i++) { let s = f.xs[(E - 1) * N + i]; for (let j = 0; j <= i; j++) s += Cl[i * N + j] * z[j]; nxt[i] = s; }
    if (keep.has(E - 1)) rec(d, E - 1, nxt);
    for (let k = E - 2; k >= 0; k--) {
      const xo = k * N, o = k * NN;
      for (let i = 0; i < N; i++) { z[i] = rng.normal(); dif[i] = nxt[i] - f.xs[xo + i]; }
      for (let i = 0; i < N; i++) { let s = f.xs[xo + i]; const gi = o + i * N; for (let j = 0; j < N; j++) s += Gf[gi + j] * dif[j]; for (let j = 0; j <= i; j++) s += Cf[gi + j] * z[j]; cur[i] = s; }
      if (keep.has(k)) rec(d, k, cur);
      nxt.set(cur);
    }
  }
}

/* -------------------------------------------------------------- the grid */
export function* gridPoints(g, fixed = {}) {
  const keys = Object.keys(g);
  const rec = function* (i, acc) { if (i === keys.length) { yield { ...fixed, ...acc }; return; } for (const v of g[keys[i]]) yield* rec(i + 1, { ...acc, [keys[i]]: v }); };
  yield* rec(0, {});
}
const KAPPA_GRID = [0.35, 0.5, 0.7, 1, 1.41, 2, 2.83, 4], KAPPA_PRIOR_SD = 0.5;
export function familyLL(series, th, kappa) { let ll = 0; for (const S of series) if (S.obs.length) ll += runFilter(S, th, kappa).ll; return ll; }
export function estimateKappa(series, th, kappa0 = null) {
  const houses = [...new Set(series.flatMap((S) => S.obs.filter((o) => !o.lone).map((o) => o.house)))];
  const kappa = kappa0 ? new Map(kappa0) : new Map(houses.map((h) => [h, 1]));
  const byHouse = new Map(houses.map((h) => [h, series.filter((S) => S.cnt[h] && !S.lone.has(h))]));
  for (let sweep = 0; sweep < 2; sweep++) for (const h of houses) {
    const ss = byHouse.get(h);
    let best = kappa.get(h) ?? 1, bv = -Infinity;
    for (const k of KAPPA_GRID) { kappa.set(h, k); const v = familyLL(ss, th, kappa) - Math.log(k) ** 2 / (2 * KAPPA_PRIOR_SD ** 2); if (v > bv) { bv = v; best = k; } }
    kappa.set(h, best);
  }
  return kappa;
}
function weigh(rows) {
  const mx = Math.max(...rows.map((r) => r.ll));
  let z = 0; for (const r of rows) { r.w = Math.exp(r.ll - mx); z += r.w; }
  for (const r of rows) r.w /= z;
  return rows.sort((a, b) => b.w - a.w);
}
function allocate(rows, n) {
  const keep = rows.filter((r) => r.w * n >= 0.5), tot = keep.reduce((a, r) => a + r.w, 0);
  const al = keep.map((r) => ({ r, n: Math.floor((r.w / tot) * n), rem: ((r.w / tot) * n) % 1 }));
  let left = n - al.reduce((a, x) => a + x.n, 0);
  for (const a of [...al].sort((p, q) => q.rem - p.rem)) { if (left <= 0) break; a.n++; left--; }
  return al.filter((a) => a.n > 0);
}
function edgesOf(rows, grid) {
  const edges = [];
  for (const k of Object.keys(grid)) {
    const vs = grid[k], wOf = (v) => rows.filter((r) => r.th[k] === v).reduce((a, r) => a + r.w, 0);
    if (vs.length > 1 && wOf(vs[0]) > 0.5 && vs[0] !== 0) edges.push(k + " low"); if (vs.length > 1 && wOf(vs[vs.length - 1]) > 0.5) edges.push(k + " high");
  }
  return edges;
}
/* settings for a family: grid → κ at the best point → grid again. grid2
   (optional): the second line's settings (kf, ρ), searched with the first
   grid's settings held at each point of its own top rows. */
export function fitSettings(series, grid, { kappa0 = null, fixedKappa = null, grid2 = null } = {}) {
  const two = series.filter((S) => S.Lv === 2);
  const g2 = grid2 && two.length ? grid2 : null;
  const base = g2 ? { kf: g2.kf[Math.floor(g2.kf.length / 2)], rho: g2.rho[Math.floor(g2.rho.length / 2)] } : {};
  const run = (kappa, fixed) => weigh([...gridPoints(grid, fixed)].map((th) => ({ th, ll: familyLL(series, th, kappa) })));
  let kappa = fixedKappa || kappa0 || new Map();
  let rows = run(kappa, base);
  if (!fixedKappa) { kappa = estimateKappa(series, rows[0].th, kappa0); rows = run(kappa, base); }
  let rows2 = null;
  if (g2) {
    /* (kf, ρ) touch only the two-line series: their likelihood on the
       second grid, at each of the first grid's top settings */
    const one = series.filter((S) => S.Lv === 1);
    const top = rows.slice(0, Math.max(1, rows.findIndex((r, i) => rows.slice(0, i + 1).reduce((a, q) => a + q.w, 0) > 0.99) + 1));
    const all = [];
    for (const r of top) {
      const ll1 = familyLL(one, r.th, kappa);
      for (const th2 of gridPoints(g2)) { const th = { ...r.th, ...th2 }; all.push({ th, ll: ll1 + familyLL(two, th, kappa) }); }
    }
    rows = weigh(all);
    rows2 = rows;
  }
  return { rows, kappa, edges: [...edgesOf(rows, grid), ...(g2 ? edgesOf(rows, g2) : [])], best: rows[0].th };
}

/* draws of each series' line(s) at its output days, and its houses' leans at the last day */
export function drawSeries(S, settings, { nDraw = 1000, seed = 1, keepDays = null } = {}) {
  const events = eventsOf(S, keepDays || []);
  const evIdx = new Map(events.map((d, i) => [d, i]));
  const days = (keepDays || S.outDays).filter((d) => evIdx.has(d));
  const keep = new Map(); days.forEach((d) => { const i = evIdx.get(d); if (!keep.has(i)) keep.set(i, keep.size); });
  const lastI = events.length - 1; if (!keep.has(lastI)) keep.set(lastI, keep.size);
  const Sn = keep.size, N = S.N;
  const level = [new Float64Array(nDraw * Sn), S.Lv === 2 ? new Float64Array(nDraw * Sn) : null];
  const leans = new Map([...S.lean.keys()].filter((h) => !S.lone.has(h)).map((h) => [h, new Float64Array(nDraw)]));
  const rng = makeRng(seed);
  let di = 0;
  for (const { r, n } of allocate(settings.rows, nDraw)) {
    const f = runFilter(S, r.th, settings.kappa, { store: true, events });
    const lastSlot = keep.get(lastI);
    ffbs(f, S, n, keep, rng, (d, k, x) => {
      const s = keep.get(k);
      level[0][(di + d) * Sn + s] = x[0];
      if (level[1]) level[1][(di + d) * Sn + s] = x[1];
      if (s === lastSlot) for (const [h, a] of leans) { const lr = S.lean.get(h); let v = 0; for (let i = S.Lv; i < N; i++) v += lr[i] * x[i]; a[di + d] = v; }
    });
    di += n;
  }
  const slotOf = new Map(); for (const d of [...days, events[lastI]]) slotOf.set(d, keep.get(evIdx.get(d)));
  const at = (d, lv = 0) => { const s = slotOf.get(d); if (s == null || !level[lv]) return null; const o = new Float64Array(nDraw); for (let i = 0; i < nDraw; i++) o[i] = level[lv][i * Sn + s]; return o; };
  return { at, leans, days, lastDay: events[lastI], nDraw };
}

/* one-step-ahead predictions of every reading at the given settings (the backtest) */
export function predictAll(series, th, kappa) {
  const out = [];
  for (const S of series) {
    if (!S.obs.length) continue;
    const f = runFilter(S, th, kappa, { pred: true });
    for (const o of S.obs) { const p = f.pred.get(o.i); out.push({ series: S.id, house: o.house, t: o.t, y: o.y, c: o.c, lv: o.lv, mu: p.mu, S: p.S, raw: o.raw, i: o.i, lone: o.lone }); }
  }
  return out;
}
