---
name: auspol-hero-matchup-morph
description: auspol-tracker — the hero "Switch 2PP" matchup MORPH machinery end-to-end (73de0c58 asset, chooseMatchup ~:843 / blend IIFE ~:970 / domainOf ~:1200 / yDomain+yTicks ~:1230; 320ms rAF morph, MORPH_EASE, reduced-motion matchMedia guard; y-axis labels slide because yTicks come from the TARGET window while yDomain lerps); SINCE 5b2c51e (2026-09-21) the ONE morph state {from,to,fromBasis,toBasis,fromDomain,t} ALSO drives the .hb-toggle basis flip (implied↔published lines reshape point-for-point, dots travel, window glides — basisMorph/basisRaf label-glide-only machinery deleted); THE load-bearing invariant — `matchup` AND `basis` state have ALREADY FLIPPED when every morph-frame render runs, so anything keyed to current matchup/basis (impBasis, impOnBasis) reads the DESTINATION inside `ptsOf(morph.from, morph.fromBasis)`: impData/impOnData became basis-named accessors impDataFor(b)/impOnDataFor(b) and iDataOf/iScatOf/ptsOf/cloudFor/domainOf take an explicit basis arg — every from-scene read names its own; `impOnData` must stay gated like `impData` (basis-only, NOT impOnBasis) or the morph back from ALP v ON snaps silently (fixed 7864c69, 2026-09-18); heroEvents per-matchup change-of-hands markers (12100d1: own-event date map alp_lnp 2026-02-12 Taylor / alp_on 2025-12-08 Joyce, pulled BY DATE from D.events, gated on shown = morph ? morph.from : matchup so the departing marker rides the blend out). Diagnosing morph asymmetries with .matilda/morph-ylabel-probe.mjs and .matilda/basis-line-morph-probe.mjs (headless axis-label + path-`d` samplers; a change in the USER's described direction may not match your measured direction — measure both, the asymmetry is the bug; VERIFY the probe's path selector measures something real — hero trend lines are path.series-line with cubic C commands, so L-only regex filters silently sample "" and vacuously pass equality checks)
source: auto-skill
extracted_at: '2026-09-21T07:17:57.967Z'
---

# Hero matchup morph (Switch 2PP) — mechanics + the flipped-state invariant

Symptom that prompted this skill (2026-09-18, fixed 7864c69): the y-axis
numeric labels animated on ONE direction of the Switch-2PP morph and
snapped instantly on the other. Root cause was NOT in the animation loop —
it was a basis-data gate that flipped together with `matchup`.

## Machinery map (all in `.build/newtracker/assets/73de0c58-….js`)

- ONE `morph` state drives BOTH switchers (since 5b2c51e, 2026-09-21):
  `{ from, to, fromBasis, toBasis, fromDomain, t }`. A matchup switch lerps
  two matchups' series at the current basis (fromBasis/toBasis undefined →
  accessors default to current basis — a semantic no-op); a basis flip lerps
  the SAME matchup id across bases (from: matchup, to: matchup, fromBasis →
  toBasis, fromDomain seeded from the on-screen yDomain so a flip
  interrupting a running morph continues from the interpolated window).
  The window-only `basisMorph` state / `basisRaf` / label-glide-only
  machinery is DELETED — grep them to zero after touching this area.
- `chooseMatchup(id)` (~:843) — the `.ha-chip` pill handler. ORDER OF
  OPERATIONS IS THE WHOLE STORY: `setMatchup(id)` runs FIRST, then
  `setMorph({ from, to: id, t: 0 })` and a rAF `step()` over
  `MORPH_MS` (320ms, `MORPH_EASE(raw)` per frame);
  completion `setMorph(null)` lands the real series. Guards: same id,
  `prefers-reduced-motion: reduce` via matchMedia, `!MATCHUPS[…]` →
  `setMorph(null)` and no animation.
- `chooseBasis()` (~:871) — the `.hb-toggle` handler, same shape:
  `setBasis(bTo)` first, cancel `morphRaf`, reduced-motion guard →
  `setMorph(null)`, else rAF loop writing the full basis-morph object.
  References `yDomain` textually before its const declaration — fine (JSX
  handlers run after module eval; the old code did the same).
- `impDataFor(b)` / `impOnDataFor(b)` (~:934/:949) — the implied lines
  parameterised by basis: `(impOffered && (b === undefined ? basis : b)
  === "imp") ? D.synth2pp.map(…) / D.synthOn.map(…) : null`. Bare
  `impData`/`impOnData` consts = the current-basis view for unchanged
  consumers. Never re-gate on `matchup ===…` (the 7864c69 invariant below).
