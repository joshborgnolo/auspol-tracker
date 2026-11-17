# Seat model — design review (2026-10-31 to 11-01)

The question, asked 2026-10-31: the site now holds polling aggregates, demographic crosstabs, the Australian Election Study and ANUpoll reports, census data back to 1993, full election results and boundaries. How should an election model be built from them? And what should we take from Collins, "Predicting Australian federal electoral seats with machine learning" (*International Journal of Forecasting* 41, 2025, 1620–1635)? Two follow-ups came later: should preference flows vary by seat type, and does IRSAD predict them better than seat type does?

This is analysis only. The W5 engine (`seat-model/swing-simulate.mjs`), its flow table and every site page are unchanged. It reviews, and in places supersedes, [the 8 October plan](seat-model-plan.md).

**Reproducing the numbers.** Every figure below comes from a script in `seat-model/design-review/`, run from the repo root, e.g. `node .build/analysis/seat-model/design-review/exp1-sa26.mjs`. The scripts only read the committed `map/data/res-*.json` stores and `data/polls.json`. `out/` holds each script's output as of 2026-11-01.

## Verdicts

1. **Build a structural simulator, not a tree model or a pendulum.** The chain: national vote, then a logit swing in each seat, then the full preference count in each seat, then thousands of simulated elections with correlated errors. About two-thirds of that already exists in W5. The missing parts are the ones that decide this race: three-way preference flows, and honest uncertainty.
2. **Spread swings with a logit shift**, not W5's 50/50 mix of proportional and uniform swing. SA 2026 is the one real test of a surging party. There, logit missed One Nation's district vote by 2.1 pts, against 2.4 for the mix and 4.5 for uniform swing.
3. **Grade the Coalition→Labor flow in Labor-v-One Nation seats by seat type.** W5 sends 21.5% of Coalition preferences to Labor everywhere. State results put it at about 40% in inner-city seats, falling to about 24% in rural ones. On today's primaries, that one constant is worth about 8 Labor seats.
4. **Keep W5's Labor→Coalition flow (60%) in Coalition-v-One Nation seats.** It matches the only federal counts: Maranoa gave 65.0% in 2019 and 57.9% in 2025.
5. **For that decisive flow, seat type beats IRSAD, and the Coalition's local vote may beat both.** IRSAD has no relationship with Coalition→Labor flows in SA 2026 (r = 0.01).
6. **Widen the uncertainty a lot.**
   - W5's national error is the spread between recent polls, 1.5–2.0 pts. Since 1972, the poll average 15–20 months out has missed Labor's primary by 4.9 pts RMS.
   - W5 has almost no flow uncertainty and no shared demographic shocks.
7. **From Collins, keep the framing, not the trees.** Correct a swing model rather than replace it, test at several lead times, and judge on the seats that change hands.

## 1. Why the outside models disagree

Seat figures as pasted on 2026-10-31, with DemosAU's MRP and W5 added:

| Model | ALP | L/NP | ON |
|---|---|---|---|
| theswingison.com | 71 | 32 | 34 |
| aeforecasts.com, forecast | 67 | 40 | 20 |
| aeforecasts.com, nowcast | 65 | 33 | 37 |
| earthelects.com | 72 | 28 | 35 |
| poliwave.com | 78 | 28 | 29 |
| auspoll.au | 82 | 23 | 33 |
| globalelectionsimulator.com | 68 | 28 | 47 |
| pollingforecast.com | 55 | 15 | 63 |
| electionforecast.net | 82 | 36 | 10 |
| DemosAU MRP (Aug–Sep 2026, n 9,740) | 84 | 34 | 24 |
| W5 engine (polls to 6 Oct) | 63 | 25.5 | 47 |

They roughly agree on Labor, but give One Nation anywhere from 10 to 63 seats.

`exp4b-federal-flows.mjs` puts today's aggregate (ALP 26.6, L/NP 22.7, ON 26.1, GRN 13.7, others 11.3) onto the 150 seats with no noise. Varying just two assumptions covers almost the whole range:

| What was varied | ALP | L/NP | ON |
|---|---|---|---|
| **Spread rule** (central flows) | | | |
| Uniform | 78 | 58 | 8 |
| 50/50 mix (W5) | 76 | 54 | 17 |
| Logit | 74 | 50 | 22 |
| Proportional | 73 | 44 | 29 |
| **Flows** (on the logit spread) | | | |
| Soft (Coalition→ON 55, Labor→Coalition 65) | 91 | 43 | 14 |
| Central | 74 | 50 | 22 |
| Right-consolidating (Coalition→ON 80, Labor→Coalition 85) | 57 | 56 | 33 |
| W5's constants | 68 | 43 | 34 |

- **The disagreement is about method, not polls.**
- **These are sensitivities, not forecasts.** The quick party-level count mishandles independents. Replaying 2025 with it gives independents 2 seats (actual 10) and the Coalition 50 (actual 43).
- **Flows decide many seats.** Under the logit spread, 42 of the 150 seats have the second- and third-placed of Labor, Coalition and ON within 5 pts on primaries.

## 2. How a surge spreads: SA 2026 (exp1–exp3, exp7)

SA in March 2026 is the closest analogue to the federal race:
- One Nation rose from 2.6% to 22.9% and the Liberals fell from 36.2% to 19.0%.
- One Nation made the final two in 31 of 47 seats.

The test: predict each district's One Nation vote from its federal 2025 vote in the same area, given only the statewide total.

| Rule | Average miss (pts) | RMSE |
|---|---|---|
| Uniform | 4.49 | 5.40 |
| Proportional | 2.70 | 3.50 |
| 50/50 mix (W5) | 2.42 | 3.05 |
| Logit shift | 2.08 | 2.73 |
| Demographic estimate (fitted on federal 2025), logit-calibrated | 2.47 | 3.15 |
| Logit + demographic blend | **1.93** | 2.65 |
| (oracle) SA 2026's own demographic fit, leave-one-out | 2.45 | 3.31 |

The fitted logit elasticity was 0.95, close to a pure logit shift (1). The pre-election blend even beat a demographic model fitted to the result itself.

- **Liberal collapse** (exp2; the 33 districts without a big change in the independent vote): logit 3.69, uniform 4.05, proportional 4.68, elasticity 1.27. Every rule is weak here.
- **Labor** (exp2, exp7):
  - Every rule misses by 5.5–5.8 pts.
  - Labor fell most in seats with few graduates. A university-share slope (3.6 pts of swing per 10 pts of graduates) explains 36% of the seat-to-seat variation. It cuts the leave-one-out miss from 5.85 to 4.94.
  - Adding more covariates overfits (6.61).
  - The Liberal swing had no education gradient.
- **Calm elections** (exp3): across federal 2016 to 2025 and Queensland 2017 to 2024, every rule misses the major parties by about 3.5 pts. That's ordinary seat-level noise, so the rule only matters for a party that is surging or collapsing.
- **The starting point matters as much as the rule** (exp3). One Nation contested only 19 SA districts in 2022. Spreading from that vote misses those districts by 4.4 pts under logit (uniform 4.4, proportional 5.6). Spreading from its federal 2025 vote in the same area misses all 47 by 2.1 (exp1).

## 3. The whole chain on SA 2026 (exp5)

Given only statewide primaries, with independents' shares taken as actual:

| Spread | Flows | ALP / LIB / ON / IND | Winners right |
|---|---|---|---|
| Logit | SA 2026 estimates (LIB→ALP 35 in ALP-v-ON) | 37 / 6 / 4 / 0 | 39/47 |
| Logit | federal central (LIB→ALP 30) | 37 / 5 / 3 / 2 | 42/47 |
| Proportional | SA 2026 estimates | 37 / 5 / 5 / 0 | 40/47 |
| Uniform | either | 32–34 / 10–12 / 1–3 / 0–2 | 37/47 |
| **Actual** | | **34 / 5 / 4 / 4** | |

