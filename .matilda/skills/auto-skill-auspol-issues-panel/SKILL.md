---
name: auspol-issues-panel
description: auspol-tracker — the Snapshot's "The issues" panel (shipped 2026-09-25) end to end - what each pollster publishes about issues, how .build/issues.mjs reads it into data/issues.json, how gen-data §7h pools it, the panel's two views, and the traps found building it (RedBridge's two table layouts, Resolve's double-counted July 2026, why only three parties pool).
source: auto-skill
extracted_at: '2026-09-25'
---

# The issues panel

## What exists, per house (checked Sep 2026, all cached reports read)

- **RedBridge/Accent**, monthly (report text in `.build/redbridge-src/`):
  - salience: "rank your top 3" of 14 issues. Summary table ("Issue salience
    in the two most recent waves") from April 2026; each summary also
    reprints the previous wave, which is how March 2026 (never cached) is
    read. Dec 2025–Feb 2026 print figures only – their all-voters numbers come
    from each issue's table by group (4 issues, 6 from February).
  - salience by group: one table per issue (cost of living, health, housing,
    immigration; crime and economy from Feb) by vote, softness, generation,
    gender, location, education, home ownership.
  - best party ("best able to deal with…"): 6 issues, 9 from March. December
    offered "The Liberal National Party Coalition" as ONE option (7 columns);
    January on, Liberal and National apart (8). Read off the header.
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
- **DemosAU** (open-ended "biggest issue", AI-coded, monthly from Feb 2026)
  and **Spectre** (pick up to 3 of 17, ~quarterly, party breakdown chart-only)
  ask salience differently – not pooled, not shown.

## Pooling (gen-data §7h)

- Ownership pools ONLY Labor / Coalition / One Nation as shares of those
  naming one of the three: the answer sets differ (no Greens at Resolve,
  "all about equal" only at RedBridge), and this is the part every current
  question shares. Six-week window (SPARSE_K), no house effect (two regular
  houses – not estimable). `leadSig`: the leader-minus-runner-up margin as
  its own measure, variance (a + b − (a − b)²)/n.
- The three parties leave out 22–41% of voters on most issues and 56–58% on
  climate at RedBridge/YouGov (the Greens). `grnTop` flags a Greens-first
  reading; the panel says so under the rows.
- Salience and salience-by-group: RedBridge alone, six-week window. Group n =
  poll n × rough group share (vote groups from the wave's primaries, 0.92
  decided; Liberal : Nationals-side 65:35) – it sizes the sampling floor only.

## The panel (a11e1559 `IssuesPanel`, composed in 73de0c58 before Undecided)

- "Who's trusted": rows sorted by salience (importance bar, three-party bar
  with dot-numbers, verdict) beside the chosen issue's monthly chart;
  `issTrendVerdict` = withinHouseSlope per party, Holm.
- "What matters to whom": table of top-three shares by group, sentences from
  `issGroupVerdict` (the vote-by-group test).
- Layout keys off the panel's own width: two columns from 1080px of panel
  (= 1136px viewport; the chart's height follows via `useNarrow`). Verified at
  1440/1024/860/390, light and dark, with a pageerror probe.
- Info entry `issues` in d1a1d215 (working: the window's polls and the
  answers each offered).

## Adding a house or an issue

Map labels in `issues-parse.mjs` (RB_ISSUE / RS_ISSUE / YG_ISSUE) only where
it is the same issue; pin with a case in `test-issues.mjs`. A new house joins
ownership pooling only if its question offers Labor, the Coalition and One
Nation separately.
