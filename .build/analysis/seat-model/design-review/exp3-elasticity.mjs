// E3: how did ON's (and the majors') vote redistribute in other transitions? logit elasticity + rule MAEs,
// on seats contested by the party at both elections (base = the printed swing column's notional prior share).
import { load, divRows, sum, mean, logit, ilogit, logitShift, mae } from "./lib.mjs";
const pairs = [["res-2016", "res-2019"], ["res-2019", "res-2022"], ["res-2022", "res-2025"], ["res-qld17", "res-qld20"], ["res-qld20", "res-qld24"], ["res-sa22", "res-sa26"]];
for (const party of ["onp", "lnp", "alp", "grn"]) {
  console.log(`\n=== ${party.toUpperCase()} ===   transition          n   state  ->  new   elast  MAE: uniform  prop  logit`);
  for (const [, b] of pairs) {
    const D = load(`map/data/${b}.json`);
    const R = divRows(D).filter((r) => r.baseKnown);
    // contested at both: candidate present now AND notional base > 0.3%
    const sel = R.filter((r) => r.c.some((c) => c[3] === party) && r.base[party] > 0.003 && r.sh[party] > 0.003);
    if (sel.length < 8) { console.log(`   ${b.padEnd(28)} n=${sel.length} (too few)`); continue; }
    const w = sel.map((r) => r.tot), W = sum(w);
    const act = sel.map((r) => r.sh[party]), base = sel.map((r) => r.base[party]);
    const T = sum(act.map((x, i) => x * w[i])) / W, B0 = sum(base.map((x, i) => x * w[i])) / W;
    const uni = base.map((x) => x + T - B0), prop = base.map((x) => x * T / B0);
    const xs = base.map(logit), c = logitShift(xs, w, T), lg = xs.map((x) => ilogit(x + c));
    const ys = act.map(logit), mx = mean(xs), my = mean(ys);
    const el = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / sum(xs.map((x) => (x - mx) ** 2));
    console.log(`   ${b.padEnd(28)}${String(sel.length).padStart(4)}  ${(100 * B0).toFixed(1).padStart(5)} -> ${(100 * T).toFixed(1).padStart(5)}  ${el.toFixed(2).padStart(5)}        ${(100 * mae(uni, act)).toFixed(2).padStart(5)} ${(100 * mae(prop, act)).toFixed(2).padStart(5)} ${(100 * mae(lg, act)).toFixed(2).padStart(5)}`);
  }
}
