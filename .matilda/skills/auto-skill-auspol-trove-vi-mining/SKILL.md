---
name: auspol-trove-vi-mining
description: auspol-tracker — mining actual voting-intention AND leadership readings from the Trove OCR corpus into data/trove-primary-vote.csv (51 rows, 1943–1985) plus trove-leader-approval.csv (120 rows, long format with measure+base columns — Gallup-era party-leader-choice is OWN-VOTERS base, never conflate with all-elector job-rating) and trove-preferred-pm.csv (12 waves, incumbent-first share_pm, cross-wired where printed table led with the opponent). Empirical recipe after three extractor iterations: narrative single-figure rows are hopeless (~40% noise); month-headered TREND TABLES are the precision route and print whole multi-month series in one article. Era-vocab map, OCR traps (decided→dec, per ccnt, US/state bleed, approval cross-tabs), wave-stitching rules (same series reprinted across mastheads with month-label drift), date conventions, and the hand-verify-every-row bar. Companion to auspol-trove-archive (which owns the corpus pipeline).
source: auto-skill
extracted_at: '2026-09-04T05:32:58.000Z'
---

# auspol-tracker: mining voting-intention readings from Trove OCR

`data/trove-primary-vote.csv` (committed dd88814→rebased bebc1ce, 2026-09-04)
holds 51 rows of verified Gallup-era primary-vote readings mined from the
Trove newspaper corpus: APOP Gallup 1943–1955 (~35 monthly-ish waves),
Morgan Gallup Mar-1971→Mar-1973 (10 rows incl. DLP), Morgan Gallup and one
Spectrum row 1984–85. It FILLS the gap before `newspoll-primary-vote.csv`
(1985-11-17) and complements `roymorgan-primary-vote.csv` (only election=1
rows pre-1976 — zero poll waves there to duplicate).

## Corpus facts that bite (from auspol-trove-archive)

- `data/trove-poll-articles.csv` (7,868 metadata rows) ∩
  `.matilda/trove-harvest/text/<id>.txt` — ALL 6,914 pre-1985-11-17 texts are
  ON DISK. `data/trove-text.jsonl` holds only 3,167 of them (8MB commit-cap
  sample): never census from the jsonl, it silently skips 60% of texts.
- Pre-1985 volume: figure-dense articles cluster 1946–54 APOP Gallup across
  many mastheads (75–147/yr), then a thin gap 1956–68 (Trove copyright cliff),
  then the Canberra Times Morgan Gallup seam from ~1971.

## Extraction recipe (empirical — trust the tables, distrust the sentences)

Three extractor generations lived in `.matilda/probe/trove-vi-extract{,2,3}.mjs`
(scratch, uncommitted). Findings:

1. **Narrative sentence rows are ~40%+ noise**: "per cent" sentences pull in
   US Gallup syndication (Republicans/Democrats/Roosevelt — WW2-era every
   paper), UK Gallup (1982-06 Conservatives 45), state elections, referendum
   cross-tabs, "Labor+Communist 54" bundles, PM-approval cross-tabs
   ("of Labor voters 77% approved"), and seat-level note figures. A
   WANT-gate (said they would vote / support for / voting intention) + USA
   and STATE reject regexes get you to maybe 70% clean — still unusable
   unreviewed. Use narrative hits ONLY to locate candidate articles.
2. **Month-headered trend tables are the precision route.** Printings repeat
   "FIRST PREFERENCES / VOTING INTENTIONS | May Jun Aug | Lab 43 42 40 |
   L-CP 39 43 46 | Undecided 16 13 12" blocks; ONE 1972-05-13 Canberra Times
   article (id 102021218) prints the whole 1971-03→1972-04 Morgan Gallup
   series in a single table; one 1954-03-06 Advertiser prints the Sep-53→Jan-54
   allocated series. Parser sketch that worked: month-token runs (≥2 tokens,
   tolerance: `dec` regex will match "UnDECIDED." — filter "decid|dect|coded"),
   then party-row labels each followed by 2–9 numbers within ~500 chars after
   the run.
3. **Hand-verify every row against the source OCR text** before committing.
   Dump candidate article regions with `.matilda/probe/trove-tables-dump.mjs`
   (prints 900–1300 chars around the first Gallup/FIRST-PREFERENCES keyword).
   OCR per-cent noise: "per ccnt", "per ceu", "p.c.", "pc", "%", "pec".
4. **Era vocabulary → modern columns**: Liberal-CP / Lib.-C.P. / L-CP /
   "Liberal and Country" / UAP-CP (pre-1945) → coalition; Labour/Labor/ALP →
   alp; DLP and Democrats kept separate (dlp column); 1943 "Others" includes
   undecided and the 'One Parliament' party (noted per-row); Country Party
   line alone → SKIP (already summed into the L-CP figure elsewhere).
5. **Wave-stitching rules**: the same Gallup wave is reprinted across 3–5
   mastheads within ±6d — dedupe on (alp, coalition) equality. Month labels
   DRIFT across republications: the wave 1952-11-29 Herald calls "Now" is the
   Oct column in the Mar-1953 Daily News series (keep one row, note the drift);
   the Sun 21-Aug-1949 table's "Aug." column IS the July wave (figures match
   the Sun 10-Oct table's July column exactly). Cross-check any table against
   the LATEST retrospective series-print before keying a wave date.
