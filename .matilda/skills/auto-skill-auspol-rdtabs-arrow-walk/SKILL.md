---
name: auspol-rdtabs-arrow-walk
description: auspol-tracker — the page-wide left/right arrow-key tab walk (shipped 5d374ed, 2026-09-29; made CIRCULAR d57fdfe same day): one rdTabsKey factory in rd.jsx wired into the shared RdTabs group covers ~12 tab rows free, and the hand-rolled rows (past-cycles Compare/Measure, all-polls pinbar, issues narrow chips) attach it themselves. Invariants (options in DOM order, focus follows selection, wraps at the ends, arrows only when a tab has focus), and the probe lesson that All polls and Past cycles are hash-driven page views whose rows don't exist on the Snapshot view.
source: auto-skill
extracted_at: '2026-09-29'
---

# rdTabsKey — left/right arrow walk on every tab row

Shipped 5d374ed (2026-09-29) after the user asked for the issues-panel
Up/Down row walk (a398185) to extend across all of the site's tab rows.

## The machinery

- `rdTabsKey(options, onChange)` in `rd.jsx` (~:315, exported via
  `Object.assign(window, …)`) returns an `onKeyDown` handler:
  ArrowRight/ArrowLeft only; finds the focused `<button>` inside the
  role=group container, steps ONE index in DOM order, `e.preventDefault()`,
  calls `onChange(options[j].id)`, focuses the new button.
- **options must be in button DOM order** — the walk uses one index for
  both the option list and the live button list. Never pass a reordered or
  filtered copy that doesn't match the rendered buttons.
- Focus travels with selection, so a held arrow key keeps walking; WRAPS
  round the ends (rightmost -> leftmost and back, `(i ± 1 + n) % n`,
  d57fdfe 2026-09-29 — the user asked for the who-votes Age…Home row to
  circle); preventDefault suppresses horizontal scroll.
- It only fires when a button of that row has focus (handler lives on the
  row container, no global key listener) — reading the page with arrows is
  unaffected elsewhere.
- **A click must focus the tab explicitly** (`rdTabFocus`, wired as onClick
  on every walk-enabled role=group, f0996a9): Safari and Firefox on macOS
  never focus a `<button>` on click (Chrome does), so the walk was dead for
  pointer users until this landed. The issues-trust rows never needed it
  because they're `tabIndex={0}` divs, which click-focus in every browser —
  that difference is exactly why "only the issues arrows worked" was the
  bug report. The probe's walkRow pins it: it clicks the first tab (real
  `page.click`, not `.focus()`), asserts focus landed, then walks.

## Covered automatically (via `RdTabs`, rd.jsx ~:334)

`RdTabs` attaches `onKeyDown={rdTabsKey(options, onChange)}` on its inner
role=group div, so every call site takes the walk free: hero time range
(rd-hero.jsx:445), Latest-polls facets (rd-polls.jsx:412), preferred-PM
question + leader rating (rd-panels.jsx:804/:834), who-votes group tabs
(:1333), undecided views (:2219), issues view tabs (:1887) and whom desktop
group tabs (:1991), all-polls main facets (rd-allpolls.jsx:1065), plus the
rd-dis-tabs/rd-hl-tabs rows incidentally.

## Hand-rolled rows (attach explicitly)

- past-cycles Compare-with — `rdTabsKey(CMP_ROWS.map(([id]) => ({ id })), setCompare)`
  on the `[aria-label="Compare with"]` div (CMP_ROWS hoisted beside
  MODE_ROWS above `controls`, ~:559).
- past-cycles Measure — `rdTabsKey(MODE_ROWS.map((id) => ({ id })), setMode)`.
- all-polls pinbar `.rd-ap-pintabs` — `rdTabsKey(FACETS, onFacet)` (~:1025).
- issues narrow `rd-iw-chips` group row — `rdTabsKey(G.tabs, setGset)`
  (rd-panels.jsx ~:1974; NOT the sibling "Issue" chip row, which was out of
  scope).

A newly hand-rolled tab row gets the walk by adding the same one-line prop;
check it renders buttons in the same order as the array passed.

## Number-key hotkeys: rdDigitKey (2648f0d, 2026-09-29)

