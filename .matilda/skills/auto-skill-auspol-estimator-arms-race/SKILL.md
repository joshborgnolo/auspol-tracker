---
name: auspol-estimator-arms-race
description: "auspol-tracker — procedure for backtesting a change to headline-estimator constants/weights: VERBATIM estimator replica in a .matilda scratch, HEAD-pinned input, parity gate via GEN_DATA_POLLS/gen-data console line, LOO + paired bootstrap + election anchors. Plus: npm test's `deff-backtest` parity FAIL (A0 replica vs committed 9f09dca2 asset) is often PRE-EXISTING committed dataset drift, red at clean HEAD — verify pre-existence (HEAD commit messages document the drift / stash or worktree probe) before treating it as your regression; it halts the && chain before test-vic-build and `npm test | tail` exit codes are tail's."
source: auto-skill
extracted_at: '2026-09-05T06:20:00.000Z'
---

# Arms-racing an estimator constant (auspol-tracker)

Applies to any proposed change to the headline estimator's constants or
weighting (`HL_DEFF` / derived-path α, `HE_HALF`, `SHRINK_K`, `HL_WINDOW`,
`HL_HALF`, `SAMPLE_CAP`, the √m deflation…): race the change against the
production estimator on the real data before touching `gen-data.mjs`.
First run of this procedure: the 2026-09-05 DEFF question (see
auto-skill-auspol-effective-sample → "Measured DEFF census"), script
`.matilda/deff-backtest.mjs` — since deleted (scratch probes do not
survive `.matilda/` cleanups; templates in order: 2026-10-02 HL_HALF
`.matilda/hl-half-backtest.mjs` → 2026-10-03 Silver-calibration
`.matilda/silver-calibration-backtest.mjs`, the newest and the first with
the NO_AGG_HOUSES row-filter correct). Rebuild a replica from the
gen-data block each time; parity will catch a stale copy.

**Replica staleness trap that COST a setup round (2026-10-03):** the
tppRows row filter in production is `p.tpp_alp != null &&
!NO_AGG_HOUSES.has(p.pollster)` with `NO_AGG_HOUSES = new Set(["Roy
Morgan (SMS)"])` (gen-data.mjs :112 + the tppRows one-liner right after
recencyW). The hl-half template's replica dropped the NO_AGG_HOUSES
clause; parity failed by exactly v +0.1 / se −0.01 (52.2/0.91 vs 52.1/0.92)
even though window `n` still matched — the SMS rows were silent
house-effect EVIDENCE, nudging every lean without entering the window.
Symptom-to-cause map: n matches but v/se are off by a rounding-scale
tick → a row-SET difference (exclusion filter), not a weight bug.

## Recipe

1. **Replicate the estimator VERBATIM into a scratch script.**
   `houseEffectsFor`, `weightedWithSe`, `nowcastAdj`, `rowN` and the
   constant block, copied character-for-character from gen-data.mjs, with
   a header comment that the copies must be refreshed whenever production
   changes. Parameterise only the thing being raced (arms = config sets;
   the identity config is arm A0, the parity control).
