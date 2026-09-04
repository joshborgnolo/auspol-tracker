---
name: auspol-hero-strips
description: auspol-tracker — map of the hero header's editable strips (hero-interval clause row; hero-controls strip whose ONLY bare TextToggle is the range window; the figure-bearing .hero-alt "Switch 2PP" pill is the SOLE matchup switcher at every width since 4b9be91, ranked within the laptop foot group by JSX DOM SEAT since 51a1817 — never flex order: a negative order floats it above EVERY order:0 sibling incl. the compare switch (812bda6 user-rejected) — while ≤560px re-leads it with order:-1 + margin-top:0; foot-group sink is a margin-top:auto chain pg-check → hero-alt → chartbar with ~ sibling resets, never :first-of-type); separator-dot machinery, hi-term cascade hazard, runtime subTight shortening, one-word-space hero-sub gap, two-DOM-homes/one-state display-toggle pattern, and phone-only reorder via flex `order`.
source: auto-skill
extracted_at: '2026-09-02T06:30:13.393Z'
---

# auspol-tracker — hero strips (interval row, control column, chartbar at its foot)

The hero card in the compiled JSX asset
(`.build/newtracker/assets/73de0c58-….js`, `<section className="card hero">`)
has three strips that copy/order requests land on. Sources, never `index.html`;
rebuild with `node .build/newtracker/build.mjs`.

## 1. `.hero-interval` clause row ("… leads by 4.0 ± 3.4 pts · 95% interval • Weighted aggregate")

- JSX at ~:987 in the 73de0c58 asset; CSS at template.html ~:1082.
- **Frame order matters, CSS reorder is unsafe**: separators are
  `::before`/`::after` pseudo-elements hung off flex-sibling positions
  (DOM order), so `order` would display the clauses shuffled while the dots
  stay in DOM positions. Reorder in JSX.
- **hi-term buttons can't host a dot** (::after inside a `<button>` picks up
  the link underline and becomes clickable). Consequences:
  - Any junction between two `.hi-term` buttons needs a literal
    `<span className="hi-sep">•</span>` between them in JSX.
  - Non-term neighbours (`.eyebrow-warn` "Limited data", `.lead-tag`) get
    their dots for free from the two CSS rules; leave them as clause
    boundaries.
- **Every dot emitter pins `font-size: 12px`** (caught live 2026-09-02,
  `9145b69`): the pseudo-element dots inherit their HOST CLAUSE's size
  (14px `.lead-tag` ::after) while the literal `.hi-sep` span inherited the
  page's 16px, so the dot before "Weighted aggregate" read visibly bigger
  than the one before "95% interval". The `::after` / `::before` / `.hi-sep`
  rules (template ~:1096-1104) each carry `font-size: 12px` — any NEW
  separator must pin a size too: an unpinned dot silently tracks whatever
  clause or ancestor hosts it, and the mismatch is user-visible.
- Clause order (since 2026-09-02, and its edge cases):
  `lead-tag, [note 95% interval if unc], [hi-sep if unc], method, [eyebrow-warn if !adjusted]`.
  `unc` = a real interval exists (`D.latest.alp2ppCi95` or `altL.ci95`).
  Shortening this list wrongly (e.g. moving the note after the method in the
  !adjusted case) leaves note+method adjacent with no dot.
- Clause sizes AND colours must be declared AFTER the `.hi-term` reset in
  source order (equal specificity, later wins): a size set above it is
  rewritten to inherited 16px, and — caught live 2026-09-02 (5c2ae4f) —
  a colour set above it is rewritten by `.hi-term`'s `color: inherit` to
  `--ink`, so "Weighted aggregate" read blacker than the ink-3 "95%
  interval" beside it. The load-bearing rule is now
  `.hero-interval .hi-method { font-size: 12px; color: var(--ink-3); }`
  below `.hi-term`; the base `.hi-method` rule at template ~:1083 keeps
  `ink-3` + nowrap for non-button/static usages only (its colour is dead
  on the button). Same rule works for `.hi-note` purely by source order.
  Phone (≤480px) drops `.lead-tag`/`.hi-range` to 12px and the gap to 6px
  (template ~:1127).
