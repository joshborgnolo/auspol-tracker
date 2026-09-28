---
name: auspol-external-link-icons
description: auspol-tracker — the ↗ external-link icon spans (rd-apd-ext / rd-ap-ext / plink-mark) and the REAL un-underlining rule: inside .rd-link's inline-flex every child blockifies into an in-flow flex item the decoration propagates into, so NO display value on the icon span shields it — the underline must be scoped to a text-only .rd-link-t span with the anchor carrying rd-link-ext (text-decoration: none).
source: auto-skill
extracted_at: '2026-09-28T01:25:38.961Z'
---

# External-link ↗ icons and the underline trap

## The CSS rule that bites (proved live 2026-09-28)

A parent's `text-decoration` propagates to its **inline** descendants
unconditionally — a child span with `text-decoration: none` still gets the
parent's underline drawn through it. The genuinely atomic exemptions are
inline-level boxes only (inline-block, floats, abspos).

The first fix (001a4ce, 2026-09-28) leaned on exactly that:
`display: inline-block` on `.rd-apd-ext`. **It did nothing on the live
page** and the user called it out the same day. Reason: `.rd-link` is
`display: inline-flex` (rd.css ~:324), so every direct child is a flex
ITEM — flex-item blockification turns the authored `inline-block` into
computed `block`, an ordinary in-flow box the container's decoration
propagates straight into. No display value on the icon span can shield it
inside a flex context.

The working fix (2026-09-28): take the underline OFF the anchor and scope
it to a text-only span inside.

- The `<a>` carries `rd-link rd-link-ext` — `.rd-link-ext` (rd.css ~:327,
  ordered AFTER `.rd-link` because specificity ties) sets
  `text-decoration: none`.
- `<span class="rd-link-t">` wraps the link words and carries
  `text-decoration: underline; text-underline-offset: 3px`.

Only the text fragment is ever a decorating box, so the icon span sits
outside every decoration — a DOM-checkable invariant (see below).
Whitespace BETWEEN flex items does not render (a whitespace-only anonymous
flex item drops), so the visible gap comes entirely from `.rd-apd-ext`'s
`margin-left: 3px`; keep the two spans adjacent in JSX and do not rely on
an inter-element space or a `{" "}` child.

## Icon-span class map (three names, one job)

- **`.rd-apd-ext`** — ↗ after "Read the release" / "APC methodology" in
  BOTH rd poll details (see two-homes below). Only span with CSS:
  rd.css ~:1659 (`display: inline-block; margin-left: 3px; font-size:
  11px; color: var(--ink-faint)`). The inline-block survives only as
  cover for any future NON-flex parent; inside `.rd-link` the thing
  keeping it un-underlined is the `rd-link-ext` / `.rd-link-t` pair,
  not its own display.
- **`.rd-ap-ext`** — firm-name links in the All-polls table cells
  (rd-allpolls.jsx ~:729/:874). No CSS; parents are
  `text-decoration: none` with underline-on-hover at rd.css ~:1554.
- **`.plink-mark`** — the same ↗ in the older live renderers
  (a11e1559 ~:3248/:3266/:4401/:4463/:4512, d1a1d215 ~:261, 73de0c58
  ~:1807). No CSS matching the name anywhere. All three carry
  `aria-hidden="true"`; any new use should too.

## "Read the release" link pair — two homes, edit together

- `rd-polls.jsx` ~:352–353 (Latest-polls expanded detail, `.rd-pld-links`)
- `rd-allpolls.jsx` ~:446–447 (All-polls expanded detail, `.rd-apd-links`)

Both anchors carry `rd-link rd-link-ext`, wrap the words in `.rd-link-t`,
and sit adjacent to the icon span with no text-child gap (see the
whitespace note above). The archive pair sits beside text-only
`.rd-link`s ("Report an error", "Back to the chart") that keep the
plain anchor underline.

## Headless verification — the invariant to assert

The 001a4ce probe asserted `getComputedStyle(span).display !== "inline"`
and called block a "shield" — wrong: computed block inside a flex
container is exactly the un-shielded case, and the live page proved it.
The correct invariant is about DECORATING BOXES, not display values.
`.matilda/probe-ext2.mjs` (node:http serve of index.html + puppeteer-core
+ system Chrome; clicks `.rd-pl-row` rows until a `.rd-pld-links` detail
shows `a.rd-link-ext`, then clicks "Open in All polls" for the
`.rd-apd-links` home) passes only when, for every icon link in both
details:

- the anchor computes `text-decoration-line: none` (proves `.rd-link-ext`
  wins the source-order tie against `.rd-link`),
- `.rd-link-t` computes `underline`, and the icon span and every one of
  its ancestors compute `none` (no decorating box can reach the glyph),
- the icon's left edge sits ~3px right of the text's right edge (the
  margin still carries the spacing).

`getComputedStyle(span).display` still reports the blockified value
(`block`) for a flex item — never assert authored `"inline-block"` on it.
