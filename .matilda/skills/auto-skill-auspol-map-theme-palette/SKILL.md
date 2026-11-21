---
name: auspol-map-theme-palette
description: When a /map/ colour needs changing — the party palette (T.party), the seat-type ladder (T.cls), or any map.css rule. All palettes live in readTheme() in .build/map/app/app-1-base.js with the lch() OKLab helper beside them; map.css is GENERATED from .build/map/app/page.css by assemble.mjs, never edit map/map.css directly. Worked 2026-11-06 (outback seat-type ramp 609a9f1d→e360f1e6, black stat-head chrome 6b948014 — dash saga: --ink → --ink-2 2e52f844 → Plex 300 5e458ffe → Plex 300 squeezed 72% 33f7c4ae, Seats share line 94fff034 reshaped inline on the Seats label f83d0022 + tense split won/has af171168; the day's sitewide palette adoption 4bd2f713 was REVERTED 2de47b44 — the bright palette is map-only again).
source: auto-skill
extracted_at: '2026-11-06T00:06:25.986Z'
---

# /map/ theme palette + map.css anatomy and edit loop

## Where map colours live (one home)

`.build/map/app/app-1-base.js`, `readTheme()` (~:86-115):

- `T.party` — the party hexes (`201cb659`, poster-flat: alp #f7310a, lnp
  #014dff in BOTH themes; grn/onp/ind/oth/csa split per theme via
  `dk ? {...} : {...}`). Every map/chamber/booth fill and the coloured
  stat-head figures (`tone(f)` in app-4-story.js) read these.
- `T.cls` — the four-stop seat-type ladder, ARRAY ORDER = the `CLS` const
  (same file, ~:197): `["Inner Metropolitan","Outer Metropolitan",
  "Provincial","Rural"]`. Read by `colorOf` case `"cls"`
  (app-2-map.js `TH.cls[CLS.indexOf(v)]`) and by the clsVoteBlock table
  chips (`css(TH.cls[…])`). Since `e360f1e6` (2026-11-06, user call after
  the light theme shipped inverted once) the ladder is ONE array for both
  themes: [lch(0.88,0.030,78), lch(0.70,0.048,62), lch(0.53,0.060,48),
  lch(0.38,0.075,38)] — cream metro out to outback red earth. The map's
  first version ran dark/light forks; the fork is GONE by user preference.
- Chromatic vocabulary: chroma ~0.028–0.045 = the map's muted inks/tans;
  ≥0.12 is vivid. The bg/surface/line triples sit at ~0.01 chroma, hue 65-85.

## The lch() helper is the site's OKLab reference

`app-1-base.js:60-72` carries `lin2s/s2lin/lab2lin/lab2rgb/rgb2lab/lch`
(OKLab-based, browser-free). `lch(L,C,H)` converts to display sRGB with
iterative gamut trim (chroma ×0.93 loop). Deriving "which hex will this
lch render" (or inverse) = a node one-liner pasting these five functions —
used 2026-11-06 to price candidate ramp stops before shipping (#e3d6c2
cream … #643324 red earth). L,C,H here = OKLCH coordinates, same numbers
you'd write in CSS `oklch()` — interchangeable, verified against the party
tokens in template.html (party-colour-tokens skill).

## map.css is GENERATED — edit app/page.css

`map/map.css` is assembled by `.build/map/assemble.mjs` from sources in
`.build/map/app/` (page.css + flips). Rule: never edit `map/map.css`;
edit `.build/map/app/page.css` then assemble. The Winner stat-head chrome
lives there ~:293-305: `.st-stat` (base `--ink-2`), `.st-lab` (labels),
`.st-stat i` (en-dash separators), `.st-swing`, `.st-grid small` (seat
deltas) — moved to `var(--ink)` 2026-11-06 (6b948014) after the user
called the greys; SAME day the en dashes alone were walked back to
`--ink-2` (2e52f844: full ink read too heavy, the pale grey it wore
before too light), then RE-FONTED to `font-family: var(--sans)`
(= IBM Plex Sans, the page's family, loaded 300-700) at weight 300 the
same evening (5e458ffe: Commissioner's geometric dash at 500 read too
chunky against the 700 figures), then the SAME night SQUEEZED to 72%
width (33f7c4ae: Plex's 300 dash in full width read as "looks like em
dashes now... too long" — the character is a true en dash U+2013; the
settled answer is the SLIM plex stroke with a horizontal squeeze, not a
thinner cut, not a longer glyph):
`.st-stat i { ...; display: inline-block; transform: scaleX(0.72); }`
(the inline-block is needed or the transform does nothing on the inline
mark). Taste lesson: the user wants dash chrome SUBTLE — mind weight,
stroke length AND tone together. The equally-named classes exist only
in app-4-story.js's seatStat — safe to restyle centrally.

The stat head also carries a seats-share reading on the Seats label —
election frames `Seats (Labor won 62.7% of 150)`, as-it-stands frames
`Seats (Labor has 62.7% of 150)`: seatStat interpolates
`` ` (${gov === "alp" ? "Labor" : coalW()} ${isNowY(m.year) ? "has" : "won"} ${f1((100*gN)/N)}% of ${N})` ``
straight into the `.st-lab` span (`shareTxt`, f83d0022; tense split by
frame af171168 — "won" what an election delivered, "has" what a now
frame holds, keyed on `isNowY(m.year)`). Shipped first as
a standalone `.st-share` row under the grid ("of the N seats", 94fff034);
the SAME day the user walked it back — "after Seats" meant after the word
itself, trimmed of "the… seats" — so the class and its `.st-share +
.st-lab` adjacency margin rule are GONE (page.css carries neither now);
adding a NEW stat-head row class still needs the same adjacency check on
the `.st-swing + .st-lab …` 22px rhythm selector. The h3's aria-label
comes from areaHedDek's hed+dek, NOT seatStat — a line added only in the
seatStat markup is invisible to screen readers unless the caller's label
gains it too. gov comes from `m.gov`, the count from areaStats' `cnt`.

## The stage's feint outline (0fc29849, 2026-11-12)

"Feint black outline around the map box (the map itself)" = the page
palette's own faint-ink token, not a hardcoded grey:
`.mp-stage { border: 1px solid var(--ink-faint); border-radius: 3px; }`
in page.css (~:96). `--ink-faint` is defined in map/index.html's inline
`<style>` with its dark-mode pair (oklch 0.70 light / 0.545 dark, the
lightest ink of the page's ladder) so the rule adapts across themes —
do not hardcode a hex. The canvas is `position:absolute; inset:0`
INSIDE the bordered stage, so the border wraps the canvas exactly at a
cost of +2px to the box; the fullscreen arm (`.fs .mp-stage`, ~:872)
zeroes the radius but the border rides on.

## Edit → verify loop

1. Edit the source (`app-1-base.js` / `page.css` / others).
2. `node .build/map/assemble.mjs` — regenerates `map/map.js`,
   `map/map.css`, re-stamps `map/index.html`.
3. If main-site tokens or shell assets moved in the same change:
   `node .build/site-shell.mjs` AFTER assembling — applyShell rewrites the
   `?v=` cache hashes inside `map/index.html` (site-shell.css/js hashes
   change with any token edit), and `test-map-page` expects THAT state.
   A token-only session saw `map/index.html` dirty for this reason alone.
4. `node .build/test-map-page.mjs > /tmp/x.log 2>&1; echo exit=$?` —
   ALWAYS to a file (piping kills the suite by SIGPIPE mid-run; see
   auspol-map-data-commit-order for the trap list).
5. Commit sources together with `map/map.js`, `map/map.css`,
   `map/index.html` (the stamps pin asserts byte-equality).
