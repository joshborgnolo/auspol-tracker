/* The national-direction model (2026-11-22; prototype, backtest and review in
   .build/analysis/direction-bayes/). gen-data §5 calls fitDirection.

   WHAT IT ESTIMATES, day by day since 2007, about Australians:
     balance    β_t = log(right / wrong)          every pollster informs it
     undecided  u_t = logit(unsure share)         pollsters that offer "unsure"
   and from them the printed shares: right = (1 − U)·σ(β), wrong the rest.
   Sampling errors on the two scales are uncorrelated (to first order under
   multinomial sampling), so each is its own linear-Gaussian model.

   ONE SCALE
     state  x_t = [m_t, z_1..z_{K-1}, g_1..g_Q]
            m_t  the national figure on this scale
            z    the K zero-setting houses' leans in a sum-to-zero (Helmert)
                 basis, so their leans average exactly zero at every date:
                 the level is "the average pollster asking the standard
                 question, each counting once" (user decision 2026-11-22)
            g    the other houses' leans: a satisfaction question (Lowy,
                 McKinnon) or an earlier method of a house (Roy Morgan's
                 face-to-face and multi-mode eras), each prior N(0, WIDE²)
     drift  m_t = m_{t−1} + N(0, ω²) a day, + N(0, J²) on a federal election
            or a change of prime minister; every lean drifts N(0, δ²) a day
     prior  zero-setting leans N(0, σ²); m_0 N(first reading, 1)
     poll   y_i = m + lean_house + e,  e ~ N(0, κ_house·v_i + τ²)
            v_i the reading's sampling variance on this scale at the site's
            design effect (1.6 on its n rule), κ that house's measured noise.
   For fixed (ω, δ, σ, τ, J) the Kalman filter gives the exact posterior and
   the exact marginal likelihood. The five settings are integrated over a
   grid, each point weighted by prior × likelihood; κ is measured by penalised
   maximum likelihood (prior log κ ~ N(0, 0.5²)) at the best point. Printed
   figures are summaries of forward-filter backward-sample draws, allocated to
   grid points by weight, seeded – every build of the same data prints the
   same figures.

   Backtest (2008–2026, predicting each poll before it was published, against
   the previous recipe copied verbatim): closer in every era but one (37
   Morgan polls 2016–22, within chance), 95% bands covering 96% of polls
   against 84%; fake-data coverage 90–96%; priors move the headline ≤0.1. */

export const DEFF = 1.6;
const LOGIT = (p) => Math.log(p / (1 - p));
const logistic = (z) => 1 / (1 + Math.exp(-z));

/* ------------------------------------------------------------ the houses */
/* how each house asks: "u" the standard question with an unsure option, "f"
   the standard question forced to two answers, "q" a satisfaction question */
export const FORMAT = {
  "Roy Morgan": "u", "Essential": "u", "Spectre Strategy": "u", "RedBridge/Accent": "u", "Freshwater": "u",
  "SEC Newgate": "f", "Ipsos": "f",
  "Lowy Institute": "q", "McKinnon": "q",
};
/* Roy Morgan's method eras, as direction-history.json's `method` field
   records them: face-to-face to March 2020, multi-mode April 2020 – May 2022,
   online since August 2022. For lean and noise each era is its own house;
   the earlier two are placed on today's scale through the houses that polled
   across the change (Ipsos throughout). Log evidence 501.0 v 496.1 for one
   Morgan whose lean drifts. */
export const MORGAN_ERAS = [["2020-03-31", "Roy Morgan (face-to-face, to 2020)"], ["2022-07-31", "Roy Morgan (multi-mode, 2020–22)"]];
export const leanHouse = (r) => {
  if (r.house !== "Roy Morgan") return r.house;
  for (const [to, name] of MORGAN_ERAS) if (r.end <= to) return name;
  return "Roy Morgan";
};
export const isCore = (r, scale) => (r.fmt === "u" || (scale === "balance" && r.fmt === "f")) && leanHouse(r) === r.house;
const WIDE_SD = 0.5;

