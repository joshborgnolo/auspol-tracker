---
name: auspol-map-axis-contest
description: auspol-tracker /map/ — adding or changing a pairing in the Two-party share view's built-contest menu (the "Two-party preferred: share⇄" legend row's second line, Labor v ON / Coalition v ON / the Greens pairings). The estimator, pair registries, senate-prefs store layout, counted-vs-built split, test pins, and the commit set. Worked 2026-11-07 (Greens v One Nation/Labor/Coalition, f79821e0, landed 01058abe).
source: auto-skill
extracted_at: '2026-11-07T00:49:41.601Z'
---

# /map/ built two-party contests (the "axis" lane)

The Two-party share legend row (app-6-ui.js `legendHTML`, `case "tpp"`) says
`Two-party preferred: share⇄`; the line under it is a contest SELECT
(`opt("axis", S.axis, axisOpts(m))` in a `.lg-t.lg-contest` div, labelled
`counted` or `estimate`), rendered only in share mode, map view, non-seats
draw, on frames in `AXIS_FRAMES`. A pairing = a poll-of-pairs code like
`AC AO CO`; since 2026-11-07 the federal frames also carry `GO GA GC`
(Greens v One Nation, Greens v Labor, Greens v the Coalition).

## Machinery map (read before editing)

- **Pair registries** — `SP_PAIRS`/`SP_DONORS` in `.build/map/app/app-3b-senate.js`
  (~:607). SHARED with the Senate-preferences lens, which is safe to extend:
  its readers (`spSlot`, `spAbsent`, `SP_PAIR_OPTS`) walk their own hardcoded
  AC/AO/CO trio, so new pairs never appear in that lens's menu — but the URL
  `sp` param parses against `SP_PAIRS` (app-6-ui `readURL`), so add an
  explicit guard or a crafted `?sp=GO` degrades the Senate view
  (`!AXIS_GREEN_SET.has(spp)` is the landed shape).
- **The estimator** — `axisOf(m, pair)` in app-2b-draw.js (~:102). Federal
  frames read per-place donor rates from the ballot store: a donor group's
  share ranking pair[0] ahead, shrunk `AXIS_K=30` toward the seat's rate.
  State frames fill constants from `AXIS_RATES[m.year][pair]` (state-frame
  pairings are only AO/CO; sa26's AO is Kevin Bonham's split estimates).
  `AXIS_LEVEL` levelling exists ONLY for fed-2025 AO (to flows.mjs FP_ON).
  Where the seat's real final two was the pair, each place takes its RAW tcp
  (`b.raw.tcp[j]`, the `fs.includes(fa) && fs.includes(fb)` arm) — real
  counts ride inside a "built" contest (Melbourne/Cooper/Wills/Griffith were
  ALP–GRN finals 2025; Ryan was LNP–GRN). Seats missing either party's fp>0,
  and by-elections, are `seatSkip`ped.
- **Slot layout coupling** — the store's per-seat/per-place flat count array
  is pair-major, donor-minor; the app finds a pair's cells by a cumulative
  walk of `Object.keys(SP_PAIRS)` lengths (`k0`). The app's SP_PAIRS key
  order MUST equal the file's `pairs` array order; test-map-draw pins both.
- **Store** — `map/data/senate-prefs-<year>.json`, self-describing
  (`pairs`, `donors`, `absent`, `gvt?`). Counts per (pair,donor):
  `[x, y, nei]` = ranked-first-ahead **or naming only it**, ranked-second,
  neither. `absent` (e.g. `onp` in the ACT; NT until 2025) comes from ballot
  named-family counts; an absent pair member yields degenerate 100%-ranked
  rates there (parity across pairings; the notes call these estimates).
- **Generator** — `.build/map/senate_prefs.mjs` (`PAIRS`/`DONORS`,
  `PAIRS6`/`DONORS6` + `SIX_YEARS` since 2026-11-07: only 2022/2025 carry
  the six-pairing 54-count rows; 2016/2019 and the GVT-ticket years stay at
  27). Inputs are all tracked: `data/senate-rankings-<y>.json` +
  `.build/aec-flow-src/senate-ballots/booth-rankings-<y>.json.gz`. Untouched
  years regen byte-identical.
