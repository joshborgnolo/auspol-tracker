---
name: auspol-rdtabs-arrow-walk
description: auspol-tracker — the page-wide left/right arrow-key tab walk (shipped 5d374ed, 2026-09-29): one rdTabsKey factory in rd.jsx wired into the shared RdTabs group covers ~12 tab rows free, and the hand-rolled rows (past-cycles Compare/Measure, all-polls pinbar, issues narrow chips) attach it themselves. Invariants (options in DOM order, focus follows selection, clamp, arrows only when a tab has focus), and the probe lesson that All polls and Past cycles are hash-driven page views whose rows don't exist on the Snapshot view.
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
- Focus travels with selection, so a held arrow key keeps walking; clamps
  at both ends (no wrap); preventDefault suppresses horizontal scroll.
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
- **Page-level Left/Right walk** — beside the phone swipe effect in the
  header layer (73de0c58, `swipeRef`): a document keydown that only fires
  when EVERY out holds — no modifiers, `defaultPrevented` clear,
  `document.activeElement` is body/html, no `.rd-qpanel`/`.term-pop` open,
  text selection collapsed — then walks `TABS` ids through `goTab`,
  clamped. The navbar's own `Tabs.onTabKeyDown` covers the focused-tab
  case, so the focused-control bail is correct everywhere else.

Probe: `.matilda/probe-pollrows-keys.mjs` walks both tables (incl. phone
cards at 480px) and the page walk incl. clamp + meta+arrow no-op.
`.matilda/` is gitignored — probes stay local.

## Probe: .matilda/probe-rdtabs-keys.mjs

Walks all ten rows at 1440px plus the whom chip row at 900px: focuses each
row's first tab, ArrowsRight across asserting `aria-pressed` AND
`document.activeElement` indices agree at each step, clamps right, walks
back left, clamps left.

**The view gate that bit us:** All polls and Past cycles are hash-driven
page views (`TABS` snapshot/cycles/allpolls/info in the header layer;
`goTab` sets `location.hash`, views unmount per tab) — their rows don't
exist in the DOM on the Snapshot view, so a naive probe fails with
"only 0 tabs". Navigate with `window.location.hash = "allpolls"` /
`"cycles"`, waitForSelector the row, walk it there. Regression companions:
`.matilda/probe-issues-keys.mjs` (Up/Down trust-row walk, a398185) and
`.matilda/probe-issues-tally.mjs`.
