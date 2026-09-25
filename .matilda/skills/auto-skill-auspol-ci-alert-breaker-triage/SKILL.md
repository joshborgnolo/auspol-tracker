---
name: ci-alert-breaker-triage
description: auspol-tracker — triaging a .build/alert-issue.sh circuit-breaker issue ("Repair circuit breaker: <workflow> … this needs a human", label ci-alert). Most are STALE at first read: the fix commonly landed via a hand push outside the agent-repair pipeline, and the breaker fires on session count, not current health. Verify with gh run list before touching anything; remember github-actions[bot] pushes (GITHUB_TOKEN) don't retrigger on:push workflows, so a bot tip commit legitimately shows NO tests run; and "push the change" requests need a your-commits-vs-sibling-WIP check, not a sweep commit.
source: auto-skill
extracted_at: '2026-09-21T01:51:57.864Z'
---

# Circuit-breaker ci-alert triage (worked: tests breaker, 2026-09-21)

> **2026-09-25 — most of the staleness is fixed at the source.** The breaker counted every
> SKIPPED agent-repair run as a session (agent-repair fires on every completion of every
> watched workflow), so `tests` sat at 19 and DemosAU at 4 — permanently tripped, and the
> "three sessions" alerts named sessions that never ran (issue #1's five comments). It now
> counts runs whose `repair` job actually ran. `tests`, `site-check`, `newspoll-watch` and
> `citation-check` are no longer watched at all. And coverage-check's daily `alerts` job
> (`.build/resolve-alerts.sh`) closes a "Repair circuit breaker: <wf>" / "Repair gate
> blocked: <wf>" issue by itself once `<wf>` has run green since the issue's last update.
> An alert that is still open is therefore probably live — the checks below still apply.

The ware look: a github-actions[bot] issue titled "Repair circuit breaker: <workflow>" —
"Three agent-repair sessions in 24h and <workflow> is still failing — failed run. No further
agent sessions this window; this needs a human." (filed by `.build/alert-issue.sh`, label
`ci-alert`). Before treating it as live breakage, run this chain.

## 1. Is the cited failure already superseded?

```sh
gh run list --workflow <wf> --limit 5
```

Find a **green run NEWER than the cited red one**. If yes, the repair already happened — the
breaker's gate is session-count-based (3 sessions / 24 h per `.build/repair-gate.sh`, matched
on the `agent-repair: <wf>` run-name), so it fires even when a human push fixed the thing it
was watching. Worked example 2026-09-21: breaker tripped on run 35546550176 (red, on merge
d6f9f3d), but hand-push `1141f0c` had already fixed the sim-test regression and run
35549921078 came back green — the issue was pure staleness. Right move: answer with the fixing
commit + green run id and propose CLOSING the issue (ask before closing — shared state).

## 2. "No tests run on the tip commit" is usually normal

Commits pushed by `github-actions[bot]` with the built-in `GITHUB_TOKEN` ("Update effective
sample sizes …", "Refresh the citation link-health ledger") do **not** retrigger `on: push`
workflows — GitHub's standard recursion guard. So:

```sh
gh api repos/<owner>/<repo>/actions/runs?head_sha=<bot-sha> --jq '.workflow_runs[] | .name'
```

on a bot tip shows `pages build and deployment` (plus `workflow_run`-gated rows like
`agent-repair:*`) but **no `tests` run — by design, not missing coverage**. tests.yml says
"advisory by design: writers push straight to main"; each updater's own validate/build gate
inside the agent workflow covers its commits. If a human genuinely needs a test signal on a
bot tip: `gh workflow run tests` or wait for the next human push. Don't chase the absence as
breakage.

## 3. "Push the change you made" → audit, don't sweep

`git status --short` in this shared repo routinely shows **another session's WIP** (SKILL.md
edits, reverted hunks, prediction files). Answering a push request means separating:

- `git log origin/main -5 --format='%h %an %s'` — name YOUR commits and shas (usually already
  on main; manual `workflow_dispatch` runs commit their own results).
- The dirty-tree remainder belongs to the sibling session — never commit it to satisfy the
  push request. Say so explicitly and name which paths you did NOT author.

## Environmental gotcha while doing any of this

`gh workflow run` and some other gh subcommands shell out to `git`; the PATH git on this
machine is broken (`Bad CPU type in executable`, exit 254). Prefix once per shell:

```sh
export PATH="$(dirname "$(xcrun -f git)"):$PATH"
```

(`gh run list`/`gh run view`/`gh api` work without git; only run-triggering subcommands need it.)
