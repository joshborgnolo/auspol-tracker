---
name: auspol-seat-model
description: The .build/analysis/seat-model 2028-seat-simulation kit (W1-W7 build order, committed as of 2026-10-08) — file map per workstream, the GES 150/150 null-replay discipline, candidate-level (never group-level) elimination, W4 vote-layer shrinkage stack, and W5 WIP failure modes.
source: auto-skill
extracted_at: '2026-10-08T03:33:51.268Z'
---

# auspol-tracker — 2028 seat-model kit (.build/analysis/seat-model)

## What it is

A multi-workstream Monte-Carlo seat-projection engine translating the site's
polling aggregates into 150-division win probabilities for the 2028 election.
Plan: `.build/analysis/seat-model-plan.md` (6341a4f). Build order the user
directed: **W7 → W1 → W3 → W1b → W2 → W6 → W4 → W5** (all Stage 1 "Analysis
only" — scripts + data under `.build/analysis/` and `data/`, never site,
workflow, or validate.mjs changes). All seven are committed as of 2026-10-08
(W5 = e06f434). Deferred and NOT built: the §Validation.3 holdout gate (needs a
2022 baseline), the β=0 demographics ablation, W8 redistribution monitor,
Stage-3 publication.

## File map per workstream

| WS | Deliverable | Commit |
|----|-------------|--------|
| W7 | benchmark/comparator expectations (poliwave 78 / GES 73 / theswingison 69 / aeforecasts 68) | 4a626f8 |
| W1 | `data/census-2021-divisions.json` (2021-boundary census frame) | ab615d1 |
| W3 | `data/seats-2025-baseline.json` (150 seats, certified primaries incl member:<surname> keys) | 76477c0 |
| W1b | `data/census-2021-divisions-2025.json` + `map-census-2025-frame.mjs` (ABS correspondence CG_CED_2021_CED_2024→CG_CED_2024_CED_2025) | 110fd44 |
| W2 | `data/aec-2025-seat-flows.json` + `extract-2025-seat-flows.mjs` (per-seat candidates + certified exclusion rows `to:{candIdx:votes}`, 976 counts/826 exclusions) | f9b1816 |
| W6 | `data/seat-candidate-set-2028.json` + `candidate-overlay-2028.json` (W6's ONE NATION-everywhere assumption adds Bean/Canberra/Fenner) | 6d89863 |
| W4 | `.build/analysis/seat-model/vote-layer.mjs` + test + `data/seat-vote-layer.json` | aab752d |
| W5 | `.build/analysis/seat-model/swing-simulate.mjs` + test + `data/seat-model-2028-nowcast.json` + `data/seat-model-2028-history.jsonl` | e06f434 |
| W5.1 | `.build/analysis/seat-model/flow-recipients.mjs` — national flow fallback DERIVED from `.build/newtracker/flows.mjs` (see "W5.1" section) | 13d82da |

## Working conventions (all workstreams)

- `_about` (plain-language hard limits) + `_provenance` (sha256-16 of every
  input file) on every data output; tests re-hash the live files.
- Raw vote counts, never shares, until a single final normalisation
  (double-division was the W4 "all values ~0" bug).
- Explicit-path commits on the dirty shared worktree:
  `git add <paths> && git commit -m <msg> -- <same paths>`; never sweep
  sibling-session staged files.
- `node .build/newtracker/validate.mjs` exit 0 before committing data changes
  (documented-exception lines print; exit code is the signal).
- Probe scratch in `.matilda/` (e.g. `.matilda/probe-dop.cjs`), not committed.

## The GES null-replay discipline (the load-bearing lesson)

Before ANY real simulation run, the engine runs **null mode**
(`AUSPOL_SIM_NULL=1`): zero national swing, zero state deviations, zero β,
zero residuals, exact certified counts, exact certified flows. It MUST
reproduce all **150/150** certified 2025 winners. A miss is an *engine bug*,
not noise. Two null-mode properties must be structural, not caller-promised:

- every stochastic term must have an explicit `NULL_MODE ? 0 : …` branch —
  the β demographic swing was accidentally left applying the fitted value and
  silently corrupting the replay (`m[p].beta` in both branches);
- null mode can never overwrite the committed nowcast — `OUT_PATH` defaults
  to `os.tmpdir()` when `NULL_MODE`, not just when the caller sets
  `AUSPOL_SIM_OUT`.

`AUSPOL_SIM_DRAWS` (default 20000) lets `test-swing-simulate.mjs` re-run the
replay at 250 draws — null draws are deterministic (exact counts).

## Eliminate per CANDIDATE, never per group

The one failure mode that took the replay to 138/150 (misses: Calare, Cowper,
Lyne, Riverina, Calwell, Goldstein, Monash, Wannon, Fisher, McPherson, Grey,
Forrest): group-collapsed elimination mis-orders exclusions wherever a seat
has **two candidates mapping to the same 5-key group** (two independents →
"oth", or Coalition pair → "lnp"). The fix mirrors W2's own extractor test —
the W2 flow rows are per-candidate (`flows[].to` indexed by candidate index),
so the simulation must spread perturbed group shares onto candidates by
certified within-group vote shares, exclude the min pile candidate-by-
candidate, and re-deal by that candidate's certified count row (Dirichlet at
count scale in sim mode, exact in null). Fallback chain when a row is absent
(synthetic `syn-on` for W6's ACT seats): W5.1's derived national row
(flow-recipients.mjs, see below) → uniform. In null mode the seat groups are
REPLACED by the certified 2025
group set so the replay field matches.

## W4 vote layer anatomy (data/seat-vote-layer.json)

- National ΔV = gen-data `primaryNow:` stdout line (spawn with
  `GEN_DATA_OUT=tmp`, `GEN_DATA_POLLS` seam, `maxBuffer 1<<28`; parse the
  P5 keys; `member:<x>` folded into `oth`, Coalition keys → `lnp`) **minus
  certified 2025 counts raw-summed from the W3 baseline**.
- State deviations: per-house centre-then-pool (self-centreing cancels each
  house's national-level bias), difference-in-differences where a baseline
  wave exists, DerSimonian–Laird random effects, then across-state shrinkage
  toward 0 with **`TAU2_FLOOR=1`** — a τ̂²=0 draw otherwise collapses every
  state dev to exactly 0±0 ("a 0 estimate is estimation noise, not certainty").
- Composite cells (YouGov ACT/NT/Tas; Resolve "Rest of Australia"→SA/WA/
  TAS/NT/ACT) applied per covered state at **double variance**, flagged
  `compositionOnly` on TAS/NT/ACT.
- β (demographic swing) is **age + gender ONLY** — the Resolve 2025-05-03
  baseline wave's only dims. Education/income/location/housing/generation are
  declared `notEstimable` in output; never back-filled. `Σ w_g β_g = 0` by
  construction (re-centred on census weights).
- Mutation-during-iteration trap: the β self-centreing loop wrote results
  into the same object later iterations still read (`NaN` after the first
  cell) — snapshot d/v for all cells first, then write.
- Measured W4 values (2026-10-08): nowcast alp 26.7 / lnp 21.6 / on 27.0 /
  grn 13.4 / oth 11.3 vs certified 34.6/31.8/6.4/12.2/12.2 → Δ −7.9/−10.2/
  +20.6/+1.2/−0.9. QLD on +4.45±0.89, VIC on −2.64±0.71. β age 18–34 on
  −9.34±1.19, 55+ on +7.26±1.15. Window RECENT_DAYS=60.
- Resolve polls.json rows carry **no `sample`** — waveSample matches
  polls.json ±14 days, else the house median, flagged `inferred` (baseline
  inferred n=1801).

## W5 engine constants and shape

`DRAWS=20000`, `SEED=20261008` (mulberry32 + Box–Muller + Marsaglia–Tsang
gamma → dirichlet). `PROP_MIX=0.5` (poliwave): `v = baseG·(1+PROP_MIX·sw/max(
nat2025,0.5)) + (1−PROP_MIX)·sw·shareOfP`, floor 0, renormalise 100.
`SIG_SEAT=2.0`+`SIG_STATE=1.5` are **declared structural, not fitted** (the
§V.3 holdout gate is where they earn their keep); `INCUMBENCY_PP=0` is a slot;
`FLOW_DRIFT=0`. National level per party ~ N(Δnat, σ_poll²) with σ_poll from
polls.json primary dispersion over the same 60-day window. History:
`data/seat-model-2028-history.jsonl`, one record per `rec.date`, deduped,
appended only in non-null mode (prediction-history pattern).

First nowcast (W5, superseded hours later by W5.1): ALP 86.71 / LNP 31.68 /
ON 17.46 / GRN 3.03 / OTH 2.85 / IND 8.27; ALP majority 94.9%. Corrected
W5.1 nowcast: **ALP 63.24 / LNP 25.50 / ON 46.98 / GRN 4.42 / OTH 2.05 /
IND 7.82; ALP majority 7.4% (none 92.6%); classic 2PP ALP 51.23%
[49.37–53.1]**.

## W5.1 — the national flow fallback must come from the 2PP flow constants

User reaction to 86.7 was "that's so high…" + "flows should be linked to
the flows used in 2pp". Diagnosis: the old `natFlows` block summed every
seat's certified group→group row out of `data/aec-2025-seat-flows.json` —
but **only 25 of 150 seats ever excluded a Coalition candidate in 2025**
(all teal-type, ON already out), so the aggregated lp/lnp fallback row was
`→ALP 49.7%, →ON 0.0%`. Every simulated ALP v ON final (58.5 expected, a
certified zero in 2025) resolved ALP; ~15–25 manufactured Labor seats. The
fix, committed 13d82da:

- New `.build/analysis/seat-model/flow-recipients.mjs` derives the whole
  national fallback FROM `.build/newtracker/flows.mjs` — the same constants
  that price the site's implied 2PP, so a constants refresh flows through.
  Minor groups: `grn→{alp: FLOW.grn}`, `on→{alp: FLOW.onp}`, `oth→{alp:
  FLOW.oth}` with the remainder spread across Coalition keys by 2025
  candidacy counts (lp 106 / np 19 / lnp 30 / clp 2 — `coalSpread`, and it
  must normalise over the *remaining* siblings, not the full total — the
  first cut left every Coalition row summing to 0.95–0.99).
- Coalition-excluded row can't come from the TPP table at all (zero 2025
  Coalition→ON measurements exist, and the TPP table never prices one), so
  it is two stated pieces: ALP share = `COAL_LEAK_ALP = 11117/62419 ≈
  0.178` (the per-ballot 3-corner leak behind FLOW_3CNR, Liberal 12.47% /
  Nationals 18.97% blended); ON share = `COAL_TO_ON = 0.65`, an explicit
  modelling constant reciprocal-consistent with the certified on→coal 61.5%
  row. Its sensitivity belongs to the §V.3 holdout gate, not to local
  tuning.
- Certified per-seat rows still take precedence; the derived rows fire only
  when no certified row is usable (synthetic `syn-on`, receivers
  exhausted). Renormalise onto standing candidates at use time, so extra
  destinations (Coalition partner not running, ON absent) drop out.
- The derived rows are SHARES summing to 1, but the elimination Dirichlet
  expects ballot-scale concentrations — scale back up (`× 50 000`) or the
  fallback transfers become near-uniform noise.
- Vocab walk: sim group keys are raw (`member:<surname>`, `ind-declared`,
  four Coalition keys) — `nationalFlowRow()` maps `member:*` → `member`,
  and the destination lookup needs the same prefix split. Every row must
  sum to exactly 1 (test pins this + FLOW.`{grn,onp,oth}` anchors + the
  Coalition row favouring ON over ALP).

Null replay held 150/150 through the swap (fallback never fires in null
mode — certified rows cover the whole 2025 field). The same-date history
record was REWRITTEN in place from the corrected nowcast rather than
appended, since it had been generated by the known-biased fallback within
the same window date. Learned cleanup: the pre-existing `FLOW_ONP` draft
block in flows.mjs was wrong and nothing imported it — `git checkout --`
the production module and keep ALL sim-side derivation in the seat-model
kit; flows.mjs stays a read-only input.

## W5 WIP failure modes (carried over)

Earlier estimate-versus-envelope thinking (pre-W5.1): expect ALP inside the
W7 comparator envelope 68–78; ON expected seats respond HARD to
COAL_TO_ON (0.65 ⇒ ON ≈ 47); the same-date-dedupe history append silently
no-ops a corrected re-run, which is why the record had to be rewritten by
hand.

## Small failure modes hit and fixed (W5 WIP)

- Report multiplied raw draw counts by 100 without dividing by DRAWS
  (`Parkes 2000000%`) — display helpers: `100*w/DRAWS`.
- Property drift: seat object built as `baseGroups`, perturb loop read
  `seat.base` → `Cannot read properties of undefined` mid-simulation. The
  failure surfaced under null mode; run null FIRST, it exercises the same
  code paths cheaply.
- History-append originally tangled with no-op `if` clauses — keep it to one
  per-date dedupe: `if (!existing.some((r) => r.date === rec.date))`.
