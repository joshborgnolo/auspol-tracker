---
name: auspol-map-head-figure-expanders
description: auspol-tracker — adding/extending an interactive click-to-expand figure in the /map/ Winner head's figure rows (the underlined "Others" opener on the PRIMARIES row, shipped 7b3a1080 on 2026-11-06; extended to the SEAT card's Primaries on 2026-11-10 — seatPrimariesStat runs the same statOthersRows/statScopeOf(m).open machinery); the Seats twin ffc74792 was REVERTED bab2449d the same day — the always-on seat-makeup legend from bfc37eba names every crossbench group, so the user ("all the parties are shown underneath the new seat-count bar anyway") dropped it; do NOT re-add a Seats expander while that legend exists). Homes: .build/map/app/app-4-story.js (statPrimaryCols/statPrimaryGrid + statOthersRows) with the open flag on statScopeOf(m), [data-othx] dispatch in the #story click in app-6-ui.js, .st-othb/.st-othx styles in .build/map/app/page.css — the only CSS source: map/map.css is assemble.mjs's verbatim product, never edit it. Oracle-pinned in .build/test-map-primary-breakdowns.mjs (vm-sandbox pattern).
source: auto-skill
extracted_at: '2026-11-06T06:39:24.423Z'
---

# /map/ Winner-head figure expanders (the "Others" openers)

The user-facing contract, established 2026-11-06: the residual figure in the
head's PRIMARIES row (the Others column) carries an UNDERLINE to say it opens.
Clicked, that column drops out of the row (remaining figures recentre — the
grid is auto-columned) and the figure's contents list in a smaller line
directly below, with changes where the data allows; clicking the line folds
it back into the figure. The open state rides the frame's figure view like
the scope menu's choice.

