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
# SECOND DUTY (2026-10-02): this wrapper also refreshes the BludgerTrack
# comparator mirror (extract-bludgertrack.mjs -> data/bludgertrack-2pp.json).
# That series (ALP2out) back-casts every feed issue, so it rides these four
# daily fetches; mirrored from the same cached feed bytes the fallback just
# validated, best-effort (its failure only logs WARN and never blocks a run).
#
# THIRD DUTY (2026-10-02): freshen Kevin Bonham's published sidebar stamps
# (extract-bonham-sidebar.mjs -> data/bonham-2pp.json). The stamps only move
# when HE updates, so the extractor ran unscheduled until the hero key
# started quoting his published current figure - an unfreshened stamp now
# shows up as a wrong label on the front page. Its own fetch of his blog's
# monthly archive (the widget is sitewide); same best-effort contract as the
# BT mirror - a wobble logs WARN and can never fail the poll agent.
#
# Two commit shapes: (a) a filed/pruned row → the full site refresh, add-list
# as the other poll wrappers; (b) only the ledgers moved (a wave is newly
# pending, or the adjudicator wrote marks/verdicts) → the ledgers alone, no
# build. CI runners are fresh each run, so the ledgers MUST be committed or
# the grace period never elapses.
#
# FOURTH DUTY (2026-10-03): wave adjudication. The first extract pass runs
# with --adjudicate (a no-op unless MATILDA_API_KEY is in the environment —
# poll-agent.yml carries it, the laptop copies don't); when a judgement call
# (pending file-now-or-defer, mismatch same_wave-or-distinct) is emitted in
# status.ambiguous, .build/adjudicate.mjs asks the pinned CLI for a routing
# verdict and this wrapper re-runs the extractor once: with --decisions
# when the verdict was accepted, plain when it was rejected (deterministic
# rules — the plain clock). Verdict + ledger are committed as
# .build/pollbludger-src/{verdict,adjudicated}.json.
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

EXTRACT_OUT="$(node .build/extract-pollbludger.mjs --apply --adjudicate 2>&1)"
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

# Wave adjudication (see the header's FOURTH DUTY). --adjudicate on a
# key-less run emits no cases, so the grep below skips this entire block.
if echo "$LAST_LINE" | grep -q '"ambiguous":\[{'; then
  ADJ_STATUS_FILE="${TMPDIR:-/tmp}/pb-adjudicate-status.$$.json"
  echo "$LAST_LINE" | sed 's/^PB_STATUS //' > "$ADJ_STATUS_FILE"
  ADJ_OUT="$(node .build/adjudicate.mjs --house pollbludger --status-file "$ADJ_STATUS_FILE" --out .build/pollbludger-src/verdict.json 2>&1)"
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
  # ran:false (no CLI, no key at this layer) → waves stay held for this slot;
  # the asked marks already persisted, so the plain clock owns them after GRACE
  if [ -n "$RERUN" ]; then
    if [ "$RERUN" = verdict ]; then
      # the re-run keeps --apply AND --adjudicate: ledger persistence lives
      # inside APPLY, and a held wave the verdict defers must not leak out
      # through a plain-pass's grace check ahead of schedule
      EXTRACT_OUT="$(node .build/extract-pollbludger.mjs --apply --adjudicate --decisions .build/pollbludger-src/verdict.json 2>&1)"
    else
      EXTRACT_OUT="$(node .build/extract-pollbludger.mjs --apply 2>&1)"
    fi
    CODE=$?
    LAST_LINE="$(echo "$EXTRACT_OUT" | tail -1)"
    if [ $CODE -ne 0 ]; then
      log "FAIL extract re-run (exit $CODE): $LAST_LINE"
      exit $CODE
    fi
    case "$LAST_LINE" in
      PB_STATUS*) log "re-run $RERUN: $LAST_LINE" ;;
      *) log "FAIL extract re-run (no PB_STATUS line): $LAST_LINE"; exit 1 ;;
    esac
  fi
fi

