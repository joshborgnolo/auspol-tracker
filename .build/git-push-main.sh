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
