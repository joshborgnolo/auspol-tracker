---
name: auspol-map-frame-data-gates
description: auspol-tracker /map/ — triaging "frame X has no booth data / the Areas (or another) draw chip is greyed / a census lane is missing": per-frame res-*.json coverage gates, the Areas vintage formula (only a 2021 SA1 pack exists), adding a pack figure to the Areas hover (areasUnpack→areasHit→tip), the Handbook-frame boot race root cause (loadYear's shell record vs M() renderers; fixed 3e0a3d12) and the deterministic timing-race repro ladder (CPU throttle + instrumented map.js).
source: auto-skill
extracted_at: '2026-11-09T00:00:00.000Z'
updated_at: '2026-11-09'
---

# Frame data gates: "why is frame X empty / view Y greyed" (/map/)

When a user reports a map frame showing no booths, or a greyed Draw chip
("Areas not available"), the answer is almost always readable from the
frame's data + the draw gates — check them before assuming the data is
missing. Worked 2026-11-09 on "no polling booth data for 1993" and "no
area census data on NSW views", where both premises were false or partial.

## 1. Read the frame's gates first (data layer)

Each frame ships `map/data/res-<frame>.json` (+ `core-` split, the same
without the polling places' census lanes). Booths are a COLUMNAR table
`booths: {d, id, n, ty, prem, sub, pc, lat, lon, v, inf, tpp, tcp, fl,
dec, vdec, location, demo, ageMed, a1824, …}`; count nonzero entries per
lane across all frames to see which lanes exist where (node one-liner;
be careful what "absent" means: **1993's prem/sub/pc are arrays of empty
STRINGS, not nulls — a filter on `x != null && x !== 0` counts 8,431 of
them as present and flatly contradicts a filter on `x !== ""`**).

The frame's `coverage` object is the documented contract — 1993's, read
verbatim from `res-1993.json`:

- `boothCoordinates: "approximate"`, `boothPreferences: false`;
- `boothLocationCounts`: matched 6540 · no-name-match 899 ·
  non-fixed-place 717 · outside-division 191 · administrative-place 71 ·
  short-name 12 · ambiguous 1 → of 8,431 places, only ~77% get a marker
  (names matched to LATER AEC venue lists; unlocated records keep votes);
- `note`/`census`/`seifa` free text: era-district census basis, "1991
  predates IRSAD" (era frames carry 3 SEIFA indexes).

Census basis per frame is `demoBasis`: `venue` (older federal),
`voter` (2016+ federal), `sa1` (EVERY state frame). Federal frames carry
`seifaCuts`; state frames do not. 1993 has per-booth FIRST PREFERENCES
only — `tpp`/`tcp`/`fl` lanes absent (1996+ all have tpp). Its
`demoInterp:` {c0:1991, c1:1996, nearestSide:1991} routes through
`data/booth-demo-1993(-c1).json` side files. The map's own static notes
page also documents the approximate-places contract for 1993/1996/1998 —
quote it when answering.

The rendering-side confirmation: on a booted frame, booth cards on a
frame with `boothPreferences: false` print "No polling-place final
preference count is available for this election"
(app-4-story.js), and an unlocated place adds "No reliable fixed
location has been matched… recorded votes remain available".

## 2. The Draw chips' availability gates (app-2b-draw.js)

`DRAWS = [["seats","Seats"],["balloons","Balloons"],["surface","Surface"],
["areas","Areas"],["chart","Chart"]]`; `drawOpts(m)` computes each chip's
grey state + `title` reason. Surface drops out on whole-seat lenses
(`cls`, informal-exhaust). **Areas needs THREE things** (`areasFits`):

1. the Census lens is active (`S.lens === "seifa"`) — note `yearLenses`
   strips only `senate/senpref/cls` from state frames, so Census IS
   offered on every state frame;
2. a pack exists for the frame's vintage: `AREAS_FILES = { 2021: "areas-sa1-2021" }`
   is the ONLY pack built. `areasVintage = m.demoInterp ?
   m.demoInterp.nearestSide : (m.demoYear == null ? 2021 : m.demoYear)` —
   a frame with NEITHER key defaults to **2021** (not "unavailable":
   2022→2025 and the newest state generations compute 2021 by default);
3. the current lane is in AREAS_LANES (includes the `sf.*` SEIFA lanes;
   the homeless lane is an SA2 estimate, never SA1 → hard-coded seat
   stay message).

Greyed-message literal when unfit: **"No census-areas pack reads this
frame's census yet"**. Frame vintages as computed from the 2026-11-09
files: federal 1993→1991, 1996/1998→1996, 2004/2007→2006, 2010/2013→2011,
2016→2016 (Areas OFF); 2019→2021, 2022/2025→default 2021 (ON). States:
nsw15/vic14→2011, nsw19/vic18/qld17/wa17→2016 (OFF, explicit `demoYear`);
nsw23/qld20/qld24/sa22/sa26/vic22/wa21/wa25→default 2021 (ON).
Live-verified: nsw23 Census lens → Areas enabled; nsw19 → disabled;
1993 → disabled.

**Surfacing a pack figure on the Areas hover (worked 3e0a3d12: the SA1
code).** The pack's topojson geometries ALREADY carry the ABS fields the
builder filtered with mapshaper (`-filter-fields`), e.g. every one of the
61,811 geometries has `properties.SA1_CODE21` (11 digits — asserted in
test-map-areas.mjs); `meta` decodes to typed arrays (`pop`, `area`,
`sa2i`→`sa2names`, `incBands`). The chain to add a per-area datum to the
hover is exactly three edits, no rebuild of the pack needed when the
field already rides properties: `areasUnpack` (app-2b-draw.js, which
discards properties into `{r, bb}` — lift the field there, e.g.
`code:`), `areasHit` (the tooltip's hit record `{i, sa2, pop}` — add the
field), and the seat-tip branch in app-6-ui.js (`arh && arh.v != null`
changes the `In <sa2>: …` / "…residents, as counted at the N census"
line). Assemble + browser probe via .matilda (§3b/§4).

## 3. The Handbook-frame boot race (root-caused + fixed in 3e0a3d12)

Deep link `#y=1993` (and the other Handbook years 1996/1998/2001 — those
geo files are ~6.5–19MB) intermittently killed the MAP BOOT entirely:
silent "didn't load" banner, or uncaught
`Cannot read properties of undefined (reading 'bb')` — and `window.__map`
never assigned (it's the LAST statement of the boot IIFE).

**The convention that makes the whole class:** in `loadYear`
(app-1-base.js ~:1380) the frame record is published IMMEDIATELY —
`Y[year] = m; m.ready = (async () => { … })` — and the async body fills
`m.res`/`m.proj`/`m.divs`/`m.geo`/`m.areas`/`m.search`, the geo last via
`await buildHandbookGeo(lo, m)` (seconds on big that-era files; also
network-wide on every frame). While the body runs, **`M()` (= `Y[S.year]`)
returns a shell** and every render path must tolerate that. The repo
idiom is sentinel-field presence as the readiness marker: `m.search`
(last assignment), `m.divs`, `m.geo`/`m.areas`, `m.divCol` — `recolor`
skips records without `m.divs`, `frame()` bails with the comment "nor a
frame not yet coloured", `frameLoad` counts only records carrying
`divs`. Anything assuming a complete record must check one.

**The two observed race victims (fixed 2026-11-09, 3e0a3d12):**

- `loadLegendMeta()`'s completion callback (kicked off at boot in
  parallel with `loadYear`) ran `if (M()) renderLegend()` → `legendHTML`
  → `const aus = m.areas.AUS` on the shell → TypeError. The `.then`
  rejects into the boot's data-load `try/catch` → the whole boot aborts
  with "The map's data didn't load. Reload the page to try again." and
  `__map` never lands. A `pageerror` NEVER fires for this form — the
  rejection is swallowed by the catch; an empty stack plus that banner
  in the DOM (`#mp-loading`/`#mp-meta` still show) is the signature.
- A `resize()` landing in the window ran `fitSelection` → `homeBox` →
  `unionBB(m.geo.bb)` — the intermittently reported uncaught `reading
  'bb'` error.

**Fix form:** `renderLegend` returns for a record with no `m.search`;
`resize`'s fit block waits for `M() && M().geo`. Both guards sit in
app-6-ui.js with explanatory comments; pinned in test-map-page.mjs
(string asserts; negative-controlled so they must fail on origin/main).
If this crash class resurfaces ELSEWHERE, check every other M()
consumer that runs from observers/callbacks against the sentinel
markers instead of trusting `if (M())`.

## 3b. Reproducing a timing race deterministically (worked recipe)

A boot race that shows ~50% live and 0% local needs shaping, not
prayer. The ladder that found the 'AUS' chain (local CDP-logging runs
and live repeats had all missed):

1. **In-memory instrumented serving**: a ~30-line node `http` server
   serves the repo's files but substitutes `map/map.js` on the fly with
   a string-replaced copy — insert `console.log("MARK <name>")` anchors
   and, decisively, replace the boot's `catch` line to `console.warn`
   the caught error's stack (the catch has no pageerror otherwise).
2. **CPU throttling over network shaping**: `Emulation.setCPUThrottlingRate`
   (CDP, rate 6–8) widens every async gap and reproducibly triggers it;
   throttling the network (Slow-3G or delaying specific fetches) mostly
   stretches everything uniformly and misses. Expect a handbook boot to
   take ~60s+ throttled; wait past it.
3. Milestones then say where it actually stops (here: last mark
   `loadYear:isl-built`, never `boot:loadYear-resolved`, and the
   catch-anchor trap then fires with the true stack).
4. RE-verify legend/area claims against **the live CDN** (`#y=…` direct
   deep links): local passes do NOT clear a live race (earlier same
   day: 8/8 clean local instruments vs live 2/2 crash).

Helper scripts from the run live in .matilda (serve loop =
`:879*`): `map-1993-catch.mjs` (plain + throttled 1993 boot with the
catch-anchor trap; — `sed 's/#y=1993/#y=1996/'` for siblings),
`map-areas-probe.mjs` / `map-areas-sa1-code.mjs` (frame gates).

**Completing the repair:** worktree off origin/main (see
auspol-clean-artifact-commit and §4), assemble the map, repeat the
throttled repro against the worktree build across every handbook year
AND hammer-run the failing template 3×+, then `npm test`, commit, push
and re-verify on the live site 1–2 min later.

## 4. Probing the live map page

The `window.__map` test hook (assigned LAST by the boot IIFE in
app-6-ui.js) is the reliable in-page instrument:

```js
// puppeteer-core + system Chrome, headless "new", --no-sandbox
await page.goto("https://auspoltracker.com/map/", { waitUntil: "load" });
await page.waitForFunction('typeof window.__map === "object"', { timeout: 40000 });
// drive frames in-page (deep-link reloads re-trigger the boot path you're testing)
await page.evaluate(() => window.__map.setYear(1993));
await page.evaluate(() => window.__map.setLens("seifa"));
// read state: __map.M() (frame model, .booth the columnar table),
// __map.areasVintage(__map.M()), __map.drawOf(m), __map.S.lens/index/year
```

- Draw-chip state: `[...document.querySelectorAll(".lg-draw button")].map(
  b => ({ t: b.textContent, off: b.disabled, why: b.title }))`.
- Served-local probes: `python3 -m http.server <port>` from the repo root
  serves `/map/` fine (index.html resolves for trailing-slash dirs);
  `?v=` stamps are ignored by it — fine.
- Flakiness is the norm here: boot may never assign `__map` with NO
  captured error (listen `pageerror` AND an evaluateOnNewDocument
  `window 'error'/'unhandledrejection'` trap for a stack; `error.stack`
  is often empty on these). Vary attempts across FRESH pages; kill stray
  Chrome instances between runs; do NOT conclude "fixed" from one local
  pass — verify against auspoltracker.com too. For timing races
  specifically, CDP CPU throttling is the shaping dial (see §3b).
