/* The vote-switching model (2026-11-24; prototype, backtest and fake-data
   check in .build/analysis/switch-bayes/). gen-data §5b calls fitSwitch for
   "Where One Nation's voters are coming from" and "Where X's voters are
   going", and for the masthead replay's switching table (switchFlows).

   WHAT IT ESTIMATES, day by day since the first table: for each group of
   2025 voters (Labor, Coalition, Greens, One Nation, everyone else), how
   its voters split now across the five – the share each party kept and the
   shares gone to each other party – as the average regular pollster would
   print them. Each group's row is one composition, so its five shares
   always add to 100 and a move to One Nation is a move away from somewhere.

   WHY THE PRIMARY MODEL'S ENGINE. A group's row is a multinomial share
   vector, read by polls of a few hundred respondents each, rounded to
   whole points – the primary vote's problem at a smaller sample. So each
   row is a run of the primary model's filter (primary-model.mjs: log-ratio
   state, regular pollsters' leans summing to zero, κ per house, rounding,
   a lone house's lean folded into its reading's noise), with the group's
   own party – its kept share, the biggest – as the reference category.

   WHAT THE FIVE ROWS SHARE. One set of settings: how fast a share going to
   each party drifts (ω per destination party, the same in every row: a
   Coalition voter's drift to One Nation and a Labor voter's are one kind of
   move), the leans' prior spread and drift, the step allowed when the
   Liberals changed leader, and each pollster's noise κ. The five groups
   are separate respondents, so given the settings their rows are
   independent and the likelihoods add; the settings are integrated as the
   primary model's are (posterior mode, then a Laplace mixture of M settings
   vectors importance-weighted by the exact posterior).

   THE ZERO. Two houses publish regularly (YouGov and DemosAU); each counts
   once, so the line sits midway between them (the convention every thin
   two-house series on the site follows). A house with one table leans as
   it likes and moves nothing.

   A PRINTED ZERO. The tables round to whole points, so a 0 means fewer than
   half a per cent. It is read as half a point, with the rounding variance of
   a whole-point step: on the log scale a small count reads low on average,
   and a quarter of a point pushed that bias into the big kept shares (in
   the fake-data check One Nation's kept share was 2 points high and its
   95% interval caught the truth 53% of the time; at half a point, 0.8 high
   and every time).

   EVIDENCE (.build/analysis/switch-bayes/: readings.mjs, recipe.mjs – the
   six-week pool it replaced, copied – backtest.mjs, fakedata.mjs).
   Predicting each table from the tables released before it (24 tables,
   600 cells): 2.15 points a cell v the recipe's 2.33, One Nation's gain
   split 2.58 v 2.83, 95% intervals covering 97% v 93%. Rejected as no
   better: one ω for every party (2.14), one ω per row (2.22), κ per house
   and row (2.14), a damped trend (2.19), no leader-change step (2.20).
   Holding ω slower (0.002–0.015 a day) predicted no better (2.22–2.15):
   the tables can't tell a quick real move from a noisy table, so the
   fitted drift (fast for shares going to One Nation, about 0.03 a day)
   stands, and today's intervals are wider than the six-week pools claimed
   – whose 95% intervals caught the next Coalition row 89% of the time.
   Fake data (40 tables sets from a known truth, real design): today's 95%
   intervals cover 95%, past months 94%, the change since February 93%; a
   share rising steadily all year reads about a point behind the truth at
   its newest point (a random walk lags a straight climb – the trend that
   would fix it predicted no better), so the change test errs toward "no
   clear change". */
import { prepare, runFilter, filterSmooth, crossCov, mvnDraw, softmaxAlr, alrOf, makeRng,
  spdInv, cholIn, cholSolveVec, mean, quant } from "./primary-model.mjs";

export const SW_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
export const SW_DEFF = 1.6;
/* a group's categories: the other four parties, then its own (kept) as the
   reference */
