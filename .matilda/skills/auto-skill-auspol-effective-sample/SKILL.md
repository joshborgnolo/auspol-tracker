---
name: auspol-effective-sample
description: "auspol-tracker — per-poll effective sample size IMPLEMENTED (2026-09-02): optional per-poll sampleEff field (house-published effective n from APC methodology statements), absent-not-zero like undecided/tpp_flows; gen-data rowN() gives nEff = sampleEff ?? min(sample||1200, 3000)/HL_DEFF — HL_DEFF (1.6) applied ONLY on the derived path, never re-applied to a published value. Filing houses with a sampleEff leg: Newspoll, YouGov, Essential, DemosAU, and (from 2026-09-04) RedBridge/Accent — a fully OFFLINE leg reading the committed .build/redbridge-src caches, 8 waves stamped. Sibling field methodUrl (shipped 2026-09-02) carries the wave's APC statement LINK (YouGov CloudFront PDF / Newspoll Pyxis statement page-or-PDF / RedBridge usrfiles PDF / DemosAU statement PDF off its own index — with a release-PDF fallback (added 2026-09-02) that parses a needing row's own url when it is a demosau.com wp-content PDF, since the house posts statement-bearing report PDFs it never lists / Essential's ONE living disclosure PDF shared by every covered wave and refreshed in place when re-uploaded — the only leg allowed to overwrite; validator check 2c2). Extract/live pipeline: .build/extract-sampleeff.mjs + sampleeff-updater.sh + sampleeff-update.yml (poll-agent reusable, Mon 07:15 AEST) + sampleeff-repair-prompt.md; plus (2026-09-04) an accent-only ride-along inside redbridge-updater.sh — `extract-sampleeff.mjs accent` right after a changed:true extract, so the new wave's eff joins the same commit. Statement caches in .build/sampleeff-src/. Since commit 212282c (2026-09-04) extract-sampleeff.mjs also treats each statement's raw `Sample size` row as authoritative for the row's `sample`, re-parses the committed caches offline every run, and corrects stale press-rounded samples (first data pass 0a280d6 fixed 13 waves, including YouGov 2026-06-16 1500→1492). Pyxis enumeration: the LIVE collection JSON API (sitemap.xml froze at 2026-01 in a CMS migration — never enumerate it). Known dead-ends: DemosAU MRP prints 'n/a for MRP' (never EFF-stamped — but its statement PDF still lands as the wave's methodUrl), YouGov Australia-Institute commissioned waves have no statement, DemosAU 2026-01-06's release URL is a Capital Brief article page (no demosau.com PDF to fall back on)."
source: auto-skill
extracted_at: '2026-09-04T01:05:29.530Z'
---

# Per-poll precision: what is stored, what is derived (auspol-tracker)

## Implemented state (shipped 2026-09-02)

- `data/polls.json` rows carry `sample` (raw n) plus OPTIONAL `sampleEff`
  (published effective n, inserted right after `sample`; 34 rows at
  launch). Absent-not-zero convention, same as `undecided`/`tpp_flows`:
  no field = fall back to the derived path, it is NOT a zero.
- `data/polls.schema.json` describes it; `validate.mjs` check "2d" guards
  it (integer, ≥200, ≤ 1.05×`sample`).
- `gen-data.mjs`: single helper `rowN(p)` (~:187-199, defined alongside
  the house-effects constants where `SAMPLE_CAP`/`HL_DEFF` live):

      rowN(p) = p.sampleEff != null ? p.sampleEff * HL_DEFF
                                    : min((p&&p.sample) || 1200, SAMPLE_CAP)

  rowN returns a RAW-SAMPLE-EQUIVALENT n: everything downstream still
  divides by `HL_DEFF` to get effective n, so a published `sampleEff`
  must be re-inflated by 1.6 here — that way `rowN(p)/HL_DEFF` recovers
  exactly the published effective n, and the derived path is unchanged
  (`min(sample||1200, 3000)/1.6`). NEVER apply another DEFF to a
  published value: it already contains that wave's design effect.
- All eight n-derivation sites call rowN: tppRows(:200), tppRowsSynth(:212),
  primaryRows (in-loop), altRowsFor(:432), apprHE(:481), apprN(:525),
  dirSample(:628-630), und(:882). No `Math.min(...1200...)` survives
  outside rowN.
