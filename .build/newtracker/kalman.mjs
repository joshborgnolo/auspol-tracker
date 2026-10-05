/* A Kalman smoother for a poll series – /vic/'s trend lines (2026-10-06).

   WHY: Victoria publishes ~1.3 polls a month (the federal page ~9), so the
   calendar-month average the federal page draws rests on one or two polls a
   point and jumps by sampling error alone (1.7 pts a month on the 2PP,
   against 0.5 federally). A trial (user call 2026-10-06: "proceed as
   recommended") found a state-space smoother calms the lines by half or more
   while predicting each next poll as well as the 21-day nowcast – provided
   its smoothness is fitted to Victoria's own polls (the federal page's
   setting over-smooths Victoria). The federal page keeps its monthly lines:
   at its density the methods agree, and Past cycles compares this term with
   twenty past terms month by month.

   MODEL, per series (a 2PP or one party's primary):
     state  x_t = [mu_t, h_1 .. h_H]    mu: the true figure; h_j: house j's lean
     mu_t = mu_{t-1} + eta_t,  eta ~ N(0, s^2) a day, plus `jumps`: extra
            variance on a known date (a change of leader may move opinion at once)
     h_j static, prior N(0, sh^2), constrained so the leans' poll-weighted mean
            is zero – the site's "relative to the other pollsters"
     poll i: y_i = mu_{t_i} + h_{k(i)} + e_i,
            e_i ~ N(0, deff * p(1-p) * 1e4 / n_i + tau^2)   (the site's
            sampling floor: n_i is rowN, deff the site's 1.6)
     mu_0 = the election's count (sd0 0.5), or the first poll for a party
            first reported long after it
   The filter runs a day at a time; the line is its Rauch–Tung–Striebel
   smooth (every poll, earlier and later), and the current figure the filter's
   own estimate, so the line ends on the headline. */

