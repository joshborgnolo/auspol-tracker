/* The primary-vote model (2026-11-23; prototype, backtests and review in
   .build/analysis/primary-bayes/, not committed). gen-data §2m calls
   fitPrimary for the national figures and fitGroupSet for the vote by
   group (§7g).

   WHAT IT ESTIMATES, day by day since the last election: the share of
   decided voters each party would get from the average regular pollster –
   the five shares together, so they always add to 100 and a lead or a fall
   carries its proper uncertainty.

   SCALE. The five shares p (Labor, Coalition, Greens, One Nation, others)
   are carried as four log-ratios against others, η_k = log(p_k / p_oth).
   Multinomial sampling has a closed-form covariance on that scale,
   (diag(1/p_k) + 1/p_oth) / n, and a poll's base (undecided in or out)
   cancels in a ratio.

   STATE  x_t = [η_t, z_1..z_{K-1}, g_1..g_Q, v_t], each block four numbers
          η    the average regular pollster's figures
          z    the K regular houses' leans (four or more polls this term) in
               a sum-to-zero basis, so their leans average exactly zero on
               every day: the level is "the average regular pollster, each
               counting once" (as the national-direction model's)
          g    occasional houses' leans, prior wide: they lean but never move
               the level (a house with a single poll is folded out of the
               state exactly: its lean is added to that poll's noise)
          v    the trend: η moves by v a day, v is damped (e^(−1/τ) a day)
   DRIFT  log p_k takes N(0, ω_k²) steps a day, party by party; the trend
          takes ν·ω_k steps; a common N(0, J²) step on a change of prime
          minister or opposition leader; every lean drifts N(0, d²) a day
   PRIOR  η on the election day: the count moved by the polls' average miss
          at the 2007–2025 elections, with that miss's spread (PRIM_MISS in
          gen-data); regular leans N(0, s²)
   POLL   y = g(η + lean_house) + e, e ~ N(0, κ_house · V_n + rounding),
          V_n the multinomial covariance at the poll's decided sample (site
          convention: published effective n, else min(n, 3000)/1.6, less a
          printed undecided share), κ the house's own noise (penalised
          maximum likelihood, log κ ~ N(0, 0.5²)); a poll that folds a party
          into others is read as the figures it printed (extended Kalman).
   For fixed settings the Kalman filter gives the posterior and its marginal
   likelihood. The settings are integrated by importance sampling around
   their posterior mode (a Laplace proposal, 64 draws: about half carry weight); printed figures
   are summaries of seeded draws, so the same data prints the same figures.

   Backtests (predicting each poll before it was published, against the
   recipe it replaced copied verbatim): 2007–2025 terms, 8,565 predictions,
   error 1.14 v 1.26 points, 95% bands covering 95% v 92%; this term 1.29 v
   1.26 (1,595 predictions; bands 95% v 92%). Election counts 2007–2025:
   level with the recipe (1.77 v 1.72 over every horizon). Vote by group:
   1.65 v 2.03. */

export const DEFF = 1.6;
export const WIDE_SD = 0.5;
export const PARTIES = ["alp", "lnp", "grn", "onp", "oth"];

/* ------------------------------------------------------------ small linalg */
function helmert(K) {
  const B = Array.from({ length: K }, () => new Float64Array(Math.max(0, K - 1)));
  for (let k = 1; k < K; k++) { const s = 1 / Math.sqrt(k * (k + 1)); for (let j = 0; j < k; j++) B[j][k - 1] = s; B[k][k - 1] = -k * s; }
  return B;
}
/* in-place Cholesky of a flat symmetric n×n (lower), returns log det; jitter if needed */
function cholIn(A, n, L) {
  let ld = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * n + j];
    for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
    if (i === j) { const v = Math.sqrt(Math.max(s, 1e-14)); L[i * n + i] = v; ld += 2 * Math.log(v); } else L[i * n + j] = s / L[j * n + j];
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) L[i * n + j] = 0;
  return ld;
}
/* solve (L Lᵀ) x = b in place, n */
function cholSolveVec(L, n, b) {
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * b[k]; b[i] = s / L[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * b[k]; b[i] = s / L[i * n + i]; }
}
/* small dense inverse of flat m×m SPD via Cholesky */
function spdInv(A, m) {
  const L = new Float64Array(m * m); cholIn(A, m, L);
  const out = new Float64Array(m * m), e = new Float64Array(m);
  for (let c = 0; c < m; c++) { e.fill(0); e[c] = 1; cholSolveVec(L, m, e); for (let r = 0; r < m; r++) out[r * m + c] = e[r]; }
  return out;
}

/* ------------------------------------------------------------- the readings */
/* categories a poll printed: each reported party its own; unreported parties
   fold into the reference category (others), the usual way a house that
   doesn't cut One Nation out prints it. Returns null when unusable. */
export function categoriesOf(y, parties = PARTIES) {
  const P = parties.length, ref = P - 1;
  const cats = [], vals = [];
  const refMembers = [ref];
  for (let k = 0; k < P - 1; k++) {
    const v = y[parties[k]];
    if (v == null) refMembers.push(k); else if (v > 0) { cats.push([k]); vals.push(v); } else return null;
  }
  let vr = y[parties[ref]];
  if (vr == null || !(vr > 0)) return null;
  cats.push(refMembers); vals.push(vr);
  if (cats.length < 2) return null;
  return { cats, vals, full: cats.length === P };
}
/* rounding step of a printed set: whole points, half points, else tenths */
export function stepOf(vals) {
  if (vals.every((v) => Math.abs(v - Math.round(v)) < 1e-6)) return 1;
  if (vals.every((v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-6)) return 0.5;
  return 0.1;
}

/* ------------------------------------------------------------- the layout */
/* an orthonormal basis of the leans that average zero with weights w (equal
   weights give a rotation of Helmert's) */
function zeroBasis(w) {
  const K = w.length, nrm = Math.hypot(...w), u = w.map((x) => x / nrm), vs = [];
  for (let j = 0; j < K && vs.length < K - 1; j++) {
    const v = Float64Array.from({ length: K }, (_, i) => (i === j ? 1 : 0) - u[j] * u[i]);
    for (const q of vs) { let d = 0; for (let i = 0; i < K; i++) d += v[i] * q[i]; for (let i = 0; i < K; i++) v[i] -= d * q[i]; }
    const n2 = Math.hypot(...v); if (n2 < 1e-8) continue;
    vs.push(v.map((x) => x / n2));
  }
  return Array.from({ length: K }, (_, h) => Float64Array.from(vs, (q) => q[h]));
}
export function makeLayout(houses, coreSet, P, trend = false, zeroW = null) {
  const D = P - 1;
  const core = houses.filter((h) => coreSet.has(h)), other = houses.filter((h) => !coreSet.has(h));
  const K = core.length, Q = other.length, nbLean = 1 + Math.max(0, K - 1) + Q, nb = nbLean + (trend ? 1 : 0), N = nb * D;
  const B = zeroW ? zeroBasis(core.map((h) => zeroW.get(h) || 1)) : helmert(K);
  const coef = new Map();                    // house -> Float64Array(nb): block coefficients
  core.forEach((h, j) => { const c = new Float64Array(nb); c[0] = 1; for (let k = 0; k < K - 1; k++) c[1 + k] = B[j][k]; coef.set(h, c); });
  other.forEach((h, q) => { const c = new Float64Array(nb); c[0] = 1; c[K + q] = 1; coef.set(h, c); });
  const nz = new Map([...coef].map(([h, c]) => [h, [...c.keys()].filter((b) => c[b] !== 0)]));
  return { houses, core, other, K, Q, nb, nbLean, N, D, P, coef, nz, trend, vOff: trend ? nbLean * D : -1 };
}

/* one prediction step over dt days: x ← F x, P ← F P Fᵀ + Q. F is the
   identity except, with the trend block, η += dt·v and v ← φ v (damped,
   φ = e^(−dt/τ)); Q holds the level's daily steps, the jump, the leans'
   drift and the trend's own steps (ν·ω per party, integrated). */
export function predictStep(x, Pm, L, th, dt, jmp) {
  const { N, D, P, nbLean } = L;
  if (dt <= 0 && !jmp) return;
  const w2 = th._w2 || (th._w2 = Array.from(th.w, (v) => v * v)), wr2 = w2[P - 1], d2 = th.d * th.d, J2 = th.J * th.J;
  if (L.trend && dt > 0) {
    const vo = L.vOff, phi = Math.exp(-dt / th.tau);
    if (x) { for (let k = 0; k < D; k++) x[k] += dt * x[vo + k]; for (let k = 0; k < D; k++) x[vo + k] *= phi; }
    if (Pm) {
      for (let k = 0; k < D; k++) { const rk = k * N, rv = (vo + k) * N; for (let j = 0; j < N; j++) Pm[rk + j] += dt * Pm[rv + j]; }
      for (let k = 0; k < D; k++) { const rv = (vo + k) * N; for (let j = 0; j < N; j++) Pm[rv + j] *= phi; }
      for (let i = 0; i < N; i++) { const ri = i * N; for (let k = 0; k < D; k++) Pm[ri + k] += dt * Pm[ri + vo + k]; for (let k = 0; k < D; k++) Pm[ri + vo + k] *= phi; }
      const nu2 = th.nu * th.nu;
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
        const q = nu2 * ((i === j ? w2[i] : 0) + wr2);
        Pm[i * N + j] += q * dt * dt * dt / 3;
        Pm[i * N + vo + j] += q * dt * dt / 2; Pm[(vo + i) * N + j] += q * dt * dt / 2;
        Pm[(vo + i) * N + vo + j] += q * dt;
      }
    }
  }
  if (!Pm) return;
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[i * N + j] += dt * ((i === j ? w2[i] : 0) + wr2) + jmp * J2 * ((i === j ? 1 : 0) + 1);
  if (d2 > 0 && dt > 0) for (let b = 1; b < nbLean; b++) { const o = b * D; for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[(o + i) * N + o + j] += dt * d2 * ((i === j ? 1 : 0) + 1); }
}

