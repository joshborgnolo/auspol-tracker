---
name: auspol-map-lens-style-generalise
description: "auspol-tracker /map/ — when a story-column style scoped behind #story[data-lens=\"winner\"] should apply to every lens (user: 'views other than winner … use winner as a model'). Generalise into the base rule in .build/map/app/page.css, delete the now-redundant winner-scoped copies, then check the THREE specificity traps before rebuilding: the retro chrome leak (html.mp-retro is element+class — a #story ID rule beats it; retro.css blocks touching the same property need explicit !important clearance), the polling-place booth override pairing, and the senate story whose head ends on a bare .st-dek (no closing rule behind it — the .st-dek + .st-sec junction suppression must NOT generalise onto it). Worked 2026-11-09, commit c3329161 (double junction rules went lens-wide)."
source: auto-skill
extracted_at: '2026-11-09T06:42:33.418Z'
---

# /map/: generalising a lens-scoped story style — recipe and traps

`#story`'s `data-lens` hook (see auspol-map-story-lens-font) lets CSS gate
story styling on the current lens. Winner accumulated a family of scoped
rules; the idiom came to a close 2026-11-09 when the user asked for the
winner separators in every view. The generalisation recipe (c3329161):

## Recipe

1. Sources live in `.build/map/app/page.css` (+ `retro.css` for the retro
   chrome). Nothing is edited in `map/` directly.
2. Move each winner-scoped stylistic rule into the shared base where the
   property is harmless lens-wide (`.st-sec`, the `.st-inf` twin rule and
   `.st-foot`'s closing rule all became `border-top: 4px double` bases),
   or widen the selector `#story[data-lens="winner"] X` → `#story X` when
   adjacency/sibling context needs `#story` (the informal pair
   `.st-inf` + `.st-foot` margin rule).
3. DELETE the winner-scoped originals the base now covers — redundant
   copies left behind read as intentional deviations later. Adjacency
   suppressors that only ever fired under winner (`… .st-stat + .st-sec`)
   widen with the family. Genuinely dead rules (the winner-scoped
   `.st-dek + .st-sec`, dormant because `.st-dek` is senate-only) drop.
4. Rebuild: `node .build/map/assemble.mjs` rewrites `map/map.css`
   (page.css + .build/retro/chrome.css + retro.css concatenated) and
   restamps `map/index.html`'s `?v=` hashes. Commit sources + `map/map.css`
   + `map/index.html` together, and nothing else (shared dirty checkout —
   stage the named files only).
5. Test the map family (`.build/test-map-*.mjs` — page/draw/chart/areas/
   senate/islands et al.), which pins assembly currency.

## Trap 1 — the retro chrome leak

`renderStory` serves the same `st-*` markup under `html.mp-retro`, whose
overrides are element+class selectors in `retro.css` (e.g.
`html.mp-retro .st-inf`). A generalised `#story …` rule carries ONE ID,
and any ID beats class/element tiers however many of them the other side
has — the story rule wins even though retro.css loads after page.css in
the concatenated map.css. Retro neutralises must therefore be explicit
per property — `.st-sec`/`.st-foot` already carried
`border-top: 0 !important`; `.st-inf` did not and took a stray twin rule
until `border-top: 0 !important` was added to its retro block. When
widening ANY story rule, grep every retro.css line touching the same
property and add the clearance where missing.

## Trap 2 — the polling-place figure adjacency

`#story[data-view="booth"][data-lens] .st-sec { border-top: 4px double }`
exists specifically to beat the head-adjacent suppressor (a polling
place's FIRST junction keeps its rule — no head figures above it). The
pair survives a generalisation ONLY because attribute selectors count in
the SAME tier as classes: the booth selector's three class-level
components (two attributes + `.st-sec`) beat the suppressor's two
(`.st-stat + .st-sec`). Widen a suppressor, re-verify the booth override
still outranks it; if you ever simplify the booth selector, its first
junction silently loses the rule.

## Trap 3 — the senate head has no closing rule

The senate story (`data-lens="senate"`, `senHead()` in app-3b-senate.js)
emits NO `.st-stat` figures; its head ends on a bare `.st-dek` (or
`.st-hed`). Suppressions like `.st-figures + .st-sec` generalise safely,
but `.st-dek + .st-sec` must NOT: zeroing senate's first section divider
leaves the head with no rule at all. When generalising adjacency
suppressions, walk every story type (`storyArea` / `storyDiv` /
`storyBooth` / `storySenate`) and confirm each head variant ends in
something whose presence the suppressor assumes.

## What stays winner-scoped on purpose

The Commissioner running-copy font rules remain behind
`data-lens="winner"` — typography was a deliberate winner-only identity
(auspol-map-story-lens-font); only the separator/rule family generalised.
