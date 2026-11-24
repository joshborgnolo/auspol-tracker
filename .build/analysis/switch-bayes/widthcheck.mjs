/* Where today's band comes from: the level's spread at the last table and
   at the build's "now" (newest poll of any kind), and each house's own
   figure (level + its lean), Coalition and Labor rows. */
import { loadTables, SW_KEYS } from "./readings.mjs";
import { fitSwitch, colOf, summary } from "../../newtracker/switch-model.mjs";
const { tables, share2025 } = loadTables();
const day = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
const t0 = tables[0].day - 1, last = Math.max(...tables.map((t) => t.day)), t1 = day(process.env.T1 || "2026-11-23");
const fit = fitSwitch(tables, { share2025, t0, t1, days: [last, t1], jumps: new Set([day("2026-02-12")]), nDraw: 4000, M: 64 });
for (const c of ["lnp", "alp"]) {
  const q = SW_KEYS.indexOf("onp");
  const a = summary(colOf(fit.shares(c, last), q)), b = summary(colOf(fit.shares(c, t1), q));
  console.log(`${c}→onp: level at last table ${a.v.toFixed(1)} ±${a.ci.toFixed(1)}; at now ${b.v.toFixed(1)} ±${b.ci.toFixed(1)}`);
  for (const h of fit.houses) { const l = fit.lean(c, h); if (l) { const s = summary(colOf(l, q)); console.log(`   lean ${h} ${s.v.toFixed(1)} [${s.lo.toFixed(1)}, ${s.hi.toFixed(1)}]`); } }
  /* at the mode: the level's sd and YouGov's figure's sd at the last table, log-ratio scale */
  const cx = fit.ctx[c], best = fit.best(c), L = cx.L, N = L.N, D = L.D, k = cx.events.indexOf(last);
  const P = best.sm.Ps.subarray(k * N * N, (k + 1) * N * N), cf = L.coef.get("YouGov");
  const qq = 3; // onp's index in cohortParties order: [alp, grn, onp, oth, lnp] for lnp; find it
  const parties = SW_KEYS.filter((x) => x !== c).concat([c]), qo = parties.indexOf("onp");
  const varLevel = P[qo * N + qo];
  let varYG = 0; const A = new Float64Array(N); A[qo] = 1; for (let b2 = 1; b2 < L.nbLean; b2++) if (cf[b2]) A[b2 * D + qo] = cf[b2];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) varYG += A[i] * P[i * N + j] * A[j];
  console.log(`   log-ratio sd (onp v kept) at last table: level ${Math.sqrt(varLevel).toFixed(3)}, YouGov's own figure ${Math.sqrt(varYG).toFixed(3)}`);
}
console.log("theta", fit.theta, "kappa", Object.fromEntries(fit.settings.kappa));
