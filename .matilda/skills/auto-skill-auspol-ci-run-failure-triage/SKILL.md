---
name: auspol-ci-run-failure-triage
description: auspol-tracker — "why did this Actions run fail?" triage playbook (worked 2026-09-30 on essential-update #90 and a red scheduled tests run; 2026-10-12 sandbox-data-drift red train "The operation was canceled"). Check git log origin/main FIRST — agent-repair may already have fixed and documented the root cause; the UI job summary shows only the log's last 200/40 lines so real error lines are routinely cut off and primary-sum entries are documented exceptions, not errors; grep patterns like `fail` false-positive on test-file names; writer commits pushed with GITHUB_TOKEN never re-trigger push-event workflows so a red SCHEDULED run is often the first test of data committed hours earlier; and a runner "canceled"/shutdown death with no assertion text can still be a plain test-child failure — a sandbox that copies validate.mjs into a tmp tree must copy every data file its main block gates (macOS's symlinked /tmp masks this locally).
source: auto-skill
extracted_at: '2026-09-30T00:30:00.000Z'
---

# auspol-tracker: triaging a failed GitHub Actions run

Worked 2026-09-30: essential-update #90 (`FAIL validate (errors above); no commit made`) and a
47s scheduled `tests` run with "5 FAILED". Both user-visible failures had non-obvious actual
causes; the order below is what found them fast.

## Procedure (in order)

1. **`gh run list --workflow=<name>.yml --limit N`** to find the run id; workflow filenames, not
   display names ("tests", not "test"; glob patterns 404).
2. **`git fetch origin && git log --oneline origin/main -10` BEFORE reproducing.** The central
   agent-repair pipeline (`.github/workflows/agent-repair.yml`) watches writer workflows and
   often lands the fix — with a long root-cause commit message — *and* a follow-up green data
   commit, hours before anyone reads the failure. On 2026-09-30 the essential-update root cause
   (assimilator stamped a future `published` on an embargo-ahead wave; validate.mjs's
   future-date check refused) was already fixed in `cc649d3` + `045f9c3` and the data had landed
   via `9795035`. Reading the log first wasted nothing much, but reproducing would have.
3. **`gh run view <id> --log`** for the evidence. Gotchas:
   - The UI "Job summary" block and the user-pasted screenshot show only the log file's
     **last 200 lines in-group / 40 in the summary**. validate.mjs prints hundreds of
     `primary-sum` / `2pp-sum` **documented exceptions** ("expected, not problems"), so the
     real error lines are routinely scrolled off. If the tail shows only `…-sum` entries and a
     `FAIL` line, the errors are NOT visible — reproduce on a checkout at the failing commit's
     data state instead of guessing from the tail.
   - Local `node .build/newtracker/validate.mjs` on an UNCHANGED working tree validates HEAD's
     data, not the failed run's — a run whose assimilator modified data then failed pre-commit
     leaves no committed trace ("no commit made" literally means it). Clean local validate does
     not clear the CI state; it only confirms HEAD is healthy.
   - **Grep false positives**: filtering `--log` output for `fail|error` matches test names like
     `test-classify-failure: ok`. On the tests run this mis-attributed the failure to
     test-dispatch-clock (the chain neighbour of the matching line); the real culprit was
     sim-next-polls.mjs later in the chain. Resolve attribution by grepping the assertion
     STRING ("FAIL <text>" / the eq() name) against `.build/**/*.mjs` — every shipped assertion
     name is unique in source.
   - `gh workflow list` gives exact workflow filenames.
   - **Runner-death, no assertion text**: a run can die with `##[error]The operation was
     canceled.` / "The runner has received a shutdown signal" / "Cleaning up orphan processes"
     and ZERO test-level error in the log. Don't conclude "infrastructure" — first rule it
     out cheaply (runner version same on green vs red; several Azure regions hit;
     `gh api repos/:owner/:repo/check-runs/<jobId>/annotations` shows only the same cancel
     line; githubstatus.com API clean; nothing newer queued to concurrency-cancel it), then
     diff the red vs green message streams (fetch both logs, strip the prefixed job/step/timestamp
     columns) to find the EXACT last line before death, and compare step timings (green's npm
     test ran ~48s end-to-end; the red died 45s into a silence right where the green took
     160ms). Then reproduce the code path at that line locally — the 2026-10-12 case below
     looked like an orchestration kill and was a plain test-child exit-1. **Avoid `gh run
     rerun --failed` until you hold a candidate fix**: a rerun re-runs the SAME sha (code
     bugs rerun identically — it proved nothing), and in a shared `concurrency` group it
     cancelled a sibling session's in-flight run.
4. **Check WHICH commits the run covered and which commits it didn't.** The tests site chain is
   `npm test` (see package.json) on push and schedule — but writer/CI commits pushed via
   GITHUB_TOKEN/`push_main` do NOT trigger new workflow runs (GitHub suppression), so a human's
   morning pushes get push-runs while the evening's many CI data commits are covered only by the
   next SCHEDULED run. A red scheduled run's HEAD commit is usually innocent; the causal commit
   is one of the untested ones since the last green run (`git log <last-green-sha>..<fail-sha>`).
   **Red-train shortcut**: if `gh run list` shows a run of consecutive failures with
   near-identical short elapsed times (a 15s gate fail across ten runs), it is ONE tripwire
   failing on every push, not ten regressions — bisect to the FIRST run in the train and diff
   its coverage window (`git log <last-green>..<first-red>`); every other run in the train,
   including perhaps your own just-pushed commit, is an innocent bystander (the 2026-09-30
   card-stamp skew: ten bystander reds, heal ac7ef1b).
5. **Separate data drift from code regression locally**: pull, run the failing script on current
   main. sim-next-polls-style fixture staleness fails identically on HEAD with zero code edits
   (see auspol-next-polls-projection, "Sim scenarios that read LIVE cadence tables…"); a genuine
   regression needs the stacked-diff treatment. For validate failures the local run on current
   main IS the verdict on whether the wedge is still present.
6. Fix, re-run the FULL failing script locally (and `npm test` if the test suite was touched),
   then commit ONLY your paths — the tree usually carries other sessions' in-flight edits
   (see shared-repo-session-race / git-prestaged-commit-sweep). Writers commit and push their
   own data runs; a human/agent test-fix commit conventionally stays local until the user asks
   for a push.

## Failure-class cheat sheet (this repo, Sep 2026)

- `FAIL validate (errors above); no commit made` in a writer log → validate.mjs rejected the
  just-assimilated data in the CI workspace; committed data is untouched. Commonest root cause
  so far: a future `published` stamp from an embargo-ahead release vs validate's future-date
  check (fixed cc649d3/045f9c3 by deferring the stamp at insert).
- tests chain `N FAILED` after a data-heavy day, zero push-runs in between → date/wave-anchored
  fixture staleness (sim-next-polls, sim-oppr-labels), not a code regression. Pin fixtures to
  the authored wave; fix landed as 724dee2 for the 29-30 Sep 2026 instance.
- `FAILURE_CLASS {"class":"defect",…}` after the FAIL line is classify-failure.mjs talking to
  agent-repair, not a second failure.
- tests run dying in ~15s on `share card is drawn for <X>, data is <Y>` → card-stamp skew (a
  bare `build.mjs` somewhere corrected data without re-rendering); heal per auspol-share-card's
  "Healing a stamp-skew red train", and if the tree carries sibling work commit ONLY
  `assets/auspol-card.json assets/auspol-card.png`.
- site-check red train, `SITE_STATUS {"verdict":2,…,"reason":"referenced asset(s) missing",
  "assets":{"failed":["<hashed-file>"]}}` with `liveBytes == localBytes` and `firstDiffAt: null`
  → NOT deploy lag: a checked-in page references an asset the repo no longer tracks. Triage:
  `git ls-files` the failed path (confirm it's gone, not just unpushed), `grep -l '<hash>'`
  across the checked files (`index.html feed.xml archives/*/index.html atlas/ feedback/
  preference-flows/ prediction/ vic/index.html assets/site-shell.{css,js}`) to find the
  REFERRER, `git log -S '<string>' -- <referrer>` for when the reference appeared, and
  `git show <first-red-sha> --name-status -- <asset-dir>` for the commit that swept the file
  (build.mjs auto-sweeps unkept hashed outputs — fonts/ every build, cycle-source only in the
  federal branch; either jurisdiction's build sweeps fonts/). **site-check is deliberately
  UNWATCHED by agent-repair**, so unlike writer failures these trains never self-heal and one
  email fires per push until a human/agent heals it (test the agent-repair `gh run list` with
  the display-title filter before assuming silence means health). Worked 2026-10-09: 783084a
  dropped crimsontext-italic-600 from FONTS, 387e270's federal rebuild swept the woff2, and
  vic/index.html — regenerated ONLY on an explicit `npm run build:vic` (last built af72596,
  5 Oct) — still anchored the swept hash in its generated @font-face block: 15 consecutive
  push-reds. Heal (9a1e9c6): rebuild the stale satellite in a CLEAN detached worktree at
  HEAD — `git worktree add .worktrees/<n> HEAD`, then `BUILD_JUR=vic node
  .build/newtracker/build.mjs` (build.mjs vendors babel-standalone, so a bare worktree
  builds with NO npm install), verify `node .build/test-vic-build.mjs`, copy the
  regenerated page into the main checkout, commit ONLY that path (the checkout had sibling
  sessions' dirty WIP all over it). Root-cause fix shipped the same day (user-approved,
  c3beeb9): refresh_site() in git-push-main.sh now runs the vic build WARN-ONLY on every
  data refresh (never blocks a federal commit; test-vic-build in npm test is the red
  surface) and vic/index.html rides SITE_FILES / the push-rebuild trigger /
  push_main_regen_attrs, so a shared generated block (fonts, hashed assets, templates)
  changing federally can no longer silently stale the satellite.
- **tests chain dies with "The operation was canceled" straight after a step's last OK line,
  no assertion ever printed** (worked 2026-10-12, eight reds across five runner regions,
  53128f7's own run included): the sandbox in test-newspoll-quarterly.mjs copies
  validate.mjs + its imports into a tmp tree and execFileSyncs it as the step-8 gate —
  and 53128f7 had added `validateChangelog()`/`validatePewSentiment()` to validate.mjs's
  main block, two data files (`data/changelog.json`, `data/pew-econ-sentiment.json`) the
  sandbox did NOT copy. On the Linux runner the child ran main, hit "missing or
  unparseable", exited 1 into execFileSync's throw. Recipe — **sandbox data-dependency
  drift is a recurring class**: when validate.mjs (or any sandboxed script) gains a data
  file its main block parses, every test that sandbox-copies it needs the file too. Audit:
  `grep -n 'join(ROOT, "data"' .build/newtracker/validate.mjs` vs
  `grep -l 'validate.mjs' .build/test-*.mjs`'s sandbox copy lists. And the **macOS
  main-guard trap** masks this class locally: validate.mjs main-runs only if
  `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`, and macOS /tmp is a
  symlink to /private/tmp, so a child invoked via a `mkdtemp(os.tmpdir())` path FAILS the
  string compare, treats itself as a module import, and silently exits 0 — the suite is
  green on the laptop and red only on Linux, where /tmp is real. Reproduce the child's
  behaviour on macOS with a realpath'd temp dir (`fs.realpathSync`). Heal: 0097a50 taught
  the sandbox to copy the two files and left a comment telling future editors to keep the
  list beside validate.mjs's data checks; 967f576 removed the diagnostics after two
  consecutive green runs. Note the signature lesson: theoretically the assert that caught
  the child's exit-1 should have printed "exit code 1" — CI showed a cancel instead (cause
  mechanism unresolved; a nested-process teardown race is the suspicion). **Don't
  over-trust the exact signature text: a deterministic kill point + a locally proven defect
  in exactly that code path is cause enough — ship the fix and let the next run confirm.**
- **Diagnostic-mark discipline for a CI-only death**: when the failure reproduces nowhere
  locally, push temporary timestamped marks (`console.log(\`8.mark +${Date.now()-t0}ms …\`)`)
  bisecting the suspect block — one before/after each await and each child-process spawn —
  IN THE SAME COMMIT as the candidate fix. If the run greens, the marks confirm within a
  run where it had died (107ms child run where 45s of silence had been); if it still dies,
  the last mark is the kill point. Remove the marks in a follow-up commit once the causal
  chain is confirmed — and say so in both commit messages so the next triager can read the
  story from `git log`.

Related: auspol-ci-alert-breaker-triage (circuit-breaker issues), poll-agent-no-show-triage
(expected run absent), auspol-next-polls-projection (the sim fixture convention).
