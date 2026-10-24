# nswec-lc-flow-src — NSW Legislative Council above-the-line preference flows

The NSW Electoral Commission publishes no Legislative Council
preference-flow table (a state upper house has no 2PP), so these were
computed from the commission's published **ballot-level preference-data
zips** (one statewide file per election, every formal vote's recorded
preferences) for the four elections it covers: **2011 (SGE2011),
2015 (SGE2015), 2019 (SG1901), 2023 (SG2301)** — 2011 is as far back as
the ballot-level publication reaches, and the current above-the-line
group-voting option has been in force since 2003. Source zips, all under
`https://pastvtr.elections.nsw.gov.au/`:

- `SG2301/LC/statewide/SG2301 LC Pref Data Statewide.zip` — 124,431,335 bytes
- `SG1901/LC/state/SGE2019 LC Pref Data Statewide.zip` — 124,075,355 bytes
- `SGE2015/data/lc/SGE2015 LC Pref Data Statewide.zip` — 103,565,020 bytes
- `SGE2011/data/sge_2011_lc_preferences.zip` — 652,275,238 bytes

(`analyse_nsw_lc.py` reads the first three as `SGE2015-LC-Statewide.zip` /
`SGE2019-LC-Statewide.zip` / `SG2301-LC-Statewide.zip` — rename or download
under those names.) Reconciliation live pages, same host:
`/SG2301/LC/statewide/cc/fp_summary`, `/SG1901/LC/state/cc/fp_summary`,
`/SGE2015/lc/state/cc/fp_summary/index.htm`; for 2011, the official
reports are committed in `published/` (below).

- `analyse_nsw_lc.py` — the 2015–2023 analyser. Of each formal
  above-the-line ballot
  (types `SATL`, a single "1", and `RATL`, a numbered ATL run; below-the-line
  papers excluded, as in the federal Senate analyser) it takes the counted
  group sequence — the `PreferenceNumber` column, which the NSWEC fills only
  for a valid consecutive run from 1 — restricts it to {ALP, Coalition} and
  files the ballot under its first-preference group as flowing to whichever
  family it ranks first. Ballots ranking no major are counted beside
  ("named neither" — a ballot that names no major is NOT exhausted; most
  stay with minor groups). Guard: the run **stops** if its formal total or
  any group's pref-1 ATL count differs from the NSWEC's `OFFICIAL` table.
- `analyse_nsw_lc_2011.py` — the 2011 analyser, same estimand and output
  shape. The 2011 file layout differs (one expanded
  `BTL_EXPANDED_PREFERENCE_ID,VC_BALLOT_PAPER_ID,PREFERENCE,CANDIDATE_ID,TYPE`
  csv, ~111M records, each ballot's ATL marks pre-converted to its groups'
  candidate lists, `TYPE` preserving SATL/RATL/BTL), so it got its own
  script rather than complicating the 2015-23 one. It merges
  `events["2011"]` into `counts.json`. Guards: the run **stops** if the
  formal total differs from the NSWEC r02 report's 4,076,024, if any of
  the 17 groups' (A–P plus ungrouped) pref-1 ATL count (SATL+RATL ballots)
  differs from the same table, or if any group's SATL/RATL split differs
  from Antony Green's *NSW Election 2011 — Final Analysis* (NSW
  Parliamentary Library Briefing Paper 3/2011, pp.44–53) "Ticket Votes
  (no preferences)/(with preferences)" rows.
