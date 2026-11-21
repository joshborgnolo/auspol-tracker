---
name: auspol-map-select-lens-invalidation
description: "auspol-tracker /map/ — a census select-lens OPTION swap (Marital status / Religion / Tenure / Ancestry / Occupation / Born-in) repaints nothing in the Chart view while the same swap works from Seats (worked 2026-11-11 on S.mar, fix c3489836, landed 9ea8566b). The /map/ views memoise on SIX separate key enumerations — legendState() (app-6-ui.js), readingKey() (app-2b-draw.js), the chart's CH.key=[statKey=[legendState(),filtersKey(),CH.tpp/vs/split,W<520], selDiv(), W, H] (app-2c-chart.js), the areas surface key readingKey(m)+'|a'+areasVintage, CH.statKey's own caches, filtersKey() (app-5-list.js, S.f.* only) — and any NEW S.<option> state must ride EVERY enumeration that gates the views it touches or that view goes silently stale. Seats/Chamber repaint unconditionally in recolor(true) from lensParamChanged, so 'works in Seats, dead in Chart' means a memo key omits the option — grep the key lists, don't touch the painters. Recipe: add a fail-first DOM scenario to .build/test-map-marital.mjs that clicks the real #lgmenu-<lane> <button data-lg-val='<lane>:<key>'> in the affected view and asserts the figure DOM changes; run it against the SHIPPED (pre-assemble) bundle to watch it fail; fix the key enumeration; node .build/map/assemble.mjs to rebuild map/map.js + restamp map/index.html, and the same probe passes; full npm test before the land push. Probe anchors: the chart view's container is el.id='chartv' (class .mp-chart, #stage child), the plot mounts at .ch-plot, the head renders at .ch-hed; lgMenu triggers carry [aria-controls='lgmenu-<lane>']; the URL draw param is draw=chart, option param is the per-lens single-letter param (&ma=wid). legendState() after the fix carries S.cob/rel/ten/anc/occ/mar beside S.index; readingKey() does too — extend BOTH (and re-audit the other four sites) when the NEXT select-lens option-state joins."
source: auto-skill
extracted_at: '2026-11-11T10:05:29.809Z'
---

# /map/ select-lens option-swap: which view's memo key missed the key audit

Setup: you shipped a select-lens (or extended an existing census select-lens
with a new S.* option-state). User report: **switching the option does
nothing in one view but works in another** — here, swapping Widowed to Never
married on the Marital status lens produced no repaint in the **Chart**
view; swapping in **Seats** worked, and returning to Chart showed the new
figure (worked 2026-11-11).

## Diagnosis: enumerate the memo keys, don't question the painters

The /map/ views each invalidates on its OWN composite key enumeration.
Worked list from this session (verify current text before relying — arrays
drift as new lens keys land):

1. `legendState()` — `.build/map/app/app-6-ui.js`. Feeds (a) the legend's
   own change gate AND (b) the chart view's stat key. Ran through
   `S.view, boothsShown(), S.draw, S.axis, S.lens, S.tppMode/fpMode/senMode/
   infMode/incMode/ageMode/eduMode (famMode joined 2026-11-11 with the
   Family-composition fold per auto-skill-auspol-map-people-menu-fold),
   S.party/from/vs/spPair/spFrom, S.index,` — the mode keys were all
   there; the select-lens OPTION keys
   (S.cob/rel/ten/anc/occ/mar) were ALL absent.
2. `readingKey(m)` — `.build/map/app/app-2b-draw.js`. The memo root for the
   booths/surface/areas cache tiers; consumed by `placesLackMemo`, the
   surface memo, `areasJob` (`readingKey(m) + "|a" + areasVintage(m)`).
   This session showed `S.mar` was present here while absent from
   legendState — precise proof the enumerations drift independently.
