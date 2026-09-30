---
name: auspol-rdpinscroll-row-pin
description: auspol-tracker — rdPinScroll (rd.jsx), the pinned-view contract for tab/chip walk rows whose head+dek glide above them (2cf6d8c machinery; 1d76fd5 generalised it to ONE ARG — pins even with the dek on screen, dek bottom glued to the row — plus the >1-screen "jump-bail", and added Leadership metric tabs + All-polls facet/flip/basis wiring; 2d23b7f added the ARRAY form — first on-screen candidate takes the pin — and re-anchored All-polls on .rd-ap-bar because the phone twopp .rd-ap-pctl counts strip sits in flow BETWEEN the tab row and the rows; 4ad3144 fixed the mid-glide USER-SCROLL FOLD sign — the anchor target is viewport-space, so a user scroll folds in as want -= dy; with += every tick fought the user 2x and shoved the page to the top; 08329ba fixed the OFF-SCREEN anchor case — pinView pinned only the compare board, so deep in #cyc-summary the pin no-oped and every compare swipe shoved an iPhone reader ~66px down: CHROME'S NATIVE scroll anchoring hides a missing pin, SAFARI HAS NO overflow-anchor — probe with an injected `* { overflow-anchor: none !important; }` <style> to see what Safari sees; fix = caller-side array preference list [board, first visible .rd-cs-row, .rd-cs-key, .rd-foot]): per-panel pinX + pickY wrappers, the sticky-bar reserve gate, and the CHROME SCROLL ANCHORING counter-force root cause (focused control outside the row becomes the browser's anchor and re-scrolls every frame against the rAF pin — suppress overflow-anchor on <html> for the pin window; 5a44431 then replaced the rAF CORRECTIVE PATH with a PRE-PAINT one — rAF-applied scrollBy paints a frame LATE in Safari, so during the 320ms glide the pinned strip breathed ±8px/frame = user-visible bounce/stutter even at net-zero drift: RdGlide hands its wrapper to the live pin via window.__rdPinObserve(el) and a ResizeObserver on that block runs the shared fix() after layout, BEFORE paint, so correction and cause land in the same painted frame; the rAF loop survives only for user-scroll fold + jump-bail. In headless Chromium rAF corrections paint BETWEEN frames — the defect is locally invisible, diagnose via .matilda/dbg-cycles-traj.mjs per-rAF strip-top trajectory + wrapped scrollBy list and look for the post-swipe 8px→0 staircase; fixed signature = each correction paired with a sub-pixel residue at the SAME millisecond). Diagnosing "my rAF scroll fix is losing" or "the pin fights my scroll": instrument all scroll APIs via evaluateOnNewDocument (scrollY moving with no JS scroll call = the browser, not the app) and record per-rAF aligned frames + wrapped scrollBy deltas (.matilda/dbg-pin-fight.mjs) — corrections ≈ -2x each user pan = the fold sign is wrong. Freeze era (2026-09-30): every device-perfect case had zero reflow above its row (all-polls was never exercised, not better) — above-row glides now FREEZE for the pin window (rdPinClip + atomic same-frame thaw, never animated), and the pin CLOSE teleporter is dead — done() scrolling back to the stale anchor reverted the user's whole scroll (a probe's 8272px setup scrollTo undone; step()'s >1-screen jump-bail guard called the same teleporting done() so it guarded nothing) — pin close now scrolls ONLY the row's measured delta ACROSS rdPinThaw, regression = probe-cycles-pin leave-mid-pin; locate the guilty scroll with a goto-time scrollTo/scrollBy/scroll wrapper logging Error().stack. 3b0dc00 then GENERALISED the freeze past glide blocks (user's third iOS report: "swiping between months views on primary vote chart, and approval/favourability/both, causes drift" — net anchor ≈ 0 headless, mid-gesture CORRECTION STREAM is the real signal): the actual movers were never .rd-glide-in — the hero card's .rd-evlist unmounts (0–230px by range, shared range state resizes the HERO card when stepping range on the PV card), .chart's event lane snaps ±30px (svg height constant, the wrapper grows), and Leadership's UNGLIDED RdSub dek snaps 45↔68px (unglided ON PURPOSE for the desktop subgrid). rdPinClip(row, rowTop) now also freezes every EARLIER SIBLING along the row's ancestor chain (skip zero-height; skip branches containing .tabs.sticky/.info-index/.rd-ap-headwrap/.poll-table thead th — overflow:clip kills sticky) and the pin RO-watches the ancestor chain as backstop — RO alone CANNOT win the race: rAF runs before RO in the same rendering iteration, so step() eats the big drift and the RO only ever sees the ≤0.2px residue. Acceptance = probe-swipe390.mjs attributing every correction via Error().stack (thaw:/step:/RO:): ZERO step: corrections, the single thaw: release ~560ms after lift is by design. Later commits then reconciled the freeze↔slice tension for boxes ON screen (cycles dek "cut off mid-paragraph, blocked out" — user reported it gone after a000f12, then "rarely, but still happens"): rdPinClip freezes an on-screen box ONLY while rdTouchHot is live, and heat now arms ONLY on a sideways-sliding touch that meets the app swipe effect's own gates (|dx| ≥ RD_TOUCH_SLIDE_DX 60, dy ≤ dx·0.5 — taps never arm), and BOTH freeze paths take the gate (the .rd-glide-in parent sweep originally froze unconditionally — the cycles dek lives inside its own glide wrapper's parent, THE residual slicer); "on screen" = readable past the stuck tabs bar (r.bottom > barHeight+6), not r.bottom > 0. probe-cycles-pin's phone touch-TAP case (no dek-chain __rdFrozen + sbSmooth live-reflow contract) pins it. 2026-09-30 follow-up: rdPinScroll is now a TOUCH-DEVICE contract only — it no-ops on fine pointers via `(pointer: coarse)`, desktop clicks/keys reflow live, and the pin probes gate row-hold assertions per rung on the same media query. Same-day coda (user: "can you implement it on laptop just in the all polls table?"): the gate moved to a two-arg `rdPinScroll(row, fine)` — callers pass `fine` to opt a row IN on fine pointers, and pinAp (alone) does, so the All-polls filter bar + rows hold through facet walk/flip/basis on a laptop exactly as on a phone while every other section stays touch-only; probe-allpolls-pin therefore asserts row-hold on EVERY rung (its mid-pin user-scroll case sends a 180px mouse-wheel tick on desktop) while panels/cycles probes stay per-rung gated. Also: pinWhom's preference list leads with `.rd-iw-tabs` (the grouping menu) since 1e2838f put that menu at every width — pinning the `.rd-iw-chips` Issue row first left the menu the user tapped gliding away, and 3cc1b40 then dropped the phone "Issue" kicker, so the chips row is `.rd-iw-tabs`' nextElementSibling with no `.rd-iw-k` of its own at phone widths.
source: auto-skill
extracted_at: '2026-09-30'
---

# rdPinScroll — pinned view while the head/dek glides above

The user's contract for walk rows: around a panel's tab/chip row, stepping
it "keeps what I see identical" — the row holds its screen position
through the 320ms `RdGlide` head/dek height morph instead of riding the
story block up or down. On a fine-pointer computer the fixed view is OFF
(pointer-gate below): clicks and keys just reflow live — unless the
caller passes the `fine` opt-in, which only All-polls does (user's ask:
the laptop's facet walk holds the table the way a phone's does).
**On touch devices
the contract is unconditional** since 1d76fd5:
it holds scrolled past the dek (the original case) AND with the dek on
screen — "what the user keeps is the control they touched and everything
below it", so the dek's bottom edge glues to the row and the changed
words spill upward. Wired rows: cycles (compare/measure), who-votes
(group tabs, party chips incl. digit keys), issues (whom group/issue
toggles), undecided, **Leadership Approval/Favourability/Both metric
row** (`pinLd`/`pickMetric`, row = `.rd-ld-panel`[1]
`[aria-label='Leader rating']`), and **All-polls** (facet tabs — pinbar
`pint` buttons AND the main `.rd-ap-tabs`, the `.rd-pl-flip` matchup
flip, the published/implied counts-basis switch inside the "?" qpop, and
rowNav facet hops).

## The machinery (rd.jsx)

`rdPinScroll(row)` — ONE argument since 1d76fd5 (the old second `dek`
param gated the pin to dek-scrolled-off; don't resurrect it). A rAF loop
that measures the row's viewport top each frame and `scrollBy`s away the
drift the glide causes, until `MORPH_MS + 240`. Wrinkles that took real
debugging:

- **Jump-bail** (1d76fd5) — per frame `const dy = y - lastY; if
  (Math.abs(dy) > window.innerHeight) { done(); return; }`. A wheel /
  trackpad tick folds into the anchor (the user nudged), but a jump of a
  screen or more — Home/End, a nav pill, a `scrollIntoView`, a probe's
  `scrollTo` — is the user LEAVING mid-glide; must hand back instead of
  dragging the page to where the row was. (Also fixes probe cross-block
  interference: a still-armed pin from one block used to fight the next
  block's 13 000px `scrollTo` — "row not in view" / "drifted −13 090px".)
- **The fold is `want -= dy`, NEVER `+=`** (4ad3144) — `want` is a
  VIEWPORT-space target: a scroll down of +dy moves content UP on screen,
  so the anchored row's top DEcreases by dy and the target follows with
  `want -= dy`. With `+=` (the latent bug since 1d76fd5) each user pan
  tick was answered by a correction reverting it AND pushing past —
  traced corrections of −90/−150/−170 against +45/+75/+65 pans marching
  scrollY 482→4: the user's verbatim report "scroll is all glitchy…
  sometimes I'm pushed up to the top of the page". It only became
  user-reachable via 2d23b7f: in the All-polls pinned-headwrap regime
  `.rd-ap-bar`'s bottom sits at 46px vs a 43px reserve — 1px on screen —
  so the array picks the bar as anchor and the bad fold fired on the
  common phone swipe→scroll gesture. Diagnosing a fight: aligned-frame
  instrumentation (.matilda/dbg-pin-fight.mjs — per-rAF records of
  [t, scrollY, barTop, barDocTop] interleaved with wrapped scrollBy
  deltas), scenario A swipe-only (must converge to ZERO corrections),
  scenario B swipe + gentle drag (must also show zero). Corrections ≈
  −2× each user pan = wrong fold sign. Don't confuse with the by-design
  page-turn: a diagonal swipe outside any `data-rd-swipe` row turns the
  main tab and goTab scrolls to top ON PURPOSE.
- **Reserve gate** = `Math.min(bar.bottom, bar.height)` from
  `.tabs.sticky`'s rect — the bar is not stuck near page top (unstuck
  ~202px down), so clamp the reserve to the bar's own height.
- **`done()` single exit** — every bail path (`!row.isConnected`,
  jump-bail, stop-time) calls it; it clears `rdPinRaf` AND restores
  `overflow-anchor` (below).
- Per panel, wire a `pinX()` helper (locate the row element) and route
  every state setter through a `pickY(id) => { pinX(); setY(id); }`.
- **Probe focus restoration can fight the pin**: probes that snapshot
  and restore focus by element handle MUST be re-SNAPPING
  (`__rdSnapNearest`) before any manual `mouse.click`
  (`probe-allpolls`'s flip flow SAVED before the pin but never
  re-scrolled, so the subsequent "recentre" click landed exactly on the
  flip BUTTON). Selectors alone don't save you if you've scrolled the
  page mid-block — assert final scroll against a recorded marker, not
  against the pre-block original. (Was the mystery behind
  probe-allpolls's post-2cf6d8c miss-the-facet-tab flake.)
- **Parity rung gate** (`compare-twice.mjs`): on non-4G hosts, if the
  5-10 min initial compilation warms up, the M1 rung's pin probes DOUBLE
  glitch (probe_allpolls_basis_hop_offback had a curious 7.5px mid-glide
  and graduate failures). Re-run the gate cold (no cache) if timings
  look wrong on the first rung; the pin friction only materialised under
  real compilation contention.
- **Global-visibility gotcha**: `rdPinScroll` is a top-level `function`
  declaration in rd.jsx — classic-script functions are already global,
  so it needs NO entry in rd.jsx's `Object.assign(window, ...)` export
  list (that list is only for `const` arrow components). If you refactor
  it to an arrow, add the export or callers in rd-panels/rd-allpolls
  throw `ReferenceError` at click.

subtle: **Careful with `scrollBy`+stop-time on substeps**.
`done()`'s `t0 = Date.now() + MORPH_MS + 240` means a SECOND pin triggered
inside the first's window RESETS t0 — but keeps the SAME page scroll
position (scrollBy is relative-to-current). Any imperfection in glide
timing (prefers-reduced-motion, fractional scroll, a frame drop) makes
the composite pin HOLD a position the rAF never actually re-locked:
that's the `leadership_stop_reset_gap` flake (row drifted 5px in the
100ms between bails). If a chain of pins is likely (a walk hitting a
flip button that re-pins), chain by handoff: stop one pin, `done()`
returns `window.scrollY`, start the next at THAT scrollY. Not worth the
threading if the two pins target different rows though (they usually
do).

## The ARRAY form + the All-polls re-anchor (2d23b7f)

`rdPinScroll(row)` now also takes an ARRAY: it picks the first
candidate whose rect spans [reserve(), innerHeight] — "an array is a
preference list … the first one actually on screen takes the pin".
Needed because All-polls' pin anchor moved from `.rd-ap-tabs` to
`[.rd-ap-bar, .rd-ap-tabs, first data row]` (pinAp, rd-allpolls.jsx
~1456-1473): on phone the twopp-only counts strip `.rd-ap-pctl`
(44px, "Labor v One Nation … implied flows"/"as published") renders IN
FLOW between the tab row and the bar, so pinning the tab row held the
tabs but let the bar, column head and every row jump −44px entering
twopp and +44px leaving it (the user's bug report — "implied flows
toggle displaces 2pp view rows"). Pinning the BAR (below the strip,
above headwrap+rows) lets everything above it spring with the
dek/counts strip while all table geometry holds; deeper scrolls fall
back through the tab row to the first data row. General rule: find
what in-flow blocks between the pinned element and the content the
user is staring at — the anchor must sit BELOW all of them.

Second layer of the same bug (desktop): the Issues facet's
`.rd-ap-hrow` measured 43px vs 57px on the 2pp/scale-header facets, so
its rows sat ~15px higher regardless. Fixed with a CSS floor —
`box-sizing:border-box; min-height:57px` on `.rd-ap-hrow` (rd.css
:1676): every facet's column head now meets the tallest. When a
row-top drift reproduces on ONE facet only, suspect its column-head
height and level it with min-height BEFORE touching the pin.

Behavioural note (by design, don't "fix"): on phone hopping OFF twopp
the TAB ROW now rides up 44px with the departing strip; the contract
is bar-and-below holds. The probe records tab-row positions as notes
only — assertions live on `.rd-ap-bar` and the first data row, LIM=3px.

Probe trap (cost a full failing run): the pinned-walk start must
scroll the TAB ROW to reserve+16 (what a user actually sees), NOT the
bar — clicking a control parked UNDER the sticky `.tabs.sticky`
reserve hits the site tab-bar's `BUTTON.tab` instead
(document.elementFromPoint proved it; 480px rung) and navigates to
#cycles, which cascades into mass failures that look like broken
wiring ("flip did not switch the matchup", "facet walk missed tab 1",
"qpop button not found"). Debug harness: .matilda/dbg-ap-click.mjs —
elementFromPoint at the intended click point before and after.

## The OFF-SCREEN anchor + Safari's missing overflow-anchor (08329ba)

User report: "drift downwards on swipe in past cycles chart section".
Only reproducible DEEP in #cyc-summary (reading the summary strips /
charts with the compare board scrolled off the top) and only on
iPhone. Three layers:

1. **The pin bails when its anchor is off screen.** pinView passed
   only `boardRef.current` (`.rd-cc`). Deeper in the section that
   block's rect is above the viewport → `r.bottom < reserve()` →
   rdPinScroll no-ops → nothing holds the reader's spot while the
   compare-set step re-glides the head/dek above (measured story
   docTop spread 129px phone / 74.5px desktop; per-swipe deltas cycle
   +66/0/−66 across All→Re-elected→Ousted, +129/−42/−87 in
   Change-since-election mode).
2. **Chrome's native scroll anchoring papers over the missing pin**
   (the probe with anchoring ON showed 0.0px shift at the same scroll
   depth). **Safari has no `overflow-anchor`** — on an iPhone every
   swipe shoved the reader down the page by the dek's height swing.
   DIAGNOSTIC: inject
   `<style id="rd-no-anchor">* { overflow-anchor: none !important; }</style>`
   via page.evaluate in the probe and headless Chrome shows exactly
   what Safari sees. Remove the style element after the block.
3. **The swipe claim outlives the pinned element's presence.**
   `rowAt()` extends the compare row's claim over its whole section,
   so a swipe deep in #cyc-summary still steps the compare set while
   the user stares at a strip — that's why an off-screen anchor
   matters at all.

**Fix** (rd-cycles.jsx pinView, ~:273): a CALLER-side preference list
— the array form already existed, the bug was the one-element array.
`[boardRef.current, firstVisibleStrip, keyEl, footEl]` where
firstVisibleStrip = first `.rd-cs-row` inside `#cyc-summary` with
`r.bottom >= 0 && r.top <= innerHeight` (found via
`[...sec.querySelectorAll(".rd-cs-row")].find(...)`), then
`.rd-cs-key`, then `.rd-foot` — the reader's own ground holds wherever
they are. General rule: **for any section whose claim extends beyond
the pinned control's viewport presence, the preference list must
include section-interior ground** — an on-screen strip/key/foot —
or the pin silently no-ops exactly where the gesture reaches.

Proof + regression: `.matilda/dbg-cycles-offscreen.mjs` (diagnostic —
scrolls `.rd-cs-row[2]`/`[4]` to mid-viewport, anchoring disabled,
3 swipes, prints reader shift + scrollBy call list; pre-fix at strip
4: shift 66.0px with scrollBy 0, post-fix 0.0px at both depths with
the pin's corrections visible). Permanent case in
`probe-cycles-pin.mjs`'s phone-only "deep summary" block (after the
measure-switch case): injects the no-anchor style, scrolls
`.rd-cs-row[4]` to 450px with the compare row off-screen (asserts
ccTop < 0 and section bottom > 80), swipes 3× asserting the set steps
`(s0 + s) % 3` and strip top within LIM=3, then REMOVES the style.

Dead ends ruled out with purpose-built probes (don't re-try): (a)
gesture-arc false trigger — `.matilda/dbg-cycles-arc.mjs` showed
flat/±12px arced swipes land 0.0px residual (the recogniser's
`|scrollY - s.sy| > 12` abort guard works); (b) pin self-fight —
scrollBy traces show the pin's corrections are the correct
counter-force once an on-screen anchor exists.

Commit wrinkle on 08329ba: the rebuild's index.html and the 08b413e7
layer carried two hunks NOT from this fix — an `evt.x != null`
readout guard (from 2015bf5's phone-evlist rd.jsx source, committed
there without regenerating the layer — torn-build lag) and an
`own0`/`.chart` swipe gate (the SOURCE was a sibling session's
UNCOMMITTED in-flight edit to the 73de0c58 source, sitting dirty in
the shared tree). Always trace a surprise hunk before composing the
message: `git diff` the hashed layer to name the hunk, then
`git log -1 -- <source>` — already committed (torn-build lag) means
the rebuild heals it and it's safe to fold in with a note in the
message; uncommitted (sibling in-flight work) means DON'T commit the
generated files (index.html can't be hand-carved — it would ship
their half-finished work while their source stays uncommitted) —
commit only your source file first; if the fix must go live, wait for
their commit, then rebuild + push. `stat -f %Sm` on the dirty sources
vs `date` tells you whether the sibling is active (minutes = active).

## rAF corrections paint a frame LATE in Safari — the pre-paint pin (5a44431)

User report one commit after 08329ba: "there's still drifting,
bouncing, stuttering". 08329ba made the pin fire at all deep in
#cyc-summary, and its NET effect was perfect (strip returns to its
doc spot) — but on a real iPhone the strip visibly oscillated through
every compare swipe. Root cause is a frame-compositing fact, not a
logic bug:

- The pin measured and corrected via `scrollBy` inside **rAF**
  callbacks. Safari's scroll compositor paints an rAF-applied
  programmatic scroll **one frame late**. Each frame of the 320ms
  head/dek height glide therefore painted the dek-collapse shift
  FIRST (strip moves ±8px on screen), then next frame's rAF scrolled
  it back — the strip under the reader's finger breathed every frame
  (read as "bouncing"), and the discrete per-frame correction sizes
  read as "stutter". Chrome's compositor instead applies rAF scrolls
  in time for the same painted frame (and Chrome's native scroll
  anchoring already smoothed the rest).
- **Headless Chromium cannot see this** — correction and shift land
  in the same painted frame locally even with overflow-anchor killed,
  so all three pin probes stayed green through the defect. Diagnosis
  needed a TRAJECTORY probe (`.matilda/dbg-cycles-traj.mjs`): records
  `[t, scrollY, stripTop]` per rAF plus a wrapped `window.scrollBy`
  call list through a 6-move touch swipe at a deep-summary scroll
  depth. Pre-fix correction signature: 19 discrete scrollBy calls,
  8.2px→0 staircase, all AFTER the gesture's ~300ms idle window;
  strip-top trajectory itself smooth (which is the proof the bug is
  paint-timing, not logic). Post-fix signature: every correction
  PAIRED with a sub-pixel residue at the SAME millisecond
  (`2547ms:8.2 2548ms:0.2 …`) — the RO fires intra-frame.

**Fix** (rd.jsx; shipped with rd-hero.jsx untouched — the sibling
parallel work was theirs): ResizeObserver callbacks run after layout
but BEFORE the frame paints, so correcting from one compounds the
correction with its cause in ONE painted frame — the strip never
visually leaves its spot.

- rd.jsx module state + API: `let rdPinRO = null;` beside
  `rdPinRaf`/`rdPinAnchorSave`; rdPinScroll extracts a shared
  `fix = () => { const drift = row.getBoundingClientRect().top - want;
  if (drift) { window.scrollBy(0, drift); lastY = window.scrollY; } };`
  used by BOTH paths; installs
  `window.__rdPinObserve = (el) => { … rdPinRO = new
  ResizeObserver(() => { if (!row.isConnected) return;
  window.__rdPinROn = (window.__rdPinROn||0)+1; fix(); });
  rdPinRO.observe(el); }` (disconnects any prior RO first — newest pin
  wins).
- RdGlide (rd.jsx ~:227, the glide-start `useLayoutEffect`, right
  after `o.style.height = h + "px"`): `if (window.__rdPinObserve)
  window.__rdPinObserve(o);` — the gliding block hand-delivers its
  wrapper to whichever pin is live. Only blocks that RESIZE need the
  hook; content changes inside a fixed-height block don't shift
  anyone.
- `done()` additionally disconnects rdPinRO, nulls it, and clears
  `window.__rdPinObserve` when it still === this pin's hook (an
  overlapping newer pin must not lose its hook to an older pin's
  cleanup). Any new rdPinScroll() call also disconnects a live RO
  from the previous pin BEFORE its cancelAnimationFrame — two pins
  never observe at once.
- **Do NOT delete the rAF loop.** The RO only fires on the observed
  block's RESIZE; the rAF loop still owns the mid-glide USER-SCROLL
  fold (`want -= dy`, 4ad3144), the >1-screen jump-bail and the
  !isConnected bail. RO and rAF share the same `fix()` so both agree
  on `want`/`lastY`.

The RO callback increments `window.__rdPinROn` — probes assert
engagement cheaply (`__rdPinROn > 0` after a glide) instead of
reasoning about paint frames they cannot observe. All three pin
probes re-green post-fix with overflow-anchor killed, npm test and
validate.mjs clean.

## THE counter-force: Chrome scroll anchoring (root cause of "pin loses")

Symptom: group tabs pinned perfectly, but a **who-votes party chip**
click let the row ride off screen by the full dek delta, even though the
rAF fired every frame (measured valley only −6.7px). Chip clicks focus
the chip; the chip sits in its own row BELOW the pinned row, still on
screen while the changing dek is OFF screen — so Chrome's scroll
anchoring picked the focused chip as its anchor node and re-scrolled
**every frame** to hold it still through the layout change, fighting
rdPinScroll's compensation (timeline: focus event → unsolicited +33px,
then +2–20px browser steps vs scrollBy counter-steps). Group tabs were
immune because the focused tab moves WITH the pinned row.

