---
name: auspol-wv-income-tab
description: auspol-tracker — the Who-votes Income tab end-to-end in its CURRENT latent-curve form (5e043b7f, 2026-10-16, replacing 8acacb93's naive extreme-band tilts shipped earlier the same day; style fixes 5c97fbaf and ff968095 still stand; naming pass 4c724259 same day): per wave and party, a census-share-weighted least-squares vote-share line over the electorate's income-QUANTILE axis (brackets mapped through data/income-dist.json), read at two standard bands (bottom half, top 15%+) — INCOME_GRIDS/incomeQuantiles/incomeFit/INCOME_STD_BANDS in demo-groups.mjs, incomeStandardise + JUR-gated INCOME_DIST in gen-data §7g-income, the support no-extrapolation gate, the separate demoIncome payload (rule 5), copy homes, roster-vs-window triage, the cross-house discrepancy audit (tilts + findings), the bands in dollars, why top 15%, the naming contract after 4c724259 (canonical group IS "Lower earners (bottom 50%)"/"Higher earners (top 15%)"; the pill names each house's household/personal income basis; the .rd-wv label column is 200px priced off the longest label; the probes price themselves off INCOME_STD_BANDS), and the earner rows' cut-off parenthetical (aedd5ae8: incomeEdge + bare/pct/cuts emit + rd-panels' RdIncomeCut - RdGenBorn's twin, hover switches, tap stays, phone HH/income-drop rungs - phone alignment 67e4cac0), and the bands pill's final clause typography (f7592cff/90958cd7: middot in-clause, between-clause ";" as :not(:last-child)::after, colon-led clauses with compact < / >= brackets - gen-data bandLabel compacts "Under $X" and "$X+"/"or more").
source: auto-skill
extracted_at: '2026-10-16T00:00:00.000Z'
updated_at: '2026-10-16'
---

# auspol-tracker: the Who-votes Income tab (sixth tab of RdDemographics)

User-ordered redesign 2026-10-16 (`5e043b7f` — "make that principled fix"
after a mathematical-design critique of the naive pooling). Same-day
lineage: `8acacb93` shipped the tab on naive extreme-bracket tilts,
`5c97fbaf`/`ff968095` fixed and moved the sethead pill, then `5e043b7f`
replaced the pooling maths; only the maths moved, the shell survived.
Later same-day: `aedd5ae8` (earner cut-off parenthetical + RdIncomeCut),
`67e4cac0` (tapped-cut phone alignment — UA `text-align: center` on
buttons was centring wrapped cut clauses), `f7592cff`/`90958cd7` (the
bands pill's final typography below).

## Why income can't be a harmonised tab

The other five tabs harmonise group labels across houses ("Men",
"University", "Mortgage"…). Income can't — `demo-groups.mjs:63` ("Income is
the ruled-out cut"): no two houses share cut points (YouGov household
<$100k/$100k+, binary since Apr 2026, four buckets before; DemosAU *personal*
<$45k/$45–125k/$125k+; Newspoll quarterly four; RedBridge weekly; Freshwater
$75–150k; Resolve and Morgan print none). Even a Newspoll↔YouGov pairwise
merge would need printed bracket bases, which Newspoll's quarterly tables
PDFs don't publish — a merged level would be an estimate, so income joins no
common group ("ruling of 2026-10-07, confirmed 2026-10-10").

## The design: meet on the quantile axis, not on common labels

All pure machinery lives at the end of `.build/newtracker/demo-groups.mjs`:

- **`INCOME_GRIDS`** — per income-printing house: `{basis, variants}` where
  basis is `household` (YouGov, Newspoll, RedBridge-weekly, Freshwater) or
  `personal` (DemosAU, DemosAU (MRP)); each variant is the era's ordered
  `[storedKey, lowerEdgeAnnual$k]` cells, closing edge = next cell's edge,
  last cell open. A house that re-schemes (YouGov Apr 2026) gets a NEW
  variant — a wave matches a variant only on that variant's own keys, so
  eras never mix. RedBridge converts at 52.1429 wk/yr; its "Prefer not to
  say" cell joins no grid.
- **`incomeQuantiles(house, dist)`** — maps every variant's cells to
  `{key, qLo, qHi, qMid, sh}` through the national census histogram:
  edge $k → weekly 2021 dollars via `edgeK*1000/weeksPerYear/aweRatio`,
  uniform interpolation inside histogram bands, saturation to q=1 at/above
  the open top band. Verified landings: YouGov binary cut at q≈0.464
  (median household income ≈ its $100k cut — the expected small gap the
  tilt machinery absorbs); Newspoll/Newspoll-era-YouGov edges
  0.227/0.464/0.655; DemosAU 0.458/0.865; MRP …0.954.
- **`incomeFit(cells, dim)`** — per PARTY present, one WLS line over
  {mid-quantile → vote share}, weights = each cell's census electorate
  share. Requires ≥2 cells with the party printed (one point pins no
  slope → null). Returns `{fits, support}`; support is the party's own
  printed interval, so a party missing cells is never extrapolated
  (YouGov's Feb-2026 top-pair-only wave reads NOTHING at the Lower band).
  2-cell layouts recover the exact line through both cell midpoints.
- **`incomeEdge(basis, share, dist)`** (added aedd5ae8, 2026-10-16) — the
  INVERSE of incomeQuantiles' qOf: walk cumulative mass to the share,
  interpolate uniformly inside the histogram band, return
  `Math.round(w × weeksPerYear × aweRatio / 1000)`; **null in the open
  top band** (an unbounded edge prices nothing), 0 at share 0. gen-data
  reads the two standard bands' outer edges through it for the cut-off
  parenthetical (RdIncomeCut below). Round-trip verified ±1.5pt.
- **`INCOME_STD_BANDS`** — since 4c724259 (2026-10-16) the `group` names
  CARRY their electorate ranges: `"Lower earners (bottom 50%)"`
  `lo:0, hi:0.5` and `"Higher earners (top 15%)"` `lo:0.85, hi:1`; reads
  sit at the midpoints 0.25/0.925. The parenthetical lives in the CANONICAL
  name so everything downstream inherits it untouched (demos list, row
  labels, payload labels, probe expectations derived via
  `INCOME_STD_BANDS.map((b) => b.group)`).
  `DEMO_SHARE["Lower earners (bottom 50%)"|"Higher earners (top 15%)"]`
  (0.5/0.15, sampling-error floor only, cancels in the pool) EQUALS the
  band widths — the probe pins that equality. See
  "Naming + label-column contract (4c724259)" below for the two
  RD_DEMO_SHORT maps and the CSS repricing the rename forced.

`gen-data.mjs` §7g-income consumes them:

- **INCOME_DIST loader** — JUR-gated like DEMOGRAPHICS (null under vic);
  loads `data/income-dist.json`.
- **`incomeStandardise(house, dim)`** — picks the best-matched variant
  (most present cells), reads each party's fit at the standard-band
  midpoints ONLY inside that party's support; returns
  `{shares, band:[firstKey,lastKey]}` (the house's own printed END bracket
  keys, for the pill) or null.
- Each wave contributes the standardised shares for the two pseudo-groups
  **"Lower earners (bottom 50%)"** / **"Higher earners (top 15%)"** in their
  own row stores `iRows`/`iRowsM` — never the harmonised `rows` maps.
- The pooled datum is the SAME tilt form as every harmonised group:
  `x = ALL[k] + (g[k] − tot[k])` — tilt vs the wave's own printed
  all-voters total, re-anchored on the current aggregate, so
  personal-vs-household bases and differing cut points cancel inside each
  poll's own gap. Pools through the UNCHANGED `iRows`/`iRowsM` machinery;
  `reusesWaves` still excludes DemosAU (MRP) BEFORE collection (the MRP is
  in the roster but pools nothing).
- **Emission**: `note` = "each house's own brackets, read at the same two
  bands of the electorate (bottom half, top 15%+)"; `bands` derived
  **newest-per-house from `incInWindow`** — never from the house's first
  wave in demographics.json. Worked bug: a first-pass
  `incomeBands[w.pollster] ||= inc.band` pinned YouGov's Jan-2026
  FOUR-bracket keys from data order while the live window was binary — the
  pill showed a dead layout. Derive bands off the window, not file order.

## Emission and rendering (rule 5 contract)

- Emitted as a **separate `D.demoIncome` payload beside `D.demographics`**
  (own houses/polls/window/roster) so the classic data-driven panel never
  sees it — classic payload byte-identical, probe-verified.
- Renderer splice happens ONLY inside `RdDemographics` (rd-panels.jsx
  ~:2647): `T = Tdemo && D.demoIncome ? { ...Tdemo, tabs: [...Tdemo.tabs,
  D.demoIncome] } : Tdemo`. Headline (`rdDemoHead`) and composition trend
  (`rdDemoShift`/`D.demoTrend`) still run off `Tdemo` — income-free by
  contract, so an income-wave quirk can't rewrite "who Labor's voters are".
- Disclosure: the dek appends "Each house counts at its own lowest and
  highest bands." (`tab.sets[0].note`), and the per-house bracket pill
  (`.rd-wv-bands`, from `st.bands`; `b.low.slice(0,2)` — max two keys shown
  per side) sits **as its own block just below the dot-plot's RdKey
  legend**, gated on `tab.sets.some((st) => st.bands)`. It began life
  inside the `.rd-wv-sethead` columnheader (`5c97fbaf` only loosened its
  leading) — but its three wrapped lines grew the sethead's shared grid
  row 1, pushing `.rd-wv-allcap` (grid-row 1, height 18px) down onto the
  fixed-`top: 22px` `.rd-wv-allline`: the "All voters X%" cap collided
  with the vertical line on Income alone (measured −2.6px vs the other
  facets' −0.4). User call 2026-10-16 moved it below the legend
  (`ff968095`), which restores the legacy single-row sethead with no
  allcap CSS change needed. Keep `.rd-wv-bands`/`.rd-wv-band` class names —
  the probe queries them. Each clause spans render as
  `<em>{demoHouse(h)}</em> (basis income): {b.low.join(", ")} <i>·</i>
  {b.high.join(", ")}` — low/high are one-element arrays of the house's
  own COMPACT end brackets (see the clause-typography section below).
- Pinned by `.matilda/probe/wv-income.mjs` (20/20 at ship time; 57 pins
  with the RdIncomeCut feature, aedd5ae8; 62 with the middot/separator +
  compact-bracket pins, f7592cff/90958cd7 — gotcha list in the next
  section).

## The cut-off parenthetical (RdIncomeCut, aedd5ae8, 2026-10-16)

User dictate ("I want the same text and font and I want it to switch to
actual incomes on hover and stay there on tap"): each earner row's
parenthetical is RdGenBorn's twin — same 13px `--ink-3` button, rest state
the electorate share, mouse-hover or tap flips to the band's outer edge
priced in dollars, tapped state STICKS until tapped again. Homes:

- **gen-data §7g-income** emits three extra fields per income group on
  `D.demoIncome.sets[0].groups`: `bare` (label minus `" (...)"`), `pct`
  (`0` for the open-ended Higher band, `1` for the Lower — an INDEX into
  RD_INCOME_REST/RD_INCOME_OP, not a percentage), and `cuts:
  [{basis, ots}]` — one clause per DISTINCT basis, deduped in
  INCOME_GRIDS insertion order (household then personal), `null` if all
  edges price null.
- **rd-panels.jsx** (right after RdGenBorn, ~:2104): `const RD_INCOME_REST
  = ["top 15%", "bottom 50%"]` and `RD_INCOME_OP = ["≥", "≤"]`, then
  `RdIncomeCut({ pct, cuts })` with the same
  hover+tapped useState pair, `pointerType === "mouse"`-gated
  enter/leave, `onClick` toggle, `aria-pressed`. Caller in the row
  label: `{g.bare || g.label}<RdGenBorn label={g.label} />{g.cuts &&
  g.cuts.length ? <RdIncomeCut pct={g.pct} cuts={g.cuts} /> : null}`.
  Each clause is
  `<span class="rd-wv-cin"><span class="rd-wv-bf">{basis}</span><span
  class="rd-wv-hh">{HH-short}</span><span class="rd-wv-iw"> income</span>
  {OP} ${ots},000</span>` joined by `"; "`.
- **rd.css** (right after `.rd-wv-born`): `.rd-wv-born.cuts` allows
  wrapping (the full two-clause clause prices wider than the 200px label
  column — wrap only AT the `; ` joint, each `.rd-wv-cin` clause
  unbroken via `white-space: nowrap`). Phone rungs: ≤640px swaps
  `.rd-wv-bf`(full basis)→hidden, `.rd-wv-hh`("HH")→inline; ≤560px hides
  `.rd-wv-iw` (the word "income"). Both spans are always in the DOM.

**Probe gotchas (all burnt once in .matilda/probe/wv-income.mjs, now 57
pins):**

1. **Read cut state via `innerText`, never `textContent`** — the
   `.rd-wv-bf`/`.rd-wv-hh` swap spans BOTH live in the DOM, so
   textContent reads "householdHH income" even at desktop width.
2. **No literal space before the parenthetical** — the visual gap is
   `.rd-wv-born`'s `margin-left: 5px`, so the label's textContent is
   "Lower earners(bottom 50%)". Probes comparing to canonical
   `INCOME_STD_BANDS[].group` or parsing figures must insert the space
   (`replace(/(\S)\(/, "$1 (")`) first, or `parseFloat` swallows the
   parenthetical digits.
3. **Assert the pinned state only after moving the pointer away** — a
   click test that reads while the pointer still hovers sees
   `hover===true` masking the tap; move off, then read "stays on tap".
4. Click-test on 390px viewport expects both rungs at once:
   "(HH ≤ $109,000; personal ≤ $50,000)".

Rest figures (verified against incomeEdge): Lower "(household income ≤
$109,000; personal income ≤ $50,000)", Higher "(household income ≥
$238,000; personal income ≥ $120,000)". Phone 390px: HH + no "income".

## The bands pill's clause typography (f7592cff + 90958cd7, 2026-10-16, final)

The semicolon swing (aedd5ae8) was walked back the same day. The
settled contract, user-dictated:

- In-clause separator between a house's own low and high bracket lists is
  the `<i>·</i>` middot again ("change the semicolons here back to
  middots").
- Between houses, a bare `";"` rides the clause it CLOSES:
  `body.rd .rd-wv-band:not(:last-child)::after` (clamped 3.5px past its
  own text), never the next clause's `::before` — a sibling `::before`
  with the spans' 12px `margin-left` gutter hangs the glyph mid-gap
  hugging neither side ("improperly spaced … detached from their clause").
- Clauses are colon-led with COMPACT brackets:
  `House (basis income): < $100k · ≥ $100k`. gen-data compacts the
  payload — `bandLabel()` beside the §7g-income emit maps
  "Under $X" → "< $X", "$X+"/"$3,000+ a week"/"$X or more" → "≥ $X" —
  so the renderer never shows INCOME_GRIDS' spelled-out keys and the
  probe prices itself off the payload (`P.income.sets[0].bands`) as
  usual.
- Probe pins (wv-income.mjs): middot present, no ";" inside a clause;
  every clause matches `/\((household|personal) income\): </` with
  "· ≥" and no "Under"/"or more"/"+"; `::after` is `";"` on all-but-last
  spans and `none` on the last, no `::before` at all, glyph hugging
  <7px past each clause's own text rect.

## Roster vs six-week window — "why isn't <house> in the income tab?"

Two different lists, both derived, can't drift:

- **roster** (`income.roster`, the Info ledger) = every house in
  INCOME_BANDS that has EVER had a wave whose `dims.income` holds the full
  stored pair (`ibHasIncome`). RedBridge/Accent and DemosAU (MRP) and
  Freshwater appear here.
- **panel** (credits, pill, dots, pooled figures) = waves inside
  `SPARSE_K.window` (six weeks, `SPARSE_WINDOW`). Only houses with a recent
  income wave show.

Worked triage (2026-10-16, user asked "why isn't RedBridge/Accent in
there?"): RedBridge IS registered — `INCOME_BANDS["RedBridge/Accent"]` weekly
keys — because it printed income brackets exactly once, the Oct-2025
demographic-detail one-off PDF (wave `2025-10-07`, n≈1997, weekly brackets,
hand-entered). Its regular monthly "First preference vote intention" table
carries softness/generation/gender/location/education/housing only — NO
income dim — so nothing of it sits inside the six-week window and it
contributes no dots/credits. Freshwater is out the same way (last income wave
2026-01-18). At ship time the live window's houses were YouGov, DemosAU and
Newspoll (pooled) only.

Probe recipes (read-only):

```sh
# which houses carry an income dim, and with what stored keys
node -e 'const d=require("./data/demographics.json");const by={};for(const w of d.waves){if(w.dims&&w.dims.income){(by[w.pollster]||=[]).push([w.date,Object.keys(w.dims.income).join(" ; ")])}}for(const[h,r]of Object.entries(by)){console.log(h,r.length,"waves");console.log(" ",r.at(-1))}'

# what the built payload actually shows (window houses, rug dots)
node -e 'const fs=require("fs");const f=fs.readdirSync("./.build/newtracker/assets").find(x=>x.startsWith("9f09dca2"));const s=fs.readFileSync("./.build/newtracker/assets/"+f,"utf8");const i=s.indexOf("Higher earners");console.log(s.slice(i-400,i+50))'
```

## Auditing cross-house discrepancy (worked 2026-10-16)

For "is the pool neat — do the houses agree?", compute each wave's
standardised reads at the band midpoints (0.25/0.925) and subtract that
wave's own all-voters figure — compare TILTS, never the raw reads:
levels carry each house's overall lean (Newspoll prints ALP ~4 points
above YouGov), which the tilt form pools away by design. Write the probe
as a scratch .mjs under .matilda — NOT inline `node -e` (apostrophes in
the log strings break bash single-quoting); delete it when done.

- machinery: `import { incomeQuantiles, incomeFit, INCOME_STD_BANDS }
  from "../.build/newtracker/demo-groups.mjs"` + income-dist.json,
  demographics.json, polls.json
- per wave: best variant = most matched cells; read `f.a + f.b*q` for
  each party ONLY when q sits inside `fit.support[k]` (else null)
- GOTCHA: recent DemosAU waves have NO `total` field in demographics.json
  — fall back to the polls.json row for the same pollster nearest in
  date, with `oth: (ind??0)+(oth??0)`. gen-data's `demoTotalOf`
  (gen-data.mjs:3108) makes exactly this fallback; mirror it, don't
  invent

Findings (all waves Jun–Oct 2026, per-house mean tilt lower/higher,
points; the table the pooled figure averages):

- ALP −1.1…+0.2 / +1.5…+2.9; LNP −1.2…−2.4 / +1.9…+5.5; ON +0.9…+4.1 /
  −2.3…−4.1 — all three houses same sign per party; the cross-house
  spread (±1–2) ≈ subsample noise (top band ≈ 225 respondents of a
  1,500-poll; per-wave sd 1–3).
- GREENS is the soft spot: houses disagree on SIGN at the top band
  (YouGov ~0/0, DemosAU +0.7/−1.6, Newspoll −0.8/+1.3). Magnitudes are
  tiny so the pool barely moves, but present the Greens income line as
  indicative, not precise.
- Structural caveats: YouGov's post-Apr-2026 binary cut (top cell
  q0.464–1.0, midpoint 0.73) means its 0.925 read is an EXTRAPOLATION
  along a two-point line; personal-vs-household bases differ in shape
  even though tilts cancel levels; only three houses print income inside
  a typical window, and YouGov's fortnightly cadence dominates the pool.

## The standard bands in dollars

The histogram is 2021 Census WEEKLY dollars; the inverse of the edge
map: walk cumulative mass to the quantile, interpolate uniformly inside
the band, annual = weekly × weeksPerYear/1000, current-dollar ≈ ×
aweRatio (1.1991). Verified 2026-10-16:

- **q0.50 (the median — the bottom-half cutoff)**: household $1,746/wk ≈
  $91k/yr 2021 (~$109k today); personal $805/wk ≈ $42k/yr (~$50k).
  Personal medians sit low because everyone 15+ counts, earners or not.
- **q0.85 (the Higher-earners cutoff)**: household $3,804/wk ≈ $199k/yr
  (~$238k); personal $1,919/wk ≈ $100k/yr (~$120k).

## Why top 15% (not quartiles, quintiles or top 20%)

The bands are neither quartiles nor quintiles — the grid's own printed
edges set them. DemosAU's top printed cell ($125k+, personal) maps to
q0.865–1.0 with centre 0.93, so the 0.925 read lands ON the only real
measurement any house makes up there rather than interpolating toward
it; top-20% (read 0.90) still fits inside that cell but off-centre and
toward the $45–125k middle bracket. Narrow also maximises the
end-to-end contrast the panel exists to show. And narrower than 15% is
not free: DEMO_SHARE["Higher earners"]=0.15 IS the sampling-error
floor — 15% of a 1,500-poll is already only ≈225 respondents. "Lower
earners" is the bottom HALF (width 0.5) for the same noise reason.

## Adding a house to the income tab

1. The crosstab reader learns the house's income layout and the group
   normaliser (`crosstab-parse.mjs` ~:85) stores the bands under stable keys
   (see the `(household) income` regex family there).
2. Add one `INCOME_BANDS` entry with the EXACT stored lowest/highest keys.
3. Done — pooling, pill, roster and credits derive themselves; no renderer
   or template work. If a house's brackets re-scheme (as YouGov's did Apr
   2026), only the INCOME_BANDS entry moves; old-layout waves just fail the
   pair gate and sit out (four-bucket YouGov waves are an example).

## Related

- auspol-demographics-reader (the data pipeline + gates these waves pass).
- auspol-allpolls-demographics-split (the OTHER income surface — the
  All-polls Demographics facet contrasts each poll's own brackets; the
  2026-10-07 ruling that income joins no common group lives there).
- auspol-vote-by-group-all-voters-anchor, auspol-wv-subsample-n,
  auspol-vote-by-group-pool-membership (shared Who-votes machinery).
