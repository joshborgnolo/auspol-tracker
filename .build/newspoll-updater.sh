#!/bin/bash
# Scheduled Newspoll update: extract -> if polls.json changed ->
# validate -> render-card -> build -> commit -> push. Installed via launchd
# (plist copied to ~/Library/LaunchAgents/local.auspol.newspoll.plist from
# the copy in this directory). Every step logs one line to
# .build/logs/newspoll.log; any
# failure exits non-zero before any commit, leaving the working tree for
# manual review.
#
# The extractor's NEWSIE_CHROME=1 Chrome-session fallback (drives the user's
# logged-in Chrome via AppleScript to read paywalled theaustralian.com.au
# stories) is intentionally NOT enabled here: it needs Chrome running/logged
# in, the "Allow JavaScript from Apple Events" toggle, and a one-time macOS
# Automation consent prompt — interactive rescue only, run the extractor by
# hand with NEWSIE_CHROME=1 when archive.md is down.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/newspoll.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

EXTRACT_OUT="$(node .build/extract-newspoll.mjs 2>&1)"
CODE=$?
LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  # exit 1 = fetch/parse, exit 2 = safety guard; either way stop before write-up
  log "FAIL extract (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  NP_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL extract (no NP_STATUS line): $LAST_LINE"; exit 1 ;;
esac

if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  exit 0
fi

log "new Newspoll release(s) detected; running validate/build/commit/push"
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

git add data/polls.json .build/newspoll-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json || { log "FAIL git add"; exit 1; }
MSG="Update Newspoll data $(date '+%Y-%m-%d')"
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
