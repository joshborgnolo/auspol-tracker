#!/bin/bash
# Scheduled Roy Morgan federal-poll update: extract -> if polls.json changed ->
# validate -> render-card -> build -> commit -> push. Installed via launchd
# (plist copied to ~/Library/LaunchAgents/local.auspol.roymorgan.plist from
# the copy in this directory). Every step logs one line to .build/logs/roymorgan.log; any
# failure exits non-zero before any commit, leaving the working tree for
# manual review.
#
# ADJUDICATION (2026-10-03): the extract runs with --adjudicate (a no-op
# unless MATILDA_API_KEY is in the environment — poll-agent.yml carries it,
# the laptop copies don't). Judgement calls the heuristics punt on — double
# releases in one window (file_both / file_only+slug / never_file+slug) and
# reissues whose figures moved (heal_absent / escalate) — are emitted as
# cases in status.ambiguous and held; .build/adjudicate.mjs asks the pinned
# CLI for a routing verdict and this wrapper re-runs the extractor once
# with --decisions (or plain when a verdict was rejected). The verdict and
# the terminal ledger land in .build/roymorgan-src/{verdict,adjudicated}.json
# and are committed — including on runs where no poll row moved (mirrors
# the pollbludger wrapper's ledger-only shape).
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/roymorgan.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
. "$REPO/.build/git-push-main.sh"

# One repo-wide lock across all writing wrappers; freshness_sync (shared,
# with wedge recovery) replaces the inline ff-only block below.
acquire_slot_lock

# The GitHub Actions roymorgan-update job may push to main between local
# launchd slots. Refresh first; if the local tree can't fast-forward, skip
# this slot rather than commit on a stale base. A dirty tree means a human
# or a sibling agent is mid-edit: refresh must not record a commit that
# sweeps in unrelated unstaged changes, and the extractor must not write
# polls.json onto a base it did not read, so ABORT rather than skip-sync.
if git diff --quiet && git diff --cached --quiet; then
  freshness_sync || exit 0
else
  log "FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base"
  exit 1
fi

EXTRACT_OUT="$(node .build/extract-roymorgan.mjs --adjudicate 2>&1)"
CODE=$?
LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
if [ $CODE -ne 0 ]; then
  # exit 1 = fetch/parse, exit 2 = safety guard; either way stop before write-up
  log "FAIL extract (exit $CODE): $LAST_LINE"
  exit $CODE
fi
case "$LAST_LINE" in
  RM_STATUS*) log "$LAST_LINE" ;;
  *) log "FAIL extract (no RM_STATUS line): $LAST_LINE"; exit 1 ;;
esac

# Wave adjudication (see the header). --adjudicate on a key-less run emits
# no cases, so on the laptop the grep below skips this block entirely.
if echo "$LAST_LINE" | grep -q '"ambiguous":\[{'; then
  ADJ_STATUS_FILE="${TMPDIR:-/tmp}/rm-adjudicate-status.$$.json"
  echo "$LAST_LINE" | sed 's/^RM_STATUS //' > "$ADJ_STATUS_FILE"
  ADJ_OUT="$(node .build/adjudicate.mjs --house roymorgan --status-file "$ADJ_STATUS_FILE" --out .build/roymorgan-src/verdict.json 2>&1)"
  rm -f "$ADJ_STATUS_FILE"
  ADJ_LINE="$(echo "$ADJ_OUT" | tail -1)"
  case "$ADJ_LINE" in
    ADJ_STATUS*) log "$ADJ_LINE" ;;
    *) log "WARN adjudicate (no ADJ_STATUS line): $ADJ_LINE" ;;
  esac
  RERUN=""
  if echo "$ADJ_LINE" | grep -q '"applied":true'; then
    RERUN="verdict"
  elif echo "$ADJ_LINE" | grep -q '"ran":true'; then
    # the model answered but its verdict was rejected → deterministic path
    RERUN="plain"
  fi
  # ran:false → the ambiguous waves stay held for this slot; the asked marks
  # already persisted, so the ledger-only path below commits them
  if [ -n "$RERUN" ]; then
    if [ "$RERUN" = verdict ]; then
      EXTRACT_OUT="$(node .build/extract-roymorgan.mjs --adjudicate --decisions .build/roymorgan-src/verdict.json 2>&1)"
    else
      EXTRACT_OUT="$(node .build/extract-roymorgan.mjs 2>&1)"
    fi
    CODE=$?
    LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
    if [ $CODE -ne 0 ]; then
      log "FAIL extract re-run (exit $CODE): $LAST_LINE"
      exit $CODE
    fi
    case "$LAST_LINE" in
      RM_STATUS*) log "re-run $RERUN: $LAST_LINE" ;;
      *) log "FAIL extract re-run (no RM_STATUS line): $LAST_LINE"; exit 1 ;;
    esac
  fi
fi

if ! echo "$LAST_LINE" | grep -q '"changed":true'; then
  # no poll row moved — but the adjudication ledger or verdict file may have
  LEDGER_FILES=()
  for f in .build/roymorgan-src/adjudicated.json .build/roymorgan-src/verdict.json; do
    [ -f "$f" ] || continue
    if ! git diff --quiet -- "$f" || [ -n "$(git ls-files --others --exclude-standard -- "$f")" ]; then
      LEDGER_FILES+=("$f")
    fi
  done
  if [ ${#LEDGER_FILES[@]} -eq 0 ]; then
    exit 0
  fi
  log "adjudication ledger(s) moved; committing them alone"
  git add "${LEDGER_FILES[@]}" || { log "FAIL git add ledger"; exit 1; }
  MSG="Roy Morgan adjudication ledger $(date '+%Y-%m-%d')"
  if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
    log "FAIL git commit"
    exit 1
  fi
  if ! push_main "$MSG" "${LEDGER_FILES[@]}"; then
    exit 1
  fi
  log "OK committed + pushed: $MSG"
  exit 0
fi

log "new Roy Morgan wave(s) detected; running validate/build/commit/push"
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

FILES=(data/polls.json .build/roymorgan-src/ "${SITE_FILES[@]}")
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
MSG="Update Roy Morgan poll data $(date '+%Y-%m-%d')"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  log "FAIL git commit"
  exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
  exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
