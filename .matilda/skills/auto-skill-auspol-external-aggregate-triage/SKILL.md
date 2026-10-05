---
name: auspol-external-aggregate-triage
description: auspol-tracker — "our aggregates are way off Bonham / Poll Bludger / BludgerTrack" triage. Verify raw rows against coverage BEFORE doubting the estimator, fetch comparators with as-of dates — SINCE 5bf0e64 (2026-10-02) committed mirrors + a validated Bonham-method replica do this for you (data/bludgertrack-2pp.json, data/bonham-2pp.json + extractors, .build/newtracker/bonham-replica.mjs, .build/check-bonham-replica.mjs; both lines chartable on the hero "Compare outside estimates" toggle — see auspol-external-aggregate-overlays; NB the BludgerTrack mirror now takes the feed's ALP2out trend-line series — FIXED efbc280 2026-10-02, was ALP2in the scatter-DOT series until then; feed anatomy below), then decompose with a parity-gated estimator replica one toggle at a time. Structural knowledge: BT+Bonham build 2PP from primaries→flows and SINCE THE 2026-09-18 BASIS TOGGLE (6cdfa7e) OUR DEFAULT DISPLAYED 2PP IS TOO (synthLatest = primaries × frozen AEC-2025 flows) — the hero line is already like-for-like with them; latest.alp2pp keeps the published-pair basis (its wedge vs implied ≈ flowDrift, −0.7pt Sep 2026); displayed "current" primaries are calendar month-to-date vs BT smoothing (+2 ONP gap in the Secret Harbour shock, vanished to ≤0.4 under a 21d primary nowcast on identical data); Newspoll/Resolve/DemosAU print no 2PP so the published-pair window is 4 houses.
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
     **The whole series also fetches as ONE PLAIN-CURL FILE** (found
     2026-10-02): `…/bludgertrack/xml/current.xml` — the shell page merely
     renders it. `federal/charts` points (163 on 2026-10-02, spanning
     05/19/2025→; date attr US MM/DD/YYYY) carry TWINS per measure:
     `ALPin/LNCin/…` are per-release READINGS (raw poll-down values — look
     at `ALPin`: plain poll primaries, and `ALP2in` can whip 65.5→51.3
     in two days) and `ALP2out/LNC2out` is his smoothed outlier-excluded
     TREND. **His published figure is the OUT series, not IN** (audited
     2026-10-02, `.matilda/bt-line-accuracy-2026-10.md`): his own
     `js/voting.js` draws 2out as the 3px line with 2in as scatter DOTS,
     and the page's headline 2PP (`<federal><summary><alp2><current>`,
     52.2 that day) equals ALP2out (52.179), not ALP2in (52.376). Any
     comparison against "BludgerTrack's estimate" must use 2out; 2in ran
     mean 0.97pt / max 3.1pt away from it over the term (mostly ALP-low,
     Feb–May 2026 the worst era). Our own mirror got this wrong until
     efbc280 (2026-10-02): extract-bludgertrack.mjs mirrored 2in; it now
     reads 2out and refreshes 4×/day inside pollbludger-updater.sh —
     see auspol-external-aggregate-overlays for the wiring.
     **Back-revision is asymmetric** (tested via 5 Wayback captures of
     current.xml 2025-09→2026-05): 2in points are ~immutable once issued
     (3 micro-revisions, max 1.47pt, always fresh points), while 2out
     back-casts EVERY issue across the whole history (all overlapping
     points moved in every capture, up to 1.8pt) — a 2out mirror must
     re-fetch on a schedule, not once.
     `federal/table` = the same poll records our fallback agent reads. For a
     bulk as-of-now comparison this beats the Chrome route; use the piggyback
     only if the XML's provenance is in doubt. Wayback replays of this file
     (`web.archive.org/web/{ts}id_/…`) arrive gzip-compressed — `curl |
     file` won't decompress; gunzip before parsing (found the hard way:
     captures looked "empty").
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
   - **Silver Bulletin (Nate Silver)**: US-ONLY — Trump net approval,
     generic congressional ballot, Musk favourability; NO Australian
     average (verified 2026-10-03), so "compare with Nate Silver" asks
     are METHODOLOGY-only, never topline-vs-topline. Pages, free/
     paywalled split, Substack extraction recipe and his published
     method summary live in `auspol-silver-bulletin-comparison`.
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

- **Measure convention** (rewritten 2026-10-02): BT and Bonham both
  aggregate PRIMARIES and derive 2PP through (their own) preference-flow
  estimates — Bonham's methods page states published 2PPs "do not affect
  the aggregate". Until 2026-09-17 our displayed headline likewise differed
  (published-pair nowcast), but the 6cdfa7e basis toggle made
  **synthLatest — primaries × the frozen AEC-2025 flow table — the site's
  DEFAULT 2PP basis** (gen-data emitter comment at :4506), so the hero
  line is now construction-like-for-like with BT/Bonham and only the
  recipe differs (their evolving flow models vs our frozen 2025 table,
  plus window/half-life/inclusion choices). The published-pair basis
  survives as `latest.alp2pp`; published-vs-implied still carries the
  standing wedge (our `flowDrift` said −0.7pt, Sep 2026). As-of read on
  2026-09-09: `synthLatest:` (n=9) 51.8 vs published headline 51.1 vs
  BludgerTrack 52.1.
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
- **ALP-v-ON divergences are flow-table + pooling, not noise** (Sep 2026
  user triage; basis corrected 2026-10-02): BOTH estimator lines in this
  pairing are primary-derived. Bonham's One Nation Shadow-2PP = "my
  conversion" — his own estimate of 2025 ALP-v-ON preferences (72% of
  Coalition, 9% of Greens voters flow to ON) applied to each poll's
  primaries, pooled as the average of the ten most recent polls with at
  most two per pollster, no house effects or accuracy/age weighting
  (methods-page update log 28 Jan / 15 Feb / 22 Feb / 11 Mar 2026; his
  Jul 2026 post says the same conversion feeds his Coalition aggregate).
  The RESPONDENT-ALLOCATED story belongs to the five pollsters'
  *published* shadow-2PPs (Morgan, RedBridge/Accent, YouGov, Spectre,
  Fox&Hedgehog — his Sep 2026 "flat field" post critiques them: ~half
  of Coalition voters conventionally copy Coalition how-to-vote cards,
  so stated splits mis-model real ballots for this exact pairing); they
  are NOT his inputs. An earlier version of this note claimed his
  sidebar figure leans on those published pairs — wrong, deleted.
  Our `onImp` figure runs primaries through the frozen counted-ballot
  FP_ON set (see auspol-flow-drift-panel). Live comparison (Sep 2026):
  51.8–48.2 (his) vs 50.7–49.3 (ours) — a 1.1pt gap, inside our printed
  ±1.1 band. Cite HIS critique when a reader cites a pollster's
  respondent-allocated ON pair rather than re-deriving the argument.
- Morgan's weekly cadence and any small-house presence are style differences
  that move ≤0.6pt in arms — don't burn triage time there before checking the
  three structural items above.

## Deliverable shape

A dated write-up under `.matilda/` with: comparator table (source URL + as-of
per figure), per-measure decomposition table, adjudication list, probe
appendix (replica path, parity line, arm log). Comparator HTML snapshots to
`/tmp/`. Verify `git status` shows the tracked tree untouched — only
ignored `.matilda/` scratch changes.
