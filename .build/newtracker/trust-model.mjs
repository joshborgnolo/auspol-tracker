/* Trust in the federal government: one line from every survey (2026-11-22;
   prototype and backtest in .build/analysis/trust-bayes/). gen-data §5t calls
   fitTrust. The national-direction model's machinery (direction-model.mjs)
   on one scale:

     y_i = m_t + lean_s + e_i        on the logit of survey s's trusting share
       m_t    latent trust: a random walk (ω a day), with extra variance J² on
              each federal election and change of prime minister, and Jp² on
              the WHO's pandemic declaration of 11 March 2020 (log evidence
              −15.6 with it, −27.2 without)
       lean_s each survey's own level – its question, the answers it counts,
              its panel. The current surveys' leans average zero; ANUpoll's
              and Scanlon's earlier panels (Life in Australia; telephone) are
              surveys of their own with a wide prior, placed through the
              surveys that polled across each change. Leans drift (δ a day).
       e_i    sampling (deff 1.6 on n) + τ²
   No survey's sensitivity differs detectably from ANUpoll's (Scanlon's and
   the AES's tested), so each shifts by its lean only. Printed on ANUpoll's
   terms (user decision 2026-11-22): the line is m + ANUpoll's current lean,
   the share with a great deal or quite a lot of confidence as its panel asks
   it. Settings integrated over a grid; seeded forward-filter backward-sample
   draws. Backtest (each reading predicted from those before it): average
   miss 5.35 v 4.98 for the survey's own last reading, a difference within
   chance; 95% bands covered 96% of readings v 44%. */
const LOGIT = (p) => Math.log(p / (1 - p));
const logistic = (z) => 1 / (1 + Math.exp(-z));
export const DEFF = 1.6;
export const DAY = (iso) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86400000);
export const ISO = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
export const ELECTIONS = ["1969-10-25", "1972-12-02", "1974-05-18", "1975-12-13", "1977-12-10", "1980-10-18", "1983-03-05", "1984-12-01", "1987-07-11", "1990-03-24", "1993-03-13", "1996-03-02", "1998-10-03", "2001-11-10", "2004-10-09", "2007-11-24", "2010-08-21", "2013-09-07", "2016-07-02", "2019-05-18", "2022-05-21", "2025-05-03"];
export const PM_CHANGES = ["1971-03-10", "1975-11-11", "1991-12-20", "2010-06-24", "2013-06-27", "2015-09-15", "2018-08-24"];
export const PANDEMIC = "2020-03-11";
const WIDE = 0.5;
export const GRID = { w: [0.002, 0.004, 0.007, 0.012, 0.02], d: [0, 0.001, 0.002, 0.004, 0.008], s: [0.05, 0.1, 0.25], tau: [0, 0.05, 0.1, 0.2], J: [0.05, 0.15, 0.3], Jp: [0.5, 1, 1.5] };

const zeros = (n) => Array.from({ length: n }, () => new Float64Array(n));
function chol(A) { const n = A.length, L = zeros(n); for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]; if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-14)); else L[i][j] = s / L[j][j]; } return L; }
function inv(A) { const n = A.length, M = A.map((r, i) => { const o = new Float64Array(2 * n); o.set(r); o[n + i] = 1; return o; }); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; } } return M.map((r) => r.slice(n)); }
const mul = (A, B) => { const n = A.length, m = B[0].length, k = B.length, C = Array.from({ length: n }, () => new Float64Array(m)); for (let i = 0; i < n; i++) for (let l = 0; l < k; l++) { const a = A[i][l]; if (a) for (let j = 0; j < m; j++) C[i][j] += a * B[l][j]; } return C; };
const Tr = (A) => Array.from({ length: A[0].length }, (_, j) => Float64Array.from(A, (r) => r[j]));
function helmert(K) { const B = Array.from({ length: K }, () => new Float64Array(Math.max(0, K - 1))); for (let k = 1; k < K; k++) { const s = 1 / Math.sqrt(k * (k + 1)); for (let j = 0; j < k; j++) B[j][k - 1] = s; B[k][k - 1] = -k * s; } return B; }
function makeRng(seed) { let s = seed >>> 0, spare = null; const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; return { normal() { if (spare != null) { const v = spare; spare = null; return v; } let a, b, r; do { a = 2 * u() - 1; b = 2 * u() - 1; r = a * a + b * b; } while (r >= 1 || r === 0); const f = Math.sqrt(-2 * Math.log(r) / r); spare = b * f; return a * f; } }; }

