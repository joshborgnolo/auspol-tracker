---
name: auspol-leadership-panels-subgrid
description: "auspol-tracker — the Leadership section's DESKTOP side-by-side row-sharing: at min-width 1001px the two rd-ld-panels sit in one grid spanning 9 rows with grid-template-rows: subgrid (rd.css :768-781); :not(.one) SKIPPED when expanded. Covers ppmNote/apprNote generators (rd-panels.jsx ppmNote ~:434, apprNote ~:743 — three-way note is dynamic copy, NOT greppable), the 2026-09-28 closing-line anchor dictate (.rd-ld-noteup lifts the three-way note one 19.5px line via negative margin on its glide), and the 6c0ebcc glide-snap fix: every glide in the subgrid (rd-ld-bars-g/rd-ld-dp-g/rd-ld-note-g) carries spacing as .rd-glide-in padding-top (NOT child margin — it collapses out of the plain outer at rest but gets contained mid-glide) AND align-self:start (default stretch rests the outer at the SHARED track height, so the cleared inline styles snapped 20-89px). Verify per ppm view: both panels' .rd-ld-note bottoms level (1px OK), chart tops level, glide heights equal pre/post, ≤1000px untouched."
source: auto-skill
extracted_at: '2026-09-28T10:44:29.541Z'
---

# Leadership — desktop subgrid layout + paired-note closing-line anchor

`auspol-leadership-dek` covers the Story head/dek; this covers the two-panel
LAYOUT below it and the footnote notes that hang a line off it.

## The side-by-side row-sharing (rd.css :768-781)

`.rd-ld-grid` is a 2-column grid; `#leadership` puts two `.rd-ld-panel`
children (ppm left, net-approval/favourability right). At
`@media (min-width: 1001px)` each panel becomes a grid item spanning NINE
rows AND a `display: grid` with `grid-template-rows: subgrid`, so both
panels share the SAME row boundaries: 1 head (`·h4` ·28px), 2 dek, 3 tabs,
4 bars/dot-plot row, 5 footnote note, 6 chart card, 7 key, +2 slack. Purpose
(per the CSS comment): the net-approval dot plot ran 24px taller than the
bars, without subgrid every row below slipped — rows/charts stay LEVEL.

Critical selectors/gates:

- All of it only applies to `.rd-ld-grid:not(.one)` — toggling a panel's
  expand button (`rd-iconbtn`) gives the grid `.one` and the single visible
  panel behaves like the stacked case (no shared rows). Anything you fix
  for the side-by-side must live INSIDE that `:not(.one)` media block.
- `.rd-ld-note` (rd.css ~:820): the base note rule carries the 12px gap
  and a `min-height`; since 6c0ebcc the gap is actually applied as
  `.rd-ld-note-g .rd-glide-in { padding-top: 12px }` and the note's own
  `margin-top` is zeroed inside its glide (margin-collapse, see the
  glide-snap section), so edit SPACING on the padding rule, not here.
- Below 1001px the two panels just STACK (block layout); the "anchor"
  question doesn't exist there — never apply the lift outside the media
  block.
- Chart copy button/mitigation rows exist (`rd-ld-chart:has(+ .rd-ckey)`),
  and `rd-hidden` hides an expanded panel. The `both` ppm view inserts a
  second chart slot (row 6+), shifting everything below — measure all
  three ppm tabs when touching this area.

## The footnote generators (rd-panels.jsx)

- `ppmNote` ~:434-457 — per ppm view (two/three/both). The THREE-WAY note
  ("Hanson has run ahead of the Coalition leader in every month's three-way
  average since ‹month›, though Taylor has cut the gap from a to b.
  Albanese's wide range reflects how differently pollsters ask this
  question.") is BUILT from `LM`/`N` (leaderMonths, gap of peak vs last,
  ci95 threshold 1.6×) — you can only grep `three-way average` /
  `run ahead of the Coalition leader`, never the full sentence.
- `apprNote` ~:743 — per metric (net/fav/both); the net view writes
  "Bars are 95% intervals. …". Both notes render as
  `<RdGlide><p class="rd-note rd-ld-note">…` in body slot order.

## USER DICTATE (2026-09-28): closing lines of the two notes must anchor

