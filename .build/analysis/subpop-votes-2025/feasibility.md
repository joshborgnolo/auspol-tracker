# Feasibility study: subpopulation primary votes, 2025 federal election

Can we estimate how demographic subpopulations voted at the May 2025 federal
election by combining census people data with polling-booth results?
Answer, with a working prototype in hand: **partially — and the answer differs
sharply by dimension.**

| Dimension | Verdict | Confidence |
|---|---|---|
| Language (English-only vs other-language-at-home) | **FEASIBLE** — robust gradient | high |
| Age (18–34 / 35–54 / 55+) | FEASIBLE-WITH-CAVEATS for 55+; weak at the young end | medium-low |
| Income / SES (lo/mid/hi cuts, SEIFA) | FEASIBLE-WITH-CAVEATS — direction robust, magnitudes not | medium |
| Education (degree vs not) | NOT IDENTIFIABLE at booth grain | high |
| Country-of-birth micro-groups (chn/ind/vnm/phl) | NOT IDENTIFIABLE | high |

Everything below is reproducible from
`.build/analysis/subpop-votes-2025/prototype.py` (scratch, uncommitted);
outputs in `results-2025.json`.

## What the repo already provides

- `data/booth-seifa-voter-2025.json` — 8,913 booths (+600 division-level
  declaration cohorts), each with a **vote-weighted census-footprint profile
  of where its voters live**: G01 11-band age shares, language-at-home,
  foreign-born, 10 country-of-birth shares, uni attainment, blue-collar,
  income cuts, four SEIFA indexes. 99.79% mean scored-vote coverage.
- `.build/aec-flow-src/booth/fpv/2025-<ST>.csv.gz` — AEC VTR per-candidate
  first preferences per polling place (ordinary votes; PPVCs are real rows),
  already reconciled against the footprint store.
- `data/census-2021-divisions-2025.json` — division-level census frames.
- `data/demographics.json` — pooled poll crosstabs (validation target;
  **first wave 2025-06-30, i.e. post-election** — see validation limits).

Units: 8,679 booths joined, **13,114,195 formal ordinary votes** (~80% of all
formal votes; the excluded ~20% are postal/absent/provisional cohorts and
~261 skipped tiny/no-demo booths). Ordinary-only is a real limitation: the
postal/absent cohorts skew older and wealthier.

## Method

For each dimension D and party p ∈ {ALP, Coalition, GRN, ON, other}:

1. Compositional WLS ("Goodman"): `y_p,i = Σ_g β_{p,g} · x_{i,g}`, no
   intercept, vote-count weights, where `x_{i,g}` is booth i's share in
   group g. β is read directly as "party p's vote share inside group g".
2. Ridge shrinkage of β toward a prior built from pooled poll crosstabs
   (λ ∈ {0, 0.1, 1.0}, plus unit-independent national-share fallback).
3. Uncertainty: cluster bootstrap over the 150 divisions (B=200).
4. A **within-division (fixed-effects) variant** — x and y demeaned per
   division — which survives only within-division compositional variation
   and is therefore robust to between-division confounding. The gap between
   (1) and (4) is the headline feasibility diagnostic.

Validation: pooled poll crosstabs from `data/demographics.json` waves dated
before 2026-01-01, compared two ways — exact levels (expected to miss: those
polls are 2–6 months after the election and party levels moved) and
**centred profile shape** (each party's pattern across groups, national
level removed).

## Findings

### Language — the success case

FE and pooled fits agree closely, with tight intervals, because 19% of the
language variance lives inside divisions (enough to identify) and the
gradient is enormous:

| group | ALP | LNP | GRN | ON |
|---|---|---|---|---|
| English only | 27.9 (FE 28.2) | 33.2 (FE 33.6) | 10.4 (FE 11.7) | 7.3 (FE 6.9) |
| Other language | 49.7 (FE 48.7) | 16.7 (FE 15.0) | 15.3 (FE 10.5) | 2.8 (FE 2.0) |

A ~22-point ALP home-language gap, Coalition halved, ON collapsed to ~2%.
Both specifications agree; polls' early-term readings match the direction
(42.6 vs 35.0 ALP). This gradient is strong enough to survive every
specification choice. **Publishable with ecological-transport caveats.**

### Age — mixed

The 55+ end is stable across specifications: Coalition ~46–50, ALP ~15–26,
Greens ~0–3 — the familiar pattern, and FE confirms it. The 18–34 end is
not: pooled says LNP 9% / ALP 49%; FE says LNP 1% / ALP 44%; ridge λ=1.0
pulls ALP to 38%. R² per party is 0.03–0.19. Root causes: the G01 18–34
proxy needs 0.4× the 15–19 band; the young cohort is small per booth and
compositionally entangled with renters/students; and young-voter turnout
variation is folded in. **Use 55+ contrasts only; treat under-35 splits as
suggestive.**