function makeLayout(houses, core) {
  const coreH = houses.filter((h) => core.has(h)), other = houses.filter((h) => !core.has(h));
  const K = coreH.length, N = 1 + Math.max(0, K - 1) + other.length, B = helmert(K), row = new Map();
  coreH.forEach((h, j) => { const v = new Float64Array(N); v[0] = 1; for (let k = 0; k < K - 1; k++) v[1 + k] = B[j][k]; row.set(h, v); });
  other.forEach((h, q) => { const v = new Float64Array(N); v[0] = 1; v[K + q] = 1; row.set(h, v); });
  const leanRow = new Map([...row].map(([h, v]) => { const w = Float64Array.from(v); w[0] = 0; return [h, w]; }));
  return { houses, K, N, row, leanRow };
}
function runFilter(obs, L, events, th, opts) {
  const { N, K } = L, x = new Float64Array(N); x[0] = opts.m0;
  const P = zeros(N); P[0][0] = 1;
  for (let i = 1; i < N; i++) P[i][i] = (i < K ? th.s : WIDE) ** 2;
  const q0 = th.w ** 2, qd = th.d ** 2, tau2 = th.tau ** 2, J2 = th.J ** 2, Jp2 = th.Jp ** 2;
  const store = !!opts.store, xs = [], Ps = [], qs = [], Ph = new Float64Array(N);
  let ll = 0, prev = null, oi = 0;
  for (const t of events) {
    let qm = 0, ql = 0;
    if (prev != null) { const k = t - prev; qm = k * q0 + (opts.jumps.has(t) ? J2 : 0) + (t === opts.pandemic ? Jp2 : 0); ql = k * qd; P[0][0] += qm; for (let i = 1; i < N; i++) P[i][i] += ql; }
    while (oi < obs.length && obs[oi].t === t) {
      const o = obs[oi++], h = L.row.get(o.house);
      let S = o.v + tau2, pred = 0;
      for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += P[i][j] * h[j]; Ph[i] = s; }
      for (let i = 0; i < N; i++) { S += h[i] * Ph[i]; pred += h[i] * x[i]; }
      const v = o.y - pred;
      ll += -0.5 * (Math.log(2 * Math.PI * S) + (v * v) / S);
      for (let i = 0; i < N; i++) x[i] += (Ph[i] / S) * v;
      for (let i = 0; i < N; i++) { const a = Ph[i] / S; for (let j = 0; j < N; j++) P[i][j] -= a * Ph[j]; }
    }
    if (store) { xs.push(Float64Array.from(x)); Ps.push(P.map((r) => Float64Array.from(r))); qs.push([qm, ql]); }
    prev = t;
  }
  return { ll, xs, Ps, qs };
}
const predicted = (f, k, N) => { const Pp = f.Ps[k].map((r) => Float64Array.from(r)); const [qm, ql] = f.qs[k + 1]; Pp[0][0] += qm; for (let i = 1; i < N; i++) Pp[i][i] += ql; return Pp; };
function smooth(f, N) {
  const L = f.xs.length, xs = new Array(L);
  xs[L - 1] = f.xs[L - 1];
  for (let k = L - 2; k >= 0; k--) {
    const G = mul(f.Ps[k], inv(predicted(f, k, N))), dx = xs[k + 1].map((v, i) => v - f.xs[k][i]), xk = Float64Array.from(f.xs[k]);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += G[i][j] * dx[j]; xk[i] += s; }
    xs[k] = xk;
  }
  return xs;
}
function cholFlat(A, N, Lo) { for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) { let s = A[i * N + j]; for (let k = 0; k < j; k++) s -= Lo[i * N + k] * Lo[j * N + k]; if (i === j) Lo[i * N + i] = Math.sqrt(Math.max(s, 1e-14)); else Lo[i * N + j] = s / Lo[j * N + j]; } for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) Lo[i * N + j] = 0; }
function cholSolveFlat(Lo, B, N, X, tmp) { for (let c = 0; c < N; c++) { for (let i = 0; i < N; i++) { let s = B[i * N + c]; for (let k = 0; k < i; k++) s -= Lo[i * N + k] * tmp[k]; tmp[i] = s / Lo[i * N + i]; } for (let i = N - 1; i >= 0; i--) { let s = tmp[i]; for (let k = i + 1; k < N; k++) s -= Lo[k * N + i] * X[k * N + c]; X[i * N + c] = s / Lo[i * N + i]; } } }
function ffbs(f, N, nDraw, keep, rng, rec) {
  const L = f.xs.length, NN = N * N, Gf = new Float64Array(L * NN), Cf = new Float64Array(L * NN), Xf = new Float64Array(L * N);
  for (let k = 0; k < L; k++) Xf.set(f.xs[k], k * N);
  const Pf = new Float64Array(NN), Pp = new Float64Array(NN), Lc = new Float64Array(NN), X = new Float64Array(NN), cov = new Float64Array(NN), Lv = new Float64Array(NN), tmp = new Float64Array(N);
  for (let k = 0; k < L - 1; k++) {
    const P = f.Ps[k]; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) Pf[i * N + j] = P[i][j];
    Pp.set(Pf); const [qm, ql] = f.qs[k + 1]; Pp[0] += qm; for (let i = 1; i < N; i++) Pp[i * N + i] += ql;
    cholFlat(Pp, N, Lc); cholSolveFlat(Lc, Pf, N, X, tmp);
    const o = k * NN;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) Gf[o + i * N + j] = X[j * N + i];
    for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) { let s = 0; for (let m = 0; m < N; m++) s += Gf[o + i * N + m] * Pf[m * N + j]; const v = Pf[i * N + j] - s; cov[i * N + j] = v; cov[j * N + i] = v; }
    cholFlat(cov, N, Lv); Cf.set(Lv, o);
  }
  const Cl = chol(f.Ps[L - 1]), z = new Float64Array(N), cur = new Float64Array(N), nxt = new Float64Array(N), dif = new Float64Array(N);
  for (let d = 0; d < nDraw; d++) {
    for (let i = 0; i < N; i++) z[i] = rng.normal();
    for (let i = 0; i < N; i++) { let s = Xf[(L - 1) * N + i]; for (let j = 0; j <= i; j++) s += Cl[i][j] * z[j]; nxt[i] = s; }
    if (keep.has(L - 1)) rec(d, L - 1, nxt);
    for (let k = L - 2; k >= 0; k--) {
      const xo = k * N, o = k * NN;
      for (let i = 0; i < N; i++) { z[i] = rng.normal(); dif[i] = nxt[i] - Xf[xo + i]; }
      for (let i = 0; i < N; i++) { let s = Xf[xo + i]; const gi = o + i * N; for (let j = 0; j < N; j++) s += Gf[gi + j] * dif[j]; for (let j = 0; j <= i; j++) s += Cf[gi + j] * z[j]; cur[i] = s; }
      if (keep.has(k)) rec(d, k, cur);
      nxt.set(cur);
    }
  }
}
function* gridPoints(g) { for (const w of g.w) for (const d of g.d) for (const s of g.s) for (const tau of g.tau) for (const J of g.J) for (const Jp of g.Jp) yield { w, d, s, tau, J, Jp }; }
function allocate(rows, n) {
  const keep = rows.filter((r) => r.w * n >= 0.5), tot = keep.reduce((a, r) => a + r.w, 0);
  const al = keep.map((r) => ({ r, n: Math.floor((r.w / tot) * n), rem: ((r.w / tot) * n) % 1 }));
  let left = n - al.reduce((a, x) => a + x.n, 0);
  for (const a of [...al].sort((p, q) => q.rem - p.rem)) { if (left <= 0) break; a.n++; left--; }
  return al.filter((a) => a.n > 0);
}