A row can also take NUMBER keys: `rdDigitKey(items, onChange)` (rd.jsx,
beside rdTabsKey) maps 1..9 to `items[n-1]` left to right, no wrap and no
focus move; 0, out-of-range and any modifier chord are inert (Cmd+digit is
the browser's own tab switcher, never hijacked). `RdTabs` takes an
`onDigits` prop hung on its OUTER `.rd-tabs` div (not the role=group, where
rdTabsKey lives) so the row's view tabs AND its inline children both reach
it. The one call site is Who votes for whom: with an Age…Home view tab or a
party chip focused, 1..5 = One Nation, Labor, Coalition, Greens, Others -
the RdTabs row carries `onDigits={rdDigitKey(DEMO_PARTIES, chooseParty)}`
and the phone's separate `.rd-chips-row` attaches the same handler itself;
both chips rows also got `onClick={rdTabFocus}` so a pointer click lands
focus where the keys can hear it. The phone row's chips ABBREVIATE
(9fdd62a, 2026-09-29): `DEMO_PARTIES[].short` — ON, ALP, L/NP, GRN, OTH,
the same short forms the votes-by-party panel's `ABBR` end labels use —
with the full name kept on each chip's `aria-label`, so the five chips
always fit one line (the ≤480px 3-over-2 wrap rung in rd.css was deleted
with the full labels; probe `.matilda/probe-chips-oneline.mjs` pins
one-line geometry + abbreviations at 320/360/480/640px, and the 2px
document overflow it surfaced at 320px is PRE-EXISTING from `.ss-table`,
not the chips). Probe: `.matilda/probe-whovotes-numkeys.mjs`
(digit picks from a view tab and from a chip, desktop + phone chips row, the
figure itself switching, inert keys, Meta+digit, no-row-focus dead air).

## Beyond tab rows (5219307, 2026-09-29)

Two more walk families ride the same ideas:

- **Poll-row Up/Down walk** — every expandable table row is `tabIndex={0}`
  (divs click-focus in every browser, so no rdTabFocus needed) with a
  `rowNav` keydown: Enter/Space toggles the row, ArrowDown/Up moves focus
  to the row above/below and, if the row being left was open, moves the
  `open` state too — the expanded poll travels with the focus. Clamped;
  `if (e.target !== e.currentTarget) return` keeps nested links/buttons
  native. Three homes: Latest table `.rd-pl-item > .rd-pl-row`
  (rd-polls.jsx, identity = pollster name, order array `sorted`, needed a
  new `plRef` on `.rd-pl`), All-polls desktop `.rd-ap-row` and phone
  `.rd-ap-card` (rd-allpolls.jsx, identity = `rowKey(p)`, order array
  `visRows` = ONLY the rendered page of rows, so clamping happens at the
  "Show earlier months" boundary, reuses the existing `bodyRef`).
  Focus ring: one `:focus-visible` rule per row class in rd.css (accent
  2px outline inset -2px), mirroring `.rd-is-row:focus-visible`. Probe
  gotcha: a probe that clicks a row must expect the click to OPEN it —
  click is the row's toggle.
- **Poll-row Left/Right facet walk** (e22b9e2, 2026-09-29; circular
  d57fdfe) — a focused poll row ALSO takes ArrowLeft/ArrowRight: it steps
  the table's own facet tabs (Latest: `RD_PL_FACETS` via local `setFacet`;
  All polls: `FACETS` — hoisted above `rowNav` so rowNav, the pinbar and
  `RdTabs` share the one array — via the `onFacet` prop), WRAPPING round
  the ends, focus never moves to the tab row. **All-polls focus-loss trap:** the leadership and
  direction facets self-arm a "has the numbers" FACET_SCOPE filter, so the
  facet hop can filter the FOCUSED POLL out of the table — React drops its
  node, focus falls to body, and the next arrow would fire the page-level
  walk (probe symptom: facet correct but `focus: -1`, then the whole view
  unmounts as subsequent keys turn pages). rowNav now snapshots the row's
  index, and a `requestAnimationFrame` after `onFacet` re-seats focus on
  the row at the clamped position if the old node is gone (no-op when it
  survived — React keeps keyed-node focus). The Latest table's facets
  never filter rows, so rd-polls.jsx needs no rAF. Probe flow lesson:
  walking DOWN from the last shown row can't grow the page (`visRows` is
  render-time), so clamp-bottom reaches the initially-shown count, not the
  archive total; and the facet walk steps ONE tab per keypress — asserting
  a multi-step jump fails.
