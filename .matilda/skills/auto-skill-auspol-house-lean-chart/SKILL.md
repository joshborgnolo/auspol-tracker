---
name: auspol-house-lean-chart
description: "auspol-tracker — house-lean-over-time chart end-to-end (panel a4618f3, party-tinted ground 111682c): gen-data emits houseLean = monthly readings of the 5547168 house-effects estimator per firm (≥3 evidence polls, months from that firm's evidenceFrom); HouseLeanPanel in d1a1d215 mounted on the All-polls 2PP facet after VariancePanel, modelled on VariancePanel; .ap-lean CSS + .lean-band-* ground fills in template.html. Houses are NOT parties — LINE palette must avoid every party hue; the party hues are spent on the GROUND halves instead (TrendChart bands className slot, themed by --lean-alp-bg/--lean-lnp-bg)."
source: auto-skill
extracted_at: '2026-09-02T12:50:34.036Z'
---

# House lean over time chart (All-polls 2PP facet; panel a4618f3, party-tinted ground halves 111682c)

Monthly time-series of each pollster's house lean, sitting under the **Poll disagreement** panel (VariancePanel) on the **2PP facet** of the **All polls** view. Built entirely on commit 5547168's contemporaneous `houseEffectsFor` estimator (±28-day consensus window, `HE_HALF = 90` evidence half-life, `SHRINK_K` shrinkage) — no new maths, just new observation points of the same estimator.

## The three edit homes (all must move together)

