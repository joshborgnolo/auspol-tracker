#!/bin/bash
# Daily SEC Newgate "Mood of the Nation" catch-up: extract-secnewgate.mjs
# -> validate -> render-card -> build -> commit -> push. Run in CI by
# secnewgate-update.yml.
#
# SEC Newgate publishes no voting intention. Its bi-monthly Mood of the
# Nation tracking study asks the national-direction question (right
# direction / wrong track) and feeds the National-direction panel alone –
# no house row in "Next expected polls". A report goes up within days of
# its fieldwork closing, on no fixed weekday, so this checks daily; before
# this workflow existed there was no fetcher at all. The weekly crosstabs
# run runs the extractor too, and stays the alarm for the house gone quiet
# (QUIET_DAYS in extract-secnewgate.mjs).
#
# Nothing new cached: no rebuild, no commit – a no-op in seconds. A newly
# cached report PDF is committed even when no figure moves (a re-hosted
# variant of a wave already on file), so the next run doesn't fetch it
# again. Two things fail the run, AFTER whatever did land is pushed:
#   - a page or PDF that didn't load: .build/classify-failure.mjs reads the
#     FAIL line (a 403 or a timeout is transient; a search that no longer
#     finds the reports is a defect);
#   - a cached report whose methodology page or direction chart doesn't
#     read cleanly (pending). The run that lands it fails; the weekly run
#     keeps the quiet alarm up meanwhile.
#
# Every step logs one line to .build/logs/secnewgate.log.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/secnewgate.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }
. "$REPO/.build/git-push-main.sh"

# One repo-wide lock across all writing wrappers; freshness_sync (shared,
# with wedge recovery) refreshes onto origin/main first.
acquire_slot_lock

# A dirty tree means a human or a sibling agent is mid-edit: never write
# onto a base these scripts did not read.
if git diff --quiet && git diff --cached --quiet; then
  freshness_sync || exit 0
else
  log "FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base"
  exit 1
fi

OUT="$(node .build/extract-secnewgate.mjs 2>&1)"
CODE=$?
LAST="$(echo "$OUT" | tail -1)"
case "$LAST" in
  SECNEWGATE_STATUS*) ;;
  *) log "FAIL extract-secnewgate (exit $CODE): $(node_error "$OUT")"; exit 1 ;;
esac
echo "$OUT" | grep '^cached report ' | while IFS= read -r l; do log "extract-secnewgate: $l"; done
log "$LAST"
# the first page or PDF that didn't load, if any: failed on below
WARN="$(node -e 'const s = JSON.parse(process.argv[1].replace(/^SECNEWGATE_STATUS /, "")); console.log((s.warnings || [])[0] || "")' "$LAST")"
# a cached report that didn't read (its methodology page or its chart)
SECBAD="$(node -e 'const s = JSON.parse(process.argv[1].replace(/^SECNEWGATE_STATUS /, "")); console.log((s.pending || []).join("; "))' "$LAST")"

if [ -z "$(git status --porcelain -- .build/secnewgate-src data/polls.json)" ]; then
  if [ -n "$WARN" ] || [ -n "$SECBAD" ]; then
    [ -n "$WARN" ] && log "FAIL extract-secnewgate (exit 1): $WARN"
    [ -n "$SECBAD" ] && log "FAIL extract-secnewgate (exit 1): SEC Newgate report didn't read: $SECBAD"
    exit 1
  fi
  exit 0
fi

if [ -z "$(git status --porcelain -- data/polls.json)" ]; then
  # a cached file that moves no figure (a wave's re-hosted variant): keep
  # the file so it isn't fetched again
  FILES=(.build/secnewgate-src)
  MSG="Cache SEC Newgate Mood of the Nation files $(date '+%Y-%m-%d')"
else
  log "new SEC Newgate direction figures; running validate/build/commit/push"
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
  FILES=(data/polls.json .build/secnewgate-src "${SITE_FILES[@]}")
  MSG="Update SEC Newgate Mood of the Nation $(date '+%Y-%m-%d')"
fi
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
  exit 1
fi
log "OK committed + pushed: $MSG"

# The alarms, last: the classifier reads the LAST FAIL line, and a report
# that didn't read is the defect to name over a page that didn't load.
if [ -n "$WARN" ] || [ -n "$SECBAD" ]; then
  [ -n "$WARN" ] && log "FAIL extract-secnewgate (exit 1): $WARN"
  [ -n "$SECBAD" ] && log "FAIL extract-secnewgate (exit 1): SEC Newgate report didn't read: $SECBAD"
  exit 1
fi
exit 0
