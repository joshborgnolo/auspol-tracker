---
name: auspol-rd-tpp-hero
description: auspol-tracker — the redesign front-page two-party hero (rd-hero.jsx, section.rd-tpp) — the chart a visitor actually sees: it draws Labor's share vs BOTH rivals at once (main + "other" line with "v Coalition"/"v One Nation" END labels), the "Compare published 2PP" overlay ("As published"/"Implied" end label), and the ON-flow sensitivity bracket whose `edge:true` renders its TOP edge as a PHANTOM second dotted line (renderer strokes area top-edges dashed; fill invisible at .rd-sens opacity .1) — restyled 1px/"1.8 3"/0.35 on 2026-09-28 via new parametric area options edgeWidth/edgeDash/edgeOpacity. Event markers are the UNION of keptEvents since the same day (user wanted identical markers on every matchup pill). Renderer dash encodings trap: dashed SERIES encode stroke-dasharray "6 6", area EDGES default "4 4"/custom — probe assertions must match the right pattern. Pinned by .matilda/rd-tpp-hero-probe.mjs (14 checks). Double-press figure flip: numPress (pointerdown pairing 500ms/30px, gated on .rd-tpp-num only, second-press preventDefault kills digit selection) steps the matchup one slot via chooseMatchup — shipped ada1ca1 (compiled layer rode along in sibling 0f1e189); probe .matilda/probe/tpp-num-dbltap.mjs
source: auto-skill
extracted_at: '2026-09-28T06:34:26.389Z'
---

# Redesign two-party hero (rd-hero.jsx)

The front-page 2PP section (`section.rd-tpp`, `#two-party`) renders from
`.build/newtracker/assets/rd-hero.jsx`, compiled into the page bundle by
build.mjs's module list. It shares the `D.*` payloads (agg2pp, synth2pp,
synthOn, alt2pp, flowSens, events) with the older 73de0c58 hero — when a
user reports something about the 2PP chart, THIS file is where to look
first (see also auto-skill-auspol-tpp-basis-toggle for the basis state
machinery and the older hero layer).

## What draws where (the "two dotted lines" map, worked 2026-09-28)

User report: ticking "Compare published 2PP" on Labor v Coalition showed
TWO dotted lines but only three end labels ("v One Nation", "v Coalition",
"As published"). The chart composes:

- **Two solid lines at once**: `main` = Labor's share in the chosen
  contest (in the RIVAL's colour: `mainCol = M[id].b.color`), and `other`
  = Labor's share in the other Labor contest (`otherOf(id)` over the
  `vsLabor` matchup list). That's why a "Labor v Coalition" chart always
  also has a "v One Nation" line with its own endLabel.
- **One dashed overlay** (`series id "cmp"`, `dashed: true` → dash "6 6"):
  the basis the chart is NOT on — published agg2pp on the implied basis
  (endLabel "As published"), implied synth on the published basis (endLabel
  "Implied"). Colour `mainCol` again, so it reads as "as published
  <rival>".
- **The phantom second line**: the ON-flow sensitivity area (`id "sens"`,
  colour var(--lnp), className rd-sens) is pushed with `edge: true`.
  TrendChart (08b413e7) renders an edging area as fill path
  (`className` lands on the FILL — `.rd-sens { opacity: .1 }` makes the
  band nearly invisible) PLUS a stroked TOP-EDGE-only outline. The edge is
  what the user sees: same blue family as the cmp line, dashed. The chart
  key below ("Range if One Nation preferences flowed as in 2022", kind
  band) names it, but as a shade swatch — nothing at the line's end.
  `sensOn = cmpOn && matchup === "alp_lnp" && D.flowSens.length > 1` is
  NOT basis-gated: it shows whenever compare is on for LvC, on both bases
  (it brackets the IMPLIED series wherever that series is drawn — main
  line on implied basis, overlay on published).
  - 2026-09-28: renderer gained parametric options `edgeWidth` (1.6),
    `edgeDash` ("4 4"), `edgeOpacity` (0.85) and the sens area passes
    `1 / "1.8 3" / 0.35` — a fine dotted bound, not a trend line. The
    renderer's only `edge: true` consumer is this sens area (every other
    area in the codebase passes `edge: false`); the component doc block at
    08b413e7 ~:160 documents its spec — keep it in sync.

## Double-press figure flip (numPress, shipped ada1ca1 / 2026-10-02)

Two quick presses on the headline `.rd-tpp-num` RollNum figures step the
contest one slot along `orderedMatchups` (wrapping
`(i + 1 + len) % len`, the same dir:+1 advance as `swipeLive.current`),
through `chooseMatchup` — the 320ms morph/domain seeding handles an
interrupt mid-morph. Contract (rd-hero.jsx ~:420 after `swipeMark`):

- **Pairing reads `pointerdown`, never click/dblclick** — a mouse
  double-click and a phone double-tap are then the same gesture, and
  dblclick doesn't fire reliably on touch. Window: 500ms and 30px on
  both axes (`numTap` ref `{t, x, y}`).
