---
name: secnewgate-extraction
description: SEC Newgate "Mood of the Nation" bi-monthly survey — direction-only house (no VI). Discovery via the WP REST media API (predictable-URL probing fails), report PDFs carry "Fieldwork dates" + n on page 2, national-direction figures come from a 27-column geometry chart parsed with pdftotext -bbox; April 2026 Special Edition has NO direction question and must be skipped. auspol-tracker.
source: auto-skill
extracted_at: '2026-09-28T05:26:18.764Z'
---

# SEC Newgate Mood of the Nation → national-direction data

Researched live 2026-09-28 (adding SEC Newgate as a direction-only house to
the auspol National-direction panel). SEC Newgate runs a **bi-monthly
tracking survey** ("the 27th wave" = Sep 2026; Wave 26 = Jul 2026, Wave 24 =
Feb 2026). It publishes issues/priorities and
right-direction/wrong-direction readings for Australia and each state —
**no voting intention** — so it feeds `direction[]` in `data/polls.json`
like Freshwater/Spectre/RedBridge one-offs did (see
auspol-direction-data-entry for the row schema/gates).

## Discovery — use the WP media API, NEVER URL guessing

- Release index: `https://www.secnewgate.com.au/news-views/?tag=research&search=mood+of+the+nation`
  lists only the latest ~4 summaries (Sep'26, Jul'26, May'26, Feb'26, Nov'25
  on 2026-09-28).
