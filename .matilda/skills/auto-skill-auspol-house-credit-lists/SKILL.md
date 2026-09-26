---
name: auspol-house-credit-lists
description: auspol-tracker — the "· House A, House B and House C" credit lists on the National-direction, Undecided and Leader-net-favourability panels. Derived in gen-data.mjs by creditHouses() (shipped 8d1cc7e, 2026-09-23): a house counts only with a reading within six months of the series' OWN newest reading, ordered most-readings-first; creditHousesWithStopped() (157f35c, 2026-09-24) appends pollsterRules.stopped contributors as "Name (inactive)" and a declared stop OVERRIDES the recency window. Also the gen-data dx() unit trap: dx() returns DECIMAL YEARS (chart x-units), not ms — window comparisons against it silently never trigger.
source: auto-skill
extracted_at: '2026-09-24T07:06:54.567Z'
---

# House credit lists (direction / undecided / favourability panels)

Task origin (2026-09-23): the National-direction card subtitle credited
"Roy Morgan, Essential, Spectre Strategy **and Freshwater**" — Freshwater's last
direction reading was 2025-10-20, eleven months stale, though it polled voting
intention into May 2026. The list looked "dynamic" (derived, not hard-coded) but
was scoped to the chart's full span (MONTHS ≈ 17 months), so a silent house kept
its billing for a year.

Follow-up (2026-09-24, commit 157f35c): user spotted the asymmetry — direction
OMITTED Freshwater (aged out of the window) while the approval subtitle's
HARD-CODED roster named it as live. Fix: stopped houses are listed LAST as
"Name (inactive)" in both panels, via a new helper (below); the approval
favourability roster is now derived too (it had also missed Spectre, a
favourability house since Jul 2026 — the hard-coded copy had fallen behind).

## Where the lists live

Both credit lists are DATA, emitted by `.build/newtracker/gen-data.mjs` — never
edit the asset JSX to change names; since 157f35c there is **no hard-coded
house list anywhere in copy** (the last one was the ApprovalPanel fav subtitle,
a11e1559 ~:1159, now `houseList(D.favHouses)`). Consumers render via
`houseList(names, max=4)` (a11e1559 ~:1266): Oxford-comma join, capped
"… and others" past 4.

- `directionHouses` — ACTIVE houses only (the count source). Emitted as
  `const directionHouses = [...]`; consumed by `DirectionPanel` for the
  How-to-read line "Only {N} houses ask this question".
- `directionHousesAll` (157f35c) — active + stopped-labelled name list for the
  CARD-SUB caption (`D.directionHousesAll || D.directionHouses` in the JSX, so
  an older data bundle still renders).