2. **Pin the input.** Read `git show HEAD:data/polls.json` via execSync,
   not the working-tree file — sibling sessions leave `data/polls.json`
   and assets dirty mid-flight, and a run that reads them is
   irreproducible. Never RUN gen-data.mjs bare in the shared checkout (it
   rewrites assets under siblings' staged work); the cleanest production
   reference is gen-data's own test seam (in place since np-backtest):
   `GEN_DATA_OUT=/tmp/<dir> GEN_DATA_POLLS=/tmp/<pinned polls.json> node
   .build/newtracker/gen-data.mjs` — assets land in /tmp, nothing in the
   shared tree is touched, no separate clone needed. The /tmp clone still
   works if the seams ever stop covering some build step.
3. **Scratch house rules.** Auto-skills' write_file can't leave the
   workspace in BOGAN mode (an attempt to write the script into
   /tmp/auspol-fh was refused) — scratch scripts live in `.matilda/`
   alongside the existing probes. When the /tmp clone must track main,
   `git checkout main` fails ("already checked out" in a linked
   worktree) — use `git checkout --detach origin/main`. Exception: a
   replica that gates a SHIPPED series belongs in `.build/` as a
   committed check script, not a `.matilda/` probe —
   `.build/flow-drift-check.mjs` (2026-09-07, see
   `auspol-flow-drift-panel`) re-derives gen-data's flowDrift payload
   from polls.json verbatim and exits 1 on mismatch with the emitted
   asset.
4. **Parity gate BEFORE scoring.** Arm A0 must reproduce production
   exactly. The robust production reference is gen-data.mjs's own stdout
   line `headline 2PP: { alp: …, n: …, se: … }` — the hero nowcast is
   emitted as `alp2pp` beside `alp2ppSe`/`alp2ppCi95`, but the FIRST
   `"alp2pp"` grep hit in the minified built asset is a per-poll payload
   field (read 49.5 when the hero was 50.9); never take a bare first-grep
   as the hero. `n` (window poll count) matching is as important as the
   value — it proves the window/row set is identical.
5. **Arm design gotcha — uniform rescales vanish.** Weights are
   relative: a flat change to the derived-path divisor is invisible
   wherever every row in the window is on the derived path (all
   pre-stamp-era refs — nothing discriminates A0 from "flat 2.0" there)
   and only moves anything in the stamp era (Newspoll 2025-07-17→) by
   shifting derived-vs-stamped balance. Only per-house arms discriminate
   in every era the named house polled.
6. **Coupled constants race as a triple, never alone.** HL_WINDOW /
   HL_HALF / HL_TAPER are not independent: a longer half-life starves
   inside the old window (the taper lops the mass it just earned). The
   2026-10-02 race shaped arms as full `{window, half, taper}` sets —
   21/7/14 (identity), 21/14/14 (the ask), 28/14/21 (widened to suit),
   28/7/28 (window-only control) — which is how it learned the WINDOW,
   not the half-life, was the only lever that moved anything (21/14/14:
   ΔMAE −0.013, CI spans zero; the 28-day variants cleared zero on LOO
   but lost on the election anchors, so all failed the bar and 7/21/14
   stands).
6. **Scoring.**
   - Leave-one-out over current-term tpp rows: hold row r out, REBUILD
     `houseEffectsFor` on the remainder every iteration (leaving r in
     leaks its own deviation into its house lean), nowcast at r's mid,
     score `est − (r.x − he.at(r.firm, r.mid))` — the debiased held-out
     reading, not the raw one, since the lean-adjustment is a separate
     estimator stage.
   - Paired bootstrap (5000 resamples of the per-row |err| diffs vs A0):
     an arm whose 95% CI on ΔMAE/ΔMedAE spans zero is noise, full stop —
     the un-bootstrapped MAE table alone will flatter whichever arm you
     built last.
   - Election anchors: replay each cycle (`D.cyclePolls[src]` ∩
     `D.elections["e"+src]`, firms through ACC_CANON, exit/"Election"
     rows dropped, production 21-day window, ref = polling day) and score
     against the result. Corroboration only: 12→19 cycles (the 2026-10
     race scored 19 incl. F2F-era implied singletons), and the
     industry-wide misses (2019 +2.84, 2025 −2.82) dominate any
     weighting effect.
   - Smoothing motives get their OWN score, not a fudge of MAE: when a
     user proposes a constant to stop the estimate "jumping around",
     add a term-stability timeline (daily nowcast over the term; mean
     |weekly Δ|; count of moves that clear their own RSS 95% rule and
     reverse within a week). The 2026-10-02 race's decisive fact was
     that ZERO weekly moves cleared that rule in the whole term under
     ANY arm — the perceived jumpiness (±0.43 avg weekly wiggle vs ±1.8
     stated margin) was sub-margin noise, so the right fix was
     display-side and the estimator stayed as optimised. A production
     "clears its margin" statement is the significance rule; report it.
   - **Forward-prediction FWD14 mode (2026-10-03, Silver Bulletin's
     "predict the next two weeks of polls" criterion)**: walk evaluation
     day D daily through the term; at each D the known row set is polls
     with PUBLICATION date ≤ D (row.date, NOT mid — a poll's data may not
     predate D while its fieldwork does), houseEffectsFor REBUILT on known
     rows only, nowcast at D, then score `est − (p.x − he(D).at(p.firm,
     p.mid))` against EVERY poll published in (D, D+14d]. NEXT1 variant =
     score against the single next poll (Silver's "Thursday survey").
     Start the walk ≥28d after the term's first row so taper-arms have a
     window's worth of data. SPLIT the days train/test 70/30: in-train
     Silver-calibration flatters smoothing, and the point of the exercise
     is out-of-sample adjudication. Observations are CROSS-CORRELATED
     (a poll recurs in up to 14 D-windows — 574 obs ≈ 142 distinct days at
     our cadence), so only the PAIRED bootstrap of per-(D×poll) |err|
     diffs vs A0 is evidence; at ~1.3 2PP polls/week this criterion
     resolves SIGN (aggressive arms worse, CIs clear of zero on both
     segments) but not MAGNITUDE (the whole smooth family is within noise
     of production out-of-sample). Silver's own density (dozens of US
     polls/week) is what makes his criterion decisive. Worked numbers in
     `.matilda/silver-calibration-2026-10.md`.
7. **Bar for proposing the change.** All scores move favourably AND the
   bootstrap CI clears zero. Failed/unchanged three times so far: the
   2026-09-05 DEFF race (LOO ΔMAE ≤0.013 all CIs straddling zero), the
   2026-10-02 HL_HALF race (the ask failed on noise −0.013; the only LOO
   winners did so by WIDENING the window and paid for it on the 19-cycle
   election anchors, mean|err| 1.76→1.86, so HL_HALF/HL_WINDOW/HL_TAPER
   stay 7/21/14), and the 2026-10-03 Silver-calibration race (FWD14
   forward-prediction re-elects production: aggressive arms decisively
   worse out-of-sample — 14/3.5/7 ΔMAE +0.078 [+0.036,+0.119] — while the
   whole smooth family is within noise of A0 test-side, ≤±0.012; bonus
   trap: the aggressive arms WIN the 20-cycle anchors, 1.53/1.54 vs 1.76 —
   the anchor-overfit signature, disowned by every in-term score). The
   DEFF walk-through is auto-skill-auspol-effective-sample; the half-life
   replica is `.matilda/hl-half-backtest.mjs`; the Silver probe is
   `.matilda/silver-calibration-backtest.mjs` (FWD14/NEXT1 + LOO +
   timeline + anchors; write-up `.matilda/silver-calibration-2026-10.md`).

## Adjacent reference points

- Estimator internals walkthrough: auto-skill-auspol-headline-estimator.
- Production call sites for parity refs: gen-data.mjs `headlineTpp`
  (~:1198, ref = `new Date(LATEST_ISO).getTime()`), console print ~:2267.
- If a constants change DOES ship: auto-skill-auspol-effective-sample
  rule 2 (per-house deff would root as `pollsterRules.<house>.deff`) and
  its copy-homes list; CHG_MEASURES significance flags and the discord
  engine's 1.6 floor share the constant — they all move together.

## `deff-backtest` red in npm test ≠ your regression — check pre-existence first

`.build/newtracker/deff-backtest.mjs` sits near the END of the npm test
`&&` chain (just before `test-vic-build.mjs`) and replays its A0 replica
against the COMMITTED `9f09dca2` dataset asset; divergence prints
`deff-backtest: FAIL — parity: A0 replica (X) != committed asset (Y)`.
Committed or sibling-parked estimator drift (a gen-data.mjs edit landed
without a `9f09dca2` dataset regen — exactly what the sibling §7gc
demographicsTpp work did) makes it fail AT CLEAN HEAD with your tree in
any state; the repo's own commit messages have documented this window
(openly: "full suite green except pre-existing deff-backtest parity
drift from sibling WIP (gen-data.mjs/9f09dca2 asset)"). Before treating
the red as yours (worked 2026-10-10, the Other-cuts feature commit):

1. `git log -5 --format=%B origin/main | grep -i drift` — the drift is
   often already documented in HEAD's message; if so, your verdict is
   free.
2. Otherwise prove pre-existence: run only that script at clean HEAD.
   On a shared dirty tree `git stash && node .build/newtracker/deff-backtest.mjs ;
   git stash pop` works and pops clean (verified 2026-10-10), but the
   cleaner shared-repo form is a detached worktree at HEAD (see
   auspol-worktree-scratch-files / ci-run-failure-triage's heal recipe)
   — never assume your feature caused it.
3. Two chain-shape traps when the FAIL shows in a tail: (a) being red
   HALTS the `&&` chain, so `test-vic-build.mjs` after it never ran —
   "passed everything" claims need the vic test run explicitly; (b)
   `npm test … | tail` exit codes are tail's (shell-command-pitfalls),
   so prove status with `npm test >/dev/null 2>&1; echo $?`.
4. If the drift IS new and yours: the replica copies inside
   deff-backtest.mjs went stale relative to gen-data.mjs (re-sync per
   this skill's recipe-1 header rule), or an estimator-affecting change
   shipped without the dataset regen — regenerate per
   forecast-history-ci-merge / the dataset convention, don't hand-edit
   the asset.
