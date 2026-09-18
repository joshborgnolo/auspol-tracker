---
name: auspol-poll-predictivity
description: auspol-tracker — "how predictive is a poll N months out?" analysis script (.matilda/poll-predictivity.mjs, uncommitted scratch) and its computed headline answer (2026-09-14). Method: per election, monthly-bin all historical 2PP/primary readings in [m−0.5, m+0.5) months before polling day, average per election, then cross-election MAE/RMSE/bias/r + winner hit-rate over 14 elections 1987–2025. Data gotchas: roymorgan CSVs' election=1 rows are RESULTS (skip as polls), acnielsen cols tpp=12/alp=5/lnp=6, newspoll primaries have combined coalition, script must use repo "../" from .matilda/. Findings table embedded — answer recurrences without rerunning; rerun only if the corpus changes.
source: auto-skill
extracted_at: '2026-09-14T00:40:33.190Z'
---

# auspol-tracker: poll lead-time predictivity analysis

Built 2026-09-14 to answer "how predictive are 2pp/primary polls 20, 19, 18…
months out of the election outcome?" as an ANALYTICAL question (message answer,
not a site change). Script: `.matilda/poll-predictivity.mjs` — scratch, NOT
committed (`.matilda/` is gitignored; commit only if the user asks).

## Method (reusable recipe)

1. Election results table: hardcoded `ELECTIONS` array in the script (14
   elections 1987–2025, `{y, date, alp2pp, alpPrim, lnpPrim}`), sourced from
   gen-data.mjs `CYC_META` (~:1960+, per-cycle `{year, eDate, ePrim, eTpp}`).
   Refresh from there if elections are added.
2. Monthly binning: `month = 30.4375 days`; for each election and m=0..24,
   average all readings with fieldwork-end in `[eDate − (m+0.5)·month,
   eDate − (m−0.5)·month)`. THEN compute cross-election stats per m
   (equal election weight per bucket — this is deliberate; pooling raw
   readings would let high-cadence eras/houses dominate).
3. Metrics per m: MAE, RMSE, bias (mean signed error, + = polls read ALP
   above result), Pearson r, winner hit-rate, share within ±3pt.
4. Data sources + the quirks that bite:
   - `data/newspoll-two-party-preferred.csv` (1993+) / `-primary-vote.csv`
     (1985+, COMBINED coalition, `<0.5` strings, blank minors = null≠error).
   - `data/roymorgan-{two-party-preferred,primary-vote}.csv` — `election=1`
     rows hold ACTUAL RESULTS; skip them as poll readings.
   - `data/acnielsen-polls.csv` (1996–2012) — wide row: tpp_alp=col12,
     alp=col5, coalition=col6; skip `election=1`.
   - `data/polls.json` — live term; fields `tpp_alp`, `alp`, `lnp`,
     `firm`; date = `date ?? fieldworkEnd ?? end`.
   - Path trap: scratch scripts in `.matilda/` need `const repo = "../"`
     (NOT `../../` — that resolves above the repo root → ENOENT).

## Computed answer (2026-09-14; 1468 2PP + 2006 primary readings, 14 elections)

ALP-2PP MAE / bias / r / winner-hit by months-out:
- m0: 2.9 / −0.4 / 0.28 / 50%(n12) — m1 3.8, m2 4.2(+2.1), m3 5.6
- m4–9: 4.5–5.4 (worst band; +1.3 to +3.6 pro-Labor bias at 5,7,8,10m —
  opposition leads that unwind by election day)
- m12: 2.5, m14: 2.5, m15: **2.4** (best anywhere; r to 0.52)
- m18–24: 3.5–4.6 — as good as the 3–9m band
- Winner hit-rate: 30–60% everywhere, best 67% @16m, only 50% even at m0
  (1998/2001/2010/2016 all decided inside ±1.5pt 2PP — uncrossable)
- Within ±3pt of the result: m0 7/12, m12 8/10, m24 2/10

Primaries track themselves far better: ALP prim MAE 1.9 @m0 (r=0.93),
~3–4 @18–24m; LNP prim MAE 1.8 @m0, ~3.5 @20–24m.

## Interpretation (the durable shape of the answer)

- MAE sits in a 2.4–5.6pt band at EVERY lead time — the 2PP signal saturates
  early and stays noisy; 18–24m out ≈ 3–9m out in accuracy.
- The 3–9m-out band is paradoxically the worst (campaign/budget turbulence)
  and carries the systematic pro-opposition bias that unwinds by m0.
- 12–15m out is a real sweet spot (post-honeymoon settling, pre-campaign noise).
- Magnitudes informative, winner calls not: knife-edges make hit-rate ~coin-flip.
- Caveats to repeat every time: n≈10–12 elections per bucket (one weird cycle
  moves numbers); the current fragmented-primary era (ON ~27%, FP_ON flows
  assumptions) is OUTSIDE this historical sample.

Run: `node .matilda/poll-predictivity.mjs`. Related: auspol-historical-csv-qa
(source schemas), auspol-estimator-arms-race (backtest recipe, different
question), auspol-accuracy-panel (final-poll accuracy, per-cycle not per-lead-time).
