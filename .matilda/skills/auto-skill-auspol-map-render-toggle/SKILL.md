---
name: auspol-map-render-toggle
description: "auspol-tracker /map/ — adding a legend switch that shows/hides drawn map features (worked 2026-11-11, the 'Water' switch beside 'City names', commit 06fb31ea). Anatomy: one session-only S.<x>Off flag, THREE toggle homes that must all carry it (desktop Draw row lg-jtoggle, phone Jump-to menu item, retro View menu), flip-in-place vs renderLegend patterns per home, and the full inventory of canvas call sites a 'hide the water' switch gates (drawOcean paper+graticule, drawGeo's sea-mask sa, both drawWater sites, prepStreets' dry lakes, sea/water names, island-inset paper). Pin the contract in the owning test-map-* suite as source-shape asserts; verify the rendered flip with a /map/-canvas pixel probe via window.__map (canvas id 'cv', lat/lon→screen through M().proj + T.k/T.x)."
source: auto-skill
extracted_at: '2026-11-11T12:11:12.081Z'
---

# /map/ render-toggle switches ("City names" idiom) — the homes, the flag, the gates

Worked case (2026-11-11): user asked for "Show water" to toggle the inland
lakes and the background ocean off and on, appearing wherever the "Show city
names" toggle appears. Shipped as `51df8747`, rebased and landed as
`06fb31ea`, pinned in `.build/test-map-ocean.mjs`.

Repo root = `/Users/joshuaborgnolo/auspol tracker`. Map app parts live in
`.build/map/app/app-*.js` and fold into `map/map.js` by
`node .build/map/assemble.mjs` (also re-stamps `map/index.html`'s `?v=`).

## State: a bare session-only flag

- The flag is `S.<x>Off` — `S.townsOff` for City names, `S.waterOff` for
  Water. It is NOT declared in the `const S = {…}` literal in app-1-base.js
  (undefined == feature on) and persists NOWHERE (no URL, no saved view,
  no localStorage — same as townsOff). Don't wire persistence unless told.

## The three toggle homes (all must carry the new switch together)

1. **Desktop Draw row** — `drawRowHTML(m)` in `.build/map/app/app-2b-draw.js`
  closes the row: `…<span class="lg-jgap"></span>${waterToggleHTML(!S.waterOff)}${townsToggleHTML(!S.townsOff)}</div>`.
  The button factory sits next to `townsToggleHTML` in `app-6-ui.js`
  (~:722): one `<button type="button" class="lg-jtoggle" data-<name>
  role="switch" aria-checked="…"><span class="lg-sw"
  aria-hidden="true"></span><noun></button>` — label is the noun alone
  ("Water", "City names"), the `.lg-sw` pill + `[aria-checked]` CSS in
  page.css styles every `.lg-jtoggle` uniformly (nothing new to write
  there; a `display:inline-flex` rule at page.css ~:1364 applies to
  `.lg-row > .lg-jtoggle` for all of them). renderLegend includes the row
  only while `S.view === "map"` (app-6-ui.js:373).
2. **Phone panel (≤560px)** — `compactPanelHTML()` in app-6-ui.js (~:711)
  pushes a menu ITEM, not a button, into the Jump-to `lgMenu` pairs:
  `["water", S.waterOff ? "Show water" : "Hide water"], ["towns", …]`.
  Menu-list order = visual order (the item above "Show city names").
  The pick lands in `applyOpt` (app-6-ui.js:306): the same `k ===
  "jump"` branch — flip the flag, then **renderLegend() + schedule()**
  (the panel needs its text re-rendered; the desktop flip does not).
3. **Retro View menu** — `rtMenuItems("view")` in app-8-retro.js (~:195):
  `{ label: "Water", check: !S.waterOff, disabled: S.view !== "map",
  act: () => { const b = $("[data-water]"); if (b) b.click(); } },` —
  it CLICKS THE DESKTOP BUTTON (single logic path), placed directly
  above the `"City names"` item.

## The two click handlers (desktop bar + panel are separate)

- Desktop bar (app-6-ui.js:~1618): `const wt =
  e.target.closest("[data-water]"); if (wt) { S.waterOff = !S.waterOff;
  wt.setAttribute("aria-checked", String(!S.waterOff)); schedule();
  return; }` — flip IN PLACE, no renderLegend (the comment there:
  rebuilding the strip for one word re-laid it, and the map under it
  jolted).
  *** Do NOT add a second edit call to the same file in one assistant
  turn — same-file edits race and one silently vanishes (see
  same-file-edit-sequencing); each home above is a different file,
  four of them + the two app-2-map gate files = sequential rounds.
- Phone panel: `applyOpt`'s `v === "water"` branch (above).

## What "water" is on the canvas — every gate a hider needs

Paint order per frame: `frame()` (app-6-ui.js:1296) clearRect → `drawOcean(m,
1)` → `drawGeo(m, 1, streetK())` → focuses/booths/islands/labels. All in
`.build/map/app/app-2-map.js` unless noted. "Water" existed in TWO
generations — gate both (the old polygon cuts are slated for removal by
another lane; the Esri sea stays):

1. `drawOcean(m, alpha)` (~:416) — `layPaper(alpha)` paints the sea-tinted
   paper over the WHOLE canvas, `layGrat(m, alpha)` rules the graticule +
   election-day Tropic on it (both visible only in the sea zone — seats
   cover everything else). Switch-off lays a flat substitute instead:
   identity transform, `ctx.globalAlpha = alpha`, `css(TH.bg)`,
   `fillRect(0, 0, canvas.width, canvas.height)`.
2. `drawGeo` — `const sa = st && st.known && !S.waterOff ? seaA() : 0;`
   (~:450). `sa` is the ONE gate for the whole Esri-sea family: grown
   seats (`layWaters`), `laySea` (the coast cut — mvtParse pushes
   "water"-kind polygons, i.e. inland lakes/reservoirs/broads, into the
   same `out.sea` mask as the ocean), `oceanUnder`, and `veilSea`
   (reaches null via seaNow). With sa=0 the seats hold their AEC coasts
   and every inland lake fills like land.
3. The old polygon cuts — `drawWater(m, alpha, st, sa)` at the END of
   drawGeo AND `drawWater(m, 1, null, 0)` at the end of drawYearMorph
   (~:1334): wrap both in `if (!S.waterOff) drawWater(…)`.
4. `prepStreets` — `const dl = S.waterOff ? [] : dryInView(M());` (~:2652)
   so dry lakes aren't cut OUT of the sea mask (and no water-tile lookup
   runs while the switch is off).
