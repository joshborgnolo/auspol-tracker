---
name: auspol-map-title-font
description: /map/ — restyling the "Electoral map" h1 (or matching a main-site headline font on the map page). The main-site headline is .rd-hed = var(--serif) 700 = Crimson Text; the map's h1 is #mp-title styled by .rd-title in .build/map/app/page.css (~:30, NOT rd.css); map/index.html carries its own --serif token and already loads the Crimson Text 400/600/700 cuts. Settled 2026-11-12 (sans 600 → serif 700 → serif 700 at 26px, 9a8ecaff/bab66878) plus the story column's today heads in the same face (0fc29849).
source: auto-skill
extracted_at: '2026-11-12T12:07:48.858Z'
updated_at: '2026-11-12'
---

# /map/ title font — matching a main-site headline treatment

Worked 2026-11-12: "make the heading 'Electoral map' in /map/ the same font
as the Now headline".

## What the main-site headline font IS

- The Now tab's story headline renders through `RdHed` (rd.jsx:91) into
  `<H class="rd-hed">`.
- `.rd-hed` in `.build/newtracker/assets/rd.css:161`:
  `font-family: var(--serif); font-weight: 700; font-size: 46px …`
- `--serif` is defined in `.build/newtracker/template.html:158`:
  `"Crimson Text", Georgia, "Times New Roman", serif`. So "the headline
  font" = **Crimson Text at 700**.

## Where the /map/ h1 lives and what styles it

- Markup: `map/index.html:191` — the page is HAND-MAINTAINED:
  `<h1 class="rd-title" id="mp-title">Electoral map</h1>` (inside the
  `.rd-eyebrow` row).
- Its ONLY styling rule: `.rd-title` in `.build/map/app/page.css:30` (the
  "section anatomy (rd.css, ported)" block — but it is this file's copy;
  editing rd.css does nothing for /map/). No site-shell rule overrides it
  (checked .build/site-shell.mjs).
- Typo loop as in auspol-map-theme-palette: edit `page.css`, then
  `node .build/map/assemble.mjs` (rewrites `map/map.css`, re-stamps the
  `?v=` hashes in `map/index.html`); never edit `map/map.css` directly.

## The map page already has the serif font — no @font-face work

`map/index.html`'s inline `<style>` defines `--serif: "Crimson Text",
Georgia, "Times New Roman", serif` itself (:89) and its `<head>` carries
`@font-face` for Crimson Text 400, 600 AND 700
(`crimsontext-*-latin/*.woff2`, unicode-ranged) plus Commissioner and
IBM Plex Sans. A `--serif` 700 headline therefore needs only the CSS
rule change — the story heads (`.st-hed`, page.css:322) already use it.

## The shipped change (settled across three same-day lands)

1. `9a8ecaff` — `.rd-title { font-family: var(--serif); …; font-weight:
   700; … }` (was `var(--sans)` 600). Family+weight only.
2. `bab66878` — "nudge up the size": expect this ask the moment the
   serif lands. Crimson Text's x-height reads shy of Commissioner's at
   the same px, so 22px → **26px**, not the `.rd-sub` rung of 28 — the
   map's own story hed `.st-hed` sits at 32 and the Now hero `.rd-hed`
   at 46; 26 keeps the page title under its story heads. line-height
   and letter-spacing kept as shipped.
Verify by grepping the assembled `map/map.css` for the new `.rd-title`
rule. The size ladder for reference: eyebrow-neutral `.rd-title` 22
(Commissioner) → serif title 26 → `.st-hed` 32 → Now `.rd-hed` 46.

## The story-column today heads followed the same face (0fc29849)

Third ask that day: "make 'The Senate today' / 'The House today' the
same crimson font". Those strings are story-column heads, NOT the h1 —
rendered by TWO renderers that must move together (same idiom as
auspol-ledger-two-homes / auspol-pollster-cell):

- `head(title, meta, …)` in `app-4-story.js:76` — every lens/area head
  (`<div class="st-head"><h2>…`); the today title is chosen upstream in
  `storyArea` (~:1522).
- `senHead(title, meta, …)` in `app-3b-senate.js:324` — the Senate/LC
  deck head; its `"The Senate today"` call site is ~:386.

Both tag `class="st-head st-today"` only when the title matches
`/^The (House|Senate|Assembly) today$/` ("The Assembly today" is the
state now-frames' twin — included by design, flagged to the user); the
CSS `.st-head.st-today h2 { font-family: var(--serif); font-weight:
700; font-size: 26px; }` sits beside the default `.st-head h2` rule
(page.css ~:320), so every other lens/seat head keeps Commissioner
22px 600. Two OTHER places the same strings appear are NOT heads and
were deliberately left alone: the fullscreen elections dock
(`.fs-cd-t`, app-7-full.js:592) and the timeline label
(app-6-ui.js:1278). No test greps `st-head` markup — the gate ran
test-map-page/senate/vote-bands/chart/draw.
