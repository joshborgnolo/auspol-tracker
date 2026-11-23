/* group-span.mjs – the vote-by-group model through every term (1987 to today).

   WHAT IT ESTIMATES, for each group (18–34s, Queenslanders, rural seats…):
   how far the group's vote sits from all voters', party by party, day by
   day, as ONE slow random walk from the group's first reading to today. A
   group's figures are the all-voters figures moved by that gap. Because the
   gap is one walk, it has one value on each polling day, read from both
   sides: the term that closes there and the term that opens there meet.

   SCALE. Nested log-ratios, so a table that folds One Nation (or the
   Greens) into others still reads, on the coordinates it printed:
       c0 = log(Labor / R1)   c1 = log(Coalition / R1)   R1 = Greens + ON + others
       c2 = log(Greens / R2)                             R2 = ON + others
       c3 = log(One Nation / others)
   A reading's level is the coordinates it can see: 4 (all apart), 3 (One
   Nation inside others), 2 (Greens too). The gap is the group's coordinates
   less the same reading's all-voters coordinates, so a poll's lean on the
   level cancels, as it always has.

   STATE  [γ, μ, β_slot…] (four numbers each)
     γ  the gap as the count would measure it; a random walk, ω a day.
     μ  the polls' shared offset from the count (sets the count cuts: states
        and AEC seat types only): pollsters' "rural" is not the AEC's rural
        seats, and their state samples have their own biases. A slow random
        walk (ω_μ), so the polls' offset measured at one election carries
        into the term and drifts until the next count measures it again –
        the group analogue of drawing the all-voters line through the counts.
     β  each pollster's own reading of the gap, a random effect N(0, s²),
        fixed while the pollster keeps publishing the cut (a break of two
        years starts afresh); the AES is one house throughout. A house with
        fewer than three readings of the group gets no slot of its own: its
        lean joins the reading's noise (exact for a single reading).
   READINGS
     poll   z = γ + μ + β + e,  e ~ N(0, κ·V)
     AES    z = γ + β_AES + e,  e ~ N(0, κ·V)
     count  z = γ + e,          e ~ N(0, V), V a hundredth of a point
   V is the gap's sampling covariance (the group is part of the poll's own
   sample: the group and the rest of the sample, to first order) plus the
   rounding of both printed sets.
   The settings (ω, s, κ, and ω_μ where the count cuts the set) are shared by
   a set's groups and integrated over a grid, each point weighted by prior ×
   likelihood (the groups of one set are one sample cut several ways, so
   their summed likelihood is tempered by (G−1)/G).

   COMPUTATION. A Kalman filter over the readings' days with slots reused as
   houses come and go (a slot's reset is a transition that zeroes the block
   and lays down its prior), and an RTS smoother written for that general
   transition. Between two reading days the walk is a Brownian bridge, so
   any day's smoothed gap comes from the two days either side and their
   smoothed cross-covariance, without being a filter step. */
import { cholIn, cholSolveVec, makeRng } from "./primary-model.mjs";

const LOG2PI = Math.log(2 * Math.PI);
export const NEST_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
export const ND = 4;
/* the walk's (and the leans') shape: independent moves in each party's log
   share, read through the nested coordinates at typical shares (Greens 0.4,
   One Nation 0.2, others 0.4 of R1; One Nation a third of R2) */
export const NEST_Q = (() => {
  const a = 0.4, b = 0.2, c = 0.4, d = 1 / 3, e = 2 / 3;
  const A = [[1, 0, -a, -b, -c], [0, 1, -a, -b, -c], [0, 0, 1, -d, -e], [0, 0, 0, 1, -1]];
  const Q = new Float64Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 5; k++) s += A[i][k] * A[j][k]; Q[i * 4 + j] = s; }
  return Q;
})();

/* ------------------------------------------------------------ coordinates */
/* the level a shares-object can show: 4, 3 (onp folded), 2 (grn and onp
   folded), 0 (unusable) */
export function nestLevel(o) {
  if (!o || o.alp == null || o.lnp == null || o.oth == null) return 0;
  if (o.grn == null) return 2;
  return o.onp == null ? 3 : 4;
}
/* the categories at a level, as fractions (floored at 0.5% then taken to 1):
   4 [alp, lnp, grn, onp, oth]; 3 [alp, lnp, grn, onp+oth]; 2 [alp, lnp, rest] */
