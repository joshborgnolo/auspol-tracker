---
name: roymorgan-table-mirror
description: auspol-tracker — .build/refresh-morgan-archive.mjs mirrors Roy Morgan's four roymorgan.com/morgan-poll table pages into data/roymorgan/*.csv (ONE CSV PER SOURCE TABLE, verbatim cells — "as stored upstream") and GENERATES archives/morgan/index.html (never hand-edit it). NOT the same pipeline as extract-roymorgan-archive.mjs (one-time normaliser → data/roymorgan-primary-vote.csv / two-party-preferred.csv used by the tracker). Gotchas: long-term pages carry header rows as <th> (match <t[dh]>, not just <td> — its silent symptom is a CSV missing its ",ALP,L-NP" header row); year-banner rows are single-cell colspan rows; no <thead>/<rowspan> upstream; page-table mapping is positional with a count guard; run has an --offline mode reading .build/morgan-archive-src/ cached snapshots (which ARE committed to the repo).
source: auto-skill
extracted_at: '2026-09-03T00:00:00.000Z'
---

# auspol-tracker: Roy Morgan verbatim table mirror (refresh-morgan-archive.mjs)

## Purpose and separation of concerns

Two Roy Morgan archive pipelines exist — do NOT conflate:

- **`.build/refresh-morgan-archive.mjs`** (b89d44e, 2026-09-03) — the VERBATIM MIRROR.
  Replicates all four `roymorgan.com/morgan-poll/*` table pages cell-for-cell into
  `data/roymorgan/*.csv` (one CSV per source table) and renders
  `archives/morgan/index.html` (GENERATED — header comment says do not hand-edit).
- `.build/extract-roymorgan-archive.mjs` — a ONE-TIME normaliser that folded the same
  source pages into the tracker's consolidated, cleaned reference series
  (`data/roymorgan-primary-vote.csv`, `data/roymorgan-two-party-preferred.csv`). Don't
  rerun it against the mirror outputs; don't extend the mirror to imitate its
  normalisation (election flags, paren-Nat splits, `##`/`<` handling) — the mirror's
  whole point is zero transformation.

## Running it

- `node .build/refresh-morgan-archive.mjs` — fetch the four pages live (desktop-Chrome UA,
  plain `fetch`), cache them, rewrite CSVs + page.
- `node .build/refresh-morgan-archive.mjs --offline` — rebuild from
  `.build/morgan-archive-src/*.html` cache (no network). The caches are COMMITTED to the
  repo — a live run dirties them; stage them with the regenerated outputs, don't leave
  half-updated pairs.

## Source map (PAGES array order = render order)

1. `two-party-preferred-voting-intention` → 4 tables: `roymorgan-2pp-election-results`
   (headRows:1), `roymorgan-2pp-weekly` (headRows:2, grouped header spans [1,3,3] —
   respondent-preferences vs 2022-flow variants), `roymorgan-2pp-weekly-2022-2024`,
   `roymorgan-2pp-weekly-2018-2022` (headRows:2, spans [1,2,2]).
2. `primary-voting-intention` → 3 tables: `roymorgan-primary-election-results`,
   `roymorgan-primary-weekly` (first body row is a "Change" row, NOT a header),
   `roymorgan-primary-weekly-2013-2022`.
3. `two-party-preferred-voting-intention-long-term-trend` → `roymorgan-2pp-long-term`.
4. `primary-voting-intention-long-term-trend` → `roymorgan-primary-elections-by-year`
   (3-row summary), `roymorgan-primary-long-term`.

Tables are matched POSITIONALLY (tables[i] ↔ spec[i]) and the page aborts if the count
differs ("page structure changed?"). 10 tables ≈ 1,949 rows ≈ 242 KB of rendered HTML.

## Hard-won extraction rules (each was an actual bug)

- **Match `<t[dh]>`, never `<td>` alone.** The two long-term pages mark header rows with
  `<th>`; a `<td>`-only regex silently drops them — symptom: the CSV's first line is data
  instead of `,ALP,L-NP`. Found after the first live run wrote headerless long-term CSVs.
- **No `<thead>` upstream** — headers are ordinary rows; each table's spec lists
  `headRows` (1 or 2) and optional `spans` for grouped two-row headers. Check rows against
  a live fetch if RM restructures, and update `headRows`/`spans` together.
- **Year-banner rows** (`2025`, `2024`, …, and event-note rows like "September 7, 2013 —
  Tony Abbott leads …") are single-cell `<tr>`s, stored in CSV as ONE cell (year banners
  had `colspan="10"` in upstream HTML, mostly hidden in escaped JSON blobs — grep counts
  of literal `colspan=` under-report). Renderer maps them back to full-width
  `<td colspan=N>` rows (`span yr` bold vs `span note` italic by `\d{4}` test).
- **Cells stay verbatim**: `"53.0%"` keeps its %, `<0.5` and `##` stay literal (escape to
  `&lt;` when rendering HTML). Don't clean, coerce, or strip `n/a`.
- Root-relative links in the generated page (`/data/roymorgan/…`, `/archives/…`,
  `/assets/fonts/…`) are required — media pages sit at depth 2.

## Verifying a regen

Serve the repo (`nohup python3 -m http.server 8481 &` — see satellite-branding skill for
the background-server gotcha), then headlessly check `archives/morgan/index.html` in BOTH
prefers-color-scheme values: 10 `table.rm`, ~1,949 rows, first body cells of table #2 are
the dual-flow TPP header "Preferences distributed by how electors told us they should be"
(colSpan 3). Redirect check while you're here: `/newspoll-archive/#acnielsen` →
`/archives/acnielsen/`.

## When the upstream page changes

New weekly wave lands → live-rerun picks it up (long-term pages are frozen historical).
RM adds/removes a table → count guard throws; update PAGES specs. RM renames columns →
mirror keeps them verbatim; nothing else to do. If a section name changes, keep CSV
filenames stable (external links may point at them) — rename the caption, not the file.
Watching the paste-from-Word artefacts: roymorgan.com pages carry inline `style=` widths
and `height: 264px`-type noise; the mirror strips all of that (regex drops attributes),
capturing text+colspan only — that's intentional, not a parser gap.
