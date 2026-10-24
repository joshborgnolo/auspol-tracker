Per-polling-place AEC products (fetched 2026-10-24 by .build/harvest-aec-booth.sh).

Three product lanes, machine-readable from the AEC Virtual Tally Room for every
federal event 2004-2025 plus a stats-era FPV/TPP repack (1983-2001 lane lives
in the parent directory's README). Landing these files changes NOTHING in the
active pipelines: consumers key every file by explicit year.

## FPV — first preferences by polling place

- fpv/<year>-<ST>.csv.gz (2004-2025) — VTR
  `Downloads/HouseStateFirstPrefsByPollingPlaceDownload-<EVENT>-<STATE>.csv`
  under https://results.aec.gov.au/<EVENT>/<results|Website>/ (2004 = 12246
  `results`; 2007+ = 13745/15508/17496/20499/24310/27966/31496 `Website`).
- fpv/<year>.csv.gz (1993, 1996, 1998, 2001) — no stats-era FPV-by-PP product
  exists; these are the COUNT 1 (first-preference) rows of the committed
  HPPDOP cascades (../dop-<year>.csv.gz), repacked by the harvest script with
  columns State;Division;Polling Place;Ballot Position;Candidate Status;Vote;
  Vote Pc. Candidate identity flows from ballot position via ../../candidates
  (hcands-<year>.txt) in the consumers — see .build/aec-booth.py.

## TPP by polling place

- tpp-pp/<year>.csv.gz (2004-2025) — VTR
  `Downloads/HouseTppByPollingPlaceDownload-<EVENT>.csv` (whole-event single
  file, all states).
- 1996/1998/2001 — the committed ../htpp-<year>.txt files ARE the per-booth
  HTPP product (stats CD-ROM packs); not duplicated here.
- 1993 — HTPPBYPP.TXT is informal-votes-only for 1993; there is no booth-grain
  1993 TPP product anywhere in the repo (see ../README-haul-1983-2007.md).

## TCP preference flows by polling place

- tcf/<year>-<ST>.csv.gz (2004-2025) — members of
  `External/HouseTcpFlowByPPDownload-<EVENT>-<STATE>.zip` (one CSV per
  division inside each zip) merged by the harvest script into ONE csv per
  state: banner line + header from the first member, then all members' data
  rows (headers assert-equal). Columns: StateAb,DivisionId,DivisionNm,PPId,
  PPNm,FromCandidate*,FromCandidatePartyAb,...,ToCandidate*,ToCandidatePartyAb,
  ...,TransferCount,TransferPercent. The `FromCandidate 0 / "First
  Preferences"` pseudo-rows carry each excluded candidate's per-booth FPV
  entering the TCP count; ordinary rows carry flows from excluded parties
  INTO the final TCP pair.
- There is NO per-polling-place TCP-flow product before 2004 (the stats
  packs carry per-PP DoP cascades and HTPP only), so booth-flows.json starts
  at 2004.

## Vote-type oracle lane (validation inputs, not a presentation product)

- oracle/fpvvt-<year>.csv.gz (2004-2025) — VTR
  `Downloads/HouseFirstPrefsByCandidateByVoteTypeDownload-<EVENT>.csv`; per
  (division, candidate, shown-as-party) OrdinaryVotes the fpv/<year>-<ST>
  per-booth files must recompose exactly.
- oracle/tppvt-<year>.csv.gz (2016-2025) — VTR
  `Downloads/HouseTppByDivisionByVoteTypeDownload-<EVENT>.csv`; per-division
  ordinary TPP by pair member.
- oracle/tcpcvt-<year>.csv.gz (2004-2013) — no TPP-by-vote-type product
  exists for those events; the VTR
  `Downloads/HouseTcpByCandidateByVoteTypeDownload-<EVENT>.csv` classic rows
  stand in.
- The division-level TCP-flow oracles (../tcpflow-<year>.csv.gz, 2025 =
  ../../../data/aec-2025-tcp-flow-by-division.csv) are committed with the
  parent directory's flow lanes, not duplicated here.

## Integrity

sha256s of every committed gz are recorded in sha256-manifest.txt in this
directory (regenerate: `shasum -a 256 fpv/*.gz tpp-pp/*.gz tcf/*.gz oracle/*.gz`).
A clean-room re-run of the harvest script reproduces the same row counts;
the VTR occasionally serves Content-Length drift, so compare by row count +
decompressed sha on any refetch before trusting a redownload.
