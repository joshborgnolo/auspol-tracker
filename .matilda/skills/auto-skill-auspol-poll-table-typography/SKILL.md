---
name: auspol-poll-table-typography
description: auspol-tracker — type-size map of the Latest-polls and All-polls tables. BOTH tables share class `poll-table archive` (a11e1559 PollsterTable ~:2688 + d1a1d215 archive ~:2408), so one template.html size change covers both. Desktop cell 16px / pollster-name 16px / apub numerals 14.5px / PPM share-keys 12.5px; th stays 13px (deliberately tracks .meta-k); the ≤1000px (13.5px) and ≤480/430px ladders are viewport-FIT tuning — .ap-wrap is overflow:visible so an over-wide table scrolls the PAGE, not a scroller. PPM figures exist ONLY under the Leadership facet, so probes of the default 2PP facet find no `.share-compact`. Bump sizes in .build/newtracker/template.html, rebuild, grep index.html.
source: auto-skill
extracted_at: '2026-08-31T05:05:04.621Z'
---

# auspol-tracker: poll-table typography map

## One class, two tables — a single CSS edit covers both

"Latest polls" (`PollsterTable` in `a11e1559-…js` ~:2688) and the "All polls" archive
(`d1a1d215-…js` ~:2408) are both `<table className="poll-table archive">`. The
Latest-polls table consciously reuses the archive ledger look (comment at a11e1559 ~:2618:
"ledger look shared with the All-polls archive"). There is **no other .poll-table consumer**
in the assets — grep confirmed only these two tables — so any `.poll-table`-selector change
is exactly these two tables, and editing one size changes both at once.

## Where the sizes live (all in `.build/newtracker/template.html`)

- `.poll-table { … font-size: 16px; }` (~:1817) — universal base for both tables.
- `.poll-table th { font-size: 13px; … }` (~:1818) — **intentional**: the comment there says
  "the same 13px semibold ink-3 label as .meta-k: track them alike". Do NOT scale th with
  the cells without updating .meta-k compare-or-contrast expectations.
- `.pollster-name { font-size: 16px; }` (~:1830) — the bold display name in the first column.
- `.pollster-mode { font-size: 12px; }` (~:1860) — the client/sub-line, its own scale.
- `.poll-table.archive { font-size: 16px; }` (~:3183) — restates the base; keep equal.
- `.apub { font-size: 14.5px; }` (~:3236) — the archive's as-published dot numerals; sits a
  deliberate step under cell size.
- `.share-compact .share-keys { font-size: 12.5px; gap: 4px 10px; }` (~:1919) — the table PPM
  figures (leader name + share numeral under the mini bar). ShareBar is only ever rendered
  `compact` in the PPM column, so this rule is exactly "the ppm figures" and nothing else.

## The narrow ladders are viewport-fit tuning — do not bump blindly

- `@media (max-width: 1000px)`: archive drops to 13.5px, `.hide-md` columns (sample, inline
  bars, OTH) drop, padding 12→6px (.ap-export CSV button also hides).
- `@media (max-width: 480px)`: 12px, padding 4px, `.pollster-name` 12.5px, `.pollster-mode`
  10.5px, `.arch-appr-bar` narrows.
- `@media (max-width: 430px)`: `.hide-sm` drops, unsorted carets hidden, `.num` 11.5px.

**The constraint that makes this matter**: `.ap-wrap` forces `overflow: visible` so the
archive thead can viewport-pin — a scrolling wrapper would become the sticky containing
block, so `.table-wrap`'s `overflow-x: auto` is overridden. Therefore a table that gets too
wide for the viewport does not scroll in-place; it pushes the whole **page** sideways.
Every point of size at narrow widths must be earned by columns shedding first. When a user
says the table type is too small "on my laptop" the fix is the >1000px desktop rules — a
full-width laptop window never hits the ladders.

Probe gotcha: at exactly 500px (Chrome headless's minimum window width) only the ≤1000px
block fires, so cells read 13.5px while `.pollster-name` stays desktop-sized — expected, the
name/mode ladder rules live in the ≤480/≤430px blocks. Real phone widths hit those.

## Procedure (thanks commit d952219, 2026-08-31)

1. Edit sizes in `.build/newtracker/template.html` only.
2. `node .build/newtracker/build.mjs` (validates poll count itself).
3. Verify in built `index.html`: grep `\.poll-table {|\.poll-table\.archive \{` — CSS falls
   through as literal text (no escaping trap like asset JS strings).
4. Stage only `template.html` + `index.html`; one-line present-tense commit; push.

Related: auspol-build-pipeline (never hand-edit index.html), headless-browser-verification
(use it if you ever widen the narrow ladders — verify no horizontal overflow at 375/480px).
