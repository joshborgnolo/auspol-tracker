---
name: auspol-copy-chart-image
description: auspol-tracker — copy-as-PLAN internals in .build/newtracker/assets/copy-chart.js (PLAIN script, canvas 1200px card): bakeSvg serialises the live svg at forced COPY_W=1120; widenForCopy parks the LIVE chart at left:-99999px during the wide re-layout (~1s on phones) and a fixed stand-in clone on document.body (3bb8bf7) covers the slot for exactly that window; the park ALSO needs every in-flow sibling of the host frozen at its measured rect (d3162c0) or phone users see the hero legend/caption slide up through the stand-in's transparent svg gaps (host.parentElement is the whole section.card.hero — .hero-foot is an in-flow sibling below .chart); the copied legend is REBUILT from DOM (chips sit outside the card) by cycleLegend() mapping .end-label text → {label, kind: line|dashed|band|square|dot|cycband, fill, alpha, year} sorted by year (overlays 9999, band 9998); ON[' ]+\d{2} → One Nation dashed, else colour-matched AUSPOL.LEADERS → "{name}, from {firstYear}"; inkVar() resolves CSS vars via probe span; painter swatch 18px at (lx,my), SW_W=26, LEG_GAP=26; the cycband entry (ed55a03) re-derives past-terms band membership from non-off non-current .cyc-chip minus end-labelled years, label mirrors live .cyc-band-note copy, swatch = stacked lo/hi roundRects in --cyc-fill with opacities read live via getComputedStyle (fallbacks 0.09/0.17) + dashed mean; the copied TITLE span (f8843f0) for past cycles walks deduped .cyc-chip runs → first-election→next-boundary ranges, current run ends "present", "," separator vs " · " fallbacks (legend years → x-axis labels) via abRange() century-compression; source holds LITERAL 2013/00b7 escapes — edit old_string must match them, not the rendered –/·; third phone-copy glitch (7d1b166): the clone is a FRESH .chart element so the no-preference chart-in opacity fade replays on insert (flash incl. evt-labels, same svg) — stand carries .copy-stand class + an unconditional template.html rule killing animation/transition inside it, placed AFTER chart-in in source order.
source: auto-skill
extracted_at: '2026-09-03T07:10:44.067Z'
---

# Copy-as-image internals (auspol-tracker, copy-chart.js)

**Sibling feature**: the expanded poll-detail breakdown has its own copy
control in `copy-poll.js` (shipped 4d1e883, 2026-09-04) — same card chrome
but painted glyph-by-glyph from Range rects with a synchronous
widen/measure/restore (NO stand-in clone needed). See
`auspol-copy-poll-image` before touching either one's shared chrome.

The "copy" button on chart cards renders a share-ready PNG entirely
client-side. All machinery lives in `.build/newtracker/assets/copy-chart.js`
— a **PLAIN-list script** (not babel-compiled, not hashed), inlined into
`index.html` by `build.mjs`. Edit → rebuild → verify in the BUILT page
(grep the built `index.html` for your marker; syntax-check the plain script
with `new Function(src)` since nothing else parses it pre-ship). Rendering
is WebKit-sensitive — see the verification guidance in the
auspol-build-pipeline skill (29499c2 lesson: no viewBox on the capture svg).

## Composer flow

- A 1200px card is composed on `<canvas>`; `bakeSvg` serialises the live
  chart svg with computed styles baked on, forced to width `COPY_W = 1120`.
- `inkVar(name)` resolves a CSS custom property to an `rgb()` string by
  probing a temporary span — canvas can only draw concrete colours, never
  `var(...)`; always resolve theme-aware tokens (party colours, `--cyc-fill`)
  through it.

## The copied legend is REBUILT from DOM, not copied

Live legend chips sit OUTSIDE the chart card, so the PNG legend is
synthesised. Past-cycles variant = `cycleLegend()` inside
`composeCardInner`:

- Entries are `{label, kind, fill, alpha, year}`, kinds
  `line|dashed|band|square|dot|cycband`, sorted by `year`; overlays park at
  9999, the past-terms band at 9998 (keeps band just left of overlays).
