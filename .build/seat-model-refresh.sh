#!/bin/bash
# Daily election-model run (/model/ and the More menu's Election model line):
# ff main -> node .build/model/refresh.mjs (re-runs only when the polls or
# another model input moved) -> if it ran: validate -> refresh_site (main +
# vic builds, asset-ref check) -> commit -> push.
# Drives the seat-model-refresh.yml job (dispatch clock slot + cron twin) and
# any manual run. Every step logs one line to .build/logs/seat-model.log; any
# failure exits non-zero before a commit, leaving the tree for review.
# Forcible past the gate: bash .build/seat-model-refresh.sh --force
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/seat-model.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
. "$REPO/.build/git-push-main.sh"

FLAGS=""
for arg in "$@"; do
  case "$arg" in
    --force) FLAGS="--force" ;;
    *) log "FAIL unknown arg: $arg"; exit 2 ;;
  esac
done

# A dirty tree means a human or another job is mid-edit: the model's writes
# must not land on a base it did not read. The next slot retries.
if git diff --quiet && git diff --cached --quiet; then
  if ! freshness_sync; then
    exit 0
  fi
else
  log "FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base"
  exit 1
fi

OUT="$(node .build/model/refresh.mjs $FLAGS 2>>"$LOG")"
CODE=$?
LAST_LINE="$(echo "$OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  log "FAIL model refresh (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  MODEL_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL model refresh (no MODEL_STATUS line): $LAST_LINE"; exit 1 ;;
esac
echo "$LAST_LINE"
if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  exit 0
fi

if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
  log "FAIL validate after the model run; no commit made"
  exit 1
fi
# the More menu quotes the run (gen-data reads the nowcast) and the sitemap
# dates /model/ by it, so the site is rebuilt like any data refresh
if ! refresh_site; then
  log "FAIL build; no commit made"
  exit 1
fi

POLLS_TO="$(node -p 'JSON.parse(require("fs").readFileSync("data/seat-vote-layer.json","utf8")).diagnostics.recentWindow.to')"
FILES=(data/seat-vote-layer.json data/seat-model-2028-nowcast.json data/seat-model-2028-forecast.json
  data/seat-model-2028-history.jsonl model "${SITE_FILES[@]}")
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
if git diff --cached --quiet; then
  log "nothing staged after the model run; no commit"
  exit 0
fi
MSG="Election model: daily run on the polls to ${POLLS_TO}"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