- `published/` — the committed 2011 evidence: the NSWEC's r02 first
  preferences by group and r08 group-by-vote-type reports
  (`sge2011-r02-fp-by-group.pdf`, `sge2011-r08-group-by-votetype.pdf`),
  BP 3/2011
  (`pnsw-2011-election-final-analysis-BP3-2011.pdf`, from
  `parliament.nsw.gov.au` via the Wayback Machine), the printed authority
  for the 2011 SATL/RATL reconciliation the analyser pins against,
  the r09 party/group result lists (`sge2011-r09-party-group-result.html`
  — the candidacies behind the family mapping: group C is John Hatton's,
  group J Pauline Hanson's unnamed independent ticket, landed in OTHER),
  and the zip's own layout document (`sge2011-Readme.doc`).
- `counts.json` — the analysers' output: per election, the formal total
  (matching the official figures at 4,076,024 / 4,316,498 / 4,451,146 /
  4,616,858), ATL and BTL totals, `groupFirst` per group reconciling
  exactly with the official per-group ATL first preferences (17, 24, 20,
  21 groups — 2011 additionally carries `groupSatl`/`groupRatl` re-pinned
  against the printed BP table), the five families' `toALP` / `toCOAL` /
  `neither` counts, their `pa` and `pc` blocks (both below), and
  `oneOnly` — how many of each family's ATL ballots numbered just the
  one box.

## The second tally (`pa`, added 2026-10-23)

Both analysers also take a **second tally** of the same verified ballots,
restricted to {ALP, PHON} instead of {ALP, Coalition} — the twin of the
federal `analyse_atl_flows.py` second tally. Each ballot's group sequence
is checked for Labor and One Nation: per first-preference family it files
`ALP_first` / `ALP_only` / `PHON_first` / `PHON_only` / `neither` (a
ballot naming only one of the pair still counts its way). The five cells
per family sum exactly to that family's ATL count — the run's own guards
already pin the ATL totals, so the pa blocks sit on the same reconciled
ballot set. One Nation ran no LC group in 2011 or 2015, so those years'
PHON cells are zero and the site's display series nulls them (a pair
nobody could rank is a gap, never a zero).

## The third tally (`pc`, added 2026-10-24)

Both analysers also take a **third tally** of the same verified ballots,
restricted to {Coalition, PHON} — the twin of the federal
`analyse_atl_flows.py` third tally. Each ballot's group sequence is
checked for the Coalition and One Nation: per first-preference family it
files `COAL_first` / `COAL_only` / `PHON_first` / `PHON_only` /
`neither` (a ballot naming only one of the pair still counts its way).
The five cells per family sum exactly to that family's ATL count — the
run's own guards already pin the ATL totals, so the pc blocks sit on
the same reconciled ballot set. As with `pa`, 2011 and 2015 have no One
Nation LC group: those years' PHON cells are zero and the site's display
series nulls them.

## What the site draws

`/flows-explained/`'s Upper view, NSW pick (FLOW_HISTORY_NSW_LC in
`.build/newtracker/flows.mjs`, pinned by `.build/test-nsw-lc-atl-flows.mjs`
against this folder's counts):

- **share** = `100 · toALP / (toALP + toCOAL)` — of that family's ATL
  ballots naming at least one major party, the share naming Labor first
- **named neither major** = `100 · neither / (toALP + toCOAL + neither)`
- a family with **zero ATL ballots** in a year is `null` in the table (One
  Nation ran no Legislative Council group in 2011 or 2015 — Pauline
  Hanson's 2011 ticket was her own unnamed independent group J, family
  OTHER), never a zero

The "1 only" share (`oneOnly` of `atl`) is most NSW upper-house voters:
84.0% in 2011, 84.4% in 2015, 71.6% in 2019, 62.3% in 2023 — the caption
sentence rides these figures, so the test re-derives them from
`counts.json` too.

The One Nation tab draws the same NSW pick through
`FLOW_HISTORY_NSW_LC_ON` (pinned by
`.build/test-nsw-lc-atl-on-flows.mjs` against this folder's `pa` blocks):

- **share** = `100 · (ALP_first + ALP_only) / (ALP_first + ALP_only +
  PHON_first + PHON_only)` — of that family's ATL ballots naming Labor
  or One Nation, the share ranking Labor ahead
- **named neither** = `100 · neither / (the five cells)`
- **coal / grn / oth** cohorts only (no ALP or PHON self-cohorts); 2011
  and 2015 are all-null (no One Nation LC group ran)

The Coalition v One Nation tab draws the same NSW pick through
`FLOW_HISTORY_NSW_LC_CON` (pinned by
`.build/test-nsw-lc-atl-con-flows.mjs` against this folder's `pc`
blocks):

- **share** = `100 · (COAL_first + COAL_only) / (COAL_first + COAL_only +
  PHON_first + PHON_only)` — of that family's ATL ballots naming the
  Coalition or One Nation, the share ranking the Coalition ahead
- **named neither** = `100 · neither / (the five cells)`
- **alp / grn / oth** cohorts only (no COAL or PHON self-cohorts); 2011
  and 2015 are all-null (no One Nation LC group ran)
