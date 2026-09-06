#!/bin/bash
# Scheduled Resolve Political Monitor update: extract -> if the CSV changed ->
# validate -> render-card -> build -> commit -> push. Installed via launchd
# (plist copied to ~/Library/LaunchAgents/local.auspol.resolve-rpm.plist from
# the copy in this
# directory). Every step logs one line to .build/logs/resolve-rpm.log; any
# failure exits non-zero before any commit, leaving the working tree with just
# the extracted CSV for manual review.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/resolve-rpm.log"
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

EXTRACT_OUT="$(node .build/extract-resolve-rpm.mjs 2>&1)"
CODE=$?
LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  # exit 1 = fetch/parse, exit 2 = safety guard; either way stop before write-up
  log "FAIL extract (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  RPM_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL extract (no RPM_STATUS line): $LAST_LINE"; exit 1 ;;
esac

if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  exit 0
fi

log "changed rows detected; assimilating new VI waves into polls.json"
if ! node .build/assimilate-resolve-vi.mjs --apply >> "$LOG" 2>&1; then
  log "FAIL assimilate (errors above); no commit made"
  exit 1
fi
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

git add data/resolve-political-monitor.csv data/polls.json .build/resolve-rpm-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json assets/auspol-latest.json || { log "FAIL git add"; exit 1; }
MSG="Update Resolve monitor data $(date '+%Y-%m-%d')"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" data/resolve-political-monitor.csv data/polls.json .build/resolve-rpm-src/ index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json assets/auspol-latest.json; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
