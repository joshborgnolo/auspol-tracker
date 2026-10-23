# ABS input sources — `irsad-by-division.json` (derive-irsad.py)

Every input `derive-irsad.py` consumes is re-fetchable. Small committed
inputs live under `../src/` (repo); the ~230MB of bulky ABS cubes/allocation
files live in the Git-ignored cache `.matilda/seifa-irsad-abs/` (root blocks:
`abs-seifa-{2011,2016,2021}-sa1-indexes.{xls,xlsx}`, downloads under `dl/`).
This note is the manifest to rebuild that cache from scratch.

## Committed inputs (in git)

| Path | What |
|---|---|
| `.build/analysis/seifa-index/cache/rr5.txt` | AEC Research Report No.5 (2005) pdftotext — Attachment 1 ranks, `<https://www.aec.gov.au/About_AEC/research/files/research_paper5.pdf>` |
| `.build/analysis/seifa-index/src/aph/aph-09rp02.txt` | APH RP no.2 2008–09, Table 2a (2006c×2006b) |
| `.build/analysis/seifa-index/src/aph/aph-11rp01.txt` | APH RP no.1 2010–11, Table 2a (2006c×2009b) |
| `.build/analysis/seifa-index/src/abs/abs-seifa-2011-ced-populations.xls` | ABS 2033.0.55.001 SEIFA 2011 — CED population distributions (2011-edition CEDs) |
| `.build/analysis/seifa-index/src/abs/abs-seifa-2011-ced-sa1-distributions.xls` | ABS 2033.0.55.001 SEIFA 2011 — CED SA1 distributions (recon gate) |
| `.build/analysis/seifa-index/src/abs/abs-seifa-2016-ced-populations.xls` | ABS 2033.0.55.001 SEIFA 2016 — CED population distributions |
| `.build/analysis/seifa-index/src/abs/abs-seifa-2016-sa1-distributions-ced.xls` | ABS 2033.0.55.001 SEIFA 2016 — CED SA1 distributions (recon gate) |
| `.build/analysis/seifa-index/src/abs/abs-seifa-2021-ced-populations.xlsx` | ABS SEIFA 2021 — CED population distributions |
| `.build/analysis/seifa-index/src/abs/abs-seifa-2021-ced-sa1-distributions.xlsx` | ABS SEIFA 2021 — CED SA1 distributions |

## Git-ignored caches (re-fetchable)

### SEIFA SA1 index cubes (`<root>/.matilda/seifa-irsad-abs/`)

| File | Source |
|---|---|
| `abs-seifa-2011-sa1-indexes.xls` | ABS cat 2033.0.55.001, `DetailsPage/2033.0.55.0012011?OpenDocument` → "Socio-Economic Indexes for Areas (SEIFA) – Postal Area, SA2, SA1, State Suburb, Local Government Area, State Electoral Division" cubes |
| `abs-seifa-2016-sa1-indexes.xls` | ABS cat 2033.0.55.001, `DetailsPage/2033.0.55.0012016?OpenDocument` → SA1 cube |
| `abs-seifa-2021-sa1-indexes.xlsx` | SEIFA 2021 release page, "Index of Relative Socio-economic Advantage and Disadvantage" … `abs.gov.au` → SEIFA 2021 → Statistical Area Level 1 |

### Allocation / membership + weights (`<root>/.matilda/seifa-irsad-abs/dl/`)

| File | Source |
|---|---|
| `1270055001_mb_{2011,2016}_{st}_csv.zip` ×9 states ea. | ASGS Vol 1 pages `DetailsPage/1270.0.55.001July%20{2011,2016}/July%20{2011,2016}` → "Mesh Block to {year} Geographical Areas" CSVs (MB→SA1 7-digit AND maincode keys) |
| `1270055003_ced_{2011,2016}_aust_csv.zip` | ASGS Vol 3 pages `…1270.0.55.003July%20{2011,2016}…` → "Commonwealth Electoral Divisions to Statistical Areas Level 1" CSV (SA1→CED at SA1_MAINCODE level) |
| `1270055003_ced_2018_aust_csv.zip` | ASGS Vol 3 **July 2018** page (exists at `DetailsPage/1270.0.55.003July%202018/July%202018`) → SA1_MAINCODE_2016 → CED_CODE_2018 |
| `ced{2021,2024,2025}.xlsx` | Ed3 allocation hub `abs.gov.au/statistics/statistical-geography/australian-statistical-geography-standard-asgs-edition-3/{jul2021-jun2026}/access-and-downloads/allocation-files/<FILE>.xlsx` (MB_CODE_2021 → CED) |
| `mb2021.xlsx` | Same Ed3 allocation hub → "Mesh Block to SA1… 2021" (MB_CODE_2021 → SA1_CODE_2021), 35MB |
| `mbcounts2021.xlsx` | `abs.gov.au/census/guide-census-data/mesh-block-counts/2021/Mesh%20Block%20Counts%2C%202021.xlsx` (state Tables 1/1.1/…/9; MB + Person col) |
| `mbcounts-2011.csv` | ABS cat 2074.0 `DetailsPage/2074.02011?OpenDocument` (Mesh Block Counts, Persons_Usually_Resident col) |
| `mbcounts-2016.csv` | ABS cat 2074.0 `DetailsPage/2074.02016?OpenDocument` (Person col) |

Fetch gotchas (all hit live during the 2026-10-23 build): spaces in
subscriber.nsf query strings must be %-escaped or curl exits (3) "URL
rejected"; abs.gov.au `subserv` endpoints 302 twice, so always `curl -L`;
the subscriber `&`/query ampersands must stay inside a single-quoted URL.

## QA gates the pipeline runs (fails loud)

1. `assert_names` per election store row (exact boundary-set name pins —
   e.g. e2013 carries Charlton+Hunter+Throsby, e2016 carries Burt+Fenner,
   e2022 carries Hawke, e2025/2028 sets are 150 seats with Bullwinkel).
2. `recon_sa1_deciles` (2011, 2016): recomputed SA1-decile histogram per
   CED must equal the ABS "CED SA1 Distributions" cube EXACTLY — separates
   parse/membership defects from methodology choice.
3. 2021-era: national population share of each IRSAD decile must be
   10%±0.5% (weighted derivation sanity).

Regenerate: `python3 .build/analysis/seifa-index/derive-irsad.py` from the
repo root (selftest: `… selftest`). Requires `xlrd` (2.x, OLE2 .xls) and
`openpyxl`.
