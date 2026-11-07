// E7: SA-2026 district swings (2026 minus notional 2022) — how much do demographics explain? (in-sample + LOO)
import { load, divRows, sum, mean, ridge } from "./lib.mjs";
const S = divRows(load("maps/data/res-sa26.json"));
const steady = S.filter((s) => Math.abs(s.sh.ind - s.base.ind) < 0.05);
for (const party of ["alp", "lnp"]) {
  const y = steady.map((s) => 100 * (s.sh[party] - s.base[party]));
  for (const [lab, feat] of [["uni only", (d) => [d.uni]], ["uni+y12less+a65+lang", (d) => [d.uni, d.y12less, d.a65, d.lang]], ["uni+y12less+a65+lang+blue+atsci+own", (d) => [d.uni, d.y12less, d.a65, d.lang, d.blue, d.atsci, d.ten.own]]]) {
    const X = steady.map((s) => feat(s.demo));
    const m = ridge(X, y, null, 0.01);
    const pred = X.map((r) => m.predict(r)), my = mean(y);
    const r2 = 1 - sum(y.map((v, i) => (v - pred[i]) ** 2)) / sum(y.map((v) => (v - my) ** 2));
    let se = 0; for (let i = 0; i < X.length; i++) { const mm = ridge(X.filter((_, j) => j !== i), y.filter((_, j) => j !== i), null, 0.01); se += Math.abs(mm.predict(X[i]) - y[i]); }
    const maeUniform = mean(y.map((v) => Math.abs(v - my)));
    console.log(`${party.toUpperCase()} swing ~ ${lab.padEnd(36)} R2 ${r2.toFixed(2)}  LOO MAE ${(se / X.length).toFixed(2)} vs uniform ${maeUniform.toFixed(2)}  (n=${X.length})${lab === "uni only" ? `  slope ${m.b[0].toFixed(1)} pts per unit uni share` : ""}`);
  }
}
