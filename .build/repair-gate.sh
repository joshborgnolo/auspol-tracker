#!/usr/bin/env bash
# Repair-agent circuit breaker — the pre-flight the central agent-repair
# workflow runs before spending a Matilda session on a persistent breakage.
#
# Counts the agent-repair RUNS for the same failed workflow in the trailing
# 24h (matched by this repo's `run-name:` contract, "agent-repair: <wf>")
# and writes allowed=true|false to $GITHUB_OUTPUT. One failed slot repaired
# is one event; a pipeline still failing after three agent sessions is a
# human-sized problem, and a fourth session will only burn API credit
# repeating what three just tried.
#
# (History: until 2026-09 this counted repair PRs, because repairs then
# landed as PR-gated branches. Repairs now land straight on main via the
# central agent-repair.yml, so the breaker counts its own runs instead.)
#
# Usage:  repair-gate.sh <failed-workflow-name>
# Requires: GH_TOKEN in env, gh on PATH, $GITHUB_REPOSITORY, $GITHUB_OUTPUT.
set -u

wf="${1:?failed workflow name}"
max=3

since="$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)"
# created>= filters server-side; jq matches the run-name contract against
# BOTH name and display_title (which one carries run-name has moved between
# API versions), completed sessions only — an in-flight sibling is serialised
# behind us by the main-writers concurrency group anyway.
count="$(gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/agent-repair.yml/runs?created=%3E%3D${since}&per_page=50" \
  --jq "[.workflow_runs[] | select(.status == \"completed\") | select(((.name // \"\") | startswith(\"agent-repair: ${wf}\")) or ((.display_title // \"\") | startswith(\"agent-repair: ${wf}\")))] | length" 2>/dev/null)" || count=""
count="${count:-0}"

echo "agent-repair runs for ${wf} in the last 24h: ${count} (breaker trips at ${max})"
if [ "${count}" -ge "${max}" ]; then
  echo "allowed=false" >> "$GITHUB_OUTPUT"
  echo "::warning::repair circuit breaker tripped for ${wf}: ${count} repair sessions in 24h; no new agent session"
else
  echo "allowed=true" >> "$GITHUB_OUTPUT"
fi