- Consumers as before: monthly 2PP/primary means (weights AND se), the
  `seFloor` of the live aggregate estimate, per-poll CHG_MEASURES
  change-CIs/significance.

## Coverage after the 2026-09-02 DemosAU release-PDF backfill (53/63 APC-statement rows stamped)

YouGov 16/21 (Sky News Pulse / News24 Pulse / Public Data, 2025-12→),
Essential 10/12, DemosAU 8/9, Newspoll 17/17 (2025-07-17 → 2026-08-28 —
the Pyxis CMS migration re-hosted every wave's statement PDF, so the
earlier "pre-2025-11 pruned, unrecoverable" gap closed; the backfill
stamped the 16 missing rows on the day the feature shipped).

Added 2026-09-04 (commit 6f12336): **RedBridge/Accent 8/16** — the Accent
APC statement's "efficiency … effective sample size of N" sentence sat in
every committed redbridge-src \*.txt cache all along; a new OFFLINE leg
(`legAccentEff`, zero network — it reads the caches the redbridge
extractor already commits) backfilled the eight cached waves
Dec-2025 → Aug-2026: 776/782/762/774/815/764/857/808 against raw samples
of 1003–1014. Still unstamped by design: the waves with no Accent page at
all (2025 AFR-only releases, 2026-03-27), the 2026-05-14 MRP (no cache;
every house's MRP precedent), and the plain-"Redbridge"
Australia-Institute row (exact-pollster match keeps "Redbridge" and
"RedBridge / Accent (MRP)" rows away from Accent records).

Documented gaps, all deliberate:
- **DemosAU MRP statements print "n/a for MRP"** for effective sample —
  extractor parses it as `{na:true}` (a note, not a hole); MRPs are
  NEVER stamped.
- **YouGov Australia-Institute commissioned waves** (2025-10-30,
  2026-03-19) are not YouGov GUS releases — no statement exists.
- Rows newer than the statement archive (e.g. the latest Essential wave)
  stamp on a later run; the wrapper extracts only CHANGED rows and
  no-ops otherwise.
- **DemosAU 2026-01-06 is never stamped** — that wave's release URL is a
  Capital Brief article page, not a demosau.com PDF, so the release-PDF
  fallback below can't reach it and no statement sits on the index.
- **Houses with NO statement leg at all are never stamped** — the
  extractor has sources for Newspoll/YouGov/Essential/DemosAU/
  RedBridge-Accent. Resolve Political Monitor has no leg (0/16 rows
  stamped at ship), and neither does Roy Morgan nor any other
  non-filing house. Their Eff. n values are always the derived
  `min(sample,3000)/1.6` (muted in the table); a "where does X's
  effective sample come from" question about any unstamped house has
  the answer "nowhere published — it's the standing convention".
  Stamping such a house means writing a NEW extractor leg, not
  configuring the existing ones away.

## Extractor + live pipeline

- `.build/extract-sampleeff.mjs` — parseApcStatement scans EVERY
  "effective sample size" occurrence (statements put the number both
  before and after the phrase; stop at "margin of error", first ≥3-digit
  non-± number); `{na:true}` for "n/a for MRP"; fieldwork date = LAST
  year-carrying date token on the fieldwork block (general fallback);
  Essential disclosure dates tolerate their `\d{2}-[A-Za-z]{3}-?\d{2,4}`
  typos ("08-Dec25"); ygStatementDate falls back to current year (or
  current−1 if >2 days in the future) when a statement names no year.
  Per-statement try/catch (warn + continue) — one fetch failure must not
  poison a leg. Guards (exit 2, never fires): eff out of range, eff >
  raw sample, two statements conflicting on one wave. Final line prints
  `SAMPLEEFF_STATUS {...changed, stamped...}`; atomic polls.json write,
  exit 0.
- `.build/sampleeff-src/` — committed statement-text cache (reviewable
  diffs between runs).
- `.build/sampleeff-updater.sh` — weekly wrapper (extract → validate →
  render-card → build → commit → push), modelled on demosau-updater.sh;
  git-add list includes `assets/` because gen-data reweights.
- `.github/workflows/sampleeff-update.yml` — poll-agent.yml caller,
  Mon 07:15 AEST, `apt_packages: poppler-utils`; repair prompt
  `.build/sampleeff-repair-prompt.md`.
- Ride-along inside the RedBridge pipeline (added 2026-09-04):
  `redbridge-updater.sh` runs `node .build/extract-sampleeff.mjs accent`
  immediately after a `changed:true` extract, so the new wave's
  sampleEff/methodUrl rides the same commit instead of waiting for the
  weekly sweep. `extract-sampleeff.mjs [leg]` takes an optional
  positional leg filter; the gate `node .build/extract-sampleeff.mjs
  accent` skips every network leg (offline only). Failure aborts the
  redbridge commit like any other step.

## Raw `sample` reconciliation (added 2026-09-04: extractor 212282c, data 0a280d6)

The same APC statement that supplies `sampleEff` also supplies the wave's
RAW `Sample size`. The bug addressed on 2026-09-04: waves first recorded
from rounded press copy (`"about 1,500"`) kept that rounded figure forever,
because later extractor runs only met the statement while stamping an
unstamped `sampleEff`. The 2026-06-16 Sky Pulse wave was filed as **1492**
while the row said 1500; its statement's 969 remained the correct
`sampleEff`.

The tail pass in `.build/extract-sampleeff.mjs` now re-parses the
COMMITTED `.build/sampleeff-src/*.txt` caches offline on every run — zero
network cost and deterministic reviewability:

- YouGov resolves its one relevant cache URL-exactly from
  `methodUrl`: `yougov-` + sanitised statement filename (truncated at 60
  chars). This deliberately avoids matching News24/Sky/Public Data waves
  by fieldwork date, because separate statements can cover the same week.
- Newspoll and DemosAU date-match their statement cache's parsed
  fieldwork end to the row within ±1 day; DemosAU MRP caches are pooled
  by filename (`mrp`). Essential rides the living disclosure table from
  the current leg, with the committed `essential-disclosure.txt` cache as
  offline fallback.
- RedBridge/Accent is not a raw-sample reconciliation source: its
  `redbridge-src` caches feed sampleEff/methodUrl legs, but are not in
  `samplePools`.
- Guards are hard stops (`SAMPLEEFF_STATUS`, exit 2): filed sample must
  be 400..60,000 and must sit between 0.5× and 2.0× the value being
  replaced; >1 filed value for one row is an ambiguity, not a coin flip.
- Missing `sample` is non-destructively inserted after `client`; an
  existing differing sample is corrected in place and logged
  `sample old→new (source)`. Status gains `samples:n`, and
  `changed = stamped || methods || samples`; any of the three triggers
  the atomic polls.json write.

First reconciliation pass (data commit 0a280d6) corrected 13 waves:
Newspoll 2025-09-11 1283→1264; Essential 2025-12-08 1300→1030,
2026-04-27 1002→1067 and 2026-05-24 1027→1062; DemosAU (MRP)
2026-03-03 8424→8484; YouGov 2026-03-10→08-10 from press-rounded 1500 to
its filed 1425/1501/1502/1501/1504/1492/1519/1511. The 2026-06-16
approval row also gained Taylor `opp:-10` with `detail.opp` 37/47 from
the same user-supplied Sky Pulse report.

## Copy homes (move together)

Same-place edits, both done at ship (house list extended 2026-09-04 to
add RedBridge / Accent when its eff leg landed):
- weighted-aggregate glossary entry (asset d1a1d215, infoTerms) — nᵢ
  sentence lists the filing houses "(Newspoll, YouGov, Essential,
  DemosAU and RedBridge / Accent, via their Australian Polling Council
  methodology statements), else its raw sample", plus the note that nᵢ
  also sets the seFloor.