**The Seats twin is GONE.** The user asked for the same treatment on the
Seats row 40 min later; it shipped (ffc74792), only for an always-on
seat-makeup LEGEND naming every crossbench group to land a few minutes
earlier on the same head (sibling's bfc37eba). The user removed the seats
expander the same evening once the duplication was pointed out (`bab2449d`
— an exact `git revert` of ffc74792): the row is back to plain figures and
composition lives in the bar legend. Its code survives in git history
(ffc74792^·ffc74792 and its revert) — reclaim from there only if the legend
itself goes away; presenting the "land it / legend is enough / land with
changes" choice to the user first is what this session established as the
norm when the ground shifts under a shipping feature.

## Homes

- `.build/map/app/app-4-story.js` — everything but dispatch/CSS:
  - `statPrimaryCols(m, A, keys)` (~:230) builds the primary-row columns
    `[tone, share, change, label, key]`. "oth" is always LAST and is a pure
    residual: `max(0, 100 − alp − lnp − Σbloc)`, where bloc = grn/onp fams at
    ≥10% plus any `party:<name>` column for an oth-fam party ≥10% in the scope
    (Xenophon SA 2016 — the worked exclusion case everywhere in the tests).
  - `statOthersRows(A, cols)` — the residual's composition: one row per fam
    (grn/onp/ind) NOT standing as a column (ind NEVER is), share-sorted desc,
    then ONE lump "All other parties" = `A.fp.oth − Σ(party: breakouts)`.
    Changes ride `A.fpSw[f]`; the lump gets `A.fpSw.oth` ONLY when nothing was
    broken out (a family's shift can't be attributed across a split).
    Nothing needs per-party swings — that was the deliberate simplification.
  - `statPrimaryGrid(m, A, cls = "", othx = false)` — `othx: true` on the
    head (seatStat's fpRow) AND, since 2026-11-10, effectively on the seat
    card too: **`seatPrimariesStat` carries the same expander** (user report
    on Wannon's seat view: "other is not expandable like in other views") —
    same `statOthersRows(p, cols)` with the seat's `seatStatOf` payload as
    its A (p.fp/p.fpSw match the expected shape), same `statScopeOf(m).open`
    (ONE flag: head row and seat Primaries open together, one click flips
    both on re-render), same `.st-othb`/`.st-othx` markup inside the seat's
    `.st-secstat` block, `st-n` from the FULL column count in both states;
    the seat keeps its own cells builder (it doesn't call statPrimaryGrid —
    seat-specific smalls titles and `st-seatfps` class; seat-pin lives in
    test-map-page beside the `statFold` pin: "the seat's Primaries carries
    the same Others expander as the head's row, on the same open state").
    The States/Seat-types cycle view keeps a plain figure. Same `st-n`
    class from the FULL column count in both states so the
    font size doesn't jump when a column leaves; the expanded grid just drops
    oth (recentring is the grid's own auto-columns), the `.st-othx` line
    renders under it. Guard: the opener renders only when
    `statOthersRows(...).length > 0` (a zero residual ⇒ plain figure).
  - (Seats twin — REVERTED, lives in git history at ffc74792: it was
    `statSeatsOthersRows(m, idx, colGroups, base)` from `crossLabel(hold)`
    groups minus any group with its own column, n-sorted, changes =
    `n − base.c[fam]` for directly-mapped fams, null for oth-sharing parties;
    the residual cell was identified positionally
    (`c === seats[seats.length - 1] && c[0] === "oth"`) so a theoretical
    ≥15-seat oth-fam bloc party couldn't collide.)
  - State: `statScopeOf(m)` (per-model WeakMap) — `.open` (the revert also
    dropped its seats flag `.openS`). A scope change replaces the object, so
    opens reset with scope (deliberate; matches the menu-choice lifecycle).
    `statOthersToggle()`: flip + `renderStory(true)` (the established
    whole-story re-render, FS-aware) + focus the replacement button.
- `.build/map/app/app-6-ui.js` — the `#story` click routes `[data-othx]` →
  statOthersToggle BEFORE the generic `[data-pv-action]` branch
  (statBreakdownClick silently ignores anything not under `.st-pv`, but take
  the early return anyway). (The seats twin's `[data-othxs]` branch was
  reverted with it.)
- `.build/map/app/page.css` — the CSS source. `.st-othb` (reset button,
  text-decoration: underline + offset 5px, thicker on hover), `.st-othx`
  (flex-wrap line, 13px, centred, tabular-nums), `.st-othx-r` rows with a 7px
  swatch. **map/map.css = page.css verbatim from assemble.mjs** — editing the
  shipped file loses on the next assemble. Colour tokens by row kind: the
  votes row swatches are inline `css(TH.party[<fam>])`. The `--m-` vocabulary
  in map/index.html's head is ONLY alp/lnp/grn/onp/ind/csa/oth: `nxt`/`dem`
  exist in TH.party but NOT as CSS vars, so anywhere you'd swatch via
  `var(--m-…)` (the reverted seats breakdown nearly shipped
  `var(--m-nxt)`/`var(--m-dem)` through FP_TONE — an invisible swatch) fall
  back to the plain fam tone.

## Coordinates the rendering must keep (the primaries row carries them all)

- aria: shut cell = real `<button class="st-othb" data-othx aria-expanded="false">`
  with an explicit aria-label ("…%. Show which parties make up this figure");
  the grid's role="group" aria-label stays consistent with the VISIBLE columns
  (built off the same `cols` array that just dropped oth).
- Small changes stay grid-row 2 via `grid-column:${2*i+1}` against whatever
  columns remain — they recentre with the figures automatically.
- Now-frames: `showChange` (fpSw non-null && !isNowY) must also suppress
  changes INSIDE the breakdown line.

## Test — extend `.build/test-map-primary-breakdowns.mjs`, don't start a file

- It vm-sandboxes the REAL `.build/map/app/app-4-story.js` against a hand-built
  ctx (FAMS/famLeg/partyShort/isNowY/$ stubs); new helpers only need to be (a)
  named in the export object literal and (b) given their stub deps. (The
  reverted seats round's recipe for a HOLDER-dependent helper, for reuse if
  needed: real-def stubs `holdFam`/`crossLabel` + `model()` attaching `hold`
  to test divs — winner from the LAST entry of the div's `h` history array,
  `d.h[d.h.length-1][2]` = party ab, with an empty-`h` guard before indexing,
  max-primary-vote fallback otherwise.)
- Compute oracles independently from `map/data/core-<year>.json` inside the
  test and assert equality.
- `assert.deepEqual` on a vm-returned array FAILS prototype identity — use the
  file's own `JSON.parse(JSON.stringify(...))` round-trip (the "Values have
  same structure but are not reference-equal" err is that, not your data).
- The shipped assertions cover: row sums == the residual figure, named-fam
  exclusion when a column exists, bloc exclusion, change attribution (lump vs
  named), Now-frame change suppression, the closed/open HTML contract
  (`st-othb` present shut, `repeat(2n−1,auto)` shrinking open, `st-othx`
  present open), and that the default (no othx flag) grid never gains buttons.

## Recipe when the next row/figure gets this treatment

1. Helper yielding `[tone, n|share, change|null, label, key]` for the clicked
   figure's contents; sum of rows MUST equal the residual exactly from the
   area's own pools (no re-derivation).
2. Shut cell → `.st-othb` button (only when rows exist); open → drop the
   column, keep `st-n` from the full count, `.st-othx` line below.
3. Per-model flag on `statScopeOf(m)` + toggle fn; dispatch branch in `#story`.
4. Reuse `.st-othb`/`.st-othx`; new CSS only for a genuinely new layout, and
   only in page.css.
5. Extend the breakdowns test oracles, then:
   `node .build/map/assemble.mjs && node .build/test-map-primary-breakdowns.mjs
   && node .build/test-map-page.mjs` (+ full npm test for the land gate).
6. **Check for a sibling surface first**: ten minutes before the seats
   land's push time, another session shipped an always-on seat-makeup LEGEND
   naming every crossbench group — the same info the click was meant to
   reveal. When the same content would suddenly live in two adjacent places,
   ask the user with concrete options (land with the info-delta version =
   breakdown rows carry changes the static legend lacks / skip as
   landed-redundant / land exact parity) before pushing — don't pick
   duplication unilaterally. The 2026-11-06 outcome: user chose
   "land expander + changes", we landed it, and within the hour they removed
   it anyway ("the parties are shown underneath the seat-count bar"). The
   expander that survives is the one with NO adjacent static surface
   (Primaries).

Related: auspol-branch-merge-land-race ("Map land rounds" — the push mechanics
in the same hour this shipped), auspol-map-theme-palette (TH.party vs --m-*).
