#!/bin/bash
# Scheduled Poll Bludger fallback: extract-pollbludger.mjs --apply -> if a
# provisional row was filed or pruned -> validate -> build -> commit -> push.
# The LAST-RESORT poll agent: it files a wave from BludgerTrack's poll-data
# feed only after the wave has sat there, missing from polls.json, for the
# extractor's grace period — every house's own extractor gets its release
# window, follow-ups and next-day sweeps first. Runs from
# pollbludger-fallback.yml (poll-agent.yml reusable). Every step logs one
# line to .build/logs/pollbludger.log; any failure exits non-zero before any
# commit.
#
# Two commit shapes: (a) a filed/pruned row → the full site refresh, add-list
# as the other poll wrappers; (b) only the first-seen ledger moved (a wave
# is newly pending) → the ledger alone, no build. CI runners are fresh each
# run, so the ledger MUST be committed or the grace period never elapses.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
LOG_DIR=".build/logs"
LOG="$LOG_DIR/pollbludger.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }
. "$REPO/.build/git-push-main.sh"
acquire_slot_lock
if git diff --quiet && git diff --cached --quiet; then
  freshness_sync || exit 0
else
  log "FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base"
  exit 1
fi

EXTRACT_OUT="$(node .build/extract-pollbludger.mjs --apply 2>&1)"
CODE=$?
LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  # exit 1 = feed unreachable with no usable cache, exit 2 = feed failed a
  # shape guard; either way nothing was written
  log "FAIL extract (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  PB_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL extract (no PB_STATUS line): $LAST_LINE"; exit 1 ;;
esac

FILES=(data/polls.json .build/pollbludger-src/seen.json "${SITE_FILES[@]}")

if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  # nothing filed or pruned — but the grace ledger may have gained a wave
  if git diff --quiet -- .build/pollbludger-src/seen.json && [ -z "$(git ls-files --others --exclude-standard .build/pollbludger-src/seen.json)" ]; then
    exit 0
  fi
  log "pending fallback wave(s) noted in the first-seen ledger; committing the ledger alone"
  git add .build/pollbludger-src/seen.json || { log "FAIL git add ledger"; exit 1; }
  MSG="Note pending Poll Bludger fallback wave(s) $(date '+%Y-%m-%d')"
  git commit -m "$MSG" >> "$LOG" 2>&1 || { log "FAIL git commit"; exit 1; }
  push_main "$MSG" .build/pollbludger-src/seen.json || exit 1
  log "OK committed + pushed: $MSG"
  exit 0
fi

FILED="$(echo "$LAST_LINE" | sed 's/^PB_STATUS //' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const f=j.filed.map(x=>"filed "+x.pollster+" "+x.date),p=j.pruned.map(x=>"pruned "+x.pollster+" "+x.date),fa=(j.filedApproval||[]).map(x=>"filed ratings "+x.firm+" "+x.date),pa=(j.prunedApproval||[]).map(x=>"pruned ratings "+x.firm+" "+x.date);console.log([...f,...p,...fa,...pa].join("; "))})')"
log "fallback change: $FILED; running validate/build/commit/push"
if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
  log "FAIL validate (errors above); no commit made"
  exit 1
fi
if ! refresh_site; then
  log "FAIL build; no commit made"
  exit 1
fi
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
MSG="Poll Bludger fallback: $FILED"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