5. Names — `drawSeaNames(m, placed)` (oceans; its tail also calls
   drawGratLabels for the degree labels, both gated) and
   `drawWaterNames(m, placed, obst)` (Esri lakes + WATER_NAMES +
   rivers): first line `if (S.waterOff) { seaSince.clear(); return; }`
   / `{ waterSince.clear(); return; }`. The since-map CLEAR is
   deliberate — it resets the label fade caches, matching every other
   early-out in those functions; a bare return leaves stale entries.
6. Island insets — drawIslands (~:2677): the box behind each island is
   clipped then `layPaper(a)`; switch-off instead
   `ctx.fillStyle = css(th.bg); ctx.fillRect(r.x, r.y, r.w, r.h)` while
   the clip holds.
7. NOT gated: the street sheet itself (roads, parks, and thin water
   lines painted on the tile images) — the switch covers water bodies
   and the sea, not the street layer; gating cached tile pixels would
   mean re-rendering every tile per flip.
8. `drawOcean` is also called from the chamber morph in
   app-3-chamber.js (~:1187) — the gate inside drawOcean covers it.

## Verify — suite pins first, then a canvas-pixel probe

- Rebuild: `node .build/map/assemble.mjs` from the tree you changed
  (it resolves ROOT from its own path — run it in a worktree to build
  THE WORKTREE). Suites: the map fleet
  (`for t in urban page ocean primary-breakdowns vote-bands draw chart
  areas geo geo-build boundary-vintages history senate islands; do node
  .build/test-map-$t.mjs; done`) plus `node .build/test-retro-pages.mjs`
  when the retro menu changed.
- Contract pins go in the owning suite's file — the worked block in
  `.build/test-map-ocean.mjs` asserts exact source strings (the
  drawOcean/flatGround regex, the `sa` line, `if (!S.waterOff)
  drawWater…` × 2, the prepStreets ternary, both names-head guards, the
  toggle button's markup, menu-item order strings, handler substrings).
  Watch your own assertion literals: `[data-water"]` never matches
  `"[data-water]"` (the quote sits outside the bracket) — that cost a
  red iteration here.
- Runtime probe (scratch, `.matilda/`, uncommitted): node:http static
  server over the repo on a fresh port + puppeteer-core
  `headless: "shell"` against the system Chrome
  (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
  DOM side: `[data-water]` precedes `[data-towns]` in `.lg-draw`,
  aria-checked flips on click, phone menu text/id at
  `[data-lg-val="jump:water"]` with `jump:towns` text AFTER it
  (menu trigger first: click `[aria-controls="lgmenu-jump"]`, wait
  `#lgmenu-jump:not([hidden])`, then click the item — items are
  not clickable while the menu is closed).
  Canvas side (what DOM probes can't prove): read pixels from
  `document.getElementById("cv")` via
  `cv.getContext("2d").getImageData(x, y, 1, 1)`; the map exposes
  `window.__map` (end of app-6-ui.js) with `{ S, M, T, goState, … }`,
  so a lat/lon lands on screen as `const [px, py] = M().proj(ll);
  x = round(px * T.k + T.x); y = round(py * T.k + T.y)` (multiply by
  devicePixelRatio for getImageData on dpr>1 viewports). Worked
  anchors: the sea band at country fit brightens measurably when water
  is off (mean of a sampled row band changes, then returns when on);
  Lake Burley Griffin `[149.133, -35.297]` at `goState("ACT")` reads
  pale sea-paper ON, the seat's party colour OFF (Δ rgb-sum ~227).
  Time the reads: boot/morph fades sample mid-animation — compare
  DISTANT pairs (off vs back-on ≫ 120, back-on vs on < 80) instead of
  demanding return-equality within 40.
