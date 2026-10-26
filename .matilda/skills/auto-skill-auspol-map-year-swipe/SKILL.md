---
name: auspol-map-year-swipe
description: "auspol-tracker — the /map/ year/lens WALK machinery (desktop arrow keys, phone swipes) end-to-end: walkYear/walkLens + swipeWatch (with start-target `want` predicate) in app-1-base.js, the year-swipe listener bound to the WHOLE .mp-fig figure — canvas, overlays, election timeline, story — with the native-control exclusion (widened from canvas-only in c28e1b65, 2026-10-26), the keyboard lensHover switch in app-6-ui.js plus the phone lens-ROW SCROLL (81d233eb, 2026-10-26: overflow-x:auto at all widths, the All-polls-menubar way; the old lens-row swipe-to-cycle double-fired the walk), the FIXED-VIEW WALK hold (2026-10-26, superseding 15a48d60's 'no compensation possible' verdict: on the ≤860px layout walkAim names the touched block — lens row, stage, legend, timeline or a story block keyed by its heading — and walkHold measures it before the render, scrollBys it back in the same task, then (round two) the blocks above sit in a .st-hold freeze released once when the reader is still, the story floored, corrections whole-pixel and non-cumulative via walkMark; walkLens still reveals chips horizontally in-row, never scrollIntoView), and the headless touch-probe traps: scrollIntoView + re-fetch centres before EVERY dispatch (off-viewport coordinates send NO touch events and negative assertions pass vacuously), elementFromPoint-verify exclusion spots."
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

## The fixed-view walk hold (2026-10-26) — walkAim / walkHold in app-1-base.js

User, on 15a48d60's layout-only version: "it's not very fixed. bring it
in line with the standard in eg all polls … this really only applies to
small screens". 15a48d60 measured the figure, lens row and timeline
(they do hold by layout: 0px through every walk) but wrongly concluded
the story could not be held. Measured with Safari's missing
overflow-anchor simulated (`* { overflow-anchor: none !important }`), a
year swipe on a story block moved it 18–507px, in TWO steps (the render,
then hydrateDists a frame later). Its reasons were anchor-choice errors,
not impossibilities:

1. "kid0 never moves" — right, which is why the anchor must be the block
   UNDER THE FINGER, not the story's top.
2. "interior kids move in opposite directions" — irrelevant: like
   All-polls, hold the touched block; everything else gives way.
