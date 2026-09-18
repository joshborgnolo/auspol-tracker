---
name: auspol-external-aggregate-triage
description: auspol-tracker — "our aggregates are way off Bonham / Poll Bludger / BludgerTrack" triage. Verify raw rows against coverage BEFORE doubting the estimator, fetch comparators with as-of dates (BT = JS-rendered page via Chrome piggyback; Bonham's sidebar isn't on his homepage), then decompose with a parity-gated estimator replica one toggle at a time. Structural knowledge: BT+Bonham build 2PP from primaries→flows while our headline uses PUBLISHED pairs (standing wedge ≈ flowDrift, −0.7pt Sep 2026); our current primaries are calendar month-to-date vs BT smoothing (+2 ONP gap in the Secret Harbour shock, vanished to ≤0.4 under a 21d primary nowcast on identical data); Newspoll/Resolve/DemosAU print no 2PP so the published-pair window is 4 houses.
source: auto-skill
extracted_at: '2026-09-09T03:25:09.823Z'
---

# External-aggregate divergence triage (auspol-tracker)

When a user reports "our numbers are very different from Bonham / Poll
Bludger": this is a TRIAGE task, not an immediate estimator edit. The first
run (2026-09-09, write-up `.matilda/divergence-vs-bonham-bludger-2026-09.md`)
fully explained a 2–3pt divergence with zero bugs found. Companion skills:
`auspol-headline-estimator` (our constructions map), `auspol-estimator-arms-race`
(replica + parity-gate recipe).

## Procedure

1. **Verify the raw rows first.** Dump recent rows from HEAD `data/polls.json`
   (clean clone, never the shared tree) and eyeball any extreme poll against
   primary-source coverage. Worked example: YouGov 1–8 Sep 2026 wave (ALP 26 /
   LNP 18 / ONP **30**) looked impossible; it matched Poll Bludger, news.com.au
   and The Conversation verbatim (post-Secret-Harbour shock). If every extreme
   row verifies, the divergence is construction, not data.
2. **Fetch comparators with as-of dates.**
   - **BludgerTrack**: `https://www.pollbludger.net/fed2028/bludgertrack/` is
     JS-rendered — plain curl/web_search extraction returns headers only. Use
     `node .build/chrome-article.mjs <url>` (see chrome-session-piggyback).
     Figures live in `google-visualization-table` cells; the authoritative 2PP
     sits in a hidden `<table><thead><th>Party</th><th>2pp</th>` block. No
     update stamp on the page — record the fetch time.
   - **Bonham**: as of Sep 2026 his SIDEBAR carries two live figures —
     `Federal 2PP Polling Aggregate 52.3-47.7 TO ALP · Last update 8 Sep
     (YouGov)` and `One Nation Shadow-2PP Estimate 51.8-48.2 TO ALP vs ON`
     — and both extract by plain curl of the monthly archive
     (`https://kevinbonham.blogspot.com/YYYY/MM/`, browser UA, ~370KB
     static HTML; strip tags and grep the prose around `TO ALP`). Poll
     Roundup POSTS are the stale route (May 2026 roundup was 4 months old
     in Sep) — prefer the sidebar over re-fetching roundups. Method
     statements (MAIN aggregate only, he publishes no shadow-ON methods
     page): `/2025/09/2025-2028-2pp-aggregate-methods-page.html`.
   - Independent check on fresh polls: The Conversation (Beaumont) and
     news.com.au poll write-ups extract cleanly via web_search.
