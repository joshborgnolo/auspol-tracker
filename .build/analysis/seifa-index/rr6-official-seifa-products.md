# rr6 — SEIFA × federal divisions: the authoritative product map (2026-10-23)

Companion to `cache/rr5.txt` (AEC Research Report 5 pdftotext, the four-class
classification system paper). This note answers the W-history question: **how
far back can census-based SEIFA-by-division figures be derived, and from where?**

## 1. Bottom line

- **The absolute floor is the 1986 Census.** SEIFA 1986 (cat 2033.0.55.001,
  data-only release 24/11/1988) is the first SEIFA edition. There is no
  census-based SEIFA before it, so elections before 1987 have no SEIFA-era map
  at all. Do not hand-extrapolate backward.
- **Ready-made per-division SEIFA scores exist for: 2001 census** (AEC Research
  Report 5 Attachment 1 — 150 rows, 2001 boundary set, four quartile bands,
  full index values — text already committed at `.build/analysis/seat-model/…`
  via cache/rr5.txt) **and 2001 + 2006 censuses** (Parliamentary Library
  `researchers.xls` series — see §4). Nothing later from either body (§6).
- **From the 2006 census onward the ABS itself ships per-CED products**:
  "Commonwealth Electoral Division, Population Distributions" and (2011+)
  "CED, SA1 Distributions" xlsx for SEIFA 2006 (as 2007 tables), 2011, 2016,
  2021 (§2). These are per-division *distributions* (population share per
  national decile) plus the SA1→CED allocation — not single scores — but the
  AEC/APH weighting method (population-weighted mean of constituent CD/SA1
  scores, ABS info paper 2039.0 §2.2) turns them into scores mechanically.
- **1987–1998 elections** sit in the middle band: no published per-division
  scores, but every input exists (CD-level SEIFA each census from 1986;
  contemporary CED census profiles from the ABS's own census-by-division
  output; AEC boundary geometry back to the 1984 edition via the AEC map
  proxy, §5). Effort is real but bounded; see §7.

## 2. ABS official SEIFA products, per census (verified this session)

Source pages cached under `.build/analysis/seifa-index/src/`:

| Census | Catalogue | Released | Index files (fine geogs) | Per-CED product |
|---|---|---|---|---|
| 1986 | 2033.0.55.001 "data only" | 24/11/1988 | CD etc., .XLS, **5 indexes** (Urban/Rural variants) | none |
| 1991 | 2033.0.55.001 "data only" | 24/11/1993 | CD etc., .XLS, 5 indexes | none |
| 1996 | 2033.0.55.001 "data only" | 24/11/1998 | CD etc., .XLS, 5 indexes | none |
| 2001 | 2033.0.55.001 "data cube only" (reissue 05/10/2006) | 2003/2006 | CD, SLA, LGA, POA — **4 indexes** | none |
| 2006 | 2033.0.55.001 | 26/03/2008 | CD, SLA, LGA, POA (+SSC added 29/05/2008) | **"2007 Commonwealth Electoral Divisions" population-distributions tables** (added 29/05/2008, "illustrative tools") |
| 2011 | 2033.0.55.001 | (DetailsPage fetched) | SA1/SA2/SLA/LGA/SSC/POA per-index xlsx | **CED Population Distributions + CED SA1 Distributions** |
| 2016 | 2033.0.55.001 | 27/03/2018 | SA1/SA2/LGA/SSC/POA per-index xlsx | **CED Population Distributions + CED SA1 Distributions** |
| 2021 | abs.gov.au latest-release | 27/04/2023 | SA1 (+SA2/SA3/SA4? no — SA1, SA2, LGA, Suburb, POA, SED index cubes) | **CED Population Distributions xlsx (267 KB) + CED SA1 Distributions xlsx (698 KB)** — both quote-checked from `abs-seifa-2021-release.html` |

Notes:
- The four indexes from 2001 on: IRSAD, IRSD, IER, IEO. 1986–1996 editions
  carried FIVE (Urban/Rural Index of Relative Socio-Economic Advantage
  variants) — comparability across eras must go through ranks/deciles, never
  raw scores; the ABS itself recomputes index definitions each census
  (technical paper 2033.0.55.002/2039.0.55.001 per edition).