- build.mjs static-summary "About this tracker" paragraph — same
  sentence before the CI paragraph.
- archive-panel "Eff. n" legend (asset d1a1d215) — same house list,
  with "Resolve and Roy Morgan file none".
- gen-data.mjs rowN comment header — same house list; edited with the
  three copy sites above.
- README.md data-fields table has `sampleEff`; README layout section
  lists `.build/sampleeff-src/`.

## Display surfaces (Eff. n, shipped 2026-09-02; published-only same day)

Display shows ONLY the house-filed figure. The estimator's derived
weighting n (`rowN(p)/HL_DEFF`) is internal and is never surfaced
per-poll — first cut emitted both and showed derived values muted,
which read as us claiming precision the house never published; user
rejected it ("i only want eff n if provided by houses… neither does
roy morgan"). Resolve and Roy Morgan file nothing, so they dash.

- gen-data emits per-row `sampleEff` only (archive + pollsterTable
  emitters); the per-row `nEff` field was REMOVED — the remaining
  `nEff`s in the data asset are aggregate Kish counts
  (`altLatest`/`synthLatest`/`alp2ppNEff`), leave them alone.
- Archive table (d1a1d215): non-sortable "Eff. n" column immediately
  after "Sample" (`hide-md`, drops ≤1000px) — sparse column
  (36-of-157 rows), non-sortable because ranking a sparsely-filled
  provenance-specific column misleads. Value rows render the filed
  figure with a provenance `title`; unstamped rows render a muted
  "—". Per-facet `colCount` and empty-row colSpans were bumped with
  it; the provenance legend (names which houses file, dash =
  unpublished not unknown) sits at the end of the archive
  `table-hint`.
- Expanded-poll detail: conditional "Effective sample n = X" item with the
  APC provenance title in BOTH expanded meta bands since a174788 (Latest
  PollDetail in a11e1559 AND ArchPollDetail metaItems in d1a1d215 — the
  band is class-less at every width; the earlier meta-md / pd-meta-sm /
  meta-dup width-hide scheme is dead, see auspol-detail-meta-band),
  rendered ONLY when `sampleEff != null`.
- CSV export: single `Effective sample` column (sampleEff; empty
  where the house filed none).

## methodUrl — APC statement LINK, sibling of sampleEff (shipped 2026-09-02)

Same extractor, same absent-not-zero convention: `methodUrl` carries the
wave's APC methodology-statement LINK (distinct from the sampleEff NUMBER
parsed out of it). Stamped by `.build/extract-sampleeff.mjs`, never by
hand; validate.mjs check "2c2" guards it (https shape + pollster ∈
{YouGov, Newspoll, RedBridge / Accent, RedBridge / Accent (MRP),
DemosAU, DemosAU (MRP), Essential} — only
those houses have a statement source reachable without paywall).

