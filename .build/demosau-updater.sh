#!/bin/bash
# Scheduled DemosAU federal-poll update: extract -> if polls.json changed ->
# validate -> build -> commit -> push. Installed via launchd (plist copied to
# ~/Library/LaunchAgents/local.auspol.demosau.plist from the copy in this
# directory). Every step logs one line to .build/logs/demosau.log; any
# failure exits non-zero before any commit, leaving the working tree for
# manual review.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/demosau.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

EXTRACT_OUT="$(node .build/extract-demosau.mjs 2>&1)"
CODE=$?
LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  # exit 1 = fetch/parse, exit 2 = safety guard; either way stop before write-up
  log "FAIL extract (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  DEMOSAU_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL extract (no DEMOSAU_STATUS line): $LAST_LINE"; exit 1 ;;
esac

if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  exit 0
fi

log "new DemosAU wave(s) detected; running validate/build/commit/push"
if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
  log "FAIL validate (errors above); no commit made"
  exit 1
fi
if ! node .build/newtracker/build.mjs >> "$LOG" 2>&1; then
  log "FAIL build; no commit made"
  exit 1
fi

git add data/polls.json .build/demosau-src/ index.html feed.xml sitemap.xml robots.txt || { log "FAIL git add"; exit 1; }
MSG="Update DemosAU poll data $(date '+%Y-%m-%d')"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! git push >> "$LOG" 2>&1; then
  log "FAIL git push (commit kept locally)"
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
