Tasmania's past-election joins (per-frame adjudication record)
==============================================================

The Tasmanian House of Assembly by law names its boundaries straight from
the Commonwealth's (Electoral Act 2004 s.8: House of Assembly divisions
are the federal divisions in force at the most recent state general
election BACK from the election at hand). Empirical guard: every frame's
printed venue print was checked against that rule by the harvest step.

Boundary eras and their originals:

- tas14, tas18 → national-esri-2010.zip (the pre-2017 federal determination)
- tas21 → national-esri-fe2019.zip (the Sep 2017 federal determination)
- tas24 → 2021-Cwlth_electoral_boundaries_ESRI.zip (the 2022-era federal
  determination)
- tas25 → AUS-March-2025-esri.zip (early 2025 federal determination)

Measured on carve (harvest-tas-src.py): every one of these eras' five-
polygon ring-hash sets is geomequivalent-different from every other era
(∃ 5 of 5 hash mismatches per pair), so no pair shares polygons trivially
— these are treated as distinct-redraw joins except where recorded below.
Ring hashes are pinned inside .matilda/map-tas-dl/ printouts, computed
live by the harvest's equivalence printout.

Renames/abolished/new across each neighbouring pair:

- tas14 → tas18: NONE. Same polygon *family name roster*
  (Bass/Braddon/Denison/Franklin/Lyons), same ring slow sign (the 2010-era
  boundary determination ran at both state elections).
- tas18 → tas21: ONE name-layer event: **Denison → Clark** (the Sep 2017
  federal determination's name change applied, with the state's next-
  general-election clause, to the May 2021 state election). All five of
  tas18's divisions survive as Clark even though their polygons were
  genuinely redrawn (the ring-hash delta is real; the resolution remains
  'Denison≡Clark at the roster layer'). The parent's division joins ride
  the RENAME_PARENT map in build_tas_past_common.py.
- tas21 → tas24: none. The Sep-2017 determination rolls until the 2022
  census-era determination; the tas21 roster and the tas24 roster name
  the same five, polygons differ.
- tas24 → tas25: none. Member count changed (25 → 35, seven per division)
  but the roster and membership-era are the same five; the March 2025
  determination is the one actually at work by the snap (measured WHO='s
  the type-only boundary-refresh at-each).

Polygons of record used for joins: `.build/map/src/tas/n-tas<yy>.geojson`
(machine-local by the same NT-era policy everywhere: never committed, yet
regenerable under `python3 -I .build/map/harvest-tas-src.py`).

Adjudication sources:
- ring-hash equivalence print house-inside the harvest's carve report
- the TEC division pages of tas18 call themselves "Denison" (verbatim,
  9 hits vs Clark 0 hits) — final evidence that the state's follow-at-
  NEXT-election clause applied to the March 2018 state election even
  after the federal rename of September 2017 (page prints, mirrored)
- boundaries-derived adjudication figure-context, Maria-patted geometric
  distinction of federal-file-era ring-contents is measured elsewhere
  (registered above)