export const cohortParties = (c) => SW_KEYS.filter((k) => k !== c).concat([c]);
const PRIOR = { w: [0.004, 1.5], d: [0.002, 1.0], s: [0.1, 1.0], J: [0.05, 1.0], nu: [0.03, 1.5], tau: [90, 0.7] };
const KAPPA_GRID = [0.5, 0.7, 1, 1.41, 2, 2.83, 4];
const KAPPA_PRIOR_SD = 0.5;

/* tables: [{ key, house, day, n (the poll's sample on the site's
   convention), rows: { cohort: { party: share, closed to 100 } } }] →
   the readings for one group's row */
export function cohortReadings(tables, c, share2025, { zero = 0.5 } = {}) {
  const parties = cohortParties(c);
  return tables.filter((t) => t.rows && t.rows[c]).map((t, i) => {
    const vals = parties.map((k) => { const v = t.rows[c][k]; return v > 0 ? v : zero; });
    return { key: t.key, house: t.house, day: t.day, pub: t.pub, idx: i, n: (t.n / SW_DEFF) * (share2025[c] / 100),
      cats: parties.map((_, q) => [q]), vals, full: true, step: 1 };
  });
}

/* settings vector (log scale): ω for each destination party (SW_KEYS order),
   lean drift d, lean spread s, leader-change step J. (omega "one": a single
   ω; "cohort": one ω per group's row – the backtest's alternatives) */
const namesOf = (omega, trend) => [...(omega === "one" ? ["w"] : SW_KEYS.map((k) => "w_" + k)), "d", "s", "J", ...(trend ? ["nu", "tau"] : [])];
const priorOf = (names) => ({ names, mean: names.map((n) => Math.log(PRIOR[n[0] === "w" ? "w" : n][0])), sd: names.map((n) => PRIOR[n[0] === "w" ? "w" : n][1]) });
let NAMES = namesOf("party"), prior = priorOf(NAMES), OMEGA = "party", TREND = false;
function setOmega(o, trend, priorW) {
  OMEGA = o || "party"; TREND = !!trend; NAMES = namesOf(OMEGA, TREND); prior = priorOf(NAMES);
  if (priorW) NAMES.forEach((n, i) => { if (n[0] === "w") { prior.mean[i] = Math.log(priorW[0]); prior.sd[i] = priorW[1]; } });
}
/* the settings for one group's row: ω re-ordered to its categories */
function thFor(v, c) {
  const P = SW_KEYS.length, parties = cohortParties(c), w = new Float64Array(P), nw = OMEGA === "one" ? 1 : P;
  parties.forEach((k, q) => { w[q] = Math.exp(OMEGA === "one" ? v[0] : OMEGA === "cohort" ? v[SW_KEYS.indexOf(c)] : v[SW_KEYS.indexOf(k)]); });
  return { w, d: Math.exp(v[nw]), s: Math.exp(v[nw + 1]), J: Math.exp(v[nw + 2]), ...(TREND ? { nu: Math.exp(v[nw + 3]), tau: Math.exp(v[nw + 4]) } : {}) };
}
/* κ for one row's readings: by house, or (kappaBy "house-cohort") by house
   and row */
let KBY = "house";
const kapFor = (kappa, c) => (KBY === "house" ? kappa : new Map([...kappa].filter(([k]) => k.endsWith("|" + c)).map(([k, v]) => [k.slice(0, k.lastIndexOf("|")), v])));

