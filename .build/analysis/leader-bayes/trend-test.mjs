/* Does a damped trend (velocity) help? Filter-only test: log likelihood and
   next-poll error at the best grid point, trend v no trend, ratings and ppm. */
import fs from "node:fs";
import { ratingSeries, ppmSeries } from "./series.mjs";
import { fitSettings } from "./leader-model.mjs";
import { GRID_R, GRID_P } from "./fit.mjs";
const J = JSON.parse(fs.readFileSync(new URL("./readings.json", import.meta.url)));
/* filter with state [m, leans..., v]; m += dt v (Euler, as primary-model), v ← φ v, noise ν·ω */
function runT(S, th, kappa) {
  const N0 = S.N, N = N0 + 1, vo = N0, NN = N * N;
  const x = new Float64Array(N), P = new Float64Array(NN);
  const f = S.obs[0]; x[0] = f.y / f.c; P[0] = S.p0 * S.p0;
  for (let i = 1; i < N0; i++) P[i * N + i] = (i < S.K ? th.s : S.wide) ** 2;
  P[vo * N + vo] = (th.nu * th.w) ** 2 * th.tauT / 2;
  const q0 = th.w * th.w, qd = th.d * th.d, tau2 = th.tau * th.tau, J2 = th.J * th.J, wide2 = S.wide * S.wide;
  const Ph = new Float64Array(N); let ll = 0, prev = null; const pred = [];
  const days = [...new Set(S.obs.map((o) => o.t))].sort((a, b) => a - b);
  let oi = 0;
  for (const t of days) {
    if (prev != null) {
      const dt = t - prev, phi = Math.exp(-dt / th.tauT);
      let jmp = false; for (const jd of S.jumps) if (jd > prev && jd <= t) jmp = true;
      x[0] += dt * x[vo]; x[vo] *= phi;
      for (let j = 0; j < N; j++) P[j] += dt * P[vo * N + j];
      for (let j = 0; j < N; j++) P[vo * N + j] *= phi;
      for (let i = 0; i < N; i++) { P[i * N] += dt * P[i * N + vo]; P[i * N + vo] *= phi; }
      const q = th.nu * th.nu * q0;
      P[0] += q * dt * dt * dt / 3 + dt * q0 + (jmp ? J2 : 0); P[vo] += q * dt * dt / 2; P[vo * N] += q * dt * dt / 2; P[vo * N + vo] += q * dt;
      if (jmp) { x[vo] = 0; }
      for (let i = 1; i < N0; i++) P[i * N + i] += dt * qd;
    }
    while (oi < S.obs.length && S.obs[oi].t === t) {
      const o = S.obs[oi++]; const h = new Float64Array(N); h.set(o.h);
      let Sv = o.v * (kappa.get(o.house) ?? 1) + tau2 + (o.lone ? wide2 : 0), mu = 0;
      for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += P[i * N + j] * h[j]; Ph[i] = s; }
      for (let i = 0; i < N; i++) { Sv += h[i] * Ph[i]; mu += h[i] * x[i]; }
      pred.push({ mu, S: Sv, y: o.y, lone: o.lone, t: o.t });
      const v = o.y - mu; ll += -0.5 * (Math.log(2 * Math.PI * Sv) + v * v / Sv);
      for (let i = 0; i < N; i++) x[i] += Ph[i] / Sv * v;
      for (let i = 0; i < N; i++) { const a = Ph[i] / Sv; for (let j = 0; j < N; j++) P[i * N + j] -= a * Ph[j]; }
    }
    prev = t;
  }
  return { ll, pred };
}
for (const [label, series, grid, toPts] of [
  ["ratings", ratingSeries(J.ratings, {}), GRID_R, (y) => 100 * y],
  ["ppm", ppmSeries(J.ppm, {}), { ...GRID_P, w: [0.01, 0.02, 0.03, 0.045], d: [0.002, 0.004, 0.008], J: [0.15, 0.3, 0.6] }, (y) => 100 / (1 + Math.exp(-y))]]) {
  const st = fitSettings(series, grid);
  const base = st.best;
  const evalT = (th) => { let ll = 0, e = [], z = []; for (const S of series) { const r = runT(S, th, st.kappa); ll += r.ll; for (const p of r.pred) if (!p.lone) { e.push(Math.abs(toPts(p.mu) - toPts(p.y))); z.push(Math.abs(p.y - p.mu) / Math.sqrt(p.S)); } } return { ll, mae: e.reduce((a, b) => a + b, 0) / e.length, cov: z.filter((q) => q < 1.96).length / z.length }; };
  const r0 = evalT({ ...base, nu: 0, tauT: 30 });
  console.log(`${label}: no trend ${JSON.stringify(base)} ll ${r0.ll.toFixed(1)} MAE ${r0.mae.toFixed(3)} cover ${(100 * r0.cov).toFixed(1)}`);
  let best = null;
  for (const nu of [0.01, 0.02, 0.04, 0.08]) for (const tauT of [15, 30, 60, 120]) for (const wf of [0.7, 0.85, 1]) {
    const th = { ...base, w: base.w * wf, nu, tauT };
    const r = evalT(th);
    if (!best || r.ll > best.r.ll) best = { th, r };
  }
  console.log(`  best trend ${JSON.stringify(best.th)} ll ${best.r.ll.toFixed(1)} (Δ ${(best.r.ll - r0.ll).toFixed(1)}) MAE ${best.r.mae.toFixed(3)} cover ${(100 * best.r.cov).toFixed(1)}`);
  console.log(`  ppm grid best (wider): ${JSON.stringify(base)} edges ${st.edges.join(",") || "-"}`);
}
