---
name: auspol-allpolls-mini-dots
description: "auspol-tracker — the RdApMini ('HOW IT COUNTS') past-release dots in the redesign All-polls detail (rd-allpolls.jsx ~:196-316): per-<circle> listeners with a transactional precomputed `dots` array (never mutate shared D.individualPolls rows for React keys), keyless-dot degradation (duplicate released dates / pollRowKey miss still read but don't open), mouse-tip/click-open vs touch-tip-only, Enter/Space keyboard open, and the sibling copy-poll capture-time head rewrite lives in auspol-copy-poll-image. Includes the headless-probe traps for this redesign page: in-page synthetic clicks trigger front.js __rdTabClick scrolls, React window handlers detach stale ElementHandles ('ariaLabel of null'), SVG .focus() must be done via in-page evaluate, probes must live IN-repo (out-of-workspace writes refused) and be deleted after."
source: auto-skill
extracted_at: '2026-09-28T00:49:14.315Z'
---

# RdApMini past-release dots (redesign All-polls "HOW IT COUNTS")

Shipped 2026-09-28 alongside the copy-poll head retitle (see
auspol-copy-poll-image for the PNG side, which shares the same
capture-time session). User brief: the past-release dots in the open-poll
mini record chart ("HOW IT COUNTS") must behave exactly like the release
dots in the Latest and Next-polls release strips — hover tooltip, click
to open.

The rail now has FOUR per-facet minis sharing this dot contract:
RdApMini (2PP), RdApDirMini (direction), RdApIssMini (issues) and,
since 2026-10-01, RdApLdMini (leadership net leader-rating gap) —
see **auspol-allpolls-ldgap-rail** for the leadership rail's pair
gate, facts rows and the phone/'Leaders'-label probe traps; the dot
interaction contract below is the shared one.

## Where and how

`RdApMini` in `.build/newtracker/assets/rd-allpolls.jsx` ~:196-316
(search `function RdApMini`). It draws the pollster's last ~7 months of
readings against the monthly average; the dots sitting on OTHER
releases now each carry:

- a visible `r=4 .rd-apd-dot`,
- an `r=7.5 .rd-apd-dothi` accent ring shown only while tipped,
- an `r=9` transparent `.rd-apd-hit` pointer/keyboard target.

CSS added in `rd.css` (~:1661 area): `.rd-apd-mini` gets
`position:relative`; `.rd-apd-hit` is `fill:none;stroke:none;
pointer-events:all;touch-action:manipulation` (+ `.link{cursor:pointer}`
and a `:focus-visible` accent outline); `.rd-apd-dothi` is the accent
ring; `.rd-apd-tip` positions the tooltip absolutely above the dot
(`translate(-50%,-100%)`, `pointer-events:none`, `white-space:nowrap`).
Reuses the BASE `.tip/.tip-title/.tip-sub/.tip-hint` classes from
template.html — do not restyle them per dot.

## The dots array: transactional, never mutate shared rows

First implementation assigned a `q._key` onto `D.individualPolls` row
objects during render to give React a stable key — that is a shared
gen-data payload other components own, and duplicate `released` dates
would also have collided React keys. Fix pattern that shipped:

```js
const dots = mine.filter((q) => q.released !== p.released).map((q, i) => {
  const raw = window.AP.pollRowKey ? window.AP.pollRowKey({pollster:q.pollster, released:q.released}) : null;
  const dup = mine.some((z) => z !== q && z.pollster === q.pollster && z.released === q.released);
  const key = (!raw || dup) ? null : raw;
  return { q, key, id: key || "d" + i, cx, cy, a: valOf(q) };
});
```

Per-render plain objects; `window.AP.pollRowKey` (ed2260de ~:271) is the
gate; a duplicate same-day wave by the same pollster yields a null key —
the dot still reads ("Released 23 Sep" hint) but simply does not open.
For the FOCUS-detail poll itself, exclude `q.released === p.released`.

## Sibling: twopp phone-card "usual lean" sub-line (2026-10-03)

User brief: under the twopp phone card's lean figure ("+1.7") add that
house's measured lean against the pollsters ("Usual lean −0.3"), then
"make the row height identical to that in the primary facet" (NOT a
live measurement — a fixed constant). Shipped in `rowFor`'s twopp
branch (rd-allpolls.jsx ~:1604) + rd.css ~:2285-2298:

- `D.houseLean` latest point (same source the detail's "0.3 to One
  Nation" expands on) renders as a `.rd-ap-cvalsub` (11px, right:0
  bottom:0) inside `.rd-ap-cpic` when the house HAS one, plus a
  `hassub` class.
- `hassub` strips grow to `primStripH = 56` px via INLINE STYLE — the
  constant derives from the measured primary card (122px = 11 padT +
  21.75 c1 + 2 gap + 16.19 c2 + 2 gap + 21.75 cprim + 28 cpic +
  ~4 collapse + 8 padB; a twopp card at the shared 28px strip is
  93.94, so strip = 122−93.94 ≈ 56 → sub-card renders 121.94).
- `hassub` re-anchors the figure: `.rd-ap-cpic.hassub .rd-ap-cval` is
  `top:4px; transform:none` (default `.rd-ap-cval` is the shared
  `top:50%; translateY(-50%)`); lean-less houses keep the shared
  28px centred strip, no height attribute, no sub.
- Other facets' `.rd-ap-cpic` NEVER grow and never carry a sub;
  desktop rows are untouched (no `.rd-ap-cvalsub` anywhere).

