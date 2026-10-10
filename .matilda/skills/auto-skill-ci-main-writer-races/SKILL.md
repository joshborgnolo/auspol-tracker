---
name: ci-main-writer-races
description: auspol-tracker — how writers (CI updaters, the laptop's launchd copies, agent repairs, humans) stay safe pushing to one main. Since 2026-09-25 there is NO shared concurrency group: each workflow queues in its own (poll-agent.yml's writers-<house>), and .build/git-push-main.sh push_main() resolves every push race — generated files rebuilt not merged, one wrapper re-run on a data conflict, "FAIL push race" (classified transient) only when a race is lost twice. HAZARD (2026-10-02): the rung-1 regen merge attributes cover `.build/newtracker/assets/**` SOURCE layers, so a racing commit touching the same rd-*/source file makes the blind driver silently KEEP ORIGIN'S version and rung 2 rebuilds index.html from the dropped source — the pushed commit's message describes a change its tree lacks (40a5f95); ALWAYS `git show origin/main:<source> | grep <marker>` after a rebase-path push and re-land on a zero. The hazard also bites an INTERACTIVE hand rebase that replicates push_main's attrs dance (bf7adc8 vs ac705a7, 2026-10-03): drop the `.build/newtracker/assets/**` glob from the hand-written attrs file so the sources merge textually (stash the foreign dirty tree first, pop after). GOTCHA: git-push-main.sh is a SOURCED library, not a script — `bash`-ing it exits 0 and pushes NOTHING, and sourcing it BARE (`bash -c 'source … && push_main'`, 2026-10-03) fakes a lost race: unset LOG makes every git op redirect-fail (`line 67: : No such file or directory`) so nothing runs yet it logs "rebase conflicted on data (commit kept locally: )" with EMPTY parens — the tell — while `log` resolves to macOS's system binary; state is untouched, push plainly. Agent/human sessions push with plain `git push origin HEAD:main` (rebase+rebuild+amend by hand on a lost race); a sibling session shipping the SAME feature area makes races REPEAT mid-cycle (three attempts to land 3c1147a, 2026-10-10) — union-merge tracked-probe conflicts keeping both sides' pin blocks, checkout --theirs generated paths + rebuild, re-verify probes after EVERY rebase round. A dirty shared checkout breaks push_main's rung-1 rebase (no autostash — log says "conflicted on data" but means "You have unstaged changes"): recover via a detached-worktree cherry-pick + rebuild + push, then MIXED (never --hard) reset the checkout, or rebase with `-c rebase.autoStash=true`. Adding a writer? Its own group, and push through push_main. Never re-add a shared group.
source: auto-skill
extracted_at: '2026-09-04T13:36:12.593Z'
updated_at: '2026-10-10'
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
     sitemap, robots, vic/index.html, `assets/**`, `.build/newtracker/assets/**`) resolved
     by a no-op
     merge driver (`auspol-regen`, set via `-c core.attributesFile=<scratch file in .git>`
     for that one command — no human merge inherits it);
   - nothing of ours left after the rebase (the other writer landed the same wave) →
     success, nothing to push;
   - otherwise validate + `refresh_site` (build → card → favicon → build → the
     `BUILD_JUR=vic` vic build, warn-only — vic/index.html rides SITE_FILES and the
     regen attrs since c3beeb9, 2026-10-09) against the
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
the new origin/main tip, rebuild, re-verify, commit and push again. (2026-10-03 addendum:
the parenthetical's "interactive sessions never register the driver" is only half true —
a hand rebase replicating push_main's attrs dance CAN opt into it, and pushed bf7adc8 that
way.)

### Hand-replicating the attrs dance? Drop the SOURCE-assets glob (2026-10-03, bf7adc8)

When an interactive session's push is rejected and the racing commit touched the same
`.build/newtracker/assets/**` SOURCE files as yours (bf7adc8 vs ac705a7 — both edited
73de0c58 + rd.jsx), writing push_main_regen_attrs VERBATIM into the scratch file would
silently keep ONE side's sources wholesale (the hazard above, self-inflicted). The safe
hand recipe:

1. `git stash push -m <tag>` — a rebase needs a clean tree, and any foreign hunk sitting
   in yours must not bake into YOUR commit (bf7adc8's tree held a sibling's uncommitted
   `.rd-cc-row` rd.css hunk plus the rebuilt index.html carrying its compiled copy).
2. Write `$(git rev-parse --git-dir)/auspol-regen.attributes` with ONLY the truly
   regenerated paths: `printf '%s merge=auspol-regen\n' index.html feed.xml sitemap.xml robots.txt 'assets/**'`
   — i.e. push_main_regen_attrs MINUS `'.build/newtracker/assets/**'`.
   (vic/index.html joined the attrs in c3beeb9, 2026-10-09 — copy the list from the
   CURRENT `push_main_regen_attrs` in `.build/git-push-main.sh`, not from here.)