- ABS never publishes a single SEIFA score per Commonwealth Electoral
  Division. The CED products are distributions ("the distribution of people
  … usual residents on Census Night" across national deciles).
- ABS Census GCP datapacks are also issued **per CED** for 2011/2016/2021 —
  the repo's own W1 frame (`.build/analysis/seat-model/extract-census-frame.mjs`
  → `data/census-2021-divisions.json`) already consumes the 2021 CED datapack.

## 3. AEC's own SEIFA-by-division: one table, never refreshed publicly

- **AEC Research Report 5 (Gerry Newman, Jan 2005, ISSN 0816-3154)** —
  `https://www.aec.gov.au/About_AEC/research/files/research_paper5.pdf`,
  pdftotext committed at `cache/rr5.txt` of the seat-model analysis dir.
  Attachment 1 = "Electoral Divisions ranked by the Index of Relative
  Socio-Economic Advantage/Disadvantage — **2001 Electoral Boundaries, 2001
  Census**", 150 divisions, index values 882 (Bonython) → 1204 (Bradfield/
  North Sydney), bucketed Low / Lower middle / Upper middle / High.
  Method: "the weighted average, using population counts from the 2001 Census
  across all Census Collection Districts for the Division" (footnote 1,
  citing ABS 2039.0 §2.2). Attachment 3 carries the same rows with
  SES band labelled per state.
- RR5 promises a rolling review "after each population census OR after each
  redistribution … the first review … following the 2004 federal election",
  recorded on the internal "Roll Management System (RMANS)".
- **That refresh was never published.** Checked 2026-10-23: the 2019
  Electoral Pocketbook (full text, `pocketbook/pb2019.txt`) carries only the
  four-class geographic classification + seat status + area per division —
  zero hits for SEIFA/socio/advantage/census. The post-2007 VTR
  HouseDivisionClassifications pages likewise show only the geographic rating
  (see skill aec-division-classifications). Treat RR5 Attachment 1 as **the
  AEC's only public SEIFA-by-division table**. (Residual uncertainty: an
  unpublished RMANS refresh could exist internally; FOI-scale question, not
  web research.)

## 4. Parliamentary Library series — THREE papers, series closed ~2010

PDFs + pdftotext committed under `.build/analysis/seifa-index/src/aph/`:

| Citation | Census | Boundaries | File |
|---|---|---|---|
| **Current Issues Brief no.13 2000–01** — Gerard Newman & Andrew Kopras, "Socioeconomic Indexes for Electoral Divisions (2000 Electoral Boundaries)", 3 Apr 2001, ISSN 1440-2009 | **1996** | 2000 | `aph-01cib13.pdf` / `.txt` |
| **Research Paper no.2 2008–09** — Paul Nelson, "Socio-economic indexes for electoral divisions: 2006 Census", 15 Aug 2008 | **2006** | 2006 | `aph-09rp02.pdf` / `.txt` |
| **Research Paper no.1 2010–11** — Paul Nelson, "Socio-economic indexes for 2009 electoral divisions: 2006 Census", 28 Jul 2010, ISSN 1834-9854 | **2006** | 2009 | `aph-11rp01.pdf` / `.txt` + `aph-11rp01-page-2012.html` (pub page) |

