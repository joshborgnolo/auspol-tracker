# Re-election signature models

One-off analysis, 2026-09-04, against `origin/main:data/polls.json` (then at
`ea81270`); extended 2026-09-14 to the F2F-Morgan era (see the era-extension
section — models 3–4 now train on terms opening 1974–2022, models 1–2 remain
1987+). The question that started it: 15–16 months into Albanese's second
term, does the term's polling profile look like the profiles of governments
that were eventually **ousted** (Whitlam-74→75, Fraser-80→83, Keating-93→96,
Howard-04→07, Gillard-10→13, Morrison-19→22) or **re-elected** (the other
thirteen completed terms since 1974)?

Every script is read-only, run from the repo root, and reads data via
`git show origin/main:data/polls.json` — immune to working-tree state:

```
node .build/analysis/reelect-15mo-levels.mjs      # levels composites
node .build/analysis/reelect-15mo-declines.mjs    # decline composites + first LOOCV
node .build/analysis/reelect-term-ridge.mjs       # ridge-logistic term models + ceiling tests
node .build/analysis/reelect-snapshot-hazard.mjs  # discrete-time snapshot (hazard) model
```

Outcome coding: ousted = government lost the election ending the term
(6 of 19 completed terms since 1974). Incumbency age = consecutive terms
held, counted along the election sequence (1974→75 and 1975→77 are not
3-year hops); ousters came at age 5, 4, 3, 2, 3, 2 — no first-term
government has lost. Era terms (opening 1974–1984) train with Morgan
primaries and LEF-implied 2PP (the only two-party series that exists
pre-1983) and no leadership series.

## Model ladder

| # | construction | Albanese-2025 reads | leave-one-term-out |
|---|---|---|---|
| 1 | 15-month **levels** composite (pmNet, oppNet, PPM, primary & 2PP swing), scored 0 = typical ousted, 1 = typical re-elected *(1987+ record, unchanged by the era extension)* | **−1.18** — below the ousted centroid | 15% (useless) |
| 2 | 15-month **declines** composite (drop from own honeymoon baseline; swings vs own election) *(1987+ record, unchanged)* | **+0.86** — a standard honeymoon fade | 54% |
| 3 | **Ridge logistic**, 5–6 trajectory features, standardised, λ=1 | live (16-month features): **p(ousted) = 0.25** | **68%** full-term · 79% live |
| 4 | **Snapshot / hazard** model: 5 features (primary & 2PP swing, incumbency age, age-fraction, swing×age interaction), pooled over ~131 term-age snapshots; 300-draw whole-term bootstrap. Refit 2026-09-08 after the feature audit below — leadership ratings were dropped | **median p(ousted) = 0.28**, 10–90% CI [0.11, 0.53]; 12% of draws call ouster | 68–79% across bands ages 6–24 · 76% at 30 · **79% at final** |

Baseline throughout: "always re-elect" = 13/19 = 68%.

## Albanese-2025 at 16.2 months (live features)

Model inputs: primary −6.6 vs own 2025 result · 2PP −3.1 · incumbency
age 2 · age-fraction 0.44. Context, not modelled (see the feature audit):
pmNet −19.1 · PPM +13.9 over Taylor. The constructions disagree on
direction but converge on the verdict: historically-bad approval
**level**, ordinary honeymoon **decline**, and — because three of the four
modern ousters were already running high p at this term-age — survivor
territory, with a bootstrap interval wide enough ([0.11, 0.53]) to keep
everyone honest.

## What the ceiling looks like and why

- **n = 19 terms, 6 ousters.** 79% final-band accuracy carries a Wilson
  interval of ≈ [57%, 91%]. Adjacent models' accuracies are statistically
  indistinguishable; effective n is the binding constraint, not the
  estimator. Confirmed empirically: on identical features LDA nearly ties
  ridge (63% vs 68%, AUC 0.79 vs 0.78), kNN degrades (58–63%), and
  capacity above logistic overfits.