function contexts(tables, share2025, { t0, t1, jumps, minCore = 4, zero }) {
  return SW_KEYS.map((c) => {
    const rs = cohortReadings(tables, c, share2025, { zero }).filter((r) => r.day > t0 && r.day <= t1);
    if (!rs.length) return null;
    const { obs, L, cnt } = prepare(rs, { t0, t1, minCore, parties: cohortParties(c), trend: TREND });
    /* the prior on the first day: wide around the first tables' average
       (a sd of 0.7 on each log share – a factor of two either way) */
    const first = obs.slice(0, 3), P = SW_KEYS.length, D = P - 1;
    const avg = Array.from({ length: P }, (_, q) => first.reduce((a, o) => a + o.vals[q], 0) / first.length);
    const tot = avg.reduce((a, b) => a + b, 0);
    const anchor = { mean: alrOf(avg.map((v) => v / tot)), cov: new Float64Array(D * D) };
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) anchor.cov[i * D + j] = 0.49 * ((i === j ? 1 : 0) + 1);
    return { c, obs, L, cnt, anchor, jumps, t0, t1 };
  });
}
function eventsOf(cx, days) {
  return [...new Set([cx.t0, ...cx.obs.map((o) => o.day), ...days.filter((d) => d > cx.t0 && d <= cx.t1), cx.t1,
    ...[...cx.jumps].filter((d) => d > cx.t0 && d <= cx.t1)])].sort((a, b) => a - b);
}

/* the joint log posterior of a settings vector, κ held */
function logPost(v, cxs, kappa) {
  let lp = 0;
  for (const cx of cxs) {
    if (!cx) continue;
    const f = runFilter(cx.obs, cx.L, cx.events, thFor(v, cx.c), { anchor: cx.anchor, jumps: cx.jumps, kappa: kapFor(kappa, cx.c), lone: cx.L.lone });
    lp += f.ll;
  }
  for (let i = 0; i < v.length; i++) lp -= (v[i] - prior.mean[i]) ** 2 / (2 * prior.sd[i] ** 2);
  return Number.isFinite(lp) ? lp : -Infinity;
}
function mapSearch(v0, cxs, kappa, { tol = 0.04, step0 = 0.7 } = {}) {
  const v = v0.slice(); let best = logPost(v, cxs, kappa); const step = v.map(() => step0);
  for (let it = 0; it < 80 && Math.max(...step) > tol; it++) {
    for (let i = 0; i < v.length; i++) {
      if (step[i] <= tol) continue;
      let moved = false;
      for (const dir of [1, -1]) {
        const u = v.slice(); u[i] += dir * step[i];
        const l = logPost(u, cxs, kappa);
        if (l > best + 1e-9) { best = l; v[i] = u[i]; moved = true; break; }
      }
      if (!moved) step[i] /= 2;
    }
  }
  return { v, lp: best };
}
function kappaSearch(v, cxs, kappa, houses, lone) {
  const pen = () => [...kappa.entries()].reduce((a, [h, x]) => a - (lone.has(h) ? 0 : Math.log(x) ** 2 / (2 * KAPPA_PRIOR_SD ** 2)), 0);
  for (let sweep = 0; sweep < 2; sweep++) for (const h of houses) {
    if (lone.has(h)) continue;
    let best = kappa.get(h), bv = -Infinity;
    for (const k of KAPPA_GRID) { kappa.set(h, k); const o = logPost(v, cxs, kappa) + pen(); if (o > bv) { bv = o; best = k; } }
    kappa.set(h, best);
  }
}
function hessian(v, cxs, kappa, h = 0.25) {
  const n = v.length, f0 = logPost(v, cxs, kappa), H = Array.from({ length: n }, () => new Float64Array(n));
  const at = (d) => logPost(v.map((x, i) => x + (d[i] || 0)), cxs, kappa);
  for (let i = 0; i < n; i++) { const e = []; e[i] = h; const fp = at(e); e[i] = -h; const fm = at(e); H[i][i] = (fp - 2 * f0 + fm) / (h * h); }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const e = []; e[i] = h; e[j] = h; const pp = at(e); e[j] = -h; const pm = at(e); e[i] = -h; const mm = at(e); e[j] = h; const mp = at(e);
    H[i][j] = H[j][i] = (pp - pm - mp + mm) / (4 * h * h);
  }
  return H;
}
function fitSettings(cxs, { M = 64, seed = 1, kappa0 = null } = {}) {
  const houses0 = [...new Set(cxs.filter(Boolean).flatMap((cx) => cx.L.houses))];
  const lone0 = new Set(cxs.filter(Boolean).flatMap((cx) => [...cx.L.lone]));
  const houses = KBY === "house" ? houses0 : cxs.filter(Boolean).flatMap((cx) => cx.L.houses.map((h) => h + "|" + cx.c));
  const lone = KBY === "house" ? lone0 : new Set(cxs.filter(Boolean).flatMap((cx) => [...cx.L.lone].map((h) => h + "|" + cx.c)));
  const kappa = new Map([...houses, ...lone].map((h) => [h, kappa0?.get(h) ?? 1]));
  let r = mapSearch(prior.mean.slice(), cxs, kappa);
  if (!kappa0) { kappaSearch(r.v, cxs, kappa, houses, lone); r = mapSearch(r.v, cxs, kappa, { step0: 0.3 }); }
  const v = r.v, comps = [{ v, lp: r.lp, lq: 0, w: 1 }];
  let ess = 1;
  if (M > 1) {
    const H = hessian(v, cxs, kappa), n = v.length, A = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A[i * n + j] = -H[i][j];
    for (let i = 0; i < n; i++) A[i * n + i] = Math.max(A[i * n + i], 1 / prior.sd[i] ** 2) + 1e-6;
    const C = spdInv(A, n), Lc = new Float64Array(n * n); cholIn(C, n, Lc);
    const rng = makeRng(seed);
    const lq = (u) => { const dl = Float64Array.from(u, (x, i) => x - v[i]); const s = Float64Array.from(dl); cholSolveVec(Lc, n, s); let q = 0; for (let i = 0; i < n; i++) q += dl[i] * s[i]; return -0.5 * q; };
    for (let m = 1; m < M; m++) {
      const z = Float64Array.from({ length: n }, () => rng.normal());
      const u = v.slice(); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j <= i; j++) s += Lc[i * n + j] * z[j]; u[i] += s; }
      comps.push({ v: u, lp: logPost(u, cxs, kappa), lq: lq(u) });
    }
    const lw = comps.map((c) => (Number.isFinite(c.lp) ? c.lp - c.lq : -Infinity)), mx = Math.max(...lw);
    let z = 0; comps.forEach((c, i) => { c.w = Math.exp(lw[i] - mx); z += c.w; });
    comps.forEach((c) => { c.w /= z; });
    ess = 1 / comps.reduce((a, c) => a + c.w * c.w, 0);
  }
  return { mode: v, lpMode: r.lp, kappa, comps: comps.sort((a, b) => b.w - a.w), ess, houses: houses0, lone: lone0 };
}
function allocate(comps, n) {
  const keep = comps.filter((c) => c.w * n >= 0.5), tot = keep.reduce((a, c) => a + c.w, 0);
  const al = keep.map((c) => ({ c, n: Math.floor((c.w / tot) * n), rem: ((c.w / tot) * n) % 1 }));
  let left = n - al.reduce((a, x) => a + x.n, 0);
  for (const a of [...al].sort((p, q) => q.rem - p.rem)) { if (left <= 0) break; a.n++; left--; }
  return al.filter((a) => a.n > 0);
}
/* a group's shares in SW_KEYS order from its category vector */
const reorder = (c) => { const parties = cohortParties(c); return SW_KEYS.map((k) => parties.indexOf(k)); };

