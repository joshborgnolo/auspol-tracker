// .build/backfill-redbridge-releaseurls.mjs – one-off that sets `releaseUrl`
// (the pollster's own release page) on the two committed RedBridge rows whose
// pages .build/extract-redbridge.mjs CANNOT discover itself: the extractor's
// candidate rule (PAGE_SLUG_RE) only matches the plain
// `afr,-redbridge-group-and-accent-research-(…-)?federal-poll` slugs, so it
// fills the monthly-wave URLs on its own runs. These two pages predate that
// naming scheme:
//
//   2025-10-07  wave released on the analysis-style page
//               "Federal Political Snapshot – October 2025"
//   2026-05-14  the MRP row (pollster "RedBridge / Accent (MRP)"),
//               released as "A fragmented electorate"; also unmatchable by
//               pollster label
//
// Rows that STAY absent (checked against the live
// dynamic-projects sitemap, September 2026): 2025-06-30, 2025-09-08,
// 2025-11-13, 2025-11-26, 2026-03-27 and 2026-08-28 have no Accent project
// page at all (March/August 2026 are sitemap lag; the four 2025 rows are
// uncovered by any dated release page – "Shifts in Vote Intention Since June
// 2025" 404s and pairs a June date with copy tying it to no single wave, and
// the 2026-02-12 row is a different series labelled plain "Redbridge").
// Rather than guess, those waves carry no releaseUrl.
//
// Run: node .build/backfill-redbridge-releaseurls.mjs
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
const OUT = fileURLToPath(new URL("../data/polls.json", import.meta.url));
const MAP = {
  "RedBridge / Accent|2025-10-07": "https://www.accent-research.com/projects/federal-political-snapshot---october-2025",
  "RedBridge / Accent (MRP)|2026-05-14": "https://www.accent-research.com/projects/a-fragmented-electorate",
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
