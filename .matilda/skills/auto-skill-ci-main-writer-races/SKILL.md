---
name: ci-main-writer-races
description: auspol-tracker — how writers (CI updaters, the laptop's launchd copies, agent repairs, humans) stay safe pushing to one main. Since 2026-09-25 there is NO shared concurrency group: each workflow queues in its own (poll-agent.yml's writers-<house>), and .build/git-push-main.sh push_main() resolves every push race — generated files rebuilt not merged, one wrapper re-run on a data conflict, "FAIL push race" (classified transient) only when a race is lost twice. Adding a writer? Its own group, and push through push_main. Never re-add a shared group.
source: auto-skill
extracted_at: '2026-09-04T13:36:12.593Z'
updated_at: '2026-09-25'
---

# Writers racing origin/main

GitHub Pages serves `main`, and many writers push to it: every house's updater (CI and the
laptop), prediction-refresh, np-score, citation-check, schedule-tune, agent-repair's publish
job, and humans. Any of them can land between another's freshness pre-flight and its push.

## History: why there is no shared group any more

2026-09-04 (ab0df87) put every push-capable workflow in ONE concurrency group,
`main-writers`, so CI writers could never race each other. It traded a race for silent
losses: a group holds one running job and ONE pending one, and a newer pending run CANCELS
the older ("Canceling since a higher priority waiting request for main-writers exists").
Whenever one long holder (Essential's 10-minute crawl, a 25-minute repair session) had two
runs waiting, one was thrown away: 29 scheduled runs from 1–22 Sep 2026, RedBridge's
morning sweep on 7 of 11 days, np-score on 12 of 14. No-op joiners made it worse:
newspoll-watch's filer job and schedule-tune entered the queue on every run.

And the queue never covered the laptop or humans anyway, so push_main had to handle
races regardless. Its old single rebase conflicted on the generated files (both sides
rebuilt index.html), so the retry failed exactly when it was needed (DemosAU, 2026-09-17).

## The system now (2026-09-25)

1. **Per-workflow queues.** `poll-agent.yml`'s update job uses
   `group: writers-${{ inputs.house }}`; prediction-refresh, citation-check, np-score and
   schedule-tune each have a group named after themselves; agent-repair's publish job uses
   `repair-publish-<wf>`; newspoll-watch's filer uses `newspoll-file` (it pushes a branch,
   not main). Within one group the newest pending run does the same work as the one it
   replaces, so cancellations cost nothing.
2. **`push_main()` makes cross-writer races safe** (`.build/git-push-main.sh`):
   - push; on rejection `git pull --rebase` with the generated paths (index.html, feed,
     sitemap, robots, `assets/**`, `.build/newtracker/assets/**`) resolved by a no-op
     merge driver (`auspol-regen`, set via `-c core.attributesFile=<scratch file in .git>`
     for that one command — no human merge inherits it);
   - nothing of ours left after the rebase (the other writer landed the same wave) →
     success, nothing to push;
   - otherwise validate + `refresh_site` (build → card → favicon → build) against the
     merged tree, re-stage, `--amend`, push;
   - a DATA conflict (two houses' rows side by side in polls.json) or a second rejection →
     `git reset --hard origin/main` and `exec` the wrapper once more with
     `AUSPOL_PUSH_RERUN=1` (the extractors are idempotent; the writers lock is released
     first because exec skips the EXIT trap). Only the re-run's own loss logs
     `FAIL push race`, which `.build/classify-failure.mjs` calls transient.
   - Re-runs only work from a `.build/*-updater.sh` / `prediction-refresh.sh` (captured at
     source time as `PUSH_MAIN_SELF`); inline workflow steps that source the file
     (citation-check, np-score) commit files nobody else writes and never need it.
   - `.build/test-push-main.mjs` races two clones through every rung (different files,
     side-by-side rows, the same row, a race lost twice, AUSPOL_PR_GATE, the runner-clone
     heal). A mutation check: drop the merge driver and scenario A needs a re-run.

## Adding a writer

- Give it its OWN concurrency group (`cancel-in-progress: false`). Never a group shared
  with another workflow — `tune-schedules.mjs`'s collision audit refuses a schedule where
  three runs of one literal group share a minute, as a tripwire.
- Push through `push_main "<msg>" <exactly the staged files>`; name the generated files in
  the list when the commit carries them (that is the rebuild signal).
- Agent sessions (`AUSPOL_PR_GATE=1`) never push: push_main leaves the commit local and
  the calling workflow's publish step owns the push.

## Verifying

- `grep -rn 'group:' .github/workflows/` — no literal group appears in two files.
- `node .build/test-push-main.mjs` and `node .build/test-workflows.mjs` (the latter also
  pins the poll-agent permissions ceiling — see poll-agent-permission-ceiling).
- `ruby -ryaml` parses workflow YAML locally (no pyyaml/yq); actionlint is not installed —
  fetch its release binary to a scratch dir to lint.

## Related

- **launchd-scheduled-data-pipeline** — wrapper anatomy, the slot lock, and the laptop's
  runner clone.
- **poll-agent-permission-ceiling** — the other workflow-topology invariant.
