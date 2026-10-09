#!/bin/bash
# EMRS (Tas) federal voting intentions: extract-emrs.mjs -> validate ->
# render-card -> build -> commit -> push. Run in CI by emrs-update.yml:
# every 20 minutes through weekday office hours (the dispatch clock), each
# run gated by `extract-emrs.mjs --probe` so a quiet one never reaches this
# script, plus one full run each evening.
#
# EMRS is a Tasmanian house whose quarterly omnibus carries a federal
# voting-intention battery in some waves: its reports appear on
# emrs.com.au/latest-news-and-results days after fieldwork closes, on no
# fixed weekday, in office hours, so those hours are combed; before this
# workflow existed the waves were hand-entered. The weekly crosstabs run
# runs the extractor too, and stays the alarm for the house gone quiet
# (QUIET_DAYS in extract-emrs.mjs — the observed federal cadence is
# ~6-monthly, not the PDF's "quarterly").
#
# Nothing new cached: no rebuild, no commit – a no-op in seconds. A newly
# cached report is committed even when no figure moves, so the next run
# doesn't fetch it again. Two things fail the run, AFTER whatever did land
# is pushed:
#   - a page or PDF that didn't load: .build/classify-failure.mjs reads the
#     FAIL line (a network blip is transient; a title layout that no longer
#     names a federal report is a defect);
#   - a cached report whose fieldwork line, federal chart or 2PP section
#     doesn't read cleanly (pending). The run that lands it fails; the
#     weekly run keeps the quiet alarm up meanwhile.
# A canon mismatch or a guard-tripping new wave exits the extractor 2 with
# EMRS_GUARD before anything is written; this script then fails
# immediately, and agent-repair gets the run.
#
# Every step logs one line to .build/logs/emrs.log.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/emrs.log"
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

OUT="$(node .build/extract-emrs.mjs 2>&1)"
CODE=$?
LAST="$(echo "$OUT" | tail -1)"
case "$LAST" in
  EMRS_STATUS*) ;;
  *) log "FAIL extract-emrs (exit $CODE): $(node_error "$OUT")"; exit 1 ;;
esac
echo "$OUT" | grep '^cached report ' | while IFS= read -r l; do log "extract-emrs: $l"; done
log "$LAST"
if [ "$CODE" -ne 0 ]; then
  # guard trips (canon moved, a new wave's figures failed the checks): the
  # extractor wrote nothing; the cache holds the evidence
  G="$(echo "$OUT" | grep '^EMRS_GUARD ' | tail -1 | cut -c1-400)"
  if [ -n "$G" ]; then log "FAIL extract-emrs (exit $CODE): $G"
  else log "FAIL extract-emrs (exit $CODE): $(node_error "$OUT")"; fi
  exit 1
fi
# the first page or PDF that didn't load, if any: failed on below
WARN="$(node -e 'const s = JSON.parse(process.argv[1].replace(/^EMRS_STATUS /, "")); console.log((s.warnings || [])[0] || "")' "$LAST")"
# a cached report that didn't read (its fieldwork line, chart or 2PP)
EMRSBAD="$(node -e 'const s = JSON.parse(process.argv[1].replace(/^EMRS_STATUS /, "")); console.log((s.pending || []).join("; "))' "$LAST")"

if [ -z "$(git status --porcelain -- .build/emrs-src data/polls.json)" ]; then
  if [ -n "$WARN" ] || [ -n "$EMRSBAD" ]; then
    [ -n "$WARN" ] && log "FAIL extract-emrs (exit 1): $WARN"
    [ -n "$EMRSBAD" ] && log "FAIL extract-emrs (exit 1): EMRS report didn't read: $EMRSBAD"
    exit 1
  fi
  exit 0
fi

if [ -z "$(git status --porcelain -- data/polls.json)" ]; then
  # a cached file that moves no figure: keep the file so it isn't fetched
  # again
  FILES=(.build/emrs-src)
  MSG="Cache EMRS federal report files $(date '+%Y-%m-%d')"
else
  log "new EMRS (Tas) federal figures; running validate/build/commit/push"
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
  FILES=(data/polls.json .build/emrs-src "${SITE_FILES[@]}")
  MSG="Update EMRS (Tas) federal poll $(date '+%Y-%m-%d')"
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
if [ -n "$WARN" ] || [ -n "$EMRSBAD" ]; then
  [ -n "$WARN" ] && log "FAIL extract-emrs (exit 1): $WARN"
  [ -n "$EMRSBAD" ] && log "FAIL extract-emrs (exit 1): EMRS report didn't read: $EMRSBAD"
  exit 1
fi
exit 0
