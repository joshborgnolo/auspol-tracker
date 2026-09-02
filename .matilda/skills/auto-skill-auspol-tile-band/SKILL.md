---
name: auspol-tile-band
description: auspol-tracker — the decorative "seismograph tide" band closing the page (.tile-band; current art is 30 stacked wave traces, shipped b6a6443, REPLACING the 07523d4→4ac45e1 fractal rhombille cubes): lives in template.html CSS + a body-level div after </noscript>, NOT in any asset; SVG art lives in a --tile-art custom property; background is cover-fit (center bottom / auto 400px repeat-x) so NO fixed tile size, row snapping, ::after layer, or masks are needed; dark-mode multiply-dim convention, headless-Chrome+Playwright pixel verification, and the giant-line edit/probe gotchas
source: auto-skill
extracted_at: '2026-09-03T00:00:00.000Z'
---

# Tile band (page-bottom wave tide)

The site closes with a full-bleed band of stacked wave traces under the last
text — like seismograph or plotter trendlines: calm ripples up high, wilder
swell at depth, every fifth trace tinted. It is **entirely in
`.build/newtracker/template.html`** — no asset JS, no React, no fetched
files. Rebuild (`node .build/newtracker/build.mjs`) after editing.

## Structure

- CSS block at the very end of the template's main stylesheet (just before
  the final `</style>`): a descriptive comment, `.tile-band` (declares the
  `--tile-art` custom property ~43KB data-URI line), `.tile-band::before`
  melt gradient, `body.dark .tile-band` dim, phone media query.
- One element in `<body>` **after `</noscript>`**:
  `<div class="tile-band" aria-hidden="true"></div>`. Body-level placement is
  deliberate; do NOT wrap it in a max-width container. Keep `aria-hidden`.

## How the tide works (b6a6443)

- One inline SVG data-URI in `--tile-art`, 1200×480, generated in PYTHON and
  spliced in by regex (the generator lives in /tmp, not the repo — regenerate
  from the formula below; splice pattern
  `r'--tile-art: url\("data:image/svg\+xml,.*?"\);'` with assert of exactly
  1 match):
  - 30 horizontal polylines, `y0 = 16 + 15.4·i`
  - deflection `A = 2.2 + 0.6·i` (amplitude grows with depth — that's the
    calm-to-wild gradient)
  - each trace = three sinusoids (n=2 w=0.54, n=3 w=0.30, n=5 w=0.16),
    phases seeded `k·i·2.399963 mod 2π` (golden ratio — decorrelates rows)
  - points every 12px; base stroke `#66779b`; every 5th line (i%5==4) tinted,
    cycling `%23d99a8e` red / `%238ba6d6` blue / `%2393bf9b` green /
    `%23e0a878` orange (washed party colours)
  - group attrs: `fill='none' stroke-width='1.6' stroke-linecap='round'`
- Sizing: `background: var(--tile-art) center bottom / auto 400px repeat-x`.
  `auto <height>` cover-fits the art to the band height and tiles
  horizontally — **there is no fixed tile size, so none of the fractal era's
  lattice arithmetic applies**: no whole-row height snapping, no ::after
  ⅓-scale repaint layer, no hexagon mask, no SVG-internal `<use>`/clipPath
  recursion. All of that was deleted in b6a6443; if reintroducing cubes, see
  git history (07523d4 → c13853a → 4ac45e1).
- `.tile-band::before` (`content:""`, `position:absolute`, `inset:0`,
  `z-index:2`) overlays the eased melt: `color-mix(in oklch, var(--bg) N%,
  transparent)` stops easing the band out of and back into the page. Tail
  lands at **`var(--bg) 92%`** — the veil completes before the bottom edge so
  the deepest arcs don't get a hard cut but also can't print un-veiled ink
  into the footer. Wave arcs tolerate any edge, so the "snap fade to lattice
  rows" rule from the cube era no longer applies; only the crest fade
  matters. `z-index:2` is vestigial now (no competing ::after) — harmless,
  keep it.
- Dark mode (`body.dark`, CLASS-based): the single surviving rule
  `body.dark .tile-band { background-color:#6f6f6f; background-blend-mode:
  multiply }`. The `body.dark .tile-band::after` twin was deleted with
  ::after. Never recolour the SVG per theme; multiply-dim is the convention.
- Heights: **400px** desktop / **320px** under 640px (margin-top 80px/56px).
  The media query must ALSO override `background-size: auto 320px` — a
  px-valued background-size does not rescale with a height change, so
  shrinking the band without it would silently crop the art.

## URL-encoding & verification

- Data-URI SVG inside a double-quoted CSS `url("…")`: single quotes for
  attributes, encode `<`→`%3C`, `>`→`%3E`, `#`→`%23`. The build pipeline URL-
  encodes further (literal spaces become `%20` etc.), so in BUILT index.html
  grep `%3Cpath` / `%23d99a8e`, never `<path` / `#d99a8e`. Probe needles:
  `--tile-art`, `auto 400px repeat-x`, `auto 320px`, `%23d99a8e`.
- The ~43KB `--tile-art` line makes read_file/edit previews dump 43KB and
  persisted-output files — work by `grep -n` anchors and small `awk`/`sed -n
  'N,Mp'` windows instead of reading ranges that contain the line.
- Visual check (BOGAN mode blocks writes outside the workspace — put the
  harness under `.build/`, delete after): extract the tile-band CSS slice
  into a standalone page with a redefined `:root{--bg}` (light #f6f6f2 /
  dark #1a1612), a 220px spacer and a bare `<div class="tile-band">`;
  Playwright chromium at dpr=1, `locator('.tile-band').screenshot()` after
  `scroll_into_view_if_needed()` (a clip screenshot at un-scrolled page y
  captures blank viewport), then PIL `row_profile` diffing each row band
  against the bg colour. Expected: traces appear ~35–85% depth, random
  teleporting crests near 87–92%, zero ink ≥93%, and dark mode shows the
  multiplied traces.
- Mobile check: same page at viewport 375×660; expect 320px band and correct
  scaled traces (no crop) — then ALSO toggle a visibly-wrong tint on the
  media-override value and re-screenshot to prove the override actually
  loads (the screenshot only proves a render, not which rule won).

## Editing safely

template.html is one file — two `edit` calls to it in ONE assistant turn
race and the second is silently dropped (see same-file-edit-sequencing): one
edit → tool returns → next edit. Shared repo: `git fetch origin main` +
`git rev-parse HEAD origin/main` before staging; sibling sessions leave dirt
in `.matilda/*` — stage ONLY `.build/newtracker/template.html` + `index.html`
for tile-band commits, and keep skill updates in their own commit.
