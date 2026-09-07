# Re-election signature models

One-off analysis, 2026-09-04, against `origin/main:data/polls.json` (then at
`ea81270`). The question that started it: 15–16 months into Albanese's second
term, does the term's polling profile look like the profiles of governments
that were eventually **ousted** (Keating-93→96, Howard-04→07, Gillard-10→13,
Morrison-19→22) or **re-elected** (the other nine completed terms since 1987)?

Every script is read-only, run from the repo root, and reads data via
`git show origin/main:data/polls.json` — immune to working-tree state:

```
node .build/analysis/reelect-15mo-levels.mjs      # levels composites
node .build/analysis/reelect-15mo-declines.mjs    # decline composites + first LOOCV
node .build/analysis/reelect-term-ridge.mjs       # ridge-logistic term models + ceiling tests
node .build/analysis/reelect-snapshot-hazard.mjs  # discrete-time snapshot (hazard) model
```

Outcome coding: ousted = government lost the election ending the term
(4 of 13 completed terms since 1987). Incumbency age = consecutive terms
held (ousters came at age 5, 4, 2, 3; no first-term government has lost).

## Model ladder

| # | construction | Albanese-2025 reads | leave-one-term-out |
|---|---|---|---|
| 1 | 15-month **levels** composite (pmNet, oppNet, PPM, primary & 2PP swing), scored 0 = typical ousted, 1 = typical re-elected | **−1.18** — below the ousted centroid | 15% (useless) |
| 2 | 15-month **declines** composite (drop from own honeymoon baseline; swings vs own election) | **+0.86** — a standard honeymoon fade | 54% |
| 3 | **Ridge logistic**, 5–6 trajectory features, standardised, λ=1 | live (16-month features): **p(ousted) = 0.31** | **85%** full-term · 77% live |
| 4 | **Snapshot / hazard** model: 5 features (primary & 2PP swing, incumbency age, age-fraction, swing×age interaction), pooled over ~90 term-age snapshots; 300-draw whole-term bootstrap. Refit 2026-09-08 after the feature audit below — leadership ratings were dropped | **median p(ousted) = 0.27**, 10–90% CI [0.09, 0.57]; 17% of draws call ouster | 77% at every band ages 6–24 · 83% at 30 · **92% at final** |

Baseline throughout: "always re-elect" = 9/13 = 69%.

## Albanese-2025 at 16.2 months (live features)

Model inputs: primary −6.5 vs own 2025 result · 2PP −3.0 · incumbency
age 2 · age-fraction 0.44. Context, not modelled (see the feature audit):
pmNet −18.9 · PPM +14.5 over Taylor. The constructions disagree on
direction but converge on the verdict: historically-bad approval
**level**, ordinary honeymoon **decline**, and — because three of the four
actual ousters were already running high p at this term-age — survivor
territory, with a bootstrap interval wide enough ([0.09, 0.57]) to keep
everyone honest.

## What the ceiling looks like and why

- **n = 13 terms, 4 ousters.** 92% accuracy carries ≈ ±16pp (Wilson
  [62%, 100%]). Adjacent models' accuracies are statistically
  indistinguishable; effective n is the binding constraint, not the
  estimator. Confirmed empirically: on identical features LDA ties ridge
  (AUC 0.83), kNN degrades (62%), and capacity above logistic overfits.
- **Single rules are worse.** "Final-6-month government 2PP < 50 ⇒ ousted"
  scores only 58% — governments routinely sit behind between fixed election
  dates (1990, 1996, 1998, 2001, 2016 were all under 50 late and won).
  Unemployment-at-election as a feature *hurts* (69%). Spill/minority flags
  don't change calls but improve probability quality (AUC 0.83 → 0.89,
  Brier 0.161 → 0.134) — the best-calibrated variant of model 3.
- **Waiting buys less than expected.** The snapshot model's per-age
  accuracy is flat at 77% from month 6 to month 24; only the final
  snapshot climbs (92%). Structural ousters (1993, 2004, 2019) are visible
  by month 6; everything else stays mud until the campaign.
- **The blind spots are structural.** 2010 is uncallable at every horizon
  (minority-term collapse with no polling antecedent in these features);
  2019 flips with snapshot timing (the COVID halo peaks exactly at the
  15-month window); 1990 is the one genuine comeback on record and fools
  everything mid-term. At n = 13 every coefficient is ±one anecdote wide.

## Feature audit (2026-09-08)

Does the leadership data add anything to model 4? Prompted by Bonham
(2020) — preferred-PM scores track leader idiosyncrasy more than
electoral health; Howard led PPM through most of 2007 and lost anyway —
and Armarium (2021) — an approval *margin* (PM minus half the opposition
leader's netsat) does the predictive work. Same harness, same λ, same
bootstrap; only the feature list varies:

| variant | AUC | Brier | final-band acc | live median |
|---|---|---|---|---|
| FULL (pmNet, ppmLead + 5 others) — as first shipped | 0.77 | 0.182 | 85% | 0.22 |
| drop ppmLead | 0.78 | 0.177 | 85% | 0.23 |
| drop pmNet (30-mo band 75→83) | 0.80 | 0.174 | 85% | 0.26 |
| **drop both leadership (shipped)** | **0.84** | **0.153** | **92%** | **0.27** |
| approval-margin swap (pmNet − ½·oppNet, keeps 15/18/24 at 85) | 0.79 | 0.177 | 85% | 0.22 |
| margin + keep ppmLead | 0.78 | 0.185 | 85% | 0.20 |
| pmNet + oppNet as free features | 0.76 | 0.194 | 85% | 0.24 |

Univariately each leadership series has some signal vs fate (AUC: pmNet
0.61 · ppmLead 0.62 · oppNet 0.53 · approval margin 0.60), and the
in-sample ridge even gives ppmLead a wrong-signed (ousted-favouring)
coefficient — but conditional on swings, age and the interaction, none
survive. Dropping both is strictly best on AUC, Brier and the final
band. The margin construction beats the free-weight split (as Armarium
would predict at this n) but not outright deletion. ppmLead is never
again a model input; both leadership series stay in `data/polls.json`
and are emitted by the script as page **context** only.

## If this is ever revisited

Highest-leverage upgrades, in order: (1) per-month discrete-time hazard on
a richer feature set (the snapshot model is the scaffold); (2) more cases —
Morgan Gallup goes back to 1946 (1972–1987 adds ~6 terms incl. two
ousters), or pool ~50 state elections; (3) time-split validation
(train ≤ 2010, predict after); (4) continuous targets (seat margin / 2PP)
instead of binary fate. Don't add estimators; add data.

This is historical signature analysis, not a forecast. Code here is
scratch-quality by design; numbers in this README are the canonical record.
