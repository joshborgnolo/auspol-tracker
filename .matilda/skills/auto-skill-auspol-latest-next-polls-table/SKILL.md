---
name: auspol-latest-next-polls-table
description: "auspol-tracker — RdPolls ('Latest and next polls' section) anatomy: facet tabs (twopp/primary/leadership) via rd.jsx RdSec data-facet, 6-column desktop grid in rd.css (~:557), per-facet grid-template-columns overrides are a media-query leak hazard (2026-09-28 fix: primary column override needed @media (min-width:901px) wrapper or it pinned phone rows to desktop columns with dead right-edge space); probe by toggling tabs headlessly and asserting getComputedStyle(row).gridTemplateColumns + per-cell bounding rects."
source: auto-skill
extracted_at: '2026-09-28T02:47:51.147Z'
---

# RdPolls — the "Latest and next polls" table (redesign)

Source: `.build/newtracker/assets/rd-polls.jsx` (489 lines, plain prop of
`RdSec` from `rd.jsx`) + its CSS block in `rd.css` at ~:545–712.

## Structure

- `RdPolls` (~:26): facet state `twopp | primary | leadership`, `sort` state
  (`pollster|latest|next` + caret), `open` row state, `tl` tooltip state for
  the releases strip.
- Desktop row (`.rd-pl-row`) is a 6-track CSS grid
  (`name 170 | latest 124 | figs 236/200 | tl minmax(0,1fr) | next 176 | exp 28`),
  declared at `rd.css:557-560`; the `tl` (releases strip) track is the only
  flexible one. A `@media (max-width:1100px)` narrow-desktop variant and a
  `@media (max-width:900px)` phone stacking variant follow (~:674-710): the
  phone layout switches to `grid-template-areas: "name figs" "tl tl" "foot foot"`,
  hides latest/next/exp cells, and shows `.rd-pl-foot1` instead.
- `figHead`/`figCell` (~:172-217) swap per facet: twopp = Labor-v-rival pair
  (basis=tfff/implied), primary = 5-party `.rd-pl-prim` mini-grid (RD_PL_PARTIES),
  leadership = preferred-PM + net approval line.
- Facet lives on the section: `RdSec` (`rd.jsx:18`) writes `data-facet={facet}`
  on the `<section id="latest-polls">`, and CSS keys per-facet overrides off
  `body.rd .rd-polls[data-facet="primary"]`.

## The facet-override media-query trap (fixed d2c809f, 2026-09-28)

`rd.css` had a per-facet override
`body.rd .rd-polls[data-facet="primary"] .rd-pl-row { grid-template-columns: 170px 124px 200px … }`
sitting unconditionally at top level. Its attribute+class selector beats the
baseline `body.rd .rd-pl-row` media-query rules in specificity, so under
900px the primary tab kept the desktop 6-column template while every other
facet correctly stacked — rows shrank to ~298px of an 480px phone row with a
right-edge gap, exactly the user-visible "squished to the left" symptom. Fix:
wrap any per-facet `grid-template-columns` override in
`@media (min-width: 901px)` so the stacking rule reclaims the row on phones.
When adding another per-facet column tweak, it MUST NOT outrank the
`max-width: 900px` stacking block.

## Headless verification recipe

Probe `.matilda/probe/pl-primary-width.mjs` (scratch, not committed) drives the
fix-proof. Pattern for a facet-rendering change:

1. Serve the repo over a local http server (one-shot `createServer` + puppeteer-core,
   the standard `.matilda/probe/` skeleton), `waitForSelector(".rd-pl-row")`.
2. Click a facet tab by visible text within `#latest-polls`
   (`[role='tab']` nodes; "Two-party" / "Primary" / "Leaders").
3. Assert `getComputedStyle(row).gridTemplateColumns`,
   `getComputedStyle(row).gridTemplateAreas`, and per-cell
   `getBoundingClientRect()` (hidden cells report width 0).
4. Run at ≥2 viewports: 1280 desktop AND a phone rung (480×860 or 390).
   The 2026-09-28 bug was invisible at 1280 and fully broken at 480 — a
   desktop-only probe would have passed.
5. Expected healthy values at 480px for ALL facets: `rowCols` two tracks
   (name+figs), `gridTemplateAreas` `"name figs" "tl tl" "foot foot"`, tl cell
   spanning the full row width (equal to `.rd-pl` width). Primary facet at
   480 is `270px 150px`; twopp `330px 89px`; leaders `239px 180px` — the
   name/figs split differs per facet by content, but no desktop 6-track
   template may survive under 901px.

## Adjacent notes

- The releases strip in each row (`.rd-pl-tl`, pos() maps releases onto a
  t0−43d…t0+23d window) and its `.rd-tl-tip` readout tooltip are a separate
  machine with an unfixed as-of-this-date bug: the tip sometimes opens past
  the screen edge on the SECOND dot click after another dot was clicked
  (first click is fine). Investigated 2026-09-28, root cause not landed.
- Fonts: `tabular-nums` on `.rd-pl`; heavy `.rd-pl-main`/`rd-pl-sub` sizing map
  lives in `rd.css:588-598` with phone overrides in the 900px block.
