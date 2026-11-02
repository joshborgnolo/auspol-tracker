# Group swings from the AES: education, housing and age terms for /model/ (2026-11-02)

**Question.** The Australian Election Study's respondent files now reach back to 1987. Should the seat model add
education or housing terms, or change its age and gender term?

**Verdict: no change to the model.** Coalition education is the one place the AES finds a real signal, and it moves
seats by under one.

- **History.** Even with the AES's real group swings, the Coalition's seat-share error falls only from 4.60 to 4.54
  points. Labor, the Greens and One Nation gain little or nothing.
- **Age and housing.** Neither ever helped.
- **Now.** The polls show the largest Coalition education shift in the AES record. Even so, applied in full it moves
  expected seats by under one, inside the model's existing random education shock.

## What was tested

### 1. Past elections (`backtest.mjs` → `out/backtest.txt`)

- **Setup.** The model's own swing fit (`../swing-fit.mjs`) leaves each seat a residual at every election 1996–2025.
  That fit is a logit swing solved to each state's exact result, plus the sitting-member terms.
- **Test.** Each AES election-to-election change in a group's vote was applied to the seats through their census mix.
- **Fair comparison.** The AES's group swings are the real national ones, so these gains are a ceiling on anything
  polls could deliver.

| Seat-share RMSE, pooled 1996–2025 (points) | Labor | Coalition | Greens | One Nation |
|---|---|---|---|---|
| Model's swing fit | 3.27 | 4.60 | 1.92 | 1.59 |
| + AES education swing (logit gaps) | 3.27 | 4.54 | 1.91 | 1.58 |
| + AES age swing (as the model does it, points) | 3.28 | 4.62 | 1.98 | 1.57 |
| + AES housing swing | 3.27 | 4.61 | 1.92 | 1.57 |
| + all three, as joint effects | 3.28 | 4.54 | 1.93 | 1.56 |
| Ceiling: each election's own slopes fitted in-sample | 2.99 | 4.29 | 1.78 | 1.50 |

- **Errors are mostly local.** Even the in-sample ceiling, with five demographic slopes refitted at every election,
  removes only 5–9% of the error.
- **Coalition education is the exception.** Its AES gap change predicts the seats' education slope (r 0.65, at full
  scale: slope 1.14). That includes One Nation's 1998 surge (AES +0.56 logit, seats +0.68) and 2001 collapse
  (−0.70, −0.56).
- **Greens:** they track too (r 0.81), but their education swings are too small to matter.
- **Labor:** r −0.01.
- **Age:** the AES's age-gap changes don't predict the seats' age slopes at all (r −0.05 Labor, −0.23 Coalition,
  −0.20 Greens).
- **Housing:** no gain.

### 2. This cycle's education shift (`poll-gaps.mjs` → `out/poll-gaps.txt`)

- **The gap.** Each party's graduate gap is logit(graduates) − logit(everyone else). The polls' education bands are
  combined with the 2021 Census mix and compared with the AES 2025, the only election-day measure.

| Coalition graduate gap, change (logit) | Mean across 4 houses | SD across houses |
|---|---|---|
| Latest window (from 28 Aug 2026) against the AES 2025 | +0.60 | 0.13 |
| First post-election waves (to 31 Oct 2025) against the AES 2025 | +0.45 | 0.08 |
| Same house, latest against first | +0.20 | 0.16 |

- **The Coalition now does better among graduates than among everyone else.** At the election (AES) it did worse.
  Every house agrees.
- **Where the shift sits.** Three-quarters of it was already in each house's first education poll after the election
  (DemosAU July 2025, with One Nation at about 9%).
- **Why that's ambiguous.** That early part is either a fast shift in the first months or the AES measuring
  differently from online panels. No poll carried education crosstabs before the election, so the two can't be split.
- **One Nation's change is not usable.** Its gap against the AES is −0.66, but its same-house change is +0.03, and the
  AES's figure rests on about 54 graduate One Nation voters. The AES's flat 2025 gap (−0.16) is the likely artefact.