3. `chartTick` in `.build/map/app/app-2c-chart.js`:
   `statKey = [legendState(), filtersKey(), CH.tpp, CH.vs, CH.split,
   W < 520].join("|")`; `CH.key = [statKey, selDiv(), W, H].join("|")`;
   render re-fires only on `CH.key` change (resume: `CH.key = ""` happens
   on ResizeObserver and on chart unmount).
4. `filtersKey()` — `.build/map/app/app-5-list.js` — `S.f.*` filter state
   only; NOT for lens options (expected — don't add lens keys there).
5. Seat/balloon/chamber views paint from live state on every `recolor()`
   — `lensParamChanged()` (app-6-ui.js ~:1075) calls `recolor(true);
   renderLegend(); renderStory(true); writeURL()` UNCONDITIONALLY. That's
   why Seats always looks correct: it never memoises on param enumerations.

**The telltale split** (works in Seats, dead in Chart, fine after a view
round-trip) locates the fault IN THE KEY — the renderers themselves read
live state at paint time (`demoShare`/`demoAreaShare`/`divValue` read the
current option each render), so a fresh draw from ANY trigger shows the
right figures; only the missing invalidation starves the draw.

## Fix

Extend the MISSING key list(s) with every select-lens option cell in one
edit, next to `S.index`. Session fix (landed as `9ea8566b`):
`legendState()` gained `S.cob, S.rel, S.ten, S.anc, S.occ, S.mar` — six
key slots, fixing the same latent staleness for ALL existing select
lenses, not only the reported one. Do not band-aid by wedging a
"mar-only" string check into legendState; every lens shares the omission
class.

When YOUR lens is the newly-arrived S.<key>, audit ALL of 1–3 above (plus
`CH.statKey` composition against your state); each enumeration names its
cells explicitly — a lens whose option never appears in a list is blind
in the views gated on that list.

## Probe choreography (fail-first, then pass)

`.build/test-map-marital.mjs` pattern (the working reference):

1. Spin the file-server + puppeteer-core headless Chrome flow of the
   existing suite (port ~8982, fresh tab per scenario — the URL state
   applies at boot only).
2. Scenario URL: `y=2025&l=seifa&i=mar&ma=marr&draw=chart`
   (`draw=chart` is the view param; `ma=` the marital option param).
3. Wait on `__map.S.index === "mar" && __map.S.draw === "chart" &&
   document.querySelector("#chartv .ch-plot svg")` — the chart view's
   container is **`#chartv`** (`class="mp-chart"id="chartv"`, appended to
   `#stage` by chartEl()), NOT `#chart`; the plot mounts inside at
   `.ch-plot`, the head text at `.ch-hed`.
4. Swap through the REAL UI: click
   `[aria-controls="lgmenu-mar"]`'s companion option —
   `#lgmenu-mar [data-lg-val="mar:wid"]` (`<button data-lg-val="<lane>:<key>">`
   per lgMenu item). ~400ms settle.
5. Assert `(plot.innerHTML + '@@' + head.textContent)` differs across the
   swap.
6. **Run the probe BEFORE assembling** — against the stale shipped bundle
   (`map/map.js`/`map/index.html` as checked out) the swap check MUST
   FAIL (that proves the scenario axes the bug); then
   `node .build/map/assemble.mjs` to rebuild `map/map.js` and restamp
   `map/index.html`, re-run, and the SAME check passes.
7. `test-map-{chart,areas,page}` + full `npm test` before the land push,
   and land per auspol-branch-merge-land-race.

## Landed references

- Origin fault + fix source: `.build/map/app/app-6-ui.js` legendState
  (app-6-ui.js ~:93, the `// the select-lens option keys ride the key too`
  comment names this class now), commit `c3489836` at branch-push time,
  `9ea8566b` as the origin/main land (2026-11-11).
- The probe: scenario 6 of `.build/test-map-marital.mjs`.
- Land-verify: `curl -s https://auspoltracker.com/map/ | shasum -a 256`
  identical to `git show origin/main:map/index.html | shasum -a 256`
  after the Pages deploy (~2–3 min settle).
