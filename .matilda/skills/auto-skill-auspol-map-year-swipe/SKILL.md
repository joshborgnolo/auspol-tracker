---
name: auspol-map-year-swipe
description: "auspol-tracker — the /map/ year/lens WALK machinery (desktop arrow keys, phone swipes) end-to-end: walkYear/walkLens + swipeWatch (with start-target `want` predicate) in app-1-base.js, the year-swipe listener bound to the WHOLE .mp-fig figure — canvas, overlays, election timeline, story — with the native-control exclusion (widened from canvas-only in c28e1b65, 2026-10-26), the keyboard lensHover switch in app-6-ui.js plus the phone lens-ROW SCROLL (81d233eb, 2026-10-26: overflow-x:auto at all widths, the All-polls-menubar way; the old lens-row swipe-to-cycle double-fired the walk), the FIXED-VIEW WALK contract (15a48d60: interaction-point element held by LAYOUT, no scroll compensation exists or is possible — interior story kids churn in opposite directions — walkLens reveals chips horizontally in-row, never scrollIntoView), and the headless touch-probe traps: scrollIntoView + re-fetch centres before EVERY dispatch (off-viewport coordinates send NO touch events and negative assertions pass vacuously), elementFromPoint-verify exclusion spots."
source: auto-skill
extracted_at: '2026-10-26T11:30:00.000Z'
---

# /map/ — the year and lens WALK machinery (keys + swipes)

Shipped across the 8baf9407 interaction fixes (arrow-walk, phone
swipe-cycling, fit-on-view-switch, chamber boot), `2bd9b825` (iOS zoom
contract), `c28e1b65` (2026-10-26, swipe zone widened from the canvas
to the whole figure — user: "shouldn't swipe-to-change-year work on
more than just the map itself"), and `81d233eb` (2026-10-26, the lens
row scrolls natively on touch — swipe-to-cycle retired after a scroll
gesture double-fired the walk).

## Machinery map

- `walkYear(dir, wrap)` — `.build/map/app/app-1-base.js` ~:183. Keyboard
  stops at the ends, swipes pass `wrap=true` and cycle around
  YEARS = [2004, 2007, …, 2025, "now"].
- `walkLens(dir)` — ~:185; always wraps; reveals the newly active chip
  HORIZONTALLY inside the row (15a48d60 — the scrollIntoView it
  replaced could also scroll the PAGE vertically, a walk side effect):

  ```js
  const b = $(`#lenses [data-lens="${LENSES[k].id}"]`);
  if (b) { const row = $("#lenses");
    row.scrollLeft += b.getBoundingClientRect().left - row.getBoundingClientRect().left
      - (row.clientWidth - b.offsetWidth) / 2; }
  ```

  Use the rect-delta form, not `offsetLeft` arithmetic (offsetParent
  chain). `#lenses` is `overflow-x:auto` at every width — the
  2026-10-26 phone contract (81d233eb) retires the ≤860px
  `overflow-x:hidden` override so the row scrolls natively, the
  All-polls menubar way.
- `swipeWatch(el, onSwipe, want?)` — ~:192. One walk per gesture:
  horizontal-dominant (`|dx| >= 48`, `|dx| > 1.6*|dy|`), quick
  (`<900ms`), single-touch only (any multi-touch touchmove kills the
  pending gesture), all listeners passive. The 2026-10-26 `want`
  predicate runs at touchstart — `want(e.target)` false means the
  gesture never starts (`g = null`); existing callers without it are
  unchanged.
- THE year swipe — `.build/map/app/app-2-map.js` ~:570:

  ```js
  swipeWatch($(".mp-fig"), (dir) => {
    if (S.view === "chamber" || (S.view === "map" && T.k <= HOME.k * 1.001)) walkYear(dir, true);
  }, (t) => !t.closest("button, a, input, select, textarea, .mp-list"));
  ```

  The contract: anything in the map figure (canvas, overlays, the
  election-timeline strip, the legend, the story column) cycles years —
  the chamber always, the map only at the whole-country fit (`HOME.k *
  1.001`; a zoomed-in map pans instead, its d3 gestures untouched).
  Native controls keep their own gestures (zoom buttons, city chips —
  both real `<button>`s — links, form fields), and the list view's rows
  (`#list` lives inside `.mp-fig`, hence `.mp-list` in the exclusion,
  plus the `S.view` gate already blocks it).
- Lens row — `.build/map/app/app-6-ui.js` ~:601: on a phone the row
  SCROLLS natively (`overflow-x: auto`, `overflow-y: hidden` pinned by
  the probe), the All-polls menubar way (user request 2026-10-26). The
  old `swipeWatch($("#lenses"), … walkLens)` is RETIRED (81d233eb) — a
  scroll gesture double-fired the walk: the row scrolled AND the lens
  changed. The row lives OUTSIDE `.mp-fig`, so it never overlaps the
  year watcher anyway.
- Keyboard — app-6-ui.js ~:608: `ArrowLeft/Right` walk years, or lenses
  while `lensHover` (pointer over the lens row), circular.

## iOS zoom contract (don't break while editing)

`body { touch-action: manipulation }` (no double-tap smart zoom) and
`.mp-search input { font-size: 16px }` ≤860px (no iOS focus zoom) —
page.css, probe-pinned. Neither conflicts with the swipe: vertical
dominance still hands drags to the page.