- `iDataOf(id, b)` / `iScatOf(id, b)` / `ptsOf(id, b)` / `cloudFor(id, b)` /
  `domainOf(id, b)` — every scene accessor takes an optional explicit basis.
- `blend` IIFE (~:970) — `if (!morph) return null`; builds
  `ptsOf(morph.from, morph.fromBasis)` / `ptsOf(morph.to, morph.toBasis)`
  on a SHARED month grid (`hold` clamps each series to its endpoints
  across months the other ran for, so the two paths interpolate
  point-for-point and the clip window `blend.clip` travels), lerps
  `a`/`b` (`ci95` → null unless BOTH sides have it, so the band never
  vanishes mid-morph) and `mixC`s the party colours. On a basis flip the
  matchup id is the same both sides, so colours lerp to themselves —
  correct: party identity unchanged, only the line shape travels.
- `morphClouds` useMemo (~:1065) — splits dots travel/leaving/arriving by
  key `pollster|released|side`, via `cloudFor(morph.from, morph.fromBasis)`
  / `cloudFor(morph.to, morph.toBasis)`; deps array includes the two basis
  fields plus basis itself. On a basis flip a poll with BOTH readings
  travels between them (implied vs its own published figure);
  polls missing on one basis fade out/in.
- `domainOf(id, b)` (~:1200) — auto-fits the y-window over BOTH series +
  ci95 band + the poll cloud (`iScatOf(id, b)`) + implied overlays
  (`synth2pp`/`agg2pp`/`flowSens` for the real matchup), pads by a dot
  radius, ROUNDS TO 5s. L/NP ≈ [40,60], ALP v ON ≈ [30,70] on the implied
  basis; the resp basis narrows ON to ≈ [40,60] too.
- yDomain/yTicks (~:1230) — THE SLIDING-LABELS TRICK: `yTicks` are
  enumerated from `yTarget = domainOf(matchup)` (the DESTINATION window)
  so their count/values hold still; `yDomain` =
  `lerp(morph.fromDomain || domainOf(morph.from, morph.fromBasis),
  yTarget, morph.t)` while blending. Labels keep their values from frame
  one and SLIDE into position as the 5s-grid window contracts/expands;
  50% never moves on windows that share its centre. Windows that round
  identically produce ZERO label motion — correct, not a bug (classic
  ALP v L/NP today).
- TrendChart (08b413e7) — plain consumer: `<text className="axis-label.y"
  … y={sy(t)}>` (~:825), `yLabelled` greedy culling (~:478, NEED=15 viewBox
  units). Its own winRef/travelling machinery (~:109) is the RANGE-ZOOM
  animation — unrelated to the matchup morph; don't debug it for matchup
  morph bugs.

## THE INVARIANT — morph frames render with DESTINATION state

Every render during the morph sees `matchup === morph.to` AND (since
5b2c51e) `basis === morph.toBasis` already. So any const keyed to the
CURRENT matchup or basis — `impBasis`, `impOnBasis`, basis-keyed data —
describes the DESTINATION inside `blend`/`domainOf(morph.from,
morph.fromBasis)` too. Worked bug (7864c69):

- `impData` (classic, :888) is gated `impOffered && basis === "imp"` —
  basis-only, NOT matchup — exactly so "a morph AWAY from it still leaves
  on the implied line it was set in" (its own comment).
- `impOnData` (ALP v ON) was gated on `impOnBasis`
  (`impOnOffered && basis==="imp" && matchup==="alp_on"`). Clicking back
  to L/NP flipped `matchup` → `impOnBasis` false → `impOnData` null →
  `iDataOf("alp_on")`/`iScatOf("alp_on")` fell through to the PUBLISHED
  head-to-head series. Its domain rounds to the same [40,60] as the L/NP
  target, so `lerp([40,60],[40,60],t)` is a no-op: labels snapped, and the
  line blend quietly interpolated from the wrong starting series.
- Fix: `impOnData = impOnOffered && basis === "imp" ? … : null` (mirrors
  impData). **Rule for this file: any data/view const consumed by
  morph-from code (`ptsOf`, `domainOf`, `iDataOf`, `iScatOf`,
  `morphClouds`) must be gated on the BASIS, never on `matchup ===…`.**
  Consumers that legitimately want the on-screen state read
  impBasis/impOnBasis directly (copy, intervals, legend keys) and were
  untouched by the change.