/* -------------------------------------------------------------- readings */
export function scaleObs(readings, scale) {
  const out = [];
  readings.forEach((r, idx) => {
    if (scale === "balance") {
      const R = r.R / 100, W = r.W / 100;
      out.push({ t: r.mid, y: Math.log(R / W), v: DEFF * (1 / R + 1 / W) / r.n, house: leanHouse(r), idx });
    } else if (r.U != null && r.U >= 0.5) {
      const U = r.U / 100;
      out.push({ t: r.mid, y: LOGIT(U), v: DEFF / (r.n * U * (1 - U)), house: leanHouse(r), idx });
    }
  });
  return out.sort((a, b) => a.t - b.t || a.idx - b.idx);
}

/* -------------------------------------------------------- linear algebra */
const zeros = (n) => Array.from({ length: n }, () => new Float64Array(n));
function chol(A) {
  const n = A.length, L = zeros(n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-14)); else L[i][j] = s / L[j][j];
  }
  return L;
}
function inv(A) {
  const n = A.length, M = A.map((r, i) => { const o = new Float64Array(2 * n); o.set(r); o[n + i] = 1; return o; });
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r) => r.slice(n));
}
const mul = (A, B) => {
  const n = A.length, m = B[0].length, k = B.length, C = Array.from({ length: n }, () => new Float64Array(m));
  for (let i = 0; i < n; i++) for (let l = 0; l < k; l++) { const a = A[i][l]; if (a) for (let j = 0; j < m; j++) C[i][j] += a * B[l][j]; }
  return C;
};
const Tr = (A) => Array.from({ length: A[0].length }, (_, j) => Float64Array.from(A, (r) => r[j]));
function helmert(K) {
  const B = Array.from({ length: K }, () => new Float64Array(Math.max(0, K - 1)));
  for (let k = 1; k < K; k++) { const s = 1 / Math.sqrt(k * (k + 1)); for (let j = 0; j < k; j++) B[j][k - 1] = s; B[k][k - 1] = -k * s; }
  return B;
}

/* flat (row-major) Cholesky and solve for the sampler's per-step setup:
   no allocation inside the loops */
function cholFlat(A, N, Lo) {                       // A symmetric → Lo lower (A untouched)
  for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * N + j];
    for (let k = 0; k < j; k++) s -= Lo[i * N + k] * Lo[j * N + k];
    if (i === j) Lo[i * N + i] = Math.sqrt(Math.max(s, 1e-14)); else Lo[i * N + j] = s / Lo[j * N + j];
  }
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) Lo[i * N + j] = 0;
}
function cholSolveFlat(Lo, B, N, X, tmp) {          // (Lo Loᵀ) X = B, N right-hand sides
  for (let c = 0; c < N; c++) {
    for (let i = 0; i < N; i++) { let s = B[i * N + c]; for (let k = 0; k < i; k++) s -= Lo[i * N + k] * tmp[k]; tmp[i] = s / Lo[i * N + i]; }
    for (let i = N - 1; i >= 0; i--) { let s = tmp[i]; for (let k = i + 1; k < N; k++) s -= Lo[k * N + i] * X[k * N + c]; X[i * N + c] = s / Lo[i * N + i]; }
  }
}

/* ------------------------------------------------------------ the layout */
function makeLayout(obs, coreSet) {
  const houses = [...new Set(obs.map((o) => o.house))];
  const core = houses.filter((h) => coreSet.has(h)), other = houses.filter((h) => !coreSet.has(h));
  const K = core.length, Q = other.length, N = 1 + Math.max(0, K - 1) + Q, B = helmert(K);
  const row = new Map();
  core.forEach((h, j) => { const v = new Float64Array(N); v[0] = 1; for (let k = 0; k < K - 1; k++) v[1 + k] = B[j][k]; row.set(h, v); });
  other.forEach((h, q) => { const v = new Float64Array(N); v[0] = 1; v[K + q] = 1; row.set(h, v); });
  const leanRow = new Map([...row].map(([h, v]) => { const w = Float64Array.from(v); w[0] = 0; return [h, w]; }));
  return { houses, core, other, K, N, row, leanRow };
}

