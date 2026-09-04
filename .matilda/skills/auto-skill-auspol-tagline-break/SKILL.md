---
name: auspol-tagline-break
description: "auspol-tracker masthead — the tagline's forced clause-break (<br className=tagline-br> in the 73de0c58 JSX), its single font-size rule (template.html .tagline, 15px since f713579), and the DYNAMIC 'last N' cycle count (c580138: the count word derives from the number of PAST cycle terms in all THREE homes — masthead JSX + build.mjs ss-sub + meta description). One break position applies at EVERY viewport since the phone-only display:none override was deleted (6118171). Verify line layout by element-height/line-height at a viewport sweep — never by Range/getClientRects."
source: auto-skill
extracted_at: '2026-09-02T00:00:00.000Z'
---

# Tagline structure and break control (auspol-tracker)

The tagline under the wordmark — "Aggregated opinion polling for the next
Australian / federal election, set against the last N." — has THREE homes
since `c580138` (2026-09-03) made the count word dynamic (see the next
section); before that it said "the last five." by hand in two of them:

1. **JSX (the text + the break)**: `<p className="tagline">` in
   `.build/newtracker/assets/73de0c58-….js` (~line 312). The forced break is a
   `<br className="tagline-br">` placed after "…next Australian", splitting the
   sentence at the clause boundary. Edit the text or the break position HERE;
   it recompiles into `index.html` via the rebuild (see auspol-build-pipeline).
2. **CSS (size/colour/wrapping)**: one `.tagline { … }` rule in
   `.build/newtracker/template.html` (~line 669). Current: `font-family:
   var(--serif)` (Crimson Text since 0f4eaa3), weight 400, **font-size 15px**
   (bumped from 13px in `f713579`, 2026-09-02), `color: var(--ink-3)`,
   `text-wrap: balance`, and a `margin: 7px 0 -1.5px` whose negative bottom
   margin optically aligns the baseline with head-meta values — keep the
   in-source comment if the margin changes.

## One break position, all viewports (user-directed 2026-09-02)

Until commit `6118171` an `@media (max-width: 560px)` rule
`.tagline-br { display: none; }` suppressed the forced break on phones, which
made the line wrap right after "next". The user wanted the desktop clause
split everywhere ("…the next Australian / federal election, set against the
last five."), so that override rule was **deleted** (replaced by an in-source
comment in the 560px media block explaining why). There is now NO
viewport-conditional break logic: the same `<br>` fires at 1400px and 360px
alike.

Consequence for future asks: "different break positions on desktop vs phone"
is NOT a CSS-only change — reintroduce a second `<br>` (e.g. plus a
`.tagline-br-phone`) with a `display: none` toggle across the 560px
breakpoint. Don't just re-add `display:none` to the shared class (that was
the exact state the user rejected).

Phone context, same media block: `.head-meta` is hidden ≤560px and replaced
by `.head-meta-compact` (12.5px freshness line, `display: none` otherwise) —
don't confuse it with the tagline when grepping `tagline` / `head-meta`.

## Text width behaviour

The tagline's rendered width caps at **~298px at every viewport ≥340px**
(298 ≈ the wider of the two forced lines — it is not a max-width rule, just
the natural content width of the break). Below ~340px viewport width the
first forced line itself wraps, producing **3 visual lines** at 320px
(iPhone SE 1st gen only, negligible share; was borderline even at 13px).
The line-height is `normal` ≈ 1.45em (21.75px at 15px) → two-line height
43.5px. A type-size bump beyond ~16px would push the 3-line threshold above
320px, so re-run the width sweep if the size changes again.

## Verification procedure (headless Chrome, established 2026-09-02)

Scratch probes live uncommitted under `.matilda/verify-tagline/` (and
`verify-fonts/`); the pattern: a `node` script serving the repo root over
`http://127.0.0.1:<port>`, `puppeteer-core` from `~/node_modules` driving
`/Applications/Google Chrome.app/…`, `waitUntil: "networkidle0"`, wait for
`.tagline`, `document.fonts.ready`, then measure.

- **Count tagline lines as `element.clientHeight / computed line-height`**
  per viewport width (sweep 320, 340, 360, 375, 390, 414, 430, 500, 560,
  768, 1400). Expected post-`f713579`: exactly 2 lines everywhere ≥340px.
- **Do NOT count lines via `Range.selectNodeContents(textNode)` +
  `getClientRects()`** — that returns duplicate rects per line box (observed:
  3+ rects for a 2-line element, two identical), which the same session's
  first probe misread as a wrap bug. Height arithmetic is the reliable oracle.
- Verify-negative gotcha for font work in general: `document.fonts.check()`
  is true-on-fallback; the real oracle is the **server-side woff2 request
  log** (record `.woff2` requests in the probe's static server).
