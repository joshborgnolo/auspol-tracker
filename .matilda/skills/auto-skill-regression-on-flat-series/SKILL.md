---
name: regression-on-flat-series
description: "Cross-domain stats lesson (worked live 2026-09-07 in auspol-tracker's flow-share fitter, c71ab17): regressing a near-constant target on near-constant, co-moving predictors invites three compounding failure modes — (1) N-WEIGHTED OLS SEs are a fiction when the noise is episode-level not row-level (44 waves from one method regime ≠ 44 iid draws: printed ±0.2–1.4pt vs honest wave-level ±8–80); (2) UNIDENTIFIED fits render as FACTS when a box/clip CONSTRAINT pins (Newspoll Greens: unconstrained slope 106 → hard-clamped to '100%' and displayed as a claim); (3) co-moving predictors create FLAT VALLEYS the optimiser lands anywhere along (Morgan anti-correlated Greens/Others → 55/79 when truth ≈ 88/55). Fix pattern: unit-weight per EPISODE, ridge with a substantive prior, POOLED noise estimate, honest posterior SEs."
source: auto-skill
extracted_at: '2026-09-07T00:00:00.000Z'
---

# Regressing a near-flat target on near-flat co-moving inputs

Generalises beyond auspol (worked example: per-house implied
preference-flow shares, fitted per pollster on its own waves; the
committed detail lives in `auspol-flow-drift-panel` → "Implied-flows
table"). Applies to any "estimate stable shares/rates/coefficients per
group from that group's own repeated measurements" task where each
group's input columns barely move over the window.

## The three failure modes (all present in one ship-and-retire day)

1. **Row-weighted SEs mistake repetition for information.**
   Weighting by sample size (or row count) treats 44 waves of one
   house's method regime as 44 independent draws. The residual
   variance that matters is episode-level: rounding, method tweaks,
   genuine drift — shared by every row of the wave. Followers see
   ±0.2–1.4pt; honest wave-level SEs were ±8–80pt. Rule: weight by
   EPISODE (unit weight per wave/survey/session), not by row n.
2. **A clipped estimate is a non-identification wearing a fact's
   clothing.** With GRN primaries stuck at 11–13 across 8 waves the
   unconstrained slope was 106; the [0,1] box PINNED it at exactly
   100 and the UI printed "Greens 100%". If you must clip, the clip
   must be a seatbelt that never engages on real data — when a fit
   wants to sit on the boundary, the answer is "the data can't say",
   not the boundary value. Also: a column the house RE-DERIVES per
   wave from its own respondent allocation (Morgan's 2PP) offers no
   fixed constant for a regression to recover at all — check whether
   the estimand even exists before fitting.
3. **Co-moving inputs → flat valleys.** When two predictors move
   anti-correlated across waves, many (β₁, β₂) pairs fit equally well
   and the optimiser lands wherever noise puts it (55/79 found
   against an 88/55 election-table truth). Validation against an
   external anchor (here: election-day counted flows) caught it —
   the fitted numbers were internally consistent, so no residual
   diagnostic would have.

## The fix pattern that shipped

- **Unit weight per episode** (kill the n-weighting fiction).
- **Gaussian-prior ridge shrunk toward a substantive anchor**, not
  toward zero: solve (X'X+Λ)β = X'y+Λβ₀ with β₀ taken from the
  trusted external reference (the election flow table; intercept
  prior mean 0, its own τ). Then "the waves can't tell" renders as
  ≈the anchor instead of an exploded cell, and genuinely informative
  houses still move (Morgan's respondent-allocated high-Other signal
  survived: 67.7 vs anchor 54.6).
- **POOL the noise variance across groups** (df-pooled σ̂² across
  houses): a per-group σ̂ can be a fluke — Newspoll's 8 waves
  near-interpolated, giving σ̂ = 0.16pt, which under the ridge's
  λ = σ̂²/τ² rescaling would have let it keep its absurd slope. The
  pooled σ̂ ≈ 0.88pt² (df 79) priced every house's noise honestly.
- **Emit posterior SEs** (σ̂·diag((X'X+Λ)⁻¹)^½) and RENDER them in
  the UI ("± 9.0" in faint type beside each cell) — the honest
  uncertainty is itself the corrective to the exploded-cell problem.
- **Implementation traps** (gen-data.mjs §7c, ~:1280–1420):
  - the ridge λ must live in the NORMAL EQUATIONS as written above;
    an earlier scratch attempt σ⁻²-rescaled the data rows and the
    prior jointly cancelled out (printed ridge = OLS — the tell;
    always sanity-check that the shrunk fit DIFFERS from OLS);
  - the linear solver must operate on COPIES of the design — the
    covariance pass (inverse) needs the un-factored X'X afterwards;
  - guard behind a minimum-episode count (≥6 joined waves) and say so
    in the copy; label the output diagnostic-only.

## Diagnostic workflow that found it (reusable)

Write a gitignored scratch probe (`.matilda/flow-fit-probe.mjs` here)
that, per group: prints the raw input series (Flatville confirmed by
eye — GRN 11→13 across the whole window), the unconstrained fit, the
constrained fit, and candidate fixes side by side (solo ridge,
anchor-blend, pooled-σ ridge). The false-SE fiction was visible as a
ladder: same fit, n-weighted SEs vs wave-level SEs. A user's "this
can't be right" on two cells at once is worth trusting immediately —
both artefacts (pin at 100, valley at 55) were real and had
independent causes; fixing one would not have fixed the other.
