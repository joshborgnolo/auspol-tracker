#!/usr/bin/env bash
# Repair-agent circuit breaker — the pre-flight run before spending a
# Matilda session on a persistent breakage.
#
# Counts the agent SESSIONS actually spent on the same target in the
# trailing 24h and writes allowed=true|false to $GITHUB_OUTPUT. One failed
# slot repaired is one event; a pipeline still failing after three sessions
# is a human-sized problem, and a fourth session will only burn API credit
# repeating what three just tried.
#
# A session is a run in which the agent JOB ran — not a run of the workflow.
# agent-repair.yml fires on EVERY completion of every watched workflow and
# its gate skips the green ones, so until 2026-09-25 this counted ~150
# skipped runs a day as sessions: `tests` sat at 19 and DemosAU (hourly) at
# 4, the breaker was permanently shut on both, and issue #1 collected five
# "three sessions" alerts for sessions that never ran. It also read only
# the newest 50 runs of a 24h window that holds ~150.
#
# Usage:  repair-gate.sh <label> [<workflow-file> <agent-job>]
#   agent-repair (default): repair-gate.sh <failed-workflow-name>
#     counts agent-repair.yml runs titled "agent-repair: <label>" whose
#     `repair` job ran
#   the Newspoll filer:     repair-gate.sh newspoll-file newspoll-watch.yml file-missing
#     counts newspoll-watch.yml runs whose `file-missing` job ran
# Requires: GH_TOKEN in env (actions: read), gh on PATH, $GITHUB_REPOSITORY,
# $GITHUB_OUTPUT.
set -u

label="${1:?label (the failed workflow name)}"
workflow="${2:-agent-repair.yml}"
job="${3:-repair}"
max=3

since="$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)"
# Title filter only for agent-repair, whose run-name carries the target
# ("agent-repair: <wf>"; which API field holds run-name has moved between
# versions, so both are checked). Skipped and cancelled runs never ran a
# session, so they are dropped before any per-run lookup.
if [ "$workflow" = "agent-repair.yml" ]; then
  title_filter="select((.name // \"\") == \"agent-repair: ${label}\" or (.display_title // \"\") == \"agent-repair: ${label}\")"
else
  title_filter="."
fi
ids="$(gh api --paginate "repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs?created=%3E%3D${since}&status=completed&per_page=100" \
  --jq ".workflow_runs[] | select(.conclusion == \"success\" or .conclusion == \"failure\") | ${title_filter} | .id" 2>/dev/null)" || ids=""

count=0
for id in $ids; do
  ran="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${id}/jobs" \
    --jq "[.jobs[] | select(.name == \"${job}\" and (.conclusion == \"success\" or .conclusion == \"failure\"))] | length" 2>/dev/null)" || ran=0
  [ "${ran:-0}" -gt 0 ] && count=$((count + 1))
done

echo "agent sessions for ${label} in the last 24h: ${count} (breaker trips at ${max})"
if [ "${count}" -ge "${max}" ]; then
  echo "allowed=false" >> "$GITHUB_OUTPUT"
  echo "::warning::repair circuit breaker tripped for ${label}: ${count} agent sessions in 24h; no new session"
else
  echo "allowed=true" >> "$GITHUB_OUTPUT"
fi
