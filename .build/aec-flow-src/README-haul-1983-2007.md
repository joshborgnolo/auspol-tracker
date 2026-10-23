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

## AEC statistics packs (HTPPBYPP.TXT, House two-party preferred by place)

Same two zips, pulled 2026-10-24 to extend the explainer's 2PP state and
seat-class cuts back to 1996 (they floored at 2004, the tppdiv downloads'
reach — the "no notional count before 2004" note was wrong; 1993's member
is informal votes only, so 1996 is the true floor):
- htpp-1996.txt, htpp-1998.txt ← tables96/tables98 members of
  aec-1993-1996-1998-election-statistics.zip
- htpp-2001.txt ← data/import/htppbypp.txt of
  aec-2001-election-statistics.zip
Committed verbatim (sha256-checked against the zip members). Schema:
Division;Polling Place;ALP TPP Vote;ALP TPP Pc;ALP Swing;Coalition TPP
Vote;Coalition Party;TPP Exhausted;Informal Vote. No state column — the
Divisional Classifications blocks' state field groups the divisions.
1998's table omits Newcastle: its final pair ran Labor v independent
(Morris), so the AEC counted no Labor-v-Coalition figure for it.

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