export function nestCats(o, lev, floor = 0.5) {
  const v = (k) => (o[k] == null ? 0 : +o[k]);
  const raw = lev === 4 ? [v("alp"), v("lnp"), v("grn"), v("onp"), v("oth")]
    : lev === 3 ? [v("alp"), v("lnp"), v("grn"), v("onp") + v("oth")]
    : [v("alp"), v("lnp"), v("grn") + v("onp") + v("oth")];
  const f = raw.map((x) => Math.max(x, floor) / 100), s = f.reduce((p, q) => p + q, 0);
  return f.map((x) => x / s);
}
/* coordinates of a category vector at its level */
export function nestCoords(p) {
  const lev = p.length - 1;
  const R1 = p.slice(2).reduce((a, b) => a + b, 0);
  const c = [Math.log(p[0] / R1), Math.log(p[1] / R1)];
  if (lev >= 3) { const R2 = p.slice(3).reduce((a, b) => a + b, 0); c.push(Math.log(p[2] / R2)); }
  if (lev >= 4) c.push(Math.log(p[3] / p[4]));
  return c;
}
/* Jacobian of the coordinates against the categories (lev × (lev+1), flat) */
export function nestJac(p) {
  const lev = p.length - 1, P = p.length, J = new Float64Array(lev * P);
  const R1 = p.slice(2).reduce((a, b) => a + b, 0);
  for (const r of [0, 1]) { J[r * P + r] = 1 / p[r]; for (let j = 2; j < P; j++) J[r * P + j] -= 1 / R1; }
  if (lev >= 3) { const R2 = p.slice(3).reduce((a, b) => a + b, 0); J[2 * P + 2] = 1 / p[2]; for (let j = 3; j < P; j++) J[2 * P + j] -= 1 / R2; }
  if (lev >= 4) { J[3 * P + 3] = 1 / p[3]; J[3 * P + 4] = -1 / p[4]; }
  return J;
}
/* the categories from coordinates (the first lev of them) */
export function nestShares(c, lev) {
  const e0 = Math.exp(c[0]), e1 = Math.exp(c[1]), R1 = 1 / (1 + e0 + e1);
  const out = [e0 * R1, e1 * R1];
  if (lev === 2) { out.push(R1); return out; }
  const R2 = R1 / (1 + Math.exp(c[2])); out.push(R1 - R2);
  if (lev === 3) { out.push(R2); return out; }
  const oth = R2 / (1 + Math.exp(c[3])); out.push(R2 - oth, oth);
  return out;
}

/* ---------------------------------------------------------------- readings */
const covMult = (p, n) => { const P = p.length, C = new Float64Array(P * P); for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) C[i * P + j] = ((i === j ? p[i] : 0) - p[i] * p[j]) / n; return C; };
const sandwich = (A, C, d, P, V) => { for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) { let v = 0; for (let i = 0; i < P; i++) { const ai = A[a * P + i]; if (!ai) continue; for (let j = 0; j < P; j++) v += ai * C[i * P + j] * A[b * P + j]; } V[a * d + b] += v; } };
/* a poll's or the AES's reading: { g, t: shares objects (percent), n: the
   group's respondents (design-effect deflated), s: the group's share of the
   sample } → { z, V, idx } at the level both sets show */
export function gapReading(o) {
  const lev = Math.min(nestLevel(o.g), nestLevel(o.t));
  if (lev < 2) return null;
  const g = nestCats(o.g, lev), t = nestCats(o.t, lev), P = lev + 1;
  const s = Math.min(Math.max(o.s, 0.02), 0.98);
  const r = t.map((v, k) => Math.max((v - s * g[k]) / (1 - s), 0.003));
  const rs = r.reduce((a, b) => a + b, 0); for (let k = 0; k < P; k++) r[k] /= rs;
  const nTot = o.n / s;
  const zg = nestCoords(g), zt = nestCoords(t);
  const z = Float64Array.from(zg.map((v, k) => v - zt[k]));
  const Jg = nestJac(g), Jt = nestJac(t);
  const Ag = new Float64Array(lev * P), Ar = new Float64Array(lev * P);
  for (let i = 0; i < lev * P; i++) { Ag[i] = Jg[i] - s * Jt[i]; Ar[i] = -(1 - s) * Jt[i]; }
  const V = new Float64Array(lev * lev);
  sandwich(Ag, covMult(g, nTot * s), lev, P, V);
  sandwich(Ar, covMult(r, nTot * (1 - s)), lev, P, V);
  /* rounding of both printed sets (whole points) */
  const rr = new Float64Array(P * P); for (let i = 0; i < P; i++) rr[i * P + i] = (1 / 12) / 1e4;
  sandwich(Jg, rr, lev, P, V); sandwich(Jt, rr, lev, P, V);
  return { z, V, idx: Array.from({ length: lev }, (_, k) => k), zt };
}
/* the count: the group's result against the nation's, shares in percent;
   One Nation (the Greens) seen apart only where it took 1% nationally, a
   gap of a fraction of a percent being no gap at all. The count is exact:
   its V is the printed two decimals' rounding (0.01 point a party), tight
   enough to pin even a party that barely stood in a state (floored at
   0.05%) to the count. */
