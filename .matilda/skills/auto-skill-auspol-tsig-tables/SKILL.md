---
name: auspol-tsig-tables
description: "auspol-tracker — the shared RdTsig \"Trend-significance table\" fold-out (rd-panels.jsx ~:2219, generalised from the who-votes original 2026-10-02; RdTsig/rdTsSgn also exported on window for cross-asset use from rd-allpolls.jsx): <details class=\"rd-evdrop rd-tsig\"> + .rd-tsig-wrap/.rd-tsig-table under a chart's legend, props {summary, heads, sets[{key,label?,since?,rows}], note}, row {name, cells[], sig} and the CSS chrome rd.css :1257-1276 (Yes rows wash --chg-up, quiet No rows fade to --ink-3, both keyed ONLY off the last td carrying .rd-tsig-yes). EIGHT call sites: who-votes + switching + issues trust + issues whom + decidedness all/party/age in rd-panels.jsx, PLUS house-lean (withinHouseSlope per pollster on monthly lean, Holm across them, recomputed per view tab) and flows (headline's |v|>ci95 z-test) in rd-allpolls.jsx on the All-polls tab. Pinned by .matilda/probe/sig-tables-panels.mjs (ALL GREEN 2026-10-02, figures recomputed independently from the live bundle payload; probe must click #tab-allpolls, and placement is bounding-box geometry because RdFoot is RdGlide-wrapped). Adding a new panel's table = one <RdTsig> call reusing the panel's own gate, never a bespoke table."
source: auto-skill
extracted_at: '2026-10-02T02:26:23.741Z'
---

# RdTsig — the shared trend-significance table

A `<details>` fold-out that sits under a chart's legend answering "did this
actually move?": a small battery table where every row's tests recompute the
exact significance gate the host panel's own visible marks use, so the note
can honestly say "Yes means the same test behind the head above clears 95%".

## Contract (rd-panels.jsx ~:2219-2247)

```jsx
<RdTsig summary="Trend-significance table"
  heads={[...]}                    // heads[0] renders as an sr-only col th
  sets={[{ key, label?, since?,   // label ⇒ a tr.rd-tsig-set sub-head row
            rows: [{ key?, name, cells: [string…], sig }] }]}
  note="…what the test is…" />     // .rd-note.rd-tsig-note under the table
```

- Markup: `<details class="rd-evdrop rd-tsig">` borrowing the event-list's
  disclosure chrome → `.rd-tsig-wrap` (overflow-x:auto — the phone scroll
  container) → `.rd-tsig-table` → per-set `<tbody>` → `.rd-tsig-note`.
- **Row significance is LAST-TD-ONLY by design.** The renderer puts
  `class="rd-tsig-yes"` on the final td iff `row.sig`; mid-row cells take no
  marker class. Never smuggle a per-test direction colour onto a mid cell as
  `rd-tsig-yes` — the row-level rules below read ANY yes-td as "this row is
  significant" (see the paint grammar).
- `rdTsSgn(v, signed)` sits right above the component: true minus "−",
  "+" only when `signed && v > 0`, one decimal. There is no `rdTsP` (dead
  helper, removed 2026-10-02).

## CSS chrome (rd.css :1257-1276, plus the ≤640px rung)

- Base: 14px tabular-nums rows, thead 13px/--ink full, set sub-heads
  13px/--ink-2 with a `--ink-3` since-span.
- **Yes rows:** `tr:has(> td.rd-tsig-yes) > :is(th, td)` → background
  `color-mix(in oklab, var(--chg-up) 9%, var(--surface))` (wash, full ink
  kept); `td.rd-tsig-yes` → 600-weight, `color: var(--chg-up)` (the
  direction-of-travel green, never a party colour).
