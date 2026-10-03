---
name: auspol-vicpoll-satellite-plan
description: auspol-tracker — the PLANNED (not yet built) /vicpoll/ Victorian election satellite page, scoped 2026-10-03 with all user decisions locked. Read this before building anything Vic-related; records the landscape facts, the locked design decisions (satellite-not-toggle, /vicpoll/ name, orphan launch, watch+assisted collection), the data schema, and the file-touch list.
source: auto-skill
extracted_at: '2026-10-03T12:48:33.097Z'
---

# auspol-vicpoll — Victorian poll tracker satellite (PLANNED, not built)

As of 2026-10-03 NOTHING in this plan has been implemented — the planning
conversation ended before execution (plan mode exited while the approval gate
was running; "No action taken"). When the user returns to this, re-confirm the
green light before code, then execute from this plan; don't re-research the
landscape facts below (they were live-verified 2026-10-03).

**Deadline pressure: the Victorian election is Saturday 28 November 2026**
(fixed date). Ordered from the election, NSW is March 2027 — but do NOT build
state-general machinery now; name files `vic-*/vicpoll-*` and lift shared logic
when NSW comes.

## User-locked decisions (2026-10-03 — these were ask_user_question'd, don't re-litigate)

1. **Satellite page**, NOT a main-page logo-toggle mode (auspol→vicpoll→nswpoll
   idea rejected — that path is the "triples maintenance" one). Same as
   /prediction/ and /atlas/: generated standalone page, site shell, page-local
   kicker+h1 identity ("Vicpoll", like prediction's "Forecast" kicker).
   The satellite-shell masthead contract (see auspol-satellite-page-branding)
   stays untouched.
2. **Name/URL `/vicpoll/`** despite the VicPol=Victoria-Police collision —
   user was explicitly warned and picked it anyway.
3. **Orphan launch** — unlisted exactly like /atlas/ and /prediction/ (user's
   2026-10-02 lock: those two carry the shell but nothing links to them). NO
   footer door link, NO template.html/colophon/copy-home edits, NO main-page
   chrome. The ONLY main-build coupling: a sitemap route + stamp constant in
   `.build/newtracker/build.mjs` (search-engine discovery without on-site chrome).
   That choice emerged from plan-gate finding GF-1 — the plan had assumed the
   door link; the user was asked and chose orphan. Don't re-add it.
4. **Collection = watch job + agent-assisted extraction**, NOT full per-house
   deterministic extractors (Spectre-kit-for-7-houses burns the whole 8-week
   runway), NOT fully manual.

## Landscape facts (live-verified 2026-10-03)

- **Bootstrap goldmine**: `https://electiontracker.au/data/vic2026/polls.csv`
  — maintained machine-readable CSV, ~20+ waves, columns
  `id,pollster,commissioner,commissioner_type,fieldwork_start,fieldwork_end,
  sample_size,alp,lnp,onp,grn,others,eligible_for_average,eligibility_exception,source_url`.
  Seven pollsters: DemosAU, Freshwater (Herald Sun, xlsx data tables),
  Newspoll/Pyxis (The Australian, paywalled), RedBridge (incl. a trades-hall
  union-commissioned wave), RedBridge/Accent (AFR, accent-research.com
  projects-page slugs — same pattern as the federal extractor),
  Resolve Political Monitor (The Age), Roy Morgan (roymorgan.com/findings —
  SAME Next.js feed the federal RM extractor already reads; Vic releases are
  titled "Victorian state voting intention …").
- CSV has NO 2PP and NO leadership — those come from primary PDFs / Poll
  Bludger coverage (pollbludger.net Vic posts; the existing
  poll-figure-recovery ladder applies). Wikipedia's Vic polling table HAS a
  2PP column but part editor-estimated — do not import wiki 2PP without a
  published-source reference; wiki leadership tables are stale (the user's
  original complaint).
- **Leaders changed mid-cycle**: Premier Allan → **Ben Carroll (ALP) 28 July
  2026**; opposition **Jess Wilson (Lib, since Nov 2025)**; Greens Ellen
  Sandell. Leadership schema must be leader-keyed (Allan segment ends Jul
  2026, Carroll begins) — same PM-change discontinuity handling as federal.
- ONP polls ~23% primary in Vic — page needs the full 5-way
  ALP/LNP/ONP/GRN/OTH primary treatment. **No 2022 ONP lower-house baseline
  exists** (ONP barely contested 2022), so flows-implied 2PP is false
  precision — the headline estimate aggregates *published* 2PP only, and the
  method note says why.
- 2022 result baseline: ALP 2PP 55.0. Other trackers already live
  (Ace Strategies, Plain Politics) — differentiation is presentation, not
  scoops.

## Plan skeleton (approved-shape; gate findings GF-1/GF-2 resolved)

- **Data**: `data/vicpoll-polls.json` — `polls[]` {id, pollster, commissioner,
  fieldworkStart/End, sample, primary{alp,lnp,onp,grn,oth}, twopp{alp}|null
  (published only), sourceUrl, provenance}, `leadership[]` {date, pollster,
  series: premierSat|opponentSat|preferredPremier, premier: allan|carroll,
  opposition: wilson, values, sourceUrl}. Backfill: csv primaries + primary-
  source 2PP/leadership harvest; provenance field marks what's imported vs
  verified. SELF-VALIDATING — federal validate.mjs is NOT touched.
- **Page**: `.build/refresh-vicpoll.mjs` generator (validate + render) →
  `vicpoll/index.html` (never hand-edited; refresh-prediction.mjs precedent —
  generator composes numbers, page is dumb renderer, vanilla-JS SVG like
  atlas). Sections: published-2PP chart (recency-weighted aggregate, ~28d
  half-life, per-house dots — house effects NOT adjusted, ≤6 waves/house),
  5-way primary chart, leadership (PPM + net satisfaction), poll table,
  method note (constants + published-2PP-only policy + provenance credit +
  estimates-only disclaimer). Stretch: next-expected-polls.
- **Watch job**: `.build/vic-watch.mjs` + `.github/workflows/vic-watch.yml`
  (daily Sydney clock). Per-house discovery reuses federal layers (RM feed,
  Accent projects listing, DemosAU fingerprint, Newspoll Bing-RSS, Age
  coverage, Freshwater site) + weekly cross-check vs electiontracker CSV and
  Wikipedia (coverage-witness pattern). Novelty → deduped ci-alert via
  `.build/alert-issue.sh`. NOTHING auto-commits rows; assisted extraction =
  fetch release → healer-style faithfulness check (figures verbatim in source
  text) → append rows → user reviews diff.
- **Pinned landing path** (every wave, no improvisation — gate finding GF-2):
  `node .build/refresh-vicpoll.mjs` (fail-hard validate+regen) →
  `bash .build/git-push-main.sh "<msg>" data/vicpoll-polls.json vicpoll/index.html`.
  vicpoll/index.html rides its OWN file list (prediction-refresh.sh:80
  precedent) — do NOT add it to shared SITE_FILES in git-push-main.sh.
  Optional stretch: 30-line `.build/vicpoll-updater.sh` wrapper.
- **Shell coupling**: ONE entry `{ file: "vicpoll/index.html" }` in
  `SHELL_PAGES` + `applyShell()` in the generator (`.build/site-shell.mjs`).
  Deliberately untouched: template.html, feed.xml (federal stays federal),
  validate.mjs, agent-repair watch list.
- **Verify**: refresh --dry + diff; site-shell.mjs --check; test-site-shell.mjs;
  masthead-parity probe (auto-covers new page via SHELL_PAGES); npm test
  (test-workflows.mjs sweeps new workflows); headless geometry probes per
  auspol-headless-geometry-verify; post-push live verify per
  auspol-live-site-verify.
- **Off-ramp after 28 Nov**: freeze rows, final regen, drop cron from
  vic-watch.yml, page joins the archives family — zero-maintenance landing.

## Related seat-modelling Q&A from the same session

Asked whether census-2021 per-seat data + repo contents suffice for a quality
seat predictor: seats TPP/TCP by division live in `atlas/data/aec-2025/` +
`atlas/data/all_elections_2PP_by_division.csv` (2004+) — uniform/state-swing
models yes, true MRP no (no respondent-level geo data, no seat polls
ingested). User decided it wasn't this site's job — parked, probably not
reopening.