### 3. What an education term would do to seats (`seats-education.mjs` → `out/seats-education.txt`)

The official inputs at 2,000 draws.

| Nowcast, expected seats | Labor | Coalition | One Nation | Labor majority |
|---|---|---|---|---|
| Official | 71.4 | 30.3 | 36.6 | 39.6% |
| Coalition +0.17 (same house, calibrate-education.mjs) | 71.4 | 30.1 | 36.8 | 39.7% |
| Coalition +0.60 (AES baseline) | 71.4 | 29.8 | 37.5 | 40.4% |
| All four parties on the AES baseline | 70.4 | 28.4 | 39.8 | 36.4% |

- **The Coalition term cancels in the totals.** The Coalition gains in high-education seats (Curtin becomes Liberal)
  and loses ground to One Nation in low-education ones.
- **Within the existing shock.** The model's random education shock is SD 0.06 logit per SD of university share, or
  0.48 per unit, so it already spans +0.17 to +0.60.
- **The all-party row** moves most only because of One Nation's unusable term.

### 4. The age and gender term (`seats-age.mjs` → `out/seats-age.txt`)

- **Size.** The whole term is worth about a seat (One Nation 36.6 with it, 35.4 without).
- **Gender:** 0.12 points in any seat at most.
- **AES as the starting point:** swapping Resolve's election-day wave for the AES 2025 moves expected seats by 0.3.
- **Convention.**
  - *The issue:* β is a points difference-in-differences, but the engine adds it to a logit swing. A logit swing
    already gives a party rising from a small base more points where it started higher, so the points β counts that
    part twice.
  - *In logit gaps:* One Nation's young-to-old spread falls from 18.7 to 12.3 point-equivalents.
  - *Seat effect:* expected seats move by 0.3 (One Nation 36.6 → 36.3).
  - *Decision:* the logit convention is the consistent one, but not worth a change at this size.

## Reopen if

- The polls' Coalition graduate gap keeps moving well past +0.6 against the AES, or One Nation's same-house gap starts
  to move.
- A poll fielded before the 2025 election with education crosstabs turns up. It would split the +0.45 into instrument
  and real change.
- The AES 2028 is released: add the wave and rerun the backtest.

## Files and rerunning (from the repo root)

- **`extract-aes-cells.py <AES integrated .dta>` → `aes-cells.json`.**
  - *Source:* the ADA's AES integrated file 1967–2025 v1 (`2_aes67to25_integrated_general_v1.dta`), licensed and not
    committed; only the weighted group shares are.
  - *Requirement:* needs pandas.
  - *Coding check:* the script checks the qualification codes against years of tertiary study. 2001's are shifted one
    step in this release.
  - *Validation:* its 2025 wave matches `data/aes-2025-groups.json` (the 2025 release's own CSV) to 0.7 points. Three
    respondents' votes are missing in the integrated file. Graduates match exactly.
- **`node .build/analysis/seat-model/aes-group-swings/backtest.mjs > …/out/backtest.txt`**
- **`node .build/analysis/seat-model/aes-group-swings/poll-gaps.mjs > …/out/poll-gaps.txt`**
- **`node .build/analysis/seat-model/aes-group-swings/seats-education.mjs > …/out/seats-education.txt`**
- **`node .build/analysis/seat-model/aes-group-swings/seats-age.mjs > …/out/seats-age.txt`**

The seat runs read the current stores (here, origin/main at cef8516c), so they move with each daily model run. The
history backtest only moves if the swing fit or the AES file does.

## Caveats

- **Weights:** the 1996–2007 AES waves carry no weights in this release, so they are unweighted.
- **Seat age shares:** the stores give shares of all persons, so 15–19s (about 6.5%) are removed as a constant.
- **Tenure:** census tenure counts dwellings; the AES counts respondents.
- **Poll bands:** two school bands (Below Year 12, Year 12) take half each of school-only. DemosAU's MRP and pooled
  Newspoll releases count with their houses' polls.
