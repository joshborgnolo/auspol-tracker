---
name: auspol-vote-by-group-all-voters-anchor
description: auspol-tracker — The vote-by-group panel ("Who votes for whom", formerly "The vote by age, gender and education") anchors on the QUOTED primaries verbatim (§7g, gen-data.mjs); never rescale the anchor to 100. History: until 9cd65cd the panel ran primaryNow / each month's aggPrimary through demoNorm (rescale to 100), so its All-voters row and dashed monthly line read +0.1 above the hero and the primary chart on the biggest parties. That was the RESCALE (the quoted sets sum to ~99.7 by design), not double rounding. A build guard now throws on any drift. Includes the window.AUSPOL node probe for payload questions. ALSO: the groups' sentence-form names live in TWO maps (RD_DEMO_SHORT in rd-panels + DEMO_WHO in the a11e asset) must move together (TAFE wording unified 769211f); the short label itself is a §7g data key, never rename it.
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
- Per-month GROUP series: `D.demographics.tabs[].sets[].groups[].monthly`
  rows are `[ym, …5 shares in DEMO_KEYS order, …5 95%-margins]` — there is
  NO per-month group n (an earlier reading said row[11] was n; the row is
  11 long and `row[11]` is undefined). Weight a trend fit by the party
  margin's precision (margin floored at 0.5, se = margin/1.96, w = 1/se²).
  The input for any trend analysis (see auto-skill
  group-trend-proportionality) — and the panel's trend sentences stopped
  being hand numbers the day §7gb shipped (2026-09-29): gen-data's
  `demoTrend` payload emits the combos significant on both the
  absolute-gap and the log-ratio slope, and the Who-votes trend block
  composes its title and dek from that list.
  Each group also carries pooled `v[party]`, `ci[party]`, `n`, `houses`.
- `oth` rides the full payload end-to-end (25/25 groups carry pooled
  `v.oth` + `ci.oth`, monthly rows included) and joined the panel as a
  fifth chip ("Others", 69f467e, 2026-09-29): `DEMO_PARTIES` is now the
  5-chip array and `RD_DEMO_HOME.oth` is curated (see
  auspol-vote-by-group-headlines for both, and for oth's running-prose
  name "others/independents"). The renderer itself is party-agnostic.

To A/B a gen-data change without touching the shared tree:
1. Copy `.build/atomic-write.mjs` and `.build/newtracker/*.mjs` into a
   scratch dir with the same layout.
2. Symlink `data/` into it.
3. Run gen-data there. It writes only to the copy's `assets/`.

## Group labels: TWO sentence-form expansion maps (drift trap)

The group's short label (e.g. `"TAFE or trade"`) is a DATA key — gen-data
§7g weights maps and the crosstabs consumers match on it. Never change the
key. Changing how the group is NAMED IN SENTENCES requires editing two
independent maps in two assets, or they drift:

- `RD_DEMO_SHORT` in `assets/rd-panels.jsx` (~:977) — the snapshot panel's
  "who" phrasing, short noun forms.
- `DEMO_WHO` in `assets/a11e1559-….js` (~:2146) — the poll-detail ledger's
  "who" phrasing, fuller forms.

They can legally differ in register (e.g. "men" vs "men and women"), but a
wording the user asks to change must move in both. Worked example
2026-09-28 (commit 769211f): the TAFE group's sentence form lived as
"TAFE or trade graduates" in RD_DEMO_SHORT and "voters with a TAFE or
trade qualification" in DEMO_WHO; unifying to "TAFE- or trade-qualified
voters" meant one line in each map (~140 chars total), then rebuild and
grep `index.html` for both old and new strings — the built file holds one
copy per map, so 2 matches for the new string = both landed.

Also greppable: the answer to "where is group X's name?" is `grep -rn
'"<label>":' .build/newtracker/assets/*.jsx .build/newtracker/assets/*.js
--include='rd-*'` — the maps are the only copy homes for these labels
(template.html/build.mjs answer with nothing).

## Vote softness/certainty is NOT a group cut here (glossary slip, fixed 218286e)

The panel's universe is exactly DEMO_SETS in `demo-groups.mjs`: 8 sets,
25 groups (age, generation, gender, education, state, location, housing,
language). RedBridge's vote-softness split (Solid / Soft / Very soft —
"certain of the choice … may change … only named when pressed") exists in
the data but lands NOWHERE in this panel:

- `data/demographics.json` waves carry a raw `"softness"` dim (Solid, Soft,
  Very soft rows) — stored verbatim but `harmonize()` in demo-groups.mjs
  deliberately maps no softness key, so §7g never sees it.
- The certainty figures users DO see are the SEPARATE firmness panel
  ("How firm each party's vote is", gen-data §5c2 ~:1631; polls.json
  `firmness` field; copy "Share of each party's voters certain of their
  vote" in the a11e1559 asset ~:1561). One house (RedBridge, pooled 3
  waves), quoted as the solid share per party — not a breakdown cut.

Worked correction (2026-09-29, 218286e): the glossary entry
`id: "vote-by-group"` ("Breakdowns by group") claimed certainty in TWO
spots — the opening enumeration "…and how certain of their choice they
are – says it will vote" and the "Which pollsters count where" paragraph's
trailing "Softness of the vote … is RedBridge's own question" sentence,
which sat in a list whose every other item IS a pooled cut. User: "that's
wrong, that's not in Who votes for whom." Both removed; rebuilt. Lesson:
when glossary copy enumerates what a panel shows, check it against
DEMO_SETS (or the panel's own section) — a nearby panel's datapoint can
drift in. If ever asked to ADD a certainty breakdown, that's a new
DEMO_SETS set + harmonize mapping, and note the pooling principle
(single-house cuts can't pool; softness is RedBridge-only).
