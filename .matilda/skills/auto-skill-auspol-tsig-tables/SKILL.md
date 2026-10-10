---
name: auspol-tsig-tables
description: "auspol-tracker — the shared RdTsig \"Trend-significance table\" fold-out (rd-panels.jsx ~:2219, generalised from the who-votes original 2026-10-02; RdTsig/rdTsSgn also exported on window for cross-asset use from rd-allpolls.jsx): <details class=\"rd-evdrop rd-tsig\"> + .rd-tsig-wrap/.rd-tsig-table under a chart's legend, props {summary, heads, sets[{key,label?,since?,rows}], note}, row {name, cells[], sig} and the CSS chrome rd.css :1257-1276 (Yes rows wash --chg-up, quiet No rows fade to --ink-3, both keyed ONLY off the last td carrying .rd-tsig-yes). EIGHT call sites: who-votes + switching + issues trust + issues whom + decidedness all/party/age in rd-panels.jsx, PLUS house-lean and flows in rd-allpolls.jsx on the All-polls tab. Three gates: house-lean is withinHouseSlope per pollster on monthly lean (Holm across them, recomputed per view tab); issues whom (converted 2026-10-02) is per-group straight-line trend on the house's own waves since the May 2025 election (t-tested, Holm per issue, All-voters anchor row first); flows (converted 2026-10-02) is per-pollster straight-line drift on monthly published-minus-implied gaps (unweighted w=1, x=D.mx(ym), Holm per contest, three sets since 2026-10-10: Against the Coalition / Against One Nation / Pressed-choice Labor share, the last running one line per forced-choice cohort through its published Labor-share dots, Holm across the pair — its Yes is what licenses the chart titles' up/down-from tails). Pinned by .matilda/probe/sig-tables-panels.mjs (ALL GREEN 2026-10-02, 214 checks, figures recomputed independently from the live bundle payload; probe must click #tab-allpolls, and placement is bounding-box geometry because RdFoot is RdGlide-wrapped; a trend battery CAN honestly be all-No — assert computed + log min raw p, never assert sig and no both present). Adding a new panel's table = one <RdTsig> call reusing the panel's own gate, never a bespoke table."
source: auto-skill
extracted_at: '2026-10-02T02:26:23.741Z'
---

# RdTsig — the shared trend-significance table

