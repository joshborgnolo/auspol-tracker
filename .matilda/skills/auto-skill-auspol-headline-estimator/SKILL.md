---
name: auspol-headline-estimator
description: auspol-tracker — where each CURRENT headline number actually comes from in gen-data.mjs. ALP 2PP = nowcastAdj over the trailing 21d window (wᵢ = nᵢ·2^(−d/7)·t(d)÷√m — t(d) a half-cosine taper, full weight to day 14 falling to zero at day 21, shipped 2026-09-09 as recencyW() so poll exits drift rather than step — undecided-inside pairs rebased to 100 by share2pp, lean read at refNow = latest poll's fieldwork end, empty-window falls back to last monthly point). SINCE 2026-09-09 (Advisory A1, divergence audit) the DISPLAYED current primary shares = latest.primary = primaryNow §7d, the SAME nowcast construction run per party (window on midpoint, lean at refNow, total rescale guard |adj−plain|>0.5); aggPrimary STAYS monthly (monthWithSe, no recency term, lean at month midpoint) for charts/prediction/election anchor. House effect = ±28d OTHER-HOUSES-ONLY consensus window (≥3 neighbours; own-house rows excluded since 0a370c2), pooled 90d half-life, shrunk sw/(sw+8), read as-of-date per measure. Primaries-through-flows is the synthetic DIAGNOSTIC (tppRowsSynth/synthEffect), never the headline. Needed before editing methodology/hero/glossary copy about "how the number is calculated" (worked example: glossary d960b2d).
source: auto-skill
extracted_at: '2026-09-03T13:03:15.884Z'
---

# Headline-number estimator map (auspol-tracker)

Where each figure a reader sees lands from, verified in
`.build/newtracker/gen-data.mjs` (aggregation estimator ~:100–470; line
anchors are approximate — grep the symbol names).

## The two constructions

Both share `weightedWithSe` (~:319): `v = Σwᵢxᵢ ÷ Σwᵢ`; they differ only
in windows and weights.

- **`nowcastAdj(rows, he, ref)` (:330) — the 2PP HEADLINE.** Rows whose
  fieldwork MIDPOINT (`midMs`, :190) sits in the trailing `HL_WINDOW=21`
  days before `ref`. Weight `w = rowN(p) · recencyW(d) ÷ √waves` where
  `recencyW(d) = 2^(−d/HL_HALF) · taperW(d)`, `HL_HALF=7`, and `taperW`
  is a Tukey half-cosine edge (full weight to `HL_TAPER=14` days, easing
  to zero at 21; shipped 2026-09-09 so a poll leaving the window drifts
  out instead of stepping out — one helper beside the HL_* constants,
  used by nowcastPts and both §8b arms), d = age in days from ref; `x = published − heV(he,firm,ref)`
  (lean read AT the reference). Called as `headlineTpp(refNow)` (:1086)
  with `refNow = LATEST_ISO` = the latest poll's fieldwork END. Emitted as
  `latest.alp2pp` / `latest.lnp2pp = 100−alp` (`latest` ~:1130).
  **Empty window → falls back to the last `agg2pp` monthly point.**
- **`nowcastPts(rows, he, ref)` (~:338, extracted 2026-09-09)** — the
  shared unrounded weighted-points core of `nowcastAdj`
  (`nowcastAdj = weightedWithSe(nowcastPts(...))` + rounding; behaviour
  identical). `primaryNow` consumes the same core, so the 2PP headline
  and the per-party primary nowcast can never drift apart in
  construction.
- **§7d `primaryNow` — the DISPLAYED current primaries (Advisory A1).**
  Per party `k`: `nowcastPts(primaryRows[k], primaryHE[k], refNow)`
  through `weightedWithSe`; five-party total check reuses the monthly
  guard — rescale all five only if `|adjTotal − plainTotal| > 0.5`
  (emits `rescaled`, `plainTotal`, `adjTotal`). Returns
  `{alp, lnp, grn, onp, oth, n, parties, …} or null` (empty window).
  Sits after `altLatest`, before §8; `win(k)` helper filters rows with
  `d ∈ [0, HL_WINDOW]`. Emitted as `latest.primary` (rounded per-key
  object); console line
  `primaryNow: alp 27.5 lnp 21.3 … | n=9` right after `aggPrimary last:`.
- **`effByKey` (§3b, after `alt2pp`) — per-poll LEAVE-ONE-OUT deltas**
  re-run the same nowcast calls minus one row for the "Effect on …
  aggregate" lines in the expanded poll detail. Same estimators, read at
  the same `LATEST_ISO` ref; house effects are NOT re-estimated. Full
  map: auto-skill-auspol-poll-aggregate-effect.
- **`monthWithSe(rows, he, ym)` (~:361) — monthly trend points (charts,
  prediction history, election anchor).** Same estimator with the
  recency term DROPPED:
  `w = n ÷ √waves` (waves that month); lean read at the month's midpoint
  (`ymid = ym-15`). `agg2pp` (~:384) and `aggPrimary` (~:430, per party
  with its OWN house effects) are arrays of these; election-day anchor
  rows are unshifted with `ci95: 0`.

## Per-measure row facts (the "exactly how" details)

- **2PP rows** (`tppRows` ~:198): only polls with a published tpp pair.
  `share2pp` (:195) computes `alp/(alp+lnp)×100` — pairs printed with
  undecided INSIDE (Essential's basis, see
  auto-skill-auspol-undecided-basis-display) are rebased to 100 before
  they enter. Houses that publish no 2PP contribute no row — never
  backfilled; the primaries-through-flows run (`tppRowsSynth`,
  `synthEffect`, `agg2ppSynth`, glossary id `implied-2pp`) is a
  **diagnostic only, never the headline**.
  Sep-2026 panel state (verify before relying on it): Newspoll, Resolve
  and DemosAU publish no 2PP, so the nowcast panel is 4 houses —
  Morgan×3/YouGov×2/Essential/RedBridge, with adjusted spreads up to
  ~6pt in one week; the implied series then carries n=9 and tracks
  BT/Bonham's primaries→flows aggregates (see
  auto-skill-auspol-external-aggregate-triage).
  - **Sibling diagnostic `flowSens` (gen-data §1c, shipped
    2026-09-09)** — the implied series re-run with only the ONP cell
    re-priced per row: the 2022 election's measured ONP→ALP flow share
    (`ONP_FLOW_2022 = 0.3570`) substituted for the shipped 2025 table's
    `FLOW.onp = 0.2550` on each row's own ONP primary; the full estimator
    (own house effects + monthly pool) re-runs on the alt series and the
    output is emitted as `flowSens: [{ym, x, lo, hi}]` — the monthly
    BRACKET between the two counted flow tables (17 pts; election month
    55.2–55.8, last month 51.9–54.8 ≈ 2.9pt wide). The hero draws it as
    the `.sens-band` area only when the implied overlay toggle is on and
    brackets the dashed implied line; the legend chip is
    `.hl-band-sens`, deliberately far lighter than `.ci-band` — it is a
    sensitivity bracket between two measured tables, NOT a confidence
    interval. Console line:
    `flowSens: 17 pts | bracket at election: 55.2–55.8 | last month: 51.9–54.8 (width 2.9pt)`.
