---
name: auspol-vote-by-group-all-voters-anchor
description: auspol-tracker — The vote by age, gender and education anchors on the QUOTED primaries verbatim (§7g, gen-data.mjs); never rescale the anchor to 100. History: until 9cd65cd the panel ran primaryNow / each month's aggPrimary through demoNorm (rescale to 100), so its All-voters row and dashed monthly line read +0.1 above the hero and the primary chart on the biggest parties. That was the RESCALE (the quoted sets sum to ~99.7 by design), not double rounding. A build guard now throws on any drift. Includes the window.AUSPOL node probe for payload questions.
source: auto-skill
---

# The vote-by-group panel's All-voters anchor

## Rule

The All-voters row and the dashed all-voters line ARE the site's quoted
figures: `latest.primary` (§7e `primaryNow`) and `aggPrimary` month by
month. The panel builds every group as anchor + pooled gap, so the anchor
must be those figures exactly, never a rescaled copy. The row's tooltip
("the headline's own estimate") and the Info entry ("added to the site's
current figure for all voters") both promise this.

## History: the +0.1 (diagnosed and fixed 2026-09-23, commit 9cd65cd)

- The user asked why the All-voters row read the primaries +0.1. Quoted
  §7e set {ALP 26.8, LNP 21.2, ON 27.3, GRN 13.2, OTH 11.2} sums to 99.7.
  The row read {26.9, 21.3, 27.4, 13.2, 11.2}.
- Mechanism: `ALL = demoNorm(primaryNow)` rescaled the set to 100, which
  lifts each party by 0.3% of its share: +0.06 to +0.08 on the big three
  (rounds to +0.1) and ~0.04 on Greens and Others (rounds away).
- It is NOT double rounding. The first diagnosis said it was, and that is
  wrong. With the unrounded §7e values (adj total 99.74) the rescale still
  reads +0.1 on three parties. Rounding only decides which parties tip.
- Why the sets sum short of 100: §7e and aggPrimary debias each party on
  its own house effects and renormalise only when the adjusted total
  drifts more than 0.5 from the plain total, and then to the plain total,
  not 100. aggPrimary's comment gives the reason: "a genuine
  undecided-driven shortfall isn't papered over". Monthly totals run
  99.7–100.6. Don't "fix" this by forcing the headline to 100: that
  changes the site's main figures, and rounded shares still wouldn't
  always sum to exactly 100.
- The same drift came back within the hour. Sibling commit 7a61bb6 added
  the monthly lines with `allByYm = … demoNorm(d)`, so the dashed line
  differed from the primary chart by 0.1 in 20 of 80 party-months.

## The fix (9cd65cd), and what it guarantees

- `ALL = pick(primaryNow)` and `allByYm = … pick(d)`: the five keys
  verbatim, no rescale.
- A poll's gaps sum to zero, since its group shares and its total both go
  through demoNorm first (that use of demoNorm is legitimate: crosstabs
  may carry undecided). So each group sums to its anchor's total. The
  final rescale (current `ALL_T * raw / t`, monthly `T * v / mt`) only
  bites when a share is clamped at 0, and then goes to the anchor's
  total, not 100.
- Effect at the time: 35 of 60 current group figures dropped 0.1 (none by
  more); group totals 99.6–99.8. Gaps and ± margins were unchanged, and
  so was the rest of the bundle.
- Guard (right after the `demographics` IIFE): throws if `all` differs
  from primaryNow or any `allMonthly` month differs from aggPrimary. It was
  tested against both regressions ("at now"; "at 2025-07 … 2026-09").
  If you touch §7g, keep it passing. Don't loosen it.

## Payload probe: window.AUSPOL under node

Load the REAL BUILT data bundle without a browser:

```js
globalThis.window = {};
await import("./.build/newtracker/assets/9f09dca2-….js");   // data asset
const D = window.AUSPOL;          // NOT window.AP – the asset sets window.AUSPOL
D.latest.primary                  // §7e quoted set
D.demographics.all                // vote-by-group All-voters anchor (== latest.primary)
D.demographics.allMonthly         // [ym, …DEMO_KEYS order] (== aggPrimary per month)
D.aggPrimary.at(-1)               // monthly chart series (separate series!)
```

Gotchas:
- Run from the repo root so the relative import path resolves. The repo
  dir's space %-escapes in module URLs, which is normal.
- `current.primary` does NOT exist. The quoted set lives at
  `D.latest.primary`.
- aggPrimary is the monthly chart series. Don't mistake it for the
  current figures (the §7e comment says exactly this).
- `demographics.order` is DEMO_KEYS (alp, lnp, onp, grn, oth). That is
  NOT PRIMARY_KEYS order (alp, lnp, grn, onp, oth), and not the per-poll
  `grp.v` order (alp, lnp, grn, onp, oth).
- To grep healed rows byte by byte instead, see
  auto-skill-auspol-bundle-data-probe.

To A/B a gen-data change without touching the shared tree:
1. Copy `.build/atomic-write.mjs` and `.build/newtracker/*.mjs` into a
   scratch dir with the same layout.
2. Symlink `data/` into it.
3. Run gen-data there. It writes only to the copy's `assets/`.
