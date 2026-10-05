---
name: auspol-decidedness-panel
description: "auspol-tracker — the Decidedness section (renamed from 'Undecided' 2026-10-01, fd7f474; story dek trimmed a6f2e60; by-party sub got a significance-gated One Nation tail fd7f474) anatomy in rd-panels.jsx ~:2704-3058: anchored internals (id undecided, .rd-un-*, D.undecided / D.firmness, glossary term id) vs the three user-facing title homes (RdSec title, RdTabs ariaLabel, three RdFoot how.from labels), which measure labels STAY 'Undecided' (100-voters bar legend, chart panel title, dek sentences), the base-window wording trap ('since July 2025' in copy vs 'RedBridge, mid-2025 → now' in the ShiftPlot source/key — user-dictated nominal phrasing, F.base is the first 3 RedBridge firmness waves pooled), and the verify-the-gate-first lesson: a dictated conditional clause may not render today (ON 51.8→56.2 was n.s. at ship time) — replicate the panel's apart() test against the data asset via a window shim before promising the full sentence. 2026-10-01 RdShiftPlot head-grid one-line title fix (9164ed8): the card's head row, data rows and axis SHARE one grid-template-columns in rd.css (~:1431) — fit a wrapping desktop title by spanning it across the plot track + white-space:nowrap, NEVER by widening track 1 (it is also the data rows' label column, so tracks and ticks misalign together); phone block already promotes the title full-row ≤640px, which is why it read one line on phone and two on laptop. 2026-10-01 ALL-VOTERS LINE PORT (user: 'assimilate A's dotted line with B's… make A functionally and visually identical', then 'do NOT retain B's blindness to the poll dots'): RdShiftPlot's all-voters line is now Who-votes' allline idiom — .rd-sp-plot wrapper + .rd-sp-allline grid overlay re-declaring the shared head/row/axis template, stroke identical to .rd-wv-allline i (1.5px repeating-linear-gradient ink 4/3-off on --x→translateX(calc(—1cqw − 0.75px))), ONE continuous desktop line vs per-row .rd-sp-all ≤640px, caption glides on --x translateX(…1cqw − 50%) with RollNum (allLabel prop gone, dp prop added). B's blindness deliberately NOT ported: the connector's alpha lives in its COLOUR (color-mix … transparent, opacity stays 1) so its solid 2px var(--bg) halo — and the dot's, widened 1.5→2px — erases the dash underneath (a translucent element's halo would ghost); z chain line 1 < link 2 < dot/ring 3. Pinned by .matilda/probe-sp-allvoters.mjs (stroke byte-identity vs .rd-wv-allline i at 1280/901/640/390). SAME-DAY B-side follow-up (83dcc7d, user: 'can u fix b's blindness too'): stacking (56d6058's z-lift) had not cured the ghosting — the rug dot faces were translucent (opacity .55/.28, no halo) so the dash still showed THROUGH the Who-votes poll dots; every rug face now carries its alpha in the COLOUR (color-mix … 55%/28%, transparent, opacity stays 1 so the halo stays solid) + the same solid 2px var(--bg) ring the ci ticks carry — the hover/hi/lit opacity rules all became colour rules, and the hi echo-ring's 55% alpha moved into its border colour. THE ANTI-GHOST RULE for any mark over a chart line: alpha belongs in the colour, not opacity, because only a solid element's box-shadow halo can erase what passes underneath (a translucent element's ring ghosts with it)."
source: auto-skill
extracted_at: '2026-10-01T09:20:00.000Z'
---

# Decidedness section (formerly "Undecided")

Home: `.build/newtracker/assets/rd-panels.jsx` ~:2704–3058 (comment banner
`Decidedness`; the `RdUndecided` component). Three views via `RdTabs`:
`all` (100-voters bar + trend panels), `party` (firmness by party) and
`age` (softness by age). Data: `D.undecided` (first-preference / after-
preferences / not-firm series), `D.firmness` (RedBridge solid-share waves),
`U.softAge` (Resolve age waves).

