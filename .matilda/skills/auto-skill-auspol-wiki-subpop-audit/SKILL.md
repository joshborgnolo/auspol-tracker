---
name: auspol-wiki-subpop-audit
description: auspol-tracker — auditing Wikipedia's "Opinion polling for the next Australian federal election" against the site's data, in 2+1 2026-10-09 passes. PASS ONE (subpopulation chapter, 638 parsed rows → 14 genuine gap waves): chapter anatomy/column semantics, by-design exclusions (2PP-by-group, per-group n, RM 2PP-only rows), the per-source verification ladder (AFR logged-out full text + Datawrapper dataset.csv, protected-tweet detection, Sky unverifiable), stale demographics.mjs assumptions disproved (FIRST-cutoff comment, two KNOWN_SKIP entries). PASS TWO (whole-page, every facet): check-coverage is the national-VI witness ONLY; per-chapter diff homes (tpp3/direction[]/seats/dem dims); false-positive traps (window firm-leaks, unlinked bare firm cells like EMRS, namespaced site pollster names, ±5d date skew); the five genuine cross-facet gaps (slot-less consideration + hypotheticals, EMRS Tasmania invisible to the witness, RM SMS 3PP, RM pre-Nov-2025 state/gender packs). PASS THREE source-verifies the RM packs live (per-finding ids, Jan special findings vs the splitless late-Jan roundup, postBy.blocks fetch recipe, primaries-only schema blocker).
source: auto-skill
extracted_at: '2026-10-09T04:41:44.210Z'
---

# auspol-tracker: Wikipedia subpopulation-chapter audit vs data/demographics.json

User goal (2026-10-09): "is there ANY subpopulation data in Wikipedia but not in the
site?" — exhaustive audit, each candidate cross-checked against the actual source,
report only (no data/pipeline edits).

## The wiki chapter anatomy (what to parse)

Page: en.wikipedia.org "Opinion polling for the next Australian federal election"
(~550 KB wikitext). The subpopulation chapter sits after "Individual polls" as a run of
per-GROUP tables, not one table: state tables (NSW/Vic/Qld/WA/SA/Tas/ACT/NT), "By
electorate classification" (Inner/Outer metropolitan, Provincial, Rural, Regional/rural —
level-4 `====` headers), then By gender, By age, By generation, By language, By country of
birth, plus hypothetical-section tail tables. A row parser keyed on the fieldwork-date
column pins firm + group from the enclosing chapter header; emit one record per row with
the raw figure cells verbatim. Parsed this session: 638 records; per-firm counts YouGov
207, Roy Morgan 170, RedBridge/Accent 64, DemosAU 51, Resolve 50, Newspoll 40, Essential
15, Fox & Hedgehog 14, Freshwater 12, EMRS 1.

Column semantics SHIFT by house and era — read each table's header row before aligning:
- RedBridge 2025-era tables are 4 primary columns ALP/LNP/GRN/ONP(merged into "Other"?)
  — actually June-2025 prints ALP, L/NP, GRN, OTH (Greens 24 to 18-34 matches AFR prose);
  Sep/Nov-2025 add an ONP column (5 primaries). A parsed cell list without the header can
  be misaligned by one — the YouGov MRP 2025-11-17 "Provincial" wiki row carries a stray
  column-shift ("33, 3, 27, 10, 21…") vs the source PDF order ALP/LNP/GRN/ONP/IND/OTH.
  FLAG artefact rows in the report rather than silently "fixing" them.
- Figs often end with 2PP cells; some rows only carry one 2PP figure (the parser kept
  whatever was printed).

## By-design exclusions (wiki content that is NOT a site gap)

State these up-front in the report so nobody re-audits them:
- **2PP-by-group columns** — the site's dims are primaries-only (`{alp,lnp,grn,onp,oth}`
  per group); no per-group 2PP exists to file in data/demographics.json.
- **Per-group subsample n and undecided% columns** — not in the wave schema.
- **Roy Morgan 4-weekly subpopulation rows (2025-06→2026-02)** — wiki carries 2PP only
  (primaries N/A in wikitext); nothing primaries-based to import.
- Wiki items already in the site under a different wave key: RM country-of-birth "15 Sep
  2026" wiki rows == site wave **2026-07-31** (same findings/10341 release, 13 groups;
  only the sample annotation differs — wiki 21,147 vs site's pooled 26,418).

