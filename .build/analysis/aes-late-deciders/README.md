# Do late deciders break like the decided? (AES 1990–2025)

Question (2026-11-20): the aggregate leaves each poll's undecideds out, which
assumes they split like that poll's decided voters. Should /model/ allocate
them differently?

Method: `/usr/bin/python3 late-deciders.py <AES integrated .dta>` – AES
`dcdvote` (when decided) by House vote `vthor`, weighted (1996–2007 are
unweighted in this release). Late = "a few days before" or "on election day";
decided = everyone earlier. Output `late-deciders.csv`: each party's
late − decided share, per election.

Result: late deciders (16–30% of voters) vote Coalition far less (−10.8 pts,
negative at every election), Greens +3.5, others +8.1, Labor −1.0.

Check against the polls (`.build/newtracker/primary-backtest.mjs`, A0 error =
aggregate − result at polling day): if poll undecideds broke like AES late
deciders, the polls would overstate the Coalition. They understate it
(−0.67, in 9 of 13 elections). Across 42 party-elections the late tilt does
not track the poll error (within-party r = 0.04, permutation p = 0.78).
Allocating a 5–7% undecided share at the AES tilt makes mean |error| worse
(1.23 → 1.33 / 1.39; Coalition 1.47 → 1.79 / 1.95; Greens 0.68 → 0.81 / 0.88).

Verdict: keep proportional allocation. AES late deciders are not the polls'
undecideds (most gave pollsters a party, as leaners or soft voters), and
recalled decision time is self-report. Historical poll-v-result error already
contains whatever undecideds did, so no separate undecided error term either.

## Others (added 2026-11-21)

The first check scored Labor, Coalition, Greens and One Nation but not
others. Others = 100 − the parties each election's polls itemise (so the
Democrats, DLP and independents count alike), from the same production-style
average at polling day (primary-backtest.mjs with an `othr` lane).

- The polls understate others: mean error −0.60 since 1990, understated in
  11 of 13; biggest 2022 (−2.3) and 2025 (−2.1). AES late deciders lean to
  others (+8.3 with unitemised Greens folded in) – same direction.
- Election by election they don't line up (r = +0.56, the wrong sign,
  driven by 1990's Democrat surge).
- Moving 5–7% undecided by the AES tilt, others included: others improve
  (1.02 → 0.94; 0.88 → 0.71 using only earlier elections' mean tilt), Labor
  improves a little, but the Coalition (1.47 → 1.78–1.95) and Greens worsen
  more. All parties: 1.18 → 1.24–1.28 (hindsight), 1.12 → 1.13–1.16 (earlier
  elections only). Still rejected.
- Correcting each party by its own mean past miss (earlier elections only,
  3+ of them): all parties 1.14 → 1.01, paired bootstrap over 10 elections,
  95% interval of the difference −0.30 to +0.06 – not statistically
  significant. Labor 1.56 → 1.21, Coalition 1.31 → 1.17, others 0.97 → 0.93
  (lumpy: small misses until 2022). Half correction: 1.14 → 1.05.