## heroEvents — per-matchup change-of-hands markers (shipped 12100d1, 2026-09-18)

The hero event rail (TrendChart `.evt-label` texts) originally drew only
`e.major` events, so neither matchup's defining switch ever appeared.
heroEvents (73de0c58 ~:1120-1128) now keeps
`(e.major || e.date === own) && e.x >= x0 && e.x <= x1`, where `own`
maps the SHOWN matchup to its defining non-major event date —
`alp_lnp: "2026-02-12"` (Taylor leads Libs) / `alp_on: "2025-12-08"`
(Joyce → ONP) — and `shown = morph ? morph.from : matchup`. The event
is pulled BY DATE from D.events (the a11e1559 `eventOn()` discipline:
never fork event copy into the hero asset). Both markers stay non-major:
a major marker rides every chart, and each is the OTHER chart's story.

MORPH GATING applies the flipped-state invariant with a deliberate
twist: events belong to the SCENE BEING DRAWN, not the destination, so
keying on `morph.from` mid-morph keeps the departing matchup's marker
on the blend until completion (`setMorph(null)` lands the arriving
matchup's marker). Gating on `matchup` here would pop the marker 320ms
early — the same class of bug as the impOnData snap, one gate flipped.

Headless verification facts (probe .matilda/hero-events-dem-probe.mjs):
- The hero chart is `.card.hero .chart svg.chart-svg` (SECTION with
  class "card hero"); event labels are `.evt-label` `<text>` nodes
  inside its svg — do NOT reach for the first svg on the page.
- Matchup switching in a probe: `document.querySelector(".ha-chip").click()`
  — do not regex the pill title; titles are verbose ("Show Labor v One
  Nation"), an `/ALP v (ON|L\/NP)/` pattern silently never matches and
  every downstream check fails one morph late.
- Live-site grep after push: the compiled bundle Babel-escapes non-ASCII
  to \uXXXX ONLY in compiled JS string literals — the data-asset event
  names ("Joyce → ONP") stay literal UTF-8 in index.html (babel input
  is the chart asset, not the data asset), so a UTF-8 grep works for
  event names but a `\u2192` grep finds nothing there; check an
  ASCII-only fragment ("Taylor leads Libs") if in doubt.

## Probe — .matilda/morph-ylabel-probe.mjs (gitignored scratch)

Headless repro/verification: puppeteer-core + ephemeral local static
server over the repo; click the `.ha-chip` pill by `title` text
(`Show Labor v One Nation` / Coalition); sample every 40ms for 900ms:
- positions of `text.axis-label.y` in the FIRST svg that has any (the
  hero) → per-value sum|Δy| "motion" metric;
- first 4 trend-path `d` strings → `pathChanges` count (proves the LINE
  morph ran; a flat-label run with pathChanges≈8 puts the bug in the
  yDomain/domainOf layer, not the morph state machine).

Expected after 7864c69: BOTH directions move the outer labels ~43 viewBox
units (L/NP→ON: 7 labels 35–65 settle; ON→L/NP: 3 labels 45/50/55 settle),
50% static, final resting positions equal the pre-click ones.

## Lessons

- **Measure both directions before believing the user's direction
  report.** The measured broken direction can be the OPPOSITE of the
  description ("animates A→B, not B→A" measured as A→B animating); exactly
  one direction animating is the bug, and naming the direction wrong
  doesn't change the fix. Report the measured precursor precisely in the
  commit message.
- **In a morph-frames-read-destination-state component, suspect the
  data GATE before the animation loop.** Our state machine, easing and
  rAF were all fine; the asymmetry ratio fell out of two consts gated
  differently (one deliberately, one by accident). Diff the WORKING
  direction's data path against the broken one — the working side had an
  "impData is computed whenever the basis is imp at all" comment that
  named the invariance the broken side violated.
- Source-only commit discipline applied: rebuilt + validated + `npm test`
  + re-probed, committed ONLY the 73de0c58 asset (sibling sessions' dirty
  template.html/copy-chart.js/d1a1d215/index.html untouched; see
  shared-repo-session-race).

## Related skills

- `auspol-tpp-basis-toggle` — the basis system (impData/impOnData sources,
  parity gate, TDZ gotcha, basis-flip probes).
- `auspol-hero-strips` — the `.hero-alt` pill's layout/seat (nothing about
  the animation).
