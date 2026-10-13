# Donor primary strength vs preference-flow split, by seat — 2025 election

Analysis run 2026-10-13 against `data/aec-2025-seat-flows.json` (W2 extractor
output; provenance-pinned `cec41a86bc199b9f`, extracted from the AEC's
`HouseDopByDivisionDownload-31496.csv`). Reproduce with:

```
node .build/analysis/seat-model/flow-strength-vs-primary.mjs
```

## Question

Does a party's **primary-vote strength in a seat** predict **where its
preferences flow in that seat**? Matters to the seat model wherever a 2025
read is unavailable: seats the party didn't contest (W6 runs ON everywhere in
2028), seats where the donor reached the final count (no distribution), and
whether the W5 sampler needs a donor-strength term or can Dirichlet-draw
around 2025 seat means alone.

## Method

Per seat, per donor group (`grn`, `on`, `oth`; exactly one GRN and one ON
candidate per seat, verified):

- **x** = donor's primary votes ÷ formal votes in the seat (%).
- **y** = ALP share of the **majors portion** of the donor's flow —
  `to(alp) ÷ (to(alp) + to(lp|lnp|np|clp))`, from the seat's `groups` row —
  the standard AEC DoP convention: the pile at the donor's exclusion is
  credited to the donor *as a whole*, inherited votes included. Coalition
  combines are grouped before the share is taken.
- Seats with a flow row but `to(alp)+to(coal) = 0` (both majors eliminated
  first) are dropped from correlations but counted for censoring.
- Stats per donor: unweighted and pile-weighted Pearson r, Spearman ρ,
  OLS slope (pp of ALP share per pp of primary share, unweighted and
  pile-weighted), and fixed share-bins with pile-weighted means. 2025 DoP
  records no exhausted votes, so nothing is lost to exhaustion.

## Findings

| Donor | Seats w/ flow | Pooled ALP share (pile-weighted) | r | ρ | Slope (pp/pp) |
|---|---|---|---|---|---|
| GRN | 140 | 82.2% | +0.19 (wtd +0.31) | +0.13 | +0.28 unwtd / +0.43 wtd |
| **ON** | 145 | 24.3% | **+0.40** (wtd +0.36) | **+0.44** | **+1.01 unwtd / +0.83 wtd** |
| OTH | 146 | 52.8% | +0.10 (wtd +0.13) | +0.18 | +0.15 unwtd / +0.19 wtd |

**Only One Nation shows a real association.** Pile-weighted ALP share of the
ON flow by ON primary share: **<3% → 15.2%**, 3–5% → 19.8%, 5–7% → 22.7%,
7–9% → 25.9%, 9–12% → 26.8%, **>12% → 27.1%** (n=19/33/38/27/20/8). Where ON
is weak its preferences behave like Liberal votes (~85% to the Coalition);
where it is strong Labor takes roughly a quarter-plus. Consistent with
high-ON seats being regional working-class seats whose ON voters are more
ex-Labor — an ecological reading, not individual-level.

**Greens: flat.** 79.7–83.8% to Labor across the whole 0–18% primary range;
only the ≥18% bin lifts (88.7%, n=8), and the sample dies exactly there —
the ten strongest Green seats (Melbourne 39.5%, Wills 35.4%, Griffith 31.7%,
Ryan 29.0%, Fraser/Cooper/Grayndler ~25%, Newcastle, Sydney, Canberra) have
no flow row because the Green candidate was never excluded. Green→Labor can
be modelled as a constant ~82% wherever a seat read is missing.

**Others: no association** (r +0.10), and the bucket is heterogeneous (teal
independents whose prefs flow heavily Labor + minor parties) — do not model
as one population. Its pooled 52.8% is a category average, not a voter
behaviour.

## Cross-election replication (2022 / 2019 / 2016)

Same method on the AEC DoP downloads for events 20499 (2016), 24310 (2019),
27966 (2022) — identical CSV shape, ON code, and the no-exhaustion, N−2
exclusion invariants all hold (pinned at parse). Vendored under
`.build/analysis/seat-model/cache/` (gitignored); reproduce with
`flow-strength-vs-primary-history.mjs`. One deliberate difference: with no
historical W3 baseline, elected crossbenchers stay in `oth` (they are never
excluded, so donor rows are unaffected — only `oth` primary shares are diluted
by their votes).

