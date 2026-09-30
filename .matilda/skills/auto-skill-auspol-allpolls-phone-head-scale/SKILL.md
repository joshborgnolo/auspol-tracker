---
name: auspol-allpolls-phone-head-scale
description: "auspol-tracker — the phone pinned scale header of the All-polls table (.rd-ap-phead/.rd-ap-hpic/.rd-ap-in/.rd-ap-tk): phoneHead JSX in rd-allpolls.jsx ~1045-1053 (per-facet branches), PMAX/pdx/ldx scales ~787-791, mounted in .rd-ap-headwrap ~1162. THE `cls` COLLISION HAZARD: the facet class (rd-ap-c2pp/-cprim/-clead/-cdir, built at rd-allpolls.jsx:767) is applied to the phead, every row/card/mrow AND the card's own primary-figures child row also carries a bare .rd-ap-cprim — so any phone-block rule on a bare facet class leaks onto every container sharing it. Worked bug (fixed b56e930, 2026-09-29): `.rd-ap-cprim { display:flex; justify-content: space-between }` (meant for the card's figures row) also matched .rd-ap-phead.rd-ap-cprim, making the pinned header a flex container whose .rd-ap-hpic span collapsed to width 0 (only abspos children = shrink-to-fit) and every 0..40% tick stacked at the left on phone Primary view; fix = scope the card rules to `.rd-ap-card .rd-ap-cprim`. CSS homes in rd.css: desktop hpic/in/tk rules 1689-1703, phone phead block 1917-1921 (note `body.rd .rd-ap-phead.rd-ap-c2pp .rd-ap-in` — the scoped-by-phead convention predates the fix), the card-row rules now at 1938-1941. Verification probes: .matilda/probe/ap-prim-phone-scale.mjs (tick rect spread at 390+320px) and .matilda/probe/overflow-320.mjs. Pre-existing overflow note: at 320px the page carries +13px scrollX from .ss-table and the rd-tabs rows — NOT from this header (verified against the deployed pre-fix site); don't chase it when gating tick fixes."
source: auto-skill
extracted_at: '2026-09-29T00:04:22.712Z'
---

# All-polls phone pinned scale header

## Symptom → cause

"On phone, the Primary view's % labels on top of the All-polls chart are
broken — numbers sit on top of each other, crammed onto the left." Geometry
probe (tick rects all at x≈20, `.rd-ap-hpic` width 0, phead computed
`display:flex` although NO rd.css rule gives phead display:flex) traced it
to the phone media block's card-figures rule:

```css
body.rd .rd-ap-cprim { display: flex; justify-content: space-between; ... }
```

The facet class string (`cls = rd-ap-cprim` for the primary facet,
rd-allpolls.jsx:767) is applied to the pinned header (`"rd-ap-phead " +
cls`, ~1046), to each phone card (`"rd-ap-card " + cls`, ~983), each
desktop row and each month row — AND the card's primary-figures child is
its own bare `<div className="rd-ap-cprim">` (~907). So a rule written for
the card's figures row silently matched the header too:

- phead became a flex row; its only child `.rd-ap-hpic` (a span,
  `display:block; align-self: stretch` desktop rule is inert in flex)
  shrink-to-fit around content that is ENTIRELY absolutely-positioned
  (`.rd-ap-in` / `.rd-ap-cap`) → width 0, height 38.
- Every tick's inline `style={{ left: pdx(v) + "%" }}` then resolved
  against a 0-wide containing block → all five labels at the left edge.

Fix (b56e930): scope all four rules as `.rd-ap-card .rd-ap-cprim` — the
card element itself keeps `display:flex; flex-direction: column` from its
own rule (1928), the figures row keeps its flex/space-between, and the
header reverts to block so hpic spans the header width.

## The rule to follow

In the `@media (max-width: 760px)` block, ANY new rule keyed on a facet
class must name its intended container explicitly:

- for the card's inner rows: `body.rd .rd-ap-card .rd-ap-c<facet> …`
- for the pinned header: `body.rd .rd-ap-phead.rd-ap-c<facet> …`
  (this exact pattern already exists: line 1920's `.rd-ap-phead.rd-ap-c2pp
  .rd-ap-in { right: 46px }`).

The same bare-class leak can hit rows/mrows (they also carry `cls`), so
never write a phone-block rule against `.rd-ap-c2pp/-cprim/-clead/-cdir`
alone.

## Verification (headless probe, both phone rungs)

`.matilda/probe/ap-prim-phone-scale.mjs`: serve-and-probe skeleton (port
8941), viewport loop 390×844 and 320×844 dSF 2, clicks All-polls → Primary
facet (narrow viewports mount `.rd-ap-card` instead of `.rd-ap-row` — the
tiles come up via `div[role=tab]` text match on "Primary"), waits
`.rd-ap-phead .rd-ap-tk`, then asserts from getBoundingClientRect:

- hpic width > 0.7×viewport (was proving 0/350 pre-fix),
- 5 ticks, adjacent-left gaps > 25px, all rects inside the viewport,
- `scrollX <= 0` at 390px; `scrollX <= 13` at 320px — the 13px is a
  PRE-EXISTING overflow from `.ss-table` (static-summary latest-polls
  table) and the `rd-tabs` facet rows, measured on the deployed site
  (auspoltracker.com) before the fix shipped; unrelated to the header,
- the card's own figures row still `display:flex` (catches an
  over-broadened selector that breaks the figures row while fixing the
  header).

## Related knowledge

- `auspol-mobile-overflow-probe` — the pannable-page/right-gutter symptom
  class generally.
- `auspol-headless-geometry-verify` — the measure-don't-screenshot
  methodology and probe skeleton.
- The rd.css phone block starts at `:1899` ("/* the phone: cards under a
  pinned scale */"); the desktop header scale rules (`.rd-ap-hrow`,
  `.rd-ap-th`, hpic/in/tk/scl/scr) sit at ~1676-1703.
