---
name: auspol-rd-tpp-hero
description: auspol-tracker — the redesign front-page two-party hero (rd-hero.jsx, section.rd-tpp) — the chart a visitor actually sees: it draws Labor's share vs BOTH rivals at once (main + "other" line with "v Coalition"/"v One Nation" END labels), the "Compare published 2PP" overlay ("As published"/"Implied" end label), and the ON-flow sensitivity bracket whose `edge:true` renders its TOP edge as a PHANTOM second dotted line (renderer strokes area top-edges dashed; fill invisible at .rd-sens opacity .1) — restyled 1px/"1.8 3"/0.35 on 2026-09-28 via new parametric area options edgeWidth/edgeDash/edgeOpacity. Event markers are the UNION of keptEvents since the same day (user wanted identical markers on every matchup pill). Renderer dash encodings trap: dashed SERIES encode stroke-dasharray "6 6", area EDGES default "4 4"/custom — probe assertions must match the right pattern. Pinned by .matilda/rd-tpp-hero-probe.mjs (14 checks)
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
