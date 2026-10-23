---
name: auspol-seifa-division-history
description: Sourcing census SEIFA scores at federal-division level for historical elections (1987→2028) — the ABS/AEC/APH product map (the ONLY published 2001-census per-division scores are AEC RR5-Att1 on the 2000/01-edition boundaries AND APH CIB 1/2004-05 on the 2003-edition ones; the APH FIVE-paper set = CIB4/1998-99 1996×1997-in-force (five-index era, served as HTML) + CIB13/2000-01 1996×2000 + CIB1/2004-05 2001×2003 + RP09rp02 2006×2006 + RP11rp01 2006×2009, first three PDFs committed 53831398, 05cib01 committed 9cfc5df0), the ABS population-weighted derivation recipe, the census↔election pairing table, AEC deep-history WMTS (Electoral_1984_CED…) + 2026-10-23-24h DNS NODATA failure with multi-resolver ladder, plus the Wayback-CDX-vs-playback recovery trick for a 403-walled host. Mapped 2026-10-23 in .build/analysis/seifa-index/; the IRSAD-only store is BUILT (2026-10-24) — derive-irsad.py + irsad-by-division.json cover every election 2001→2028 — and the IRSD/IER/IEO store landed the same day (extract-division-seifa.mjs + derive-division-seifa-abs.py → data/division-seifa-indexes.json), MERGED the same day on the user's call ("yeah, single file") into the ONE four-index store data/division-seifa-indexes.json, then extended to ELEVEN elections the same day with the 1998 block from the published CIB 4/1998-99 tables: 1998→2028, 1,650 rows {state, irsd, ier, ieo, irsad, via} (1998 rows irsd/ier/ieo-only, no irsad — the index did not exist before the 2001 census; the paper's Advantage composite is fixture-only as `adv`), irsad cells {value, rank 1=most advantaged, rankDis N+1−rank} plus an irsad-* provenance lane, spliced from the seifa-src/irsad-cells.json fixture derive-irsad.py emits (never re-derived); irsad-by-division.json stays the display store and splice fidelity to it is invariant 11 of test-division-seifa.mjs.
source: auto-skill
extracted_at: '2026-10-23T06:20:52.767Z'
---

# SEIFA × federal divisions — the authoritative product map (auspol-tracker)

Question answered 2026-10-23: **can census-based SEIFA scores be derived per
electoral division for elections back to the 1984–2010 era?** Yes — floor is
the **1986 Census** (first SEIFA edition, cat 2033.0.55.001 "data only",
released 24/11/1988, five-index variant series). Nothing earlier exists; do
not extrapolate backward. Full note: `.build/analysis/seifa-index/rr6-official-seifa-products.md`;
source-page caches in its `src/`, the 2019 pocketbook full-text in
`pocketbook/`, RR5 pdftotext in `cache/rr5.txt`.

## Inventory at a glance (the "are all four indexes there?" question)

Yes — flat answer, no caveat: since the 2026-10-24 merge (user call
"yeah, single file") **all four indexes per division per election live
in ONE store, `data/division-seifa-indexes.json`** and the same day's
1998 extension covers **11 elections 1998→2028, 1,650 rows** of
`{state, irsd, ier, ieo, irsad, via}` (1,352 shared rows byte-faithful
to the pre-merge store except the added irsad key; the 150-row 2028
forward block is irsad-only `{state, irsad, via}` — the other three
indexes have no 2025-boundary product; the 148-row 1998 block mirrors
that asymmetry the other way — `{state, irsd, ier, ieo, via}`, no
irsad, because the index did not exist before the 2001 census and its
paper's five-index-era Advantage composite is fixture-only as `adv`,
never mapped to irsad). The TWO-STORE SPLIT documented below as
"deliberate" lasted one day: the IRSAD derived store
`.build/analysis/seifa-index/irsad-by-division.json` is now the
splice's SOURCE OF TRUTH (via the name-canonicalised
`.build/analysis/seat-model/seifa-src/irsad-cells.json` fixture
derive-irsad.py emits beside it → extract-division-seifa.mjs's IRSAD
lane) and stays the display store; the merge is a splice, never a
re-derivation, and invariant 11 of test-division-seifa.mjs checks every
merged irsad value+rank back against the sibling rows. Original stores
merged to main 2026-10-24 (`5ecb9864`).

## Landed: the IRSAD store (2026-10-24)