/* ------------------------------------------------------------- the filter */
const LOG2PI = Math.log(2 * Math.PI);
/* th: { w: Float64Array(P) per-party daily sd on log shares, d, s, J }
   opts: { anchor: { mean: Float64Array(D), cov: Float64Array(D*D) }, jumps: Set(day),
           kappa: Map, store, rounding } */
export function runFilter(obs, L, events, th, opts) {
  const { N, D, P, nb } = L;
  const x = new Float64Array(N), Pm = new Float64Array(N * N);
  x.set(opts.anchor.mean, 0);
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[i * N + j] = opts.anchor.cov[i * D + j];
  /* lean blocks: prior s² (I + 11ᵀ) for regular, WIDE² for occasional */
  for (let b = 1; b < L.nbLean; b++) {
    const s2 = (b < L.K ? th.s : WIDE_SD) ** 2, o = b * D;
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[(o + i) * N + o + j] = s2 * ((i === j ? 1 : 0) + 1);
  }
  /* the trend starts at rest, with the spread it would reach in a long run */
  if (L.trend) { const vo = L.vOff, w2 = Array.from(th.w, (v) => v * v); for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[(vo + i) * N + vo + j] = th.nu * th.nu * ((i === j ? w2[i] : 0) + w2[P - 1]) * th.tau / 2; }
  const w2 = Array.from(th.w, (v) => v * v), wr2 = w2[P - 1], d2 = th.d * th.d, J2 = th.J * th.J;
  const store = !!opts.store, NN = N * N;
  const xsF = store ? new Float64Array(events.length * N) : null, PsF = store ? new Float64Array(events.length * NN) : null;
  const qinfo = store ? new Float64Array(events.length * 2) : null;   // [dt, jump]
  const upd = store ? [] : null;                                       // per obs: { k, H, R, zlin }
  const U = new Float64Array(N * D), PH = new Float64Array(N * 4), S = new Float64Array(16), Ls = new Float64Array(16), Kg = new Float64Array(N * 4);
  const mu = new Float64Array(D), pr = new Float64Array(P), Jm = new Float64Array(4 * D), V = new Float64Array(D * D);
  let ll = 0, prev = null, oi = 0, nObs = 0;
  for (let ev = 0; ev < events.length; ev++) {
    const t = events[ev];
    let dt = 0, jmp = 0;
    if (prev != null) {
      dt = t - prev;
      for (const jd of opts.jumps) if (jd > prev && jd <= t) jmp = 1;
      predictStep(x, Pm, L, th, dt, jmp);
    }
    while (oi < obs.length && obs[oi].day === t) {
      const o = obs[oi++], c = L.coef.get(o.house), nzb = L.nz.get(o.house);
      /* predicted log-ratios for this house */
      for (let k = 0; k < D; k++) { let s = 0; for (const b of nzb) s += c[b] * x[b * D + k]; mu[k] = s; }
      let mx = 0; for (let k = 0; k < D; k++) mx = Math.max(mx, mu[k]);
      let z = Math.exp(-mx); pr[P - 1] = z;
      for (let k = 0; k < D; k++) { pr[k] = Math.exp(mu[k] - mx); z += pr[k]; }
      for (let k = 0; k < P; k++) pr[k] /= z;
      const cats = o.cats, C = cats.length, m = C - 1, refc = cats[C - 1];
      const Pc = cats.map((cc) => cc.reduce((a, k) => a + pr[k], 0)), Pref = Pc[C - 1];
      /* Jacobian of g wrt η (m×D) and innovation */
      Jm.fill(0);
      for (let ci = 0; ci < m; ci++) for (const k of cats[ci]) Jm[ci * D + k] += pr[k] / Pc[ci];
      for (const k of refc) if (k < D) for (let ci = 0; ci < m; ci++) Jm[ci * D + k] -= pr[k] / Pref;
      const v = new Float64Array(m), zlin = new Float64Array(m);
      for (let ci = 0; ci < m; ci++) {
        const g = Math.log(Pc[ci] / Pref), yo = Math.log(o.vals[ci] / o.vals[C - 1]);
        v[ci] = yo - g;
        let jm = 0; for (let k = 0; k < D; k++) jm += Jm[ci * D + k] * mu[k];
        zlin[ci] = yo - g + jm;
      }
      /* R: κ · multinomial on the category log-ratios + rounding */
      const kap = opts.kappa?.get(o.house) ?? 1, rr = (o.step * o.step / 12) / 1e4, nz2 = th.noise ? (th.noise / 100) ** 2 : 0;
      for (let a = 0; a < m; a++) for (let b2 = 0; b2 < m; b2++)
        S[a * m + b2] = kap * ((a === b2 ? 1 / Pc[a] : 0) + 1 / Pref) / o.n + (opts.rounding === false ? 0 : rr * ((a === b2 ? 1 / (Pc[a] * Pc[a]) : 0) + 1 / (Pref * Pref))) + nz2 * ((a === b2 ? 1 / (Pc[a] * Pc[a]) : 0) + 1 / (Pref * Pref));
      /* a lone house's lean (prior WIDE², touching only this reading) */
      if (opts.lone && opts.lone.has(o.house)) {
        const w2l = WIDE_SD * WIDE_SD;
        for (let a = 0; a < m; a++) for (let b2 = 0; b2 < m; b2++) {
          let s1 = 0, sa = 0, sb = 0;
          for (let k = 0; k < D; k++) { s1 += Jm[a * D + k] * Jm[b2 * D + k]; sa += Jm[a * D + k]; sb += Jm[b2 * D + k]; }
          S[a * m + b2] += w2l * (s1 + sa * sb);
        }
      }
      const Rsave = store ? S.slice(0, m * m) : null;
      /* U = P (c ⊗ I)  (N×D) */
      U.fill(0);
      for (let r = 0; r < N; r++) { const row = r * N; for (const b of nzb) { const cb = c[b], o2 = b * D; for (let k = 0; k < D; k++) U[r * D + k] += cb * Pm[row + o2 + k]; } }
      /* V = (c ⊗ I)ᵀ U (D×D) */
      V.fill(0);
      for (const b of nzb) { const cb = c[b], o2 = b * D; for (let k = 0; k < D; k++) for (let l = 0; l < D; l++) V[k * D + l] += cb * U[(o2 + k) * D + l]; }
      /* PH = U Jᵀ (N×m); S += J V Jᵀ */
      for (let r = 0; r < N; r++) for (let a = 0; a < m; a++) { let s = 0; for (let k = 0; k < D; k++) s += U[r * D + k] * Jm[a * D + k]; PH[r * m + a] = s; }
      for (let a = 0; a < m; a++) for (let b2 = 0; b2 < m; b2++) { let s = 0; for (let k = 0; k < D; k++) { const jk = Jm[a * D + k]; if (!jk) continue; for (let l = 0; l < D; l++) s += jk * V[k * D + l] * Jm[b2 * D + l]; } S[a * m + b2] += s; }
      const ld = cholIn(S, m, Ls);
      const sv = Float64Array.from(v); cholSolveVec(Ls, m, sv);
      let q = 0; for (let a = 0; a < m; a++) q += v[a] * sv[a];
      ll += -0.5 * (m * LOG2PI + ld + q); nObs += m;
      /* K = PH S⁻¹ (N×m) */
      const tmp = new Float64Array(m);
      for (let r = 0; r < N; r++) { for (let a = 0; a < m; a++) tmp[a] = PH[r * m + a]; cholSolveVec(Ls, m, tmp); for (let a = 0; a < m; a++) Kg[r * m + a] = tmp[a]; }
      for (let r = 0; r < N; r++) { let s = 0; for (let a = 0; a < m; a++) s += Kg[r * m + a] * v[a]; x[r] += s; }
      for (let r = 0; r < N; r++) { const row = r * N; for (let a = 0; a < m; a++) { const kr = Kg[r * m + a]; if (!kr) continue; for (let cc = 0; cc < N; cc++) Pm[row + cc] -= kr * PH[cc * m + a]; } }
      /* symmetrise lightly */
      if (store) {
        const H = new Float64Array(m * N);
        for (let a = 0; a < m; a++) for (const b of nzb) for (let k = 0; k < D; k++) H[a * N + b * D + k] += c[b] * Jm[a * D + k];
        upd.push({ k: ev, idx: o.idx, H, R: Rsave, zlin, m });
      }
    }
    if (store) { xsF.set(x, ev * N); PsF.set(Pm, ev * NN); qinfo[ev * 2] = dt; qinfo[ev * 2 + 1] = jmp; }
    prev = t;
  }
  return { ll, nObs, xsF, PsF, qinfo, upd, N, D, x: Float64Array.from(x), P: Float64Array.from(Pm) };
}

