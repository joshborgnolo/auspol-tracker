---
name: auspol-walk-floor
description: auspol-tracker — the All-polls walk-floor (fbc1b13, 2026-10-08) — when the pinned table "crawls"/jolts on a facet WALK (tabs, arrow keys, .rd-ap-pint), the root cause is a row ABOVE the table changing height between walkable states, not the pin's scroll arithmetic; Safari's ±2css-correction loop then never settles. Fix shape copied from past cycles' .rd-cyc-storyvar (6f25cf4): invisible zero-height measurement stacks (.rd-ap-storyvar/-ctlvar/-ebvar) render every walkable state, live slots take min-height: max(children), so a hop rewrites words only — no reflow, no pin correction. Clones must be geometry-identical (mirror parent-scoped CSS selectors; walked-state copy from shared source constants) and the floor must be re-measured when upstream copy edits land (2343d19's confidence-meta reword was the longest walkable state). Pin: .matilda/probe/ap-walk-floor.mjs (12 widths × 2 anchors: drift 0, zero scrollTo/scrollBy on the walk).
source: auto-skill
extracted_at: '2026-10-08T00:00:00.000Z'
---

# The All-polls walk-floor (fbc1b13, 2026-10-08) — kill the reflow, never chase scroll corrections

When the All-polls pin "crawls"/jolts on a facet WALK (tabs, arrow
keys, the pinned pint tabs), the root cause is NEVER the pin's scroll
arithmetic — it is a row ABOVE the table changing height between the
walkable states. The pin's ancestor ResizeObserver then fires a scroll
correction, which Safari paints ±2css off and re-fires, so the drift
never settles (user report 2026-10-06; three contributors: the hed/dek
slot, the ≤1140px 45px control row that mounts only for twopp and
demographics, the ≤390px Confidence eyebrow meta wrapping to two
lines). Fix shape, copied from past cycles' `.rd-cyc-storyvar`
(6f25cf4): an INVISIBLE measurement stack renders every walkable state
(`.rd-ap-storyvar` / `.rd-ap-ctlvar` / `.rd-ap-ebvar`, CSS `height: 0;
overflow: hidden; visibility: hidden`), the live slot takes
`min-height: max(stack children)`, so a hop rewrites words only and
nothing reflows. Rules that bit during assembly:

- **Clones must be geometry-identical.** Any CSS scoped by
  `parent-chain > .rd-eyebrow` (e.g. `.rd-ap > .rd-eyebrow > .rd-ap-nav`)
  does NOT match the clone inside its stack wrapper — mirror the
  selector (done for the 761–1239px navigonal `flex-basis` rule and the
  2343d19 `gap: 14px` shave). Walked-state copy must come from the same
  source constants as the live row, measured `getBoundingClientRect` per
  stack child, floor `Math.ceil(h - 0.01)`.
- **Re-measure on upstream copy edits.** The 2343d19 confidence-meta
  reword ("Every confidence-index release (business and consumer)…")
  landed mid-fix and is exactly the longest walkable state at ≤390px —
  rebasing without re-running the geometry probe would have shipped a
  stale floor.
- Probe: `.matilda/probe/ap-walk-floor.mjs` (12 widths × {tabs-mid,
  deep} anchors): anchor drift 0, zero scrollTo/scrollBy on the walk,
  stacks hidden+0-height. Run it after ANY hed/dek/meta/control-row
  copy or CSS change touching rd-ap.
