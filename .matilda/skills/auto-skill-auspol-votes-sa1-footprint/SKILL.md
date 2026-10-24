---
name: auspol-votes-sa1-footprint
description: auspol-tracker — the AEC "Votes by SA1" product → voter-footprint vote-weighted SEIFA+demo per booth, production pipeline for all four elections (.build/analysis/seat-model/derive-booth-seifa-voter.py → data/booth-seifa-voter-{2016,2019,2022,2025}.json, test-booth-seifa-voter.mjs in npm test; the 2025 prototype stays under .matilda/aec-sa1/ uncommitted). The 7-digit ccd_id IS the 11-digit SA1 code minus SA4+SA3 digits (code[0]+code[5:11], verified injective — no correspondence file needed); pseudo-row anatomy (pp_id==0 declaration cohorts, PPVC/EAV real rows); per-index SEIFA suppression needs per-index weighting denominators; 2026-10-24 demo block folds 2021-census GCP G01 at SA1 into every lane in Ed3 space (age shares renormalise over the 11 bands — G01 has NO age-not-stated column, so shares on Tot_P_P miss 1 by ≤4% per SA1). Sibling of auspol-booth-seifa-store (venue proxy).
source: auto-skill
extracted_at: '2026-10-24T07:23:06.997Z'
---

# auspol-tracker — AEC votes-by-SA1 → voter-footprint SEIFA+demo (production since 2026-10-24)

Complements `data/booth-seifa-2025.json` (venue proxy: SA1 of the booth's
PREMISES — see auto-skill-auspol-booth-seifa-store) with a footprint
weighted by where the booth's voters LIVE. Built 2026-10-24 as an
UNCOMMITTED prototype; script `.matilda/aec-sa1/prototype_voter_footprint_2025.py`,
output `.matilda/aec-sa1/voter-footprint-2025.json` (1.9 MB). Do not commit
until the user asks; the survey/design work survives compaction in
`.matilda/aec-sa1/edition_check.py` too.

## Product availability (surveyed 2026-10-24)

"Votes by SA1 – national / by state" on each election's downloads-statistics
page. Roll mark-off × polling-place results; the AEC itself flags it
"indicative… not directly comparable to vote counts due to rounding".

- 2025 — Ed3 (2021) SA1s, 64.7 MB CSV, 1,064,065 rows,
  header `year,state_ab,div_nm,ccd_id,pp_id,pp_nm,votes` (ccd 7-char).
- 2022 — Ed2 (2016), 47.4 MB CSV, same schema, id col `ccd_id`.
- 2019 — Ed2 (2016), 47.2 MB CSV, id col `SA1_id`.
- 2016 — Ed1 (2011), 31.1 MB XLSX, sheet `HouseCatchment (2016FE)`,
  934,147 rows, id col `SA1_id`.
- 2013–2004: NOTHING (downloads pages carry no SA1/CCD product).
  Voter-footprint is feasible for 4 of the 8 venue-proxy elections only.

Census pairing for scores: 2016-file → 2011-census cube (booth-seifa-2016),
2019 → 2016-census cube, 2022 → Ed2 needs the ABS Ed2→Ed3 correspondence
`CG_SA1_2016_SA1_2021.csv` (RATIO_FROM_TO; ABS Edition-3 correspondences URL
pattern confirmed live 2026-10-24) to reach census-2021 scores, 2025 → 2021
cube directly.

## THE 7-digit compression (the load-bearing discovery)

The AEC 7-digit `ccd_id`/`SA1_id` IS the 11-digit SA1 maincode with the
SA4+SA3 digits dropped:

```
ccd7 = code11[0] + code11[5:11]
```

- Verified byte-for-byte against the published `SA1_7DIG11` (54,805 rows)
  and `SA1_7DIG16` (57,523) DBF columns — ZERO mismatches; injective on all
  three ASGS editions (Ed3: 61,844 distinct). No external correspondence
  file is needed for a same-edition decode — apply the transform to
  `SA1_CODE21` from the committed cache zip
  `.build/analysis/seat-model/cache/SA1_2021_AUST_GDA2020.zip`.
- Trap: bare suffix-7 of the 11-digit code is WRONG (10,863 collisions).
- Trap: ABS Ed3 boundary packs (GDA94 AND GDA2020) carry NO 7-digit column —
  only Ed1/Ed2 packs do. Hence the transform exists for Ed3.
