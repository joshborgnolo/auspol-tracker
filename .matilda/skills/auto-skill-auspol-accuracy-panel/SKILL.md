---
name: auspol-accuracy-panel
description: auspol-tracker — the "How the final polls did" AccuracyPanel end-to-end: gen-data.mjs accuracyCycles (~:1490-1550; ACC_WINDOW_DAYS=14, one final 2PP poll per house equally weighted, exit polls excluded, ACC_CANON renames-only, houses sorted by |err|) emits D.accuracy.cycles {year,eDate,result,mean,err,absErr,houses,n,sameSide,worst} + per-firm aggregates; renderer in the d1a1d215 asset (~:1956-2145) with Last-five/More split BY POSITION, lanesFor spread toggle, small .acc-dot per house + big .acc-mean average dot, "All one way" flag, bothWays hint paragraph, by-house grid for firms with n>1. Solo-rule (9c8c6ee + rebuild 83618e0): a one-house election (1993, 1996) draws ITS OWN poll as the big dot, never an average-of-one stacked on its own small dot.
source: auto-skill
extracted_at: '2026-09-04T07:32:32.121Z'
---

# auspol-accuracy-panel — "How the final polls did"

## Data side: `gen-data.mjs` (~lines 1476–1560)

The panel's entire methodology is stated in the block comment above
`const ACC_WINDOW_DAYS = 14` — read it before changing anything; it is
the on-page caveat and the reproducibility contract. Distilled:

- **Rule**: every house's LAST poll with a 2PP within `ACC_WINDOW_DAYS`
  (14) of polling day, ONE poll per house, **equally weighted** (not
  sample-weighted — "each house is a separate attempt at the same
  question").
- **Exit polls excluded** (`/exit/i.test(p.firm)`); a house's
  undecided-inclusive pair (Essential) is normalised the same way the
  trend series normalises it *before* scoring, so a 48/47 arithmetic
  artefact isn't scored as a miss.
- **`ACC_CANON` is renames-only** (`Morgan→Roy Morgan`,
  `Newspoll-YouGov→Newspoll`, `Resolve Strategic→Resolve`, …). Galaxy
  and YouGov are deliberately NOT merged — merging houses to build a
  longer record is a claim about continuity of method the table refuses
  to make.
- `accuracyCycles` = CYC_META entries with `!c.current && c.src`; each
  emits `{year: c.src (the election being CALLED, not the one that
  started the term), eDate, result, mean, err, absErr,
  houses: [{firm, date, alp2pp, err}] sorted by |err|, n, sameSide,
  worst}`. Cycles with zero houses in the window are dropped
  (`return null`).
- A second pass builds `accuracy.firms`: per-house `{firm, n, cycles,
  meanAbs}` aggregates. Payload lands in `D.accuracy`; the component
  binds it as `A` (`A.cycles`, `A.windowDays`, `A.meanAbs`, `A.firms`,
  `A.oneSided`-derived flanking).
- Cycle singletons as of 2026-09: **1993 and 1996 have n=1**; the rest
  are n=3–11. For singletons `c.err === c.houses[0].err` exactly, so
  any solo-aware display logic needs no arithmetic.

## Renderer: `.build/newtracker/assets/d1a1d215-…js` (~lines 1956–2145, `AccuracyPanel`)

- Rows: `byRecency` sorted year-desc, split **by position, never by
  year** — `recent = slice(0,5)` labelled "Last five elections", the
  rest "More elections" — so a newly added election slides in without
  touching the panel. `ri` = global row index across both groups,
  drives tooltip flip on the top row.
- Spread machinery: `lanesFor(c.houses)` / `laneOffset` / `LANE_H`,
  surfaced by an **acc-spread toggle button rendered only when
  `stacked > 0`** ("Separate overlapping dots" — steps identical-miss
  dots into vertical lanes without moving them on the scale; track
  height grows by `26 + maxOff*2`).
- Scale header `acc-scale`: left "← Labor understated" (LNP colour),
  centre "Result", right "Labor overstated →" (ALP colour). Negative
  err = the poll understated Labor.
- Dots: small `.acc-dot` (8px) per house with its own tooltip
  (title=firm, date=poll date, "Poll/Result/Miss"); big `.acc-mean` at
  `pct(c.err)` labelled "Average of N final polls" with row label
  "Poll average". `.acc-err` column = signed `c.err` in `col(c.err)`.
  `.acc-note` = "N house(s)" + **`All one way` flag** when `c.sameSide`
  (title copy: "the signature of an industry-wide problem rather than
  one firm's noise").
- Hint copy (`table-hint`) covers: spread-lane explanation, exit-poll
  exclusion, undecided normalisation, and the **bothWays paragraph** —
  when >1 one-sided election exists and they missed in OPPOSITE
  directions ("not a standing lean that today's figures could be
  corrected for. It is the size of the error, not its direction, that
  carries."). Don't lose that paragraph when editing the hint.
- `acc-firms` grid renders ONLY firms with `n > 1` ("By house, where
  there is more than one election to judge on"); hint notes houses are
  not merged across renames of different operations.

## Solo rule — shipped `9c8c6ee` + rebuild `83618e0` (2026-09-04)

User request: "when there is only one poll for an election, don't
display the average just display the poll". Before the fix, a singleton
cycle drew the big mean dot exactly on top of its only member's small
dot. Implementation, entirely in the renderer:

```js
const solo = c.n === 1 ? c.houses[0] : null;
const accErr = solo ? solo.err : c.err;   // identical, but named
```

- House dots suppressed when solo: `{!solo && c.houses.map(…)}`.
- The big dot renders the poll itself: tooltip title = firm name,
  date = `solo.date` (not `eDate`), first row label "Poll" /
  value `solo.alp2pp`, aria-label rewritten to name the firm; else the
  pre-existing average strings.
- Hint copy gained the clause "…– where only one house was in the
  field, its own figure stands alone; …" (verify compiled output with
  `grep -c 'stands alone' index.html` → 4 repetitions; it also confirms
  on the live site).
- NO CSS change needed: `.acc-mean` was already a plain round dot.
  `.acc-err` already equals `solo.err` for singletons, so the side
  column needed no branch.

## Editing cautions

- Results are stored at AEC precision (2019 = 48.47); everything is
  displayed at 1dp (`toFixed(1)`) — the comment by `.acc-detail` calls
  this deliberate.
- The data rule comment and the page hint copy must stay in sync:
  change the window, weighting, or exclusions in gen-data and the
  `table-hint` text moves with it.
- Precision trap: `sameSide` uses the unrounded signs, so a cycle can
  show "All one way" with rounded misses that look like 0.0.
