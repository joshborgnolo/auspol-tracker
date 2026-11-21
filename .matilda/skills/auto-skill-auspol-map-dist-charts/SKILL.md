---
name: auspol-map-dist-charts
description: auspol-tracker /map/ — the "Across the seats" distribution charts end-to-end (app-5-list.js lensColumn flags decile/qt10/qtPct → binsFor/distData → distSVG holder stacks, boundary ticks, ordinal x-map → hydrateDists note + drag-filter wiring), the RANK-vs-value-cut binning lesson (integer-valued measures like median age tie and lopside value-cut bins 2×), and changing a lens chart's look (worked 2026-11-07, census lenses ranked into SEIFA-style tenths b9e3ce9e, merge 704782a4)
source: auto-skill
extracted_at: '2026-11-07T02:13:08.795Z'
---

# /map/ distribution charts (the "Across the seats" side chart and kin)

The same engine renders four surfaces from ONE column definition:
1. story rail "Across the seats ‹lens›" — `storyArea` in
   `.build/map/app/app-4-story.js` (~:910): when `lensNumeric()`,
   `distBlock(m, "seats", idx.map((i) => m.divs[i]), { compact: true })`;
2. the seat story's booth distribution (`distBlock(m, "booths", js, …)` ~:1125);
3. the list view's fold-out distribution (renderList, column picked via `S.dist`);
4. column-head sparklines (`sparkSVG`, 12-bin target).

## The column is the contract

`lensColumn` + `seatCols`/`boothCols` (app-5-list.js) define per measure:
`get`, `dist: true`, `num`, `fmt`, `color`, `zero` (signed), `diverge`,
`ref` (country/state figure), and the binning flags:
- `decile` — SEIFA non-demo lenses only (`S.lens === "seifa" && !isDemo()`);
  `binsFor` returns fixed `{ lo: 0.5, hi: 10.5, w: 1, n: 10, decile: true }`.
- `qt10` (added 2026-11-07) — the census people lenses
  (`S.lens === "seifa" && isDemo()`); `qtPct` marks share measures
  (fmt f1 — median age/income are years/dollars and get no "%" tick suffix).
Otherwise `binsFor` builds NICE-bin histograms from the data
(target ~22 bins seats / ~44 booths / 18|24 compact / 12 spark).

## The tenths (qt) binning — RANK membership, never value cuts

In `distData`, when `c.qt10 && unit === "seats" && !plain && vals.length >= 10`
(sparse scopes like TAS's 5 seats fall back to the histogram):
seats are sorted by value, member k goes to bin `floor(10k/n)` — each bar is
a tenth of the seats ±1 — and `B.cuts` (11 entries) is built from group
boundary midpoints for DISPLAY, FILTER and x-MAPPING ONLY. This was the
session's load-bearing finding: the first attempt assigned membership by the
value cut points, and integer-valued measures (median age) tie so heavily
across cuts that bars rendered 2× off (probe: 25px vs 49px) — rank membership
is what makes "each bar a tenth" true. Tie straddles make the filter/tooltip
approximate at boundaries; accepted.

## distSVG mechanics (all bins are equal PIXEL width)

- `bw = (W - padL - padR) / B.n`; the bar loop draws every bin at
  `x(v0) + gap/2`. The x closure differs: value-linear normally, qt = ordinal
  piecewise over `cuts` (value inside bin k → sub-interpolates cuts[k]..cuts[k+1]).
- Holders stack (`rect` per family, `fill="var(--m-<fam>)"`) when
  `unit === "seats" && (c.decile || B.qt)` — heights equal by construction,
  so who holds them is the reading; note line in `hydrateDists`:
  "Each bar is a tenth of the N seats, from the {least advantaged|lowest} on
  the left, split by who holds/won them".
- Ticks: decile `[1,5,10]`; qt `[0,5,10]` mapped via `x(B.cuts[t])` and
  labelled with the boundary VALUES in the measure's own fmt, "%" appended on
  the max tick only when `c.qtPct`; histogram = `d3.ticks` (existing "%"
  suffix rule applies to /tpp|inf|final|lens|lead/ keys).
- The country-figure dashed ref line and the selected-seat ▲ reuse the same
  x closure — nothing extra needed for qt; they interpolate into the right bin.
- Interactivity needs NO new wiring for ordinal bins: `binAt` is already
  pixel-ordinal (`fx * D.B.n`). The reading sites DO need qt branches:
  pointermove tooltip's `v0/v1 = B.cuts[k]/B.cuts[k+1]`, pointerup filter
  `lo/hi = B.cuts[a]/B.cuts[b+1]`.
- `distData(m, unit, rows, key, target, plain)` — pass `plain: true` to skip
  qt binning; `sparkSVG` does this because a spark's job is the distribution's
  shape, and rank-tenths would draw ten like-sized bars.

## Verify

1. `node .build/map/assemble.mjs` — app/* folds into `map/map.js` (+ stamps
   `map/index.html`); `test-map-page.mjs` pins currency ("map/map.js is
   current, its data stamps too").
2. Map fleet: `node .build/test-map-{page,draw,areas,urban,primary-breakdowns,
   vote-bands,history,senate,geo,geo-build,boundary-vintages}.mjs`.
3. Headless probe `.matilda/probe/map-census-tenths.mjs <baseUrl>` (serve the
   repo root first, e.g. `python3 -m http.server 8141`): census views at
   `?#y=2025&l=seifa&i=age` / `i=fborn` show ten equal-height stacked tenths
   with the tenths note and boundary ticks (no "%" on medians, "%" on shares);
   SEIFA `i=ieo` keeps its 1/5/10 decile ticks and "least advantaged" wording;
   `#y=sa26` state frame ranks tenths at 47 seats; no phone overflow.

## Adjacent

- Sibling-era `/map/` skills: auspol-map-theme-palette (colours),
  auspol-map-head-stat-rows (winner head), auspol-map-data-commit-order
  (commit order incl. assemble), auspol-headless-geometry-verify (probe style).
- Sibling sessions commit to this file area constantly; land feature edits
  from a worktree (auspol-branch-merge-land-race) — uncommitted main-checkout
  edits can be silently reset by a sibling's clean-room landing.
