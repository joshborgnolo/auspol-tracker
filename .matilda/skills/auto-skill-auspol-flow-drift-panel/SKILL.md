---
name: auspol-flow-drift-panel
description: "auspol-tracker — the Preference-flow drift panel end-to-end (shipped 2026-09-07): gen-data §7c flowDrift block (~:1224-1310) = per-poll residual (share2pp published 2PP − flows.mjs implied 2PP on the same primaries), election-anchored per-house 180-day baselines, anomalies pooled through monthWithSe/nowcastAdj with NULL house effects; FlowDriftPanel in the d1a1d215 asset mounted on the All-polls 2PP facet after HouseLeanPanel; .ap-flow/.flow-band-* CSS reuses --lean-*-bg vars; .build/flow-drift-check.mjs is the committed verbatim-replica verification script. Includes the pq-passthrough fix to nowcastAdj/monthWithSe (difference series need per-row pq — the share-scale fallback produces p(1−p)<0 and ci95 nulls to NaN→null). Diagnostic-only by design: corrects no other figure."
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
   HouseLeanPanel's closing `}`, before AllPollsView) + mount line
   `{facet === "twopp" && <FlowDriftPanel rangeId={range} />}` after the
   HouseLeanPanel mount.
3. **`template.html`** — `.ap-flow` frame (mirrors `.ap-lean`),
   `.flow-band-alp`/`.flow-band-lnp` fills (reuse `--lean-alp-bg`/
   `--lean-lnp-bg`), `.ap-flow` added to the
   `.ap-var, .ap-lean, .ap-flow, .acc-card { scroll-margin-top: 72px }` rule.
4. **`.build/flow-drift-check.mjs`** — independent re-derivation from
   data/polls.json compared against the emitted payload; exit ≠ 0 on
   disagreement. Verbatim estimator replica per
   `auspol-estimator-arms-race`'s convention (`est-console-backtest.mjs`):
   COPIED, not imported — any intentional estimator change must update the
   replica in the same commit.
5. **`flows.mjs` `FLOW_TABLE`** — display-copy string
   ("the AEC's 2025-election flow table (TPP cut)"), interpolated by the
   panel's note so a future re-anchor can't leave the page describing
   yesterday's table. Also feeds `flowDrift.meta.table`.

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
  baseDays, anchor, baseFrom, houses, aec}, flows}` — `flows`/`meta.aec`
  added 2026-09 with the implied-flows table (next section).

## Implied-flows table (added 2026-09, under the drift chart)

First row = the frozen 2025 election flows (`meta.aec`, derived from `FLOW`
in flows.mjs — never hardcoded, so a re-anchor moves the row); one row per
house = that house's IMPLIED flows with a `±`1σ margin per cell, rendered
by `FlowDriftPanel` as `.flow-tab-wrap > table.flow-tab` (AEC row =
`tr.flow-tab-aec`, label "2025 election outcome (AEC)", waves cell "–";
`.flow-tab-se` styles the ± suffix, `--ink-faint` 12.5px) with a
`.flow-tab-note` under it. CSS family `.flow-tab*` lives in
template.html's flow-drift section before the `.ap-wrap` archive-ledger
rules; tracks `.poll-table` conventions.

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
- Note copy commitments: the shrunk-toward-the-election-row explanation,
  ± = one standard error, the respondent-allocation caveat naming BOTH
  Roy Morgan AND RedBridge/Accent ("their rows track a moving allocation
  rather than fixed assumptions"), the six-waves minimum, and the
  diagnostic-only closer. Both houses' headline 2PPs are
  respondent-allocated (RedBridge's tpp_alp = Table 2's respondent
  column; its 2025-flows variant rides tpp_flows like Morgan's — see
  redbridge-accent-extraction). RedBridge also PRINTS its split each wave
  (report Table 1, per first preference), so the copy adds "RedBridge
  publishes that allocation beside each wave … its row here is the term
  average, not any one wave's split". Sanity: RedBridge's published Table-1
  means Feb–Aug 2026 = Greens 85.5 / ON 20.5 / Other 58.3 to Labor —
  the fitted row (94.4±8.3 / 19.6±2.9 / 52.8±6.7) sits within ~1σ on all
  three (g/t trade off through the co-moving primaries); the Aug-2026 wave
  (78/17/50) is their LOWEST-Greens-flow wave, so fitted-term-constant vs
  latest-published-wave looks like a bigger disagreement than it is. A
  future option: for houses that publish the split, show the measured
  mean instead of the fit (needs a per-poll published-split datapoint —
  auspol-extra-datapoint-pipeline).

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

## Check script traps

- `.mjs` already implies ESM — run `node .build/flow-drift-check.mjs`; the
  flow-validate shebang (`env -S node --input-type=module`) only matters for
  direct execution.
- `new URL("..", import.meta.url)` has NO trailing slash → resolves to the
  parent of `.build/`, not repo root; use `new URL("../", import.meta.url)`
  and prefix `.build/newtracker/…` inside.