/* RTS smoother with a general F: Pp = F Pf Fᵀ + Q, G = Pf Fᵀ Pp⁻¹ =
   (Pp⁻¹ F Pf)ᵀ, x_s = x_f + G (x_s,next − F x_f). Returns smoothed
   means/covs (flat per event) and the gains. */
export function smooth(f, L, th) {
  const { N } = L, NN = N * N, E = f.qinfo.length / 2;
  const xs = new Float64Array(E * N), Ps = new Float64Array(E * NN), G = new Float64Array(E * NN);
  xs.set(f.xsF.subarray((E - 1) * N, E * N), (E - 1) * N);
  Ps.set(f.PsF.subarray((E - 1) * NN, E * NN), (E - 1) * NN);
  const Pp = new Float64Array(NN), Lc = new Float64Array(NN), col = new Float64Array(N), Gk = new Float64Array(NN), dP = new Float64Array(NN), T = new Float64Array(NN), FP = new Float64Array(NN), Fx = new Float64Array(N);
  for (let k = E - 2; k >= 0; k--) {
    const Pf = f.PsF.subarray(k * NN, (k + 1) * NN), dt = f.qinfo[(k + 1) * 2], jmp = f.qinfo[(k + 1) * 2 + 1];
    Pp.set(Pf); predictStep(null, Pp, L, th, dt, jmp);
    /* F Pf: apply F to the rows only (no noise) */
    FP.set(Pf);
    if (L.trend && dt > 0) { const vo = L.vOff, D = L.D, phi = Math.exp(-dt / th.tau); for (let q = 0; q < D; q++) { const rk = q * N, rv = (vo + q) * N; for (let j = 0; j < N; j++) FP[rk + j] += dt * Pf[rv + j]; } for (let q = 0; q < D; q++) { const rv = (vo + q) * N; for (let j = 0; j < N; j++) FP[rv + j] *= phi; } }
    cholIn(Pp, N, Lc);
    for (let c = 0; c < N; c++) { for (let r = 0; r < N; r++) col[r] = FP[r * N + c]; cholSolveVec(Lc, N, col); for (let r = 0; r < N; r++) Gk[c * N + r] = col[r]; }
    G.set(Gk, k * NN);
    const xf = f.xsF.subarray(k * N, (k + 1) * N), xn = xs.subarray((k + 1) * N, (k + 2) * N), xo = xs.subarray(k * N, (k + 1) * N);
    Fx.set(xf); predictStep(Fx, null, L, th, dt, 0);
    for (let i = 0; i < N; i++) { let s = 0; const gi = i * N; for (let j = 0; j < N; j++) s += Gk[gi + j] * (xn[j] - Fx[j]); xo[i] = xf[i] + s; }
    const Pn = Ps.subarray((k + 1) * NN, (k + 2) * NN);
    for (let i = 0; i < NN; i++) dP[i] = Pn[i] - Pp[i];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += Gk[i * N + l] * dP[l * N + j]; T[i * N + j] = s; }
    const Po = Ps.subarray(k * NN, (k + 1) * NN);
    for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) { let s = 0; for (let l = 0; l < N; l++) s += T[i * N + l] * Gk[j * N + l]; const v = Pf[i * N + j] + s; Po[i * N + j] = v; Po[j * N + i] = v; }
  }
  return { xs, Ps, G, E, N };
}

/* Cov(x_a, x_b | all) for a ≤ b: G_a … G_{b−1} Ps_b, flat N×N */
export function crossCov(sm, a, b) {
  const { N } = sm, NN = N * N;
  let C = Float64Array.from(sm.Ps.subarray(b * NN, (b + 1) * NN));
  const T = new Float64Array(NN);
  for (let k = b - 1; k >= a; k--) {
    const Gk = sm.G.subarray(k * NN, (k + 1) * NN);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += Gk[i * N + l] * C[l * N + j]; T[i * N + j] = s; }
    C = Float64Array.from(T);
  }
  return C;
}

/* --------------------------------------------------------------- helpers */
export const softmaxAlr = (eta) => {
  const D = eta.length; let mx = 0; for (let k = 0; k < D; k++) mx = Math.max(mx, eta[k]);
  const p = new Float64Array(D + 1); let z = Math.exp(-mx); p[D] = z;
  for (let k = 0; k < D; k++) { p[k] = Math.exp(eta[k] - mx); z += p[k]; }
  for (let k = 0; k <= D; k++) p[k] /= z;
  return p;
};
export const alrOf = (shares) => { const D = shares.length - 1; return Float64Array.from({ length: D }, (_, k) => Math.log(shares[k] / shares[D])); };

