# Shared push-with-one-rebase-retry for the *-updater.sh wrappers.
#
# Why this exists: every wrapper extracts, validates, builds, commits, then
# pushes to main. Another writer (a neighbouring CI workflow, the local
# launchd backup, a human) can land a commit between our freshness pre-flight
# and our push — git rejects the push non-fast-forward, and previously the
# slot simply failed with the wave sitting in a local commit. Now the push is
# attempted, and on rejection we rebase onto origin/main, regenerate the built
# artifacts against the merged tree (validate + build), fold them into the
# commit via --amend, and push ONCE more. A second rejection fails the slot —
# the next scheduled run redoes the extraction on the fresh base, and the
# extractors are idempotent.
#
# Source AFTER the wrapper defines LOG and log(). Usage:
#   push_main <commit-message> <file> [<file>...]
# where <file>... is exactly the set the commit was staged from; the amend
# path re-stages it so regenerated artifacts land in the same commit. Pass
# index.html in the list whenever the commit carries it — that is the signal
# that the merged tree needs a rebuild before the retry.
push_main() {
  local msg="$1"; shift
  if git push origin HEAD:main >> "$LOG" 2>&1; then
    return 0
  fi
  log "push rejected; rebasing onto origin/main and retrying once"
  if ! git pull --rebase origin main >> "$LOG" 2>&1; then
    git rebase --abort >> "$LOG" 2>&1 || true
    log "FAIL rebase onto origin/main (commit kept locally: $msg)"
    return 1
  fi
  # If the commit carries the generated index.html, the merged tree's data
  # may differ from what those artifacts were built against (the other
  # writer may have landed data too) — re-validate and rebuild before the
  # retry so index.html/feed/sitemap reflect the merged polls.json.
  local f rebuild=false
  for f in "$@"; do [ "$f" = "index.html" ] && rebuild=true; done
  if $rebuild; then
    if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
      log "FAIL validate after rebase; retry abandoned (commit kept locally)"
      return 1
    fi
    if ! node .build/newtracker/build.mjs >> "$LOG" 2>&1; then
      log "FAIL build after rebase; retry abandoned (commit kept locally)"
      return 1
    fi
    # build.mjs rewrites hashed asset layers; catch renames/deletions too
    git add assets/ >> "$LOG" 2>&1 || true
  fi
  if ! git add "$@" >> "$LOG" 2>&1; then
    log "FAIL git add after rebase"
    return 1
  fi
  if ! git commit --amend --no-edit >> "$LOG" 2>&1; then
    log "FAIL amend after rebase"
    return 1
  fi
  if ! git push origin HEAD:main >> "$LOG" 2>&1; then
    log "FAIL git push after rebase (commit kept locally)"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Slot lock — one repo-wide lock for every writing wrapper.
#
# Why: the launchd shim locks per-wrapper (it stops a job overlapping
# ITSELF), but several plists share the same calendar slot and every
# extractor does read-modify-write on data/polls.json in this one checkout.
# Two wrappers a minute apart could each append disjoint waves to their own
# in-memory copy, and the second write would silently clobber the first in
# the working file. mkdir is atomic, so it is the mutex; a pid file inside
# lets a later slot reap the lock of a wrapper that died mid-run.
#
# Usage: acquire_slot_lock   — takes the lock or exits 0 (slot skipped).
# The lock releases itself via an EXIT trap.
SLOT_LOCK_DIR=""
acquire_slot_lock() {
  SLOT_LOCK_DIR="$REPO/.build/locks/writers.lock"
  if [ -d "$SLOT_LOCK_DIR" ]; then
    local oldpid=""
    [ -f "$SLOT_LOCK_DIR/pid" ] && oldpid="$(cat "$SLOT_LOCK_DIR/pid" 2>/dev/null)"
    if [ -n "$oldpid" ] && kill -0 "$oldpid" 2>/dev/null; then
      log "another wrapper holds the writers lock (pid $oldpid); skipping slot"
      exit 0
    fi
    log "reaping stale writers lock (pid ${oldpid:-unknown} no longer running)"
    rm -rf "$SLOT_LOCK_DIR"
  fi
  if ! mkdir "$SLOT_LOCK_DIR" 2>/dev/null; then
    log "writers lock lost to a concurrent wrapper; skipping slot"
    exit 0
  fi
  echo $$ > "$SLOT_LOCK_DIR/pid"
  trap 'rm -rf "$SLOT_LOCK_DIR"' EXIT
}

# ---------------------------------------------------------------------------
# freshness_sync — the pre-flight every writing wrapper used to copy-paste:
# fetch, ff-only onto origin/main, skip the slot if the local tree can't
# fast-forward. The old version had a wedge: when push_main's retry fails it
# keeps the commit locally, and from then on ff-only failed on EVERY slot —
# logged at exit 0, so the local job never contributed again and nothing
# ever said so. Now:
#   1. kept commit tree-identical to origin/main (the common case — the CI
#      twin won the race and landed the same rows) → reset to origin/main,
#      slot proceeds. Nothing is lost: identical trees, and the object
#      stays in the reflog.
#   2. genuinely diverged content → one rebase attempt; on conflict, abort
#      and skip the slot with a WARN so the log line greps differently.
# Callers expect: fresh tree check is the caller's job (dirty tree → no
# sync at all, as before); returns 0 when main is synced, 1 to skip.
freshness_sync() {
  git fetch origin -q || true
  if git merge --ff-only origin/main >> "$LOG" 2>&1; then
    return 0
  fi
  # A failed ff with a clean tree means local main has commits origin lacks
  # (behind-only is a fast-forward, and clean was checked by the caller).
  if git diff --quiet origin/main HEAD; then
    log "local main's kept commit is tree-identical to origin/main (lost push race); resetting to origin/main"
    if git reset --hard origin/main >> "$LOG" 2>&1; then
      return 0
    fi
    log "WARN reset to origin/main failed; skipping slot"
    return 1
  fi
  log "local main diverged from origin/main; attempting one rebase recovery"
  if git rebase origin/main >> "$LOG" 2>&1; then
    log "rebased kept local commit(s) onto origin/main; continuing slot"
    return 0
  fi
  git rebase --abort >> "$LOG" 2>&1 || true
  log "WARN local main diverged from origin/main (kept commits conflict); skipping slot"
  return 1
}