Pinned by `.matilda/probe/ap-usual-lean-sub.mjs` (heredoc-free,
committed): sub wording/alignment, Essential "-0.3" (normalise the
U+2212 minus), sub figure == detail's own usual-lean figure, primary
122/122/122 uniformity, twopp sub-card == primary card height, other
facets 28px/no-sub, desktop clean. Probe trap that cost a debug loop:
`pickFacet(page, re)` round-trips `re.source` through `page.evaluate`
— pass `re.flags` too or the `/…/i` case-insensitive facet-regex
silently becomes case-sensitive against the "Primary|Leaders|…" tabs.

## Interaction contract (mirror of rd-polls.jsx tlTip, NOT TrendChart)

This is per-`<circle>` handler territory — deliberately the OPPOSITE of
TrendChart's root-level pointer picking (see auspol-trendchart-dot-
picking). The mini chart is small enough that exact dots matter more
than catchment:

- `onPointerDown` records `ptr.current = ev.pointerType`.
- mouse enter/leave show/hide the tip; `onClick` with
  `ptr.current==="mouse"` (or synthetic key click, `ev.detail===0`)
  calls `window.AP.openPoll(key, "twopp", "the poll you were reading")`
  — third argument is the back-label the opened detail shows
  ("Back to the poll you were reading").
- touch tap only TOGGLES the tip (a tap cannot also be the trip — the
  only way to read a dot on a phone). Tip hides itself when
  `tip.src === "touch"` shows no hint line.
- `onFocus` shows the tip only under `:focus-visible`
  (`ev.target.matches(":focus-visible")`); `onBlur` hides.
- `onKeyDown` Enter / Space / "Spacebar" → `preventDefault(); open()`.
  `tabIndex=0`, `role="button"` when keyed else `role="img"`, and an
  aria-label naming figure/house/date (+ "; press Enter to open it").
- Viewport-edge nudge is a `useLayoutEffect` on `[tip]` that resets
  `marginLeft` to 0, measures `getBoundingClientRect`, and shifts the
  tip back inside an 8px page gutter. There is NO `useRafState` in this
  codebase — don't invent one; this is the actual rd-polls.jsx pattern.

Hooks order caution: `useState`/refs/`useLayoutEffect` must all sit
BEFORE the `if (!vals.length …) return` early return, or the hook list
length changes between renders. The tooltip reads
`dots.find(d => d.id === tip.id)` AFTER the early return, so it can sit
below it.

`AP.openPoll` on the allpolls tab is safe from inside a detail: the
focus effect (d1a1d215:4848) clears filters, `setOpen`s the target key,
and `backFromPoll` restores scroll — no remount. Calling it mid-detail
just swaps the open row.

## Headless-probe traps hit while verifying (2026-09-28)

The probe that verified all this died several times to probe-env
problems, not app bugs. Keep these for the next redesign-page probe:

- **Probes must live IN the repo** (e.g. `.build/probe-*.mjs`): writes
  outside the workspace root are REFUSED by the harness ("out-of-
  workspace write"), so `~/Desktop` is not an option. Untracked +
  deleted after the run; never commit.
- **Synthetic clicks on this shell scroll.** `front.js`'s window-level
  `__rdTabClick` (capture) intercepts in-page `.click()`s on tabs and
  scrolls the window to the top (and at narrow widths toggles its
  scroll-lock). Use the keyboard (`.focus()` + Enter) to activate tab
  pills, or drive `window.front.toggleTab(tab, sub)` directly to
  hide/show a tab without its click semantics.
- **In-page synthetic clicks on archive rows navigate the whole headless
  tab away** (the row's pollster URL opens in the same tab; the probe's
  outer loop then explodes off a dead context). Open rows by keyboard
  Enter instead.
- **Stale ElementHandles**: React re-renders between issuing a handle
  and calling `handle.click()` detach the DOM node → puppeteer throws
  `Cannot read properties of null (reading 'ariaLabel')`. Fetch the
  handle and click it in the SAME microtask group, or click via
  `page.mouse` at a fresh `boundingBox()`.
- **Never `.focus()` an SVG element via puppeteer's ElementHandle**
  (`Cannot focus non-HTMLElement`). Do
  `page.evaluate(() => document.querySelector(sel).focus())` then
  `page.keyboard.press("Enter")`.
- A `mouse.move` at intended coordinates can land pointerY at 0 when a
  prior in-page click scrolled the page — the app's window `pointermove`
  handler treats y≤0 as "not a mouse hover" and kills tooltips. Assert
  `page.evaluate(() => window.scrollY)` before blaming React handlers.
- **Open-detail state does NOT survive `front.toggleTab` hide→show.**
  If your probe hides the allpolls tab to test something else, re-open
  the detail afterwards or every downstream selector quietly finds
  nothing.
- **Restore probe viewport changes synchronously.** A
  `setTimeout(() => innerWidth = …)` that fires mid-probe triggers a
  React resize re-render which can unmount-remount the detail and eat
  your open row.
- The redesign pollster short-name map collides: `pollsterShort`
  returns `"Morgan"` for Roy Morgan while the cell shows "Roy Morgan" —
  assert against the full `p.pollster`, and note `.rd-ap-who b`
  textContent ends with the `↗` external-link glyph (strip it before
  comparing).

## Feature verification checklist before reporting done

1. `node .build/newtracker/build.mjs` rebuild, grep built index.html for
   `rd-apd-hit`, `"Press Enter to open this poll"`, the back-label
   string, `data-pollster`.
2. `node .build/newtracker/validate.mjs` clean.
3. Headless probe: hit circles exist + focusable; hover shows a tip with
   `Fieldwork …` and `Labor a – 100−a`; mouse click calls openPoll with
   the row key + "the poll you were reading"; Enter on a focused dot
   opens; mouse-leave drops the tip; no pageerrors.
4. Copy-poll PNG head check (both a client-published house and a
   self-published one — Roy Morgan): the simulated retitle reads
   "‹House› · Fieldwork … · Published by News24" or "… self-published …"
   with no "This poll" anywhere.
