// AGB McNair voting-intention rows for the 1990–1993 and 1993–1996 terms,
// hand-verified from the Trove newspaper corpus (Canberra Times write-ups of
// The Bulletin's AGB McNair waves) — the same articles catalogued in
// data/agb-mcnair-mentions.csv / data/agb-mcnair-figures.csv. This is a
// CURATED set, not a CSV drill: the Fairfax AGB McNair tables only survive
// as prose in these articles, so every row below was read back against the
// article's OCR text (.matilda/trove-harvest/text/<id>.txt) before admission.
//
// Admission rule: the article must print BOTH majors and at least one minor
// figure, so the unprinted remainder of the slate is corroborated rather
// than guessed. oth is DERIVED as 100 − alp − lnp, never printed verbatim —
// that is exactly what Newspoll's era rows carry in oth (all non-majors,
// undecided included; every Newspoll row on file sums to exactly 100), and
// the derivation is anchored twice against full slates that ARE printed in
// this corpus: 1993-01-23 prints 43+42+3+6+6 = 100 → oth 15 = 3+6+6, and
// 1993-05-01 prints 50+39+3+4+4 = 100 → oth 11 = 3+4+4. A third anchor is
// external: AGB's 1993-04-17 wave (49/40, minors 3+3 printed) derives oth
// 11 — the same figure Newspoll prints for its 1993-04-18 oth cell.
//
// Rows are therefore Newspoll-basis "share of all respondents, remainder in
// oth". Articles printing undecided INSIDE the quoted figures (the 1990
// Melbourne Herald wave) or quoting a full slate now known to be Morgan's
// (1992-07-27) were excluded. Articles printing majors alone were excluded —
// with nothing printed of the minor slate, a residual oth would be a guess.
//
// Duplicated waves appear once, dated at the FIRST full write-up: 1993-01-19
// (majors only) yields to 1993-01-23 (same ppm 41/37 chain, full slate,
// n 2078); 1993-04-28 (majors only) yields to 1993-05-01 (same wave:
// mid-April, n 2045, full slate); 1993-05-22 is the same wave as 05-15
// (n 2066 both, "50 to 47" both) and adds nothing.
//
// Excluded after reading the OCR, with reasons (so no-one re-mines them):
//   131180529  undecided 11 quoted inside the slate; others never printed;
//              basis unverifiable against the Newspoll rows
//   126938585  full slate belongs to Time's Morgan poll, not AGB
//   126963602  43/38 bound the SENATE aggregate; Reps race numeric-only
//              as "five-point lead"
//   126976907/63/346 1993-02 THE POLLS digests: issue questions and other
//              houses' figures; no AGB VI slate
//   127199003  its 49.5/50.5 2PP is Newspoll's; AGB itself majors-only 45/47
//   127200877  campaign-eve 46/46 equal-share; majors only
//   127205554  post-election 50/38; majors only
//   127223882  1993-08-04: 45/41; majors only
//   127230754  AGB figures are SENATE aggregates (up from the election's
//              43.5); the 51–49 2PP beside them is Morgan's n=3399 wave
//   127232220  46/41 mid-May; majors only
//   127237630  1993-07-07: 47/40 "steady" — same values as the 06-23 wave
//   127237630  majors only
//   127247294  kept (prints Greens 7 + Democrats 3 — folded into oth per
//              the Newspoll-era convention of no separate Greens column)
//   127250824  kept (minors line ambiguous between Democrats/Greens; the
//              ambiguity sits inside oth either way)
//   118161192/118210797/118259643/127283056  1994–95 waves; majors only
//   126984220  the 50% is NSW state Opposition support; federal figures in
//              this article are Newspoll's
//   126988868  kept; its 05-22 sibling 126990297 reports the same wave
//   126970231  01-19 write-up of the 01-23 wave (no coalition figure); dup
//   126971123  kept — the full-slate 01-23 write-up (n 2078)
//   126972749  figures are an AFR multi-poll graph, no AGB slate
//   126973231  kept — prints combined minors "14 per cent" (45+41+14=100)
//   126977346  AGB items are issue questions; VI figures are Morgan's
// Firm label "AGB McNair" — matches the archive page's naming; no 2PP was
// ever printed by the house in this corpus, so the rows never reach the
// accuracy panel. n/fieldwork/sample are not on the row schema; they live
// in data/agb-mcnair-figures.csv.
//
// Row shapes are the curated ones: cyclePolls rows
// ({"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}), grn/onp
// null in-era as with Newspoll. Re-runs are no-ops (dedupe on date+firm).
// Dry-run by default; --apply writes. Input/output defaults to
// data/polls.json; POLLS_JSON env overrides it (used to build the commit
// candidate from origin/main's file without touching the working tree).
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const FILE = process.env.POLLS_JSON || "data/polls.json";