/* ------------------------------------------------------------ the filter */
function runFilter(obs, L, events, th, opts) {
  const { N, K } = L;
  const x = new Float64Array(N); x[0] = opts.m0;
  const P = zeros(N); P[0][0] = 1;
  for (let i = 1; i < N; i++) P[i][i] = (i < K ? th.s : WIDE_SD) ** 2;
  const q0 = th.w * th.w, qd = th.d * th.d, tau2 = th.tau * th.tau, J2 = th.J * th.J;
  const store = !!opts.store, xs = [], qs = [], Ph = new Float64Array(N), NN = N * N;
  const PsF = store ? new Float64Array(events.length * NN) : null;
  let ll = 0, prev = null, oi = 0;
  for (const t of events) {
    let qm = 0, ql = 0;
    if (prev != null) { const k = t - prev; qm = k * q0 + (opts.jumps.has(t) ? J2 : 0); ql = k * qd; P[0][0] += qm; for (let i = 1; i < N; i++) P[i][i] += ql; }
    while (oi < obs.length && obs[oi].t === t) {
      const o = obs[oi++], h = L.row.get(o.house);
      let S = o.v * (opts.kappa?.get(o.house) ?? 1) + tau2, pred = 0;
      for (let i = 0; i < N; i++) { let s = 0; const Pi = P[i]; for (let j = 0; j < N; j++) s += Pi[j] * h[j]; Ph[i] = s; }
      for (let i = 0; i < N; i++) { S += h[i] * Ph[i]; pred += h[i] * x[i]; }
      const v = o.y - pred;
      ll += -0.5 * (Math.log(2 * Math.PI * S) + (v * v) / S);
      for (let i = 0; i < N; i++) x[i] += (Ph[i] / S) * v;
      for (let i = 0; i < N; i++) { const Pi = P[i], a = Ph[i] / S; for (let j = 0; j < N; j++) Pi[j] -= a * Ph[j]; }
    }
    if (store) {
      const o = xs.length * NN;
      for (let i = 0; i < N; i++) PsF.set(P[i], o + i * N);
      xs.push(Float64Array.from(x)); qs.push([qm, ql]);
    }
    prev = t;
  }
  /* Ps[k] as nested rows, built on demand (the smoother reads it at one grid point) */
  const Ps = store ? new Proxy([], { get: (_, k) => k === "length" ? xs.length
    : (typeof k === "string" && /^\d+$/.test(k)) ? Array.from({ length: N }, (__, i) => PsF.slice(+k * NN + i * N, +k * NN + i * N + N)) : undefined }) : null;
  return { ll, xs, Ps, PsF, qs };
}
const predicted = (f, k, N) => { const Pp = f.Ps[k].map((r) => Float64Array.from(r)); const [qm, ql] = f.qs[k + 1]; Pp[0][0] += qm; for (let i = 1; i < N; i++) Pp[i][i] += ql; return Pp; };

/* RTS smoother with each step's gain (for cross-covariances) */
function smooth(f, N) {
  const L = f.xs.length, xs = new Array(L), Ps = new Array(L), G = new Array(L);
  xs[L - 1] = f.xs[L - 1]; Ps[L - 1] = f.Ps[L - 1];
  for (let k = L - 2; k >= 0; k--) {
    const Pp = predicted(f, k, N), Gk = mul(f.Ps[k], inv(Pp));
    const dx = xs[k + 1].map((v, i) => v - f.xs[k][i]), xk = Float64Array.from(f.xs[k]);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += Gk[i][j] * dx[j]; xk[i] += s; }
    const dP = Ps[k + 1].map((r, i) => r.map((v, j) => v - Pp[i][j]));
    const add = mul(mul(Gk, dP), Tr(Gk));
    xs[k] = xk; Ps[k] = f.Ps[k].map((r, i) => r.map((v, j) => v + add[i][j])); G[k] = Gk;
  }
  return { xs, Ps, G };
}

