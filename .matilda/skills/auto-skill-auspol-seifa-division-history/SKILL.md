---
name: auspol-seifa-division-history
description: Sourcing census SEIFA scores at federal-division level for historical elections (1987→2028) — the ABS/AEC/APH product map (RR5-Att1 is the ONLY published 2001-census per-division score; the APH trilogy = CIB13/2000-01 1996×2000 + RP09rp02 2006×2006 + RP11rp01 2006×2009, all three PDFs committed 53831398), the ABS population-weighted derivation recipe, the census↔election pairing table, AEC deep-history WMTS (Electoral_1984_CED…) + 2026-10-23-24h DNS NODATA failure with multi-resolver ladder, plus the Wayback-CDX-vs-playback recovery trick for a 403-walled host. Mapped 2026-10-23 in .build/analysis/seifa-index/.
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
- **Parliamentary Library — THREE papers, series closed ~2010.** Recoverable
  **only** via Wayback (live aph.gov.au 403s every probes with a 411-byte
  body). PDF + pdftotext committed `53831398` at
  `.build/analysis/seifa-index/src/aph/`:
  | Citation | Census × Boundaries | Repo file |
  |---|---|---|
  | **Current Issues Brief no.13 2000–01** — Newman & Kopras, "Socioeconomic
    Indexes for Electoral Divisions (2000 Electoral Boundaries)",
    3/04/2001, ISSN 1440-2009 | 1996 × 2000 | `aph-01cib13.{pdf,txt}` |
  | **Research Paper no.2 2008–09** — Nelson, "Socio-economic
    indexes for electoral divisions: 2006 Census", 15/08/2008 | 2006 × 2006
    | `aph-09rp02.{pdf,txt}` (Wayback
    `…/binaries/library/pubs/rp/2008-09/09rp02.pdf`) |
  | **Research Paper no.1 2010–11** — Nelson, "Socio-economic
    indexes for **2009** electoral divisions: 2006 Census", 28/07/2010,
    ISSN 1834-9854 | 2006 × 2009 | `aph-11rp01.{pdf,txt}` +
    `aph-11rp01-page-2012.html` |
  **Verified-negative**: no APH paper for the **2001 census** exists — CIB
  13/00–01 is on the 1996 census ("…derived from the 1996 Census of
  Population and Housing … the 1999–2000 electoral redistributions"). AEC
  RR5 Att1 remains the sole published 2001-census per-division print.
  **Earlier "08xp01 = 2006 update" graffiti was wrong** — the 09rp02 (Aug
  2008) paper IS the 2006-census APH edition; 11rp01 is its 2009-boundary
  re-issue with explicit-2009 in the title, published after the
  2009-edition gazettal. No 2011-or-later edition found (re-verify before
  hard-reliance). Companion RP "Electorate Rankings: Census …" (Kopras) is
  a *different* product (census-variable rankings, not SEIFA) — citeable
  from `aph-01cib13.txt` line 445 fn3.
  **Method constant** across all three papers: population-weighted average
  of constituent CDs (= the AEC/ABS 2039.0 §2.2 recipe).
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
| 1998 | 1996 | 1996 | SEIFA-1996 CD + 1996-edition concordance | B |
| 2001/2004 | 2000/2003 | 2001 | **RR5-Att1 (2001 edition)** — no APH 2001-census paper exists (CIB13 is 1996-census); 2004 needs 2003-edition re-aggregation | A/B |
| 2007 | 2006 | 2006 | **APH RP09rp02 (2006×2006)** + ABS 2007-CED dist xlsx | A |
| 2010 | 2009 | 2006 | **APH RP11rp01 (2006×2009 re-issue)** | A |
| 2013/2016 | 2010/2016 | 2011/2016 | ABS CED Population/SA1 Distributions → weighted derivation | B |
| 2019 | 2018 | 2016 | ABS 2016 CED cubes VERIFIED on the **2016-edition** boundaries (`CED_CODE_2016`; Hunter/Whitlam/Burt/Fenner in, Charlton/Throsby out) — one edition behind the 2018 set the 2019 election used; changed seats (Cooper/Macnamara/Monash/Fraser, Bean, Spence/Port-Adelaide-out) need SA1-SEIFA-2016 + an SA1→CED(2018) allocation | B |
| 2022 | 2021 | 2021 | ABS 2021 CED SA1-distributions cube → mechanical | A/B |
| 2025 | 2025 | 2021 | SEIFA-2021 SA1 file + 2021-SA1→2025-CED weights (repo's own `map-census-2025-frame.mjs` re-aggregation pattern) | B |
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