Sources and link forms:
- **YouGov** — the APC listing at
  yougov.com/about/methodology/australian-polling-council hands out
  statement-PDF hrefs on `d3nnbamw3dez3b.cloudfront.net/documents/…`;
  the PDF href IS the methodUrl. The listing is a ROLLING window, so
  pre-window waves (Nov 2025 and earlier) stay unlinked and unstamped
  rows never overwrite. Commissioned waves (Australia Institute
  2025-10-30, 2026-03-19) file no statement.
- **Newspoll** — Pyxis MIGRATED CMS around the 2026-01 wave:
  pyxispolling.com/apc/ is now JS-rendered from a PUBLIC collection
  JSON API — `https://pyxispolling.com/api.php/collection/6909661a09b83573fd004fe4/items?limit=200&order=columns.date_DESC`
  (apiHost = location.host + "/api.php" in the app bundle; the raw
  cms.sitehub.io service needs auth). `pyxisStatements()` maps each
  federal item (slug `newspoll-D-M-YYYY`, Sydney publication date) to
  its statement PDF at `columns.file.url` — PDFs resolve ONLY via the
  `/api.php/images/document/<id>/…` prefix (the bare path 404s). The
  migration FROZE `sitemap.xml` at `newspoll-19-01-2026` and removed
  statement PAGES for post-migration waves (the seven old stamped
  pages — 2025-07 → 2026-01 — still resolve and stay linked via the
  never-overwrite rule), so for post-migration waves the PDF itself is
  the methodUrl, matching YouGov's shape. Anything that describes the
  OLD enumeration (sitemap.xml as "THE enumeration", "Pyxis stops
  filing at 2026-01", "pruned PDFs") is stale — this note replaced it
  on 2026-09-02 after the user saw live 2026 statements the sitemap hid.
  `legNewspollLinks` matches rows ±7 days on `(p.published || p.date)`;
  both Newspoll legs now run with no Chrome and no rendering at all.
- **RedBridge / Accent** (added 2026-09-02 as methodUrl-only; the
  sampleEff leg followed 2026-09-04 — see the coverage block above) —
  NO network fetch at all: `legAccentLinks()` re-reads
  the `pdfUrl` field already cached in `.build/redbridge-src/*.json` by
  extract-redbridge.mjs's Chrome-click resolver (an Accent project page
  yields its usrfiles.com methodology-report PDF URL ONLY to a clicked
  `[data-hook="file-upload-viewer"]` widget — never in static HTML or
  the Wix page-model JSON, so do not try to fetch it statically). Match
  is EXACT on cache `date` = row fieldwork end (not ±days); pollster
  prefix-matches so "RedBridge / Accent (MRP)" rows are covered. Two
  Accent pages fall outside the extractor's sitemap regex
  (afr,-…-federal-poll slugs only) and live as a two-entry constant in
  the leg: the Oct-2025 snapshot (2025-10-07) and the MRP
  "a fragmented electorate" (2026-05-14), hrefs captured 2026-09-02 by
  the one-off probe `.matilda/probe/accent-pdfurl.mjs` (a standalone
  copy of scrapeProjectPage) and verified 200 application/pdf.
  Deliberately unlinked: the six waves with no Accent page at all
  (2025 AFR-only releases, 2026-03-27, 2026-08-28) and the
  plain-"Redbridge" Australia-Institute row 2026-02-12 (commissioned
  wave — same precedent as YouGov's AI waves, which file no statement).
- **DemosAU** (added 2026-09-02, the same day) — the ONLY leg whose
  source is the house's own public index page:
  demosau.com/methodology-statements/ is plain HTML, curlable with a UA
  header, no Chrome; `legDemosau` regexes statement-PDF hrefs
  (demosau.com/wp-content/uploads/<YYYY>/<MM>/…pdf) out of the index,
  fetches each new one and caches pdftotext output in
  `.build/sampleeff-src/demosau-*.txt`, then parses with the shared
  `parseApcStatement`. Both link forms ride ONE record shape:
  `{na:true}` statements (the MRPs) parse sample + fieldwork-end off
  their Australian-order d/m/y dates ("13/01/26 -03/03/26") and push a
  LINK-ONLY record (the sampleEff matcher filters `r.eff != null`; the
  methodUrl matcher dates these n/a records onto "(MRP)" rows, ±1 day).
  The leg's need-months widen to rows missing sampleEff OR methodUrl
  (mirrors the YouGov leg), since post-sampleEff-era DemosAU waves
  (2026-08-20) need only the link. RELEASE-PDF FALLBACK (added
  2026-09-02 after the index-only leg missed real statements): the
  house posts statement-bearing Capital Brief/report PDFs without
  listing them on the index, so after the index pass the leg re-reads
  every needing DemosAU row and parses the row's own `url` when it is
  itself a demosau.com wp-content PDF (href = the release URL, pollster
  taken from the row). The 2026-09-02 backfill stamped 2025-07-06
  (762/1199), 2026-02-20 (1008/1551 — the cover's "Effective Sample
  Size: 1008" beats the disclosure row's 1006 because the parser stops
  at the first number) and 2026-07-08 (1532/2694) off exactly this path.
  Still unlinked by design: 2026-01-06 (release URL is a Capital Brief
  article page, not a demosau.com PDF) and the 2026-07-11 MRP (release
  URL is a news page) — verified live 2026-09-02 that the index lists
  only two MRP statements (OctNov-2025 report, FebMarch-2026 model); if
  a July MRP statement ever posts, the weekly sampleeff-updater picks
  it up. URL/METHODURL SPLIT (also 2026-09-02, user-asked): every
  DemosAU wave whose row `url` equalled its statement PDF (Feb, Apr,
  May, Jul, Aug 2026 + the FebMarch MRP) was re-pointed so `url` =
  the wave's Capital Brief article/newsletter (`url` is the table's
  "DemosAU" name link; the same-page-as-method duplication read as a
  bug) while `methodUrl` keeps the demosau.com PDF. 2025-07-06 keeps
  `url` == `methodUrl` — the Capital Brief partnership began Jan 2026,
  so that wave has no article. Consequence for extract-demosau.mjs's
  row-url verify leg: re-pointed rows drop out of PDF verification the
  same way the Jan rows always were (Feb/Jul-Aug statements aren't
  index-listed either) — acceptable, values stay hand-authoritative.
  RELEASELINK (same session, also user-asked): each of those six rows
  (plus pre-split 2026-01-21, same shape) ALSO gained
  `releaseUrl` = the same demosau.com PDF, so the capitalbrief-cited
  rows still show a "Pollster's release" link in the expanded poll
  pointing at the DemosAU-hosted report. `releaseUrl` ==
  `methodUrl` there by design — PollLedger merges the two surface
  PdSecs into one release line carrying the "(includes the wave's APC
  methodology statement)" note; a11e1559 defines it once for BOTH
  tables. 2026-01-06 still has neither (no demosau.com PDF exists for
  it).
