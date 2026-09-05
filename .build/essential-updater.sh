#!/bin/bash
# Scheduled Essential Report update: extract -> assimilate (new waves when the
# CSV changed; retro-fill of late-arriving fields — e.g. a wave's releaseUrl
# once Essential publishes the release page after the charts — when the
# extractor reports the report index drifted) -> if anything changed ->
# validate -> render-card -> build -> commit -> push. Installed via launchd
# (plist copied to ~/Library/LaunchAgents/local.auspol.essential.plist from
# the copy in this directory). Every step logs one line to
# .build/logs/essential.log; any failure exits non-zero before any commit,
# leaving the working tree with just the extracted CSV for manual review.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/essential.log"
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

# Runs the assimilator, teeing output to the log. Sets ASSIM_LAST to the
# run's ASSIMILATE_STATUS line; non-zero return means failure (already
# logged). A no-op run writes nothing (no CSV rewrite, no proof-file
# timestamp churn), so it can run on index drift without dirtying the tree
# for the cleanliness pre-flight above.
run_assimilator() {
  ASSIM_OUT="$(node .build/assimilate-essential-vi.mjs --apply 2>&1)"
  local code=$?
  echo "$ASSIM_OUT" >> "$LOG"
  if [ $code -ne 0 ]; then
    log "FAIL assimilate (exit $code); no commit made"
    return $code
  fi
  ASSIM_LAST="$(echo "$ASSIM_OUT" | tail -1)"
  case "$ASSIM_LAST" in
    ASSIMILATE_STATUS*) log "$ASSIM_LAST"; return 0 ;;
    *) log "FAIL assimilate (no ASSIMILATE_STATUS line): $ASSIM_LAST"; return 1 ;;
  esac
}

# Two data-change triggers: a changed CSV (a new wave has landed), or a
# drifted report index (Essential published the wave's release page after
# the charts updated, so retro-fill can now complete the row). Retro-fill is
# gated on the extractor's actual index-rewrite line rather than run every
# slot — there is no other between-waves data source, and the gating keeps
# the wrapper's log honest about why the assimilator ran.
DATA_CHANGED=false
MSG="Update Essential Report data $(date '+%Y-%m-%d')"
if echo "$LAST_LINE" | grep -q '"changed":true'; then
  log "changed rows detected; assimilating new VI waves into polls.json"
  run_assimilator || exit 1
  DATA_CHANGED=true
elif echo "$EXTRACT_OUT" | grep -q '^updated .*report-index\.json'; then
  log "report index drifted; running assimilator retro-fill"
  run_assimilator || exit 1
  if echo "$ASSIM_LAST" | grep -q '"changed":true'; then
    DATA_CHANGED=true
    MSG="Retro-fill late-arriving Essential fields $(date '+%Y-%m-%d')"
  else
    # No row needed the drift (e.g. a slug rename, or a record for a wave
    # outside the curated horizon): nothing to rebuild, but commit the
    # refreshed index so the tree is clean for the next slot's pre-flight
    # and other machines get the provenance.
    git add .build/essential-src/report-index.json
    IDX_MSG="Refresh Essential report index $(date '+%Y-%m-%d')"
    if git commit -m "$IDX_MSG" >> "$LOG" 2>&1; then
      push_main "$IDX_MSG" .build/essential-src/report-index.json \
        || log "FAIL git push (commit kept locally)"
      log "OK committed + pushed: $IDX_MSG"
    else
      log "index commit produced nothing; carrying on"
    fi
  fi
fi

if [ "$DATA_CHANGED" = false ]; then
  # No new CSV wave and no retro-fill changes: give the skip-confirm a go.
  # It verifies — from the
  # extractor's own status emitted a moment ago, not a cached state file —
  # that the publisher's newest report predates a passed projection slot and
  # that it's at least 5am Sydney the day after; exit 3 means a slot got
  # recorded in pollsterRules.skippedSlots, which then needs a rebuild and a
  # commit like any other data change. Anything else is a silent no-op.
  STATUS_JSON="${LAST_LINE#ESSENTIAL_STATUS }"
  node .build/essential-confirm-skip.mjs "$STATUS_JSON" >> "$LOG" 2>&1
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
    SKIP_ISO="$(git diff --cached -U0 data/polls.json | grep -o '+ *"20[0-9-]*"' | tr -d '+ " ' | head -1)"
    MSG="Confirm skipped Essential slot $SKIP_ISO"
    git commit -m "$MSG" >> "$LOG" 2>&1 || true
    push_main "$MSG" data/polls.json index.html assets/ feed.xml sitemap.xml robots.txt \
      || log "FAIL git push (commit kept locally)"
    log "OK committed + pushed: $MSG"
  elif [ $CONFIRM -ne 0 ]; then
    log "skip-confirm refused (see above); human review needed"
  fi
  exit 0
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
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
ESS_FILES=(data/essential-report.csv data/polls.json index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json)
[ -d .build/essential-src ] && ESS_FILES+=(.build/essential-src/)
if ! push_main "$MSG" "${ESS_FILES[@]}"; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
