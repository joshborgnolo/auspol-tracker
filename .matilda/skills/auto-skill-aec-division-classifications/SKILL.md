---
name: aec-division-classifications
description: AEC per-division demographic classification (Inner Metropolitan / Outer Metropolitan / Provincial / Rural) — the VTR HouseDivisionClassifications product end-to-end for ELEVEN election blocks (recovered-on-page 1996 + 1998 from the AEC's own whole-chamber "Divisional Classifications" table pages via Wayback, canonical-on-page 2001 from the Wayback-harvested 2001-epoch profile pages + RR5 gap-fill of its 3 holes, canonical-on-page 2004 from the LIVE 2004 profile pages, plus live VTR 2007–2025; two markup eras: 2016+ headers="c*" self-label cells vs 2007/2010/2013 positional 7/8-cell rows), chamber-count invariants, the repo's extractor + fixtures + test, and the geography-stratification use it was built for. NOTE 2026-10-22: the supposed 2004 gap is CLOSED — live per-division profile pages under aec.gov.au/Elections/federal_elections/2004/profiles/ carried the rating; the 150-row harvest landed as a committed canonical block. RR5 att2's FROM column records the 2004-epoch print, not 2001's.
source: auto-skill
extracted_at: '2026-10-22T06:00:00.000Z'
---

# AEC division classifications (demographic rating per division)

The AEC publishes one row per House division per election: a **demographic
classification** (Inner Metropolitan / Outer Metropolitan / Provincial /
Rural), enrolment, previous/current seat status (Marginal <56%, Fairly safe
56–60%, Safe >60%) and winning/previous parties. This is the AEC's own
geography rating — use it whenever "regional/metro" must be a covariate
defined by the election authority rather than improvised from census cells.

AEC definitions (from the page's own notes):
- **Inner Metropolitan** — capital-city, well-established built-up suburbs
- **Outer Metropolitan** — capital-city, large areas of recent suburban expansion
- **Provincial** — outside capital cities, majority of enrolment in major
  provincial cities
- **Rural** — outside capital cities, no majority of enrolment in major
  provincial cities

## URL + table anatomy (two markup eras, verified 2007–2025)

```
https://results.aec.gov.au/<event>/Website/HouseDivisionClassifications-<event>-<STATE>.htm
https://results.aec.gov.au/<event>/Website/HouseDivisionClassifications-<event>-NAT.htm   (national page also exists)
```

Events: 2007=13745, 2010=15508, 2013=17496, 2016=20499, 2019=24310,
2022=27966, 2025=31496. States: NSW VIC QLD SA WA TAS NT ACT (8 GETs per
election, 56 total for all seven; ~60KB pages).

**Era 2016+** — parse per `<tr>` row; cells self-label via `headers=`:
- `cDiv` — division name (inside `<a href="HouseDivisionPage-<event>-<divID>.htm">`)
- `cStt` — state, `cEnr` — enrolment, `cDem` — **the classification**
- `cPP`/`cPSS` — previous party / previous seat status
- `cScss`/`cSS` — successful party / current seat status

**Era 2007/2010/2013** — the pages self-label NOTHING: zero `headers=`
attributes anywhere, uppercase `<TR class="rownorm">`/`<TD>`, positional
columns. Split on `<tr`, keep rows of exactly 7 or 8 `<td>`s, and require a
`HouseDivisionFirstPrefs-<ev>-<id>.htm` (or `-Page-`) anchor in the first
cell as the data-row discriminator:
- **7 cells (2007/2010)** — div, enr, dem, prevParty, prevStatus, party,
  status. **No state column** — the row's state is the state page it was
  fetched from.
- **8 cells (2013)** — div, STATE, enr, dem, prevParty, prevStatus, party,
  status (state is column 2).

Two legacy-era surprises that must NOT trip invariants:
- New divisions carry previous-party cells anyway (Flynn 2007 previous =
  "The Nationals"; Wright 2010 previous = "Liberal National Party of
  Queensland") — "previous.party non-empty" holds across eras.
- Division names are ERA names (pre-2016-17 renames): Denison not Clark,
  Throsby not Whitlam, Batman; Fremantle-era sets. Map renames only at
  join time, never in the store.

The 2022 W2 run also found a 2016-era mirror at
`https://www.aec.gov.au/Elections/federal_elections/2016/profiles/`, but the
VTR pages are cleaner and uniform — prefer them.

## Chamber-count invariants (pin every extraction)

| Election | event | divisions |
|---|---|---|
| 1996 | (recovered Wayback whole-chamber classification page) | 148 |
| 1998 | (recovered Wayback whole-chamber classification page) | 148 |
| 2001 | (v2 Wayback pages + 3 RR5 fills — no VTR event) | 150 |
| 2004 | (live per-division profile pages — no VTR event) | 150 |
| 2007 | 13745 | 150 |
| 2010 | 15508 | 150 |
| 2013 | 17496 | 150 |
| 2016 | 20499 | 150 |
| 2019 | 24310 | 151 (added Lingiari->Fraser etc.) |
| 2022 | 27966 | 151 |
| 2025 | 31496 | 150 |

Every division must carry exactly one of the four class labels and a known
state; a parse that yields any other count or label has drifted — fail loud.

Boundary pins (all live-verified): 2025 — Clark Inner Metro, Braddon Rural,
Franklin Outer Metro, Sydney Inner Metro, Maranoa Rural, **La Trobe
Provincial** (not metro), Lyons Rural. Legacy era — 2007: Lyons Rural,
Throsby Provincial, McEwen Rural, Aston Outer, Adelaide Inner; 2010:
Wentworth Inner, Durack Rural, Lyons Rural; 2013: Denison Inner, Throsby
Provincial, Lyons Rural, Aston Outer. (Lyons and Aston pin the same class
across eras — clean anchors.) Recovered-on-page era — 1996: Northern
Territory Rural (CLP), Namadgi Inner Metro, Aston Outer, Gwydir Rural,
Fisher Rural, Pearce Outer Metro; 1998: Northern Territory Rural (ALP —
the 1998-election flip), Blair Rural, Pearce Provincial, Fisher
Provincial, Aston Outer Metro, Macarthur Rural.

Cross-era reclass drift is small and listable: 96→98 two (Fisher R→P,
Pearce OM→P); 98→01 six (Brand P→OM, Cunningham P→OM, Macarthur R→OM,
Maribyrnong OM→IM, Pearce P→R, Throsby P→IM — **exactly the inverse of
the 2001→04 set minus Fisher**: the v2 2001 profile-page layer is a
transitional print nearest the 1998 Pocket-Book epoch, and Fisher keeps
moving Provincial through 2001 before returning to its 1996 Rural print
at 2004); 01→04 seven (Brand OM→P,
Cunningham OM→P, Throsby IM→P, Fisher P→R, Macarthur OM→R, Maribyrnong
IM→OM, Pearce R→OM); 04→07 four (Hinkler R→P, Longman R→P, Macarthur
R→OM — flipping back within three years — Macquarie OM→P); 07→10 Forde
R→OM, Brand P→OM; 10→13 five (Casey, Hotham, Jagajaga, Maribyrnong,
Blair); 13→16 Hume+Paterson; 16→19 Cowper R→Provincial + Griffith
OM→IM; 19→22 four (Fraser, Jagajaga, La Trobe, Cowan); 22→25 Hume.

The test ALSO pins the 2001 on-page layer: Gwydir Rural, Burke Rural,
Cowper Rural, Griffith Outer Metropolitan (v2 agrees with RR5's att2 FROM
column there); **Pearce Rural** (the v2 page's token — RR5's att2 FROM
says Outer Metropolitan; one of four pinned page-vs-paper divergences —
**reframed 2026-10-22: those four divergences are four of the seven REAL
2001→2004 on-page reclassifications; att2's FROM records the 2004-epoch
print, 15/15 comparable rows** — see the 2004 section);
Macarthur/Canning Outer Metropolitan (the normalised era tokens); and the
three RR5 gap fills Bradfield/Maribyrnong Inner Metropolitan, Wide Bay
Rural. The 2001 distribution is locked (Inner 44 / Outer 45 / Provincial
16 / Rural 45) and `deltas['2001']` in the JSON is exactly the 20
v2-vs-att3 divergences with the era tokens preserved. And the 2004
live-page layer is pinned too: Bonner/Gorton Outer Metropolitan (the
2003-04 redistribution creations), Hunter/Gwydir/Wide Bay Rural,
Macarthur Rural, Maribyrnong/Pearce Outer Metropolitan, Solomon Inner
Metropolitan, with distribution locked at Inner 42 / Outer 45 /
Provincial 18 / Rural 45.

## The 1998-epoch on-page rating harvest (B-lane, 2026-10-21 → 148-row TSV)

Beyond RR5-derivation there is a SECOND source for the 2001 epoch: the
AEC's own division profile pages as Wayback captured them
Nov 2001 – Apr 2002. Their page bodies still showed the
"3 October 1998 Election" Seat Status block plus a
**Demographic Rating** token — i.e. the rating the AEC physically
displayed at that epoch, as opposed to RR5's later SES re-derivation.
Harvest kit (committed, `.build/analysis/seat-model/divclass-src/2001/`):
- **Enumeration: CDX, not the site's map indexes.** v1 walked the eight
  `electorates/maps/<st>/index.htm` pages and surfaced only the
  geographic/rural subset listing (43/148). The full 150-slug enumerate is
  `web.archive.org/cdx/search/cdx?url=aec.gov.au/electorates/profiles/*&from=20011001&to=20021001&collapse=urlkey`
  — exactly the 2001 division set, 0 missing/0 extra against the RR5
  names after alias (`kingsford`→kingsfordsmith, `melports`→melbourneports,
  legacy no-letter-dir `/profiles/Mcmillan.htm`, underscore slugs
  `new_england`/`north_sydney`/`port_adelaide`, all normalised by stripping
  non-alphanumerics).
- **Fetcher/parser** `harvest-1998-v2.py`: fetch each slug's own capture
  `…/web/<ts>id_/<orig>`, parse "Demographic Rating" = the line after that
  label, Seat Status via
  `Seat Status:\s*\n?\s*([A-Za-z' -]+?)(?:\n|  +)`, era-gate on
  "3 October 1998". 1.2 s politeness + exp-backoff (Wayback throttle is
  real — "Temporarily Offline" HTML and 502s, 45–60 s backoff works).
- **Result: 148/150 rows**, era=1998 on 144 (plus the four new-2001 seats'
  genuinely-2001-era rows, ingiari/solomon/etc. which have no 1998 block).
  Rating vocabulary is the four classes PLUS two real 2001-era tokens:
  `Outer Urban` (macarthur) and `Outer Metropolitan/Provincial` (canning)
  — don't hard-fail a validator on the four-class vocab if you re-validate
  this TSV.

The four holes, and why they're holes:
- **Bradfield, Maribyrnong** — phantom CDX entries; per-URL CDX probes
  return nothing; not recoverable from Wayback at all.
- **Wide Bay** — every capture of its page carries an EMPTY rating (the
  AEC never printed one); RR5 supplies Rural.
- **Northern Territory** (single seat, abolished 2001) — the page was
  never archived; domain-wide CDX probe for `northern[_-]territor*`
  1998–2004 is empty.

**Cross-check vs RR5's `classificationRR5proposed`: 128/148 agree exactly;
the 20 divergences are all ADJACENT classes** (Burke Rural vs RR5 Outer
Met, Cook Inner vs Outer Met, Macarthur "Outer Urban" vs Outer Met, etc.)
— the exactly-where-RR5-re-derived cases. So the TSV is the authoritative
"what the AEC said" layer and RR5 is the reconstruction; the delta is
listable and both are defensible.

TSV caveat: the harvest wrote `\t` joins but rating/status fields
themselves contain SPACES — `awk -F'\t'` works, awk's default FS does NOT
(it collapses the string fields and makes every row look anomalous). The
file is `.build/analysis/seat-model/divclass-src/2001/aec-profiles-2001epoch-v2.tsv`; v1's
partial 43-row `aec-profiles-1998-candidates.tsv` is superseded.

**LANDED 2026-10-22 as the canonical 2001 layer (option C).** The harvest
was committed as `.build/analysis/seat-model/aec-2001-epoch-profile-ratings.tsv`
(`division × classificationV2page × provenance`, 150 rows: 147 aecPage +
the three RR5 fills Bradfield/Maribyrnong Inner Metropolitan, Wide Bay
Rural with provenance=rr5Patch; the harvest kit lives committed beside it
in `.build/analysis/seat-model/divclass-src/2001/` as the regenerator). The
extractor normalises the two era tokens to Outer Metropolitan and asserts
att2's FROM column corroborates v2 on 12 of 16 rows with exactly the four
known page-vs-paper divergences pinned by name —
**Macarthur** (page Outer Urban→OM vs att2 Rural), **Maribyrnong** (page
IM/fill vs att2 OM), **Fisher** (page Provincial vs att2 Rural — v2 and
att3 both Provincial, so att2's FROM row is the outlier) and **Pearce**
(page Rural vs att2 OM — test pin flipped Outer→Rural). The 20
v2-vs-att3 divergences land in the JSON as `deltas["2001"]`.

## The 2004 live profile-page harvest (canonical 2004 layer, landed 2026-10-22)

The per-division **4 October 2004** profile pages still exist LIVE:
`https://www.aec.gov.au/Elections/federal_elections/2004/profiles/<Name>.htm`
— slug = division name minus spaces/apostrophes/HYPHENS (`deo-ong`… strip
`-` too), server case-insensitive; bogus slugs return a **55,488-byte
text/html sentinel** (same anti-soft-200 as the pocket-book probe); the
era gate is `<title>` starting `2004 Profile of the division of`. Every
one of the 150 divisions carries a **Demographic Rating** token AND a
**Seat Status** string (2004 election outcome, e.g. "Safe Labor",
"Marginal Country Liberal").

Two page templates coexist in the directory and BOTH templates must parse:
- split: `Demographic Rating:</h2><p>Rural</p>` / `Seat Status:</li><li>…</li>`
- inline: `…: Rural</li>` / `Seat Status: Marginal Labor</li>`

State is NOT machine-labelled on the pages (body prose carries suburb
names that defeat substring matching). Source it from RR5 att3 for the
148 surviving divisions + hardcode the two 2003-04 creations
(**Bonner = QLD, Gorton = VIC**). The 2004 set is the 2001 set
+ Bonner/Gorton − **Bonython/Burke** (abolished in the 2003-04
redistributions; per-state counts: NSW 50 / VIC 37 / **QLD 28** /
**SA 11** / WA 15 / TAS 5 / NT 2 / ACT 2 — Qld gained a seat, SA lost
one vs 2001).

Harvest kit: `.build/analysis/seat-model/divclass-src/2004/harvest-2004.py` (committed),
pages captured in `.build/analysis/seat-model/divclass-src/2004/pages/`, output committed as
`.build/analysis/seat-model/aec-2004-epoch-profile-ratings.tsv`
(`division,state,classification,party,status,provenance` — all 150 rows
`aecPage`, no RR5 patches needed, unlike 2001). Party vocabulary Labor /
Liberal / National / Independent / **Country Liberal** (NT); statuses
Marginal / Fairly Safe / Safe. Distribution Inner 42 / Outer 45 /
Provincial 18 / Rural 45. `previous: null` (the pages are single-epoch —
no prior/after pair printed).

**This harvest settles RR5 att2.** Newman's attachment-2 FROM column
(labelled "2001 election") matches the 2004 live pages on **15/16** rows
(Burke, the only att2 division not in the 2004 set, is uncomparable) vs
only 12/16 against the 2001 pages — att2's FROM records the class **as
printed at Jan-2005 / 2004-election epoch**, not the 2001 election. The
four 2001 ATT2_DIVERGES (Fisher, Macarthur, Maribyrnong, Pearce) are four
of the seven REAL 2001→2004 on-page reclassifications.

## Repo implementation (committed)

- `.build/analysis/seat-model/extract-division-classifications.mjs` — emits
  ELEVEN blocks. The 1996 and 1998 blocks are OFFLINE and share
  `electionsClassicEra(fixture, stateCounts)`: a document-order regex walk
  of the committed whole-chamber TSVs (`<p><b>STATE</b></p>` banner
  paragraphs interleaved with six-column `<tr>` rows at transcription
  time — the column-inversion trap: the RATING rides the printed
  "Socio-Demographic" column and the WINNING PARTY rides the printed
  "Classification" column). Guards: exact 148-row count, per-state
  chamber counts (1996: ACT 3/QLD 26/NT 1; 1998: ACT 2/QLD 27 — the
  1997-redistribution pivots), four-class/state vocabularies, era party
  vocabulary (LP/ALP/NP/CLP/IND), duplicate divisions, fixture schema
  header required, provenance ∈ {aecPage}, and the Namadgi↔Blair set
  pivot asserted between the two blocks. Both seed before 2001 so keys
  stay chronological. The 2004 block is OFFLINE too: `elections2004()` walks the
  committed live-page fixture (no fetch — the pages' fetch happened at
  harvest time), guards the four-class/state/party/status vocabularies,
  duplicates, the exact 150-row count, the per-state chamber counts
  (NSW 50/VIC 37/QLD 28/SA 11/WA 15/TAS 5/NT 2/ACT 2) and exact set
  membership (2001 set ± the 2003-04 redistribution pivots). The 2001
  block is OFFLINE: `elections2001()` walks the
  committed v2 fixture (aec — see below) joined to the two RR5 fixtures,
  `out.elections["2001"]` seeds first so keys stay chronological. Per row:
  class = `NORMALISE_2001[raw] ?? raw` over the fixture's
  classificationV2page (era tokens Outer Urban / Outer Metropolitan/
  Provincial → Outer Metropolitan); state/party/status come from att3.
  Fixture guards: `# `-prefixed schema-header line required, column-count
  per row, class/state vocabularies, duplicate divisions, 150-row count,
  v2 fixture ↔ att3 name-set equality, provenance ∈ {aecPage, rr5Patch},
  the v2-vs-att3 delta has EXACTLY 20 rows (rolls out of sync = loud
  throw), and att2's FROM-column corroboration diverges from v2 on
  EXACTLY the pinned set Fisher/Macarthur/Maribyrnong/Pearce. Then live
  fetch of the SEVEN VTR events (extended
  2026-10-21 from four). One main loop branches on `+ev >= 20499`: modern
  maps the `cell(row, "cId")` header parse onto a shared
  `{div,dem,stt,pp,pss,sp,ss}` shape, legacy is the positional
  `legacyRows(html, st)` generator above. Hard-errors on unparseable row /
  wrong state / duplicate division; writes
  `data/division-classifications.json` keyed `elections[year][division]` —
  2001 rows are `{state, classification, previous: null, current: {party,
  status}}` (neither 2001 source has a prior/after pair), and the 20-row
  delta lands beside the blocks as `deltas["2001"].v2vsRR5att3` (top-level
  `deltas` member — consumers see `_about/_provenance/elections/deltas`).
  Join to flow files **by exact division name** (AEC canonical case for the
  election's era) — the test pins name-set equality with
  `data/aec-2025-seat-flows.json` so joins never silently miss.
- `.build/analysis/seat-model/aec-1996-epoch-classifications.tsv` +
  `.build/analysis/seat-model/aec-1998-epoch-classifications.tsv` — the
  canonical 1996/1998 sources (committed 2026-10-22): 148 rows each,
  schema `# division, state, classification, party, status, provenance`
  (tab-separated, all rows `aecPage`). Transcribed from the AEC's own
  whole-chamber "Divisional Classifications" table pages via Wayback
  raw-capture (`id_`) fetches — provenance header carries the source URL,
  capture id, page title/stamp and the raw HTML's sha256. 1996:
  `aec.gov.au/_content/When/elections/1996/info/classification.htm`
  capture 20060524142147, title "1996 Divisional Classifcations" (sic),
  stamp "last updated 08 September 2005", sha256
  `cead85a74fd7a970b67ea1c436a9e05b18edd1e80f87b43f5d72acf5310a4ba6`;
  raw cached `.build/analysis/seat-model/divclass-src/1996/1996-classification-2006.html`. 1998:
  `aec.gov.au/Elections/federal_elections/1998/classification.htm`
  capture 20070831140251, title "1998 Divisional Classifications", stamp
  "last updated Thursday, August 09, 2007", source note printed on-page
  "Source: Electoral Pocket Book, August 1999", sha256
  `760ff820c4e062508ff198f08be4041ebf52b941e397d09ff7672eafe09d8248`;
  raw cached `.build/analysis/seat-model/divclass-src/1998/1998-classification-raw.html`, parsed transcript
  `.build/analysis/seat-model/divclass-src/1998/1998-classification.tsv`. Both pages print six columns
  Code/Division/Enrolment/Socio-Demographic/Seat Status/Classification
  with state banners as `<p><b>STATE</b></p>` paragraphs between tables,
  and both are COLUMN-INVERTED: the rating sits under "Socio-Demographic"
  and the winning party under "Classification" — resolved at
  transcription, the fixture carries the corrected columns. Chamber sets:
  1996 has Namadgi (ACT 3) and no Blair; 1998 has Blair (QLD 27) and no
  Namadgi — the 1997-redistribution pivot. NT is single-seat **Rural** in
  both (CLP 1996, ALP 1998 — see
  `.build/analysis/seat-model/divclass-src/2001/nt-1998-rating-placeholder.md`, now fully
  resolved; two earlier guesses, "Provincial" and Wikipedia's
  "Provincial, rural and remote" composite, were both wrong). Era party
  tokens: LP/ALP/NP/CLP/IND. Distributions: 1996 Inner 42/Outer 43/
  Provincial 18/Rural 45; 1998 Inner 41/Outer 42/Provincial 20/Rural 45.
- `.build/analysis/seat-model/aec-2001-epoch-profile-ratings.tsv` — the
  canonical 2001 classification source (committed 2026-10-22): 150 rows,
  schema `# division, classificationV2page, provenance`; 147 Wayback-page
  ratings + 3 RR5-att3 gap fills (see the B-lane section for the harvest
  kit and the four-holes map). Vocabulary is the four classes PLUS the two
  era tokens, normalisation happens in the extractor not the fixture.
- `.build/analysis/seat-model/aec-2004-epoch-profile-ratings.tsv` — the
  canonical 2004 source (committed 2026-10-22): 150 rows, schema
  `# division,state,classification,party,status,provenance`; ALL rows
  aecPage (no patch lanes). Unlike the 2001 fixture this one is
  ready-keyed: state/party/status live in the fixture (state blamed on
  RR5 att3 + Bonner/Gorton hardcodes at harvest time — see the 2004
  harvest section).
- `.build/analysis/seat-model/rr5-att3-proposed-classifications.tsv` +
  `rr5-att2-changes.tsv` — the RR5 fixtures, DEMOTED 2026-10-22 from
  canonical to gap-fill + corroboration (150-row per-state transcript and
  the 16 change rows; schema in their `# ` header lines:
  `division,state,status,party,areaKm2,classificationRR5proposed,sesBand`
  and `division,classification2001election,classificationRR5proposed`).
  att3 supplies 2001 state/party/status + the delta's comparison value;
  att2's FROM column independently checks v2 (see guards above). Classes
  canonicalised to title case IN THE FIXTURES (att3 prints sentence case,
  att2 prints title case) so the extractor carries no RR5-specific casing
  logic. Regenerator script:
  `.matilda/gen-rr5-fixtures.mjs` (scratch — see gotchas below).
- `test-division-classifications.mjs` — chamber counts for 11 blocks
  (148×2 1996/1998, 150×6 2001–2016, 151×2, 150), vocabulary with the
  `previous === null` exception scoped to the four single-epoch years
  1996/1998/2001/2004 (all single-print page layers; current still
  required), the boundary pins (incl. the 1996 six, the 1998 six, the
  2001 on-page ten and the 2004 live-page nine — see the pins
  paragraph), W2 name-set equality, the exact reclass sets 1996→1998
  (two: Fisher R→P, Pearce OM→P), 1998→2001 (six — Brand/Cunningham
  P→OM, Macarthur R→OM, Maribyrnong OM→IM, Pearce P→R, Throsby P→IM;
  the test header records the transitional-2001-layer finding), 2001→2004
  (seven) and 2004→2007 (four — incl. Macarthur's R→OM flip-back),
  2016→2019 drift list (still exactly Cowper + Griffith), the era-set
  invariants: 1996 has Namadgi PRESENT and Blair ABSENT; 1998 has Blair
  PRESENT and Namadgi ABSENT (the 1997-redistribution pivot);
  Kingsford-Smith hyphenated in 1996/1998 (2001 drops the hyphen);
  Solomon/Lingiari/Hasluck ABSENT from 1998 (created for 2001);
  2001 has Gwydir PRESENT and Gorton/Bonner/Flynn/Wright
  ABSENT; 2004 has Bonner/Gorton PRESENT and Bonython/Burke ABSENT (the
  2003-04 redistribution pivots), and the per-layer pins: 1996
  distribution 42/43/18/45, 1998 distribution 41/42/20/45, 2001
  distribution 44/45/16/45, `deltas["2001"]` exactly 20 rows (spot rows
  Burke/Throsby/Macarthur/Canning, RR5 gap-fill rows never appear),
  2004 distribution 42/45/18/45. Run order: extractor then test, from
  repo root.
  (Extractor fetches live; a `cd` into a cache dir then `node …` heredoc
  broke a run once — run from repo root.)
- `.build/analysis/seat-model/flow-strength-findings.md` — the use case
  this was built for.

## How far back the record reaches (probe map, 2026-10-21)

Question asked: can the four-class table be sourced before 2007? Answer:
**2007 is the start of the online per-division RESULTS table; 2004 and
2001 are both canonical-on-page from the AEC's own per-division profile
pages (2004 live today, 2001 via Wayback); and 1996 + 1998 are
canonical-on-page from the AEC's own whole-chamber "Divisional
Classifications" table pages, both recovered from Wayback and committed
as fixtures (2026-10-22 — see the fixture bullets above). Earlier than
1996 is print-only or back-projection.** (2026-10-22 correction: an earlier draft of this map
claimed "2004 has NO four-class table … back-project" — wrong; it only
looked at the VTR results product. The 2004 per-division PROFILE pages,
a different www.aec.gov.au surface, carry the rating — see the 2004
harvest section above. Same lesson repeated: the 1996/1998
whole-chamber classification pages lived under yet another aec.gov.au
surface — `aec.gov.au/Elections/federal_elections/<year>/…` — and never
surfaced in the results.aec.gov.au probes at all.)

Archive anatomy (results.aec.gov.au):
- The archive index `https://results.aec.gov.au/` hrefs name every event
  id. Events hang at `results.aec.gov.au/<event>/…` — **2004 (event
  12246) lives at `/12246/results/`** (lowercase `results`, entry
  `Default.htm`, banner `logo_12246`), while **2007+ (13745, 15508, …)
  live at `/<event>/Website/`**. Probe named pages only: there is no
  default index page (even `13745/Website/index.html` 404s; real 404s here
  are ~1.2KB `text/html`).
- `/10822/` is a "Past Electoral Events" frameset — it links no older
  election results (points at a Stats CD-ROM product). Election results
  simply aren't served before 2004's event.
- **2004 has NO four-class table AMONG ITS RESULTS PAGES**:
  `HouseResultsMenu-12246.htm` offers no classifications page and the CSV
  downloads menu no classifications CSV — only aggregate
  `HouseDemographicFirstPrefsByParty-12246-NAT-Metropolitan` /
  `-NonMetropolitan` splits (a two-way metro/non-metro cut, not per
  division). BUT the same event's per-division PROFILE pages
  (`www.aec.gov.au/Elections/federal_elections/2004/profiles/<Name>.htm`,
  still live) carry the rating — the 2004 block is now sourced from
  them (see the 2004 harvest section). Lesson: "no results table" ≠ "no
  rating anywhere"; probe the profile-page surface too before calling a
  gap.

**AEC soft-200 trap** — probed pocket-book PDF URLs for 1998–2010 and every
guess returned HTTP 200. All were the same 55,488-byte `text/html` error
page (a nonsense 1975 probe confirmed the sentinel size/type). Real PDFs
are `application/pdf`, 2–6MB. **Verify `content_type`/`size_download`,
never the status code** — and calibrate against a known-nonsense URL.

Electoral Pocket Book reachback: the live aec.gov.au index links only the
**2011, 2013, 2016 and 2019** editions as real PDFs
(`archived/2011-electoral-pocketbook.pdf` etc.); 2022/2025 are web-only or
absent at those paths. Earlier editions are print-only (ANU Noel Butlin
archives hold "Electoral Pocket Book 1996"). Wayback CDX was "Temporarily
Offline" during the probe — that is the retry lane if a live-index-gone PDF
is ever needed.

**Recovering the 2001 table exactly — AEC Research Report 5** (Gerry
Newman, Jan 2005, `https://www.aec.gov.au/About_AEC/research/files/research_paper5.pdf`,
pdftotext -layout reads clean):
- Its own statement: the four-class system "has been used since at least
  the 1975 election".
- **Attachment 3** = a complete 150-division *proposed* classification
  table (rows `Name | Status Party | Area | Class | SES-band`; SES vocab
  High / Upper middle / Middle / Lower middle / Low — 150 rows).
- **Attachment 2** = the 16 proposed changes, whose FROM column is
  *LABELLED* the 2001-election classification but — settled by the 2004
  live-page harvest (15/16 match, only Burke uncomparable) — actually
  records the class as printed at the Jan-2005 / 2004-election epoch.
  For 2001 itself trust the Wayback pages; treat att2's FROM as the
  2004-epoch cross-check.
- So derive 2001 by reverting proposed rows by their change rows (only when
  the row's proposed value matches the change's TO value — the pattern
  `if proposed[d] === c.toProposed: y2001[d] = c.from2001`). Landed in the
  extractor 2026-10-21 via the two fixture TSVs, then **DEMOTED
  2026-10-22** when the Wayback page harvest became the canonical 2001
  layer — RR5 is now gap-fill + corroboration (see B-lane above).
- Verification against the 2007 VTR: the att2-reverted table matches
  **135/146** common names; the *proposed* redesign only 124/146 — the
  SES-informed relabel was never adopted downstream. The 11 diffs (Cook,
  Hotham, Maribyrnong, Macarthur, Macquarie, Corangamite, Capricornia,
  Hinkler, Longman, Mayo, Brand) were originally read as "post-2001
  drift" — **re-dated 2026-10-22**: since att2's FROM is the 2004-epoch
  print, those 11 are 2004→2007-epoch diffs, not 2001→2007. The old
  "derived-2001 stands as an exact 2001 snapshot" verdict is VOID —
  2001 truth is the Wayback page layer.
- Worked recipe scripts: `.matilda/compare-rr5.mjs` (recon vs VTR) and
  `.matilda/gen-rr5-fixtures.mjs` (the fixture generator), both scratch.

Fixture-generator parse gotchas (all bit once, in `.matilda/gen-rr5-fixtures.mjs`):
- **`\f` form-feed page breaks** prefix some pdftotext lines (Wentworth,
  Groom) — strip `/^\f+/` per line or two rows vanish (148 ≠ 150).
- **Region-slice before parsing**: attachment 3 holds SEVERAL tables —
  slice text between "Attachment 3" and "VICTORIA (After 2002
  Redistribution)" or the post-2001 supplementary tables (Gorton! and the
  moot NT single-seater with no SES band) graze the parse.
- **Per-state counts pin correctness**: NSW 50 / VIC 37 / QLD 27 / SA 12 /
  WA 15 / TAS 5 / NT 2 / ACT 2 = 150. The att3 numeric column is **Area
  (sq kms)**, not enrolment (sanity: Fowler = 47 km²).
- **Attachment 2 misprints "Maribrynong"** — alias it IN THE GENERATOR
  (validated against att3); the committed fixture carries the correct
  "Maribyrnong".
- **Class case differs between attachments** — att3 sentence case ("Inner
  metropolitan"), att2 title case. Canonicalise both to title case before
  the att2↔att3 consistency check (every att2 TO must equal att3's class
  for that division) and before writing fixtures.
- att2 rows carry optional inline state-prefix tokens (NSW/VIC/QLD/SA/WA)
  on the first row of each state subgroup — the regex must allow and drop
  them.

Practical fill ladder for the seat model: **1996 + 1998 + 2001 + 2004 +
2007–2025** = IN THE REPO NOW (recovered-on-page 1996/1998 whole-chamber
blocks + canonical-on-page 2001 + 2004 profile-page blocks + VTR pages,
one regen command); **pre-1996** = print-only (pocket
books, National Electoral Division Profiles, Electoral Atlas) — not
worth scanning unless a workstream truly needs it.

Probe environment gotchas from this session: macOS grep refuses
`.{0,600}`-style repetition (255 cap) — use sed/awk ranges; and
`node -e '…'` with regex literals containing `'` breaks shell quoting —
write scratch scripts to `.matilda/` (file tools refuse `/tmp` in BOGAN
mode) and run them from repo root.

## The stratification pattern (what it's for)

Question: is the 2025 ON strength→flow gradient (weak-ON seats ~85/15 to
Coalition, strong-ON ~25–28% ALP) just a regional-composition artefact?
Re-stratify the same per-seat records by AEC class and re-run the bins
within each class. Answer: **the gradient lives inside every class**
(r ≈ +0.44 Inner Metro, +0.50 Outer Metro, +0.50 Provincial, +0.24 Rural;
rural only flatter and floor-raised). Composition shifts the level, not the
gradient — so no geography interaction term is needed in the seat model's
no-read-seat conditional (it keys on ON primary strength alone).

Generalisable lesson: when a seat-level gradient might be composition, the
cheapest falsifier is the AEC's own classification, not a census join —
32 small GETs and one exact-name join versus a full SA1 frame.
