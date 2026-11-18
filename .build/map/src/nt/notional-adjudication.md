# NT notional Labor-v-CLP 2PP — adjudication

Started 2026-11-19, from the user report that /map/'s nt24 Fannie Bay page
carried no "classic" (Labor v Coalition) two-party figure.

## The question

Each NT division's mirrored NTEC page (`.build/state-flow-src/nt/<year>/`)
publishes only the final-pair TCP count. Where that pair isn't Labor v CLP
(nt16: 7 of 25 divisions; nt20: 5; nt24: 10), the forked question is what,
if anything, the map shows for a Labor-v-Coaliton two-party figure.

## Provenance ladder (what was found)

1. **nt16 — OFFICIAL.** The NT Electoral Commission itself ran alternative
   two-party distributions in all seven non-classic divisions
   post-election. Antony Green's ABC summary document
   (`abc.net.au/dat/news/elections/nt/2020/guide/NT2016_Results.pdf`, p.12)
   states verbatim: “The Northern Territory Electoral Commission carried
   out alternative two-party preferred counts in seven districts. These
   were in four Labor-Independent contests (Barkly, Blain, Karama,
   Nhulunbuy) and three Country Liberal-Independent contests (Araluen,
   Goyder, Nelson).” Figures transcribed from that table (its “(*)
   alternative count” rows) into `notional-2pp.json`.
2. **nt20/nt24 — Antony Green's published figures, termed “alternative
   two-party preferred counts” in his post-election summaries.** No NTEC
   publication of equivalent counts exists (their results pages carry no
   such lane, and Google/NTEC site sweeps turn up none — 2016 was the last
   cycle the commission visibly did this itself). Wikipedia's per-seat
   result boxes for 2020 and 2024 mark them “Estimated two-party
   (-preferred) count by Antony Green” (the ag2pp reference → his analysis
   posts), so the safe provenance is “Antony Green estimates, as published
   by Antony Green/ABC”. Filed with `provenance: estimated-green` so the
   map labels them `estimated`, never `notional`.
   - nt20's four rows were transcribed from the seat result boxes of
     *Results of the 2020 Northern Territory general election* on Wikipedia
     (each box cites AG's “2020 Northern Territory Election – Analysis of
     Results” post).
   - nt24's nine rows were transcribed from the per-division two-party
     table in `abc.net.au/dat/news/elections/nt/2024/guide/NT2024-ResultSummary.pdf`
     (rows flagged “2 – Alternative two-party preferred count for 2024
     election”), which also publishes the territory-wide ex-Mulka total
     ALP 41,102 v CLP 57,583 (41.6/58.4).
3. **Computing our own was tried and rejected.** A counterfactual replay
   of each division's printed distribution-of-preferences (actual rounds
   until the divergence, then a family-pooled split of the swapped pile)
   lands up to ~10pts from the published/official figures on remote
   IND-heavy divisions — cleanest counterexample: this method gives
   Nelson-nt16 ALP 47.8% against NTEC's official alternative count of
   43.0%. (The physical recount re-reads every ballot's majors-pair
   preference directly; pooled flows can't.) The engine was removed;
   `.build/map/nt_parse.py`'s DOP parser remains for the tcp upgrade below
   and its own integrity asserts.

## Adjudicated consequences

- **All-row set check**: each frame's "non-classic final pair AND both
  major parties stood" division set equals `notional-2pp.json`'s division
  set exactly (asserted by build_nt_common — fail-loud).
- **Mulka 2020 (no CLP candidate), Mulka 2024 (no ALP candidate)**: no
  majors pair can ever be defined — nothing is filed.
- **Nelson 2024 tcp upgrade**: NTEC's Nelson page never printed a TCP lane
  (its summary reprints primaries; the builder previously fabricated the
  final pair from primaries), but its Distribution-of-preferences table
  runs the complete count to the final two → the canonical tcp now comes
  from the DOP (CLP 3,949 v Ind 1,155), replacing the primaries-as-tcp
  3,653/743 fiction. Margin changes 76.4 → 77.4; the elected member is
  unchanged. Recorded deliberately in nt_parse's parse log.
- **DOP-vs-summary micro-drifts**: NTEC's own pages contradict themselves
  by 1–31 votes (DOP snapshot vs post-recheck summary/per-centre lanes;
  ±9 recorded across three elections) — pinned per-division in
  `nt_parse.DOP_SUMMARY_DIVERGENCES` with the summary lane canonical (the
  per-centre TCP sums prove it). Antony Green's classic-row figures in his
  summary tables follow the DOP lane (e.g. Karama 2024: AG's 2542/1605 is
  NTEC's DOP print; the summary lane canonical here says 2537/1599), so
  headquarters totals differ from his published totals by ~±30 votes,
  territory-wide shares by ≤0.1pt. Build prints both as a cross-check.
- **No 2PP swings on notional rows**: `tpp[2]` stays null everywhere a
  row rides `tppe` (swing-vs-estimate is an estimate squared), exactly as
  `build_nt_past_common.py` already gates on the pair being classic in
  both elections. (NTEC's 2016 alternative counts could define 2016→2020
  swings for those seven seats — deliberately NOT made now.)

## Filing semantics on the map

- nt16 rows file as plain `tpp` (official alternative counts) — the seat
  head shows them under the existing “(notional, …)” label.
- nt20/nt24 rows file as `tpp` + `tppe: 1` — the seat head shows
  “(estimated, …)”, and the territory head figure pools classic counts
  with the estimates into the ex-Mulka 24-division 2PP (Antony Green's
  practice for the territory figure is the same).
