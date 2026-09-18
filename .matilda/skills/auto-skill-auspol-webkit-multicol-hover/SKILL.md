---
name: auspol-webkit-multicol-hover
description: auspol-tracker — Safari/WebKit hover broken on a TrendChart that works in Chrome/Firefox → suspect CSS multicol fragmentation (the .info glossary's `columns: 2` + `break-inside: avoid`). WebKit returns a PRE-FRAGMENT getBoundingClientRect for an element pushed out of its column (measured 1144×4825, top −4288, while offsetHeight=181); TrendChart's toVB() maps pointer coords through that rect so the readout answers from a phantom column ("left side blocked", "laggy" on Mac Safari only). Fix pattern: `.info .info-term:has(.info-chart) { column-span: all; }` (shipped 2026-09-08, commit 12221e0). Includes the WebKit probing toolchain (playwright-core WebKit, since safaridriver/AppleScript are gated off on this Mac) and the geometry A/B recipe.
source: auto-skill
extracted_at: '2026-09-08T08:11:27.744Z'
---

# WebKit multicol fragmentation breaks TrendChart hover — auspol-tracker

## Symptom shape (what the user reports)

- "Hover is laggy / can't move the hover to the left / left side of the
  chart blocked" **in Safari on Mac only** — Chrome and Firefox fine,
  including on the live site, and other TrendChart instances on the same
  page fine.
- The failing chart lives inside a **CSS multi-column container**
  (the only one on the site: the Info glossary,
  `@media (min-width:1100px) { .info { columns: 2 } .info-term { break-inside: avoid } }`,
  template.html ~:2030).

## Root cause (engine quirk, not app code)

- A `.info-term` too tall for the remaining column gets pushed to the
  next column (`break-inside: avoid`). WebKit then reports the element's
  `getBoundingClientRect()` from its **pre-fragment geometry**: measured
  on the glossary FlowChart svg, `1144×4825, top −4288` while
  `offsetHeight` was **181** and the viewBox was `"0 0 1000 330"`.
  Chrome/Firefox report honest rects — that engine split IS the bug
  signature.
- TrendChart (`08b413e7` asset ~:231) maps every pointer event through
  that rect:
  `toVB = e => ({ x:(e.clientX-rect.left)/rect.width*W, … })`.
  With a phantom 4825px-tall rect offset −4288px, most of the visible
  plot maps to nonsense coordinates → the guide only fires where the
  phantom rect happens to coincide with the real plot (right side), and
  it "lags".

## Fix (shipped commit 12221e0, 2026-09-08)

In template.html, inside the EXISTING `@media (min-width:1100px)` block:

```css
.info .info-term:has(.info-chart) { column-span: all; }
```

A spanning term is never fragmented, so the rect is honest in every
engine; the chart also gets the full two-column measure. If a future
chart lands in ANY multicol/`break-inside` context, prefer spanning (or
`display: block` on an unfragmentable wrapper) over JS workarounds —
do NOT touch `toVB()` itself; the mapping is correct given a true rect.

## Diagnostic recipe (reusable)

1. **Rule out app-side first** — Chrome hover probe + touch-scrub probe
   pass; live site grep proves the shipped build is current (`fc-unit`
   token), so it isn't a stale deploy. Then the engine split itself is
   the lead.
2. **Geometry A/B in WebKit** (`.matilda/flow-webkit-geom.mjs`): serve
   the repo over `node:http`, launch playwright-core **WebKit**, measure
   `rect` vs `offsetHeight` vs viewBox at 1440 / 1000 / 390 px. Broken
   only at widths where `columns: 2` applies = multicol fragmentation
   confirmed. (A rect/offsetHeight mismatch >2× with a negative `top`
   is the tell.)
3. **Functional sweep**: `page.mouse.move` across the plot at ~4% steps
   reading `.tip .tip-title` after each move; assert the title walks
   1996→2025 monotonically, especially the LEFT edge. Capture the
   bounding box AFTER any scroll-into-view settles (a box read before
   the openTerm scroll gives stale coordinates — that exact bug cost a
   probe iteration).

## WebKit probing toolchain on this Mac

- `safaridriver` → "You must enable 'Allow remote automation'" (disabled;
  don't burn time). AppleScript `do JavaScript` → "Allow JavaScript from
  Apple Events" also disabled. DEAD END both.
- Working route: `npm i --no-save playwright-core` +
  `npx playwright-core install webkit` (WebKit binary lands in
  `~/Library/Caches/ms-playwright/webkit-*`, currently wk 26.6 /
  webkit-2359), then `import { webkit } from "playwright-core"`.
  Probe scripts live in `.matilda/flow-webkit-*.mjs` (gitignored):
  `flow-webkit-geom.mjs` (geometry A/B) and `flow-webkit-probe.mjs`
  (hover sweep + elementFromPoint + move-timing).

## Related

- The glossary layout & TERMS machinery: auto-skill-auspol-glossary-terms.
- TrendChart sizing (viewBox → rendered height), the other geometry
  axis: auto-skill-auspol-chart-sizing.
- The `.info .info-term:has(.info-chart)` selector requires `:has()`
  support — fine on every engine this site targets; verify visually at
  exactly 1100px and just-below when touching that media block.
