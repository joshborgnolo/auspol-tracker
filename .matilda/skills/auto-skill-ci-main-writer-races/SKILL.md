---
name: ci-main-writer-races
description: auspol-tracker — how writers (CI updaters, the laptop's launchd copies, agent repairs, humans) stay safe pushing to one main. Since 2026-09-25 there is NO shared concurrency group: each workflow queues in its own (poll-agent.yml's writers-<house>), and .build/git-push-main.sh push_main() resolves every push race — generated files rebuilt not merged, one wrapper re-run on a data conflict, "FAIL push race" (classified transient) only when a race is lost twice. HAZARD (2026-10-02): the rung-1 regen merge attributes cover `.build/newtracker/assets/**` SOURCE layers, so a racing commit touching the same rd-*/source file makes the blind driver silently KEEP ORIGIN'S version and rung 2 rebuilds index.html from the dropped source — the pushed commit's message describes a change its tree lacks (40a5f95); ALWAYS `git show origin/main:<source> | grep <marker>` after a rebase-path push and re-land on a zero. GOTCHA: git-push-main.sh is a SOURCED library, not a script — `bash`-ing it exits 0 and pushes NOTHING; agent/human sessions push with plain `git push origin HEAD:main` (rebase+rebuild+amend by hand on a lost race). A dirty shared checkout breaks push_main's rung-1 rebase (no autostash — log says "conflicted on data" but means "You have unstaged changes"): recover via a detached-worktree cherry-pick + rebuild + push, then MIXED (never --hard) reset the checkout, or rebase with `-c rebase.autoStash=true`. Adding a writer? Its own group, and push through push_main. Never re-add a shared group.
source: auto-skill
extracted_at: '2026-09-04T13:36:12.593Z'
updated_at: '2026-10-02'
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

## HAZARD: the regen list covers SOURCE assets — a race can silently drop your source edit

`push_main_regen_attrs` lists `.build/newtracker/assets/**` — which holds the rd-*.jsx /
rd.css / plain-JS SOURCE layers, not just built outputs. So when a racing commit touches
the same source file (2026-10-02: my `flexGrow` gate in rd-panels.jsx vs the sibling's
`77bc61c` in the same file), rung 1's blind `merge.auspol-regen.driver=true` KEEPS
ORIGIN'S VERSION — the local source hunk is dropped WITHOUT a conflict and WITHOUT any
log line — and rung 2 then rebuilds index.html from the dropped source. The push succeeds
and the commit's MESSAGE describes a change its TREE does not carry (40a5f95 shipped
message-without-fix; 0fd47c5 re-landed the source on the new base). Only `.matilda/**`
content in the same commit was safe (not in the regen list).

**After ANY push_main run (or hand replay of its rungs) that took the rebase path**,
verify the source survived before reporting done:

```bash
git fetch -q origin
git show origin/main:<source-file> | grep -c '<your marker>'   # must be > 0
git show origin/main:index.html     | grep -c '<your marker>'  # compiled line, if rebuilt
```

A zero from the first command means the regen driver ate the hunk: re-apply the edit on
the new origin/main tip, rebuild, re-verify, commit and push again. (An interactive
session pushing plainly and rebasing by hand never registers the regen driver, so its
rebase would CONFLICT on the same-file source touch — the silent form is specific to
push_main callers and sessions that replicate its `-c core.attributesFile` dance.)

## Agent/human sessions push DIRECTLY — `bash`-ing the file is a silent no-op

`.build/git-push-main.sh` is a SOURCED function library for the wrappers ("Source AFTER
the wrapper defines REPO, LOG and log()") — it is NOT a runnable script. Executing
`bash .build/git-push-main.sh` defines the functions, exits 0 immediately, and pushes
NOTHING, with zero output — origin/main unmoved (observed 2026-09-28, an agent session
ran it twice before noticing). An interactive session commits to local main and pushes
plainly: `git push origin HEAD:main`. If origin has raced ahead, replay push_main's
rungs by hand: fetch, `git pull --rebase` (generated files — index.html, feed, sitemap,
robots, `assets/**`, `.build/newtracker/assets/**` — fold via rebuild, never textual
merge), `node .build/newtracker/build.mjs`, re-stage the regenerated files, `--amend`,
push once more.

## Adding a writer

- Give it its OWN concurrency group (`cancel-in-progress: false`). Never a group shared
  with another workflow — `tune-schedules.mjs`'s collision audit refuses a schedule where
  three runs of one literal group share a minute, as a tripwire.
- Push through `push_main "<msg>" <exactly the staged files>`; name the generated files in
  the list when the commit carries them (that is the rebuild signal).
- Agent sessions (`AUSPOL_PR_GATE=1`) never push: push_main leaves the commit local and
  the calling workflow's publish step owns the push.

## Interactive/Matilda sessions push directly — do NOT "run" the script

`.build/git-push-main.sh` is a SOURCED function library for the wrappers, not a
runnable script: executing `bash .build/git-push-main.sh` defines the functions,
evaluates the `$0` case, and exits 0 having pushed NOTHING — silently, twice in a
row on 2026-09-28 when an agent session took its name literally. A human/agent
session that has committed to local main pushes with plain
`git push origin HEAD:main`. If origin has raced ahead, replay push_main's rung 1
by hand: fetch, `git pull --rebase` (generated files conflict only on real data
now — index.html etc. are rebuilt, so on an index.html conflict take the rebuild
route: rebase with ours, `node .build/newtracker/build.mjs`, re-stage, amend),
then `git push` again.

## Dirty shared checkout: rung 1 has NO autoStash — recover via worktree

Methods (worked 2026-09-28, local commit `20fd11b` vs racing `0200407`):

- push_main's rung-1 `git pull --rebase` carries no `--autostash`. With
  sibling sessions' uncommitted files in the tree it aborts at
  "cannot pull with rebase: You have unstaged changes" and the wrapper's
  catch-all logs "FAIL push race: the rebase onto origin/main conflicted on
  data" — MISLEADING: read the log for the unstaged-changes line before
  hunting a data conflict. The commit is intact locally.
- Diagnosing the racing commit: `git diff <myTip>..<remoteTip>` unions BOTH
  divergent commits' changes, so it lies about what the remote touched —
  `git show <remoteTip> --stat` (or diff `merge-base..remoteTip`) instead.
- Recovery, untouched by the dirty tree:
  `git worktree add .matilda/pushfix-<tag> --detach origin/main`,
  `cd` in, `git cherry-pick <myCommit>` (generated files may auto-merge
  textually — fine, but still run validate + build.mjs in the worktree; the
  rebuild reproduced the auto-merge byte-identical here, leaving the tree
  clean so there was nothing to amend), `git push origin HEAD:main` from
  the worktree, `git worktree remove` it.
- Realign the checkout afterwards (its commit is now the pushed one's
  twin): `git reset origin/main` — MIXED, never `--hard`, which would wipe
  sibling sessions' tracked uncommitted edits — then
  `git checkout -- index.html <any other generated paths>` so the working
  tree's generated copies refresh from HEAD. Old local commit dies in the
  reflog; fine.
- Small edits interactively: plain `git push` first (it usually wins); on
  rejection `git -c rebase.autoStash=true pull --rebase origin main`
  survives the dirty tree (stashes, replays, POPS the stash back — confirm
  the "Applied autostash." line), rebuild, confirm
  `git status --short index.html .build/newtracker/assets/` is empty
  (zero drift), push. Clean twice that day (8a7d389, 32cdfe8).

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