/* forward-filter backward-sample: nDraw joint paths; rec(d, k, x) is called
   with each draw's state at every event k that `keep` holds */
function ffbs(f, N, nDraw, keep, rng, rec) {
  const L = f.xs.length, NN = N * N;
  /* each step's gain G_k = Pf Pp⁻¹ and the Cholesky of Pf − G_k Pf, flat */
  const Gf = new Float64Array(L * NN), Cf = new Float64Array(L * NN), Xf = new Float64Array(L * N);
  for (let k = 0; k < L; k++) Xf.set(f.xs[k], k * N);
  const Pf = new Float64Array(NN), Pp = new Float64Array(NN), Lc = new Float64Array(NN), X = new Float64Array(NN), cov = new Float64Array(NN), Lv = new Float64Array(NN), tmp = new Float64Array(N);
  for (let k = 0; k < L - 1; k++) {
    Pf.set(f.PsF.subarray(k * NN, (k + 1) * NN));
    Pp.set(Pf);
    const [qm, ql] = f.qs[k + 1];
    Pp[0] += qm; for (let i = 1; i < N; i++) Pp[i * N + i] += ql;
    cholFlat(Pp, N, Lc);
    cholSolveFlat(Lc, Pf, N, X, tmp);                 // X = Pp⁻¹ Pf, so G = Xᵀ
    const o = k * NN;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) Gf[o + i * N + j] = X[j * N + i];
    for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let m = 0; m < N; m++) s += Gf[o + i * N + m] * Pf[m * N + j];
      const v = Pf[i * N + j] - s;
      cov[i * N + j] = v; cov[j * N + i] = v;
    }
    cholFlat(cov, N, Lv);
    Cf.set(Lv, o);
  }
  const Cl = chol(f.Ps[L - 1]), z = new Float64Array(N), cur = new Float64Array(N), nxt = new Float64Array(N), dif = new Float64Array(N);
  for (let d = 0; d < nDraw; d++) {
    for (let i = 0; i < N; i++) z[i] = rng.normal();
    for (let i = 0; i < N; i++) { let s = Xf[(L - 1) * N + i]; for (let j = 0; j <= i; j++) s += Cl[i][j] * z[j]; nxt[i] = s; }
    if (keep.has(L - 1)) rec(d, L - 1, nxt);
    for (let k = L - 2; k >= 0; k--) {
      const xo = k * N, o = k * NN;
      for (let i = 0; i < N; i++) { z[i] = rng.normal(); dif[i] = nxt[i] - Xf[xo + i]; }
      for (let i = 0; i < N; i++) {
        let s = Xf[xo + i];
        const gi = o + i * N;
        for (let j = 0; j < N; j++) s += Gf[gi + j] * dif[j];
        for (let j = 0; j <= i; j++) s += Cf[gi + j] * z[j];
        cur[i] = s;
      }
      if (keep.has(k)) rec(d, k, cur);
      nxt.set(cur);
    }
  }
}

/* -------------------------------------------------------------- the grid */
/* Each scale's grid spans its posterior on the full 26,880-point grid of the
   prototype with room either side (balance: ω ≈ 0.020–0.0225, δ ≈ 0.004–0.006,
   τ ≈ 0–0.04, J ≈ 0.3–0.5; undecided: ω ≈ 0.0065–0.009, τ ≈ 0.1). gen-data
   logs any setting whose weight sits on a grid edge. */
