#!/bin/bash
# Scheduled RedBridge/Accent federal-poll update: extract -> if polls.json
# changed -> stamp the wave's sampleEff/methodUrl off the fresh redbridge-src
# caches (extract-sampleeff.mjs accent, offline) -> crosstabs -> validate -> render-card ->
# build -> commit -> push. Installed via launchd
# (plist copied to ~/Library/LaunchAgents/local.auspol.redbridge.plist from
# the copy in this directory). Every step logs one line to
# .build/logs/redbridge.log; any failure exits non-zero before any commit,
# leaving the working tree for manual review.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/redbridge.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }
. "$REPO/.build/git-push-main.sh"

# One repo-wide lock across all writing wrappers; freshness_sync (shared,
# with wedge recovery) replaces the inline ff-only block below.
acquire_slot_lock

# GitHub Actions may push to main between local launchd slots. Refresh first;
# if the local tree can't fast-forward, skip this slot rather than commit on a
# stale base. Untracked files don't count as dirty.
if git diff --quiet && git diff --cached --quiet; then
  freshness_sync || exit 0
else
  log "FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base"
  exit 1
fi

EXTRACT_OUT="$(node .build/extract-redbridge.mjs 2>&1)"
CODE=$?
if [ $CODE -eq 1 ]; then
  # transient fetch click failures happen; retry the whole run once
  log "extract failed (exit 1); retrying in 5 min"
  sleep 300
  EXTRACT_OUT="$(node .build/extract-redbridge.mjs 2>&1)"
  CODE=$?
fi
LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  # exit 1 = fetch/parse, exit 2 = safety guard; either way stop before write-up
  log "FAIL extract (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  RB_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL extract (no RB_STATUS line): $LAST_LINE"; exit 1 ;;
esac

if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  # No new wave: give the skip-confirm a go. It verifies — from the AFR topic
  # list this run's extractor parsed a moment ago, not a cached state file —
  # that nothing has been filed since before the slot day and that it's past
  # 9pm Sydney on it (an hour after the latest recorded filing); exit 3 means
  # the slot got recorded in pollsterRules.skippedSlots and the projection
  # rolls to the Sunday a week on, which then needs a rebuild and a commit
  # like any other data change. Anything else is a silent no-op.
  STATUS_JSON="${LAST_LINE#RB_STATUS }"
  node .build/redbridge-confirm-skip.mjs "$STATUS_JSON" >> "$LOG" 2>&1
  CONFIRM=$?
  if [ $CONFIRM -eq 3 ]; then
    log "skip confirmed; validating and rebuilding next-polls data"
    if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
      log "FAIL validate after skip-confirm; skipping slot"
      exit 1
    fi
    if ! refresh_site; then
      log "FAIL build after skip-confirm; skipping slot"
      exit 1
    fi
    git add data/polls.json "${SITE_FILES[@]}" || true
    stage_dataset
    SKIP_ISO="$(git diff --cached -U0 data/polls.json | grep -o '+ *"20[0-9-]*"' | tr -d '+ " ' | head -1)"
    MSG="Confirm skipped RedBridge/Accent slot $SKIP_ISO"
    if git diff --cached --quiet; then
      log "skip-confirm recorded slot $SKIP_ISO but nothing staged to commit; leaving tree for review"
      exit 1
    fi
    if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
      log "FAIL git commit after skip-confirm; no commit made"
      exit 1
    fi
    if push_main "$MSG" data/polls.json "${SITE_FILES[@]}"; then
      log "OK committed + pushed: $MSG"
    else
      log "FAIL git push (commit kept locally)"
    fi
  elif [ $CONFIRM -ne 0 ]; then
    log "skip-confirm refused (see above); human review needed"
  fi
  exit 0
fi

log "new RedBridge/Accent wave(s) detected; running validate/build/commit/push"

# Offline ride-along: the fresh redbridge-src caches may carry the wave's
# "effective sample size of N" APC line; stamp it (plus the wave's methodUrl)
# now so it reaches the site in this commit instead of waiting for the weekly
# sampleeff sweep. Failures abort before any commit like every other step.
SE_OUT="$(node .build/extract-sampleeff.mjs accent 2>&1)"
SE_CODE=$?
SE_LAST="$(echo "$SE_OUT" | tail -1)"
if [ $SE_CODE -ne 0 ]; then
  log "FAIL sampleeff-accent (exit $SE_CODE): $SE_LAST"
  exit $SE_CODE
fi
case "$SE_LAST" in
  SAMPLEEFF_STATUS*) log "sampleeff-accent: $SE_LAST" ;;
  *) log "FAIL sampleeff-accent (no SAMPLEEFF_STATUS line): $SE_LAST"; exit 1 ;;
esac

# The report's first-preference table by group joins data/demographics.json,
# and its issue tables data/issues.json, in this same commit (non-fatal; see refresh_crosstabs in git-push-main.sh).
refresh_crosstabs demographics issues

if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
  log "FAIL validate (errors above); no commit made"
  exit 1
fi
# Fresh build → gated share-card redraw → og restamp: refresh_site in
# git-push-main.sh owns the order render-card needs the page built first.
if ! refresh_site; then
  log "FAIL build; no commit made"
  exit 1
fi

FILES=(data/polls.json data/demographics.json data/issues.json .build/redbridge-src/ "${SITE_FILES[@]}")
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
MSG="Update RedBridge/Accent poll data $(date '+%Y-%m-%d')"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
