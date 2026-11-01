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
