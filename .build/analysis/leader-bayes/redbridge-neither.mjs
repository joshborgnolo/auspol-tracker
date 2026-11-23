/* RedBridge's Albanese v Ley question offered "About the same", "Neither" and
   "Not sure" (28% Neither in Nov 2025, 69% of One Nation voters). How far do
   its three readings move the Albanese v Ley line, and what lean does it get? */
import fs from "node:fs";
import { ppmSeries, fitSettings, lineMoments, houseCoef } from "../../newtracker/leader-model.mjs";
const J = JSON.parse(fs.readFileSync(new URL("./readings.json", import.meta.url)));
const GRID_P = { w: [0.014, 0.02, 0.03], d: [0.002, 0.004, 0.008], s: [0.03, 0.1, 0.25], tau: [0, 0.03, 0.06], J: [0.15, 0.3, 0.6] };
const ID = "pm-opp:Albanese-Ley:2022-05-21/2025-05-03";
const rows0 = J.ppm.filter((r) => (r.contest === "pm-opp" || r.contest === "alb-han") && r.a > 0 && r.b > 0)
  .map((r) => ({ ...r, house: r.kind === "2pmp" ? r.house + " (2PMP)" : r.house, i: r.rid }));
const days = []; for (let y = 2025, m = 6; y < 2026 || m <= 1; m === 11 ? (y++, m = 0) : m++) days.push(Math.floor(Date.UTC(y, m, 15) / 86400000));
const sh = (x) => 100 / (1 + Math.exp(-x));
function run(label, rows) {
  const S = ppmSeries(rows);
  const st = fitSettings(S, GRID_P);
  const L = S.find((s) => s.id === ID);
  const ds = days.filter((d) => d >= L.t0 && d <= L.t1);
  const c = houseCoef(L, "RedBridge/Accent", 1);
  const mo = lineMoments(L, st, ds, c ? { main: null, rb: c } : { main: null });
  console.log(label, "settings", JSON.stringify(st.best), "κ RedBridge", st.kappa.get("RedBridge/Accent"));
  console.log("  line (Albanese share of those choosing):", ds.map((d, j) => new Date(d * 864e5).toISOString().slice(0, 7) + " " + sh(mo.main[j].m).toFixed(1)).join("  "));
  if (c) console.log("  RedBridge reads at:", ds.map((d, j) => sh(mo.rb[j].m).toFixed(1)).join(" "), "(lean " + (mo.rb[0].m - mo.main[0].m).toFixed(2) + " logit)");
  return Object.fromEntries(ds.map((d, j) => [d, sh(mo.main[j].m)]));
}
const a = run("with RedBridge", rows0);
const b = run("without RedBridge", rows0.filter((r) => !(r.house === "RedBridge/Accent" && r.series === ID)));
console.log("difference (points):", Object.keys(a).map((d) => (a[d] - b[d]).toFixed(2)).join(" "));
console.log("RedBridge readings:", rows0.filter((r) => r.house === "RedBridge/Accent" && r.series === ID).map((r) => r.date + " " + (100 * r.a / (r.a + r.b)).toFixed(1)).join(", "));