- Deliberately NO per-width clause-order variant: CSS comment at ~:1104 says
  the same order/dots/sizes are wanted at every width — any order change,
  including phone-only requests, is a global JSX change.
- **copy-chart.js keeps the strip's order a second time**: the copied-image
  meta tail is built as `const meta = [txt(.hi-note), txt(.hi-method)]…`
  (copy-chart.js ~:469). Flip that join whenever the JSX clause order moves —
  it does not follow the DOM on its own.
- The `.hero-sub` line UNDER the interval row carries
  delta → "vs. 1 month ago"/"vs. previous reading" → (
  `unc.changeSig === false` caveat "(within the margin)") → (since 600d530)
  a `.hero-sub-count` clause `• {unc.n} poll{s} in {D.latest.method.windowDays} days`
  (all widths, gated on `unc` like the note). History: "vs. one month ago"
  became "on a month ago" (5c2ae4f), then "vs. 1 month ago" (f1f8173) —
  the delta label has TWO emitters that must move together: this JSX
  ternary (73de0c58 ~:1082) AND the og share-card meta line in
  `.build/newtracker/make-card.js` (~:207, `+ " vs. 1 month ago"`). The
  count's separator is a
  real `•` bullet (5c2ae4f), NOT the `·` middle dot it shipped with — the
  interval strip's dots are all `•` (hi-sep span + CSS `content: "•"`),
  and mixed dot glyphs are visible enough that the user flagged it. When
  adding a separator anywhere in the hero, copy the `•` (U+2022) char.
  SIZE parity came a day later (6bbe3cf): that bullet began life as a bare
  `{"• "}` text node under `.hero-sub-count`'s 13px and sat 1px proud of
  the strip's 12px dots across the two hero lines. The fix BORROWS the
  strip's pin — the JSX bullet now rides inside
  `<span className="hi-sep" aria-hidden="true">`; `.hi-sep` is a GLOBAL
  class (template.html ~:1111), so one 12px rule serves both lines. Never
  add a second size pin for a new hero separator — wrap it in `.hi-sep`.
  Same datum the pre-f48f8d2 hi-note label printed; CSS is folded into
  the `.hero-sub-note` selector, not its own rule.
- **`.hero-sub` container gap = ONE word space (063c270)**. The horizontal
  gap stands in for the word spaces the line would have if it were plain
  text, so it must equal ~one space at the line's sizes (a 13px space in
  IBM Plex Sans measures 3.07px) — anything ~2× a word space reads
  "double spaced". History: `600d530` shipped `gap: 12px`; `53c2540`
  (Sep 1) tightened 12→6px "so the line reads as one sentence"; the user
  still read "pts"→"vs." and ")"→"•" as double-spaced, and `063c270`
  (Sep 2) split it to `gap: 6px 3px` (row gap stays 6px for wrapped
  lines; column gap 3px) on template.html ~:1037. The junction INSIDE the
  count clause ("•"→count digit, ~2.83px) was never the problem — it's a
  literal `" "` text node baked into the JSX and needs nothing; never pad
  separators to compensate for container gaps.
- **Diagnosing "this line reads double-spaced" — measure inks against a
  canvas-derived word space, element boxes lie.** Element
  getBoundingClientRect on the three sub-children gives junk (delta chip
  children + suffix text node confound it); instead, for each junction
  use a Range over the last text node of clause A and the first of clause
  B and diff `firstInkEdge - lastInkEdge`; then weigh every gap against
  `canvas.getContext("2d").measureText(" ").width` with
  `cv.font = weight + " " + computedSize + " " + computedFamily` set from
  the clause's OWN computed style (the junction between the 12px delta
  chip and the 13px note has no single ambient font — the note's is the
  readable word space). Working probe:
  `.matilda/verify-hero-sub/measure-glyphs.mjs`; it generalises to any
  in-page junction complaint. Expected hero-sub values post-063c270:
  jA pts→vs 3, jB )→• 3, jC •→digit 2.83, space 3.07.
