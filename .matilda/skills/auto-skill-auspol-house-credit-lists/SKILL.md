---
name: auspol-house-credit-lists
description: auspol-tracker — the "· House A, House B and House C" credit lists on the National-direction and Undecided panels. Derived in gen-data.mjs by creditHouses() (shipped 8d1cc7e, 2026-09-23): a house counts only with a reading within six months of the series' OWN newest reading, ordered most-readings-first. Also the gen-data dx() unit trap: dx() returns DECIMAL YEARS (chart x-units), not ms — window comparisons against it silently never trigger.
source: auto-skill
extracted_at: '2026-09-23T03:31:55.151Z'
---

# House credit lists (direction / undecided panels)

Task origin (2026-09-23): the National-direction card subtitle credited
"Roy Morgan, Essential, Spectre Strategy **and Freshwater**" — Freshwater's last
direction reading was 2025-10-20, eleven months stale, though it polled voting
intention into May 2026. The list looked "dynamic" (derived, not hard-coded) but
was scoped to the chart's full span (MONTHS ≈ 17 months), so a silent house kept
its billing for a year.

## Where the lists live

Both credit lists are DATA, emitted by `.build/newtracker/gen-data.mjs` — never
edit the asset JSX to change names; there is no hard-coded house list anywhere
in copy (verified by grep). Consumers both render via `houseList(names, max=4)`
in `assets/a11e1559-….js` (~:1223): Oxford-comma join, capped "… and others".

- `directionHouses` — gen-data ~:1022, emitted into the 9f09dca2 data asset as
  `const directionHouses = [...]`; consumed by `DirectionPanel` (`D.directionHouses`)
  for the card-sub AND for the caption's "Only {N} houses ask this question".
- Undecided — per-series `series[].houses` (gen-data ~:1294, inside the
  `UNDECIDED_BASES.map`) plus overall `undecided.houses` (~:1303). Rendered at
  a11e1559:1409 (panel head) and :1427 (per-basis read-note).
  See `auspol-undecided-basis-display` for the basis machinery.

## The recency rule — creditHouses() (gen-data ~:983)

```js
const CURRENT_HOUSE_MS = 183 * 86400000;   // ~6 months
const creditHouses = (items, firmOf, xOf) => { … };
```

- A house is credited only if it published THAT measure within six months of the
  SERIES' OWN newest reading (not of today — deterministic per polls.json, and the
  list always matches "who feeds the visible recent line").
- Callers pass a **millisecond** extractor: `(d) => Date.parse(d.date)` /
  `(d) => Date.parse(d.released)`. This is the fix for the trap below.
- Direction keeps its pre-existing MONTH_SET scope (the visible-chart months)
  BEFORE the recency filter; the filter then drops span-ancient houses.
- Ordering: reading-count desc, ties alphabetical (`localeCompare`). Freshwater
  had dropped out at 2026-09-23: `["Roy Morgan","Essential","Spectre Strategy"]`.

## TRAP — dx() is decimal years, not ms (first fix silently no-oped)

`const dx = (iso)` (gen-data ~:170) converts an ISO date to a FRACTIONAL YEAR
(`y + doy/365`) — the chart's x-units, not milliseconds. My first version passed
`(d) => dx(d.date)` as the recency x-extractor, so `newest - x > 183·86400000`
was never true (diffs of ~1.0 vs a constant of ~1.58e10): the build ran green,
validate ran green, and the emitted list was IDENTICALLY the stale one. Only
grepping the emitted value caught it. Related unit map in gen-data: `mx(ym)`
(fractional-year mid-month x), `midMs(p)` (ms — used by cadence math),
`Date.parse` (ms), `ymOf` (yyyy-mm). Any recency/window logic in gen-data must
state its units in the extractor, and the verify step below is mandatory — log
silence proves nothing.

## Verify

```bash
node .build/newtracker/build.mjs && node .build/newtracker/validate.mjs
grep -o 'const directionHouses = \[[^]]*\]' index.html   # the arbiter
grep -o 'const directionHouses = \[[^]]*\]' .build/newtracker/assets/9f09dca2-*.js
```

Probe house staleness before guessing (latest reading per house, direction
reads `D.direction`, undecided reads `polls[].undecided != null`; newest poll
per house from `polls[].date`). In 2026-09: Freshwater's last DIRECTION reading
was Oct 2025 while its last VI poll was May 2026 — "inactive" per-measure, so
the rule is per-series, never a global house-off switch.

## House lists that must NOT get this filter

Flow-drift `meta.houses` (per-firm chart series, historical record) and accuracy
`c.houses` (per-cycle election accounting) legitimately include inactive houses —
those are time-arcs, not present-tense credit. Only the credit prose got scoped.