| Donor-cycle | seats w/ flow (contested) | Pooled ALP share | r | Verdict |
|---|---|---|---|---|
| GRN 2016 | 144 (150) | 78.5% | +0.21 | flat 76–79%, 83% at >18% |
| GRN 2019 | 146 (151) | 77.7% | +0.38 | flat ~75%, 83–84% at >14% |
| GRN 2022 | 142 (151) | 80.2% | +0.27 | flat ~79%, 86% at >18% |
| **GRN 2025** | 140 (150) | 82.2% | +0.19 | **replicates the 2025 shape** |
| ON 2016 | 14 (15) | 50.2% | +0.16 | too few to judge (raw rows only) |
| ON 2019 | 58 (59) | 33.9% | +0.17 | no gradient (bins 27→37→34) |
| ON 2022 | 149 (149) | 33.5% | +0.04 | **none — flat 32–37% at every level** |
| **ON 2025** | 145 (145) | 24.3% | **+0.40** | **gradient is 2025-specific** |
| OTH 2016 | 149 (149) | 43.0% | +0.15 | unstable, heterogeneous |
| OTH 2019 | 151 (151) | 39.3% | +0.04 | flat |
| OTH 2022 | 151 (151) | 43.0% | −0.24 | sign-flips cycle to cycle |
| **OTH 2025** | 146 (150) | 52.8% | +0.10 | "do not model as one population" replicates |

**The GRN and OTH findings replicate; the ON gradient — the one actionable
finding — does not.** In 2022 the ON→ALP share of the majors flow was flat at
~33% from the weakest ON seat to the strongest (r +0.04); 2025's 15%→27%
gradient arrived with 2025's regime: ON preferences hardened nationally toward
the Coalition (pooled ALP share 50.2% → 33.9% → 33.5% → **24.3%**, the well-
known 2025 shift), and the gradient comes from the weak end collapsing to
Liberal-like splits (15%) while strong regional seats softened far less (27%).

Censoring is endemic to GRN in every cycle (the donor's strongest seats —
Melbourne 43.7%→49.3%→49.6%→39.5%, Batman, Wills, Griffith — never distribute
their pile). Inheritance medians are likewise stable: own-vote share of the
donor's pile 0.82–0.84 GRN, 0.64–0.79 ON, 0.79–0.87 OTH across all four
cycles.

Levels note: these are the pile-at-exclusion-of-the-donor, majors-renormalised
cut. The AEC's headline TCP-flow products sit a couple of points off for
cut-definition reasons — the aec-flow-cuts skill reconciles exactly those
cuts; cycle-to-cycle comparisons here are internally consistent, which is what
the gradient question needs.

## Caveats

1. **Pile ≠ pure first preferences.** The DoP pile carries votes inherited
   from earlier exclusions; median own-vote share of the donor's pile is
   82% (GRN), **66% (ON)**, 87% (OTH). About a third of the typical
   "ON flow" is recycled minor-party votes (OTH→ON transfers ride through),
   which mechanically constructs part of the ON gradient: where ON's own
   vote is small, the pile is *more* recycled. This is the AEC's published
   flow-convention, so it is self-consistent with the W2 layer's use, but a
   ballot-level ("formal preferences") product would be needed to isolate
   pure ON→major transfers.
2. **Right-censoring.** Flow rows exist only where the donor was excluded —
   the strongest seats are unobservable precisely where the effect would be
   most diagnostic (10 GRN seats incl. the four >25%; ON: Hunter 16.1%,
   Maranoa 12.3%; Bean/Canberra/Fenner had no ON candidate at all).
3. **Ecological.** 150 seat-level observations; state/region composition
   rides along (high-ON seats are disproportionately regional Qld).

## Seat-model implications (W2/W5/W6)

Revised after the cross-cycle replication:

- **Cycle-locality is the headline.** The ON→Coalition level moved 50→
  66→ 66→76% across four cycles and the cross-seat ON gradient exists only
  in 2025. Flow constants must come from the *current* cycle — do NOT lean
  on the 2022 file, and plan Validation #2's flow backtest should expect
  and tolerate level drift, not treat it as error. (The plan's Dirichlet
  drift parameter is the right mechanism.)
- **Seat anchoring (current W5 plan) carries the 2025 ON gradient for the
  145 seats with rows** — correct choice; no extra term needed for them.
- **No-read seats (W6's ON-everywhere set: Bean/Canberra/Fenner, plus
  Hunter/Maranoa)**: the 2025 conditional (≈85% to Coalition below 3%
  primary, ≈73% above 12%) is the best single prior — 2028's ON electorate
  composition should look more like 2025's regime than 2022's — but it is
  regime-contingent, not structural. Treat the pooled 75.7% as a fallback,
  not a law.
- **GRN**: flat ~78–82% to ALP in all four cycles, level drifting up
  slowly (+~1pp/cycle since 2019); constant-per-cycle is adequate wherever
  a seat read is missing, with the same current-cycle proviso.
- **OTH**: unstable level (39–53%) and shape across cycles; never pool
  across candidate types — recompute from the actual 2028e candidate set.
- Ballot-level purity (caveat 1) is unresolved within this repo; treat the
  ON slope as an upper bound, not causal.