- **Page-level Left/Right walk** — beside the phone swipe effect in the
  header layer (73de0c58, `swipeRef`): a document keydown that only fires
  when EVERY out holds — no modifiers, `defaultPrevented` clear,
  `document.activeElement` is body/html, no `.rd-qpanel`/`.term-pop` open,
  text selection collapsed — then walks `TABS` ids through `goTab`,
  WRAPPING round the ends (d57fdfe). The navbar's own
  `Tabs.onTabKeyDown` (which always wrapped, `(i ± 1 + n) % n`) covers
  the focused-tab case, so the focused-control bail is correct everywhere
  else.

Probe: `.matilda/probe-pollrows-keys.mjs` walks both tables' rows (incl.
phone cards at 480px), the row-level facet walk (tab `aria-pressed` index
+ focus never leaving the table, wrapRight/wrapLeft at the ends), and the
page walk incl. wrap + meta+arrow no-op. `.matilda/` is gitignored —
probes stay local.

## Phone swipes WRAP too, and the hero chart takes one (4b901b0, 2026-09-29)

The touch layer beside the keydown (`swipeRef` effect, 73de0c58 ~:2100-2190;
phone-only ≤640px, 60px min flick, 800ms cap, 24px system-edge guard,
≤12px scroll drift, collapsed-selection guard) drives two steppers, and
since 4b901b0 BOTH wrap round the ends `(i + dir + len) % len`, matching
the arrow-key walks (user ask the same day; an earlier deliberate clamp —
"a swipe off the last page should do nothing" — is obsolete):

- **A swipe tab row** (`RdTabs swipe` prop → element `data-rd-swipe` +
  `__rdSwipe(dir)` on the DOM node) — its `live.current` closure now steps
  with wrap. Swiping anywhere in the row's ownership window (row rect
  bottom + 120px, or its owner section bottom, whichever is lower) fires it.
- **The page turn** (no row owns the touch point) — `go(ids[i±1 mod n])`
  turns the main view and wraps snapshot↔info both ways.

The exact-claim exception: a touch starting inside an element marked
`data-rd-swipe-exact` skips the `claimsSideways(e.target)` ancestor-walk
bail (inputs/sliders, `touch-action` outside auto/manipulation/pan-x,
overflow-x scrollers) and the row nearest-search — the element's own
`__rdSwipe` gets the gesture. The ONE claimer is the hero's
`.rd-tpp-chart` card (rd-hero.jsx): a sideways swipe on the 2PP chart
flips the hero matchup circularly through `orderedMatchups` via
`chooseMatchup` (`swipeLive`/`swipeMark` refs set beside `orderedMatchups`),
which is needed because the TrendChart svg's own `touch-action` for its
scrub rectangle made `claimsSideways` reject touches beginning on the
chart — the card itself registering `__rdSwipe` keeps the rest of the
page's claim logic untouched (a swipe on the hero's range tabs row still
steps views).

Probe: `.matilda/probe-swipe-wrap.mjs` (480×900, `page.touchscreen`
touchStart/Move/End flicks) — hero card swipes cycle every matchup and
wrap both directions without turning the page; the who-votes view row
swipes wrap Home→Age and Age→Home; the page turn wraps snapshot→info and
info→snapshot swiping on the verdict strip, which no row owns.

## Probe: .matilda/probe-rdtabs-keys.mjs

Walks all ten rows at 1440px plus the whom chip row at 900px: focuses each
row's first tab, ArrowsRight across asserting `aria-pressed` AND
`document.activeElement` indices agree at each step, wraps right back to
the first tab, wraps left to the last, walks back left to the first
(`.matilda/probe-issues-keys.mjs`'s Up/Down walk still clamps).

**The view gate that bit us:** All polls and Past cycles are hash-driven
page views (`TABS` snapshot/cycles/allpolls/info in the header layer;
`goTab` sets `location.hash`, views unmount per tab) — their rows don't
exist in the DOM on the Snapshot view, so a naive probe fails with
"only 0 tabs". Navigate with `window.location.hash = "allpolls"` /
`"cycles"`, waitForSelector the row, walk it there. Regression companions:
`.matilda/probe-issues-keys.mjs` (Up/Down trust-row walk, a398185) and
`.matilda/probe-issues-tally.mjs`.