export function makeRng(seed) {
  let s = seed >>> 0, spare = null;
  const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, normal() { if (spare != null) { const v = spare; spare = null; return v; } let a, b, r; do { a = 2 * u() - 1; b = 2 * u() - 1; r = a * a + b * b; } while (r >= 1 || r === 0); const f = Math.sqrt(-2 * Math.log(r) / r); spare = b * f; return a * f; } };
}
/* draw from N(mean, cov) (flat), n dims */
export function mvnDraw(mean, cov, n, rng, Lbuf) {
  const L = Lbuf || new Float64Array(n * n); cholIn(cov, n, L);
  const z = Float64Array.from({ length: n }, () => rng.normal()), out = Float64Array.from(mean);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j <= i; j++) s += L[i * n + j] * z[j]; out[i] += s; }
  return out;
}
export const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
export const quant = (a, q) => { const s = Float64Array.from(a).sort(); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
export { spdInv, cholIn, cholSolveVec };

/* =================================================================== fit */
/* settings vector, log scale: [log ω_1..ω_P, log d, log s, log J] */
/* settings, by name, on the log scale. noise: extra spread every reading
   carries beyond sampling, in points of each printed share (house weighting,
   frames, question order – what sampling theory can't see) */
export const paramNames = (P, o = {}) => [...Array.from({ length: P }, (_, k) => "w" + k), "d", "s", "J", ...(o.trend ? ["nu", "tau"] : []), ...(o.noise ? ["noise"] : [])];
const PRIOR_OF = { w: [0.008, 1.5], d: [0.002, 1.5], s: [0.1, 1.0], J: [0.03, 1.5], nu: [0.03, 1.5], tau: [90, 0.7], noise: [0.5, 1.0] };
export const unpack = (v, P, names = null) => {
  const nm = names || paramNames(P, { trend: v.length > P + 3 && v.length !== P + 4, noise: v.length === P + 4 || v.length === P + 6 });
  const o = { w: new Float64Array(P) };
  nm.forEach((n, i) => { if (n[0] === "w" && n !== "w") o.w[+n.slice(1)] = Math.exp(v[i]); else o[n] = Math.exp(v[i]); });
  return o;
};
export const DEFAULT_PRIOR = (P, trend = false, noise = false) => {
  const names = paramNames(P, { trend, noise });
  return { names, mean: names.map((n) => Math.log(PRIOR_OF[n[0] === "w" ? "w" : n][0])), sd: names.map((n) => PRIOR_OF[n[0] === "w" ? "w" : n][1]) };
};
const KAPPA_GRID = [0.35, 0.5, 0.7, 1, 1.41, 2, 2.83, 4];
const KAPPA_PRIOR_SD = 0.5;

/* readings → model observations: houses with one reading and no regular
   standing are folded out of the state – their lean, prior wide, touches
   only their own reading, so it is added to that reading's noise exactly */
export function prepare(readings, { t0, t1, minCore = 4, parties = PARTIES, coreOverride = null, trend = false, zero = "equal" }) {
  const obs = readings.filter((r) => r.day > t0 && r.day <= t1).map((r, i) => ({ ...r, idx: r.idx ?? i }));
  const cnt = {}; for (const r of obs) cnt[r.house] = (cnt[r.house] || 0) + 1;
  const isCore = (h) => (coreOverride ? coreOverride.has(h) : cnt[h] >= minCore && !/\(MRP\)$/.test(h));
  const lone = new Set(Object.keys(cnt).filter((h) => cnt[h] === 1 && !isCore(h)));
  const houses = [...new Set(obs.map((r) => r.house))].filter((h) => !lone.has(h));
  const zeroW = zero === "equal" ? null : new Map(houses.map((h) => [h, zero === "sqrt" ? Math.sqrt(cnt[h]) : cnt[h]]));
  const L = makeLayout(houses, new Set(houses.filter(isCore)), parties.length, trend, zeroW);
  /* lone houses ride as an extra non-core coefficient set with no block:
     their reading sees η only, with WIDE² (I + 11ᵀ) added to its noise */
  for (const h of lone) { const c = new Float64Array(L.nb); c[0] = 1; L.coef.set(h, c); L.nz.set(h, [0]); }
  L.lone = lone;
  return { obs, L, cnt };
}

/* the log posterior of a settings vector (κ held) */
export function logPost(v, ctx, kappa) {
  const P = ctx.L.P, pr = ctx.prior, th = unpack(v, P, pr.names);
  const f = runFilter(ctx.obs, ctx.L, ctx.events, th, { anchor: ctx.anchor, jumps: ctx.jumps, kappa, lone: ctx.L.lone });
  let lp = f.ll;
  for (let i = 0; i < v.length; i++) lp -= (v[i] - pr.mean[i]) ** 2 / (2 * pr.sd[i] ** 2);
  /* a settings vector the filter can't take (an overflow far out in a
     direction the data don't pin) has no posterior weight */
  return Number.isFinite(lp) ? lp : -Infinity;
}
function mapSearch(v0, ctx, kappa, { tol = 0.04, step0 = 0.7 } = {}) {
  const v = v0.slice(); let best = logPost(v, ctx, kappa), step = v.map(() => step0), evals = 1;
  for (let it = 0; it < 60 && Math.max(...step) > tol; it++) {
    for (let i = 0; i < v.length; i++) {
      if (step[i] <= tol) continue;
      let moved = false;
      for (const dir of [1, -1]) {
        const u = v.slice(); u[i] += dir * step[i];
        const l = logPost(u, ctx, kappa); evals++;
        if (l > best + 1e-9) { best = l; v[i] = u[i]; moved = true; break; }
      }
      if (!moved) step[i] /= 2;
    }
  }
  return { v, lp: best, evals };
}
function kappaSearch(v, ctx, kappa) {
  const th = unpack(v, ctx.L.P, ctx.prior.names);
  const pen = (k) => [...k.entries()].reduce((a, [h, x]) => a - (ctx.L.lone.has(h) ? 0 : Math.log(x) ** 2 / (2 * KAPPA_PRIOR_SD ** 2)), 0);
  const obj = () => runFilter(ctx.obs, ctx.L, ctx.events, th, { anchor: ctx.anchor, jumps: ctx.jumps, kappa, lone: ctx.L.lone }).ll + pen(kappa);
  for (let sweep = 0; sweep < 2; sweep++) for (const h of ctx.L.houses) {
    let best = kappa.get(h), bv = -Infinity;
    for (const k of KAPPA_GRID) { kappa.set(h, k); const o = obj(); if (o > bv) { bv = o; best = k; } }
    kappa.set(h, best);
  }
  return kappa;
}
/* numerical Hessian of logPost at v (central differences, step h) */
function hessian(v, ctx, kappa, h = 0.2) {
  const n = v.length, f0 = logPost(v, ctx, kappa), H = Array.from({ length: n }, () => new Float64Array(n));
  const at = (d) => logPost(v.map((x, i) => x + (d[i] || 0)), ctx, kappa);
  const fp = [], fm = [];
  for (let i = 0; i < n; i++) { const e = []; e[i] = h; fp[i] = at(e); e[i] = -h; fm[i] = at(e); H[i][i] = (fp[i] - 2 * f0 + fm[i]) / (h * h); }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const e = []; e[i] = h; e[j] = h; const pp = at(e); e[j] = -h; const pm = at(e); e[i] = -h; const mm = at(e); e[j] = h; const mp = at(e);
    H[i][j] = H[j][i] = (pp - pm - mp + mm) / (4 * h * h);
  }
  return H;
}

/* settings: MAP, κ, MAP again, then a Laplace mixture of M settings vectors
   drawn from N(mode, (−H)⁻¹) and importance-weighted by the exact posterior */
export function fitSettings(ctx, { start = null, M = 64, seed = 1, quick = false, inflate = 1.0 } = {}) {
  const P = ctx.L.P;
  const kappa = ctx.kappa0 ? new Map(ctx.kappa0) : new Map(ctx.L.houses.map((h) => [h, 1]));
  for (const h of ctx.L.lone) kappa.set(h, 1);
  for (const h of ctx.L.houses) if (!kappa.has(h)) kappa.set(h, 1);
  let v = start ? start.slice() : ctx.prior.mean.slice();
  let r = mapSearch(v, ctx, kappa, quick ? { step0: 0.3 } : {});
  if (!ctx.kappaFixed) { kappaSearch(r.v, ctx, kappa); r = mapSearch(r.v, ctx, kappa, { step0: 0.3 }); }
  v = r.v;
  const comps = [{ v, lp: r.lp, lq: 0, w: 1 }];
  if (M > 1) {
    const H = hessian(v, ctx, kappa);
    const n = v.length, A = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A[i * n + j] = -H[i][j];
    /* covariance = A⁻¹; guard a flat or indefinite direction with the prior */
    for (let i = 0; i < n; i++) A[i * n + i] = Math.max(A[i * n + i], 1 / ctx.prior.sd[i] ** 2) + 1e-6;
    let C = spdInv(A, n);
    for (let i = 0; i < n * n; i++) C[i] *= inflate * inflate;
    const Lc = new Float64Array(n * n), ld = cholIn(C, n, Lc);
    const rng = makeRng(seed);
    const lq = (u) => { const dlt = Float64Array.from(u, (x, i) => x - v[i]); const s = Float64Array.from(dlt); cholSolveVec(Lc, n, s); let q = 0; for (let i = 0; i < n; i++) q += dlt[i] * s[i]; return -0.5 * q; };
    comps[0].lq = 0;
    for (let m = 1; m < M; m++) {
      const z = Float64Array.from({ length: n }, () => rng.normal());
      const u = v.slice(); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j <= i; j++) s += Lc[i * n + j] * z[j]; u[i] += s; }
      comps.push({ v: u, lp: logPost(u, ctx, kappa), lq: lq(u) });
    }
    /* self-normalised importance weights; the mode enters as a draw of q too */
    const lw = comps.map((c) => (Number.isFinite(c.lp) && Number.isFinite(c.lq) ? c.lp - c.lq : -Infinity)), mx = Math.max(...lw);
    let z = 0; comps.forEach((c, i) => { c.w = Number.isFinite(mx) ? Math.exp(lw[i] - mx) : (i === 0 ? 1 : 0); z += c.w; });
    comps.forEach((c) => { c.w /= z; });
    ctx.laplace = { sd: Array.from({ length: n }, (_, i) => Math.sqrt(C[i * n + i])), ess: 1 / comps.reduce((a, c) => a + c.w * c.w, 0) };
  }
  return { mode: v, kappa, comps: comps.sort((a, b) => b.w - a.w), lpMode: r.lp };
}

