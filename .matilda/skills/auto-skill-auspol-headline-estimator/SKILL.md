---
name: auspol-headline-estimator
description: auspol-tracker — where each CURRENT headline number actually comes from in gen-data.mjs. ALP 2PP = nowcastAdj over the trailing 21d window (wᵢ = nᵢ·2^(−d/7)÷√m, undecided-inside pairs rebased to 100 by share2pp, lean read at refNow = latest poll's fieldwork end, empty-window falls back to last monthly point). ALP primary/DISPLAYED current primary shares = LAST POINT of aggPrimary = current month-to-date (monthWithSe, NO recency term, lean at month midpoint, five parties rescaled only when the debiased total drifts >0.5pt from the plain-mean total). House effect = ±28d consensus window (≥3 neighbours), pooled 90d half-life, shrunk sw/(sw+8), read as-of-date per measure. Primaries-through-flows is the synthetic DIAGNOSTIC (tppRowsSynth/synthEffect), never the headline. Needed before editing methodology/hero/glossary copy about "how the number is calculated" (worked example: glossary d960b2d).
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
  days before `ref`. Weight `w = rowN(p) · 2^(−d/HL_HALF) ÷ √waves`,
  `HL_HALF=7`, d = age in days from ref; `x = published − heV(he,firm,ref)`
  (lean read AT the reference). Called as `headlineTpp(refNow)` (:1086)
  with `refNow = LATEST_ISO` = the latest poll's fieldwork END. Emitted as
  `latest.alp2pp` / `latest.lnp2pp = 100−alp` (`latest` ~:1130).
  **Empty window → falls back to the last `agg2pp` monthly point.**
- **`effByKey` (§3b, after `alt2pp`) — per-poll LEAVE-ONE-OUT deltas**
  re-run the same nowcast calls minus one row for the "Effect on …
  aggregate" lines in the expanded poll detail. Same estimators, read at
  the same `LATEST_ISO` ref; house effects are NOT re-estimated. Full
  map: auto-skill-auspol-poll-aggregate-effect.
- **`monthWithSe(rows, he, ym)` (~:361) — monthly trend points AND the
  current ALP primary.** Same estimator with the recency term DROPPED:
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
  neighbours, same-stratum only); pooled with `HE_HALF=90`-day half-life;
  shrunk toward zero by `sw/(sw+SHRINK_K)`, `SHRINK_K=8`; **per measure**
  (tpp, each party's primary, leadership…) and **read as-of-date** —
  `he.at(firm, t)` is the lean at t, so a mid-cycle method change settles
  in ~2 months. A stopped house's lean decays back to 0.

## Where the page reads them (consumers to check before copy edits)

- `latest.alp2pp` / `lnp2pp` → hero 2PP headline, `latest.method`
  (~:1130) carries the published constants {windowDays 21, halfLifeDays 7,
  shrinkK 8}; `latest.alp2ppCi95` is SHARE-scale (see
  auto-skill-auspol-ci95-scales before using it beside a LEAD).
- "Current ALP primary" shown anywhere = **last `aggPrimary` point**
  (month-to-date aggregation, NOT a nowcast): GlyphDial bars
  `73de0c58…js :44`, primary-chart latest label `a11e1559…js :188`,
  `infoTerms` `d1a1d215…js ~:3880` (`const L = D.latest, prim =
  D.aggPrimary[len-1]` — glossary entries interpolate these live).
- There's **no primary nowcast** — the asymmetry (2PP = 21-day nowcast,
  primary = current calendar month to date) is deliberate and is what the
  Weighted-aggregate glossary entry's two walkthrough paragraphs describe.

## Voice check for copy (committed reference: d960b2d)

Methodology text overclaims when it says "renormalised" (only >0.5 drift),
says "weekly Morgan counts once" (it counts √waves, ~1.7×), or implies the
implied-2PP line feeds the headline. The glossary main definition quotes
the full formula; the two `.info-p` paragraphs under it walk the primary
and 2PP applications and print the live figures (`{prim.alp.toFixed(1)}`,
`{L.alp2pp.toFixed(1)}–{L.lnp2pp.toFixed(1)}`).

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
  - `primary`: all POLLS rows in `ym = MONTHS[last]` with a per-row
    `crossed: true` flag when the midpoint's calendar month ≠ ym (drives
    the conditional "a wave joins the month its fieldwork ended in" note
    in the glossary); five-party check calls `monthWithSe` per party on
    `primaryRows[k]`/`primaryHE[k]` and emits
    `{ym, ymLabel, rows, sw, swx, mean, plainMean, parties, plainTotal,
    adjTotal, rescaled, v}`.
  - **Self-check at build time**: `console.warn` fires if
    `showWorking.tpp.v !== hlNow.alp` or the primary v ≠
    `aggPrimary[last].alp` — drift means the replication diverged from
    the real estimator; fix §8b, never the estimator.
- Emitted as `const showWorking = …;` in the payload template (after
  `latest`), so the renderer reads `D.showWorking`.
- Renderer: `primWork`/`tppWork` JSX blocks in `infoTerms(D)` inside the
  `weighted-aggregate` entry (d1a1d215 asset ~:3896+), styled
  `.info-work` in template.html (tabular-nums, 12.5px, right-aligned
  numerics, `.info-work-sum` totals row, `.info-work-note` caption).
  Columns: primary 9 (Pollster/Fieldwork/Mid/Published/lean/xᵢ/nᵢ/m/wᵢ),
  tpp 11 (adds "of pair" rebased share + d).
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
   n ×1.6 where filed; w = n·2^(−d/7)÷√m; undecided-inside pairs rebased
   first — worked example: Essential printed 45–50 (sums 95) → enters as
   47.37; Morgan's 3 window waves count √3).

Worked session (Sep 2026): window midpoints 10–31 Aug, 6 polls → 2PP
51.078→51.1; August primary month, 13 polls (Morgan √5, Newspoll/YouGov
√2) → 27.830→27.8, five-party drift check 0.02 < 0.5 → no rescale fired.