/* [date, alp, lnp, minorsPrinted, troveArticleId, what-the-article-prints] */
const ROWS = [
  // cyclePolls.1993 — window (e1990 1990-03-24, e1993 1993-03-13]
  ["1993-01-23", 43, 42, 15, "126971123",
    "Labor 43 (down 2), Coalition 42, Democrats 3, Independents 6, others 6; n 2078"],
  ["1993-02-01", 45, 41, 14, "126973231",
    "ALP 45 (from 43), Coalition 41 (from 42), minor parties and Independents 14"],
  // cyclePolls.1996 — window (e1993, e1996 1996-03-02]
  ["1993-04-17", 49, 40, 6, "126982731",
    "ALP 49 (down 1), Coalition 40 (up 2), Democrats 3, Independents 3; n 2078, face-to-face Mar 26–28/Apr 2–4"],
  ["1993-05-01", 50, 39, 11, "126985892",
    "ALP 50 (up 1), Coalition 39 (down 1), Democrats 3, Independents 4, others 4; n 2045 mid-April"],
  ["1993-05-15", 47, 39, 10, "126988868",
    "Labor 47 (down 3), Coalition 39, Democrats 4, independents and others 5; n 2066 Apr 23–May 2"],
  ["1993-06-23", 47, 40, 8, "127234419",
    "Labor 47 (up 1 since late May), Coalition 40 (down 1), Democrats 2, Independents 6"],
  ["1993-09-15", 36, 46, 10, "127247294",
    "ALP 36 (down 3), Coalition 46 (unchanged), Greens 7, Democrats 3"],
  ["1993-09-29", 36, 44, 5, "127250824",
    "Coalition 44 (down 2), ALP 36 (steady); balance-of-power party up 2 to 5"],
];

const FIRM = "AGB McNair";
const D = JSON.parse(readFileSync(FILE, "utf8"));
const resultOn = (k) => {
  const e = D.elections?.["e" + k];
  if (!e) { console.error(`elections.e${k} missing — cannot derive cycle windows`); process.exit(1); }
  return e.date;
};
const WIN = { 1993: [resultOn(1990), resultOn(1993)], 1996: [resultOn(1993), resultOn(1996)] };

const cycleOf = (date) => Object.keys(WIN).find((k) => date > WIN[k][0] && date <= WIN[k][1]);
const url = (id) => `https://trove.nla.gov.au/newspaper/article/${id}`;

// ---- candidates in the curated row shape ------------------------------
const vi = [];
for (const [date, alp, lnp, minors, id] of ROWS) {
  const cycle = cycleOf(date);
  if (!cycle) { console.error(`${date} (${url(id)}) falls outside every cycle window`); process.exit(1); }
  vi.push({ cycle, date, firm: FIRM,
    lnp, alp, grn: null, onp: null, oth: 100 - alp - lnp,
    tpp_lnp: null, tpp_alp: null, minors, id });
}

// ---- guards: never insert a dud row ------------------------------------
const guard = [];
for (const r of vi) {
  const sum = r.lnp + r.alp + r.oth;
  if (sum !== 100) guard.push(`${r.date} — shares sum ${sum}`);            // by construction; belt-and-braces
  if (r.oth < r.minors) guard.push(`${r.date} — derived oth ${r.oth} below the printed minors ${r.minors} (${url(r.id)})`);
  if (r.oth - r.minors > 15) guard.push(`${r.date} — unprinted remainder ${r.oth - r.minors} implausibly large (${url(r.id)})`);
  for (const k of ["lnp", "alp", "oth"])
    if (r[k] == null || Number.isNaN(r[k]) || r[k] < 0 || r[k] > 100)
      guard.push(`${r.date} — ${k} = ${r[k]}`);
}
const seen = new Set();
for (const r of vi) {
  const key = r.date + "|" + r.firm;
  if (seen.has(key)) guard.push(`${r.date} — duplicated inside this script's own row list`);
  seen.add(key);
}
if (guard.length) {
  console.error("aborting — rows failed sanity checks:\n  " + guard.join("\n  "));
  process.exit(1);
}

// ---- merge: skip any date+firm already on file, splice date-sorted ------
const byCycle = {};
for (const r of vi) (byCycle[r.cycle] ||= []).push(r);
console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
for (const k of Object.keys(WIN)) {
  const cycle = (D.cyclePolls[k] ||= []);
  const have = new Set(cycle.map((p) => p.date + "|" + p.firm));
  const news = (byCycle[k] || []).filter((r) => !have.has(r.date + "|" + r.firm))
    .map(({ cycle, minors, id, ...row }) => row);
  const skipped = (byCycle[k] || []).length - news.length;
  D.cyclePolls[k] = cycle.concat(news).toSorted((a, b) => a.date.localeCompare(b.date));
  console.log(`cyclePolls.${k}: existing ${have.size} · new ${news.length}`
    + (skipped ? ` · already present ${skipped}` : "")
    + (news.length ? ` (${news.map((r) => `${r.date} ${r.alp}/${r.lnp}/o${r.oth}`).join(", ")})` : "")
    + ` → total ${D.cyclePolls[k].length}`);
}
console.log("provenance: the printed slate behind every row is in this file's row table; articles at trove.nla.gov.au/newspaper/article/<id>");

if (APPLY) writeFileSync(FILE, JSON.stringify(D, null, 2) + "\n");