The per-division IRSAD dataset for the seat-model W-history is **built and
stored**: `.build/analysis/seifa-index/derive-irsad.py` (pipeline + green
selftest) emits `.build/analysis/seifa-index/irsad-by-division.json` —
per-election row sets `{2001,2004,2007,2010,2013,2016: 150 · 2019,2022:
151 · 2025,2028: 150}` of
`{division, censusYear, editionInForce, irsad, rank, decile, quartile,
derivation, sourceProduct}`. Rank convention everywhere: **rank 1 = most
advantaged** (RR5's printed 1=most-disadvantaged is re-based on ingest;
`rankConvention` key in the JSON documents it). Recipes per election and
the empirically-pinned boundary name sets (2016-era = **150**, Fenner↔
Charlton swap, NO net gain; 2024 xlsx == 2025 xlsx name sets, Bullwinkel
era) are recorded in `rr6-official-seifa-products.md` §9 — read that before
touching the ladder. The re-fetch manifest for the Git-ignored
`.matilda/seifa-irsad-abs/` ABS caches is `docs/abs-input-sources.md`.
QA gates that failed loud during the build and now pass: per-store
boundary-name pins; 2011+2016 SA1-decile histogram recon vs the ABS CED
distributions cubes (EXACT, 150/0 twice); 2021-era national decile
population shares within 10%±0.5%.

## Landed: the IRSD/IER/IEO store (2026-10-24)

The published-source **three-index** lane's stores became the **single
four-index store** with the same day's irsad splice (see Inventory —
the "sibling store" split this section title-era described is one day
stale): `.build/analysis/seat-model/extract-division-seifa.mjs` (fixture
parsers + merge) consumes `.build/analysis/seat-model/derive-division-seifa-abs.py`
(ABS lanes) and emits `data/division-seifa-indexes.json` — elections
`{1998: 148 · 2001,2004,2007,2010,2013,2016: 150 · 2019,2022: 151 ·
2025: 150 · 2028: 150 irsad-only}` = **1,650 rows** of `{state, irsd,
ier, ieo, irsad, via}` (2028 rows `{state, irsad, via}` — no
2025-boundary product for the other three indexes; 1998 rows `{state,
irsd, ier, ieo, via}` — no IRSAD before the 2001 census), pinned by
`.build/analysis/seat-model/test-division-seifa.mjs` (11-election set,
name-exact vs division-classifications, rank permutations incl. both
irsad rank keys — every irsad check guarded `y !== "1998"`, 49 pinned
cells, provenance census-year pins solving
BOTH lanes per election — the irsad lane's keys are
`irsad-<derivation>-<census>`, `-e<edition>` suffixed where one census
backs two elections). The 1998 block's verification is the strongest in
the store (invariant 12): its same-census sibling 01cib13 (2000
boundaries) doubles as an EXACT-match oracle — the 66 divisions
untouched between the two editions (VIC 37 + QLD 27 + ACT 2) must print
identical values on all three shared indexes (ranks move — N=148 vs
150 universes). The "IRSAD stays deliberately absent" design this
section documented lasted one day: the irsad cells were spliced in
2026-10-24 from `seifa-src/irsad-cells.json` (names/state already
canonicalised there; a splice of the sibling store's committed display
rows, never a re-derivation — fidelity check = invariant 11). **Rank
convention DANGER: irsd/ier/ieo ranks are rank 1 = most DISadvantaged
(the APH
tapes' order, kept); the irsad cell carries BOTH —
`rank` 1 = most ADVANTAGED (the sibling display store's natural read,
== the descending-score recompute) and `rankDis` = N+1−rank, the store
convention. Pick deliberately per consumer.** Lane
map: **1998 = APH CIB no.4 1998–99 printed tables** (aph98cib04, 1996
census × the 1997-in-force boundaries — the series' one served-as-HTML
paper, committed as the raw Wayback `id_` capture `aph-98cib04.htm` and
folded into the shared line grammar by the extractor's `aphHtmlLines`;
five-index era — its Advantage composite rides the fixture as `adv` and
never reaches the store, consumers key per-paper index lists);
**2004 = APH CIB 1/2004-05 printed tables** (2001 census × 2003
boundaries — see the five-paper set below); 2007/2010 = APH printed
tables (scores+ranks verbatim);
**2001 = the ABS's own published 2001-CED cube** (`AUS_ced_s01.xls`,
2001C×2000/01-edition CEDs, scores printed / ranks computed, IRSAD column
verified 150/150 vs RR5-Att1 within printed rounding) — graded A after
all; **2013–2025 = ABS 2039.0 §2.2 weighted derivations** (SEIFA SA1
cubes × 2010/2016/2018-edition memberships for 2013–2019; SEIFA-2021 MB
cube × 2021/2024-edition MB allocations + 2074.0 MB counts for 2022/2025),
ranks computed from 3dp scores. QA: 2013+2016 SA1-decile histograms per
CED EXACT vs the ABS CED SA1-distributions cubes (3 indexes each);
national decile pop-shares sanity **10%±2** (±0.5 is unattainable — ABS
buckets SA1s by COUNT so IEO d1 sits at 8.8% of population in 2021).
**2004 = LANDED (2026-10-24)** — the 2004 election ran on the 2003-edition
boundaries (Bonython→Bonner, Burke→Gorton) and no official ABS/AEC
2001-CD→2003-CED concordance exists (ABS 2905.0 Vol 2 approximates
census-geographic CEDs at the 2001 census alone); the gap is filled by
APH CIB 1/2004-05, which did its own bespoke CD weighting on exactly the
2003-edition set (Bonner/Gorton in, Bonython/Burke out — verified 150).
**ABS header-drift trap (now confirmed, not speculation)**: ABS swapped
the IRSD/IRSAD lead-column order between SEIFA editions — 2011 SA1
summary leads IRSAD, 2016+2021 lead **IRSD** — so positional column reads
misread silently. derive-division-seifa-abs.py resolves every cube column
by header NAME because of this. The sibling `derive-irsad.py` had the
same disease until it was **fixed 2026-10-24**: its SA1 loaders +
distributions-recon sheet pick now resolve IRSAD by header caption
("Index of Relative Socio-economic Advantage and Disadvantage"), never
positionally; e2016/e2019/e2022/e2025/e2028 in
`irsad-by-division.json` were re-derived as true IRSAD that day
(e2013 and the printed lanes were always correct; the 2016 recon gate
had previously passed because it compared against the IRSD Table 1
pick — the compensating second defect). The distributions cube's per-index
order is Table1=IRSAD in 2011, Table1=IRSD in 2016 — same swap.

