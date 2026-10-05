#!/bin/bash
# RedBridge/Accent wave from the AFR article's chart, in CI (2026-10-05).
# Runs on a GitHub macOS runner — the chart is read with macOS Vision OCR
# (.build/ocr-image.swift) — called by redbridge-update.yml's `afr` job,
# which an Ubuntu gate starts only when the AFR topic page lists a story
# after the latest committed wave that the ledger hasn't settled. It does
# what the laptop's redbridge-updater.sh AFR step does, minus the logged-in
# Chrome: discover -> chart -> Matilda's citations -> change reconciliation
# -> validate -> build -> commit -> push (see extract-redbridge-afr.mjs).
# The laptop job stays installed: whichever files first wins, the other
# finds the wave committed.
#
# A story settled without a filing (no chart, not federal, unverifiable)
# is recorded in .build/redbridge-src/afr-seen.json and that ledger is
# committed on its own, so the gate stops starting a Mac for it.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/redbridge-afr.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }
. "$REPO/.build/git-push-main.sh"

acquire_slot_lock
if git diff --quiet && git diff --cached --quiet; then
  freshness_sync || exit 0
else
  log "FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base"
  exit 1
fi

OUT="$(node .build/extract-redbridge-afr.mjs --discover 2>&1)"
CODE=$?
LAST="$(echo "$OUT" | tail -1)"
echo "$OUT" >> "$LOG"
case "$LAST" in
  RBAFR_STATUS*) log "$LAST" ;;
  *) log "FAIL afr-chart (no RBAFR_STATUS line, exit $CODE): $LAST"; exit 1 ;;
esac
if [ $CODE -ne 0 ]; then
  log "FAIL afr-chart (exit $CODE)"
  exit $CODE
fi

SEEN=.build/redbridge-src/afr-seen.json
if ! echo "$LAST" | grep -q '"changed":true'; then
  # nothing filed: commit the ledger alone if this run settled a story
  if [ -f "$SEEN" ] && { ! git diff --quiet -- "$SEEN" || [ -n "$(git ls-files --others --exclude-standard "$SEEN")" ]; }; then
    git add "$SEEN"
    MSG="RedBridge/Accent: record AFR stories read without a wave $(date '+%Y-%m-%d')"
    if git commit -m "$MSG" >> "$LOG" 2>&1 && push_main "$MSG" "$SEEN"; then
      log "OK committed + pushed: $MSG"
    else
      log "WARN ledger commit/push failed; the next run rereads the story"
    fi
  fi
  exit 0
fi

log "wave filed from the AFR chart; running validate/build/commit/push"
if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
  log "FAIL validate (errors above); no commit made"
  exit 1
fi
if ! refresh_site; then
  log "FAIL build; no commit made"
  exit 1
fi

FILES=(data/polls.json .build/redbridge-src/ "${SITE_FILES[@]}")
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
MSG="RedBridge/Accent: file the new wave from the AFR article's chart $(date '+%Y-%m-%d') (Accent report to follow)"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
