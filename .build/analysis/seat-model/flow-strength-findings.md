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

- **ON needs a conditional.** For seats with no 2025 ON flow row — the three
  uncontested ACT/Bean seats under W6's run-everywhere assumption, plus
  Hunter/Maranoa — do not lift the pooled 75.7%-to-Coalition constant
  blindly: condition on the modelled ON primary. A defensible first cut is
  the bin table above (≈85% to Coalition below 3% primary, falling to ≈73%
  above 12%).
- **GRN and OTH constants can stay unconditional** where a seat read is
  missing; ~82% ALP for GRN, and for OTH recompute per candidate-set rather
  than using the pooled 52.8%.
- **Seat-anchored Dirichlet draws (current W5 plan) already preserve the
  cross-seat ON gradient** for the 145 seats with rows — the term matters
  only for imputed/no-read seats. Optionally add the +0.8–1.0 pp/pp slope
  as a weak prior when the draw must move with the simulated ON primary.
- Ballot-level purity (caveat 1) is unresolved within this repo; treat the
  ON slope as an upper bound, not causal.