## Who publishes what (the load-bearing facts)

- **ABS never publishes a single SEIFA score per Commonwealth Electoral
  Division.** Per census it ships fine-geography index files:
  - 1986/1991/1996: cat 2033.0.55.001 data-only `.XLS` at CD etc., **5
    indexes** (Urban/Rural Index of Relative Socio-Economic Advantage + 4
    standard). 2001 reissue: CD/SLA/LGA/POA, **4 indexes** (IRSAD/IRSD/
    IER/IEO — the line that continues). 2006: same + SSC. 2011/2016/2021:
    SA1-centric (SA2/LGA/SSC/POA index cubes).
  - **"Commonwealth Electoral Division, Population Distributions" xlsx**
    exists for SEIFA **2006** (added post-release 29/05/2008 as a "2007 CED"
    illustrative tool), **2011**, **2016**, **2021** (27/04/2023 release);
    **2011+ also ship "CED, SA1 Distributions"** = the SA1→CED allocation
    file. Distributions are population-shares per national decile — the
    sanctioned input for deriving division scores, not scores themselves.
  - ABS GCP Census datapacks are issued per CED for 2011/2016/2021 (the
    seat-model W1 frame `extract-census-frame.mjs` already eats the 2021 one).
- **AEC**: Research Report 5 (Gerry Newman, Jan 2005, ISSN 0816-3154,
  `aec.gov.au/About_AEC/research/files/research_paper5.pdf`, pdftotext at
  `seifa-index/cache/rr5.txt`). **Attachment 1** = "Electoral Divisions
  ranked by the Index of Relative Socio-Economic Advantage/Disadvantage —
  2001 Electoral Boundaries, 2001 Census": all 150 divisions, values 882
  (Bonython) → 1204 (Bradfield/North Sydney), Low/Lower-middle/Upper-middle/
  High quartiles; same rows re-keyed per state in Attachment 3.
  Method (fn 1): **weighted average of constituent Census Collection
  Districts' scores using 2001 Census population counts** (ABS infopaper
  2039.0 §2.2) — *the canonical derivation recipe*.
  RR5 promised a rolling refresh "after each census OR redistribution …
  first review after the 2004 election" recorded on the internal RMANS —
  **that refresh was never published**: 2019 Electoral Pocketbook full-text
  carries only the four-class geographic rating (zero hits for
  SEIFA/socio/advantage/census) and every post-2007 VTR
  HouseDivisionClassifications page shows the same geography-only columns.
  Treat RR5-Att1 as the AEC's *only* public SEIFA-by-division table.
