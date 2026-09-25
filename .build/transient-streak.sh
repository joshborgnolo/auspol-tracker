#!/usr/bin/env bash
# transient-streak.sh — is this transient updater failure still "the next
# slot will get it", or has it gone on long enough to be repair work?
#
# poll-agent.yml runs this only after .build/classify-failure.mjs called the
# failure transient (the pollster was down or walled, or push_main lost a
# push race twice). A single outage should not spend a Matilda session or
# send an email — the next slot retries on its own, and the coverage doctor
# still catches any wave that goes missing. But Essential walled GitHub's
# runners for four straight days (15–18 Sep 2026), and a wall that long IS
# worth a look: a UA or header change has fixed walls before.
#
# So: walk this workflow's earlier completed runs, newest first, skipping
# runs in which the updater never ran (DemosAU's hourly gate); count the
# consecutive ones where this same step ran green — they were transient too —
# and stop at the first clean or genuinely failed run. Escalate (exit 1:
# the run goes red and agent-repair takes it) once STREAK_MIN earlier runs
# were transient AND the oldest of them is STREAK_HOURS old. A run that
# escalated counts as red, so the next escalation waits for a fresh streak —
# at most one every STREAK_HOURS, not one per comb slot.
#
# Requires: GH_TOKEN (actions: read), GITHUB_REPOSITORY, GITHUB_RUN_ID, gh.
set -uo pipefail

STREAK_MIN="${STREAK_MIN:-2}"
STREAK_HOURS="${STREAK_HOURS:-12}"
STEP="Note a transient upstream failure" # this step's name in poll-agent.yml
MAX_RUNS=15

summary() { [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$*" >> "$GITHUB_STEP_SUMMARY"; return 0; }

wf_id="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" --jq .workflow_id 2>/dev/null)" || wf_id=""
if [ -z "$wf_id" ]; then
  echo "::warning::transient failure; could not read this workflow's run history, so no streak check (actions: read missing?)"
  exit 0
fi

streak=0 oldest="" inspected=0
while read -r id created; do
  [ -n "$id" ] || continue
  inspected=$((inspected + 1))
  [ "$inspected" -le "$MAX_RUNS" ] || break
  flags="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$id/jobs" --jq "
    [.jobs[].steps[]?] as \$s
    | \"\([\$s[] | select((.name | test(\"^Run the .* updater\$\")) and (.conclusion == \"success\" or .conclusion == \"failure\"))] | length) \([\$s[] | select(.name == \"$STEP\" and .conclusion == \"success\")] | length)\"" 2>/dev/null)" || break
  ran="${flags% *}" transient="${flags#* }"
  [ "${ran:-0}" -gt 0 ] || continue
  [ "${transient:-0}" -gt 0 ] || break
  streak=$((streak + 1))
  oldest="$created"
done < <(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/$wf_id/runs?status=completed&branch=main&per_page=40" \
  --jq ".workflow_runs[] | select(.id != $GITHUB_RUN_ID) | select(.conclusion == \"success\" or .conclusion == \"failure\") | \"\(.id) \(.created_at)\"" 2>/dev/null)

age_h=0
if [ -n "$oldest" ]; then
  age_h="$(node -e 'console.log(Math.floor((Date.now() - Date.parse(process.argv[1])) / 3600000))' "$oldest")"
fi

if [ "$streak" -ge "$STREAK_MIN" ] && [ "$age_h" -ge "$STREAK_HOURS" ]; then
  echo "::error::transient failures for ${age_h}h straight ($streak earlier runs, oldest $oldest) — escalating to repair"
  summary "### Transient failure, escalated"
  summary "This run and the $streak before it (since $oldest, ${age_h}h) all failed the same transient way. That is long enough to be worth a look — the run goes red so agent-repair takes it."
  exit 1
fi
echo "::warning::transient failure (the pollster or the network, or a lost push race) — the next slot retries; $streak earlier run(s) in this streak${oldest:+, since $oldest}"
summary "### Transient failure — not repair work"
summary "The updater failed in a way the next slot fixes on its own (see the classification above). Streak: $streak earlier run(s)${oldest:+ since $oldest}. It escalates after ${STREAK_HOURS}h."
exit 0