- Labels come from `.end-label` SVG **text nodes**:
  - `"{2-digit year} {lead}"` → cycle line entries (`line`),
  - `^ON[' ]+\d{2}$` → `"One Nation"` (`dashed`),
  - otherwise colour-matched against `AUSPOL.LEADERS` →
    `"{name}, from {firstYear}"` (`dashed`).
- Painter: a canvas `switch` on `it.kind`; swatch drawn at `(lx, my)`, 18px
  wide, inside `SW_W=26` advance with `LEG_GAP=26` inter-item gap. New swatch
  kinds = one new `else if` branch before `"band"`.

## The `cycband` entry (shipped ed55a03, 2026-09-03)

The purple past-terms band previously rendered in the PNG unattributed —
its only live attribution is the `.cyc-band-note` key under the chips,
outside the SVG. Pattern for the fix (reusable for any future
"SVG draws something whose legend lives elsewhere"):

- Append the entry ONLY when the svg actually draws the feature:
  `if (svgEl.querySelector(".cyc-band")) { ... }` — the band only exists
  with ≥3 past terms selected (cycBanded gate, see auspol-past-cycles).
- **Member terms** = `.cyc-chip` elements that are neither `.off` nor
  `.current` (read year from the chip's `.cyc-year` child), MINUS years
  already individually named by end labels (avoid double-attribution:
  named cycles keep their own line entry).
- Label mirrors the live key wording:
  `"Past terms (YYYY, YYYY…): mean of the set, middle half and middle 80%"`.
- Swatch echoes the live 3-part key: stacked lo/hi `roundRect` fills in
  `inkVar("--cyc-fill")` (both themes correct via one token) whose alphas
  are read LIVE from `.cyc-band.lo` / `.cyc-band.hi` computed opacity
  (`parseFloat(getComputedStyle(el).opacity)`, fallbacks 0.09 / 0.17), plus
  a dashed mean stroke in `--ink-2` (`setLineDash([2, 2.7])`).

## widenForCopy: the off-screen park + frozen stand-in (phone vanish fix, 3bb8bf7)

`widenForCopy(svg)` re-lays the chart out wide by mutating the LIVE hosts:
`.chart` host is parked inside a height-pinned, `overflow:hidden`,
`position:relative` ancestor with `position:absolute; left:-99999px;
width:COPY_W px` (chart re-lays via its ResizeObserver in charts.jsx), then
the closure awaits `.evt-label` (up to 30×16ms) before restore returns the
saved inline styles (`removeAttribute`/`setAttribute` pattern).

- **Desktop is invisible**: the park commits instantly, or the function
  early-returns when `host.width >= COPY_W - 1`. On a phone the wide
  re-layout + compose holds the park for ~1s → the chart visibly VANISHES.
- **Fix pattern**: while parked, pin a frozen clone of the host over the
  slot — `host.cloneNode(true)`, `position:fixed` on `document.body`
  (viewport coords from `host.getBoundingClientRect()` taken BEFORE
  mutating), `pointer-events:none`, `aria-hidden:"true"`, zero margin.
  Remove the stand FIRST inside the restore closure, in the same
  synchronous block as the style restores → one paint, never stacked.
- **The stand must NOT go inside the card** (my first attempt, `absolute`
  in the anchor): the composer's live-document readers
  (`readLegend` on `.ro-party`/`.hl-item`, title queries scoped to the
  card `target`) would match the clone's nodes a second time and draw
  every legend row twice. `<body>`-mounted is outside every `target`
  query scope, and the cloned copy-button is inert (no listener,
  aria-hidden). Also note the clone-of-slots id duplicates (svg defs
  ids) are harmless — both copies resolve identically.
- **Phone probe lesson**: to verify a `pointer-events:none` overlay with
  headless Chrome, `elementFromPoint` PASSES THROUGH it by design → a
  hit-test probe shows `background` during the parked window even when
  the stand is correctly covering (false failure); earlier loose string
  matching gave a false positive the other way. Verify via DOM + geometry
  instead: `querySelectorAll("body > [aria-hidden='true']")` with computed
  `position:fixed`, then rect-contains on the slot centre. Working probe:
  `.matilda/probe/phone-copy-standin.mjs` — serves repo root over local
  http, `puppeteer-core` from `$HOME/node_modules` (run with
  `NODE_PATH="$HOME/node_modules"`), `executablePath` to real Chrome,
  viewport 390×844 mobile dpr=3, samples every 32ms after clicking
  `.hero .chart .chart-copy-btn`; PASS = every parked frame covered.
- **Negative-control the probe** (added for the sibling freeze): the
  probe's page URL honours `INDEX_HTML=/path/to.html` — run it against
  `git show <pre-fix-sha>:index.html > /tmp/old.html` and REQUIRE the
  probe to FAIL on the old build (here: old 3bb8bf7 build drifted
  `.hero-foot` 256.60px during the park; fixed build 0.00px). A probe
  that passes on both tested nothing.

## Sibling freeze (d3162c0, 2026-09-03): the stand covers the slot, but the REFLOW still moves things

Follow-up bug to the stand-in: the frozen clone covered the chart slot,
yet phone users saw "text beneath the chart move on top of it" during
the park. Root cause is containment, not z-order: in the hero the chart
host's parent (the `anchor`) IS `section.card.hero`, so `.hero-foot`
(the hero legend + "Each dot is one published poll…" caption) is an
IN-FLOW SIBLING below the host. Parking the host removes it from flow,
so the sibling slides up to the host's old top — and since the stand's
svg has no background fill, the slid-up text shows THROUGH the stand's
transparent areas. The anchor height-pin only holds the outer box;
nothing inside it is anchored. (Laptop never shows this: desktop early-
returns or finishes before layout settles.)

Fix pattern in `widenForCopy`, all measured BEFORE any mutation:

- For every element child of `anchor` except the host, if computed
  `position` is `static|relative|sticky` (in-flow) and its rect is
  non-zero, snapshot `{el, savedStyleAttr, left, top, width, height}`.
- Offsets are relative to the anchor's PADDING box:
  `left = childRect.left - anchorRect.left - borderLeftWidth` (`.card`
  has a 1px border — subtract both border sides; `box-sizing: border-box`
  is sitewide so px w/h pin the border box exactly).
- Then set `position:absolute; margin:0; left/top/width/height px` on
  each (margins zeroed: the measured border-box rect already bakes them;
  gap space stays empty inside the height-pinned anchor).
- Restore each element's saved `style` attribute (null →
  `removeAttribute`) inside the SAME synchronous restore closure as the
  stand removal → one paint, screen never shows an intermediate state.
