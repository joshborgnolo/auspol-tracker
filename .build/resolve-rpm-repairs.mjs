// Wave-date repairs for data/resolve-political-monitor.csv, shared by
// extract-resolve-rpm.mjs (every run, over committed and fresh rows alike) and
// this file's own CLI, which applies them to the committed CSV offline.
//
// (8) Feb 2026 scenario pair, firmness half. Defect (5) moves the Ley
//     counterfactual's primary vote (dated 12/02/2026 upstream) out of
//     primary_vote; its "how firm are you" subsection rode along into
//     vote_firmness, filing the one wave's firmness twice (12 and 14 Feb,
//     identical values). It moves to vote_firmness_ley_scenario the same way.
// (9) May 2026 wave under two dates. The 2021 interactive dated it 17/05,
//     the 2026 rebuild 16/05 (the fieldwork end, as the tracker's Resolve row
//     is dated), so the committed 2021-generation rows and the 2026 rows sit
//     side by side as two waves a day apart. A 17 May row with a 16 May twin
//     (same dataset, question, answer and breakdown) is dropped; one without
//     (the Net rows and wellbeing, which only the 2021 file carried) is
//     re-dated to 16 May. who_will_win is left alone: its May rows disagree
//     on which answer slot is which party between the two generations, and
//     neither date's set sums as the published question did, so there is no
//     twin to keep with confidence.
//
// Usage: node .build/resolve-rpm-repairs.mjs [--apply]   (dry-run by default)
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FEB_LEY = "2026-02-12";
const MAY_OLD = "2026-05-17", MAY = "2026-05-16";
const sansDate = (r) => [r.dataset, r.question_id, r.answer, r.dimension, r.key].join("|");

// Mutates the rows in place and drops from both arrays; returns the counts.
export function repairWaveDates(committed, fresh) {
  let firmLey = 0, mayDropped = 0, mayRedated = 0;
  for (const r of [...committed, ...fresh])
    if (r.dataset === "vote_firmness" && r.date === FEB_LEY) { r.dataset = "vote_firmness_ley_scenario"; firmLey++; }
  const mayKeys = new Set([...committed, ...fresh].filter((r) => r.date === MAY).map(sansDate));
  for (const rows of [committed, fresh])
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.date !== MAY_OLD || r.dataset === "who_will_win") continue;
      if (mayKeys.has(sansDate(r))) { rows.splice(i, 1); mayDropped++; }
      else { r.date = MAY; mayRedated++; }
    }
  return { firmLey, mayDropped, mayRedated };
}

// ---- CLI: apply to the committed CSV -------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const OUT = "data/resolve-political-monitor.csv";
  const { parseLine, rowToLine } = await import("./resolve-rpm-csv.mjs");
  const lines = readFileSync(OUT, "utf8").trim().split("\n");
  const rows = lines.slice(1).filter(Boolean).map(parseLine);
  const counts = repairWaveDates(rows, []);
  console.log(`rows ${lines.length - 1} -> ${rows.length}:`, counts);
  if (process.argv.includes("--apply")) {
    writeFileSync(OUT + ".tmp", [lines[0], ...rows.map(rowToLine)].join("\n") + "\n");
    renameSync(OUT + ".tmp", OUT);
    console.log(`wrote ${OUT}`);
  }
}
