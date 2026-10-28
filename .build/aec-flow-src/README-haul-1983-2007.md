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

## 2001 /map/ frame members (fetched 2026-10-28, packed from the same zip)

The 2001 statistics pack re-downloaded as
`aec-2001-election-statistics.zip` (58,251,181 bytes; sha256
`73069fc7c4958388bbc559e15430c6d69268b117fdb1cee8ffd37ba90ae4b616`) —
same edition as the dop/htpp/hcands members above (re-verified: all
three committed copies are byte-identical to their zip members).

- `divs-2001.txt` ← `data/import/divs.txt` (House division summary:
  enrolment, formal/informal/total, TPP + swings; 150 records)
  sha256 `ebf6b5da6eae4a269c36855865b6176829d480d34f1415a68181b8e0fb90ae54`
- `scands-2001.txt` ← `data/import/scands.txt` (Senate candidates by
  state, `#` elected flags, order of election, term expiries)
  sha256 `d05689b00a8322a072fc8ea1023067dddf6f7cd6cff4f5c9a28e015fb81b4bbd`
- `sppvote-2001.csv.gz` ← `data/import/sppvote.txt` (Senate first prefs
  by division and polling place; gzipped)
  member sha256 `dcca7469ef1cbb98878abedc23391c02ece3fb343ece0a60bcc158433fafa96f`
- `pps-2001-<st>.txt` ← `data/<st>/<st>_txt/pps<ST>.txt` × 8 (the 2001
  polling-place roll: name/premises/address/suburb grouped by division;
  the /map/ 2001 venue list — no coordinates in this product)
  sha256s: nsw cf8755037c2c484e…, vic 4bd03bc63f4cb08f…,
  qld 7584de597b10384e…, wa 64f8e21186303394…, sa a1c671d1d4dca1e0…,
  tas ffd9b62d8a1319e8…, act 3d1eabf9b687e81c…, nt 09c138e623d86582…
  (full values verified at fetch; the zip sha above re-covers them)

Semantics per the pack's own `data/stats/import_files.pdf`: DIVS.txt is
the division summary; HCANDS rows with ballot position >900 are "ghost"
candidates (previous-election parties not re-contesting, swings only,
empty candidate field); HTPPBYPP/HPPDOP carry ABSENT, POSTAL, PRE POLL
and PROVISIONAL declaration rows by name under each division (no
division-summary sentinel rows). The pack ships NO boundary geometry.

### 2001 /map/ VTR-equivalent lanes (added 2026-10-28)

From the same pack's v3_10<DIV>.txt members ("Two Candidate Preferred
Preference Flow Result", the OFFICIAL movement of each excluded
candidate's first preferences into the final pair per polling place and
division): collated member-marker-concatenated to `v310-2001.txt.gz`
(3,391,892 bytes → 778 KB), plaintext sha256
`243932ae3d37da0912d0e0f65d5ba6a568b6a3f2bc4b1549339f3b4756088e26`.
The VTR-frame lanes under `booth/` + `tcpflow-2001.csv.gz`, `tppdiv-2001.csv.gz`
and `atlas/data/aec-2001/GeneralPollingPlacesDownload-2001-derived.csv`
are DERIVED products `<as the year marks>` of
`.build/map/pack-2001-booth.py` from these committed members (parser
`.build/map/v310_2001.py`); the pack's products carry no candidate or
polling-place ids, so the pack assigns AEC-flavoured synthetic ones —
documented in the script. Rebuild deterministically with
`python3 .build/map/pack-2001-booth.py` after changing any member — every
emitted number is gated against divs-2001.txt's printed totals
exactly-recompose per the script's oracle run.

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
