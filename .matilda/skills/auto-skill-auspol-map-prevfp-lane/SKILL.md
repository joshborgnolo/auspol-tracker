---
name: auspol-map-prevfp-lane
description: "auspol-tracker /map/ — the same-place first-preference change lane (`booths.prevFp`): why every booth once read 'Didn't stand both times' (the lane didn't exist outside Now overlays), its read/write homes, the producer join by AEC polling-place id, splice-not-rebuild for res files, and the honest null-copy contract (shipped bc1dcddd, 2026-11-06)"
source: auto-skill
extracted_at: '2026-11-06T06:03:32.258Z'
---

# /map/ booth Primary-change — the `prevFp` lane end to end

Shipped bc1dcddd (2026-11-06) after a user report: 2025 frame, Primary lens,
Greens, change mode, booth level said "Didn't stand both times" at places the
Greens had contested at both elections. The claim was systemic, not
party-specific.

## Why it lied, and the symptom map

- `boothValue` (`.build/map/app/app-2-map.js` fp/`S.fpMode === "change"`)
  reads `b.raw.prevFp[j]`, else returns null; null renders the valueText
  string. Division-level change never had the problem — it sums the AEC's own
  candidate swing columns (`fpChange` in the same file: `c.sw` by family).
- Before the fix, `prevFp` was written ONLY by `applyNow` (app-1-base.js) for
  by-election overlay booths; no `core-*.json` (22 frames) or `res-*.json`
  carried it, so EVERY booth in EVERY frame claimed "didn't stand both times".
- Diagnosis recipe: grep the user-facing string in `map/map.js` (assembled —
  edit `.build/map/app/*`, never map.js by hand) → chase the lane name
  (`prevFp`) through `.build/{map/data}` producers and `git log -S`.

## Write side (`.build/map/build_map_data.py`, build_year)

- The join block runs after `divs_prev = load_fpvvt(prev)` (only when
  `prev >= 2004`; 2004's past is stats-pack 2001 with no per-booth lanes —
  the whole column is then ABSENT, matching the read side's
  `b.raw.prevFp ? ...` null-when-absent convention).
- Shape: `fam_of = {cid: bucket}` from `divs_prev` candidates;
  `load_booth_fpv(prev)` rows are `(divisionId, pp)` keyed; AEC
  `PollingPlaceID` is globally unique within an election — the producer
  asserts no id spans two divisions before keying `prev_fp[pp]`.
- Emit per booth (appended in the main booth loop right after
  `B["id"].append(pp)`, only when the lane exists):
  `prev_fp.get(pp)` → `{alp,lnp,grn,onp,ind,oth}` shares rounded 2dp, or None
  for a lapsed venue. Join yield prints as `<n> fp-joined` per year
  (2007: 8013, 2010: 7972, 2013: 8480, 2016: 7868, 2019: 7799, 2022: 7809,
  2025: 7882 of ~8.2–8.9k — the unjoined rest are new/lapsed or RENUMBERED
  venues, e.g. reissued PPVC rows after a redistribution; "new place" is the
  honest read there).
- Running the producer: bare `python3 .build/map/build_map_data.py <stage>`.
  NOT `-I`: it implies `-E` (env stripped → PYTHONPATH dead) while
  `:865` `from historical_booth_locations import apply_locations` relies on
  the script's own dir on sys.path. (The file's usage comment still claims
  `-I`; it doesn't work.)

## res files are spliced, not rebuilt

`map/data/res-<y>.json` = `geo_build.mjs(<stage>/data-<y>.json)` + geometry
label anchors + later lanes (`vt2` piles from `build_vote_piles.py`) — so a
blind full regen properly needs mapshaper + boundary sources. For a
data-lane-only change:

1. Run the producer to `/tmp/map-results-$USER` (newish data-*.json).
2. Parity-checked splice (recipe hidden in a scratch
   `.matilda/tmp-*.mjs`; recreate when needed): assert every staged lane ==
  res lane byte-for-byte (`vt2`/`lp` extras allowed on the res side), then
  insert `prevFp` into `res.booths` at its producer key position (after
  `id`) so a future full build lands byte-identical.
3. `node .build/map/assemble.mjs` — runs `stampPrevTpp`, `writeCores`
  (core-*.json from res), `dataStamps`, `map.js`/`map.css`, index restamp.
  `prevFp` is not a PPL census lane, so it sits in core-* (+~0.5MB/frame,
  loads on first visit).
4. Verify (a) every joined row exact-matches an independent recompute from
   `.build/aec-flow-src/booth/fpv/<prev>-<st>.csv.gz`, (b) per-seat average
   booth change sits within a few points of the AEC div-level swing
   (ordinary-vote-only vs total-votes swings legitimately diverge; e.g.
   Melbourne grn −2.5 booth-avg vs −5.3 div swing).

## Null-copy contract (app-6-ui.js valueText) + legend

- `kind !== "booth"` null stays "Didn't stand both times" (true for
  divisions via `fpChange`).
- Booth + lane present → "New place since last time, so no change".
- Booth + no lane anywhere in the frame (state frames 5 producer families,
  1993–2004) → "No like-for-like count on file for this election". State
  frames still have division-level swings (every candidate carries `c[5]`)
  but no same-place booth lane — wiring joins there is five custom
  producers of follow-up work, deliberately not done.
- The fp-change legend gains the same `<span class="lg-hatch">` "Place not
  used last time" note the tpp-swing legend carries, gated on
  `boothsOn && ch && m.res.booths.prevFp`. Null booths draw the theme hatch
  (`hatch()` pattern in app-2-map.js).

## Consumers that light up automatically

The booth story card's first-preferences table (app-4-story.js ~:1127)
gains its "· change on <prev> here" column from the same raw lane — the
header substring only appears when `pf` is non-null. The booth whole-lens
colour (`boothValue` → `colorOf` fp-change → RAMP.gain/loss) needs no
read-side change at all.

## Pins (test-map-page.mjs, shipped with the fix)

Per-year joined-count oracle (the table above), row shape — sorted keys
`alp,grn,ind,lnp,onp,oth`, shares ≥0 ≤100, sum-to-100 ±0.1 (rounding of 6
2dp shares), a `grn > 2` sanity seat count, lane-absence pins for
1996/1998/2001/2004, the Fitzroy fixture (2025 id 4631 → 2022 shares
{alp:23.1, lnp:8.33, grn:59.23, onp:0.65, ind:1.01, oth:7.68}), and the two
copy strings verbatim.
