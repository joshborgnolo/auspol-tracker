---
name: auspol-poll-table-typography
description: auspol-tracker — type-size map of the Latest-polls and All-polls tables. BOTH tables share class `poll-table archive` (a11e1559 PollsterTable ~:2688 + d1a1d215 archive ~:2408), so one template.html size change covers both. Desktop cell 16px / pollster-name 16px / apub numerals 14.5px / PPM share-keys 12.5px; th stays 13px (deliberately tracks .meta-k); the ≤1000px (13.5px) and ≤480/430px ladders are viewport-FIT tuning — .ap-wrap is overflow:visible so an over-wide table scrolls the PAGE, not a scroller. PPM figures exist ONLY under the Leadership facet, so probes of the default 2PP facet find no `.share-compact`. Expanded-row figures (`.poll-detail b/.netv/.chg/.seat-est`) are set in `--figures` — the Archivo variable cut since 7a3451f (the 9f2c168 Fira Sans statics it replaced are gone). Bump sizes in .build/newtracker/template.html, rebuild, grep index.html.
source: auto-skill
extracted_at: '2026-09-02T00:00:00.000Z'
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

## Expanded breakdown (.poll-detail) — figures set in `--figures` (Archivo since 7a3451f; Fira Sans 9f2c168→7a3451f)

- **Expansion markup**: data rows are `tr.poll-row`; the toggle is
  `<button class="exp-btn" aria-label="Expand full breakdown">` inside the first `.exp-col`
  cell. There is NO `.arch-row` class — a probe guessed it and clicked nothing. The Latest
  table renders ~8 rows immediately; click the `.exp-btn` (or `row.click()`), then the
  `.poll-detail` panel mounts.
