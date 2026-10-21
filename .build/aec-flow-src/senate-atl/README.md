# senate-atl — Senate above-the-line preference flows

The AEC publishes no Senate flow table (there is no Senate 2PP), so these
were computed from the AEC's published **ballot-level formal-preferences
zips** (`aec-senate-formalpreferences-…` per state) for the four elections
since group voting tickets were abolished — **2016 (25108), 2019 (24310),
2022 (27966), 2025 (31496)**. Elections before 2016 ran group tickets, so
no per-ballot CSVs exist and no ORDINAL-1-reading flows can be computed.

- `analyse_atl_flows.py` — the analyser (avg_group assigned by ticket order,
  CLP→Coalition at the family map as documented in the script; see the
  `aec-senate-atl-flows` skill for every entanglement it handles).
- `counts.json` — its national + per-state ATL `counts` output, verbatim:
  for each of the five average-group families (ALP, COAL, GRN, PHON, OTHER),
  `toALP` / `toCOAL` / `neither` ballot counts, BTL papers excluded.

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

The territories elect only two senators each from small fields, so their
"neither" shares are tiny (single digits) and their shares sit far closer to
a true two-way split than the states' — the per-state tooltip prints each
point's "named neither" share so the mix is visible where it is read.