## The 2026-10-01 rename map: what moves, what never does

User: "rename the 'undecided' section 'decidedness'". The section's
user-facing title has exactly THREE homes, all in rd-panels.jsx:

1. `<RdSec id="undecided" cls="rd-un" title="Decidedness" …>` (~:2944)
   — `title` is the rendered section heading (`RdHed`); CSS titlecases it.
2. `<RdTabs … ariaLabel="Decidedness among" …>` (~:2946).
3. THREE `<RdFoot how={{ term: "undecided", from: "Decidedness" }}>`
   couples (~:2985/:3020/:3053, one per view). `term` is the glossary
   definition id — stays `"undecided"` (the term still exists). `from` is
   the provenance label passed to `window.AP.openTerm(term, from)` →
   TermPop/openTermPage, where it names the section the user tapped from —
   it must track the section's NAME.

STAY "undecided" (anchored internals and measure-level labels):

- `id="undecided"` on the section — `document.getElementById("undecided")`
  is called 3× in rd-panels.jsx (the rdPinScroll wiring ~:2759/:2780/:2935)
  and outside anchors may target it.
- `cls="rd-un"` + every `.rd-un-*` CSS class in rd.css.
- `D.undecided`, `undecidedOf`, `undecided[]` rows, gen-data fields.
- Measure labels: the 100-voters bar's `<b>Undecided</b>` segment (~:2960),
  its legend row "Undecided:" (~:2972), the `panel(…, "und", "Undecided",
  "% of all voters")` chart title (~:2982), dek sentence copy ("… is
  undecided."), the `buildStaticSummary` figure label
  (`Undecided ${p.undecided}%.` in build.mjs). These name the MEASURE, not
  the section — renaming them mislabels the polling question.

The rd-hero eyebrow "On this page" nav (snapNav) lists only four sections;
Decidedness is not one — no nav edit needed.

## The by-party sub-head and its significance-gated tail (fd7f474)

`partyView` IIFE (~:2869): rows = parties with `sig` per
`apart(a,b) = Math.abs(a.v-b.v) > Math.hypot(a.ci95,b.ci95)` (now-ci95
against base-ci95, pooled 3-wave pools at both ends); `biggest` = the sig
row with the largest |now−base|. Sub sentence:

```
{biggest} voters have {softened|firmed} since July 2025[, while One Nation voters have {softened|hardened}]
```

- "softened" = solid share FELL (now < base), "firmed"/"hardened" = rose.
- The One Nation tail renders iff `onpRow.sig && biggest.id !== "onp"`
  (the lead clause already names ON when it's the biggest — no doubling).
- Fallback when nothing is sig: "No party's voters have softened
  significantly since July 2025".
- No-party instance at ship time: only lnp sig (59.8→48.1), ON 51.8→56.2
  NOT sig → page reads "Coalition voters have softened since July 2025".

### Verify the gate against the payload BEFORE promising dictated copy

The user dictated the FULL sentence including "…, while One Nation voters
have hardened" — but the panel's own test said it didn't fire at ship
time. Reproduce the test on the built data asset and report the sentence
that ACTUALLY renders:

```bash
node -e "
const fs=require('fs'),f=fs.readdirSync('.build/newtracker/assets').find(n=>n.startsWith('9f09dca2'));
const w={};new Function('window',fs.readFileSync('.build/newtracker/assets/'+f,'utf8'))(w);
const F=w.AUSPOL.firmness;
const apart=(a,b)=>Math.abs(a.v-b.v)>Math.hypot(a.ci95,b.ci95);
['onp','alp','lnp','grn','oth'].forEach(k=>console.log(k,apart(F.now[k],F.base[k])));
"
```

(The asset assigns `window.AUSPOL` — a bare-window shim is enough; do NOT
eval `const` declarations into a bare scope expecting them to leak.)

## The base-window wording trap

`F.base` (gen-data.mjs ~:1890) = the FIRST `FIRM_POOL` (3) RedBridge
firmness waves pooled — as of 2026-10-01 "19–30 Jun – 25 Sep–7 Oct 2025".
The nominal phrasing of that window lives in MULTIPLE homes that can
drift apart:

- sub copy: "since July 2025" (user-dictated 2026-10-01, was
  "since mid-2025"),
- ShiftPlot `source={"RedBridge, mid-2025 → now"}` (~:2993),
- RdKey `label: "Mid-2025 (" + F.base.from + " to " + F.base.to + ")"`
  (~:2994),
- the age view's own `source="Resolve, mid-2025 → now"` / "Mid-2025" key
  (~:3026/:3027).

The user's 2026-10-01 edit scoped ONLY the sub sentence; the ShiftPlot
furniture still says mid-2025 and still matches the displayed exact dates.
If asked to reconcile, move all five homes together (or leave generic).

## The RdShiftPlot head grid and the one-line title (9164ed8)

The shift-plot card (`RdShiftPlot`, rd-panels.jsx :2717) heads both the
By-party and By-age views (`title="Share who call their vote solid"` /
`title="Share not firm, by age"`). Head row, data rows AND axis all share
ONE grid declaration (rd.css ~:1431):

```
body.rd .rd-sp-head, body.rd .rd-sp-row, body.rd .rd-sp-axis { … grid-template-columns: 200px minmax(0, 1fr) 110px 60px; column-gap: 20px; … }
```

That sharing is the trap: never WIDEN track 1 to fit a wrapping title —
track 1 is also the data rows' party-label column, and the dotted plot
tracks + axis ticks ride the same template, so every row and the scale
misalign together.

Desktop, the title `<b>` sat in `grid-column: 1` (200px track; the
31-char title at 15px/600 needs ~230px) and wrapped to two lines. Phone
escaped it because the max-width:640px block (rd.css ~:1458–1472)
re-templates the grid (`86px minmax(0,1fr) 54px 40px`) AND promotes the
title `grid-column: 1 / span 4` with src on row 2 and the allcap label on
row 3 — a full-row title, one line. That asymmetry is exactly the user's
report ("one line on my phone, two on laptop").

Fix (9164ed8, rd.css ~:1433): the desktop title spans into the plot
track and cannot wrap — `grid-column: 1 / span 2; grid-row: 1;
white-space: nowrap;`. It shares track 2 with the absolutely-positioned
`.rd-sp-allcap > span` "All voters N%" caption, but the caption is
bottom-of-cell text pinned at X(all)% (≈25%), far left of the track and
nowhere near the title's ~230px of text — measured zero 2D intersection
at every rung. Phone block untouched; its more specific `1 / span 4`
still wins ≤640px.

Probe `.matilda/probe-shifttitle.mjs` (scratch, serves the built repo):
clicks both Decidedness tab views, asserts the title b's rect height
stays ≈21.8px (>30 = wrapped) at 1440/1280/1100/901/900/640/390, and
asserts non-overlap against both the allcap caption and `.rd-sp-src`.
Two probe-side traps, recorded in auto-skill-auspol-headless-geometry-verify:
the tab MOUNTS the DOM (waitForSelector the card before the tab click
times out), and overlap asserts need both axes (phone stacks the cousins).

## History & probes

- **9164ed8 (2026-10-01)** — RdShiftPlot head-grid one-line title fix
  (section above). Probe: `.matilda/probe-shifttitle.mjs` (untracked).
- **a6f2e60 (2026-09-28)** — story dek TRIMMED to its verdict sentence
  ("Neither share has moved significantly since the 2025 election"; the
  Roy-Morgan quartile block and pooled-figure tail deleted from the story
  IIFE ~:2800). See auto-skill-auspol-curated-panel-copy's trim section.
- **fd7f474 (2026-10-01)** — section rename (above) + by-party sub rework
  (above). Probe: `.matilda/probe-decidedness.mjs` (scratch) serves the
  repo, asserts heading === "Decidedness" and the party view's `.rd-sub`
  head matches the expected sentence, and fails on stale "mid-2025".
