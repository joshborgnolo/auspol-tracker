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
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

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
exit 0
