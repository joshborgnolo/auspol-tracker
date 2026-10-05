---
name: auspol-svg-hover-hit-shadow
description: auspol-tracker — an SVG dot/hit-target is dead to hover (its tooltip never shows, or a background layer's tooltip shows instead): diagnose with an elementFromPoint centre-sweep, then make painted-over display-only layers pointer-events:none (worked 2026-10-05 on the flow-drift detail chart, commit 74ce1fa, after the line-clamp fix 4f2e0c8).
source: auto-skill
extracted_at: '2026-10-05T09:00:07.583Z'
---

# SVG hover hit-shadow: overlay layers eating a dot's hover

## Symptom → cause

User reports an SVG dot "not selectable by hover" — its tooltip never
appears, or the chart's OTHER tooltip (month guide, line) shows instead.

SVG has no z-index: **paint order = DOM order**, and every painted layer
defaults to `pointer-events: visiblePainted` — a later-painted sibling's
stroke/fill pixels catch the pointer even when invisible-fill overlays
(like `.rd-apd-hit`, which sets `fill:none; pointer-events:all`) sit
beneath. So any decorative layer painted AFTER the hit circles — a line
stroke, an end dot, a guide line, the axis path, corner text — owns its
pixels and the hit circle's `onPointerEnter` never fires there.

## Where it bites in this repo

The `.rd-apd-hit` hit-circle idiom (r=8–9 invisible circle + per-dot
listeners) is shared: rd-allpolls.jsx detail renderers (~:378, ~:489,
~:675) and RdFlowChart's wave dots (~:3019). RdFlowChart's fix is commit
`74ce1fa` (2026-10-05): 9 of 177 wave dots were centre-shadowed (7 by
`.rd-fl-line`, 2 by `.rd-fl-enddot`); fix was `pointer-events: none` on
`.rd-fl-line`, `.rd-fl-enddot`, `.rd-fl-pick`, `.rd-dis-guide`,
`.rd-dis-base`, `.rd-fl-note`, `.rd-fl-empty` **scoped to `.rd-fl-chart`**
— scoped because `.rd-dis-*` classes are SHARED with the discord panel
and must not be touched globally. The month-hover still works because
the svg's own `onMouseMove` computes it — a background skew-handler
needs no pointer-bearing child. Contract written in
`auto-skill-auspol-flow-drift-panel` ("hit-shadow contract" section).

## Diagnose (headless, in order)

1. **Static sweep first** (instant, catches painted-before layers):
   per target, `el.getBoundingClientRect()` centre →
   `document.elementFromPoint(cx, cy)` must be the hit element (or any
   `.rd-apd-hit`). Report the shadowing element's class per failure —
   that tells you exactly which overlay to exempt.
2. **Dynamic hover sweep** (catches layers that only exist DURING hover —
   e.g. the `hv` guide/end-dot render only once hover is active, so the
   static sweep can't see them): `page.mouse.move(x, y, {steps: 2})`
   onto each centre, flush (~50ms), assert the shown tooltip is the
   TARGET's class of tip — for wave dots "any pollster title passes,
   the month title and null fail".

## Probe gotchas (all cost cycles in the worked session)

- **scrollIntoView rects are stale under smooth scroll** — the page sets
  `scroll-behavior: smooth`; `scrollIntoView` then wait ~700ms, THEN
  measure rects. Measuring in the same evaluate as the scroll gives
  pre-scroll positions and your mouse lands on the wrong dots.
- **A section component can render TWO svgs** (mini strip + main chart)
  — `half.querySelector("svg")` hits the mini strip; scope to the chart
  (`#flow-drift .rd-fl-one .rd-fl-chart svg`).
- **Dense clumps legitimately misread**: adjacent r=8 hit circles
  overlap; the later-painted neighbour winning the centre is correct
  behaviour, not a shadow. Assert "SOME target-class tip", not "this
  exact dot's tip".
- **Approach gestures steer results**: arriving along a row keeps the
  pointer on an overlay stroke the whole way (realistic user dead-zone)
  — that's exactly the bug mode, so park DIRECTLY on centres when
  verifying the fix, and use row-approach only when reproducing.

## Fix recipes

- `pointer-events: none` on the display-only overlay, scoped to the
  chart's container class; default-reachable rule: anything painted
  above the hit circles joins the exempt list, anything interactive
  paints beneath the hit circles or keeps its events.
- If a background handler (like the svg's month-hover mousemove) must
  keep working: it computes from `ev.clientX` on the svg element and
  bubbles from ANY child, so exempting overlays does not break it —
  verify the background tooltip still appears in the probe.
- Rebuild (`node .build/newtracker/build.mjs`), re-probe; work in a
  worktree when main is dirty (see auto-skill-auspol-worktree-scratch-files).
  Probes live as gitignored `.matilda/probe-*.mjs` scratch; run against
  another checkout with `BASE=<path>`.
