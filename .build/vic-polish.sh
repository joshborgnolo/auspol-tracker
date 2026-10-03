#!/usr/bin/env bash
# vic-polish wrapper — runs the review loop in its OWN clone, never the
# checkout people work in (the launchd-clone precedent and the reason for
# it: push_main's conflict rungs do `git reset --hard`, and the writers
# lock's dirty-guard assumes a nobody-edits runner clone).
#
#   bash .build/vic-polish.sh [--rounds=N] [--hours=N] [--no-push] [...]
# Args pass straight through to .build/vic-polish.mjs. Overnight form:
#   bash .build/vic-polish.sh --rounds=8 --hours=8
#
# The clone lives at ${AUSPOL_POLISH_HOME:-~/Library/Application Support/
# auspol-polish}/repo and is cloned from origin on first use. A one-line
# summary is appended to THIS checkout's .build/logs/vic-polish.log.
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
MAIN_REPO=$(cd "$HERE/.." && pwd)
CLONE_HOME="${AUSPOL_POLISH_HOME:-$HOME/Library/Application Support/auspol-polish}"
CLONE="$CLONE_HOME/repo"

if ! [ -d "$CLONE/.git" ]; then
  url=$(git -C "$MAIN_REPO" remote get-url origin) || exit 1
  echo "vic-polish: cloning $url -> $CLONE"
  mkdir -p "$CLONE_HOME"
  git clone -q "$url" "$CLONE" || { echo "vic-polish: clone failed"; exit 1; }
fi

cd "$CLONE" || exit 1
git fetch -q origin || echo "vic-polish: WARN fetch failed (offline?); continuing on local state"

# Dead-run leftovers are disposable in the runner clone; unpushed commits
# are NOT dirt (they ride the next push_main).
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "vic-polish: runner clone had uncommitted leftovers; discarding"
  git reset -q --hard HEAD
fi
if ! git pull -q --rebase origin main; then
  # Can't advance cleanly (rare: data conflict vs unpushed round commits):
  # stay where we are — push_main's own rungs do the rebasing on the push.
  git rebase --abort 2>/dev/null || true
  echo "vic-polish: WARN could not rebase onto origin/main; continuing on current HEAD"
fi

REPO="$CLONE"
LOG_DIR="$CLONE/.build/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/vic-polish.log"
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >>"$LOG"; }
export AUSPOL_RUNNER_CLONE=1
source .build/git-push-main.sh
acquire_slot_lock

log "vic-polish start: $*"
command -v node >/dev/null 2>&1 || { log "FAIL no node on PATH"; echo "vic-polish: node not found on PATH"; exit 1; }

# Full output streams to the clone log; the status line is the last
# VPOLISH_STATUS the orchestrator emitted (it always finishes with one).
node .build/vic-polish.mjs --repo "$CLONE" "$@" | tee -a "$LOG"
STATUS_LINE=$(grep '^VPOLISH_STATUS ' "$LOG" | tail -1)
echo "$STATUS_LINE"

# One summary line back in the invoking checkout's gitignored logs, so a
# human finds it without knowing the clone's path.
mkdir -p "$MAIN_REPO/.build/logs"
printf '%s %s\n' "$(date -u +%FT%TZ)" "$STATUS_LINE" >>"$MAIN_REPO/.build/logs/vic-polish.log"
exit 0