In the three-way ppm view the ppm note wraps to THREE lines vs approval's
TWO, so top-anchored rows left the ppm note hanging one line low — user
wanted its FINAL line level with the approval note's final line
("should sit one line higher" / "one less new line above it" /
"final line anchored to the counterpoint text in net
approval/favourability").

Mechanism (final form as shipped 6c0ebcc; the original calc-on-.rd-ld-note
form predates it):

- `rd-panels.jsx :815` — ppm note's `<RdGlide>` gets
  `className={"rd-ld-note-g" + (ppmView==="three" ? " rd-ld-noteup":"")}`.
- `rd.css :802` inside the min-width:1001px block lifts the WHOLE glide
  wrapper one line: `body.rd .rd-ld-grid:not(.one) .rd-ld-noteup {
  margin-top: -19.5px; }` (the glide's top-position margins don't
  collapse out, so unlike the old calc-on-note form this survives the
  margin-collapse containment fixed below).

## The glide rest-height snap (fixed 6c0ebcc, 2026-09-28)

Reported as "the leadership charts stutter a bit toggling 2-way↔3-way
ppm" (approval side was clean) plus "the three-way note's first line is
momentarily cut off by white". TWO compounding diseases, both inside the
1001px subgrid:

1. **Margin collapse through the glide outer.** `.rd-hbs { margin-top:
   20px }` (rd.css:815) and `.rd-dp { margin-top: 18px }` (:852) sat
   INSIDE RdGlide's plain-div outer. At rest the margin collapses through
   to the ancestors (outer rest height excludes it); mid-glide the state
   sets `overflowY: clip`, which establishes a new block-formatting
   context and CONTAINS the margin — so rest and glide geometries were
   never the same.
2. **Subgrid stretch.** The glide outers are grid items of the subgrid
   with default `align-self: normal` → stretch to the SHARED track
   height, not their own content (measured: bars outer rested at 173.6px
   in two-way / 160px in three-way while its own content was
   153.56/90.78). When RdGlide's 320ms ease ended and its inline styles
   cleared, the block snapped 20–89px up to the stretched/slacked box.

Fix recipe (applies to any RdGlide living in a shared-row grid):

- Give every glide a named class: `rd-ld-bars-g` (rd-panels.jsx :808),
  `rd-ld-note-g` (ppm :815 + approval :835), `rd-ld-dp-g` (:833).
- Move vertical spacing from child margin to glide-inner padding:
  `.rd-ld-bars-g .rd-glide-in { padding-top: 20px }` +
  `.rd-ld-bars-g .rd-hbs { margin-top: 0 }`; same pattern for dp (18px,
  20px at ≥1001px to match the existing media rule) and note (12px).
- `align-self: start` the glide classes inside the
  `min-width:1001px :not(.one)` block so rest height = own content
  height = the glide's measured target.

Verify after: rest geometry must be pixel-identical to before (measured
@1280 — chart tops 700.2 two-way / 686.6 three-way, note tops
628.2/595.1) and a tab toggle must glide and LAND on the exact rest
height with the inline styles cleared (`.matilda/probe-lead-stutter.mjs`,
VW env width, real `page.mouse.click` — synthetic `.click()` never trips
the `__rdInput` gate and the glide silently doesn't run).

## Verify: two NUMBERS per ppm view, don't eyeball

Probe `.matilda/probe-ppm-note-pos.mjs` (VW env for width):

- ppm `.rd-ld-note` rect.bottom − right-hand `.rd-ld-note` rect.bottom ≈ 0
  in EACH of two / three / both (Measured 2026-09-28 @1280: 0 / 1.0 /
  0 — the 1px is subpulse padding, fine).
- Chart card tops of both panels IDENTICAL (align diff 0).
- At 900px and 480px the note still sits 12.0px under its bars in every
  view (must be untouched — guards the media-block scoping).
- Repro probe pattern: click the tab by its visible text, waitForFunction a
  `.rd-ld-note` textContent marker ("three-way average"), 500ms settle,
  then read getBoundingClientRect on both panels' notes and chart cards.

Trap: index.html's compiled copy inlines these classes; the JSX edit only
shows after `node .build/newtracker/build.mjs` — rebuild BEFORE probing or
you'll read stale geometry.
