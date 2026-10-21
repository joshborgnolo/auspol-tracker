# nswec-lc-flow-src — NSW Legislative Council above-the-line preference flows

The NSW Electoral Commission publishes no Legislative Council
preference-flow table (a state upper house has no 2PP), so these were
computed from the commission's published **ballot-level preference-data
zips** (one statewide file per election, every formal vote's recorded
preferences) for the three elections it covers: **2015 (SGE2015),
2019 (SG1901), 2023 (SG2301)**. Source zips, all under
`https://pastvtr.elections.nsw.gov.au/`:

- `SG2301/LC/statewide/SG2301 LC Pref Data Statewide.zip` — 124,431,335 bytes
- `SG1901/LC/state/SGE2019 LC Pref Data Statewide.zip` — 124,075,355 bytes
- `SGE2015/data/lc/SGE2015 LC Pref Data Statewide.zip` — 103,565,020 bytes

(`analyse_nsw_lc.py` reads them as `SGE2015-LC-Statewide.zip` /
`SGE2019-LC-Statewide.zip` / `SG2301-LC-Statewide.zip` — rename or download
under those names.) Reconciliation live pages, same host:
`/SG2301/LC/statewide/cc/fp_summary`, `/SG1901/LC/state/cc/fp_summary`,
`/SGE2015/lc/state/cc/fp_summary/index.htm`.

- `analyse_nsw_lc.py` — the analyser. Of each formal above-the-line ballot
  (types `SATL`, a single "1", and `RATL`, a numbered ATL run; below-the-line
  papers excluded, as in the federal Senate analyser) it takes the counted
  group sequence — the `PreferenceNumber` column, which the NSWEC fills only
  for a valid consecutive run from 1 — restricts it to {ALP, Coalition} and
  files the ballot under its first-preference group as flowing to whichever
  family it ranks first. Ballots ranking no major are counted beside
  ("named neither" — a ballot that names no major is NOT exhausted; most
  stay with minor groups). Guard: the run **stops** if its formal total or
  any group's pref-1 ATL count differs from the NSWEC's `OFFICIAL` table.
- `counts.json` — its output: per election, the formal total (matching the
  fp_summary pages at 4,316,498 / 4,451,146 / 4,616,858), ATL and BTL
  totals, `groupFirst` per group reconciling exactly with the pages'
  per-group ATL first preferences (24/24, 20/20, 21/21 groups), the five
  families' `toALP` / `toCOAL` / `neither` counts, and `oneOnly` — how many
  of each family's ATL ballots numbered just the one box.

## What the site draws

`/flows-explained/`'s Upper view, NSW pick (FLOW_HISTORY_NSW_LC in
`.build/newtracker/flows.mjs`, pinned by `.build/test-nsw-lc-atl-flows.mjs`
against this folder's counts):

- **share** = `100 · toALP / (toALP + toCOAL)` — of that family's ATL
  ballots naming at least one major party, the share naming Labor first
- **named neither major** = `100 · neither / (toALP + toCOAL + neither)`
- a family with **zero ATL ballots** in a year is `null` in the table (One
  Nation ran no Legislative Council group in 2015), never a zero

The "1 only" share (`oneOnly` of `atl`) is most NSW upper-house voters:
84.4% in 2015, 71.6% in 2019, 62.3% in 2023 — the caption sentence rides
these figures, so the test re-derives them from `counts.json` too.
