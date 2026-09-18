---
name: auspol-tpp3-lead-measure
description: auspol-tracker — the three-cornered preferred ('3PP') machinery end-to-end (shipped 2026-09-05): polls.json inline tpp3 field → gen-data build3cp() spread into BOTH row emitters (individualPolls + pollsterTable) → archive Lead popover's THREE maps/mechanisms that must move together (MEASURE_LAB, measure-radio list, holder map) PLUS the query-string persistence pair (MEAS_BY_URL restore + MEAS_BY_ID write, short letter v=3); 3PP figures are passthrough display data and enter NO aggregate series.
source: auto-skill
extracted_at: '2026-09-05T00:00:00.000Z'
---

# Three-cornered preferred (3PP) machinery — auspol-tracker

Fox & Hedgehog is the only house printing a three-cornered preferred ("3PP"):
ALP / Coalition / One Nation each get a slice of 100. Shipped 2026-09-05 as a
passthrough-only datapoint — the figures ride on the row for display and NEVER
feed the 2PP aggregate, the alt-matchup series (ALT_BY/altNowcast), or any
other-first composite. A F&H row keeps its canonical `tpp_alp/tpp_lnp` pair,
which is what the aggregate continues to consume.

## Data layer

- `data/polls.json` — `tpp3: { alp, lnp, onp }` on the wave's row, inserted
  after `tpp_lnp`. Feb 2026: 44/27/29, May 2026: 43/27/30. Jan + Mar 2026
  published NO 3PP figure and carry no field
  (absent-not-zero, the `undecided`/`tpp_flows` precedent — the pattern this
  feature is modelled on end-to-end; see the auspol-extra-datapoint-pipeline
  user skill for the recipe).
- `data/polls.schema.json` — `tpp3` documented next to `tpp_flows` (~:86).
- `.build/newtracker/validate.mjs` — guard block "2b2" (right after the
  tpp_flows 2b checks): pollster must be "Fox & Hedgehog", all three slices
  present, each in 10–70, Σ ≈ 100 (±1, same discipline as the 2pp-sum check).
  Fails use `3cp-pollster` / `3cp-shape` / `3cp-range` / `3cp-sum` codes.

## gen-data.mjs

- `build3cp(p)` (~:913, directly after `buildAlt`): returns
  `{ tppKind: "3cp", tpp3: { alp, lnp, onp } }` (r1'd) when `p.tpp3` exists,
  else `{}`. Per-poll field, so it rides directly off the row — deliberately
  NOT a `date|firm` join map like ALT_BY/PPM_BY.
- Spread into BOTH row emitters beside `...buildAlt(...)`:
  `individualPolls` (~:1105) and `pollsterTable` (~:1178). The two emitters
  must carry the same spread — the Latest table and the archive read
  `tppKind` from whichever row shape they're fed.
- Emitted JSON key names differ by consumer: the Latest table's row payload
  carries `alp2pp/lnp2pp`, individualPolls carries `alp/lnp`; `tppKind` /
  `tpp3` are spelled the same on both.

## Archive renderer (d1a1d215) — Lead popover has FOUR homes

All inside `AllPollsView` unless noted (line refs at ship time):

1. `MEASURE_LAB` (~:3513) — add `"3cp": "3-cornered"` (used in the popover
   row label AND the FilterPop summary).
2. Measure radio list (~:3719) — `["lnp","onp","lnponp","3cp"].map(...)`;
   counts use `archLeadInfo(r, m)` which has a committed `3cp` branch.
3. Holder map (~:3727) — `{…, "3cp": ["alp","lnp","onp"]}` feeds the
   "Held by" radios; holder ids are the same `alp/lnp/onp` vocabulary as
   `archLeadInfo`'s `who`, and `HOLDER_LAB` needs no new entry.
4. Query-string persistence pair:
   - write: `MEAS_BY_ID` (~:3536) — `"3cp": "3"` (the short letter; `lnp`
     stays the omitted default).
   - restore: `MEAS_BY_URL` (~:3280) — BOTH the short letter AND the
     verbose fallback: `"3": "3cp", "3cp": "3cp"`. Muscle-memory trap: the
     restore map needs the verbose entry too or a hand-typed `vs=3cp` link
     silently resets to the lnp default.
   - URL key is `v` (was `vs` in the legacy verbose scheme); the effect
     sets it only when `measure !== "lnp"`.

Already-shipped renderer half (committed before the data half, needs no
edits when adding 3PP data): `tppContests` 3cp branch (a11e1559 ~:1446,
emits the 3cp contest FIRST then a DERIVED "2PP · ALP v L/NP · Derived"
pair — see auspol-tpp-pair-labelling for the never-key-on-array-index
trap), `archLeadInfo` 3cp branch (d1a1d215 ~:2596, margin sign convention:
positive = ALP holds the lead, matching the two-way branches), POLL_TAGS
`3pp` chip + `pollTagIds` push (~:2796/:2809 — Contains filter works off
`p.tpp3` automatically), `ArchSortTh` lead label map (~:3799, "Lead ·
3-cornered").

## Verification

- `node .build/newtracker/validate.mjs` — should print 0 errors.
- Root `assets/` has NO compiled JS (fonts/JSON only — the JS layers are
  inlined into index.html by the build). Verify the payload in the built
  `index.html`: grep `"tppKind":"3cp"` — expect 2 hits (Feb + May F&H rows),
  each followed by `"tpp3":{"alp":..,"lnp":..,"onp":..}`.
- The sort header and popover can only be checked live/simulated — the
  13-ish literal `tpp3` matches in index.html are renderer-source references
  mixed with the two data rows.
