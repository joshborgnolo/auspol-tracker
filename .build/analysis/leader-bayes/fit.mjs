/* Fit + backtest the leadership model variants (analysis).
   node fit.mjs [ratings|ppm] */
import fs from "node:fs";
import { fitSettings, predictAll, runFilter } from "./leader-model.mjs";
import { ratingSeries, ppmSeries, ISO } from "./series.mjs";
const J = JSON.parse(fs.readFileSync(new URL("./readings.json", import.meta.url)));
const which = process.argv[2] || "none";

export const GRID_R = { w: [0.005, 0.0075, 0.01, 0.014, 0.02], d: [0, 0.0007, 0.0015, 0.003, 0.006], s: [0.02, 0.05, 0.1], tau: [0, 0.01, 0.02, 0.035], J: [0.05, 0.1, 0.2] };
export const GRID_P = { w: [0.004, 0.007, 0.012, 0.02], d: [0, 0.001, 0.002, 0.004], s: [0.03, 0.1, 0.25], tau: [0, 0.03, 0.06, 0.1], J: [0.05, 0.15, 0.3] };

/* ---- the recipe, past-only: house effects (houseEffectsFor) + nowcast window ---- */
const LN2 = Math.log(2), HE_WINDOW = 28, HE_HALF = 90, SHRINK_K = 1.5;
const recency = (win) => { const half = win / 3, taper = (2 * win) / 3; return (d) => Math.exp(-LN2 * d / half) * (d <= taper ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - taper) / (win - taper)))); };
export function recipePredict(rows, { win, houseAdj, equalW, toY }) {
  /* rows: [{ t, x (target scale, points), house, n, strat }] sorted by t; returns Map i → prediction (points) */
  const out = new Map(), wf = recency(win);
  const devs = [];       // { house, t, dev } computed when both a and neighbours are in the past
  for (let k = 0; k < rows.length; k++) {
    const a = rows[k], t = a.t;
    const past = rows.filter((b) => b.t < t);
    let heAt = () => 0;
    if (houseAdj) {
      const ds = [];
      for (const p of past) {
        let sw = 0, swx = 0, c = 0;
        for (const b of past) { if (b === p || b.house === p.house || Math.abs(b.t - p.t) > HE_WINDOW || b.strat !== p.strat) continue; sw += b.n; swx += b.n * b.x; c++; }
        if (c >= 3) ds.push({ house: p.house, t: p.t, dev: p.x - swx / sw });
      }
      heAt = (h) => { let sw = 0, swx = 0; for (const d of ds) if (d.house === h) { const w = Math.exp(-LN2 * (t - d.t) / HE_HALF); sw += w; swx += w * d.dev; } return sw ? (sw / (sw + SHRINK_K)) * (swx / sw) : 0; };
    }
    const inWin = past.filter((b) => t - b.t <= win);
    if (!inWin.length) continue;
    const waves = new Map(); for (const b of inWin) waves.set(b.house, (waves.get(b.house) || 0) + 1);
    let sw = 0, swx = 0;
    for (const b of inWin) { const w = (equalW ? 1 : b.n) * wf(t - b.t) / Math.sqrt(waves.get(b.house)); sw += w; swx += w * (b.x - heAt(b.house)); }
    if (sw > 0) out.set(a.i, swx / sw + heAt(a.house));
  }
  return out;
}

const summarize = (label, P, toPts) => {
  const e = P.map((p) => Math.abs(toPts(p.mu, p) - toPts(p.y, p)));
  const z = P.map((p) => Math.abs(p.y - p.mu) / Math.sqrt(p.S));
  const cov = z.filter((x) => x <= 1.96).length / z.length;
  console.log(`${label.padEnd(44)} n=${String(P.length).padStart(5)}  MAE ${(e.reduce((a, b) => a + b, 0) / e.length).toFixed(2)}  RMSE ${Math.sqrt(e.reduce((a, b) => a + b * b, 0) / e.length).toFixed(2)}  95% cover ${(100 * cov).toFixed(1)}%`);
  return e;
};

