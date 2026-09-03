---
name: auspol-poll-table-typography
description: auspol-tracker — type-size map of the Latest-polls and All-polls tables. BOTH tables share class `poll-table archive` (a11e1559 PollsterTable ~:2688 + d1a1d215 archive ~:2408), so one template.html size change covers both. Desktop cell 16px / pollster-name 16px / apub numerals 14.5px / PPM share-keys 12.5px; th stays 13px (deliberately tracks .meta-k); the ≤1000px (13.5px) and ≤480/430px ladders are viewport-FIT tuning — .ap-wrap is overflow:visible so an over-wide table scrolls the PAGE, not a scroller. PPM figures exist ONLY under the Leadership facet, so probes of the default 2PP facet find no `.share-compact`. Expanded-row typography was rebuilt 2026-09-03 from a supplied mock-up: the whole panel is Source Sans 3 (`--panel`), Archivo/`--figures` is RETIRED (its only consumer was this panel; the FONTS entry is gone, the subset file stays in fonts/). Bump sizes in .build/newtracker/template.html, rebuild, grep index.html.
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
- **Detail type ladder — TOKENS on `.poll-detail`, not a table of sizes.** Rebuilt
  2026-09-03 against a user-supplied mock-up which is the visual source of truth; the
  earlier 16px-body/22px-fig/40px-hero ladder is gone. Change a token, not a rule.
  - Family: `--panel: "Source Sans 3", var(--sans)` — ONE family for the whole panel,
    weights 400 body/values, 500 secondary labels (seat names), 600 metadata labels +
    section headings, 700 figures. Source Sans 3 was already self-hosted (variable
    400–800, preloaded for `.wordmark`), so this needed NO font-pipeline work — and it
    retired Archivo, whose sole consumer was the old `.poll-detail b` rule.
  - Scale — the mock's RATIOS at smaller absolute sizes: its own 17/28/60 read too
    large in situ (this panel sits inside a 16px data table, not on a standalone
    page), so the whole ladder stepped down ~15% the same day. `--pd-body` 15px/1.45 ·
    `--pd-note` 13px (moves, seat ranges, the way back) · `--pd-fig` 23px (a
    percentage inside a sentence) · `--pd-mid` 26px (National direction — `PdSec mid`
    → `.pd-sec-mid`) · `--pd-hero` 48px/0.98 with `--pd-hero-w` 20px words and
    `--pd-hero-note` 16px (first two-way pair only). `.pd-k` headings take
    `var(--pd-body)` at 600 **uppercase, 0.12em** — same px as the body; the
    distinction is case, tracking and grey. Every size in the panel is a token:
    there are no literal px font-sizes left to miss when rescaling.
  - Palette: panel-scoped hex, NOT the theme tokens — `--pd-paper` #FAF9F6,
    `--pd-ink` #171717, `--pd-ink-2` #62605D, `--pd-rule` #DDDCD8. `body.dark
    .poll-detail` maps all four back onto `--surface-2`/`--ink`/`--ink-2`/`--line`;
    a cream/charcoal pair cannot be inverted.
  - Layout: `--pd-measure` 820px, `margin-inline: auto` on `.pd-meta`, `.pd-rel` and
    `.pd-simple` — a centred column inside a full-width table row. Rhythm: rule →
    24px → heading → 15px → result → 28px → rule, one `.pd-sec` rule doing all of it
    (`padding-top` / `.pd-k` margin / `margin-top`). Retuned with the type when the
    ladder stepped down — a rhythm set for a 17px body reads as slack around 15px, so
    **rescaling the type means rescaling this too**; panel padding 36px, meta row gap
    12px, `.pd-s + .pd-s` 11px, basis caption 12px.
  - **The label column is `max-content`, never a px value.** There is only ONE grid now
    (the release block is `display: block`, label over value), so nothing needs a shared
    width; `--pd-gut` is the gutter. A fixed column silently collided with
    "Commissioned by" at 16px. Watch for narrow-width `gap: Xpx 0` rules zeroing it.
  - Figures: `.pd-s b` `--pd-fig` at `line-height: 1`; `.pd-s.pd-s-hero b` `--pd-hero`.
    Hero is a **prop**, only the first TppLine whose contest has exactly 2 segments.
    `b` is a DESCENDANT of `.pd-grp`, so `> b` child selectors silently miss it.
  - Moves: `.chg` 15px/600, `.chg.up`/`.chg.down` take `--chg-up`/`--chg-down`,
    `.poll-detail .chg.flat` takes `--pd-ink-2`. Always parenthesised via `ChgParen`.
  - `NetVal` and the archive's lean/house-effect (`signed1()` in d1a1d215) emit a true
    minus **U+2212**, not a hyphen — it is in the build's LATIN subset range.
  - Spacing between a figure and its word is WORD-SPACING, not margins: `.pd-s` 7px /
    `.pd-grp` 7px / `.pd-s-hero .pd-grp` 10px / `.pd-lab`, `.pd-mat` normal /
    `.pd-s-chg` 4px (7px in the hero) / `.pd-s-basis` 2px. Margins between inline
    groups survive a line break and hang the wrapped line in.
  - No pills in the panel: `.poll-detail .back-to-chart` is plain text, `.pd-report` is
    a 30px outlined circle, label always hidden.
  - Probe: `.matilda/verify-poll-detail-type/probe.mjs` — the whole ladder in both
    tables, the family, the palette-driven move colours, the self-sizing label column,
    beside/no-wrap/no-overflow at 500/390/320px, and all 124 archive rows at 375px.
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
