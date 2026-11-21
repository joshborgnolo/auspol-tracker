---
name: auspol-aec-vote-type-mix
description: auspol-tracker — answering "how votes were cast" (on-day / early-centre / postal / absent…) by STATE or AEC division classification (worked 2026-11-06 on the 2025 election, reproducing the AEC's published national buckets exactly). The two file gotchas: in HouseFirstPrefsByCandidateByVoteType *OrdinaryVotes includes early-voting-centre (PPVC) votes* and PrePollVotes is DECLARATION pre-poll only; the on-day↔early split needs HouseTppByPollingPlace with booths classified by NAME (PPVC / Special Hospital|Remote Mobile|Other Mobile teams).
source: auto-skill
extracted_at: '2026-11-06T06:19:00.891Z'
---

# Vote-type mix by geography (AEC federal events)

**Situation:** a question like "do vote types (on the day / early centres /
postal …) differ by state or by rural-vs-metro seat type" for a federal
election. Worked for 2025 (event 31496) on 2026-11-06; validated by
reproducing the AEC headline buckets (formal 15,490,236; On the day 41.0 /
Early centres 38.6 / Early, by declaration 3.4 / Postal 13.6 / Absent and
other 3.4).

## The two source files and their division of labour

1. `HouseFirstPrefsByCandidateByVoteTypeDownload-<EVENT>.csv` — **vendored**
   at `atlas/data/aec-2025/` (2026-10-08 fetch). Per CANDIDATE rows with five
   vote-type columns: `OrdinaryVotes, AbsentVotes, ProvisionalVotes,
   PrePollVotes, PostalVotes`. Sum across a division's candidates (SKIP the
   `PartyNm === "Informal"` pseudo-row when you want a formal-vote basis).
   Column semantics, established empirically against the AEC's published
   national buckets:
   - **`OrdinaryVotes` = on-day booths + PPVC (early voting centres) + mobile
     teams.** It is NOT "on the day" (national 79.6% ≠ headline 41.0%).
   - **`PrePollVotes` = declaration pre-poll ONLY** ("Early, by declaration" —
     national 3.4% matches exactly).
   - Absent, Provisional, Postal map straight onto the headline buckets
     (the headline folds Absent+Provisional into "Absent and other").
2. `HouseTppByPollingPlaceDownload-<EVENT>.csv` — fetched live
   (`https://results.aec.gov.au/<EVENT>/Website/Downloads/…`, ~5.9 MB for
   2025, one row per polling place). Splits Ordinary into geography:
   - Header cols: `StateAb,DivisionID,DivisionNm,PollingPlaceID,PollingPlace,
     <ALP> Votes,<ALP> %,Liberal/National Coalition Votes,<%>,TotalVotes,Swing`
     (NO `PollingPlaceTypeID` column, no declaration pseudo-booths).
   - Booth class by NAME: contains `PPVC` → early voting centre (this also
     catches interstate CBD centres, e.g. "Wynyard WENTWORTH PPVC", booked to
     the voter's home division); `^(Special Hospital|Remote Mobile|Other
     Mobile)` → mobile teams; everything else → on-day booth.
   - `TotalVotes` per booth reconciles EXACTLY with the division formal total
     (worst residual 0.00% across all 150 in 2025) — summing TPP totals by
     class gives vote counts, no proportionality fudge.
   - **AEC headline "On the day" = day booths + mobile teams** (2025: 40.3%
     booths + 0.7% mobile = 41.0%). Remote Mobile teams are a real slice only
     in the NT (14.2 pt NT-wide; 30.7 pt of Lingiari's formal vote).

Classification: join division names to the cDem cells of
`HouseDivisionClassifications-<EVENT>-NAT.htm` (see skill
aec-division-classifications; all 150 matched by name, 0 misses, 2025).
Parse both CSVs with the RFC-4180 `splitRow` from
`.build/analysis/seat-model/extract-2025-baseline.mjs` (quoted party names).

**Validation invariants before trusting a mix table** (all held 2025):
national formal = AEC figure (15,490,236); per-file sums reproduce the
published buckets; sum of booth classes == `OrdinaryVotes` total.

Script from the worked run: `.matilda/vote-type-mix.mjs` (uncommitted
scratch; re-fetch the two non-vendored inputs if evicted).

## Computed 2025 reference tables (share of formal votes, %)

By state/territory (Mobile = hospital+remote+other mobile teams):

| | On-day | Early-ctr | Mobile | Early-decl | Postal | Abs+prov |
|---|---|---|---|---|---|---|
| National | 40.3 | 38.6 | 0.7 | 3.4 | 13.6 | 3.4 |
| NSW | 44.6 | 38.7 | 0.5 | 2.9 | 10.3 | 3.0 |
| VIC | 37.3 | 38.0 | 0.5 | 3.6 | 17.1 | 3.6 |
| QLD | 32.4 | 43.6 | 0.7 | 3.8 | 16.2 | 3.2 |
| WA | 41.4 | 37.8 | 0.6 | 3.9 | 11.7 | 4.6 |
| SA | 48.9 | 30.0 | 0.8 | 3.0 | 13.3 | 3.9 |
| TAS | 55.8 | 25.3 | 0.9 | 2.7 | 12.0 | 3.3 |
| ACT | 45.5 | 40.4 | 0.4 | 4.3 | 7.4 | 2.1 |
| NT | 25.1 | 47.8 | 14.2 | 6.2 | 4.8 | 1.9 |

By AEC classification (div counts IM 43, OM 45, Prov 24, Rural 38):

| | On-day | Early-ctr | Postal | Abs+prov |
|---|---|---|---|---|
| Inner Metropolitan | 43.7 | 34.1 | 13.7 | 4.1 |
| Outer Metropolitan | 40.1 | 37.6 | 15.2 | 3.8 |
| Provincial | 37.8 | 41.8 | 13.7 | 2.8 |
| Rural | 38.4 | 42.6 | 11.6 | 2.6 |

Extremes worth citing: on-day lowest Lingiari 16.9 (NT), then QLD
rural/provincial row (Fisher 23.0, Hinkler 23.9); highest Bass 58.6 and the
rest of TAS. Early centres highest Hinkler 55.7 / Kennedy 55.3 / Fisher
55.2; lowest Bass 20.4 / Clark 23.6. Postal highest Macnamara 21.8, McEwen
21.5, Scullin 21.4, Rankin 21.3 (then a VIC/QLD outer-metro run ≥20.5);
lowest Lingiari 3.4, Solomon 5.8. Pattern: state dwarfs classification
(30+ pt state spreads vs 3–9 pt class spreads); rural/provincial seats lean
early centres, postal vote is an OUTER-METRO (not rural) skew, absent is an
INNER-metro skew.

Framing for answers: with ~15.5m votes every gap is statistically
unassailable; report practical effect sizes (points), not p-values.

Related: `auspol-aec-event-downloads` (CSV family anatomy + splitter),
`aec-division-classifications` (cDem page parsing),
`auspol-map-vote-type-panel` (the same buckets as /map/'s product block,
vt/vt2 lane and renderer gates).
