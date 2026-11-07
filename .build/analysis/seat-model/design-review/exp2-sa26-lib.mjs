// E2: the SA-2026 Liberal collapse (36.2 -> 19.0) and Labor's small fall — which geometry predicts district shares?
import { load, divRows, boothRows, km, sum, mean, logit, ilogit, logitShift, mae, rmse, corr } from "./lib.mjs";
const fed = load("maps/data/res-2025.json");
const sa = load("maps/data/res-sa26.json");
const S = divRows(sa);
const fedB = boothRows(fed).filter((b) => b.st === "SA" && b.tot >= 30);
const saB = boothRows(sa);
const K = 4, foot = S.map(() => ({ w: 0, on: 0 }));
for (const b of saB) {
  const near = fedB.map((f) => ({ f, d: km(b, f) })).sort((x, y) => x.d - y.d).slice(0, K);
  const ws = near.map((x) => x.f.tot / (0.5 + x.d) ** 2), W = sum(ws);
  foot[b.d].w += b.tot; foot[b.d].on += b.tot * sum(near.map((x, i) => ws[i] * x.f.sh.onp)) / W;
}
const wts = S.map((s) => s.tot), W = sum(wts);
const wmean = (a) => sum(a.map((x, i) => x * wts[i])) / W;
// ON prediction (logit shift from fed-25 footprint) — pre-election information only + statewide total
const onT = wmean(S.map((s) => s.sh.onp));
const xo = foot.map((t) => logit(t.on / t.w)); const co = logitShift(xo, wts, onT);
const onPred = xo.map((x) => ilogit(x + co));

const indSteady = S.map((s) => Math.abs(s.sh.ind - s.base.ind) < 0.05);
console.log(`districts with IND share change < 5pts: ${indSteady.filter(Boolean).length}/47`);
for (const party of ["lnp", "alp"]) {
  const act = S.map((s) => s.sh[party]), base = S.map((s) => Math.max(s.base[party], 0.005));
  const T = wmean(act), B0 = wmean(base);
  console.log(`\n${party.toUpperCase()}: notional-2022 ${(100 * B0).toFixed(1)} -> 2026 ${(100 * T).toFixed(1)}`);
  const M = {};
  M["uniform"] = base.map((b) => b + (T - B0));
  M["proportional"] = base.map((b) => b * T / B0);
  { const xs = base.map(logit); const c = logitShift(xs, wts, T); M["logit shift"] = xs.map((x) => ilogit(x + c)); }
  // ON-linked loss: party loses share kappa*onPred_i of its own base (more where ON pulls harder), kappa calibrated to the state total
  { let lo = -5, hi = 5; for (let it = 0; it < 100; it++) { const k = (lo + hi) / 2; const m = wmean(base.map((b, i) => b * (1 - k * onPred[i]))); if (m > T) lo = k; else hi = k; }
    const k = (lo + hi) / 2; M[`ON-linked loss (kappa ${k.toFixed(2)})`] = base.map((b, i) => b * (1 - k * onPred[i])); }
  // ON-linked loss on logit scale: logit(p26) = logit(p22) + c + g*(logit onPred - mean)
  for (const g of [-0.5, -1.0]) { const xs = base.map((b, i) => logit(b) + g * (logit(onPred[i]) - mean(onPred.map(logit)))); const c = logitShift(xs, wts, T); M[`logit shift + ON-pull term (g=${g})`] = xs.map((x) => ilogit(x + c)); }
  console.log("model".padEnd(44) + " MAE(all) MAE(IND-steady) corr  pred range");
  for (const [k, p] of Object.entries(M)) {
    const a2 = act.filter((_, i) => indSteady[i]), p2 = p.filter((_, i) => indSteady[i]);
    console.log(k.padEnd(44) + (100 * mae(p, act)).toFixed(2).padStart(8) + (100 * mae(p2, a2)).toFixed(2).padStart(14) + corr(p, act).toFixed(2).padStart(7) + `  ${(100 * Math.min(...p)).toFixed(1)}–${(100 * Math.max(...p)).toFixed(1)}`);
  }
  console.log(`actual range ${(100 * Math.min(...act)).toFixed(1)}–${(100 * Math.max(...act)).toFixed(1)}`);
  // implied elasticity on logit scale
  const xs = base.map(logit), ys = act.map(logit), sel = xs.map((_, i) => indSteady[i]);
  const X = xs.filter((_, i) => sel[i]), Y = ys.filter((_, i) => sel[i]);
  const mx = mean(X), my = mean(Y);
  console.log(`logit elasticity (IND-steady): ${(sum(X.map((x, i) => (x - mx) * (Y[i] - my))) / sum(X.map((x) => (x - mx) ** 2))).toFixed(2)}`);
}
