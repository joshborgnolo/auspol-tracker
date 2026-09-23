---
name: auspol-tpp-basis-toggle
description: auspol-tracker — the two-basis 2PP system (shipped 6cdfa7e, 2026-09-18; single-button toggle + ALP v ON parity 0365ba4; "(default)" marker + compare-switch single-home move a6578f4, same day): implied preference flows is the DEFAULT headline basis everywhere, with ONE interactive "Using implied preference flows (default)"/"Using respondent-allocated preferences only" button (names the ACTIVE basis, press to flip, sentence case, the implied side carries a " (default)" suffix) under the two-party heading on BOTH the classic and ALP v One Nation matchups. The published-basis estimator payload is deliberately untouched (deff-backtest parity gate) — implied is a display-surface merge. The Compare overlay checkbox has ONE home, under the chart legend at EVERY width (the .pg-phone two-homes machinery is deleted; copy-chart STRIP_SEL now strips `.hero > .pg-check`). The interval hi-method tag names the ESTIMATOR ("Weighted aggregate"/"Monthly average") on BOTH bases — a basis-swapping label ("Implied from primary votes") was tried between commits and the user rejected it on sight ("this seems silly to me"). Probe lessons — read .hero-readout .roll .sr-only for the figure (a regex for "Labor X% · Coalition" matches TabScore's d1a1d215 string, not the hero), and identify the hero svg by viewBox height 420|700, NOT by most circles (the flow-drift panel at ~647 circles is basis-independent and masks the hero's change). TDZ gotcha — build/validate/test all pass with a ReferenceError that kills the whole JS view; always headless-probe the render. Same-day table extension f57ffd3: the 2PP column header in BOTH polls tables is now a th-basis button flipping the SHARED App tppBasis (table clicks move the hero too). ArchPublished recovered verbatim from 798b853^ behind a new ArchTpp switch; archLeadInfo gained a basis arg (4 callers); archive lead/lean/hfx + FACET_SCOPE.twopp are basis-keyed (published scope 126 rows vs implied 157) — all off pre-existing 9f09dca2 payloads (alpN/agg2pp/houseEffects.tpp), NO gen-data change. Probe: .matilda/lead-basis-probe.mjs (36 checks)
source: auto-skill
extracted_at: '2026-09-18T04:49:06.097Z'
---

# Two-basis 2PP system (implied default / published toggle)

Classic matchup shipped as commit 6cdfa7e (2026-09-18); the toggle UI was
reworked into a single button and the same basis feature extended to ALP v
One Nation in 0365ba4 (same day). The site carries TWO 2PP bases side by
side and leads with the implied one:

- **Implied** — every poll's primaries read through the one fixed AEC-2025
  flow table (`synth2pp` aggregate line + per-wave `alpImp` dots); on
  ALP v ON it's the site's own ALP–ON calibration (`synthOn` line +
  per-wave `alpOnImp` dots).
- **Respondent-allocated (published)** — the pollsters' own figures
  (classic: `latest.alp2pp`; ALP v ON: `D.altLatest.alp_on` /
  `MATCHUPS.alp_on.data`).

## Layer map (edit any copy/behaviour in all its homes)

