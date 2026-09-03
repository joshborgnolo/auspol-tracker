---
name: auspol-tile-band
description: auspol-tracker — the decorative "seismograph tide" band closing the page (.tile-band; current art is 30 stacked wave traces, shipped b6a6443, REPLACING the 07523d4→4ac45e1 fractal rhombille cubes; canvas twin on html shipped 41bc58c, now a THREE-layer composite with --tide-fade/--tide-ground): lives in template.html CSS + a body-level div after </noscript>, NOT in any asset; strip painted TWICE coincident (html canvas for rubber-band overscroll + in-flow band), SVG art in --tile-art (light) / --tile-art-dark (dark is a REDRAWN palette, no multiply-dim anywhere since the ground scheme shipped); cover-fit (center bottom / auto 400px repeat-x) so NO fixed tile size, row snapping, ::after layer, or masks; PLUS the boot-order lesson (73fb846): body.js must be added only by App's first-commit layout effect — set earlier it collapses the document and splash-paints the canvas tide art across the viewport on refresh; headless-Chrome pixel + rAF-cadence verification and the giant-line edit/probe gotchas
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
  the final `</style>`): a descriptive comment, an **`html` rule** (declares
  the `--tile-art` ~43KB data-URI line + `--tide-fade` + the three-layer
  canvas composite — see "Canvas twin" below), `html:has(body.dark)` (dark
  ground/fade colours + `--tile-art-dark` swap), `.tile-band` (in-flow copy
  of the same strip), `.tile-band::before` melt gradient,
  `body.dark .tile-band { background-image: var(--tile-art-dark) }`, phone
  media query (overrides BOTH html's middle-layer and the band's
  `background-size: auto 320px`).
- One element in `<body>` **after `</noscript>`**:
  `<div class="tile-band" aria-hidden="true"></div>`. Body-level placement is
  deliberate; do NOT wrap it in a max-width container. Keep `aria-hidden`.

## Canvas twin (shipped 41bc58c, ground scheme + dark redraw later)

The strip is painted TWICE, coincident to the pixel: once in-flow on
`.tile-band`, once on `html` — the canvas is the only surface a phone's
rubber-band overscroll can reveal, so dragging past the page end keeps
tracing instead of opening blank paper. **On the canvas the strip repeats
on BOTH axes** — `background-repeat: repeat` (a one-way repeat does not
exist) — and body's opaque box is what hides it above the page end. Any
state that shortens body below the viewport exposes tiled tide art across
the screen; that is exactly what the boot-order bug below did.

The current `html` rule is a THREE-layer composite over
`background-color: var(--tide-ground)` (with a .35s background-color
transition):

- layer 1: `linear-gradient(--tide-fade,--tide-fade)` at
  `left top -3000px, 100% 3000px, no-repeat` — a plain ground block sitting
  entirely ABOVE the document, capping the upward run that the both-axes
  repeat would otherwise paint into the pull-down gutter over the masthead
- layer 2: `var(--tile-art)` at `center bottom, auto 400px, repeat` — the
  tide itself
- layer 3: `linear-gradient(to bottom, --tide-fade, --tide-ground)` at
  `left bottom -180px, 100% 180px, no-repeat` — a 180px wash melting the
  strip out into the ground below the document end

Colours come from two custom properties, `--tide-fade` (defaults to
`var(--bg)`) and `--tide-ground`, re-declared for dark by
`html:has(body.dark)` in the SAME rule that swaps middle layer to
`var(--tile-art-dark)`. Dark art is a REDRAWN palette (same 30 paths,
strokes remapped to sit light on ink) — no `background-image:none` drop
and no multiply blend on the canvas; the old "canvas drops the strip in
dark" scheme was replaced. Theme --bg no longer needs an html:has mirror —
only edits to the tide ground/fade pair are two-homes (base html rule +
html:has(body.dark) override).

- Harmony proof: html strip + band strip share the identical tile, size
  (`auto 400px`/`auto 320px` under 640px), and `center bottom` anchoring —
  verified 0.000% pixel diff on-page at two widths with the canvas art
  toggled off. Any size change must edit the html middle-layer size AND
  .tile-band AND the media query override.

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
  transparent)` stops easing the band out of the page at the crest fade,
  reaching `transparent 76%` and STAYING there — the old tail fade (back to
  `var(--bg) 92%`) was removed in 41bc58c so the tide runs inky to the
  page's last pixel. Wave arcs tolerate any edge, so no terminal fade is
  needed; only the crest fade matters. `z-index:2` is vestigial (no
  competing ::after) — harmless, keep it.
- Dark mode (`body.dark`, CLASS-based): `body.dark .tile-band {
  background-image: var(--tile-art-dark) }` — a redrawn-palette SVG, the
  same 30 paths with strokes remapped light-on-ink. The multiply-dim
  scheme (`background-color:#6f6f6f; background-blend-mode:multiply`, an
  opaque plate reading as a lit slab) was REPLACED when the tide ground
  scheme shipped; there is no multiply anywhere now. Regenerate dark art
  with the same generator, remapped stroke palette only.
