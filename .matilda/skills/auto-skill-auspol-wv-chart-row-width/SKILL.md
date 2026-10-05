---
name: auspol-wv-chart-row-width
description: "auspol-tracker — Why a Who-votes single-chart tab (Gender, Education) can stop short of the row edge while another fills it, the CSS-flexbox sub-1 grow-factor rule that causes it, and the rd-panels.jsx :2062 width contract behind it (flexGrow = Math.max(0.35, c.span), span = x-domain span IN YEARS). Diagnosed live 2026-10-02: Gender filled (span 1.27 yr → grow 1.27), Education left 270px dead space (span 0.68 yr → grow 0.68, and flex only distributes free space × 0.68 when the row's grow sum < 1). One-line fix proposed (grow 1 when charts.length < 2), NOT shipped as of extraction."
source: auto-skill
extracted_at: '2026-10-02T00:51:59.810Z'
---

# Who-votes chart row width — the sub-1 flex-grow trap

Symptom (user, 2026-10-02): "in Who votes for whom, why does By gender
extend all the way to the edge of the screen, but By education does not".
Both tabs render ONE `.rd-wv-chart` card in the `.rd-wv-charts` flex row,
and theory says a lone `flex-grow > 0` item always fills its row — yet
Education measured 882px wide inside a 1152px row. The cause is the CSS
Flexbox §"resolve flexible lengths" rule: **if a row's flex-grow factors
sum to less than 1, only that fraction of the free space is distributed**;
the rest stays empty. A lone child with `flex-grow: 0.68` captures 68% of
the free space and leaves 32% as dead space.

## The width contract (rd-panels.jsx, RdDemographics)

- Row: `.rd-wv-charts { display:flex; gap:32px }` (rd.css :1174), stacks
  to column ≤640px; only child = `charts.map(chartOf)` (~:2150).
- Card width (~:2062):
  ```jsx
  style={even ? { flex: "1 1 0" }
              : { flexGrow: narrow ? 1 : Math.max(0.35, c.span) }}
  ```
  `even` = Place tab only (state card present) — both cards share 1 1 0.
- `c.span` = chart x-domain span **in years**, built in `chartsFor`
  (~:1858): `x0 = Math.max(rangeLo, firstX - 0.06)`, `x1 = rangeHi`, so a
  set whose data starts late (Education) has a small span on the default
  range; Gender 1.27, Education 0.68 at 2026-10-02.
- Intent (footer, ~:2159): when a tab has TWO charts they share one scale,
  "each is only as wide as its data" — the grow factors divide the row by
  data span. For a ONE-chart tab the factor only has to be ≥1 to fill;
  anything <1 trips the spec gap.

## Tab → chart-count map (demo-groups.mjs, DEMO_SETS/DEMO_TABS)

- Age → 2 charts (By age + By generation); Place → 2 (state panels +
  By location, the `even` case); Home → 2 (By housing + By language).
- Gender → 1 chart; Education → 1 chart — the tabs exposed to this trap.

## Verification numbers (2026-10-02, live site, 1440px)

Row 144→1296 (1152px). Gender card 1152px wide, grow 1.26667, fills.
Education card 882.2px, grow 0.68333, stops 269.8px short. Sanity maths
for the trap: free space 851.4 × 0.317 ≈ 270px unused; card base
(max-content, ≈ the svg's 300px intrinsic width before growth) 300.6px.
Probe: `.matilda/wv-widths.mjs` (untracked; puppeteer vs
`URL?=https://auspoltracker.com/`, tab → row/card rects + computed flex).

## Status / proposed fix

User asked WHY only. Proposed one-liner, NOT yet shipped:

```jsx
style={even ? { flex: "1 1 0" }
            : { flexGrow: narrow || charts.length < 2 ? 1 : Math.max(0.35, c.span) }}
```

If shipped, also consider the two-chart case where
`Math.max(0.35, span)` can sum < 1 (both spans < 0.65) — same trap. Ship
path as usual: edit source → rebuild in a clean worktree (sibling sessions
dirty the main tree) → verify with the probe → commit only own paths.

Cross-refs: `auto-skill-auspol-wv-place-chart-heights` (the row's HEIGHT
contract and the same RdDemographics code neighbourhood);
`auto-skill-auspol-headless-geometry-verify` (puppeteer layout probing);
`auto-skill-auspol-chart-sizing` (TrendChart heightPx/width scaling).
