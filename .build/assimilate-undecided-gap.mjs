/* Merge the 1972–2004 undecided readings (data/undecided-gap-readings.json)
   into data/undecided-history.json. Each reading is a share the pollster
   printed (a sentence such as "Of the electors surveyed, only 5 percent
   didn't state their preference", or a release's footnote), quoted with a
   link a person can open; none is a residue of the party shares. Gathered
   2026-11-24 from The Bulletin's Morgan Gallup Poll column (1973–84, the
   NLA's digitised run), Roy Morgan's own findings (Wayback copies of
   roymorgan.com.au, 1997–2002, each re-read from its archived page),
   Newspoll's release PDFs (Wayback, 2001–04), and The Canberra Times and
   other papers on Trove (1972–93).
   Dry-run by default; --apply writes, and is a no-op when nothing is new.
   Rebuild the model afterwards: node .build/build-undecided-history.mjs */
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const R = JSON.parse(readFileSync("data/undecided-gap-readings.json", "utf8"));
const D = JSON.parse(readFileSync("data/undecided-history.json", "utf8"));
const SRC = {
  bulletin: (r) => `The Bulletin, Morgan Gallup Poll column${r.published ? ", " + r.published : ""} (${r.url})`,
  newspoll: (r) => `Newspoll release PDF, archived (${r.url})`,
  trove: (r) => `Trove newspaper article (${r.url})`,
  house: (r) => `the house's release, archived (${r.url})`,
  secondary: (r) => `secondary table (${r.url})`,
};
let added = 0, same = 0;
for (const r of R.readings) {
  if (!(r.und > 0 && r.und < 30) || !r.quote || !r.url || !SRC[r.source]) throw new Error(`incomplete reading ${r.house} ${r.end}`);
  const other = D.waves.find((w) => w.house === r.house && w.end === r.end);
  if (other) {
    if (other.und !== r.und || other.basis !== r.basis) throw new Error(`existing wave differs at ${r.house} ${r.end}: ${other.und} ${other.basis} vs ${r.und} ${r.basis}`);
    same++; continue;
  }
  D.waves.push({ house: r.house, era: r.era, start: r.start, end: r.end, ...(r.n ? { n: r.n } : {}), und: r.und,
    basis: r.basis, basisConf: r.basisConf, dateBasis: r.dateBasis, note: r.note, quote: r.quote, src: SRC[r.source](r) });
  added++;
}
D.waves.sort((a, b) => a.end === b.end ? a.house.localeCompare(b.house) : a.end.localeCompare(b.end));
if (added && !D._about.includes("1972–2004 additions")) D._about += " 1972–2004 additions (data/undecided-gap-readings.json, .build/assimilate-undecided-gap.mjs) quote the printed figure in `quote`.";
console.log(`${APPLY ? "APPLY" : "dry-run"}: ${R.readings.length} readings, ${added} new, ${same} already present`);
if (APPLY && added) {
  writeAtomic("data/undecided-history.json", JSON.stringify(D, null, 1) + "\n");
  console.log(`wrote data/undecided-history.json (${D.waves.length} waves); rebuild the history model next`);
}
