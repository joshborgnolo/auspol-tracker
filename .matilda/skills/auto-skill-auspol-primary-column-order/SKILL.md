---
name: auspol-primary-column-order
description: auspol-tracker — the Latest/All-polls tables' primary facet has a DATA-DRIVEN column order (shipped 2026-09-19, bfb4037): gen-data.mjs walks aggPrimary with PRIMARY_DEADBAND=1.0 (adjacent-swap passes, strict > — the rivalLead overtake rule cloned) and emits latest.primaryOrder; BOTH renderers (PollsterTable in a11e1559 + AllPollsView in d1a1d215) map it through a DUPLICATE PCOLS def that must be edited together (presentation travels with the column; OTH ranks too, user-adjudicated, but stays muted/hide-md/non-sortable). Fixture test test-primary-order.mjs replays the walk verbatim — keep them in step. CSV export, snapshot chips, hero and the ss-primary static table deliberately stay FIXED-order.
source: auto-skill
extracted_at: '2026-09-19T00:00:00.000Z'
---

# Primary-vote column order is computed, not hardcoded

Shipped 2026-09-19 as commit `bfb4037` (with the RedBridge/Accent rename
and the past-cycle legend year compression). Before this, both poll
tables rendered the primary facet as a hardcoded ALP · L/NP · GRN · ON ·
OTH block.

## The rule (same deadband as the hero matchup)

- `gen-data.mjs`: `PRIMARY_DEADBAND = 1.0` walk immediately after the
  `rivalLead` IIFE (~:1712-1738 pre-bfb4037 numbering; `RIVAL_DEADBAND`
  itself is ~:1691 — read that comment block first, the walk clones it).
  Starts from `PRIMARY_KEYS = ["alp","lnp","grn","onp","oth"]` (:538),
  walks the monthly `aggPrimary` rows, skips months where any of the
  five is null, and runs bottom-up adjacent-swap passes until a full
  pass makes no swap. A party overtakes the one above it only when its
  aggregate leads by strictly MORE than one point (`>` not `>=`).
  Pure function of the data — every build reproduces the same order.
- Emitted as `primaryOrder` inside `latest` (right after `rivalLead,`),
  so it ships in the `9f09dca2-*.js` data asset. Any gen-data change
  regenerates that asset — co-stage it with the source at commit time,
  and `git status --short -- assets/` after EVERY rebuild (the
  cycle-source sidecar hash can roll independently; see
  auspol-build-pipeline).
- Order at ship time: **ALP · ON · L/NP · GRN · OTH** — ON 27.5 led
  ALP 27.3 by only 0.2 (inside the deadband, so ALP kept first) but
  cleared L/NP 21.1 by a mile; GRN 12.7 v OTH 11.2 stayed put.

## The two renderers (edit together)

There is NO shared component. Each renderer holds its own copy of
`pOrder` + the `PCOLS` presentation map, a `pOrder.map` in the thead
and one in the row cells; the d1a1d215 copy carries a "these two move
together" comment. Same dual-home hazard as the pollster-name cell
(auto-skill-auspol-pollster-cell) and the meta band
(auto-skill-auspol-detail-meta-band).

- `a11e1559-…js` PollsterTable: defs after its FACETS const (~:2904),
  thead `pOrder.map` with `<SortTh label sortKey={c.k}>` (~:2971), row
  cells reading `r.p[id]` (~:3032).
- `d1a1d215-…js` AllPollsView (archive): same trio after its 4-facet
  FACETS (~:4096), thead with `<ArchSortTh k>` (~:4735), cells reading
  `p.p[id]` (~:4823). `colCount = facet === "primary" ? 10` unchanged.
- `PCOLS[id]` holds label / sortKey / style / class per party:
  ALP and L/NP get `color: var(--<party>-text), fontWeight: 600`; OTH
  is `muted hide-md` and renders as a plain `<th scope="col"
  className="hide-md">` — the residual stays **non-sortable** even
  though it reorders with the parties (explicit user adjudication:
  nothing is pinned, all five rank by aggregate).
- Fallback `(D.latest && D.latest.primaryOrder) || PRIMARY_KEYS order`
  keeps old cached data assets renderable.

## The contract test

`.build/newtracker/test-primary-order.mjs` — in the package.json `test`
chain between `test-np-score.mjs` and `sim-next-polls.mjs`. Loads the
`9f09dca2` asset via `new Function("window", src)(win)` (the
repo-standard fixture pattern), replays the walk **verbatim** against
`aggPrimary`, and asserts the emitted `latest.primaryOrder` exists, is
a permutation of the five keys, matches the walk exactly, and leaves no
adjacent pair inverted by more than the deadband on the latest month.
Prints a `column order: …` report line — check it against expectation
whenever the aggregates move. If you change the rule in gen-data.mjs,
port the change into the test's replica; a divergence fails loudly,
which is the point.

## Deliberately NOT data-driven (scope)

The user asked only for "the all polls and latest polls table when
primary vote is selected". These stay canonical fixed-order on purpose:
the CSV export column order, the snapshot primary chips, the hero, and
`buildStaticSummary()`'s `ss-primary` static table in build.mjs
(auto-skill-auspol-static-summary-tables). Don't "helpfully" wire
`primaryOrder` into them.
