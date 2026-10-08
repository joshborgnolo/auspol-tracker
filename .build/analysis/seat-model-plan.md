# Seat model — the plan (draft, 2026-10-08)

A demographically-adjusted swing model that turns the site's current-cycle polling
into per-seat win probabilities and a national seat distribution. **Not MRP** —
the repo holds published marginal crosstabs, never respondent-level data, and the
plan is shaped by that constraint throughout (see *Hard limits*). Everything
below is analysis-side (`.build/analysis/`, new `data/` inputs); nothing touches
the built site until Stage 3, which is a separate decision.

---

## The four comparators (surveyed 2026-10-08)

ALP seat medians "if an election were held today", same week: **poliwave 78,
GES 73, theswingison 69, aeforecasts 68.** The 68→78 spread is the single most
informative fact about this problem: four defensible models, the same polls,
ten seats apart. The spread is driven by where we must be most careful — the
vote→seat conversion, not the polling read.

### Poliwave — poliwave.com/au (78)

Canadian-derived engine ("ridings"). Per-seat baseline from the 2025 result,
with a historical-reconstruction step that fills a baseline for parties that
didn't contest a seat last time. The swing formula **mixes proportional swing
with a gain/loss-asymmetric additive term**, scaled by the party's new target:
a losing party can't be pushed below zero, and mid-tier seats get room to surge
when the party is gaining. User-adjustable inputs sit over a simulation that
reports per-seat probabilities.

*Adopt:* the proportional+additive mix with a zero floor (naive additive swing
goes negative on collapsing parties; pure proportional under-moves a surging
minor party — exactly the ON problem); the not-in-2025 imputation rule; a
user-input surface if this ever becomes a page — it defers the "predicting the
future" accusation.

### Global Election Simulator — globalelectionsimulator.com/australia (73)

Baseline-first simulator, not a poll model: the certified 2025 result is
re-entered seat by seat, and **the seat totals the baseline produces are checked
against the real ones before the simulator ships.** National-share sliders drive
a swing engine; an election-night mode drips results in regions.

*Adopt:* the shipping invariant as a build-time test — our baseline layer must
reproduce the actual 150-seat 2025 result (primaries within rounding, TCP pair
and winner exact in every seat) or the model doesn't run. This turns silent
baseline corruption (a misjoined AEC row, a redistribution re-map bug) into a
loud failure. Nothing else here competes with a poll-driven model.

### The Swing Is On — theswingison.com (69)

Poll aggregate + seat nowcast with the most publishable validation practice of
the four. QLD-2024/NSW-2023 model reports give final-2CP-pair identification
(~99% correct), winner-within-pair (~100%), 2CP MAE ~1pp, and the honest
structural note that seat-level accuracy is the binding constraint. Their ON
analysis (22% statewide → 3 seats) is exactly the elimination-sequence thinking
a federal ON-surge model needs.

*Adopt:* **full ballot-transfer simulation per seat per draw** — determine the
final pair by elimination inside the simulation, never assume ALP v LNP finals —
and their validation metrics (pair accuracy, 2CP MAE) as our own backtest
targets, published beside any output.

### aeforecasts — aeforecasts.com/forecast/2028fed (68)

The academic one (and already in the repo's orbit: `auspol-pollanalyser-gap-audit`,
`bonham-additional-aeforecasts.csv`). Dual-track — a fundamentals "general
forecast" and a poll "nowcast" — with relaxation weighting between them across
the term; everything is interval-first (2PP shown as 10/50/90). After ON's
surge they rewrote minor-party projection **as general rules applied
consistently**, not a party-specific patch.

