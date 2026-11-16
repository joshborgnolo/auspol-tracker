# SA past-election joins — adjudication record (sa18 ← 2014)

The sa18 frame's past lane rides the (renames / new / abolished) record in
`.build/map/build_sa18_past.py` (`RENAMES`, `NEW`, `ABOLISHED`). This file
is the evidence trail per the family rule ("extend deliberately, never
silently"), exactly as qld's, NT's and WA's records sit beside theirs.

## 2014 → 2018 (the 2016 determination)

Boundary set: the Electoral Districts Boundaries Commission's final
determination of 2016-09-09 (the 2012-det's boundaries carried the 2014
election; the 2016-det's the 2018). Both sets exist in the ABS ArcGIS SED
series — ASGS2016 (2012-determination) and ASGS2017 (2016-determination) —
which this adjudication uses per polygon-centroid containment in both
directions (clean one-hit pairs both directions for five of the six).

Antony Green's redistribution analysis (ABC Elections unit, November 2017 —
`SA2016_Redistribution.pdf`) documents exactly this record; every rename
matches its "re-named districts are …" summary, and the abolition/creation
lists match its "abolished / created" summary. Nothing here moves past the
documented record, and every centroid check concurs:

### Renamed (stayed the same seat in the determination's eyes)

| 2014 district     | 2018 district  | documented rename            | centroid |
|-------------------|----------------|------------------------------|----------|
| Ashford           | Badcoe         | "Ashford becoming Badcoe"    | clean both directions |
| Goyder            | Narungga       | "Goyder now known as Narungga" | clean both directions |
| Little Para       | Elizabeth      | "Little Para reverting to its former name Elizabeth" | clean both directions |

### Abolished (2014 seats with no successor named-seat)

Bright, Mitchell, Fisher, Napier (the record treats *Bright* and
*Mitchell* as abolished with Black and Gibson created beside them;
Fisher's land moves anti-clockwise into Hurtle Vale and friends;
Napier's into King).
Centroid notes: B:Black's centre sits inside 2014-era Bright (its close
partner in the determination); B:Gibson's centre sits inside 2014-era
Mitchell; B:Hurtle Vale's main mass sits inside 2014-era Mawson with
Fisher's south-west (cast aside as the anti-clockwise successor region);
B:King's centre sits inside 2014-era Little Para, with 2014-era Napier's
centre landing on it too (the "Napier abolished, King created to the
east" document covers the land the successor grew from).

### Created (2018 seats with no predecessor named-seat)

Black, Gibson, Hurtle Vale, King.

The unsplit remainder joins name-for-name through the unchanged
boundaries (both determinations printed their polygons exactly as
gazetted; the 2018-era own no seat it shares with 2014-era moved less
than half-of-urban out of ... no — the determination moved dozens of
borders minimally, the name joins ride the names only).

## A note on the name authority in the 2014 record (verified live 2026-11-17)

The ECSA 2014-era static results tree carries duplicate stale labels on
THREE pages ("District of Florey" / "District of Mawson" / "District of
Mitchell") while their tables belong to Giles, Kaurna and Port Adelaide
respectively (folds of a live-count-era sitemap where every page was
filed by id-position: ids 718, 723 and 737 carry them — the parser uses
the ECSA's own alphabetical id ORDER (see `DISTRICT_SEQUENCE`), pins the
three mislabels at `MISLABELS`, and fails loudly than honour a fourth.

## Mirror integrity

Every district's own tallies reconcile: candidate-vote Σ == total
formal, TCP-pair Σ == total formal; the 47 sums reach the statewide
formal 1,017,856 / informal 32,503 / enrolled 1,142,419 and the
independently-printed psephos transcription matches per every seat
(per-Candidate, per-count; its own mirror had a bookkeeping slip: its
Voting-by-District section skips Davenport's and Dunstan's entire
sections and its pendulum print is missing its #09 Labor rank — the
ECSA static pages, and this file's Oracle's, govern).
