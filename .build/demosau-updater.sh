#!/bin/bash
# Scheduled DemosAU federal-poll update: extract -> if polls.json changed ->
# validate -> render-card -> build -> commit -> push. Installed via launchd
# (plist copied to ~/Library/LaunchAgents/local.auspol.demosau.plist from
# the copy in this directory). Every step logs one line to
# .build/logs/demosau.log; any
# failure exits non-zero before any commit, leaving the working tree for
# manual review.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/demosau.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }
. "$REPO/.build/git-push-main.sh"

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
  # No new wave: give the skip-confirm a go. It verifies — from the
  # extractor's own status emitted a moment ago, not a cached state file —
  # that the publisher's newest wave predates a passed slot MONTH and that
  # it's at least 5am Sydney the day after the measured window closed; exit 3
  # means a month got recorded in pollsterRules.skippedMonths, which then
  # needs a rebuild and a commit like any other data change. Anything else is
  # a silent no-op.
  STATUS_JSON="${LAST_LINE#DEMOSAU_STATUS }"
  node .build/demosau-confirm-skip.mjs "$STATUS_JSON" >> "$LOG" 2>&1
  CONFIRM=$?
  if [ $CONFIRM -eq 3 ]; then
    log "skip confirmed; validating and rebuilding next-polls data"
    if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
      log "FAIL validate after skip-confirm; skipping slot"
      exit 1
    fi
    if ! node .build/newtracker/build.mjs >> "$LOG" 2>&1; then
      log "FAIL build after skip-confirm; skipping slot"
      exit 1
    fi
    git add data/polls.json index.html assets/ feed.xml sitemap.xml robots.txt || true
    SKIP_YM="$(git diff --cached -U0 data/polls.json | grep -o '+ *"20[0-9-]*"' | tr -d '+ " ' | head -1)"
    MSG="Confirm skipped DemosAU slot month $SKIP_YM"
    git commit -m "$MSG" >> "$LOG" 2>&1 || true
    push_main "$MSG" data/polls.json index.html assets/ feed.xml sitemap.xml robots.txt \
      || log "FAIL git push (commit kept locally)"
    log "OK committed + pushed: $MSG"
  elif [ $CONFIRM -ne 0 ]; then
    log "skip-confirm refused (see above); human review needed"
  fi
  exit 0
fi

log "new DemosAU wave(s) detected; running validate/build/commit/push"
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

git add data/polls.json .build/demosau-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json || { log "FAIL git add"; exit 1; }
MSG="Update DemosAU poll data $(date '+%Y-%m-%d')"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" data/polls.json .build/demosau-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
