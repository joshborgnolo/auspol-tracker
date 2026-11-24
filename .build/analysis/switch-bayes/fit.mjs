/* One fit on every table: settings, today's rows, the monthly lines, beside
   the recipe's six-week nowcast of the same cells. node fit.mjs */
import { loadTables, SW_KEYS } from "./readings.mjs";
import { fitSwitch, colOf, summary } from "../../newtracker/switch-model.mjs";
import { recipeNow } from "./recipe.mjs";

const { tables, share2025 } = loadTables();
const day = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
const t0 = tables[0].day - 1, t1 = Math.max(...tables.map((t) => t.end));
const months = [];
for (let y = 2026, m = 2; ; m++) { if (m > 12) { m = 1; y++; } const d = day(`${y}-${String(m).padStart(2, "0")}-15`); if (d > t1) { months.push(t1); break; } months.push(d); }
const jumps = process.env.NOJUMP ? new Set() : new Set([day("2026-02-12")]);
const fit = fitSwitch(tables, { share2025, t0, t1, days: [...months, t1 - 30], pairs: [[t1, t1 - 30], [t1, months[0]]], jumps, nDraw: 2000, M: +(process.env.M || 64), zero: +(process.env.ZERO || 0.5) });
console.log("timing", fit.timing, "ESS", fit.settings.ess.toFixed(1), "lp", fit.settings.lpMode.toFixed(2));
console.log("theta", Object.fromEntries(Object.entries(fit.theta).map(([k, v]) => [k, +v.toPrecision(3)])));
console.log("kappa", Object.fromEntries(fit.settings.kappa), "lone", [...fit.lone]);
const iso = (d) => new Date(d * 864e5).toISOString().slice(0, 10);
for (const c of SW_KEYS) {
  const now = fit.shares(c, t1), rec = recipeNow(tables, c, t1, share2025);
  console.log(`\n${c} cohort (n≈${Math.round(tables[0].n * share2025[c] / 100)} a poll)`);
  for (const [q, k] of SW_KEYS.entries()) {
    const s = summary(colOf(now, q));
    const pr = fit.pair(c, t1, months[0]);
    const dd = colOf(pr[0], q).map((v, i) => v - colOf(pr[1], q)[i]);
    const ds = summary(dd);
    const line = months.map((d) => summary(colOf(fit.shares(c, d), q)).v.toFixed(1)).join(" ");
    console.log(`  ${c}→${k}: model ${s.v.toFixed(1)} ±${s.ci.toFixed(1)} | recipe ${rec[k].v.toFixed(1)} ±${rec[k].ci.toFixed(1)} | since Feb ${ds.v >= 0 ? "+" : ""}${ds.v.toFixed(1)} [${ds.lo.toFixed(1)}, ${ds.hi.toFixed(1)}] | ${line}`);
  }
  for (const h of fit.houses) { const l = fit.lean(c, h); if (!l) continue; console.log(`    lean ${h}: ${SW_KEYS.map((k, q) => k + " " + summary(colOf(l, q)).v.toFixed(1)).join(" ")}`); }
}
console.log("\nmonths", months.map(iso).join(" "));