# Comparator mirror: BludgerTrack's published 2PP trend (ALP2out) is
# re-issue wise back-cast, so it rides this wrapper's four daily fetches —
# the extract above just refreshed .build/pollbludger-src/current.xml, so
# mirror the same bytes rather than fetch twice. Best-effort on purpose:
# a comparator wobble must never take down a poll agent; a missed tick
# only bows the hero's overlay line until the next run.
BT_CHANGED=false
BT_OUT="$(node .build/extract-bludgertrack.mjs --apply --xml .build/pollbludger-src/current.xml 2>&1)"
BT_CODE=$?
BT_LINE="$(echo "$BT_OUT" | tail -1)"
if [ $BT_CODE -eq 0 ] && echo "$BT_LINE" | grep -q '^BT_STATUS'; then
  log "$BT_LINE"
  echo "$BT_LINE" | grep -q '"changed":true' && BT_CHANGED=true
else
  log "WARN bludgertrack comparator extract (exit $BT_CODE): $BT_LINE"
fi

# THIRD DUTY: Kevin Bonham's published sidebar stamps (its own fetch; see the
# header). Same best-effort contract — a comparator wobble only logs WARN.
KB_CHANGED=false
KB_OUT="$(node .build/extract-bonham-sidebar.mjs --apply 2>&1)"
KB_CODE=$?
KB_LINE="$(echo "$KB_OUT" | tail -1)"
if [ $KB_CODE -eq 0 ] && echo "$KB_LINE" | grep -q '^KB_STATUS'; then
  log "$KB_LINE"
  echo "$KB_LINE" | grep -q '"changed":true' && KB_CHANGED=true
else
  log "WARN bonham sidebar extract (exit $KB_CODE): $KB_LINE"
fi

# The ledgers this wrapper owns: the grace ledger, the adjudication ledger
# and the adjudicator's verdict file. Any of them can move without a poll
# row moving (a wave newly pending; asked marks; a defer/never_file verdict).
LEDGER_FILES=()
for f in .build/pollbludger-src/seen.json .build/pollbludger-src/adjudicated.json .build/pollbludger-src/verdict.json; do
  [ -f "$f" ] || continue
  if ! git diff --quiet -- "$f" || [ -n "$(git ls-files --others --exclude-standard -- "$f")" ]; then
    LEDGER_FILES+=("$f")
  fi
done

FILES=(data/polls.json "${LEDGER_FILES[@]}" "${SITE_FILES[@]}")

if ! echo "$LAST_LINE" | grep -q '"changed":true' && [ "$BT_CHANGED" = false ] && [ "$KB_CHANGED" = false ]; then
  # nothing filed or pruned, comparator tame — but a ledger may have gained a wave or a mark
  if [ ${#LEDGER_FILES[@]} -eq 0 ]; then
    exit 0
  fi
  log "fallback ledger(s) noted a pending wave / adjudication mark; committing them alone"
  git add "${LEDGER_FILES[@]}" || { log "FAIL git add ledger"; exit 1; }
  MSG="Note pending Poll Bludger fallback wave(s) $(date '+%Y-%m-%d')"
  git commit -m "$MSG" >> "$LOG" 2>&1 || { log "FAIL git commit"; exit 1; }
  push_main "$MSG" "${LEDGER_FILES[@]}" || exit 1
  log "OK committed + pushed: $MSG"
  exit 0
fi

if echo "$LAST_LINE" | grep -q '"changed":true'; then
  FILED="$(echo "$LAST_LINE" | sed 's/^PB_STATUS //' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const f=j.filed.map(x=>"filed "+x.pollster+" "+x.date),p=j.pruned.map(x=>"pruned "+x.pollster+" "+x.date),fa=(j.filedApproval||[]).map(x=>"filed ratings "+x.firm+" "+x.date),pa=(j.prunedApproval||[]).map(x=>"pruned ratings "+x.firm+" "+x.date);console.log([...f,...p,...fa,...pa].join("; "))})')"
else
  FILED="no poll rows"
fi
if [ "$BT_CHANGED" = true ]; then
  FILES+=(data/bludgertrack-2pp.json)
  FILED="$FILED; BludgerTrack comparator refresh"
fi
if [ "$KB_CHANGED" = true ]; then
  FILES+=(data/bonham-2pp.json)
  FILED="$FILED; Bonham sidebar refresh"
fi
log "change: $FILED; running validate/build/commit/push"
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
