---
name: auspol-map-winner-legend
description: auspol-tracker /map/ — when the "Who holds each seat today" legend chips show or lose their seat tallies (user-dictated de-dupe, 5a9caafb 2026-11-07): the winner-lens .lg-cats row is colour-and-tag ONLY — the per-party counts now live solely in the winner head's Seats row beside/below it, while the senate and seat-type legend variants still count (the .lg-cats b styling is shared) and the counters themselves stay as the seat-presence filter; reps 5a9caafb in legendHTML app-6-ui.js, .lg-cats/.lg-unit CSS homes, map-winner-head probe pins.
source: auto-skill
extracted_at: '2026-11-07T03:20:00.000Z'
---

# /map/ — the winner legend is colour and tag only (since 5a9caafb)

**Contract** (user call 2026-11-07, landed `5a9caafb`): under the winner-lens
title ("Who holds each seat today" / "Who won each seat in 2025" / booths'
"Who led the final count at each place"), the `.lg-cats` chip row carries ONE
colour chip + party tag per family — **never the seat tallies**. Those tallies
(ALP 94 · L/NP 41 · …) are shown once, in the winner head's Seats row (the
stat summary panel beside the map on large screens, below it on small), so the
legend would be a verbatim duplicate a room away.

## Where it lives — `legendHTML` in `.build/map/app/app-6-ui.js` (~:284-296)

```js
h += `<div class="lg-cats">${catFams.map((f) => `<span><i style="${swc(f)}"></i>${famTag(f)}</span>`).join("")}</div>`;
```

The counts (`<b>${nOf(f)}</b>`) and the booth-view "seats" unit chip
(`.lg-unit`) were deleted together — the unit existed only to clarify those
numbers, so with the numbers gone the chip was nonsense. Its CSS rule
`.lg-unit { color: var(--ink-3); }` went in the same commit; grep finds zero.

**The counters (`cnt`, `nOf`) themselves MUST STAY** — they did not die with
their display:

- `catFams` filters on them ("a party with none [of the seats] is left out"),
  and One-Nation-era membership via `famEraOpts`.
- `nOf` folds Community Strong (`.csa`) into `ind` over polling places — the
  fold logic counts the seats; only the rendering went.

## The `.lg-cats` class is SHARED — do not copy this change to its siblings

- **The SENATE legend** (`.build/map/app/app-3b-senate.js`, its own `cats`
  builder) still prints `<b>${cnt[f]}</b>` per party — Senate seat tallies
  have no stat-summary sibling to defer to.
- **The seat-type legend** (winner-adjacent `cls` lens in app-6-ui.js ~:369)
  still prints per-type counts ("Inner metro 44").
- So `.lg-cats b { font-weight: 600; … }` and `.lg-cats`'s flex rules in
  **page.css** are load-bearing for the siblings — leave them. Deleting
  `.lg-cats b` like the winner row was wrong-headed surgery; the row content
  differs per lens call site.
- The same-day "tighter head" era and its Spiel: `map-winner-head` probe (see
  below) also pins the chamber-side "By state or territory" heading — owned by
  the sibling chamber-table lane, red at some bases; don't fix it inside a
  legend change.

## Pin

`.matilda/probe/map-winner-head.mjs` (tracked file under gitignored
`.matilda/*` — commit with `git add -f`), its "now legend" block:

- seats view on "now": exactly 7 `.lg-cats > span` (ALP, L/NP, GRN, IND, CS,
  ON, OTH — CS own family visible on federal now).
- `legend-balloons` (booths): 6 chips — `csa` folds into IND.
- `.lg-cats b` count === 0, `document.querySelector(".lg-unit")` null, and no
  chip text matches `/\d/` (tags carry no digits).
- Note the probe's preceding block STILL asserts the winner head's Seats row
  content (`s.seatSmalls` etc.) — that's the surviving home of the tallies.

After edits here: `node .build/map/assemble.mjs` (rewrites map/map.js +
map/map.css + restamps map/index.html), then `test-map-page`,
`test-map-draw`, `test-map-vote-bands`, `test-map-primary-breakdowns` and the
two head probes. Same-day races are normal — rebase onto the moved origin and
regenerate generated conflicts (`--theirs` + re-assemble + rebase --continue),
per auspol-branch-merge-land-race.
