#!/bin/bash
# Weekly crosstabs catch-up: vote-switching.mjs + demographics.mjs -> if
# either file changed -> validate -> render-card -> build -> commit -> push.
# Run in CI by crosstabs-update.yml.
#
# Every YouGov/News24, DemosAU, RedBridge and Resolve update already reads
# its own wave's tables (refresh_crosstabs in git-push-main.sh), so most
# weeks this is a no-op. It exists for what those runs leave pending: a
# chart id the laptop's Chrome run records after the CI run, a report PDF a
# fetch didn't get, a table that didn't read cleanly. And it is the alarm
# for anything that stays unread: a wave still pending STALE_DAYS after its
# fieldwork closed (listed as `stale` in the scripts' status lines) fails
# the run – after committing whatever did land – so the failure email and
# agent-repair (.build/crosstabs-repair-prompt.md) take it from there. So
# does a group demographics.mjs lists as `dropped` (a house's newest wave
# missing a group it printed two waves running: a renamed column or chart
# the reader no longer finds, or a house that stopped). A script that
# doesn't finish fails the run the same way.
#
# Every step logs one line to .build/logs/crosstabs.log.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/crosstabs.log"
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

CHANGED=false
UNFINISHED=""
STALE=""
DROPPED=""
for b in vote-switching demographics; do
  OUT="$(node ".build/$b.mjs" 2>&1)"
  CODE=$?
  LAST="$(echo "$OUT" | tail -1)"
  echo "$OUT" | grep '^\(pending\|dropped\) ' | while IFS= read -r l; do log "$b: $l"; done
  case "$LAST" in
    VS_STATUS*|DEMO_STATUS*) ;;
    *) [ $CODE -eq 0 ] && CODE=1 ;;
  esac
  if [ $CODE -ne 0 ]; then
    log "FAIL $b (exit $CODE): $(node_error "$OUT")"
    UNFINISHED="$UNFINISHED $b"
    continue
  fi
  log "$LAST"
  if echo "$LAST" | grep -q '"changed":true'; then CHANGED=true; fi
  S="$(echo "$LAST" | sed -n 's/.*"stale":\[\([^]]*\)\].*/\1/p')"
  if [ -n "$S" ]; then STALE="$STALE $b: $S"; fi
  D="$(echo "$LAST" | sed -n 's/.*"dropped":\[\([^]]*\)\].*/\1/p')"
  if [ -n "$D" ]; then DROPPED="$DROPPED $b: $D"; fi
done

if $CHANGED; then
  log "crosstab tables changed; running validate/build/commit/push"
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
  git add data/vote-switching.json data/demographics.json index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json assets/auspol-latest.json assets/favicon.svg assets/favicon-192.png assets/favicon-192.json || { log "FAIL git add"; exit 1; }
  MSG="Update crosstab tables $(date '+%Y-%m-%d')"
  if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
    log "FAIL git commit"
    exit 1
  fi
  if ! push_main "$MSG" data/vote-switching.json data/demographics.json index.html feed.xml sitemap.xml robots.txt assets/auspol-card.png assets/auspol-card.json assets/auspol-latest.json assets/favicon.svg assets/favicon-192.png assets/favicon-192.json; then
    exit 1
  fi
  log "OK committed + pushed: $MSG"
fi

if [ -n "$UNFINISHED" ]; then
  log "FAIL did not finish:$UNFINISHED (output above)"
  echo "::error::crosstab script(s) did not finish:$UNFINISHED"
  exit 1
fi
if [ -n "$STALE" ]; then
  log "FAIL stale – waves still unread long after fieldwork closed:$STALE (reasons in the pending lines above)"
  echo "::error::crosstab tables still unread:$STALE"
  exit 1
fi
if [ -n "$DROPPED" ]; then
  log "FAIL dropped – groups missing from a house's newest wave:$DROPPED (fix the reader, or record a real stop in KNOWN_DROP)"
  echo "::error::crosstab groups dropped:$DROPPED"
  exit 1
fi
exit 0
