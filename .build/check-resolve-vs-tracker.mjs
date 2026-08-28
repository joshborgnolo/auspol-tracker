// Check data/resolve-political-monitor.csv against the Resolve/Resolve
// Strategic rows already in data/polls.json:
//   cyclePolls  (federal primary vote)  <- CSV dataset primary_vote, National
//   cycleApproval (pmNet/oppNet)        <- CSV pm_performance / opp_leader_performance
//                                        "Net (Good - Poor)", National
//   legacy PM net 2021-2025             <- CSV leader_performance (VG+G)-(P+VP)
//   ppm                                 <- CSV who_will_win (to detect a
//                                          mis-sourced series; not a PPM question)
// Usage: node .build/check-resolve-vs-tracker.mjs
import { readFileSync } from "node:fs";

const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

const csv = parseCsv(readFileSync("data/resolve-political-monitor.csv", "utf8").trim());
const rows = csv.slice(1).map(([dataset, qid, question, visual, answer, dimension, key, date, value]) => ({
  dataset, answer, dimension, key, date, value: value === "" ? null : Number(value),
}));
const s = (dataset, answer, dim = "region", key = "National") =>
  new Map(rows.filter((r) => r.dataset === dataset && r.answer === answer && r.dimension === dim && r.key === key)
    .map((r) => [r.date, r.value]));
const datesFor = (dataset, answer) => new Set(rows.filter((r) => r.dataset === dataset && r.answer === answer && r.key === "National").map((r) => r.date));

const pv = {
  lnp: s("primary_vote", "LNP"),
  lib: s("primary_vote", "Liberals"),
  nat: s("primary_vote", "Nationals"),
  alp: s("primary_vote", "ALP"),
  grn: s("primary_vote", "GRN"),
  onp: s("primary_vote", "ONP"),
  ind: s("primary_vote", "IND"),
  oth: s("primary_vote", "OTH"),
  totalOth: s("primary_vote", "Total Others"),
};
const csvLnp = (d) => pv.lnp.get(d) ?? ((pv.lib.get(d) ?? 0) + (pv.nat.get(d) ?? 0));
const csvOth = (d) => pv.totalOth.get(d) ?? ((pv.ind.get(d) ?? 0) + (pv.oth.get(d) ?? 0));
const pmNetCsv = s("pm_performance", "Net (Good - Poor)");
const oppNetCsv = s("opp_leader_performance", "Net (Good - Poor)");
const legacyDates = datesFor("leader_performance", "Very good");
const legacyNet = (d) => {
  const g = (a) => s("leader_performance", a, "overall", "National").get(d);
  return g("Very good") + g("Good") - g("Poor") - g("Very poor");
};
const wiw = { first: s("who_will_win", "answerFirst"), second: s("who_will_win", "answerSecond"), und: s("who_will_win", "answerUndecided") };

const DAY = 86400000;
const near = (map, date, tol = 2) => {
  for (const [d, v] of map) if (Math.abs(new Date(d) - new Date(date)) / DAY <= tol) return { date: d, value: v };
  return null;
};

const polls = JSON.parse(readFileSync("data/polls.json", "utf8"));
const trackerPv = Object.entries(polls.cyclePolls)
  .flatMap(([cycle, a]) => a.filter((r) => /resolve/i.test(r.firm)).map((r) => ({ cycle, ...r })));
const trackerAppr = Object.entries(polls.cycleApproval)
  .flatMap(([cycle, a]) => a.filter((r) => /resolve/i.test(r.firm)).map((r) => ({ cycle, ...r })));
const trackerPpm = polls.ppm.filter((r) => /resolve/i.test(r.firm));

let nBad = 0;
const flag = (msg) => { nBad++; console.log("  ✗", msg); };

console.log("=== 1. primary vote: cyclePolls vs CSV primary_vote (National) ===");
const csvWaveDates = datesFor("primary_vote", "LNP");
for (const t of trackerPv) {
  if (!csvWaveDates.has(t.date)) {
    flag(`${t.cycle} ${t.date}: tracker has a poll but CSV has no wave on this date`);
    continue;
  }
  const cmp = [
    ["lnp", t.lnp, csvLnp(t.date)],
    ["alp", t.alp, pv.alp.get(t.date)],
    ["grn", t.grn, pv.grn.get(t.date)],
    ["onp", t.onp, pv.onp.get(t.date) ?? null],
    ["oth", t.oth, csvOth(t.date)],
  ];
  for (const [f, a, b] of cmp) {
    if (b == null) { console.log(`  • ${t.cycle} ${t.date} ${f}: tracker=${a}, CSV has no ${f === "onp" ? "ONP" : f} series on this date`); continue; }
    if (Math.abs(a - b) > 0.05) flag(`${t.cycle} ${t.date} ${f}: tracker=${a} csv=${b} (Δ${(a - b).toFixed(2)})`);
  }
}
console.log("  CSV federal waves without a matching tracker poll:");
for (const d of [...csvWaveDates].sort()) {
  if (!trackerPv.some((t) => t.date === d)) console.log(`  - ${d}${d > "2025-04-28" ? " (beyond tracker horizon)" : ""}`);
}

console.log("\n=== 2. approval: cycleApproval vs CSV Net (Good - Poor) ===");
for (const t of trackerAppr) {
  const pm = pmNetCsv.get(t.date), op = oppNetCsv.get(t.date);
  if (pm != null || op != null) {
    if (pm != null && t.pmNet !== pm) flag(`${t.cycle} ${t.date} pmNet: tracker=${t.pmNet} csv=${pm} (Δ${t.pmNet - pm})`);
    if (op != null && t.oppNet !== op) flag(`${t.cycle} ${t.date} oppNet: tracker=${t.oppNet} csv=${op} (Δ${t.oppNet - op})`);
    if (pm == null) flag(`${t.cycle} ${t.date}: CSV has opp wave but no pm_performance row`);
    if (op == null) console.log(`  • ${t.cycle} ${t.date}: CSV has no opp_leader_performance row (cosmetic wave?)`);
  } else if (legacyDates.has(t.date)) {
    const net = legacyNet(t.date);
    if (t.pmNet !== net) flag(`${t.cycle} ${t.date} pmNet: tracker=${t.pmNet} legacy leader_performance net=${net} (Δ${t.pmNet - net})`);
  } else {
    flag(`${t.cycle} ${t.date}: tracker has an approval wave but CSV has none on this date`);
  }
}
console.log("  CSV pm_performance waves without a matching tracker row:");
for (const d of [...pmNetCsv.keys()].sort()) {
  if (!trackerAppr.some((t) => t.date === d)) console.log(`  - ${d}${d > "2025-04-28" ? " (beyond tracker horizon)" : ""}`);
}

console.log("\n=== 3. ppm (tracker) vs who_will_win (CSV) — provenance spot check ===");
for (const t of trackerPpm) {
  const w1 = near(wiw.first, t.date, 2), w2 = near(wiw.second, t.date), wu = near(wiw.und, t.date);
  if (!w1 && !w2) { console.log(`  • ${t.date} alb=${t.alb} opp=${t.opp}: no who_will_win wave nearby — PPM not verifiable from CSV`); continue; }
  const firstIs = w1 && (w1.value === t.alb ? "ALB" : w2 && w2.value === t.alb ? "SECOND" : "≠");
  console.log(`  ${t.date} tracker ppm alb=${t.alb} opp=${t.opp}${t.han != null ? " han=" + t.han : ""} | csv who_will_win first=${w1?.value} second=${w2?.value} und=${wu?.value} -> first-series matches: ${firstIs}`);
}

console.log(`\n${nBad} hard discrepancies`);