export function countReading(g, t) {
  /* a party seen apart only where it took 1% nationally AND stood in the
     group's seats (0.3% there): a party that ran nowhere in a state (One
     Nation in Western Australia in 2016) has no gap for the walk to carry
     into the next term, where it did stand */
  const on = (o, k, m) => o[k] != null && o[k] >= m;
  const lev = on(t, "grn", 1) && on(g, "grn", 0.3) ? (on(t, "onp", 1) && on(g, "onp", 0.3) ? 4 : 3) : 2;
  const fold = (o) => (lev === 4 ? o : lev === 3 ? { ...o, onp: null, oth: (o.oth || 0) + (o.onp || 0) } : { alp: o.alp, lnp: o.lnp, grn: null, onp: null, oth: (o.oth || 0) + (o.onp || 0) + (o.grn || 0) });
  const gc = nestCats(fold(g), lev, 0.05), tc = nestCats(fold(t), lev, 0.05), P = lev + 1;
  const zg = nestCoords(gc), zt = nestCoords(tc);
  const z = Float64Array.from(zg.map((v, k) => v - zt[k]));
  const V = new Float64Array(lev * lev), rr = new Float64Array(P * P);
  for (let i = 0; i < P; i++) rr[i * P + i] = 0.0001 ** 2;
  sandwich(nestJac(gc), rr, lev, P, V); sandwich(nestJac(tc), rr, lev, P, V);
  return { z, V, idx: Array.from({ length: lev }, (_, k) => k) };
}

/* ------------------------------------------------------------------ layout */
const ERA_GAP = 730;
/* one group's readings → events, house slots and resets */
function layoutGroup(rd, { useMu, days, minSlot = 3 }) {
  /* days: the days that must be filter steps */
  const obs = rd.slice().sort((a, b) => a.day - b.day);
  /* houses: a pollster's run of readings with no two-year break; the AES one
     house throughout */
  const runs = new Map(), last = new Map();
  for (const o of obs) {
    if (o.src === "count") continue;
    const h = o.house;
    let k = last.get(h);
    if (!k || (o.src !== "aes" && o.day - runs.get(k).b > ERA_GAP)) { k = h + "#" + o.day; runs.set(k, { a: o.day, b: o.day, n: 0 }); last.set(h, k); }
    const R = runs.get(k); R.b = o.day; R.n++; o.hk = k;
  }
  const slotted = [...runs.entries()].filter(([, R]) => R.n >= minSlot).sort((p, q) => p[1].a - q[1].a);
  const slotOf = new Map(), free = [], busy = [];   // busy: [slot, lastDay]
  let S = 0;
  for (const [k, R] of slotted) {
    for (let i = busy.length - 1; i >= 0; i--) if (busy[i][1] < R.a) { free.push(busy[i][0]); busy.splice(i, 1); }
    const sl = free.length ? free.pop() : S++;
    slotOf.set(k, sl); busy.push([sl, R.b]);
  }
  /* events: the readings' days, plus the days asked for that must be steps
     (the pair's, and the last asked day so the walk runs to today); every
     other asked day is read off the bridge between steps (gapAt) */
  const t0 = obs[0].day;
  const evDays = [...new Set(obs.map((o) => o.day).concat(days.filter((d) => d >= t0)))].sort((a, b) => a - b);
  const evIdx = new Map(evDays.map((d, i) => [d, i]));
  const events = evDays.map((d) => ({ day: d, obs: [], resets: [] }));
  for (const o of obs) events[evIdx.get(o.day)].obs.push(o);
  for (const [k, R] of slotted) events[evIdx.get(R.a)].resets.push(slotOf.get(k));
  for (const o of obs) o.slot = o.hk && slotOf.has(o.hk) ? slotOf.get(o.hk) : -1;
  const B = 1 + (useMu ? 1 : 0);                 // blocks before the slots
  const lastOf = new Map(); for (const [k] of slotted) lastOf.set(slotOf.get(k), k);
  return { obs, events, S, B, N: ND * (B + S), evIdx, useMu, lastOf };
}

