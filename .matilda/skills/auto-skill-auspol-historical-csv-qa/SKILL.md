---
name: auspol-historical-csv-qa
description: auspol-tracker — schema + conventions of the historical Newspoll/Roy Morgan reference CSVs in data/ (newspoll-{primary-vote,two-party-preferred,better-pm}, roymorgan-{primary-vote,two-party-preferred}, acnielsen-polls) and the recipe for auditing a pasted external table (e.g. Wikipedia) against them. Date = fieldwork-END (Newspoll Sunday; ACNielsen last day of printed range); Newspoll CSVs merge Lib+Nat into coalition; Wikipedia "<" under Nat means folded into Lib; roymorgan-primary uses "< 0.5" STRING values and a mode column (face/phone/blank) plus election=1 result rows; ACNielsen (8295c6e, extended 2026-09-03 to 2007–2012) has NO undecided column — uncommitted were redistributed — keeps literal "<0.5" STRING cells, and its ppm_pm/ppm_opp pair must be read through the pm/opp_leader era columns (howard/rudd/gillard × beazley/crean/latham/rudd/nelson/turnbull/abbott).
source: auto-skill
extracted_at: '2026-09-02T13:31:35.759Z'
---

# auspol-tracker: historical Newspoll/Roy Morgan CSVs + paste-vs-CSV audit

The repo's `data/` holds long historical pollster series (separate from
`polls.json`, which extractors write). These are the "existing data" users mean when
they paste an external table and ask "is this consistent with what's on file".

## Files, schemas, conventions

- `newspoll-primary-vote.csv` — `date,coalition,alp,greens,others,democrats,one_nation`
  since 1985. Coalition is COMBINED (no Lib/Nat split). `democrats`/`one_nation` sparse,
  and blank minor cells are legitimate elsewhere too: `1996-01-21` prints greens blank
  (sub-threshold) and the row still sums exactly 100 — never coerce blank minors to an
  error, they're null-with-zero-contribution. Coverage floor facts for the Morgan/ACN
  series: Morgan's poll WAVES begin 1996-03-23 (earlier rows, incl. 1993-03-13 and
  1996-03-02, are election=1 markers only) and acnielsen-polls.csv opens on the
  1996-03-02 election row (first real wave 1996-05-05) — nothing pre-1996 exists
  from either house.
- `newspoll-two-party-preferred.csv` — `date,alp,coalition` since 1993.
- `trove-primary-vote.csv` (added bebc1ce, 2026-09-04) — Morgan CSV's 16 columns
  verbatim + `dlp,pollster,date_basis,note,article_id,url`; 51 Gallup-era rows
  1943–1985 (APOP Gallup to 1955, Morgan Gallup 1971–73 & 1984–85, one Spectrum).
  Date is the PRINTED POLL MONTH (15th) or publication week, NOT fieldwork-end —
  fieldwork dates are unprinted in the sources. Undecided printed as a line, left
  as-is; pollster-allocated estimate rows flag the allocation in `note`. Every row
  has a Trove article_id/url audit trail. See auspol-trove-vi-mining.
- `newspoll-better-pm.csv` — one sparse column PER leader
  (`...kevin_rudd,malcolm_turnbull,brendan_nelson,tony_abbott,julia_gillard,...uncommitted`).
  Each row fills exactly the pairing in office that wave; values + `uncommitted` sum to 100.
  Span = 1987-06-07 → 2022-04-03 (cadence varies: 6 rows in election-year
  1987, ~24–28/yr in the 2000s, 16 in 2020). It is the SOLE canonical
  better-PM archive for its era: polls.json's separate live `ppm` table
  covers ONLY the in-progress term (opens 2025-07-01), so the
  2022-05→2025-05 block (Albanese v Dutton) exists in NEITHER — the one
  PPM gap on file (verified 2026-09-03). cycleApproval's per-term
  `pmPpm/oppPpm` values are this CSV's imported projection (joined by
  Newspoll's own approval waves, plus ACNielsen ppm_pm/ppm_opp 1996–2004
  and Essential 2007–2020): every in-term row here lands there (verified
  1990, 2019 terms 1:1), so per-term ppm sparsity in cycleApproval is the
  source's own — the question wasn't asked in those windows.