**Fix** (rd.jsx, 2cf6d8c): at pin start,
`document.documentElement.style.overflowAnchor = "none"` (exact prior
value stashed in module-level `rdPinAnchorSave`); `done()` restores it.
Suppressing on `<html>` for the ~560ms window silences anchor selection
page-wide — fine, since the page isn't scrolling then.

## How to prove a scroll is the browser's, not the app's

App-side greps found nothing scrolling the window except the pin. Proof
came from instrumentation in the probe page
(`page.evaluateOnNewDocument`): wrap `window.scroll/scrollTo/scrollBy`,
`Element.prototype.scrollIntoView` and `HTMLElement.prototype.focus`
(logging timestamp + `new Error().stack`), plus a passive `scroll`
listener logging scrollY. Replay the failing click. If scrollY moves
with **zero logged JS scroll calls**, the mover is the browser itself —
then check `getComputedStyle(documentElement).overflowAnchor` and think
scroll anchoring. Scratch probes (gitignored):
`.matilda/scratch/debug-party-pin.mjs`, `debug-party-scroll.mjs`.

## Wiring a NEW row (the 1d76fd5 checklist)

1. `pinX()` + `pickY()` wrappers; call `pickY` from the main `<RdTabs
   onChange>`, every flip/switch button, AND the sticky **pinbar**
   copies of the same controls (`rd.ap-pinbar … pint`) — they are
   separate JSX with their own handlers.