export const GRIDS = {
  balance:   { w: [0.0125, 0.0175, 0.0225, 0.03], d: [0.002, 0.004, 0.006, 0.009], s: [0.025, 0.1, 0.4], tau: [0, 0.02, 0.04, 0.08], J: [0.15, 0.3, 0.6] },
  undecided: { w: [0.0045, 0.0065, 0.009, 0.0125], d: [0.001, 0.002, 0.004], s: [0.025, 0.1, 0.4], tau: [0.06, 0.08, 0.1, 0.12, 0.15], J: [0.05, 0.15, 0.3] },
};
function* gridPoints(g) { for (const w of g.w) for (const d of g.d) for (const s of g.s) for (const tau of g.tau) for (const J of g.J) yield { w, d, s, tau, J }; }
const KAPPA_GRID = [0.35, 0.5, 0.7, 1, 1.41, 2, 2.83], KAPPA_PRIOR_SD = 0.5;
function estimateKappa(obs, L, events, opts, th) {
  const houses = [...new Set(obs.map((o) => o.house))], kappa = new Map(houses.map((h) => [h, 1]));
  const obj = () => runFilter(obs, L, events, th, { ...opts, kappa }).ll + houses.reduce((a, h) => a - Math.log(kappa.get(h)) ** 2 / (2 * KAPPA_PRIOR_SD ** 2), 0);
  for (let sweep = 0; sweep < 2; sweep++) for (const h of houses) {
    let best = kappa.get(h), bv = -Infinity;
    for (const k of KAPPA_GRID) { kappa.set(h, k); const v = obj(); if (v > bv) { bv = v; best = k; } }
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
export function makeRng(seed) {
  let s = seed >>> 0, spare = null;
  const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, normal() { if (spare != null) { const v = spare; spare = null; return v; } let a, b, r; do { a = 2 * u() - 1; b = 2 * u() - 1; r = a * a + b * b; } while (r >= 1 || r === 0); const f = Math.sqrt(-2 * Math.log(r) / r); spare = b * f; return a * f; } };
}

/* --------------------------------------------------------- one scale, fit
   days: output days (day numbers ≤ t1); track: houses whose lean is kept at
   every output day in each draw. Returns draws of m (and tracked leans) at
   every output day, each house's lean at t1 per draw, and at the best grid
   point the leave-one-out quantities for every reading. */
function fitScale(readings, scale, { t1, days, smoothDays = [], jumps, nDraw, seed, track = [] }) {
  const obs = scaleObs(readings, scale);
  if (!obs.length) return null;
  const coreSet = new Set(readings.filter((r) => isCore(r, scale)).map((r) => leanHouse(r)));
  const L = makeLayout(obs, coreSet);
  const t0 = obs[0].t;
  const outDays = [...new Set(days.filter((d) => d >= t0 && d <= t1))];
  const fitEvents = [...new Set([...obs.map((o) => o.t), ...[...jumps].filter((d) => d > t0 && d <= t1)])].sort((a, b) => a - b);
  const events = [...new Set([...fitEvents, ...outDays, ...smoothDays.filter((d) => d >= t0 && d <= t1), t1])].sort((a, b) => a - b);
  const base = { m0: obs[0].y, jumps };
  const grid = GRIDS[scale];
  const run = (opts) => weigh([...gridPoints(grid)].map((th) => ({ th, ll: runFilter(obs, L, fitEvents, th, opts).ll })));
  const T = [Date.now()], tick = () => T.push(Date.now());
  let rows = run(base); tick();
  const kappa = estimateKappa(obs, L, fitEvents, base, rows[0].th); tick();
  rows = run({ ...base, kappa }); tick();
  const opts = { ...base, kappa };
  /* edges: a setting whose weight piles onto the first or last grid value */
  const edges = [];
  for (const k of Object.keys(grid)) {
    const vs = grid[k], wOf = (v) => rows.filter((r) => r.th[k] === v).reduce((a, r) => a + r.w, 0);
    if (wOf(vs[0]) > 0.5 && vs[0] !== 0) edges.push(k + " low"); if (wOf(vs[vs.length - 1]) > 0.5) edges.push(k + " high");
  }
  /* draws */
  const evIdx = new Map(events.map((d, i) => [d, i])), keep = new Map();
  outDays.forEach((d) => { const i = evIdx.get(d); if (!keep.has(i)) keep.set(i, keep.size); });
  if (!keep.has(events.length - 1)) keep.set(events.length - 1, keep.size);
  const slotOfDay = new Map([...outDays, t1].map((d) => [d, keep.get(evIdx.get(d))]));
  const lastSlot = keep.get(events.length - 1), S = keep.size, N = L.N;
  const trackRows = track.filter((h) => L.leanRow.has(h)).map((h) => [h, L.leanRow.get(h)]);
  const rng = makeRng(seed), draws = [], alloc = allocate(rows, nDraw);
  if (process.env.DIR_PROFILE) console.log(`direction ${scale}: ${alloc.length} grid points drawn from; top weights ${rows.slice(0, 5).map((r) => r.w.toFixed(3)).join(" ")}; mass in points with ≥20 draws ${alloc.filter((a) => a.n >= 20).reduce((t, a) => t + a.r.w, 0).toFixed(3)}`);
  for (const { r, n } of alloc) {
    const f = runFilter(obs, L, events, r.th, { ...opts, store: true });
    const batch = Array.from({ length: n }, () => ({ m: new Float64Array(S), tr: Object.fromEntries(trackRows.map(([h]) => [h, new Float64Array(S)])), leans: {} }));
    ffbs(f, N, n, keep, rng, (d, k, x) => {
      const s = keep.get(k), b = batch[d];
      b.m[s] = x[0];
      for (const [h, lr] of trackRows) { let v = 0; for (let i = 0; i < N; i++) v += lr[i] * x[i]; b.tr[h][s] = v; }
      if (s === lastSlot) for (const h of L.houses) { const lr = L.leanRow.get(h); let v = 0; for (let i = 0; i < N; i++) v += lr[i] * x[i]; b.leans[h] = v; }
    });
    draws.push(...batch);
  }
  tick();
  /* leave-one-out at the best grid point. With every reading in, the
     smoothed state at reading i's day is N(x, P); dropping reading i (the
     only term of the posterior that involves it) is a rank-one downdate:
       x₋ᵢ = x + P hᵀ (h x − yᵢ) / (Rᵢ − h P hᵀ),
     and its effect on today's state runs through the smoother's
     cross-covariance Cov(x_k, x_today) = G_k G_{k+1} … P_today. */
  const best = rows[0].th, f = runFilter(obs, L, events, best, { ...opts, store: true }), sm = smooth(f, N);
  const covToEnd = new Array(events.length);
  covToEnd[events.length - 1] = sm.Ps[events.length - 1];
  for (let k = events.length - 2; k >= 0; k--) covToEnd[k] = mul(sm.G[k], covToEnd[k + 1]);
  const loo = new Map();
  for (const o of obs) {
    const k = evIdx.get(o.t), h = L.row.get(o.house), x = sm.xs[k], P = sm.Ps[k];
    const Ri = o.v * (kappa.get(o.house) ?? 1) + best.tau * best.tau;
    const Ph = P.map((row) => row.reduce((a, v, j) => a + v * h[j], 0));
    const hPh = Ph.reduce((a, v, i) => a + v * h[i], 0), hx = x.reduce((a, v, i) => a + v * h[i], 0);
    const c = (hx - o.y) / Math.max(1e-9, Ri - hPh);
    const xLoo = x.map((v, i) => v + Ph[i] * c);
    const C = covToEnd[k], dEnd = new Float64Array(N);       // Cov(x_today, x_k) hᵀ · c
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += C[j][i] * h[j]; dEnd[i] = s * c; }
    loo.set(o.idx, { k, xLoo, dEnd });
  }
  const at = (d) => sm.xs[evIdx.get(d)];
  tick();
  if (process.env.DIR_PROFILE) console.log(`direction ${scale}: grid ${T[1] - T[0]}ms, κ ${T[2] - T[1]}ms, refit ${T[3] - T[2]}ms, draws ${T[4] - T[3]}ms, leave-one-out ${T[5] - T[4]}ms; events ${events.length}, fit events ${fitEvents.length}, N ${N}`);
  return { L, kappa, rows, edges, draws, slotOfDay, best, smoothAt: at, smoothEnd: sm.xs[events.length - 1], loo, events, evIdx, sm };
}

