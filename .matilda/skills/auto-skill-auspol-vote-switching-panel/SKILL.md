---
name: auspol-vote-switching-panel
description: auspol-tracker — the "Where One Nation's new voters came from" panel (§5b) end-to-end. Data is data/vote-switching.json (recalled-2025-vote → current-party transition matrix), hand-maintained via .build/vote-switching.mjs. gen-data ALL-OR-NOTHING gates each wave: any missing group→ON split or ON-retention returns null and the wave is silently dropped. Newspoll's remembered-vote writeup uses TWO bases — ALP→ON quoted as a share of the LOST vote, Coalition→ON as a share of ALL 2025 Coalition voters. Convert bases before comparing to the chart's stored all-voter pp or the numbers "contradict" what is already plotted.
source: auto-skill
extracted_at: '2026-09-24T06:59:15.806Z'
---

# "Where One Nation's new voters came from" (§5b) — auspol-tracker

## What it is / where it lives

- **Derivation:** `gen-data.mjs` §5b, comment block ~:1460 ("where One Nation's
  gains came from"), emit ~:3645 (keyed as `switchingPoll` on the current poll
  + `onSourceWaves` for the per-wave rates).
- **Panel JSX:** `a11e1559` asset ~:1540-1660 (h2 "Where One Nation's new
  voters came from"; verdict line "{a}% of One Nation's gain came from people
  who voted for X in 2025"; `openTerm("vote-switching", …)`).
- **Glossary / Info:** `d1a1d215` ~:5212-5216 (all-polls table columns for
  `p.sw.{lnp,alp,grn,oth,onp}`), and the `vote-switching` term + "A check."
  paragraph (~:6280-6296) whose identity is kept-ON + each group's switch
  share = ON's total.
- **THE INPUT: `data/vote-switching.json`** — a `waves[]` array of
  recalled-2025-vote → current-party transition matrices. Each wave:
  `pollster, date, dateStart, sample, article, source, read, onp, rows, total,
  fit`. `rows` is keyed by 2025 cohort (`alp, lnp, grn, oth, onp, dnr`), each
  row giving the CURRENT-vote distribution of that cohort as percents.
- **Maintainer:** `.build/vote-switching.mjs` — fetch/parse/patch helper.
  `read` is the MECHANISM token: `reparsed`, `measured from the chart`,
  `published table`, `assumed`, … and gates deterministic merge vs re-read.

## The all-or-nothing wave gate (the load-bearing rule)

A wave becomes usable ONLY if, per wave, EVERY 2025 cohort row carries the
share now voting One Nation, AND One Nation's own retention is present. The
derivation needs each cohort's →ON split to weight the gain, and ON's own
re-election to separate "new voters" from "kept" voters. If ANY of those is
absent the wave `return`s `null` and drops silently off the panel — no partial
row, no dot. This is why Newspoll historically contributed NO wave: its
published remembered-vote table omits some group→ON splits (and ON's own
retention), so it never satisfied the gate. (If you ever need Newspoll on the
panel, do NOT loosen the gate — collect the missing cells into the wave's
`rows` first.)

## Newspoll's TWO-BASE writeup (the thing that bites)

The Australian's "voters recall who they backed at the 2025 election" copy
quotes two cohorts on DIFFERENT bases:

- **Labor:** retained "a little under two-thirds"; then "of those lost, X%
  went to One Nation / Y% to the Coalition / Z% to the Greens / …".
  → every cohort percentage here is a **share of the LOST vote only**.
  To land it on the chart's all-voter basis: multiply by the loss
  (e.g. 65% retained → 35% lost; 15%-of-loss→ON ≈ 0.15×35 ≈ **5.1 pp of ALL
  2025 Labor voters**).
- **Coalition:** "retained 53% … 39% switching to One Nation."
  → these are **shares of ALL 2025 Coalition voters** (39% + 53% + rest = 100%),
  straight numbers, no conversion.

So the SAME prose sentence-set mixes denominators. ALP→ON=15% and LNP→ON=39%
aren't comparable to each other, and neither is directly the pp the chart
plots until the ALP figure is rescaled. Do the base-math before concluding a
discrepancy — the "contradiction" is usually the denominator, not the data.

## Worked check (2026-09): Newspoll vs the plotted YouGov/DemosAU/DemosAU waves

Compare like-for-like (all shares of ALL 2025 voters):

| quantity | Newspoll (raw → converted) | chart waves (YouGov 09-08/09-21, DemosAU 09-14, DemosAU) |
|---|---|---|
| ALP retained "a little under two-thirds" | ~65% | 65–68% (consistent) |
| ALP→ON | 15% of loss ≈ 35% → **~5 pp** | 13–14 pp of all ALP voters (higher) |
| LNP→ON | **39%** (verbatim) | 24–47 pp, 09-21 = 38 (consistent) |
| LNP retained 53% | 53% | 52% (consistent) |

The LNP→ON 39 and LNP-retained 53 land right on the 09-21 YouGov wave; the
ALP→ON ~5 pp sits BELOW the plotted 13–14 pp but that is a house/recall-method
gap, not an arithmetic error — and either way the *direction and magnitude
rank* are preserved. A recalled-vote matrix carries recall + false-consistency
bias (the `fit:` residual per wave quantifies the data-vs-model mismatch);
treat cohort cells as approximate.

## If you DO add a wave

1. `cp data/vote-switching.json /tmp/vote-switching.bak.json` (it's hand-curated;
   back it up first). Add the row under `waves[]` in `date` order.
2. Fill `rows` for ALL cohorts you intend the wave to claim — remember the gate.
   A Newspoll wave missing ON-retention + some group→ON cells will be dropped.
3. `read` must describe how each cell was obtained (`published table` >
   `measured from the chart` > `assumed`/`inferred`).
4. `node .build/newtracker/build.mjs` then `node .build/newtracker/validate.mjs`.
5. Verify the new wave actually rendered: the built dataset asset
   (`9f09dca2`) is a single-line JSON — probe it via the
   auto-skill-auspol-bundle-data-probe / window.AUSPOL recipe, not a line-grep.
6. Keep the Info glossary's "A check." identity true (kept-ON + group switch
   shares = ON total) — if your wave's ON cohort doesn't carry a retention
   figure the identity breaks and the wave shouldn't have been added.
