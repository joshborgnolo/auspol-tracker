/* Import raw first-preference undecided readings from the hand-verified Trove
   Gallup series. The CSV keeps pollster-allocated rows' undecided cell blank,
   so this never reconstructs a share from the party figures or a residue.
   Dry-run by default; --apply writes data/undecided-history.json. Rebuild the
   model separately with .build/build-undecided-history.mjs. */
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const FIELDNAMES = "date,election,alp,coalition,lib,nat,greens,one_nation,nxt,family_first,democrats,independents,other_parties,other,undecided,mode,dlp,pollster,date_basis,note,article_id,url".split(",");
const parseRow = (line) => {
  const cells = [];
  let cell = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += c;
  }
  cells.push(cell);
  if (quoted) throw new Error(`unclosed CSV quote: ${line}`);
  return cells;
};
const parseCsv = (text) => text.trim().split(/\r?\n/).map(parseRow);
const parsed = parseCsv(readFileSync("data/trove-primary-vote.csv", "utf8"));
const expected = parsed.length - 1;
if (parsed[0].join(",") !== FIELDNAMES.join(",")) throw new Error("trove-primary-vote.csv header/schema changed");
const records = parsed.map((r) => Object.fromEntries(r.map((v, i) => [FIELDNAMES[i], v])));
const waves = records.slice(1).filter((r) => r.date && !r.election && r.undecided).map((r) => {
  const und = Number(r.undecided);
  if (!(r.pollster && und > 0 && und < 30 && /^\d{4}-\d{2}-\d{2}$/.test(r.date))) throw new Error(`invalid undecided row ${r.date}: ${r.undecided}`);
  return {
    house: r.pollster,
    era: "face-to-face",
    start: null,
    end: r.date,
    und,
    basis: "first",
    basisConf: "documented",
    dateBasis: r.date_basis,
    note: r.note || null,
    src: `data/trove-primary-vote.csv; Trove article ${r.article_id} (${r.url})`,
  };
});

const D = JSON.parse(readFileSync("data/undecided-history.json", "utf8"));
let added = 0;
for (const w of waves) {
  const other = D.waves.find((p) => p.house === w.house && p.end === w.end);
  if (other) {
    if (other.und !== w.und || other.basis !== "first") {
      throw new Error(`existing wave differs at ${w.house} ${w.end}: ${other.und} ${other.basis} vs ${w.und} first`);
    }
    continue;
  }
  D.waves.push(w);
  added++;
}
const keyOf = (w) => `${w.house}|${w.end}|${w.basis}`;
const beforeSort = D.waves.map(keyOf);
D.waves.sort((a, b) => a.end === b.end ? a.house.localeCompare(b.house) : a.end.localeCompare(b.end));
const reordered = D.waves.some((w, i) => keyOf(w) !== beforeSort[i]);
if (added && !D._about.includes("Trove additions")) {
  D._about = D._about.replace(
    /Fieldwork ending \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/,
    "Published reading dates 1946-06-15 to 2025-05-02",
  );
  D._about += " Trove additions carry their printed-month/publication-week date basis and note alongside each raw first-preference share; allocated primary-vote estimates are not undecided readings.";
}
console.log(`${APPLY ? "APPLY" : "dry-run"}: ${waves.length} verified Trove undecided waves, ${added} new, ${waves.length - added} already present (CSV rows ${expected}${reordered ? ", chronology corrected" : ""})`);
if (APPLY && (added || reordered)) {
  writeAtomic("data/undecided-history.json", JSON.stringify(D, null, 1) + "\n");
  console.log(`wrote data/undecided-history.json (${D.waves.length} waves); rebuild the history model next`);
}