/* ---------------------------------------------------------------- the fit
   readings: [{ house, fmt, start, end, mid (day number), R, W, U (or null), n }]
   Returns per-scale fits and the helpers gen-data prints from. */
export function fitDirection(readings, { t1, days, jumps, nDraw = 2000, track = [] }) {
  const smoothDays = readings.map((r) => r.mid);           // every reading's day, for leave-one-out on both scales
  const bal = fitScale(readings, "balance", { t1, days, smoothDays, jumps, nDraw, seed: 20261122, track });
  const und = fitScale(readings, "undecided", { t1, days, smoothDays, jumps, nDraw, seed: 20261123 });
  const n = Math.min(bal.draws.length, und.draws.length);
  const fmtOf = (h) => FORMAT[h.replace(/ \(.*\)$/, "")] || "u";
  /* printed shares at a day, per draw */
  const shares = (day) => {
    const sb = bal.slotOfDay.get(day), su = und.slotOfDay.get(day);
    const R = new Float64Array(n), W = new Float64Array(n), U = new Float64Array(n), NET = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const b = logistic(bal.draws[i].m[sb]), u = logistic(und.draws[i].m[su]);
      U[i] = 100 * u; R[i] = 100 * (1 - u) * b; W[i] = 100 * (1 - u) * (1 - b); NET[i] = R[i] - W[i];
    }
    return { R, W, U, NET };
  };
  /* a house's printed figures against the average pollster's at t1, per draw */
  const leanPts = (h) => {
    const sb = bal.slotOfDay.get(t1), su = und.slotOfDay.get(t1), f = fmtOf(h);
    const dR = new Float64Array(n), dW = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const bm = bal.draws[i].m[sb], um = und.draws[i].m[su];
      const u = logistic(um), b = logistic(bm), bj = logistic(bm + (bal.draws[i].leans[h] ?? 0));
      const uj = f === "f" ? 0 : f === "q" ? u : logistic(um + (und.draws[i].leans[h] ?? 0));
      dR[i] = 100 * ((1 - uj) * bj - (1 - u) * b); dW[i] = 100 * ((1 - uj) * (1 - bj) - (1 - u) * (1 - b));
    }
    return { dR, dW };
  };
  /* the net at the best grid point from two scale states (point estimate) */
  const netOf = (xb, xu, h) => {
    const b = logistic(xb[0] + (h ? lean(bal, h, xb) : 0)), f = h ? fmtOf(h) : "u";
    const u = h && f === "f" ? 0 : logistic(xu[0] + (h && f === "u" ? lean(und, h, xu) : 0));
    return 100 * (1 - u) * (2 * b - 1);
  };
  const lean = (fit, h, x) => { const lr = fit.L.leanRow.get(h); if (!lr) return 0; let s = 0; for (let i = 0; i < lr.length; i++) s += lr[i] * x[i]; return s; };
  /* each reading's leave-one-out: the average pollster's net at its day
     without it, its house's net lean then, and what dropping it does to
     today's net (point estimates at each scale's best grid point) */
  const influence = (idx) => {
    const r = readings[idx], lb = bal.loo.get(idx), lu = und.loo.get(idx);
    if (!lb) return null;
    const xb = lb.xLoo, xu = lu ? lu.xLoo : und.smoothAt(r.mid) || und.smoothEnd;
    const xbAll = bal.sm.xs[lb.k], xuAll = und.smoothAt(r.mid) || und.smoothEnd;
    const level = netOf(xb, xu), he = netOf(xbAll, xuAll, leanHouse(r)) - netOf(xbAll, xuAll);
    const endB = bal.smoothEnd, endU = und.smoothEnd;
    const endB2 = endB.map((v, i) => v + lb.dEnd[i]), endU2 = lu ? endU.map((v, i) => v + lu.dEnd[i]) : endU;
    return { level, he, dNow: netOf(endB, endU) - netOf(endB2, endU2) };
  };
  return { bal, und, n, shares, leanPts, influence, fmtOf, logistic };
}

/* summaries */
export const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
export const quant = (a, q) => { const s = Float64Array.from(a).sort(); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
