# NT past-election joins — adjudication record

Each frame's past lane rides an explicit (renames / new / abolished)
record in `.build/map/build_nt_past_common.py`'s `PREV` map. This file is
the evidence trail per `build_qld_past_common.py`'s "extend deliberately,
never silently" rule.

## 2012 → 2016 (nt16's past lane comes from the 2012 election)

Boundary set: the 2011 NT redistribution (final determination published
the week ending 28 July 2011; in effect June 2012). The 2016 election's
own set is the 2015 redistribution (final determination 17 September
2015). **No ABS SED edition carries the 2012 divisions** — the SED product
starts at ASGS2016, and the 2011 gazettal set is not in it — so this pair
is adjudicated on the documented record, never polygons.

The 2011-gazettal roster (as contested 25 August 2012) vs the
2015-gazettal roster (as contested 27 August 2016) differs by exactly:

| 2012 division | 2016 division | adjudication |
|---|---|---|
| Greatorex | — | ABOLISHED (2015 redistribution; Alice Springs 3 urban seats → 2) |
| — | Spillett | NEW (2015 redistribution) |

Every other 2016 division's name carries the 2012 seat one-for-one.
Sources: ABC "Northern Territory electoral boundaries finalised"
(2011-07-28, 2015-09-17 reports), NTEC division pages; mirrored counts
reconciled per division in `.build/state-flow-src/nt/2012/
2012-official-summary.txt` (NTEC's official 2012 statistical report) vs
the psephos transcription. The Sanderson roll sits 10 higher in the
transcription (5,110 vs the official 5,100) and is pinned as the only
adopted rollback (`PSEPHOS_2012_ROLL_OVERRIDES` in nt_parse.py).

## 2016 → 2020 (nt20's past lane)

Boundary set: the 2019 NT redistribution (final determination early
September 2019). Contested 22 August 2020. Name changes and nothing else
material to a name-join:

| 2016 division | 2020 division | adjudication |
|---|---|---|
| Stuart | Gwoja | RENAME |
| Nhulunbuy | Mulka | RENAME |

NTEC treats both as renames of the continuously-existing divisions (its
division pages), not abolish+create pairs: the 2019 redistribution renamed
Stuart to Gwoja and Nhulunbuy to Mulka with only minor fence moves. Every
other name carries. Sources: NTEC redistribution pages; Katherine Times /
Antony Green reporting (September 2019);
data.nt.gov.au `2019-nt-electoral-boundary-redistribution-final-divisions`.

## 2020 → 2024 (nt24's past lane)

Boundary set: the 2023 NT redistribution (finalised 15 December 2023).
Contested 24 August 2024. **No division renamed, none created or
abolished** — the final changes were boundary-shape moves only (notably
Gwoja expanded north into Daly; the Mulka–Arnhem border revised), so this
pair joins one-for-one on names with an empty record. Sources: Tally Room
/ Antony Green reporting (December 2023), NTEC 2023 redistribution page.
