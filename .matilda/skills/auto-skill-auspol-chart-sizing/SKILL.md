---
name: auspol-chart-sizing
description: "auspol-tracker — map of every TrendChart's height prop and how rendered height is derived (SVG viewBox 0 0 1000 H + CSS height:auto = rendered h = container px × H/1000); useNarrow() exists because media queries can't retune SVG aspect — ALL eight charts ship adaptive narrow-taller heights since 654b926"
source: auto-skill
extracted_at: '2026-09-02T07:09:16.608Z'
---

# Chart sizing — where heights come from

All trend charts render through `TrendChart` (`assets/08b413e7-…js`), which
draws into a fixed viewBox `0 0 1000 H` (`VB = { W: 1000 }`, height passed as a
prop) and emits `<svg class="chart-svg">`. CSS does the rest:

```css
.chart-svg { width: 100%; height: auto; }
```

So **rendered height = container px width × H / 1000**. Aspect is locked; no
CSS media query can change it. Small containers get proportionally SHORT
charts, which is why phone charts collapse height-wise. The fix pattern is a
component-level switch to a taller viewBox (`useNarrow`), never CSS.

Container geometry (page `.page` maxw 1200px, padding 28px sides → ~1144px
content on laptop; 16px sides ≤560px → ~358px on a 390px phone; `.card` adds
22px 24px padding):

| Chart (callsite) | height | Laptop (~1144px) | Phone (390px) |
|---|---|---|---|
| Hero 2PP trend — `73de0c58…js` ~:1203 | `narrow ? 700 : 420` | ~480px | ~250px |
| Primary vote — `a11e1559…js` ~:255 | `narrow ? 460 : 340` | ~373px | ~143px |
| Preferred PM — `a11e1559…js` ~:901 | `narrow ? 460 : 340` | ~174px (two-col) | ~143px |
| Leader approval — `a11e1559…js` ~:1159 | `narrow ? 460 : 340` | ~174px (two-col) | ~143px |
| National direction — `a11e1559…js` ~:1299 | `narrow ? 460 : 340` | ~373px | ~143px |
| Undecided — `a11e1559…js` ~:1408 | `narrow ? 460 : 340` | ~373px | ~143px |
| Past cycles — `d1a1d215…js` ~:1250 | `narrow ? 380 : 300` | ~329px | ~119px |
| Poll disagreement — `d1a1d215…js` ~:2305 | `narrow ? 380 : 300` | ~329px | ~119px |

## `useNarrow()` — the adaptive-height hook

- Shared hook, lives in the plain-utils layer `assets/ed2260de-…js` (~:16) as
  `window.useNarrow(query)`; default query `(max-width: 620px)`. wraparound
  explains the WHY in its header comment: a 1000×420 box renders ~150px tall
  in a 358px phone column, "the trend flattens into a smear", and media queries
  can't fix it because the aspect lives in the viewBox — the breakpoint must
  reach the COMPONENT and ask for a taller box.
- ONLY the hero uses `narrow` for `pad` and `axisFont: 30` (narrow) — the
  other charts got ternaries on height/axisFont only.
- Phone fix SHIPPED 654b926 (2026-09-02): every TrendChart callsite now takes
  `height={narrow ? 460 : 340}` (or `380 : 300` for the two 300s) and
  `axisFont={narrow ? 28 : 20}`. Each of the seven panel components got a
  `const narrow = useNarrow();` line hoisted above its early `if (!…)
  return null;` checks — the hook MUST precede any conditional return
  (DirectionPanel and UndecidedPanel guard on data presence). VariancePanel
  previously passed NO `axisFont` (TrendChart default 15) — its ternary is
  `{narrow ? 28 : 15}`, and that desktop `15` MUST stay explicit in the prop
  or desktop discrepancy labels grow.

## Adjacent, not duplicated

- `auspol-endlabel-dodge` — the dodging algorithm for past-cycles end labels,
  same renderer asset, different concern.
- Small strips are NOT TrendChart heights and don't need attention: hero
  timeline (`.dl-track` 62px), accuracy rails (`.acc-track` 26px), 8px
  histograms — CSS-locked by design.
- `.two-col` collapses to 1fr at ≤1200px, so the leadership pair is
  single-column everywhere below laptop widths — every chart is effectively
  full-width on phone.