/* fitSwitch: settings, then nDraw joint draws of all five rows.
   opts: { share2025, t0, t1, days, jumps: Set(day), nDraw, seed, M,
           zero (a printed 0, default 0.5), kappa0 (Map: hold κ);
           the backtest's alternatives: omega "one" | "cohort", kappaBy
           "house-cohort", trend }
   Each draw is a whole path: a row's figures at every output day drawn
   together from the smoother's joint distribution, so any two days'
   figures (today and a month ago, today and the first month) difference
   exactly, and the monthly line, today's figure and every change read the
   same draws. Draw i of every row comes from the same settings, so a
   figure built across rows (One Nation's gain split) is drawn jointly. */
export function fitSwitch(tables, opts) {
  const { share2025, t0, t1 } = opts;
  setOmega(opts.omega, opts.trend, opts.priorW); KBY = opts.kappaBy || "house";
  const jumps = opts.jumps || new Set();
  const days = [...new Set([...(opts.days || []), ...(opts.pairs || []).flat(), t1].filter((d) => d > t0 && d <= t1))].sort((a, b) => a - b);
  const cxs = contexts(tables, share2025, { t0, t1, jumps, zero: opts.zero ?? 0.5 });
  for (const cx of cxs) if (cx) cx.events = eventsOf(cx, days);
  const T0 = Date.now();
  const S = fitSettings(cxs, { M: opts.M ?? 64, seed: opts.seed ?? 1, kappa0: opts.kappa0 });
  const T1 = Date.now();
  const nDraw = opts.nDraw ?? 2000, P = SW_KEYS.length, D = P - 1, ND = days.length, R = ND * D;
  const dayIdx = new Map(days.map((d, i) => [d, i]));
  const rng = makeRng(opts.seed ?? 20261124);
  const alloc = allocate(S.comps, nDraw);
  const out = {};
  for (const cx of cxs) {
    if (!cx) continue;
    out[cx.c] = { path: new Float64Array(nDraw * ND * P), lean: new Map(cx.L.houses.map((h) => [h, new Float64Array(nDraw * P)])), best: null };
  }
  const Lpath = new Float64Array(R * R), Lbuf = new Float64Array(4 * D * D);
  let di = 0;
  for (const { c: comp, n } of alloc) {
    for (const cx of cxs) {
      if (!cx) continue;
      const th = thFor(comp.v, cx.c), L = cx.L, N = L.N, ro = reorder(cx.c);
      const { f, sm } = filterSmooth(cx.obs, L, cx.events, th, { anchor: cx.anchor, jumps: cx.jumps, kappa: kapFor(S.kappa, cx.c), lone: L.lone });
      const o = out[cx.c];
      if (!o.best) o.best = { th, f, sm };
      const evIdx = new Map(cx.events.map((d, i) => [d, i]));
      /* the joint mean and covariance of the level at every output day:
         Cov(x_a, x_b) = G_a … G_{b−1} P_b for a ≤ b (the smoother's
         cross-covariance) */
      const ks = days.map((d) => evIdx.get(d)), mu = new Float64Array(R), C = new Float64Array(R * R);
      for (let a = 0; a < ND; a++) {
        mu.set(sm.xs.subarray(ks[a] * N, ks[a] * N + D), a * D);
        for (let b = a; b < ND; b++) {
          const X = a === b ? sm.Ps.subarray(ks[a] * N * N, (ks[a] + 1) * N * N) : crossCov(sm, ks[a], ks[b]);
          for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
            const v = X[i * N + j];
            C[(a * D + i) * R + b * D + j] = v; C[(b * D + j) * R + a * D + i] = v;
          }
        }
      }
      for (let j = 0; j < n; j++) {
        const e = mvnDraw(mu, C, R, rng, Lpath), base = (di + j) * ND * P;
        for (let a = 0; a < ND; a++) {
          const s = softmaxAlr(e.subarray(a * D, (a + 1) * D));
          for (let q = 0; q < P; q++) o.path[base + a * P + q] = s[ro[q]];
        }
      }
      /* each house's lean today: its shares minus the average pollster's */
      const kN = evIdx.get(t1), xN = sm.xs.subarray(kN * N, (kN + 1) * N), PN = sm.Ps.subarray(kN * N * N, (kN + 1) * N * N);
      for (const h of L.houses) {
        const cf = L.coef.get(h), A = new Float64Array(2 * D * N);
        for (let k = 0; k < D; k++) A[k * N + k] = 1;
        for (let bk = 1; bk < L.nbLean; bk++) if (cf[bk]) for (let k = 0; k < D; k++) A[(D + k) * N + bk * D + k] = cf[bk];
        const r = 2 * D, mm = new Float64Array(r), CC = new Float64Array(r * r), AP = new Float64Array(r * N);
        for (let i = 0; i < r; i++) { let s = 0; for (let jj = 0; jj < N; jj++) s += A[i * N + jj] * xN[jj]; mm[i] = s; }
        for (let i = 0; i < r; i++) for (let jj = 0; jj < N; jj++) { let s = 0; for (let l = 0; l < N; l++) s += A[i * N + l] * PN[l * N + jj]; AP[i * N + jj] = s; }
        for (let i = 0; i < r; i++) for (let jj = 0; jj < r; jj++) { let s = 0; for (let l = 0; l < N; l++) s += AP[i * N + l] * A[jj * N + l]; CC[i * r + jj] = s; }
        const arr = o.lean.get(h);
        for (let j = 0; j < n; j++) {
          const e = mvnDraw(mm, CC, r, rng, Lbuf), pc = softmaxAlr(e.subarray(0, D)), ph = softmaxAlr(e.subarray(0, D).map((v, i) => v + e[D + i]));
          for (let q = 0; q < P; q++) arr[(di + j) * P + q] = ph[ro[q]] - pc[ro[q]];
        }
      }
    }
    di += n;
  }
  const T2 = Date.now();
  /* a row's draws at one output day: Float64Array(nDraw × 5), party q of
     draw i at [i·5 + q], SW_KEYS order */
  const at = (c, d) => {
    const o = out[c], a = dayIdx.get(d);
    if (!o || a == null) return null;
    const r = new Float64Array(nDraw * P);
    for (let i = 0; i < nDraw; i++) for (let q = 0; q < P; q++) r[i * P + q] = o.path[(i * ND + a) * P + q];
    return r;
  };
  return {
    cohorts: cxs.filter(Boolean).map((cx) => cx.c), settings: S, nDraw, P, days,
    ctx: Object.fromEntries(cxs.filter(Boolean).map((cx) => [cx.c, cx])),
    shares: at,
    /* the same draws at two days, for a change */
    pair: (c, a, b) => { const A = at(c, a), B = at(c, b); return A && B ? [A, B] : null; },
    lean: (c, h) => out[c]?.lean.get(h) || null,
    best: (c) => out[c]?.best || null,
    houses: S.houses, lone: S.lone,
    theta: Object.fromEntries(NAMES.map((nm, i) => [nm, Math.exp(S.mode[i])])),
    timing: { settings: T1 - T0, draws: T2 - T1 },
  };
}

