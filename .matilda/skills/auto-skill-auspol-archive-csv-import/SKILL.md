---
name: auspol-archive-csv-import
description: auspol-tracker — bulk-importing an external poll-archive CSV
  into the repo (mirror verbatim → adjudicate → assimilate → verify → proof
  JSON) as run for d-j-hirst/aus-polling-analyser on 2026-09-11 (374 VI +
  373 leadership rows, commit 83fb6d7). The verification battery (firm-aware
  best-of-date fidelity, era-mean orientation, idempotence dry-run) and the
  cyclePollBases vehicle for Σ≠100 adjudications generalise to any future
  archive import; complements per-pollster live extractors, which look
  nothing like this.
source: auto-skill
extracted_at: '2026-09-12T00:00:00.000Z'
---

# Bulk-importing an external poll-archive CSV (worked: aeforecasts, 83fb6d7)

Use when folding a *whole external database dump* (another aggregation
project's CSV/JSON, a dead-house archive, a scrape cache) into
`data/polls.json`. This is NOT the per-pollster extractor shape — one
refresh script + one idempotent assimilator, not a pipeline with repair
agents. The bonham-additional-aeforecasts run is the canonical instance;
audit results and artefact names live in auspol-pollanalyser-gap-audit.

## Artefact layout — ONE stem for everything

Pick one stem (`bonham-additional-aeforecasts` here — the user named it) and
stamp it on every artefact so future-you can `git grep`:

- `data/<stem>.csv` — the verbatim upstream mirror.
- `.build/refresh-<stem>.mjs` — re-downloads the upstream file, rewrites the
  mirror. Mirror is **cells-verbatim**: no transforms, no normalising at
  mirror time (matches the roymorgan-table-mirror convention).
- `.build/assimilate-<stem>.mjs` — the importer that folds rows into
  polls.json. Idempotent by construction (re-run = 0 inserts).
- `.build/<upstream-shortname>-src/` — cached upstream copy +
  `assimilate-proof.json` (see Proof file below).

## Assimilator adjudications (the design decisions to make ONCE, explicitly)

- **Era-renaming**: archives mangle house identity across eras (upstream
  had "Morgan"/"Roy Morgan" spanning 1943→2026). Re-home by era boundary
  (≤2016 → `Morgan`, ≥2019 → `Roy Morgan`) per bucket, not by string
  passthrough.
- **Identity minus volatile columns**: wave identity = date+firm(+basis);
  EXCLUDE `oth` from Morgan clash identity (printed tables varied whether
  minors were itemised inside or outside it) — otherwise spurious
  "conflicts" between the same wave's two renderings.
- **Dedupe classes, reported separately**: date-dup (same date+firm, keep
  ours), figure-dup (different values, same identity — investigate, default
  keep ours), conflicts (log, never silently overwrite curated rows).
- **Scope guards from the user decision**: which rows are polls[]-eligible
  (current-term only if the house is APC-methodology-verified; upstream
  Morning Consult turned out to be approvals-only — all VI columns `#N/A`
  upstream, so ZERO current-term rows materialised), which stay CSV-only
  (pre-1987 rows were later imported 39de76c as era cycle buckets 1974–1987
  via .build/bootstrap-pre1987-cycles.mjs; pre-1974-05 rows remain CSV-only).
- **Reported-only**: never renormalise upstream figures; if a bucket's
  sums legitimately stray from 100, handle via `cyclePollBases` (see
  auspol-pollsjson-schema §4), not by patching rows.

## Verification battery (run BEFORE validating; each caught something real)

1. **Idempotence**: immediate dry re-run must report 0 inserts,
   `changed:false`. (GL date-dup re-checked itself: 403 on first apply.)
2. **Fidelity sample — firm-aware best-of-date**: a naive
   `join(date,firm)` sample scored 31/42 with 11 phantom "mismatches".
   Causes: upstream has same-MidDate DIFFERENT-firm collisions (date key
   alone lies), and upstream `MidDate` (fieldwork midpoint) sits ~4d off
   curated end-dates. Re-match allowing ±window and nearest-firm → 42/42
   exact. Don't trust a fidelity number until the matcher is era/firm aware.
3. **Era-mean orientation**: before/after import, bucket-mean ALP2PP by
   house-year (Morgan 44.2 vs Newspoll 43.5 in 1987–90) — bulk rows must
   move the mean, not break it.
4. **Git-diff attribution via the proof file** (shared repo!): sibling
   sessions edit polls.json too. `assimilate-proof.json`
   `{inserted:[{where,row}], glInserts, dateDup, figureDup, conflicts}`
   lets you prove which diff hunks are yours (we verified +59 Newspoll/
   −AGB 1990 rows were the sibling's legitimate archive fix, not ours —
   our proof listed none of them). Inserted rows carry NO in-file marker;
   the proof file IS the provenance trail.
5. **Mirror-coverage cross-check can 0 out legitimately**: spot-checking
   new Morgan rows against `data/roymorgan-*.csv` returned 0/13 — correct;
   the mirror tables simply don't cover those windows. Absence of the
   comparator isn't absence of the data.

## Gate + ship sequence

`node .build/newtracker/validate.mjs` until `errors 0` (Σ≠100 notes into
`cyclePollBases` first), then rebuild (`node .build/newtracker/build.mjs`)
so the cycle-source asset rotates, then stage ONLY owned paths + commit
(defer to auspol-shared-repo-session-race; siblings were mid-commit
throughout and two rebuilds landed on the same deterministic hash — just
rebuild on the raced state, don't force).
