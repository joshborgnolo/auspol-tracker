---
name: auspol-vic-satellite-plan
description: auspol-tracker — the /vic/ Victorian election satellite, SHIPPED 2026-10-03 (landing commit 69f0061 as /vicpoll/, renamed /vic/ by user call the same day; election day 28 Nov 2026). Read this before touching anything Vic-related — records the locked user decisions, the shipped data schema + estimator constants, the wikitext heading-level regex trap (ED-15, wiki ==== era headings mis-filed dozens of leadership rows), the data-legitimate null-cell allowance, and what remains UN-built (CI/launchd watch cadence). The overnight vic-polish builder↔reviewer loop that grinds the page toward the main-page standard is its own skill: auspol-vic-polish-loop.
source: auto-skill
extracted_at: '2026-10-03T12:48:33.097Z'
updated_at: '2026-10-04'
---

# auspol-vic — Victorian poll tracker satellite (SHIPPED 2026-10-03, 69f0061)

The satellite LANDED the same day it was scoped, as commit 69f0061 (9 files,
+5351), and was pushed live the same morning: `vic/index.html` (unlisted-orphan
launch), `.build/refresh-vic.mjs`
(generator: validate → compose → applyShell → writeAtomic), `.build/vic-watch.mjs`
(wave discovery/parsing — nothing auto-commits), `data/vic-polls.json`
(64 polls + 4 three-cornered + 87 leadership rows = 39 PPM + 48 approval), the
`SHELL_PAGES` entry, build.mjs's `VIC_STAMP` + sitemap route, the widened
unlisted regex in test-site-shell.mjs, and this skill itself. The same day the
user renamed the URL `/vicpoll/` → `/vic/`; every path-shaped identifier moved
(see the rename bullet under Shipped deltas) while the page's DISPLAY name
stays "Vicpoll". NOT yet built from the plan skeleton below: the vic-watch CI
workflow / launchd cadence — every wave still lands by hand-running the
pinned landing path. The locked decisions and landscape facts below stood up
in execution; the "Shipped deltas" section at the end records what execution
changed and taught. Don't re-research the landscape facts (live-verified
2026-10-03).

**Deadline pressure: the Victorian election is Saturday 28 November 2026**
(fixed date). Ordered from the election, NSW is March 2027 — but do NOT build
state-general machinery now; name files `<state>-*` (`vic-*` shipped) and lift
shared logic when NSW comes.

## User-locked decisions (2026-10-03 — these were ask_user_question'd, don't re-litigate)