6. **Undecided basis varies by printing**: 1940s–55 APOP articles usually
   print RAW intentions (undecided 5–16pc, sums <100); later retrospectives
   print Gallup's ALLOCATED estimate ("dividing the undecided by their 1946
   vote", sums 100). Keep the raw version when both exist (prefer sum<100
   rows!), else keep the allocated row and flag it in note.

## CSV conventions (assimilated to roymorgan-primary-vote.csv)

Column order = Morgan's 16 verbatim (date,election,alp,coalition,lib,nat,
greens,one_nation,nxt,family_first,democrats,independents,other_parties,
other,undecided,mode) + appended `dlp,pollster,date_basis,note,article_id,url`.
- `date` = 15th of the printed poll month (`date_basis=printed-month`) or the
  publication week date (`publication-week`). Fieldwork dates are almost never
  printed pre-1985 — publication-date keying is a documented limitation, not
  a bug; Newspoll-style fieldwork-end dating does NOT apply.
- `undecided` as printed (do NOT pre-allocate: pre-Newspoll Morgan-Gallup
  tables print it as a line; Morgan's allocated-estimate rows have undecided
  blank with the allocation named in `note`).
- `pollster` ∈ APOP Gallup | Morgan Gallup | Spectrum (same poll combined).
- `note` carries: basis disputes (allocated-by-pollster), scope caveats
  (1954-05-23 = contested seats only; 1954-10-15 party pref via leader
  question), month-label drift, and which retro table supplied the row.
- Every row's `article_id`+`url` pins one canonical masthead printing
  (Sun/Herald/Daily News/Advertiser/Canberra Times are all APOP/Gallup
  prints of the same underlying poll — the `pollster` column from
  trove-poll-articles.csv says 'Gallup' or 'Morgan' inconsistently, both
  mean the Morgan-directed Gallup series).

## Leadership mining (second file pair, committed 73780ff, 2026-09-04)

The same corpus yields leadership readings: `data/trove-leader-approval.csv`
(120 rows, 1942–1985) and `data/trove-preferred-pm.csv` (12 waves), generated
by `.matilda/probe/trove-leadership-gen.py` from a hand-QA'd block dump
(`.matilda/probe/trove-approval-qa.txt`, produced by `trove-approval-dump.py`
— keyword-window dump over the on-disk OCR texts: approval/rating/"done a
good job"/"first choice" + leader names, ~126 blocks). Targeted census was
67 articles; ~20 false positives (Menzies-in-gardening, US Truman, state
leaders) excluded by reading.

**Approval CSV is LONG format, not the wide Newspoll convention**:
`date,leader,role,measure,approve,disapprove,undecided,base,sample_n,
pollster,date_basis,note,article_id,url`. Two columns do the real work:
- `measure` ∈ job-rating | party-leader-choice | government-performance |
  action-approval | good-job/bad-job | dismissal-approval
- `base` = `all` vs `own-party voters` — THE trap of Gallup-era leadership
  data: the 1943–54 "first choice for party leader" series (Curtin 74/58,
  Chifley 55→83, Menzies 44→87, Evatt 31→66) is measured **among each
  party's own voters**, NOT all-elector approval. Never merge or chart these
  against all-base job ratings.

**PPM CSV uses incumbent-first `share_pm`** (officeholder side), matching the
Newspoll reference CSVs: where the printed table leads with the opposition
candidate, cross-wire it and flag in note (Feb 1983 printed Hawke 49/Fraser
38 → share_pm=38 candidate_pm=malcolm_fraser, share_opposition=49).

Same corpus-derived seams: 1971-04→1972-11 McMahon/Whitlam monthly
approve/disapprove/undecided backcast from Morgan trend tables (one Canberra
Times article reprints the whole series, incl. a Hawke-as-ACTU-president
rating series 1971–72); fortnightly Hawke/Peacock 1984–85 (Peacock 41→19
trough Oct 1984 = then-record leader low); 1953 Menzies/Evatt "personally
prefer as PM" (APOP). Historical-label conflicts get noted per-row, never
silently resolved (1947 wave 'October' per Nov-1954 retrospective vs
'December' mastheads; 1954-10 'year ago: Oct' vs 'Sept').

## Anything sharp left behind

- `validate.mjs` does NOT cover these CSVs (it audits polls.json); alignment
  check = import csv, assert equal col-count per row.
- The committed CSV itself is git-managed like any data file — but stage
  ONLY it; sibling sessions leave extract-*/template.html/assets dirty and
  `git commit` of a pre-staged index will sweep them (see
  shared-repo-session-race / git-prestaged-commit-sweep).
- Growth path for MORE rows: 1956–68 gap is a corpus gap, not extraction
  failure. Likely yield remains: 1976–1983 Canberra Times Morgan Gallup
  seam (only spot-checked 1980/1982 hits so far — the 1982-06 hit was UK
  Gallup, trap!), and Senate-vs-hoR interleaved waves (skip Senate-only).