3. **Decompose with a parity-gated replica**, never by staring at outputs.
   Copy HEAD gen-data + `flows.mjs` + `house-renames.mjs` + `atomic-write.mjs`
   into `.matilda/scratch-<topic>/` (scratch lives in `.matilda/` — `.gitignore
   `.matilda/*` keeps it untracked automatically; BOGAN refuses /tmp writes),
   sed-patch `ROOT`/`DATA_ASSET`/`CYCLE_SOURCE_ASSET` (ROOT → clean /tmp
   clone, assets → /tmp paths), append a probe tail (module consts are all
   reachable at file END), and require the probe to reproduce gen-data's own
   console line (`headline 2PP: { alp, n }` — both value AND window count)
   before trusting any arm. Toggle ONE choice per arm: inclusion set
   (drop Morgan), wave exponent (√m→m), house effects null, flat weights,
   window/half-life, implied-2PP, and for primaries: calendar-month vs
   21-day nowcast.
4. **Report as write-up, not edits.** Classify every contributor deliberate-
   methodology vs candidate-bug; bugs go to the arms-race procedure, never a
   same-session estimator change.

## Structural facts that explain most of any gap (Sep 2026 state)

- **Measure convention, biggest wedge**: BT and Bonham both aggregate
  PRIMARIES and derive 2PP through (their own) preference-flow estimates —
  Bonham's methods page states published 2PPs "do not affect the aggregate".
  Our headline uses PUBLISHED pairs. When published pairs industry-wide run
  from flow-implied (our own `flowDrift` says −0.7pt now), a standing wedge
  of that size is EXPECTED. The like-for-like comparator to BT/Bonham is our
  **implied-2PP diagnostic**: gen-data console's `synthLatest:` line
  (n=9 — the larger panel), which read 51.8 when the published-pair headline
  read 51.1 and BludgerTrack 52.1.
- **Published-pair panel thinning**: Newspoll, Resolve and DemosAU (Sep 2026)
  publish no 2PP — the window panel is Morgan/YouGov/Essential/RedBridge only
  (gen-data's `houseEffects (2PP)` + window dumps show it). Treat internal
  spread of the nowcast (Essential-adj 48.7 vs Morgan-adj 54.5 in the same
  week) as a panel property, not an estimator fault; watch for A2-style
  degradation if more houses drop pairs.
- **Calendar-month primary fragility**: displayed "current" primaries are the
  month-to-date mean (see headline-estimator skill). Early in a month during
  a shock it is a 2-poll, shock-pure panel; the same data through a 21-day
  primary nowcast tracked BludgerTrack to ≤0.4pt on every party. This asymmetry
  vs BT's smoothing is THE expected primary-gap generator.
- **Bonham's 2025–28 conventions** (from his methods page, for arm design):
  7-day smoothed; age-decay ×0.618/week from release day; only the 2 heaviest
  polls per pollster; accuracy weights 0.5–1.5 from post-2022 election tables
  (new pollster 0.8); NO sample-size weighting (n<900 halved); house effects
  only ≥0.5pt; excludes commissioned, SMS-majority, undecided≥10%, and polls
  with data >1 month old.
- **ALP-v-ON divergences are flow-table basis, not noise** (Sep 2026 user
  triage): Bonham's One Nation Shadow-2PP leans on the five pollsters'
  published shadow-2PPs (Morgan, RedBridge/Accent, YouGov, Spectre,
  Fox&Hedgehog) — ALL respondent-allocated per his own Sep-2026 post, where
  he notes ~half of Coalition voters conventionally copy Coalition
  how-to-vote cards, so stated splits mis-model real ballots for this exact
  pairing. Our `onImp` figure instead runs primaries through the frozen
  counted-ballot FP_ON set (see auspol-flow-drift-panel). Live comparison:
  51.8–48.2 (his) vs 50.7–49.3 (ours) — a 1.1pt gap, inside our printed
  ±1.1 band, and pointing exactly the way his own how-to-vote-card critique
  predicts (respondent-allocated reads redder). Cite HIS critique when
  defending ours rather than re-deriving the argument.
- Morgan's weekly cadence and any small-house presence are style differences
  that move ≤0.6pt in arms — don't burn triage time there before checking the
  three structural items above.

## Deliverable shape

A dated write-up under `.matilda/` with: comparator table (source URL + as-of
per figure), per-measure decomposition table, adjudication list, probe
appendix (replica path, parity line, arm log). Comparator HTML snapshots to
`/tmp/`. Verify `git status` shows the tracked tree untouched — only
ignored `.matilda/` scratch changes.
