#!/bin/bash
# Scheduled coverage watchdog: ask Wikipedia whether the tracker has missed a
# poll, and tell someone when it has.
#
# This is the only scheduled job that does not write to the repo. Every other
# agent can only report on the source it owns, and all of them fail silently —
# a rotted parser and a quiet fortnight produce the same empty run. This one
# compares data/polls.json against an independent witness and raises a
# notification, so a missed wave surfaces within a day instead of whenever
# someone happens to look at the site.
#
# It deliberately does NOT fill gaps. Which article a row cites, how a house's
# fieldwork dates are keyed and whether a wave is the headline or a scenario
# are conventions the owning extractor encodes; a watchdog quietly writing rows
# from a secondary source would put data in the file that no extractor would
# have produced. Finding the gap is the job; filling it is the extractor's.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/coverage.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }

# GitHub Actions may push data updates to main between local launchd slots;
# the check is only meaningful against current main. Untracked files don't
# count as dirty.
if git diff --quiet && git diff --cached --quiet; then
  git fetch origin -q || true
  git merge --ff-only origin/main >> "$LOG" 2>&1 || log "note: ff-only sync failed; checking against local main"
fi

OUT="$(node .build/check-coverage.mjs 2>&1)"
CODE=$?
STATUS_LINE="$(echo "$OUT" | grep '^COVERAGE_STATUS' | tail -1)"

if [ -z "$STATUS_LINE" ]; then
  log "FAIL check-coverage (exit $CODE, no COVERAGE_STATUS line): $(echo "$OUT" | tail -1)"
  exit 1
fi
log "$STATUS_LINE"

# exit 1 = inconclusive (Wikipedia unreachable, or its table changed shape).
# Worth knowing about, but it is not evidence of a missing poll, so it must not
# cry wolf: log it and let a run of them show up in the log rather than as a
# notification every day the network is flaky.
# ---------------------------------------------------------------------------
# Writer-pipeline liveness (added 2026-09-07, after the lock outage): the same
# two checks the CI heartbeat job runs — that the writers lock is acquirable,
# and that automation has committed within 60h. Runs BEFORE the inconclusive
# and clean-exit gates so a stalled pipeline alarms on its own — the day
# Wikipedia is unreachable is the day you most want to know the pipeline
# itself is alive. Report-only like everything else here: this job never
# writes the repo.
LIVE_FAIL=""

PROBE_OUT="$(bash .build/probe-writers-lock.sh 2>&1)"
PROBE_RC=$?
PROBE_STATUS="$(echo "$PROBE_OUT" | grep '^PROBE_STATUS' | tail -1)"
if [ -z "$PROBE_STATUS" ]; then
  log "note: lock probe inconclusive (exit $PROBE_RC, no PROBE_STATUS line); not an alarm"
else
  log "$PROBE_STATUS"
  [ "$PROBE_RC" -eq 1 ] && LIVE_FAIL="writers lock refused with config-failure signature"
fi

HB_OUT="$(node .build/check-writer-heartbeat.mjs 2>&1)"
HB_RC=$?
HB_STATUS="$(echo "$HB_OUT" | grep '^HEARTBEAT_STATUS' | tail -1)"
if [ -z "$HB_STATUS" ]; then
  log "note: heartbeat inconclusive (exit $HB_RC, no HEARTBEAT_STATUS line); not an alarm"
else
  log "$HB_STATUS"
  if [ "$HB_RC" -eq 3 ]; then
    HB_DETAIL="$(echo "$HB_OUT" | grep '^STALLED' | tail -1)"
    LIVE_FAIL="${LIVE_FAIL:+$LIVE_FAIL; }${HB_DETAIL:-automation heartbeat stalled}"
  fi
fi

if [ -n "$LIVE_FAIL" ]; then
  log "ALERT $LIVE_FAIL"
  osascript -e "display notification \"${LIVE_FAIL//\"/\'}\" with title \"auspol tracker: writer pipeline silent\" sound name \"Basso\"" \
    >> "$LOG" 2>&1 || log "note: osascript notification failed (no GUI session?)"
fi

if [ "$CODE" -eq 1 ]; then
  log "coverage check inconclusive; no alert raised"
  exit 0
fi
[ "$CODE" -eq 0 ] && exit 0

# exit 3 = a real gap. Summarise it in the notification itself: a notification
# that only says "something is wrong" makes you go and look, which is the cost
# this is supposed to remove.
SUMMARY="$(echo "$OUT" | grep -E '^  [0-9]{4}-' | head -3 | sed 's/^  //' | tr '\n' ';' | sed 's/;$//')"
COUNT="$(echo "$OUT" | grep -cE '^  [0-9]{4}-')"
[ -z "$SUMMARY" ] && SUMMARY="$(echo "$OUT" | grep -E 'missed$' | head -2 | sed 's/^  //' | tr '\n' ';')"
MSG="${COUNT} wave(s) on Wikipedia not in polls.json: ${SUMMARY}"
log "ALERT $MSG"

osascript -e "display notification \"${MSG//\"/\'}\" with title \"auspol tracker: missing poll\" sound name \"Basso\"" \
  >> "$LOG" 2>&1 || log "note: osascript notification failed (no GUI session?)"

# In CI (GitHub Actions sets CI=true) fail the run so the alert arrives as a
# GitHub notification email instead of sitting in a logfile nobody reads.
if [ "${CI:-}" = "true" ]; then
  exit 1
fi
exit 0

