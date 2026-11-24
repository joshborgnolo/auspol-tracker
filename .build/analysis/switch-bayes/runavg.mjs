/* the model's switching table averaged over the run's months (each month's
   posterior mean table, months with a table weighted equally) v today's */
import fs from "node:fs";
import { loadTables, SW_KEYS } from "./readings.mjs";
import { fitSwitch, colOf, mean } from "../../newtracker/switch-model.mjs";
const { tables, share2025 } = loadTables();
const day = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
const t0 = tables[0].day - 1, t1 = day("2026-11-22");
const months = [];
for (let y = 2026, m = 2; ; m++) { if (m > 12) { m = 1; y++; } const d = day(`${y}-${String(m).padStart(2, "0")}-15`); if (d >= t1) { months.push(t1); break; } months.push(d); }
const fit = fitSwitch(tables, { share2025, t0, t1, days: months, jumps: new Set([day("2026-02-12")]), nDraw: 2000, M: 64 });
const tab = (d) => Object.fromEntries(SW_KEYS.map((g) => [g, Object.fromEntries(SW_KEYS.map((k, q) => [k, +(share2025[g] * mean(colOf(fit.shares(g, d), q)) / 100).toFixed(2)]))]));
const avg = Object.fromEntries(SW_KEYS.map((g) => [g, Object.fromEntries(SW_KEYS.map((k) => [k, +(months.reduce((t, d) => t + tab(d)[g][k], 0) / months.length).toFixed(2)]))]));
fs.writeFileSync(new URL("./results/tables-now-avg.json", import.meta.url), JSON.stringify({ now: tab(t1), avg }));
console.log(JSON.stringify({ now: tab(t1), avg }));