/* ------------------------------------------------------------------ filter */
function filterSpan(L, th, store, onPred = null) {
  const { events, N, B, useMu } = L, NN = N * N, D = ND;
  const x = new Float64Array(N), P = new Float64Array(NN);
  const setBlock = (b, sc) => { const o = b * D; for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) P[(o + i) * N + o + j] = sc * NEST_Q[i * D + j]; };
  setBlock(0, 1.0);
  if (useMu) setBlock(1, th.smu0 * th.smu0);
  for (let b = B; b < N / D; b++) setBlock(b, th.s * th.s);
  const w2 = th.w * th.w, m2 = (th.wmu || 0) ** 2, s2 = th.s * th.s;
  const E = events.length;
  const xs = store ? new Float64Array(E * N) : null, Ps = store ? new Float64Array(E * NN) : null, Pps = store ? new Float64Array(E * NN) : null;
  let ll = 0, prev = events[0].day;
  const PH = new Float64Array(N * D), S = new Float64Array(D * D), Ls = new Float64Array(D * D), v = new Float64Array(D), col = new Float64Array(D), K = new Float64Array(N * D);
  const blocksOf = new Int32Array(3);
  for (let e = 0; e < E; e++) {
    const ev = events[e], dt = ev.day - prev;
    if (dt > 0) {
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) P[i * N + j] += dt * w2 * NEST_Q[i * D + j];
      if (useMu) for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) P[(D + i) * N + D + j] += dt * m2 * NEST_Q[i * D + j];
    }
    for (const sl of ev.resets) {
      const o = (B + sl) * D;
      for (let i = 0; i < D; i++) { x[o + i] = 0; for (let c = 0; c < N; c++) { P[(o + i) * N + c] = 0; P[c * N + o + i] = 0; } }
      setBlock(B + sl, s2);
    }
    if (store) Pps.set(P, e * NN);
    for (const o of ev.obs) {
      const d = o.idx.length;
      let nb = 0; blocksOf[nb++] = 0;
      if (useMu && o.src === "poll") blocksOf[nb++] = 1;
      if (o.slot >= 0) blocksOf[nb++] = B + o.slot;
      /* PH = P Hᵀ (N×d); S = H P Hᵀ + κV (+ a lone house's lean) */
      for (let r = 0; r < N; r++) for (let a = 0; a < d; a++) { let sum = 0; for (let q = 0; q < nb; q++) sum += P[r * N + blocksOf[q] * D + o.idx[a]]; PH[r * D + a] = sum; }
      const kv = o.src === "count" ? 1 : th.kappa;
      for (let a = 0; a < d; a++) for (let c = 0; c < d; c++) {
        let sum = 0; for (let q = 0; q < nb; q++) sum += PH[(blocksOf[q] * D + o.idx[a]) * D + c];
        S[a * d + c] = sum + kv * o.V[a * d + c] + (o.src !== "count" && o.slot < 0 ? s2 * NEST_Q[o.idx[a] * D + o.idx[c]] : 0);
      }
      for (let a = 0; a < d; a++) { let hx = 0; for (let q = 0; q < nb; q++) hx += x[blocksOf[q] * D + o.idx[a]]; v[a] = o.z[a] - hx; }
      if (onPred) onPred(o, Float64Array.from({ length: d }, (_, a) => o.z[a] - v[a]));
      const ld = cholIn(S, d, Ls);
      for (let a = 0; a < d; a++) col[a] = v[a];
      cholSolveVec(Ls, d, col);
      let qf = 0; for (let a = 0; a < d; a++) qf += v[a] * col[a];
      ll += -0.5 * (d * LOG2PI + ld + qf);
      for (let r = 0; r < N; r++) { for (let a = 0; a < d; a++) col[a] = PH[r * D + a]; cholSolveVec(Ls, d, col); for (let a = 0; a < d; a++) K[r * D + a] = col[a]; }
      for (let r = 0; r < N; r++) { let sum = 0; for (let a = 0; a < d; a++) sum += K[r * D + a] * v[a]; x[r] += sum; }
      for (let r = 0; r < N; r++) for (let a = 0; a < d; a++) { const k = K[r * D + a]; if (!k) continue; for (let c = 0; c < N; c++) P[r * N + c] -= k * PH[c * D + a]; }
      for (let r = 0; r < N; r++) for (let c = 0; c < r; c++) { const m = 0.5 * (P[r * N + c] + P[c * N + r]); P[r * N + c] = m; P[c * N + r] = m; }
    }
    if (store) { xs.set(x, e * N); Ps.set(P, e * NN); }
    prev = ev.day;
  }
  return { ll, xs, Ps, Pps };
}