- **Essential** (added 2026-09-02, same day) — the odd one out: ONE
  living disclosure-statement PDF the house appends each wave to and
  re-uploads (essentialreport.com.au/wp-content/uploads/<YYYY>/<MM>/
  Essential-Report-Disclosure-Statement-Full-Questionnaire.pdf), linked
  off essentialreport.com.au/methodology ("…can be found here").
  `legEssential` re-reads that href off /methodology EVERY weekly run
  and its records carry `href`, so every covered wave shares the one
  living URL. That makes Essential the ONLY leg allowed to OVERWRITE
  an existing methodUrl: a dedicated block before the main stamper
  refreshes any covered row whose stored link differs from the current
  href (logs "(refreshed)"), because a re-uploaded PDF at a new URL
  would otherwise strand eleven rows on a dead link — nothing per-wave
  is preserved, so nothing is lost. Coverage matching is by the
  disclosure table's `end` column ±1 day: a wave the house has not yet
  appended (the brand-new release sits in this gap by design — at ship,
  2026-08-31) keeps NO link until the house appends it, after which the
  next weekly run stamps it. The same leg already parsed the survey-
  details table for sampleEff, so the link rides the existing fetch.

Coverage: YouGov 19/22, Newspoll 17/17 (2025-07-17 → 2026-08-28: seven
statement-page links + ten post-migration PDF links),
RedBridge / Accent 9/16 (seven cache-derived + the two constant entries;
the other seven stay unlinked by design as listed above), DemosAU 10/12
(seven index statement PDFs incl. two of the three MRP waves, plus
2025-07-06 / 2026-02-20 / 2026-07-08 via the release-PDF fallback;
2026-01-06 and the 2026-07-11 MRP stay unlinked by design — neither
wave has a fetchable demosau.com PDF), Essential 11/12
(living PDF shared across waves; 2026-08-31 links once the house
appends it).
Status line gained a `methods` count; the extractor stamps links only
for unstamped rows (never overwrite — EXCEPT the Essential leg above,
whose shared living URL must refresh), ambiguity on >1 distinct href
matches = the same error convention as sampleEff conflicts.

