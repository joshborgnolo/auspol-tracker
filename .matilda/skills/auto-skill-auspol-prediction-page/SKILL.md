---
name: auspol-prediction-page
description: auspol-tracker — the /prediction/ satellite page and its DAILY refresh loop end-to-end (shipped 2026-09-05 as fortnightly; switched to a daily record-per-date gate + monthly backcast chart same day in commit d0741fa): .build/refresh-prediction.mjs is the pure-append history writer + data-slot page regenerator (never hand-edit prediction/index.html), driven by .build/prediction-refresh.sh and .github/workflows/prediction-refresh.yml (03:00 UTC, main-writers group). Due-gate is now "no record exists for today's Sydney date yet" — the ANCHOR/INTERVAL_DAYS fortnightly machinery was REMOVED. The page carries a frozen BACKCAST chart (16 foresight-blind monthly points baked as a literal in the generator, extended by live daily records) injected as a plain template var, NOT a data-slot. PREDICTION_STAMP in .build/newtracker/build.mjs is the page's sitemap lastmod — bumping it only ever rebuilds sitemap.xml. Model numbers come from the two analysis scripts run with --json (reelect-snapshot-hazard.mjs --age=N, reelect-term-ridge.mjs), which read origin/main:data/polls.json via git show — so the refresh only sees polls that are COMMITTED AND PUSHED. When the training record itself grows (era import added six terms; recompute shipped 2026-09-14 as 8aa8dcd), a full-recompute path is needed: extend both model scripts, regen the frozen BACKCAST literal, replay history --force --as-of, migrate page copy with EVERY baked anecdote re-verified against fresh runs — see "Recompute when the training record grows" below.
source: auto-skill
extracted_at: '2026-09-05T00:00:00.000Z'
---

# auspol-tracker: /prediction/ page + daily refresh loop

## The pieces

- `prediction/index.html` — **GENERATED, never hand-edit**. Static-article chrome
  (satellite recipe, see auto-skill-auspol-satellite-page-branding) with `data-slot="…"`
  spans/p's the generator rewrites each refresh + a `const PRED_DATA = [...]` script block
  appended from `data/prediction-history.json`. First read shipped 2026-09-05 (asOf =
  data date, not run date).
- `data/prediction-history.json` — append-only `{records:[{asOf, sl, o:{median,lo,hi,
  shareOuster}, s:{…slot strings…}}]}`; each due+changed refresh appends ONE record and
  rewrites the whole `PRED_DATA` block from it (pure-append: corrupt file = hard fail,
  no silent reseed).
- `.build/refresh-prediction.mjs` — the generator. Flags: `--if-due` (default in the
  wrapper; DAILY gate since d0741fa — due only when the history has no record for
  today's Sydney date; the old ANCHOR=2026-09-19 + INTERVAL_DAYS=14 fortnightly
  machinery was removed, and a forced same-date run replace-in-places that day's
  record), `--force`, `--as-of=YYYY-MM-DD` (probe/backfill). Ends with exactly ONE
  `PRED_STATUS {"due":bool,"changed":bool,"wrote":[...]}` line — the wrapper parses THIS,
  nothing else. Exit non-zero on any failure. Guardrails: band-index/ageFrac/live-read
  range/profile sanity; slot text falls back when a number jumps >50pp (median) or >60pp
  (band edge) between records so prose never contradicts the figure.
- `.build/newtracker/build.mjs` — `PREDICTION_STAMP` const lives in the `LAST_UPDATED`
  block; the sitemap route triplet for `/prediction/` takes lastmod from it (home `/` and
  others unchanged). The generator bumps the stamp to the newest record's asOf; the wrapper
  then runs the FULL `node .build/newtracker/build.mjs` (not a partial sitemap build —
  there is no partial mode) and stages only `sitemap.xml` from the output, proving the
  rest of the site is byte-stable. **If prediction/ ever gets folded into the main build,
  the wrapper's staging list is the fold-in point** (comment in script).
- `.build/prediction-refresh.sh` — wrapper (daily slot runner): skip if working tree
  dirty → else `git fetch + merge --ff-only origin/main` (diverged → log "skipping slot",
  exit 0; the next slot retries) → generate → if due+changed: `validate.mjs`, `build.mjs`,
  stage `data/prediction-history.json prediction/index.html .build/newtracker/build.mjs
  sitemap.xml`, commit `Refresh re-election model read as at <asOf>`, push via
  `.build/git-push-main.sh`'s `push_main`. All steps log one line to
  `.build/logs/prediction.log`. Args: `--force`, `--as-of=…` (force implies if-due+force).
- `.github/workflows/prediction-refresh.yml` — daily 03:00 UTC, `main-writers`
  concurrency group (see auto-skill-ci-main-writer-races); pages-403 push failures are
  tolerated the same way the poll updaters tolerate them (rerun next slot).