/* RTS smoother for the reset-and-drift transition: x_{k+1} = F x_k + w,
   F the identity with each slot reset at k+1 zeroed. Keeps, per event, the
   smoothed γ (mean, covariance) and γ's cross-covariance with the next
   event's γ, and the gains for longer cross-covariances. */
function smoothSpan(L, f, { keepGains = null, th } = {}) {
  const { events, N, B } = L, NN = N * N, D = ND, E = events.length, m = D * B;
  const gm = new Float64Array(E * D), gC = new Float64Array(E * D * D), gX = new Float64Array(E * D * D), mm = B > 1 ? new Float64Array(E * D) : null;
  const xsN = Float64Array.from(f.xs.subarray((E - 1) * N, E * N)), PsN = Float64Array.from(f.Ps.subarray((E - 1) * NN, E * NN));
  const put = (k, x, P) => { for (let i = 0; i < D; i++) { gm[k * D + i] = x[i]; if (mm) mm[k * D + i] = x[D + i]; for (let j = 0; j < D; j++) gC[(k * D + i) * D + j] = P[i * N + j]; } };
  put(E - 1, xsN, PsN);
  const gains = keepGains ? new Map() : null;
  const Lc = new Float64Array(NN), G = new Float64Array(NN), col = new Float64Array(N), dP = new Float64Array(NN), T = new Float64Array(NN), xo = new Float64Array(N), Po = new Float64Array(NN), dx = new Float64Array(N);
  const Wm = new Float64Array(m * N), WA = new Float64Array(m * N), WAW = new Float64Array(m * m), Qm = new Float64Array(m * m), PpiU = new Float64Array(m * N);
  const w2 = th.w * th.w, m2 = (th.wmu || 0) ** 2;
  for (let k = E - 2; k >= 0; k--) {
    const Pf = f.Ps.subarray(k * NN, (k + 1) * NN), xf = f.xs.subarray(k * N, (k + 1) * N), Pp = f.Pps.subarray((k + 1) * NN, (k + 2) * NN);
    const resets = events[k + 1].resets;
    cholIn(Pp, N, Lc);
    if (!resets.length) {
      /* F = I and the drift Q sits in the first m rows (γ, μ): G = I − U W,
         W = Q Uᵀ Pp⁻¹, so the smoothed state differs from the next step's
         only in those rows and columns */
      const dt = events[k + 1].day - events[k].day;
      Qm.fill(0);
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) { Qm[i * m + j] = dt * w2 * NEST_Q[i * D + j]; if (B > 1) Qm[(D + i) * m + D + j] = dt * m2 * NEST_Q[i * D + j]; }
      for (let a = 0; a < m; a++) { col.fill(0); col[a] = 1; cholSolveVec(Lc, N, col); PpiU.set(col, a * N); }   // rows of Uᵀ Pp⁻¹
      for (let a = 0; a < m; a++) for (let c = 0; c < N; c++) { let s = 0; for (let b = 0; b < m; b++) s += Qm[a * m + b] * PpiU[b * N + c]; Wm[a * N + c] = s; }
      for (let r = 0; r < N; r++) dx[r] = xsN[r] - xf[r];
      for (let i = 0; i < N; i++) xo[i] = xsN[i];
      for (let a = 0; a < m; a++) { let s = 0; for (let c = 0; c < N; c++) s += Wm[a * N + c] * dx[c]; xo[a] -= s; }
      /* A = P_s(k+1) − Pp; P_s(k) = P_s(k+1) − U Q Uᵀ − U WA − (WA)ᵀ Uᵀ + U WAWᵀ Uᵀ */
      for (let a = 0; a < m; a++) for (let c = 0; c < N; c++) { let s = 0; for (let l = 0; l < N; l++) s += Wm[a * N + l] * (PsN[l * N + c] - Pp[l * N + c]); WA[a * N + c] = s; }
      for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) { let s = 0; for (let l = 0; l < N; l++) s += WA[a * N + l] * Wm[b * N + l]; WAW[a * m + b] = s; }
      /* Cov(γ_k, γ_{k+1}) = (G P_s(k+1))_γγ = P_s(k+1)_γγ − (W P_s(k+1))_γγ */
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) { let s = 0; for (let l = 0; l < N; l++) s += Wm[i * N + l] * PsN[l * N + j]; gX[(k * D + i) * D + j] = PsN[i * N + j] - s; }
      Po.set(PsN);
      for (let a = 0; a < m; a++) for (let c = 0; c < N; c++) { Po[a * N + c] -= WA[a * N + c]; Po[c * N + a] -= WA[a * N + c]; }
      for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) Po[a * N + b] += WAW[a * m + b] - Qm[a * m + b];
      if (gains && keepGains(k)) gains.set(k, { W: Float64Array.from(Wm), m });
    } else {
      /* a slot reset at k+1: the general transition. G = Pf Fᵀ Pp⁻¹, from
         Gᵀ = Pp⁻¹ (F Pf), F Pf's column c being Pf's row c zeroed where reset */
      const reset = new Uint8Array(N);
      for (const sl of resets) for (let i = 0; i < D; i++) reset[(B + sl) * D + i] = 1;
      for (let c = 0; c < N; c++) {
        for (let r = 0; r < N; r++) col[r] = reset[r] ? 0 : Pf[c * N + r];
        cholSolveVec(Lc, N, col);
        for (let r = 0; r < N; r++) G[c * N + r] = col[r];
      }
      for (let r = 0; r < N; r++) dx[r] = xsN[r] - (reset[r] ? 0 : xf[r]);
      for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += G[i * N + j] * dx[j]; xo[i] = xf[i] + s; }
      for (let i = 0; i < NN; i++) dP[i] = PsN[i] - Pp[i];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += G[i * N + l] * dP[l * N + j]; T[i * N + j] = s; }
      for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) { let s = 0; for (let l = 0; l < N; l++) s += T[i * N + l] * G[j * N + l]; const v = Pf[i * N + j] + s; Po[i * N + j] = v; Po[j * N + i] = v; }
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) { let s = 0; for (let l = 0; l < N; l++) s += G[i * N + l] * PsN[l * N + j]; gX[(k * D + i) * D + j] = s; }
      if (gains && keepGains(k)) gains.set(k, { G: Float64Array.from(G) });
    }
    xsN.set(xo); PsN.set(Po);
    put(k, xo, Po);
  }
  return { gm, gC, gX, mm, gains };
}