Findings verified by content this session:
- **No APH paper for the 2001 census exists.** The CIB 13/00–01 paper (pre-dating 2001 election by 7 months) is explicitly "derived from the **1996** Census of Population and Housing" (p1: "This paper provides data on four summary indexes, derived from the 1996 Census of Population and Housing" + "the effects of the 1999–2000 electoral redistributions"). The repo's earlier "08rp01 = 2001 census" graffiti is wrong; AEC RR5 Attachment 1 remains the sole 2001-census per-division score source.
- The 09rp02 "…for electoral divisions: 2006 Census" edition is on the **2006 boundary set** (the election that was current at publication; the 2009 boundaries were promulgated mid-2009, after its Aug 2008 date). Its title omits a boundary year deliberately; 11rp01 carries the explicit "2009" in its title to mark the re-issue.
- The 11rp01 re-issue paper cites the same Kopras "Electorate Rankings: Census 1996 (2000 Electoral Boundaries)" companion RP its 2001 sibling cites — that companion (census-variable rankings, not SEIFA) is out of scope for the SEIFA ladder but is referenced in `aph-01cib13.txt` line 445.
- No 2011/2016/2021 edition of the series was found — series ends with 11rp01. The library's *census-rankings* line (RP no. 18 2009–10 "Electoral division rankings: Census 2006 (2009 boundaries)") continues separately and is a different product.

Method note from 01cib13/09rp02/11rp01 §2: all three papers use the same population-weighted CD→CED aggregation the AEC/ABS guidance recommends, so cross-edition ranks are safe to compare within the four-index (2001-onwards) era and by rank/decile only against 1986–1996 five-index editions (§8).

## 5. Boundary geometry for arbitrary editions (AEC map proxy)

- `map-api.aec.gov.au` WMTS demo instance lists ~60 layers incl.
  `Electoral_1984_CED`, `Electoral_1987_CED_*`, `Electoral_1993_CED_*`,
  `Electoral_1994_CED_*`, `Electoral_1996_CED_*`, `Electoral_1998_CED_*`,
  `Electoral_2000_CED_*`, `Electoral_2002_CED_*`, `Electoral_2003_CED_*`,
  `Electoral_2004_CED`, state-fragment variants for every partial-era
  gazettal; plus `Region_2011_SEIFA` and `Region_SA_2011_SEIFA` (a 2011
  SA1-level SEIFA choropleth the EC serves itself). Discovered 2026-10-23
  am; deep-history probed OK early afternoon.
- **DNS outage note**: as of ~17:10 local 2026-10-23 the hostname returns
  NODATA globally (verified via 8.8.8.8, 1.1.1.1, cloudflare-dns.com DoH —
  SOA present, no A record). Re-checked ~17:35 with dig via 8.8.8.8/1.1.1.1/
  9.9.9.9 + DoH cloudflare-dns.com & dns.google — identical: `SOA
  ns-1628.awsdns-11.co.uk.` only, zero A/AAAA/CNAME. Persistent DNS-side
  removal rather than a blip; would re-check next session before declaring
  the mapproxy surface permanently changed. Earlier same-day it served the
  full capabilities documents.
- Authoritative edition/in-force schedule 1984→2025 + the AE ledger is in
  `cache/rr5.txt` successor note (the rr5 summary file) — 13 editions:
  1984/1987/1990/1993/1996/2000/2003/2006/2009/2010/2016/2018/2021/2025
  (14 blocks with the 2016-era ACT/NSW re-gazette merged).

## 6. Who else has done the division-level aggregation

- AEC: RR5 att1 only (2001×2001).
- Parliamentary Library: 2001 census + 2006 census files, plus a 2009-
  boundary re-issue of the 2006 file (§4).
- ABS itself: per-CED distributions 2006/2011/2016/2021 (§2), which are the
  sanctioned input for the same derivation; ABS Customised Data Services will
  also produce named-geography SEIFA outputs on commission.
- Academic practice (Keele/Jupp-class papers): CD→CED population-weighted
  aggregation of the public CD files — i.e. the same recipe, done bespoke.

## 7. Per-election source ladder (SEIFA side)

Census ↔ election proximity decides which SEIFA census to attach. Editions
from the rr5 atlas schedule. Effort grades: **A** published per-division
figure exists; **B** mechanical aggregation from official ABS/AEC files
(same-geometry inputs); **C** spatial/archive work (weights files must be
sourced from ABS census geography units + boundary polygons).

