---
name: aec-division-classifications
description: AEC per-division demographic classification (Inner Metropolitan / Outer Metropolitan / Provincial / Rural) — the VTR HouseDivisionClassifications product end-to-end for EIGHT election blocks (a CANONICAL-ON-PAGE 2001 block from the Wayback-harvested 2001-epoch profile pages + RR5 gap-fill of its 3 holes, plus live VTR 2007–2025; two markup eras: 2016+ headers="c*" self-label cells vs 2007/2010/2013 positional 7/8-cell rows), chamber-count invariants, the repo's extractor + fixtures + test, and the geography-stratification use it was built for.
source: auto-skill
extracted_at: '2026-10-21T06:06:18.696Z'
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
| 2001 | (v2 Wayback pages + 3 RR5 fills — no VTR event) | 150 |
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
across eras — clean anchors.)

Cross-era reclass drift is small and listable: 07→10 Forde R→OM,
Brand P→OM; 10→13 five (Casey, Hotham, Jagajaga, Maribyrnong, Blair);
13→16 Hume+Paterson; 16→19 Cowper R→Provincial + Griffith OM→IM;
19→22 four (Fraser, Jagajaga, La Trobe, Cowan); 22→25 Hume.

The test ALSO pins the 2001 on-page layer: Gwydir Rural, Burke Rural,
Cowper Rural, Griffith Outer Metropolitan (v2 agrees with RR5's att2 FROM
column there); **Pearce Rural** (the v2 page's token — RR5's att2 FROM
says Outer Metropolitan; one of four pinned page-vs-paper divergences);
Macarthur/Canning Outer Metropolitan (the normalised era tokens); and the
three RR5 gap fills Bradfield/Maribyrnong Inner Metropolitan, Wide Bay
Rural. The 2001 distribution is locked (Inner 44 / Outer 45 / Provincial
16 / Rural 45) and `deltas['2001']` in the JSON is exactly the 20
v2-vs-att3 divergences with the era tokens preserved.

## The 1998-epoch on-page rating harvest (B-lane, 2026-10-21 → 148-row TSV)

Beyond RR5-derivation there is a SECOND source for the 2001 epoch: the
AEC's own division profile pages as Wayback captured them
Nov 2001 – Apr 2002. Their page bodies still showed the
"3 October 1998 Election" Seat Status block plus a
**Demographic Rating** token — i.e. the rating the AEC physically
displayed at that epoch, as opposed to RR5's later SES re-derivation.
Harvest kit (uncommitted, `.matilda/divclass-pre2001/`):
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
file is `.matilda/divclass-pre2001/aec-profiles-2001epoch-v2.tsv`; v1's
partial 43-row `aec-profiles-1998-candidates.tsv` is superseded.

**LANDED 2026-10-22 as the canonical 2001 layer (option C).** The harvest
was committed as `.build/analysis/seat-model/aec-2001-epoch-profile-ratings.tsv`
(`division × classificationV2page × provenance`, 150 rows: 147 aecPage +
the three RR5 fills Bradfield/Maribyrnong Inner Metropolitan, Wide Bay
Rural with provenance=rr5Patch; the
`.matilda/divclass-pre2001/` harvest kit stays as the regenerator). The
extractor normalises the two era tokens to Outer Metropolitan and asserts
att2's FROM column corroborates v2 on 12 of 16 rows with exactly the four
known page-vs-paper divergences pinned by name —
**Macarthur** (page Outer Urban→OM vs att2 Rural), **Maribyrnong** (page
IM/fill vs att2 OM), **Fisher** (page Provincial vs att2 Rural — v2 and
att3 both Provincial, so att2's FROM row is the outlier) and **Pearce**
(page Rural vs att2 OM — test pin flipped Outer→Rural). The 20
v2-vs-att3 divergences land in the JSON as `deltas["2001"]`.

## Repo implementation (committed)

- `.build/analysis/seat-model/extract-division-classifications.mjs` — emits
  EIGHT blocks. The 2001 block is OFFLINE: `elections2001()` walks the
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
- `.build/analysis/seat-model/aec-2001-epoch-profile-ratings.tsv` — the
  canonical 2001 classification source (committed 2026-10-22): 150 rows,
  schema `# division, classificationV2page, provenance`; 147 Wayback-page
  ratings + 3 RR5-att3 gap fills (see the B-lane section for the harvest
  kit and the four-holes map). Vocabulary is the four classes PLUS the two
  era tokens, normalisation happens in the extractor not the fixture.
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
- `test-division-classifications.mjs` — chamber counts for 8 blocks
  (150×5 2001–2016, 151×2, 150), vocabulary with the 2001 `previous ===
  null` exception SCOPED to `year === "2001"` (current still required),
  the boundary pins (incl. the 2001 on-page ten — see the pins paragraph),
  W2 name-set equality,
  2016→2019 drift list (still exactly Cowper + Griffith), the era-set
  invariant: Gwydir PRESENT, Gorton/Bonner/Flynn/Wright ABSENT (all
  post-2001 creations), and the 2001 layer's own pins: distribution
  44/45/16/45, `deltas["2001"]` exactly 20 rows (spot rows Burke/Throsby/
  Macarthur/Canning, RR5 gap-fill rows never appear). Run order: extractor
  then test, from repo root.
  (Extractor fetches live; a `cd` into a cache dir then `node …` heredoc
  broke a run once — run from repo root.)
- `.build/analysis/seat-model/flow-strength-findings.md` — the use case
  this was built for.

## How far back the record reaches (probe map, 2026-10-21)

Question asked: can the four-class table be sourced before 2007? Answer:
**2007 is the start of the online per-division table; 2001 is derivable
exactly from a research paper; earlier is print-only or back-projection.**

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
- **2004 has NO four-class table**: `HouseResultsMenu-12246.htm` offers no
  classifications page and the CSV downloads menu no classifications CSV —
  only aggregate `HouseDemographicFirstPrefsByParty-12246-NAT-Metropolitan`
  / `-NonMetropolitan` splits (a two-way metro/non-metro cut, not per
  division).

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
- **Attachment 2** = the 16 proposed changes, whose FROM column **is the
  2001-election classification**.
- So derive 2001 by reverting proposed rows by their change rows (only when
  the row's proposed value matches the change's TO value — the pattern
  `if proposed[d] === c.toProposed: y2001[d] = c.from2001`). Landed in the
  extractor 2026-10-21 via the two fixture TSVs, then **DEMOTED
  2026-10-22** when the Wayback page harvest became the canonical 2001
  layer — RR5 is now gap-fill + corroboration (see B-lane above).
- Verification against the 2007 VTR: the derived-2001 table matches
  **135/146** common names; the *proposed* redesign only 124/146 — the
  SES-informed relabel was never adopted downstream. The 11 diffs are
  genuine post-2001 rating drift (Cook, Hotham, Maribyrnong, Macarthur,
  Macquarie, Corangamite, Capricornia, Hinkler, Longman, Mayo, Brand), so
  derived-2001 stands as an exact 2001 snapshot.
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

Practical fill ladder for the seat model: **2001 + 2007–2025** = IN THE
REPO NOW (v2 canonical-on-page 2001 block + VTR pages, one regen
command);
**2004/1998** = back-project from 2007 (drift runs 2–5 seats per cycle —
same order as any reconstruction); **pre-2001** = print-only (pocket
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