- **No rows (e322ad0, user's "tweak it so"):** `tbody tr:not(.rd-tsig-set)
  :not(:has(...)) > :is(th, td)` → `color: var(--ink-3)`. A No is the test
  FAILING to establish a shift, not evidence of none — quiet ink, not red.
- Chamber open details+wrap scroll: `@media ≤640px` the table carries
  `min-width: 600px` + `text-size-adjust: 100%` (iOS inflates sub-heads
  otherwise); wide tables scroll inside their wrap, the page never pans.

## The eight call sites and THEIR GATE (each table = its panel's own test)

| panel | heads | gate behind Yes |
|---|---|---|
| who-votes (original) | group · support then→now · all · rel · |t| abs · |t| LR · sig | the panel's own group-slope battery (sets per Age/Gender/…) |
| switching (~:2507) | Party's 2025 voters · line first→last · slope pts/yr · t · Significant | `withinHouseSlope` per party, Holm across the four (a11e1559 ~:2254 returns {b,t,p}) |
| issues trust, per chart (~:2953, guarded `ch.trend && ch.trend.byParty`) | Party · line · slope · t · Significant | same slope+Holm across the 3 parties, from rdIssTrend's fits |
| issues whom (~:3027) | per-issue sets × 7 groups, z column | the ▲▼ rule: `|diff| > c.ci`, z = diff/(ci/1.96) |
| decidedness all (~:3371) | 3 series | `slopeOf`/Holm survivors via unSig |
| decidedness party (~:3397) | 7 rows incl. All-voters anchor | apart: `|now−base| > hypot(ci95,ci95)`, z = chg/(hypot/1.96) |
| decidedness age (~:3445) | 3 bands | same apart gate; NO all-voters column (its Resolve not-firm change basis differs — dropped 2026-10-02) |
| **house-lean** (rd-allpolls.jsx ~:2540, RdHouseLean, All-polls tab) | Pollster · lean first→last · slope pts/yr · t · Significant | `withinHouseSlope` (w=1, x=`D.mx(ym)`) on the pollster's monthly lean since 2025-06, Holm across the tested pollsters; cell "first → last" strings use rdTsSgn; **recomputed per view tab** (tpp/alp/lnp/onp/grn/oth/split — split is the client-side onp−lnp series) |
| **flows** (rd-allpolls.jsx ~:2680, RdFlows, All-polls tab) | Contest · published−implied now · 95% interval · z · Significant | the headline's own test: `sig = |now.v| > now.ci95` (= head's `outC`/`outO` gates), z = v/(ci95/1.96); ON row's zero is each house's first head-to-head, not the election |

Adding a ninth: compute the panel's existing gate into `sig` per row —
don't write a bespoke table or a new test wrapper.

## Cross-asset use from rd-allpolls.jsx

`RdTsig`/`rdTsSgn` are defined in **rd-panels.jsx** but referenced **bare**
in rd-allpolls.jsx. That works because the build is Babel-only (top-level
functions stay script-global across script tags), and `RdTsig`/`rdTsSgn`
are additionally appended to rd-panels' closing
`Object.assign(window, {…})` (~:3484) for safety. `withinHouseSlope`
(a11e1559) and `D.mx` (data-bundle return object, 9f09dca2) resolve the
same way — `D` is `window.AUSPOL`. If a new call site lands in a third
asset, add its names to that same Object.assign line; never `import`
(there is no module graph).

## Verification

`.matilda/probe/sig-tables-panels.mjs` (gitignored scratch, ALL GREEN
2026-10-02) recomputes ALL figures independently in node from the live
bundle payload (`window.AP` pulls for `onSources`/`issues`/`undecided`/
`firmness`/`softAge`; `ISS_PHRASE` regex-extracted from the a11e1559 asset),
and checks: placement (switching under `.rd-sm-key`, trust below the
`details.view-how` HowTo, whom as previous-sibling of `.rd-key`, decidedness
below `.rd-un-panels`), heads, every row figure-for-figure, note wordings,
Yes/No colouring off live tokens, and a 390px phone containment rung. The
who-votes original keeps its own pin at `.matilda/probe/sig-table.mjs`.

Two probe-side traps that each faked a product bug (see
auto-skill-auspol-headless-geometry-verify for the full pattern): bare
`tr` selectors net the thead row (lights a No-row check full-ink), and
getComputedStyle declarations are live (snapshot token strings before
mutating the scratch reference span).

Two more traps specific to the All-polls call sites (both hit
2026-10-02): **RdHouseLean/RdFlows mount only under the `#tab-allpolls`
page tab** — the probe must click that tab before waiting on
`#house-lean`/`.rd-fl-*` selectors, and re-click `#tab-snapshot` before
later Snapshot-tab sections or their tab buttons won't exist. And
**placement checks can't use sibling classes**: `RdFoot` renders inside
`RdGlide`, so `details.rd-tsig`'s next element sibling is NOT
`.rd-foot`/`.rd-fl-key` — compare bounding boxes
(`det.top >= .rd-hl-table/.rd-fl-key .bottom`,
`det.bottom <= .rd-foot.top`). The house-lean expectation harness
derives the active measure from the rendered `.rd-hl-ct` title text
(the page may open on a non-default 2PP basis/matchup) and re-verifies
after clicking Coalition / split / back-to-two-party tabs.
