---
name: auspol-endlabel-width-pricing
description: auspol-tracker — end-of-line label WIDTH pricing in the TrendChart engine (08b413e7, commit 1c11115, 2026-09-30): textWidth(s, fontPx, weight) MEASURED widths replaced the 0.72em/letter char-advance estimate everywhere (25-28% fat on 13px/700 --sans labels; who-votes "Millennials" left ~28px dead plot). Covers both conversion sites (right-pad reservation IIFE ~:415 + past-cycles dodge collision-domain chaining ~:1601) and the padSeries prop: a morphing chart's caller never sees cw, so the ENGINE must price the union of both slots' series — the PPM (preferred-PM) switch's plot used to jolt ~21 viewBox units mid-morph because each slot priced its own margin from its own end labels. Probe: .matilda/probe/ppm-jolt.mjs (W slot clip rect bit-identical across Three-way/Two-way/Both at 1280px AND W=480).
source: auto-skill
extracted_at: '2026-09-30T05:16:35.931Z'
---

# End-of-line label width pricing + the padSeries prop

Companion to the user-level `auspol-endlabel-dodge` skill (vertical
y-clustering, gap constant `refUnits*1.15`). This one is the HORIZONTAL
axis: how much right-hand plot margin the engine reserves for end labels,
and how a chart that morphs between series sets holds one margin.

## textWidth, not the char-advance table

`08b413e7-…js` top-level `textWidth(s, fontPx, weight)` is a memoised
string-width measurer (canvas measureText). Before 1c11115 two sites
estimated width from per-character advances:

- **right-pad reservation IIFE** (~:415): `0.72em per letter`
  (+0.55 digits, +0.3 spaces) × fontPx × 0.95 + (rd ? 12 : 7).
- **past-cycles endlabel dodge** (~:1601): `adv(ch)` table feeding the
  collision-domain chaining — labels were chained into collision domains
  their real glyphs never overlapped.

On the 13px Archivo 700 `--sans` labels the estimate ran **25–28% fat**
(measured vs estimate, per `.matilda/probe/label-slack-probe.mjs`:
who-votes Education "Year 12 or less" real 100.1px vs estimate 140.8px;
issues-trust "One Nation" real 176.8px; leadership "over Hanson" −0.87px
slack after conversion). Symptom: dead whitespace right of the plot
("Millennials" label left ~28px of unused plot on the who-votes panel).

Both sites now call `textWidth(s.endLabel ?? l.text, rd ? 13 : 10.5*0.95,
700)`. The +12 (chart) / +7 (redesign) breathing allowances after the
measured width are unchanged.

## padSeries: price the union, morph in place

New TrendChart prop `padSeries` (signature after `refLines = [],` ~:193,
default `null`). The pad-reservation `need` chain becomes
`(padSeries ? seriesProp.concat(padSeries) : seriesProp).filter(...)` —
series the margin is priced from but NOT drawn.

Why it exists: the leadership preferred-PM chart morphs between slots
(two-way leads / three-way name labels / both). Each slot used to price
its own right margin from its own end labels ("over Taylor" vs
"Albanese"/"Hanson"/"Taylor" — different widths), so the plot width
jumped ~21 viewBox units mid-morph and the time axis jolted. The caller
cannot fix this with a constant pad (it never sees `cw`, the measured
column width — the engine converts units→px internally), hence the prop.

Consumer (`.build/newtracker/assets/rd-panels.jsx`):
`const ppmPadSeries = leadSeries.concat(threeSeries);` (:617) and
`padSeries: ppmPadSeries` replacing the old `padPx: ppmPad` in the
`ppmChart` lchart call (:639). Slot keying: `ppmSlot = v => v === "three"
? "three" : "two"` — ONE persistent slot, so content morphs in place
(labels swap, margin constant).

Rule of thumb: if a chart's series SET can change while its plot must
stay put, price the margin from the union via `padSeries`; never patch
it with a caller-side `padPx` constant.

## Regression probe

`.matilda/probe/ppm-jolt.mjs` (untracked unless `git add -f`'d — probe
dir is gitignored, curated probes are committed force-added per the
election-ring.mjs precedent). Headless pattern from auspol-headless-
geometry-verify: serve the repo over http, click the PPM RdTabs
(`button.rd-tab` inside `[role=group][aria-label="Preferred prime
minister question"]`, 1000ms settle past the 320ms morph), measure every
`#leadership svg` with a clipPath rect per state, assert:

1. every end-label slack >= -2px in every state;
2. the W slot's clip `x`/`w` identical ±1.5u across Three-way/Two-way/Both
   (key the slot by POSITION — first labelled chart in the section — its
   label vocabulary migrates between states, so content-matching breaks);
3. the label vocabulary actually changes (guards against no-op clicks).

Probe gotchas that cost time: pass the tab name as an arg into
`page.evaluate((n) => {...}, name)` — a missing `, name` silently makes
every click a no-op; assert state CHANGED so silent no-ops can't pass.
Run at both `W=1280` and `W=480`.

Sibling probe for pure width pricing:
`.matilda/probe/label-slack-probe.mjs` — raw `textWidth` vs pad per chart.