/* readings: [{ house, day, v (percent), n }]; core: zero-setting houses;
   ref: the house whose terms the line is printed on; days: output days;
   track: houses whose lean is kept at every output day */
export function fitTrust(readings, { core, ref, days, nDraw = 2000, seed = 20261122 }) {
  const obs = readings.map((r, idx) => { const p = Math.min(0.99, Math.max(0.01, r.v / 100)); return { t: r.day, y: LOGIT(p), v: DEFF / (r.n * p * (1 - p)), house: r.house, idx }; })
    .sort((a, b) => a.t - b.t || a.idx - b.idx);
  const houses = [...new Set(obs.map((o) => o.house))], L = makeLayout(houses, core);
  const t0 = obs[0].t, t1 = Math.max(...obs.map((o) => o.t));
  const jumps = new Set([...ELECTIONS, ...PM_CHANGES].map(DAY).filter((d) => d > t0 && d <= t1)), pandemic = DAY(PANDEMIC);
  const outDays = [...new Set(days.filter((d) => d >= t0 && d <= t1))];
  const fitEvents = [...new Set([...obs.map((o) => o.t), ...jumps, ...(pandemic > t0 && pandemic <= t1 ? [pandemic] : [])])].sort((a, b) => a - b);
  const events = [...new Set([...fitEvents, ...outDays, t1])].sort((a, b) => a - b);
  const opts = { m0: obs[0].y, jumps, pandemic };
  const rows = [...gridPoints(GRID)].map((th) => ({ th, ll: runFilter(obs, L, fitEvents, th, opts).ll }));
  const mx = Math.max(...rows.map((r) => r.ll)); let z = 0;
  for (const r of rows) { r.w = Math.exp(r.ll - mx); z += r.w; }
  for (const r of rows) r.w /= z;
  rows.sort((a, b) => b.w - a.w);
  const evIdx = new Map(events.map((d, i) => [d, i])), keep = new Map();
  for (const d of [...outDays, t1]) { const i = evIdx.get(d); if (!keep.has(i)) keep.set(i, keep.size); }
  const slotOfDay = new Map([...outDays, t1].map((d) => [d, keep.get(evIdx.get(d))]));
  const S = keep.size, N = L.N, refRow = L.leanRow.get(ref), lastSlot = keep.get(events.length - 1);
  const rng = makeRng(seed), draws = [];
  for (const { r, n } of allocate(rows, nDraw)) {
    const f = runFilter(obs, L, events, r.th, { ...opts, store: true });
    const batch = Array.from({ length: n }, () => ({ v: new Float64Array(S), m: new Float64Array(S), hRef: 0, leans: {} }));
    ffbs(f, N, n, keep, rng, (d, k, x) => {
      const s = keep.get(k); let h = 0;
      for (let i = 0; i < N; i++) h += refRow[i] * x[i];
      batch[d].v[s] = 100 * logistic(x[0] + h);                 // on the reference survey's terms
      batch[d].m[s] = x[0];                                       // the pooled level (logit), free of any lean
      if (s === lastSlot) batch[d].hRef = h;                      // the reference's lean today
      if (s === lastSlot) for (const hs of L.houses) { const lr = L.leanRow.get(hs); let v = 0; for (let i = 0; i < N; i++) v += lr[i] * x[i]; batch[d].leans[hs] = v - h; }
    });
    draws.push(...batch);
  }
  /* each house's lean against the reference at every reading day (smoothed,
     best grid point), for moving readings onto the reference's terms */
  const sm = smooth(runFilter(obs, L, events, rows[0].th, { ...opts, store: true }), N);
  const leanAt = (house, day) => {
    let k = evIdx.get(day); if (k == null) k = events.findIndex((e) => e >= day); if (k < 0) k = events.length - 1;
    const x = sm[k], lr = L.leanRow.get(house); let a = 0, b = 0;
    for (let i = 0; i < N; i++) { a += (lr ? lr[i] : 0) * x[i]; b += refRow[i] * x[i]; }
    return a - b;                                                 // house lean minus reference lean (logit)
  };
  const edges = Object.keys(GRID).filter((k) => { const vs = GRID[k], wOf = (v) => rows.filter((r) => r.th[k] === v).reduce((a, r) => a + r.w, 0); return (vs[0] !== 0 && wOf(vs[0]) > 0.5) || wOf(vs[vs.length - 1]) > 0.5; });
  return { draws, slotOfDay, t1, best: rows[0].th, leanAt, edges, houses, n: draws.length };
}
export const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
export const quant = (a, q) => { const s = Float64Array.from(a).sort(); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
export const toTerms = (v, leanLogit) => 100 * logistic(LOGIT(Math.min(0.99, Math.max(0.01, v / 100))) - leanLogit);
