---
name: auspol-wv-place-chart-heights
description: "auspol-tracker — the Who-votes Place tab's side-by-side chart row and the By-location plot whose x axis lands on the bottom row's x axes of the 2×2 By-state grid beside it (final contract 2026-10-02): .rd-wv-charts flex row (rd.css :1174) holds the state card (head + .rd-wv-panels grid of four .rd-sm minis at heightPx 140/120) and the location card (one TrendChart); rd-panels.jsx RdDemographics measures .rd-wv-panels with a ResizeObserver (wvGridRef/wvGridH, ~:1906-1920) and sizes the location TrendChart heightPx = narrow ? 240 : (even && wvGridH ? Math.round(wvGridH) + 14 : 260) — the 14 is .rd-wv-panels margin-top 8 + (loc padPx b 30 − panels' b 24) and MUST move with any of those three. Probe .matilda/probe-wv-loc-height.mjs asserts the location x axis within 1.75px of each bottom-row panel's at 1440/820, re-asserted across a party morph, and the stacked fixed 240px at 390."
source: auto-skill
extracted_at: '2026-10-02T12:00:00.000Z'
---

# Who-votes Place tab — By-location x axis == By-state bottom row's x axes

The ask (2026-10-02, two turns): first "on laptop, the 'By location'
chart y axis should be as long as the height of the 2 by 2 by state chart
grid", then "the x axis of the By location chart should be in line with
the x axes of the bottom 2 charts in the 2×2 by state grid". The FIRST
reading (svg height = grid + full t12+b30 pads = grid+42, plot == grid
block height) shipped in commit 0f1e189 and was wrong for the user: the
location card's svg starts 8px ABOVE the grid's top (.rd-wv-panels
margin-top) and its own 30px bottom pad drops the x axis 36px below the
bottom-row panels' axes. The FINAL contract is baseline alignment:
location x-axis line == each bottom-row chart's x-axis line, within
±0.5px measured. Implemented entirely in
`.build/newtracker/assets/rd-panels.jsx` (`RdDemographics`, starts
~:1463); no CSS change needed.

## Row/card anatomy (edit points)

- `.rd-wv-charts` — flex row, gap 32 (rd.css :1174); children both
  `style={{flex:"1 1 0"}}`; stacks to column at ≤640px (rd.css :1204).
  The component's `narrow = useNarrow("(max-width: 640px)")` matches that
  breakpoint, so gates on `!narrow` are exactly "side by side".
- `even = charts.some(c => c.st.id === "state")` (~:1906) — true only on
  Place (state card present). The stretch also gates on `even`.
- State card (~:1944+): `{head}` then `.rd-wv-panels` — grid, 2 cols,
  row-gap 16, column-gap 30, margin-top 8 (rd.css :1177) — of four
  `.rd-sm.rd-wv-panel`: `.rd-sm-top` + `TrendChart
  heightPx={narrow?120:140} padPx={{l:30,r:6,t:8,b:24}}`.
- Location card (~:2041+): `{head}` then one `TrendChart` with desktop
  `padPx={{l:40,r:12,t:12,b:30}}`. The b's differ: 30 loc vs 24 panels.

## The enum that pins the 14

`heightPx = Math.round(wvGridH) + 14`, desktop only, where:

