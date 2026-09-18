---
name: auspol-estimator-arms-race
description: "auspol-tracker — procedure for backtesting a change to headline-estimator constants/weights (worked example .matilda/deff-backtest.mjs, the 2026-09-05 DEFF arms race): VERBATIM estimator replica scored in a .matilda scratch script, input pinned to `git show HEAD:data/polls.json` under sibling-dirty trees, PARITY GATE = gen-data's own console `headline 2PP:` line (never the first \"alp2pp\" grep in the minified 9f09dca2 asset — that's a per-poll payload field), LOO with per-iteration house-effect refit + paired bootstrap + 12-cycle election anchors as corroboration only."
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
`.matilda/deff-backtest.mjs` — use it as the template.

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
   irreproducible. For the same reason never RUN gen-data.mjs in the
   shared checkout (it rewrites assets under siblings' staged work);
   production-reference runs happen in the clean /tmp clone.
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
     against the result. Corroboration only: 12 cycles, and the
     industry-wide misses (2019 +2.84, 2025 −2.82) dominate any
     weighting effect.
7. **Bar for proposing the change.** Both scores move the same way AND
   the bootstrap CI clears zero. The 2026-09-05 DEFF race cleared
   neither (LOO ΔMAE ≤0.013pp all CIs straddling zero; anchors ±0.04
   mean|err|; live headline ≤0.3pp across the whole arm space — inside
   its own ±2.5 CI), so HL_DEFF stayed 1.6.

## Adjacent reference points

- Estimator internals walkthrough: auto-skill-auspol-headline-estimator.
- Production call sites for parity refs: gen-data.mjs `headlineTpp`
  (~:1198, ref = `new Date(LATEST_ISO).getTime()`), console print ~:2267.
- If a constants change DOES ship: auto-skill-auspol-effective-sample
  rule 2 (per-house deff would root as `pollsterRules.<house>.deff`) and
  its copy-homes list; CHG_MEASURES significance flags and the discord
  engine's 1.6 floor share the constant — they all move together.