2. **JSX TDZ trap**: in RdAllPolls, `const pinBar = (` JSX that
   referenced `facetPick` declared BELOW it threw
   `ReferenceError: Cannot access 'facetPick' before initialization` at
   RENDER — the view's error boundary showed "view render failed" and
   the probe's `waitForSelector` just timed out, looking like flaky
   infra. Declare all pin/pick consts BEFORE any JSX that mentions them.
   (Const references inside event HANDLERS like rowNav are lazy and
   safe.) First probe diagnostic: `page.on("pageerror")` +
   console-error listener — kept permanently in all three probes.
3. If the row has no height change above it under your data (Leadership
   metric deks are all an identical 2 lines / 45px at 480px AND 1440px —
   measurement spread 0.0px), the pinned walk is a smoke check of the
   pin only: probe vacuous guards must NOTE that, not FAIL. Verify a
   claimed zero spread with a scratch debug script before weakening a
   guard (.matilda/debug-ld.mjs pattern: click each tab, record per-tab
   dek height/line count/docTop).

## Probing the counts-basis qpop (all-polls)

The published/implied switch lives inside the "?" RdQPop, whose DOM home
DIFFERS by width: desktop `.rd-ap-tabs > .rd-pl-ctl`, phone
`.rd-ap-pctl`. Probe with the unscoped `.rd-qpop .rd-qbtn`. React mounts
the panel a tick after the click — a click+query in ONE `page.evaluate`
never sees `.rd-qpanel .rd-switch`: split into two evaluates with a
250ms sleep between, then Escape to close. Left a permanent
`pageerror`+console listener and a waitForSelector catch-and-dump in
probe-allpolls-pin.mjs for this class of failure.

