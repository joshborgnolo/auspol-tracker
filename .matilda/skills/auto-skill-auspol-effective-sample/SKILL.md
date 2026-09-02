---
name: auspol-effective-sample
description: "auspol-tracker — per-poll effective sample size IMPLEMENTED (2026-09-02): optional per-poll sampleEff field (house-published effective n from APC methodology statements), absent-not-zero like undecided/tpp_flows; gen-data rowN() gives nEff = sampleEff ?? min(sample||1200, 3000)/HL_DEFF — HL_DEFF (1.6) applied ONLY on the derived path, never re-applied to a published value. Sibling field methodUrl (shipped 2026-09-02) carries the wave's APC statement LINK (YouGov CloudFront PDF / Newspoll Pyxis statement page; validator check 2c2). Extract/live pipeline: .build/extract-sampleeff.mjs + sampleeff-updater.sh + sampleeff-update.yml (poll-agent reusable, Mon 07:15 AEST) + sampleeff-repair-prompt.md. Statement caches in .build/sampleeff-src/. Known dead-ends: Pyxis Newspoll statements pre-2025-11 pruned (404, not in Wayback) and stop at 2026-01, DemosAU MRP prints 'n/a for MRP' (never stamped), YouGov Australia-Institute commissioned waves have no statement."
source: auto-skill
extracted_at: '2026-09-02T00:00:00.000Z'
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

## Coverage at launch (34/63 APC-statement rows stamped)

YouGov 16/21 (Sky News Pulse / News24 Pulse / Public Data, 2025-12→),
Essential 10/12, DemosAU 5/9, Newspoll 1/17 (2025-11-20 only).
Documented gaps, all deliberate:
- **Pyxis/Newspoll statements pre-2025-11-20 are pruned**: 404, not in
  Wayback. Cannot be recovered.
- **DemosAU MRP statements print "n/a for MRP"** for effective sample —
  extractor parses it as `{na:true}` (a note, not a hole); MRPs are
  NEVER stamped.
- **YouGov Australia-Institute commissioned waves** (2025-10-30,
  2026-03-19) are not YouGov GUS releases — no statement exists.
- Rows newer than the statement archive (e.g. the latest Essential wave)
  stamp on a later run; the wrapper extracts only CHANGED rows and
  no-ops otherwise.
- **Houses with NO statement leg at all are never stamped** — the
  extractor has sources only for Newspoll/YouGov/Essential/DemosAU.
  Resolve Political Monitor has no leg (0/16 rows stamped at ship), and
  neither do Roy Morgan, RedBridge/Accent, etc. Their Eff. n values are
  always the derived `min(sample,3000)/1.6` (muted in the table); a
  "where does X's effective sample come from" question about any
  unstamped house has the answer "nowhere published — it's the standing
  convention". Stamping such a house means writing a NEW extractor leg,
  not configuring the existing ones away.

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

## Copy homes (move together)

Same-place edits, both done at ship:
- weighted-aggregate glossary entry (asset d1a1d215, infoTerms) — nᵢ
  sentence now reads "its published effective sample where the house
  files one (Newspoll, YouGov, Essential and DemosAU, via their
  Australian Polling Council methodology statements), else its raw
  sample", plus the note that nᵢ also sets the seFloor.
- build.mjs static-summary "About this tracker" paragraph — same
  sentence before the CI paragraph.
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
- Expanded-poll detail (ArchPollDetail metaItems): conditional
  "Effective sample n = X" meta-md item, rendered ONLY when
  `sampleEff != null`.
- CSV export: single `Effective sample` column (sampleEff; empty
  where the house filed none).

## methodUrl — APC statement LINK, sibling of sampleEff (shipped 2026-09-02)

Same extractor, same absent-not-zero convention: `methodUrl` carries the
wave's APC methodology-statement LINK (distinct from the sampleEff NUMBER
parsed out of it). Stamped by `.build/extract-sampleeff.mjs`, never by
hand; validate.mjs check "2c2" guards it (https shape + pollster ∈
{YouGov, Newspoll} — only those two houses have a statement source
reachable without paywall).

Sources and link forms:
- **YouGov** — the APC listing at
  yougov.com/about/methodology/australian-polling-council hands out
  statement-PDF hrefs on `d3nnbamw3dez3b.cloudfront.net/documents/…`;
  the PDF href IS the methodUrl. The listing is a ROLLING window, so
  pre-window waves (Nov 2025 and earlier) stay unlinked and unstamped
  rows never overwrite. Commissioned waves (Australia Institute
  2025-10-30, 2026-03-19) file no statement.
- **Newspoll** — Pyxis's sitemap.xml enumerates statement PAGES
  (`pyxispolling.com/methodology-statement/newspoll-D-M-YYYY`); the
  statement PAGE is the methodUrl, not the PDF it hosts, because Pyxis
  prunes the PDFs pre-2025-11 (they 404) while the pages persist. The
  /apc/ listing itself is JS-paginated with `?page=N` ignored server-
  side — the sitemap is THE enumeration. Pyxis stops filing Newspoll
  statements at 2026-01 (last: newspoll-19-01-2026), so post-Jan-2026
  Newspolls stay unlinked. `legNewspollLinks` matches rows ±7 days on
  `(p.published || p.date)`; no Chrome, no PDF fetch.

Coverage at ship: YouGov 19/22, Newspoll 7/17 (2025-07-17 → 2026-01-16).
Status line gained a `methods` count; the extractor stamps links only
for unstamped rows (never overwrite), ambiguity on >1 distinct href
matches = the same error convention as sampleEff conflicts.

Surface path: schema describes it; gen-data emits `methodUrl`
conditionally in BOTH emitters (archive ~:943, pollsterTable ~:999);
a11e1559 defines `MethodLink` (sibling of `PollsterName`) rendered in
the Latest-table pollster cell AND in PollLedger as an
"APC methodology statement" PdSec beside "Pollster's release"; the
archive table (d1a1d215) renders MethodLink in its pollster cell above
the tag chips; template.html styles `.pollster-method` after
`.pollster-mode`; check-citations.mjs sweeps it (`add(p.methodUrl,
"methodUrl")`, +26 URLs at stamp); README data-fields bullet beside the
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
