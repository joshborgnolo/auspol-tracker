/* The issues model (2026-11-24; prototype and backtests in
   .build/analysis/issue-bayes/, not committed). gen-data §7hm builds the
   readings and calls the builders below; the engine is the leadership
   model's (leader-model.mjs: one scalar line per series, house leans,
   Kalman filter, settings on a grid, seeded draws).

   TWO QUESTIONS, THREE KINDS OF LINE, one per issue each:

   WHAT MATTERS (salience). The share of voters who would put the issue
   among their three most important, for the average regular top-three
   pollster (RedBridge and Ipsos this term, each counting once – the
   panel's convention since September 2026). Carried as log-odds, x =
   log(p / (1 − p)). Every other way of asking reads the same line through
   a lean of its own, per issue: a poll asking for the ONE most important
   issue (AES, ANUpoll, Scanlon, DemosAU, Vote Compass …), an open question,
   a longer or shorter list. On the log-odds scale such a reading moves
   one-for-one with the top-three share (RedBridge prints both for the same
   people: within an issue, first-ranked log-odds move 0.98 for each 1 of
   top-three's), so its lean is a constant shift, measured wherever it
   overlaps the regular pollsters, and the line before them follows its
   movements. Leans may drift slowly (δ).

   WHO IS BEST (ownership), as two independent lines:
     d = log(Labor / Coalition)                among those naming either
     o = log(One Nation / (Labor + Coalition))  One Nation against the two
   The multinomial sampling errors of d and o are uncorrelated (to first
   order the covariance cancels: Cov(log a − log l, log o − log(a + l)) = 0),
   so the two can be fitted apart. A poll that offered no One Nation reads
   d alone; one offering all three reads both. The panel's three shares are
   onp = σ(o), alp = (1 − onp)·σ(d), lnp = (1 − onp)·(1 − σ(d)). Before One
   Nation was offered (December 2025) only d exists: the history is Labor v
   the Coalition, as the two-party vote's is. A house that changed the
   parties it offers (Resolve and Ipsos added One Nation in 2026) is a
   different question before and after: each era leans on its own.

   ONE LINE  y = c·m + lean_h + e, e ~ N(0, κ_h·v + τ²), m a random walk
   (N(0, w²) a day, plus J² on a jump day), leans N(0, s²) for the regular
   houses (sum to zero), N(0, WIDE²) for the rest, drifting N(0, δ²) a day;
   v the multinomial variance of the reading on its scale at the poll's
   effective sample (design effect DEFF), plus the printed figure's
   rounding. */

import {
  makeSeries, fitSettings as ldFitSettings, lineMoments, drawReads, drawSeries, predictAll, houseCoef,
  makeRng, quant, mean,
} from "./leader-model.mjs";

export { lineMoments, drawReads, drawSeries, predictAll, houseCoef, makeRng, quant, mean };
export const DEFF = 1.6;
export const WIDE_SAL = 1.0;        // a lean house's log-odds lean, prior sd
export const WIDE_OWN = 0.6;
export const P_FLOOR = 0.5;         // shares under half a point read as half a point
export const logit = (p) => Math.log(p / (1 - p));
export const expit = (x) => 1 / (1 + Math.exp(-x));

/* a printed share's variance on the log-odds scale: sampling (DEFF) and
   rounding to the printed step (an integer unless decimals were printed) */
const roundV = (step, p) => (step * step / 12) / 1e4;
export function salObs(p0, n, step = 1) {
  const p = Math.max(P_FLOOR, Math.min(100 - P_FLOOR, p0)) / 100;
  const q = p * (1 - p);
  return { y: logit(p), v: DEFF / (n * q) + roundV(step) / (q * q) };
}
/* ownership: d and o from printed shares (any base) at sample n */
export function ownObs(sh, n, step = 1) {
  const a = Math.max(P_FLOOR, sh.alp) / 100, l = Math.max(P_FLOOR, sh.lnp) / 100;
  const r = roundV(step);
  const d = { y: Math.log(a / l), v: DEFF * (1 / a + 1 / l) / n + r * (1 / (a * a) + 1 / (l * l)) };
  if (sh.onp == null) return { d, o: null };
  const o0 = Math.max(P_FLOOR, sh.onp) / 100, s = a + l;
  const o = { y: Math.log(o0 / s), v: DEFF * (1 / o0 + 1 / s) / n + r * (1 / (o0 * o0) + 2 / (s * s)) };
  return { d, o };
}

/* readings → one series per issue (salience) or per issue and line
   (ownership). rows: { day, house, issue, y, v, i?, raw? }; core: the
   houses whose leans average zero (a Set, or a function of the issue). */
export function buildSeries(rows, { core, jumps = [], wide, p0, outDays = () => [], minCore = 4, keyOf = (r) => r.issue }) {
  const by = new Map();
  rows.forEach((r, i) => { const k = keyOf(r); const a = by.get(k) || []; a.push({ ...r, i: r.i ?? i }); by.set(k, a); });
  const out = [];
  for (const [id, rs] of by) {
    const cnt = {}; for (const r of rs) cnt[r.house] = (cnt[r.house] || 0) + 1;
    const coreSet = typeof core === "function" ? core(id) : core;
    const c = new Set([...coreSet].filter((h) => (cnt[h] || 0) >= minCore));
    const obs = rs.map((r) => ({ t: r.day, y: r.y, v: r.v, house: r.house, c: 1, i: r.i, raw: r.raw || r }));
    const t0 = Math.min(...obs.map((o) => o.t)), t1 = Math.max(...obs.map((o) => o.t));
    const S = makeSeries(id, obs, { core: c, jumps: new Set(jumps.filter((d) => d > t0 && d <= t1)), wide, p0, outDays: outDays(t0, t1, rs, id) });
    S.key = id;
    out.push(S);
  }
  return out;
}

export function fitFamily(series, grid, opts = {}) { return ldFitSettings(series.filter((S) => S.obs.length >= 2), grid, opts); }

/* draws → a share line: per output day, median and 95% interval of f(draws) */
export function bandOf(arr, f = (x) => x) {
  const n = arr.length, t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = f(arr[i]);
  return { m: quant(t, 0.5), lo: quant(t, 0.025), hi: quant(t, 0.975), mean: mean(t) };
}
/* Pr(a > b) over paired draws */
export function pAbove(a, b) { let k = 0; for (let i = 0; i < a.length; i++) if (a[i] > b[i]) k++; return k / a.length; }
