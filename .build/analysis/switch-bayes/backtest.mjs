/* Predicting each table before it was published: the model (refit on the
   tables released before it, its house's lean included) against the recipe
   (six-week nowcast of the same tables, no house adjustment).
   node backtest.mjs [variant]   variants: base | nojump | onew | zero50 | jeff
   Writes results/<variant>.json. */
import fs from "node:fs";
import { loadTables, SW_KEYS } from "./readings.mjs";
import { fitSwitch, predictRow, cohortParties, SW_DEFF } from "../../newtracker/switch-model.mjs";
import { recipeAt } from "./recipe.mjs";
import { makeRng, softmaxAlr, alrOf } from "../../newtracker/primary-model.mjs";

const variant = process.argv[2] || "base";
const { tables, share2025 } = loadTables();
const day = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
const JUMP = day("2026-02-12");
const opts = {
  base: {}, nojump: { jumps: new Set() }, zero50: { zero: 0.5 }, zero10: { zero: 0.1 },
  onew: { omega: "one" }, cohortw: { omega: "cohort" }, kapc: { kappaBy: "house-cohort" },
  onew50: { omega: "one", zero: 0.5 }, kapc50: { kappaBy: "house-cohort", zero: 0.5 }, cohortw50: { omega: "cohort", zero: 0.5 },
  nojump50: { jumps: new Set(), zero: 0.5 },
  w004: { priorW: [0.004, 0.05] }, w008: { priorW: [0.008, 0.05] }, w015: { priorW: [0.015, 0.05] }, w030: { priorW: [0.03, 0.05] }, w002: { priorW: [0.002, 0.05] },
  trend50: { trend: true, zero: 0.5 }, trendone50: { trend: true, omega: "one", zero: 0.5 }, trendkapc50: { trend: true, zero: 0.5, kappaBy: "house-cohort" },
}[variant] || {};
const MIN_TRAIN = +(process.env.MIN_TRAIN || 4);
const order = [...tables].sort((a, b) => a.pub - b.pub || a.day - b.day);
const rows = [];
const rng = makeRng(7);
for (let j = 0; j < order.length; j++) {
  const target = order[j];
  const train = tables.filter((t) => t.pub < target.pub);
  if (train.length < MIN_TRAIN) continue;
  const t0 = Math.min(...train.map((t) => t.day)) - 1;
  const t1 = Math.max(target.day, ...train.map((t) => t.day));
  const fit = fitSwitch(train, { share2025, t0, t1, days: [target.day], pairs: [], jumps: opts.jumps ?? new Set([JUMP]), nDraw: 400, M: 1, zero: opts.zero ?? 0.5, omega: opts.omega, kappaBy: opts.kappaBy, trend: opts.trend, priorW: opts.priorW });
  for (const c of SW_KEYS) {
    const obs = target.rows[c];
    const pm = predictRow(fit, c, target.house, target.day);
    const pr = recipeAt(train, c, target.day, share2025);
    /* the model's predictive draws of the PRINTED row: today's state for the
       house (its lean if it has one), then a poll of the group's size with
       the house's κ, rounded to whole points */
    const cx = fit.ctx[c], best = fit.best(c), L = cx.L, N = L.N, D = L.D, k = cx.events.indexOf(target.day);
    const x = best.sm.xs.subarray(k * N, (k + 1) * N), Pk = best.sm.Ps.subarray(k * N * N, (k + 1) * N * N);
    const cf = L.coef.get(target.house), inState = !!cf && !L.lone.has(target.house);
    const A = new Float64Array(D * N);
    for (let q = 0; q < D; q++) { A[q * N + q] = 1; if (inState) for (let b = 1; b < L.nbLean; b++) if (cf[b]) A[q * N + b * D + q] = cf[b]; }
    const m = new Float64Array(D), C = new Float64Array(D * D);
    for (let a = 0; a < D; a++) { let s = 0; for (let l = 0; l < N; l++) s += A[a * N + l] * x[l]; m[a] = s; }
    for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) { let s = 0; for (let l = 0; l < N; l++) for (let r = 0; r < N; r++) s += A[a * N + l] * Pk[l * N + r] * A[b * N + r]; C[a * D + b] = s; }
    if (!inState) for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) C[a * D + b] += 0.25 * ((a === b ? 1 : 0) + 1);
    const kap = fit.settings.kappa.get(target.house) ?? fit.settings.kappa.get(target.house + "|" + c) ?? 1;
    const nEff = (target.n / SW_DEFF) * share2025[c] / 100 / kap;
    const parties = cohortParties(c), ro = SW_KEYS.map((kk) => parties.indexOf(kk));
    const sims = SW_KEYS.map(() => []);
    const Lc = new Float64Array(D * D);
    { // cholesky
      for (let i = 0; i < D; i++) for (let jj = 0; jj <= i; jj++) { let s = C[i * D + jj]; for (let kk = 0; kk < jj; kk++) s -= Lc[i * D + kk] * Lc[jj * D + kk]; Lc[i * D + jj] = i === jj ? Math.sqrt(Math.max(s, 1e-12)) : s / Lc[jj * D + jj]; }
    }
    for (let it = 0; it < 1000; it++) {
      const z = Array.from({ length: D }, () => rng.normal()), e = Float64Array.from(m);
      for (let i = 0; i < D; i++) for (let jj = 0; jj <= i; jj++) e[i] += Lc[i * D + jj] * z[jj];
      const p = softmaxAlr(e);
      /* multinomial of nEff, by sequential binomials (normal approx past 30) */
      let left = Math.round(nEff), rest = 1; const cnt = new Float64Array(p.length);
      for (let q = 0; q < p.length - 1; q++) {
        const pq = Math.min(1, Math.max(0, p[q] / rest));
        let draw;
        if (left * pq * (1 - pq) > 9) draw = Math.round(left * pq + Math.sqrt(left * pq * (1 - pq)) * rng.normal());
        else { draw = 0; for (let u = 0; u < left; u++) if (rng.u() < pq) draw++; }
        draw = Math.max(0, Math.min(left, draw)); cnt[q] = draw; left -= draw; rest -= p[q];
      }
      cnt[p.length - 1] = left;
      const tot = cnt.reduce((a, b) => a + b, 0) || 1;
      for (let q = 0; q < SW_KEYS.length; q++) sims[q].push(Math.round(100 * cnt[ro[q]] / tot));
    }
    for (const [q, kk] of SW_KEYS.entries()) {
      const s = sims[q].sort((a, b) => a - b), lo = s[25], hi = s[974];
      const ov = obs[kk], rv = pr[kk];
      const rsd = rv ? Math.sqrt(rv.se ** 2 + SW_DEFF * rv.v * (100 - rv.v) / ((target.n * share2025[c] / 100))) : null;
      rows.push({ key: target.key, house: target.house, c, k: kk, obs: ov, model: pm[q], recipe: rv ? rv.v : null,
        mIn: ov >= lo - 0.5 && ov <= hi + 0.5, rIn: rv ? Math.abs(ov - rv.v) <= 1.96 * rsd + 0.5 : null,
        mW: hi - lo, rW: rsd ? 2 * 1.96 * rsd : null, inState });
    }
  }
}
fs.mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`./results/${variant}.json`, import.meta.url), JSON.stringify(rows));
const both = rows.filter((r) => r.recipe != null);
const mae = (rs, f) => rs.reduce((a, r) => a + Math.abs(r.obs - r[f]), 0) / rs.length;
const pct = (rs, f) => (100 * rs.filter((r) => r[f]).length / rs.length).toFixed(0) + "%";
const groups = {
  "all cells": both,
  "the One Nation rates (x→onp, onp kept)": both.filter((r) => r.k === "onp"),
  "kept shares": both.filter((r) => r.c === r.k),
  "Coalition row": both.filter((r) => r.c === "lnp"), "Labor row": both.filter((r) => r.c === "alp"), "Greens row": both.filter((r) => r.c === "grn"),
  "One Nation row": both.filter((r) => r.c === "onp"), "others row": both.filter((r) => r.c === "oth"),
  "YouGov tables": both.filter((r) => r.house === "YouGov"), "DemosAU tables": both.filter((r) => r.house === "DemosAU"),
};
console.log(`variant ${variant}: ${new Set(both.map((r) => r.key)).size} tables predicted, ${both.length} cells`);
for (const [nm, rs] of Object.entries(groups)) if (rs.length)
  console.log(`  ${nm.padEnd(40)} model ${mae(rs, "model").toFixed(2)}  recipe ${mae(rs, "recipe").toFixed(2)}  | 95% cover model ${pct(rs, "mIn")} recipe ${pct(rs, "rIn")} | width ${(rs.reduce((a, r) => a + r.mW, 0) / rs.length).toFixed(1)} v ${(rs.reduce((a, r) => a + r.rW, 0) / rs.length).toFixed(1)}  (n ${rs.length})`);
/* One Nation's gain split (the panel's headline): each group's part of the
   points One Nation drew from voters it didn't have in 2025, from the
   predicted rows v the printed table */
{
  const byKey = new Map();
  for (const r of both) { const o = byKey.get(r.key) || byKey.set(r.key, { m: {}, r: {}, o: {} }).get(r.key); if (r.k === "onp") { o.m[r.c] = r.model; o.r[r.c] = r.recipe; o.o[r.c] = r.obs; } }
  const G = ["lnp", "alp", "grn", "oth"];
  const split = (x) => { const pts = G.map((c) => share2025[c] * x[c]); const s = pts.reduce((a, b) => a + b, 0); return pts.map((p) => 100 * p / s); };
  let em = 0, er = 0, n = 0;
  for (const o of byKey.values()) { const so = split(o.o), sm = split(o.m), sr = split(o.r); for (let i = 0; i < G.length; i++) { em += Math.abs(sm[i] - so[i]); er += Math.abs(sr[i] - so[i]); n++; } }
  console.log(`  gain split (share of One Nation's gain by group)  model ${(em / n).toFixed(2)}  recipe ${(er / n).toFixed(2)}  (${n / G.length} tables)`);
}
