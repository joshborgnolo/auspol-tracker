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

## Division summaries + Senate lane for 1993/1996/1998 (fetched 2026-10-28)

Same zip as the HPPDOP/HTPP members
(`aec-1993-1996-1998-election-statistics.zip`, ~99MB; sha256
`ee3b46be593dfd2b6e8f29ca1acf78a1ae4a86f0dfd0aba71f33248bdbb025e8`),
completing the division-summary and Senate lanes across the CD-ROM era
(1993–2001 now contiguous with the committed 2001 files):

- `divs-1993.txt` ← `data/import/tables93/DIVS.TXT`
  sha256 `2d1fe96fc7abdc6c45cfc7c5beb20bf0f08e5ea06582054743991b489d61f03c`
- `divs-1996.txt` ← `data/import/tables96/DIVS.TXT`
  sha256 `6189dee54a7f57269fdae3de4870a054e86f2925dcb279ea9aee2ce6ae4344ce`
- `divs-1998.txt` ← `data/import/tables98/DIVS.TXT`
  sha256 `8c4299421e0184278f3924aebba763366f5771c3107d0d95abeb93d930dbd4cc`
- `scands-{1993,1996,1998}.txt` ← `SCANDS.TXT` (Senate candidates; identical
  schema to committed `scands-2001.txt`)
  sha256 `8ecd3ec0f55a345a51c2b60c9be7c44764f04283820523e6c383a6ce74184f14`,
  `bc8a10aeec6d6997286826d08d4fb11d2d0b542043936e7154b1c84e8df93187`,
  `1e93a5c9e36486789b0b707ad67f1749dfbb8697784aac69bc673a05cae582c6`
- `sppvote-{1993,1996,1998}.csv.gz` ← `SPPVOTE.TXT` gzipped (Senate first
  prefs by division and polling place; identical schema to committed
  `sppvote-2001.csv.gz`), plaintext sha256
  `7418d6c8243d67726b17e8233904214333927ad64db7dc875f9ceabb12bbe5e8`,
  `ba11f690c3b6ff86984ddeb87c9357823c9f5e65add8cb0aaefaf5f94fffb1ef`,
  `39a54c92d76f97310c291056660a9cee9c277511edc18188d06fb3eb9825886b`

DIVS.TXT schema per its header:
`State;Division;Enrolment;Formal Vote;Informal Vote;Total Vote;Formal Pc;
Formal Swing;Informal Pc;Informal Swing;Turnout;Turnout Swing;ALP TPP Vote;
Coalition TPP Vote;TPP Exhausted;ALP TPP Pc;ALP Swing` — swing cells may be
EMPTY (no previous-election comparator, e.g. Namadgi 1996); parse those as
null, do not coerce to 0.

**1993's DIVS.TXT carries real ALP/Coalition TPP pairs + swings at division
level.** The "1993 = informal only" floor applies to the booth-grain
HTPPBYPP.TXT product only; the AEC's own division summary for 1993 IS the
certified division-level Labor-v-Coalition count and it is the finest 1993
TPP grain that exists.

Division counts are the chamber counts (derived, pin via consumer tests):
147 (1993 — pre-1995-redistribution, no Namadgi, NT single-seat) / 148
(1996 — Namadgi in) / 148 (1998 — Blair in, Namadgi out). Files end with a
trailing blank line; skip blank records when parsing. divs-1993.txt's 148
lines = 147 divisions + terminator.

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
