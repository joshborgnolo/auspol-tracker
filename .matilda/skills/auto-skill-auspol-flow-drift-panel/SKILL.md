---
name: auspol-flow-drift-panel
description: "auspol-tracker — the Preference-flow drift panels end-to-end (shipped 2026-09-07): gen-data §7c flowDrift block (~:1224-1310) = per-poll residual (share2pp published 2PP − flows.mjs implied 2PP on the same primaries), election-anchored per-house 180-day baselines, anomalies pooled through monthWithSe/nowcastAdj with NULL house effects; §7d flowDriftOn reruns the same machinery on the ALP-v-ON head-to-heads against a first-principles frozen table FP_ON = {lnp 0.315, grn 0.89, oth 0.53} (AEC 2025 Senate ATL ballots, LNP cell recalibrated 2026-09-11 on Green's Secret Harbour analysis + the SA 2026 count; flipped 2026-09-09 from the shipped RedBridge-published-splits table — RedBridge's own splits survive only as its measured row, m:1); FlowDriftPanel + FlowDriftOnPanel in the d1a1d215 asset mounted on the All-polls 2PP facet after HouseLeanPanel; .ap-flow/.flow-band-* CSS reuses --lean-*-bg vars; .build/flow-drift-check.mjs is the committed verbatim-replica verification script. Includes the pq-passthrough fix to nowcastAdj/monthWithSe (difference series need per-row pq — the share-scale fallback produces p(1−p)<0 and ci95 nulls to NaN→null). Diagnostic-only by design: corrects no other figure."
source: auto-skill
extracted_at: '2026-09-07T00:00:00.000Z'
---

# Preference-flow drift panel (All-polls 2PP facet)

Answers "are published 2PPs drifting away from what the SAME polls' primaries
would imply under the frozen 2025-election flow table (flows.mjs)?" Mounted
after HouseLeanPanel on the All-polls **twopp facet only**. Shaped by the
settled design conclusion in `aec-preference-flow-constants`: flow modelling
is viable ONLY as a diagnostic — this panel corrects no other figure.

## The five homes (all must move together)

1. **`gen-data.mjs` §7c `flowDrift` block (~:1224-1310, after `synth1mo`)** —
   residual join + baselines + pooled series. Emitted into the data asset at
   ~:2256, added to the `D` export list at ~:2340, console sanity lines at
   ~:2379-2380. Constants: `FLOW_BASE_DAYS = 180`, `FLOW_BASE_MIN = 3`.
