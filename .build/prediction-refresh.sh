#!/bin/bash
# Scheduled /prediction/ refresh: ff main -> regenerate (daily due gate — one
# record per Sydney date) -> if anything changed: sitemap -> commit -> push.
# Drives both the daily prediction-refresh.yml job and any manual run.
# Every step logs one line to .build/logs/prediction.log; any failure exits
# non-zero before any commit, leaving the working tree for manual review.
# Forcible outside the gate: bash .build/prediction-refresh.sh --force
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/prediction.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
. "$REPO/.build/git-push-main.sh"

FLAGS="--if-due"
for arg in "$@"; do
 case "$arg" in
 --force) FLAGS="--if-due --force" ;;
 --as-of=*) FLAGS="--if-due --force $arg" ;;
 *) log "FAIL unknown arg: $arg"; exit 2 ;;
 esac
done

# Another writer may push between local slots. Refresh first; give up cleanly
# if the tree isn't clean — the next daily slot retries.
if git diff --quiet && git diff --cached --quiet; then
 git fetch origin -q || true
 if ! git merge --ff-only origin/main >> "$LOG" 2>&1; then
 log "local main diverged from origin/main; skipping slot"
 exit 0
 fi
else
 log "working tree dirty; skipping freshness sync"
fi

OUT="$(node .build/refresh-prediction.mjs $FLAGS 2>&1)"
CODE=$?
LAST_LINE="$(echo "$OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
 log "FAIL refresh (exit $CODE): $LAST_LINE"
 exit $CODE
fi
case "$LAST_LINE" in
 PRED_STATUS*) log "$LAST_LINE" ;;
 *) log "FAIL refresh (no PRED_STATUS line): $LAST_LINE"; exit 1 ;;
esac

DUE=false CHANGED=false
echo "$LAST_LINE" | grep -q '"due":true' && DUE=true
echo "$LAST_LINE" | grep -q '"changed":true' && CHANGED=true
if ! $DUE || ! $CHANGED; then
 exit 0
fi

# The generator bumped PREDICTION_STAMP in build.mjs; only the sitemap depends
# on it, so regenerate that alone rather than the whole site. If prediction/
# ever gets folded into the main build the fold-in point is here.
if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
 log "FAIL validate before sitemap rebuild; no commit made"
 exit 1
fi
if ! node .build/newtracker/build.mjs >> "$LOG" 2>&1; then
 log "FAIL build (sitemap); no commit made"
 exit 1
fi

# Stamp + record date for the commit message
AS_OF="$(node -p 'JSON.parse(require("fs").readFileSync("data/prediction-history.json","utf8")).records.slice(-1)[0].asOf')"

FILES=(data/prediction-history.json prediction/index.html .build/newtracker/build.mjs sitemap.xml)
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
if git diff --cached --quiet; then
 log "nothing staged after refresh; no commit"
 exit 0
fi
MSG="Refresh re-election model read as at ${AS_OF}"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
 log "FAIL git commit"
 exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
 exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