/* ============================================================ the result */
function allocate(comps, n) {
  const keep = comps.filter((c) => c.w * n >= 0.5), tot = keep.reduce((a, c) => a + c.w, 0);
  const al = keep.map((c) => ({ c, n: Math.floor((c.w / tot) * n), rem: ((c.w / tot) * n) % 1 }));
  let left = n - al.reduce((a, x) => a + x.n, 0);
  for (const a of [...al].sort((p, q) => q.rem - p.rem)) { if (left <= 0) break; a.n++; left--; }
  return al.filter((a) => a.n > 0);
}
const block = (M, N, rows, cols) => { const r = rows.length, c = cols.length, o = new Float64Array(r * c); for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) o[i * c + j] = M[rows[i] * N + cols[j]]; return o; };
/* the linear map from the state to [η; lean_h] */
function leanMap(L, h) {
  const { N, D, nb } = L, c = L.coef.get(h), A = new Float64Array(2 * D * N);
  for (let k = 0; k < D; k++) A[k * N + k] = 1;
  if (c && !L.lone.has(h)) for (let b = 1; b < L.nbLean; b++) if (c[b]) for (let k = 0; k < D; k++) A[(D + k) * N + b * D + k] = c[b];
  return A;
}
function mapMoments(A, r, x, P, N) {
  const m = new Float64Array(r), AP = new Float64Array(r * N), C = new Float64Array(r * r);
  for (let i = 0; i < r; i++) { let s = 0; for (let j = 0; j < N; j++) { s += A[i * N + j] * x[j]; } m[i] = s; }
  for (let i = 0; i < r; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += A[i * N + l] * P[l * N + j]; AP[i * N + j] = s; }
  for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) { let s = 0; for (let l = 0; l < N; l++) s += AP[i * N + l] * A[j * N + l]; C[i * r + j] = s; }
  return { m, C };
}

/* fitPrimary: settings, then nDraw posterior draws at the output days.
   opts: { t0, t1, anchor, jumps, days, pairs: [[a, b]], minCore, prior, start, M, nDraw, seed, kappa0, parties } */
export function fitPrimary(readings, opts) {
  const parties = opts.parties || PARTIES, P = parties.length, D = P - 1;
  const { obs, L, cnt } = prepare(readings, { t0: opts.t0, t1: opts.t1, minCore: opts.minCore ?? 4, parties, coreOverride: opts.coreOverride, trend: !!opts.trend });
  const days = [...new Set([...(opts.days || []), ...(opts.pairs || []).flat(), opts.t1].filter((d) => d >= opts.t0 && d <= opts.t1))];
  const extra = (opts.eventDays || []).filter((d) => d > opts.t0 && d <= opts.t1);
  const events = [...new Set([opts.t0, ...obs.map((o) => o.day), ...days, ...extra, ...[...opts.jumps].filter((d) => d > opts.t0 && d <= opts.t1)])].sort((a, b) => a - b);
  const ctx = { obs, L, events, anchor: opts.anchor, jumps: opts.jumps, prior: opts.prior || DEFAULT_PRIOR(P, !!opts.trend, !!opts.noise), kappa0: opts.kappa0, kappaFixed: opts.kappaFixed };
  const T0 = Date.now();
  const S = fitSettings(ctx, { start: opts.start, M: opts.M ?? 64, seed: opts.seed ?? 1 });
  const T1 = Date.now();
  const nDraw = opts.nDraw ?? 2000, rng = makeRng(opts.seed ?? 20261123);
  const evIdx = new Map(events.map((d, i) => [d, i]));
  const sh = new Map(days.map((d) => [d, new Float64Array(nDraw * P)]));
  const pairDraws = new Map((opts.pairs || []).map(([a, b]) => [a + "|" + b, new Float64Array(nDraw * P)]));
  const leanDraws = new Map(L.houses.map((h) => [h, new Float64Array(nDraw * P)]));
  const nowIdx = evIdx.get(opts.t1), N = L.N;
  let di = 0, best = null;
  const Lbuf = new Float64Array(4 * D * D);
  const alloc = allocate(S.comps, nDraw);
  for (const { c, n } of alloc) {
    const th = unpack(c.v, P, ctx.prior.names);
    const f = runFilter(obs, L, events, th, { anchor: ctx.anchor, jumps: ctx.jumps, kappa: S.kappa, lone: L.lone, store: true });
    const sm = smooth(f, L, th);
    if (c === S.comps.find((q) => q.v === S.mode) || (!best && c === alloc[0].c)) best = best || { th, f, sm };
    const etaIdx = Array.from({ length: D }, (_, k) => k);
    for (const d of days) {
      const k = evIdx.get(d), x = sm.xs.subarray(k * N, k * N + D), C = block(sm.Ps.subarray(k * N * N, (k + 1) * N * N), N, etaIdx, etaIdx);
      const out = sh.get(d);
      for (let j = 0; j < n; j++) { const e = mvnDraw(x, C, D, rng, Lbuf); out.set(softmaxAlr(e), (di + j) * P); }
    }
    for (const [a, b] of opts.pairs || []) {
      const ka = evIdx.get(a), kb = evIdx.get(b), lo = Math.min(ka, kb), hi = Math.max(ka, kb);
      const X = crossCov(sm, lo, hi), mean2 = new Float64Array(2 * D), C2 = new Float64Array(4 * D * D);
      mean2.set(sm.xs.subarray(ka * N, ka * N + D), 0); mean2.set(sm.xs.subarray(kb * N, kb * N + D), D);
      const Pa = sm.Ps.subarray(ka * N * N, (ka + 1) * N * N), Pb = sm.Ps.subarray(kb * N * N, (kb + 1) * N * N);
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
        C2[i * 2 * D + j] = Pa[i * N + j]; C2[(D + i) * 2 * D + D + j] = Pb[i * N + j];
        const xab = ka <= kb ? X[i * N + j] : X[j * N + i];      // Cov(η_a,i, η_b,j)
        C2[i * 2 * D + D + j] = xab; C2[(D + j) * 2 * D + i] = xab;
      }
      const out = pairDraws.get(a + "|" + b);
      for (let j = 0; j < n; j++) {
        const e = mvnDraw(mean2, C2, 2 * D, rng, Lbuf);
        const pa = softmaxAlr(e.subarray(0, D)), pb = softmaxAlr(e.subarray(D));
        for (let q = 0; q < P; q++) out[(di + j) * P + q] = pa[q] - pb[q];
      }
    }
    const xN = sm.xs.subarray(nowIdx * N, (nowIdx + 1) * N), PN = sm.Ps.subarray(nowIdx * N * N, (nowIdx + 1) * N * N);
    for (const h of L.houses) {
      const { m, C } = mapMoments(leanMap(L, h), 2 * D, xN, PN, N), out = leanDraws.get(h);
      for (let j = 0; j < n; j++) {
        const e = mvnDraw(m, C, 2 * D, rng, Lbuf), pc = softmaxAlr(e.subarray(0, D)), mu = e.subarray(0, D).map((v, i) => v + e[D + i]), ph = softmaxAlr(mu);
        for (let q = 0; q < P; q++) out[(di + j) * P + q] = ph[q] - pc[q];
      }
    }
    di += n;
  }
  if (!best) { const th = unpack(S.mode, P, ctx.prior.names); const f = runFilter(obs, L, events, th, { anchor: ctx.anchor, jumps: ctx.jumps, kappa: S.kappa, lone: L.lone, store: true }); best = { th, f, sm: smooth(f, L, th) }; }
  const T2 = Date.now();
  /* leave-one-out at the mode: smoothed state without reading i, and its
     effect on today's state through the smoother's cross-covariance */
  const covToEnd = new Array(events.length), E = events.length, NN = N * N;
  covToEnd[E - 1] = Float64Array.from(best.sm.Ps.subarray((E - 1) * NN, E * NN));
  { const Tm = new Float64Array(NN); for (let k = E - 2; k >= 0; k--) { const Gk = best.sm.G.subarray(k * NN, (k + 1) * NN), Cn = covToEnd[k + 1], C = new Float64Array(NN); for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += Gk[i * N + l] * Cn[l * N + j]; C[i * N + j] = s; } covToEnd[k] = C; } }
  const updByIdx = new Map(best.f.upd.map((u) => [u.idx, u]));
  const xEnd = best.sm.xs.subarray((E - 1) * N, E * N);
  const sharesOfState = (x, h) => {
    const c = h ? L.coef.get(h) : null, mu = new Float64Array(D);
    for (let k = 0; k < D; k++) { mu[k] = x[k]; if (c && !L.lone.has(h)) for (let b = 1; b < L.nbLean; b++) if (c[b]) mu[k] += c[b] * x[b * D + k]; }
    return softmaxAlr(mu);
  };
  const influence = (idx) => {
    const u = updByIdx.get(idx);
    if (!u) return null;
    const { k, H, R, zlin, m } = u, x = best.sm.xs.subarray(k * N, (k + 1) * N), Pk = best.sm.Ps.subarray(k * NN, (k + 1) * NN);
    const PH = new Float64Array(N * m), Sx = new Float64Array(m * m), r = new Float64Array(m);
    for (let i = 0; i < N; i++) for (let a = 0; a < m; a++) { let s = 0; for (let j = 0; j < N; j++) s += Pk[i * N + j] * H[a * N + j]; PH[i * m + a] = s; }
    for (let a = 0; a < m; a++) { let hx = 0; for (let j = 0; j < N; j++) hx += H[a * N + j] * x[j]; r[a] = hx - zlin[a]; for (let b2 = 0; b2 < m; b2++) { let s = 0; for (let j = 0; j < N; j++) s += H[a * N + j] * PH[j * m + b2]; Sx[a * m + b2] = R[a * m + b2] - s; } }
    /* (R − H P Hᵀ) is the leave-one-out residual covariance; guard tiny */
    for (let a = 0; a < m; a++) Sx[a * m + a] = Math.max(Sx[a * m + a], 1e-9);
    const Si = spdInv(Sx, m), cvec = new Float64Array(m);
    for (let a = 0; a < m; a++) { let s = 0; for (let b2 = 0; b2 < m; b2++) s += Si[a * m + b2] * r[b2]; cvec[a] = s; }
    const xLoo = Float64Array.from(x); for (let i = 0; i < N; i++) { let s = 0; for (let a = 0; a < m; a++) s += PH[i * m + a] * cvec[a]; xLoo[i] += s; }
    const Ce = covToEnd[k], xEndLoo = Float64Array.from(xEnd);       // Cov(x_k, x_end) = Ce
    for (let i = 0; i < N; i++) { let s = 0; for (let a = 0; a < m; a++) { let ch = 0; for (let j = 0; j < N; j++) ch += Ce[j * N + i] * H[a * N + j]; s += ch * cvec[a]; } xEndLoo[i] += s; }
    const o = obs.find((q) => q.idx === idx);
    const lvl = sharesOfState(xLoo, null), all = sharesOfState(x, null), withH = sharesOfState(x, o.house);
    const nowAll = sharesOfState(xEnd, null), nowLoo = sharesOfState(xEndLoo, null);
    return { level: lvl, he: L.lone.has(o.house) ? null : withH.map((v, i) => v - all[i]), dNow: nowAll.map((v, i) => v - nowLoo[i]) };
  };
  /* each house's smoothed lean (points) at given days, at the mode */
  /* the average pollster's shares at a day (an event day), at the mode */
  const levelAt = (d) => { const k = evIdx.get(d); return k == null ? null : sharesOfState(best.sm.xs.subarray(k * N, (k + 1) * N), null); };
  const leanPath = (h, ds) => ds.map((d) => { const k = evIdx.get(d); if (k == null) return null; const x = best.sm.xs.subarray(k * N, (k + 1) * N); const a = sharesOfState(x, null), b = sharesOfState(x, h); return b.map((v, i) => v - a[i]); });
  const T3 = Date.now();
  return { parties, L, obs, cnt, events, settings: S, ctx, nDraw, shares: (d) => sh.get(d), pair: (a, b) => pairDraws.get(a + "|" + b), lean: (h) => leanDraws.get(h),
    influence, leanPath, levelAt, best, timing: { settings: T1 - T0, draws: T2 - T1, loo: T3 - T2 } };
}
/* summaries over draws for party q */
export function col(draws, P, q) { const n = draws.length / P, o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = draws[i * P + q]; return o; }

