#!/bin/bash
# Scheduled Essential Report update: extract -> if the CSV changed -> validate
# -> render-card -> build -> commit -> push. Installed via launchd (plist copied to
# ~/Library/LaunchAgents/local.auspol.essential.plist from the copy in this
# directory). Every step logs one line to .build/logs/essential.log; any
# failure exits non-zero before any commit, leaving the working tree with just
# the extracted CSV for manual review.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/essential.log"
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

EXTRACT_OUT="$(node .build/extract-essential-report.mjs 2>&1)"
CODE=$?
LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  # exit 1 = fetch/parse, exit 2 = merge-shrink guard; either way stop before write-up
  log "FAIL extract (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  ESSENTIAL_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL extract (no ESSENTIAL_STATUS line): $LAST_LINE"; exit 1 ;;
esac

if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  exit 0
fi

log "changed rows detected; assimilating new VI waves into polls.json"
if ! node .build/assimilate-essential-vi.mjs --apply >> "$LOG" 2>&1; then
  log "FAIL assimilate (errors above); no commit made"
  exit 1
fi
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

# essential-src has no tracked files (the extractor writes the CSV directly);
# add it only if this run produced snapshots, so a fresh checkout doesn't fail
# the add with "pathspec did not match".
git add data/essential-report.csv data/polls.json index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json || { log "FAIL git add"; exit 1; }
[ -d .build/essential-src ] && git add .build/essential-src/ || true
MSG="Update Essential Report data $(date '+%Y-%m-%d')"
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