3. `git -c core.attributesFile=<attrs> -c merge.auspol-regen.name=… -c merge.auspol-regen.driver=true pull --rebase origin main`
   — index.html disappears into the driver (to be rebuilt), the SOURCE assets now merge
   TEXTUALLY, cleanly here because the racing hunks touched different regions.
4. validate + rebuild, then grep-verify the merged artifact carries BOTH sides' markers
   (`grep -c '<racing commit's marker>' index.html` — ac705a7's `min(1152` gauge seed —
   AND your own, e.g. zero `tagline-flip`), plus zero of the stashed foreign hunk.
5. `git add index.html` (+ whatever regenerated), `--amend --no-edit`, push.
6. `git stash pop` and confirm the foreign hunk is back in the working tree
   (`git diff <file> | grep -c '<hunk line>'` == 1) and the tree's uncommitted state
   matches the pre-race state.

(`git -c rebase.autoStash=true pull --rebase` would have handled steps 1/6 too — the same
clean checkout trick as below — but the attrs ADAPTATION in step 2 is the load-bearing
bit.)

## Agent/human sessions push DIRECTLY — `bash`-ing the file is a silent no-op

`.build/git-push-main.sh` is a SOURCED function library for the wrappers ("Source AFTER
the wrapper defines REPO, LOG and log()") — it is NOT a runnable script. Executing
`bash .build/git-push-main.sh` defines the functions, exits 0 immediately, and pushes
NOTHING, with zero output — origin/main unmoved (observed 2026-09-28, an agent session
ran it twice before noticing; recurred 2026-10-03 on a compaction-resume — the
reconstructed "push the commit" step replayed the wrong recipe, and the diagnosis
that caught it was `git rev-parse main origin/main` disagreeing after the "push").
An interactive session commits to local main and pushes
plainly: `git push origin HEAD:main`. If origin has raced ahead, replay push_main's
rungs by hand: fetch, `git pull --rebase` (generated files — index.html, feed, sitemap,
robots, vic/index.html, `assets/**`, `.build/newtracker/assets/**` — fold via rebuild,
never textual
merge), `node .build/newtracker/build.mjs`, re-stage the regenerated files, `--amend`,
push once more.

## Same-area sibling sessions race REPEATEDLY — budget N rounds (worked 2026-10-10)

When a sibling Matilda session is actively SHIPPING the same feature area as you,
"fetch → rebase → rebuild → push" doesn't converge in one cycle: pushing a forced-choice
feature took THREE push attempts (rejected by sibling dd4d173, rebased, rejected again
by sibling 0a6191e mid-cycle, rebased again, landed 3c1147a). Refinement loop (run in a
detached worktree so the dirty main checkout's WIP is untouched):

1. `git fetch origin` at the start of EVERY cycle — inspect `git log --oneline HEAD..origin/main`
   and `git show <racing> --stat` to see what the sibling touched and predict conflicts.
2. `GIT_EDITOR=true git rebase origin/main` (the plain rebase, NOT the attrs dance —
   the sibling's source hunks must merge textually, see the hazard above). In this repo
   rd-*.jsx/rd.css hunks from two sessions on the same COMPONENT auto-merged cleanly both
   rounds (different regions; titles/tsig block vs dot-click idiom block in RdForced).
3. Conflict resolution recipes that worked twice:
   - GENERATED paths (`index.html`, the hashed `9f09dca2-*.js` dataset asset): conflict
     → `git checkout --theirs <file>` (either side is fine — the rebuild below
     regenerates them), `git add`, never textual-merge generated content.
   - TRACKED probes (`.matilda/probe/*.mjs` live under a gitignored dir but committed —
     re-stage with `git add -f`): conflicts UNION-resolve by hand — keep BOTH sides' check
     blocks (sibling's new pin blocks first, then your feature's pins), and union the
     header-comment mission statements (each side documents its own feature; the merged
     probe asserts everything both branches pinned). Mind the braces: two side blocks
     closing with `}` often share ONE `}` as context — count opens/closes after editing,
     `node --check` the result.
4. `git rebase --continue`, then `node .build/newtracker/build.mjs` — rebuild REGENERATES
   index.html/dataset from the merged sources, so they're consistent by construction.
   Expect "only the dataset shows dirty" after the build (git auto-merged index.html
   already matched).
5. RE-VERIFY after every rebase round, not just the first: the feature's unit test +
   its tracked probe + any mirrored scratch probes (untracked/gitignored probes like
   `.matilda/probe/sig-tables-panels.mjs` in MAIN get `cp`'d into the worktree, run, and
   `rm`'d — probes derive ROOT from import.meta.url so a copy tests the worktree).
6. `git add` the regenerated paths, `git commit --amend --no-edit` (same commit gets the
   new base), `git push origin HEAD:main` IMMEDIATELY — every verification minute widens
   the next race window. On a third rejection: same loop, no retries within a round.
7. Tidy up: `git worktree remove` the worktree once pushed (verify
   `git -C <wt> status --porcelain` empty first); leave the MAIN checkout's local main
   untouched (sibling owns its own fetch — per the dirty-shared-checkout guidance, never
   realign a checkout carrying sibling WIP).

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

### The push "did nothing" signature — TWO causes, check both (2026-10-02)

`bash .build/git-push-main.sh` exit 0 with origin unmoved happened AGAIN
2026-10-02, stacked under a second cause: the commit itself never existed.
A pre-compaction "committed as <hash>" claim had been performed word-for-word
after the resume, yet `git reflog` showed no commit entry — the working tree
still carried every change, and the following push had literally nothing to
send. Diagnosis is two commands: `git log --oneline -3` (or reflog) and
`git status --porcelain --branch`. No `[ahead N]` with your files still
` M`-flagged = phantom commit — re-commit the intact tree and push again.
Never re-report a pre-compaction commit claim without seeing it in `git log`;
never report "pushed" without `git log origin/main -1` agreeing.
Recurred yet again 2026-10-09 on a compaction-resume ship half (Other-cuts
commit 7001f17): the resume plan said "push per .build/git-push-main.sh
conventions", and `bash .build/git-push-main.sh | tail -15` printed NOTHING
with exit 0 while `git status -sb` still showed `ahead 1` — the classic
silent no-op, twice in a row. Empty output IS the signature (a real push
prints the remote line): run `git push origin HEAD:main` plainly, as this
paragraph's close prescribes. The script file's $0-case header means even
a successful `bash` can never reach push_main — it defines functions and
falls off the end.

## A THIRD bad invocation: sourcing it bare fakes a lost race (2026-10-03)

`bash -c 'source .build/git-push-main.sh && push_main msg files…'` — sourcing
IN A BARE SHELL and calling push_main without the wrapper env — fails loudly
and deceptively. push_main expects `REPO`, `LOG` and a `log()` function to
already exist ("Source AFTER the wrapper defines REPO, LOG and log()"); with
`LOG` unset, EVERY git op dies at its redirect (`git push … >> ""` →
`.build/git-push-main.sh: line 67: : No such file or directory`), so the push
never runs, push_main reads the failed call as a rejection, and its every
`log "…"` call hits macOS's SYSTEM `log` binary (`log: Unknown subcommand
'push rejected; rebasing…'`). Exit 1 with output that perfectly mimics a REAL
lost race: "rebase onto origin/main conflicted on data (commit kept locally:
)" — note the EMPTY parens, the tell. Nothing actually ran: no rebase, no
reset, the local commit sits untouched ahead by N. If you see the phantom,
there is nothing to recover — state is intact, just push plainly:
`git push origin HEAD:main`, verify `git log origin/main -1`. Interactive
sessions never call push_main, in ANY form: the wrappers own it.

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
- Worktree-in-/tmp variant (62e64b1, 2026-10-03) — `git worktree add
  --detach /tmp/auspol-integ origin/main` keeps the integration out of the
  repo entirely. Two operational snags: (1) run_shell_command's `directory`
  param rejects paths outside the registered workspace — drive the worktree
  with `cd /tmp/auspol-integ && …` inside the command instead; (2) npm test
  needs the devDependencies, so `ln -s "$PWD/node_modules"
  /tmp/auspol-integ/node_modules` before testing (build/validate ran fine
  either way) and `rm` the symlink before `git worktree remove` — it shows
  as untracked `?? node_modules` otherwise.
- Realign the checkout afterwards **only when the tree's generated files
  are clean** (its commit is now the pushed one's twin): `git reset
  origin/main` — MIXED, never `--hard`, which would wipe sibling sessions'
  tracked uncommitted edits — then `git checkout -- index.html <any other
  generated paths>` so the working tree's generated copies refresh from
  HEAD. Old local commit dies in the reflog; fine. **Skipped 2026-10-03**:
  a sibling session had uncommitted index.html (its own rebuild products)
  in the tree, and the `git checkout -- index.html` step would have
  clobbered them. Equal alternative: leave local main sitting on the twin
  commit — the next `git pull --rebase` drops it silently (patch already
  upstream) and nothing else needs doing. Report this to the user instead
  of realigning whenever sibling generated-file edits are present.
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