- Elements already absolute/fixed are out of flow — skip them, they
  can't reflow. Text nodes can't reflow their box either — children
  iteration covers elements only.
- Trust the DOM, not paint-order reasoning: all actors sit in z-auto
  stacking, so DOM order decides who paints over whom; the
  `<body>`-appended fixed stand wins against in-flow text, but that
  never saved us because the failure was geometry (text moved beside/
  around the stand's box), not z-fighting.

Generalises beyond the hero: any copy target whose `.chart` shares its
containing block with other content (cycle cards = title/source div +
.chart + legend) parks the same way — freeze ALL in-flow children of
whatever `host.parentElement` happens to be, not a hardcoded selector.

## Gotchas

- The composer reads the LIVE DOM (`document.querySelectorAll(".cyc-chip")`),
  not the card clone — chip state (off/current) at click time is what lands
  in the PNG.
- After shipping, standard verify: rebuilt + committed `index.html` in the
  SAME commit, push, then curl `raw.githubusercontent.com/.../index.html |
  grep -c <marker>` after a ~45s CDN lag (see auspol-live-site-verify).
- **Rebuild side-effect watch**: any rebuild can roll
  `assets/cycle-source.<hash>.json` if sibling-session gen-data WIP sits in
  the tree — check `git status --short -- assets/` before committing and
  ship the sidecar rename with `index.html` (see auspol-build-pipeline).