/* summaries over draws */
export const colOf = (draws, q, P = SW_KEYS.length, scale = 100) => { const n = draws.length / P, o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = scale * draws[i * P + q]; return o; };
export function summary(c) { const lo = quant(c, 0.025), hi = quant(c, 0.975); return { v: mean(c), lo, hi, ci: (hi - lo) / 2 }; }
/* a two-sided p from draws of a difference: twice the smaller tail, floored
   at one draw's worth so a test never claims more than the draws can show */
export function pOf(d) { let up = 0; for (const x of d) if (x > 0) up++; const n = d.length, t = Math.min(up, n - up); return Math.max(1 / n, (2 * t) / n); }
export { mean, quant };

/* the filtered (real-time) prediction of one house's printed row at day t
   from the readings before it – the backtest's question; S = fitSwitch's
   settings mode, held */
export function predictRow(fit, c, house, t) {
  const cx = fit.ctx[c], best = fit.best(c);
  if (!cx || !best) return null;
  const L = cx.L, N = L.N, D = L.D, k = cx.events.indexOf(t);
  if (k < 0) return null;
  const x = best.sm.xs.subarray(k * N, (k + 1) * N);
  const cf = L.coef.get(house), mu = new Float64Array(D);
  for (let q = 0; q < D; q++) { mu[q] = x[q]; if (cf && !L.lone.has(house)) for (let b = 1; b < L.nbLean; b++) if (cf[b]) mu[q] += cf[b] * x[b * D + q]; }
  const s = softmaxAlr(mu), ro = reorder(c);
  return SW_KEYS.map((_, q) => 100 * s[ro[q]]);
}