- `gen-data.mjs` — hoisted `impOk(p)` eligibility predicate (~:271, full
  primary set {alp,lnp,grn,onp} + no sumNote) shared by `tppRowsSynth` and
  per-poll emission (~:1331 and ~:1410, both row emitters);
  `individualPolls` emits `alpImp: r1(impliedAlp2pp(p))` ONLY where
  impOk — so the two dot clouds are genuinely different point sets, not a
  re-render of the same polls. Worked user-question 2026-09-23 ("why no
  implied 2pp for YouGov … 25–30 Sep"): that's the Sep-**2025** YouGov
  "Public Data" wave whose sumNote (OTH 14% incl. 7% undecided, Σ107)
  gates it out — archive implied cells show "—", published 2PP still
  renders, and the sumNote text itself appears NOWHERE on-page, so the
  dash is unexplained to readers (see auspol-pollsjson-schema; the
  archive's yearless DD–DD Mon date column is why it read as current).
  `synthChg` (~:1286) adds implied month-on-month significance
  (changeSe/changeCi95/changeSig, two independent 21d windows RSS)
  merged into `synthLatest`.
- gen-data ALP–ON emit (0365ba4) — `synthOn` (monthly implied ALP–ON
  points), `latest.onImp` = {a, b, band, flows, n, aPrev}, and per-poll
  `alpOnImp`. ALP–ON flow constants FP_ON={lnp:0.315, grn:0.89, oth:0.53}
  (bands .025/.03/.03) were deliberately recalibrated 2026-09-11
  (Coalition 0.72→0.685) and already post-date the user's analysis doc —
  do NOT "recalibrate" them again on that basis.
- Data asset (9f09dca2) — `synthLatest` shape is {alp, lnp, ci95, n, prev,
  changeSig, ...} — DIFFERENT from `latest` = {alp2pp, lnp2pp, alp2ppCi95,
  alp2ppPrev, method{nPolls,windowDays}, ...}. Never regex one with the
  other's keys. `latest.onImp` carries `band` = the frozen ALP–ON
  flow-table RANGE (labelled "flow range" in the UI, never "95% interval").
- Hero asset (73de0c58) — App state `tppBasis` (default "imp", mirrored to
  window.AP.tppBasis); gates at :783-785: `impOffered`/`impBasis`
  (classic) + `impOnOffered` (= `D.synthOn.length>1 && !!D.latest.onImp`) /
  `impOnBasis` (alp_on). `latest` merge clamps classic to impBasis;
  `onImpL` (~:969-977) is gated on impOnBasis so latest/unc/monthDelta
  flip together, while `D.adjusted.alp_on` keeps the "Weighted aggregate"
  interval label alive on the resp basis. impData/impScatter (:865-884,
  classic) has ALP v ON twins impOnData/impOnScatter (~:893-910);
  iDataOf/iScatOf extended for `id==="alp_on"`. **Since 7864c69 BOTH
  impData AND impOnData are basis-gated only (`…Offered && basis==="imp"`)
  — never gate impOnData on impOnBasis again: matchup flips before the
  first morph frame, so matchup-keyed data vanishes mid-morph and the
  ON→L/NP y-window snaps silently (see auspol-hero-matchup-morph).**
  Module-scope
  `tppLatest(id, basis)` is the shared nowcast accessor (alp_on resp →
  `D.altLatest.alp_on`, imp → `D.latest.onImp`; TabScore in d1a1d215 calls
  it — already basis-aware). Basis flips do NOT animate (setMorph fires
  only on matchup switches) — dots swap instantly.
- Toggle JSX ~:1239-1253 (0365ba4): ONE interactive button
  `.hero-basis .hb-toggle` naming the ACTIVE basis (`Using <span.hb-what>`
  implied preference flows | respondent-allocated preferences only
  `</span>`, sentence case, and since a6578f4 the implied side prints a
  `" (default)"` text-node suffix OUTSIDE the hb-what span — the probe's
  exact-text assertions read `.hb-toggle` textContent, so the suffix
  joins the assertion); onClick flips setBasis imp↔resp. Render gate
  `((m.real && impOffered) || (m.altKey === "alp_on" && impOnOffered))`.
  The TextToggle pair + all-caps "USING" label are GONE.
- The `.hb-q` explainer link (f138f69, 2026-09-18): a circled "?" anchor
  (`<a className="hb-q" href="/preference-flows/">`, aria-label "How the two
  bases work – read the full explainer") is a SIBLING of the toggle button
  inside `.hero-basis`, leading to the new standalone explainer satellite
  page (`preference-flows/index.html` — see auspol-satellite-page-branding).
  CSS `.hb-q` in template.html (~:1141-1156, 17×17 circle, 11px/600, ink-3,
  EXPLICIT colours on base + :hover/:focus-visible — the
  content-link-colour rule: a colourless anchor falls through to UA blue;
  see auspol-content-link-colour). The explainer page carries the SHIPPED
  constants and its HTML head comment records the c3ec7be recalibration —
  when FP_ON/flows.mjs move, the explainer page's tables move with them in
  the same commit (it was written from repo constants, NOT from the
  external analysis doc, whose 72-to-ON Coalition figure c3ec7be
  superseded). Probe constraint: basis-flip-probe's exact-text assertions
  regex the BUTTON (`^Using implied preference flows \(default\)$` /
  `^Using respondent-allocated preferences only$` on `.hb-toggle`
  textContent) — the "?" anchor must never alter the button's text; add new
  affordances as SIBLINGS inside `.hero-basis`, not as appended text nodes.
- The interval hi-method tag (`unc`-gated row above the readout) names
  the ESTIMATOR — `{adjusted ? "Weighted aggregate" : "Monthly average"}` —
  on BOTH bases and both matchups, tooltip/openTerm always
  weighted-aggregate / monthly-average (`adjusted` is truthy on implied
  and resp alike: `m.real || !!onImpL || !!D.adjusted[m.altKey]`). A
  mid-session experiment swapped it to "Implied from primary votes" on
  the implied basis and the user rejected it on sight ("this seems silly
  to me") — a name-the-basis label duplicates what the toggle button
  already says 40px away. The revert orphaned `unc.implied` /
  `tppLatest(...).implied` payload markers (dead-field greps: `\.implied`
  in the hero asset returned writer-only hits) — both stripped in
  a6578f4. The d1a1d215 fp-flows glossary entry cross-references the
  toggle button's text, not the tag; keep it on the toggle's wording.
- Compare overlay (0365ba4) — `cmpCopy` (~:848) branched for
  `matchup === "alp_on"` (imp→"published head-to-head", resp→"implied 2PP");
  `compareToggle` + `synthOverlay` render gates widened to
  `(matchup === "alp_lnp" && impOffered) || (m.altKey === "alp_on" && impOnOffered)`;
  alp_on overlay y = `d.alp ?? d.a`; `sensAreas` stays classic-only.
  ONE render site since a6578f4: `compareToggle()` (no phone arg, no
  `.pg-phone` class) renders directly after `</div>` of `.hero-foot` —
  under the chart legend at EVERY width. The old two-homes machinery
  (desktop copy inside `.hero-controls` + `.pg-phone` display rules in
  template.html `:1284`/`:2962`/`:3479`) is deleted; the toggle's CSS is
  now one `.hero > .pg-check { margin: 10px 0 0; }` rule below the
  legend block. copy-chart.js STRIP_SEL strips
  `".hero-controls, .hero-alt, .hero-chartbar, .hero > .pg-check"` (the
  `.pg-phone` entry is gone). When moving a control that receives a
  margin chain's auto-sink: walk the template.html comment+rule pairs —
  the desktop foot-group sink (.hero-controls .pg-check / .hero-alt /
  .hero-chartbar) had THREE comment+rule homes that all described the
  compare switch leading; leaving one stale rule reintroduces a
  double-sink.
- Legend/caption (~:1497/) — ribbon label `impOnBasis ? "flow range" :
  "95% interval"`; ALP v ON implied caption names "the site's fixed ALP–ON
  flow set" and notes "No election has counted this pairing".
- `template.html` — `.hb-toggle` / `.hb-what` CSS (~:1138-1150, replaces
  `.hero-basis` / `.hero-basis-label`): sentence case, 12px, ink-3 "Using",
  ink-2 600 basis name, 1.5px ink-faint underline, hover→ink; `.hb-toggle`
  joined to the 44px tap-target pseudo-element lists (~:852-857).
- `build.mjs` — `headlineView(L,S)` (:311) merges implied over the latest
  shape; `basisClause(v)` (:345) = " on implied preference flows"; appears
  in cardAlt + metaDesc + static summary (3× in built index.html).
- `make-card.js` — head merge (:48-67) overlays synthLatest fields onto a
  latest-SHAPED object (synthLatest lacks method/alp2pp* — a plain swap
  crashes on `.toFixed` of undefined); caption basisTag "· implied
  preference flows"; fig stamp gains `basis: "imp"|"pub"`, which feeds the
  render-card staleness gate (auspol-card.json vs auspol-latest.json).

## The parity-gate constraint

The published-basis `latest`/`agg2pp` payload is UNTOUCHED on purpose:
`.matilda/deff-backtest.mjs`'s parity gate regexes it. The implied default
is a display-surface merge on top. If you change the published estimator,
update the backtest replicas in the same commit (see
auspol-estimator-arms-race).

## TDZ gotcha (worked 0365ba4, cost a full debug round)

The bundler does NOT catch a temporal-dead-zone ReferenceError, and neither
do validate.mjs or npm test — ALL THREE pass while the page renders NOTHING
but the static summary (the JS view never mounts). In 73de0c58 the hero
component's `const m = MATCHUPS[matchup]` sits at ~:881, but any code added
ABOVE that line must reference `matchup`/`MATCHUPS[matchup]`, never `m`:
the 0365ba4 cmpCopy edit at ~:855 used `m.altKey`, runtime threw
`Cannot access 'm' before initialization`. Diagnose with a one-off
pageerror listener (puppeteer-core + ephemeral local static server —
`page.on("console"/"pageerror")` logging); `window.AUSPOL` payloads stay
intact, so "static summary renders + data present + no hero" = a render
exception, not a data problem. Rule: **any 73de0c58 edit that compiles is
NOT proven until a headless render probe succeeds.**

## Headless-probe lessons (cost a false bug hunt)

Reusable probes: `.matilda/basis-flip-probe.mjs` (same-node before/after
sample; since 0365ba4 it clicks `.hero-basis .hb-toggle`, asserts the exact
sentence-case text pairs, and also switches to ALP v ON via the `.ha-chip`
pill whose text contains both "Labor" and "One Nation", restoring the
implied basis between matchups) and `.matilda/basis-svg-dump.mjs` (hash
every svg per basis).

1. **Verify your measurement before the code.** The old smoke probe's
   figure regex matched a non-toggling node, so identical readings were a
   MEASUREMENT artifact — the flip had worked all along. The authoritative
   figure node is `.hero-readout .roll .sr-only` (RollNum's DOM value is
   final from the first frame despite the rolling animation). If a caption
   flips but "the figure doesn't", suspect the selector, not the state.
2. **The "Labor X% · Coalition Y%" literal is NOT in the hero** — it lives
   in TabScore (d1a1d215). Grepping the hero asset for it finds nothing.
3. **Identify the hero svg by viewBox height (1000x420 desktop, 1000x700
   phone), never by circle count** — the flow-drift panel has ~647 circles
   and is basis-independent, so "largest svg" heuristics report a false
   "dots identical".
4. Expected flip signatures (0365ba4): classic 51.5/48.5 ↔ 52.0/48.0,
   dots 318 ↔ 256; ALP v ON 51.3/48.7 ↔ 53.7/46.3, dots 318 ↔ 110,
   interval label "flows range" → "95% interval" on the resp basis.

## Verification checklist for basis work

`node .build/newtracker/build.mjs` → `validate.mjs` → `npm test` →
`basis-flip-probe.mjs` (figure + dots + exact toggle-text pairs flip on
BOTH matchups; exit 0) → grep built index.html for "on implied preference
flows" (×3) → card stamps auspol-card.json == auspol-latest.json with
basis:"imp". Scoped commit of the named source files + 9f09dca2 regen +
index.html only (shared repo — see shared-repo-session-race).

## Matchup follows the page too (2026-09-20)

User: "the table is alpvlnp centric … even when onp is stronger against alp
than l/np is" and "Poll lean / House effect … ignores alp v onp 2pp". Both
tables now follow the MATCHUP as well as the basis, and open on the hero's
rival ruling (`latest.rivalLead`, deadbanded in gen-data — `alp_on` at the
time of writing):

- `window.AP.measureOfMatchup(id)` (a11e1559, above PollsterTable) is the ONE
  bridge between hero matchup ids (`alp_lnp`/`alp_on`/`lnp_on`) and table
  measures (`lnp`/`onp`/`lnponp`). Unknown → `lnp`.
- Latest table: `PollsterTable` takes `tppMatchup`/`setTppMatchup` (SnapshotView
  in 73de0c58 passes the App state the Switch-2PP pills drive). The Lead head
  is a sortable `th` whose matchup name is a `th-basis` button (stopPropagation
  so a flip doesn't re-sort) toggling `alp_lnp ⇄ alp_on` — table flips move
  the hero and vice versa. `ArchTpp`/`ArchLead` take `measure`.
- `ArchImplied({p, measure})` prints `alpOnImp` / ON on `onp`;
  `ArchPublished({p, measure})` leads with the `kind: "alt"` contest on `onp`
  where the house filed one, else what it did publish. `lnponp`/`3cp` fall
  back to the classic pair in the 2PP column.
- Archive: `DEFAULT_MEASURE = measureOfMatchup(D.latest.rivalLead)`; URL `v=`
  is written only when the measure departs from it (`MEAS_BY_ID.lnp = "c"`,
  `MEAS_BY_URL.c/lnp = "lnp"`). The archive's measure is its OWN state (the
  Lead pop), not the hero's — it seeds from the ruling, it doesn't track pills.
  The pop lists the two Labor contests in ruling order (the rival Labor is
  doing worst against first), then L/NP v ON and 3-cornered (user, 2026-09-20).
- Rows carry `leanLnp`/`leanOn`/`hfxLnp`/`hfxOn` (+`pubBasis`); the COLUMN
  `lean`/`hfx` is the measure's pick, null on `lnponp`/`3cp` (dash titled "No
  aggregate on this matchup…"). ON lean = `alpOnImp − D.synthOn[ym].a`
  (implied) or `tppAlt.alp − D.alt2pp.alp_on[ym].a` (published); ON house
  effect = `D.houseEffects.synthOn` (NEW in gen-data, `synthOnEffect.snapshot`)
  or `.alp_on`. `.arch-lean.onp` (template) inks a negative in One Nation's
  colour.
- `ArchPollDetail` Poll lean / House effect rows print BOTH contests as
  clauses in the agg-effect row's shape (`+0.6 for ALP vs L/NP; −0.6 for ALP
  vs ON, against the implied aggregate that month`), basis-worded.
- `.matilda/lead-basis-probe.mjs` (37 checks) now loads `?v=c` and clicks the
  Latest head to ALP v L/NP before its classic-pair checks, and expects the
  implied default archive view UNSCOPED (85bd71d) — its "158 scoped" count
  had been failing since that commit.