/* a day's smoothed γ from the events either side (Brownian bridge) */
function gapAt(L, sm, th, day) {
  const { events } = L, D = ND, E = events.length;
  if (day < events[0].day || day > events[E - 1].day) return null;
  let hi = L.evIdx.get(day);
  if (hi != null) return { m: sm.gm.subarray(hi * D, hi * D + D), C: sm.gC.subarray(hi * D * D, (hi + 1) * D * D), mu: sm.mm ? sm.mm.subarray(hi * D, hi * D + D) : null };
  let lo = 0; hi = E - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (events[mid].day <= day) lo = mid; else hi = mid; }
  const a = events[lo].day, b = events[hi].day, lam = (day - a) / (b - a), w2 = th.w * th.w;
  const m = new Float64Array(D), C = new Float64Array(D * D);
  for (let i = 0; i < D; i++) m[i] = (1 - lam) * sm.gm[lo * D + i] + lam * sm.gm[hi * D + i];
  const mu = sm.mm ? Float64Array.from({ length: D }, (_, i) => (1 - lam) * sm.mm[lo * D + i] + lam * sm.mm[hi * D + i]) : null;
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
    const X = sm.gX[(lo * D + i) * D + j] + sm.gX[(lo * D + j) * D + i];
    C[i * D + j] = (1 - lam) ** 2 * sm.gC[(lo * D + i) * D + j] + lam * lam * sm.gC[(hi * D + i) * D + j] + lam * (1 - lam) * X + lam * (1 - lam) * (b - a) * w2 * NEST_Q[i * D + j];
  }
  return { m, C, mu };
}

