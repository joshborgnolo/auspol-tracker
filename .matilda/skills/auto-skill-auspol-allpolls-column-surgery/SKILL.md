---
name: auspol-allpolls-column-surgery
description: auspol-tracker — adding or REMOVING a column in the All-polls table (worked 2026-09-29, commit d4a4862 — dropped the Issues facet's Net direction column). A column lives in FOUR homes across two renderers (redesign hrow th + rowFor cells + rd.css per-facet grid tracks; classic ArchSortTh + td + the colCount AND empty-state colSpan chains); the redesign row is a fixed-child-count grid so a removed cell becomes a placeholder span, and the classic colCount fallthrough hides per-facet counts until you make one explicit. Plus the hashed-asset "File not found" edit failure: re-glob and diff hash length before blaming a sibling rebuild.
source: auto-skill
extracted_at: '2026-09-29'
---

# All-polls table column surgery — auspol-tracker

Worked example: removing the Issues facet's "Net direction" column
(commit d4a4862, 2026-09-29). Every All-polls column exists in FOUR homes
across the TWO table renderers; removing cleanly means touching all four
and KNOWING WHAT TO LEAVE.

## The four homes of a column

1. **Redesign hrow** — `rd-allpolls.jsx`, the per-facet
   `{facet === "x" && <>…</>}` header group (`th("Label", "sort.key", …)`).
2. **Redesign rowFor branch** — `rd-allpolls.jsx` `} else if (facet ===
   "x") {` (~:1190-1370): the desktop `val`/`figs`/`pic` cells AND the
   phone `body` csubs are assigned here. Remove the cell assignment AND
   any now-unused `const d = p.<field>;` binding AND the phone-card
   `<div className="rd-ap-csub">` that renders the same datum.
3. **`rd.css` per-facet grid tracks** — `body.rd .rd-ap-c<facet> {
   grid-template-columns: … }` exists at THREE rungs: desktop (~:1675),
   ≤1240px (~:1895), ≤1000px (~:1906). Track count == row child count.
4. **Classic archive table** — the d1a1d215 asset: `<ArchSortTh …/>` in
   the per-facet thead group, the `<td>…</td>` in the per-facet row-cell
   group, `const colCount = facet === … ? N : …` (detail-expanded row
   colSpan), AND the `{sorted.length === 0 …}` empty-state `<td
   colSpan={…}>` — the latter is a SEPARATE ternary chain that does not
   read colCount. The two chains must move together or a facet's detail
   row / empty row misaligns.

## Redesign grid: fixed child count, placeholder spans

The row layout is one JSX expression with a fixed child count
(`{pollsterCell}{fieldCell}{sampleCell}<span></span>{figs}{pic}{val}
{facet === "twopp" && <span></span>}<button …>`), and `cls` maps the facet
to its `rd-ap-c*` class. Remove a cell the wrong way and every later cell
shifts one grid column. The pattern:

- Declare the cell with an EMPTY default — `let figs, pic, val =
  <span></span>, …` — and let a facet that has no datum for that track
  simply not assign it.
- In the hrow, replace the removed `th(...)` with `<span></span>` (same
  child count as `grid-template-columns` tracks).
- Collapse the now-empty track ONLY where it visibly holds space: at the
  ≤1000px rung the issues val track went `44px` → `0` (row and hrow both
  shrink). Desktop `minmax(0,1fr)` and ≤1240 leftover empty tracks are
  harmless — an empty `minmax(0,1fr)` absorbs slack the pic would
  otherwise take; leave them.
- Phone ≤760px sets `grid-template-columns: none` for all `rd-ap-c*` —
  phone layout comes from the `body` tree, not tracks. Nothing to do
  there beyond removing the csub.

## Classic table: the fallthrough hides counts

`colCount` was `facet === "primary" ? 10 : facet === "leadership" ? 9 :
facet === "direction" ? 9 : 9` — issues rode the FALLTHROUGH `9`. When a
facet loses a column you must insert an explicit clause
(`facet === "issues" ? 8`) in BOTH the colCount chain and the empty-state
colSpan chain; grepping one chain does not find the other (they sit ~100
lines apart). Count check: base columns + facet cells — expander, pollster,
fieldwork, released, sample = 5…6 (count the thead, not the CSS).

The classic table is a real `<table>` — column widths follow the DOM, so
no CSS edit accompanies a classic-table column removal (unlike the
redesign grid).

## What stays behind

- **Sort-key registration** (`case "dir.net": …` in the classic sort
  switch) stays if ANY facet still sorts on it — "dir.net" also backs the
  Direction facet's own Net column. Removing a facet's column but not the
  key keeps the other facet working; removing the key breaks both.
- **Generic CSV export columns** (`["Direction net", p => p.dir ?
  p.dir.net : ""]` in the CSV builder) are facet-independent — every facet
  exports the same wide sheet. Not a column-removal target.
- **The same datum on OTHER views** — the Direction facet's own "Net"
  th (`th("Net", "dir.net")` in rd-allpolls.jsx AND its ArchSortTh in
  d1a1d215) must not be touched when stripping the datum from Issues.
  Grep every `d.right`/`d.wrong`/`dir.net` hit and check WHICH facet
  branch each line is in before deleting.

## Verify

- `node .build/newtracker/validate.mjs` — errors 0.
- The facet's own probe + the adjacent facet's probe (here iss-facet
  35/35 and dir-facet 31/31 — the dir probe is the regression guard for
  the facet that KEEPS the datum).
- Grep the BUILT `index.html`: the removed header text must have ZERO
  matches ("Net direction" — plain ASCII, no babel escaping to worry
  about); the kept facet's header literal must still match
  (`th("Net", "dir.net"`).

## Hashed-asset edit failure: "File not found"

An `edit` call on `.build/newtracker/assets/d1a1d215-<uuid>.js` failed
"File not found" minutes after `read_file` on the same path succeeded.
The cause was NOT a sibling rebuild — it was a mis-transcribed hash read
off a compacted session summary: the real last group is
`…-7eeea9ad8102` (UUID last group = 12 hex chars), the summary had
dropped one char to `…-7eeea9d8102`. Recovery order:

1. Re-glob `prefix-*` in the assets dir (glob returns the true full name)
   or `list_directory` the assets folder ignoring `*.css, *.jsx`.
2. Diff the returned name against your path CHARACTER BY CHARACTER —
   count the last group's hex length (must be 12). A transcript from a
   compacted summary is the prime suspect.
3. Only then suspect a sibling-session rebuild renaming assets (hashes
   DO change when the build rewires asset references — but the build
   alone does not rename d1a1d215's file; that hash is the asset's
   identity, not a content stamp).

Same caution applies to line numbers re-derived from summaries: always
re-grep the target string in the CURRENT file before editing.
