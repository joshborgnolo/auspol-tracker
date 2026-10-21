Historical per-seat distribution-of-preferences haul (fetched 2026-10-21).

Extends the repo's per-seat DoP coverage backwards from 2010 to 1987 and
adds the CD-era packs. Landing these files changed NOTHING in the active
pipelines: consumers of this directory key every file by explicit year
(estimate-state-flows.py FED_YEARS; aec-flow-history.py literals).

## AEC Virtual Tally Room (HouseDopByDivisionDownload, comma CSV)

- dop-2004.csv.gz — Event 12246, old results path:
  https://results.aec.gov.au/12246/results/Downloads/HouseDopByDivisionDownload-12246.csv
- dop-2007.csv.gz — Event 13745:
  https://results.aec.gov.au/13745/Website/Downloads/HouseDopByDivisionDownload-13745.csv

(2010–2022 already in this dir; 2025 is atlas/data/aec-2025/.)

## AEC statistics CD-ROM packs (HPPDOP.TXT, per-count semicolon tables)

Extracted from the packs hosted at
https://www.aec.gov.au/About_AEC/Publications/statistics/files/ :
- dop-1993.csv.gz, dop-1996.csv.gz, dop-1998.csv.gz
  ← aec-1993-1996-1998-election-statistics.zip
    members data/import/tables{93,96,98}/HPPDOP.TXT
- dop-2001.csv.gz
  ← aec-2001-election-statistics.zip
    member data/import/hppdop.txt

Schema: State;Division;Polling Place;Count;Ballot Position;Candidate Status;
Vote Distributed;Vote;Vote Pc;Elected Swing;Exhausted Transfer;Exhausted
The ~160MB source zips are not committed (same rule as aec-flow-history.py).

## psephos transcriptions (1983–1990, pre-digital AEC era)

psephos/<year>/<year>reps<state>.txt — Adam Carr's verbatim transcriptions
of the AEC's printed "Election Statistics" volumes, fetched from
http://psephos.adam-carr.net/countries/a/australia/<year>/ (http only; the
https listener does not answer). Kept verbatim, one file per state/territory
per election. Each division block carries the full count-by-count
distribution ("2nd count: Green's 4,590 votes distributed"), headered
"Source: Australian Electoral Commission".

1983-repsact/repstas contain no distribution blocks — those divisions had
no exclusions (majors reached 50% on primaries or two-candidate counts).

Coverage summary after this haul:
  1983, 1984, 1987, 1990  psephos/<year>/*.txt (transcribed printed counts)
  1993–2001               dop-<year>.csv.gz (AEC HPPDOP per-count tables)
  2004–2025               dop-<year>.csv.gz / atlas/data/aec-2025/ (AEC VTR DoP)
