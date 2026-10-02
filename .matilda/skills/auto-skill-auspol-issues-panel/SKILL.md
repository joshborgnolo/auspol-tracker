---
name: auspol-issues-panel
description: auspol-tracker — the Snapshot's "The issues" panel (shipped 2026-09-25; Ipsos added 2026-09-26) end to end - what each pollster publishes about issues, how .build/issues.mjs reads it into data/issues.json, how gen-data §7h pools it (houseEffectsFor on ownership, pairLeanFor on salience), the panel's two views plus the 2026-09-28 importance-weighted scoreboard tally row (and the rd-is-row five-column auto-placement trap), and the traps found building it (RedBridge's two table layouts, Resolve's double-counted July 2026, Ipsos's rolling page 2 and publication lag, why only three parties pool). 3cc1b40 (2026-09-30): the "Issue" kicker span over the phone chips row is GONE (aria-label covers it) — its 16px moved onto .rd-iw-chips; pinWhom pins the grouping menu first (rdPinScroll array form).
source: auto-skill
extracted_at: '2026-09-26'
updated_at: '2026-09-30'
---

# The issues panel

## What exists, per house (checked Sep 2026, all cached reports read)

- **RedBridge/Accent**, monthly (report text in `.build/redbridge-src/`):
  - salience: "most important to you when deciding who will receive your
    vote? Please rank your top 3" of 14 issues. Summary table ("Issue
    salience in the two most recent waves") from April 2026; each summary also
    reprints the previous wave, which is how March 2026 (never cached) is
    read. Dec 2025–Feb 2026 print figures only – their all-voters numbers come
    from each issue's table by group (4 issues, 6 from February).
  - salience by group: one table per issue (cost of living, health, housing,
    immigration; crime and economy from Feb) by vote, softness, generation,
    gender, location, education, home ownership.
  - best party ("best able to deal with…"): 6 issues, 9 from March. December
    offered "The Liberal National Party Coalition" as ONE option (7 columns);
    January on, Liberal and National apart (8). Read off the header.
- **Ipsos** Issues Monitor, monthly (`.build/extract-ipsos.mjs` caches text in
  `.build/ipsos-src/`; fetched daily by `ipsos-update.yml` →
  `.build/ipsos-updater.sh`, and again by the weekly crosstabs run as the
  backstop). Read from Dec 2025 (`IP_FIRST`, RedBridge's first month). Not
  on Next expected polls, deliberately: it publishes no voting intention,
  and its release rhythm is weak (see the traps below).
  - national report, two pages. Page 1: the month's five top issues, then
    "Party most capable to manage the top issues facing Australia" for those
    five – Coalition, ALP, Greens, One Nation (from June 2026; inside Other
    before), Other, Don't know, None. Page 2: all 19 issues, yearly averages
    from 2010 then monthly columns.
  - question: "What would you say are the three most important issues
    facing Australia today?" – three of 19, no ranks (rows store `{top3}`
    only; the 19 shares sum to ~300, gated at ±10).
  - methodology statements (polling-methodology-disclosure-statements page,
    one per month) give fieldwork dates and the EFFECTIVE sample (936 of
    1,000 in Aug 2026; 512 in May 2026). Statement dates win over the
    report's: January 2026's report reprints January 2025's "8–11".
  - labels are short forms of the statement's list: "Defence" is
    "Defence/Foreign affairs/Terrorism" (mapped to security, as Resolve's and
    YouGov's bundles are); "Environment" is environment, not climate;
    Unemployment, Poverty, Petrol prices, Population, Personal debt, Racism
    and Drug abuse have keys of their own.
- **Resolve**, monthly since April 2021 (`party_attributes` in
  `data/resolve-political-monitor.csv`): 18 areas; Liberals, Labor, someone
  else, undecided, plus One Nation from July 2026. Quirks the reader handles:
  items all 0 = not asked; the Indigenous item under three labels (decimals
  win, whole numbers must agree within rounding); July 2026 carries the older
  copy's "someone else" (One Nation folded in, 30) beside the decimal One
  Nation figure – One Nation is subtracted back out (Indigenous item proves
  it: 33 = 12.08 + 21.07). 2023-02-19 has 5/5/5/5 placeholders for two items
  (dropped, listed in `dropped`).
- **YouGov** News24 Pulse: an occasional "Which party is best at handling…"
  Infogram chart (12 issues; seen 24 Aug 2026, not 8 or 21 Sep). Found by
  shape among the charts the News24 extractor records as "unmodelled";
  `KNOWN_IG_ISSUES` holds ids found by hand.
- **DemosAU**: open-ended "biggest issue facing Australia today?", one answer,
  AI-coded into categories REGENERATED every month (economy, fuel prices,
  housing ± homelessness drift) – compare with RedBridge's first rank, not
  its top three. Not pooled; the Info cites it as a check. It also asked
  "Which political party do you trust more to handle the following issues?"
  once (Feb 2026: Greens, Labor, Don't know, Coalition, One Nation; 12
  issues) – pooled since 2026-09-26 (`daOwnership`). "Medicare" maps to
  health (its three-way shares sat within a few points of RedBridge's health
  that month); "Inflation" and "Aged care" keep keys of their own. One poll:
  no lean measurable, excluded from the trend test (withinHouseSlope skips
  one-poll houses), but it moves February's monthly points (it reads Labor
  lower than RedBridge on most issues).
- **Spectre**: up to 3 of 14 issues (+ other, unsure), bundled ("health &
  aged care", "immigration & population growth"), ~every three months.
  Not pooled; cited as a check. Its levels match Ipsos within ~4 points.
- **SEC Newgate** MotN (salience NOT pooled; ownership pooled from
  2026-09-29, `col` only – the user asked "can they be worked in" and
  spotted G4 on the live report): the report carries FOUR issue
  measures (details in the secnewgate-extraction skill) – B1
  open-ended unprompted concerns (% mentioning, 10 issues, tracked
  MAR '22 + 3 waves; banked parse-only 2026-09-29), B5 the 36-priority
  "extremely important" rating scale (tops ~70 vs a top-3 share's ~40,
  unmixable), B6 the "Political Heat Score" pick-3 of 36 (banked
  parse-only 2026-10-02 into data/sec-issues.json `heatScore`, off
  the page-4 summary grid; still NOT pooled), and G4
  "best party to manage the cost of living". Salience stays out:
  B1 is % mentioning (different scale from RedBridge's top-3 /
  Ipsos's pick-3), B5 is ratings, and even B6's 36-item choice set
  dilutes every share vs RedBridge's 14 / Ipsos's 19. Ownership DOES
  take G4: asked every wave, with One Nation and the Greens options
  from the May 2026 wave – only those waves pool (a three-party
  question needs them on the list). extract-secnewgate.mjs banks the
  G4 TOTAL column into data/sec-issues.json `bestParty` (keyed by
  month; printed parties + `rest` balancing 100; "can't say" never
  prints, "neither/someone else" prints only Nov 2025–Feb 2026 as
  `oth`); .build/issues.mjs reads the May-2026-on bank months into
  ownership rows whose dates come from the house's polls.json
  direction rows (it has no poll rows), with an options override
  (alp/lnp/onp/grn/oth/unsure) and `rest` riding as oth = neither +
  can't-say combined. The secnewgate updater runs issues.mjs via
  refresh_crosstabs. Pre-May waves keep the older two- or
  three-row option sets in the bank but stay out of the pool.

## Pooling (gen-data §7h)

- WAVE→ROW KEYING TRAP (found 2026-09-29 planning the All-polls Issues
  facet): §7h's `pollOf(w)` matches an issue wave to a `polls[]` row by
  EXACT `pollster|fieldwork-end-date` only, and silently falls back to the
  wave's own `{date, dateStart, sample, sampleEff}` when it misses. It
  misses ROUTINELY, not exceptionally: RedBridge's wave date is the report
  publication date (2026-08-28) while its poll row keys on the fieldwork
  end (~a week earlier), so RedBridge waves never join their poll rows at
  all. Pollster names normalise fine (`RedBridge/Accent` both sides;
  `houseName` maps to "RedBridge" for display). The fallback is harmless
  for the pooled figures (midpoint/window/sample all live on the wave) but
  any consumer that needs the actual row (the archive table's per-wave
  `iss` join, where a wave must LAND on an individualPolls/directionOnlyPolls
  row or become an issuesOnly one) has to resolve across the gap: exact
  `date|pollster` first, else nearest same-pollster poll inside ~14 days,
  else the `direction[]` key (SEC's issue rows carry their dir row's date),
  else a declared issues-only house (Ipsos) – and an unresolvable wave must
  fail the build, never vanish quietly. Direction-wave joins don't have
  this trap: direction `.date` is always the fieldwork end.
- Ownership pools ONLY Labor / Coalition / One Nation as shares of those
  naming one of the three: the answer sets differ (no Greens at Resolve,
  "all about equal" only at RedBridge), and this is the part every current
  question shares. Six-week window (SPARSE_K), less each house's lean per
  party per issue from houseEffectsFor – estimable once Ipsos made a third
  regular house (≥3 other-house neighbours within 28 days). Leans sum to
  zero across a house's three shares, so the pooled set still makes 100 (a
  build check). Shrunk by SHRINK_K = 8 on 1–3 polls each, so ~1 point in
  Sep 2026 against Ipsos's raw ~+8 on Labor's share (every issue). `lead()`
  takes the difference of the two parties' leans. `leadSig`: the
  leader-minus-runner-up margin as its own measure, variance
  (a + b − (a − b)²)/n.
- The three parties leave out a quarter to two fifths of voters on most
  issues and 56–58% on climate at RedBridge/YouGov (the Greens). `grnTop`
  flags a Greens-first reading: `grnTop[k] = {house, grn, date}` from the
  newest in-window (SPARSE_K) wave of a Greens-offering house (median
  ranker) where the Greens top the table (gen-data ~:2870, `grn > alp &&
  grn > lnp`, ranked over Gen/GenC rows). Two render sites in RdIssues:
  the row verdict's small print "Greens first (N) where offered" — N
  bracketed, inked `inkOf(pColor("grn"))`, the figure column's convention
  (added 01410e0, 2026-09-30, at the user's request; the payload's `grn`
  field had always been there, just never printed) — and the rd-note under
  the rows "-house- also offers the Greens, who come first on -issue- (N%)".
- Salience pools RedBridge and Ipsos with `pairLeanFor`: each poll's gap to
  the other house's polls within HE_WINDOW, recency-decayed (HE_HALF), each
  house leaning HALF of it (two houses can't say which is right), NOT
  shrunk. Why: the gap is wording, stable all 2026 (RedBridge − Ipsos:
  health +14, col +11, immigration +7, housing −7, economy −7), and Ipsos
  publishes ~26 days after its fieldwork midpoint (19–40), so its poll is in
  the six-week window only part of each month. Replayed day by day over
  2026 with real publication lags: an unadjusted pool swung health 27–38
  (jumps of 7 in a day); the half-gap pool 26–32. houseEffectsFor can't do
  this: with two houses "the others" is the other house, so each would be
  charged the whole gap.
- `imp.by`: each house's newest poll (within 61 days) for the tooltip and
  the note under the rows; `imp.gap`: the pair's gap; `imp.r1`: RedBridge's
  first rank alone. Houses credited on the card include a house whose
  newest poll sets the bars' level through its gap even after it leaves
  the window.
- Salience by group: RedBridge alone, six-week window, under `groups.all` –
  RedBridge's OWN all-voters reading (the pooled bar would sit off its
  groups' average). Group n = poll n × rough group share (vote groups from
  the wave's primaries, 0.92 decided; Liberal : Nationals-side 65:35) – it
  sizes the sampling floor only.

## The panel (a11e1559 `IssuesPanel`, composed in 73de0c58 before Undecided)

- `D.issues.list` is an SORTED ARRAY of `{id, label, imp, own, monthly,
  dots,…}` (sorted by `imp.v` at the end of §7h, and later
  scoreboard-descended by display) — NOT a map keyed by `id`. Any consumer
  off the archive rail must find by `it.then((x) => x.id === …)` /
  `find((it) => it.id === k)`, as RdApIssMini does (a `list[iss.top]`?
  keyed lookup returns `undefined` and the component's empty `<div>`
  fallback renders silently, giving an empty rail box with no pageerror —
  shipped as a half-finished row and caught by the iss-facet probe's
  railSvg:false, 2026-09-29). Monthly rows are `[ym, alp, lnp, onp,
  ±alp, ±lnp, ±onp]` — arrays, not objects (RdApIssMini's per-party line
  unpacks the i-th column, never a key).

- "Who's trusted": rows sorted by salience (importance bar, three-party bar
  with dot-numbers, verdict) beside the chosen issue's monthly chart;
  `issTrendVerdict` = withinHouseSlope per party, Holm. Under the rows: the
  issue where the two salience houses' latest polls differ most (≥5
  points), then the Greens note (figure included — see `grnTop` above).
  The trust axis prints gridline labels 20/30/40/50 ONLY: its "⅓ each"
  even-split label and the per-row dotted line it named
  (rd-is-third/rd-is-thirdlab) were removed 2026-09-30 at the user's call
  ("don't think it's necessary"; the row figures + the ahead/behind
  verdicts carry the reading) — removed TOGETHER on the principle that a
  mark must never outlive the label that names it (an unlabelled vertical
  line through every row reads as a bug), and the axis's min-height/height
  tightened 30→20px with it (the 30px had existed for that second label
  line). Rows are focusable buttons (tabIndex 0);
  ArrowDown/ArrowUp from a focused row steps the selection one row at a
  time, focus following (a held key keeps walking), clamped at the list's
  ends – `rowKey` in RdIssues (~:1771) locates row j through `rowsRef` on
  `.rd-is-left` (DOM order === `list` order; the tally row is excluded by
  the `:not(.rd-is-tally)` selector). Probe:
  `.matilda/probe-issues-keys.mjs` real-key walks the list down and back up,
  asserting selection, focused element and chart head follow and both ends
  clamp.
- "Issue-importance-weighted trust score" scoreboard tally (row shipped 36e73c3, scoreboard restyle 271d103, label renamed to the sentence-case trust-score line 355a6e2, chip names de-capped 6ca8ea8 — all 2026-09-28/29): a bottom row on the Who's trusted table — per party q over rows = issues with both `own` and `imp`: Σ(x.imp.v × x.own.v[q]) ÷ Σx.imp.v (importance × perceived competence; 36/30/34 at ship — shares of voters naming one of the three parties, per the ownership convention). The tally IIFE sits after `wide` in RdIssues (~:1790), the row JSX after `{list.map(row)}` (~:1890) as `.rd-is-row.rd-is-tally`, an aria-label carries the spoken split. The 271d103 scoreboard gives the row only TWO children, each placed by explicit `grid-column`: `.rd-is-tallab` (1 / span 3 — the 14px/600 plain sentence-case label "Issue-importance-weighted trust score", which 355a6e2 made out of the 12px uppercase eyebrow "Weighted by importance", plus its definitional small, which moved into the row from the RdFoot sentence that 271d103 dropped) and `.rd-is-tallynums` (4 / span 2 — three equal `.rd-is-score` chips flexing across the figures+verdict tracks: party-tinted via inline `color-mix(in oklab, <pColor> 12%, transparent)` (theme-safe: dark mode re-computes a lighter tint), a 24px/700 figure in `inkOf(pColor(q))`, and the `ISS_PARTY_CAP[q]` name in 10px/700 sentence case — 6ca8ea8 removed the caps transform and its 0.04em tracking, so the stored title-case text renders as written; "One Nation" now fits a 59px chip inner width with room to spare at 10px). Phone (≤760px) drops the row off the named-area grid to `display:flex; flex-direction:column`, label over the chip row. Every three-party LISTING on the trust side — head legend, each row's figures, the chips, both aria texts — renders scoreboard-descending via `pOrd` (RdIssues, sorted from `tally`; 6d0266b, 2026-09-29), so the order re-sorts as the pooled scores move; `P = I.parties` stays the data-shape key (monthly arrays unpack by its index — never reorder it). The tally probe asserts the sort rule, legend/figure/chip order agreement and sentence-casing by regex rather than a baked party order.
  - **GRID TRAP for anyone touching `.rd-is-row` children**: head/row/axis share one five-column auto-placement grid (150px 104px minmax(0,1fr) 88px 120px) where children place BY POSITION — `display:none` on any child removes it from the grid-item list and shifts later siblings a whole column LEFT (the first tally's numbers cell landed 205px left of the data rows' at 1440px; caught by the probe's numLeftDelta check, fixed with `height: 0` in 36e73c3 then eliminated with the two-child explicit-column design in 271d103). If a row variant must hide a cell, use `height: 0` (or `visibility`), never `display:none` — or place every child by `grid-column`/`grid-area` so auto-placement isn't in play. Phone (≤760px) is immune — its rows use named `grid-template-areas`.
    Probe: `.matilda/probe-issues-tally.mjs` serves the repo and asserts the scoreboard at 1440 (+dark)/900/761/390 — three equal chips, chip-label overflow, 24px figure, the exact sentence-case label text + `text-transform: none` on both the label and the `i` chip names (casing by regex, order by the scoreboard-descending rule, legend and row figures in agreement), flush join to the last data row, no horizontal scroll.
- With the redesign on (`window.AP.rd`), a11e1559 defers to `RdIssues`
  (rd-panels.jsx ~:1617) and its head/dek come from `trustHead`/`trustDek`
  (~:1700). `trustHead` stays data-driven; `trustDek` has been
  HAND-CURATED since 2026-09-28 (the user's verbatim wording: "The cost of
  living is by far the issue most important to voters… The Coalition
  retains its age-old lead on economic management."), same convention as
  RD_DEMO_HOME — every lead it names must be a currently-significant
  pooled gap, refreshed by hand when the pool moves; it no longer
  regenerates from the data.
- "What matters to whom": table of top-three shares by group, sentences from
  `issGroupVerdict` (the vote-by-group test). Its gist line is `whomHead`
  (rd-panels.jsx ~:1790, per-tab generated) — user-trimmed 2026-09-28 to the
  first sentence ("‹issue› comes first for everyone."); the conditional
  "What comes second divides them." tail and its `secondDiffers` check were
  cut (8a7d389), don't restore.
- Whom view's grouping switcher is the LAPTOP'S MENU on a phone too
  (1e2838f, 2026-09-30, user's request "can you make it a menu on phone…
  or does it not fit" — it fits, proven): the ≤1000px `whomList` branch
  (rd-panels.jsx ~:2461) renders the SAME RdTabs `.rd-iw-ctl` uses
  (`rd-tabs-sm rd-iw-tabs` + `swipe`), not the old `.rd-iw-chips` chip
  cloud; the 14-item Issue row below STAYS chips (a menu can't scroll).
  Six tabs fit 320px via a measured ladder in rd.css (~:1244, all under
  `@media (max-width: 1000px)`): `flex: 1 1 0` slots, 14px font with
  `0 6px` padding; 341–400px `0 4px`; ≤340px 13px + `0 2px` (~262px of
  the 280px card at 320 — the first candidate 13px/4px was 281.8 > 280;
  the card clips its own overflow so the PAGE never spills and
  scrollWidth stays green while the row crowds the card edge — assert
  tab-in-card rects numerically, never trust scrollW). No
  `padding-bottom` tuning: it would double the selected underline's
  distance, inconsistent with every other RdTabs. ISSUE_GROUP_SETS
  (gen-data ~:2869) reordered Vote, Age, Gender, Education, Place, Home
  (Education from last to fourth, per the user) — groupTabs (~:3021) maps
  it, so desktop table + phone menu follow one source; order is
  presentation-only, safe to reorder. Probe
  `.matilda/probe/issues-group-menu.mjs` (gitignored dir: `git add -f`;
  23 checks, 320–1280px) asserts the six-tab menu + order at every rung,
  no `.rd-iw-chip` grouping switcher, text-overflow ≤0.5px per tab, tab
  rects inside row AND card, Issue row unchanged, click re-reads the
  groups, desktop `.rd-iw-ctl` + table intact at 1280. Probe trap: the
  panel's default view is "trust" — click the `.rd-is-tabs` tab matching
  /matters to whom/i BEFORE waiting on `.rd-iw`, or the waitForSelector
  times out and reads like a site 404.
- Layout keys off the panel's own width: two columns from 1080px of panel
  (= 1136px viewport; the chart's height follows via `useNarrow`). Verified at
  1440/1024/860/390, light and dark, with a pageerror probe
  (.matilda/issues-ipsos-probe.mjs, issues-info-probe.mjs).
- Info entry `issues` in d1a1d215: computed gap sentence, the DemosAU/Spectre
  check, working = the window's polls and answers offered, the largest lean
  taken off today (in-window houses only), and the RedBridge − Ipsos table.

## Ipsos reader traps (issues-parse.mjs `ipReports`)

- pdftotext -layout printed two of June 2026's None cells on the line ABOVE
  its label: cells are placed by the column their % sign ends under, and a
  label-less line fills the one neighbouring row missing exactly those
  columns.
- Page 2's monthly columns run through the report's year, but January and
  February reports run 13–14 months from the year before, and the years
  under them can be clipped ("202", Dec 2025). The months are read off the
  month-name line (JAN… or January…), must be consecutive and end at the
  report's month, and are dated backwards from it.
- The state reports share the page header: only pages with "The top issues
  facing Australia" are read; `coverOf` skips IM_States_ files.
- Reprints can disagree when Ipsos revises: its 2025 reports reprint April
  2024 with different figures. In range, a disagreement leaves the month
  pending (a person decides), as RedBridge's printed-twice check does.
- `Ipsos|quiet` (IP_QUIET_DAYS = 90 since the newest cached month's
  fieldwork) fails the weekly run: the page moved, the file names changed,
  or Ipsos stopped.
- The daily run fails on a page or PDF that didn't load (a 403 or timeout is
  transient, via classify-failure.mjs), and on a newly fetched report whose
  month is pending or carries an unmapped label, but only in the run that
  fetched it. Whatever landed is pushed first, so the next run finds nothing
  new and exits 0; the weekly run keeps the stale alarm up.
- Nothing records when a report went up, and the PDFs' Last-Modified stamps
  are NOT publication dates: re-uploads move them. June 2026's linked v4
  reads 23 July, but `documents/2026-07/IM_Nat_Jun_26_v3.pdf` was up on
  2 July; August 2025's linked copy reads 17 October, but its first copy
  (`documents/2025-09/`) reads 1 September and the Wayback Machine has it
  on the page on 13 September. Probe earlier `_vN` names and folders, and
  Wayback captures, before quoting a release date. First-known releases:
  2026 lags of 16–22 days after fieldwork closed (January's 31 aside);
  2025–26 median 22.5, range 10–40. By the upload folder's month, every
  month's report since Jan 2023 was out by the end of the following month
  (44 of 44). Replaying np-project over these dates gave windows of ±9–15
  days that caught 6 to 10 of the 14 releases since mid-2025, depending on
  September 2025's uncertain date – why it isn't projected.

## Adding a house or an issue

Map labels in `issues-parse.mjs` (RB_ISSUE / RS_ISSUE / YG_ISSUE / IP_ISSUE / DA_ISSUE)
only where it is the same issue; pin with a case in `test-issues.mjs`. A new
house joins ownership pooling only if its question offers Labor, the
Coalition and One Nation separately. A third salience house would need a
many-house version of pairLeanFor (or houseEffectsFor, once each poll has
three other-house neighbours).
