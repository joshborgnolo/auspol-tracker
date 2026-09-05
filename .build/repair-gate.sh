#!/usr/bin/env bash
# Repair-agent circuit breaker — the pre-flight every repair job runs before
# spending a Matilda session on a persistent upstream breakage.
#
# Counts the repair PRs already opened for <house> in the trailing 24h and
# writes allowed=true|false to $GITHUB_OUTPUT. A house whose updater failed
# yesterday and was repaired is one event; a house still failing after three
# repair attempts is a human-sized problem, and a fourth agent session will
# only burn API credit repeating what three just tried.
#
# PRs are matched by the contract the repair jobs open them under:
# label "repair-agent" + title prefix "Repair: <house>".
#
# Usage:  repair-gate.sh <house>
# Requires: GH_TOKEN in env, gh on PATH, $GITHUB_REPOSITORY, $GITHUB_OUTPUT.
set -u

house="${1:?house name}"
max=3

since="$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)"
q="repo:${GITHUB_REPOSITORY} is:pr label:repair-agent in:title Repair: ${house} created:>=${since}"
count="$(gh api -X GET search/issues -f q="$q" --jq '.total_count' 2>/dev/null)" || count=""
count="${count:-0}"

echo "repair PRs for ${house} in the last 24h: ${count} (breaker trips at ${max})"
if [ "${count}" -ge "${max}" ]; then
  echo "allowed=false" >> "$GITHUB_OUTPUT"
  echo "::warning::repair circuit breaker tripped for ${house}: ${count} repair PRs in 24h; no new agent session"
else
  echo "allowed=true" >> "$GITHUB_OUTPUT"
fi
