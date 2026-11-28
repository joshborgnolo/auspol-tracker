/* Life satisfaction: one line from the surveys that move together
   (2026-11-28; prototype and backtest in .build/analysis/life-bayes/).
   gen-data §5u calls fitLife. The trust model's filter and sampler
   (trust-model.mjs) on the 0–10 mean itself:

     y_i = m_t + lean_s + e_i        survey s's published mean
       m_t    latent life satisfaction on ANUpoll's current panel's terms
              (its lean is zero): a random walk (ω a day), with extra
              variance Jp² on the WHO's pandemic declaration of 11 March
              2020. Elections get no jump: the data prefer none (log
              evidence −0.6 v −0.1).
       lean_s the ABS General Social Survey's level, and the gap between
              ANUpoll's Life in Australia panel and its current one. Prior
              sd 1 and PANEL_SD: a change of panel is a smaller thing than a
              change of survey. Leans drift (δ a day). The panel prior only
              moves the pre-2024 history (the gap reads +0.10 to +0.22 for
              priors from 0.1 to 1), never today's figure.
       e_i    sampling (deff 1.6, respondent sd 1.9 as ANU prints it, on n)
              + τ²

   Left out, and why:
   · HILDA. It follows the same households and has sat between 7.8 and 8.0
     since 2001, through a pandemic in which ANUpoll fell 0.5. Given its own
     sensitivity to the others' movement the data put it at zero or below
     (HILDA forced to move one-for-one: log evidence 15.5; free: 36.8, with
     82% of the weight at 0 or less). It measures something that doesn't
     move with these, so it stays its own published line.
   · A survey with one reading (Scanlon). With a lean of its own it says
     nothing about the line, and moved onto the line's terms its dot would
     land on the line by construction.

   Tested, not adopted: a faster walk through the pandemic's lockdowns
   (+0.8 log evidence); each wave still reads about 0.1 noisier than its
   sample explains, so the line moves less than the waves do.

   Settings integrated over a grid; seeded draws. Backtest (each reading
   from those before it, 16 readings): average miss 0.12, the same as the
   survey's own last reading; 95% bands covered 15 of 16. */
import { runFilter, smooth, ffbs, allocate, makeRng, DAY, PANDEMIC } from "./trust-model.mjs";

export const REF = "anupoll";
export const PANEL_SD = 0.25, SURVEY_SD = 1;
export const RESP_SD = 1.9, DEFF = 1.6;
export const GRID = { w: [0.003, 0.005, 0.008, 0.012, 0.018, 0.027], d: [0, 0.0005, 0.001, 0.002, 0.004], tau: [0, 0.03, 0.06, 0.1, 0.15, 0.2], Jp: [0, 0.15, 0.3, 0.5] };
function* gridPoints(g) { for (const w of g.w) for (const d of g.d) for (const tau of g.tau) for (const Jp of g.Jp) yield { w, d, tau, Jp, J: 0, s: 0 }; }

/* readings: [{ house, day, v (0–10 mean), n }], house REF for the terms the
   line is printed on and "anupoll-lia" for the earlier panel; days: output days */
export function fitLife(readings, { days, nDraw = 2000, seed = 20261128 }) {
  const obs = readings.map((r, idx) => ({ t: r.day, y: r.v, v: (DEFF * RESP_SD ** 2) / r.n + 0.005 ** 2 / 3, house: r.house, idx }))
    .sort((a, b) => a.t - b.t || a.idx - b.idx);
  const houses = [...new Set(obs.map((o) => o.house))], others = houses.filter((h) => h !== REF), N = 1 + others.length;
  const unit = (i) => { const v = new Float64Array(N); if (i >= 0) v[i] = 1; return v; };
  const leanRow = new Map([[REF, unit(-1)], ...others.map((h, i) => [h, unit(i + 1)])]);
  const row = new Map([...leanRow].map(([h, v]) => { const w = Float64Array.from(v); w[0] = 1; return [h, w]; }));
  const L = { N, K: 1, row, leanRow, houses };
  const sd = [0, ...others.map((h) => (h === "anupoll-lia" ? PANEL_SD : SURVEY_SD))];
  const t0 = obs[0].t, t1 = obs[obs.length - 1].t, pandemic = DAY(PANDEMIC);
  const outDays = [...new Set(days.filter((d) => d >= t0 && d <= t1))];
  /* the earlier panel's gap, read while it was still asked (after that its
     lean only drifts) */
  const panelDay = obs.filter((o) => o.house === "anupoll-lia").pop()?.t ?? null;
  const fitEvents = [...new Set([...obs.map((o) => o.t), ...(pandemic > t0 && pandemic <= t1 ? [pandemic] : [])])].sort((a, b) => a - b);
  const events = [...new Set([...fitEvents, ...outDays, t1])].sort((a, b) => a - b);
  const opts = { m0: obs[0].y, jumps: new Set(), pandemic, sd };
  const rows = [...gridPoints(GRID)].map((th) => ({ th, ll: runFilter(obs, L, fitEvents, th, opts).ll }));
  const mx = Math.max(...rows.map((r) => r.ll)); let z = 0;
  for (const r of rows) { r.w = Math.exp(r.ll - mx); z += r.w; }
  for (const r of rows) r.w /= z;
  rows.sort((a, b) => b.w - a.w);
  const evIdx = new Map(events.map((d, i) => [d, i])), keep = new Map();
  for (const d of [...outDays, ...(panelDay != null ? [panelDay] : []), t1]) { const i = evIdx.get(d); if (!keep.has(i)) keep.set(i, keep.size); }
  const slotOfDay = new Map([...outDays, t1].map((d) => [d, keep.get(evIdx.get(d))]));
  const S = keep.size, rng = makeRng(seed), draws = [];
  for (const { r, n } of allocate(rows, nDraw)) {
    const f = runFilter(obs, L, events, r.th, { ...opts, store: true });
    const batch = Array.from({ length: n }, () => ({ v: new Float64Array(S), panel: 0 }));
    const lia = others.indexOf("anupoll-lia") + 1;
    ffbs(f, N, n, keep, rng, (d, k, x) => {
      batch[d].v[keep.get(k)] = x[0];
      if (lia && k === evIdx.get(panelDay)) batch[d].panel = x[lia];
    });
    draws.push(...batch);
  }
  /* each survey's lean at every reading day, averaged over the grid, for
     moving its readings onto the line's terms */
  const heavy = rows.filter((r) => r.w > 0.002), hz = heavy.reduce((a, r) => a + r.w, 0);
  const sm = heavy.map((r) => ({ w: r.w / hz, xs: smooth(runFilter(obs, L, events, r.th, { ...opts, store: true }), N) }));
  const leanAt = (house, day) => {
    const k = evIdx.get(day), i = others.indexOf(house) + 1;
    return house === REF || !i ? 0 : sm.reduce((a, s) => a + s.w * s.xs[k][i], 0);
  };
  const edges = Object.keys(GRID).filter((k) => { const vs = GRID[k], wOf = (v) => rows.filter((r) => r.th[k] === v).reduce((a, r) => a + r.w, 0); return (vs[0] !== 0 && wOf(vs[0]) > 0.5) || wOf(vs[vs.length - 1]) > 0.5; });
  return { draws, slotOfDay, t1, best: rows[0].th, leanAt, panelDay, edges, n: draws.length };
}
