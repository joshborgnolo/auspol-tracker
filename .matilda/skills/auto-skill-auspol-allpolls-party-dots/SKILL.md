---
name: auspol-allpolls-party-dots
description: auspol-tracker — the All-polls table's coloured party dots (.rd-ap-dot, rd.css :2063) shared by the primary/2PP/leadership facets, the row-background BOX-SHADOW halo that reads as a white/dark outline per mode, and the 2026-10-03 design ruling (055e117) that the halo STAYS while the month-average rings went hollow. Palette call sites in rd-allpolls.jsx (RD_AP_PRIM :137, rdApLeanDot :73) and template.html :54-57/:166-169.
source: auto-skill
extracted_at: '2026-10-03T02:26:58.670Z'
---

# All-polls party dots and their halo

## Anatomy — one shared dot, three facets

`.rd-ap-dot` (`.build/newtracker/assets/rd.css` ~:2063): a 10px circle,
absolutely positioned on the row's scale strip by `left: <pct>%`,
`transition: left .32s var(--morph-ease), background-color .32s ease`
(neutered under `prefers-reduced-motion` in the shared media block).
Call sites, all in `.build/newtracker/assets/rd-allpolls.jsx`:

- **primary facet** (~:1547, `rowFor`): one dot per party from
  `RD_AP_PRIM` (~:137 — `{ id, lab, ink, dot }`, dot = `var(--alp)` /
  `--lnp` / `--grn` / `--onp` / `--oth`), painted sorted DESCENDING by
  value so smaller-share parties sit on top.
- **two-party facet**: the lean dot inside `RdApStrip` (~:180), colour
  from `rdApLeanDot(lean, onM)` (~:73) — `--alp` leaning Labor,
  `--lnp`/`--onp` leaning the rival, `--ink-3` when |lean| < 0.05.
- **leadership facet** (~:1580): net-rating dots,
  `albNet`/`taylorNet`/`hansonNet` → `--alp`/`--lnp`/`--onp`.

Party palette vars are defined in `template.html` ~:54-57 (light) and
~:166-169 (dark) — Labor red `oklch(0.55 0.150 27)`, Coalition blue,
Greens green, One Nation orange; the dots reference them only via the
`--*` vars, never literals.

## The halo is a box-shadow, not a border

`box-shadow: 0 0 0 1.5px var(--rd-rowbg)`. `--rd-rowbg` is `var(--bg)`
by default (rd.css ~:1852) and switches to `--surface-2` on
`.rd-ap-row:hover`/`.open` (~:2019), so the "outline" is **invisible
against the row** and always matches a hovered/open row's tint —
white-ish ring in light mode, dark ring in dark mode. It exists for
exactly one moment: **dot–dot collision** (ALP and LNP sit in the
low-mid 30s, so their primary dots overlap routinely). It is the
standard white-halo separation technique for dense dot maps.

**Design ruling 2026-10-03 (user asked, kept, part of 055e117):** the
halo STAYS. The user's worry — "you can see the outline when the dots
overlap" — is backwards: collision is the only time it's visible, and
that's when it's earning its keep; naked dots would merge into a two-col
our blob with no seam and no readable stacking. Middle option noted but
not taken: 1.5px → 1px.

## The rings went the OTHER way — don't confuse the rulings

The primary facet's month-average `.rd-ap-ring` elements (desktop mrow
only) DROPped their `background: var(--bg)` fill in 055e117 so
overlapping rings cross Venn-style — their strip contains only rings,
so the fill's entire effect was fixed `RD_AP_PRIM` paint order erasing
earlier rings at level averages. Dots share their strip with other
marks and collide routinely; rings shared theirs with nothing. Full
reasoning, paint order and probe in `auspol-allpolls-month-rows`.

Probe model for either marker (uncommitted-scratch
`.matilda/probe-ap-ring-intersect.mjs`, puppeteer-core + file:// build):
computed-style assertion (`getComputedStyle(el).backgroundColor` /
box-shadow / borderColor on the rendered elements) plus geometry-
intersection check via `getBoundingClientRect()` centre gaps vs marker
diameter. Screenshots are useless to the reviewing model — assert, don't
look (see `auspol-headless-geometry-verify`).