- `roymorgan-primary-vote.csv` — `date,election,alp,coalition,lib,nat,greens,one_nation,
  nxt,family_first,democrats,independents,other_parties,other,undecided,mode`.
  Quirks: sub-threshold values are the STRING `"< 0.5"` (never coerce blind);
  `mode` ∈ `face|phone|(blank)` — ALWAYS filter by mode when comparing against a table
  labelled "face to face" etc.; `election=1` rows hold actual election results
  (e.g. `2010-08-21,1,38,43.6,...,6.4` + matching 2PP row `50.1,49.9`).
  There is exactly ONE non-election POLL row with a blank mode in the 2007–10
  era: `2010-08-21`, which sits date-for-date on a labelled `phone` wave, so
  its provenance can't be named apart — the cycle assimilator
  (`.build/assimilate-2007-cycle-csv.mjs`) drops it on purpose.
  ALSO: polls.json's curated 2013-cycle Morgan rows can DIVERGE from these
  CSV 2PP columns (e.g. 2010-08-26: curated `tpp_alp` 49 vs CSV alp 51.5) —
  treat the CSV's alp/coalition pair as canonical (it sums to 100); nobody
  has documented the curated cut's basis.
- `roymorgan-two-party-preferred.csv` — `date,election,alp,coalition,flow_alp,flow_coalition,mode`.
- `acnielsen-polls.csv` (added 8295c6e by `.build/extract-acnielsen-archive.mjs` from
  the yearly `ACNielsenPoll*.pdf` stashed in `.build/acnielsen-src/`; extended
  2026-09-03 with the 2007–2012 yearly tables and the Sep-2008 FedVote cross-tab
  special, pinned from later wayback snapshots of au.acnielsen.com) — ONE wide
  row per wave: `date,election,sample,moe,mode,alp,coalition,democrats,greens,
  independents,one_nation,other,family_first,tpp_alp,tpp_coalition,tpp_flow_alp,
  tpp_flow_coalition,pm,pm_approve,pm_disapprove,pm_uncommitted,opp_leader,
  ol_approve,ol_disapprove,ol_uncommitted,ppm_pm,ppm_opp,ppm_uncommitted`
  (28 cols). 157 rows, 1996-03-02 → 2012-02-04. `mode=phone` on every wave
  (ACNielsen footnote); `election=1` rows (six: 1996/1998/2001/2004/2007/2010)
  carry no sample/moe/mode/leadership fields. NO undecided column — ACNielsen
  footnote is "Uncommitted voters were redistributed", so primaries already
  exclude them (do NOT reconcile against tables that keep an undecided line).
  Post-2006 additions: `family_first` (the 2007+ tables print the row), literal
  `<0.5` STRING cells, `tpp_flow_*` = the second 2PP block ("by how preferences
  flowed at the YYYY election") the 2008+ tables print beneath the
  respondent-allocation pair, and `pm` — 2007+ tables print no NAMES on the
  leadership rows, so `pm`/`opp_leader` are date-keyed by the extractor (PM:
  howard → rudd 2007-12-03 → gillard 2010-06-24; opposition: rudd 2006-12-04,
  nelson 2007-12-03, turnbull 2008-09-16, abbott 2009-12-01; pre-2007 waves
  take names from the printed labels, beazley/crean/latham — the Dec-2003 wave
  pairs Howard/Latham (spill 2003-12-02) even though the same PDF row prints
  "Crean /Latham"). The 2007-11-24 election row comes from the Sep-2008
  FedVote cross-tab ("ELECTION November 2007" prints no day — day filled from
  the known poll date) and carries VI+TPP only. GAP: no ACNielsen polls in
  2002 (ACN's own note). Verbatim quirks: 1996 election 2PP prints 47/53 (AEC
  official 46.4/53.6 — kept, same rule as the RM archive's election values);
  the 1998 and 2004 election columns reprint bit-identical in the following
  year's PDF (deduped to one row each); `ACNielsenPoll2011.pdf` (Feb–Jul) is
  fully subsumed by `ACNielsenPollDec2011.pdf`; the Sep-2008 cross-tab's five
  monthly waves reprint identical to the 2008 yearly table (its unique column
  is ELECTION Nov 2007); the 2010 election column's sample cell prints "AEC"
  and its MoE cell a generation-date stamp ("12-Oct-10"), both blanked;
  2007-07-14's PPM triple sums 98 (source rounding, kept).

**Date convention: Newspoll CSV date = fieldwork weekend END (Sunday)** — paste row
"17–19 Aug 2010" keys to `2010-08-19`. ONE known anomaly: the 2–4 Oct 2009 wave is keyed
`2009-10-01` in all three Newspoll CSVs (would be `2009-10-04` under the rule); values are
consistent, it's a row-key oddity only (as of the 2026-09-02 audit). **ACNielsen CSV
date = LAST day of the printed range** ("21-22 Jan 2005" → `2005-01-22`, "30 Sep 2
Oct" → `2004-10-02`). No known anomalies (101-row key-uniqueness checked by the
extractor at write time).

## Auditing a pasted table against these CSVs

1. Slice each CSV with awk by date range, e.g.
   `awk -F, '$1 >= "2009-01-01" && $1 <= "2010-08-31"' data/newspoll-primary-vote.csv`.
2. Key each pasted row to its CSV row by fieldwork-end date (see convention above).
3. Crossing the schema gaps:
   - Newspoll CSV has no Lib/Nat split — pasted `Lib+Nat` must equal CSV `coalition`.
     A "<" printed under Nat (Wikipedia convention) means Nat was folded into the Lib
     column: compare pasted Lib ALONE against `coalition`.
   - Better-PM tables suffix "^Remainder were uncommitted" — check
     pasted_a + pasted_b + CSV `uncommitted` = 100, and compare pasted pair against the
     two named leader columns (pairing changes at leadership spills AND at PM changes —
     Rudd/Howard → Rudd/Nelson(2007-12-02) → Rudd/Turnbull(2008-09-21) → Rudd/Abbott
     (2009-12-06) → Gillard/Abbott(2010-06-27)).
   - Roy Morgan pasted "Oth" columns are LOSSY: Wikipedia-like tables often drop
     `family_first` (1–2pts/row) and take "Oth" from CSV `other`, so pasted rows sum
     short of 100. 2026-09-02 audit finding: on the 7–8 Aug 2010 face mode row, the pasted
     Oth=2 equalled CSV `family_first` rather than `other=2.5` — flag pasted-side
     shortfall, CSV complete (ff 2.0 + other 2.5 = 4.5 others).
   - Pasted "Election" marker rows are NOT polls — match them to
     roymorgan `election=1` rows if anything, and expect ε-level rounding gaps in
     combined primaries (pasted 43.4 vs CSV 39.9+3.7=43.6) and differing "Others"
     categories (pasted 4.1 vs CSV other 6.4). The 2007-election row exists in NO CSV.
   - ACNielsen pastes: key by range-END day; a pasted table WITH an undecided line
     cannot reconcile column-by-column (CSV has redistributed shares); read
     preferred-PM as ppm_pm (always Howard here) vs ppm_opp (the wave's `opp_leader`),
     and expect their "-"/"not asked" waves as blank cells. 1997's May-02 wave is the
     famous One-Nation debut poll (one_nation 10, sample 1,032, moe 3.1).
4. Report per-table verdict with count of rows compared; attach anomalies as footnotes,
   naming which side (CSV or pasted) owns each anomaly.

## 2026-09-02 audit result (Newspoll 2007–2010 + Roy Morgan Jul–Aug 2010 pastes)

All 61 Newspoll VI rows, all 77 better-PM rows, and all 4 Roy Morgan face rows matched
value-for-value. Only the 2009-10-01 key oddity (CSV side, cosmetic) and the lossy pasted
"Oth" columns above. No data repairs were needed.

Related: roymorgan-release-extraction (live-release extractor that APPENDS to these
series conventions), newspoll-extraction, essential-vi-assimilator (the third historical
CSV, `essential-report.csv`, is covered there), acnielsen-extraction-recipe — see
`.matilda/skills/auto-skill-auspol-archive-pdf-extraction/` for the pollster-PDF →
`data/*.csv` mining recipe that produced `acnielsen-polls.csv`.
