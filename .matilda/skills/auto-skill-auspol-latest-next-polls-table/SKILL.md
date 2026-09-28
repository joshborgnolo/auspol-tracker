---
name: auspol-latest-next-polls-table
description: "auspol-tracker — RdPolls ('Latest and next polls' section) anatomy: facet tabs (twopp/primary/leadership) via rd.jsx RdSec data-facet, 6-column desktop grid in rd.css (~:557), per-facet grid-template-columns overrides are a media-query leak hazard (@media (min-width:901px) needed), the facet RdSwap crossfade ghost must stay OUT of flow (position:absolute float, fixed 2026-09-28) or the phone's content-sized figs track snaps ~360ms in when the ghost unmounts (figures visibly jump right/down); probe by toggling tabs headlessly and asserting getComputedStyle(row).gridTemplateColumns + per-cell bounding rects stay constant through the crossfade."
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

## The facet-swap ghost sizing trap (fixed 2026-09-28, commit 105dfd1)

Figure cells and the figures header swap per facet through `RdSwap`
(rd.jsx): on a key change the outgoing copy stays mounted ~360ms after the
incoming one lands so the first can fade out under it. The original CSS put
BOTH copies in one grid area of `.rd-swap`, so during the fade the cell
computed its box from max(old, new) — on a phone, where the figures track
is `auto` (content-sized) and right-aligned, the right-anchored box kept
the OLD content's width/height for ~360ms, then snapped smaller/wider when
the ghost unmounted. Probe-measured at 390px: after Primary→2PP the first
row's `gridTemplateColumns` flipped `188px 150px → 248.6px 89.4px` at
t≈372ms (cell jumped ~60px right); 2PP→Primary shifted the cell's top +9px
at t≈375ms. That was the user-visible "digits shift a beat late" glitch.

Fix: the outgoing copy is `position: absolute; top:0; right:0; left:0;
min-width: max-content` (out of flow, width-capped to its own natural size
so it never wraps), inside `.rd-swap` now `position: relative`; only the
incoming copy ever sizes the track. Under the 900px phone block the float
is right-anchored (`left:auto; right:0`) inside `.rd-pl` cells so it fades
exactly over the right-aligned figures it replaces. Don't put the ghost
back in flow — desktop's fixed px columns wouldn't bounce, but any
content-sized track (all phone facets, any future auto column) will.

## Headless verification recipe

Probe `.matilda/probe/pl-primary-width.mjs` (scratch, not committed) and
`.matilda/probe-rdpl-glitch.mjs` (ghost-bounce atlas, values above) drive
the fix-proofs. Pattern for a facet-rendering change:

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
