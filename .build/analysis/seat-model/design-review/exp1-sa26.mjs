// E1: where did One Nation's SA-2026 surge land? Compare swing geometries that use only pre-election data.
import { load, divRows, boothRows, km, sum, mean, logit, ilogit, ridge, logitShift, mae, rmse, corr } from "./lib.mjs";
const fed = load("map/data/res-2025.json");
const sa = load("map/data/res-sa26.json");
const F = divRows(fed), S = divRows(sa);
const fedB = boothRows(fed).filter((b) => b.st === "SA" && b.tot >= 30);
const saB = boothRows(sa);

// federal-2025 footprint of each SA-2026 district: K nearest federal booths (vote- and distance-weighted)
const K = 4;
const foot = S.map(() => ({ w: 0, on: 0, lnp: 0, alp: 0, grn: 0, ind: 0, oth: 0 }));
for (const b of saB) {
  const near = fedB.map((f) => ({ f, d: km(b, f) })).sort((x, y) => x.d - y.d).slice(0, K);
  const ws = near.map((x) => x.f.tot / (0.5 + x.d) ** 2);
  const W = sum(ws);
  const est = {}; for (const k of ["onp", "lnp", "alp", "grn", "ind", "oth"]) est[k] = sum(near.map((x, i) => ws[i] * x.f.sh[k])) / W;
  const t = foot[b.d];
  t.w += b.tot; t.on += b.tot * est.onp; t.lnp += b.tot * est.lnp; t.alp += b.tot * est.alp; t.grn += b.tot * est.grn; t.ind += b.tot * est.ind; t.oth += b.tot * est.oth;
}
const F25 = foot.map((t) => ({ on: t.on / t.w, lnp: t.lnp / t.w, alp: t.alp / t.w, grn: t.grn / t.w }));
const wts = S.map((s) => s.tot);
const actual = S.map((s) => s.sh.onp);
const target = sum(actual.map((a, i) => a * wts[i])) / sum(wts);
const fedMean = sum(F25.map((f, i) => f.on * wts[i])) / sum(wts);
console.log(`SA-2026 ON statewide ${(100 * target).toFixed(1)}; federal-2025 ON in the same footprint ${(100 * fedMean).toFixed(1)} (x${(target / fedMean).toFixed(2)})`);

const models = {};
models["uniform from fed-25"] = F25.map((f) => f.on + (target - fedMean));
models["proportional from fed-25"] = F25.map((f) => f.on * target / fedMean);
{ const xs = F25.map((f) => logit(f.on)); const c = logitShift(xs, wts, target); models["logit shift from fed-25"] = xs.map((x) => ilogit(x + c)); }
models["poliwave 50/50 mix from fed-25"] = F25.map((f) => 0.5 * f.on * target / fedMean + 0.5 * (f.on + (target - fedMean)));