- `.build/probe-prediction.mjs` + `.build/prediction-repair-prompt.md` — read-only probe
  (15 checks: history record invariants — strict asOf sort, 0≤lo≤median≤hi≤1,
  shareOuster/inSample/liveP in [0,1], features finite, govAge positive int, age ≤33.5 —
  PREDICTION_STAMP == newest asOf, page PRED_DATA mirrors the history asOf list and its
  o fields, every `data-slot` attr covered by the newest record's slot map, good PRED_DATA
  latest == history latest, and the generator still emits the PRED_STATUS contract with
  its due-gate) and the Matilda repair-job prompt that prediction-refresh.yml's repair
  job runs when the update job fails. The probe's failure mode is precisely written so
  the repair agent's first step is to run it.

## The model drivers (--json contract)

Both analysis scripts gained `--json` (silence prose, emit one machine-readable line at
EOF) WITHOUT changing default behaviour — a default run is byte-identical to before. The
trap hit during shipping: an early `--json` path printed the JSON via `console.log`
AFTER `console.log` had been muted — JSON vanished. Emit with `process.stdout.write`.

- `node .build/analysis/reelect-snapshot-hazard.mjs --json --age=16.2` — snapshot/hazard
  model (the picked one). `--age=N.N` ∈ (0,36] is the current term's snapshot age;
  default stays the README-canonical 16.2. Emits
  `{age, ousted:{median,lo,hi,shareOuster}, inSample, features:{…}, profile:[…bands…]}`.
  Bootstrap is seeded (42) → deterministic across runs on the same data; two consecutive
  refreshes with no new polls are `changed:false` no-ops.
- `node .build/analysis/reelect-term-ridge.mjs --json` — the comparison ridge row.
- BOTH read `git show origin/main:data/polls.json`, so the page sees only pushed data.
  The wrapper's ff-only sync runs first so `$PWD` data == origin/main data.

Model internals, feature windows, validation numbers: auto-skill-reelection-signature-models.
Generator slot strings derive from the emitted `features` (pmNet → `−19`, tppSw → level
`52.3 vs 55.2 at the election`, govAge → ordinal "2nd term" with the GovAge===2 Gillard
aside, etc.) — new slots follow the same pattern and get both a probe check and a
`data-slot` in the page.

## The monthly backcast chart (shipped d0741fa)

