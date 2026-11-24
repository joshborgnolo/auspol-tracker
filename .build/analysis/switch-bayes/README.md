# Vote switching on a Bayesian model (2026-11-24)

The prototype, backtest and fake-data check behind `.build/newtracker/switch-model.mjs`
(gen-data §5bm), which replaced the six-week pools behind "Where One Nation's voters are
coming from" / "Where X's voters are going" and the masthead replay's switching table.

- `readings.mjs`: the tables as gen-data reads them (onSourceWaves' wave set, switchFlows'
  closed rows). 28 tables: YouGov 19, DemosAU 8, RedBridge 1; out: three DemosAU MRPs that
  reuse its waves, YouGov 24 Mar 2026 (no "other" row; complete tables only, the user's ruling).
- `recipe.mjs`: the six-week nowcast it replaced, copied.
- `fit.mjs`: one fit on every table, beside the recipe (`node fit.mjs`).
- `backtest.mjs [variant]`: each table predicted from the tables released before it
  (refit each time, its house's lean included) against the recipe.
- `fakedata.mjs [reps] [zero] [omega]`: tables simulated from a known truth (the real fit's
  smoothed path, fitted leans and κ) with the real design and whole-point rounding, refitted.
- `widthcheck.mjs`: where today's interval comes from (drift, not the leans).
- `runavg.mjs`: the model's table today v its run average (the replay's pattern).

## Results (base settings: ω per destination party, zero read as 0.5, jump at Taylor)

| | model | recipe |
|---|---|---|
| next-table error, all 600 cells | 2.15 | 2.33 |
| One Nation rates (x→ON, ON kept) | 2.91 | 3.03 |
| One Nation's gain split | 2.58 | 2.83 |
| 95% predictive cover | 97% | 93% (Coalition row 89%) |

Variants (all cells): one ω 2.14, ω per row 2.22, κ per house and row 2.14, damped trend
2.19, no leader-change step 2.20, zero read as 0.25 2.20 / 0.1 2.28; ω held at
0.002/0.004/0.008/0.015/0.03 a day: 2.22/2.21/2.19/2.15/2.13 – the tables can't tell slow
drift from fast, so the fitted (fast, ≈0.03 for shares going to One Nation) setting stands
and today's intervals are wider than the pools claimed (Coalition→ON ±6.3 v ±3.2).

Fake data (40 reps, zero 0.5): today's 95% intervals cover 94.8%, past months 94.1%, the
change since February 92.8%. Zero read as 0.25: 87.9% (One Nation's kept share 53%, bias
+2.1). A share rising steadily all year reads ~1 point behind at its newest point
(Labor→Coalition), so "since February" tests err toward no clear change.

The masthead replay's probe check (One Nation's inflow within 2 points of the table's
proportions) failed before the switch (6.6 points with the pooled table against today's
aggregate) and fails less after it (4.7): the two-house tables imply vote changes the
all-house aggregate doesn't, and the replay must net to the aggregate.
