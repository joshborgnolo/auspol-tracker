---
name: auspol-ci-run-failure-triage
description: auspol-tracker — "why did this Actions run fail?" triage playbook (worked 2026-09-30 on essential-update #90 and a red scheduled tests run). Check git log origin/main FIRST — agent-repair may already have fixed and documented the root cause; the UI job summary shows only the log's last 200/40 lines so real error lines are routinely cut off and primary-sum entries are documented exceptions, not errors; grep patterns like `fail` false-positive on test-file names ("test-classify-failure: ok"); and writer commits pushed with GITHUB_TOKEN never re-trigger push-event workflows, so a red SCHEDULED run is often the first test of data committed hours earlier — identify the causal commit, never assume the run's HEAD commit did it.
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

Related: auspol-ci-alert-breaker-triage (circuit-breaker issues), poll-agent-no-show-triage
(expected run absent), auspol-next-polls-projection (the sim fixture convention).
