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
  who voted for X in 2025"; `openTerm("vote-switching", …)`). With the
  redesign on, `RdSwitching` in rd-panels.jsx (~:1770-2000) renders instead.
  TITLE/DEK SWAPPED (user's, **2026-09-30**, everything computed live):
  the **head** is the switch-RATE sentence — `rdCap(plainShare(hiC.rate)) +
  " 2025 {A} voters now back One Nation"` (e.g. "Almost two in five 2025
  Coalition voters now back One Nation") — and the **dek** is
  "{A} voters have flocked to One Nation at about {r} times the rate of {B}
  voters. {share} of One Nation's new voters backed the {Z} in 2025." where
  {A}/{B} follow whichever of lnp/alp rates higher, {r} is the ratio rounded
  to the nearest quarter, and the second sentence is the OLD head: {share} is
  rdFraction of the top gain share and {Z} that gainer's party ("the
  Coalition"/"Labor"/"the Greens"/"another party"). The pre-swap dek tail
  "{share} 2025 {A} voters now say they'd vote for One Nation." is GONE —
  don't grep for it as a health check. Both figures recompute every build;
  hiC/loC derivation sits at rd-panels.jsx ~:1816-1832.
  - Dek → graphic spacing (user-found loose on phone, 2026-09-29):
    `.rd-mo-wrap { margin-top: 36px }` is the desktop value; **06bb319**
    adds a ≤640px override of **28px**. On phone the card is fully unboxed
    (`.rd-card` padding/background/border 0, rd.css :545), so that margin IS
    the whole perceived gap — it measured 36px = 1.7× the phone dek's
    line-height against who-votes' 28px = 1.33× on the same dek→content
    step. The site's phone rhythm for a block directly under a dek is
    **28px** (`.rd-wv-tabs`, `.rd-dir-chart` phone, `.rd-un-sp`);
    `.rd-is-grid` at 36px is the other desktop-carryover outlier if spacing
    triage ever reaches the issues panel. Probe:
    `.matilda/probe-switching-gap.mjs` measures dek-bottom →
    first-graphic-top at 390/1440 and compares ACROSS SECTIONS in
    line-heights — the reusable pattern for any "is this gap too big?"
    report: never judge one gap alone, rank it against the siblings.
  - Mosaic encoding: fills = switch RATE, text under bars = gain share —
    the ORIGINAL setup. A one-day reversal (**742df1e**, fills=gain /
    text=rate) was REVERTED on the user's "undo this reversal" the same
    afternoon (2026-09-30, landed uncommitted alongside the title/dek swap
    via `git revert --no-commit 742df1e`): the "Area: voters gained" key
    clause, the "Stayed or went elsewhere" caption and `.rd-mo-else` are
    back, and `.matilda/probe/switching-reverse.mjs` was deleted by the
    revert (a probe pinning a dead encoding would fail from then on).
  - Mosaic `pts` label chains (user's, 2026-09-30): the FIRST column's
    points row descends "… of One Nation's gain" → "… of ON's gain" →
    bare, the SECOND descends "… of the gain" → bare, all later columns
    are bare ("≈ 3.1 points"); the chains are SVG-column-label only —
    the phone `.rd-mo-rows` variant still shows "≈ N pts". The SHARE row
    under the points row carries its tail on the FIRST column ONLY and
    there as "of the gain" (never "of One Nation's gain" — that column's
    pts row above already says it); the second column's share row is
    bare for the same reason — each column says its counting tail once,
    on exactly one of its two sub-rows (user's rule, 2026-09-30, two
    follow-ups in a row). Pinned by
    `.matilda/probe/switching-title-dek-swap.mjs` (15 checks, 1280 +
    390px; floats its own http server — map "/" → "/index.html", and use
    `new Function` on the 9f09dca2 asset for live expectations;
    `S.series` is an ARRAY of `{id,…}` entries, not a keyed object).
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