/* ======================================================= vote by group */
/* The vote-by-group model.

   WHAT IT ESTIMATES, for each group (18–34s, renters, Queenslanders…): how
   far the group's vote sits from all voters', party by party, day by day.
   The group's figures are then the national model's figures moved by that
   gap.

   SCALE. The gap is measured as each poll measures it: the group's shares
   against the SAME poll's all-voters shares, as log-ratios against others,
       z = alr(group) − alr(all voters).
   Measuring a poll against its own total removes its lean on the level
   exactly, as the site always has.

   STATE  [γ_t, β_1..β_H] (four numbers each)
          γ  the gap for the average pollster; a random walk, ω a day on
             each log share
          β  each pollster's own reading of the gap – a house that finds
             young voters greener than the others do – a random effect,
             prior N(0, s²) on each log share, fixed through the term
   POLL   z = γ + β_house + e, e ~ N(0, κ · V), V the sampling covariance of
          the gap: the group (n·s respondents) is part of the poll's own
          total, so V = A_g Σ_g A_gᵀ + A_r Σ_r A_rᵀ for the group and the rest
          of the sample (exact to first order), plus rounding.
   ω, s and κ are shared by the groups of one set (age, gender, …) and
   integrated over a grid, each point weighted by prior × likelihood (the
   groups of a set are one sample cut several ways, so their summed
   likelihood is tempered by (G−1)/G). */
export const GRID = { w: [0.0003, 0.001, 0.003, 0.009], s: [0.03, 0.1, 0.3], kappa: [0.7, 1, 1.41, 2, 2.83] };
const PRIOR_SD0 = 1.0;

/* observation vector and covariance for one reading (full categories only) */
export function gapObs(o) {
  const P = o.g.length, D = P - 1;
  if (o.g.some((v) => v == null) || o.t.some((v) => v == null)) return null;
  const fl = (v) => Math.max(v, 0.5) / 100;
  const g = o.g.map(fl), t = o.t.map(fl);
  const gs = g.reduce((a, b) => a + b, 0), ts = t.reduce((a, b) => a + b, 0);
  for (let k = 0; k < P; k++) { g[k] /= gs; t[k] /= ts; }
  const s = Math.min(Math.max(o.s, 0.02), 0.98);
  const r = t.map((v, k) => Math.max((v - s * g[k]) / (1 - s), 0.003));
  const rs = r.reduce((a, b) => a + b, 0); for (let k = 0; k < P; k++) r[k] /= rs;
  const nTot = o.n / s;
  const z = new Float64Array(D);
  for (let k = 0; k < D; k++) z[k] = Math.log(g[k] / g[D]) - Math.log(t[k] / t[D]);
  const Ag = new Float64Array(D * P), Ar = new Float64Array(D * P);
  for (let k = 0; k < D; k++) for (let j = 0; j < P; j++) {
    const dg = (j === k ? 1 / g[k] : 0) - (j === D ? 1 / g[D] : 0), dt = (j === k ? 1 / t[k] : 0) - (j === D ? 1 / t[D] : 0);
    Ag[k * P + j] = dg - s * dt; Ar[k * P + j] = -(1 - s) * dt;
  }
  const cov = (p, n) => { const C = new Float64Array(P * P); for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) C[i * P + j] = ((i === j ? p[i] : 0) - p[i] * p[j]) / n; return C; };
  const Cg = cov(g, nTot * s), Cr = cov(r, nTot * (1 - s));
  const V = new Float64Array(D * D);
  for (const [A, C] of [[Ag, Cg], [Ar, Cr]]) for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) { let v = 0; for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) v += A[a * P + i] * C[i * P + j] * A[b * P + j]; V[a * D + b] += v; }
  /* rounding of both printed sets (whole points) */
  const rr = (1 / 12) / 1e4;
  for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) V[a * D + b] += rr * ((a === b ? 1 / (g[a] * g[a]) + 1 / (t[a] * t[a]) : 0) + 1 / (g[D] * g[D]) + 1 / (t[D] * t[D]));
  return { z, V, day: o.day, house: o.house };
}

