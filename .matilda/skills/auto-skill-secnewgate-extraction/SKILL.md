---
name: secnewgate-extraction
description: SEC Newgate "Mood of the Nation" bi-monthly survey — direction-only house (no VI). Discovery via the WP REST media API (predictable-URL probing fails), report PDFs carry "Fieldwork dates" + n on page 2, direction rows carry url (the report PDF itself since 2026-10-09 — the house's report posts 301 straight to their PDFs, so pickReports takes source_url with it.link only as fallback) + published (the media date, site-local). April 2026 Special Edition has NO direction question and must be skipped. auspol-tracker.
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
  Each media item also yields `page` (the media item's `source_url` —
  the report PDF itself — since 2026-10-09: the house's report posts
  now 301 straight to their PDFs, so `page = url || it.link || null`
  with the article-page `link` demoted to fallback; before that change
  `page` was the item's `link`, the WP article page, never the PDF) and
  `published`
  (`date.slice(0,16)`, site-local UTC+10 — the upload stamp trails the
  fieldwork by days); the sidecar carries `url`/`published`, the
  direction row spreads them in, and the heal condition treats a missing
  OR MISMATCHED link/stamp as a heal target so rows filed before the
  fields existed get back-filled (all 7 healed 2026-09-29, and re-healed
  2026-10-09 when the contract moved — commit 4046c12; an item with no
  link/date yields nulls, not a crash — pinned). Synthetic test items ride a
  `(rendered, url, rest)` factory — `link`/`date` go in `rest`.
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
  data/polls.json data/sec-direction-states.json` — all three, because
  the extractor writes rows and the state bank itself. A new cache file
  with unmoved polls.json commits cache-only ("Cache SEC Newgate …
  files"). Alarms are FAIL-last, after the push; pending (defect) logs
  AFTER warnings so classify-failure names the defect.
- `.github/workflows/secnewgate-update.yml` — poll-agent.yml caller,
  cron `25 10 * * *` (20:25 AEST, clear of Ipsos's :10), NO
  tune-schedules block and NO dispatch-clock slot: the tuner/clock only
  know poll-row houses, and a dropped run costs nothing. `apt_packages:
  poppler-utils`; permissions ceiling contents:write + actions:read.
- `crosstabs-updater.sh` runs the extractor weekly as backstop, parses
  `"stale":[…]` (the `SEC Newgate|quiet` alarm) into its STALE exit, and
  carries `.build/secnewgate-src data/polls.json
  data/sec-direction-states.json` in its CHANGED check and FILES list.
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
  4. Since the 2026-10-09 link-contract change the pickReports pins
     expect `page` = the PDF `source_url` (the media item's page `link`
     IGNORED), and an embargoed-only wave links its embargoed PDF with
     `published: null` rather than linking nothing — the page link is
     fallback, the PDF is the contract.

## State direction bank (data/sec-direction-states.json, 2026-09-29)

The "Perceived direction of individual states (%)" table on the direction
page is now BANKED (parse-only, nothing on the site reads it — the
2026-09-29 call was: too noisy and too one-house to chart, but too cheap
to let evaporate). `stateTableOf(bbox)` in the extractor reads it:
five mainland states (NSW/VIC/QLD/SA/WA), each row carrying the CURRENT
wave's right/wrong pair left of the column block, then % right-direction
cells under MON ’YY headers — a MAR ’22 anchor plus the wave's own and
its two predecessors' tracking waves (so the union of all cached reports
stitches a series from Feb 2025, one wave beyond the SEC_FIRST national
floor; Feb/Apr 2025 and the 2022-03 anchor are right-direction-only —
wrong is only ever printed for a report's own wave, so each wave's pair
is captured exactly once, from its own report). Geometry notes: pair
splits from cells at first-column-centre−25, cells match column centres
(minX+6 within 20px), state labels are required BELOW the column header
row because the dek copy above can carry a stray "NSW" token (Sep-25
report, y≈74), and May'26's window reaches NOV ’25 not APR ’26 because
the April special asked no direction question. The extractor merges
sightings newest-report-wins, warns on any reprint conflict (a state
revision), treats a state-table misread as `pending` WITHOUT holding the
wave's national row back, and re-reads every cached report each run so a
wave dropped from the media API never shrinks the bank. `SECNEWGATE_STATES`
env var redirects the output. The bank is committed by BOTH wrappers —
`.build/secnewgate-updater.sh` (no-change gate + cache-only and full
FILES lists) and `crosstabs-updater.sh` (CHANGED check + FILES) — and
pinned in test-secnewgate.mjs (per-report columns, pair==own-cell,
reprint-agreement, merged series == the file).

## Issue questions in the report (assessed 2026-09-29 — salience NOT pooled, G4 ownership pooled)

The user asked whether MotN's issues data could join the issues panel;
answer: salience stays out, but G4's best-party question pools for
ownership (`col`). Each report carries FOUR issue measures:

- **B1 Unprompted concerns and priorities** (txt "Unprompted concerns
  and priorities", p.6): open-ended "main issues facing Australians
  most important to you right now" — % MENTIONING each of 10 printed
  issues (cost of living, housing affordability, crime, immigration &
  population, healthcare, government performance, climate change,
  petrol prices, inflation, grocery prices), tracked MAR '22 + the
  wave's own and two predecessors' tracking waves (same header
  geometry as the state direction table, col x≈MON 'YY pairs).
  Multiple mentions allowed (shares ≈300 sum) — unpooled like DemosAU's
  open-ended question, but a good level-check: Sep '26 COL 68, housing
  32, crime 20, immigration 17 (record).
- **B5 36 national priorities** ("Australia's national priorities (%)",
  pp.10+): "How important are these things to you personally" rated
  Extremely-important % across 36 granular items (tops ~70 vs a top-3
  share's ~40 — unmixable scale; a txt `-` marks a not-asked wave).
- **B6 Political Heat Score** (same tiles, small lone number under
  each label): "Next please select the 3 of these things that are most
  important" — this IS RedBridge/Ipsos top-3 format, but off a 36-item
  choice set (dilutes every share vs their 14/19), printed for the
  current wave only, and many-to-one onto the issues-panel keys; see
  the auspol-issues-panel skill for the full not-pooled reasoning.
  BANKED parse-only since 2026-10-02 (see the heat-score bank section
  below) — from the page-4 summary grid, not the tile pages.
- **G4 best party on cost of living** ("Now turning to the cost of
  living. Which of the following do you think would be the best party
  to manage the cost of living?"): asked EVERY wave, one issue only,
  with an APR '22 tracking chart and a demographics table whose TOTAL
  column is the national share. Banks and POOLS (May 2026 on) — see
  the next two sections. The option list changed at the May 2026
  "METHODOLOGY CHANGE" wave: One Nation and the Greens joined, and
  "neither"/"can't say" stopped printing as separate figures.

B5/B6 live on tile pages (6 tiles/page, label + 4 tracking values + one heat
number) — pdftotext -layout interleaves them loosely, so bbox geometry
would be needed if they're ever read. B5 is deliberately NOT
banked: its extremely-important scale mixes with nothing. B6's heat
scores were banked from October 2026 (2026-10-02) — off the page-4
summary grid, whose machine-printed `Label (EI:heat)` tiles make the
series tractable; see the heat-score bank section below.

## Unprompted-concerns bank (data/sec-issues.json, shipped 2026-09-29)

B1 is banked parse-only, exactly like the state direction bank — nothing
on the site reads it; the issues panel keeps pooling RedBridge+Ipsos
alone. `concernTableOf(text)` in the extractor reads the B1 "% MENTIONING
EACH" table straight from the WHOLE-REPORT `-layout` text (no bbox
needed): the `MENTIONING EACH` line anchors a scan for a MON header row
(≥2 lone month tokens) with its `’YY` row below (each year token within
6 chars of a month start), column key = MON end index; rows are a label
at col ~133 plus one bare integer per column right-aligned within 5
chars of the column edge; blank lines separate, and the scan stops at `\f`,
`B\d.`, or `Base:` (footer prose carries no digit tokens). Value guard
≤90; want ≥5 rows, ≥2 columns, no duplicated labels. Per report the grid
= MAR ’22 anchor + the wave's own month + its two predecessors' B1
months — and here the April 2026 special DIFFERS from direction: the
special DID ask B1, so 2026-04 enters the May/July 2026 grids and the
bank carries 11 core months, the special's own reading (e.g. petrol
prices spiked to 22 in 2026-04) visible only via reprint. Merge is
sightings-newest-wins with a `warnings` line on any reprint conflict
(SEC Newgate revised a wave), `SECNEWGATE_ISSUES` env redirects the
output, writeAtomic only on content change, and a per-wave misread lands
in `status.pending` (the wave's national row is NOT held back — it never
was; concerns are decorative to the pipeline). Both wrappers carry
`data/sec-issues.json` (secnewgate-updater: porcelain gate + cache-only
FILES + full FILES; crosstabs: CHANGED check + FILES), and
test-secnewgate.mjs pins per-report columns (2026-04 in waves 25/26),
per-label one-cell-per-column, reprint agreement, and the merged bank
== the file. The issues Info entry's check sentence now names SEC
Newgate as the third check house ("Every two months SEC Newgate asks the
same kind of open question … None of the three can be pooled with the
others …"), text edited in the d1a1d215 asset per the auspol-glossary-terms
skill.

## G4 best-party bank (data/sec-issues.json `bestParty`, shipped 2026-09-29)

G4's demographics table is banked parse-only beside B1 — `g4BestPartyOf(text)`
in the extractor reads the whole-report `-layout` text: the "G4. Now turning
to the cost of living" question line anchors an UPWARD scan (≤16 lines, stop
at `\f`) for the `MON ['’]YY (%)  TOTAL` header (May 2026 uses a curly
apostrophe, "MAY ‘26 (%)"; year 2 or 4 digits), then reads label+value rows
BELOW the header (cells split on 2+ spaces, first cell the label, second a
bare integer ≤60). Printed row sets VARY BY ERA — do not assume uniformity:
- Jul/Sep 2025: Labor Party + Coalition only (neither/can't-say exist only
  in the chart legend);
- Nov 2025/Feb 2026: adds "Neither / someone else" (`oth`); Feb 2026's
  Coalition row reads "Liberal / National*";
- May 2026 on ("METHODOLOGY CHANGE" wave): the four party rows only —
  Labor Party, One Nation, Liberal/Nationals Coalition, The Greens.
"Can't say" never prints as a row in any wave (it's remainder). Guards: the
header month must equal the wave's month; alp+lnp required; onp/grn appear
together; a "Can't say" row would be an explicit problem; `rest` = 100 −
printed sum, bounded [5, 60]. The bank = `{ "2025-07": {alp, lnp, rest},
"2025-11": {alp, lnp, oth, rest}, "2026-05": {alp, onp, lnp, grn, rest},
…}` — printed parties plus `rest`, one sighting per wave (no reprints to
cross-check, unlike B1; the April 2026 special prints no G4 column).
.build/issues.mjs turns the May-2026-on months into ownership rows
(issues.col = alp/lnp/onp/grn + oth:=rest = neither + can't-say combined;
an options override lists unsure even though it never prints separately,
matching the question's option set; the wave's dates/sample/link come from
its polls.json direction row — SEC Newgate has no poll rows). Only the ON-era
waves pool: before May 2026 neither One Nation nor the Greens was an option,
so the shared three-party question doesn't exist. The secnewgate updater
runs issues.mjs via `refresh_crosstabs issues` after the extractor; both
FILES lists carry data/issues.json. gen-data §7h needed NO code change — its
pollOf fallback takes dates/sample off the ownership row itself when no
poll row matches — only its prose comment lists the house. test-secnewgate.mjs
pins every wave's G4 shares, the era shapes, and the merged bank == the file;
test-issues.mjs pins the three pooled rows (dates, shares, options, gate).
Verified figures: w21 alp38/lnp21/rest41, w22 35/22/43, w23 33/22/oth30/15,
w24 29/22/oth31/18, w25 alp23/onp20/lnp17/grn9/rest31,
w26 24/23/14/10/29, w27 23/22/16/12/27.

## Heat-score bank (data/sec-issues.json `heatScore`, shipped 2026-10-02)

B6's Political Heat Score banks into the same file as B1 and G4 — a third
block `heatScore: { ym: { label: heat } }`. The source is NOT the tile
pages (pp.10+) but each report's page-4 summary grid, "Tracking the
importance of 36 national priorities": 36 numbered tiles in 6-column
rows, each printed `Label (EI:heat)`. `gridPageOf(text)` finds the grid
page (4 in every cached wave) and the grid's own N; `heatGridOf(bbox)`
parses `<slug>.grid.bbox.html` — a THIRD cache file, fetched with the
report when new and back-filled from the still-listed PDF for waves
cached before the bank existed (the existing txt/bbox bytes never
move). GEOMETRY is forced: `-layout` reflows the six tile columns into
one another (probe: 27–33 problems per report), so tile numbers anchor
the column x-bands, row bands run number-y to next-number-y (last row
to the "Legend" line), and a tile's words (wrapped label then its pair)
are whatever's centre-x inside its box, rejoined by visual line. The
EI half of each pair parses with the heat but is NOT banked (a
% extremely-important ratings scale mixing with nothing). One sighting
per wave — the grid prints the current wave only, no reprints to
cross-check — and labels bank VERBATIM per wave, including the
university/University case flip at May 2026 (the same 36 priorities
otherwise). Read `heatScore[ym][label]` for the % choosing the item in
their top 3 of 36; the shares sit BELOW B1's multi-mention percentages
and between RedBridge's 14-item and a free-for-all's dilution — nothing
pools them (see the issues-panel skill). Verified Sep 2026 pins: cost
38 (Jul 2025 peak 41), crime 23, healthcare 16, rental 15, interest
rates 14, own-home 12, borders 8, migration-for-shortages 1, tariffs 0.
test-secnewgate.mjs pins gridPageOf (page 4, n 36), all-clean grids,
six spot values, the label flip in both directions, cross-wave label-set
equality (flip aside), and the merged bank == the file.
