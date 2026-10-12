---
name: auspol-workflows-fleet-audit
description: auspol-tracker — auditing the .github/workflows CI fleet for drift/defects (worked 2026-10-10, verdict clean, no actionable issues). The verification gates to run, the expected fleet shape to compare against, and the seven false-positive traps that look like issues but are misreads.
source: auto-skill
---

# Auditing the .github/workflows CI fleet

For "pick one part of the repo and identify issues" reviews of `.github/workflows` (28 files). The fleet proved clean on 2026-10-10; the value here is the recipe + the traps.

## The two gates that do most of the work

1. `node .build/tune-schedules.mjs --check` — drift gate for the generated cron blocks. Green output: `"stale":0,"broken":0,"collisions":0`, 511 dispatch-clock slots, every house file `=current`, twins np-score/prediction-refresh current.
2. `node .build/test-workflows.mjs` — convention gate (comment per trigger, every action+runner pinned, `contents:none` default, caller `permissions:` ceilings vs poll-agent.yml's needs, watch-list pins). Green: `test-workflows: ok (28 workflows, 15 poll-agent callers)`.

If both are green and `git status` on `.github/workflows/` is clean, the fleet is most likely fine — the remaining checks are cross-references.

## Expected fleet shape (compare counts before reading files)

- 28 workflow files; ONE reusable `poll-agent.yml` driven by 15 callers / 16 call sites (redbridge-update.yml calls it twice: crosstabs + afr jobs).
- 13 generated cron blocks inside `# tune-schedules:begin/end` markers (11 houses + twins). `demosau-update.yml` also has TWO HAND cron lines above its generated block — legal hand territory, not marker violation.
- agent-repair.yml watch list = exactly 19 workflows; tests, site-check, newspoll-watch, citation-check, schedule-tune, healer, first-contact are deliberately UNWATCHED (matches MATILDA.md).
- PAT expiry alerting lives in `schedule-tune.yml` (~lines 111–129): queries `SCHEDULE_TUNER_TOKEN` expiry, warns + files ci-alert ≤3 weeks out.

## Cross-reference checks

- Sweep every `.build/` path a workflow references against the filesystem.
- Confirm no stale references to retired machinery (the `/vic/` review of the same session found none in workflows/wrappers).
- Compare the fleet inventory against MATILDA.md's claims (it is accurate — "fifteen caller workflows (eleven houses…)").

## False-positive traps (all seven disproved on 2026-10-10 — verify before reporting)

1. Grep "duplicate job key" hits — grep across a file can make two uses of a word look like two job defs; count actual job keys (`site-check.yml` has exactly ONE `check:` job; the step name `Run the site check` is load-bearing for transient-streak.sh).
2. "Missing wrapper script" — read the workflow's actual `wrapper:` value (`foxhedgehog-updater.sh`, with -er), not the pattern you expected.
3. `agent-repair-run.md` "missing" — a CI-runtime scratch file created and consumed in the same job, never a repo file.
4. `.gitignore` "damage" from a sibling commit — `git show` the commit; it may have removed only the intended block.
5. `.matilda/*` "not ignoring" probe files — a nested auto-generated `.matilda/.gitignore` handles it; `.matilda/probe/*` files are deliberately tracked.
6. "first-contact ledger untracked in .matilda/" — it's `.build/first-contact-seen.json`, tracked and pushed by the workflow via push_main.
7. Machine/language paths like `bg/bg/` with zero evidence — if `ls` and `git ls-files` are both empty, the thread was hallucinated; discard.

Also trivia, not issues: an empty git-invisible root `logs/` dir; the read-time `.build/logs` symlink is the real one.

## Report shape

Report-only audits of this fleet should lead with "verified sound" evidence (gate outputs, counts) and keep disproved suspicions OUT of the findings — list them separately as checked-and-cleared, or omit.
