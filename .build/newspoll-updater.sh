#!/bin/bash
# Scheduled Newspoll update: extract -> if polls.json changed ->
# validate -> render-card -> build -> commit -> push. Installed via launchd
# (plist copied to ~/Library/LaunchAgents/local.auspol.newspoll.plist from
# the copy in this directory). Every step logs one line to
# .build/logs/newspoll.log; any
# failure exits non-zero before any commit, leaving the working tree for
# manual review.
#
# NEWSIE_CHROME=1 IS enabled on the laptop (2026-10-04): the extractor reads
# The Australian's own story through the user's logged-in Chrome when the
# plain fetch and archive.md are walled (archive.md was unusable for the
# 2026-09-17 wave). It was held back on the belief that a scheduled job
# could not answer macOS's Automation consent; the News24 job disproved that
# on 2026-08-30 (see news24-updater.sh) and the RedBridge AFR-chart step
# relies on the same consent. Without Chrome (CI, Chrome logged out) the
# extractor degrades to the free outlets, exactly as before.
#
# Figures are read by Matilda with every citation verified
# (newspoll-read.mjs; the regex parser is the fallback when Matilda is
# unavailable), so the Chrome read now yields a full release on its own.
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

if [ "$(uname)" = Darwin ] && [ -z "${CI:-}" ]; then export NEWSIE_CHROME=1; fi
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

FILES=(data/polls.json .build/newspoll-src/ "${SITE_FILES[@]}")
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
MSG="Update Newspoll data $(date '+%Y-%m-%d')"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
