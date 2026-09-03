// Backfill the 2022–2025 term's preferred-PM readings into
// data/polls.json cycleApproval.2022 from data/wiki-2025-election-ppm.csv
// (written by .build/extract-2022-ppm-wiki.mjs — Wikipedia's 2025-election
// polling page, the term's leadership table; see that script's header).
//
// Why a wiki mirror at all: cycleApproval.2022 was built when the 2022 term
// was demoted to a past cycle, and carried pmNet/oppNet only — ppm was never
// assimilated, and Newspoll's archived better-PM CSV ends 2022-04-03, before
// the term. The term's pairing is Albanese v Dutton throughout (Dutton took
// the leadership 2022-05-30, before the first ppm reading on file), so no
// era complications: pmPpm = albanese, oppPpm = dutton.
//
// Row matching is exact date+firm where the repo already records the wave,
// plus a hand-verified alias table for the nine Resolve waves where this
// repo's date convention (publication Sunday) runs one day past the table's
// fieldwork close (publication Eve) — verified same-wave by date arithmetic
// against repo rows (Δ exactly 1 day, no second candidate; a tenth candidate
// alias for YouGov 2023-09-29 was disproved: the repo never recorded that
// wave at all). Waves the repo never recorded (DemosAU, Spectre, Freshwater
// x2, YouGov late-Sep 2023) insert as new leadership-only rows with null
// pmNet/oppNet — net approval is a coverage fact, fabricated values are not.
//
// Row shape matches the other cycle drills: {date,firm,pmNet,oppNet,pmPpm,
// oppPpm} with nulls where a wave didn't ask; quotes are whole-percentage
// integers like the term's other readings. Re-runs are no-ops. Dry-run by
// default; --apply writes data/polls.json.
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const TERM = ["2022-05-23", "2025-05-03"];          // Albanese sworn in .. election day
const APPR_KEY = "2022";                            // cycleApproval is keyed by the term-START election

// wiki-date|firm → repo-date for the verified same-wave pairs (Δ+1d)
const ALIASES = {
  "2023-05-13|Resolve": "2023-05-14",
  "2023-07-15|Resolve": "2023-07-16",
  "2023-09-09|Resolve": "2023-09-10",
  "2023-10-04|Resolve": "2023-10-05",
  "2024-02-24|Resolve": "2024-02-25",
  "2024-06-15|Resolve": "2024-06-16",
  "2024-07-13|Resolve": "2024-07-14",
  "2024-10-05|Resolve": "2024-10-06",
  "2025-04-13|Resolve": "2025-04-14",
};

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
D.cycleApproval[APPR_KEY] ||= [];
const cycle = D.cycleApproval[APPR_KEY];

const csv = readFileSync("data/wiki-2025-election-ppm.csv", "utf8").trim()
  .split("\n").slice(1).map((l) => l.split(","))
  .map((c) => ({ date: c[0], firm: c[1], pmPpm: +c[2], oppPpm: +c[3] }));

const guard = [];
const inTerm = (d) => d >= TERM[0] && d <= TERM[1];
const seen = new Set();
for (const r of csv) {
  if (!inTerm(r.date)) guard.push(`out-of-term ${r.date} ${r.firm}`);
  const k = r.date + "|" + r.firm;
  if (seen.has(k)) guard.push(`csv dup ${k}`);
  seen.add(k);
  if (r.pmPpm + r.oppPpm > 100) guard.push(`pair > 100: ${JSON.stringify(r)}`);
}
if (guard.length) {
  console.error("aborting — source rows failed sanity checks:\n  " + guard.join("\n  "));
  process.exit(1);
}

const byKey = new Map(cycle.map((r) => [r.date + "|" + r.firm, r]));
const enriched = [];   // existing rows gaining pmPpm/oppPpm
const inserted = [];   // new leadership-only rows
const unmerged = [];
for (const r of csv) {
  const key = r.date + "|" + r.firm;
  let row = byKey.get(key);
  let aliasNote = "";
  if (!row && ALIASES[key]) {
    row = byKey.get(ALIASES[key] + "|" + r.firm);
    if (row) aliasNote = ` (alias → ${ALIASES[key]})`;
  }
  if (row) {
    if ((row.pmPpm != null && row.pmPpm !== r.pmPpm) || (row.oppPpm != null && row.oppPpm !== r.oppPpm)) {
      console.error(`aborting — ${key} already carries ppm ${row.pmPpm}/${row.oppPpm}, csv says ${r.pmPpm}/${r.oppPpm}`);
      process.exit(1);
    }
    if (row.pmPpm == null) { row.pmPpm = r.pmPpm; row.oppPpm = r.oppPpm; enriched.push(key + aliasNote); }
    continue;                                    // identical re-run: no-op
  }
  const fresh = { date: r.date, firm: r.firm, pmNet: null, oppNet: null, pmPpm: r.pmPpm, oppPpm: r.oppPpm };
  inserted.push(fresh);
  byKey.set(key, fresh);
}
if (inserted.length) {
  D.cycleApproval[APPR_KEY] = cycle.concat(inserted)
    .toSorted((a, b) => a.date.localeCompare(b.date));
}
// every csv row must be accounted for: enriched, inserted, or identical re-run
const missedCsv = csv.filter((r) => {
  const k = r.date + "|" + r.firm;
  const row = byKey.get(k) || byKey.get((ALIASES[k] || "") + "|" + r.firm);
  return !(row && row.pmPpm === r.pmPpm && row.oppPpm === r.oppPpm) &&
    !inserted.some((i) => i.date === r.date && i.firm === r.firm);
});

const fmt = (keys) => {
  const by = {};
  for (const k of keys) by[k.split("|")[1]] = (by[k.split("|")[1]] || 0) + 1;
  return Object.entries(by).map(([f, n]) => `${f} ${n}`).join(", ") || "none";
};
const fmtIns = (rows) => {
  const by = {};
  for (const r of rows) by[r.firm] = (by[r.firm] || 0) + 1;
  return Object.entries(by).map(([f, n]) => `${f} ${n}`).join(", ") || "none";
};

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`csv rows: ${csv.length}`);
console.log(`enriched existing rows: ${enriched.length} (${fmt(enriched)})`);
console.log(`inserted leadership-only rows: ${inserted.length} (${fmtIns(inserted)})${inserted.length ? " — " + inserted.map((r) => r.date + " " + r.firm).join("; ") : ""}`);
console.log(`cycleApproval.${APPR_KEY} total: ${D.cycleApproval[APPR_KEY].length}`);
if (missedCsv.length) console.log("UNACCOUNTED CSV ROWS:", missedCsv.map((r) => r.date + "|" + r.firm).join("; "));
if (APPLY && (enriched.length || inserted.length))
  writeFileSync("data/polls.json", JSON.stringify(D, null, 2) + "\n");