3. "element refs die (innerHTML)" and child INDEX shifts between years
   (Now adds "Since the election" + a note) — so blocks are found again
   by KEY: `blockKey` = `sec:<h3 first text>` (`sec:chamber` for the
   #minich section, whose heading differs Now v elections), else the
   className; `.st-note` is keyless; repeats get `#n`. A key the new
   story lacks hands the hold to the next keyed block below it.

Machinery (phone layout only: `PHONE = matchMedia("(max-width: 860px)")`
— wide screens keep the story in its own column beside a sticky figure):

- `walkAim(y)` — the gesture names the spot: a FIXED_SPOTS element
  (`#lenses #stage #legend #time`) spanning y, else the first story
  block whose bottom is below y. Called by the year swipe (swipeWatch
  now passes the touchstart y as onSwipe's 2nd arg) and by a
  CAPTURE-phase document click listener (every tap, before any
  handler). `takeSpot()` only returns a spot < 1000ms old (a tap that
  changed nothing leaves a stale one).
- `walkHold(spot)` → `{ land() }`. setYear takes the spot BEFORE its
  `await loadYear` (it may be slow) and calls walkHold after it, so
  the measurement is the pre-swap position; setLens and
  lensParamChanged wrap their renders the same way. `land()` re-finds
  the block, `scrollBy`s the drift in the same task (pre-paint), sets
  `overflow-anchor: none` on <html> (Chrome's anchoring would move the
  page under the hold and read as a reader scroll), and for 700ms a
  ResizeObserver on the eyebrow, #view and #story re-runs `fix()`:
  reader scroll folds in (`want -= dy`, the 4ad3144 sign), a jump of a
  screen or more ends the hold, a new hold ends the old one.

Probe: `.matilda/map-walk-hold-probe.mjs` (uncommitted scratch,
`MAP_ROOT=<tree> [W=… ANCHOR=1 SC2=1 V=1] node …`) — per-rAF trajectory
of the touched element (story blocks tracked by the same key rule)
through map/timeline/story/chamber swipes, a timeline tap and lens taps;
max |Δ| ≤ 1.5px. Samples are rAF-start so they approximate painted
frames (the pre-fix two-step −507/−248 showed up). SC2=1 checks a reader
scroll 150px mid-hold lands exactly 150px on. Probe traps: pass setup
functions as source and INVOKE them (`(${src})()`); stop each run's rAF
recorder (old loops pushed into the next run's trace — fake alternating
0/612px traces); a repeat tap on the selected year changes nothing.

## Round two (2026-10-26): the freeze/thaw hold — All polls' iPhone lessons applied

User, on db766f5d: "Swiping on my phone produces some upward drift … it's
happened before, for example in the all polls table, but you fixed it. fix
it here too, applying the lessons of that fix." db766f5d HELD in headless
Chrome by NET position — which the rdPinScroll skill warns is not evidence:
the correction STREAM is. Its stream, per story swipe: a sync −282px then
a +259px RO correction a frame later (renderStory hydrated the "Across the
seats" chart in a rAF, so the story painted 259px short for a frame), i.e.
two big opposing scrolls in the gesture, the iPhone failure class (a
page-issued scroll mid-gesture paints late or is lost to the fling).
Fixes, each an All-polls lesson:

1. **Kill the reflow** — renderStory now paints the mini chamber and
   hydrates the dist charts in the same task (was rAF). No block changes
   height after the story paints.
2. **Freeze, then thaw once** — land() moves the NEW blocks above the
   touched block into `.st-hold` (height = old above-height, overflow
   hidden, an absolutely-positioned inner pinned `bottom:0`, so the new
   words sit bottom-aligned against the touched block and any surplus or
   shortfall is at the far top end). Zero page scrolls during the gesture.
   Release (`settle`) waits for no finger down (capture touch listeners,
   `touchesDown`), no scroll for 200ms, ≥400ms after land; then unwraps
   and makes ONE `scrollBy` measured ACROSS the unwrap (teleporter lesson:
   never against a stale spot). A walk while the holder stands supersedes
   it without releasing (`end("superseded")`) — a run of swipes costs one
   correction in all.
3. **Hold the slot** — walkHold (before the render) floors `#story`'s
   min-height at its current height until release: near the page foot a
   momentarily shorter story let the BROWSER clamp scrollY (probe showed
   "reader −715" with zero app scrolls). Superseding must not clear the
   new hold's floor (bug found: it did).
4. **Nothing cumulative** — WebKit floors scrollBy deltas (−551.3 →
   −552), and each walk re-measured from the rounded landing: 0.5–0.8px
   per swipe, 4–5px over a ten-year tour in Playwright WebKit (Chrome
   held 0) — the "drift". Now the release rounds itself (`Math.round`,
   ≤0.5px) and leaves `walkMark` {block, aimed top, scrollY}; the next walk
   on the same block with scrollY unchanged aims for the mark, and the
   release aims for `want` when the block stands within 1px of it.

5. **Floor the eyebrow** (the map-at-top drift, iPhone Plus/Pro Max
   widths) — at 414–600px an election's `#mp-meta` line wraps to two and
   Now's fits on one: swiping the map at scrollY 0 moved it ±19px (34 at
   600), and at the page top no scroll can take a shrink back. holdEyebrow
   (app-6-ui.js, called wherever the meta changes, on resize and on
   fonts.ready) floors `.mp-sec > .rd-eyebrow` at its tallest line, keyed
   by width × view: the map view on every year's House line, the chamber
   view also on every federal election's Senate line (a chamber walk can
   cross Senate→House at SA 2026). `align-content: flex-start` keeps the
   surplus at the bottom. Lines for years not yet loaded come from
   `META_FACTS`, stamped by assemble.mjs (data-stamp.mjs `metaFacts`: each
   res-*.json's date/seats/booth count, Now = data-now asOf + 2025's,
   each senate-*.json's asOf/size) — stand-in lines failed both ways
   ("8,888 polling places" for SA26's real 0 wrapped a third line at
   320px and a ratcheting floor kept the blank for good). test-map-page
   pins the stamp and a fact for every YEARS entry. Probe:
   `.matilda/map-eyebrow-floor-probe.mjs` — stage/timeline tops across
   every year in the map view and the Senate chamber, 320–860px, boot =
   loaded.

Probe: `.matilda/map-walk-tour-probe.mjs` (uncommitted scratch;
`MAP_ROOT=<tree> ENGINE=chrome|webkit W=… [GAP=300] [ONLY=re] [V=1]`):
ten consecutive swipes per surface (map at top, map half off, timeline,
story head, 2PP, Primary, Closest seats — keyed, present every year)
without re-placing; prints per swipe the net drift (net of the reader's
own scroll), the painted-frame worst (sampler RO re-armed after each
gesture so it reads painted frames), and every page scroll with its
caller (`@settle` = the release). Acceptance: cumulative ≤3, worst ≤2,
and no scroll attributed to anything but the release. GAP=300 (rapid
swipes) must show ZERO scrolls until the run ends. WebKit can't build
synthetic Touches ("Illegal constructor"), so it drives `__map.walk(dir,
y)` (walkAim + walkYear, the swipe's own path). Probe traps: swipes are
dropped while the map camera flies (sa26 reframes the projection) — the
probe waits for `T.k <= HOME.k*1.001`; puppeteer's waitForFunction is
(fn, opts, arg), Playwright's (fn, arg, opts).

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