*Adopt:* interval-first output (median + 80/95%, never a bare seat count);
minor-party rules that generalise across parties and elections; a slot in the
architecture where a fundamentals prior could later join (deferred — the
re-election-signature suite is the repo's fundamentals track for now);
respect for the conservatism gap: their 68 vs poliwave's 78 is mostly
relaxation speed and ON→seat conversion geometry, and a model that can't say
which side of that gap it sits on, and why, isn't done.

(Also surfaced: electionfirstpreference.com — per-candidate first-preference
model, redistribution-adjusted baselines, fundamentals+polling blend. Borrow
its redistribution re-baselining pattern when the 2028 boundaries land.)

---

## Architecture

Five layers, each separately testable, each failing loudly:

**1. Baseline (2025, per seat).** Primaries by candidate group (ALP / LNP [+
Nat where distinct] / ON / GRN / named IND / OTH), the TCP pair and TCP%,
contest-type classification, incumbent and first-term status. Source: AEC
certified results — the same data behind the atlas page and the aec-flow
constants. GES invariant: baseline must reproduce the 150-seat result exactly.
Manual overlay table (small, hand-maintained): retirements as announced,
by-election changes, candidate-set assumptions for 2028. Redistribution
monitor: track the AEC apportionment determination and draft/final boundary
gazettals; re-baseline by enrolment-weighted recomputation from SA1-level
counts when final boundaries land — never from press notional margins.

**2. Vote layer (what the nation thinks now).**
- *National:* the repo's own aggregate (gen-data nowcast, house-effects
  estimate already computed) → per-party ΔV_p^national vs the 2025 result.
- *State deviations:* state marginals from `data/demographics.json` (47 waves),
  pooled hierarchically with shrinkage toward the national swing — the state
  cells are thin (a Tas wave is n≈100), so the prior does real work.
- *Demographic differential swings* β_{p,g}: hierarchical binomial pool of each
  group's current shares vs its May-2025 baseline (polling-day Resolve wave and
  neighbours), house effects removed, §7g effective-n weights. Nine dims exist
  (`DEMO_RAW_DIMS`: gender, age, generation, education, income, location,
  housing, language + state); the model uses a small orthogonal subset — age,
  education, location, income, say — because the βs are estimated jointly with
  shrinkage (ridge or partial pooling), never as hand-applied rules. Correlated
  demographics double-count: that is the trap this layer exists to avoid.

**3. Seat translation.**

    ΔV_{i,p} = ΔV_p^national
             + Σ_g β_{p,g} · (X_{i,g} − X_g^national)
             + state_dev_{s(i),p}
             + incumbency_{i,p}
             + ε_i

with the swing applied as poliwave's proportional+additive mix (zero floor,
surge headroom), per-party normalisation back to 100, and X_{i,g} from ABS 2021
Census counts by division (the one genuinely missing input — **workstream W1**).
Marginals-only caveat encoded directly: β_g are additive; the model knows no
age×education interaction, and says so in its output notes.