- **Only the NUMBERS carry the claim**: the handler gates on
  `e.target.closest(".rd-tpp-num")`; it's wired `onPointerDown` on the
  `.rd-tpp-read` strip (which already carries `ref={swipeMark}
  data-rd-swipe-self=""`), so the names and the rule stay inert.
- **`e.preventDefault()` on the paired second press** kills the
  browser's double-click digit text-selection.
- Probe: `.matilda/probe/tpp-num-dbltap.mjs` (ROOT `../..`, PORT 9041;
  touch rungs use `page.touchscreen.tap`, desktop `page.mouse.click`,
  70ms between presses) — per rung 1440/820/390-touch: single press
  inert, double flips (names read via `.rd-tpp-side.rd-a/.rd-b
  .rd-tpp-name`), `window.getSelection().toString()` empty, second
  double flips back, double on the NAMES inert.
- Landing note: the compiled layer shipped first inside sibling commit
  `0f1e189` (their build read the shared worktree); ada1ca1 is the
  source-only follow-up — see auto-skill-shared-repo-session-race
  "Sibling's commit SHIPS your compiled change" (2026-10-02).

## Double-press open-water flip (onDoubleEmpty, 2026-10-02)

The same two-press claim the figure flip has on `.rd-tpp-num`, applied to
the chart itself: two quick presses on OPEN chart water (no poll and no
event in either press's catchment) step the matchup one slot, wired in
rd-hero.jsx as `onDoubleEmpty={() => swipeLive.current(1)}` between
`pollFacet="twopp"` and `tooltipTitle` — the exact +1 advance the swipe
runs through chooseMatchup, so drag, figure double-press and chart
double-press are the same gesture to the state machine. Engine side is an
OPT-IN TrendChart prop (08b413e7):

- `dblEmpty(e, pickPx)` (~:706): pairs presses within 500ms/30px measured
  on client coords. A press whose catchment holds a poll or event
  (`nearestDot`/`nearestEvent`) does its own job AND resets the clock
  (`dblTap.current.t = 0`) — it is never the first half of a pair.
  Touch measures openness with TOUCH_PICK_PX=22, mouse MOUSE_PICK_PX=11.
- Touch path runs `dblEmpty(e, TOUCH_PICK_PX)` inside `onPointerUp`
  BEFORE `pickTouch(e, true)`; mouse path runs `dblEmpty(e,
  MOUSE_PICK_PX)` inside `handleClick` ONLY when the dot isn't openable
  (hovered dot + dotSrc "mouse" + rowKey) — a hovered double-click keeps
  its archive-open, it never flips.
- **The echo-press trap (the one that bites):** Chrome dispatches a
  synthesized CLICK after every touch tap, immediately after pointerup.
  Without the `touchTapAt` guard both handlers count the same tap —
  every SINGLE tap on open water flips the contest (probe caught this).
  `onPointerUp` stamps `touchTapAt.current = performance.now()` where it
  processes a touch tap, and `handleClick` returns when
  `now - touchTapAt.current < 400`. Only a touch tap stamps the clock
  (the pointerup touch branch returns early for the mouse), so desktop
  double-click pairing is untouched; the real second tap's echo is
  swallowed too — harmless, its pointerup already paired.
- `.chart-svg` is unselectable (`user-select: none` +
  `-webkit-user-select`, template.html ~:1462 beside `touch-action:
  pan-y`) so a desktop double-click can't word-grab the chart's text
  labels.
- Probe `.matilda/probe/tpp-chart-dbltap.mjs` (PORT 9042). Three traps to
  know before editing it: the naive phone-rung selector
  `section.rd-tpp .rd-tpp-chart svg` matches RdKey's 24×14 legend line
  sample — select `.rd-tpp-chart .chart svg.chart-svg` AND wait
  `width > 200` because the narrow-rung chart mounts late after the
  useNarrow re-render; pickable dots are ONLY `circle.scatter-dot` /
  `g.rd-dot-hot circle` (rings, end-caps, hover-markers, badge circles
  live in the keep-out set); a desktop hovered-dot double-click opens
  the archive, which switches to the all-polls tab and UNMOUNTS the
  hero — read `.rd-tpp-name` before the click and assert `.poll-detail`
  / `#allpolls` hash after. Per rung (1440/820/390-touch): lone press
  inert, double flips, no text selected, second double flips back; touch
  adds a dot tap opens its `.tip.tip-dot` readout without flipping;
  desktop adds the openable-dot double-click opening the archive.

## Compare checkbox (RdCheck)

- `cmpBox` label: since 2026-09-28 ONE matchup-independent string —
  `"Compare published 2PP" : "Compare implied 2PP"` (user asked to drop
  the alp_on-only "Compare published head-to-heads" wording). Renders
  inside `RdTabs` on desktop and below the chart on narrow (`label.rd-check`).
- `cmpData`/series/`iScatOf` pick per matchup+basis (`onImp`, `chooseBasis`,
  `qPanel` RdQPop with the basis RdSwitch). `cmpOn` also requires `!morph`.
- `flowSens` only exists for the classic pairing (2022-table re-read of the
  same primaries); ALP–ON has its own `latest.onImp.band`, no second
  bracket.

## X axis (election tick, 2026-09-30)

- xTicks now run through `rdElectionTicks(xDomain, narrow, elec.x)` (from
  rd-panels.jsx, window-exported) — the same "opens on a strong Election
  tick" axis the Primary chart has; out-of-range ranges (3/6/12 mo) fall
  back to plain `rdXTicks` automatically. `elec` = the agg2pp election
  point; passed unconditionally (tick marks the DATE, not the matchup's
  ring, so it also shows on alp_on).
- Verified with `.matilda/probe/hero-election-tick.mjs` (tick on All only,
  desktop + phone; exact-text match "Election"/"E" — the ring's
  "2025 election: nn.n" label is a DIFFERENT node, don't collide them).

## Event markers

- Source: `data/polls.json` `events[]` rows `{date, short, label, desc,
  major}` → gen-data §9 maps to `D.events` with `x: dx(date)` (add `major:
  true/false` there, never per-panel).
- Hero filter (`evsOf`): majors plus `keptEvents = ["2026-02-12",
  "2025-12-08"]` (Taylor leads Libs, Joyce → ONP) — a UNION on every
  matchup since 2026-09-28. Before that it was a per-contest map
  `{alp_lnp: "2026-02-12", alp_on: "2025-12-08"}[sc.id]` and switching
  pills visibly swapped one marker; the user wanted them identical.
- TrendChart lays labels out with `e.short` and dodges them; mid-switch
  `eventsFrom`/`eventMix` slides one set into the other. On narrow,
  `rdEventBadges`/`RdEventList` (rd.jsx) compact them into badges listed
  under the chart. The vertical rule is class `.evt-line` (rd.css
  stroke-dasharray 1 3, ink-faint) — distinct from series/edge dashes.

## Renderer dash encodings (08b413e7 — THE probe trap)

- Dashed SERIES: `strokeDasharray={s.dash || (s.dashed ? "6 6" : "none")}`
  (~:1286) — so solid trend paths also carry the literal "none" attribute.
- Area EDGES: "4 4" by default, or the area's edgeDash (~:1089-1092).
- Event rules: class `.evt-line`, dashed by CSS ("1 3" in rd.css).
A 2026-09-28 probe "failure" was the probe expecting "4 4" for the compare
series when it's "6 6" — verify the encoding in the renderer before
asserting on rendered zeros.

## Lead gauge (RdLeadGauge) — the first-frame width contract

`RdLeadGauge` (~rd-hero.jsx:20) sizes to its parent via a measured-width
state (`w`, min 760) fitted by a ResizeObserver in a layout effect; every
element's x geometry is computed from `w` (`cx = w/2`, `unit` clamp,
`X(v)`; phones land on w = parent ≈ 350 inside the page padding). The
spans/caps/dots carry a `.32s var(--morph-ease)` `left`/`width` transition
(rd.css ~:534), so ANY step change in `w` interpolates positions — which
is why the width state must be measured before the FIRST paint (fix
460a75c, 2026-09-30, the Snapshot-tab bounce/right-overflow report):

- PRE-FIX: `useState(760)` mounted with desktop geometry; on a tab
  remount one 760 frame painted before the fit's setW landed and the
  transitions then slid children 760→350 era. Mid-interpolation the dot's
  right edge reached 408px on a 390px phone (absolute children extend
  `documentElement.scrollWidth` even with the parent already correct) —
  the reader felt a bounce / saw right-edge overflow.
- POST-FIX contract: `useState(0)` is the unmeasured sentinel; the div
  renders `width: w || "auto"` + `visibility: w ? "visible" : "hidden"`
  until the observer measures, so its first painted geometry is already
  final. The mercury settle (`settled` after SETTLE_MS, collapsed at `cx`
  then spreading) is independent of this and must keep working.
- Regression probe: `.matilda/probe/snapshot-tab-overflow.mjs` (per-rAF
  scrollWidth/innerWidth sampler around a Snapshot tab click; asserts
  zero frames wider than the captured viewport at phone and laptop
  rungs). Full method in `auto-skill-auspol-mobile-overflow-probe` —
  transient-overflow section. Note `.rd-lg` itself has NO CSS transition
  and no overflow clipping; the `.rd-lg-dot` shares the reduced-motion
  override list with the chart's `.rd-tpp-dot`.

## Probe & verification

`.matilda/rd-tpp-hero-probe.mjs` (14 checks, harness copied from
.matilda/basis-flip-probe.mjs: ephemeral http server + puppeteer-core,
CHROME env var): on BOTH Labor-contest matchup views — checkbox text reads
exactly "Compare published 2PP", compare toggles on, both event shorts
present in the hero svg text, sens edge present only on LvC
(`dash "1.8 3" AND width 1 AND opacity 0.35` — match ALL THREE, dash alone
collides with nothing but width/opacity pin the hand), exactly one "6 6"
dashed series path. Drive matchups by clicking `section.rd-tpp
button.rd-chip` by visible text ("Labor v Coalition" / "Labor v One
Nation"); read the current matchup from `.rd-tpp-side.rd-b .rd-tpp-name`;
wait ~900ms per pill click (matchup morph ~320ms).
