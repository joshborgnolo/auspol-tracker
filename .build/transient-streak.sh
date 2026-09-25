#!/usr/bin/env bash
# transient-streak.sh — is this soft verdict still "the next run will get
# it", or has it gone on long enough to be a defect?
#
# Two callers, one rule (STREAK_KIND):
#
#   transient     poll-agent.yml, after .build/classify-failure.mjs called an
#   (default)     updater failure transient (the pollster was down or walled,
#                 or push_main lost a push race twice). A single outage should
#                 not spend a Matilda session or send an email — the next slot
#                 retries on its own, and the coverage doctor still catches any
#                 wave that goes missing. But Essential walled GitHub's runners
#                 for four straight days (15–18 Sep 2026), and a wall that long
#                 IS worth a look: a UA or header change has fixed walls before.
#
#   inconclusive  the watchdogs (site-check.yml, coverage-check.yml), after a
#                 class-1 "couldn't tell" verdict. One is not an alarm — the
#                 network had a bad minute. An unbroken run of them is a blind
#                 watchdog: coverage-check read a reshaped Wikipedia table as
#                 inconclusive for twelve days (Sep 2026), and site-check
#                 crashed on a deleted file, and reported inconclusive, for
#                 nineteen. Both stayed green the whole time.
#
# So: walk this workflow's earlier completed runs, newest first, skipping
# runs in which the STREAK_RAN step never ran (DemosAU's hourly gate, a
# backup slot the dispatch clock already served, a failed Pages deploy);
# count the consecutive ones where the STREAK_STEP marker step ran green —
# they were soft too — and stop at the first clean or genuinely failed run.
# Escalate (exit 1: the job goes red) once STREAK_MIN earlier runs were soft
# AND the oldest of them is STREAK_HOURS old. A run that escalated counts as
# red, so the next escalation waits for a fresh streak — at most one every
# STREAK_HOURS, not one per run.
#
# Requires: GH_TOKEN (actions: read), GITHUB_REPOSITORY, GITHUB_RUN_ID, gh.
set -uo pipefail

STREAK_KIND="${STREAK_KIND:-transient}"
STREAK_MIN="${STREAK_MIN:-2}"
STREAK_HOURS="${STREAK_HOURS:-12}"
case "$STREAK_KIND" in
  transient)
    STEP="${STREAK_STEP:-Note a transient upstream failure}" # the marker step's name in poll-agent.yml
    RAN="${STREAK_RAN:-^Run the .* updater\$}" ;;
  inconclusive)
    STEP="${STREAK_STEP:-Note an inconclusive verdict}"
    RAN="${STREAK_RAN:?STREAK_RAN: the watchdog step whose run makes a run count}" ;;
  *) echo "::error::transient-streak.sh: unknown STREAK_KIND '$STREAK_KIND'"; exit 2 ;;
esac
# how far back to walk; a watchdog that runs on every deploy needs more
# than an updater does to reach STREAK_HOURS back
MAX_RUNS="${STREAK_MAX_RUNS:-15}"

summary() { [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$*" >> "$GITHUB_STEP_SUMMARY"; return 0; }

wf_id="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" --jq .workflow_id 2>/dev/null)" || wf_id=""
if [ -z "$wf_id" ]; then
  echo "::warning::$STREAK_KIND verdict; could not read this workflow's run history, so no streak check (actions: read missing?)"
  exit 0
fi

streak=0 oldest="" inspected=0
while read -r id created; do
  [ -n "$id" ] || continue
  inspected=$((inspected + 1))
  [ "$inspected" -le "$MAX_RUNS" ] || break
  flags="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$id/jobs" --jq "
    [.jobs[].steps[]?] as \$s
    | \"\([\$s[] | select((.name | test(\"$RAN\")) and (.conclusion == \"success\" or .conclusion == \"failure\"))] | length) \([\$s[] | select(.name == \"$STEP\" and .conclusion == \"success\")] | length)\"" 2>/dev/null)" || break
  ran="${flags% *}" soft="${flags#* }"
  [ "${ran:-0}" -gt 0 ] || continue
  [ "${soft:-0}" -gt 0 ] || break
  streak=$((streak + 1))
  oldest="$created"
done < <(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/$wf_id/runs?status=completed&branch=main&per_page=$(( MAX_RUNS + 25 > 100 ? 100 : MAX_RUNS + 25 ))" \
  --jq ".workflow_runs[] | select(.id != $GITHUB_RUN_ID) | select(.conclusion == \"success\" or .conclusion == \"failure\") | \"\(.id) \(.created_at)\"" 2>/dev/null)

age_h=0
if [ -n "$oldest" ]; then
  age_h="$(node -e 'console.log(Math.floor((Date.now() - Date.parse(process.argv[1])) / 3600000))' "$oldest")"
fi

if [ "$streak" -ge "$STREAK_MIN" ] && [ "$age_h" -ge "$STREAK_HOURS" ]; then
  if [ "$STREAK_KIND" = inconclusive ]; then
    echo "::error::inconclusive for ${age_h}h straight ($streak earlier runs, oldest $oldest) — the watchdog is blind, not unsure"
    summary "### Inconclusive for ${age_h}h — escalated"
    summary "This run and the $streak before it (since $oldest) could not reach a verdict. A watchdog that can't see for that long is broken: the check itself, its parser or its source needs a look. The run goes red."
  else
    echo "::error::transient failures for ${age_h}h straight ($streak earlier runs, oldest $oldest) — escalating to repair"
    summary "### Transient failure, escalated"
    summary "This run and the $streak before it (since $oldest, ${age_h}h) all failed the same transient way. That is long enough to be worth a look — the run goes red so agent-repair takes it."
  fi
  exit 1
fi
if [ "$STREAK_KIND" = inconclusive ]; then
  echo "::warning::inconclusive verdict — not an alarm yet; $streak earlier run(s) in this streak${oldest:+, since $oldest}"
  summary "### Inconclusive — not an alarm yet"
  summary "The check could not reach a verdict this time. Streak: $streak earlier run(s)${oldest:+ since $oldest}. It goes red after ${STREAK_HOURS}h."
else
  echo "::warning::transient failure (the pollster or the network, or a lost push race) — the next slot retries; $streak earlier run(s) in this streak${oldest:+, since $oldest}"
  summary "### Transient failure — not repair work"
  summary "The updater failed in a way the next slot fixes on its own (see the classification above). Streak: $streak earlier run(s)${oldest:+ since $oldest}. It escalates after ${STREAK_HOURS}h."
fi
exit 0
