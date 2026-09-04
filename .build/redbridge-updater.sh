#!/bin/bash
# Scheduled RedBridge/Accent federal-poll update: extract -> if polls.json
# changed -> stamp the wave's sampleEff/methodUrl off the fresh redbridge-src
# caches (extract-sampleeff.mjs accent, offline) -> validate -> render-card ->
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

# GitHub Actions may push to main between local launchd slots. Refresh first;
# if the local tree can't fast-forward, skip this slot rather than commit on a
# stale base. Untracked files don't count as dirty.
if git diff --quiet && git diff --cached --quiet; then
  git fetch origin -q || true
  if ! git merge --ff-only origin/main >> "$LOG" 2>&1; then
    log "local main diverged from origin/main; skipping slot"
    exit 0
  fi
else
  log "working tree dirty; skipping freshness sync"
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

if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
  log "FAIL validate (errors above); no commit made"
  exit 1
fi
# Best-effort card redraw: headless Chrome is flakier than the node steps,
# so a miss warns (and build.mjs prints its stale-card line) instead of
# blocking the commit over a social-preview image.
if ! node .build/newtracker/render-card.mjs >> "$LOG" 2>&1; then
  log "WARN render-card failed; shipping with the previous card"
  echo "::warning::render-card failed; shipped the previous card"
fi
if ! node .build/newtracker/build.mjs >> "$LOG" 2>&1; then
  log "FAIL build; no commit made"
  exit 1
fi

git add data/polls.json .build/redbridge-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json || { log "FAIL git add"; exit 1; }
MSG="Update RedBridge/Accent poll data $(date '+%Y-%m-%d')"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! git push origin HEAD:main >> "$LOG" 2>&1; then
  log "FAIL git push (commit kept locally)"
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