- A `<figure class="pred-chart">` sits between the hero figure (`</figure>` after
  `.pred-fig`) and `<h2>What this number is</h2>` — a static inline SVG baked by the
  generator, NOT a data-slot and NOT in PRED_DATA (page-level static, identical for
  every record; the selector doesn't swap it). Probe row 13 passes precisely because
  it has no `data-slot` attr — future per-generation statics should follow the same
  plain `${var}` template pattern, never the slot map.
- Data: `BACKCAST` — a frozen literal of 16 `[ageMonths, oustedMedian, lo, hi]` rows,
  one per 1st-of-month of the term, computed 2026-09-05 by running
  `reelect-snapshot-hazard.mjs --json --age=<N>` at each month-start (ages 0.95–15.97;
  trailing-3-month features cut at that date = foresight-blind). Live records with
  `age > lastBackcast + 0.05` extend the line at generation time, so the daily loop
  grows the series point by point without ever recomputing the frozen rows.
- Rendering facts: y-axis is RE-ELECT % (`100·(1−p_ousted)` — plot-space flips the
  band: top = `re(lo)`, bottom = `re(hi)`); house tokens only (`--accent` band at
  opacity .16, `--ink` median/dots, `--line-2` grid, 50-line dashed); month ticks
  every 3 via `addDays(ELECTION_DATE, round(m·30.4375))`; the `<figure>` carries
  role="img" + a DATELESS aria-label and the inner svg is aria-hidden — never bake a
  value into the aria text, the line moves daily.
- Cadence flip in the same commit touched ~10 copy sites (generator header, page
  banner, metaDesc, selnote, reproduce para, wrapper/workflow/repair-prompt/build.mjs
  comments) — grep `fortnightly|ANCHOR|INTERVAL` when changing cadence again.

## Recompute when the training record grows (2026-09-14, 13→19 terms)

Trigger: the era-cycle import (39de76c, see auspol-era-cycle-import) grew the
completed-term record in polls.json from 13 to 19 (terms opening 1974–1987,
F2F Morgan primaries + LEF-implied tppEra). A daily refresh does NOT apply a
new training set — recompute the whole page. Two user decisions were made up
front (start any future recompute by asking these): (1) **full recompute** —
regenerate the frozen BACKCAST AND replay `--force --as-of` for every lived
history record, so the whole series reflects the new-model numbers even though
the live model genuinely said the old ones at the time (records are knowingly
backdated); (2) **era tpp used as-is** for tppSw (LEF-implied, no adjustment
for the missing leadership features on era rows).

Steps (each verified before moving on):

1. **Model scripts first** (both, in lockstep — page copy compares them):
   TERMS list 1987– → 1974–2022; WIN/outcome sets gained 1972/1974/1975;
   govAge = election-sequence walk over the full record; era rows contribute
   primaries + implied tpp ONLY (no pmNet/ppmNet features — leave those
   undefined-not-zero). Numbers: hazard bands 68/79/79/79/68/76/fin 79 at ages
   6/12/15/18/24/30/fin, AUC 0.75, Brier 0.185, 131 snapshots; ridge A2
   13/19=68% (Brier 0.178), B λ=1 15/19=79%, liveP 0.2454; Wilson on 13/19 ≈
   [46%, 85%]; part-3c best A2+spill+minor 74% / AUC 0.81 / Brier 0.153.
2. **Regen the BACKCAST literal**: re-run `reelect-snapshot-hazard.mjs --json
   --age=N` at each of the 16 month-start ages on the NEW training set and
   swap the 16 `[age, median, lo, hi]` rows in refresh-prediction.mjs; point
   the literal's header comment at the page's era note.
3. **Replay history**: for each lived record `--force --as-of=<date>`, then a
   plain `--force` for today. Verify invariants after: record count
   (10 = 2026-09-05…09-14), strict asOf sort, monotone ages. Every run must be
   PRED_STATUS ran:true/changed:true. The daily loop needs nothing — next slot
   reads origin/main data through the new scripts by itself.
4. **Copy migration — verify EVERY baked anecdote against fresh runs.** The
   page copy encodes ~15 numbers keyed to the term count AND to specific band
   values that SHIFT with the training set. Four claims nearly shipped wrong
   off 13-term-era memory, caught only by re-running the models: 1990
   month-12 hazard = 0.7729 → write 77%, not 76%; 1977 hazard bands never
   exceed 0.3838 — the >50% tip for the 1977–80 government exists ONLY in
   ridge-B (λ=1 live read p=0.54), so attribute it to "the cross-check model",
   NEVER to the page's headline hazard model, or the page's own numbers
   contradict the prose; era terms spanning <30 months are THREE (1974 18.9,
   1980 28.5, 1983 20.9), not two; losers already ≥0.5 ouster at month 6 =
   THREE of six (0.572/0.912/0.560), not four. Also scope historical-audit
   copy that must stay 13-term: the feature-audit paragraph now reads "(run
   over the 1987-and-later thirteen-term record, before the era extension)" —
   its 0.77→0.84 / 0.182→0.153 figures are pre-extension and correct as such.
5. New page copy shipped with the recompute: "A note on the six oldest
   terms…" (no published 2PP pre-1983 → modelled from first preferences +
   historical flows; irregular era parliaments; three terms never saw a
   three-year read — matches the termRows `b > t.span ? "·"` guard).
6. **Ship = exactly 8 files**: reelect-snapshot-hazard.mjs,
   reelect-term-ridge.mjs, .build/analysis/README.md, refresh-prediction.mjs
   (copy + BACKCAST), prediction/index.html (regenerated, never hand-edited),
   data/prediction-history.json (replayed), build.mjs (PREDICTION_STAMP —
   auto-bumped by the refresh runs), sitemap.xml (lastmod). **NOT index.html**
   — the prediction page builds outside the main build; the main site is
   untouched. Gates before commit: probe-prediction.mjs 15/15, validate.mjs
   0 errors, build.mjs clean, then grep the generated page for the new copy
   markers ("six oldest terms", "nineteen", "a hundred and thirty-one
   snapshots", "68-to-79-per-cent").

## Racing origin/main while editing a generator + its artifact

When another session lands commits touching the same generated file (hit 2026-09-05:
upstream swapped the prediction page's favicon to `/assets/favicon.svg` while this
loop was being edited): adopt upstream's GENERATOR-side change into your local
generator FIRST, regenerate, commit, then rebase — identical changes on both sides
merge to identical content instead of a conflict in a 14k-line artifact. Proof the
merge is self-consistent: after the rebase, re-run the generator with `--force` and
require `PRED_STATUS … "changed":false, "wrote":[]` (merged source regenerates the
merged artifact byte-for-byte), then probe 15/15, then `git push origin HEAD:main`.

## Verified invariants (probe encodes these)

- Second `--if-due` run on unchanged data: `changed:false, wrote:[]` (idempotent).
- Full `build.mjs` after a refresh with asOf == existing `PREDICTION_STAMP`:
  `git status` shows NO sitemap.xml modification (stamp already correct).
- `validate.mjs` clean before every scheduled commit.
