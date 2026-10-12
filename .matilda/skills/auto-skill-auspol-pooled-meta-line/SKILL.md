---
name: auspol-pooled-meta-line
description: auspol-tracker — the "Pooled from the last six weeks of ‹houses› polls" meta lines by the Primary-vote (group mode) and Who-votes-for-whom sections, and the Issues/Health-panel after-text. Rendered, never hand-written: window label comes from gen-data's SPARSE_K.label at render time, house list per group per build from in-window waves. Worked 2026-10-09 (user: "is this line … updated?"). Read this before "edit the copy" or "is the line stale" questions; for why a wave counts in the pool, see auspol-vote-by-group-pool-membership.
source: auto-skill
extracted_at: '2026-10-09T03:35:22.417Z'
---

# "Pooled from the last … of … polls" meta lines — generated, not copy

Asked 2026-10-09: "is this line by the 'Primary vote' header updated?" — the
rendered "Pooled from the last six weeks of YouGov and Roy Morgan polls". Yes:
it is ASSEMBLED, and it re-derives on every build from current data.

## The three render sites (same sentence, one family)

1. **Primary vote panel, group mode** — `rd-panels.jsx:278` (the `rd-pv`
   component, `G` truthy when a demographic group is selected):
   ```js
   const meta = G
     ? "Pooled from the last " + T.window + " of " + rdList(G.houses.map(demoHouse)) + " polls"
     : …D.latest.pollsTracked " national polls…" // the all-voters variant
   ```
   `T = D.demographics` (rd-panels.jsx:70). House list per GROUP.
2. **Who votes for whom section header** — `rd-panels.jsx:2576`:
   `meta={"Pooled from the last " + T.window + " of " + rdList(T.houses.map(demoHouse)) + " polls"}`
   House list is the WHOLE SET union.
3. **Panel after-text / Health → Issues** — the `a11e1559` asset `Houses`
   component (~:2525, ~:2879): `${name}'s share … pooled from the last
   ${T.window} of polls` / Issues' `pooled from the last ${I.window}`.

The mirrors on /vic/ come from the same generator — grep both
`index.html` and `vic/index.html` when confirming a built result.

## What fills the blanks

- **`T.window`** — `SPARSE_K.label` = `"six weeks"`, emitted once per data
  bucket by gen-data.mjs (~:336-337: `SPARSE_WINDOW = 2*HL_WINDOW`, i.e. the
  headline window doubled; emitted at ~:2689 for the One-Nation-split block,
  ~:3662 for the demographics `window:` key, ~:4077/:4088 issues).
  To CHANGE the wording, change `SPARSE_K`, never the JSX string.
- **`G.houses` / `T.houses`** — computed in gen-data §7g per group/set as the
  union of firms whose waves sit inside the window (see
  auspol-vote-by-group-pool-membership for the window rule: fieldwork
  MIDPOINT vs `refNow` = newest poll's date — never wall-clock today). So a
  state group with few cuts shows 2 houses ("YouGov, Roy Morgan"), an
  age/education group 3–4 ("Essential, YouGov, Resolve, DemosAU"), a
  location cut 3 ("RedBridge/Accent, YouGov, DemosAU"). The list legitimately
  differs per group AND per tab.
- **Roy Morgan appears** in state-group lists — it's the hand-entered wave
  system (auspol-demographics-hand-entry), not a pipeline feed.

## Verifying "is the line current" (the worked recipe)

```bash
# 1. The window label is where the data is, not the app code:
grep -n '"window": "six weeks"' index.html   # blocks at ~33957 / ~34830 / ~39082 / ~40555
# 2. House rosters differ per group — diff against expectation, don't guess:
sed -n '34830,39080p' index.html | grep -n '"houses": \[' | sort | uniq -c
# 3. Check the newest wave is on the live build:
git show origin/main:index.html | grep -c '29 Sep–6 Oct'   # newest wave label
git show HEAD:index.html       | grep -c '29 Sep–6 Oct'
# 4. Build freshness: the last commit touching index.html
git log -n 1 --format='%h %ad %s' --date=short -- index.html
# 5. data recency: newest polls.json wave (this answers "how fresh can it be")
node -e "const p=require('./data/polls.json');console.log(p.polls.slice(-3).map(w=>w.pollster+' '+w.date))"
```

Caveats from 2026-10-09: the repo shared-tree race is real — local main was
ahead 2 / behind 1 of origin/main, and `data/polls.json` +
`data/demographics.json` had uncommitted edits, so a still-fresher line can
exist locally than on origin, or vice versa (see
auspol-stale-main-reconcile). The site the user sees is always the ORIGIN
build; compare against `git show origin/main:index.html`, never localhost.

## What NOT to do

- Don't hand-edit the meta string in rd-panels.jsx to "fix" a house list —
  the names are data. If a house is missing from a group, the missing piece
  is a wave inside the six-week window (see the pool-membership skill), or
  the group isn't in that house's crosstabs at all.
- Don't rename the "six weeks" phrasing per-panel — `SPARSE_K.label` is the
  single source and it also feeds the Health/Issues and Decidedness panels.
- The ALL-VOTERS Primary-vote header shows a different meta
  (`D.latest.pollsTracked … "polls since the … election"`) — same site,
  different sentence; don't confuse its house-less form with a bug.

Related: auspol-vote-by-group-pool-membership (why a wave is in a group
pool), auspol-house-credit-lists (the OTHER house roster on three panels,
6-month recency), auspol-bundle-data-probe (where the emitted block lives
in the built bundle).
