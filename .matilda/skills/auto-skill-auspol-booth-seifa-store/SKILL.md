---
name: auspol-booth-seifa-store
description: auspol-tracker — booth-level SEIFA stores for the 2025 election (data/booth-seifa-2025.json, commit 69232fef) AND the seven historical elections 2004–2022 (data/booth-seifa-{2004..2022}.json via derive-booth-seifa-hist.py, ~60k booths across SA1/CD/geo eras, census pairing mirroring the division store, 2004 coords carried forward from the 2007 CSV). Carries the stdlib-only SHP/DBF/MapInfo-dat parser anatomy, the ABS shapefile quirks (ZZZ sentinel + 33 migratory null-shape SA1s, pre-composite FID-referenced CD shapes), the AEC polling-place CSV profile per era, and the SEIFA-cube ground truths (true score envelopes, suppression floors, partial per-index suppression, the 2001 cube's per-state-unweighted quantile-cut-point decile recipe) that pin every guard.
source: auto-skill
extracted_at: '2026-10-24T01:05:00.000Z'
---

# auspol-tracker — booth-level SEIFA stores (2025 + 2004–2022)

## The SEVEN-election historical extension (2004..2022, landed 2026-10-24)

`data/booth-seifa-{2004,2007,2010,2013,2016,2019,2022}.json` — one store per
election, user's chosen layout — from
`.build/analysis/seat-model/derive-booth-seifa-hist.py`, pinned by
`.build/analysis/seat-model/test-booth-seifa-hist.mjs` (in npm test after
test-booth-seifa-2025.mjs; 60,248 booths, 7 elections). Census pairing
mirrors the division store: 2004→2001c, 2007/2010→2006c, 2013/2016→2011c,
2019→2016c, 2022→2021c. 2025 stays in its own store/script/test above. The
geo key is `geo` (not `sa1`): 7-digit CD code in the 2001/2006/2011 eras,
11-digit SA1 in 2016/2021 eras. 1,080 OT/`9…`-geo booths are kept and
scored (CD-era cubes carry digit-9 OT rows; pre-2016 geometries resolve
them too). Per-era measured universes are pinned in the test's `YEARS`
table (rows/scored/noCoords/seifaSuppressed/pointOutside/otTerritory —
badCoords only where noted): 2004: 8,234/6,663/1,382/185/4/3; 2007:
8,235/7,631/512/88/4/3; 2010: 8,951/8,171/592/181/7/4; 2013:
9,146/8,319/578/245/3/7 (+1 badCoords); 2016: 8,328/7,534/587/206/1/7;
2019: 8,875/8,045/571/258/1/2; 2022: 8,479/8,196/64/217/0/5 (+2 badCoords).
Divisions are 150 everywhere except 151 in 2019/2022 (the House genuinely
expanded). Partial per-index suppression exists only in the SA1-era cubes:
13 in 2013, 27 in 2016, 43 in 2019, 25 in 2022 (CD cubes are complete).

Extraction lanes per census (all stdlib; SHP/DBF/WKB internals reused
verbatim from the 2025 script via importlib — `fail`, `hash16`,
`read_shp_polygons`, `ring_crossings`, `read_seifa` as `read_seifa_2021`):

- **2001 CD** — geometry `.matilda/seifa-irsad-abs/dl/asgc2001.gpkg`
  (data.gov.au mirror of the ABS ASGC 2001 boundaries, GDA94): sqlite
  open + stdlib WKB blob parse (guards: blob magic, little-endian WKB,
  polygon-part structure). Cube `AUS_cd_s01.xls` inside
  `dl/seifa2001-aus.zip` (the SAME zip the division pipeline's CED cube
  comes from); flat single sheet, 49 cols fixed by header NAME
  (`2001_CD_Code` c0, `State_Code` c2, population c20, four score cols
  c21–24 — IRSAD leads irsd here — Q cut cols 25..44), 35,695 CD rows.
  **2001 ships NO per-area deciles** — see the recipe section below.
- **2006 CD** — geometry nine ABS 1259.0.30.002 state zips
  (`1259030002_cd06a<st>_shape.zip` incl. an `ot` pack): DBF fields
  STATE_CODE+CD_CODE06 validated (7-digit, leading digit == state code),
  **38,704 polygons and zero null geometries** pinned per state pack.
  Cube `dl/seifa2006-cd.xls` Table-1 lane, 37,457 rows.
- **2011 SA1** — geometry ABS 1270.0.55.001 July 2011 zip (DBF records
  pinned 54,805, key field **`SA1_7DIG11`**); cube
  `abs-seifa-2011-sa1-indexes.xls` keyed by the SAME 7-digit code in col 0
  (52,678 rows). No maincode geometry/cube mismatch exists in this era —
  **2011-era stores carry 7-digit SA1 codes** (it's the 2021/2016/2025
  stores that carry 11-digit).
- **2016 SA1** — July 2016 zip (DBF 57,523, key `SA1_MAIN16`); cube
  `abs-seifa-2016-sa1-indexes.xls`, 55,140 rows, 11-digit maincode col 1
  (col 0 is the 7-digit), pop col 10.
- **2021 SA1** — the committed cache zip + `_m25.read_dbf_codes` (the
  2025 script's own sentinel+61,844 pins → 61,811 polygons) and its
  `read_seifa` xlsx lane.
- **2006/2011/2016 cubes share `_cube_xls_table1`**: header row 4 names
  the indexes (resolved by NAME — ABS leads IRSAD in 2006/2011 but IRSD
  in 2016), row 5 must read Score/Decile, data from row 6, row count
  pinned, and the cube's own national-decile columns are taken AS-IS.
- **2004 carry-forward** — the 2004 AEC CSV ships NO coord columns (the
  script fails if it ever gains any), so coords are carried from the
  2007 CSV by exact key: (state, division, polling-place name) first
  (6,717 hits pinned), then (state, division, premises, suburb) for the
  leftovers (135 hits pinned — a guard fails loud if the pair
  `(6717, 135)` ever drifts); only 2007 rows with non-(0,0) coords are
  eligible. Matched rows are flagged `coordsFrom: "2007"` at the record
  AND in `_provenance.coordCarryForward`. The 1,382 unmatched stay
  `noCoords`.

### SEIFA 2001 decile derivation (no per-area deciles in that release)

`AUS_cd_s01.xls`'s Q columns (25..44, five cuts per index) are
**per-state quantile cut points over index values — each CD counting
once, never population-weighted** (AUS/Details.rtf: "below which a
specified percentage of index values fall"). The store's national
deciles are derived in-pipeline by `_abs_quantile_2001`: sorted order
statistics, Hyndman-Fan type 2 (split pair → average the two central
neighbours), one AREA counting once. The recipe is VERIFIED before any
decile is emitted: it must reproduce all **180 published state quantile
cells** (abs err ≤ 1e-4) and the **4 prose medians** of Details.rtf
(national IRSAD median 990; TAS 935, NT 1010, ACT 1117) — printed
"quantile recipe verified" on every run. National edges at q = 0.1..0.9
(sorted + 100–1450 range guards), decile = `bisect_left(edges, score)+1`
("one-tenth at or below").

### Old-CSV and era gotchas (each pinned in ELECTIONS/test)

- Every CSV's profile is pinned in `ELECTIONS[year]`: exact row count,
  division count, the PollingPlaceTypeID histogram, the state histogram
  and (post-2004) the coordless-row count — load is fail-loud on any
  drift. PPVC (type 5) rows first appear in the **2010** CSV (682);
  2004/2007 have types 1–4 only. 2019/2022 carry 151 divisions — that's
  the House itself growing (Bean 2019, Hawke 2022), and the guard is
  per-era, never a blanket 150.
- `badCoords` = coords outside the sanity band (-55..-9 lat, 95..169.5
  lon — 169.5 keeps Norfolk Island legit); rows are KEPT raw with the
  note (2013: 1, 2022: 2, others 0). There is no remap dictionary —
  nothing is silently corrected.
- Premises-state v polygon-state disagreements are a GUARD REPORT ONLY
  (`stateFlagBooths`, list pinned in the test per year: 5/3/2/3/2/3/1
  across 2004..2022) — **the physical premises location wins**, no
  record is rewritten. Exemplars in the pins: Jennings (NSW/QLD border)
  2004–2013, Mungindi ditto, Malua Bay ~140 m offshore (`pointOutside`
  2010), Leigh Creek 2022.
- OT (code digit 9) booths are kept and SCORED in every era (the census
  cubes all carry OT geographies; pp counts per year live in
  `counts.otTerritory`) — 2010's OT PPVCs even land `pointOutside`
  against the 2006-era OT shapes, which is pinned, not "fixed".
- Scored-rate floor is **90%** for the hist stores (CD-era suppression
  is heavier than the 2025 store's 96% guard).

## The 2025 store (original section)

Shipped 2026-10-24, commit 69232fef (branch allseats-class-flows). ONE record
per 2025 federal polling place: `{div, divId, state, boothId, booth, type,
venue, suburb, premisesState, postcode, lat?, lon?, note?, sa1, seifa|null}`
with `seifa = {irsd, irsad, ier, ieo, dec{irsd,irsad,ier,ieo}}` — scores plus
ABS-published **national** deciles. `_about` records the method limits (SA1
of the PREMISES as catchment proxy, 2021-census vintage leads the 2025
election by ~3.7y, GDA94↔GDA2020 ~1.8 m shift is noise at SA1 scale).

Pipeline: `.build/analysis/seat-model/derive-booth-seifa-2025.py` (python3 +
openpyxl, stdlib for geospatial work) → store; pinned by
`.build/analysis/seat-model/test-booth-seifa-2025.mjs` (wired into npm test
after test-division-seifa.mjs). Inputs: vendored committed
`atlas/data/aec-2025/GeneralPollingPlacesDownload-31496.csv` (git);
git-ignored caches `.matilda/seifa-irsad-abs/abs-seifa-2021-sa1-indexes.xlsx`
and `.build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip`
(re-fetch manifest in the extractor docstring; SEIFA cube manifest is
`.build/analysis/seifa-index/docs/abs-input-sources.md`).

## Measured universe (first green run 2026-10-24 — the test pins these)

8,940 booths → 8,354 mapped to an SA1, **zero pointOutside**, zero
premises-state/SA1-state mismatches. 8,085 scored (**96.78%** of
coord-holding); 269 in score-suppressed SA1s (genuine ABS suppression, see
below); 584 `note=noCoords` (mobile/hospital teams); 2 `note=badCoords`
(Henty/Farrer + Carlingford North/Parramatta, AEC ships (0,0)); 4
Other-Territories SA1 hits (Norfolk Island + NI PPVC on Bean
90104100404, Jervis Bay + Other Mobile Team 1 on Fenner); 17 booths on cube
rows with PARTIAL per-index suppression (Wetherill Park BLAXLAND PPVC has
ieo only — representation stays faithful: that index's score+decile are
null, never interpolated). Extractor is byte-deterministic (md5 checked).

## Stdlib-only SHP/DBF parsing (no geopandas/shapely/pyshp on this machine)

Layout that cost two debug cycles — SHP 100-byte header:

- byte 0: file code **9994 BIG-endian**; byte 24: file length in 16-bit
  words **BIG-endian** (verify `flen*2 == len(buf)`); byte 28: version
  **1000 LITTLE-endian**; byte 32: shape type LE (5=polygon).
- Records: 8-byte BE header (rec no, clen in words) then LE content. For
  type 5: bbox 4×d @4, nparts/npts 2×i @36, parts[] @44, points after.
- **Null-shape records (type 0) appear mid-file**, not just at the end: the
  ABS SA1 pack has 34 — the terminal ZZZ record plus 33 migratory/offshore
  no-usual-address SA1s (`x979797999x` + `x999949999` per state; TAS gains
  69797979994; ACT/OT carry only two; full 33-code pin set lives in the
  extractor's `want_null`, the test re-pins the OT booth outcome).
  Those DBF rows keep REAL SA1 codes; pair codes↔records positionally and
  skip the nulls — 61,811 polygons remain (61,845 DBF rows − 1 sentinel −
  33 migratory).
- DBF trailer: the pack's last record is a `ZZZZZZZZZZZ` null-geometry
  sentinel — expect exactly one, drop it, count-guard 61,844 digit codes.
- DBF field descriptors: 32-byte records from offset 32 terminated by 0x0D;
  name bytes 0–10, field length byte 16; record 0 = deleted-flag byte, so
  column offsets start at 1.

PIP join: 0.25° static grid over polygon bboxes → shortlist per point (BFS
expansion ≤2 cells for border points), even-odd crossing parity summed over
ALL rings (holes cancel by parity — count crossings ring-by-ring, `% 2` on
the total). Multi-hit (points on shared boundaries) takes the sorted first
code — deterministic.

## AEC GeneralPollingPlacesDownload-31496.csv profile (vendored copy)

Banner line 0, header line 1, 8,940 data rows, no quoted fields. Key
`(DivisionID, PollingPlaceID)` is unique; 150 division IDs. Type taxonomy:
1:Polling place ×6966, 2:Special hospital ×484, 3:Remote mobile ×77,
4:Mobile team ×114, 5:PPVC ×1299 (all no-coords rows are type 2/3/4 — 584
rows). 4 out-of-band coords: Norfolk Island + NI PPVC are LEGIT (lon
167.95 — sanity band must reach 169.5, not 160); Henty + Carlingford North
are (0,0) garbage → `badCoords`. More on the CSV family:
auto-skill-auspol-aec-event-downloads.

## SEIFA 2021 SA1 cube ground truths (guards must be pinned to MEASURED)

- `abs-seifa-2021-sa1-indexes.xlsx` Table 1: header row is index 5; col 0 =
  11-digit SA1 code; cols 1/2 IRSD score+decile … 7/8 IEO, col 9 URP.
  59,421 rows with data.
- True score envelopes (measured 2026-10-24 — an assumed [300,1400] band
  tripped on real data): irsd **143.5–1206.7**, irsad 435.3–1273.0,
  ier 298.8–1315.1, ieo 407.5–1371.9. Guard band used: 100–1450.
- **2,390 of 61,811 SA1s publish no scores** (~3.9%) — low-pop areas. Booths
  hit them at 3.2%, so the scored-rate guard floors at **96%** (measured
  floor 96.78% with headroom), never a fresh-fit threshold.
- Partial suppression is real: a cube row can carry ieo while
  irsd/irsad/ier are suppressed-null. When a score is null its decile is
  null too (test pins `score===null ⇔ dec===null`).
- ABS swaps IRSD/IRSAD lead-column order between editions (2011 leads
  IRSAD, 2016/2021 lead IRSD) — resolve cube columns by header NAME. This
  bit the division pipeline too (see auto-skill-auspol-seifa-division-history).

## Test-writing discipline (same pattern as the division store)

Pin the test from the GREEN extractor output, not from plan estimates:
universe counts, note vocabulary, per-state histogram, key uniqueness,
sort order (state order → div → boothId, monotonic sweep), and spread
spot cells across states/kinds/extremes — here: Toorak & Mosman top band,
Hobart SA1 60105102717, Waverley PPVC, cube-max SA1 80104112206 (ANU
campus — irsad 1273.0/ier 1315.1 BOTH global maxima), floor SA1
20603111321 (Ascot Vale public housing — irsd 266.6, all four decile-1),
one noCoords remote-mobile, both badCoords, one seifaSuppressed, the
partial row, all 4 OT booths. Test re-hashes the COMMITTED AEC CSV
against `_provenance.files.<path>` (sha256-16); git-ignored caches are
hash-string pinned only. Coord-band checks must skip deliberately-kept
raw badCoords rows (their (0,0) is filed in the store by design).
Commit discipline: explicit-path `git add`/`git commit` (shared dirty
worktree — see auto-skill-shared-repo-session-race); validate.mjs exit 0
gate before commit per auto-skill-auspol-seat-model conventions.