2. **`assets/d1a1d215-….js` `FlowDriftPanel({rangeId})`** (~145 lines, after
   HouseLeanPanel's closing `}`) + **`FlowDriftOnPanel({rangeId})`** (the §7d
   twin, after FlowDriftPanel's closing `}`, before AllPollsView) + mount
   lines `{facet === "twopp" && <FlowDriftPanel …/>}` /
   `… <FlowDriftOnPanel rangeId={range} />}` after the HouseLeanPanel mount.
   FlowDriftOnPanel returns null when `D.flowDriftOn` is null (input set too
   small — see §7d); nothing renders, absent-not-empty.
3. **`template.html`** — `.ap-flow` frame (mirrors `.ap-lean`),
   `.flow-band-alp`/`.flow-band-lnp` fills (reuse `--lean-alp-bg`/
   `--lean-lnp-bg`) plus `.flow-band-on` (reuses `--lean-onp-bg`; the ON
   panel's below-zero ground) folded into the shared transition selector,
   `.ap-flow` added to the
   `.ap-var, .ap-lean, .ap-flow, .acc-card { scroll-margin-top: 72px }`
   rule.
4. **`.build/flow-drift-check.mjs`** — independent re-derivation from
   data/polls.json compared against the emitted payload; exit ≠ 0 on
   disagreement. Verifies BOTH panels (§7c block then §7d block; the §7d
   regex accepts `(\{…\}|null)` and FAILs on a null emission). Verbatim
   estimator replica per `auspol-estimator-arms-race`'s convention
   (`est-console-backtest.mjs`): COPIED, not imported — any intentional
   estimator change must update the replica in the same commit. The §7d
   replica needs `ALT_BY` (altTpp keyed date|pollster) and the shared
   `POLL_BY_KEY` map built before it (since 61963fd: hoisted beside §7c's
   preamble — §7c's own fl derivation reads it too); the published-alt-TPP
   curve builder must run before the §7d block so the join has rows to
   read.
5. **`flows.mjs` `FLOW_TABLE`** — display-copy string
   ("the AEC's 2025-election flow table (TPP cut)"), interpolated by the
   panel's note so a future re-anchor can't leave the page describing
   yesterday's table. Also feeds `flowDrift.meta.table`.

## §7d — the Labor-v-One Nation twin panel (shipped 2026-09-07; frozen table flipped to first-principles 2026-09-09)

The same machinery re-run on the ALP-v-ON totals the same publication
prints (`altTpp.alpVsOnp_alp`, already a 0–100 share — NOT a fraction to
rebase). Every estimator piece is §7c's untouched — join, within-house
rebasing, monthWithSe/nowcastAdj pooling, wave-equal ridge with pooled
σ̂²w — cloned as a parallel block right after §7c with the constants
prefixed `FLOW_ON_*`. The differences are the ones the data forces:

- **The frozen table is FIRST-PRINCIPLES** (`FP_ON = {lnp 0.315, grn 0.89,
  oth 0.53}` fractions at gen-data.mjs ~:1566, with `FP_ON_BAND =
  {lnp 0.025, grn 0.03, oth 0.03}` the set's own ± range, stacked linearly
  into the band §7f's quoted figure carries): derived from the AEC 2025
  Senate ATL ballot counts, then the LNP cell was recalibrated 2026-09-11
  from 0.28 to 0.315 against the counted 2026 evidence — Antony Green's
  Secret Harbour preference analysis puts Coalition→Labor above 29.8 in a
  strong-ON seat (national figure must sit above it), and SA 2026's
  whole-state count ran ~33–34 to Labor at a March ON primary of 23.5%
  (the national ON primary has since firmed to ~27); ON-side shares
  Coal→ON 68.5 (66–71), GRN→ON 11 (8–14),
  others→ON 47 (44–50) carried ALP-side. No election ever counts a
  Labor-v-ON pairing, so there is no election anchor — `impliedOn(p) =
  p.alp + p.lnp·FP_ON.lnp + p.grn·FP_ON.grn + (ind+oth)·FP_ON.oth`.
  Chosen 2026-09-09 over RedBridge/Accent's respondent-allocated splits
  (`tpp_split_on` — the only published per-cohort allocation of the
  pairing, kept as the panel's measured RedBridge row below) because
  revealed, re-validated ballots beat a stated allocation with no count
  to anchor; the published head-to-heads stay the corroboration this
  panel monitors. This is the table the page QUOTES the pairing on
  (§7f's `impliedOnFp` hero figure); σ̂²w aside, the drift series is
  baseline-subtracted per house anyway, so a level offset costs nothing —
  only a table whose cohort mixes drift from the industry's would. Note
  the ON panel's design needs an LNP column (classic pairing folds LNP
  into the two-party share; this pairing doesn't), so the fitter's design
  is `[1, lnp, grn, ind+oth]` with f0 pointed at FP_ON.
- **Every house anchors on its own first-waves residual mean**
  (`FLOW_ON_BASE_MIN = 3`; `meta.baseFrom[firm]` = that wave date for all
  firms, `meta.anchor = null`). The drift curve's IDENTIFICATION is
  unaffected — each house's reading is centred on its own start
  regardless — only the implied-flows table rows are relative-to-FP_ON
  instead of absolute. gen-data prints per-house baseFrom
  lines; the panel copy states the first-waves anchoring outright (no
  conditional clause, since no firm can be election-anchored).
- RedBridge's measured row is the n-weighted mean of its own published
  splits (`tpp_split_on`, `FLOW_ON_PUB_MIN = 3`, `FLOW_ON_PUB_SD = 10`
  pure-count SE) — same m:1 provenance convention as §7c's measured row;
  the fits loop skips measured firms; the σ̂²w pool does not (≈0.95 pt²
  on current data — printed as ≈1 when it rounds there, not the
  `=== 1` fallback; the two look identical in the sanity line).
- **meta.pub carries the frozen table, not a fit**:
  `pub: { l: FP_ON.lnp×100, g: FP_ON.grn×100, t: FP_ON.oth×100 }` (r1),
  `pubSrc: "first-principles flow set"` — no `pubN` (there's no wave
  count behind a first-principles set). `meta.anchor = null`;
  `meta.baseFrom` maps each firm to its first-waves date.
- **`flowDriftOn = null` only when there is nothing to say** — the gate
  is `driftOnAnom.length ? {…} : null` (no joined ALP-v-ON head-to-head
  anomalies at all); the renderer returns null and nothing renders,
  absent-not-empty like every other optional series. flow-drift-check.mjs
  FAILs if the emitted `const flowDriftOn =` matches `null` while the
  replica has anomalies to report.
- Sanity anchors at the FP_ON flip (Sep 2026): 5 houses, 48 anomalies,
  now +0.2 ± 1.7 (n=6, nEff 4.1), last month 2026-09 +0.3 ± 2.4 (k=2);
  fits Roy Morgan l29.4/g95.1/t58.5 (n=17) and YouGov l36.1/g84.4/t66.2
  (n=17), SEs ±4.5–9.6; measured RedBridge row 34.2/90.8/64.2 ±4.5
  (n=5 published). Sanity echo: `flowDriftOn: 5 houses | now: …` plus
  `  flow fits (wave σ²w=0.95): pub("first-principles flow set") …`
  (post-flip there is no `FLOW_ON:` echo line — flip-era gen-data had
  `FLOW_ON: N published split waves …`).
- **Ship incident (a74e550 → repaired by dc02e64)**: the §7d shipping
  commit landed gen-data.mjs + the d1a1d215 renderer but STOPPED short of
  the rebuild — the committed 9f09dca2 data asset didn't export
  `flowDriftOn`, so main served a renderer reading a field its data
  layer lacked (harmless only because FlowDriftOnPanel null-guards;
  the ON panel simply never rendered live). Any gen-data change MUST
  land with the rebuilt data asset + index.html in the same commit —
  when a rebuild produces a fixed-name asset diff you didn't expect
  (`git diff .build/newtracker/assets/9f09dca2-*.js`), suspect exactly
  this half-committed prior commit and fold the debris in rather than
  reverting it.

## §7c construction (the arguments that make it defensible)

- **Join, not a new estimator**: `tppRows` (published, already
  share2pp-rebased for Essential's undecided-inclusive pairs) and
  `tppRowsSynth` (implied; full-primaries, sumNote-excluded) share
  `date|pollster` keys. Residual = published − implied per poll.
- **Baselines absorb method offsets**: a house's residual carries a fixed
  offset (allocation basis), so drift is identified only from WITHIN-house
  CHANGE. Each firm gets an n-weighted election-window baseline (residuals
  within 180 days of ELECTION.date, ≥3 polls); late-starting houses fall back
  to their first 3 waves and `meta.baseFrom[firm]` records which anchor was
  used (election date vs. a fallback wave date) — the panel's note renders a
  conditional clause naming those houses. The election is the one moment
  actual flows are counted, which is why it's the only defensible anchor.
- **Pool with NULL house effects**: anomalies (residual − own baseline) run
  through `monthWithSe(driftAnom, null, ym)` and `nowcastAdj(driftAnom, null,
  refNow)` — the firm baselines ARE the debias; `heV` already returns 0 for a
  null he object. Sanity anchors at ship (Sep 2026): 9 houses, 116 anomalies,
  now −0.9 ± 1.5, last month 2026-08 −0.9 ± 1.1; per-house baseFrom lines
  print from gen-data.
- **Payload shape**: `{months: [{ym,x,v,ci95,k}], now: {v,ci95,n,nEff},
  houses: {firm: [{ym,v}] n-weighted monthly means, ragged}, meta: {table,
  baseDays, anchor, baseFrom, houses, aec}, polls}` — `polls` added
  2026-10-05: one dot per published wave `{x: dx(date), v: r1(anomaly),
  pollster, dateLabel, released, sample}` (display-only, from driftAnom +
  POLL_BY_KEY; flowDriftOn mirrors it), driving per-wave hover tooltips and
  click-to-open on the drift charts like every other chart's poll cloud.

## Implied-flows table (added 2026-09, under the drift chart)

First row = the frozen 2025 election flows (`meta.aec`, derived from `FLOW`
in flows.mjs — never hardcoded, so a re-anchor moves the row); one row per
house = that house's IMPLIED flows with a `±`1σ margin per cell, rendered
by `FlowDriftPanel` as `.flow-tab-wrap > table.flow-tab` (AEC row =
`tr.flow-tab-aec`, label "2025 election outcome (AEC)", waves cell "–";
`.flow-tab-se` styles the ± suffix, `--ink-faint` 12.5px) with a
`.flow-tab-note` under it. CSS family `.flow-tab*` lives in
template.html's flow-drift section before the `.ap-wrap` archive-ledger
rules; tracks `.poll-table` conventions. `.flow-tab-wrap` MUST keep its
`overflow-x: auto` (added dc02e64, 2026-09-07): shipped without it, the
~534px min-content table widened the document to ~550px on phones,
exposing the html-level line-art down a right gutter top-to-bottom —
diagnosis recipe and the wrapper-overflow convention live in
`auspol-mobile-overflow-probe`. The thead is NOT sticky so the
containing-block side effect doesn't apply here (unlike the archive
ledger — see the template comment after `.flow-tab-note`).

- **Fitter (gen-data §7c, after `driftAnom`): wave-equal ridge SHRUNK
  TOWARD THE ELECTION TABLE.** Rows: same joined filter as the residuals
  (`tpp_alp/alp/lnp/grn/onp != null && !sumNote`); y = `share2pp(p) −
  p.alp`; design `[1, grn, onp, ind+oth]` with UNIT weight per wave (the
  residual noise is poll-to-poll, not sampling). Constants
  `FLOW_FIT_MIN = 6`, `FLOW_FIT_TAU = 0.12` (prior SD per share),
  `FLOW_FIT_TAU_INT = 0.05` (intercept, prior mean 0). `flowDesign`
  accumulates X'X/X'y; `flow4Solve` = 4×4 Gaussian elimination + partial
  pivoting on COPIES (caller arrays preserved — the covariance pass needs
  the design afterwards); `flow4Inv` = Gauss-Jordan; `flowRidge` solves
  (X'X+Λ)f = X'y+Λf0 with Λ = diag(σ̂²w/τ_int², σ̂²w/τ² ×3) and
  f0 = [0, FLOW.grn/onp/oth]. σ̂²w is df-POOLED wave-residual variance
  across houses (≈0.88pt², df 79 at ship) — a per-house σ̂ let Newspoll's
  near-interpolating 8-wave fit claim σ≈0.16pt and keep an absurd slope.
  Emitted: `{firm, g, ge, o, oe, t, te, n}` (percent, r1; betas clamp01 as
  a seatbelt, all interior on current data). Posterior SEs =
  σ̂w·diag((X'X+Λ)⁻¹)½.
- **Why shrinkage replaced the boxed WLS (shipped and retired same day,
  2026-09-07):** within a house each primary moves only ±1–2pts and the
  columns co-move, so the three shares are barely identified — Newspoll
  (8 waves, GRN stuck 11–13) fitted g=106 unconstrained and the box PINNED
  it at 100, which read in the table as a factual claim; Roy Morgan
  (n=44, but RESPONDENT-ALLOCATED 2PP — no fixed house-flow constant
  exists for the regression to recover; their waves' implied minor-pref
  total sits ~1–2pts over the election table, i.e. true Greens flows
  ~80s) landed in a flat g/t valley at 55/79 vs the election 88/55.
  Meanwhile n-weighting treated 44 polls as iid draws and printed false
  ±0.2–1.4pt SEs. The ridge makes "the waves can't tell" read as ≈the
  election row instead of an exploded cell. (The generalised
  flat-series-regression lesson — including the λ-in-normal-equations
  and pooled-σ̂ traps — lives in `regression-on-flat-series`.)
- **Payload**: `flowDrift.flows` + `flowDrift.meta.aec = {g, o, t}`.
  flow-drift-check.mjs replicates the block VERBATIM (constants included)
  and eq-compares both fields — update the replica in the same commit.
  Diagnosis diagnostics + candidate-fit comparison were worked up in
  .matilda/flow-fit-probe.mjs (local scratch, gitignored like all
  .matilda scripts).
- Sanity at ridge ship (Sep 2026), 6 fits: Essential 85.7/23/45.2 (n=10)
  · Newspoll 89.8/24.4/54.6 (8) · RedBridge-Accent 94.4/19.6/52.8 (14) ·
  Resolve 89.3/30.6/49.3 (10) · Roy Morgan 79.1/30.8/67.7 (44) ·
  YouGov 88.9/24.4/57.9 (17); SEs ±2.3–9.5; AEC row 88.2/25.5/54.6.
- Note copy commitments: the shrunk-toward-the-election-row explanation
  (qualified "every FITTED cell" since the measured row shipped),
  ± = one standard error, the respondent-allocation caveat naming BOTH
  Roy Morgan AND RedBridge/Accent, the measured-row explanation below,
  the waves minimums, and the diagnostic-only closer. Both houses'
  headline 2PPs are respondent-allocated (RedBridge's tpp_alp = Table 2's
  respondent column; its 2025-flows variant rides tpp_flows like
  Morgan's — see redbridge-accent-extraction).

## Measured row replaces the fit (shipped 2026-09-07, same session as tpp_split)

A house that PRINTS its respondent allocation each wave gets no fit row:
the measured term average of its own published splits answers the same
question directly. Built before the fits loop so the loop can skip the
firm; push-then-sort keeps the alphabetical order.

- **Input**: polls.json `tpp_split: {grn, onp, oth}` (ALP shares,
  RedBridge/Accent only for now, parsed from report Table 1 — see
  redbridge-accent-extraction). `FLOW_PUB_MIN = 3` published waves.
- **Row**: n-weighted sample-weighted mean per bucket (w = `sample`),
  pure-count SE `FLOW_PUB_SD·√(Σw²)/Σw` with `FLOW_PUB_SD = 10` pts
  (declared per-wave SD; ≈±4.1 at 6 equal waves — NOT a regression SE,
  and deliberately wider than the empirical wave SD ~4.5 so true drift
  reads inside it). Emitted `{firm, g,ge, o,oe, t,te, n, m:1}` — **m:1
  is the provenance marker**: renderer shows `{f.n} published` in the
  waves cell (header renamed "Waves fit" → "Waves"), note copy explains
  "its row is no fit at all – it averages the house's own published
  splits … marked “published”".
- **RedBridge numbers at ship**: 85.5 ±4.1 / 20.5 ±4.1 / 58.3 ±4.1 (n=6
  published). The PRE-measured fitted row was 94.4±8.3 / 19.6±2.9 /
  52.8±6.7 — within ~1σ on all three even though they look far apart
  (g/t trade off through the co-moving primaries); the Aug-2026 wave
  (78/17/50) is RedBridge's LOWEST-Greens-flow wave, so
  fitted-term-constant vs latest-published-wave looked like a bigger
  disagreement than it ever was. Ignore the stale fit numbers in older
  notes; the measured row is canonical.
- **`flow-drift-check.mjs` replicates the block VERBATIM** (consts
  included) — same update-in-the-same-commit rule as the ridge.
- σ̂²w pool UNCHANGED: the fits loop skips measured firms but the σ̂²w
  block above it does not — RedBridge's 14 waves still contribute to the
  pooled wave-noise estimate (though on current data the difference is
  immaterial, σ̂²w ≈ 0.78–0.88 either way).

## The pq-passthrough fix (general estimator gotcha — not flow-specific)

`weightedWithSe`'s `seFloor` reads per-point `pq` and falls back to
`(mean/100)·(1−mean/100)·1e4` — correct for a SHARE, but a DIFFERENCE series
can sit at mean ≈ −0.9, giving p(1−p) < 0 → `sqrt(negative)` → NaN, which
`JSON.stringify` writes as `null` (first deploy shipped `ci95: null`
quietly). Fix is three-part: (1) each residual row carries `pq` computed from
the PUBLISHED share before x is overwritten
(`pq: (r.x/100)·(1−r.x/100)·1e4, x: r.x − imp`); (2) `nowcastAdj`'s
pts.push now forwards `...(a.pq != null ? { pq: a.pq } : {})`; (3)
`monthWithSe`'s rows.map forwards `...(r.pq != null ? { pq: r.pq } : {})`.
Any future series that isn't a share must forward its own pq the same way —
the check is whether the fallback share-scale variance is meaningful for it.

## FlowDriftPanel renderer (reuses HouseLeanPanel chrome wholesale)

- Pooled ink line width 3 (series id `"Pooled, all houses"`); per-house
  width-1.5 opacity-0.4 faint lines via `houseLeanColour(f)`; hidden-chip
  opacity toggling; chips read the FULL series (lean-panel consistency rule).
- Per-wave dots (2026-10-05): `fd.polls` → one scatter dot per published
  wave at the wave's own x/anomaly in `houseLeanColour(f)` (label "Drift",
  meta straight from the payload — pollster/dateLabel/sample/released), so
  hover shows the standard poll tooltip and click opens the wave in All
  polls (`pollFacet="twopp"`). Dots filter out with the house's hidden
  chip and feed `vals` for fitDomain.
- CI ribbon via TrendChart `areas=[{id, color:"var(--ink-faint)", opacity:0.18,
  points:[{x,y0,y1}]}]` — VariancePanel floor-ribbon precedent; dropped when
  the pooled series is hidden. Ground halves via `bands` className slot
  (`flow-band-alp` above zero / `flow-band-lnp` below) sharing the lean
  theme vars. Zero refLine; fitDomain seeded so 0 is strictly inside.
- Full-MONTHS spine; `useNarrow()`; non-narrow height 340 (HouseLeanPanel is
  300 — see `auspol-chart-sizing` for the viewBox derivation).
- Glossary link: existing term `openTerm("preference-flows", …)` — do NOT
  create a new glossary term; the "preference-flows" and "implied-2pp"
  entries already exist (~:4302 and :4379 in the asset).
- The jump-pill "Jump to flow drift" needs the facet-switch dance: the panel
  exists only on twopp, so `jumpToFlow` switches facet to twopp first and a
  `React.useEffect` on facet performs the scroll after the remount (mirrors
  `jumpToLean`; see `auspol-archive-jump-links`).
- Note copy commitments: the sign convention, per-house baseline sentence,
  the irregular-2PP caveat ("a wave that publishes no two-party figure
  carries no gap…"), and the diagnostic-only disclaimer. Do NOT reintroduce
  per-house unverifiable claims (an earlier draft asserted "most of
  Newspoll's and Resolve's output has no 2PP" — unverifiable in-repo and
  wrong; both houses appear in the series). Guard the pooled chip's ci95 with
  `fd.now.ci95 != null` — ci95 can regress to null if a future data change
  reintroduces degenerate variance.

## RdFlowChart (All-polls detail flow chart) — the ±3.5 scale and the ±3.4 clamp contract

`RdFlowChart` in rd-allpolls.jsx (~:2987) draws the detail view's two
`.rd-fl-one` halves ("Against the Coalition …" / "Against One Nation …",
mounted at #flow-drift ~:3185/3196) on ONE hand-rolled fixed scale —
values NEVER drive the domain: `Y = zero − (v/3.5)·(zero−top)`, plot
bottom bot=214 (178 phone) ↔ −3.5, and everything drawn must be clamped
before it calls `Y`:

- house dots, wave dots and the per-house pick line: **±3.4**;
- the CI band and the "Now" whisker: **±3.5** (they may touch the rails);
- the monthly line, its r-3 end dot and the hover end dot: **±3.4**
  (shipped 2026-10-05 — they were UNclamped, and October 2026, the first
  month ever outside the scale at −4.7 on RedBridge's 2 Oct wave, drew the
  line end at y≈248 — through the baseline and into the tick labels,
  reading as a point BELOW the ±3.4-clamped RedBridge wave dot).

The clamp is DISPLAY-only: every tooltip (monthly "All pollsters" tip and
the wave-dot tip) reports the true unclamped figure. Keep the comment on
the line (`{/* the line and its end dots obey the dots' ±3.4 clamp … */}`)
with the clamps. Probe: `.matilda/probe-flow-line-clamp.mjs` asserts the
line/end dots never cross the baseline, the last-month end dot sits on the
lowest wave dot's row, and the October tooltip still reads −4.7. A dot at
the last month's x can shadow the monthly hover in a probe — the wave
hit-target wins the tip (`hv && !tip`), so walk the pointer column to an
x-off-dot row before asserting the monthly tip.

## RdFlowChart — the hit-shadow contract (painted-over layers are click-through)

Shipped 2026-10-05 (user: "if the poll dots line up with the month line
they are not selectable by hover"). The wave dots' `.rd-apd-hit` circles
(r=8) are painted BEFORE the month line, end dots, pick line, guide and
axis — each default `pointer-events: visiblePainted` — so a dot sitting on
any of them kept its pixels dead to `onPointerEnter` (the svg's month
`onMouseMove` answered instead). Baseline: 9 of 177 hit circles shadowed
at centre (7 by `.rd-fl-line`, 2 by the `.rd-fl-enddot` over the clamped
RedBridge 2 Oct rail dot). Fix in rd.css: `pointer-events: none` scoped
`.rd-fl-chart` on `.rd-fl-line`, `.rd-fl-enddot`, `.rd-fl-pick`,
`.rd-dis-guide`, `.rd-dis-base`, `.rd-fl-note`, `.rd-fl-empty` — display
only there (the month hover comes from the svg's own handler; nothing
needs pointer events on those layers). Rule: anything rdAllpolls adds
above the hit circles joins the list; anything that needs a pointer goes
BENEATH the polls map or stays interactive. `rd-dis-*` scoping keeps the
discord panel's own guide/base untouched. In a dense clump a later-painted
neighbour's r=8 circle legitimately wins the centre (any wave tip is
correct) — the contract is only "never the month tip, never nothing".
Pinned by `.matilda/probe-flow-drift-dots.mjs` (static: every hit circle's
centre resolves to a `.rd-apd-hit`; hover: every centre raises a wave
tip).

## Respondent-allocated flow to Labor on the tooltips (shipped 61963fd, 2026-10-05)

User request ("can u include in those tooltips percent respondent-allocated
flow to labor", carried as "Flow share to Labor" on BOTH tip types — the
wave dots and the house month-vertex hit rings).

- **Formula** (`flowToAlp(pairA, own, other)` in gen-data.mjs after
  `FLOW_BASE_MIN`): `(pairA − own) / (100 − own − other) × 100`, null when
  either primary is absent or `100 − own − other ≤ 0.5`. §7c feeds it
  `(r.x, p.alp, p.lnp)`; §7d `(v.ao, p.alp, p.onp)`. It answers "of the
  non-major respondent-allocated preferences this wave published, what
  share went to Labor" — a wave-level figure, independent of the frozen
  table, for any house with full primaries.
- **Payload**: `fl` rides residuals → anomalies → (a) each `polls` dot as
  `r1(fl)` spread CONDITIONALLY (`...(r.fl != null ? {fl: …} : {})`) after
  `sample` so eq()'s key-order-sensitive JSON stays stable; (b) each
  houses-month row as the n-weighted mean over the month's fl-carrying
  waves, also conditional. flows rows do NOT carry fl.
- **Renderer**: rd-allpolls.jsx RdFlowChart — wave-dot tip row "Respondent
  flow to Labor" `{d.fl.toFixed(1)}%` under "Published minus implied";
  vertex tip row under "House drift"; both hit circles' aria-labels append
  ", respondent-allocated flow to Labor X.X percent".
- **checker**: flow-drift-check.mjs replicates the formula; `POLL_BY_KEY`
  was hoisted beside §7c's preamble (§7d then shares it; `ALT_BY` stays
  §7d-local) so fl can be derived inside `driftResid`. The checker eq()
  never compares houses-month objects, so ONLY the poll-dot fl needs the
  verbatim replica — that asymmetry is documented in a check-file comment;
  if eq() ever starts comparing months, mirror the mean too.
- **probe** (gitignored `.matilda/probe-flow-drift-dots.mjs`: every wave
  tip's fl row matches its payload fl to a decimal (or the row is absent
  exactly when payload fl is null); every STRICT vertex win's fl row
  matches the month-payload fl. Vertex ym is parsed off the tip's Month
  row — `rdMonthYear` (rd.jsx) emits FULL month names ("October 2026"), so
  month-name → zero-padded `YYYY-MM` is the parse; if that format ever
  abbreviates the probe's month-name array must follow.
- Baseline: waves with null fl are normal — any house whose own/rival
  primaries are absent or sum past 99.5 fails the formula's gate by
  design; tips on those waves simply omit the row. 2026-10-05 run:
  all-green including 39/17 strict vertex wins.

## Per-house month marks — painted dots REMOVED, invisible hover stays (2026-10-05)

The chart's per-house monthly gaps (109 across the two halves, exact
month-column x) rendered as `.rd-fl-hdot` circles sized like poll dots —
there is NO per-house polyline, the dots WERE the house representation.
Two user calls on 2026-10-05: first "all dots are ringed except ones i
cannot hover over" (shipped 9e523bf — each vertex got an invisible r=8
`.rd-fl-vhit` hit ring with the house+month+drift tip); then "what's the
point of a dot for that — doesn't it only serve to confuse" → the user
picked "Remove the dots": the painted `.rd-fl-hdot` circles, their `.on`/
`.off` pick styling and the "One pollster's gap that month" keydot key
item are GONE; the invisible hit rings stay (tip sub: "this pollster's
gap that month – not a published wave"), and the key line gained a
swatchless hint "Each pollster's own gap – hover its month spot to read".
Probes scope wave queries with `:not(.rd-fl-vhit)` so the two ring
populations never confuse each other; the dense-clump rule applies (a
later-painted wave ring or a neighbour house's ring may win a shared
centre — vertex tips are proven by strict-count), and clicking a vertex
must never open a poll. The diag page rings the vhit marks magenta and
names them MONTH MARK.

## RdFlowChart tips follow the cross-chart tooltip idiom (shipped d262781, 2026-10-05)

User report 2026-10-05: "the tooltip implementation isn't the same as in
the 2pp chart — tapping away from an open tooltip on phone does not close
it; on phone it says 'Open in all polls' which the 2pp chart doesn't show
(and the button doesn't even work on phone); on laptop it says 'Click to
open this poll in All polls', not just 'Click to open this poll', and in
a different colour". RdFlowChart's tip JSX had drifted from the standard
idiom in four ways; all fixed in rd-allpolls.jsx:

1. **Dismiss-outside**: the chart root carries `ref={chartBox}` and
   `window.useDismissOutside(chartBox, !!(tip && tip.src === "touch"),
   () => setTip(null))` — the same ed2260de hook TrendChart wires at its
   own root. A touch-opened tip now closes on any pointerdown outside the
   chart. The hook is armed on touch-src tips only (mouse tips close on
   leave, as elsewhere).
2. **Hint element**: the hint is the standard bare `<div className=
   "tip-hint">`. It WAS a `<span className="tip-sub tip-hint">` — the
   `.tip-sub` rule (template.html:1696) is defined AFTER `.tip-hint`
   (:1674), so it overrode `--accent` with `--ink-3` and the hint
   rendered grey. Never stack `tip-sub` on `tip-hint`; the cascade
   order makes tip-sub win the colour.
3. **No hint on touch**: gated `{k && tip.src !== "touch" && …}` like
   rd-panels/rd-polls — a touch tap READS a dot (the click branch
   toggles the tip; it never navigates), which is exactly why the
   "Open in all polls" affordance "didn't work" on phone. Standard
   text: `tip.src === "focus" ? "Press Enter to open this poll in
   All polls" : "Click to open this poll in All polls"`.
4. Vertex tips carry NO hint — their sub-line ("this pollster's gap
   that month – not a published wave") is a qualifier, not an action.

Probe: `.matilda/probe-flow-drift-dots.mjs`'s touch block (phone
viewport 390×780 isTouch, `touchscreen.tap` a wave `.rd-apd-hit`) asserts
a touch-opened tip has NO `.tip-hint` and that a second tap outside the
chart dismisses it; the desktop wave-hint check expects the standard
"Click to open this poll in All polls" text.

## RdFlowChart tips clamp INSIDE THE CHART BOX (shipped 07bba15, 2026-10-06)

User report 2026-10-06: "some tooltips on phone open over edge of phone
screen". The three rd-fl-tip renders (`hv` month tip, vertex tip,
wave-dot tip) used a STATIC x clamp (`style={{ left: Math.min(W - 110,
Math.max(110, px)) }}`) that assumed a tip half-width ≤110px but never
measured the mounted card; the vertex qualifier line ("this pollster's
gap that month – not a published wave") makes the card ~293px wide (half
~147), so early-month vertex tips opened ~17px past the LEFT edge of a
390px phone (right-edge dots symmetric).

The fix keeps the RdAp detail charts' MEASURED idiom (shared `tipBox`
ref + `React.useLayoutEffect([tip, hv])` + marginLeft shift) but clamps
against the CHART'S OWN `getBoundingClientRect()` (±8px margins), NOT
`window.innerWidth` — the innerWidth variant of the idiom fails on
phones: an overhanging absolutely-positioned tip widens the page's
scrollable overflow, Chrome mobile's overview layout responds by
EXPANDING the layout viewport (debug probe measured innerWidth growing
390→413 to fit the open tip), so a viewport-anchored clamp chases a
moving target, never converges, and the user watches the whole page
zoom out while the tip reads. `.rd-fl-chart` is a width:auto block that
never reads its own overflow, so its rect is stable while the tip
mounts and measures. The static clamp is GONE from the style props —
tips place at raw `X(hv.ym)` / `px` and the effect re-anchors.

Pin probe (gitignored) `.matilda/probe-flow-tip-overflow.mjs`,
BASE=<built tree>: phone rung (390×780 isMobile/hasTouch) taps every
near-edge wave + vertex ring (170px/100px edge windows) in BOTH halves
and asserts each open tip's rect inside [0, innerWidth]; desktop rung
hovers the same rings plus extreme month-guide columns. Phone sweep
mechanics that cost three probe rewrites: recentre EACH half
(`scrollIntoView {block:"center"}`) immediately before collecting THAT
half's targets — rings sitting below the viewport are `elementFromPoint`
NULL and a CDP tap there hits document.body (the documented touchend
page-turn trap again); and dismiss each opened touch tip (synthetic
bubbling `pointerdown` on `document.body`) before the next tap, or a
clumped second tap TOGGLES the already-open tip closed and reads as a
product no-op. Post-fix phone tips live in [28, 362] of 390 with widest
cards 293px (vertex) / 231px (wave).

## Touch hover pollution + top-edge clamp (shipped f69254c, 2026-10-06)

Two follow-up defects surfaced the same day on the user's phone, both pinned
by the new gitignored probe `.matilda/probe-flow-tip-close.mjs`:

1. **"Close weirdly / one frame / not smooth like the 2PP chart"** —
   a touch tap raises COMPAT mouse events (mousemove→…→click). The svg's
   `onMouseMove` had no pointer-type guard, so tap 1 seeded the month-hover
   `hv` *behind* the open tip; on dismiss or toggle-close the commit
   rendered `{hv && !tip && month-guide}`, swapping the wave card for the
   narrow month card (guide line included). That also produced the
   user's "second press falls within the screen": the second press closed
   the wave tip and the NARROW month card appeared in its place — they
   were comparing two different tip TYPES. (An out-tap that lands inside
   the svg cleared nothing; one landing outside the svg fired mouseout →
   hv cleared → why it looked "sometimes".) Fix: the svg hover runs
   through `onPointerMove` gated `ev.pointerType === "mouse"` (compat
   mousemoves never surface as pointer events; touch pointermoves carry
   pointerType touch — same gate the hit circles already used on enter),
   and `useDismissOutside`'s callback clears hv with the tip. LESSON:
   whenever a chart shows a touch-opened tip AND a hover-only auxiliary
   card, gate the hover to a real mouse or the aux card becomes the
   dismiss stutter.
2. **"First press opens over the edge of the screen" (the TOP edge)** —
   the card hangs UP from `top:-6px; translate(-50%,-100%)`; with the
   chart fresh-scrolled to the viewport top (the classic first-press
   shape) a tall card (~150px) opened −56/−59px ABOVE the screen. The
   measured layout effect now also slides the tip DOWN until its top
   clears **78px** — the site's 72px sticky-bar scroll-margin + 6 —
   using viewport-relative box coords, which are stable vertically
   (vertical overhang never widens the mobile layout viewport).

Probe traps that cost extra runs: a tap at viewport y < ~72 hits the
STICKY TAB BAR and switches the facet (unpicks the run) — filter tap
targets to cy ≥ 80 and park the svg top at 76px with a 3-pass
`scrollBy` helper; a "hover open chart" desktop spot needs no hit circle
within 18px or it lands on a wave dot; the out-tap target point must be
OUTSIDE the svg for mouseout-clear (inside-svg out-taps are exactly the
hv-persistence repro). Desktop mouse flow pinned unchanged (month tip on
hover, wave swap, mouse-out clear).

## X clamp IN RENDER — the tipW idiom (shipped 92fc5f4, 2026-10-06; supersedes f69254c's marginLeft clamp)

The dot-to-dot overflow survived TWO earlier fixes (07bba15, f69254c)
because both clamped after commit: `getBoundingClientRect()` on the mounted
tip, then a `marginLeft` correction. `.tip` glides `left` .15s
(template.html:1616) and React reuses the tip DOM node across a
dot-to-dot swap, so the measure read the rect at the glide's START (the
OLD dot's position) → off=0, "in bounds" → the card glided to the
unclamped new `left`, 50–90px past the screen edge on the user's repro
(mid chart → far-right Essential dot; mid → far-left). Probes missed it
because they dismissed between taps (fresh mounts, no glide to measure
mid-flight); the user never dismisses.

The durable answer is TrendChart's `tipW` idiom (08b413e7:481-509,
:940-960) — the user themselves pointed at it: **the layout effect
measures ONLY the tip's WIDTH into state; the clamp is computed IN
RENDER from that width**, so it holds on every frame of the glide instead
of once against a stale position. In RdFlowChart: `FLOW_TIP_HALF =
{ m: 90, w: 125, v: 155 }` first-paint fallbacks, `tipWs[kind]` measured
widths, `tipLeft(kind, px) = min(W-8-h, max(8+h, px))` with the
half-width capped at `W/2-8`; all three renders left: tipLeft(...); the
layout effect keeps only width-measure + the 78px TOP clamp (safe: tips
glide in x, never in y). GENERAL LESSON: never x-clamp a gliding element
post-commit from its rect — the rect you measure is where the glide
STARTED, not where it ends. Measure the INVARIANT (width) in the effect,
clamp the rendered style. Probe section (c) tracks the tip rect across
~12 frames of the glide (30ms samples) with NO dismiss between taps.

## Check script traps

- `.mjs` already implies ESM — run `node .build/flow-drift-check.mjs`; the
  flow-validate shebang (`env -S node --input-type=module`) only matters for
  direct execution.
- `new URL("..", import.meta.url)` has NO trailing slash → resolves to the
  parent of `.build/`, not repo root; use `new URL("../", import.meta.url)`
  and prefix `.build/newtracker/…` inside.
