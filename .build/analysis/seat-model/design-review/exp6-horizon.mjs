// E6: how far do primaries move between ~18 months out and election day? (cycle polls vs the next election result)
import { load, mean } from "./lib.mjs";
const p = load("data/polls.json");
const cycles = Object.keys(p.cyclePolls).sort();
// each cycle key = the election year the polls lead up to; result = the election row in cyclePolls? find result via isElection rows or p.elections
const elec = {};
for (const [k, v] of Object.entries(p.elections)) elec[v.date.slice(0, 4)] = v;
const rows = [];
for (const c of cycles) {
  const polls = p.cyclePolls[c];
  const res = polls.find((r) => r.isElection || r.firm === "Election Result" || r.pollster === "Election Result");
  const end = res ? res.date : (elec[c] && elec[c].date);
  const R = res || elec[c];
  if (!end || !R) continue;
  const T = new Date(end).getTime();
  const win = (a, b) => polls.filter((r) => !(r.isElection || r.firm === "Election Result") && (T - new Date(r.date).getTime()) / 864e5 >= a && (T - new Date(r.date).getTime()) / 864e5 < b);
  const out = { c };
  for (const [lab, a, b] of [["m18", 480, 600], ["m12", 330, 400], ["m6", 150, 210], ["m1", 0, 35]]) {
    const w = win(a, b);
    for (const k of ["alp", "lnp", "onp", "grn", "tpp_alp"]) { const xs = w.map((r) => r[k]).filter((x) => x != null); out[lab + "_" + k] = xs.length ? mean(xs) : null; }
    out[lab + "_n"] = w.length;
  }
  for (const k of ["alp", "lnp", "onp", "grn", "tpp_alp"]) out["res_" + k] = R[k] ?? null;
  rows.push(out);
}
console.log("cycle  n18 | ALP  m18->res   L/NP m18->res   2PP(ALP) m18->res | ON m18 m6 m1 ->res");
const errs = { alp: [], lnp: [], tpp_alp: [] }, errs1 = { alp: [], lnp: [], tpp_alp: [] };
for (const r of rows) {
  const f = (x) => (x == null ? "  -  " : x.toFixed(1).padStart(5));
  console.log(`${r.c}  ${String(r.m18_n).padStart(3)} | ${f(r.m18_alp)}->${f(r.res_alp)}  ${f(r.m18_lnp)}->${f(r.res_lnp)}  ${f(r.m18_tpp_alp)}->${f(r.res_tpp_alp)} | ${f(r.m18_onp)} ${f(r.m6_onp)} ${f(r.m1_onp)} ->${f(r.res_onp)}`);
  for (const k of Object.keys(errs)) { if (r["m18_" + k] != null && r["res_" + k] != null && +r.c >= 1972) errs[k].push(r["res_" + k] - r["m18_" + k]); if (r["m1_" + k] != null && r["res_" + k] != null && +r.c >= 1972) errs1[k].push(r["res_" + k] - r["m1_" + k]); }
}
const rms = (a) => Math.sqrt(mean(a.map((x) => x * x)));
for (const k of Object.keys(errs)) console.log(`${k}: 1972+ result minus 18-month poll mean — mean ${mean(errs[k]).toFixed(2)}, RMS ${rms(errs[k]).toFixed(2)} (n=${errs[k].length}); final-month RMS ${rms(errs1[k]).toFixed(2)} (n=${errs1[k].length})`);
