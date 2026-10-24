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
| `.build/analysis/seifa-index/src/aph/aph-98cib04.htm` | APH CIB no.4 1998–99 (1996c × the 1997-in-force boundaries) — served as HTML, committed as the raw Wayback `id_` capture; consumed by the seat-model extractor (`aph98cib04` via `aphHtmlLines`), **not** derive-irsad.py. Five-index era: Advantage composite stays fixture-only as `adv`, the store block carries irsd/ier/ieo only |
| `.build/analysis/seifa-index/src/aph/aph-01cib13.txt` | APH CIB no.13 2000–01 (1996c × 2000b) — 2001-row fallback + the 1998 block's cross-paper oracle (66 untouched divisions byte-identical) |
| `.build/analysis/seifa-index/src/aph/aph-05cib01.txt` | APH CIB no.1 2004–05 (2001c × 2003b) — 2004-row source |
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
| `dl/seifa2001-aus.zip` | ABS cat 2033.0.55.001, `DetailsPage/2033.0.55.0012001?OpenDocument` — the "Commonwealth Electoral Division" cube set (`AUS_ced_s01.xls`, published per-division scores on 2000/01-edition CEDs; consumed by seat-model's 3-index pipeline) |
| `dl/seifa1996-australia.zip` | ABS cat 2033.0.55.001 `DetailsPage/2033.0.55.0011996?OpenDocument` — per-state `XX SEIFA96.xls` CD-level cubes (five index columns + population). **Unparsed as of 2026-10-24**: the 1998-election need it was fetched for is satisfied at grade A by the published APH CIB no.4 1998–99 tables (`aph-98cib04.htm`); a CD→CED(1997-in-force) concordance was never sourced. Kept as the grade-B fallback for any 1996–2000 work (rr6 §7) |

### Booth-hist pipeline inputs (`.matilda/seifa-irsad-abs/dl/`, consumed by `../../seat-model/derive-booth-seifa-hist.py`)

| File | Source |
|---|---|
| `asgc2001.gpkg` | data.gov.au mirror of the ABS ASGC (2001 Edition) CD boundaries (`data.gov.au/data/dataset/asgc-2001` — CD (2001) GeoPackage resource, GDA94); read by raw sqlite + WKB parse |
| `1259030002_cd06a<nsw,vic,qld,sa,wa,tas,nt,act,ot>_shape.zip` ×9 | ABS cat 1259.0.30.002 (ASGC 2006 digital boundaries), `DetailsPage/1259.0.30.0022006?OpenDocument` → "CD 2006 … <State>" shape zip per state incl. Other Territories; 38,704 CD polygons total |
| `1270055001_sa1_2011_aust_shape.zip` | ASGS Vol 1 July 2011 page → "SA1 2011 … AUST" shape zip (DBF 54,805, key `SA1_7DIG11`) |
| `1270055001_sa1_2016_aust_shape.zip` | ASGS Vol 1 July 2016 page → SA1 shape zip (DBF 57,523, key `SA1_MAIN16`) |
| `seifa2006-cd.xls` | ABS cat 2033.0.55.001, `DetailsPage/2033.0.55.0012006?OpenDocument` → the CD-level SEIFA cube |
| `seifa2001-aus.zip` | (already in the cube manifest above — `AUS/AUS_cd_s01.xls` is the booth pipeline's 2001 cube, same zip as the division pipeline's CED cube) |
| `SA1_2021_AUST_SHP_GDA2020.zip` | (already committed under `../../seat-model/cache/` — the 2025 booth pipeline's own zip, reused for the 2022 store) |

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
Dead ends checked (2026-10-24): ABS cat 2905.0/1996's PDF is image-only
and its Appendix I is profile name lists only — no CD→CED concordance,
kill it as a source; the ABS's own live catalogue page for the 1996
SEIFA data serves the cube set above fine.

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