- An x-axis line sits at svgTop + svgHeight − padPx.b of its own chart.
- Bottom-row panel axes: gridTop + gridH − 24 (their svgs end at the
  grid's bottom edge).
- Location svg top = card content top = gridTop − 8, because
  `.rd-wv-panels { margin-top: 8 }` (rd.css :1177) drops the grid 8px
  below the same `rd-chead` bottom both cards share. (Measured: cards
  top 625.2, loc svg 669.2 = +44 head, grid 677.2 = +52.)
- So svgH = (gridTop + gridH − 24) − (gridTop − 8) + 30 = gridH + 14.

A change to the margin-top (8), the location b (30), or the panels' b
(24) moves the 14; the callsite comment above the TrendChart says so and
`.matilda/probe-wv-loc-height.mjs` fails if the alignment drifts
>1.75px. Deriving the offset dynamically (measuring the svg top too)
was considered and rejected as complexity for a constant the probe pins.

## Chrome metrics

- `.rd-card` padding 0 (rd.css :594); `.rd-chead` margin-top 16,
  min-height 28 (rd.css :273) → svg top = card top + 44.
- `body.rd .chart { margin-top: 0 }` (rd.css :244) overrides the
  template's `.chart { margin-top: 4px }`.
- `.chart:has(> .chart-copy-btn)` gets padding-bottom 30 (template), but
  the state minis are zeroed (`.rd-sm .chart…` rd.css :1248) — card
  bottoms DON'T align, and that's fine: the cards are borderless
  (`background:none; border:0`), only the plot axes read.
- The location plot starts 4px lower than the grid block (padPx.t 12 vs
  margin-top 8) — imperceptible; only the x-axis alignment was asked.

## The measurement hook

```jsx
const wvGridRef = React.useRef(null);
const [wvGridH, setWvGridH] = React.useState(0);
React.useLayoutEffect(() => {
  const el = wvGridRef.current;
  if (!el) return undefined;
  const fit = () => setWvGridH(el.getBoundingClientRect().height);
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(el);
  return () => ro.disconnect();
}, [even, narrow, tabId]);
```

- `ref={wvGridRef}` on the state card's `.rd-wv-panels` div. The whole
  `.rd-wv-charts` row is `key={"wv-" + tab.id}` so the grid element
  remounts per tab — the deps re-run the effect and re-observe.
- Layout-effect measure + setState re-renders before paint; the 260px
  fallback never visibly flashes.
- **No feedback loop**: wvGridH comes from the state card's grid (whose
  minis are fixed heightPx), never from the row height the location card
  now drives. Grid height is constant on desktop
  (~2×(smTop+140)+16 ≈ 339.7px at both 1440 and 820).
- The existing `useRdWidth(ref, fallback)` hook (:2134) is the same-shape
  width-only pattern if width is ever the measured axis.

## TrendChart `heightPx` contract (why svgH == heightPx exactly)

See `assets/08b413e7-…js` :191/:406 — `heightPx` is a SCREEN-px height:
the chart measures its own host width (`cw`, k0 = cw/1000) and sets
viewBox `height = heightPx / k0`, so the `.chart-svg { width:100%;
height:auto }` scaling cancels k0 and **rendered svg height == heightPx
at every width**. Rendered plot = heightPx − padPx.t − padPx.b. (Also
folded into auto-skill-auspol-chart-sizing.)

## Verification

`.matilda/probe-wv-loc-height.mjs` (file:// against the built index.html,
puppeteer-core + system Chrome): rungs 1440/820/390. Desktop asserts both
cards render in one row, location svg top sits 8px above the grid top
(±1), svgH == round(gridH)+14 (±1) and > 300 (not the old 260), and the
location x axis lands within ±1.75px of EACH bottom-row panel's axis;
re-asserted after clicking the ALP party chip. Phone rung: cards stack
(location top ≥ state bottom) and svg stays 240. Measured 2026-10-02:
grid 339.7px → svg 354.0px; axis 993.2 vs panels 992.9 at 1440, 1036.3
vs 1036.0 at 820, same after morph at 1440; ALL PASS. validate.mjs exit
0, npm test exit 0, wv-spacing/wv-gap sister probes unchanged. Rebuild
via `node .build/newtracker/build.mjs` first — and shield any sibling's
dirty rd.css (it inlines into index.html; see
auto-skill-shared-repo-session-race for the stash/checkout/restore dance).

## Card widths — a LONE card must always fill the row with flexGrow 1

The companion problem (same `.rd-wv-charts` row, asked the same day): the
By-education chart stopped ~270px short of the row's right edge on
desktop while By gender filled it. cardsFor gives each chart
`span = x1 − x0` (x-domain span in YEARS; Education's four-house wave
history spans ~0.68yr vs Gender's ~1.27yr) and cardOf sized the card
`flexGrow: Math.max(0.35, c.span)`. CSS hands a row whose grow factors
sum to LESS than 1 only that fraction of the free space — Education
(factor 0.68) got a third of the free space withheld (measured at 1440:
card right edge 1026 vs row edge 1296) while Gender (1.27) filled the row
by accident. The proportional sizing only exists for two-chart tabs (Age,
Home) so the pair share the row in x-span proportion beside the RdFoot
"Both panels share one scale" note. Fix (rd-panels.jsx ~:2061):
`flexGrow: narrow || charts.length < 2 ? 1 : Math.max(0.35, c.span)` —
never restore an ungated Max(0.35, span). Verified by
`.matilda/wv-widths.mjs` measuring rendered card rects per tab (run with
`URL="file://…built index.html"` after rebuild: Education card right edge
== row right edge 1296 at 1440px).
