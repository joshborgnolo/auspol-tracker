// .build/backfill-essential-releaseurls.mjs – one-off that sets `releaseUrl`
// (the pollster's own release page) on the committed Essential rows. The
// extractor only began persisting .build/essential-src/report-index.json
// (WP publish date -> wave page link) so that .build/assimilate-essential-vi.mjs
// could stamp releaseUrl on waves assimilated from here on; the rows curated
// before that machinery existed carry no releaseUrl. Date mapping verified
// against the live WP REST index 2026-09-01: a tracker row dates by
// fieldwork end, the report's WP record by publish day (UTC), which has run
// 1-2 days ahead since Sep 2025 (probe: figure-join against
// data/essential-report.csv pins each row to exactly one wave).
//
//   2026-03-23 STAYS ABSENT: its `url` already points at the wave's own
//   release page (.../reports/25-march-2026) – a releaseUrl would be the
//   same link twice.
//
// Run: node .build/backfill-essential-releaseurls.mjs
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
const OUT = fileURLToPath(new URL("../data/polls.json", import.meta.url));
const MAP = {
  "Essential|2025-09-29": "https://essentialreport.com.au/reports/30-september-2025",
  "Essential|2025-10-27": "https://essentialreport.com.au/reports/29-october-2025",
  "Essential|2025-11-24": "https://essentialreport.com.au/reports/26-november-2025",
  "Essential|2025-12-08": "https://essentialreport.com.au/reports/10-december-2025",
  "Essential|2026-01-23": "https://essentialreport.com.au/reports/28th-january-2026",
  "Essential|2026-02-23": "https://essentialreport.com.au/reports/25-february-2026",
  "Essential|2026-04-27": "https://essentialreport.com.au/reports/29-april-2026",
  "Essential|2026-05-24": "https://essentialreport.com.au/reports/27-may-2026",
  "Essential|2026-06-29": "https://essentialreport.com.au/reports/30-june-2026",
  "Essential|2026-07-27": "https://essentialreport.com.au/reports/28-july-2026",
};
const orig = readFileSync(OUT, "utf8");
const D = JSON.parse(orig);
let set = 0, already = 0;
for (const [key, url] of Object.entries(MAP)) {
  const [pollster, date] = key.split("|");
  const w = D.polls.find((p) => p.date === date && p.pollster === pollster);
  if (!w) { console.error(`MISSING WAVE ${key}`); process.exit(2); }
  if (w.releaseUrl === url) { already++; continue; }
  if (w.releaseUrl && w.releaseUrl !== url) {
    console.error(`${key}: existing releaseUrl differs\n  have ${w.releaseUrl}\n  want ${url}`);
    process.exit(2);
  }
  w.releaseUrl = url;
  set++;
}
if (!set) {
  console.log(`no change (${already} rows already carry their releaseUrl)`);
  process.exit(0);
}
const trailingNl = orig.endsWith("\n") ? "\n" : "";
writeFileSync(OUT + ".tmp", JSON.stringify(D, null, 2) + trailingNl);
renameSync(OUT + ".tmp", OUT);
console.log(`releaseUrl set on ${set} wave${set === 1 ? "" : "s"}${already ? ` (${already} already set)` : ""}`);