- `favHouses` (157f35c) — the net-FAVOURABILITY houses in the approval series
  (`appl`/`appr` rows filtered by `FAV_FIRMS.has(canonFirm(r.firm))` — the firm
  set from `metricRules.favFirms`, same order/stopped treatment); consumed by
  the ApprovalPanel fav-mode card-sub. Stored firm names appear verbatim in the
  list, e.g. "RedBridge/Accent". The NET-mode subtitle ("Newspoll, YouGov,
  Resolve, Essential, and others") is STILL hard-coded at a11e1559 ~:1155 —
  untouched, flagged only if a house set ever changes.
- Undecided — per-series `series[].houses` plus overall `undecided.houses`,
  still plain creditHouses (no stopped tail requested there).
  See `auspol-undecided-basis-display` for the basis machinery.

## The recency rule — creditHouses() (gen-data ~:1102)

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

## Stopped houses — creditHousesWithStopped() (157f35c, gen-data ~:1121)

```js
const STOPPED_HOUSES = new Map(
  Object.entries(D.pollsterRules || {}).filter(([, r]) => r && r.stopped));
const creditHousesWithStopped = (items, firmOf, xOf, display = (f) => f) => {
  const active = creditHouses(items, firmOf, xOf).filter((f) => !STOPPED_HOUSES.has(f));
  const stopped = [...new Set(items.map(firmOf))]
    .filter((f) => !active.includes(f) && STOPPED_HOUSES.has(f))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `${display(f)} (inactive)`);
  return [...active.map(display), ...stopped];
};
```

- A DECLARED stop (`pollsterRules.<firm>.stopped: true` — currently only
  Fox & Hedgehog and Freshwater) **overrides the recency window**: the house is
  filtered OUT of the active list even when its last reading sits inside 183
  days. Freshwater's last approval-series reading (2026-05-15) was inside the
  window, so pure recency still billed it as live on the favourability panel —
  that was the exact bug the user reported. Never re-infer "inactive" from
  recency alone; always go through this helper or replicate its filter.
- Stopped contributors **that actually fed the series** append at the end,
  alpha-sorted, as `Name (inactive)` (via the `display` fn). A stopped house
  with no rows in the series does not appear at all.
- The `display = (f) => f` default matters: the helper maps BOTH halves; before
  the default existed the build died with `TypeError: display is not a
  function`. (build.mjs swallows gen-data stderr — run
  `node .build/newtracker/gen-data.mjs` standalone to see errors.)
- Call sites (gen-data ~:1156-1173, emits ~:3641):
  - `directionHouses` — UNCHANGED plain creditHouses (active only) → the
    How-to-read "Only N houses" count.
  - `directionHousesAll` — creditHousesWithStopped over the same MONTH_SET
    scope → the card-sub caption; DirectionPanel uses
    `D.directionHousesAll || D.directionHouses`.
  - `favHouses` — creditHousesWithStopped over
    `appr.filter((r) => FAV_FIRMS.has(canonFirm(r.firm)))` (FAV_FIRMS from
    `metricRules.favFirms`; `canonFirm` strips "(…)" and "/…" before lookup but
    the list shows the STORED name, e.g. "RedBridge/Accent") → the
    ApprovalPanel fav-mode subtitle, replacing the hard-coded roster that had
    named Freshwater live and omitted Spectre Strategy (a fav house since
    Jul 2026). Only the FAV subtitle went data-driven; the NET-mode roster
    string at a11e1559 ~:1155 is still literal copy.
- Shipped 157f35c with these built values (2026-09-24):
  `directionHousesAll = ["Roy Morgan","Essential","Spectre Strategy","Freshwater (inactive)"]`,
  `favHouses = ["DemosAU","RedBridge/Accent","Spectre Strategy","Freshwater (inactive)"]`.
  Order between the two differs because active ordering is reading-count —
  don't "fix" it to be alphabetical.

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
node .build/newtracker/gen-data.mjs   # standalone: surfaces errors build.mjs swallows
node .build/newtracker/build.mjs && node .build/newtracker/validate.mjs
grep -o 'const directionHouses = \[[^]]*\]' index.html   # the arbiter
grep -o 'const directionHousesAll = \[[^]]*\]' index.html
grep -o 'const favHouses = \[[^]]*\]' index.html
grep -c '(inactive)' index.html      # expect ≥ 4 (two lists × data asset + jsx)
grep -o 'const directionHouses = \[[^]]*\]' .build/newtracker/assets/9f09dca2-*.js
```

Validator summary line `polls NNN · errors 0` is the pass arbiter (164 / 0 at
2026-09-24); primary-sum lines above it are informational.

Probe house staleness before guessing (latest reading per house, direction
reads `D.direction`, undecided reads `polls[].undecided != null`; newest poll
per house from `polls[].date`). In 2026-09: Freshwater's last DIRECTION reading
was Oct 2025 while its last VI poll was May 2026 — "inactive" per-measure, so
the rule is per-series, never a global house-off switch.

## House lists that must NOT get this filter

Flow-drift `meta.houses` (per-firm chart series, historical record) and accuracy
`c.houses` (per-cycle election accounting) legitimately include inactive houses —
those are time-arcs, not present-tense credit. Only the credit prose got scoped.