- **Single rules are no better than the baseline.** "Final-6-month
  government 2PP < 50 ⇒ ousted" scores 67% over the 18 two-party-era
  terms (era terms read their LEF-implied 2PP) — governments routinely sit
  behind between fixed election dates (1977, 1990, 1996, 1998, 2001, 2016
  were all under 50 late and won). Unemployment-at-election now *helps*
  (68% → 74%) — but both era ousters came at high/rising unemployment, so
  this is plausibly six extra cases of era luck rather than a durable
  feature; spill/minority flags also lift the term model to 74%.
- **Waiting buys less than expected.** Per-band accuracy sits in a 68–79%
  band from month 6 to month 24, and the final snapshot no longer climbs
  meaningfully above it (79%; it was 92% under the 1987+ record). The
  structural ousters differ in visibility: 1993 and 2004 are obvious by
  month 6–15, 1980 and 2019 stay mud until ~24–30 months, and the 1974
  dismissal reads middling the whole way.
- **The blind spots are structural.** 2010 is uncallable at every horizon
  (minority-term collapse with no polling antecedent in these features);
  1990 (the one genuine comeback on record) and 1977 (a re-election the
  live model just tips over 0.5) fool the mid-term reads; 2019 flips with
  snapshot timing (the COVID halo peaks exactly at the 15-month window).
  At n = 19 every coefficient is ±one anecdote wide.

## Feature audit (2026-09-08)

*(Run under the 13-term, 1987+ harness; not re-run against the era record —
era terms carry no leadership series at all, so their imputed cells would
dilute every variant equally.)*

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

## Era extension (2026-09-14)

The past-cycles era import (39de76c/20ef05e) added the F2F-Morgan record —
terms opening 1974–1984 — to `data/polls.json`, six extra completed terms
including two more ousters (Whitlam-74→75 dismissed, Fraser-80→83). Models
3 and 4 now train on the full 19-term record; models 1–2 stay on the
1987+ record they were computed against.

Era terms are feature-sparse: Morgan primaries plus **LEF-implied** 2PP
(`tppEra`, flows-modelled — no official 2PP exists before 1983) and no
leadership series (pmNet/ppm median-imputed as ever). An A/B on the
hazard harness showed reading the implied 2PP as-is ≥ nulling it to
imputation (Brier 0.185 vs 0.189 across the same 131 snapshots), so era
tpp enters `tppSw` unmodified. `govAge` was rewritten to count consecutive
wins along the election sequence — the year−3 stepping convention
misclassifies 1977 and 1984 under era election spacing. Two structural
caveats: short era terms (1974: 18.9mo, 1983: 20.9mo spans) contribute
snapshots at ages past their own span whose features fall to the training
median, and every era two-party figure is flows-modelled rather than
published.

Making the training set *harder* lowers the headline validation numbers,
exactly as expected; the extension ships because six real cases with two
real ousters beat four clean ones:

| harness | model 3 (ridge, live window) | model 4 (snapshot hazard) |
|---|---|---|
| 13 terms, 1987+ | live LOOCV 77% | AUC 0.84 · Brier 0.152 · final band 92% |
| **19 terms, 1974+ (shipped)** | live LOOCV 79% | AUC 0.75 · Brier 0.185 · final band 79% |

(Model 3's live-window accuracy was already its weak suit and improves;
its full-term autopsy row drops 85% → 68%. Albanese-2025 live reads after
the extension: ridge 0.25, hazard median 0.28 — barely moved.)

The page machinery (frozen backcast, prediction-history replay, the
"thirteen completed federal terms" copy) was regenerated against the
19-term model in the same change, and `data/prediction-history.json` was
replayed `--as-of` so the whole recorded series reflects this record.

## If this is ever revisited

Highest-leverage upgrades, in order: (1) per-month discrete-time hazard on
a richer feature set (the snapshot model is the scaffold); (2) more cases —
~~Morgan Gallup goes back to 1946 (1972–1987 adds ~6 terms incl. two
ousters)~~ done: the F2F-Morgan era record landed 2026-09-12 and models
3–4 now train on 19 terms (era extension above); remaining headroom is
~50 state elections, or the pre-1972 record if usable figures ever
surface; (3) time-split validation
(train ≤ 2010, predict after); (4) continuous targets (seat margin / 2PP)
instead of binary fate. Don't add estimators; add data.

This is historical signature analysis, not a forecast. Code here is
scratch-quality by design; numbers in this README are the canonical record.
