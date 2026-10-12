---
name: auspol-abs-census-datapack
description: ABS 2021 Census GCP datapack anatomy for seat-model demographic frames (W1) — G01 age-band columns are Age_*_yr_M/F/P EXCEPT Age_85ov_{M,F,P}, the weekly-income histogram splits across G17B (up to $649) and G17C ($650 up), column-header probing before extraction, ABS cell randomisation means component sums drift from published totals (observed <=8 gender / <=15 tenure / <=26 income -> flat TOL=30 in invariant tests), and the G01 education-attendance column gotcha (worked 2026-10-08, commit ab615d1, .build/analysis/seat-model/extract-census-frame.mjs).
source: auto-skill
extracted_at: '2026-10-08T02:28:12.447Z'
---

# ABS Census GCP datapack — extraction anatomy (auspol-tracker seat model W1)

`.build/analysis/seat-model/extract-census-frame.mjs` (commit ab615d1) pulls
`TABLES = ["G01","G02","G17B","G17C","G37","G43"]` from the 2021 Census GCP
CED datapack (unzip cached under `.build/analysis/seat-model/cache/` — the
cache dir is gitignored in `.gitignore`'s seat-model block) into
`data/census-2021-divisions.json`; `test-census-frame.mjs` pins it. Every
table row is keyed by division name — no AEC IDs anywhere, so cross-file
matching is name-based with `/( fmr )/` atlas-renames stripped
("Cooper (fmr Batman)" etc. — 151 = 151 when the strip regex is applied to
BOTH sides).

## Column-name traps (each cost a failure cascade)

- **G01 age bands**: `Age_<lo>_<hi>_yr_M` / `_F` / `_P` for every band …
  EXCEPT the top band, which is `Age_85ov_{M,F,P}` — no `_yr` infix. Any
  generated-name loop that does `Age_${b}_yr_P` silently drops 85+ and every
  age-sum check fails by exactly the 85+ population. The extractor now holds
  an explicit AGE_BANDS list with the `Age_85ov_P` special case — keep
  generated loops OUT of census columns entirely.
- **G01 also carries institution-attendance columns**
  (`Age_psns_att_educ_inst_*`): same Age_ prefix on a different base. A
  column-name filter keyed on the `Age_` prefix alone collects them and
  double-counts. Filter tighter (require the `_yr_M/_yr_F/_yr_P` tail or the
  explicit band list).
- **Income histogram spans TWO tables**: G17B has 6 columns from
  `Neg_Nil_income` through `500_649`; G17C has the 9 higher bands
  (`650_799` … `3500_more`) plus the not-stated and total columns. Read
  G17B-only and you silently lose everyone on >$649/wk — W1's first cut
  had exactly this (16-band INCOME_BANDS constant now spans both, merged
  as `{ ...g17b, ...g17c }`; G17C-only columns are the not-stated/total).
  The probe that caught it: print all `P_*_Tot` headers of both tables
  before writing the band map. ALWAYS header-probe the file before
  abbreviating the extractor.
- **Not-stated feels like a band**: `P_PI_NS_ns_Tot` sits inside the income
  table — it belongs to `inc.notStated`, not the 15-band histogram. The
  test pins `Object.keys(inc.bands).length === 15` against this.

## Randomisation residuals — sum checks need REAL tolerance

ABS randomly perturbs census cells, so per-division component sums drift
from ABS's own published totals. Measured on the 151-throw frame
(2026-10-08): ≤8 for gender (2 cells), ≤15 tenure (6 cells), ≤26 income
(17 cells). Scaling tolerance by cell count was tried and was TOO TIGHT
for gender (2 cells → 4 < 8) and tenure. Shipped: **flat `TOL = 30`**
(`const close = (a,b) => Math.abs(a-b) <= TOL`) for ALL component-sum
checks, with a test comment carrying the observed residuals — 30 stays far
below any genuine column misread (hundreds–thousands). When extending
checks to more columns, measure the residual empirically on the green file
before choosing a tolerance; do NOT reintroduce per-cell-count scaling.

Other pins that earned their place: per-group non-negative loops (an early
`flatMap` version of the negative-count check had its own bug — use the
explicit grouped loop), national-persons sanity band, unique division codes,
atlas name cross-check (2022 rows, rename-stripped).

## Repo/build conventions for this pipeline

Extractor and test both run **from the repo root** with relative paths;
the datapack zip lives in the gitignored cache (re-download is offline
only); the JSON lands in `data/` with `_about`/`_provenance`:
`sourceUrl`, nightly `reportGeneratedFrom` path names per table, and the
`extractedAt` date. Validate (`node .build/newtracker/validate.mjs`)
before committing; commit extractor+test+JSON+the `.gitignore` cache
exclusion as ONE commit ("Seat model W1: …", ab615d1 is the template).

Related: `auspol-aec-event-downloads` (the W3 results baseline that pairs
with this frame), `auspol-demographics-hand-entry` (poll-level demographic
tables, a different data path for the vote-by-group panel).
