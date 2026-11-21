---
name: auspol-map-lc-senpref
description: Adding a state's upper-house ballot-preference data to /map/ as the federal Senate-preference lens on a state frame (worked for NSW LC, nsw15/19/23, shipped 83865492) — and why VIC has no per-ballot source at all. Read before touching senate-prefs-*, SEN_PREF_STATE_FRAMES, or spYear.
source: auto-skill
extracted_at: '2026-11-04T12:11:57.362Z'
---

# /map/ upper-house ballot preferences on state frames (the NSW LC lens)

Shipped 2026-11-04 in two halves the user asked for: "also get upper house
preferences too, like for federal elections" → "why is there no upper house
preference data for the state elections in map".

## Feasibility by state — established facts

- **NSW: yes, since 2015.** NSWEC's `https://pastvtr.elections.nsw.gov.au/`
  publishes per-ballot Legislative Council zips. Pinned byte sizes
  (README-history.md): SG2301 124,431,335 · SGE2019 124,075,355 ·
  SGE2015 103,565,020. Live-fetchable; the zips sit untracked at
  `.build/nswec-lc-flow-src/` (same convention as the big federal prefs zips:
  sources uncommitted, derived artefacts committed).
- **VIC: impossible by source absence.** The Discover Data Vic catalogue and
  web search both show only aggregate district-count workbooks
  (`vec.vic.gov.au/files/State2014/{Region}{VotesReceived,Distributions}.xls`,
  now live-404; Wayback holds captures) and the 2018 count isn't even
  catalogued. **The VEC publishes no per-ballot LC product.** Do not
  re-investigate this; a VIC LC lens has nothing to read until the VEC ships
  one. State this reason when asked.

## The shape that worked (avoids inventing a new format)

The data maps snugly onto the federal `senate-prefs-<frame>.json` schema:
pairs AC/AO/CO, donors `grn`/`onp`/`oth`, 27-count cells. Family mapping of
NSWEC group labels: ALP / joint Liberal–Nationals ticket / GRN / PHON
(absent in 2015 — `absent: {"NSW": ["onp"]}` with AO/CO cells zero, same
idiom as the federal-ACT case) / OTHER. Mapping lives in
`.build/nswec-lc-flow-src/analyse_nsw_lc.py` (`GROUP_LABELS` per year +
`family(label)`); the reconciliation bank is `.build/nswec-lc-flow-src/counts.json`
(family-ATL totals 2011–2023; extend it there for later elections).

## Producer

`.build/map/build_nsw_lc_prefs.py` (stdlib-only, deterministic, byte-identical
on re-run) → `map/data/senate-prefs-nsw{15,19,23}.json`. Guards baked in and
verified at ship: formal/informal counts byte-equal the official tallies
(258,368 / 301,681 / 278,477); per-family ATL == counts.json; per-district
(pair, donor) triples == district tallies; 93-district rosters match the era
(2013 names nsw15/19, 2021 nsw23); `GUARD_MIN_MATCH_SHARE = 0.90` is computed
over JOINABLE (non-**DV**) ballots only — DV types (Absent/iVote/Postal/
Enrolment/Provisional) are 17–19% of ATL and have **no venue in any roll by
construction**, so a ≥90%-of-all-bar is arithmetically impossible;
`GUARD_MIN_BOOTHS` floors {2500, 2300, 2500}.

## App wiring (every home a lens-opening touches)

- `.build/map/app/app-1-base.js`: `SEN_PREF_STATE_FRAMES =
  new Set(["nsw15","nsw19","nsw23"])` beside `FED_LENS` (`senate`/`senpref`/
  `cls` stay federal-only otherwise); `yearLenses` keeps `senpref` on those
  frames.
- `.build/map/app/app-3b-senate.js`: `spYear(y)` resolves state frame ids
  directly when `SEN_PREF_STATE_FRAMES.has(y)`, else falls back to the
  federal `svYear` path; `loadSenatePrefs` fetches
  `senate-prefs-<frame>.json`.
- `.build/map/app/app-4-story.js`: the three story gates swap `svYear`→`spYear`.
- `.build/map/app/app-6-ui.js`: `setLens`/`setYear`/`readURL`/`flowSrcBtn`
  honour the SEN_PREF exception; the legend note's LC string: "Every formal
  upper-house ballot in New South Wales…" (a state frame **without**
  SEN_PREF coverage keeps the "A state election has no Senate-ballot
  preference record here." fallback).
- Test pin block in `.build/test-map-page.mjs` (yearLenses/readURL/setLens/
  setYear exceptions + the three data files' shape); probe pattern
  `.matilda/probe/map-nsw-lc-senpref.mjs` — assert **DOM story/legend text**,
  not data internals: `window.__map` only exports `{S, Y, walk…}` (no SPD).
- `window.README-history.md` → `.build/map/README-history.md` LC-prefs
  recovery section.

## Commit-time gotcha

New `map/data/*.json` files interact with the assemble-stamp ledger — staged
data files must land in the same commit as freshly assembled
`map/map.js`/`map/index.html` (git-add the data BEFORE assembling). See
`auto-skill-auspol-map-data-commit-order`.
