---
name: auspol-section-fold
description: "auspol-tracker — the Now sections' eyebrow Hide/Show roll-up (RdFoldBtn, shipped 2026-11-09 commit 1b355b37): collapsed ids persist as ?hide=id,id via a parameterised history[verb] try/catch writer — .build/test-tab-pages.mjs greps EVERY .build/newtracker/assets file for bare history.pushState/replaceState( so new URL writers must use the module-local (verb,to) wrapper idiom — the rd-shut class is applied imperatively by the button (works for RdSec sections and the hero's bespoke one alike), and folded sections get contain-intrinsic-size:120px so a skip placeholder is 10x too tall otherwise. RdSec gains the button from a bare `fold` prop; Now's nine sections + the hero are the current carriers."
source: auto-skill
extracted_at: '2026-11-09T06:40:00.000Z'
---

# The Now sections' fold (RdFoldBtn)

The retro panel shade translated to the rd idiom. Collapse a section from a
Hide/Show word in its eyebrow; the fold persists as `?hide=…` in the address
bar, so a link a researcher passes on opens the page in the same shape. The
query is the ONLY persistence (no localStorage, no saved views).

## Where the machinery lives

`.build/newtracker/assets/rd.jsx`, module scope above `RdSec`:

- `rdFoldRead()` — `new URLSearchParams(window.location.search).get("hide")`
  split on comma into a Set. `rdFoldState()` lazily caches it.
- `rdFoldWrite()` — serialises the Set back into the query (deleting the
  param when empty) and calls `rdFoldWriteUrl("replaceState", path + "?" + q
  + hash)`.
- `rdFoldWriteUrl = (verb, to) => { try { history[verb](null, "", to); }
  catch {} }` — the router's urlWrite idiom verbatim. **The form is not a
  style choice**: `.build/test-tab-pages.mjs` walks every `.js/.jsx` in
  `.build/newtracker/assets` and fails on `/history\.(pushState|replaceState)\(/
  (the pin exists because a view-layer writer once shipped bare
  replaceState). Parameterised `history[verb]` passes the grep, and the
  try/catch means a file:// copy's SecurityError refuses the write without
  vetoing the fold itself. State updates still apply (rdFoldNotify) if the
  URL write throws.
- `RdFoldBtn({ id })` — subscribes a per-mount tick to a Set of listeners,
  reads `shut` from `rdFoldState()`, and **applies the class imperatively**:
  `React.useLayoutEffect(() => document.getElementById(id).classList.toggle("rd-shut",
  shut))`. RdSec-rendered sections and the hero's hand-written `<section>`
  fold identically without threading React class plumbing through two files.
  It also owns a page-lifetime `popstate` listener (module flag
  `rdFoldWired`) that re-reads the query — back/forward to a shared folded
  URL re-applies its shape.
- Exported via `Object.assign(window, { ... RdFoldBtn, ... })` — rd-hero.jsx
  renders it for `#two-party` outside any RdSec (`<span
  className="rd-eyebrow-tools"><RdFoldBtn id="two-party" /></span>`).

## The render hooks

`RdSec` gained a bare `fold` prop: `{…, fold}` renders the button inside the
existing `.rd-eyebrow-tools` span, after `tools` content:

```jsx
{(tools || fold) ? <span className="rd-eyebrow-tools">{tools}{fold ? <RdFoldBtn id={id} /> : null}</span> : null}
```

Carriers (all 2026-11-09): rd-panels.jsx primary-vote, leadership, direction,
who-votes, switching, issues, undecided, confidence; rd-polls.jsx
latest-polls; rd-hero.jsx's bespoke hero. Other tabs' RdSec sections
(cycles, allpolls) take no fold — the control lands per call-site, not per
component global.

## CSS (rd.css, beside `.rd-eyebrow-tools`)

- `.rd-fold` — 13px/500 ink-2 word, `min-height: 24px` (KEEP IT ≤24: the
  eyebrow is `align-items: baseline` with the 26px title line; a 28px
  min-height inflated the row to 33px and every section head grew ~7px).
  The 44px touch band is an inflated `::after` instead (inset -10px -6px) —
  same trick as rd-chip's, harmless here because the eyebrow is not a
  scroll container.
- `.rd-sec.rd-shut > :not(.rd-eyebrow) { display: none !important; }` — the
  head stays, the body leaves the page.
- Inside the existing cv-`@supports` block: `body.rd .rd-sec.rd-shut {
  contain-intrinsic-size: 120px; }` — WITHOUT the `auto` keyword. The blanket
  sections placeholder (`auto 1200px`) would leave a ~1200px hole for a
  folded-and-still-skipped section; 120px approximates the real
  head-and-padding height and is replaced by the true size on reveal.

## Collision notes

- Queries are param-shared state: cycles' bitmask writers and the All-polls
  filter sync own `window.location.search` too. `rdFoldWrite` merges into
  the CURRENT URLSearchParams — never rebuilds the whole string from its own
  state. Keep it that way.
- `warmSections` skips shut bodies naturally (`checkVisibility` false on
  display:none children) — no interaction.
- The scroll-spy (auspol-nownav) measures on scroll, so a post-fold height
  shift re-derives positions for free; a chip jump to a SHUT section lands
  on its collapsed eyebrow (acceptable, by design).
- Retro harvest (`.build/retro/blocks.mjs`) already filters `rd-eyebrow-tools`
  trees out of harvested blocks — fold controls never appear in /retro/
  content. `npm test`'s retro Now pin proves it still passes.

## Probe

`.matilda/probe/now-frames.mjs` (tracked via `git add -f`, PORT 8964): clicks
fold on #issues → asserts rd-shut applied, all children hidden, button flips
to Show, query is `?hide=issues`; folds #confidence second → query carries
both; reloads on the folded URL → both reopen shut, an untouched section
stays open; un-folds both → body visible again and the param is gone; and the
eyebrow holds one slim row (unframed ≤44px, framed ≤52px).