- **Frame gating** — `AXIS_FRAMES` (which frames have ANY alternative),
  `axisNow`/`axisOffers` (per-pair eligibility — the Greens pairings are
  federal-only: a picked-but-unsupported pair falls back to the counted `AC`
  display with `S.axis` kept for the walk back), `axisOpts(m)` (menu per
  frame), `axisSpan` (`CO`/`GO` run the long ±40 scale, the rest ±30),
  `axisRamp` (a `div*` ramp per pairing, defined next to `divOn`/`divCo` in
  `buildRamps`, app-1-base.js ~:144).
- **Constant-rate frames** — `AXIS_RATES` (qld20/qld24/qldnow/sa26) are
  measured flows, pinned against `FLOW_HISTORY_SENATE_ON`/`_CON` from
  `.build/newtracker/flows.mjs` by test-map-draw. A NEW pairing on a state
  frame means MEASURING new constants (federal-only was the 2026-11-07 call;
  zero constants needed).
- **Story/hed machinery is generic** — `axisHedDek`, `axisSeatHedDek`
  (app-2b-draw ~:1351-1370), `axisHow` read `SP_PAIRS[pair]`/names and switch
  a seat whose final two really ran the pair to won/coount wording. Verify
  the copy for a new pairing at a counted seat (e.g. Melbourne under GA),
  don't special-case.
- **Products** — `node .build/map/assemble.mjs` → `map/map.js`,
  `map/map.css`, `map/index.html` stamped regions (`?v=` links + the
  data-warm script). test-map-page's "map/map.js is current, its data stamps
  too" gate compares committed map.js to a reassembly from the tree, so
  sources + data + products + tests land in ONE commit.
- **Notes copy** — the estimates paragraph in `map/index.html` (~:227,
  hand-maintained — assemble only rewrites marked regions) names every
  pairing the contest builds; test-map-draw pins the sentence's exact words
  ("the page's notes name the built contests…"). Edit them TOGETHER.

## Adding a pairing — the worked sequence

1. Extend the generator (pair code + donor groups, the year gate), regen the
   affected files. spot-measure each new pair's national donor rates
   (sum the `pairs`/`donors` cells) as a sanity check and to pick the axis
   span from the real spread.
2. App: `SP_PAIRS`/`SP_DONORS`; `axisName` for any new family
   (`grn → "The Greens"/"the Greens"` landed); option lists + a guard for
   whatever URL param is narrower than the pair registry.
3. Span + ramp (`div*` in buildRamps); menu/story fall into place off the
   registries; legend menu call is already generic if you keep `axisOpts`.
4. `map/index.html` estimates note + the test-map-draw notes string pin.
5. Tests: `test-map-page.mjs` per-year row-count loop (27/54 per file × year
   — years' files you changed) AND `test-map-draw.mjs` blocks (menu/code
   pins, store `pairs` order, `d.tcp` candidate-index final-two data pins
   from `map/data/core-<y>.json` proving a counted seat for the new pair:
   `d.tcp = [[candIdx,votes],[…]]` with `d.c[idx][3]` = family).
6. `node .build/map/assemble.mjs`, the test-map cluster, then full `npm
   test`. Commit sources + data + products + tests together.

## Land gotchas

- `setAxis` lazy-fetches `senate-prefs-<src>.json` for any non-AC federal
  pairing — extra pairings ride the same fetch (the 2025 file went ~800KB →
  ~1.55MB for the six-pairing 2026-11-07 extension; still lazy).
- If the shared checkout has a sibling mid-feature that touches map app
  sources or products, `assemble.mjs` folds THE WHOLE TREE just like
  build.mjs — build in an isolated worktree and land with
  `git push origin HEAD:main` (see auto-skill-auspol-branch-merge-land-race).
- The test-map-draw `stood()` audit walks every frame: every AXIS_FRAME must
  have One Nation standing in ≥3 seats in 4 and every other core frame
  <3/4 — new AXIS_FRAMES entries must genuinely meet it.