if (which === "ratings") {
  const variants = {
    combined_compress: { metrics: ["approval", "fav"], compress: true },
    combined_plain: { metrics: ["approval", "fav"], compress: false },
    approval_only: { metrics: ["approval"], compress: true },
    fav_only: { metrics: ["fav"], compress: true },
  };
  const fits = {};
  for (const [name, o] of Object.entries(variants)) {
    const T = Date.now();
    const series = ratingSeries(J.ratings, o);
    const st = fitSettings(series, GRID_R);
    const P = predictAll(series, st.best, st.kappa);
    fits[name] = { series, st, P };
    console.log(`\n${name}: ${series.length} series, best ${JSON.stringify(st.best)} edges ${st.edges.join(",") || "-"} top w ${st.rows.slice(0, 3).map((r) => r.w.toFixed(2)).join(" ")} (${Date.now() - T} ms)`);
    console.log("  κ", [...st.kappa].map(([h, k]) => h + " " + k).join(", "));
  }
  /* the recipe on every rating series (as production: approval and favourability separate strata, equal house weights, 3 weeks for the majors / 6 weeks otherwise) */
  const recipe = new Map();
  for (const S of fits.combined_compress.series) {
    const rows = S.obs.map((o) => ({ t: o.t, x: o.y * 100, house: o.house, n: o.raw.n, strat: o.raw.metric, i: o.raw.i }));
    const byStrat = new Map(); for (const r of rows) { const a = byStrat.get(r.strat) || []; a.push(r); byStrat.set(r.strat, a); }
    for (const [strat, rs] of byStrat) {
      const win = (S.role === "han" || strat === "fav") ? 42 : 21;
      for (const [i, v] of recipePredict(rs, { win, houseAdj: true, equalW: true })) recipe.set(i, v);
    }
  }
  const toPts = (v) => v * 100;
  console.log("\n— next-poll errors, net points (readings with a recipe prediction and not a lone house) —");
  for (const scope of [["all", () => true], ["2025– term", (p) => p.t >= 20211], ["approval readings", (p) => p.raw.metric === "approval"], ["favourability readings", (p) => p.raw.metric === "fav"], ["pre-2007", (p) => p.t < 13841]]) {
    console.log(`\n[${scope[0]}]`);
    const base = fits.combined_compress.P.filter((p) => recipe.has(p.raw.i) && !p.lone && scope[1](p));
    const keys = new Set(base.map((p) => p.raw.i));
    for (const [name, F] of Object.entries(fits)) {
      const P = F.P.filter((p) => keys.has(p.raw.i));
      if (P.length) summarize(name, P, toPts);
    }
    const rp = base.map((p) => Math.abs(recipe.get(p.raw.i) - p.y * 100));
    console.log(`${"recipe (window + house effects)".padEnd(44)} n=${String(rp.length).padStart(5)}  MAE ${(rp.reduce((a, b) => a + b, 0) / rp.length).toFixed(2)}  RMSE ${Math.sqrt(rp.reduce((a, b) => a + b * b, 0) / rp.length).toFixed(2)}`);
  }
  fs.writeFileSync(new URL("./fit-ratings.json", import.meta.url), JSON.stringify(Object.fromEntries(Object.entries(fits).map(([k, F]) => [k, { best: F.st.best, kappa: [...F.st.kappa], rows: F.st.rows.slice(0, 40).map((r) => ({ th: r.th, w: r.w, ll: r.ll })) }]))));
}

if (which === "ppm") {
  const variants = {
    decided_2pmpOwn: { twoPmpOwn: true },
    decided_2pmpAsNewspoll: { twoPmpOwn: false },
  };
  const fits = {};
  for (const [name, o] of Object.entries(variants)) {
    const T = Date.now();
    const series = ppmSeries(J.ppm, o);
    const st = fitSettings(series, GRID_P);
    const P = predictAll(series, st.best, st.kappa);
    fits[name] = { series, st, P };
    console.log(`\n${name}: ${series.length} series, best ${JSON.stringify(st.best)} edges ${st.edges.join(",") || "-"} top w ${st.rows.slice(0, 3).map((r) => r.w.toFixed(2)).join(" ")} (${Date.now() - T} ms)`);
    console.log("  κ", [...st.kappa].map(([h, k]) => h + " " + k).join(", "));
  }
  const sh = (y) => 100 / (1 + Math.exp(-y));
  const recipe = new Map();
  for (const S of fits.decided_2pmpOwn.series) {
    const rows = S.obs.map((o) => ({ t: o.t, x: sh(o.y), house: o.house, n: o.raw.n, strat: "-", i: o.raw.i }));
    for (const [i, v] of recipePredict(rows, { win: 42, houseAdj: false, equalW: false })) recipe.set(i, v);
  }
  const recipeHE = new Map();
  for (const S of fits.decided_2pmpOwn.series) {
    const rows = S.obs.map((o) => ({ t: o.t, x: sh(o.y), house: o.house, n: o.raw.n, strat: "-", i: o.raw.i }));
    for (const [i, v] of recipePredict(rows, { win: 42, houseAdj: true, equalW: false })) recipeHE.set(i, v);
  }
  console.log("\n— next-poll errors, PM's share of those who chose (points) —");
  for (const scope of [["all", () => true], ["2022– terms", (p) => p.t >= 19133], ["pre-2007", (p) => p.t < 13841]]) {
    console.log(`\n[${scope[0]}]`);
    const base = fits.decided_2pmpOwn.P.filter((p) => recipe.has(p.raw.i) && !p.lone && scope[1](p));
    const keys = new Set(base.map((p) => p.raw.i));
    for (const [name, F] of Object.entries(fits)) summarize(name, F.P.filter((p) => keys.has(p.raw.i)), (v) => sh(v));
    for (const [lab, R] of [["recipe (6-week window, no house adj.)", recipe], ["recipe + house effects", recipeHE]]) {
      const rp = base.map((p) => Math.abs(R.get(p.raw.i) - sh(p.y)));
      console.log(`${lab.padEnd(44)} n=${String(rp.length).padStart(5)}  MAE ${(rp.reduce((a, b) => a + b, 0) / rp.length).toFixed(2)}  RMSE ${Math.sqrt(rp.reduce((a, b) => a + b * b, 0) / rp.length).toFixed(2)}`);
    }
  }
  fs.writeFileSync(new URL("./fit-ppm.json", import.meta.url), JSON.stringify(Object.fromEntries(Object.entries(fits).map(([k, F]) => [k, { best: F.st.best, kappa: [...F.st.kappa] }]))));
}