1. **Satellite page**, NOT a main-page logo-toggle mode (auspol→vicpoll→nswpoll
   idea rejected — that path is the "triples maintenance" one). Same as
   /prediction/ and /atlas/: generated standalone page, site shell, page-local
   kicker+h1 identity ("Vicpoll", like prediction's "Forecast" kicker).
   The satellite-shell masthead contract (see auspol-satellite-page-branding)
   stays untouched.
2. **Name/URL `/vic/`** — OVERRIDDEN same day by the user, who owns the lock:
   launched `/vicpoll/` despite the VicPol=Victoria-Police collision (user was
   explicitly warned and picked the wordplay anyway), then ordered the rename
   to `/vic/` once live. Only path-shaped identifiers moved; the on-page
   display name stays "Vicpoll".
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

- **Data**: `data/vic-polls.json` — `polls[]` {id, pollster, commissioner,
  fieldworkStart/End, sample, primary{alp,lnp,onp,grn,oth}, twopp{alp}|null
  (published only), sourceUrl, provenance}, `leadership[]` {date, pollster,
  series: premierSat|opponentSat|preferredPremier, premier: allan|carroll,
  opposition: wilson, values, sourceUrl}. Backfill: csv primaries + primary-
  source 2PP/leadership harvest; provenance field marks what's imported vs
  verified. SELF-VALIDATING — federal validate.mjs is NOT touched.
- **Page**: `.build/refresh-vic.mjs` generator (validate + render) →
  `vic/index.html` (never hand-edited; refresh-prediction.mjs precedent —
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
  `node .build/refresh-vic.mjs` (fail-hard validate+regen) →
  `bash .build/git-push-main.sh "<msg>" data/vic-polls.json vic/index.html`.
  vic/index.html rides its OWN file list (prediction-refresh.sh:80
  precedent) — do NOT add it to shared SITE_FILES in git-push-main.sh.
  Optional stretch: 30-line `.build/vic-updater.sh` wrapper.
- **Shell coupling**: ONE entry `{ file: "vic/index.html" }` in
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

## Shipped deltas (2026-10-03, 69f0061 — what execution changed/taught)

- **Leadership schema as shipped** differs from the plan skeleton: rows are
  `{firm, date, pair, series, …, provenance}`; series is
  `preferredPremier` (leader-keyed `values` + `dk` + `net`) or `approval`
  (per-leader `pos`/`neg`/`net`). Era pairs:
  carroll-vs-wilson-vs-pickering (current), allan-vs-wilson, allan-vs-battin,
  allan-vs-pesutto, andrews-vs-pesutto.
- **ED-15 — the wikitext heading-level regex trap** (the expensive bug of the
  landing; generalises to ANY Wikipedia-table extractor). Wikipedia's
  "Leadership polling" section holds TWO level-3 families,
  `===Preferred premier===` and `===Leadership approval===`, each broken up
  by IDENTICAL level-4 era headings (`====Carroll vs Wilson vs Pickering====`
  …). Clipping a family body with an end-regex like `/^(?:===\s*|==\s*)/m`
  stops at the FIRST `====Pair====` (the `===`/`==` alternative prefix-matches
  the four `=`), which left a ~9-char PPM body; the fallback then fed the
  whole leadership region to the PPM parser and mis-filed dozens of approval
  rows as preferred-premier (e.g. DemosAU's approval {pos 21, neg 37, dk 42,
  net −16} became a PPM row {carroll 21, wilson 37, pickering 42}); the
  pre-fix data file carried 111 leadership rows, the fixed parse yields 87.
  RULE: a regex anchored on level-N heading delimiters also matches levels
  N+1, N+2… — cap the count AND require the next char to be a non-delimiter.
  Working form for a 2–3-level clip: `/^={2,3}[^=]/m`. An intermediate
  `/^=={2,3}[^=]/m` STILL matched `====` (the leading `==` prefix-matches 3–4
  equals) — same trap, one level down.
- **Data-legitimate nulls**: a wiki `{{N/A}}` cell is genuine absent data
  (RedBridge 2026-08-04 fielded the Carroll/Wilson/Pickering era but didn't
  publish a Pickering PPM). The refresh-vic validator filters nulls out
  of `values` before the inPct and 95–103 sum-band checks instead of
  rejecting the row; a bare grey-dash approval net heals as `pos − neg` at
  parse. Don't "fix" such rows in the data to appease a guard — teach the
  guard the null is legal.
- **Committed-file envelope conventions** (the regen transform applied before
  commit): rows drop `year`/`csvSample`/`csvDates`/`figCheck`;
  `client: ""` → null; csv-merged rows keep
  `provenance: ["wikipedia","electiontracker"]` without csv* keys; 3pp rows
  omit `sourceUrl` entirely when null while leadership rows serialise
  `"sourceUrl": null`.
- **Estimation as shipped**: headline blend over PUBLISHED 2PP only (never
  flows-implied — no 2022 ONP baseline), `w = n·2^(−d/28)`; 60 d trailing
  window widened in 15 d steps until ≥3 published 2PPs; trend curves on a
  14-day grid over 120 d; ≤6 waves/house; primaries
  ALP/LNP/ONP/GRN/OTH(=IND+other); per-house dots, no house effects;
  `SAMPLE_DEFAULT = 1000`; method note on the page says published-only.
- **`/vicpoll/` → `/vic/` rename** (user call the same day — decision 2's
  override). Every path-shaped identifier moved together: the directory,
  `data/vic-polls.json`, `.build/refresh-vic.mjs`, vic-watch's
  `.build/vic-src/`, `VIC_STAMP`, `VIC_STATUS`, the sitemap route,
  `SHELL_PAGES`, the unlisted regex, and this skill. Display strings
  ("Vicpoll" title/kicker/colophon) deliberately unmoved. Recipe that worked:
  `git mv` the two files and the directory first (clean renames), then two
  case-sensitive replace_all sweeps (`vicpoll`→`vic`, `VICPOLL`→`VIC`) inside
  the five sources — capital-V "Vicpoll" display text survives untouched —
  regen page + sitemap, validate, npm test.
- **Verification gate that ran**: `node .build/refresh-vic.mjs --dry` →
  real run; `node .build/newtracker/build.mjs`;
  `node .build/newtracker/validate.mjs`; `npm test` (test-site-shell's
  unlisted regex is now `prediction|atlas|vic`).
- **Commit discipline in the shared repo** (git-prestaged-commit-sweep in
  action): the landing commit named exactly nine paths. The freshly rebuilt
  `index.html` was NOT one of them — its diff was +14 lines of a sibling
  session's Option+D theme handler; regenerating a file locally does not
  make it yours.
