// Backfill Galaxy Research federal voting intention into cyclePolls from
// data/galaxy-federal-pre2012.csv — the pre-2012 half of the Galaxy record,
// which no cycle array carried. cyclePolls' Galaxy rows began at 2011-08-03
// because they were transcribed from Wikipedia, and Wikipedia's opinion-polling
// articles only exist from the 2013 cycle on: its 2010-cycle article carries no
// Galaxy row at all, and there is no 2007-cycle article. Galaxy polled federally
// from 2004.
//
// Source (how the CSV was assembled, and how to re-derive it: see
// .build/extract-galaxy-archive.mjs and /archives/galaxy/):
//   data/galaxy-federal-pre2012.csv — 21 transcribed national federal waves,
//     Sep 2004 to Aug 2010, each row citing the page it was read off. Three
//     origins: William Bowe's Poll Bludger write-ups (pollbludger.net serves
//     its whole back catalogue, 2004 on), Galaxy's own pubpolls.html via the
//     Internet Archive, which printed the latest federal wave in full and kept
//     an accuracy table of final campaign polls, and the Courier Mail's
//     polldetail PDFs (media01.couriermail.com.au), which still serve Galaxy's
//     printed trend tables — the source of the Greens/others shares and
//     fieldwork windows Bowe's 2007 running table omitted.
//
// Only rows that meet the cycle-array row shape are assimilated. Every existing
// row in these cycles carries non-null lnp/alp/grn/oth/tpp_*, so a wave whose
// Greens share was never published cannot be represented without inventing one:
// 18 of the 21 rows qualify, the rest stay in the CSV as the transcript. Absent
// is not zero — the repo convention, applied to a whole column.
//
// Dates. The cycle arrays key on fieldwork END. Galaxy published on a Monday
// off weekend fieldwork, and its waves reach us dated three ways, so the CSV
// carries date_basis per row and this script resolves in that order:
//   fieldwork_end   where a source states the window
//   date            otherwise — publication day, or Bowe's table date, which is
//                   itself either publication or fieldwork end (his table prints
//                   "Aug 27" for a wave that closed the 26th, and "Nov 4" for
//                   one that closed the 4th). The residual uncertainty is ±1 day
//                   against a series read as monthly means.
// One exception, logged when it fires: the two July 2010 waves both resolve to
// 2010-07-17 (one conducted in the last days before the election was called,
// one on the Saturday night it was), which check 8 in validate.mjs would read
// as a mis-keyed date rather than two real waves. The second keeps its
// publication date instead. Choosing between two published facts, not inventing
// a third.
//
// Re-runs are no-ops: a candidate is skipped when its date+firm already sits in
// the cycle. Dry-run by default; --apply writes data/polls.json.
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const CSV = "data/galaxy-federal-pre2012.csv";
const FIRM = "Galaxy";
// cyclePolls is keyed by the term-END election; a wave belongs to the cycle
// whose window it falls in. Bounds are exclusive of the opening election day
// and inclusive of the closing one, matching the other assimilators.
const CYCLES = [
  { key: "2004", from: "2001-11-10", to: "2004-10-09" },
  { key: "2007", from: "2004-10-09", to: "2007-11-24" },
  { key: "2010", from: "2007-11-24", to: "2010-08-21" },
];

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));

/* CSV with quoted fields (notes carry commas) – small hand-rolled reader
   rather than a dependency, same as the other .build scripts. */
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.some((c) => c !== ""))
             .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
};

const num = (c) => (/^\s*-?\d+(\.\d+)?\s*$/.test(c) ? +c : null);

const rows = parseCsv(readFileSync(CSV, "utf8"));
const candidates = [], skipped = [];

for (const r of rows) {
  const shares = { alp: num(r.alp), lnp: num(r.coalition), grn: num(r.greens),
                   oth: num(r.other), tpp_alp: num(r.tpp_alp), tpp_lnp: num(r.tpp_coalition) };
  const date = r.fieldwork_end || r.date;
  const label = `${r.date || "(undated)"} ${r.date_basis}`;
  if (!date) { skipped.push(`${label} — no date; Galaxy never printed one for this wave`); continue; }
  if (String(r.note).startsWith("SUSPECT")) { skipped.push(`${label} — flagged SUSPECT in the CSV`); continue; }
  const missing = Object.entries(shares).filter(([, v]) => v == null).map(([k]) => k);
  if (missing.length) { skipped.push(`${label} — no published ${missing.join("/")}`); continue; }
  const cycle = CYCLES.find((c) => date > c.from && date <= c.to);
  if (!cycle) { skipped.push(`${label} — ${date} falls outside every cycle window`); continue; }
  candidates.push({ cycle: cycle.key, date, pubDate: r.date, ...shares });
}

/* Two waves resolving to one date is check 8's mis-keyed-date signature. Where
   both are real, the later one falls back to its publication date. */
for (const c of candidates) {
  const clash = candidates.find((o) => o !== c && o.cycle === c.cycle && o.date === c.date);
  if (!clash) continue;
  const later = [c, clash].sort((a, b) => (a.pubDate < b.pubDate ? -1 : 1))[1];
  if (later !== c || c.date === c.pubDate) continue;
  console.log(`  date clash on ${c.date} — ${c.pubDate} wave keeps its publication date`);
  c.date = c.pubDate;
}

const added = [], present = [];
for (const c of candidates) {
  const cycle = D.cyclePolls[c.cycle];
  if (!cycle) throw new Error(`cyclePolls.${c.cycle} is missing`);
  if (cycle.some((p) => p.date === c.date && p.firm === FIRM)) { present.push(`${c.cycle} ${c.date}`); continue; }
  // Row shape matches the curated cycle rows exactly, key order included.
  const row = { date: c.date, firm: FIRM, lnp: c.lnp, alp: c.alp, grn: c.grn,
                onp: null, oth: c.oth, tpp_lnp: c.tpp_lnp, tpp_alp: c.tpp_alp };
  const sum = c.alp + c.lnp + c.grn + c.oth;
  if (Math.abs(sum - 100) > 0.5) { skipped.push(`${c.date} — primaries sum to ${sum}, not 100`); continue; }
  if (c.tpp_alp + c.tpp_lnp !== 100) { skipped.push(`${c.date} — 2PP pair sums to ${c.tpp_alp + c.tpp_lnp}`); continue; }
  cycle.push(row);
  added.push(`${c.cycle} ${c.date} — ALP ${c.alp}/${c.tpp_alp} L-NP ${c.lnp}/${c.tpp_lnp} GRN ${c.grn} OTH ${c.oth}`);
}

for (const c of CYCLES) D.cyclePolls[c.key]?.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

console.log(`\nGalaxy rows read: ${rows.length}`);
console.log(`added: ${added.length}`);
for (const a of added) console.log(`  + ${a}`);
if (present.length) console.log(`already present: ${present.join(", ")}`);
console.log(`\nleft in the CSV as transcript only: ${skipped.length}`);
for (const s of skipped) console.log(`  - ${s}`);

if (!APPLY) { console.log("\ndry run — pass --apply to write data/polls.json"); process.exit(0); }
writeFileSync("data/polls.json", JSON.stringify(D, null, 2) + "\n");
console.log("\nwrote data/polls.json");