## The fixed-view walk contract (15a48d60) — why /map/ has NO scroll compensation

User request: "implement fixed-view swipe just like in eg all polls
table". The All-polls rdPinScroll contract transplants as TWO
properties: the element AT THE INTERACTION POINT holds a constant
viewport position through the walk, and a walk has zero scroll side
effects of its own. Measured verdict: the map ALREADY satisfied the
first by layout (the figure, lens row and election timeline — every
swipe surface — sit ABOVE the story column's reflow, and no walk path
ever touches scrollY), so the whole landing was the second: removing
walkLens's scrollIntoView page-yank. A full scroll-compensation hold
was built, instrumented, and ABANDONED as unsound — record the reasons
so nobody rebuilds it:

1. **The story column's top edge is layout-pinned.** `#story` hangs off
   `#time`'s bottom + a margin-top, so kid0's viewport top never moves
   on a walk (measured dy≈0 every rAF tick) — any anchor on the topmost
   child can never fire a correction. Don't read "no correction" as
   "held"; the anchor was inert.
2. **Interior children genuinely move, in OPPOSITE directions on one
   walk** (kid2 +29.2 while kid3 −87.1 in one capture) — real content
   height churn from the new year's copy, not compensable jolt. No
   single scrollBy can pin all visible elements, so compensation is
   unsound in principle here. This is the walk-floor lesson
   (auspol-walk-floor: kill the reflow, never chase scroll corrections)
   one step further: some layouts can't be corrected at all — measure
   whether the INTERACTION POINT moves before building machinery, and
   treat interior churn as content, not defect.
3. **Element refs can't survive a walk anyway.** renderStory rewrites
   `#story` via innerHTML every year change, so any captured `el`
   detaches (`isConnected === false`); a hold would need child-INDEX
   anchoring, and (1) makes the index trivially motionless.

Diagnostics that paid off in an IIFE bundle (map.js exposes nothing but
`window.__map` to page.evaluate): monkey-patch scroll APIs into a page
array from evaluate (`window.__log` + wrapped scrollBy/scrollTo — zero
calls logged across all four walk scenarios was the proof), and for
in-bundle state drop temporary `if (window.__log) window.__log.push(…)`
lines into the app sources (assemble, probe, revert — never commit).
`.matilda/map-walk-drift-probe.mjs` (uncommitted, same MAP_ROOT env
pattern as the keys probe) asserts `scrollY` Δ0 across year
keyboard-walk, year swipe, lens row swipe and lens keyboard-walk;
interior story churn is asserted only as notes.

## Headless probe — `.matilda/map-keys-swipe-probe.mjs`

Uncommitted scratch in the main checkout; run against any tree with
`MAP_ROOT=<dir> node .matilda/map-keys-swipe-probe.mjs` (serves it over
127.0.0.1). 29 assertions: desktop arrow-walk, lens-hover switch, phone
map/timeline/story swipes, zoom-button exclusion, lens-ROW SCROLLING
(overflow 540>350 at 390px, overflow-x auto / overflow-y hidden, a
swipe moves `scrollLeft` and never cycles the lens), the mini-chamber
majority-label clamp (74f89499), zoomed-pan vs fit-cycle, the iOS zoom
contract. Traps (literally hit):

1. **Scroll targets into view before touching.** `Input.dispatchTouchEvent`
   at coordinates outside the viewport sends NO events at all — the
   first timeline-swipe run hung 15 s on `waitForFunction` for exactly
   this. Pattern: `el.scrollIntoView({ block: "center" })`, ~120 ms
   settle, THEN re-fetch `getBoundingClientRect` centres and dispatch.
   Re-fetch EVERY time the page scrolls or the view switches — stale
   centres dispatch into the wrong element with no error.
2. **Negative assertions go vacuous.** "a swipe on the zoom button
   changes nothing" passes trivially if the touch never landed (see 1).
   Sandwich exclusions between two POSITIVE swipe assertions (timeline
   cycles to 2004 … zoom-button #zout … story cycles back), so a dead
   dispatch path fails the neighbours instead of passing green. For a
   plain-text story spot, `elementFromPoint` each candidate and skip
   anything `closest("a,button,input,select,textarea")` — a paragraph
   whose centre happens to sit on a link would exercise the exclusion
   predicate, not the walk.
3. Synthetic one-finger swipes ARE `touchStart/Move/End` via
   `page.createCDPSession()` (`Input.dispatchTouchEvent`, explicit
   `id: 1`, ~160 px horizontal, tiny ±8 px vertical so it passes the
   dominance test) — no click is synthesised, so tap-only handlers
   (timeline year stops) don't fire mid-swipe.
4. `window.__map` exposes `S.year`/`S.lens`/`T`/`HOME` for assertions;
   year switches need long waits (`waitForFunction` 15 s — first visit
   to a year loads its data).

## Gate chain after any edit here

```
node .build/map/assemble.mjs          # regenerates map/map.js + stamps map/index.html
node .build/test-map-page.mjs         # includes the conflict-marker assert on map/index.html
MAP_ROOT=<checkout> node .matilda/map-keys-swipe-probe.mjs
```

## Related

- auspol-map-touch-scroll — the vertical side of the touch contract
  (d3-zoom preventDefault trap, homePinch), plus the shared assemble/
  gate notes.
- auspol-headless-geometry-verify — general page-geometry probe hygiene.
