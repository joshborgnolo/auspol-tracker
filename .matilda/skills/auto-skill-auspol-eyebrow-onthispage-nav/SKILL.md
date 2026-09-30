---
name: auspol-eyebrow-onthispage-nav
description: "auspol-tracker — the redesign's per-tab 'On this page' eyebrow-jump nav (rd-eyebrow-tools), now in THREE tabs (rd-cycles.jsx navs/goTo, rd-allpolls.jsx NAV/jump, rd-hero.jsx snapNav/snapGo added 45314de): one <nav aria-label=\"On this page\"> in the FIRST section's .rd-eyebrow, desktop-only, buttons scrollIntoView({behavior:'smooth'}) to section ids which need NO scroll-margin (the redesign has no sticky chrome — grep 'position: sticky' in rd.css proves it). Shipping the Snapshot one taught the capacity math: content = min(viewport−128, 1152) so tiers above 1280px are pointless; the hero eyebrow's left block (title 205 + meta 400) leaves ~516px — five 13px items fit ONLY at the eyebrow's own 16px gap rhythm, not the siblings' 20px (6px over → the nav wraps to a second 23px row and pushes the hero hed down). Tiered: 5 ≥1280 / 4 ≤1279 (.rd-snap-t) / hidden ≤1189 / no DOM on phone (!narrow). Probe gotcha: baseline-aligned flex children make offsetTop equality useless — assert eyebrow HEIGHT ≤~30px for 'one line'."
source: auto-skill
extracted_at: '2026-09-30T13:24:04.464Z'
---

# The redesign's "On this page" eyebrow-jump navs (rd-eyebrow-tools)

Each tab's FIRST section eyebrow carries a desktop-only jump list, right of the
meta via `margin-left: auto`. Pattern per tab — if you add/remove an entry, it's
ONE array entry + (rarely) a section id; the CSS is shared.

## Where each tab's nav lives

| Tab | JSX | data/jump |
|---|---|---|
| Past cycles | `rd-cycles.jsx` eyebrow `:794` | `navs` const `:783`, `goTo` `:544` (`{!narrow && …}`) |
| All polls | `rd-allpolls.jsx` `:1567-1572` (`rd-ap-nav`) | `NAV` const + `jump()`; also the pinned `.rd-ap-pinnav` copy `:1528` |
| Snapshot | `rd-hero.jsx` eyebrow `:462` (`rd-snap-nav`, **45314de**) | `snapNav`/`snapGo` right after `meta` (`:395-406`); 4th entry flag `true` → `rd-snap-t` tier |

All three: `<nav className="rd-eyebrow-tools …" aria-label="On this page">` with
`all: unset` 13px/500 buttons (styles at `rd.css:1618-1626`, the `.rd-ap-nav`
rules now dual-selected with `.rd-snap-nav`), hover underline, accent
focus ring, `scrollIntoView({ behavior: "smooth", block: "start" })`.

## Jump mechanics in the redesign — no scroll-margin needed

The redesign has NO sticky page chrome (`grep "position: sticky" rd.css` → only
the All-polls pinned headwrap and one pseudo-element). So targets are plain
section ids (`latest-polls`, `leadership`, `direction`, `who-votes`,
`switching`, `issues`, `undecided`, hero `two-party` — all RdSec ids in
rd-panels.jsx / rd-hero.jsx) with NO `scroll-margin-top`. The old design's
72px `.tabs.sticky` clearance convention (auspol-archive-jump-links) does NOT
apply here. Smooth must be passed explicitly; no global `scroll-behavior`.

## Capacity math (measured 2026-09-30, before you reach for viewport tiers)

- Page column caps at `--maxw: 1200px` (`template.html:118`, `.page` plus
  28px padding + more): the eyebrow measures 1152px wide at viewport ≥1280
  and does NOT grow past it. Tiering by wider viewports buys ~zero.
- Hero eyebrow left block: title "Two-party preferred" 204.9px + column-gap
  16 + meta ("After preferences, N polls from N pollsters, updated …") 399.6px
  = ~620.5px → nav budget ≈ 515.5px at full width.
- The five Snapshot buttons measure 123.3 / 65.9 / 121.6 / 62.7 / 64 = 437.5px;
  at gap 16 → 501.5 ✓ (14px slack); at the sibling tabs' gap 20 → 517.5 ✗
  (wraps: eyebrow 50px tall, nav on a second row, hero hed pushed down).
- **Labels are the exact section titles** — shortening "Latest and next polls"
  etc. was rejected; the budget fixes the item count, not the wording.
- Fragility: the meta widens daily with CI poll counts ("9 pollsters" →
  "10 pollsters" ≈ +6px). 14px slack covers it; the failure mode is just a
  flex-wrap to a second row, same tolerance cycles already has.

## The Snapshot tier rules (rd.css right after the shared button block)

```css
body.rd .rd-snap-nav { gap: 16px; }   /* the eyebrow's own rhythm, not the 20 */
@media (max-width: 1279px) { body.rd .rd-snap-nav .rd-snap-t { display: none; } }
@media (max-width: 1189px) { body.rd .rd-snap-nav { display: none; } }
```

Entry flag 3rd-tuple-item `true` on the LAST `snapNav` entry (`undecided`)
adds `rd-snap-t`: shed the deepest link first as the row narrows, hide the
whole nav under 1189 (4-item fit needs ≥1190 incl. 6px meta-growth), no DOM at
all on the phone rung (`{!narrow && …}`, `useNarrow("(max-width: 640px)")`).
All-polls hides its `.rd-ap-nav` below 760 (`rd.css:1968`) instead — per-tab
choice, driven by how crowded its own eyebrow is.

## Probing (what to assert — auspol-headless-geometry-verify technique)

Probe: `.matilda/probe/snap-nav.mjs` (committed via `git add -f`), six widths.
The trap that cost a false negative first time: the eyebrow is
`align-items: baseline`, so a 22px title and a 13px nav NEVER share a top —
`navTop === titleTop` fails even when correct. Assert the wrapping tell
instead: `.rd-eyebrow` height ≤~30px = one line, ~50px = wrapped. Also assert
`nav` inside the eyebrow box, `display:flex` per rung, no horizontal
`scrollWidth` overflow, and click→`window.scrollY` moves and the target
section's `getBoundingClientRect().top` lands ~0 (wait ~1.6s for the smooth
scroll). Phone rung: nav absent from the DOM, not just hidden.

Related: `auspol-archive-jump-links` (old-design jump pills + the 72px
scroll-margin convention that does NOT apply in rd), `auspol-headless-geometry-verify`,
`auspol-rd-tpp-hero` (the hero section this nav rides in).
