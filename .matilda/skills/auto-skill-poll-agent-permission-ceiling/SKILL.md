---
name: poll-agent-permission-ceiling
description: auspol-tracker — the eight poll-agent caller workflows must keep their top-level `permissions:` block in step with anything the reusable poll-agent.yml's jobs request (currently contents + pull-requests + issues, all write, on the PR-gated `repair` job). A one-sided widening breaks ALL EIGHT data pipelines at their next scheduled trigger with "Invalid workflow file" startup failures. Worked incident/fixes 0c3a2ba (2026-09-06).
source: auto-skill
extracted_at: '2026-09-06T05:00:00.000Z'
---

# The reusable-workflow permissions ceiling (poll-agent.yml ↔ its 8 callers)

## The mechanism (why a permissions edit can silently kill 8 pipelines)

A **called** (reusable) workflow's `GITHUB_TOKEN` can never exceed what the **caller**
grants: the caller's `permissions:` block is the ceiling, and any scope it doesn't list is
treated as `none` for the called workflow. GitHub enforces this at **workflow validation** —
if any nested job in `poll-agent.yml` declares a scope the caller doesn't list, the caller
workflow is INVALID and never starts.

Failure signature (from the responder run list, 2026-09-06):

```
Status: Startup failure — no jobs ran at all
Annotations: Invalid workflow file: .github/workflows/resolve-update.yml#L22
  The nested job 'repair' is requesting 'issues: write, pull-requests: write',
  but is only allowed 'issues: none, pull-requests: none'.
```

Red herrings in that output:

- The annotation's file/line points at the caller's `uses:` line (L22), but the required
  change is the caller's top-level `permissions:` block (L18) — don't edit at the cited line.
- Nothing fails at commit/push time; the break appears at each caller's NEXT scheduled
  trigger, spread over the day, one "Startup failure" email per slot, and data goes stale
  behind it (all extraction/expo sweeps are these 8 pipelines).

Origin incident: `1a8dd72` (PR-gated repair agents) added `pull-requests: write,
issues: write` to poll-agent.yml's `repair` job without widening the callers; every caller
then failed on its next schedule. Fixed in `0c3a2ba` by widening all 8 callers.

## The invariant to maintain

`poll-agent.yml` currently declares per-job permissions on `repair`
(~L139-142: `contents: write`, `pull-requests: write`, `issues: write` — the comment block
explains each: push repair branch / open PR / breaker alert issues). Whenever ANY job in
`poll-agent.yml` gains a new or widened scope, update the top-level `permissions:` block in
ALL EIGHT callers in the same commit:

```
resolve-update.yml, spectre-update.yml, essential-update.yml, demosau-update.yml,
redbridge-update.yml, newspoll-update.yml, foxhedgehog-update.yml, sampleeff-update.yml
```

Each caller's block currently reads:

```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
```

NOT affected: `roymorgan-update.yml`, `newspoll-watch.yml`, `prediction-refresh.yml`,
`coverage-check.yml` — their repair jobs are INLINE (not called) and declare their own
per-job permissions. poll-agent.yml itself needs no top-level widened block; only callers do.

## Verifying a permissions edit (no js-yaml/pyyaml on this machine, but ruby works)

```bash
ruby -ryaml -e '
  %w[resolve spectre essential demosau redbridge newspoll foxhedgehog sampleeff].each do |h|
    d = YAML.load_file(".github/workflows/#{h}-update.yml")
    abort "drift in #{h}" unless d["permissions"].keys.sort ==
      poll_agent_repair_scopes    # read from poll-agent.yml repair: permissions
  end'
```

Cross-check against `poll-agent.yml`'s `repair.permissions` keys; the caller set must
cover them (exact equality is the current convention). Note ruby `-ryaml` is the working
local validator — corrects the older "no YAML parser installed" note in
ci-main-writer-races (pyyaml/yq absent, ruby present).

## Auditing ALL workflows after a permissions-class change (beyond the 8 callers)

Don't stop at the callers — after `0c3a2ba`, a full-repo structural sweep confirmed no
other ceiling mismatches. Pattern: for every `.github/workflows/*.yml`, compute each job's
EFFECTIVE permissions (job-level block, else the workflow top-level block) and assert they
cover what the job's `run:` steps actually do; jobs that `uses:` a reusable workflow need
the union of that workflow's per-job scopes. The run-step → scope rules that caught real
issues: `alert-issue.sh` / issue ops → `issues: write`; `gh pr *` → `pull-requests: write`;
`push_main` / `git push` → `contents: write`. For reusable-workflow callers specifically,
compare against the called file's per-job `permissions:` (not its top level). All 17
workflows parsed clean via ruby on 2026-09-06 with this sweep; keep it as the regression
check whenever any workflow's permissions, repair-job scope, or script inventory changes.

## Related

- **ci-main-writer-races** — the other workflow-topology invariant (main-writers group +
  push_main); adding a workflow means checking BOTH skills' membership rules.
- **launchd-scheduled-data-pipeline** — the launchd twins of these 8 pipelines; a CI
  permissions break is exactly when the local backup tier matters (they share wrappers, so
  startup-failing CI slots don't stop local jobs).
