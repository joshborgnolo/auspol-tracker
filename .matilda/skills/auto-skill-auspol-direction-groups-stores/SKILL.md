---
name: auspol-direction-groups-stores
description: auspol-tracker — the national-direction GROUP-BREAKDOWN stores' write-side map (data/{essential,roymorgan,redbridge}-direction-groups.json + sec-direction-states.json), answering "does the <house> agent automatically get national direction breakdown data?". Essential, Roy Morgan and RedBridge/Accent are ALL fully automatic warn-only sidecars run by their updater wrappers every slot (RB machine-owned since 2026-10-23: extract-redbridge-direction.mjs files BOTH the headline direction[] rows and the breakdown store from the committed statement pdftotext caches — the RB hand-entry era ended 2026-10-23).
source: auto-skill
extracted_at: '2026-10-23T03:30:00.000Z'
---

# Direction-group stores — who fills them (write side)

These stores feed the Snapshot National-direction panel's group views
(gen-data.mjs ~:2144 essential store, §5 directionGroups ~:2393) and the
All-polls Direction facet's per-wave ledger breakdown (the gen-data `bg`
decoration — read/render side documented in auspol-direction-ledger-bg).
Headline `direction[]` rows in polls.json are a separate concern
(auspol-direction-data-entry); this skill is the BREAKDOWN stores only.

## Per-house automation state

| House | Store | Writer | Automatic? |
|---|---|---|---|
| Essential | `data/essential-direction-groups.json` | `.build/extract-essential-direction.mjs` | YES — every slot |
| Roy Morgan | `data/roymorgan-direction-groups.json` | `.build/extract-roymorgan-direction.mjs` | YES — every slot (since 2026-10-21) |
| RedBridge/Accent | `data/redbridge-direction-groups.json` | `.build/extract-redbridge-direction.mjs` | YES — every slot (since 2026-10-23) |
| SEC Newgate | `data/sec-direction-states.json` | (five-state pairs; see auspol-direction-ledger-bg) | pipeline-backed |

### Essential (extract-essential-direction.mjs, every slot)

- Reads the committed CSV mirror `data/essential-report.csv` (the
  "National mood (<group> Trend)" Flourish visuals — TOTAL + Male/Female +
  18–34/35–54/55+); banks `{waves: {date: {csv, r/w/u per band, dirRow}}}`
  keyed by the TRACKER date (csvDate − 1).
- Wired in `essential-updater.sh:131-175`, running AFTER the VI
  assimilator so a new wave's headline direction row is on file for the
  reconcile; on an otherwise-quiet slot a moved store triggers validate →
  rebuild → commit (`data/essential-direction-groups.json` + SITE_FILES)
  → push_main, all by itself.
- Wave clustering: a wave's six visuals can land days apart
  (WAVE_GAP=7d); a broken cluster / dropped band cell / sum-out-of-
  tolerance / reconcile-fail is a GUARD (exit 2) — never completed from
  row sums.
- Coverage is gender + three age bands ONLY. Essential has no vote-firmness
  / location / education cuts — don't promise them.
- validate.mjs `validateEssDirectionGroups` (~:1000): shape, r+w+u=100±2
  per band, and coverage — every Essential `direction[]` row must be
  claimed by exactly one wave's `dirRow`. Pinned by
  `test-essential-direction.mjs`.

### Roy Morgan (extract-roymorgan-direction.mjs, every slot, 2026-10-21)

- Reads the VI extractor's COMMITTED release caches ONLY
  (`.build/roymorgan-src/release-<slug>.json`) — NEVER a live fetch. A
  wave with no cache is noted and skipped; the release's national pair +
  fieldwork date is re-derived through `parseRelease` (RM_LIB mode) and
  must equal polls.json's head queue exactly or it guards.
- Banks the "Analysis by …" prose blocks: gender pair
  `{Men:{r,w}, Women:{r,w}}`, voting-intention WRONG-shares only (ALP row
  also prints right), and stateExtremes {highest,lowest}. The fortnights
  ALTERNATE which block prints (gender+vote / vote only / state extremes
  only) — ABSENCE OF A BLOCK IS NORMAL, not an error.
- Wired in `roymorgan-updater.sh:143-160` BEFORE the changed:false
  early-exit so a splits-only fortnight takes the sidecar commit path
  (:189-230, commits `data/roymorgan-direction-groups.json` among the
  sidecar FILES). Warn-only: exit 2 (moved prose anchor / recon drift) →
  WARN, nothing written, poll pipeline unblocked.
