---
name: auspol-senate-pair-external-recon
description: auspol-tracker — when an external analyst's published Senate per-ballot pair statistic (worked 2026-11-09: Kevin Bonham's 2025 Coalition→"preferred One Nation over Labor" state table, today article) disagrees with the /map/ Senate-preferences lens. How to extract OUR figure, fetch the raw AEC zips, and adjudicate with an exhaustive variant battery; with the measured per-knob effect sizes and the verdict envelope (±0.5pt, same ordering — no data error).
source: auto-skill
extracted_at: '2026-11-09T04:58:47.389Z'
---

# Reconciling an external analyst's Senate pair-cut against the /map/ lens

## Where OUR figure comes from (read these first)

- Lens inputs: `data/senate-rankings-<year>.json` (per division, cohort
  (`COAL:SUB`/`ON`/`ALP`/`GRN`/`OTH:*`) → sparse `{patternIdx: ballots}`;
  `patterns` = first-appearance order of A/C/G/O in the ballot's saved run;
  built by `.build/analysis/seat-model/extract-senate-rankings.py`) →
  `.build/map/senate_prefs.mjs` → `map/data/senate-prefs-<year>.json`.
- Layout of senate-prefs divs rows: flat `[x,y,nei]` per (pair,donor),
  pair-major donor-minor. 2022/2025 carry six pairs
  `AC,AO,CO,GO,GA,GC` = 54 ints; 2016/2019 three pairs (AC,AO,CO) = 27.
  Pair letters: A=ALP, C=Coalition, G=Greens, O=ON. Coalition→{ALP,ON}
  cut = pair `AO`, donor `lnp` (x=ALP-ahead incl. ALP-only, y=ON-ahead
  incl. ON-only, nei=neither named).
- The reader's rule (extract-senate-rankings.py): BTL run (contiguous
  singletons 1..k) with ≥6 beats any ATL marks, else ATL; runs stop at
  first missing/repeated number (the AEC count rule); cohort = family of
  preference 1; tables reconcile to AEC TotalFormalPapers and cross-gate
  ≤0.22pt vs the ATL-only analyser (`checks.countsJsonCoalitionLaborVOnAtl`).

## The adjudication procedure (worked 2026-11-09)

1. **Print ours per state** from map/data/senate-prefs-<yr>.json
   (divisions→state via data/senate-rankings' `divisions[x].st`), and
   tabulate |ours − theirs| per line item. UNIFORM-SIGN small deltas
   (all seven states 0.09–0.46pp here) = systematic definitional drift,
   not a data bug. Sign-mixed large deltas = look for a cohort/family bug.
2. **Read the analyst's exact sentence in their own article** (the quote
   arrived pre-paraphrased 75% right: "above and below the line",
   cohort implicitly Coalition via the preceding sentence, denominator =
   ballots indicating a preference between the pair — nei excluded).
   Bonham's table appeared ONLY inside an election-outlook piece with no
   method note; expect that, don't expect a methods page.
3. **Replicate OUR reader against the raw zips first** as a probe sanity
   gate; then run a variant battery. Cache: `~/tmp/aec-senate-<eventid>/fp-<ST>.zip`,
   URL `results.aec.gov.au/<ev>/Website/External/aec-senate-formalpreferences-<ev>-<ST>.zip`
   (byte-verify against `data/senate-rankings-<yr>.json` `_provenance`).
   Scripts from this session live at `.matilda/bonham-senpref-probe{,2,3}.py`
   (scratch; import `family` from extract-senate-rankings.py).
4. **The plausibility inversion**: holding x fixed, solve y* needed to hit
   the external share per state, then check the nei pool's depth. Here the
   needed extra ON-classified ballots (e.g. +13.2k VIC, +4.5k SA) exceeded
   what ANY permissive nei-recovery could supply — and the recovered
   ballots leant ALP when re-admitted. That killed "defect handling" as
   the cause. Fold in the nei deltas per reader variant as the evidence.
5. **Universe cross-validation at seat level when the analyst names
   seats.** Bonham's "Calwell the exception, Goldsteins/Kooyongs normal"
   matched ours exactly (Calwell 54.6 vs ~72.5–75.3 neighbours) — proving
   both pipelines read the same universe before debating decimals.

## Measured effect sizes of each methodology knob (2025 cut, Coalition→{ALP,ON})

- Truncation (AEC count rule) vs tolerant full read / distinct-6 BTL /
  gap-skip: ≤0.1pp, mostly WRONG direction (tolerant recovers ALP-side
  more than ON here).
- BTL/ATL side selection & duplicate-number handling
  (`side_anyB`,`side_atl`,`dup_void`,`dup_last`): ≤0.08pp.
- ATL-only lineage (counts.json analyser): per-state −0.22..+0.5pp — fits
  NSW/QLD to rounding but blows out WA/SA/NT by +0.3..+0.6.
- **Exit-destination** (first family named after the source family): the
  BIG fork, +1.5..+3.9pp above any-first-mention cut — always disambiguate
  which of these a "preference flow" number means BEFORE comparing.
- Both-named-only (pair must both appear): −13..−22pp — rules out fast.
- Seat-mean vs ballot-weighted: −0.9..−2.1pp.
- Cap at first 6 (or 10/12) preferences: ≤0.7pp wobbles, no consistent lift.
- Rounding 1dp contributes ≤0.07pp apparent drift; a casual "same as"
  pairing (VIC=WA printed equal) already signals approximated cells.

## Verdict pattern & numbers to quote

Difference was sub-half-point, uniform-direction, unexplained-by-any-rule
sum: print the table (ours | theirs | delta), state the shared ordering
(NSW>QLD>VIC≈WA>SA>NT>TAS), and the envelope: **±~0.5pt between careful
readers of the same zips; no canonical per-ballot standard** — the
published explorers themselves diverge unreconciled (Barry's cross-table
guide notes unexplained differences vs Poll Bludger's sheet). Our figures
are the replicable, dual-gated ones; keep them. 2025 worked values:
ours NSW 78.11 / VIC 73.48 / QLD 76.95 / WA 73.38 / SA 70.74 / NT 70.13 /
TAS 63.24 vs Bonham 78.2 / 73.8 / 77.1 / 73.8 / 71.2 / 70.3 / 63.4.
National: ours 75.24 (all ballots) vs ATL-only 75.49 — both his
"around three to one". ACT shows nothing on both sides (no ON group).