Uniform swing gives the Liberals about twice the seats they actually won.

## 4. The W5 engine as of its last run (polls to 6 October)

Expected seats: ALP 63.2, L/NP 25.5, ON 47.0, GRN 4.4, OTH 2.1, sitting members 7.8. Majority chances: ALP 7.4%, Coalition 0%.

1. **Coalition→Labor in Labor-v-ON seats is 21.5% everywhere.** `flow-recipients.mjs` sets `COAL_LEAK_ALP` (11117/62419 ≈ 0.178, borrowed from a Liberal/National three-cornered leak) against `COAL_TO_ON` 0.65. That's about right for rural seats and too low everywhere else (section 6).
2. **Labor→Coalition in Coalition-v-ON seats is 60%.** That matches the Maranoa counts, so keep it (correction 2 in section 9).
3. **The spread rule is the 50/50 mix** (`PROP_MIX = 0.5`). Logit did better on the one real test.
4. **The uncertainty is too narrow.**
   - σ_nat is the dispersion between polls over 60 days: ALP 1.46, L/NP 1.92, ON 2.02 pts.
   - Flows are drawn from a Dirichlet at vote-count scale, so they barely vary, and `FLOW_DRIFT = 0`.
   - Besides seat noise (2.0 pts), seats share only state shocks (1.5) and age/gender shocks.
5. **Demographics enter only as age and gender**, estimated from one Resolve difference-in-differences. Education, which this realignment runs on, is reported by 43 polls in the crosstab data.

## 5. Lead time (exp6)

Federal 1972–2025: the election result minus the poll mean 15–20 months before.

| Measure | RMS miss, 15–20 months out | RMS miss, final month |
|---|---|---|
| Labor primary | 4.92 (n 20) | 2.10 |
| Coalition primary | 3.76 (n 20) | 2.07 |
| Labor 2PP | 4.32 (n 18) | 1.87 |

- **One Nation's level 15–20 months out has faded twice:** in 1998 (11.3 → 8.4) and 2019 (8.0 → 3.1). It held or rose in 2022 (3.5 → 5.0) and 2025 (6.0 → 6.4).
- **Only a forecast needs this.** An election-day forecast has to carry this error; an "if held today" nowcast doesn't.
- **It explains the aeforecasts gap.** This is the difference between its forecast (ON 20) and its nowcast (ON 37).

## 6. Preference flows by seat type (exp8, exp8b, exp9)

**How the state flows were made:**
- **Seat type:** state districts take the AEC class of the federal division that holds most of their booths.
- **The flows are modelled, not counted.** `.build/estimate-state-flows.py` estimates them from each electoral commission's distribution of preferences, to about ±3 pts per seat.
- **The gradient isn't built in:** the estimator has no seat-type term.

**Coalition→Labor in Labor-v-ON finals (%):**

| Source | Inner | Outer | Provincial | Rural | Pooled |
|---|---|---|---|---|---|
| SA 2026 (25 seats) | 40.4 (7) | 34.7 (13) | – | 26.1 (5) | 33.8 |
| Qld 2017 (13 seats) | – | 34.1 (3) | 30.9 (7) | 23.8 (3) | 30.2 |
| Qld 2020 (2 seats) | | | 26.0 | | |
| Federal 2025 (Hunter, Nationals) | | | | 17.1 | |
| DemosAU respondents (stated, not counted) | 48 | 37 | 30 (regional) | | |

Predicting each seat from the others (average miss, pts):
- **SA:** flat 7.31, seat type 6.24.
- **Queensland 2017:** flat 7.57, seat type 7.89. Too few seats to show a gain.

**Labor-v-Coalition flows, predicting each seat at the next election.** Federal 2010–25, average miss in pts, with the national level given:

| Donor | Flat | Seat type | Seat's own last flow | Half seat, half type | Seat-type oracle |
|---|---|---|---|---|---|
| Greens | 3.87 | 3.50 | 2.77 | **2.59** | 3.48 |
| One Nation | 3.75 | 3.68 | 4.21 | **3.31** | 3.51 |
| Others | 6.63 | 6.67 | 6.95 | **6.16** | 6.55 |

- **Labor-v-Coalition contests:** the seat's own history comes first, steadied by its seat type, steadied in turn by the national level.
- **Three-way contests:** there's almost no seat history to use. Federally, only Hunter and Maranoa have had these finals, so seat type has to carry the weight.