/* the joint smoothed (γ_a, γ_b) of two event days, a < b: Cov = Eγᵀ G_a … G_{b−1} P_s(b)
   – needs the full P_s(b), so the pair's later day keeps it */
function pairAt(L, sm, ka, kb, PsB) {
  const { N } = L, D = ND;
  let R = new Float64Array(D * N);
  for (let i = 0; i < D; i++) R[i * N + i] = 1;
  for (let k = ka; k < kb; k++) {
    const gk = sm.gains.get(k), R2 = new Float64Array(D * N);
    if (gk.G) { const G = gk.G; for (let i = 0; i < D; i++) for (let j = 0; j < N; j++) { let s = 0; for (let l = 0; l < N; l++) s += R[i * N + l] * G[l * N + j]; R2[i * N + j] = s; } }
    else {
      const { W, m } = gk;
      R2.set(R);
      for (let i = 0; i < D; i++) for (let a = 0; a < m; a++) { const ra = R[i * N + a]; if (!ra) continue; for (let j = 0; j < N; j++) R2[i * N + j] -= ra * W[a * N + j]; }
    }
    R = R2;
  }
  const X = new Float64Array(D * D);
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) { let s = 0; for (let l = 0; l < N; l++) s += R[i * N + l] * PsB[l * N + j]; X[i * D + j] = s; }
  const m = new Float64Array(2 * D), C = new Float64Array(4 * D * D);
  for (let i = 0; i < D; i++) { m[i] = sm.gm[ka * D + i]; m[D + i] = sm.gm[kb * D + i]; }
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
    C[i * 2 * D + j] = sm.gC[(ka * D + i) * D + j];
    C[(D + i) * 2 * D + D + j] = sm.gC[(kb * D + i) * D + j];
    C[i * 2 * D + D + j] = X[i * D + j]; C[(D + j) * 2 * D + i] = X[i * D + j];
  }
  return { m, C };
}

/* -------------------------------------------------------------------- fit */
/* ω reaches well past what any set picks (language, states and seat types
   settle at 0.006, the rest at or below 0.003), so the walk's pace is the
   readings' choice and not the grid's edge: with 0.003 the top, "Other
   language" sat on its term-long average above the polls' recent run */
export const SPAN_GRID = { w: [0.0003, 0.001, 0.003, 0.006, 0.012, 0.024], s: [0.03, 0.1, 0.3], kappa: [0.7, 1, 1.41, 2], wmu: [0.0005, 0.0015, 0.0045] };
/* raw: one set's readings, each { group, house, day, src: "poll"|"aes"|"count",
   z, V, idx }. days: the days the caller wants each group's gap on. pair:
   [a, b] two days whose joint gap is wanted (the change since the election).
   Returns per group a mixture over the kept settings: at each asked day
   [{ w, m, C }…] and for the pair [{ w, m, C }…] (8 numbers), plus the
   houses' leans at the end and what read the group. */
