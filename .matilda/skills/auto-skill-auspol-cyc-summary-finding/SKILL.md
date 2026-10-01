---
name: auspol-cyc-summary-finding
description: auspol-tracker — the Past-cycles summary finding (the head+dek above the "Every measure N months in" table, storyFor in rd-cycles.jsx, ~:523 → pageStory → RdHed at the top of #cyc-summary). FROZEN ACROSS COMPARE PICKS (user dictate 2026-10-02, "make this the copy in past cycles … but keep it dynamic … this is the copy regardless of whether All past terms / Re-elected / Ousted is selected"): storyFor(c2) ranks the sitting term against EVERY past term (rowsForHidden(new Set(), c2)) and emits no compare-scoped tails; the summary table and charts below still rescope to the pick. Dek shape (level measure): S1 "<N> months after the {year} election, <gov>'s primary vote is the lowest of any government at the same point since {firstYear}." (full-set "since" ALWAYS), S2 "After preferences, though, <gov>'s NN.N% <quartile ladder: sits in the middle half / is above three in four / is below three in four> of past governments.", S3 (only while the opposition primary is a record low AND the combined row carries a reading) "And while <opp>'s primary vote is the lowest of any opposition, it's also <STANDING LADDER: the highest (rank /^Highest/) / among the highest (v>=q3) / in the middle half / among the lowest> when combined with One Nation's." (wording per user dictate 2026-10-02 — 0a6efe2's same-day "But while" stint reversed to "And while … it's also"; the probe's derived expectation carries the literal opener too, so ANY wording swap to S3 edits rd-cycles.jsx AND probe-cyc-story-freeze.mjs's expectMid builder in one pass) — S3 rides the summary table's own L/NP+ON `comb` row (FA.comb rank/peers quartiles), never rederived. storyVariants (the invisible walk-floor stack .rd-cyc-storyvar) is now TWO measure states (abs/chg) — it was SIX (3 compare × 2 measure); probe-cyc-cycles-pin's floor-state-count assertion moved 6→2 in the same pass (internal-count probes ride DESIGN changes). hiddenFor DELETED (its only consumer was the old storyVariants). The per-SECTION stories (tppStory/primStory/leadStory, RdHed per RdSec ~:936-953) still take `tail` and DO rescope with the compare pick — the dictate covered only the top finding. Regression set: .matilda/probe-cyc-story-freeze.mjs (the contract probe: derives expected copy from the table's rank cells so it tracks data; asserts identical head/dek under all three pills, chg-measure invariance, 2-state floor, 1440px + 390px-touch), probe-cycles-pin.mjs, probe-cyc-chipmove.mjs, validate, npm test.
source: auto-skill
extracted_at: '2026-10-02T09:00:00.000Z'
---

# Past-cycles summary finding (storyFor) — freeze contract and machinery

The finding is the head + dek rendered directly under the "Past cycles" title in
`#cyc-summary`, ABOVE the compare pills and the summary table. Generator:
`storyFor(c2)` in `.build/newtracker/assets/rd-cycles.jsx` (~:523), consumed as
`const pageStory = storyFor(chg);` and rendered through `<RdHed head dek level={2}>`.

## The freeze (2026-10-02) — copy cannot move with the Compare-with pills

User dictate: new three-sentence dek, "keep it dynamic", and "this is the copy
regardless of whether All past terms / Re-elected / Ousted is selected". Before
the freeze, storyFor took `(RV, cmp, c2)` and ranked against the picked
comparison subset, appending ", among terms whose government was re-elected"
tails and rescoping even "since 1972" away. The rendered dek proof of the old
behaviour: Re-elected dropped the "since 1972" and said "those governments".

Implementation of the freeze:

```jsx
const storyFor = (c2) => {
  const FA = rowIdx(rowsForHidden(new Set(), c2));   /* ALWAYS the full set */
  const g = FA.primary, o = FA.oppr, t = FA.tpp;
  const snc = " since " + cycles[0].year;            /* full-set anchor, always */
  ...
  const head = found || "Every term since ...";       /* no + tail */
```

- `storyFor` lost its `RV`/`cmp` args; `pageStory = storyFor(chg)`;
  `storyVariants = [false, true].map((c2) => ({ key: c2 ? "chg" : "abs", ... }))`
  — TWO story states in the invisible floor stack (`.rd-cyc-storyvar`), down
  from six. The walk-floor comment and `probe-cycles-pin.mjs`'s
  "walk floor measures against N finding states" assertion moved in the same
  commit (6 → 2). **Any probe pinning an internal STATE COUNT is a design
  contract probe — update it with the design, in one pass.**
- `hiddenFor(cmp)` was DELETED — its only consumer was the old storyVariants.
  `tail`/`since` consts: `tail` SURVIVES (the per-section tppStory/primStory/
  leadStory still append it; they rescope with the pick by design). `since`
  was deleted; its only user was storyFor's `snc`.
- After the freeze, ALL of (compare × measure) hold the summary row at the
  same document top — probe-cycles-pin reports `row docTop by story … spread
  0.0px`, the best obtainable.

## The level-measure dek shape (rendered 2026-10-02, all dynamic)

> Sixteen months after the 2025 election, Labor's primary vote is the lowest of
> any government at the same point since 1972. After preferences, though,
> Labor's 51.6% sits in the middle half of past governments. And while the
> Coalition's primary vote is the lowest of any opposition, it's also among the
> highest when combined with One Nation's.

- S1: `monthsWord` (rdCap(rdNumWord(m))) + term year + gov superlative (gLow =
  rank.main /^Lowest/) + full-set since. Falls back to rankWords when not
  record-low.
- S2: the 2PP standing ladder reused verbatim —
  `t.v in [q1,q3]` → "sits in the middle half of past governments";
  `> q3` → "is above three in four of…"; `< q1` → "is below three in four of…".
  "though, " fires only when S1 claims a record (contrast).
- S3 (the dictation's new clause): fires only when `oLow && combined` in level
  mode. `combined` prices the `FA.comb` row — the summary table's own L/NP+ON
  combined measure — never a fresh computation:

  ```js
  const cb = !c2 && FA.comb.rank && FA.comb.v != null ? FA.comb : null;
  const combined = cb ? /^Highest/.test(cb.rank.main) ? "the highest"
      : cb.v >= cb.peers.q3 ? "among the highest"
      : cb.v > cb.peers.q1 ? "in the middle half" : "among the lowest" : null;
  ```
  If `oLow && !combined` (no ON-split history), the opposition clause folds
  back into S1 as ", and the Coalition's the lowest of any opposition" — the
  pre-dictate shape. At ship the comb row read 48.1%, "4th highest of 17" →
  "among the highest" (>= q3 of 16 peers).
- S3 is gated on level mode (`!c2`): the Change-since-election finding is a
  change-ranks read ("lost more of their vote than any before them…") and
  deliberately carries no One Nation sentence; the freeze applies there too.

## What still moves (do not "fix")

The summary table's Now/rank cells and the strip bands still respond to the
compare pills (comb: "4th highest of 17" all → "2nd highest of 13" re-elected →
"Middle of 5" ousted), and the per-SECTION per-measure stories still rescope.
Only the section's top finding stands still — it's the page's read of the
moment above the controls.

## Contract probe: `.matilda/probe-cyc-story-freeze.mjs` (port 9018)

Derives the EXPECTED dek from the summary table's own default-state cells
(gov/opp rank-mains, TPP now-cell, comb rank-main, eyebrow `Every term since
<year>`), so it tracks the data as waves land — it pins the STRUCTURE and the
FREEZE, not 2026-10-02's numbers. Asserts, at 1440px and 390px-touch:

- default-state dek body === derived expectation (S1 + S2 + S3 ladder words);
- head === "Both major parties are at record lows for this point in a term";
- head+dek byte-identical after clicking Re-elected / Ousted; zero
  "among terms whose government" / "those governments" leakage;
- `.rd-cyc-storyvar` has exactly 2 children (measure states only);
- change-measure finding: different dek, still pill-invariant, no "One Nation".

DON'T paste exact current copy into probes — the figures move.

### DOM click gotchas (learned writing the probe)

- Compare pills: `[aria-label="Compare with"] button`; on the 390px rung the
  All pill's label shortens away from "All past terms" — match `startsWith("All")`
  as fallback.
- Measure tabs: `#cyc-summary .rd-tab`, Level-first order — clicking "the first
  Change/Level tab" clicks Level (a no-op). Match by prefix AND
  `aria-pressed !== "true"`.
- Summary cells: row name in `.rd-cs-name b`, party sub in the DIRECT child
  `.rd-cs-name > span` (a `span span` selector finds nothing), figure cell
  `.rd-cs-now`, rank main `.rd-cs-rank b`.
- Inter-state sleeps ~750ms: RdHed cross-glides; 700ms was enough everywhere.

## Related

- auto-skill-auspol-past-cycles-summary-rows — the rows themselves (Mby alias
  trick; `comb` is a derived-series row; probes cycles-combine-onp,
  cycles-label-wrap, probe-cyc-holder-year).
- auto-skill-auspol-curated-panel-copy — the dictate-pattern catalogue; this
  session added its SEVENTH form (restructure-to-dictation + control-state
  freeze).
- auto-skill-auspol-headless-geometry-verify — probe conventions.
