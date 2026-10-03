---
name: auspol-primary-column-order
description: auspol-tracker — the Latest/All-polls tables' primary facet has a DATA-DRIVEN column order (shipped 2026-09-19, bfb4037): gen-data.mjs walks aggPrimary with PRIMARY_DEADBAND=1.0 (adjacent-swap passes, strict > — the rivalLead overtake rule cloned) and emits latest.primaryOrder; BOTH table renderers (PollsterTable in a11e1559 + AllPollsView in d1a1d215) map it through a DUPLICATE PCOLS def that must be edited together, since ac625e2 (2026-10-03) the All-polls house-lean/tab measure row (rd-allpolls.jsx hlViews) spreads the SAME emission after its pinned Two-party/split pair, since 9b5e9b9 (2026-10-03) the RdPolls "Latest and next polls" primary facet (rd-polls.jsx plParties) ranks row values + figure-head ladder + expanded detail figures by it too, AND since 02cf021 (2026-10-03) the redesign All-polls tab's OWN primary facet (rd-allpolls.jsx RdAllPolls prims via RD_AP_PRIM_META/RD_AP_PRIM_FALLBACK/rdApPrimList) ranks its colHead ladder, row figures/aria, phone cards and month-row figures+rings by it — and a same-day follow-up (2026-10-03, user call: the expanded poll's primary order "should be the same as the poll row order") pulled the last FOUR value-sort/legacy holdouts onto the walk with it: RdApDetail's primary ladder, its modelled-seats sentence, the row's primary dot strip and the issues ownership dots (all rd-allpolls.jsx). EVERY party-primary listing site-wide now rides the walk. Fixture test test-primary-order.mjs replays the walk verbatim; probe .matilda/probe/ap-prim-detail-order.mjs pins row/aria/dots/detail-ladder/seats order against it — keep them in step. CSV export, snapshot chips, hero and the ss-primary static table deliberately stay FIXED-order.
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

## The third consumer: house-lean measure tabs (ac625e2, 2026-10-03)

The All-polls house-lean section's measure-tab row (`RdHouseLean`
hlViews in `rd-allpolls.jsx`, ~:2317) joined the emission when the
user asked for "the rest … ordered by primary vote, largest first".
After the pinned Two-party + One Nation–Coalition split pair, the five
party tabs spread `latest.primaryOrder` through a small
`HL_LABELS = { alp: "Labor", lnp: "Coalition", … }` map — so tab row,
Latest table and All-polls table can never show different orders, and
a primary-vote crossing via the walk moves all three together. Key
shape note: the hlViews ids ARE the PRIMARY_KEYS strings (`alp`, `lnp`,
`grn`, `onp`, `oth`), which is why the reuse type-checks at all.

Same fallback contract as the renderers, but spelled: a missing
payload or ANY unknown key in the order reverts the whole row to the
previous static order — never partially, so a drift can't hide a tab.
gen-data's walk comment block (see below) names every consumer;
change the walk and every surface moves.

Probe `.matilda/probe/hl-tabs-scroll.mjs` pins the WIRING, not the
day's data: it loads the same `9f09dca2` data asset with the
repo-standard `new Function("window", src)(world)` fixture pattern,
re-derives its expected label row from `world.AUSPOL.latest.
primaryOrder` (hard `die2` if missing/unknown keys), and asserts the
rendered tab labels equal it at every width rung — a future crossing
moves the tabs AND the expectation in lock-step, and a broken wire
fails loudly. Copy this pattern for any other probe that might
otherwise freeze a data-dependent order into a constant. Order at
ac625e2: alp · onp · lnp · grn · oth (One Nation had crossed the
Coalition — the first order a static list could not have produced).

- `a11e1559-…js` PollsterTable: defs after its FACETS const (~:2904),
  thead `pOrder.map` with `<SortTh label sortKey={c.k}>` (~:2971), row
  cells reading `r.p[id]` (~:3032).
- `d1a1d215-…js` AllPollsView (archive): same trio after its 4-facet
  FACETS (~:4096), thead with `<ArchSortTh k>` (~:4735), cells reading
  `p.p[id]` (~:4823). `colCount = facet === "primary" ? 10` unchanged.

## The fourth consumer: RdPolls "Latest and next polls" primary facet (9b5e9b9, 2026-10-03)

The user call: "the primary votes in primary view of the polls tables
should also be so ordered: by current primary vote site aggregate
ranking. Currently it goes Labour Coalition Greens one nation other,
which is unprincipled." RdPolls' fixed `RD_PL_PARTIES` ladder was the
last primary party-listing still hardcoded.

- `.build/newtracker/assets/rd-polls.jsx` — the old
  `const RD_PL_PARTIES = [["alp","ALP"],…]` def (~:10) split into
  `RD_PL_LABEL = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON",
  oth: "OTH" }` (id→label lookup ONLY) + `RD_PL_FALLBACK =
  ["alp","lnp","grn","onp","oth"]` (drift-only ladder if the emission
  is ever absent).
- Inside `RdPolls({…})` after `const { D } = window.AP;`:
  `const plParties = ((D.latest && D.latest.primaryOrder) ||
  RD_PL_FALLBACK).filter((k) => k in RD_PL_LABEL).map((k) => [k,
  RD_PL_LABEL[k]]);` — **silent drop of unknown keys** (different from
  the house-lean row's revert-whole-row contract; here a bad key
  mis-ordering the ladder is the worse failure mode, and the filter
  can't hide a legitimate party because all five live keys are in
  RD_PL_LABEL by construction).
