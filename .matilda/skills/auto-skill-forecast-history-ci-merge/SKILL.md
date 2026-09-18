---
name: forecast-history-ci-merge
description: auspol-tracker — the forecast-history read-model's survival contract across CI `git pull --rebase` (shipped dd040ae, 2026-09-05): file tracked in git + build.mjs temp export + stash/restore-merge YAML step pair in all 5 data workflows and poll-agent.yml (live rows win, rebuild-from-polls.json fallback). mtime stale-check footgun; ×100.0% probabilitySum() rows are the real corruption signature — repair agents must NOT "fix" them by re-breaking probabilitySum(). Pull-side counterpart to ci-main-writer-races.
source: auto-skill
extracted_at: '2026-09-05T12:00:00.000Z'
---

# forecast-history.mjs vs CI rebases (dd040ae)

`forecast-history.mjs` is a **generated read-model** of the forecast model's run history
(probability rows that must pass `probabilitySum()` ≈ 100.00%). It is both regenerated
per-build AND consumed by later CI runs — the classic recipe for a rebase to either silently
wipe fresh rows or produce divergent duplicate-row merges. Commit `dd040ae` replaced the
implicit behaviour with an explicit five-part contract. All five parts move together; a new
data workflow must copy the whole pattern.

## The contract (what dd040ae shipped)

1. **The file is tracked in git** (un-ignored in `.gitignore`). CI runners and fresh clones
   get the canonical copy at checkout; it is no longer machine-local state.
2. **`build.mjs` exports the same data to a temp file on every build.** This gives the merge
   step a fresh "live" candidate to compare/merge against. Verified: build output is
   byte-identical to before — the export is a pure side-effect (`validate.mjs` still PASS).
3. **Workflow YAML step pair around `git pull --rebase`** in all five data workflows
   (roymorgan-update, essential-updater, resolve-updater, demosau-updater,
   redbridge-updater) and the reusable `poll-agent.yml`:
   - *Stash forecast history* — park the just-built rows before the pull;
   - *Restore and merge forecast history* — merge after the pull with **live rows winning**
     on conflict. If the merged file has no live rows / is genuinely stale, **rebuild it
     from `data/polls.json`** (demographic fields degrade gracefully when rebuilt).
   - The pull itself carries `--autostash --no-rebase-merges` as belt-and-braces.
4. **Divergence auto-recovery in the same YAML steps**: before the pull, a corrupt or
   non-fast-forward state is healed with `git fetch origin main` + `git reset --hard
   origin/main`; the `pull.rebase=false` advice warning is silenced so logs stay clean.
   Tested locally against a deliberately corrupted repo before shipping.
5. **Repair-prompt guard clause** added to 4 of the `.build/*-repair-prompt.md` set: the
   stash/merge contract is documented and repair agents are told explicitly NOT to "fix" a
   ×100.0% probability-sum failure by re-breaking `probabilitySum()` — see below.

Also shipped in the same commit: the launchd mirror job picked up its rebuilt copy
automatically (jobs are unload-loaded, so a re-conversion leaves no stale state — a no-op).

## The corruption signature (how to recognise the real failure)

- **×100.0% sums from `probabilitySum()` are THE red flag** — they mean duplicate/merged
  rows survived a bad rebase, i.e. the merge contract failed. Row data (polls.json) is never
  touched by any of this machinery; only the read-model is.
- Classification rule for any missing-poll or bad-figure alert touching forecasts: check the
  sum signature FIRST. ×100.0% → merge-contract bug (fix the YAML/merge step); anything else
  → upstream extraction, different skill.

## Known footgun: the mtime-proxy stale check

The "genuinely stale?" check uses **file mtime as a proxy for the file's commit date**.
`git checkout`/`git reset` refresh the file's mtime without changing its content, so a truly
stale merge can be masked as "fresh" and get skipped instead of rebuilt. Consequence is
bounded (worst case: rows regenerate on the next run instead of merging now; polls.json is
untouched), but do not "strengthen" the check without replacing the proxy — commit-date via
`git log -1 --format=%ct -- <file>` is the correct signal if it ever needs to be precise.

## Adding a new data workflow or a new generated read-model

Generalised pattern (reusable beyond this file):

1. Decide whether the generated file is machine-local (keep ignored) or cross-run state
   (track it). If CI runs consume it, it MUST be tracked — an ignored file that differs per
   runner will eventually collide with a rebase.
2. Give the build a zero-drift export of the same rows (temp file) so merges compare like
   with like, not source vs generated format.
3. Stash → pull(rebase, autostash, no-rebase-merges) → merge with a **declared precedence**
   (here: live rows win). Never let git's default text merge decide semantics for structured
   generated data.
4. Provide a rebuild-from-canonical-data fallback and make the fallback lossless-or-degrading
   by design.
5. Put the invariant + the "do not fix it this way" note in the repair prompts, because the
   first responder to the failure alert is an LLM agent that will otherwise reason its way
   into breaking the invariant checker.
6. Prove the recovery path locally (deliberately corrupt a clone; run the steps) — YAML merge
   logic has no test harness in this repo, empirical proof is the bar (same standard as
   ci-main-writer-races' `bash -n` + diff review).

## Related

- **ci-main-writer-races** — the push-side counterpart (`main-writers` concurrency group +
  `push_main()` retry in `.build/git-push-main.sh`); commit groups vs pull-side YAML steps.
- **launchd-scheduled-data-pipeline** — wrapper anatomy; the local mirror jobs re-convert
  cleanly because they're unload-loaded.
- **auspol-build-pipeline** — never hand-edit `index.html`; build.mjs change verified by
  byte-identical output + `validate.mjs`.
