---
name: auspol-pollster-cell
description: auspol-tracker — the pollster-name cell JSX lives in TWO renderers that must be edited together (PollsterTable in a11e1559 ~:2671 + archive AllPollsView in d1a1d215 ~:2921); shared PollsterName/MethodLink components are defined once in a11e1559 ~:1610-1640. Order is name → client → APC-methodology link since 5759f68. Cell anchors must e.stopPropagation() (rows are click-to-expand). Grep lesson: assets embed the whole dataset, so grep JSX label text ('APC methodology') or class names ('pollster-cell'), never bare 'APC'.
source: auto-skill
extracted_at: '2026-09-02T03:05:52.152Z'
---

# auspol-tracker: the pollster-name cell (structure, not type sizes)

Type sizes for the tables live in template.html — see auspol-poll-table-typography.
THIS skill is the JSX/structure map of the first column.

## Two cell sites — edit both or the tables disagree

- **Latest polls**: `PollsterTable` in `a11e1559-f455-…js` ~:2671-2675.
- **All polls archive**: `AllPollsView` in `d1a1d215-370c-…js` ~:2921-2927.

Both render `<td className="ta-l pollster-cell">` from the same shared components, and the
archive carries a JSX comment asserting its order matches the Latest table — if you change
one cell, mirror it in the other and update that comment. The archive cell also appends
`.poll-tags` p-tags after the sub-lines; the Latest cell does not.

Cell order since 5759f68 (2026-09-02, user-requested flip):
`PollsterName` → `<span class="pollster-mode">{client}</span>` → `MethodLink`.
Was: name → link → client. The commissioner/publisher (the poll's `client` field) now sits
directly under the pollster name, the APC link below it.

## Shared components — defined ONCE in a11e1559

- `PollsterName({name,url})` ~:1610 — the name IS the release link when a citation exists
  (`.pollster-name.pollster-link`, `plink-mark ↗`), plain span otherwise.
- `MethodLink({url})` ~:1628 — `.pollster-method` anchor reading `APC methodology ↗`;
  returns null without `methodUrl`, so only YouGov/Newspoll waves ever show it
  (stamped by extract-sampleeff.mjs). NOT `<PdSec label="APC methodology statement">`
  (~:1991) — that's the expanded poll-detail panel, a separate site.
- Both anchors call `e.stopPropagation()` — table rows are click-to-expand, so a click on
  any cell anchor must not toggle the row. Keep that on any new anchor you add to the cell.

## CSS hooks (template.html; sizes may have moved — grep the class)

`.pollster-cell` line-height ~:1724; `.pollster-mode` block 12px ink-3 ~:1755;
`.pollster-method` block margin-top 1px, 11px, no-decoration + hover underline/focus ring
~:1759-1762; phone `.poll-table.archive` overrides 11px/10px ~:3454-3455. Making the
sub-lines inline vs stacked is pure CSS here (both are `display: block`).

## Grep lesson (context floods)

Every asset JS inlines the poll dataset, so `grep APC` returns hundreds of per-poll JSON
`methodUrl` values. Grep the JSX label text (`APC methodology`) or the class
(`pollster-cell|pollster-mode`) — finds the renderer immediately. `client` as a word also
hits getBoundingClientRect etc. — anchor on the component/class names instead.

## Procedure (proven at 5759f68)

1. Edit BOTH cell JSX blocks (and the match-order comment in d1a1d215).
2. `node .build/newtracker/build.mjs` — these layers inline into index.html, no new hashed
   asset file; expect the diff to be exactly the two compiled `React.createElement` sites
   (`PollsterTable` + `AllPollsView`).
3. `node .build/newtracker/validate.mjs`; stage only the two asset files + index.html with
   explicit paths (repo shared with other sessions); commit; push.
