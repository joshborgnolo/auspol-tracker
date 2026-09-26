---
name: auspol-issues-panel
description: auspol-tracker — the Snapshot's "The issues" panel (shipped 2026-09-25; Ipsos added 2026-09-26) end to end - what each pollster publishes about issues, how .build/issues.mjs reads it into data/issues.json, how gen-data §7h pools it (houseEffectsFor on ownership, pairLeanFor on salience), the panel's two views, and the traps found building it (RedBridge's two table layouts, Resolve's double-counted July 2026, Ipsos's rolling page 2 and publication lag, why only three parties pool).
source: auto-skill
extracted_at: '2026-09-26'
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
  `.build/ipsos-src/`; only the weekly crosstabs run fetches it). Read from
  Dec 2025 (`IP_FIRST`, RedBridge's first month).
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

## Pooling (gen-data §7h)

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
  flags a Greens-first reading; the panel says so under the rows.
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

- "Who's trusted": rows sorted by salience (importance bar, three-party bar
  with dot-numbers, verdict) beside the chosen issue's monthly chart;
  `issTrendVerdict` = withinHouseSlope per party, Holm. Under the rows: the
  issue where the two salience houses' latest polls differ most (≥5
  points), then the Greens note.
- "What matters to whom": table of top-three shares by group, sentences from
  `issGroupVerdict` (the vote-by-group test).
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

## Adding a house or an issue

Map labels in `issues-parse.mjs` (RB_ISSUE / RS_ISSUE / YG_ISSUE / IP_ISSUE / DA_ISSUE)
only where it is the same issue; pin with a case in `test-issues.mjs`. A new
house joins ownership pooling only if its question offers Labor, the
Coalition and One Nation separately. A third salience house would need a
many-house version of pairLeanFor (or houseEffectsFor, once each poll has
three other-house neighbours).