export function fitSpan(raw, { days, pair = null, useMu = false, grid = SPAN_GRID, smu0 = 0.25, nKeep = 8, log = null, predFrom = null }) {
  const byGroup = new Map();
  for (const r of raw) (byGroup.get(r.group) || byGroup.set(r.group, []).get(r.group)).push(r);
  const groups = [...byGroup.keys()], G = groups.length, temper = G > 1 ? (G - 1) / G : 1;
  const extra = [Math.max(...days), ...(pair || [])];
  const lay = groups.map((g) => layoutGroup(byGroup.get(g), { useMu, days: extra }));
  const tg0 = Date.now();
  const rows = [];
  for (const w of grid.w) for (const s of grid.s) for (const kappa of grid.kappa) for (const wmu of useMu ? grid.wmu : [0]) {
    const th = { w, s, kappa, wmu, smu0 };
    let ll = 0; for (const L of lay) ll += filterSpan(L, th, false).ll;
    rows.push({ th, ll: temper * ll - Math.log(kappa) ** 2 / (2 * 0.5 ** 2) });
  }
  const mx = Math.max(...rows.map((r) => r.ll)); let z = 0;
  for (const r of rows) { r.w = Math.exp(r.ll - mx); z += r.w; }
  for (const r of rows) r.w /= z;
  rows.sort((a, b) => b.w - a.w);
  /* the settings carrying the weight: the leading points to 99.5% of it,
     at most nKeep */
  const keep = []; let acc = 0;
  for (const r of rows) { if (keep.length >= nKeep || acc >= 0.995) break; keep.push(r); acc += r.w; }
  for (const r of keep) r.wk = r.w / acc;
  const tg1 = Date.now();
  const out = new Map();
  lay.forEach((L, gi) => {
    const g = groups[gi], at = new Map(), pr = [];
    let beta = null;
    const kA = pair ? L.evIdx.get(pair[0]) : null, kB = pair ? L.evIdx.get(pair[1]) : null;
    for (const r of keep) {
      const f = filterSpan(L, r.th, true);
      const sm = smoothSpan(L, f, { th: r.th, keepGains: kA != null && kB != null ? (k) => k >= kA && k < kB : null });
      for (const d of days) { const q = gapAt(L, sm, r.th, d); if (q) (at.get(d) || at.set(d, []).get(d)).push({ w: r.wk, m: Float64Array.from(q.m), C: Float64Array.from(q.C), ...(q.mu ? { mu: Float64Array.from(q.mu) } : {}) }); }
      if (kA != null && kB != null && kA < kB) {
        /* P_s at the pair's later day: kB is the last event (today) */
        const NN = L.N * L.N, E = L.events.length;
        if (kB === E - 1) pr.push({ w: r.wk, ...pairAt(L, sm, kA, kB, f.Ps.subarray((E - 1) * NN, E * NN)) });
      }
      if (!beta) {
        const E = L.events.length, x = f.xs.subarray((E - 1) * L.N, E * L.N);
        beta = Object.fromEntries([...L.lastOf].map(([sl, k]) => [k.split("#")[0], Array.from(x.subarray((L.B + sl) * ND, (L.B + sl + 1) * ND))]));
      }
    }
    /* each poll from predFrom on, predicted from every reading before it
       (the filter's one-step forecast at the leading settings) given the
       poll's own all-voters figure: the error on each party it prints, in
       points */
    const pred = [];
    if (predFrom != null) filterSpan(L, keep[0].th, false, (o, zp) => {
      if (o.src !== "poll" || o.day < predFrom || !o.zt) return;
      const lev = o.idx.length, a = nestShares(o.zt.map((v, k) => v + o.z[k]), lev), b = nestShares(o.zt.map((v, k) => v + zp[k]), lev);
      pred.push(a.map((v, k) => 100 * Math.abs(v - b[k])));
    });
    out.set(g, { at, pair: pr, beta, pred, first: L.obs[0].day, sources: [...new Set(L.obs.map((o) => o.src))], houses: [...new Set(L.obs.filter((o) => o.src !== "count").map((o) => o.house))], n: L.obs.length, slots: L.S });
  });
  if (process.env.GS_PROF) console.log("fitSpan prof", JSON.stringify({ groups: G, grid: rows.length, keep: keep.length, events: lay.map((L) => L.events.length), N: lay.map((L) => L.N), gridMs: tg1 - tg0, smoothMs: Date.now() - tg1 }));
  if (log) log(keep.map((r) => ({ omega: r.th.w, s: r.th.s, kappa: r.th.kappa, ...(useMu ? { omegaMu: r.th.wmu } : {}), weight: +r.w.toFixed(3) })));
  return { groups: out, settings: keep.map((r) => ({ omega: r.th.w, s: r.th.s, kappa: r.th.kappa, ...(useMu ? { omegaMu: r.th.wmu } : {}), weight: +r.w.toFixed(3) })) };
}

/* n draws of the first d dims from a { w, m, C } mixture (counts allocated
   by weight, the last component taking the remainder) */
export function drawMix(mix, n, rng, d) {
  const out = [];
  let left = n;
  const Lc = new Float64Array(d * d), C = new Float64Array(d * d), z = new Float64Array(d);
  mix.forEach((c, i) => {
    const full = c.m.length, k = i === mix.length - 1 ? left : Math.min(left, Math.round(c.w * n));
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) C[a * d + b] = c.C[a * full + b];
    cholIn(C, d, Lc);
    for (let j = 0; j < k; j++) {
      for (let a = 0; a < d; a++) z[a] = rng.normal();
      const o = new Float64Array(d);
      for (let a = 0; a < d; a++) { let s = c.m[a]; for (let b = 0; b <= a; b++) s += Lc[a * d + b] * z[b]; o[a] = s; }
      out.push(o);
    }
    left -= k;
  });
  return out;
}
export { makeRng };
