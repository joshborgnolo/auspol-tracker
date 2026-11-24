/* Fake-data check: tables simulated from a known truth with the real
   design (dates, houses, samples, each group's share of the sample, whole-
   point rounding, a house's lean and κ), refitted; does the model recover
   the truth, and do its 95% intervals cover it 95% of the time?
   node fakedata.mjs [reps=40] [zero=0.25] [omega=party]
   Truth: the real fit's smoothed path for every row (so the small cells
   and the moves are realistic), each house's fitted lean, κ as fitted. */
import fs from "node:fs";
import { loadTables, SW_KEYS } from "./readings.mjs";
import { fitSwitch, colOf, summary, cohortParties, SW_DEFF } from "../../newtracker/switch-model.mjs";
import { makeRng, softmaxAlr } from "../../newtracker/primary-model.mjs";

const REPS = +(process.argv[2] || 40), ZERO = +(process.argv[3] || 0.25), OMEGA = process.argv[4] || "party";
const { tables, share2025 } = loadTables();
const day = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
const t0 = tables[0].day - 1, t1 = Math.max(...tables.map((t) => t.end));
const months = [];
for (let y = 2026, m = 2; ; m++) { if (m > 12) { m = 1; y++; } const d = day(`${y}-${String(m).padStart(2, "0")}-15`); if (d >= t1) { months.push(t1); break; } months.push(d); }
const jumps = new Set([day("2026-02-12")]);
const tDays = [...new Set(tables.map((t) => t.day))];
const real = fitSwitch(tables, { share2025, t0, t1, days: [...months, ...tDays], pairs: [], jumps, nDraw: 200, M: 1, zero: ZERO, omega: OMEGA });
/* truth at a day: the real fit's smoothed level (mode settings); house h's
   printed expectation: level + its smoothed lean today, held through */
const truthAt = (c, d) => {
  const cx = real.ctx[c], b = real.best(c), N = cx.L.N, D = cx.L.D, k = cx.events.indexOf(d);
  return { eta: Float64Array.from(b.sm.xs.subarray(k * N, k * N + D)), x: b.sm.xs.subarray(k * N, (k + 1) * N), L: cx.L };
};
const houseEta = (c, d, h) => {
  const { eta, L } = truthAt(c, d), cx = real.ctx[c], b = real.best(c), N = L.N, D = L.D;
  const kN = cx.events.indexOf(t1), xN = b.sm.xs.subarray(kN * N, (kN + 1) * N), cf = L.coef.get(h);
  const out = Float64Array.from(eta);
  if (cf && !L.lone.has(h)) for (let bk = 1; bk < L.nbLean; bk++) if (cf[bk]) for (let q = 0; q < D; q++) out[q] += cf[bk] * xN[bk * D + q];
  return out;
};
const ro = (c) => { const p = cohortParties(c); return SW_KEYS.map((k) => p.indexOf(k)); };
const truthShares = (c, d) => { const s = softmaxAlr(truthAt(c, d).eta), r = ro(c); return SW_KEYS.map((_, q) => 100 * s[r[q]]); };
const TRUTH = Object.fromEntries(SW_KEYS.map((c) => [c, months.map((d) => truthShares(c, d))]));
const rng = makeRng(11);
const binom = (n, p) => {
  if (n * p * (1 - p) > 25) return Math.max(0, Math.min(n, Math.round(n * p + Math.sqrt(n * p * (1 - p)) * rng.normal())));
  let k = 0; for (let i = 0; i < n; i++) if (rng.u() < p) k++; return k;
};
const stats = {};   // key -> { n, cover, bias, z2 }
const add = (key, est, truth) => {
  const s = stats[key] || (stats[key] = { n: 0, cover: 0, bias: 0, abs: 0, w: 0 });
  s.n++; s.cover += truth >= est.lo && truth <= est.hi ? 1 : 0; s.bias += est.v - truth; s.abs += Math.abs(est.v - truth); s.w += est.hi - est.lo;
};
for (let rep = 0; rep < REPS; rep++) {
  const sim = tables.map((t) => {
    const kap = real.settings.kappa.get(t.house) ?? 1;
    const rows = {};
    for (const c of SW_KEYS) {
      const p = softmaxAlr(houseEta(c, t.day, t.house)), r = ro(c);
      const nEff = Math.round((t.n / SW_DEFF) * share2025[c] / 100 / kap);
      let left = nEff, rest = 1; const cnt = new Float64Array(p.length);
      for (let q = 0; q < p.length - 1; q++) { const x = binom(left, Math.min(1, Math.max(0, p[q] / rest))); cnt[q] = x; left -= x; rest -= p[q]; }
      cnt[p.length - 1] = left;
      const printed = SW_KEYS.map((_, q) => Math.round(100 * cnt[r[q]] / nEff));
      const tot = printed.reduce((a, b) => a + b, 0);
      rows[c] = Object.fromEntries(SW_KEYS.map((k, q) => [k, 100 * printed[q] / tot]));
    }
    return { ...t, rows };
  });
  const fit = fitSwitch(sim, { share2025, t0, t1, days: months, pairs: [[t1, months[0]]], jumps, nDraw: 1000, M: 16, seed: rep + 1, zero: ZERO, omega: OMEGA });
  for (const c of SW_KEYS) {
    months.forEach((d, mi) => {
      const dr = fit.shares(c, d);
      SW_KEYS.forEach((k, q) => {
        const est = summary(colOf(dr, q)), tr = TRUTH[c][mi][q];
        add(`${c}>${k}|past`, est, tr);
        if (d === t1) add(`${c}>${k}|now`, est, tr);
      });
    });
    const [A, B] = fit.pair(c, t1, months[0]);
    SW_KEYS.forEach((k, q) => {
      const dd = colOf(A, q).map((v, i) => v - colOf(B, q)[i]);
      add(`${c}>${k}|chg`, summary(dd), TRUTH[c][months.length - 1][q] - TRUTH[c][0][q]);
    });
  }
  if ((rep + 1) % 10 === 0) process.stderr.write(`rep ${rep + 1}\n`);
}
const out = [];
for (const c of SW_KEYS) for (const k of SW_KEYS) {
  const r = ["now", "past", "chg"].map((w) => { const s = stats[`${c}>${k}|${w}`]; return s ? `${w} ${(100 * s.cover / s.n).toFixed(0)}% bias ${(s.bias / s.n >= 0 ? "+" : "") + (s.bias / s.n).toFixed(2)} mae ${(s.abs / s.n).toFixed(2)}` : ""; });
  out.push(`${(c + ">" + k).padEnd(8)} truth now ${TRUTH[c][months.length - 1][SW_KEYS.indexOf(k)].toFixed(1).padStart(5)} | ${r.join(" | ")}`);
}
const tot = (w) => { const ss = Object.entries(stats).filter(([key]) => key.endsWith("|" + w)).map(([, s]) => s); const n = ss.reduce((a, s) => a + s.n, 0); return (100 * ss.reduce((a, s) => a + s.cover, 0) / n).toFixed(1) + "%"; };
console.log(`zero ${ZERO}, omega ${OMEGA}, ${REPS} reps`);
console.log(out.join("\n"));
console.log(`overall cover: now ${tot("now")}, past months ${tot("past")}, change since Feb ${tot("chg")}`);
fs.mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`./results/fake-${ZERO}-${OMEGA}.json`, import.meta.url), JSON.stringify(stats));