/* one group's filter: state [γ, β_h…]; returns ll and (stored) moments */
export function groupFilter(obs, houses, th, { t0, events, store = false }) {
  const D = obs[0].z.length, H = houses.length, N = D * (1 + H), NN = N * N;
  const hi = new Map(houses.map((h, i) => [h, 1 + i]));
  const x = new Float64Array(N), P = new Float64Array(NN);
  const iJ = (i, j) => (i === j ? 1 : 0) + 1;
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) P[i * N + j] = PRIOR_SD0 * PRIOR_SD0 * iJ(i, j);
  for (let b = 1; b <= H; b++) for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) P[(b * D + i) * N + b * D + j] = th.s * th.s * iJ(i, j);
  const w2 = th.w * th.w;
  let ll = 0, prev = t0, oi = 0;
  const xs = store ? new Float64Array(events.length * N) : null, Ps = store ? new Float64Array(events.length * NN) : null, dts = store ? new Float64Array(events.length) : null;
  const PH = new Float64Array(N * D), S = new Float64Array(D * D), Ls = new Float64Array(D * D), v = new Float64Array(D), tmp = new Float64Array(D);
  for (let e = 0; e < events.length; e++) {
    const t = events[e], dt = t - prev;
    if (dt > 0) for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) P[i * N + j] += dt * w2 * iJ(i, j);
    while (oi < obs.length && obs[oi].day === t) {
      const o = obs[oi++], b = o.noLean ? null : hi.get(o.house), bo = b == null ? -1 : b * D;
      /* H = [I | … I at block b …]; a reading with no lean of its own (the
         count) sees γ alone, and its error is given (fixedV), not sampling */
      const kv = o.fixedV ? 1 : th.kappa;
      for (let r = 0; r < N; r++) for (let k = 0; k < D; k++) PH[r * D + k] = P[r * N + k] + (bo >= 0 ? P[r * N + bo + k] : 0);
      for (let a = 0; a < D; a++) for (let c = 0; c < D; c++) S[a * D + c] = kv * o.V[a * D + c] + PH[a * D + c] + (bo >= 0 ? PH[(bo + a) * D + c] : 0);
      for (let a = 0; a < D; a++) v[a] = o.z[a] - x[a] - (bo >= 0 ? x[bo + a] : 0);
      const ld = cholIn(S, D, Ls);
      tmp.set(v); cholSolveVec(Ls, D, tmp);
      let q = 0; for (let a = 0; a < D; a++) q += v[a] * tmp[a];
      ll += -0.5 * (D * LOG2PI + ld + q);
      const Kg = new Float64Array(N * D), col = new Float64Array(D);
      for (let r = 0; r < N; r++) { for (let a = 0; a < D; a++) col[a] = PH[r * D + a]; cholSolveVec(Ls, D, col); for (let a = 0; a < D; a++) Kg[r * D + a] = col[a]; }
      for (let r = 0; r < N; r++) { let s = 0; for (let a = 0; a < D; a++) s += Kg[r * D + a] * v[a]; x[r] += s; }
      for (let r = 0; r < N; r++) for (let a = 0; a < D; a++) { const k = Kg[r * D + a]; if (!k) continue; for (let c = 0; c < N; c++) P[r * N + c] -= k * PH[c * D + a]; }
    }
    if (store) { xs.set(x, e * N); Ps.set(P, e * NN); dts[e] = dt; }
    prev = t;
  }
  return { ll, xs, Ps, dts, N, D, H, x, P };
}
/* RTS smoother (F = I; only γ drifts) with gains for cross-covariances */
export function groupSmooth(f, th) {
  const { N, D } = f, NN = N * N, E = f.dts.length, w2 = th.w * th.w;
  const xs = new Float64Array(E * N), Ps = new Float64Array(E * NN), G = new Float64Array(E * NN);
  xs.set(f.xs.subarray((E - 1) * N), (E - 1) * N); Ps.set(f.Ps.subarray((E - 1) * NN), (E - 1) * NN);
  const Pp = new Float64Array(NN), Lc = new Float64Array(NN), col = new Float64Array(N), Gk = new Float64Array(NN), T = new Float64Array(NN);
  for (let k = E - 2; k >= 0; k--) {
    const Pf = f.Ps.subarray(k * NN, (k + 1) * NN), dt = f.dts[k + 1];
    Pp.set(Pf); for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pp[i * N + j] += dt * w2 * ((i === j ? 1 : 0) + 1);
    cholIn(Pp, N, Lc);
    for (let c = 0; c < N; c++) { for (let r = 0; r < N; r++) col[r] = Pf[r * N + c]; cholSolveVec(Lc, N, col); for (let r = 0; r < N; r++) Gk[c * N + r] = col[r]; }
    G.set(Gk, k * NN);
    const xf = f.xs.subarray(k * N, (k + 1) * N), xn = xs.subarray((k + 1) * N, (k + 2) * N), xo = xs.subarray(k * N, (k + 1) * N);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += Gk[i * N + j] * (xn[j] - xf[j]); xo[i] = xf[i] + s; }
    const Pn = Ps.subarray((k + 1) * NN, (k + 2) * NN);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += Gk[i * N + l] * (Pn[l * N + j] - Pp[l * N + j]); T[i * N + j] = s; }
    const Po = Ps.subarray(k * NN, (k + 1) * NN);
    for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) { let s = 0; for (let l = 0; l < N; l++) s += T[i * N + l] * Gk[j * N + l]; const v = Pf[i * N + j] + s; Po[i * N + j] = v; Po[j * N + i] = v; }
  }
  return { xs, Ps, G, E, N, D };
}
function crossGamma(sm, a, b) {               // Cov(γ_a, γ_b), a ≤ b, D×D
  const { N, D } = sm, NN = N * N;
  let C = Float64Array.from(sm.Ps.subarray(b * NN, (b + 1) * NN)); const T = new Float64Array(NN);
  for (let k = b - 1; k >= a; k--) { const Gk = sm.G.subarray(k * NN, (k + 1) * NN); for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += Gk[i * N + l] * C[l * N + j]; T[i * N + j] = s; } C = Float64Array.from(T); }
  const o = new Float64Array(D * D); for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) o[i * D + j] = C[i * N + j]; return o;
}

/* fit one set: grid over (ω, s, κ), then per group draws of γ at the output
   days and of (γ_a, γ_b) for each pair. raw: readings of this set. */