A `<details>` fold-out that sits under a chart's legend answering "did this
actually move?": a small battery table whose note says exactly what the Yes
gate is. Six sites recompute the host panel's own visible-mark gate (the
"same test behind the head" pattern); the two converted 2026-10-02 (issues
whom, flows) deliberately ask a DIFFERENT question from the panel's marks —
drift over the term vs today's gap — and their notes say so in words
("The card's ▲▼ marks ask a different question…" / "…not just sitting off
zero today").

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
| issues whom (~:3066, whomTsig ~:2870) | Group · Share, first → last · Slope, pts/yr · t · Significant | since-the-2025-election drift battery (converted 2026-10-02): `withinHouseSlope` per group on the house's own monthly waves from gen-data's `tr` payload (RedBridge salience, weighted by sample share, x = date-decimal), Holm per issue; All-voters anchor row always first, its source = the house's own all-voters line, not the electorate |
| decidedness all (~:3371) | 3 series | `slopeOf`/Holm survivors via unSig |
| decidedness party (~:3397) | 7 rows incl. All-voters anchor | apart: `|now−base| > hypot(ci95,ci95)`, z = chg/(hypot/1.96) |
| decidedness age (~:3445) | 3 bands | same apart gate; NO all-voters column (its Resolve not-firm change basis differs — dropped 2026-10-02) |
| **house-lean** (rd-allpolls.jsx ~:2540, RdHouseLean, All-polls tab) | Pollster · lean first→last · slope pts/yr · t · Significant | `withinHouseSlope` (w=1, x=`D.mx(ym)`) on the pollster's monthly lean since 2025-06, Holm across the tested pollsters; cell "first → last" strings use rdTsSgn; **recomputed per view tab** (tpp/alp/lnp/onp/grn/oth/split — split is the client-side onp−lnp series) |
| **flows** (rd-allpolls.jsx ~:2680, RdFlows, All-polls tab) | Series · First → last · Slope, pts/yr · t · Significant | per-pollster drift battery (converted 2026-10-02): two contest sets (Against the Coalition / Against One Nation) over `flSetRows(FD|FO)`, each pollster a row with `withinHouseSlope` unweighted (w=1, x=`D.mx(ym)`) through its own monthly published−implied gap dots on `flMonths = rdApMonths("2025-06")`, Holm per contest; ON's zero remains each pollster's first published head-to-heads, not the election. Plus a third Pressed-choice Labor share set (2026-10-10): `ffSet`, one row per forced-choice cohort ("Coalition voters" / "One Nation voters"), same fit on that cohort's `flowForced` Labor-share waves, Holm across the pair; a cohort's Yes licenses its chart title's ", up/down from NN% in <month>" tail (heads widened to Series/First → last so they fit gaps and shares alike) |

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
2026-10-02, 214 checks) recomputes ALL figures independently in node from
the live bundle payload (`window.AP` pulls for `onSources`/`issues`/
`undecided`/`firmness`/`softAge`; the whom battery pulls the groupTabs
`tr` payload under `issues` and replays `withinHouseSlope`+`holmWon`
against it; flows pulls `flowHouses` — `{c: D.flowDrift.houses, o:
D.flowDriftOn.houses}` — and filters dots onto `rdApMonths("2025-06")`;
`ISS_PHRASE` regex-extracted from the a11e1559 asset), and checks:
placement (switching under `.rd-sm-key`, trust below the
`details.view-how` HowTo, whom as previous-sibling of `.rd-key`, decidedness
below `.rd-un-panels`), heads, every row figure-for-figure, note wordings,
Yes/No colouring off live tokens, and a 390px phone containment rung. The
who-votes original keeps its own pin at `.matilda/probe/sig-table.mjs`.

Probe-row shape trap (cost one failure 2026-10-02): rows from the probe's
`readTable`/`compareRows` carry `name` SEPARATE from `cells` — the verdict
cell of a five-head table is `cells[3]`, not `cells[4]`.

Trend-battery trap: a drift battery can honestly come back ALL-No (the
whom battery did: min raw p 0.064–0.118 per issue vs Holm thresholds
0.005–0.05). Assert the battery COMPUTED (fits ran — count fitted vs
dashed rows — and the All-voters anchor is first in every set) and log
min raw p per issue as a diagnostic; never assert "sig and no both
present" or the probe will fake a product bug on a quiet term.

Two probe-side traps that each faked a product bug (see
auto-skill-auspol-headless-geometry-verify for the full pattern): bare
`tr` selectors net the thead row (lights a No-row check full-ink), and
getComputedStyle declarations are live (snapshot token strings before
mutating the scratch reference span).

Two more traps specific to the All-polls call sites (both hit
2026-10-02): **RdHouseLean/RdFlows mount only under the `#tab-allpolls`
page tab** — the probe must click that tab before waiting on
`#house-lean`/`.rd-fl-*` selectors, and re-click `#tab-now` before
later Snapshot-tab sections or their tab buttons won't exist. And
**placement checks can't use sibling classes**: `RdFoot` renders inside
`RdGlide`, so `details.rd-tsig`'s next element sibling is NOT
`.rd-foot`/`.rd-fl-key` — compare bounding boxes
(`det.top >= .rd-hl-table/.rd-fl-key .bottom`,
`det.bottom <= .rd-foot.top`). The house-lean expectation harness
derives the active measure from the rendered `.rd-hl-ct` title text
(the page may open on a non-default 2PP basis/matchup) and re-verifies
after clicking Coalition / split / back-to-two-party tabs.
