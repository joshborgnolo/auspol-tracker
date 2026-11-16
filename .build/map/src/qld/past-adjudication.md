# QLD past-election joins — adjudication record

Each frame's past lane rides the (renames / new / abolished) record in
`.build/map/build_qld_past_common.py`'s `PREV_ADJ` map. This file is the
evidence trail per the file's own "extend deliberately, never silently"
rule, exactly as .build/map/src/wa/past-adjudication.md and
.build/map/src/nt/past-adjudication.md record theirs.

## 2015 → 2017 (qld17's past lane comes from the 2015 election)

Boundary change: the 2017 redistribution determination (published 2017,
contested 25 November 2017) moved Queensland from 89 districts to 93.
Since ABS ArcGIS SED editions frame BOTH sides (ASGS2016 = the
89-district set as contested 31 January 2015; ASGS2017 = the
93-district set as contested 25 November 2017), the adjudication was
computed mechanically: polygon centroids of each set dropped on the
other set's polygons in both directions
(scratch: .build/map/probe-qld17-adjudication.mjs.tmp.py run 2026-11-16).
Every verdict below matched the documented 2017 determination renames;
the centroid evidence table for the cross-map pairs was clean single-hit
both ways except where noted.

### Renames (continuing seats, new names)

| new (2017-era) | renamed from (2015-era) | centroid evidence |
|---|---|---|
| Theodore | Albert | drift noted: A:Albert centre lands in 2017-era Coomera, B:Theodore's centre lands in 2015-era Gaven — a reworked rename, kept on the documented determination |
| Cooper | Ashgrove | clean both ways |
| Scenic Rim | Beaudesert | clean both ways |
| McConnel | Brisbane Central | clean both ways |
| Oodgeroo | Cleveland | clean both ways |
| Maiwar | Indooroopilly | clean both ways |
| Kurwongbah | Kallangur | clean both ways |
| Traeger | Mount Isa | clean both ways |
| Miller | Yeerongpilly | clean both ways |

### Abolished (2015-era seats with no successor seat)

- **Dalrymple** — abolished; its area divided between the new Traeger
  (centroid: Mount Isa's centre also sits in new Traeger — that pair is
  the rename above) and the new Hill (centroid evidence: Hill's centre
  sits in 2015-era Dalrymple).
- **Mount Coot-tha** — abolished; its area joined Maiwar
  (centroid evidence: Mount Coot-tha's centre sits in Maiwar).
- **Sunnybank** — abolished; its area divided between continuing
  Stretton (centroid evidence: Sunnybank's centre sits in Stretton) and
  the new Toohey.

### New (2017-era seats with no predecessor seat)

Bancroft, Bonney, Hill, Jordan, Macalister, Ninderry, Toohey
(7 seats: 89 − 3 abolished + 7 new = 93).

Net check: 89 existing names carry over (80 untouched names + 9
renames), 3 abolished leave the count, 16 new names appear
(9 renames + 7 new): 80 + 9 − 3 + 7 = 93.

## 2017 → 2020, 2020 → 2024

Name-for-name identity chains on the unchanged 93-district set (the
existing PREV_OF/past_main contract; no adjudication needed).