## Verification ladder per candidate wave (what worked, in order)

1. **House's own first-party report** (PDF/text, cached in `.build/<house>-src/` or
   fetchable) — strongest: cell-for-cell. DemosAU 2025-07→2026-03 reports, TAI's
   2026-03-19 PDF, Climate Council EPA MRP PDF (the YouGov 2025-11-17 MRP source,
   n=3,530) all verified this way.
2. **AFR articles: FULL body text came through logged-out** via
   `node .build/chrome-article.mjs <url>` (no AFR subscription needed 2026-10-09 — the
   old-article metered wall served the whole pieces: Jun/Jul-2025 youthquake,
   Sep-2025 permanent-opposition, Nov-2025 record-low-Ley). Prose confirms quoted cells.
   See poll-figure-recovery for the Datawrapper rung.
3. **OCR for image-only PDF pages** (DemosAU Jan-2026 breakdown pages are images):
   poppler `pdftoppm -r 160 -png` then `.build/ocr-image`. **This session the repo's
   ocr-image FAILED every run with Vision `e5rt` error 13 (~50s each, CPU-only variant
   too) at the `.accurate` level — a `.fast` recognitionLevel re-compile works**
   (compiled to `.matilda/demosau-ocr/ocr-fast`; large chart numerals fine, age-band
   labels degraded — cross-check against a native-text page where bands overlap).
   tesseract (`/opt/homebrew/bin/tesseract`) is the further fallback.
4. **Protected tweets are detectable but unreadable**:
   `curl "https://cdn.syndication.twimg.com/tweet-result?id=<id>&token=a"` returns a
   `TweetTombstone` JSON ("account owner limits who can view their Posts") for
   KosSamaras — RedBridge's Sep-2025 detail charts live behind it; declare those cells
   verification-limited, not gaps-by-assumption.
5. **Wayback can be entirely DOWN** ("Internet Archive: Temporarily Offline" 2026-10-09;
   the availability API silently returned `{}`) — note the attempt, move on.
6. **Sky Pulse broadcast graphics are unreachable**: post-migration, Sky article URLs 301
   to news24.com.au mirror text with NO Infogram embeds and no chart images (checked the
   Apr-2026 "One Nation becomes most popular party in Victoria" mirror — zero `<img>`
   beyond avatars/icons). Wiki's YouGov 2026-04-07 five-state primary rows therefore
   cannot be source-verified — verification-limited.

## Verified gap waves as of 2026-10-09 (14 — the audit's deliverable)

RedBridge/Accent: 2025-06-30 (gender/age/location — the AFR article's own Datawrapper
datasets, two rounding-level diffs: Inner-metro ALP 42v43, 65+ GRN 2v1), 2025-09-08
(gender/generation/state — 2PP cells prose-verified), 2025-10-07, 2025-11-13,
2025-12-12, 2026-01-29. DemosAU: 2025-07-06, 2026-01-06, 2026-01-21 (OCR), 2026-02-20,
plus MRP waves 2025-11-11 and 2026-03-03. YouGov: (TAI) 2026-03-19, (MRP Climate
Council) 2025-11-17. Full dims-per-wave table is in the session report; import needs the
FIRST/hand-entry decisions in auspol-demographics-reader.

## Stale pipeline assumptions the audit PROVED wrong (as of 2026-10-09)

Verify current state before citing — the user may fix these any time:
- `demographics.mjs` FIRST-cutoff comment ~:143 — "no house published these breakdowns
  earlier this term" is FALSE (RedBridge own PDFs through 2025, DemosAU from Jul-2025,
  TAI, Climate Council MRP).
- KNOWN_SKIP `YouGov|2026-03-19` — "an Australia Institute poll – no crosstab published"
  is contradicted: the TAI PDF (`.matilda/tai-mar26.txt` in-session) carries full
  gender/age/state crosstabs.
- KNOWN_SKIP `DemosAU|2026-02-20` — "predates the Gender, Age and Education charts"
  contradicted by its own report.
- polls.json DemosAU `2026-01-06` row has `methodUrl: null` though its report PDF
  exists on the house site (also affects demosauPdfUrls routing in crosstab-sources.mjs).

## The paired WHOLE-PAGE audit (2026-10-09, second session — every facet, not just the subpop chapter)

User follow-up: "are there any polls in here (in ANY facet — voting intention,
demographics) — or any poll data here that is not in the site?" Same page, this time
diffing EVERY chapter, not just subpopulations.

