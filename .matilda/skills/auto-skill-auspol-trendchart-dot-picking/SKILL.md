---
name: auspol-trendchart-dot-picking
description: "auspol-tracker — the TrendChart dot pick→click→archive chain (08b413e7: root-level pointer picking, MOUSE_PICK_PX=11/TOUCH_PICK_PX=22, dotSrc mouse/touch gate, pollRowKey → AP.openPoll, cursor:pointer + 'Click to open this poll' hint) and the toVB measurement gotcha: .chart takes padding-bottom:30px whenever copy-chart.js strips its button on (:has), so client→viewBox conversion must measure the <svg>, never the wrapper — measuring the wrapper drifted every pick ~7% and made sparse-chart dots (Undecided's newest, lowest ones first) unclickable (fixed 0c3d9b7). Includes the falsification ladder for 'dot won't click' reports."
source: auto-skill
extracted_at: '2026-09-24T05:28:31.987Z'
---

# TrendChart dot pick → click → archive (08b413e7 asset)

All pointer int the TrendChart component
(`.build/newtracker/assets/08b413e7-…js`, `function TrendChart` ~:118).

## The chain

1. **Pick (root-level, not per-circle)** — the svg root carries
   `onPointerMove`; `nearestDot(p, radius)` scans the `scatter` prop in
   Euclidean viewBox units. Catchments: `MOUSE_PICK_PX=11` / `TOUCH_PICK_PX=22`
   / `EVT_PICK_PX=9` (key events), converted px→units via `scale = cw/W`.
   Dots deliberately have NO per-circle listeners (Safari enters/leaves on
   SVG children were unreliable once).
2. **Source gate** — `dotSrc.current` records "mouse"|"touch". Touch picks
   survive finger-up (that's how a phone reads a tooltip) and are
   deliberately NOT clickable: tap = read, not navigate.
3. **Openable** — `openable = dot && dotSrc==="mouse" && rowKey && window.AP.openPoll`
   where `rowKey = window.AP.pollRowKey(dot.meta)` (engine ed2260de ~:271:
   key = `pollster + "|" + released`, Set-membership against
   ROW_KEYS built from `D.individualPolls`; `meta` comes from the panel,
   e.g. UndecidedPanel passes the undecided-series poll object).
4. **Click** — svg root `onClick` →
   `window.AP.openPoll(rowKey, pollFacet)` (73de0c58 ~:1924 switches to the
   All-polls tab and focuses the row). Panels pass their own `pollFacet`
   ("twopp" etc.).
5. **Affordance** — svg root gets `style={{cursor:"pointer"}}` only when
   openable, and the dot tooltip shows the `.tip-hint` line "Click to open
   this poll in All polls".

## The toVB gotcha that made dots unclickable (fixed 0c3d9b7, 2026-09-24)

`toVB(e)` converts client px → viewBox units. It must measure **the
`<svg>` element's own box** — never the `.chart` wrapper div:

- `.chart:has(> .chart-copy-btn) { padding-bottom: 30px }` (template.html)
  reserves the copy-as-image button strip whenever copy-chart.js strips
  its button onto a chart. So almost every `.chart` div is 30px TALLER
  than its svg.
- `getBoundingClientRect()` includes padding. Dividing by the taller box
  squeezed the y-mapping ~7% (389→419), so every pick landed low and the
  effective catchment sat ~one dot-row BELOW the visible dot (measured
  ~16px x / ~22px y displacement at 1280w).
- Why only SOME dots died: the error grows with distance down the plot.
  The Undecided panel is sparse (63 lone dots), and its lowest-running
  series are the newest Roy Morgan readings — the user's "particularly
  those latest in time" exactly. Dense charts (hero 2PP) still caught a
  NEIGHBOURING dot and looked fine.
- Fix (one line): `ref.current.querySelector("svg").getBoundingClientRect()`.
  `cw` was already the svg width (no horizontal padding), so x was exact
  throughout — a y-only drift.

**Any future client→viewBox (or screen↔unit) conversion in this repo must
measure the svg, or first verify the wrapper is box-identical.** The same
trap arms itself whenever padding/margin is added to `.chart` for chrome
(buttons, docks, strips).

## "A dot won't click" — falsification ladder (order that worked)

1. **Key layer** — do all scatter metas resolve to ROW_KEYS? Probe the
   data asset in node (`globalThis.window=globalThis; new Function(src)`)
   and diff `pollster+"|"+released` sets. (Undecided: 0 unkeyed of 63 —
   killed this fast.)
2. **Overlay interception** — `.tip` already has `pointer-events:none`;
   a stale "guide" tooltip at a dead dot is left by the PREVIOUS handled
   pointer event, not proof the current one was handled. Confirm with
   `document.elementFromPoint(x,y)` at the dot centre: if it returns an
   svg child (circle/series-line), events reach the svg root — overlays
   are ruled out.
3. **Catchment displacement** — walk the pointer in a fine grid (±40px,
   4px steps) around the failing dot and record where `tip-dot`/pointer
   actually engages. A displaced pick region points straight at the
   coordinate conversion; compare `.chart` rect vs `svg.chart-svg` rect
   (page-wide dump of `div.chart` vs its svg exposes padding/margins per
   chart).

Probe techniques live in auspol-headless-geometry-verify (interactivity
section); scratch probes belong in `.matilda/` untracked.