### Income / SES

Both specifications give the same qualitative shape — ALP concave
(mid > lo > hi), Coalition strongly increasing, ON flat/higher-low — but the
hiinc tail swings 68 (FE) vs 36 (pooled) vs prior 30. Only 39% of income
variance is within-division, and the top income group is thin inside
divisions. SEIFA-first lens (the store's existing quintile cuts, as used on
/map/) remains the robust presentation. **Direction publishable; point
estimates not.**

### Education — fails

Within-division variance share 18%; FE and pooled disagree by up to 8pp in
the cells that matter (Green/uni: 22.6 pooled vs 31.0 FE vs poll 14.7); FE
gives an incoherent −6% for ON among uni voters. University attainment is
too entangled with age, language and location at booth grain.
**Do not publish booth-ecology education estimates.** If education subpop
votes are needed, the honest path is survey data (crosstabs) or a model
that conditions on age and language jointly — see "the one thing" below.

### Country-of-birth micro-groups — fails

Groups with national shares ≤9% of a booth's typical footprint produce
garbage (FE CI half-widths of ±70pp; a 131% ALP estimate). Only
binary language works at this grain.

### Validation reality

- Poll-crosstab level agreement: **9/35 cells** inside the estimate's own
  95% interval — but the targets are post-election readings and every miss
  concentrates in parties whose national level moved (ON, ALP, LNP between
  May and late-2025 polling). Level mismatches are contaminated evidence.
- Centred profile-shape agreement: **median 3.45pp, p90 11.1pp**; worst
  cells are exactly the dims already flagged (age ALP 55+ 17pp, young-LNP,
  edu-GRN).
- Weighted R² of the ecological fits is 0.01–0.37 depending on dim/party —
  most booth-vote variation is not demographic. The ridge prior moves
  young-age ALP by ~27pp across λ, i.e. **the data alone do not pin the
  weak dimensions down; the survey prior is doing real work there**.

## Limits to state with any number derived here

- Ecological estimates are group-composition statements about where voters
  live, not observed individual votes; even a robust gradient is one
  confounder away from inversion (the report's FE-vs-pooled comparison is
  the minimum due diligence per cell).
- Footprint demographics are 2021-census residents of the SA1s where 2025
  voters lived; vs the enrolled-voter population they miss citizenship
  composition (mtime), enrolment and turnout — all concentrated in
  language/age/SES groups. Estimates are "of the voting, booth-attending
  electorate".
- ~20% of formal votes (postal/absent/provisional) sit in division-level
  cohorts excluded from the fits; they skew old/high-SES.
- Census→election drift (2021→2025), SA1 compositional noise, and the
  AEC's own rounding in the votes-by-SA1 product.

## What would buy the most (ranked)

1. **A true election-window validation target.** Import the ANU Australian
   Election Study 2025 crosstabs (age × vote, education × vote, language ×
   vote, income × vote) as the gold check — the repo's poll store starts
   2025-06-30 and is a moving level target. Cheapest high-value step.
2. **Forty more demographic columns.** The GCP SA1 datapack pattern is
   proven (`.build/analysis/seat-model/cache/gcp-sa1-2021.zip`): adding
   G02 (sex), G17 (income bands), G43/G40 (education detail), G14
   (religion) to the footprint deriver is mechanical — the votes walk and
   per-index denominator machinery already exist. Sex alone fixes the
   current "no gender at booth grain" gap (the division frames have it).
3. **Declaration votes into units** (HouseDeclarationVotes downloads) to
   fold the ~20% postal/absent vote into the estimation sample instead of
   dropping it.
4. **A multilevel joint model** (all dims at once, partial-pooled toward
   poll priors, binomial likelihood) replacing per-dim marginals — the
   regularisation becomes principled and education may become identifiable
   conditional on age+language.
5. Historical replication: footprint stores exist for 2016/2019/2022, so
   every check above can be re-run against the AES 2019/2022 benchmarks to
   verify the method reproduces known answers.

## Bottom line

Booth × census ecology can support three claims about 2025: the home-language
gradient (large, robust), the 55+ Coalition skew (robust), a concave ALP /
rising-Coalition income gradient (direction only). It cannot support
education or country-of-birth claims from this data alone. The marginal
cost of turning this prototype into a production lane is dominated by step
(1) + (2) above, roughly a day of derivation work each, using existing repo
machinery — worth doing if the site wants a census-based complement to the
poll-crosstab Who-votes panel, with every figure published under an
ecological-transport caveat in the spirit of `DEMO_ABOUT`.