**Effect on seats** (exp9; logit spread, today's primaries, no noise):

| Coalition→Labor / Labor→Coalition | ALP | L/NP | ON |
|---|---|---|---|
| W5-like, flat 21.5 / 60 | 67 | 43 | 35 |
| Flat SA average, 33.8 / 60 | 79 | 43 | 25 |
| Coalition→Labor graded 40 / 34.5 / 31 / 24 (inner, outer, provincial, rural); Labor→Coalition flat 60 | 75 | 43 | 28 |
| Both graded (Labor→Coalition 75 / 70 / 65 / 60) | 75 | 45 | 27 |
| Graded, but rural 5 pts and provincial 3 pts more pro-ON | 72 | 41 | 34 |

- **Where the finals fall:** Labor-v-ON finals come in every seat type (inner 16, outer 22, provincial 17, rural 8). Coalition-v-ON finals are mostly rural (18 of 23).
- **From W5's flat 21.5 to graded flows:** Dobell, Macquarie, Shortland, Whitlam, Dunkley, Holt and Brand go from ON to Labor.
- **From a flat 33.8 to graded flows:** Lingiari, Braddon and McEwen go from Labor to ON.
- **The rural and provincial levels move the most seats.**

## 7. IRSAD v seat type (exp10, exp10b)

This was prompted by `.build/on-flow-correlates.py`. Its fixed-effects fit for One Nation's preferences gives SEIFA advantage a significant term in 2019–25. I added the IRSAD score to the same out-of-sample tests; the score is comparable across states within one census.

**Coalition→Labor in Labor-v-ON finals** (average miss in pts, predicting each seat from the others):

| Predictor | SA 2026 (25) | Qld 2017 (13) |
|---|---|---|
| Flat | 7.31 | 7.57 |
| Seat type | 6.24 | 7.89 |
| IRSAD | 7.47 | 8.34 |
| University share | 6.59 | 8.09 |
| Coalition's previous federal vote in the same area | 6.30 | 7.54 |
| Liberal retention since 2022 (SA only) | 6.27 | – |
| Coalition's primary in the seat on the day | 5.78 | 7.61 |
| Seat type + Coalition primary | 5.69 | 8.89 |

- **IRSAD's correlation with the flow is 0.01 in SA and 0.11 in Queensland.**
- **SA's poorest seats break the IRSAD idea.** Elizabeth, Ramsay, Taylor and Playford (IRSAD 814–899) gave Labor 31–46% of Liberal preferences. That's about the same as the inner suburbs, which averaged 42%.
- **The lowest flows came where the Liberals were still strong.** Hammond 21, Mawson 25, Ngadjuri 26 and Light 28 are country seats with middling IRSAD, where the Liberals still held 12–25% of the vote.

**One Nation's preferences in Labor-v-Coalition finals.** This is the flow `on-flow-correlates.py` studies. As that script found, IRSAD helps a little, and only alongside Coalition strength.

| Model | Federal 2025 (114 seats) | SA 2026 (13 seats) |
|---|---|---|
| Flat | 3.74 | 4.01 |
| Seat type | 3.69 | 4.09 |
| IRSAD | 3.59 | 3.75 |
| Coalition primary | 3.01 | 3.06 |
| IRSAD + Coalition primary | 2.90 | 2.15 |

(Average miss in pts, predicting each seat from the others in the same election.)

Predicting the next election, 2010–25:
- Coalition margin: 3.44.
- IRSAD plus margin: 3.47.
- IRSAD alone: 3.85, worse than the flat rate (3.75).
- IRSAD adds anything only in 2025 (3.23 → 3.12).

**Greens preferences.** IRSAD overtook seat type in 2025. It explains 26% of the seat-to-seat variation against 18%, and predicting the next election it misses by 3.13 against 3.23. Over 2010–25, seat history plus IRSAD (2.62) does about as well as seat history plus seat type (2.59).

**An open question about the mechanism:**
- **Within SA, seats where the Liberals kept less of their 2022 vote sent more to Labor** (r = −0.49). The voters who stayed Liberal look least like One Nation voters.
- **If that held federally, the SA-based levels would be too high.** The federal Coalition is holding about 71% of its 2025 vote, against 52% in SA, so SA's seat-type levels would overstate federal Coalition→Labor flows.
- **Queensland 2017 doesn't show it.** There's no within-state relationship (r = 0.07), and the LNP kept about 82% of its vote yet still gave Labor 30% overall.

## 8. Collins (IJF 2025)

Extra-trees and gradient-boosted corrections of the Mackerras pendulum, tested on the 2010–2022 federal elections at several lead times.

**What it reports:**
- Against the TPP proportional pendulum, extra trees misclassified 15 fewer seats in 2019 and five fewer in 2022, and one more in 2013.
- Predicting "no change" already gets about 87% of seats right.
- Pendulum and past-vote features dominate. State effects and unemployment come next, and polls add little.

**Weaknesses it admits:**
- Hyperparameters were picked retrospectively, as the best average over the five test elections (§2.2.4 and the limitations).
- The real seat count "rarely fell within the 95% confidence interval" of the extra-trees model.
- Crossbench winners were predicted no better than by the pendulum.

**Worth keeping:**
- Correct a swing model rather than replace it.
- Test at several lead times.
- Judge on seats that change hands and on marginals.

**Not worth copying:**
- Tree models can't extrapolate, and no past federal election looks like ON 26 / Coalition 23.
- Tuning on the test elections overstates the gains.
- Seats were simulated independently, which is why the intervals were overconfident.
- Predicting win or lose throws away the vote shares that a preference count needs.

## 9. Corrections made during the review

1. **"Measured" flows.** The first answer called the SA and Queensland flows measured. They are modelled estimates, accurate to about ±3 pts per seat.
2. **The 60% constant doesn't favour One Nation.** The first answer said W5's 60% Labor→Coalition constant also favours ON, comparing it with DemosAU's respondent-stated 72–82%.
   - The only counts are Maranoa's 65.0% and 57.9%, both rural, and they support 60% for rural seats.
   - The "SA 2026 flat" flow set in `exp4b` carries a DemosAU-like 77% and overstates Labor→Coalition.
3. **Graded, not flat 33.8.** The first answer proposed a flat 33.8% Coalition→Labor, the SA average. That is too high in rural seats; the fix is to grade it by seat type (exp9).
4. **The graded levels may still be too high.** Section 7's retention finding means the SA-derived levels (40 / 34.5 / 31 / 24) may be too generous to Labor federally. This is unresolved.

## 10. Recommended build

1. **National vote.** The site's aggregate, plus a model of polling error, in two modes: "if held today" and an election-day forecast. The forecast mode carries the lead-time error from section 5, and a One Nation fade fitted from history.
2. **Seat primaries.**
   - Logit swing from each seat's 2025 result, for every party.
   - One Nation's starting point blends its 2025 vote with a demographic estimate. The estimate is also needed for Bean, Canberra and Fenner, where ON didn't stand.
   - An education term from the polls' change since 2025, state terms, sitting-member effects, and carry-over for independents.
3. **Flows.**
   - Labor-v-Coalition contests: each seat's own 2025 flows, shrunk toward its seat type and the national level.
   - Coalition→Labor in three-way contests: graded by seat type, with Liberals and Nationals as separate donors.
   - Test the Coalition's local vote as a covariate: the 2025 figure now, the model's projected primary in a forecast.
   - Labor→Coalition: about 60% in rural seats, with any gradient tested before use.
   - Draw one shared shift per seat type in each simulation.
4. **Count.** The full elimination in every seat, which W5 already does.
5. **Shared errors in the simulation.**
   - National errors that are linked across parties and allow occasional big misses.
   - State shifts, and shocks shared by seats with similar education levels or rurality.
   - Seat noise. SA's seat-level misses were about 4–5 pts for the majors, against about 3.5 in calm years.

**Validation, before anything is published:**
- Run the seat chain on known statewide totals for federal 2004–2025, SA 2026, Queensland 2017/20/24, NSW 2023 and Victoria 2022.
- Run real-time backtests on federal 2010–2025 at 18, 12, 6 and 1 month out, using the poll archive.
- Tune settings only on elections before the one being tested.
- Score against a no-change baseline and the pendulum on:
  - calibrated seat probabilities
  - flips caught
  - seat-count error
  - how often the ranges contain the result

**Order** (progress, 2026-11-01: steps 1–3 done as v2 in section 12, with Senate-ballot flows in place of seat-type grades; 4 open; 5 unchanged):
1. Fix W5's flows (graded Coalition→Labor), switch it to the logit spread, widen its uncertainty, and rerun it.
2. Build the backtest harness.
3. Add the forecast mode.
4. Add the education term.
5. Decide where the model is published. The prediction page stays unlisted unless decided otherwise.

## 11. Data notes and gaps

- **Coalition-v-ON flows.** The state estimator produces none for:
  - SA 2026: Chaffey, Flinders, MacKillop, Narungga
  - Queensland 2017: Callide, Condamine, Gregory, Gympie, Lockyer, Nanango, Scenic Rim, Southern Downs
  - Queensland 2024: Southern Downs

  Adding them would give the Labor→Coalition flow more support than Maranoa's two counts.
- **Australian Election Study.** `.matilda/aes` holds the 2019, 2022 and 2025 reports and the trend tables. They give party identification by group, not vote by group. The 2025 respondent file would be the cleanest baseline for an education term, but it needs registration with the Australian Data Archive.
- **ANUpoll.** Only the June 2026 report's tables are on disk.
- **Redistributions.** The AEC's SA1-level 2025 vote file (downloaded locally, not committed) would let the 2025 results be re-cut to new boundaries.
- **DemosAU's quarterly MRP.** It is in `data/polls.json` with seat counts and regional flows. Use it for comparison, and for the shape of flow gradients but not their level.

## 12. The rebuild on Senate ballots (2026-11-01)

Asked next: is this the best possible model of preference flows, and the best use of all available data, in every direction? It wasn't. The review above never used Senate ballots, though state totals from them were already in the repo. The user then asked for the best model the data allows, online data included. Seat model v2 is that build: `swing-simulate.mjs` and the scripts named here. W5 is in git history.

### Data
- **Every formal Senate ballot, 2016–2025**, about 15 million an election, from the AEC's ballot-level files (`extract-senate-rankings.py`).
  - Per division and first-preference cohort, it counts the order in which Labor (A), the Coalition (C), the Greens (G) and One Nation (O) first appear: `data/senate-rankings-<year>.json`.
  - Per polling place, keyed by the PollingPlaceID that /map/ already uses: `.build/aec-flow-src/senate-ballots/booth-rankings-<year>.json.gz`.
  - Cross-checked against `counts.json` to within 0.44 pts in every state and year. The gaps are reading rules, not errors: this reader stops a run of preferences at the first gap or repeat, as the AEC count does.
- **The counted House flows of every excluded candidate**, 2016–2025, wherever the final pair was two of those four families: 2,830 donor-seat rows.

### The flow layer
Each candidate's voters rank the four families as that party's Senate voters in the same division did. The count replays those orders at every exclusion, so the count is exact along every path, with no pairwise table and no "share among whoever is left" assumption. That assumption misplaces right-wing minor parties' three-way splits by about 11 pts. Minor-party ballots that pass through Labor reach the Coalition 75% of the time, against 48% for all minor-party voters (exp11).

Calibration (`calibrate-flows.mjs`, logit scale):
- **House-v-Senate offsets by donor class:**
  - Greens −0.40 (the House is less Labor-ward)
  - One Nation +0.17
  - Coalition voters choosing Labor over the Greens or One Nation +0.22 (pooled with SA 2026's +0.02 as 0.15 for Labor v One Nation)
  - Labor voters choosing the Coalition +0.16
  - right / centre / left minor parties +0.15 / −0.10 / −0.26
- **Drift between elections** (the national flow shock) and **seat-level noise**, both fitted.
- **Forecast weights**, fitted election-out: how much each seat's previous-election Senate deviation and its own previous House flow count.
  - Where the House counted the flow (Labor-v-Coalition contests), the seat's own history carries most of it: Greens 0.66 House against 0.21 Senate; One Nation 0.38 against 0.20.
  - In three-way contests no House history exists and the Senate is the signal.
- **Minor parties go by party**, using each party's own Senate table. Per-seat error falls from 8.1 to 5.2 pts (exp12).
- **Today's voters for each big party are mixed from their 2025 parties** by the vote-switching tables:
  - One Nation: 23% retained, 44% ex-Coalition, 19% ex-Labor, the rest from others.
  - Coalition: 82% its own 2025 voters, 12% ex-Labor.
  - Switchers keep their old ranking with their new party moved first.

### Tests
- **2025 replay.** The certified 2025 primaries counted on the modelled flows reproduce 147 of 150 winners (148 on Senate ballots alone), 140 of 150 final pairs, and a 1.5–1.7 pt two-candidate error where the pair is right.
- **SA 2026, out of sample.** Counted from its actual district primaries, with flows from the 2025 federal Senate ballots at the nearest federal booth (`backtest-states.mjs`):

  | Flow scheme | Winners | Final pairs | Two-candidate error |
  |---|---|---|---|
  | W5's constants | 42/47 | 39/47 | 2.9 pts |
  | Section 6's seat-type grades (partly fitted on SA 2026 itself) | 44/47 | 41/47 | 1.6 pts |
  | Senate ballots | 43/47 | 41/47 | 1.7 pts |
  | Senate ballots + switching mix | 43/47 | 42/47 | 1.9 pts |

  The whole chain from the federal footprint, with noise drawn, scores Brier 0.207 for Senate + switching, 0.208 for the grades and 0.234 for W5. All schemes miss the same three independent contests.
- **Federal chain backtests**, 2019/2022/2025 from what was known three years earlier, with the actual totals given (`backtest-chain.mjs`):
  - 130–141 of 150 winners.
  - Expected seats close except 2022's teal independents, which no 2019 baseline could hold.
  - The flow variants score within noise of each other: when nearly every final is Labor v Coalition, flow geography barely moves seats.
  - Seat noise at 1.3 times the calm-year size (Student-t, 5 degrees of freedom) maximised the held-out log score.

### Swing and error settings (`calibrate-swing.mjs`, `calibrate-national.mjs`)
- **Seat residuals from a logit swing with state totals given, 2007–2025:** Labor 0.18, Coalition 0.19, Greens 0.23 logit. Fat-tailed, and rising over time.
- **SA 2026:** the collapsing Liberals 0.46, One Nation's surge only 0.16. The model adds a term that grows with a party's fall (k = 0.47) and uses the surge figure for One Nation.
- **National polling error (logit RMS):**
  - final month: Labor 0.098, Coalition 0.094, Greens 0.18, One Nation 0.29 (five cycles)
  - 13–20 months out: 0.19, 0.15, 0.36, 0.47
  - Labor and Coalition errors correlate at −0.68.
- **Minor-party fade:** about 0.6 of a logit surge since the last election fades by polling day. That is fitted on small surges, so the election-day mode draws the fade from 0 to 0.6 and the nowcast applies none.

### 2028 (polls to 27 October 2026: Labor 26.6, Coalition 22.7, Greens 13.7, One Nation 26.1, others 11.3)
| Mode | Labor | Coalition | One Nation | Greens | Independents | Labor majority |
|---|---|---|---|---|---|---|
| If held today | 72 [53–90] | 31 [16–48] | 35 [13–61] | 4 | 8 | 41% (no majority 57%) |
| Election day, about 17 months out | 83 [55–107] | 40 [17–64] | 15 [0–46] | 4 | 8 | 74% |

Brackets are 90% ranges. In the nowcast, Labor-v-One Nation finals average 63 and 39 seats have no candidate above 60%. The election-day numbers are mostly the fade assumption.

### Corrections to the sections above
- Section 6's seat-type grades were about 8 pts too generous to Labor in provincial seats. The Senate puts provincial Coalition voters near rural ones.
- W5's flat 60% Labor→Coalition holds in the bush only. Senate: inner 84, outer 74, provincial 63, rural 64.
- "Others" and the minor parties' three-way splits were guesses in exp4b/exp9, worth about seven seats.
- The "who left" composition idea fails for the Coalition: it predicts 73% on SA 2026 against 34%. It works for One Nation's own flows.

### Still open
- **How-to-vote decisions.** The 2025 Coalition card put One Nation above Labor almost everywhere. A different call would move many seats, and no card data is in the repo.
- **The education term** (order step 4). The vote layer has no 2025 baseline wave with education. *Tested in v2.1: no fixed term (section 13).*
- **Independents' flows**, which depend on the candidate.
- **The Queensland 2017 test**, using the 2016 ballots, now in the repo. *Done in v2.1 (`backtest-states.mjs`, section 13).*
- **A /map/ preference lens.** The booth tables are ready for one. *Built: /map/'s Preferences lens reads the Senate ballots (d568cef8).*

## 13. v2.1, the /model/ page and the daily run (2026-11-01)

### v2.1 (cd06daf1)
- **National flow shocks sized on observed drift.** The level shift between a Senate election and the next House count, pooled over federal 2019–2025 and six state elections (`backtest-states.mjs` `drift`): logit RMS One Nation 0.46, Coalition 0.30, Greens 0.27, right minors 0.48. Section 12 had capped them at 0.35.
- **The Coalition's Labor-v-One Nation offset is 0**, from its own four counts (Hunter +0.24, SA 2026 +0.02, Queensland 2020 −0.12, Queensland 2017 −0.58). Section 12's 0.15 borrowed Labor-v-Greens finals.
- **Education: no fixed term.** Within each pollster, the graduate gap moved One Nation +0.01, Greens +0.06, Labor +0.21, Coalition +0.17 logit (`calibrate-education.mjs`). One Nation's and the Greens' surges spread as the logit swing implies; the major parties' moves are worth at most ~1.5 pts in the most extreme seats, inside the education shock.
- **One Nation's 2022 "sitting members last" card** shows no incumbency effect in the counts, so there is no lever for it.
- **One implementation.** The engine is four pure modules (`seat-engine`, `senate-flows`, `seat-build`, `model-sim`) that node and the page both run.

### The six state elections, read in full
| Totals over SA 2026, Qld 2017, Vic 2022, Qld 2020, Qld 2024, SA 2022 (461 seats) | Final pairs right | Winners right |
|---|---|---|
| Senate ballots (the model) | **444** | 436 |
| Seat-type grades (section 6, partly fitted on SA 2026) | 438 | **440** |
| Fixed rates (W5) | 425 | 432 |
| Diagnostic: Senate pattern, statewide levels set to the count | 441 | 441 |

The Senate ballots pick the final pair best, which is the three-way routing doing its job. On winners they do not beat the seat-type grades: what decides most seats here is each party's statewide level, which a class average captures as well as the seat pattern, and Queensland 2017's 0.7-logit drift holds most of the gap. The model keeps the Senate for coverage (every party's voters, every pair, every direction) and because taking minor parties one by one cuts the per-seat miss on their counted flows from 8.1 to 5.2 pts (exp12; that gain is from going by party, measured with House rates). Section 12's "the Senate flows tie or beat" was about W5's constants only. The page says all of this, generated from the table.

### One Nation's national polling error
The model draws min(own RMS, max(Greens', 0.25)) logit: 0.25 now (its own five-election record says 0.285) and 0.358 on election day (own 0.468). Using its own record instead (20,000 draws each):

| | One Nation seats, 90% range | One Nation majority | Labor majority |
|---|---|---|---|
| Now, as drawn | 36 [13–63] | 1.7% | 38.0% |
| Now, its own record | 36 [12–66] | 2.4% | 38.4% |
| Election day, as drawn | 16 [0–48] | 0.9% | 71.6% |
| Election day, its own record | 17 [0–54] | 1.6% | 70.3% |

The shrinkage trims One Nation's upper tail by a few seats and changes no headline. The page's polling-error table shows what the model draws, with the raw record beside it.

### The page (`/model/`, 85daba0c)
- More menu item 6, federal only. Sources in `.build/model/` (app parts, `views.mjs`, `page.css`), assembled by `assemble.mjs` into `model/model.js` and `model/model.css`; the four engine modules are copied byte-identical into `model/js/` for a module Web Worker. `export.mjs` writes `model/data/inputs.json` (unrounded, so the browser reproduces the engine) and `evidence.json`. `test-model-bundle.mjs` (npm test) pins the copies and a 300-draw reproduction.
- The headline is written by rules in `views.mjs` (majority ≥90% / 60–90%; otherwise most seats with a majority clause at <20 / 20–40 / 40–60%), the same rules that write each official run's `national.headline` for the More menu.
- Every figure on the page is read from the stores. The state-backtest prose is generated from its table by stated rules.

### The daily run
`.build/model/refresh.mjs` rebuilds the vote layer into a temp file and re-runs the nowcast and forecast only when its content (provenance aside) or another model input has moved; then the page's stores, the assembly, guards and the bundle test. `.build/seat-model-refresh.sh` commits through `refresh_site` and `push_main`. `seat-model-refresh.yml` runs at the dispatch clock's 06:30 Sydney slot with a cron twin; agent-repair watches it.

### Still open
- How-to-vote decisions: an explorer lever only; no card data.
- Independents' flows, which depend on the candidate.
- One Nation's polling-error floor (above).
- A /map/ lens for the model's seat chances.

## 14. v2.2: every election since 1993 (2026-11-01)

The user asked why the backtest started at 2019 and the flow fit at 2016, when the repo holds results back to 1993.

**Why those dates.** The flow model reads Senate ballots. Before 2016 about 95% of Senate votes were a single 1 above the line, adopting the party's group ticket, so no voter's own order is recorded. The House-v-Senate calibration (2,802 rows) pairs a seat's House flow with its Senate rankings, which only exists from 2016. The Senate-mode backtest needs the previous election's ballots, so it starts at 2019.

**What the older data could test.** The House results, swing columns and counted flows go back further: every seat from 1996 to 2025, and 123 of 147 seats in 1993. The repo also holds the full distribution of preferences for every election since 1993. None of the swing or noise needs the Senate. This section uses all of it.

### Sitting members (`extract-incumbency.mjs` -> `data/house-incumbency.json`)
- **The res stores' sitting column is wrong.** It is 0 from 2007, marks the *winner* in 2004, and is a same-name match before that.
- **Sources:**
  - 2007–2025: the AEC's HistoricElected. It includes by-election winners (Phelps 2019) and renamed seats (Leigh, Fenner). It also flags any sitting MP, so Banks in Flinders 2019 is classed as a mover.
  - 1993–2004: the previous general election's winners re-contesting, plus a by-election list. The 1990 winners come from psephos, from the final count's capitalised name.
- **The 1996/2001 CD-ROM SittingMemberFl is not used.** It misses by-election winners (Abbott, Latham, Georgiou) and long-serving members (Cadman, Jones, Pyne).
- **Checks:** sitting members standing per election run from 115 to 140 seats, and the lost-seat counts look right (1996 lost 32; 2001 lost 7).

### Seat terms (`swing-fit.mjs`, `calibrate-swing.mjs`)
**Model:** logit swing from the notional previous share, with state totals given and Huber IRLS (k 1.5). Reversion is fitted in a second stage on the first stage's residuals.

| 1996–2025, logit | Sitting member | Previous member gone | Defection | Reversion |
|---|---|---|---|---|
| Labor | +0.099 | −0.075 | −0.237 | −0.204 |
| Coalition | +0.098 | −0.125 | −0.208 | −0.100 |
| Greens | +0.099 (borrowed) | −0.100 (borrowed) | – | −0.252 |

- **Stable by era.** 2010–2025: Labor +0.122 / −0.080 / −0.193; Coalition +0.081 / −0.092 / −0.103.
- **The Greens' sitting members are too few to fit.** There are nine contests. Their own estimate, +0.28 / −0.29, points the same way, so they take the major parties' average.
- **Out of sample** (terms refitted before each of 2001–2025, scored on it), typical seat miss:
  - Labor: RMS 0.181 → 0.173, better in 8 of 9 elections.
  - Coalition: RMS 0.218 → 0.210, better in 6 of 9, though the MAE is worse in 2007, 2016, 2019 and 2022.
  - Greens: RMS 0.238 → 0.231, better in 7 of 9.
- **Seat noise left** (1996–2025): Labor 0.167 → 0.159, Coalition 0.219 → 0.204, Greens 0.230 → 0.221. Kurtosis gives t df 5.0 / 4.3 / 6.1, so df 5 stands.
- **Seat-type shocks:** 0.035–0.054 measured, against the model's stated 0.06 (0.09 for One Nation). Left as stated.
- **State deviations:** Labor 0.13, Coalition 0.137, Greens 0.188, One Nation 0.225.
- **State elections:** sitting members against open seats their party held, recovered from the previous state winners:

  | Election | Labor | Liberals / LNP |
  |---|---|---|
  | SA 2026 | +0.44 | +0.44 |
  | Qld 2024 | +0.32 | −0.07 |
  | Qld 2020 | +0.21 | +0.18 |

  So in a realignment the personal vote cushions a collapse. The federal sizes may be conservative for 2028.
- **Independents:** established independents re-standing move little (mean about 0, SD about 0.25 logit). That supports sigMember 0.30 and no sophomore term. Defectors collapse.
- **kFall:** the federal record has no fall the size of the 2028 Coalition's. Falls of 0.2–0.35 logit show extra noise of 0–0.5 per unit fall, inconclusive. kFall stays at SA 2026's 0.47.

### The long backtest (`backtest-long.mjs` -> `data/seat-model-backtest-long.json`)
**Setup:** every election 2001–2025 from the one before, with the national vote given and state shocks drawn. Seat terms are fitted before E. Noise is the RMS of the three previous elections' residuals × a multiplier.

**Flows ("house" mode):** the previous House count's flows by party, set on the 2016 Senate ballots' shape by tilting each observed pair to P's state and national level, then each seat toward its own P flow (n/(n+1500)). The 2016 shape is the only borrowed piece, and it matters only for three-way splits.

| 2001–2025, 1,352 seats | Brier | Log | Winners right |
|---|---|---|---|
| v2.1 (no seat terms, ×1.3) | 0.1569 | −0.3221 | 1,218 |
| v2.2 (terms, ×1.3) | 0.1527 | −0.3170 | 1,221 |
| Sitting-member terms only | 0.1530 | −0.3163 | 1,218 |
| Reversion only | 0.1564 | −0.3201 | 1,214 |

**Candidly, by election:**
- The terms win clearly in 2001, 2004 and 2007, which is where the pooled gain comes from.
- They lose in 2013, 2019 and 2022, so the four elections from 2016 slightly favour v2.1 (mean Brier 0.1779 v 0.1812; 2001-2013 0.1400 v 0.1299).
- The two terms pull opposite ways in seats that changed hands last time. In 2016 and 2019 those seats swung back, and reversion was right. In 2022 and 2025 the new members held, and the sitting-member term was right.
- On the Senate ballots (`backtest-chain.mjs`, out-of-sample flow settings), 2019 / 2022 / 2025 winners: 140 / 130 / 130 with the terms against 140 / 131 / 131 without.
- Adopted anyway, on the nine-election pooled scores, the out-of-sample vote shares and SA 2026. The page says the gain is before 2016.

**The noise multiplier.** Mean Brier over 2016–2025:

| Multiplier | 1.0 | 1.15 | 1.3 | 1.5 | 1.7 |
|---|---|---|---|---|---|
| Brier | 0.1837 | 0.1826 | 0.1812 | 0.1812 | 0.1815 |

- Over 2001–2025, 1.0 is best (0.1517), because seats strayed less in the 2000s.
- The rule: the recent window by Brier, ties to the smaller multiplier. **1.3 stays**, now on nine elections, not three.
- Not log score. From 1.3 up it keeps rising only through wins no starting point foresees: new independents, Mayo 2016 (Curtin 2022: p 0.0000 → 0.0010). Those buy a net +2.2 log points while 522 of the 602 recent seats lose a combined 15.7 (`AUSPOL_BL_DUMP`).
- df 4 ≈ 5 > 8 on both scores.

### Preferences, cross-checked (`flow-drift.mjs` -> `data/seat-model-flow-drift.json`)
National House splits between Labor and the Coalition, 1993–2025, and their logit drift between elections:

| | Greens | One Nation | Right minors | Other minors | Left minors |
|---|---|---|---|---|---|
| Split, first to last year | 68 → 87.5% | 46 → 26% | | | |
| House drift since 1993 | 0.205 | 0.282 | 0.18 | 0.17 | 0.30 |
| Model draws | 0.27 | 0.46 | 0.48 | 0.33 | 0.35 |

- One Nation's drift has two card-driven jumps, −0.63 in 2019 and −0.49 in 2025.
- The model's draws are wider in every group. That is right: they measure Senate-to-count drift, which includes model error, not only time.
- Unchanged. The page says so.

### 2028 effect
- **The terms, by seat:**
  - Labor's 2025 first-termers gain about +0.10 (Dickson +0.12, with the LNP −0.11 for Dutton's lost personal vote).
  - Brisbane and Melbourne move about 0.05–0.09 from the Greens to Labor.
  - Calwell's Labor vote recovers +0.21 from its 2025 collapse.
- **Means over seats** (national totals still solved exactly): Labor +0.03, Coalition −0.01, Greens 0.
- **Victoria** has no sitting-member record in its stores, so it keeps the plain-swing noise (`modelSettings({plainNoise: true})`).

## 15. Victoria v2.3: the real field, state-fitted errors, respondents and cards (2026-11-16)

The Victorian run (28 November 2026) until now assumed 2022's candidates stood again, borrowed every error from federal elections and took One Nation's preferences from federal counts. Twelve days out, the things it assumed are on the record. What changed, and what each test found:

### The field (`vic-field.mjs`, `data/vic-candidates-2026.json`)
- **Nominations closed 9 November: 734 candidates.** Labor, the Greens, One Nation and the Victorian Socialists stand in all 88; the Liberals in 77 (the Nationals alone in their nine seats and both Bendigos; Ripon is the only three-cornered contest); 91 independents in 56 districts, 12 of whom stood in the same district in 2022.
- **2022's strongest independents are gone** (Cupper, Sheed, Hawkins, Lardner, Lowe). The old run stood them again and gave independents 1.25 seats on their 2022 votes.
- **Starting shares:** 2022 Assembly share where the party or person stood (430); One Nation from the federal 2025 footprint in all 88 (one scale; its five 2022 districts were on another); the party's 2022 Council share where it stood only for the Council (90; `data/vic-lc-2022-by-district.json`, scaled by its Assembly/Council ratio where it stood for both: Victorian Socialists 1.36, Family First 1.52, Animal Justice 1.66); a median for the 126 with no record (2.5% minor party, 1.6% independent).
- **New independents carry their own spread** (`c.sig`, the one engine change in `model-sim.mjs`): the logit SD of 2022's 123 independents, 1.24. Independents average 0.9 seats; the last four elections elected 0, 1, 3 and 0.
- **Districts whose 2022 independent is gone** have shares summing under 1 (Mildura 0.68); the swing is applied first and the gap spread in proportion to post-swing shares, so One Nation takes more of an orphaned vote than a 2022-level split would give it.

### Sitting members (`calibrate-state-swing.mjs`, `data/seat-model-state-swing.json`)
- **Four state elections on unchanged boundaries** (Victoria 2018, Queensland 2020 and 2024, NSW 2019; 367 district pairs), statewide totals given, Huber fit, bootstrap SEs.
- **Member stands again +0.055 (se 0.018, n 284); member gone −0.111 (se 0.046, n 62)**, both against districts the party did not hold. By party: Labor +0.068 / −0.048, Coalition +0.040 / −0.183; the differences are not significant (z 0.8 and 1.3), so one pair serves both, and the Greens.
- **State personal votes are not larger than federal ones** on this evidence (federal: +0.10 / −0.075 to −0.125). The SA 2026 gap of 0.44 was one collapse; across ten elections including redistributed ones the gap is 0.18–0.25, and in the four collapses in the stores it is 0.21.
- **2026:** 67 of 88 sitting members stand again; 21 do not (11 Labor, 7 Coalition, 1 Green, 2 who left Labor). A by-election successor of the same party carries both terms.
- **District noise** at state elections: 0.235 (Labor) and 0.253 (Coalition) after the terms, 0.246 (Greens, plain), against about 0.21 federally.

### Polling error (`state-polls/`, `calibrate-state-polls.mjs`, `data/seat-model-state-polls.json`)
- **19 state elections 2010–2026** with a polling table on Wikipedia (NSW 2015 and 2019 have none there): the mean of the final month's polls against the result, logit scale.
- **RMS: Labor 0.096, Coalition 0.080, Greens 0.161, the rest 0.193**; federal final month 0.098, 0.094, 0.183. The page had said state polls were "if anything" less accurate. They are not.
- **Labor is under-polled at state elections**: mean +0.048, above its polls in 13 of 19, t = 2.5. Federally the lean runs the other way (−0.059), so the run adds neither.
- **One Nation at 5%+**: four elections, RMS 0.199, over-polled in all four (mean −0.146). It keeps the federal floor (0.25).

### Preferences
- **Published two-party figures were below the old run's** (43–46 against 46.5 implied). The gap was One Nation's level.
- **No count has ever sent less than 25.5% of One Nation's preferences to Labor** (federal 2025; Queensland 2024, with Labor losing office, 26.9; Queensland 2017 and 2020, 33). Victorian respondents (RedBridge/Accent) said 25% in February 2026, matching the 2025 count in Victoria (25.0%), then 9–13% from August. The same house's Coalition-to-Labor-over-One-Nation reading is 37–38% against the Senate tables' 28%.
- **Rule:** where Victoria has its own count (Greens 86.0%, minor parties 49.1%, 2022) the count sets the level. Every level involving One Nation starts from the federal reading and moves halfway, on the logit scale, to the respondents of the six weeks to the newest poll. One Nation to Labor 17%; Coalition to Labor over One Nation 32%.
- **Halfway is a judgement** (`RESPONDENT_WEIGHT`). Federal readings alone: Coalition 42.8 seats, One Nation 10.8, Coalition majority 39%. Respondents alone: 46.5, 7.5, 62%. Official: 44.8, 9.1, 52%. The count on 28 November is the first test of a reading that moved.
- **Implied two-party vote** now 44.5 for Labor against the Coalition (seven polls: 43–46) and 53.0 against One Nation (four polls: 54–55).

### How-to-vote cards (`.build/vic/model-2026/htv/`, `data/vic-htv-2026.json`)
- **The VEC's register read for all 88 districts** (264 cards: text layers, except the Nationals' twelve, whose numbers are artwork, read by eye).
- **The cards follow the federal pattern**: Labor has Greens, Coalition, One Nation in 86 (open in Caulfield and Prahran); the Liberals and Nationals have One Nation, Labor, Greens in 83 (Labor ahead of One Nation in Greenvale and Preston, open in Brunswick and Footscray, none registered in Williamstown); One Nation has the Coalition ahead of Labor in all 88.
- **What a card is worth**, from the stores: the Liberal card's reversal between 2010 and 2013 moved Coalition voters' share to Labor over the Greens from 19.6% to 66.9% in Melbourne and Batman (2.11 logit). A reversed card moves its voters that far, an open card half as far, the pairs fitted together. Measured on Liberal voters only; Labor's open cards borrow it.

### Result (polls to 13 November: Labor 22.1, Coalition 31.2, One Nation 21.9, Greens 13.8, others 11.0)
| | Before | v2.3 |
|---|---|---|
| Coalition | 43.2 | **44.8** (32–57) |
| Labor | 25.4 | **26.3** (15–38) |
| One Nation | 11.7 | **9.1** (1–22) |
| Greens | 6.4 | **6.8** (4–10) |
| Independents | 1.25 | **0.9** (0–3) |
| Coalition majority | 43% | **52%** |

### Still open
- By-elections change who sits, not the starting vote. Prahran is the case that matters: the Liberals won it in 2025 with Labor absent, and the run makes the Greens 4-in-5 favourites on the 2022 count.
- Candidates disendorsed after nominations closed (One Nation in Preston, the Liberals in Williamstown) are counted as their party's.
- The cards were read from the register as listed on 16 November; registration ran to 20 November.
- The federal explorer's card button still assumes a third of voters follow a card (35 points); the stores now measure 47.
- After 28 November: score the run, and the two ends of the respondents' judgement, against the count.

## 16. Federal v2.3: who sits now, independents from the record, preferences by who is left (2026-11-17)

The question was whether Victoria's v2.3 changes (section 15) carry over to the federal model. Each was checked against the federal stores. Three carry over and are built; two are already the federal model's rule; one cannot be had until nominations.

| Victoria v2.3 | Federal counterpart | Verdict |
|---|---|---|
| The real field (nominations) | No one is nominated until 2028. What is on the record: by-elections, changes of party, retirements | **Built**: the candidate overlay was empty |
| New independents as a draw from the record | The federal model gave no independent outside Parliament any chance | **Built**, and extended to sitting independents |
| Sitting-member terms | Already fitted on federal elections (v2.2) | Extended to a by-election winner and a member who changed party |
| Polling error and district noise fitted on state elections | Already fitted on federal cycles | No change; One Nation's floor checked against the state record |
| Levels with no count moved halfway to respondents | Each federal level has a federal count | No change (that is the Victorian rule's own principle); the two ends are now printed |
| Registered how-to-vote cards | None registered until 2028 | The explorer's card button now uses the measured reversal |

### Who sits now (`candidate-overlay-2028.json`, `build-candidate-set.mjs`, `seat-inputs.mjs` adjFor)
- **The overlay held nothing**, so the model still stood Sussan Ley as Farrer's sitting Liberal and Barnaby Joyce as New England's sitting National. The /map/ page's own record (`map/data/data-now.json`) had both changes.
- **Farrer**: One Nation's David Farley won the by-election of 9 May 2026. The Liberals give back Ley's personal vote; One Nation's member takes the two major parties' average sitting-member term (0.0985 logit), as the Greens' do. The starting vote stays the 2025 count, as in Victoria ("by-elections change who sits, not the starting vote").
- **New England**: Joyce has sat for One Nation since 8 December 2025 and has not settled whether to stand there again (`recontests: null`). The Nationals lose their member's personal vote; no One Nation member and no defection term is assumed. Set to `true`, the Nationals' term goes from −0.15 to −0.36 and One Nation gains 0.0985.
- **Capricornia**: Michelle Landry's retirement was announced on 23 October 2026.
- `test-fed-model.mjs` fails when the overlay and the /map/ record of the House disagree.

### Independents from the record (`independents.mjs`, `calibrate-independents.mjs`, `data/seat-model-independents.json`)
- **What the model did**: sitting independents moved with the polls' "others" (down 0.36 logit since 2025, so Kooyong read Liberal 69%, Bradfield 73%, Fowler Labor 56%); 2025's losing independents stood again as minor candidates who take no preferences (Goldstein's final pair read Liberal 75–25); nobody new could appear. Independents averaged 7.3 of the 12 seats they hold.
- **Sitting independents' own record**: 27 have recontested since 1996 and 23 held. Their vote rose by 0.16 logit on average (se 0.06, spread 0.31). Regressed on the national change in "others" the slope is 0.52 (se 0.27): moving with others at slope 1 misses by 0.34 RMS, their own mean by 0.31. When others fell 0.33 in 2004 the three sitting independents averaged +0.10.
- **Polls understate "others" between elections**: at 13–20 months the poll mean sat below the result in each of the last five cycles (by 0.07 to 0.73 logit, mean 0.28), and in the final month in eight of nine since 2001 (mean 0.12). Not applied: the nowcast quotes the site's aggregate as it stands. It is a second reason not to tie a member's vote to that figure.
- **Everyone else**: 1,570 seat-elections 1996–2025 where a party held the seat. What the strongest independent polled next depends on what one polled before, and on the era. Before 2019, of 22 seats with an independent on 10% or more, one stayed strong. In 2019–2025, 13 of 23 kept at least half and four won.
- **The draw**: one challenge per party-held seat; its share is a level drawn from the window's seat-elections, weighted by a normal kernel on the logit of the previous share (width 0.5, floor 1%). From 5% up the draw stands in for the 2025 candidate (36 seats); below, only a drawn challenger of 10% or more is added.
- **Waves**: each simulated election takes every seat's draw from one of the window's elections. New challengers passing 10% in seats with none before: 5, 15 and 19 in 2019, 2022 and 2025; winners 0, 5 and 0.
- **Independents are outside the national swing**: their shares stand as drawn, the seat's parties share the rest, and the "others" target is met by minor parties (`seat-engine.mjs` spreadShares, `free`). National party totals still hit the polls exactly.
- **Tested and dropped**: sending a lapsed challenger's voters where their preferences went scored worse than sharing them in proportion (Brier 0.1576 v 0.1552). Hughes 2025 fits the preference rule; Wentworth 2007, Dickson 2001 and Nicholls 2025 do not.

### What an independent takes of preferences (`seat-inputs.mjs` certifiedShares, `seat-engine.mjs` count)
- **One share per donor class was wrong whenever the alternatives changed.** It sent 72% of One Nation preferences to Labor over an independent, and 65–73% of Coalition preferences to an independent over One Nation.
- **Two cases, measured on the 2025 count** (pile by pile, leaving aside ballots to other minor candidates): while a party of the voters' own side still stands, an independent took 46% of a Greens pile and 35% of a One Nation pile; once only the other side is left, 75% of a Labor pile and 70% of a Coalition pile. A Coalition candidate's pile with its partner standing: 12%.
- **Two cases 2025 never counted come from Farrer 2026**, the one count of an independent against One Nation: Coalition voters 37% to the independent (22,473 votes), Greens voters 92%.
- **Checked on counts it was not measured on**: the four SA 2026 districts where an independent reached the final two. Mean absolute error of the independent's two-candidate share 6.4 → 3.3 points (Stuart +6.4 → +1.5, Kavel −6.7 → −2.1, Finniss −9.2 → −5.0, Mount Gambier −3.5 → −4.7).
- **2025 replay**: winners 147 → 148 of 150, final pairs 140 → 147, two-candidate error 1.48 → 0.91 points. The 11 challengers' finals are within 0.8 on average.

### The backtest (`backtest-long.mjs` terms-ind28, terms-indrec; national vote given, 2,000 draws)
Both variants know only what a forecast would: who sits, and how independents polled last time. The reference variant (`terms`) is told the whole field.

| | Brier | Log | Independents expected v 39 elected |
|---|---|---|---|
| Old treatment, 2001–2025 | 0.1529 | −0.329 | 22.6 |
| The record, 2001–2025 | 0.1541 | −0.300 | 31.8 |
| Old, 2019–2025 | 0.1761 | −0.432 | 12.0 v 23 |
| Record, 2019–2025 | 0.1728 | −0.343 | 20.2 v 23 |
| Old, 2001–2016 | 0.1413 | −0.278 | 10.6 v 16 |
| Record, 2001–2016 | 0.1446 | −0.279 | 11.6 v 16 |

- **Candid verdict**: better on the log score and where independents matter (2019–2025); a little worse on Brier before 2019, when independents were rare and every seat still carried a small chance. About a third of that early cost is 2016's One Nation seats, which sit at 50–50 in every variant and flip on any small change.
- **Calibration** in party-held seats 2019–2025: the record expected 8.2 independent wins and 10 happened; by chance given, 0–0.5%: 0.4 v 3, 6–15%: 2.2 v 5, 15–40%: 2.1 v 0. Still cautious overall.
- **The baseline's sitting independents looked safe by artefact.** Handed the true "others" total, it inflated them (Dai Le 43% modelled, 33.5% polled; Monique Ryan 44% v 33.9%). The comparison above gives neither variant the votes of independents it cannot see.
- **Robustness** (pooled Brier / log): window of 2 elections 0.1548 / −0.305, 5: 0.1551 / −0.302, all: 0.1548 / −0.301; kernel 0.35: 0.1557 / −0.306, 0.8: 0.1548 / −0.302; no drift for sitting members 0.1559 / −0.305. All within run-to-run noise. Three elections tracks the rising count of winners best (expected 8.7 of 13 new winners, against 6.7 and 5.5 for longer windows).

### Checked, no change
- **One Nation's polling error**: federal record 0.285 logit (five cycles), state elections at 5% or more 0.199 (four). Pooled over nine: 0.25, the floor the model already draws.
- **Respondents**: the one federal poll in the six-week window publishing its respondents' allocation has One Nation voters 17% to Labor (count: 25.5%) and Coalition voters 41% to Labor over One Nation (table: 27%). Halfway: One Nation 34 seats, Labor 62. Respondents alone: 31 and 64. Official: 36 and 60. The page prints all three.

### Result (polls to 8 November)
| | Nowcast before | v2.3 | Election day before | v2.3 |
|---|---|---|---|---|
| Labor | 64.3 | **60.1** (40–79) | 77.2 | **73.0** (42–97) |
| One Nation | 39.7 | **36.3** (14–63) | 17.4 | **15.5** (1–48) |
| Coalition | 34.3 | **29.4** (14–47) | 43.8 | **38.1** (16–64) |
| Independents | 7.3 | **20.1** (14–27) | 7.5 | **19.7** (14–27) |
| Greens | 4.5 | 4.2 | 4.1 | 3.7 |
| Labor majority | 17% | **9%** | 59% | **48%** |

Independents: 10.7 of the 12 sitting hold on average, and challenges win 9.4 of the other 138.

### Still open
- **The 9.4 is above any election on record** (seven in 2022). By 2025 share: seven seats on 20% or more give 2.2, 17 on 10–20% give 3.8, 12 on 5–10% give 1.2, and the other 102 give 2.2. The record's own win rates for those bands (25%, 13%, 6.5%, 0.8% in 2019–2025) would give 5.6; the rest comes from the count, where major-party primaries of 26 and 23 let a smaller independent vote win.
- **One election in the stores has a field that split**: SA 2026 (One Nation 22.9%, Liberals 19.0%). Four of its five independents on 15% or more won, one from fourth place on 18.1% (Finniss). At federal 2022, federal 2025 and SA 2022 together, independents on 15–30% won 5 of 30. Small numbers; they point the same way as the model.
- The record cannot say whether 2025's challengers stand again; treat single seats as rates, not forecasts.
- **Boundaries**: Tasmania, South Australia and the ACT were redrawn in July 2026 (Bean gained the Woden Valley); Queensland's redistribution is due in September 2027. The base is still the 2025 count on 2025 boundaries.
- **Farrer** reads Liberal 37%, One Nation 36%, independent 27% from the 2025 count, where One Nation won the by-election 58–42. Whether a by-election count should move the starting vote needs the record of federal by-elections against the next general election, which is not in the stores.
- **Victoria** still counts with one share per class and moves independents with "others". Its 79 new independents and its independent-v-One Nation finals would be affected.
- First-term independents rose more (0.28 v 0.16 logit, not significant). Only Bradfield and Calare are first-term now.
- The page was checked by rendering its copy in node (`test-model-page.mjs`), not in a browser: layout at each width is unverified.

## Scripts (`seat-model/design-review/`)

| Script | Question |
|---|---|
| `lib.mjs` | Shared helpers: store loading, booth tables, ridge regression, logit shift |
| `exp1-sa26.mjs` | Which spread rule best predicts One Nation's SA 2026 district vote from its federal 2025 footprint? |
| `exp2-sa26-lib.mjs` | The same for the Liberal collapse and Labor's fall |
| `exp3-elasticity.mjs` | Spread rules and logit elasticities across five calmer transitions |
| `exp4-federal.mjs` | Today's primaries on the 150 seats under each spread rule and three flow sets |
| `exp4b-federal-flows.mjs` | The same, adding W5's flows and a flat SA flow set |
| `exp5-sa26-seats.mjs` | The whole chain on SA 2026 from statewide primaries |
| `exp6-horizon.mjs` | Poll error 15–20 months out and in the final month, 1972–2025 |
| `exp7-realign.mjs` | How much demographics explain SA 2026's district swings |
| `exp8-class-flows.mjs` | Does seat type predict a seat's flows at the next election? |
| `exp8b-threeway.mjs` | Three-way flows by seat type in SA 2026, Queensland and federal 2025 |
| `exp9-class-seats.mjs` | Federal seats under flat and graded three-way flows |
| `exp10-irsad.mjs` | IRSAD, university share and Coalition strength against seat type |
| `exp10b-coal-mechanism.mjs` | Local Coalition strength or retention: why the Coalition's vote predicts its flow |
| `exp11-three-way-splits.mjs` | Can three-way splits be built from pairwise flows? (2025 Senate ballots) |
| `exp12-minor-parties.mjs` | Minor parties' flows by party v lumped |

v2's own scripts sit one level up in `seat-model/`:
- `extract-senate-rankings.py`, `senate-flows.mjs`
- `calibrate-flows.mjs`, `calibrate-swing.mjs`, `calibrate-national.mjs`
- `seat-engine.mjs`, `seat-inputs.mjs`, `swing-simulate.mjs`
- `backtest-chain.mjs`, `backtest-states.mjs`
- v2.2: `extract-incumbency.mjs`, `swing-fit.mjs`, `backtest-long.mjs`, `flow-drift.mjs`
- v2.3: `independents.mjs`, `calibrate-independents.mjs`, `test-fed-model.mjs`; Victoria's `vic-field.mjs`, `calibrate-state-polls.mjs`, `calibrate-state-swing.mjs`, `test-vic-model.mjs`
