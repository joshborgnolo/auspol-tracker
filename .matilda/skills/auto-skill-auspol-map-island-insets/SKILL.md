---
name: auspol-map-island-insets
description: "auspol-tracker /map/ — the island inset boxes (Norfolk, Lord Howe, Christmas, Cocos) drawn off the mainland frame: the seaSpots/islandCards machinery in app-2-map.js, why an island can sit inland in ONE view mode only (a clamp/memo that differs per mode — page chrome being read as a clearance floor under full screen), and the serve-time injection probe that dumps seaSpots intermediates from inside the single-IIFE map.js. Pin: .build/test-map-islands.mjs"
source: auto-skill
extracted_at: '2026-11-08T07:11:12.338Z'
---

# /map/ island inset boxes — anatomy, failure signature, probe

Diagnosed and fixed 2026-11-08 (commit 30d265f7): user reported Christmas
and Cocos drawn inland on WA in full screen only, while Norfolk/Lord Howe
sat correctly in the Tasman. Christmas Island's box was landing on Durack.

## Where it lives (`.build/map/app/app-2-map.js`, the "the islands" block ~:1722)

- Four offshore islands can't be drawn in place past the mainland clip
  frame; each renders as a north-up inset box (source data
  `map/data/islands.json` from `.build/map/islands_build.mjs`). Boxes glide
  between two modes: **sea** (country fit, no relevant selection — pairs
  anchored off the coast) and **dock** (selection holds the island's seat —
  docked boxes beside the seat, with polling places live).
- `seaSpots(m, hb, A, p)` computes the sea anchors in HOME-fit stage px.
  Every term is a limb a per-view bug can break:
  - `ISL_PAIRS` = `[["christmas","cocos"],["norfolk","lordhowe"]]`, diagonal
    pairs (NE/SW); `ISL_AT.side` fractions sit the middles at [0.14,0.145]
    (inside the nw of the Australia bbox — ocean by construction) and
    [1.015,0.78] (just east of the bbox); `ISL_AT.stacked` (chosen when the
    stage leaves ≥2 box-heights of vertical room) sits them ABOVE/Below the
    bbox ([0.2,-0.15], [0.86,1.07]). The fractions themselves are
    view-independent — verify them LAST, not first, when a mode misplaces
    things.
  - Box half-width `max(A, captionTextWidth+6)/2`; A = `islSea()` =
    `clamp(HOME.k*96, 42, 64)`.
  - **Clamps:** boxes are shifted onto the stage by `sx/sy` against
    [L,R]×[top,B]; in full screen L/R/B come from `FS.ins` (the plates'
    insets), `top` from `seaTop.top` when `seaTop.w === Wpx` — a MEMO of
    where the `#cities` strip and `#hint` (legend blocks) bottom out,
    measured only while they show.
  - **Step-out rescue:** if any box edge/caption grid point touches a
    division path (`hitCtx.isPointInPath`), the pair is nudged horizontally
    (west pair left, east pair right) in 6px steps, capped at `out2 <= 60`
    (66px effective travel), and only while staying inside [L,R]. It cannot
    compensate for a large vertical shove onto a coastline.
- The commission: full screen PARKS the legend (so `#cities`/`#hint`) into
  the fs-side plate — off the sea entirely — but `seaSpots` kept measuring
  their feet (~355px down) as the clearance floor: `sy≈221` shoved the
  western pair onto the coast past what the step-out could walk home. Fix:
  gate the memo's measurement AND use on `!FS.on`; when FS, the top
  clearance is `(isPhone() ? FS.ins.t : p.t) + (4 | 22)` — the plates' own
  room, already kept clear by the L/R clamps.
- `islDrawn` (the actually-drawn boxes) is refreshed from `islandCards()`
  each frame; a box outside the stage rect or at alpha ≤ 0.01 is skipped —
  at 390px phone widths ALL FOUR boxes can be absent at the country fit
  (pre-existing, both before and after the fix — don't gate a probe on
  `drawn().length === 4` there).

## Failure signature

