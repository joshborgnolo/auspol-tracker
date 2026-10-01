---
name: auspol-wv-place-chart-heights
description: "auspol-tracker — the Who-votes Place tab's side-by-side chart row and the By-location plot that stretches to the 2×2 By-state grid's height (implemented 2026-10-02): .rd-wv-charts flex row (rd.css :1174) holds the state card (head + .rd-wv-panels grid of four .rd-sm minis at heightPx 140/120) and the location card (one TrendChart); rd-panels.jsx RdDemographics measures .rd-wv-panels with a ResizeObserver (wvGridRef/wvGridH, laid out at ~:1906-1920) and sizes the location TrendChart heightPx = narrow ? 240 : (even && wvGridH ? Math.round(wvGridH) + 42 : 260) — the 42 is padPx t12+b30 and MUST move with those pads. Probe .matilda/probe-wv-loc-height.mjs asserts svgH == gridH + 42 (±1.5) side-by-side at 1440/820 and stacked 240px at 390, re-asserted across a party morph. Phone/narrow layout untouched by design."
source: auto-skill
extracted_at: '2026-10-02T10:00:00.000Z'
---

# Who-votes Place tab — By-location plot == By-state 2×2 grid height

The user ask (2026-10-02): "on laptop, the 'By location' chart y axis
should be as long as the height of the 2 by 2 by state chart grid". Reading
of the intent: the **plot area** (the y-axis's vertical span) equals the
`.rd-wv-panels` grid block's rendered height, only where the two cards sit
side by side. Implemented entirely in
`.build/newtracker/assets/rd-panels.jsx` (`RdDemographics`, starts ~:1463);
no CSS change needed.

## Row/card anatomy (edit points)

- `.rd-wv-charts` — flex row, gap 32 (rd.css :1174); children both
  `style={{flex:"1 1 0"}}`; stacks to column at ≤640px (rd.css :1204).
  The component's `narrow = useNarrow("(max-width: 640px)")` matches that
  breakpoint, so gates on `!narrow` are exactly "side by side".
- `even = charts.some(c => c.st.id === "state")` (~:1906) — true only on
  Place (state card present). The stretch also gates on `even`.
- State card (~:1944+): `{head}` then `.rd-wv-panels` — grid, 2 cols,
  row-gap 16, margin-top 8 (rd.css :1177) — of four `.rd-sm.rd-wv-panel`:
  `.rd-sm-top` (13px label / 15px `<b>` figure) + `TrendChart
  heightPx={narrow?120:140} padPx={{l:30,r:6,t:8,b:24}}`.
- Location card (~:2041+): `{head}` then one `TrendChart` with desktop
  `padPx={{l:40,r:12,t:12,b:30}}` — the t12+b30 **is the 42** in the
  heightPx formula; the callsite carries a comment saying so. Both `head`s
  are the same `rd-chead` JSX, so header heights match on both cards.

## Chrome metrics (why the offsets line up)

- `.rd-card` padding 0 (rd.css :594); `.rd-chead` margin-top 16,
  min-height 28 (rd.css :273).
- `body.rd .chart { margin-top: 0 }` (rd.css :244) overrides the
  template's `.chart { margin-top: 4px }`.
- `.chart:has(> .chart-copy-btn)` gets padding-bottom 30 (template), but
  the state minis are zeroed (`.rd-sm .chart…` rd.css :1248) — card
  bottoms therefore DON'T align, and that's fine: the cards are borderless
  (`background:none; border:0`), only the plot tops/axis spans read.
  The location plot starts 4px lower than the grid block (padPx.t 12 vs
  the grid's margin-top 8) — imperceptible, and the ask was axis LENGTH.

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
  now drives. Grid height is in practice constant on desktop
  (~2×(smTop+140)+16 ≈ 340px).
- The existing `useRdWidth(ref, fallback)` hook (:2134) is the same-shape
  width-only pattern if width is ever the measured axis.

## TrendChart `heightPx` contract (why svgH == heightPx exactly)

See `assets/08b413e7-…js` :191/:406 — `heightPx` is a SCREEN-px height:
the chart measures its own host width (`cw`, k0 = cw/1000) and sets
viewBox `height = heightPx / k0`, so the `.chart-svg { width:100%;
height:auto }` scaling cancels k0 and **rendered svg height == heightPx
at every width**. Rendered plot = heightPx − padPx.t − padPx.b. This is
what makes `Math.round(wvGridH) + 42` yield an axis exactly `wvGridH` px
tall. (Also folded into auto-skill-auspol-chart-sizing.)

## Verification

`.matilda/probe-wv-loc-height.mjs` (file:// against the built index.html,
puppeteer-core + system Chrome): rungs 1440/820/390. Desktop asserts both
cards render, tops coincide (±2px), location svg height == grid height +
42 (±1.5 rounding) and svg > 300 (i.e. not the old 260); re-asserts after
clicking the ALP party chip (morph keeps the contract). Phone rung:
cards stack (location top ≥ state bottom) and svg stays 240. Measured:
grid 339.7px → location svg 382.0px at both desktop widths; ALL PASS
2026-10-02. Rebuild via `node .build/newtracker/build.mjs` first — and
shield any sibling's dirty rd.css (it inlines into index.html; see
auto-skill-shared-repo-session-race for the stash/checkout/restore dance
used this session).