## Undecided phone swipe (user-reported earlier)

"Arrow walking works on laptop but swipe on phones does not": the
undecided `<RdTabs>` lacked the **`swipe` prop**, so no
`data-rd-swipe`/`__rdSwipe` registration existed and the gesture fell
through to the page-turn navigator — the SAME failure class as the
hand-rolled Compare-with row (615ae67, see
auspol-rdtabs-arrow-walk). Fix: add `swipe` + the pin wiring above. When
a user reports "keys work, swipe doesn't" on any row, diff its props
against the nearest walking row first — the keyboard walk and the swipe
registration are two separate attach points.

## Probes (gitignored under .matilda)

`.matilda/probe-panels-pin.mjs` — who-votes, issues whom, undecided,
leadership (measurement pass + pinned walk, dek-on-screen smoke).
`.matilda/probe-cycles-pin.mjs`. `.matilda/probe-allpolls-pin.mjs` —
five-facet + flip measurement pass; pinned walk on twopp asserts
`.rd-ap-bar`-top AND first-data-row-top ≤LIM through flip mid/landing,
basis qpop, facet hop off/back and dek-on-screen (tab-row positions
NOTES ONLY since 2d23b7f — the 44px ride-off is intended); walk start
places the TAB ROW at reserve+16, never the bar (sticky-bar click
interception, above). Its **mid-pin scroll** block (the 4ad3144
regression pin): control hop twopp→primary measures the layout comp
(−249px phone, −182px desktop), hop back, then hop again with a user
scroll injected inside the pin window and assert the NET user scroll as
`yEnd − (yC0 + comp)` — phone gentle drag (touchMove in ~28ms steps)
must land 100–600 (Chromium touch momentum coasts past touchend, so
assert a BAND, never an exact delta), desktop `mouse.wheel({deltaY:
180})` ±30, plus no post-window motion (>60px backlog = fight). Trap
that cost a false failure: never compare `yEnd` against the PRE-HOP
scroll pos — with comp ≠ 0 even a perfect run sits comp below it, so a
"shoved upward" check must use the comp-adjusted baseline
`yC0 + comp − slack` (or just the net-delta form above, which folds the
old-bug's hugely-negative net into the same assertion).
`.matilda/dbg-pin-fight.mjs` — aligned-frame fight tracer (above).
`.matilda/dbg-pin-candidates.mjs` — dumps every array candidate's rect
vs reserve at the pinned position (found the 46-vs-43 one-px bar).
All ports 8987/8988/8989, 480×900 touch + 1440×900,
`LIM = 3`px landing, 2×LIM mid-glide. Vacuous-guard semantics:
measurement-spread `<8px` on the phone rung FAILS only where the dek is
supposed to move (who-votes, issues, all-polls) — NOTE elsewhere. The
who-votes probe's scary-looking "missed chip / 7373px" failures during
the anchoring bug were the REAL bug, not probe rot.

## Cross-session commit wrinkles

A sibling session's 17008fc ("dotted leads from election rings") swept
uncommitted pin wiring INTO ITS rebuilt index.html while leaving sources
uncommitted — 2cf6d8c's message had to note the built form rode along.
And after 1d76fd5's push, a sibling's RD_DEMO_HOME copy-edit re-dirtied
`.build/newtracker/assets/rd-panels.jsx` mid-rebase (leave it — it is
theirs to commit). In this shared repo: verify HEAD's content before
composing a message, stage explicit paths only, and re-check
`git status` AFTER `pull --rebase --autostash` before assuming the tree
is quiet. When the upstream you just rebased over touched a SHARED
GENERATOR your commit carries the generated artifacts OF (2d23b7f
rebased over 65e2b55's build.mjs PREDICTION_STAMP bump with our index.
html committed from the pre-merge builder), rebuild from the merged tree
and `git status` the generated files before declaring done: no diff =
artifacts match the merged sources (the stamp only feeds prediction/),
a diff = commit a rebuild follow-up.

## The pin-close TELEPORTER (freeze/thaw era, 2026-09-30)

Third user report — "the drift is still there, and it's everywhere you've
implemented fixed-view swipe — except in all polls, in which the
implementation seems perfect". Two shipped fixes hadn't cured the device.
Two realisations:

**all-polls was perfect because nothing above its pinned row ever
REFLOWS** — so its pin was never even exercised, not because its pin
code differed. Other views' walks rewrite head/dek story words → RdGlide
height animations above the pinned row → corrections. First layer of the
fix: **freeze the glides for the pin's window** — `rdPinClip(rowTop)` at
pin start sets every `.rd-glide-in` block entirely above the row to
`transition:none; height:<current>; overflowY:clip; __rdFrozen` (RdGlide's
layout effect and its RO settle both early-return on the flag), and the
pin end **ATOMIC-thaws them all in one frame** (`rdPinThaw` clears the
inline styles; NO animated release — an animated 320ms thaw moved reader
content with no corrector to answer it, strictly worse: probe showed a
54-correction 0.5px staircase). `done()` then thaws + corrects in the
same rAF task: at most ONE correction per pin, well after touch end.

**The real teleporter hid in `done()` itself.** probe-panels-pin failed
on the UNDECIDED case with "row not in view" BEFORE any click and a
−7475px "drift" — exposing that a setup scrollTo (the user's departure)
had been exactly reverted. The scroll-call tracer (wrapper on
scrollTo/scrollBy with `new Error().stack`, probe-cycles' `__sbLog`)
logged it: `scrollBy(0,−8272)` from `fix()` inside `done()` — the pin's
end-of-window correction scrolled the page BACK to the stale anchor
`want` — 8272px == exactly the user's own scroll. Every unguarded
`done()` call site did this, INCLUDING `step()`'s >1-screen jump-bail
(hand back ⇒ call `done()` ⇒ `done()` teleports — the guard was a
no-op!). On an iPhone: swipe (pin live), flick-scroll away (momentum
still rolling at pin close ~560ms later), page yanks back to the row —
the residual "drift/bounce/stutter".

**Fix shape**: at pin close the ONLY legitimate correction is the
frozen blocks' own release — measure the row's viewport top ACROSS
`rdPinThaw()` and `scrollBy` exactly that delta:

```js
const was = row.isConnected ? row.getBoundingClientRect().top : 0;
rdPinThaw();
if (!row.isConnected) return;
const shift = row.getBoundingClientRect().top - was;
if (shift) { window.scrollBy(0, shift); lastY = window.scrollY; }
```

`fix()` vs `want` stays for MID-pin use (step()/RO) where folding user
scroll into `want` is correct; pin CLOSE must never consult the anchor
again. Regression case: probe-cycles-pin's **leave-mid-pin** block —
click (pin live), `scrollBy(innerHeight*2)`, wait out the tail, assert
post-pin movement ≤150px (pre-fix ≈ −1 screen, post-fix 0.0px).

Diagnostic pattern when a probe's own `scrollTo` gets reverted:
suspect an outstanding lifecycle callback (pin/observer/timer) — wrap
`window.scrollTo/scrollBy/scroll` right after page.goto BEFORE any page
JS interacts, log `[t, args, scrollY, Error().stack.split("\n").slice(1,4)]`
at every call; the guilty frame names itself (`at fix … at done`). A
repeated IDENTICAL drift (e.g. −7475.0 ×3) with a bogus pre-scroll t0
means the setup scroll never landed, not that the row moves.

Shared-repo wrinkle this session: the freeze/thaw went out in a SIBLING's
commit (7410314 swept it) while the done() fix sat uncommitted — a
sibling `git restore` on rd.jsx + their own rebuild then DESTROYED my
edit (working file clean vs HEAD, marker phrase gone from index.html).
Defence: `git diff -- <file> > .matilda/<fix>.patch` the moment a probe-
green edit is uncommitted; re-apply after sibling waves.

## The glide-only freeze missed the real movers (3b0dc00)

Third iOS report after the teleporter fix: "swiping between: months views
on primary vote chart (but not 2pp chart), and approval, favourability
and both in net apprv/fav, causes drift." Net anchor position stayed ≤1px
in headless probes — **net position is not evidence** on this class of
bug; the mid-gesture CORRECTION STREAM is. Hunting with wrapped
`scrollBy` (log every pin scroll with a timestamp) showed per 3-swipe
walk streams like `[-267.9, 0.09×32, 70.8, -0.15×32, 164.2, 0.22×33]` —
each big entry one frame after a React commit, each tail the rAF loop
decaying against it.

**The movers were never glide blocks** (probe-card30.mjs table, 390px,
card child heights per range — click EVERY range button in turn, never by
index: clicking the already-pressed button is a silent no-op that wasted
a run):

- hero card child `.chart` wrapper: 300 at 3mo, 330 otherwise (svg height
  CONSTANT 300 — the wrapper grows a 30px event lane per range);
- `.rd-evlist` (unglided, plain component): unmounted at 3mo, 32.8 /
  197.1 / 229.9px at 6mo/12mo/All;
- PV card mirrors both (svg 320, wrapper 350/320);
- **shared range state**: stepping range on the PV card re-renders the
  HERO card — the movers sit ~2000px above the pinned PV menu row;
- Leadership: the panel renders `<RdSub head dek />` UNGLIDED ON PURPOSE
  (desktop subgrid — a panel's own head/dek are rows of its grid, comment
  in rd-panels.jsx) → metric flip snaps the dek 45↔68px in one frame,
  plus a ±0.5px/frame × ~50 train behind it (same lane fighting the rAF
  loop; died entirely with the freeze — zero corrections, and thaw shift
  0 because a net→both→fav tour ends 68=68).

**Failed attempt worth remembering**: observing the row's ANCESTOR CHAIN
with the pin's ResizeObserver cannot win — rAF callbacks run BEFORE RO
callbacks in the same rendering iteration, so step()'s rAF always
consumes the big drift first and the RO only ever sees the ≤0.2px
residue (probe attribution proved it: big entries stack-labelled "step",
sub-pixel ones "RO"). The chain-watch stays as a backstop for whatever
a future freeze misses, but repair is not the strategy — prevention is.

**The fix** (rd.jsx, one commit): `rdPinClip(row, rowTop)` — after the
existing `.rd-glide-in` parent loop, walk `node = row; node.parentElement`
up to (not incl.) `document.body`, and freeze every EARLIER SIBLING of
each chain link whose rect is fully above `rowTop` (same `__rdFrozen`
flag, same `rdPinHeld` list, same atomic thaw). Skips: zero-height boxes,
and anything matching or CONTAINING
`.tabs.sticky, .info-index, .rd-ap-headwrap, .poll-table thead th`
(overflow:clip on an ancestor breaks sticky for the pin window). Never
freeze the ancestors themselves — only pre-siblings (a frozen ancestor
chain would clip the row's own card). Right after `rdPinClip(...)` in
rdPinScroll comes one same-task `fix()` call: a freshly clipped box stops
its children's margins collapsing through it, which can shift the row a
few px at clip time — settle it before any frame can paint. rdPinScroll's
call changed from `rdPinClip(want0.top)` to `rdPinClip(row, want0.top)`.

**Acceptance probe** (`.matilda/probe-swipe390.mjs`, 390×844): five
surfaces (pv-menu, pv-chart surface, ld-rating, ld chart below it,
tpp-menu as the always-clean control), 3 swipes each, wrapped `scrollBy`
attributes each call via `Error().stack` — `thaw:` (done()), `step:`
(rAF), `RO:` (observer). Acceptance = ZERO `step:`-attributed corrections
AND net anchor ≤4px. Post-fix streams: pv-menu `[thaw:-32.8]`, pv-chart
`[thaw:-164.2]`, everything else silent — the single thaw release is the
pin's DESIGNED end (fires ~560ms after the last touch, outside the
gesture, painted on time; magnitude = net card-height delta of the
range tour, hero card is 781.1/748.2/584/513.2 at All/12mo/6mo/3mo). A
`thaw:` entry is not a failure; any `step:` entry >0.5px is.

Sibling flow that beat "wait for their commit" (sibling had an
uncommitted rd-panels.jsx + rd.css feature in the tree): `git stash push
-m "wip: …" -- .build/newtracker/assets/rd-panels.jsx
.build/newtracker/assets/rd.css` → rebuild (index.html then compiles ONLY
my rd.jsx change; `git status` must show exactly rd.jsx + index.html) →
stage the two explicit paths → commit → push → `git stash pop` to drop
their files back where they were. Faster than waiting, cleaner than
landing half-finished foreign work, and the generated artifact never
ships code whose sources are uncommitted.

Regression set before push: probe-swipe390 + probe-panels-pin +
probe-cycles-pin + probe-allpolls-pin + probe-swipe (480px; its known
pre-existing tpp-card 19.5px morph-measurement miss stays a note, not
this fix's business) + npm test + validate.mjs.

## On-screen boxes: freeze ↔ slice tension resolved by sideways-slide heat

The chain freeze's first pass had NO visibility guard, so a click-raised
cycles pin froze the story dek while it was on screen — the user read it
as "the dek text gets cut off mid-paragraph, blocked out" (a frozen box
shows its new words inside its old height). The fix shipped in THREE
steps, each pinned by a user report:

1. **Touch-heat gate (a000f12)** — `rdTouchHot` armed on ANY touch
   (touchstart +500ms); chain-walk boxes with `r.bottom > 0` froze only
   mid-touch. Residue: "it still cuts off mid para… rarely" — every
   iPhone TAP fell inside the touchstart window.
2. **Slide gate** — heat arms ONLY when a touch has actually SLID
   sideways into the app page-swipe effect's own gates (`|dx| ≥ 60` —
   `RD_TOUCH_SLIDE_DX` mirrors `MIN_DX` in the 73de0c58 swipe source —
   with `|dy| ≤ |dx|·0.5`), measured on touchmove AND on touchend (the
   swipe commits its step inside the touchend dispatch). touchstart now
   just records the start point. Taps never freeze visible text; real
   swipes keep full protection (probe-swipe390 ld-rating silent).
3. **The glide sweep takes the same gate** — the residual slicer after
   (2) was rdPinClip's `.rd-glide-in` sweep, which froze glide PARENTS
   UNCONDITIONALLY. The cycles dek (`#cyc-summary .rd-dek`) sits inside
   a `.rd-glide-in`, so its parent froze at pre-switch height on EVERY
   pin, taps included, and sliced it. Diagnosis: probe walks the dek's
   ancestor chain asserting no `__rdFrozen` (computed `overflow-y` on
   the dek itself stays "visible" — the freeze clips the PARENT, not
   the dek). Now both freeze paths (glide sweep + ancestor-chain walk)
   apply one screen test: **freeze unless on screen and no hot touch**,
   where ON SCREEN means readable past the stuck tabs bar —
   `r.bottom > min(bar.bottom, bar.height) + 6`, NOT `r.bottom > 0`
   (a box squeezed wholly into the bar's strip can't be read or
   sliced; freezing it keeps the pinned click-walk cheap, which the
   old rule lost — 100+ corrections per walk).

Probe contract: probe-cycles-pin's phone-only "dek tap-on-screen" case
touchTaps a Compare pill with the dek on screen and fails if ANY dek
ancestor gains `__rdFrozen`/clip; surfaces left to reflow live are
judged by `sbSmooth` (max one >16px step per activation — the thaw —
any count of small tracking stairs allowed), while REAL touch swipes
keep the strict `sbCheck` correction budgets.

## Coarse-pointer gate: no fixed view on computers

User ask: "can you remove the fixed-view behaviour on computer?" The pin
exists for touch gestures whose momentum can stretch across the 320ms
glide on iOS Safari. A mouse click, trackpad click, or keypress on a
computer does not need that contract, so `rdPinScroll(row, fine)` starts
with:

```js
if (!fine && window.matchMedia && !window.matchMedia("(pointer: coarse)").matches) return;
```

Fine pointers therefore get no freeze, no RO/rAF pin, and no close-time
thaw correction — the head/dek above a row reflows naturally. Coarse
pointers (phones/tablets) keep every existing contract.

**The `fine` opt-in (2026-09-30, same day — user: "implement it on
laptop just in the all polls table")**: the second parameter lets a
caller opt its row IN on fine pointers. Only pinAp (rd-allpolls.jsx)
passes it — the All-polls filter bar and rows hold through the facet
walk, the matchup flip, the counts-basis switch and row-nav hops on a
laptop exactly as on a phone; cycles, panels, leadership, who-votes and
undecided stay touch-only. The same-day verification pass turned up
three sibling-collision repairs to probes, useful patterns to remember:
(a) panel probes broke on yesterday's 1e2838f grouping-menu swap —
pinWhom's list now leads `.rd-iw-tabs` (the one grouping control at
every width), then `.rd-iw-chips`, then desktop `.rd-iw-ctl`;
(b) 3cc1b40 dropped the phone "Issue" kicker, so the Issue chips row is
just `.rd-iw-tabs`' nextElementSibling and probes find it by class, not
by kicker text;
(c) a SECOND `[aria-label="Time range"]` group landed on the Primary
card, so bare `"Time range"` selectors now match 8 buttons — scope to
`#two-party` / `#primary-vote`.

Probe rule across `probe-cycles-pin.mjs`, `probe-panels-pin.mjs`, and
`probe-allpolls-pin.mjs`: each rung evaluates `matchMedia("(pointer:
coarse)").matches` as a device-sanity check against its `hasTouch`
viewport (headless Chrome's touch rung does report coarse). Cycles and
panels gate row-hold assertions on it (pin off under fine pointers);
`probe-allpolls-pin` sets `pinOn = true` and asserts the hold on every
rung, since pinAp opts in everywhere. Geometry assertions (control in
view, dek scrolled off) run everywhere; anchor/step/step-state
assertions run because changing the control is not the pin's job. The
all-polls mid-pin user-scroll case runs on BOTH rungs — the phone sends
a gentle drag, the desktop a 180px `mouse.wheel`, and the net must be the
requested 180px on top of the layout comp (never reverting upward).
Desktop all-polls keeps one probe-helper wrinkle from the unpinned era:
the click helper still parks a target just below the sticky site tab
bar's reserve before `mouse.click` (a control parked under
`.tabs.sticky` gets its click intercepted by the site tab and the probe
navigates to `#cycles`).

## The laptop facet-walk drift fixes (2026-09-30, the day after the fine opt-in)

User report straight after the `fine` opt-in shipped: "pressing right
arrow scrolled down on all polls table; each time the view comes around
to 2PP and primary, the viewport drifts down." Two independent
mechanisms, proven separately with headless timelines:

1. **`focus()` teleports the page: any focus on a pinned-bar control
   MUST pass `{ preventScroll: true }`.** The All-polls pinbar
   (`.rd-ap-pinbar`) is `position: fixed`, so its facet buttons' LAYOUT
   boxes sit far up the page where the unpinned bar rendered. Chrome
   focuses a `<button>` on click (Safari/Firefox-mac don't), and a plain
   `el.focus()` re-scrolls the page to the button's layout box —
   observed 4200 → 2399 = a 1801px teleport. `rdTabFocus` (the click
   focus for Safari/Firefox) and `rdTabsKey`'s arrow step (both in
   rd.jsx) now call `focus({ preventScroll: true })`: the pin owns the
   scroll position, so a tab-walk control focus must never move the
   viewport. Diagnosis harness: `.matilda/dbg-ap-click-jump2.mjs` wraps
   `HTMLElement.prototype.focus` (call AFTER load — the page's own
   wrappers stack) and records `opts` + `Error().stack`; the trace that
   convicted it was `focus opts=null at rdTabFocus`. REBUILD GOTCHA
   that cost a lap: the fix in rd.jsx source does NOT reach the running
   page until `node .build/newtracker/build.mjs` re-runs — index.html
   kept executing the stale `b.focus()` copy at the old line and the
   probe kept failing post-edit. **After any rd.jsx edit, grep the BUILT
   index.html for the fix (the source map isn't there — grep for the
   literal `preventScroll: true`), don't assume the rebuild happened.**
2. **The anchor preference list must include the reader's own ground,
   or the pin no-ops AT READING DEPTH** (the 08329ba lesson, repeated
   for a table this time). pinAp's list was `[bar, tabs, first DOM data
   row]`; 620px into the table all three are above the fold, so at a
   user's real facet-walk depth the pin bailed (RO count stayed 0, no
   compensation) and each facet's head/dek swap (twopp keeps a 99.3px
   hed, every other facet drops it — ±182px page-height deltas at
   1440px) walked the viewport under a held scroll offset. pinAp now
   appends `[...onScreenRows].slice(0, 3)` — the first up-to-three
   `.rd-ap-mrow/.rd-ap-row/.rd-ap-card` whose rect spans the viewport —
   so the row the reader is staring at takes the pin.
   **Repro-depth gotcha that wasted two probes**: at 1440×900 the whole
   All-polls TABLE occupies ~620–2930 document px (measured on a
   39-row twopp facet), so `scrollTo(0, 4200)` lands PAST the table in
   the poll-disagreement/house-lean sections with NO rows on screen —
   there the pin has no anchor BY DESIGN and drift measurements prove
   nothing. `.matilda/dbg-ap-arrow-drift3.mjs` prints each section's
   rect first — confirm rows are actually on screen (`nrows` visible,
   `tbl` spans the viewport) before reading drift into a result.