- THREE map sites rewired from `RD_PL_PARTIES.map` to `plParties.map`:
  the primary row values (~:188, `r.p[id]` read per id), the
  figure-head ladder `.rd-pl-prim rd-pl-primh` (~:235), and the
  expanded poll-detail figures `.rd-pld-prim` (~:369) — all three
  render [id, label] pairs, so the same tuple shape dropped straight
  in.
- gen-data's walk comment block (~:3398-3401) became a THREE-homes
  note (table columns + hlViews + plParties). Naming rule: the
  comment enumerates every consumer; add a consumer → grow the
  comment list in the same diff.
- Scope check ran before editing: `rd-panels.jsx` :67 has the same
  five-key literal but immediately `.sort((a,b)=>b.v-a.v)` by VALUE —
  it needs no change; CSV exports stay fixed (see "deliberately NOT"
  below). AND: `D.latest.primaryOrder` is not consulted anywhere else
  in rd-*.jsx after this commit — grep
  `grep -rn "primaryOrder" .build/newtracker/assets/*.jsx` to confirm
  the consumer count before naming it in the comment.
- `PCOLS[id]` holds label / sortKey / style / class per party:
  ALP and L/NP get `color: var(--<party>-text), fontWeight: 600`; OTH
  is `muted hide-md` and renders as a plain `<th scope="col"
  className="hide-md">` — the residual stays **non-sortable** even
  though it reorders with the parties (explicit user adjudication:
  nothing is pinned, all five rank by aggregate).
- Fallback `(D.latest && D.latest.primaryOrder) || PRIMARY_KEYS order`
  keeps old cached data assets renderable.

## The fifth consumer: redesign All-polls tab's own primary facet (02cf021, 2026-10-03)

The user's follow-up to 9b5e9b9: "Now do the same for the all poles
table primary facet" — the *redesign* All-polls tab (`rd-allpolls.jsx`
`RdAllPolls`) had kept its own hardcoded `RD_AP_PRIM = [["alp","ALP"],…]`
ladder. Mirrored the 9b5e9b9 rd-polls.jsx idiom exactly:

- The file-level def (:148-163) split into
  `RD_AP_PRIM_META = { alp: {lab, ink, dot}, … }` (presentation lookup
  ONLY — richer than rd-polls.jsx's label-only map because this facet
  colours dots) + `RD_AP_PRIM_FALLBACK = ["alp","lnp","grn","onp","oth"]`
  + a `rdApPrimList(ids)` helper (filters unknown keys to id→meta pairs,
  like rd-polls.jsx's silent-drop).
- One derivation inside `RdAllPolls` after `const pdx`:
  `const prims = rdApPrimList((D.latest && D.latest.primaryOrder) ||
  RD_AP_PRIM_FALLBACK);`
- The 11 consumers of the old ladder split by intent at ship time: six
  **display-order** sites rode `prims` (colHead figure ladder, row
  figures, row aria-label, phone cards, month-row figures + rings); five
  **value-sorted/positional** sites kept `RD_AP_PRIM_FALLBACK`
  (RdApDetail prim / seats, row dots, own-vote dots). The FIFTH consumer
  below joined the walk six hours later, so that split no longer exists —
  see the next section.
- gen-data's walk comment grew to a FOUR-surface note (the redesign
  All-polls primary facet named alongside hlViews, plParties and the
  table columns) — same naming rule as 9b5e9b9: enumerate every
  consumer in the comment in the same diff; grep
  `grep -rn "primaryOrder" .build/newtracker/assets/*.jsx` to confirm
  the consumer count first.

## The last four holdouts join (expanded detail + dots, 2026-10-03)

User call, same day: with the row ranked by the aggregate and its own
expanded card ranked by the wave's own figures, "what we have is
potentially two different orders… the expanded poll view order [should]
be the same as the poll row order." The site now has ONE rule — party
position = site aggregate position. Four sites moved off the
value-sort/legacy ladder (their `RD.AP_PRIM_FALLBACK` reads) onto the
walk, all in `rd-allpolls.jsx`:

- `RdApDetail` prim (:787): dropped `.sort((a,b)=>q[b.id]-q[a.id])`,
  ladder now `rdApPrimList((D.latest && D.latest.primaryOrder) ||
  RD_AP_PRIM_FALLBACK)` — D is `window.AUSPOL` inside the component, so
  RdApDetail re-derives; `prims` lives in RdAllPolls, out of scope.
- `RdApDetail` seats (:832): same emission replaces the frozen legacy
  `alp·lnp·grn·onp·oth` — it had been a THIRD order inside one card.
- Row primary dot strip (:1580) and issues ownership dots (:1682): both
  were `…FALLBACK…sort by own value` → now just the in-scope `prims`
  (ownership minus `oth`). Dots are position-indexed on the scale so
  the DOM order only changes PAINT order (who sits on top on a tight
  cluster: the walk's later parties now) and the aria sequence (which
  already rode prims at the row level since 02cf021).
- After the rewrite, `grep rdApPrimList(RD_AP_PRIM_FALLBACK)` returns
  ZERO — the FALLBACK constant is drift-only vocabulary again.
- Probe `.matilda/probe/ap-prim-detail-order.mjs` pins all of it against
  the bundle (figure slots, aria labs, dot DOM order, expanded ladder —
  requiring at least one DISAGREEING wave where the wave's own order
  differs from the walk — and the seats sentence label order).

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

The user has now widened the scope four times (house-lean tab row
ac625e2, RdPolls primary facet 9b5e9b9, redesign All-polls rows
02cf021, detail + dots this commit) — but each was an explicit call,
so these still stay canonical fixed-order until asked: the CSV export
column order, the snapshot primary chips, the hero, and
`buildStaticSummary()`'s `ss-primary` static table in build.mjs
(auto-skill-auspol-static-summary-tables). Don't "helpfully" wire
`primaryOrder` into them.