// demographic propensity: fit logit(ON share) on federal-2025 divisions (state dummies absorb Qld etc.), apply to SA districts
const keys = ["uni", "y12less", "blue", "a65", "a2034", "lang", "atsci"];
const X = (dm) => [...keys.map((k) => dm[k]), dm.rel.norel, dm.ten.own, dm.ten.rentPub ?? 0];
const states = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const fedFit = F.filter((r) => r.sh.onp > 0.005);
const Xf = fedFit.map((r) => [...X(r.demo), ...states.slice(1).map((s) => (r.st === s ? 1 : 0))]);
const yf = fedFit.map((r) => logit(r.sh.onp));
// LOO-CV lambda on federal
let best = null;
for (const lam of [0.01, 0.03, 0.1, 0.3, 1, 3]) {
  let se = 0;
  for (let i = 0; i < Xf.length; i++) {
    const m = ridge(Xf.filter((_, j) => j !== i), yf.filter((_, j) => j !== i), null, lam);
    se += (ilogit(m.predict(Xf[i])) - ilogit(yf[i])) ** 2;
  }
  const r = Math.sqrt(se / Xf.length);
  if (!best || r < best.r) best = { lam, r };
}
const demoM = ridge(Xf, yf, null, best.lam);
console.log(`federal-2025 ON demographic fit: LOO RMSE ${(100 * best.r).toFixed(2)}pp at lambda ${best.lam} over ${Xf.length} divisions`);
{
  const xs = S.map((s) => demoM.predict([...X(s.demo), ...states.slice(1).map((st) => (st === "SA" ? 1 : 0))]));
  const c = logitShift(xs, wts, target);
  models["demographic (fed-25 fit), logit-calibrated"] = xs.map((x) => ilogit(x + c));
  // blend demographic and fed-25 footprint on logit scale
  const xf = F25.map((f) => logit(f.on));
  const xb = xs.map((x, i) => 0.5 * x + 0.5 * xf[i]);
  const cb = logitShift(xb, wts, target);
  models["blend demo+fed-25 (logit)"] = xb.map((x) => ilogit(x + cb));
}
// oracle ceiling: demographic fit on SA-2026 itself (in-sample, LOO)
{
  const Xs = S.map((s) => X(s.demo)), ys = S.map((s) => logit(s.sh.onp));
  const pred = Xs.map((_, i) => ilogit(ridge(Xs.filter((_, j) => j !== i), ys.filter((_, j) => j !== i), null, 0.3).predict(Xs[i])));
  models["(oracle) SA-26 demographic fit, leave-one-out"] = pred;
}
console.log("\nmodel".padEnd(52) + "MAE   RMSE  corr  maxErr  pred range");
for (const [k, p] of Object.entries(models)) {
  const err = p.map((x, i) => Math.abs(x - actual[i]));
  const worst = S[err.indexOf(Math.max(...err))].name;
  console.log(k.padEnd(52) + (100 * mae(p, actual)).toFixed(2).padStart(5) + (100 * rmse(p, actual)).toFixed(2).padStart(6) + corr(p, actual).toFixed(2).padStart(6) + ((100 * Math.max(...err)).toFixed(1) + " " + worst).padStart(18) + `  ${(100 * Math.min(...p)).toFixed(1)}–${(100 * Math.max(...p)).toFixed(1)}`);
}
console.log(`actual range ${(100 * Math.min(...actual)).toFixed(1)}–${(100 * Math.max(...actual)).toFixed(1)}`);

// elasticity: regress logit(ON26) on logit(fed-25 ON) — slope 1 = logit shift, slope <1 = flatter than logit
{
  const xs = F25.map((f) => logit(f.on)), ys = actual.map(logit);
  const mx = mean(xs), my = mean(ys);
  const b = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / sum(xs.map((x) => (x - mx) ** 2));
  console.log(`\nlogit elasticity of SA-26 ON on fed-25 ON footprint: ${b.toFixed(2)} (1 = logit shift; 0 = uniform-on-logit)`);
  // linear slope (pp per pp)
  const xl = F25.map((f) => f.on), yl = actual;
  const mxl = mean(xl), myl = mean(yl);
  const bl = sum(xl.map((x, i) => (x - mxl) * (yl[i] - myl))) / sum(xl.map((x) => (x - mxl) ** 2));
  console.log(`linear slope ${bl.toFixed(2)} pp/pp (1 = uniform, ${(target / fedMean).toFixed(2)} = proportional)`);
}
// print per-district comparison for the worst cases of the proportional model
const rows = S.map((s, i) => ({ n: s.name, act: actual[i], fed: F25[i].on, prop: models["proportional from fed-25"][i], logit: models["logit shift from fed-25"][i], demo: models["demographic (fed-25 fit), logit-calibrated"][i] }));
rows.sort((a, b) => b.act - a.act);
console.log("\ndistrict        actual  fed25  prop  logit  demo");
for (const r of rows) console.log(r.n.padEnd(15) + [r.act, r.fed, r.prop, r.logit, r.demo].map((x) => (100 * x).toFixed(1).padStart(7)).join(""));
