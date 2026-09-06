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
. "$REPO/.build/git-push-main.sh"

# One repo-wide lock across all writing wrappers; freshness_sync (shared,
# with wedge recovery) replaces the inline ff-only block below.
acquire_slot_lock

# The GitHub Actions newspoll-update job may push to main between local
# launchd slots. Refresh first; if the local tree can't fast-forward, skip
# this slot rather than commit on a stale base. (Same guard as the migrated
# siblings — required before the two schedules can coexist.) A dirty tree
# means a human or a sibling agent is mid-edit: refresh must not record a
# commit that sweeps in unrelated unstaged changes, and the extractor must
# not write polls.json onto a base it did not read, so ABORT rather than
# skip-sync.
if git diff --quiet && git diff --cached --quiet; then
  freshness_sync || exit 0
else
  log "FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base"
  exit 1
fi

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
# Fresh build → gated share-card redraw → og restamp: refresh_site in
# git-push-main.sh owns the order render-card needs the page built first.
if ! refresh_site; then
  log "FAIL build; no commit made"
  exit 1
fi

git add data/polls.json .build/newspoll-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json assets/auspol-latest.json || { log "FAIL git add"; exit 1; }
MSG="Update Newspoll data $(date '+%Y-%m-%d')"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" data/polls.json .build/newspoll-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json assets/auspol-latest.json; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