/* ---------------------------------------------------------------- algebra */
const zeros = (n) => Array.from({ length: n }, () => new Float64Array(n));
const copyM = (A) => A.map((r) => Float64Array.from(r));
function inv(A) {                                   // Gauss–Jordan, small and SPD
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
function mul(A, B) {
  const n = A.length, m = B[0].length, k = B.length, C = Array.from({ length: n }, () => new Float64Array(m));
  for (let i = 0; i < n; i++) for (let l = 0; l < k; l++) { const a = A[i][l]; if (a) for (let j = 0; j < m; j++) C[i][j] += a * B[l][j]; }
  return C;
}
const T = (A) => { const C = Array.from({ length: A[0].length }, () => new Float64Array(A.length)); A.forEach((r, i) => r.forEach((v, j) => (C[j][i] = v))); return C; };

/* ---------------------------------------------------------------- the filter
   obs: [{ t (day number), y, n, house }]
   opts: { s (drift sd a day), tau, sh, deff, mu0, sd0, t0, t1, jumps: [{ t, v }],
           smooth: bool, snapAt: day (a frozen copy of mu from that day's end,
           for the change test) } */
export function kalmanRun(obs, opts) {
  const houses = [...new Set(obs.map((o) => o.house))];
  const H = houses.length, snap = opts.snapAt != null, N = 1 + H + (snap ? 1 : 0), S = N - 1;
  const hi = new Map(houses.map((h, i) => [h, 1 + i]));
  const sh = opts.sh ?? 1.6, tau2 = (opts.tau ?? 0) ** 2, deff = opts.deff ?? 1.6, q = opts.s ** 2;
  const x = new Float64Array(N); x[0] = opts.mu0;
  const P = zeros(N); P[0][0] = (opts.sd0 ?? 0.5) ** 2;
  for (let j = 1; j <= H; j++) P[j][j] = sh * sh;
  const update = (h, y, R) => {                     // scalar observation y = h.x + noise(R)
    const Ph = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += P[i][j] * h[j]; Ph[i] = s; }
    let Sv = R, pred = 0;
    for (let i = 0; i < N; i++) { Sv += h[i] * Ph[i]; pred += h[i] * x[i]; }
    const v = y - pred;
    for (let i = 0; i < N; i++) x[i] += (Ph[i] / Sv) * v;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) P[i][j] -= (Ph[i] * Ph[j]) / Sv;
    return { v, S: Sv };
  };
  // the leans' poll-weighted mean is zero: one near-exact pseudo-observation
  const cnt = houses.map((h) => obs.filter((o) => o.house === h).length), tot = cnt.reduce((a, b) => a + b, 0);
  if (H) { const h = new Float64Array(N); houses.forEach((_, j) => (h[1 + j] = cnt[j] / tot)); update(h, 0, 1e-8); }
  const jumpAt = new Map((opts.jumps || []).map((j) => [j.t, j.v]));
  const byDay = new Map();
  for (const o of obs) { if (!byDay.has(o.t)) byDay.set(o.t, []); byDay.get(o.t).push(o); }
  const xs_p = [], Ps_p = [], xs_f = [], Ps_f = [];
  let ll = 0;
  for (let t = opts.t0; t <= opts.t1; t++) {
    if (t > opts.t0) P[0][0] += q + (jumpAt.get(t) || 0);       // predict
    if (opts.smooth) { xs_p.push(Float64Array.from(x)); Ps_p.push(copyM(P)); }
    for (const o of byDay.get(t) || []) {
      const h = new Float64Array(N); h[0] = 1; h[hi.get(o.house)] = 1;
      const p = Math.min(0.99, Math.max(0.01, o.y / 100));
      const r = update(h, o.y, (deff * p * (1 - p) * 1e4) / o.n + tau2);
      ll += -0.5 * (Math.log(2 * Math.PI * r.S) + (r.v * r.v) / r.S);
    }
    if (snap && t === opts.snapAt) {                              // freeze a copy of mu
      x[S] = x[0];
      for (let j = 0; j < N; j++) { P[S][j] = P[0][j]; P[j][S] = P[j][0]; }
      P[S][S] = P[0][0];
    }
    if (opts.smooth) { xs_f.push(Float64Array.from(x)); Ps_f.push(copyM(P)); }
  }
  const out = { ll, final: { mu: x[0], sd: Math.sqrt(Math.max(0, P[0][0])) },
                leans: Object.fromEntries(houses.map((h, j) => [h, x[1 + j]])), nHouse: Object.fromEntries(houses.map((h, j) => [h, cnt[j]])) };
  if (snap && opts.snapAt <= opts.t1) {
    out.change = { prev: x[S], chg: x[0] - x[S], sd: Math.sqrt(Math.max(0, P[0][0] + P[S][S] - 2 * P[0][S])) };
  }
  if (opts.smooth) {                                              // Rauch–Tung–Striebel
    const L = xs_f.length, xs = new Array(L), Ps = new Array(L);
    xs[L - 1] = xs_f[L - 1]; Ps[L - 1] = Ps_f[L - 1];
    for (let k = L - 2; k >= 0; k--) {
      const J = mul(Ps_f[k], inv(Ps_p[k + 1]));
      const dx = xs[k + 1].map((v, i) => v - xs_p[k + 1][i]);
      const xk = Float64Array.from(xs_f[k]);
      for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += J[i][j] * dx[j]; xk[i] += s; }
      const dP = Ps[k + 1].map((r, i) => r.map((v, j) => v - Ps_p[k + 1][i][j]));
      const add = mul(mul(J, dP), T(J));
      xs[k] = xk;
      Ps[k] = Ps_f[k].map((r, i) => r.map((v, j) => v + add[i][j]));
    }
    out.path = xs.map((v, k) => ({ t: opts.t0 + k, mu: v[0], sd: Math.sqrt(Math.max(0, Ps[k][0][0])) }));
  }
  return out;
}

/* maximum likelihood over the drift and the extra noise, on a grid – the
   check gen-data logs beside the fixed settings (a refit is a hand call) */
export const KF_GRID = { s: [0.01, 0.02, 0.03, 0.045, 0.06, 0.075, 0.09, 0.11, 0.13, 0.16, 0.2, 0.25, 0.3, 0.4, 0.5, 0.65, 0.8, 1.0],
                         tau: [0, 0.5, 1, 1.5, 2, 2.5, 3] };
export function kalmanFit(obs, base, grid = KF_GRID) {
  let best = null;
  for (const s of grid.s) for (const tau of grid.tau) {
    const r = kalmanRun(obs, { ...base, s, tau, smooth: false, snapAt: null });
    if (!best || r.ll > best.ll) best = { s, tau, ll: r.ll };
  }
  return best;
}
