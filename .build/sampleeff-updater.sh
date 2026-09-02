#!/bin/bash
# Scheduled effective-sample-size update: extract-sampleeff -> if polls.json
# changed -> validate -> render-card -> build -> commit -> push. Statement
# sources change slowly (statements post with releases and stay put), so this
# runs weekly. Installed locally via launchd like the other house jobs, and
# in CI by sampleeff-update.yml. Every step logs one line to
# .build/logs/sampleeff.log; any failure exits non-zero before any commit,
# leaving the working tree for manual review.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/sampleeff.log"
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

EXTRACT_OUT="$(node .build/extract-sampleeff.mjs 2>&1)"
CODE=$?
LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  # exit 1 = fetch/parse, exit 2 = a guard tripped on a candidate value
  log "FAIL extract (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  SAMPLEEFF_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL extract (no SAMPLEEFF_STATUS line): $LAST_LINE"; exit 1 ;;
esac

if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  # Nothing new stamped: no rebuild, no commit. Rows still on the derived
  # convention stay there until the house's own statement shows up.
  exit 0
fi

log "new sampleEff stamp(s); running validate/build/commit/push"
if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
  log "FAIL validate (errors above); no commit made"
  exit 1
fi
# Best-effort card redraw: headless Chrome is flakier than the node steps,
# so a miss warns instead of blocking the commit over a social-preview image.
if ! node .build/newtracker/render-card.mjs >> "$LOG" 2>&1; then
  log "WARN render-card failed; shipping with the previous card"
fi
if ! node .build/newtracker/build.mjs >> "$LOG" 2>&1; then
  log "FAIL build; no commit made"
  exit 1
fi

git add data/polls.json .build/sampleeff-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json || { log "FAIL git add"; exit 1; }
# gen-data reweights from sampleEff where present, so the derived dataset and
# every inlined script can move too
git add assets/ >> "$LOG" 2>&1 || { log "FAIL git add assets"; exit 1; }
MSG="Update effective sample sizes $(date '+%Y-%m-%d')"
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