- Residual unmapped codes per votes file (18–37 ids) ALL end `9999` = ABS
  migratory/no-usual-address sentinel SA1s; no SEIFA scores exist. 2025:
  38 votes of 16,420,747 (0.0002%) — bucket them, exclude from weights.
- Edition identity per file confirmed by set-membership testing
  (.matilda/aec-sa1/edition_check.py): ≥99.95% of ids / ~100.000% of votes.

## 2025 file anatomy (each pinned by the prototype run)

- `pp_id == "0"` rows: division-level DECLARATION cohorts, names exactly
  `{Postal, Pre-Poll, Absent, Provisional}` → 600 cohort units (4 × 150
  divisions). Weight them at division level, never as booths.
- PPVC and EAV are REAL-pp_id rows (1,282 PPVC ids; EAV e.g. pp 65592
  "EAV Adelaide PPVC"; 150 EAV booths join the store). This dissolves the
  venue-proxy EAV distortion: the store had all 150 EAVs pinned to the
  Canberra head-office SA1; the footprint gives them honest scores
  (99.5% coverage).
- 26 store booths have NO votes rows (listed-but-unused PPVCs like
  Rockingham/Exmouth/Hall; Bean/Eden-Monaro "Other Mobile Team 1/2").
- Join key: votes file carries NO DivisionID — join to the booth store on
  (normalized `div_nm` ↔ `div`, `pp_id` ↔ `boothId`). Division name sets
  matched exactly 2025 (drift → fail, not fuzzy-match).

## SEIFA weighting gotcha (cost one crash)

ABS suppresses SEIFA indexes INDEPENDENTLY within an SA1 — a cube row can
carry IRSD while IEO is null. Weight per INDEX with per-index covered-vote
denominators (`scoredByIdx`), reweight each index over its own kept votes.
A single shared denominator (guard on irsd only) crashes on `int * None`
or silently shifts scores. (Same partial-suppression fact is pinned in
auto-skill-auspol-booth-seifa-store: 25 such rows among 2022 booths etc.)

## Reconciliation oracle + its gotcha

Committed per-state FPV files `.build/aec-flow-src/booth/fpv/2025-<ST>.csv.gz`
(VTR HouseStateFirstPrefsByPollingPlaceDownload) — **banner line FIRST,
then header** (`next(fh)` before DictReader; forgetting it = fieldname
assertion). Sum `OrdinaryVotes` per (DivisionNm, PollingPlaceID).
2025 result: all 8,914 booths matched, median diff 0.0%, p95 0.4%, worst
absolute ±70 votes on 1.2k–19k-vote booths (consistent with the AEC
rounding disclaimer); ±100%/33% extrema are tiny-denominator remote booths.
(National HouseFirstPrefsByPollingPlaceDownload and
HouseDopByPollingPlaceDownload 404 on the VTR — the per-state lane is the
only path; documented in README-booth.md.)

## Demo block (GCP G01 at SA1, shipped 2026-10-24 on all four lanes)

Architecture decision: **every lane folds demographics on the 2021-census
G01 basis** (never 2016/2011 census replicas) — the votes are walked into
Ed3 space FIRST, then one `demo_units()` pass folds the GCP SA1 table.
Only the 2016 lane needed an extra walk doc: `CG_SA1_2011_SA1_2016.xlsx`
Table 3 (58,769 data rows / 54,805 sources; 5 sources sum <1) composed
with the already-loaded Ed2→Ed3 CSV. Zero votes dropped on any walk — a
`votesDroppedWalk` key in counts.demo would be emitted otherwise (assert
its ABSENCE).

File links: GCP zip at
`abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_SA1_for_AUS_short-header.zip`
(382 MB, member `...G01_AUST_SA1.csv`, pinned 61,844 rows), cached
`.build/analysis/seat-model/cache/gcp-sa1-2021.zip` (gitignored).

Per-unit emit `{persons, cov, langOther, age:{11 bands}}`; `persons` is a
vote-weighted pseudo-population, never a headcount — the store carries the
ecological-transport caveat (`DEMO_ABOUT`) plus `demoBasis`, GCP zip hash,
and the CG_2011 xlsx hash in `_provenance`.

