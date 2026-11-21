# When do the polls go wrong? (federal primaries, 1972–2025)

Question (user, 2026-11-21): the polls miss at elections (2025: about 2.9 on
the 2PP). Can a historical primary-vote chart be adjusted for that, and how,
given the miss is only known on polling day?

Data: `data/polls.json` at HEAD (cyclePolls + elections), the production
estimator copied verbatim (within-term house leans, SHRINK_K 1.5; 21-day
window at polling day, six-week window early in a term). "Everyone else" =
100 − Labor − Coalition, the same in every era. Past rows have no sample
sizes (n = 1200 throughout).

```
node .build/analysis/poll-error-timing/timing.mjs [--from 1972] [--json out.json]   # tables + T1–T4
node .build/analysis/poll-error-timing/head-start.mjs                               # w0, the share of the miss present at the start
node .build/analysis/poll-error-timing/term-lines.mjs 2025 0 0.4 1                  # one term's lines, raw v drawn through the counts
```

## Findings

| test | result |
|---|---|
| T1 does a miss carry into the next term? | No. The first 45 days of a new term jump back toward the count: s = 0.82 ± 0.28 since 1972, 1.33 ± 0.39 for terms opening 1987+ (s = 1 full reset; carry-over would read ~0.1 once sampling noise is allowed for). Honeymoon ±1.25 for the party that formed government. |
| T2 are consecutive misses related? | No: r = +0.07 Labor, −0.10 Coalition, −0.09 everyone else (permutation p 0.67–0.80). There is a standing lean: Labor over in 16 of 21 since 1972 (mean +0.9), Coalition under in 15 (mean −0.9). |
| T3 do misses scale with the real change between counts? | No: slopes −0.05 ± 0.10 (Labor), +0.05 ± 0.11 (Coalition). A correction should drift steadily over time, not rescale the moves. |
| T4 does the late campaign trend run on past the last polls? | Not for the majors (Labor −0.08 ± 0.17, Coalition +0.11 ± 0.12). For everyone else the polls overshoot late moves: +0.34 ± 0.11, p 0.008 (1990, 1998, 2001 drive it). |
| term length | No sign that longer terms end with bigger misses, so a miss doesn't simply build up over the term. |
| w0, the head start | Net of the honeymoon, the early-term gap carries 0.17–0.56 of the coming miss (8 window × era versions; e.g. 0.34 [90% −0.12..0.68] 1975+, 0.56 [0.27..0.93] 1987+, 45-day window). Within a term, start gap v final miss r = +0.65 Coalition, +0.60 everyone else, +0.23 Labor (1987+, n 11). "The whole miss all term" (w0 = 1) is outside every 90% interval. "None at the start" (w0 = 0) is outside only in the 1987+ early windows. |

Reading: at each election the old error goes and a new term-level error
starts, about 40% of it visible early and the rest arriving at an unknown
time. Adjusted line for a completed term:

    adjusted(t) = polls(t) − e·[w0 + (1 − w0)·f],   f = share of the term elapsed

With e = the polling-day miss, the line starts at the opening count and ends
exactly on the closing count. Variance split (V = Var e ≈ 2.7, σε ≈ 0.5):
the bias uncertainty given the count is about ±1.5 (95%) for most of the
term, narrowing in the last months. The raw line's own bias uncertainty
mid-term is about ±2.6, around the standing Labor lean.

Example, 2022–25 at w0 0.4: the Coalition's primary lead in Jan 2025 goes
from 38.9 v 30.5 (polls) to 37.1 v 33.1. Labor's Jan 2023 peak goes from
38.3 to 39.7 (38.9 at w0 0, 41.0 at w0 1).

Not tested: whether the polls' early-term Labor lean (+0.7 to +1.4 beyond
the honeymoon and the head start) is error or a real mid-term Labor bump.
No count can tell, so the adjustment leaves it in.