export function fitSet(raw, { t0, t1, days, pairs = [], nDraw = 2000, seed = 1, grid = GRID }) {
  const byGroup = new Map();
  for (const r of raw) {
    const o = r.zV ? { z: Float64Array.from(r.zV.z), V: Float64Array.from(r.zV.V), day: r.day, house: r.house, noLean: !!r.noLean, fixedV: true } : gapObs(r);
    if (!o || o.day > t1) continue;
    (byGroup.get(r.group) || byGroup.set(r.group, []).get(r.group)).push({ ...o, src: r });
  }
  const groups = [...byGroup.keys()], G = groups.length;
  const temper = G > 1 ? (G - 1) / G : 1;
  const prep = groups.map((g) => {
    const obs = byGroup.get(g).sort((a, b) => a.day - b.day);
    const houses = [...new Set(obs.filter((o) => !o.noLean).map((o) => o.house))];
    const tFirst = Math.min(obs[0].day, t0) - 1;
    const evs = [...new Set([tFirst, ...obs.map((o) => o.day), ...days.filter((d) => d >= tFirst && d <= t1), ...pairs.flat().filter((d) => d >= tFirst && d <= t1), t1])].sort((a, b) => a - b);
    return { g, obs, houses, tFirst, events: evs };
  });
  /* grid weights (log prior: ω, s, κ log-uniform on the grid; κ mildly
     centred on 1) */
  const rows = [];
  for (const w of grid.w) for (const s of grid.s) for (const kappa of grid.kappa) {
    const th = { w, s, kappa };
    let ll = 0; for (const p of prep) ll += groupFilter(p.obs, p.houses, th, { t0: p.tFirst, events: p.events }).ll;
    rows.push({ th, ll: temper * ll - Math.log(kappa) ** 2 / (2 * 0.5 ** 2) });
  }
  const mx = Math.max(...rows.map((r) => r.ll)); let z = 0; for (const r of rows) { r.w = Math.exp(r.ll - mx); z += r.w; } for (const r of rows) r.w /= z;
  rows.sort((a, b) => b.w - a.w);
  /* allocate draws */
  const keep = rows.filter((r) => r.w * nDraw >= 0.5), tot = keep.reduce((a, r) => a + r.w, 0);
  const al = keep.map((r) => ({ r, n: Math.floor((r.w / tot) * nDraw), rem: ((r.w / tot) * nDraw) % 1 }));
  let left = nDraw - al.reduce((a, x) => a + x.n, 0); for (const a of [...al].sort((p, q) => q.rem - p.rem)) { if (left-- <= 0) break; a.n++; }
  const rng = makeRng(seed);
  const out = new Map();
  for (const p of prep) {
    const D = p.obs[0].z.length;
    const gd = new Map(days.filter((d) => d >= p.tFirst && d <= t1).concat([t1]).map((d) => [d, new Float64Array(nDraw * D)]));
    const pd = new Map(pairs.map(([a, b]) => [a + "|" + b, new Float64Array(nDraw * 2 * D)]));
    const ev = new Map(p.events.map((d, i) => [d, i]));
    let di = 0, bestSm = null;
    for (const { r, n } of al) {
      if (!n) continue;
      const f = groupFilter(p.obs, p.houses, r.th, { t0: p.tFirst, events: p.events, store: true }), sm = groupSmooth(f, r.th);
      if (!bestSm) bestSm = { sm, th: r.th, f };
      const N = sm.N, NN = N * N;
      for (const [d, arr] of gd) {
        const k = ev.get(d), m = sm.xs.subarray(k * N, k * N + D), C = new Float64Array(D * D);
        for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) C[i * D + j] = sm.Ps[k * NN + i * N + j];
        for (let j = 0; j < n; j++) arr.set(mvnDraw(m, C, D, rng), (di + j) * D);
      }
      for (const [a, b] of pairs) {
        const ka = ev.get(a), kb = ev.get(b); if (ka == null || kb == null) continue;
        const lo = Math.min(ka, kb), hi = Math.max(ka, kb), X = crossGamma(sm, lo, hi);
        const m2 = new Float64Array(2 * D), C2 = new Float64Array(4 * D * D);
        for (let i = 0; i < D; i++) { m2[i] = sm.xs[ka * N + i]; m2[D + i] = sm.xs[kb * N + i]; }
        for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
          C2[i * 2 * D + j] = sm.Ps[ka * NN + i * N + j]; C2[(D + i) * 2 * D + D + j] = sm.Ps[kb * NN + i * N + j];
          const xab = ka <= kb ? X[i * D + j] : X[j * D + i];
          C2[i * 2 * D + D + j] = xab; C2[(D + j) * 2 * D + i] = xab;
        }
        const arr = pd.get(a + "|" + b);
        for (let j = 0; j < n; j++) arr.set(mvnDraw(m2, C2, 2 * D, rng), (di + j) * 2 * D);
      }
      di += n;
    }
    /* each house's own reading of the gap (β) at the best grid point */
    const N = bestSm.sm.N, E = bestSm.sm.E;
    const beta = Object.fromEntries(p.houses.map((h, i) => [h, Array.from({ length: D }, (_, k) => bestSm.sm.xs[(E - 1) * N + (1 + i) * D + k])]));
    out.set(p.g, { draws: gd, pairs: pd, obs: p.obs, houses: p.houses, beta, D, first: p.obs[0].day });
  }
  return { groups: out, grid: rows.slice(0, 6).map((r) => ({ omega: r.th.w, s: r.th.s, kappa: r.th.kappa, weight: +r.w.toFixed(3) })) };
}

/* ============================================================== anchors */
/* the polls' final consensus (this model, election eve) minus the count at
   the 2007–2025 elections, mean and spread in points (spread = sd·√(1+1/n),
   the mean's own doubt included; One Nation from the three elections it was
   polled apart) – .build/analysis/primary-bayes run-history.mjs */
export const PRIM_MISS = { alp: [1.03, 2.16], lnp: [-0.70, 2.19], grn: [0.56, 0.70], onp: [0.78, 1.26], oth: [-1.22, 1.25] };
/* the prior on the election day: the count moved by the polls' average miss
   at past elections (miss: { party: [mean, sd] } in points, the polls'
   final consensus minus the count), on the log-ratio scale */
export function anchorFrom(result, miss, parties = PARTIES) {
  const sh = parties.map((k) => Math.max(0.1, (result[k] ?? 0) + (miss && miss[k] ? miss[k][0] : 0)) / 100);
  const tot = sh.reduce((a, b) => a + b, 0), s = sh.map((v) => v / tot);
  const mean = alrOf(s), D = parties.length - 1;
  const sd = parties.map((k, i) => ((miss && miss[k] ? miss[k][1] : 2) / 100) / s[i]);
  const cov = new Float64Array(D * D);
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) cov[i * D + j] = (i === j ? sd[i] ** 2 : 0) + sd[D] ** 2;
  return { mean, cov };
}

/* ============================================================ undecided */
/* The undecided share on one basis (can't say with no leaner asked, or
   still undecided after a leaner) is the same model with two categories,
   undecided and decided: each pollster's lean on it (its own wording) drifts,
   the regular pollsters average zero, each counting once. There is no count
   to start from, so the prior on the first day is wide around the first
   readings. readings: [{ house, day, n (all respondents), und, idx }].
   Returns monthly summaries at `months` [{ ym, day }], today and a month
   ago, each house's lean, and (pairs) the change between two days. */
export const UND_PARTIES = ["und", "dec"];
export function fitUndecided(readings, { t0, t1, months, pairs = [], nDraw = 2000, seed = 20261126, M = 16, minCore = 4 }) {
  const rs = readings.filter((r) => r.und > 0 && r.und < 50 && r.day > t0 && r.day <= t1).map((r, i) => {
    const vals = [r.und, 100 - r.und];
    return { ...r, idx: r.idx ?? i, cats: [[0], [1]], vals, full: true, step: stepOf([r.und]) };
  });
  if (rs.length < 2) return null;
  const first = rs.slice(0, Math.min(5, rs.length)).map((r) => r.und).sort((a, b) => a - b)[Math.floor(Math.min(5, rs.length) / 2)];
  const anchor = { mean: Float64Array.from([Math.log(first / (100 - first))]), cov: Float64Array.from([0.4 ** 2]) };
  const days = months.map((m) => m.day).filter((d) => d > t0 && d <= t1);
  const fit = fitPrimary(rs, { t0, t1, anchor, jumps: new Set(), parties: UND_PARTIES, days, pairs, nDraw, seed, M, minCore });
  const colU = (draws) => { const n = draws.length / 2, o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = 100 * draws[i * 2]; return o; };
  const sum = (c) => { const lo = quant(c, 0.025), hi = quant(c, 0.975); return { v: mean(c), lo, hi, ci: (hi - lo) / 2 }; };
  const out = months.filter((m) => m.day > t0 && m.day <= t1).map((m) => ({ ym: m.ym, day: m.day, ...sum(colU(fit.shares(m.day))) }));
  const pairOut = pairs.map(([a, b]) => { const c = colU(fit.pair(a, b)); return { a, b, ...sum(c), pUp: mean(c.map((v) => (v > 0 ? 1 : 0))) }; });
  const leans = Object.fromEntries(fit.L.houses.map((h) => { const s = sum(colU(fit.lean(h))); return [h, s]; }));
  return { months: out, now: sum(colU(fit.shares(t1))), pairs: pairOut, leans, core: fit.L.core, houses: [...new Set(rs.map((r) => r.house))],
    n: rs.length, ess: fit.ctx.laplace ? fit.ctx.laplace.ess : null, kappa: Object.fromEntries(fit.settings.kappa) };
}
