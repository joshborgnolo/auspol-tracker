// Backfill + normalise the tracker's Resolve rows from the repaired
// resolve-political-monitor.csv. Dry-run by default; --apply writes.
//
// 1. Insert Morrison-era opposition-leader waves into cycleApproval['2019']:
//    the CSV's relabelled legacy rows (dataset opp_leader_performance,
//    dimension 'overall') carry Albanese's 2021-22 ratings for 14 waves; the
//    tracker holds only 5. Inserts { pmNet: null, oppNet: n } — Morrison's
//    PM rating is not recoverable from the interactive (Q17 starts Aug 2022).
// 2. Re-date tracker Resolve waves that were keyed off a date one day from
//    the CSV's wave date (publication-date convention; values already match,
//    only dates drifted). Applies to cyclePolls and cycleApproval.
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

const SHIFTS = {
  "2021-07-17": "2021-07-18", "2021-08-21": "2021-08-22", "2021-11-21": "2021-11-20",
  "2023-05-13": "2023-05-14", "2023-07-15": "2023-07-16", "2023-09-09": "2023-09-10",
  "2023-10-04": "2023-10-05", "2024-02-24": "2024-02-25", "2024-06-15": "2024-06-16",
  "2024-07-13": "2024-07-14", "2024-10-05": "2024-10-06", "2025-04-13": "2025-04-14",
};

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
const csv = parseCsv(readFileSync("data/resolve-political-monitor.csv", "utf8").trim()).slice(1)
  .map(([dataset, qid, q, v, answer, dim, key, date, value]) => ({ dataset, answer, dim, key, date, value: +value }));
const csvVal = (dataset, answer, date, dim = "region", key = "National") =>
  csv.find((r) => r.dataset === dataset && r.answer === answer && r.date === date && r.dim === dim && r.key === key)?.value ?? null;

// Morrison-era Albanese net from the relabelled legacy rows (dim 'overall')
const legacyDates = [...new Set(csv.filter((r) => r.dataset === "opp_leader_performance" && r.dim === "overall").map((r) => r.date))].sort();
const legacyNet = (d) => {
  const g = (a) => csv.find((r) => r.dataset === "opp_leader_performance" && r.answer === a && r.date === d && r.dim === "overall").value;
  return g("Very good") + g("Good") - g("Poor") - g("Very poor");
};

const polls = JSON.parse(readFileSync("data/polls.json", "utf8"));
const isResolve = (r) => /resolve/i.test(r.firm || "");

// --- pass 1: date shifts (only where the CSV really has the target wave) ---
let shifted = 0;
const anomalies = [];
for (const [bucket, rows] of [...Object.entries(polls.cyclePolls), ...Object.entries(polls.cycleApproval)]) {
  for (const r of rows) {
    if (!isResolve(r) || !SHIFTS[r.date]) continue;
    const target = SHIFTS[r.date];
    if (csvVal("primary_vote", "LNP", target) == null) { anomalies.push(`${bucket} ${r.date}: no CSV wave at ${target}, not shifted`); continue; }
    const dupe = rows.some((x) => x !== r && x.date === target && isResolve(x));
    if (dupe) { anomalies.push(`${bucket} ${r.date}: target ${target} already occupied by a Resolve row`); continue; }
    console.log(`  shift ${bucket} ${r.date} -> ${target}`);
    r.date = target;
    shifted++;
  }
}
// Known-good deviations from the CSV's LNP (both verified against the SMH/Age
// publication, which the tracker follows):
//   2024-02-25: CSV stores LNP=36 (internally consistent with its own Lib 32 +
//               Nat 4), but the paper printed "Coalition primary vote 37 per
//               cent". Upstream data-entry slip; tracker keeps 37.
//   2022-05-17: CSV rounds to 34; tracker holds the finer 34.4.
const LNP_OK = { "2024-02-25": 37, "2022-05-17": 34.4 };

// verify shifted primary rows now agree with the CSV at the new date
for (const [bucket, rows] of Object.entries(polls.cyclePolls)) {
  for (const r of rows.filter(isResolve)) {
    const v = csvVal("primary_vote", "LNP", r.date);
    const expected = LNP_OK[r.date] ?? v;
    if (v != null && r.lnp !== expected) anomalies.push(`cyclePolls.${bucket} ${r.date} lnp=${r.lnp} vs CSV ${v}`);
  }
}

// --- pass 2: Morrison-era oppNet inserts ---
const term2019 = polls.cycleApproval["2019"];
const inserted = [];
for (const d of legacyDates) {
  if (d < "2021-04-01" || d > "2022-05-18") continue;
  if (term2019.some((r) => isResolve(r) && r.date === d)) continue;
  const row = { date: d, firm: "Resolve", pmNet: null, oppNet: Math.round(legacyNet(d)) };
  inserted.push(row);
  term2019.push(row);
}
term2019.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`dates shifted: ${shifted}`);
console.log(`Morrison-era oppNet rows inserted: ${inserted.length}`);
for (const r of inserted) console.log("  +", JSON.stringify(r));
console.log(`anomalies: ${anomalies.length}`);
anomalies.forEach((a) => console.log("  !", a));

if (APPLY && anomalies.length === 0) {
  const out = JSON.stringify(polls, null, 2) + "\n";
  writeFileSync("data/polls.json", out);
  console.log(`wrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB)`);
} else if (APPLY) {
  console.error("ABORTED: resolve anomalies before applying");
  process.exit(1);
}