### THE G01 age not-stated trap (cost a full regeneration)

G01's 11 age bands do NOT sum to `Tot_P_P`: the table has NO
age-not-stated column, and the residual runs anywhere up to ~4–5% per
SA1 (measured SA1 maxima 0.0365 deviation). Shares banded on `Tot_P_P`
therefore miss 1 by as much; a sum-to-1 invariant test on per-share
values fires in bulk across all ~35k demo rows. **Fix: renormalise age
shares over the band sum** — the same ex-not-stated basis the
language share already uses (`oth/(eng+oth)`, never `oth/Tot_P_P`).
`counts.demo.national` accumulates vote-weighted per-unit values, so its
denominator consistently uses the band sum (`nat_b`), not `nat_p`.

### Other measured invariants (pin table per year in the test)

- counts.demo = {rows, coverage: 1.0, national: {langOther, age0_14, age65ov}};
  **rows spans booth AND cohort rows** (2025: 9,513 = 8,913+600).
  National numbers (2025): langOther 0.2277, age0_14 0.1855,
  age65ov 0.1728 — vs 2021-census actuals 0.228/0.182/0.172 (the residual
  gap IS the ecological weight-vs-population difference; sanity envelope,
  never an equality check).
- One footprint unit maps to votes but ZERO usual-resident persons:
  2019 O'Connor Other Mobile Team 2 (boothId 65160, 49 votes) →
  `{persons:0, cov:…, langOther:null, age:null}`. The test pins it in
  `demoEmpties`; renderers must treat demo.age as nullable.
- noVotesRows / zeroVotes rows carry `demo: null` (not a zero block).
- Extremes are plausible by mouth: max langOther = Lingiari Home
  Island 0.9804 (2016) / Remote Mobile Team 5 0.942 (2025); min = Grey
  Hallett 0.0011 / Lyne Vacy 0.0006; oldest = Dawson Special Hospital
  Team 4 at 97.7% 65+ (n=13 — small cohort, fine); youngest =
  Melbourne CBD North West at 66.8% aged 20–34 (2025) / Annandale East
  (Herbert) 59.8% (2016).
- openpyxl yields the CG_2011 xlsx SA1 codes as Python **ints** — coerce
  `int`s in [10**10, 10**11) to str before the `isinstance(c0, str)`
  row gate, or the Table-3 read returns 0 rows.

## Prototype results (2025, numbers to quote)

1,064,065 rows → 8,914 booth units + 600 cohorts; 8,913/8,914 booths scored
(mean scored-vote coverage per booth **99.79%**, residual = SEIFA-suppressed
SA1s). **582 venue-proxy `noCoords` booths newly covered** (mobile/hospital
teams have votes-file rows even without premises coords). Divergence
|footprint − venue| is dramatic for centralised venues sited in
disadvantaged areas: Acacia Ridge South (Oxley) irsd 476.3→1023.8,
Ascot Vale 266.6→800.5, Eastlakes SYDNEY PPVC 523.4→1053.4,
Warrawong WHITLAM PPVC 531.6→980.5 — the venue-proxy reads the postcode;
the footprint reads the catchment.

## Neighbourhood facts (from SA1 pack + cube, not re-derived here)

61,844 Ed3 SA1 codes incl. 33 migratory null-shape sentinels; 59,421 SA1
cube rows with scores; ~3.9% of SA1s score-suppressed (low pop). Full
SHP/DBF/PPP parsing anatomy + cube ground truths:
auto-skill-auspol-booth-seifa-store. Reusable extractor helpers import via
importlib from `.build/analysis/seat-model/derive-booth-seifa-2025.py`
(`read_dbf_codes`, `read_seifa`, `fail`, `hash16`).

## Scratch I/O discipline (hard-won this session)

- /private/tmp writes: REJECTED by BOGAN workspace rules for SCRIPT files
  (write to repo `.matilda/aec-sa1/` — gitignored, uncommitted); DOWNLOADS
  to /private/tmp/aec-sa1/ worked via curl shell commands.
- 2016 xlsx: `-I`/HEAD-style curl produces a 616-byte error page; plain GET
  then verify with `file` ("Microsoft Excel 2007+", 31,087,463 bytes).
