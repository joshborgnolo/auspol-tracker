/* settings per role/era v pooled: marginal likelihood and next-poll error */
import fs from "node:fs";
import { fitSettings, predictAll, familyLL } from "./leader-model.mjs";
import { ratingSeries } from "./series.mjs";
import { GRID_R } from "./fit.mjs";
const J = JSON.parse(fs.readFileSync(new URL("./readings.json", import.meta.url)));
const all = ratingSeries(J.ratings, { metrics: ["approval", "fav"], compress: true });
const pooled = fitSettings(all, GRID_R);
const err = (P) => { const e = P.filter((p) => !p.lone).map((p) => Math.abs(p.mu - p.y) * 100); return (e.reduce((a, b) => a + b, 0) / e.length).toFixed(3) + " (n " + e.length + ")"; };
console.log("pooled", JSON.stringify(pooled.best), "ll", familyLL(all, pooled.best, pooled.kappa).toFixed(1));
const groups = { pm: (S) => S.role === "pm", opp: (S) => S.role === "opp", han: (S) => S.role === "han",
  pre1996: (S) => S.obs[0].t < 9557, from1996: (S) => S.obs[0].t >= 9557 };
for (const split of [["pm", "opp", "han"], ["pre1996", "from1996"]]) {
  let llSep = 0, llPool = 0;
  for (const g of split) {
    const ss = all.filter(groups[g]);
    const st = fitSettings(ss, GRID_R, { fixedKappa: pooled.kappa });
    const a = familyLL(ss, st.best, pooled.kappa), b = familyLL(ss, pooled.best, pooled.kappa);
    llSep += a; llPool += b;
    console.log(`  ${g.padEnd(9)} ${ss.length} series  own ${JSON.stringify(st.best)} ll ${a.toFixed(1)} v pooled ${b.toFixed(1)}  next-poll own ${err(predictAll(ss, st.best, pooled.kappa))} pooled ${err(predictAll(ss, pooled.best, pooled.kappa))}`);
  }
  console.log(`  split ${split.join("/")}: Δll ${(llSep - llPool).toFixed(1)} for ${5 * (split.length - 1)} extra settings`);
}
