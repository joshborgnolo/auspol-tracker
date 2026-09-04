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
| 4 | **Snapshot / hazard** model: 7 features incl. age-fraction and swing×age interaction, pooled over ~90 term-age snapshots; 300-draw whole-term bootstrap | **median p(ousted) = 0.22**, 10–90% CI [0.05, 0.60]; 18% of draws call ouster | 77% at every band ages 6–24 · 75% at 30 · **85% at final** |

Baseline throughout: "always re-elect" = 9/13 = 69%.

## Albanese-2025 at 16.2 months (live features)

pmNet −18.9 · PPM +14.5 over Taylor · primary −6.5 vs own 2025 result ·
2PP −3.1 · incumbency age 2. The four constructions disagree on direction
but converge on the verdict: historically-bad approval **level**, ordinary
honeymoon **decline**, and — because three of the four actual ousters were
already running p ≥ 0.59 at this term-age — survivor territory, with a
bootstrap interval wide enough ([0.05, 0.60]) to keep everyone honest.

## What the ceiling looks like and why

- **n = 13 terms, 4 ousters.** 85% accuracy carries ≈ ±14pp (Wilson
  [58%, 96%]). Adjacent models' accuracies are statistically
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
  accuracy is flat at ~77% from month 6 to month 24; only the final
  snapshot climbs (85%). Structural ousters (1993, 2004, 2019) are visible
  by month 6; everything else stays mud until the campaign.
- **The blind spots are structural.** 2010 is uncallable at every horizon
  (minority-term collapse with no polling antecedent in these features);
  2019 flips with snapshot timing (the COVID halo peaks exactly at the
  15-month window); 1990 is the one genuine comeback on record and fools
  everything mid-term. At n = 13 every coefficient is ±one anecdote wide.

## If this is ever revisited

Highest-leverage upgrades, in order: (1) per-month discrete-time hazard on
a richer feature set (the snapshot model is the scaffold); (2) more cases —
Morgan Gallup goes back to 1946 (1972–1987 adds ~6 terms incl. two
ousters), or pool ~50 state elections; (3) time-split validation
(train ≤ 2010, predict after); (4) continuous targets (seat margin / 2PP)
instead of binary fate. Don't add estimators; add data.

This is historical signature analysis, not a forecast. Code here is
scratch-quality by design; numbers in this README are the canonical record.