- **subTight (9deb114) — runtime-measured copy shortening**: the caveat
  reads "(within the margin)" until the `.hero-sub-count` clause wraps to
  a second line, then — and only then — renders "(within margin)"
  (`{subTight ? "" : "the "}` inside `.hero-caveat`). Measured in the Hero
  component via `subRef`/`subNoteRef`/`subCountRef` +
  `count.offsetTop !== note.offsetTop`, re-checked every render plus on a
  `ResizeObserver` over the row and on `document.fonts` ready/loadingdone
  (font swap moves the wrap point too). Restore hysteresis: `subOverW`
  ref records the row width at the last overflow; full wording returns
  only when `row.clientWidth > subOverW`. **Recipe for any "shorter
  wording only when the screen is too small" request**: don't pick a
  media-query breakpoint — the wrap point moves with the delta figure's
  width, the caveat's presence, and font metrics. Measure the wrap with
  offsetTop of the would-wrap element vs its line-mate, gate the copy on
  state, and keep a width ref so the longer copy comes back.

## 2. `.hero-controls` control strip (range / Switch-2PP pill / compare)

- JSX at ~:1144 in the 73de0c58 asset, DOM order (since 51a1817): the
  phone copy of the range `TextToggle` (`.tt-caps`, options
  3mo/6mo/12mo/All, display:none ≥561px), the compare-implied `pg-check`
  line (`{matchup === "alp_lnp" && D.synth2pp && … && compareToggle(false)}`),
  the `.hero-alt` "Switch 2PP" pill block with per-contest figures, then
  the `.hero-chartbar` div (the range toggle's laptop copy, see 3) as the
  column's LAST child. **DOM order IS the laptop foot-stack order —
  compare, pill, range**: an earlier same-day attempt ranked the pill
  with laptop `order: -1` (812bda6), but a negative order floats the item
  above EVERY order:0 sibling — the compare switch too — and the user
  immediately rejected it ("below Compare implied 2PP, above the range
  toggle"). *Within* the foot group, re-rank blocks by moving the JSX
  block, never by `order`; `order` is safe ONLY for the ≤560px phone
  lead, where the pill is the row's lone reorder candidate.
- **There is no bare matchup `TextToggle` at any width (4b9be91).** The
  strip copy and the chartbar copy were both deleted, and the formerly
  shared `matchupOptions` const was removed with them. The pill is the only
  matchup switcher everywhere: it names the alternative AND carries its
  figure/±CI, so a bare toggle only duplicated it (the phone had already
  worked this way). `chooseMatchup` and `orderedMatchups` stay — the
  ha-chip pills still use them.
- Base CSS (template ~:1168) is a right-aligned column with
  `align-self: stretch` (lets the column span the hero-top row so its foot
  group can sit level with the interval strip, see 3). Sinking is a
  THREE-RUNG margin chain walked in DOM order, each later rung cancelled
  by a `~` sibling rule when an earlier one renders:
  `.hero-controls .pg-check { margin: 0; margin-top: auto }` — the
  checkbox leads and sinks the group when the synth overlay exists;
  `.hero-controls .hero-alt { margin-top: auto }` with
  `.hero-controls .pg-check ~ .hero-alt { margin-top: 0 }` — the pill
  sinks only when it LEADS (no compare switch: non-ALP/LNP matchup);
  `.hero-chartbar { … margin-top: auto }` with both resets
  `.hero-controls .pg-check ~ .hero-chartbar, .hero-controls .hero-alt ~
  .hero-chartbar { margin-top: 0 }` — solo-2PP-race fallback.
  Do NOT express any rung as `:first-of-type`
  (`.hero-controls > .hero-alt:first-of-type` shipped once, deleted in
  51a1817): the display:none phone range-copy TextToggle is a DOM sibling
  of `.hero-alt`, so whether the pill counts as "first of its type"
  hinges on TextToggle's root element beneath it — an implicit dependency
  no comment will save. Explicit conditional-render sibling resets are
  robust under any future control joining the column. The phone
  range-copy rule `.hero-controls > .text-toggle { display: none }` hides
  the strip's bare toggle ≥561px (its laptop home is the chartbar).
- **The 54px `hero-alt` height cap is GONE** — an earlier 2026-09-02
  head-of-column arrangement needed it to shrink-wrap the hero-top row;
  the foot-group re-seat superseded that approach. Do not resurrect the
  cap when touching the pill strip.
- ≤900px flips the column to `align-items: flex-start`, then re-rights the
  pill strip and the chartbar with
  `.hero-controls .hero-chartbar, .hero-controls .hero-alt { align-self: flex-end }`.
- **≤560px (template ~:2371)** makes the strip a wrapping row
  (`flex-direction: row; flex-wrap: wrap`), shows the phone range copy
  (`.hero-controls > .text-toggle { display: inline-flex }`), hides the
  whole chartbar, and re-leads the row with
  `.hero-controls .hero-alt { order: -1; align-self: center; margin-top: 0 }`.
  The `margin-top: 0` is LOAD-BEARING (added 51a1817): the laptop chain's
  base `.hero-alt { margin-top: auto }` applies at every width, and in a
  wrapping row an auto top margin pins the pill to a line of its own
  instead of leading the chips. The pill stays the only matchup control
  here too — the old `.text-toggle:not(.tt-caps)` hide rule was deleted
  in 4b9be91 because its target element no longer exists.
- **Phone-only reorders belong here as flex `order` in the ≤560px block**,
  not JSX swaps — the desktop column order has its own rationale and stays
  put. Equal-specificity rules resolve by source order (the ≤560px laptop
  `margin-top:auto` override above is the same trick), so the ≤560px
  block must stay later in the file.
- `.hero-alt` base (template ~:1236) is a flex row with
  `justify-content: flex-end`; on phone it inherits no width-forcing so the
  pill packs into the wrap row.

## 3. `.hero-chartbar` (laptop: matchup STACKED over range, foot of hero-controls)

Added 2026-09-02 as the laptop home for the two toggles; re-stacked same day
(600d530) after the user rejected the left/right split — the matchup rides
directly above the range window it filters. **Re-homed the same day
(639e813)** after the user found the standalone row sat too low/offset from
the interval block: it is now nested INSIDE `.hero-controls` as its LAST
child, sunk to the column foot so its baseline matches the interval strip /
delta line across the hero-top row.
- JSX: a `<div className="hero-chartbar">` as the last child of
  `.hero-controls`, immediately after the `.hero-alt` pill block (51a1817;
  the compare line sits ABOVE the pill), containing ONLY the range
  `TextToggle` (`caps: true`, `rangeOptions`) — the bare matchup toggle
  that once shared the bar was deleted in 4b9be91 along with the shared
  `matchupOptions` const; the pill is the matchup switcher. Its earlier
  incarnation as a sibling row between hero-top and `<TrendChart>` is
  GONE.
- **Two DOM homes, one state — copy the compare-toggle pattern.** Both
  TextToggle copies render always; CSS `display` chooses per width. State
  (`matchup`, `rangeId`) stays single in App scope — never introduce a
  second state for the chartbar copy. `rangeOptions` was hoisted to a
  const near `matchupOptions` (~:653) so both copies share it.
- **The desktop alignment mechanism (639e813, re-carried e42a57b)**:
  `.hero-top` is
  `align-items: flex-start`, so any content at the head of the right column
  floats high and nothing can sit level with the left column's lower lines
  by default. Fix recipe (reusable for any "this block must line up with
  that block lower down the row" request):
  1. nest the block inside the flex column you want it pinned to;
  2. `.hero-controls { … align-self: stretch; }` on the COLUMN rule — lets
     the column span the hero-top row height despite `align-items:
     flex-start` on the container;
  3. `margin-top: auto` on the sunk group — it forces the flex item(s)
     to the column foot, at whatever height the row happens to be.
  Do NOT try `margin-bottom: 0` / fixed offsets — `margin-top: auto` is
  the load-bearing half of the idiom. **Since e42a57b the margin rides on
  the GROUP LEADER, not the chartbar**: user asked for the Switch-2PP pill
  and Compare-implied toggle moved down next to the toggles, so
  `.hero-alt { … margin-top: auto; }` now sinks the whole pill→pg-check→
  chartbar group as one block; the chartbar keeps its own
  `margin-top: auto` ONLY as the fallback for a no-other-contest window
  (no pill rendered), cancelled by the sibling rule
  `.hero-alt ~ .hero-chartbar { margin-top: 0; }`. The ≤560px block puts
  `margin-top: 0` on `.hero-controls .hero-alt` (next to its `order: -1`)
  because a wrapping row has no foot, and an auto top margin there just
  pins the pill to the bottom of its line. Verified live
  (.matilda/verify-hero-foot/measure-foot-group.mjs): junctions pill→check
  and check→chartbar both equal the column's 14px gap, group flush at the
  column foot.
- CSS (template ~:1146): base
  `.hero-chartbar { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; margin-top: auto; }`
  — `align-items: flex-end` CHILD-alignment keeps the stack right.
  **≤900px container switches to `align-items: flex-start`, which would
  also left-align the chartbar child** — a descendant override
  `.hero-controls .hero-chartbar { align-self: flex-end; }` (in the same
  ≤900px block) counters it; the width-specific override lives NEXT TO the
  tt-opt/tt-div touch-padding rules that already extend to
  `.hero-chartbar .tt-opt`/`.tt-div`.
  **≤560px hides the whole chartbar** (`.hero-chartbar { display: none; }`
  plus `.hero-controls > .text-toggle { display: inline-flex; }` fallback,
  preserving the pre-change phone arrangement — range only, matchup stays
  hidden by the `:not(.tt-caps)` rule).
- **copy-chart.js `STRIP_SEL` still names `.hero-chartbar`** (redundantly
  now — as a child of the stripped `.hero-controls` it is removed either
  way) and MUST keep listing `.hero-controls`; the comment there describes
  the chartbar as nested at the column foot. Lesson from 600d530 stands:
  any NEW interactive hero element must join `STRIP_SEL` or it leaks into
  copied PNGs silently.

## Rebuild / verify

`node .build/newtracker/build.mjs` (also validates the data). Then confirm
in built `index.html`:
- CSS: `grep -n "hero-alt { order:" index.html`;
  `grep -n "hero-chartbar" index.html` (base `margin-top: auto` rule,
  ≤900px `.hero-controls .hero-chartbar { align-self: flex-end; }`
  override + padding, ≤560px hide, copy-chart STRIP_SEL, compiled JSX
  div — nested as hero-controls' last child, right after
  `compareToggle(false)`, NOT a sibling before `<TrendChart>`);
  `grep -n "hero-alt ~ .hero-chartbar\|hero-alt { display" index.html`
  — e42a57b sink pair: `.hero-alt { … margin-top: auto; }` base rule
  plus the `.hero-alt ~ .hero-chartbar { margin-top: 0; }` fallback
  canceller, and the ≤560px `.hero-controls .hero-alt { order: -1;
  margin-top: 0; }` reset.
- compiled strip order: `grep -n 'className: "hi-note hi-term"' index.html`
  should precede `"hi-method hi-term"` (compiled JSX keeps source order).
- sub spacing: `grep -n "hero-sub { display" index.html` — the rule must
  read `gap: 6px 3px` (063c270: one-word-space column gap; a bare
  `gap: 6px` is the pre-fix double-spaced state).
- `.hero-sub-count` clause: `grep -n "hero-sub-count" index.html` (one CSS
  hit via the shared `.hero-sub-note` selector + one compiled span;
  since 6bbe3cf the bullet sits in its OWN compiled
  `className: "hi-sep"` span — expect exactly TWO `"hi-sep"` hits in the
  built page (strip dot + sub-count dot) and `"• "` INSIDE the span; the
  pre-6bbe3cf substring `"• ", unc.n` no longer matches).
- subTight: `grep -n "subTight\|subRecheck" index.html` — expect the
  compiled state/refs ~five hits plus the compiled ternary
  `" (within ", subTight ? "" : "the "`.
- **Never verify from a carried-over summary.** 2026-09-02: a compaction
  summary asserted the note/method JSX swap was "done and verified" — the
  source had never been edited and the user caught the old order live, on
  a page that also carried fresh data (misleadingly "current"). Grep the
  JSX SOURCE before reporting done, then re-grep the rebuilt artefact.
- **origin/main can advance mid-task.** Other sessions commit + push data
  work while your layout diff sits uncommitted; HEAD==origin/main can move
  between your first and last `git status`. Before committing, re-run
  `git rev-parse HEAD origin/main`; stage only your named files (their
  `.matilda`/extractor WIP stays out), and include the build-regenerated
  data asset (`9f09dca2-….js`) with `index.html` — peers have committed
  index.html without its data asset, and a fresh rebuild off committed
  `data/polls.json` re-syncs the pair.