- PURE TEXT (no macOS Vision unlike extract-roymorgan-demo.mjs) — the CI
  twin of the updater files it too. Machine-filed waves re-parse every
  run and must reproduce the stored entry figure-for-figure (drift =
  exit 2, never an overwrite); the store's own shape is validated at
  load. Pinned by `test-roymorgan-direction.mjs`.

### RedBridge/Accent (extract-redbridge-direction.mjs, every slot, 2026-10-23)

- MACHINE-OWNED since 2026-10-23 — files BOTH the headline `direction[]`
  rows in polls.json (graduating the house from hand-entry, user call
  2026-10-23) and the breakdown store from the APC statements' occasional
  national-direction table. Never hand-add or hand-edit an RB row (one
  exception below). Modelled on extract-roymorgan-direction.
- Reads the VI extractor's COMMITTED statement caches ONLY
  (`.build/redbridge-src/<slug>.json` wave records + their pdftotext
  `<slug>.txt` twins) — NEVER a live fetch, never the 40MB PDFs (not
  cached). A wave record with no `.txt` twin is a guard. Parser lives in
  `.build/rb-direction-parse.mjs` (DIM_OF_HEADER 12 printed headers→dim
  ids, KNOWN_GROUPS row vocabulary per dim, figure-for-figure verified
  against the hand store at ship time).
- Detection: a cache prints the `Generally headed in the right direction`
  anchor or it doesn't — the section is OCCASIONAL (3 of 13 statements:
  Nov-2025, Jan-2026, May-2026); absent = quiet no-op, NOT an error.
  Present-but-unreadable anchor = guard (exit 2). Parse anchored on
  captions/wording, NEVER table numbers (they drift: 47–48 → 27 → 38).
- Filing: a section-bearing cache whose wave has no direction row files
  BOTH the polls.json row ({date,dateStart,pollster,right/wrong/unsure}
  from the table's ALL-VOTERS column — date-sorted, byte-stable write)
  AND the store wave {src:{url,tables}, total, dims}. A cache on a
  section-less wave that HAS a row = date-contract guard.
- Reconcile: every run re-parses every cache and must reproduce stored
  waves and rows figure-for-figure (drift = exit 2, never an overwrite).
  The June-2025 row (2025-06-30) is LEGACY hand provenance (November's
  trend figure; no statement cache covers it) — noted and left alone.
- Surfaced dims stay the hand-curated five (generation/vote-firmness/
  location/education/home ownership — gen-data optgroups); new printed
  dims are banked unsurfaced, and a wave arriving with a dim the store
  doesn't already know bumps the SURFACED_DIMS-watch NOTE.
- Wired in `redbridge-updater.sh` (~:80-108) BEFORE the changed:false
  early-exit so a section-only slot takes the sidecar commit path
  (validate → rebuild → commit `data/polls.json` +
  `data/redbridge-direction-groups.json` + SITE_FILES → push_main).
  Warn-only: exit 2 → WARN, nothing written, poll pipeline unblocked.
  Pure text, so the CI twin (redbridge-update.yml rides the same
  wrapper) files identically.
- validate.mjs `validateRbDirectionGroups`: ALLOWED_DIMS + per-wave
  reconcile of the printed all-voters total against the polls.json row
  (right/wrong exact, unsure row-derived) + int cells summing 100±1 —
  machine-banked waves need no roster (the hard-coded 3-date roster and
  trailing missing-wave loop were REMOVED 2026-10-23; provenance is the
  extractor's guard chain). test-direction-groups.mjs's expected set is
  store-derived (was exact-33). Pinned by `test-redbridge-direction.mjs`
  (5 groups, incl. tamper/guard-trip and row-refiling cases).

## Guardrails common to all direction-breakdown work

- Every machine pass is WARN-ONLY: a guard trip logs and writes nothing;
  the poll pipeline never blocks on breakdowns. Elevating a sidecar to
  blocking violates rule-3-era convention.
- A dropped/broken cell is a GUARD, never completed from sums or
  neighbouring rows.
- Machine-filed waves re-verify against the store every run; drift =
  guard, never a silent rewrite.
- Never invent or surface a breakdown a house didn't print — absence is
  the contract (per-wave, per-house), in the stores AND the renderer.