- **The summary page contains only the wrong-track headline** (e.g. "68% …
  wrong direction", no right/unsure split, no dates). The full figures live
  in the report **PDF**.
- Report-PDF filenames are inconsistent (`Report-July-2026.pdf`,
  `September-2026-Report.pdf`, `Report-May-2026-1.pdf`,
  `Special-Edition-April-2026.pdf`; Nov'25 report re-hosted under
  `2026/02/`; `-Embargoed` duplicates of some finals). HEAD-probing
  predictable URLs hits this (Sep'26 guessed path → Cloudflare **523**).
- What works: the public WordPress REST media endpoint —

  ```
  https://www.secnewgate.com.au/wp-json/wp/v2/media?search=Mood&per_page=100
  ```

  returns every `Mood-of-the-Nation-*Report*.pdf` including odd names
  (filter `.pdf`, drop `-Embargoed` when a same-wave final exists, dedupe
  by wave). Parse the wave out of the PDF TEXT, never the filename.

## What's in each report PDF

- Page ~2 methodology block, verbatim shape:
  `The 27th wave of this bi-monthly tracking study.` ·
  `Fieldwork dates\n8th – 14th September 2026.` ·
  `n = 1,659 Australians aged 18+ including a Victorian boost.` (Sep'26;
  Jul'26 n=1,975, Feb'26 n=2,166, Apr'26 special n=1,237). This gives
  `dateStart`/`date` directly — the direction row needs nothing else.
- National direction chart: page containing `Perceived direction of
  Australia (%)` — one monthly series Mar'22→current wave (27 columns at
  Sep'26), two lines (upper = **wrong** direction, lower = **right**,
  right+wrong ≤ 100; `unsure = 100 − right − wrong`).
- **Geometry parse (pdftotext -bbox, poppler):** the x-axis month-label
  row (27 tokens at one y-centre) anchors column centres ("Sep\n'26"
  tokens are per-cell, ~right-aligned; pair each `Month` token with the
  nearest `’YY` token — they're curly `’`, not ASCII `'`). Chart
  endpoints = numeric tokens in the last column above the label row.
  Exclusions that matter: left-axis gridline labels (30/40/50/60/70 at
  far-left x), the `RIGHT DIRECTION %` side callout and the per-state
  "Perceived direction of individual states" table (same page, to the
  right/below the national chart) — filter tokens to x < national-label
  row right edge, y above the label row.
- Self-check: the summary page's stated wrong-track % and the report's
  last-column upper endpoint must agree (Sep'26: 68, matching both, "equal
  record high with July 2026" → Jul'26 = 66).
- APRA-style **methodology disclosure statements** live on a DIFFERENT
  domain — `secnewgate.au` (no `.com`):
  `/wp-content/uploads/YYYY/MM/NGR-2203003-MOTN-Methodology-Disclosure-Statement-<Month>-<Year>.pdf`
  (formal research dates + n; redundant with the report's own page).

## Gotchas

- **April 2026 Special Edition** (7–13 Apr 2026, n=1,237): a special
  Iran-war edition with **no direction question at all** — no
  `Perceived direction` page. A wave without that page must be SKIPPED,
  not failed.
- The per-state direction table on the chart page mixes MAR '22 /
  MAY '26 / JUL '26 / SEP '26 columns — never let those numbers contaminate
  the national series (spatial filter above).
- curl with a browser UA works for everything; no paywall, no JS gate.
- Cloudflare serves 523 (origin unreachable) — transient; retry later,
  don't treat as "page gone".

## Tracker-side integration (verified by repo survey 2026-09-28)

- Direction-only houses need **zero registration**: no roster in validate.mjs
  (gates: ISO date + shares 0–100 + `direction-sum` ±1), no colour/asset/copy
  changes — the panel's house counts, credits, dek all derive from data.
- Waves with no `polls[]` row swim fine (`direction-only waves`): weight
  defaults to n=1200, tooltip sample renders null, no archive-table row.

## Shipped pipeline (commit 5a070fe, 2026-09-28)

Backfilled 7 waves (Jul 2025–Sep 2026, waves 21–27) into `direction[]`;
the automation then keeps it current:

- `.build/extract-secnewgate.mjs` — media-API discovery
  (`wp-json/wp/v2/media?search=Mood&per_page=100`, one page suffices;
  page 2 404s with `rest_post_invalid_page_number`), committed cache
  `.build/secnewgate-src/<slug>.{txt,bbox.html,json}`, and it writes the
  `direction[]` rows ITSELF straight into `data/polls.json` (Roy-Morgan
  model — NOT the Ipsos model where a second script reads the cache).
  `SEC_FIRST="2025-07"` (backfill floor), `QUIET_DAYS=75`, `HEAL_DAYS=8`,
  `unsure = 100 − right − wrong` (=0 on all waves so far, stored as int).
  Last line `SECNEWGATE_STATUS {…,"added","healed","pending","stale",
  "warnings"}`; quiet goes to `stale` (the weekly run's alarm), report
  unreads to `pending` (the daily run's failure).
- The direction chart is page **8** in every tracking report since
  mid-2025, and all 7 cached bbox parses come back with `problems: []`
  and `columns == wave ordinal` (21–27) — the anticipated wave-1
  axis-label collision (Mar'22 wrong-token vs the "50" gridline label)
  never actually triggers; the x/y windows keep it out. The extractor
  also cross-checks every earlier wave's endpoint against
  `series[wave-1]` of the NEWEST report's chart (it reprints history; a
  mismatch = SEC Newgate revised a wave = question for a person).
- `.build/secnewgate-updater.sh` mirrors `ipsos-updater.sh` but its
  change-detection is `git status --porcelain -- .build/secnewgate-src
  data/polls.json` — BOTH paths, because the extractor writes rows
  itself. A new cache file with unmoved polls.json commits cache-only
  ("Cache SEC Newgate … files"). Alarms are FAIL-last, after the push;
  pending (defect) logs AFTER warnings so classify-failure names the
  defect.
- `.github/workflows/secnewgate-update.yml` — poll-agent.yml caller,
  cron `25 10 * * *` (20:25 AEST, clear of Ipsos's :10), NO
  tune-schedules block and NO dispatch-clock slot: the tuner/clock only
  know poll-row houses, and a dropped run costs nothing. `apt_packages:
  poppler-utils`; permissions ceiling contents:write + actions:read.
- `crosstabs-updater.sh` runs the extractor weekly as backstop, parses
  `"stale":[…]` (the `SEC Newgate|quiet` alarm) into its STALE exit, and
  carries `.build/secnewgate-src data/polls.json` in its CHANGED check
  and FILES list.
- Agent-repair: `secnewgate-update` in agent-repair.yml's watch list +
  `secnewgate-repair-prompt.md`; the gate's forbidden-path regex
  (`\.build/[a-z0-9-]*repair-prompt\.md$`) fits the filename.
- `.build/test-secnewgate.mjs` (registered in package.json's `test`
  chain right after test-issues) pins all pure fns against the 7-wave
  fixture set plus the polls.json rows themselves. Test-authoring traps
  (all three bit during writing):
  1. `titleMonthOf` is survey-agnostic — it returns "2024-03" for
     `"SEC Newgate Omnibus Poll March 2024"`; the MotN/report/PDF
     filters are `pickReports`' job. Assert titleMonthOf's real
     contract, not a "non-MotN rejects" fiction.
  2. A synthetic embargoed-only fixture dated **March 2025** vanishes
     entirely — that is BELOW the `SEC_FIRST` ("2025-07") floor; pick a
     post-floor month for synthetic reports.
  3. Every cached bbox parses clean — do NOT pin an expected wave-1
     problem column that doesn't occur.