### Whole-page recipe

1. **Run `node .build/check-coverage.mjs` FIRST** — but know it is the national-VI
   witness ONLY (164 witness waves, all present 2026-10-09). Green there says nothing
   about 3PP, direction, sub-national, projections, seat polling, subpopulations or
   hypotheticals. EMRS-type subsection-only houses are structurally invisible to it —
   no FIRST_CONTACT will ever fire for them.
2. Fetch wikitext: `action=parse&page=...&prop=wikitext&format=json` to a temp file;
   split sections on `^={2,}\s*(.+?)\s*\1\s*$`. Page inventory 2026-10-09: VI 2026+2025,
   Three-party-preferred, Voting consideration, National direction ("Individual polls"),
   Sub-national (8 state tables), Electorate projections, "Individual seat polling"
   (= by-electorate-CLASSIFICATION tables, not literal seat polls), Subpopulation
   results, Hypothetical scenarios. **No leadership/satisfaction section on the page
   at all this cycle.**
3. Diff each facet against its site home: national VI via check-coverage; 3PP via
   `tpp3` fields on polls.json rows; direction via `direction[]`; MRP projections via
   `seats` on the MRP rows (all four wiki projection rows covered, incl. DemosAU
   2026-07-11); everything group-wise via data/demographics.json dims.
4. **Verify EVERY flagged row in raw wikitext context before reporting.** Window-based
   firm matching leaks across table rows: this session's false positives included
   `Essential|2025-11-11` (really a DemosAU (MRP) Oct–11 Nov 2025 row), `Newspoll|
   2026-06-18` (really a DemosAU 16–18 Jun row), and a Resolve date-conflation —
   three "gaps" that dissolved on direct greps.

### Parser traps beyond the subpop-chapter ones

- Wiki firm cells are INCONSISTENTLY wikilinked — **EMRS appears bare (no `[[…]]`)**;
  a firm regex requiring the `[[` prefix silently drops unlinked firms (EMRS sailed
  through one full pass unseen). Substring firm search in a bounded window is safer.
- Site dem.waves pollster names are namespaced — `Newspoll (pooled)`, `YouGov (MRP)`,
  `DemosAU (MRP)` — while wiki prints the bare firm; un-aliased these manufacture
  false gaps (the YouGov MRP 2025-11-17 classification rows are covered on the site
  as `YouGov (MRP)`).