Surface path: schema describes it; gen-data emits `methodUrl`
conditionally in BOTH emitters (archive ~:943, pollsterTable ~:999);
a11e1559 defines `MethodLink` (sibling of `PollsterName`) rendered in
the Latest-table pollster cell AND in PollLedger as an
"APC methodology statement" PdSec beside "Pollster's release"; the
archive table (d1a1d215) renders MethodLink in its pollster cell above
the tag chips; template.html styles `.pollster-method` after
`.pollster-mode`; check-citations.mjs sweeps it (`add(p.methodUrl,
"methodUrl")`, +36 URLs once Newspoll's 2026 waves linked, +9 more
when the RedBridge / Accent leg landed, +7 for the DemosAU leg,
+11 for the Essential leg → 63 entries, though Essential's eleven
resolve to one living URL);
README data-fields bullet beside the
`sampleEff` one.

## Rules

1. Do NOT store per-poll `moe` — it is derived from the effective n; the
   estimator needs n, not the quote.
2. `HL_DEFF` is applied only inside rowN's derived branch. If per-house
   DEFFs ever land, root them as `pollsterRules.<house>.deff` constants
   (like `tppIncludesUndecided`) and re-check the copy homes AND the
   CHANGE-significance flags.
3. Never weaken the extractor guards (range check, eff > raw sample,
   same-wave conflict, YouGov same-series rule).
4. Display-only per-poll "± x.x pts" remains possible with no schema
   change; any such figure must respect auspol-ci95-scales (share-scale
   vs lead-scale = 2×).