| Election | Edition | Nearest SEIFA census | Best per-division source | Grade |
|---|---|---|---|---|
| 1987 | 1984 | 1986 (13 mo before) | SEIFA 1986 CD files + 1986 CED census concordances (ABS Unlodged CD catalogue lists 1986 "Commonwealth Electoral Division" profiles, e.g. 12N29.3M block) | C |
| 1990 | 1987 | 1986 (back) / 1991 (fwd 16 mo) | same as 1987, or 1991 CD + concordances | C |
| 1993 | 1990 | 1991 (19 mo before) | SEIFA 1991 CD + concordances for 1990 edition | C |
| 1996 | 1993 | 1996 (5 mo after) | SEIFA 1996 CD + concordances for 1993 edition | C/B |
| 1998 | 1996 | 1996 (~2 y before) | SEIFA 1996 CD + 1996-edition concordances | B |
| 2001 | 2000 | 2001 (3 mo before) | **AEC RR5 att1 (2001×2001 — printed)** + APH CIB 13/00–01 (1996 census on the SAME 2000 boundaries — the direct fallback) | **A** |
| 2004 | 2003 | 2001 (~3.2 y before) | AEC RR5 att1 target is the 2001-boundary set — one edition behind. For exact 2003-edition SEIFA, derive from ABS 2001 CD cube + 2003-edition concordance (open item 3 **no longer blocks** the 2001/2010 rows; only this one pre-2004 row) | A/B |
| 2007 | 2006 | 2006 (15 mo before) | APH 2006 update + ABS 2007-CED population distributions xlsx | **A** |
| 2010 | 2009 | 2006 (4 y before) | **APH RP 1/2010–11 (2006 census × 2009 divisions)** | **A** |
| 2013 | 2010 | 2011 (23 mo before) | ABS SEIFA 2011 CED population/SA1 distributions → weighted derivation | B |
| 2016 | 2016 | 2016 (6 wk after) | ABS SEIFA 2016 CED population/SA1 distributions → weighted derivation | B |
| 2019 | 2018 | 2016 (~2.7 y before) | ABS SEIFA 2016 CED dist (verify which boundary vintage the xlsx uses) | B |
| 2022 | 2021 | 2021 (9 mo before) | ABS SEIFA 2021 CED distributions + SA1-distributions (mechanical) | **A/B** |
| 2025 | 2025 | 2021 (~3.7 y before) | SEIFA 2021 SA1 file + 2021-SA1→2025-CED weights (repo's own `map-census-2025-frame.mjs` pattern) | B |
| 2028 | next gazettal | 2021 (SEIFA 2026 lands ~2029, too late) | SEIFA 2021 SA1 + new-edition weights | B |

## 8. Warnings that sit on every exported number

- Index recomputation: 1986/1991/1996 five-index systems vs 2001-onwards
  four indexes — cross-time comparisons must be rank/decile based.
- SEIFA is AREA-derived (PCA of census variables): an electorate score is an
  aggregate of area scores, not of individual voters; the ABS technical
  paper's aggregation guidance (2039.0 §2.2) is the canonical method.
- Census vintage vs edition vintage always differs by months-to-years;
  record both in provenance (`editionInForce`, `censusYear`).

## Open items (if a workstream proceeds)

1. ~~Fetch + commit the APH files~~ — **DONE 2026-10-23**: three-paper set
   (`aph-01cib13.{pdf,txt}` 1996×2000; `aph-09rp02.{pdf,txt}` 2006×2006;
   `aph-11rp01.{pdf,txt}` 2006×2009) committed under `src/aph/`. No
   2001-census APH edition exists.
2. Verify which boundary edition the ABS 2016 CED distributions xlsx targets
   (the 2016 publication could be on the 2013 or the 2016 set — its release
   27/03/2018 postdates the 2016-edition gazettal, so likely 2016; still
   worth one xlsx download to confirm).
3. For pre-2001-census works (1987–1998 elections), source ABS correspondence
   files (CD→CED) per census from ABS catalogue 1217/2900-era products or
   the ABS Unlodged-CD catalogue (research-visit territory).
4. Re-check map-api.aec.gov.au DNS recovery; when back, pull the GetCapabilities
   XML for every Electoral_* layer into `src/mapproxy-caps/` (the directory is
   created and waiting).