- Date conventions skew ±5d (wiki fieldwork-end vs the site's wave `date`): Resolve
  12–16 Jan 2026 → site wave 2026-01-11 territory. Deduct ±5d NEAR hits as covered.
- `node -e` one-liner diff scripts ate regex escapes (`\s`, `\{`) under single-quote
  shell wrapping — write the diff script to a scratch file instead; and reset
  `.lastIndex` when reusing a /g regex with exec() per window.

### Whole-page findings 2026-10-09

Covered (verified): national direction (site's 38 Roy Morgan weekly 2026 readings are
a SUPERSET of wiki's 13-row table), 3PP Fox & Hedgehog ×4, electorate projections,
subpopulations per the main audit above, classification tables (the site's RedBridge/
DemosAU/YouGov-MRP location dims use the identical Inner metro/Outer metro/Provincial/
Rural groups).

Genuine cross-facet gaps (beyond the subpop-chapter list above):
1. **Voting consideration** — the ENTIRE measure has no slot in the data model
   (grep 'consider' across data/ is empty): YouGov-for-Sky consideration waves
   9–16 Jun, 26 May–2 Jun, 17–24 Feb 2026; Essential 18–23 Feb 2026; YouGov MRP
   consideration Nov 2025 + Jul 2025.
2. **Hypothetical scenarios** — DemosAU 15–20 May 2026 "Barnaby Joyce as One Nation
   leader" footing + the "Teal Party" inclusion test. No schema slot for either.
3. **EMRS Tasmania federal poll, 16–19 Feb 2026, n=953** — Tas ALP 30/LIB 18/GRN 13/
   ONP 24/IND 12/OTH 2, 2PP ALP 60–40 (the subpop-chapter parser's lone "EMRS 1"
   record). EMRS is outside the house canon entirely, and as a subsection-only row
   check-coverage can never surface it (see recipe step 1).
4. **Roy Morgan SMS wave 13–14 May 2026 3PP** — wave IS on the site as a VI/2PP row,
   but wiki's 3PP table carries its triangle ALP 44.5 / LNP 19 / ONP 36.5 (n=2,348)
   and no `tpp3` is filed on the row.
5. **Roy Morgan pre-Nov-2025 SUB-NATIONAL packs** — the state tables carry PRIMARY
   figures at waves ending 1 Jun, 27 Jul, 24 Aug, 21 Sep, 19 Oct 2025 and 5–11 Jan,
   12–18 Jan, 13–16 Feb (2PP head) 2026. Distinct from the subpop-chapter RM rows
   (which are 2PP-only, hence by-design-excluded there — see above): the site reads
   these RM packs only from 2025-11-16 onward (+ hand-entered 2026-02-01 + the
   fortnightly machine reads from late Sep-2026).

### The RM packs source-verified live (third 2026-10-09 pass — "is it true these are missed in the data?")

User asked whether the pack list above really is missing. **Yes** — every pack
verified against roymorgan.com itself, and none is in data/demographics.json.

Live-fetch recipe: `curl -sL -A "Mozilla/5.0 … Chrome/126.0" https://www.roymorgan.com/
findings/<slug>` → regex the `<script id="__NEXT_DATA__">…</script>` JSON →
`props.pageProps.findingData.postBy` → iterate **`blocks[].saveContent`** (plain-text
search the block text). Trap: `postBy.content` alone MISSES the table/analysis
paragraphs on the newer findings (the late-Jan-2026 roundup parsed to 0 split
sentences from `content` while `blocks` carried none either — that release genuinely
has no splits; but 10113/10123's gender analysis lives ONLY in blocks, not content).

Where each wave's pack actually lives (all verified 2026-10-09):
- **Monthly 2025** — findings 9901 (Jun 3), 9932 (Jul 27), 9941 (Aug 25), 9947
  (Sep 21), 9948 (Oct). Each prints "Two-party preferred vote in every State &
  Territory: <month>" + an "Analysis by age" + a Women/Men 2PP block in release
  prose; One Nation's PRIMARY per group is noted inline per state (e.g. 9948 "Primary
  support for One Nation: 12%" per state) but a full primary-by-group table is NOT in
  the release text. Screenshot-era primaries by state, if wiki's sub-national rows
  carry them, come from somewhere else (PDF/video) — unverified this pass.
- **Jan 2026 weekly waves** — packs live in SEPARATE special findings, NOT the
  late-January roundup: 5–11 Jan → the 12-Jan "Bondi Shooting" special
  (`findings/alp-two-party-lead-is-smallest-since-the-federal-election-following-the-
  bondi-shooting-alp-52-cf-l-np-48`, Women 57.5/Men L-NP 53.5 etc.); 12–18 Jan →
  **finding 9967** (federal-voting-intention-january-18-2026). The late-January
  roundup (the URL on polls.json's 2026-01-11/01-18/01-25 rows) carries NO splits —
  its only line is the "contact Julian McCrann" paywall pointer.
- **13–16 Feb 2026** — findings 10113 (Feb 13) + 10123 (Feb 16), gender-2PP only.
- Eras already on the site: Nov/Dec 2025's releases print the full primary
  by-gender/age/state tables (that's what the hand-entered 2025-11-16 / 2025-12-14 /
  2026-02-01 ROYMORGAN_DEMO keys hold); Apr–May 2026 weekly gender/age hand entries;
  2026-07-31 country (10341); 2026-09-27 state/location (10363, hand-owned — the
  OCR machine-read era begins here and data/roymorgan-demo.json's `waves` is
  meanwhile EMPTY: "fortnightly machine reads since late Sep" = exactly one wave,
  and it is hand-owned).

Schema consequence (why they can't just be keyed in): the site's demographics store
is **primaries-only per group** — no wave in data/demographics.json carries any
2PP-by-group dim (checked: zero tpp/2pp fields anywhere). Filing these eight packs
therefore needs a NEW measure/dim decision in the vote-by-group pipeline (schema +
gen-data + panel consumers), not a ROYMORGAN_DEMO hand-entry job. The 2PP figures
themselves (ALP v L-NP per state/gender/age band, monthly Jun→Oct 2025, weekly Jan,
fortnight Feb) are well-sourced in release prose — a future "2PP by group" facet
could consume them verbatim from the fetched blocks.
