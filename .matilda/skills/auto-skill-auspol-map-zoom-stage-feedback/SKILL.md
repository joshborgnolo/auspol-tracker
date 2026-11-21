---
name: auspol-map-zoom-stage-feedback
description: "auspol-tracker /map/ — user reports \"the map jitters / jumps up and down at (or near) one zoom level\", incl. the Jump-to Sydney…Darwin row flickering in and out. Anything that resizes the strip or stage as a function of the zoom scale T.k feeds back through HOME.k (HOME.k is the country's fit to the stage), flipping its own predicate every frame — 30px stage flips and a 15px map shift per frame. Contract: zooming NEVER resizes the stage. Known offenders: the Jump-to row's `T.k > HOME.k * 3` gate in renderJumpSel/updateHint (app-6-ui.js; the jumpRowVis helper hides it only for a chosen seat or another view) and balloonKey's svg box sized to the zoom's own biggest circle (app-2b-draw.js; it must stay the tallest circle's height, `Math.ceil(2 * 9.5 + 2)`). Oracle probe: `.matilda/probe/map-zoom-jitter.mjs <baseUrl> [WxH…]` walks the zoom 1.02→40× in 4% steps across seats/balloons/surface asserting one stage height and zero T.y drift per held zoom — run it on pristine HEAD first (negative control; red at 3.06–3.18× home on 2026-11-11), green only after restore. Shipped 9e0561e2 (2026-11-10), silently reverted by 0c08ffe8's stale-copy Industry-picker land, restored as 8dd13969 (2026-11-11)."
source: auto-skill
extracted_at: '2026-11-11T12:41:33.768Z'
---

# /map/ zoom jitter — the stage-height feedback loop

## The failure class

The map's control strip (legend) and the map stage share one column: the
stage gets whatever height the strip leaves. `HOME.k` is the country's fit
INTO THAT STAGE. So any renderer that shows/hides a strip row or resizes a
strip box **based on `T.k`** (or on zoom-derived values) closes a loop:

toggle off → stage grows → `HOME.k` shrinks → the test re-fires on → stage
shrinks → `HOME.k` grows back → toggle fires again …

The stage flips tens of px EVERY FRAME while the zoom sits in the trigger
band (measured live 2026-11-10/11: 460↔490px at 3.0–3.2× home, a 15px map
shift per frame; a quick zoom through the band reads as one jolt; sitting
in it, the map never settles). The rule that prevents the whole class:
**zooming never resizes the stage** — strip content must not depend on
`T.k`, `HOME.k`, or `balScale()`-like zoom scales.

## Known offenders and their pinned forms

Region map (grep before assuming either is live):

1. **Jump-to cities row** — `.build/map/app/app-6-ui.js`, `renderJumpSel()`
   (~:758) and `updateHint()` (~:886) both gate the `#cities` row. Healthy:
   a shared `jumpRowVis(cit)` helper that hides it ONLY for
   `S.view !== "map" || selDiv() != null` — never for zoom (the block
   comment above it narrates the loop; keep it, it deters the next
   "tidy-up"). Regressed form: `… || (T.k > HOME.k * 3 && S.sel.level !==
   "state")` in both sites.
2. **Balloons size key** — `.build/map/app/app-2b-draw.js`, `balloonKey()`
   (~:1466). Regressed: `const R = Math.sqrt(big) * s, H = Math.ceil(2 * R +
   2)` — the legend box height follows the zoom's own biggest circle and
   nudges the stage 1px at a time. Pinned: `const H = Math.ceil(2 * 9.5 +
   2)` (comment about the tallest circle rides with it; `big`/`list` stay,
   only the box height freezes).

Both halves were fixed together in 9e0561e2 (2026-11-10), reverted one day
later by 0c08ffe8's Industry-picker land riding pre-fix app sources, and
restored as 8dd13969 — restore from those diffs before re-inventing. A
faithful restore shows the SAME diff-stat counts as 9e0561e2
(app-6-ui 17 changed lines, app-2b-draw 4).

## The oracle probe (committed, tracked)

`.matilda/probe/map-zoom-jitter.mjs <baseUrl> [WxH …]` (default sizes
1280x860, 1440x900, 1024x768): walks `mp.view([151.0, -33.8], k0 * f)` in
4% steps from country fit to 40× in seats/balloons/surface, holds each step
six rAF frames, and fails on any stage-height motion or `T.y` drift while
held.

- Serve the repo root first (`python3 -m http.server <port>` or similar —
  `/map/index.html`, `map.js` and `map/data/*.json` are all real files).
- **Negative control**: on the pristine broken tree it must FAIL — red
  checks exactly in the reported band (3.06x/3.18x heights 460/490 seats;
  balloons 416/446 plus 1px 413–416 wobble; surface 385/415). Green only
  after the restore. A probe that passes on broken code binds nothing.
- **Server flakiness masquerades as product bugs**: a long-lived
  `python3 -m http.server` (~40 min, ~900 requests) started dropping the
  page's warm data fetches (`go` at map/index.html:117 — "Failed to fetch"
  pageerrors) and one multi-size run crashed with `window.__map` never
  appearing at the third size. Restart the server and run each size as a
  SEPARATE `node probe … <url> 1280x860` invocation if you see either;
  don't debug the bundle for them. (Sister traps in
  auspol-headless-geometry-verify: single-threaded python +
  ERR_EMPTY_RESPONSE; verify the port serves YOUR tree.)
- Note the page-errors check counts late warm-fetch rejections; the six
  zoom-oscillation checks per size are the pin for this failure class.

## Suite baseline caveat (2026-11-11)

Six of the 18 `.build/test-map-*.mjs` suites were red at PRISTINE origin
main that day (areas, chart, marital, page, primary-breakdowns,
vote-bands — vote-pile/census data contracts in sibling WIP lanes, not
zoom anything). Attribute reds BEFORE claiming them: stash your change,
run the same set on the untouched base, and compare lists. 'All green'
claims in sibling commit messages refer to their land-candidate machine.

## Restoring after a stale-copy revert (session-proven recipe)

This is auspol-reverted-feature-triage with map mechanics: culprit found
by pickaxe (`git log -S 'HOME.k \* 3' -- .build/map/app/app-6-ui.js` names
the fix; `git log <fix>..HEAD -S 'HOME.k \* 3'` names the re-regressing
commit without reading any diff). Then: clean worktree off **origin/main**
(never the dirty shared checkout), restore the regions verbatim,
`node .build/map/assemble.mjs` (map.css usually unchanged; a second run
must print all-unchanged), probe negative-control-red → green, commit
sources + `map/map.js` + `map/index.html` only, push `HEAD:main`
(land races are routine: rebase on the moved tip, take `--theirs` on the
`map/index.html` stamp conflict, re-assemble honestly, amend, re-probe).