Island box lands INLAND in exactly one view mode (page fine, full screen
inland; or vice versa) → the cause is almost certainly a CLAMP/INPUT that
differs per mode (`FS.ins`, `seaTop` memo, `stagePads()` which adds FS.ins,
`islSea()` scale via HOME.k), not the `ISL_AT` fractions. Read
`state()`: compare `seaTop`, `FS.ins`, `HOME`, `p.t` between modes.

## Probe — reach into the single-IIFE map.js (scratch: .matilda/isl-sea-probe.mjs)

`map/map.js` is one IIFE — module internals aren't reachable externally, so
inject a probe export at SERVE time (never written to disk):

- Static-serve the repo with `node:http`; when the request is for
  `map/map.js`, read the file and splice a `window.__seaProbe = {…}`
  snippet in just before the final `})();` via
  `src.lastIndexOf("})();")`. **`.replace("})();", …)` hits the first of
  MANY inner IIFE endings** — the probe landed inside a nested closure and
  never defined `__seaProbe`; lastIndexOf is the fix.
- The snippet runs inside the IIFE, so it can reference closures:
  `seaSpots`, `homeBox`, `stagePads`, `islSea`, `seaTop`, `FS`, `HOME`,
  `T`, `Wpx`, `Hpx`, `islDrawn`, layout elements (`$("#hint")`/`#cities`
  bottoms minus the stage top). Replay the placement math there with
  intermediates (raw base x/y, halves, sx, sy, out2, L/R/top, touched
  before/after) and require `replay.final ≈ seaSpots(...).out` to trust it.
- `window.__map` already exposes useful hooks: `__map.landAt(px,py)`
  (screen px → land boolean via geo paths), `get HOME()`, `T`, `M()` — no
  injection needed for those.
- Full screen: `__map.fs.enter({ native: false })` (the option must be
  explicit or headless tries the browser's native API), then poll until
  `T ≈ HOME` within eps and `islDrawn` rects stabilise (~1-2s), and exit
  with `__map.fs.exit(...)`.
- Verify per mode that each sea box's 3×3 edge/caption grid hits NO land
  (`landHitHome` on the HOME-fit frame), and that page mode is unchanged
  vs pre-fix (byte-identical positions).

## Pin: `.build/test-map-islands.mjs` (wired into `npm test` next to test-map-senate)

VM-slice pattern (cousin of auspol-map-vm-harness-stubs): slice
`seaSpots`+its private state out of the source between
`"let seaMemo = null"` and `"function islandCards(m) {"`, prepend stub
globals it reads from other file scopes (`FS`, `isPhone`, `HOME`, `ctx`
with `measureText`, `hitCtx`, `geoOf`, `$` returning hint/cities/…,
`ISL_$`, `SANS`, `Wpx`, `Hpx`), run in `vm.createContext`, and assert the
FS-mode y position stays near the raw anchor while page mode still
honours the measured chrome floor. **Negative control first**: `git stash
push -- .build/map/app/app-2-map.js`, run the pin against the pre-fix
source, watch it fail with the old shove (got y=387), `git stash pop` —
this proves the pin binds the regression, not the fixed tree.

## Test/rebuild loop for a /map/ fix

1. Edit `.build/map/app/app-N-*.js`; `node .build/map/assemble.mjs`
   re-writes `map/map.js` + restamps `map/index.html` (map.css only when
   page.css changed).
2. Run the map battery (all live in npm test): `test-map-urban / page /
   primary-breakdowns / vote-bands / draw / areas / geo / geo-build /
   boundary-vintages / history / senate / islands`.
3. After any rebase of the fix commit onto a moved origin/main: re-run
   `node .build/map/assemble.mjs` — OUTPUT MUST BE "unchanged" for map.js
   and css. If it isn't byte-stable, the auto-merged generated files are
   out of sync with the merged sources; regenerate and amend before
   pushing.

Related: auspol-worktree-scratch-files (base the worktree on origin/main —
a local main may carry unpushed sibling commits), auspol-map-vm-harness-stubs,
auspol-headless-geometry-verify (assert numbers in-page, never screenshots).
