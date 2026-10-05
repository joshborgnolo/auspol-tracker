---
name: auspol-endlabel-colour
description: auspol-tracker — why a TrendChart end-of-line label never exactly matches its line colour (worked 2026-10-02, "why isn't the BludgerTrack label the same colour as the line"). The TrendChart engine (08b413e7) deliberately re-colours every end label for glyph legibility: var-token colours (alp/lnp/grn/onp/oth/mood-*/ink-*) go through inkOf() to their darker --x-text counterparts, and any colour with NO text variant (hex series like the hero overlay's publisher colours #7e52a8 purple / #10998d aquamarine, morph colour-mixes) is painted color-mix(in oklch, <colour> 62%, var(--ink)) — a 38% ink pull that visibly greys light teals while high-chroma purples survive. The recipe lives in TWO inside-TrendChart homes that must move together (~:1593-1601 visible labs map + ~:1756 the hidden-series `gone` fade list); there is no per-series endLabelColor prop today — overriding means editing the engine. Companion to auspol-endlabel-width-pricing (horizontal) and the user-side endlabel dodge skill (vertical).
source: auto-skill
extracted_at: '2026-10-02T05:35:00.000Z'
---

# TrendChart end-label colour recipe (why labels don't match their lines)

Symptom worked 2026-10-02: after the hero compare-outside-estimates overlay
went solid publisher colours (`cd11f5c`), user asked why the "BludgerTrack"
end label isn't the aquamarine of its line. Answer: the engine re-colours
every end label on purpose, site-wide, not per chart — nothing about the
overlay's series definition can express "label = exact line colour".

## The rule

`08b413e7-…js`, inside the end-label IIFE that also does the dodge and the
width pricing (see auspol-endlabel-width-pricing for those axes):

```js
/* inkOf, not the series colour: the label is a GLYPH … */
color: /var\(--(alp|lnp|grn|onp|oth|mood-pos|mood-neg|ink[-\w]*)\)/.test(s.color)
  ? inkOf(s.color) : "color-mix(in oklch, " + s.color + " 62%, var(--ink))",
```

Two arms:

1. **Recognised `var(--…)` token** (parties, mood, ink) → `inkOf(s.color)`,
   defined in `ed2260de-…js` as `window.inkOf` (~:37): regex-swaps
   `var(--alp|lnp|grn|onp|oth)` → `var(--$1-text)`, passes anything else
   through. The `-text` tokens are the pre-tuned darker text variants.
2. **Everything else** — hex strings, `color-mix(…)` morph outputs,
   anything without a token variant → `color-mix(in oklch, <c> 62%, var(--ink))`.
   `--ink` = `oklch(0.27 0.012 55)` (template.html `:root` ~:37; dark-mode
   override ~:156), a near-hueless warm dark grey.

Why it exists (the inline comment says it verbatim): mark colours are tuned
as LINES/DOTS; at 13px/700 text on paper `--grn` sits at ~3.5:1 and any
light teal worse — the label is a glyph and must hold ~3:1. A colour with
no text-weight variant is pulled a third of the way to ink so "a light
teal label [doesn't] sit under 3:1 on paper".

**Practical consequence:** light, lower-chroma series colours grey out the
hardest — 38% ink on aquamarine `#10998d` reads as slate-teal, visibly
off-line; the same mix on purple `#7e52a8` (higher chroma) still clearly
reads purple. Same rule, different optics.

## TWO homes, edit together

- **~:1593–1601** — the visible-labels map (colour, ideal-y for the dodge).
- **~:1755–1760** — the `gone` list: labels of series hidden via a legend
  click keep their names at opacity 0 and fade out with the line instead
  of vanishing. Same recipe duplicated so a fading label doesn't colour-
  shift mid-fade.

Change the recipe (or the 62/38 mix) in both or the flash shows.

## There is no caller-side override today

TrendChart accepts no `endLabel*` colour prop (only `endLabel`,
`endLabelOpacity`, `endCap`). If a chart ever needs a label exactly its
line colour — or a gentler mix — the options are: add an
`endLabelColor(/Opacity)`-style per-series prop honoured in BOTH homes,
or route the colour through a `var(--…)` token the regex recognises and
give it a `-text` variant. Engine edit + rebuild; probe with the
geometry-verify pattern (reading `fill` attributes on `.end-label` texts)
since screenshots are useless to the reviewing model.
