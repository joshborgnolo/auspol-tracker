Informal-vote history raw sources, committed 2026-10-24 for
`.build/aec-informal-history.py` (the /flows-explained/ card's fourth
"View: Informal votes" stop) — every cell an informal-ballot share of
ballots cast, informal ÷ (formal + informal), per cent.

- `aph-informal-house.htm` / `aph-informal-senate.htm` — the APH
  Parliamentary Library handbook appendices "Informal votes: House of
  Representatives" (a †-note-free per-state % table, 1901–2013, 44 rows)
  and "Informal votes: Senate" (1901–2013, 42 rows; 1901 is `n.a.`
  everywhere but SA/WA/Tas, so the series floors at 1903). Live URLs
  soft-404 (a generic "Research – Parliament of Australia" page) as of
  2026-10-24, so these are the Wayback captures of
  `https://www.aph.gov.au/About_Parliament/Parliamentary_Departments/Parliamentary_Library/pubs/rp/rp1415/FedElect/FedElectn`
  and `…/FedElecto` (snapshot requested 20240604184229; the index page
  listing the appendix letters is the same capture root). Column order in
  the pages is NSW Vic Qld SA WA Tas NT ACT Aust (SA before WA, NT before
  ACT — never parse by position). Footnote (a) on the Senate 2013 row: it
  folds the 5 April 2014 WA half-Senate re-election into 2013's figures.
- `aec-informality-summary.html` — the AEC's "Informality (%) House of
  Representatives and Senate" page
  (`https://www.aec.gov.au/Voting/Informal_Voting/summary.htm`, page says
  Updated: 24 August 2022; re-fetched live 2026-10-24 and byte-equal in
  both tables, so no 2025 row exists yet). Table 0 is the SENATE table
  (1977 national 9.0 matches the APH Senate row; includes a WA-only
  2014[2] row for the half-Senate re-election, which the builder drops),
  table 1 the HOUSE table. Columns run Year NSW Vic Qld WA SA Tas ACT NT
  Total (WA before SA).

Series seams (documented in the builder, which enforces them):
- House 1901–2001 = APH appendix; 2004–2025 = derived from the committed
  VTR vote-type files (`orpheus` lane below). APH-vs-derived agree at 1dp
  on the 2004–2013 overlap (asserted).
- Senate 1903–1975 = APH appendix; 1977–2022 = the AEC summary page.
- Small APH/AEC printed divergences on the overlaps (the AEC page's
  number governs): House 1980 (2.4 v 2.5) and 1984 (6.8 v 6.3); Senate
  1980 (9.7 v 9.6), 1984 (4.7 v 4.3), 1987 (4.0 v 4.1), 2007 (2.5 v 2.6),
  2010 (3.7 v 3.8), 2013 (2.9 v 3.0 — the WA-2014 fold).

Derivation lanes the builder reads elsewhere in the repo (none fetched here):
- `.build/aec-flow-src/booth/oracle/fpvvt-<year>.csv.gz` (2004–2025) —
  House First Preferences By Candidate **By Vote Type** downloads; the
  per-division `Informal` pseudo-rows carry every vote type's informal
  total, and TotalVotes sums recombine exactly to the AEC's published
  informal shares (verified against both AEC page and APH table).
- `.build/aec-flow-src/htpp-{1996,1998,2001}.txt` — the statistics-era
  HTPP-by-polling-place tables' `Informal Vote` column, ÷ (their informal
  + the same election's `hcands-<year>.txt` formal first preferences).
  1998 covers 147 of 148 divisions (Newcastle ran Labor v independent and
  is absent from the HTPP product) and lands 3.75 vs the APH's 3.8 — the
  exclusion is the whole gap. All three years recompose the APH national
  figures at 1dp.
- `data/division-classifications.json` (per-election AEC seat-class
  blocks, 1996–2025) and `.build/seifa_quintiles.py` (IRSAD/IEO
  fifth-of-seats memberships, 2001–2025) — the grouping lanes.

SENATE 2025 floor: no AEC machine-readable 2025 Senate informal figure is
committed (the summary page stops at 2022; the committed Senate
first-preference downloads carry no informal rows; VTR 2025 probes of the
turnout/national-data URLs 404). When the AEC updates its summary page, a
re-fetch of it over `aec-informality-summary.html` extends the Senate
lane exactly as the 2016/19/22 rows do now.
