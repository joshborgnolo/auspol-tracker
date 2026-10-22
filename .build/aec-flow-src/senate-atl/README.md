# senate-atl — Senate above-the-line preference flows

The AEC publishes no Senate flow table (there is no Senate 2PP), so these
were computed from the AEC's published **ballot-level formal-preferences
zips** (`aec-senate-formalpreferences-…` per state) for the four elections
since group voting tickets were abolished — **2016 (20499), 2019 (24310),
2022 (27966), 2025 (31496)**. Elections before 2016 ran group tickets, so
no per-ballot CSVs exist and no ORDINAL-1-reading flows can be computed.
(2016 is event **20499** — its ballot files use a positional-string
`Preferences` column, with `*` and `/` for pref 1 and a dashes second row;
the candidate layout comes from
`aec-senate-candidateinformation-20499.zip`, whose `nom_ty` = S rows in
ticket order set each ATL slot's family. The other three events carry a
one-column-per-group CSV and `SenateCandidatesDownload-<EVENT>.csv`.)

- `analyse_atl_flows.py [EVENT]` — the analyser (avg_group assigned by
  ticket order, CLP→Coalition at the family map as documented in the
  script; see the `aec-senate-atl-flows` skill for every entanglement it
  handles). Takes every EVENT in {20499, 24310, 27966, 31496}; its
  per-election output lands in `atl_flow_results-<EVENT>.json` beside
  the data (`AEC_DATA_DIR`/`AEC_RESULTS_DIR` point the runs elsewhere).
- `merge_pa_counts.py` — folds the four events' Labor-v-One-Nation pair
  counters (`pa`, the second tally the analyser always takes now) into
  `counts.json`'s `pa`/`paStates` blocks. Recomputes every committed
  `counts` block byte-for-byte first: nothing is written on a mismatch.
- `counts.json` — the four events' national + per-state ATL counts,
  verbatim: for each of the five average-group families (ALP, COAL, GRN,
  PHON, OTHER), `toALP` / `toCOAL` / `neither` ballot counts (the Labor-v-
  Coalition cut), and under `pa`/`paStates` the pair counters of the
  Labor-v-One-Nation cut (`ALP_first`, `ALP_only`, `PHON_first`,
  `PHON_only`, `neither`), BTL papers excluded throughout.

## What the site draws

`/flows-explained/`'s Upper view (FLOW_HISTORY_SENATE in
`.build/newtracker/flows.mjs`, pinned by `.build/test-senate-atl-flows.mjs`
against this folder's counts):

- **share** = `100 · toALP / (toALP + toCOAL)` — of that family's ATL
  ballots naming at least one major party, the share naming Labor first
- **named neither major** = `100 · neither / (toALP + toCOAL + neither)`
- a family with **zero ATL ballots** in a state-year is `null` in the table
  (One Nation had no Senate tickets in the ACT in any of the four elections,
  none in the NT until 2025), never a zero

And the Labor v One Nation tab's Upper view of the same ballots
(FLOW_HISTORY_SENATE_ON, pinned by `.build/test-senate-atl-on-flows.mjs`
against the `pa` blocks):

- **share** = `100 · (ALP_first + ALP_only) / (ALP_first + ALP_only +
  PHON_first + PHON_only)` for the three cohort families (COAL, GRN,
  OTHER) — of the cohort's ATL ballots naming either party, the share
  ranking Labor ahead (a ballot naming only one of the pair counts its
  way, as the House cut's "naming at least one major" does)
- **named neither** = `100 · neither / (the five cells' sum)` — for
  these ballots never "exhausted": a One Nation contest's unranked share
  still elects someone
- the same all-null rule marks a state-year with no One Nation ticket;
  the ACT sits out that menu

The territories elect only two senators each from small fields, so their
"neither" shares are tiny (single digits) and their shares sit far closer to
a true two-way split than the states' — the per-state tooltip prints each
point's "named neither" share so the mix is visible where it is read.
