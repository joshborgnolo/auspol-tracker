---
name: auspol-house-credit-lists
description: auspol-tracker — the "· House A, House B and House C" credit lists on the National-direction, Undecided and Leader-net-favourability panels. Derived in gen-data.mjs by creditHouses() (shipped 8d1cc7e, 2026-09-23): a house counts only with a reading within six months of the series' OWN newest reading, ordered most-readings-first; creditHousesWithStopped() (157f35c, 2026-09-24) appends pollsterRules.stopped contributors as "Name (inactive)" and a declared stop OVERRIDES the recency window; directionStoppedSince (2026-09-28) dates each stopped direction house ("became inactive in ‹Month YYYY›" = month AFTER its last series reading); the same footer (same day) singles out an ACTIVE house on a lone reading ("has supplied only one direction reading, in ‹M YYYY›" from directionPolls counts) and closes its list with a panel-local Oxford-comma rdListOx. Also the gen-data dx() unit trap: dx() returns DECIMAL YEARS (chart x-units), not ms — window comparisons against it silently never trigger.
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
  don't "fix" it to be alphabetical. By 2026-09-28 RedBridge/Accent had
  joined the direction roster:
  `directionHousesAll = ["Roy Morgan","Essential","Spectre Strategy","RedBridge/Accent","Freshwater (inactive)"]`.

## Dating the stop — directionStoppedSince (2026-09-28, direction only)

Task: the direction footer's bare "Freshwater has stopped asking" became
"Freshwater became inactive in ‹Month YYYY›" per user request. New derived
const sibling to directionHousesAll, computed in gen-data right after it:

```js
const dirLastYm = {};
for (const d of DIR) {
  if (!MONTH_SET.has(ymOf(d.date)) || !STOPPED_HOUSES.has(d.pollster)) continue;
  … // max ymOf(d.date) per firm
}
// then each ym bumped ONE MONTH (Dec → next-year-01)
```

- Convention (chosen, user-ratifiable): **"became inactive in ‹M YYYY›" =
  the month AFTER the house's last series reading** — its first quiet month
  (Freshwater's last direction reading Oct 2025 → "became inactive in
  November 2025"). "Inactive in the last-reading month" would be false copy
  (it published then). If the user ever says the displayed month feels
  wrong, the knob is the one-month bump in the derivation loop.
- Derived from the DIRECTION series (DIR, MONTH_SET-scoped), never from
  poll rows: a house goes quiet per-measure (Freshwater polled VI to
  May 2026). Emitted as `const directionStoppedSince = {"Freshwater":"2025-11"}`
  and added to the gen-data return list beside directionHousesAll;
  renderer is the RdDirection foot in rd-panels.jsx (~:887): a sinceGroups
  Map groups inactive houses by ym so two houses quiet in the same month
  share one clause ("A and B became inactive in M"), differing months join
  with "; "; "became" needs no has/have agreement. A "(has|have) stopped
  asking" fallback branch remains in the JSX for a ym-less house — with the
  shared derivation that case is unreachable, kept only against a stale
  hand-built bundle.
- Only the direction panel got dates; favHouses' "(inactive)" label in the
  ApprovalPanel sub is undated (not requested).

## Lone-reading houses, Oxford comma, sentence shape (2026-09-28, same footer)

User spec (verbatim target, filled by derivation): "Essential, Spectre Strategy,
and RedBridge/Accent supply the rest. RedBridge/Accent has supplied only one
direction reading, in ‹M YYYY›; Freshwater became inactive in November 2025."

- `sparseBits` (rd-panels foot ~:895-900): the non-`top` ACTIVE houses with
  `counts[h] === 1` over `D.directionPolls` get
  "‹House› has supplied only one direction reading, in ‹Month YYYY›" — the
  date is the spare row's OWN `ym` field (directionPolls rows carry
  `ym`/`pollster`/`x`; no date parsing). Currently RedBridge/Accent
  (hand-entered one-off, May 2026). Derived, so the clause deletes itself
  when that house's second wave lands; `top` is excluded (it is by
  definition the plurality house).
- Sentence shape changed: "…supply the rest" now ENDS a sentence; sparse and
  inactive bits share the NEXT sentence —
  `tail = sparseBits.concat(inactiveBits).join("; ")` — replacing the old
  `inactiveClause` string that opened with "; " and glued the stop clause
  onto the supply-the-rest sentence. Rendered 2026-09-28 (68 readings):
  "Most readings are Roy Morgan's weekly poll: 47 of the 68 since May 2025.
  Essential, Spectre Strategy, and RedBridge/Accent supply the rest.
  RedBridge/Accent has supplied only one direction reading, in May 2026;
  Freshwater became inactive in November 2025."
- `rdListOx` — PANEL-LOCAL Oxford-comma joiner ("A, B, and C"; 1–2 items
  delegate to rdList), used only for this closing list because the user
  quoted it with the Oxford comma. Shared `rdList` (bare "and", ~:954) is
  untouched — every other list on the site keeps the no-comma house style.
  Don't widen a user's quoted Oxford comma into a global rdList change.
- House names in templates come from DATA. The user's spec wrote
  "Redbridge/Accent" twice; the stored canonical name is "RedBridge/Accent"
  and that is what renders in both clauses. Follow the data, not the user's
  loose house-name typography — same rule as the direction-dek skill's
  loosely quoted sentences. If a rename is really wanted it belongs in
  polls.json/`canonFirm`, not in template literals.
- `ymLong(ym)` is the footer's single month-name formatter
  (`D.monthNameFull(Number(ym.slice(5))) + " " + ym.slice(0, 4)`) — clone
  it rather than re-deriving month labels inline.

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
grep -A2 'const directionStoppedSince' index.html   # per-firm first quiet month
grep -o 'became inactive in ' index.html            # the rd-panels foot clause
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
