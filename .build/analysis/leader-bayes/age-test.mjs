/* ω larger early in a stint? ω_t² = ω²·(1 + a·e^(−age/λ)), age = days since the series' first reading */
import fs from "node:fs";
import { ratingSeries, ppmSeries } from "./series.mjs";
import { fitSettings } from "./leader-model.mjs";
import { GRID_R, GRID_P } from "./fit.mjs";
const J = JSON.parse(fs.readFileSync(new URL("./readings.json", import.meta.url)));
function runA(S, th, kappa, a, lam) {
  const N = S.N, x = new Float64Array(N), P = new Float64Array(N * N);
  const f = S.obs[0]; x[0] = f.y / f.c; P[0] = S.p0 * S.p0;
  for (let i = 1; i < N; i++) P[i * N + i] = (i < S.K ? th.s : S.wide) ** 2;
  const tau2 = th.tau * th.tau, wide2 = S.wide * S.wide, Ph = new Float64Array(N);
  let ll = 0, prev = null, oi = 0, e = [];
  const days = [...new Set(S.obs.map((o) => o.t))].sort((p, q) => p - q);
  for (const t of days) {
    if (prev != null) {
      const dt = t - prev, a0 = prev - S.t0, a1 = t - S.t0;
      const integ = dt + a * lam * (Math.exp(-a0 / lam) - Math.exp(-a1 / lam));
      let jmp = false; for (const jd of S.jumps) if (jd > prev && jd <= t) jmp = true;
      P[0] += th.w * th.w * integ + (jmp ? th.J * th.J : 0);
      for (let i = 1; i < N; i++) P[i * N + i] += dt * th.d * th.d;
    }
    while (oi < S.obs.length && S.obs[oi].t === t) {
      const o = S.obs[oi++], h = o.h;
      let Sv = o.v * (kappa.get(o.house) ?? 1) + tau2 + (o.lone ? wide2 : 0), mu = 0;
      for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += P[i * N + j] * h[j]; Ph[i] = s; }
      for (let i = 0; i < N; i++) { Sv += h[i] * Ph[i]; mu += h[i] * x[i]; }
      const v = o.y - mu; ll += -0.5 * (Math.log(2 * Math.PI * Sv) + v * v / Sv);
      if (!o.lone) e.push({ mu, y: o.y, S: Sv });
      for (let i = 0; i < N; i++) x[i] += Ph[i] / Sv * v;
      for (let i = 0; i < N; i++) { const q = Ph[i] / Sv; for (let j = 0; j < N; j++) P[i * N + j] -= q * Ph[j]; }
    }
    prev = t;
  }
  return { ll, e };
}
for (const [label, series, grid, toPts] of [["ratings", ratingSeries(J.ratings, {}), GRID_R, (y) => 100 * y], ["ppm", ppmSeries(J.ppm, {}), { ...GRID_P, w: [0.01, 0.02, 0.03, 0.045], d: [0.002, 0.004, 0.008], J: [0.15, 0.3, 0.6] }, (y) => 100 / (1 + Math.exp(-y))]]) {
  const st = fitSettings(series, grid);
  const ev = (th, a, lam) => { let ll = 0, e = []; for (const S of series) { const r = runA(S, th, st.kappa, a, lam); ll += r.ll; e.push(...r.e); } return { ll, mae: e.reduce((s, p) => s + Math.abs(toPts(p.mu) - toPts(p.y)), 0) / e.length }; };
  const r0 = ev(st.best, 0, 1); console.log(label, "base ll", r0.ll.toFixed(1), "MAE", r0.mae.toFixed(3));
  let best = null;
  for (const a of [1, 3, 8]) for (const lam of [30, 90, 180]) for (const wf of [0.7, 0.85, 1]) { const th = { ...st.best, w: st.best.w * wf }; const r = ev(th, a, lam); if (!best || r.ll > best.r.ll) best = { a, lam, wf, r }; }
  console.log("  best age", best.a, best.lam, best.wf, "ll", best.r.ll.toFixed(1), "Δ", (best.r.ll - r0.ll).toFixed(1), "MAE", best.r.mae.toFixed(3));
}
