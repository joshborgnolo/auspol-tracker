---
name: auspol-external-link-icons
description: auspol-tracker — the ↗ external-link icon spans (rd-apd-ext / rd-ap-ext / plink-mark), the CSS spec rule that a parent link's underline CANNOT be cancelled by a child span's text-decoration:none (fix = atomic display: inline-block, or blockification inside .rd-link's inline-flex), and the two renderers of the "Read the release"/"APC methodology" link pair.
source: auto-skill
extracted_at: '2026-09-28T01:25:38.961Z'
---

# External-link ↗ icons and the underline trap

## The CSS rule that bites (fixed 2026-09-28)

A parent element's `text-decoration` propagates to its **inline**
descendants unconditionally — a child span with `text-decoration: none`
still gets the parent's underline drawn through it. `.rd-apd-ext` had
exactly that no-op rule (rd.css ~:1659) from the start, so the ↗ in
"Read the release ↗" rendered underlined on hover until the fix.

To un-underline an icon span, make it **atomic**: `display: inline-block`
(block-level boxes and flex/grid items take no ancestor decoration).
`.rd-link` itself is `display: inline-flex` (rd.css ~:324) with forced
`text-decoration: underline`, so any direct child span inside it is a
flex **item** and gets blockified — that's why the fixed
`display: inline-block` on `.rd-apd-ext` probes as computed
`display: block`, and *both* are correct shields. If the span is
ever used inside a normal inline link, `inline-block` is what matters.

## Icon-span class map (three names, one job)

- **`.rd-apd-ext`** — ↗ after "Read the release" / "APC methodology" in
  BOTH poll details (see two-homes below). Only span with CSS:
  rd.css ~:1659 (`display: inline-block; margin-left: 3px; font-size:
  11px; color: var(--ink-faint)`).
- **`.rd-ap-ext`** — firm-name links in the All-polls table cells
  (rd-allpolls.jsx ~:729/:874). No CSS; parents are
  `text-decoration: none` with underline-on-hover at rd.css ~:1554.
- **`.plink-mark`** — the same ↗ in the older live renderers
  (a11e1559 ~:3248/:3266/:4401/:4463/:4512, d1a1d215 ~:261, 73de0c58
  ~:1807). No CSS matching the name anywhere. All three carry
  `aria-hidden="true"`; any new use should too.

## "Read the release" link pair — two homes, edit together

- `rd-polls.jsx` ~:352–353 (Latest-polls expanded detail,
  `.rd-pld-links`)
- `rd-allpolls.jsx` ~:446–447 (All-polls expanded detail,
  `.rd-apd-links`)

The Latest-detail copy originally had the ↗ as bare text; it now wraps
it in `<span className="rd-apd-ext" aria-hidden="true">↗</span>`,
mirroring the archive copy. Verify in BOTH details.

## Headless verification gotcha

`getComputedStyle(span).display` returns the **resolved/blockified**
value: a flex-item span authored `inline-block` reports `"block"`. A
probe asserting literal `"inline-block"` falsely FAILs — accept both
(anything non-`inline` is atomic). Pattern used (puppeteer-core, CHROME
env, throwaway `.build/probe-ext.mjs`): click `.rd-pl-row` rows until a
`.rd-pld-links` detail exposing both "Read the release" and
"APC methodology" appears (not every poll has a `methodUrl`), then click
its "Open in All polls" button to probe `.rd-apd-links` too.