1. **`.build/newtracker/gen-data.mjs`** — the estimator now returns `evidenceFrom`; `houseLean` const + `D` export. 1959 lines after this change.
   - **`houseEffectsFor` (`~:231–272`)**: evidence loop at `:248-253` records `evidenceN` and `evidenceFrom[firm]` = first evidence mid (ms) per firm; return at `:272` adds `evidenceFrom` alongside `{at, evidenceN, snapshot, estimable}`.
   - **`ymMidMs(ym)` helper (`:359`)**: `Date.parse(ym + "-15T00:00:00Z")` — mid-month anchor for monthly readings. (Nearby machinery: `mx` fractional year `:114`, `MONTHS` `:150`, `ddays` `:198`, `r1` rounding.)
   - **`houseLean` block (after `:368`)**: shape `{firm: [{ym, v}]}`. MONTHS filtered to `ymMidMs(ym) >= evidenceFrom[firm]` (series begins at the firm's first evidence month — no leading zero-padding by construction, so the planned "drop leading zero-only months" filter was DROPPED as unnecessary: initial values are small anyway since shrinkage starts an estimator at 0 and the first evidence is what carries it off it). `v = r1(houseEffect.at(firm, ymMidMs(ym)))`. **Only firms with `evidenceN >= 3`** (mirrors the `estimable` gate) — DemosAU and Wolf & Smith are correctly absent at Sep 2026.
   - Emitted in the dataset asset template at `:1837` (`const houseLean = ${JSON.stringify(houseLean)};`) and added to the `D` export list at `:1908` (`... adjusted, houseEffects, houseLean, direction, ...`).
2. **`.build/newtracker/assets/d1a1d215-….js`** (archive AllPollsView asset, 3453 lines after 111682c) — `HOUSE_LEAN_COLOURS` + `houseLeanColour` + `HouseLeanPanel` after VariancePanel at `~:2360-2445`; mounted at `~:3170`:
   - `{facet === "twopp" && <HouseLeanPanel rangeId={range} />}` directly after `<VariancePanel facet={facet} rangeId={range} />`, with the JSX comment that house lean is a 2PP story (NOT mounted on the primary facet).
3. **`.build/newtracker/template.html`** — `.ap-lean` frame rule AND, since 111682c, the `.lean-band-alp`/`.lean-band-lnp` ground-fill rules (`~:3252-3265`, after the ap-var media query): `.ap-lean` is `border-top: 1px solid var(--line); padding: 24px 0 0; margin: 30px 0 0`. Everything else (panel head, legend chips, note) reuses the disagreement panel's global classes: `.ap-var-head`, `.legend`, `.legend-chip val/name/swatch`, `.table-hint .ap-var-note`. The separate `lean-head` wrapper class was planned and REMOVED as unused — don't reintroduce it.

111682c also touched a fourth file outside the panel: **`.build/newtracker/assets/08b413e7-….js`** (TrendChart renderer) — the `bands` prop grew an optional `className` on the `<rect>` (doc comment at `:95`, render at `:762`), mirroring the theming contract `areas` already had. Band colours for the lean chart then live entirely in CSS (theme vars), and a band whose `className` supplies the fill just omits `color`.

Always edit sources → `node .build/newtracker/build.mjs` → `node .build/newtracker/validate.mjs` → diff the built `index.html`. Never hand-edit `index.html`.

## HouseLeanPanel internals (the VariancePanel pattern — reuse it for any new archive-facet panel)

- `useNarrow()` responsive; **hidden-chips toggle series opacity** (`opacity: hidden ? 0 : 1`), not removal — geometry never reshuffles.
- Line width 3; `rangeDomain(rangeId)`; window membership `inWin >= xDomain[0] - 0.02` (small tolerance so the edge month isn't dropped by float noise); **full-MONTHS spine** so all firms share one x grid even though series start at different months.
- **TrendChart tooltip handles ragged series for free**: rows come from `ptAtX` per spine x — a firm with no point at that month simply omits its row; rows are sorted by value; a point's `note` shows beside the value. No special-casing needed for per-firm start months.
- `fitDomain(vals, maxAbs > 4 ? 2 : 1, 0)` with `vals` seeded `[1, -1]` — the y-domain always covers ±1pp so near-zero series don't render on a degenerate sub-pp scale. **This seed also guarantees 0 is strictly inside the domain, which is what the two ground bands need** (below).
- **Ground halves via `bands` (111682c)**: `bands={[{y0: 0, y1: domain[1], className: "lean-band-alp"}, {y0: domain[0], y1: 0, className: "lean-band-lnp"}]}` — no `color` prop, the class supplies the fill. Bands render as full-plot-width rects from y1 down to y0, drawn before gridlines/reflines/series, so they sit behind everything. They pane to the DOMAIN edges (not ±fixed), so an asymmetric domain gives asymmetric halves — intended.
- **Latest standing shown in the value column comes from the FULL series, not the window** — so narrowing the range does not change the chip numbers. (Consistency rule: chips describe the series, the chart shows the window.)
- Signed format `±pp` using "−" (en-dash-style minus); `fmt: (v) => (v===0 ? "" : ...)` keeps the zero tick label empty since the zero line is labelled by the legend instead; zero baseline via `refLines: [{y: 0, color: "var(--ink-3)"}]`.
- TrendChart props: `height` narrow ? 500 : 300 (see auspol-chart-sizing for the viewBox/CSS height derivation), `pad {l:54, r:20, t:18, b:40}`, `unit="pp"`, `ariaLabel` set.
- hi-term glossary link: `window.AP.openTerm("house-effect", "House lean")`.
- Since 29c5447 the section carries `id="house-lean"` (+ `scroll-margin-top: 72px` via template.html's `.ap-var, .ap-lean` rule) — it is the destination of the "Jump to house lean" pill above the All-polls table; do not rename/remove the id. See `auspol-archive-jump-links`.

## Colour policy — houses are not parties

- `HOUSE_LEAN_COLOURS`: `oklch(0.63 0.145 H)` ladder with `H ∈ {90, 110, 128, 165, 185, 205, 225, 268, 290, 312}`, **deliberately avoiding every party hue** (ALP 27, ONP/OTH 58–70, GRN 150, LNP 250) — a red-looking line would read as a Labor measure, which house lean is not.
- **Alphabetical firm→colour assignment from the fixed ladder**, so rebuilds/new data cannot reshuffle the palette.
- `houseLeanColour(firm)` hash fallback for uncatalogued houses: `99 + (h % 9) * 29` → hues 99–331, inside the safe band.
- **Party hues are NOT banned from the panel — they belong to the GROUND, not the series.** Since 111682c the chart's two halves carry ALP red above zero / LNP blue below as faint washes: theme vars `--lean-alp-bg` (`oklch(0.55 0.150 27 / 0.08)` light) and `--lean-lnp-bg` (`oklch(0.50 0.095 250 / 0.09)` light), lifted to `/0.14` alphas on the dark party hues in `body.dark`, applied by `.lean-band-alp`/`.lean-band-lnp` CSS rules (with a `.35s` fill transition matching grid/refline theme crossfade). When leaning a chart this way: hue washes at ≤~0.1 alpha won't fight the 0.63-lightness lines, and className-themed fills are how SVG backgrounds stay dark-mode-correct here.

## Copy/commitments the panel makes (don't break)

- Note below the legend states the sign convention, now worded to own the shading: "**Above zero – the red ground – leans to Labor** on the classic two-party, the blue below it to the Coalition" AND explicitly warns that the All-polls table's **House-effect column pools the whole history**, so it will NOT match the chart's right edge (the snapshot column is all-history shrinkage; the chart walks the same estimator month by month). The `ariaLabel` likewise ends "…the ground above zero is tinted Labor red, below zero Coalition blue". All deliberate; keep them in sync with any estimator or shading change.
- Sanity anchors observed at commit (Sep 2026): Essential walks −0.2 → −1.0 (Labour-adverse drift, the 5547168 motivation), Roy Morgan sits ≈ +0.7; per-firm starts 2025-06 (Roy Morgan) / 2026-01 (Fox & Hedgehog), all series end at the current month; 9 firms present.

Related: `auspol-extra-datapoint-pipeline` (per-poll datapoint passthrough) and `auspol-next-polls-projection` (another two-home gen-data↔renderer feature map). Sister panel: `auspol-poll-discord-panel` (VariancePanel directly above it — the pattern HouseLeanPanel is modelled on).

**Extension hooks verified 2026-09-03** (per-primary lean toggle designed, unshipped): `HouseLeanPanel` is the SOLE consumer of `D.houseLean`; `primaryHE[k]` (per-primary house-effects estimators, all 5 keys) already exists at gen-data `:430-438` and per-key whole-history snapshots are ALREADY emitted as `houseEffects.primary` (`gen-data.mjs :1896`), so a per-measure `houseLean = {tpp, alp, lnp, onp}` restructure needs only gen-data + this panel + new `.lean-band-*` ground classes (ON tint + neutral below-half) in template.html (`--lean-*-bg` vars at `:105-110` light, `:165-172` dark). Mount gate `facet === "twopp"` at d1a1d215 `:3534`; the he-sort jump trigger `jumpTo("house-lean")` at `:2935` is likewise 2PP-only.