- **Figure-face rule** (template.html ~:1916-1921, beside a comment "the expanded view's
  numbers are the poll's data"): `.poll-detail b, .poll-detail .netv, .poll-detail .chg,
  .poll-detail .seat-est { font-family: var(--figures, var(--sans)); }` — was `var(--serif)`
  Crimson Text. The token sits in `:root` right after `--sans` (~:94) and is now
  `--figures: "Archivo", var(--sans);` — Archivo arrived in 7a3451f as ONE wght 100-900
  variable cut that replaced the three Fira Sans statics 9f2c168 had shipped for this
  rule. Prose in the panel stays in the text faces: `.pd-simple` / `.pd-s`
  14px sentences (~:1900-1915), with `.pd-s b` the ink figures.
- **Figure weights/sizes** (all in template.html): `.netv` 800 + tabular-nums (~:1787),
  `.chg` 10.5px weight 700 (~:1611) at base — in the DETAIL the override is 10.5px/
  **600** (`poll-detail .chg`, critique pass 2026-09-03), `.seat-est` 15px weight 800
  (~:1950). The 100-900 Archivo variable cut covers all of these in one file (the retired
  Fira statics shipped exactly the 400/700/800 cuts for the same rule) — see
  auspol-font-pipeline for the add-a-typeface recipe and the `document.fonts`
  lazy-loading trap when probing weights.
- **Detail type ladder — FOUR TOKENS on `.poll-detail`, not a table of sizes** (second
  2026-09-03 pass; the earlier 14px-body/16px-lead ladder is gone). `--pd-lab` 118px is
  the provenance label column, `--pd-body` 16px the sentences, `--pd-fig` 22px every
  published figure, `--pd-hero` 40px the first head-to-head. Change a token, not a rule;
  the `@media 720px/560px` blocks re-set the SAME tokens and nothing else.
  - **The provenance list is two columns at EVERY width** — do not stack it
    label-over-value on narrow screens. That was tried and reverted: the values
    are longer than the labels, so stacking bought ~110px of a 341px line and
    spent six extra rows buying it. The only structural narrow rule is
    `@media (max-width: 360px)`, where `.pd-meta` wraps and `.pd-meta-tail`
    takes `order: -1` so the controls sit ABOVE the list — wrapping them below
    puts them between "House effect" and the ledger-rendered `.pd-rel` rows and
    cuts the list in two. Probe asserts beside/no-wrap/no-overflow at 500, 390
    and 320px.
  - `.pd-meta` is a flex band holding `.pd-meta-items`, a **two-column grid**
    (`var(--pd-lab) minmax(0,1fr)`). Each `.pd-meta-i` is `display: contents`, so its
    `.pd-meta-k` (11.5/600) and `.pd-meta-v` (14px) are the grid's real items — a meta
    row that forgets `.pd-meta-v` puts its value in the label column. The controls take
    `margin-left: auto` because the items are capped at `--pd-measure` (700px).
  - `.pd-rel` (release / APC-statement rows, built in PollLedger so BOTH tables get them)
    is a SECOND `.pd-meta-items` grid in `.pd-simple`; the two align only because both
    read `--pd-lab`. There is no `PdSec` for the release any more.
  - `.pd-k` kickers are 10.5px/600 **uppercase, 0.115em tracked**, and every `.pd-sec`
    carries `border-top` — the panel is ruled sections, not a gap-separated stack.
  - Figures: `.pd-s b` `--pd-fig` with `line-height: 1` (keeps the step out of the
    leading); `.pd-s.pd-s-hero b` `--pd-hero`. The hero is a **prop**, set only on the
    first TppLine whose contest has exactly 2 segments — a three-cornered pair or a
    second matchup stays at `--pd-fig`. Note `b` is a DESCENDANT of `.pd-grp` (the
    nowrap figure+label unit), so `> b` child selectors silently miss it.
  - Basis notes are their own `<p class="pd-s pd-s-basis">` caption line (14px, 18px
    figure) under the measure — undecided-inside-the-pair, set-aside shares, PPM
    undecided, the flows term. They used to be parentheses trailing the figures.
  - **The move is ALWAYS parenthesised, never comma-led.** Every site goes through
    `<ChgParen d={…}/>` (which wraps `ChgTag` in `.pd-s-chg`), including the two basis
    notes that used to write `, <ChgTag/>` inline (tppLines' undecided, the primaries'
    set-aside). The probe asserts no `,\s*[▲▼–]` survives in the panel.
  - **Direction colour**: `.chg.up` / `.chg.down` take `--chg-up` / `--chg-down`
    (light + dark, ~5–6:1 on the panel ground); `.chg.flat` stays `--ink-3`. This
    OVERRIDES the "no good/bad colour in a party-neutral tracker" rule the ChgTag
    comment still states for the NET and the mood axis — asked for directly, 2026-09-03.
    `.chg` renders in exactly two places (the panel, and the archive's `direction`
    facet cells, whose `<td>` already carries an inline `--mood-pos`/`--mood-neg`);
    ShareBar's `{!compact && <ChgTag/>}` is dead — both call sites pass `compact`.
  - **Spacing between a figure and its word is WORD-SPACING, not margins**: `.pd-s` 5px
    (between pairs) / `.pd-grp` 3px (inside one) / `.pd-lab`, `.pd-mat`, `.pd-s-chg`
    normal (multi-word labels, matchup prefixes and the parenthetical must not open up)
    / `.pd-s-hero .pd-grp` 6px / `.pd-s-basis` 2px. A margin between two inline groups
    survives a line break and hangs the wrapped line in — at phone widths that is most
    lines. Every label beside a figure is wrapped in `<span class="pd-lab">` for this.
  - Probe: `.matilda/verify-poll-detail-type/probe.mjs` — asserts the ladder in both
    tables and opens all 124 archive rows at 375px to prove no `.pd-grp` pushes the page
    sideways. Content probe: `.matilda/verify-ticker/probe-tpp-undecided.mjs`.
- **Not every poll's detail has every figure class**: `.netv`/`.seat-est` only render for
  polls carrying those metrics — expand several rows before declaring a selector missing.

## Procedure (thanks commit d952219, 2026-08-31)

1. Edit sizes in `.build/newtracker/template.html` only.
2. `node .build/newtracker/build.mjs` (validates poll count itself).
3. Verify in built `index.html`: grep `\.poll-table {|\.poll-table\.archive \{` — CSS falls
   through as literal text (no escaping trap like asset JS strings).
4. Stage only `template.html` + `index.html`; one-line present-tense commit; push.

Related: auspol-build-pipeline (never hand-edit index.html), headless-browser-verification
(use it if you ever widen the narrow ladders — verify no horizontal overflow at 375/480px).