- **Parliamentary Library — FIVE papers, series closed ~2010.** Recoverable
  **only** via Wayback (live aph.gov.au 403s every probes with a 411-byte
  body). Three PDFs + pdftotext committed `53831398`, the fourth
  (05cib01, found 2026-10-24 at Wayback
  `…/web/20061208010454id_/http://www.aph.gov.au/library/pubs/cib/2004-05/05cib01.pdf`),
  and the fifth (98cib04 — served as HTML, committed as the raw Wayback
  `id_` capture the day it landed) all at
  `.build/analysis/seifa-index/src/aph/`:
  | Citation | Census × Boundaries | Repo file |
  |---|---|---|
  | **Current Issues Brief no.4 1998–99** — Newman & Kopras, "Socio-Economic
    Indexes for Electoral Divisions (1997 Electoral Boundaries)",
    8/12/1998 — **five-index era** (Advantage composite + IRSD/IER/IEO,
    no IRSAD) | 1996 × **1997 (in-force)** | `aph-98cib04.htm` (HTML) |
  | **Current Issues Brief no.13 2000–01** — Newman & Kopras, "Socioeconomic
    Indexes for Electoral Divisions (2000 Electoral Boundaries)",
    3/04/2001, ISSN 1440-2009 | 1996 × 2000 | `aph-01cib13.{pdf,txt}` |
  | **Current Issues Brief no.1 2004–05** — Newman & Kopras, "Socio-economic
    indexes for electoral divisions: 2001 Census (2003 boundaries)",
    12/07/2004, ISSN 1449-8472 | 2001 × 2003 | `aph-05cib01.{pdf,txt}` |
  | **Research Paper no.2 2008–09** — Nelson, "Socio-economic
    indexes for electoral divisions: 2006 Census", 15/08/2008 | 2006 × 2006
    | `aph-09rp02.{pdf,txt}` (Wayback
    `…/binaries/library/pubs/rp/2008-09/09rp02.pdf`) |
  | **Research Paper no.1 2010–11** — Nelson, "Socio-economic
    indexes for **2009** electoral divisions: 2006 Census", 28/07/2010,
    ISSN 1834-9854 | 2006 × 2009 | `aph-11rp01.{pdf,txt}` +
    `aph-11rp01-page-2012.html` |
  The 2001 census has **two** published per-division prints on different
  editions: AEC RR5-Att1 (2000/01 boundaries) and APH CIB 1/2004-05 (2003
  boundaries — the 2004 election's set). This skill previously claimed no
  APH 2001-census paper existed (verified-negative, wrong): CIB 13/00–01
  is 1996-census but its successor 05cib01 was found on 2026-10-24. BOTH
  stores' 2004 lanes are the CIB (landed 2026-10-24, same day): the
  3-index store carries its irsd/ier/ieo scores+ranks, and the IRSAD
  sibling re-derives e2004 from its IRSAD alpha table (printed rank 73
  disadvantaged-first re-bases to store rank 78 advantaged-first —
  re-base formula: store rank = 150 − printed + 1 —
  derive-irsad.py parse_aph05cib01, ranked re-print kept as the
  per-division cross-check; mind its thousands-separated four-figure
  scores, 1,059.3-style — a naive \d{3}\.\d silently eats the tail, so
  score regexes need (\d{1,2},\d{3}\.\d|\d{3}\.\d)).
  CIB-ranked-table traps that cost a debug cycle in both parser lanes:
  scores print WITH trailing whitespace ("\d+\.\d $" matches only via the
  ungreedy line slice — expect SOME rows to drop out if you tighten to a
  header-shaped exemption), and the ranked table's monotonicity gate is
  non-DEcreasing by score (rank 1 = most DISadvantaged = lowest score,
  ascending rank → ascending score; an "assert a < b" direction check
  written the advantaged-first way trips on the adjacent-tie back-to-back
  like Adelaide 987.9 / Lingiari 987.0 pair).
  **Earlier "08xp01 = 2006 update" graffiti was wrong** — the 09rp02 (Aug
  2008) paper IS the 2006-census APH edition; 11rp01 is its 2009-boundary
  re-issue with explicit-2009 in the title, published after the
  2009-edition gazettal. No 2011-or-later edition found (re-verify before
  hard-reliance). Companion RP "Electorate Rankings: Census …" (Kopras) is
  a *different* product (census-variable rankings, not SEIFA) — citeable
  from `aph-01cib13.txt` line 445 fn3.
  **Method constant** across all five papers: population-weighted average
  of constituent CDs (= the AEC/ABS 2039.0 §2.2 recipe) — the APH did its
  own bespoke 2001-CD weighting onto the 2003 boundaries for 05cib01, which
  is precisely the concordance no ABS/AEC product ever published.
- Academic practice (Keele/Jupp-class papers) does the same weighted-CD
  aggregation bespoke. ABS Customised Data Services will commission
  named-geography SEIFA outputs.

## Census ↔ election pairing (the SEIFA side of the rr5 edition atlas)

Attach the census whose data was available *at each election* (not the
nearest by mere distance — check direction):

| Election | Edition | SEIFA census to use | Best division-level source |
|---|---|---|---|
| 1987 | 1984 | 1986 | old-catalogue 1986 CED profile CDs (Unlodged 12N29.3M block) + CD cubes | C |
| 1990/1993 | 1987/1990 | 1986→1991 | CD cubes + era concordances | C |
| 1996 | 1993 | 1996 (6 wk after — use 1991? no: 1996 census too late; **1991**) | CD cubes | C |
| 1998 | 1997 (in force) | 1996 | **LANDED: APH CIB no.4 1998–99** (aph98cib04; five-index era — Advantage composite fixture-only as `adv`; SEIFA-1996 CD cube `dl/seifa1996-australia.zip` kept as the grade-B fallback, unparsed) | A |
| 2001 | 2000 | 2001 | **2001 LANDED: ABS's own AUS_ced_s01.xls cube** (2000/01-edition CEDs) + AEC RR5-Att1 (same set, printed IRSAD); CIB13 is 1996-census so no APH paper covers this row | A |
| 2004 | 2003 | 2001 | **LANDED: APH CIB 1/2004-05** (2001 census × 2003-edition CEDs, the APH's own bespoke CD weighting — no ABS/AEC 2001-CD→2003-CED concordance exists) | A |
| 2007 | 2006 | 2006 | **APH RP09rp02 (2006×2006)** + ABS 2007-CED dist xlsx — LANDED | A |
| 2010 | 2009 | 2006 | **APH RP11rp01 (2006×2009 re-issue)** — LANDED | A |
| 2013/2016 | 2010/2016 | 2011/2016 | ABS CED Population/SA1 Distributions → weighted derivation — LANDED (SA1 cubes × CED memberships) | B |
| 2019 | 2018 | 2016 | ABS 2016 CED cubes VERIFIED on the **2016-edition** boundaries (`CED_CODE_2016`; Hunter/Whitlam/Burt/Fenner in, Charlton/Throsby out) — one edition behind the 2018 set the 2019 election used; changed seats (Cooper/Macnamara/Monash/Fraser, Bean, Spence/Port-Adelaide-out) landed via SA1-SEIFA-2016 × SA1→CED(2018) allocation (1270.0.55.003 July 2018 zip) | B ✓ |
| 2022 | 2021 | 2021 | SEIFA-2021 at MB level × CED_2021 allocation (`ced2021.xlsx`) + 2074.0 MB counts × MB→SA1 keys — LANDED | A/B ✓ |
| 2025 | 2025 | 2021 | Same MB recipe × CED_2024 allocation (`ced2024.xlsx` == ced2025 name sets) — LANDED | B ✓ |
| 2028 | post-2025 gazettal | 2021 (SEIFA-2026 lands ~2029 — too late) | same recipe on the new edition | B |

Grades: **A** published per-division score exists; **B** mechanical
derivation from ABS cubes + division maps; **C** archive/catalogue work
(unlodged CD era).

## Cross-era comparability (bake into every export)

1. **Index count changed**: 1986–1996 censuses = five indexes (urban/rural
   advantage variants), 2001+ = four (IRSAD/IRSD/IER/IEO). Cross-time
   comparisons must use **ranks/deciles**, never raw scores — index
   definitions are re-derived per census (PCA weights recommputed).
2. A division-level SEIFA is an **average of area scores**, not an average
   of people — record `editionInForce` + `censusYear` in any store's
   provenance (cf. division-classifications.json's provenance pattern).
3. SEIFA is the ABS's recommended area-level proxy precisely *because* it
   is stable against the ABS-thin small-cell problem — but the division
   aggregate inherits census-era geography mismatches (e.g. 2003 edition
   on 2001-census CDs is a concordance job, not a lookup).

## Boundary geometry: AEC deep-history WMTS + the DNS outage

`map-api.aec.gov.au` (demo mapproxy at `/mapproxy/service/demo/…/wmts`)
serves ~60 layers including **Electoral_1984_CED … Electoral_2010_CED** plus
state-fragment layers for every partial-gazettal era (Electoral_2011_CED …,
`Region_2011_SEIFA`, **`Region_SA_2011_SEIFA`** — SA1-with-SEIFA boundaries.
So boundary geometry back to the **1984 edition** is live-fetched, no
Wayback needed. Probe recipe: `GET /api/map-layers` then per-layer
`/wmts?request=GetCapabilities`, tile smoke-test z=3 r=0 c=0, record
`TileMatrixSet` per layer (gridsets.json).

**2026-10-23 ~17:10 AEDT: the whole host went globally NODATA** (no A
record at 8.8.8.8 / 1.1.1.1 / cloudflare-dns.com DoH; SOA still answers;
`virtualtour.aec.gov.au` also down — apex domain resolve failure). Layers
were responding minutes before. Re-checks 17:35 and 18:22 same day: still
dead (18:22: even SOA empty). Assume transient; **retry ladder before
any dead-end verdict**: dscacheutil → public resolvers → DoH; note the
outage window in the research log (rr6's open items, item 4) and re-pull
caps into `.build/analysis/seifa-index/src/mapproxy-caps/` (dir created)
when back.

## Probe-environment traps (all hit this session)

- **AEC soft-200**: any non-existent aec.gov.au URL returns HTTP 200 with a
  **55,488-byte text/html sentinel**. Verify downloads by file type/size
  (pocketbook real PDF ≈ 5.9 MB pdf-1.7; speculated `archived/2016-electoral-pocketbook.pdf` hit the sentinel) — the
  aec-division-classifications skill carries the same warning for
  pocket-book probing; calibrate nonsense-URL size once per host.
- ABS `latest-release` URL style is live and complete for 2021 (quotes of
  the CED xlsx names are in `abs-seifa-2021-release.html`); the
  `data-download` aiab path 301s — use the root release page.
- ABS **subscriber.nsf cube downloads double-redirect**: abs.gov.au
  `/ausstats/subscriber.nsf/log?openagent&…` → 302 ausstats.abs.gov.au
  same path → 302 `subscriber.nsf/0/<ID>/$File/<name>.xls` → 200. Must
  `curl -L` (bare curl writes a zero-byte file and `file` says "empty").
  2016 cubes are real OLE2 .xls — read with python xlrd (2.x still reads
  the old binary format).
- ABS 2033.0.55.001 **archive "data only" pages** (1986/1991/1996) expose
  the `.XLS` inventory text but the file links are JS-rendered —
  the "Document Selection … PrintAllGenerateJSON" flow; fetch the release
  **details page** (`AUSSTATS/abs@.nsf/DetailsPage/2033.0.55.001<year>?OpenDocument`)
  for the datacube list (that URL shape works for 2011/2016 too — 50 KB of
  plain HTML enumerating every cube, incl. the CED ones).
- `pdftotext -layout` RR5 is clean except `\f` page-break prefixes on some
  rows (Wentworth/Groom) — strip them before row-count checks (same gotcha
  as the RR5 att3 fixtures in aec-division-classifications).
- AEC pocket-book *editions* go back further than web PDFs: live aec.gov.au
  index links 2011/2013/2016/2019 only; pre-2011 is print/ANU-archive
  territory. None carry SEIFA regardless (2019 checked top-to-bottom).
- Home-tree `find` sweeps time out — always scope finds to the project dir.

## Output contract for a W-history SEIFA layer

Every exported row: `{division, censusYear, editionInForce, irsad,
rank/decile/quartile, derivation: 'published'|'weighted',
sourceProduct}` — **IRSAD ONLY as the covariate (user call 2026-10-23)**:
it is the index AEC RR5-Att1 prints and captures both tails; sisters
IRSD/IER/IEO ship in the same ABS cubes if a later workstream wants them.
Rank sets stay the only cross-census-comparable field; note in any consumer
that 1986/1991/1996 ranks are five-index-era ranks.
