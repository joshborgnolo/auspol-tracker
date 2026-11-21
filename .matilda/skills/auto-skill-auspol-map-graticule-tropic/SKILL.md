---
name: auspol-map-graticule-tropic
description: "auspol-tracker /map/ — the graticule + per-day Tropic of Capricorn machinery (worked 2026-11-10, commit 5eedfdc1, replacing the stamped -23.4358° constant on user report). tropicOn/tropicOf/gratOf/layGrat in app-2-map.js's @grat block, the test-extraction contract of the @grat-begin/end markers, per-frame tropic dates (election day per frame; live today on isNowY frames per user call 'Computed live in Now View Only'), the Rt-radius direction fact, and the oracle pins (J2000 84381.448″, 1993 84384.7″, 2026 84369.2″, drift ~0.47″/yr north). Assemble map.js afterwards (maps regenerate; never hand-splice)."
source: auto-skill
extracted_at: '2026-11-10T00:50:50.070Z'
---

# /map/ graticule + Tropic of Capricorn machinery

Everything below lives in `.build/map/app/app-2-map.js` (assembled into
`map/map.js` by `node .build/map/assemble.mjs` — edit the part, then
reassemble; `map/index.html`'s `?v=` stamp rides along).

## Lay of the land

- **`/* @grat-begin … /* @grat-end */` block (~:284)** — the test-extracted
  graticule core:
  - `tropicOn(iso)` — the day's Tropic latitude. Mean-obliquity polynomial:
    `t = (Date.parse(iso)/864e5 + 2440587.5 − 2451545)/36525` (Julian
    centuries from J2000.0), `−(84381.448 − 46.815t − 0.00059t² +
    0.001813t³)/3600` degrees. UTC-for-TT is deliberate (ΔT moves nothing
    at arc-second scale). Oracles it must keep matching: J2000.0 =
    84381.448″ = 23°26′21.448″; 1993 = 23°26′24.7″; 2026 = 23°26′09.2″;
    northward drift ≈ 0.47″/yr (16″ = ~480 m over the 1993–2025 timeline).
  - `degLat`/`degLon` — atlas degree labels ("30°S", "130°E"; equator and
    antimeridian bare).
  - `gratOf(P, trop)` — the apex/radii/meridian-angle work, cached on the
    projection as `P._grat` keyed by **(k, tx, ty, trop)** — the day's
    trop degree rides the cache key, so a date rollover or a frame walk
    recomputes the circle instead of reusing yesterday's.
- **`tropicOf(m)`** (defined just OUTSIDE `@grat-end`) — one line:
  `tropicOn(m && m.date && !isNowY(m.year) ? m.date : new Date().toISOString().slice(0,10))`.
  `m.date` comes from each `map/data/res-<frame>.json` (`m.date = res.date`
  in the loader, app-1-base.js) — an ISO election day ("1993-03-13",
  "2025-05-03", "2025-03-08"). Now frames are overlays riding the BASE
  frame's res (they'd otherwise inherit the base election's date), so the
  `isNowY` branch is what makes Now frames live at today's date — the
  2026-11-10 user call, verbatim: "Computed live in Now View Only".
- **Call sites that must all pass `trop`**: `layGrat(m, …)` (draws the
  dashed tropic circle from `G.Rt`), `drawSeaNames` and `drawWaterNames`
  (each `gratOf(m.proj, tropicOf(m))` — water names don't use `Rt` but
  share the cache), and `drawGratLabels` (places the italic "Tropic of
  Capricorn" label separately via `seaLayout(…, [lon, trop], …)` — `G.Rt`
  gives the circle, the label still needs the latitude).

## Geometry fact that pins direction

The projection's apex lies SOUTH of the map (`G.C[1] > P([132,-44])[1]`),
so a MORE-southerly tropic stands nearer the apex → SMALLER `Rt`.
1993's line (`G93.Rt`) must be < the 2025 line's (`G.Rt`) — the pin's
assertion direction is that way round.

## The @grat extraction contract (test-map-ocean.mjs)

- `test-map-ocean.mjs` regex-pulls ONLY the block:
  `/@grat-begin[^*]*\*\/([\s\S]*?)\/\* @grat-end \*\//` and evals it as
  `new Function("GRAT_STEP", `${grat[1]}; return {...}`)(10)`. Consequences:
  - anything inside must be **dependency-free** — no app globals
    (`isNowY`, `T`, `css`, …) or the eval throws. Per-frame glue
    (`tropicOf`) therefore sits after `@grat-end`, not inside.
  - the opening comment behind `@grat-begin` must contain no OTHER `*`
    before its `*/` (`[^*]*` anchor); stick to `// ` comments inside the
    block (a `/* … */` containing `*/`-shaped text breaks the match).
  - the test destructures `{ gratOf, degLat, degLon, tropicOn }` from the
    eval's return — renaming any of those means updating the test
    (gratOf's second `trop` arg landed this way 2026-11-10).
- Oracle pins in the same file: tropicOn vs J2000/1993/2026 datebook
  figures (±0.2″ tolerance), the ~0.47″/yr creep rate measured between
  two election dates, per-day cache split (`gratOf(P, tropicOn("1993-03-13"))`
  ≠ `gratOf(P, 2025-day)`), and `G93.Rt < G.Rt`.
- **Negative control** (used for this change): `git stash push -- app-2-map.js`,
  test must FAIL (old source has no `tropicOn`), `git stash pop`. A pin
  that passes on the old code binds nothing.

## Rebuild & after-effects

`node .build/map/assemble.mjs` rewrites `map/map.js` and restamps
`map/index.html`. The stamp isn't only the bottom `?v=` script tag —
one rediff of index.html after a regenerated map.js sat at **:111**
(another stamp line), with `map/map.js unchanged`. That's the
worktree-skill's "post-rebase assemble idempotence" idiom in action:
regen until byte-stable, amend, THEN push.