**4. Preference layer.** AEC's full 2025 distributions of preferences, per seat
(the repo's aec-flow machinery refreshes national constants — **workstream W2**
extends it to a per-seat flow matrix, `data/aec-2025-seat-flows.json`). In
simulation, flow matrices are Dirichlet-drawn around 2025 seat means with a
drift parameter calibrated on election-to-election flow change; flows
conditional on contest type (classic, IND-held, ON-relevant). The national
ON→LNP split (~71/29 in 2025, per user's aec note) is a calibration anchor,
not a hard-coded constant.

**5. Simulation.** Monte Carlo (≥20k draws): draw national votes (estimator σ
inflated by empirical polling error from `np-calibration` machinery), state
deviations, seat residuals (state-correlated), demographic-shock variance,
flow matrices; run the full elimination per seat per draw. Outputs: per-seat
win probability, national seat distribution (median + 50/80/95%), majority
probability, and a per-date record in the `prediction-history.json` pattern so
calibration is auditable over the term.

Rules the architecture enforces: **primaries first, flows after, TCP/TCP from
elimination** (a seat can finish ALP v ON; 2PP is an output of the national
aggregation, not a modelled quantity); **no double-counting** — layer 2's
national swing is distributed by layers 3–4, never added to again; **no
party-specific hacks** — ON is a set of parameter values, not a code path.

## What the repo already supplies

- House-corrected national aggregate + house-lean estimator (gen-data §estimator)
- `data/demographics.json` — 47 waves of marginal breakdowns with §7g effective-n
- `data/vote-switching.json` — recalled-2025-vote → current transitions; a
  second opinion on the flow matrix and a diagnostic for β plausibility
- AEC preference-flow constants pipeline (skills aec-flow-cuts /
  aec-preference-flow-constants) and the `/preference-flows/` satellite
- 2025 seat-level results via the atlas data
- Backtesting precedent (`np-calibration`, hl-half race) and the
  prediction-history record pattern (auspol-prediction-page)
- `.build/analysis/` itself (this directory): the re-election suite is the
  fundamentals prior's natural home

## Workstreams (build order)

- **W1 Census frame.** ABS 2021 Census by 2025 federal division: the mapped
  demographic cells for the orthogonal subset → `data/census-2021-divisions.json`.
  One-off extraction + a checksum test. *The* missing input.
- **W2 Seat flow matrix.** Extend the AEC constants extractor to per-seat
  distributions → `data/aec-2025-seat-flows.json`, with the aec-flow-cuts
  reconciliation pinned as a test.
- **W3 Baseline + invariant.** Candidate-grouped 2025 primaries/TCP per seat;
  GES reproduction test (150/150 winners exact or build fails).
- **W4 Vote layer.** Hierarchical β fit + state deviations (read-only script,
  `git show origin/main:` pattern like its neighbours).
- **W5 Swing + simulation engine.** Layers 3–5; stream to per-seat records.
- **W6 Candidate-set overlay.** Hand table: retirements, IND contest set
  (2025 teal seats + declared likely), ON/GRN run-everywhere assumptions.
- **W7 Benchmark panel.** Weekly snapshot of the four comparators' seat medians
  alongside ours → `data/seat-model-benchmarks.json`; the disagreements are the
  diagnostic surface, so record them from day one.
- **W8 Redistribution monitor.** Determination + boundary gazettal watch;
  re-baselining procedure (manual trigger, scripted recomputation).

## Validation

1. **Baseline invariant** (GES): reproduce 150/150 2025 winners exactly.
2. **Flow backtest**: predict 2025 flows from 2022 flows + drift; score vs
   actual AEC distributions.
3. **Cycle holdout**: run layers 1–5 *as of April 2025* (final-poll aggregates,
   2022 baseline, 2022 flows) against the actual 2025 result — the one true
   out-of-sample test available pre-2028. Targets, borrowing theswingison's
   report card: ≥95% final-pair accuracy, seat-2CP MAE ≈1–1.5pp, national seat
   totals within interval.
4. **Demographics null test**: ship layer 3 with β=0 vs β fitted; the
   demographic term must earn its keep on the holdout or ship off. (This is
   the honest answer to "is the demographic machinery load-bearing?")
5. **Benchmark divergence log**: when our median departs ≥3 seats from the
   comparator envelope, write down why. The answer is always in the vote read,
   the ON conversion, or the flows — check in that order.

## Hard limits (say them on every output)

- Marginals, not joints — no demographic interactions exist to estimate.
- No respondent electorate — every seat figure is model, none is measurement.
- Tas/NT/ACT seats are composition-only guesses; state cells are n≈100.
- Validation set is one election, and the model is anchored to that same
  election's baseline (2026-08 diagonal: 2025 is both calibration and test —
  holdout discipline in §Validation.3 is the only defence).
- Structural uncertainty (additive-linear swings, 2025-anchored flows,
  candidate-set assumptions) exceeds everything Monte Carlo can express;
  intervals are floor, not ceiling.

## Delivery stages

1. **Analysis only** — scripts + this plan in `.build/analysis/`, new data under
   `data/`; no site, no workflows, no validate.mjs changes.
2. **Backtest gate** — §Validation.3 passes (pair accuracy and MAE inside
   target) or the project stops here.
3. **Publication decision** — possible `/seats/` satellite or `/prediction/`
   extension; interval-first, "model output, not polling" framing per the
   disclaimer conventions. Deferred; needs its own conversation.