- **Primary rows** (`primaryRows[k]`, k = alp/lnp/grn/onp/oth ~:420s):
  `oth = (ind ?? 0) + (oth ?? 0)`. After all five parties are estimated,
  `aggPrimary` rescales the five **only if** the debiased total drifts
  >0.5 pt from the plain-mean total — an undecided-driven shortfall
  survives; say "rescaled past a half-point drift", never "renormalised
  to 100".
- **nᵢ** (`rowN` :187, see auto-skill-auspol-effective-sample): published
  effective sample × `HL_DEFF 1.6` where the house files one (APC
  methodology statements: Newspoll/YouGov/Essential/DemosAU), else raw
  sample capped at `SAMPLE_CAP=3000`.
- **House effect** (`houseEffectsFor` :240): each poll's deviation from
  the n-weighted cross-house consensus within `HE_WINDOW=±28` days (≥3
  neighbours, same-stratum only); **the consensus is OTHER HOUSES ONLY** —
  same-firm rows are skipped (shipped 0a370c2, 2026-09-06: a weekly house
  ringing three times in a window used to outvote everyone, read its own
  level as consensus, and have its measured lean shrunk toward zero by
  construction; the deff-backtest arms race confirmed the fix with LOO
  MAE flat, and the dropped trailing-window-primary arm is recorded there
  too); pooled with `HE_HALF=90`-day half-life;
  shrunk toward zero by `sw/(sw+SHRINK_K)`, `SHRINK_K=8`; **per measure**
  (tpp, each party's primary, leadership…) and **read as-of-date** —
  `he.at(firm, t)` is the lean at t, so a mid-cycle method change settles
  in ~2 months. A stopped house's lean decays back to 0.

## Where the page reads them (consumers to check before copy edits)

- `latest.alp2pp` / `lnp2pp` → hero 2PP headline, `latest.method`
  (~:1130) carries the published constants {windowDays 21, halfLifeDays 7,
  taperDays 14, shrinkK 8}; `latest.alp2ppCi95` is SHARE-scale (see
  auto-skill-auspol-ci95-scales before using it beside a LEAD).
- "Current primary" shown anywhere = **`latest.primary`** (the §7d
  nowcast; A1 shipped 2026-09-09): GlyphDial bars `73de0c58…js ~:52`
  (`const lp = D.latest.primary`), primary-chart chip sort
  `a11e1559…js :188` (CHART POINTS at :198 still read `D.aggPrimary`),
  `infoTerms` `d1a1d215…js :4516` (`const L = D.latest, prim =
  D.latest.primary`), favicon `build.mjs ~:245` (`L.primary`; aggPrimary
  grab removed), static summary `build.mjs ~:370` (`prim = L.primary`),
  share card `make-card.js ~:163`.
- Deliberately NOT re-pointed (still monthly `aggPrimary`): the primary
  trend chart series, prediction `primPts/oppPrimPts/onpPts` (~:2040s),
  `wm-story.jsx ~:93` primBy. The asymmetry (quoted now vs plotted
  trend) is intentional.
- Pre-A1 history: the quoted primary used to be the last `aggPrimary`
  month-to-date point; A1 (divergence-vs-Bonham/Bludger audit,
  `.matilda/divergence-vs-bonham-bludger-2026-09.md`) moved it to the
  same 21-day nowcast family as the 2PP headline because the calendar
  month-to-date mean lagged comparators by up to ~2 pt early-month.

## Voice check for copy (committed reference: d960b2d)

Methodology text overclaims when it says "renormalised" (only >0.5 drift),
says "weekly Morgan counts once" (it counts √waves, ~1.7×), or implies the
implied-2PP line feeds the headline. The glossary main definition quotes
the full formula; the two `.info-p` paragraphs under it walk the primary
and 2PP applications and print the live figures (`{prim.alp.toFixed(1)}`,
`{L.alp2pp.toFixed(1)}–{L.lnp2pp.toFixed(1)}`).

## Changing the weight function (Tukey taper, 2026-09-09)

The recency weight lives in THREE code sites that must change in lockstep:
`nowcastPts` and BOTH §8b show-working arms (the §8b THROW guards fire
build-time if the table and hero disagree). Do it as a single shared
helper beside the `HL_*` constants — `recencyW(d) =
2^(−d/HL_HALF)·taperW(d)` consumed by all three — never parallel edits of
the inline formula, and remember the OFF-site copies too: the verbatim
estimator replica in `.build/flow-drift-check.mjs` carries `recencyW` and
went stale at the 2026-09-09 taper ship (repaired same day when its
nowcast comparisons printed MISMATCH on ci95/nEff while v matched —
identical mean, different weights, the signature of a weight-formula-only
divergence). Exception — NOT to be synced: the arms-race replica
`.build/newtracker/deff-backtest.mjs` still carries the pre-taper `Math.exp`
form on purpose (it's a PINNED historical experiment, not a drift-check;
syncing it would rewrite the arms race's recorded comparisons — see
auspol-estimator-arms-race). Then keep the rest of the paper trail truthful in the
same change: the glossary's quoted formula in d1a1d215 (adds `× t(d)`),
the `.info-work-note` caption under the work tables, and
`latest.method`'s published constants (`taperDays`). Worked reference:
Tukey half-cosine taper full→0 over days 14→21 — fixed the midnight
exit-jump (a poll went from ~14% total weight at day ~20.9 to 0 at 21)
without lengthening the window; expected headline moves are small
(2PP 51.1→51.0, primaries ±0.2 on the boundary-week polls).

## Shipped "show your working" tables (commit 89b91bc, branch `show-your-working`)

The reader-facing tables behind the two headline figures now SHIP — the
`weighted-aggregate` glossary entry renders them live. Machinery:

- **gen-data.mjs §8b** (`/* ---- 8b. show-your-working */`, right after
  `const latest = …`): an IIFE builds `showWorking = {tpp, primary}` by
  REPLICATING the estimator predicates (never re-implementing them):
  - `tpp`: window rows filtered by the same refNow/HL_WINDOW predicate,
    each row `{firm, fw, mid, d, pair, x, lean, adj, n, m, w}` plus
    totals `{k, sw, swx, mean, v=r1(swx/sw)}`. `fw` formats fieldwork as
    "10–16 Aug" in-month / "27 Jul – 2 Aug" cross-month.
  - `primary` (post-A1): the §7d 21-day window rows (same
    `d ∈ [0, HL_WINDOW]` filter as `primaryNow`), each row
    `{firm, fw, mid, d, x, lean, adj, n, m, w}`; totals/parties/
    plainTotal/adjTotal/rescaled RIDE from `primaryNow` (single source);
    `v` is recomputed from the rows with the same optional rescale and
    `ref: dayMon(refNow)`. Pre-A1 this arm walked the calendar month
    with `monthWithSe` per party and a `crossed` flag — both gone.
  - **Self-check at build time**: `console.warn` fires if
    `showWorking.tpp.v !== hlNow.alp`; a THROW fires if
    `showWorking.primary.v !== primaryNow.alp` — drift means the
    replication diverged from the real estimator; fix §8b, never the
    estimator. Console tail reads
    `showWorking: 2pp mean ..% over N polls | primary mean ..% (21d to D Mon)`.
- Emitted as `const showWorking = …;` in the payload template (after
  `latest`), so the renderer reads `D.showWorking`.
- Renderer: `primWork`/`tppWork` JSX blocks in `infoTerms(D)` inside the
  `weighted-aggregate` entry (d1a1d215 asset ~:3896+), styled
  `.info-work` in template.html (tabular-nums, 12.5px, right-aligned
  numerics, `.info-work-sum` totals row, `.info-work-note` caption).
  Columns: primary 10 (Pollster/Fieldwork/Mid/Published/lean/xᵢ/**d**/
  nᵢ/m/wᵢ — d added with A1), tpp 11 (adds "of pair" rebased share + d);
  primary sum row is `colSpan="10"` and the trailing note reads "A wave
  counts from its fieldwork midpoint and fades out over its last week:
  full weight to day 14, then a half-cosine taper to zero on day 21,
  when it leaves the window." (the pre-A1 crossed-month prose is
  removed; the taper sentence replaced "leaves the window after 21
  days.").
- ALSO FIXED in that commit: the nᵢ prose sentence — reads "published
  effective sample… grossed back up by the shared 1.6 design factor,
  else raw sample capped at 3,000 – 1,200 where no sample is filed".
  Don't let copy regress to "raw sample" alone.

Merge status: as of 2026-09-04 this lives ONLY on branch
`show-your-working` (worktree `.matilda/worktrees/show-working`, based
on `d10c376` = deployed state), withheld from main because a sibling
session's uncommitted trove-revert occupies the main index. When merging
later, expect gen-data.mjs conflicts if the sibling's `d6b50f0` trove
work (+30 lines elsewhere in that file) or its revert lands first — the
§8b block is self-contained, so rebase-and-re-resolve is mechanical.

The scratch-dump technique below is still the tool for ANALYSIS
questions ("why did the headline move?"), not for adding/changing the
on-page tables (edit §8b + rebuild).

## Scratch dump — reproducing numbers poll-by-poll off-page

When asked to demonstrate the exact arithmetic behind a headline figure,
DON'T hand-reimplement the estimator — run the committed one with a dump
appended, so the working is the shipped code's own:

1. `git show HEAD:.build/newtracker/gen-data.mjs > <scratch>/gen-data.mjs`
   and same for `flows.mjs` (its only import). ALWAYS the HEAD copy — the
   working tree may carry sibling-session WIP in gen-data.mjs.
2. Scratch dir must live INSIDE the workspace (BOGAN refuses /tmp edits);
   e.g. `.matilda/scratch-hw/` — untracked. Delete it when done (`git
   status --porcelain` confirms the tree is back to its prior state).
3. Patch in the copy: `const ROOT = "<abs repo path>"` (it derives ROOT
   from its own location) and point `DATA_ASSET`/`CYCLE_SOURCE_ASSET` at
   /tmp paths so the run writes nothing real.
4. Append a dump routine at the END of the file — all estimator consts are
   module scope (`tppRows`, `houseEffect`, `primaryRows`, `primaryHE`,
   `heV`, `rowN`, `share2pp`, `midMs`, `ddays`, `HL_WINDOW`, `HL_HALF`,
   `LN2`, `hlNow`, `aggPrimary`, `MONTHS`, `ymMidMs`…), so plain top-level
   code after the final `console.log` can re-walk the window rows exactly
   as the estimator did and print per-row: n, published pair, rebased x,
   lean, x_adj, d, m, w, w·x, then Σw / Σwx / Σw² against `hlNow` and
   `aggPrimary[last]`.
5. Verify the reproduction lands on the DEPLOYED figures before presenting:
   `grep -o '"alp2pp":[0-9.]*' .build/newtracker/assets/9f09dca2-*.js`.
6. Present the table with this skill's unit conventions (n = published eff
   n ×1.6 where filed; w = n·2^(−d/7)·t(d)÷√m, t(d) the day-14→21
   half-cosine taper; undecided-inside pairs rebased
   first — worked example: Essential printed 45–50 (sums 95) → enters as
   47.37; Morgan's 3 window waves count √3).

Worked session (Sep 2026): window midpoints 10–31 Aug, 6 polls → 2PP
51.078→51.1; August primary month, 13 polls (Morgan √5, Newspoll/YouGov
√2) → 27.830→27.8, five-party drift check 0.02 < 0.5 → no rescale fired.
