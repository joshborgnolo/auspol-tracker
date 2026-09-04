---
name: reelection-signature-models
description: auspol-tracker — the re-election signature modelling suite in .build/analysis (README + 4 scripts, committed de5dfa4, 2026-09-04): 15-month levels/decline composites → ridge-logistic term models (85% leave-one-term-out) → discrete-time snapshot/hazard model (Albanese-2025 p(ousted) median 0.22, 10–90% [0.05, 0.60]). Scripts read data via `git show origin/main:data/polls.json` by design — reproducible even when a sibling session has poisoned the working tree. Carries the outcome-coding constants (seat-winner ≠ 2PP-winner in 1998; term windows; incumbency age), every canonical number, and the vetted upgrade paths for when this modelling is revisited.
source: auto-skill
extracted_at: '2026-09-04T05:02:43.722Z'
---

# Re-election signature models (auspol-tracker)

One-off analysis shipped as **`.build/analysis/`** (commit `de5dfa4`): a README
carrying every canonical number, plus four read-only probes. Origin question:
*15–16 months into a term, does a government's polling profile match the
profiles of governments eventually ousted vs re-elected — and where does
Albanese-2025 sit?*

## What exists and how to re-run

From the repo root (paths anchor on cwd — NOT on script location):

```
node .build/analysis/reelect-15mo-levels.mjs      # 15mo levels composites
node .build/analysis/reelect-15mo-declines.mjs    # decline composites + first LOOCV
node .build/analysis/reelect-term-ridge.mjs       # ridge-logistic A/B models + ceiling tests
node .build/analysis/reelect-snapshot-hazard.mjs  # discrete-time snapshot model + term bootstrap
```

**Data-access convention that makes these durable**: every script does
`execSync("git show origin/main:data/polls.json")` rather than reading the
working-tree file — twice this session the main tree's `data/polls.json` was a
sibling session's half-finished rewrite (AGB rows missing, foreign edits), and
origin/main was the only trustworthy state. Any NEW analysis probe in this repo
should follow the same pattern (see also shared-repo-session-race); keep probes
in `.matilda/probe/` while scratch, promote to `.build/analysis/` when persisted.

## The modelling canon (don't re-derive)

- **Outcomes**: ousted = government lost the election ENDING the term — 4 of 13
  completed terms since 1987 (1993→96 Keating, 2004→07 Howard, 2010→13 Gillard,
  2019→22 Morrison). Winner map extends 1977→2025 for incumbency-age:
  **seat-winner, NOT 2PP-winner** (1998 Howard won on 49.0 two-party).
- **Incumbency age** (consecutive terms held) is the single strongest feature
  (standardised +1.01 in the full-term ridge): ousters came at age 5, 4, 2, 3;
  no first-term government has ever lost. Followed by late-term primary swing
  (−0.90). Leadership levels are weak features.
- **Current-term plumbing**: the 2025 term has NO `cycleApproval.2025` —
  leadership lives in top-level `approval` (`{alb, opp}` nets per row) and `ppm`
  (`{alb, opp, han}` — Hanson-inclusive question designs since 2026, note
  `ppmHeadToHead` separate); VI lives in `polls` (post-2025 rows, fields
  `lnp/alp/…/tpp_alp`). cyclePolls keys are term-END years, cycleApproval
  term-START (auspol-past-cycles).
- **Canonical numbers** (origin/main @ ea81270, 2026-09-04): levels composite
  −1.18 vs declines composite +0.86 for Albanese-2025; full-term ridge 11/13 =
  85% LOTO (AUC 0.83 → 0.89 with spill/minority features, Brier 0.134); live
  16-month ridge p(ousted) = 0.31; snapshot model ~77% LOTO at every age band
  6–24, 85% at final; **Albanese-2025 median p = 0.22 [0.05, 0.60], 18% of
  whole-term bootstrap draws call ouster**. Live features: pmNet −18.9, PPM
  +14.5, primary −6.5 vs own election, 2PP −3.1, age 2.

## Why the ceiling is ~85% (argued, tested)

Baseline "always re-elect" = 69%. Single rules fail: final-6mo gov-2PP < 50
rule = 58% (winners sit behind between fixed election dates); unemployment-at-
election as a feature *hurts*. Estimator choice doesn't matter (LDA ties ridge
on AUC; kNN collapses at n=12-train). Structural blind spots: **2010 is
uncallable at every horizon** (minority-term collapse, no polling antecedent),
**2019 flips with snapshot timing** (COVID halo peaks at exactly the 15-month
window), 1990 is the one genuine comeback on record. n = 13 terms / 4 ousters
puts ±14pp on every accuracy figure. Do not add estimators — add cases.

## If revisited (vet paths, in leverage order)

1. Per-month hazard enrichment (snapshot model is the scaffold);
2. More cases: Morgan Gallup back to 1946 (~6 more terms, 2 more ousters) or
   pooled state elections (~50);
3. Time-split validation (train ≤2010, predict after);
4. Continuous targets (seat margin / 2PP) — binary fate hides 1998's
   2PP-loss-seat-win. The README's "If this is ever revisited" section is the
   authoritative list; keep it in sync with any rerun.
