#!/bin/bash
# Daily Ipsos Issues Monitor catch-up: extract-ipsos.mjs -> if it cached a new
# report or methodology statement -> issues.mjs -> validate -> render-card ->
# build -> commit -> push. Run in CI by ipsos-update.yml.
#
# Ipsos publishes no voting intention, so it has no house updater and no row
# in "Next expected polls": its monthly Issues Monitor feeds the Snapshot's
# issues panel alone. A report goes up about three weeks after its fieldwork
# closes, on no fixed weekday and mostly in the afternoon, and the panel
# counts Ipsos's newest poll for only part of each month – so this checks
# daily. The weekly crosstabs run, the only fetcher before 2026-09-26, would
# have picked 2026's reports up 2 to 7 days after they went up. That run
# still fetches Ipsos too, and stays the alarm for a month left unread
# (stale) and for Ipsos gone quiet (IP_QUIET_DAYS in issues.mjs).
#
# Nothing new cached: no rebuild, no commit – a no-op in seconds. A newly
# cached file is committed even when no figure moves, so the next run doesn't
# fetch it again. Two things fail the run, AFTER whatever did land is pushed:
#   - a page or PDF that didn't load: .build/classify-failure.mjs reads the
#     FAIL line (a 403 or a timeout is transient; a page that no longer links
#     a report is a defect);
#   - a newly fetched report whose month doesn't read cleanly, or that carries
#     an issue label no reader maps. Only the run that fetched it fails: the
#     next finds nothing new, and the weekly run keeps up the alarm.
#
# Every step logs one line to .build/logs/ipsos.log.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/ipsos.log"
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

OUT="$(node .build/extract-ipsos.mjs 2>&1)"
CODE=$?
LAST="$(echo "$OUT" | tail -1)"
case "$LAST" in
  IPSOS_STATUS*) ;;
  *) log "FAIL extract-ipsos (exit $CODE): $(node_error "$OUT")"; exit 1 ;;
esac
echo "$OUT" | grep '^cached ' | while IFS= read -r l; do log "extract-ipsos: $l"; done
log "$LAST"
# the first page or PDF that didn't load, if any: failed on below, once
# anything that did load has been pushed
WARN="$(node -e 'const s = JSON.parse(process.argv[1].replace(/^IPSOS_STATUS /, "")); console.log((s.warnings || [])[0] || "")' "$LAST")"

if [ -z "$(git status --porcelain -- .build/ipsos-src)" ]; then
  if [ -n "$WARN" ]; then
    log "FAIL extract-ipsos (exit 1): $WARN"
    exit 1
  fi
  exit 0
fi

ISS="$(node .build/issues.mjs 2>&1)"
CODE=$?
ILAST="$(echo "$ISS" | tail -1)"
case "$ILAST" in
  ISSUES_STATUS*) ;;
  *) [ $CODE -eq 0 ] && CODE=1 ;;
esac
if [ $CODE -ne 0 ]; then
  # nothing committed: the next run fetches the file again and retries
  log "FAIL issues (exit $CODE): $(node_error "$ISS")"
  exit 1
fi
echo "$ISS" | grep '^pending Ipsos\|^unknown label Ipsos' | while IFS= read -r l; do log "issues: $l"; done
log "$ILAST"
# Ipsos months left waiting, and Ipsos labels no reader maps. "quiet" is the
# weekly run's alarm, and can't be true of a run that just cached a file.
IPBAD="$(node -e '
  const s = JSON.parse(process.argv[1].replace(/^ISSUES_STATUS /, ""));
  const bad = [...(s.pending || []).filter((k) => k.startsWith("Ipsos|") && k !== "Ipsos|quiet"),
               ...(s.unknown || []).filter((u) => u.startsWith("Ipsos "))];
  console.log(bad.join("; "));' "$ILAST")"

if git diff --quiet -- data/issues.json; then
  # a statement or report that moves no figure (a month still waiting, or
  # dates that already matched): keep the file so it isn't fetched again
  FILES=(.build/ipsos-src)
  MSG="Cache Ipsos Issues Monitor files $(date '+%Y-%m-%d')"
else
  log "new Ipsos figures; running validate/build/commit/push"
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
  FILES=(data/issues.json .build/ipsos-src "${SITE_FILES[@]}")
  MSG="Update Ipsos Issues Monitor $(date '+%Y-%m-%d')"
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
if [ -n "$WARN" ] || [ -n "$IPBAD" ]; then
  [ -n "$WARN" ] && log "FAIL extract-ipsos (exit 1): $WARN"
  [ -n "$IPBAD" ] && log "FAIL issues (exit 1): new Ipsos report didn't read: $IPBAD (reasons in the issues lines above)"
  exit 1
fi
exit 0