- Heights: **400px** desktop / **320px** under 640px. Gap-to-footer is
  controlled solely by `margin-top`: 80px/56px originally, pulled down
  over time through **32px/24px** (c67a5fe) to the current **12px/8px** —
  a "move the band up/down" request = edit margin-top only, in BOTH the
  base rule and the media query.
  The media query must ALSO override `background-size: auto 320px` on BOTH
  html (middle layer; the three-layer rule lists all three sizes — edit
  the tide layer, leave the 3000px cap and 180px melt alone) and
  .tile-band — a px-valued background-size does not rescale with a height
  change, so shrinking without it would silently crop the art (and
  silently desync the canvas twin).

## Boot order: body.js is the "app has mounted" flag (fixed 73fb846)

Symptom shipped to users: on REFRESH, the tide art briefly painted across
the whole screen ("the line art all over the page for a moment"). Cause
was nothing in the tile band itself, it is any frame where the document
collapses shorter than the viewport (the both-axes canvas art is normally
masked by body's opaque box — see Canvas twin). The collapse chain was:

1. the boot script in asset 73de0c58 set `document.body.classList.add(
   "js")` synchronously BEFORE `ReactDOM.createRoot(el).render(<App />)`;
2. `body.js .static-summary { opacity: 0 }` + `body.js #root { margin-top:
   calc(-1*var(--ss-h)) }` then applied while #root was still empty —
   render() commits asynchronously, so real frames existed with the static
   article transparent, #root childless and pulled up over it;
3. the document collapsed to the tile band alone (measured 5714→2290px,
   band top=12 of a blank viewport) and Chrome scroll RESTORATION could
   land mid-page inside that window — exposing the tiled canvas art where
   body no longer reached.

Fix pattern (73fb846, asset + rebuilt index.html): `React.useLayoutEffect(
() => { document.body.classList.add("js"); }, []);` as the FIRST statement
inside `function App()` — the class lands in the same commit as the first
tree, no intermediate frame. Frames before it are just the no-JS page, for
which the static summary was built. Rule: nothing before the first React
commit may touch state that collapses or hides the static article.

Verifier: `.matilda/verify-tide-flash/probe.mjs` — serves HEAD's
index.html (`MODE=before`, control) or the working tree; installs a
requestAnimationFrame chain via `evaluateOnNewDocument` and samples
`{js, kids: #root.childElementCount, docH, bandTop}` per painted frame;
asserts **never `body.js` set with an empty #root**. Control reproduces
one collapsed frame per run (js=true kids=0 docH=2290 bandTop=12); fixed
tree is clean. `collapse-check.mjs` proves the geometry (empty #root under
body.js → scrollHeight 2290), `measure.mjs` records static heights. Probe
gotchas: `document.documentElement` is NULL at document-start when
evaluateOnNewDocument fires — guard every DOM read in the chain and
re-schedule the rAF in all cases, a thrown tick silently stops sampling
and you read "0 frames".

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
  harness under `.build/`, delete after): puppeteer-core from
  `~/node_modules` + system Chrome (render-card.mjs convention; Playwright
  is NOT installed here), full built `index.html`, scroll to
  `document.body.scrollHeight`, viewport screenshot, then PIL diff each row
  band against the bg colour. Expected: traces ~35–85% depth AND ink right
  down to the final rows (~10–16% coverage at 96–100% depth since 41bc58c;
  the pre-41bc58c profile was zero ink ≥93%). Canvas-twin checks:
  `getComputedStyle(documentElement)` shows the three-layer
  `background-image` (cap gradient + svg tile + melt gradient; dark swaps
  the svg layer to the --tile-art-dark build — never
  `background-image:none`), html's middle-layer `.backgroundSize` (parse
  the comma list) tracks the band's at both widths, and a screenshot diff
  of the band region with `documentElement.style.backgroundImage='none'`
  toggled MUST be ~0% on-page (proves html/band coincidence, no ghosting).
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
