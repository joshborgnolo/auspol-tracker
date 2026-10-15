#!/bin/bash
# worktree-sweep.sh — remove abandoned worktrees that have nothing left to give.
#
#   bash .build/worktree-sweep.sh           dry-run: report what would be removed
#   bash .build/worktree-sweep.sh --apply    actually remove
#
# What counts as "abandoned": a worktree whose branch is fully merged into
# origin/main (so its commits are already in history) and whose working tree
# is clean (so no uncommitted edits would be lost). Worktrees that are dirty,
# unmerged, or have unpushed commits are left alone — the sweep is a janitor,
# not a garbage collector.
#
# Why this exists: sessions spawn worktrees constantly and almost never run
# `git worktree remove` afterwards. In five days (Oct 10–15, 2026) the folder
# grew 1.16 GB of stale worktrees before a manual sweep found them. A weekly
# launchd slot keeps that from recurring.
#
# The sweep runs in the MAIN checkout (the one the installer was run from),
# never in a worktree itself — a worktree seeing its own path in the list
# would try to remove itself.
#
# The lock is the same per-job lock the launchd jobs use; two sweeps never
# overlap.
set -uo pipefail

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 1
[ -d .git ] || { echo "not in a git checkout: $REPO" >&2; exit 1; }

LOCKDIR="/tmp/auspol-agent-locks/worktree-sweep.lock"
mkdir -p "$(dirname "$LOCKDIR")"
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  held="$(cat "$LOCKDIR/pid" 2>/dev/null || echo unknown)"
  if [ "$held" != unknown ] && kill -0 "$held" 2>/dev/null; then
    echo "worktree-sweep: already running (pid $held); skipping" >&2
    exit 0
  fi
  rm -rf "$LOCKDIR"
  mkdir "$LOCKDIR" 2>/dev/null || { echo "worktree-sweep: cannot take lock" >&2; exit 1; }
fi
trap 'rm -rf "$LOCKDIR"' EXIT
echo $$ > "$LOCKDIR/pid"

# Never remove the main checkout or a worktree that is the current HEAD of
# another branch (someone else is working there). A worktree whose HEAD is
# an ancestor of origin/main and whose tree is clean is fair game.
#
# We refresh origin/main once; the sweep's "merged" test is against what we
# just fetched, so a stale local main can't hide a merge that already landed.
git fetch -q origin 2>/dev/null || true

removed=0
skipped=0

# A worktree counts as abandoned only when it is clean, fully merged, AND
# nobody has touched it for IDLE_SECS: a sibling session that has committed
# and pushed but is still working in the directory would otherwise be swept
# out from under its feet. "Touched" = newest regular-file mtime (skipping
# node_modules) or the last reflog action, whichever is newer.
# AUSPOL_SWEEP_IDLE_SECS overrides the window (tests use 0; an operator doing
# a deliberate manual pass can too).
IDLE_SECS="${AUSPOL_SWEEP_IDLE_SECS:-$((2 * 86400))}"
# BSD stat (macOS) prints mtime with -f '%m', GNU stat (Linux/CI) with -c '%Y'.
# Probe once rather than sprinkling fallbacks through every call.
if stat -f '%m' "$0" > /dev/null 2>&1; then STAT_M="stat -f %m"; else STAT_M="stat -c %Y"; fi
newest_activity() {
  local wt="$1" newest reflt
  newest=$(find "$wt" -type f -not -path '*/node_modules/*' -not -name '.DS_Store' \
      -exec $STAT_M {} + 2>/dev/null | sort -rn | head -1)
  newest=${newest:-0}
  reflt=$(git -C "$wt" log -g -1 --format=%ct 2>/dev/null || echo 0)
  [ "${reflt:-0}" -gt "$newest" ] && newest="$reflt"
  echo "$newest"
}
cutoff=$(( $(date +%s) - IDLE_SECS ))

# git worktree list --porcelain gives one blank-line-separated record per
# worktree. We parse it in awk: one "worktree " line per record. The list is
# read line-by-line below — repos live under paths with spaces ("auspol
# tracker"), so word-splitting the list silently halves everything.
worktrees="$(
  git worktree list --porcelain | awk '
    /^worktree / {
      if (path != "") print path
      path = substr($0, 10)
    }
    END { if (path != "") print path }
  '
)"

while IFS= read -r worktree; do
  [ -d "$worktree" ] || continue

  # Skip the main checkout itself.
  if [ "$worktree" = "$REPO" ]; then
    continue
  fi

  # Skip if the worktree is dirty (uncommitted changes).
  if ! git -C "$worktree" status --porcelain 2>/dev/null | grep -q .; then
    : # clean
  else
    echo "  SKIP (dirty):  $worktree"
    skipped=$((skipped + 1))
    continue
  fi

  # Skip if the worktree's HEAD is not fully merged into origin/main.
  # This also covers "branch has no upstream" — merge-base returns non-zero.
  if ! git merge-base --is-ancestor "$(git -C "$worktree" rev-parse HEAD)" origin/main 2>/dev/null; then
    echo "  SKIP (unmerged): $worktree"
    skipped=$((skipped + 1))
    continue
  fi

  # Skip if the worktree is on a branch that has unpushed commits relative to
  # origin/main (a detached HEAD worktree has no branch, but its commits are
  # still ancestors, so it passes the above test — we still don't touch it).
  if ! git -C "$worktree" symbolic-ref -q HEAD >/dev/null 2>&1; then
    echo "  SKIP (detached): $worktree"
    skipped=$((skipped + 1))
    continue
  fi

  branch="$(git -C "$worktree" symbolic-ref --short HEAD 2>/dev/null)"

  # Skip anything touched inside the idle window (see newest_activity).
  idle_check=$(newest_activity "$worktree")
  if [ "${idle_check:-0}" -gt "$cutoff" ]; then
    echo "  SKIP (active): $worktree"
    skipped=$((skipped + 1))
    continue
  fi

  echo "  REMOVE: $worktree  (branch $branch, merged and clean)"
  if $APPLY; then
    if git worktree remove "$worktree" 2>&1; then
      removed=$((removed + 1))
    else
      echo "    git worktree remove failed — leaving it"
      skipped=$((skipped + 1))
    fi
  fi
done <<< "$worktrees"

# Also sweep .matilda/worktrees/ — the Matilda agent tool creates worktrees
# there with random names and no lifecycle discipline. They're always
# detached-HEAD scratch pads; if they're clean and their registration is
# stale, prune them.
matilda_worktrees="$REPO/.matilda/worktrees"
if [ -d "$matilda_worktrees" ]; then
  for wt in "$matilda_worktrees"/*; do
    [ -d "$wt" ] || continue
    # If it's not a git worktree registration, it's a tree copy — leave it.
    git worktree list --porcelain 2>/dev/null | grep -q "worktree $wt$" || continue
    [ -d "$wt/.git" ] && continue # regular clone, not a worktree — leave it
    # Dirty or unmerged? Leave it.
    if git -C "$wt" status --porcelain 2>/dev/null | grep -q .; then
      continue
    fi
    if ! git merge-base --is-ancestor "$(git -C "$wt" rev-parse HEAD)" origin/main 2>/dev/null; then
      continue
    fi
    if [ "$(newest_activity "$wt")" -gt "$cutoff" ]; then
      continue
    fi
    echo "  REMOVE: $wt  (matilda scratch, merged and clean)"
    if $APPLY; then
      if git worktree remove --force "$wt" 2>&1; then
        removed=$((removed + 1))
      fi
    fi
  done
fi

# Prune stale registrations (the working directory is gone but git still lists it).
if $APPLY; then
  git worktree prune -v 2>/dev/null | while read -r line; do echo "  $line"; done
fi

# Delete merged worktree-* branches. Removing a worktree leaves its branch
# behind; the Oct 15 manual sweep found ten such husks. Only worktree-* (the
# agents' scratch-branch naming), only fully merged into origin/main, and
# never a branch checked out in another worktree.
for b in $(git branch --merged origin/main --format='%(refname:short)' 2>/dev/null | grep -E '^worktree-'); do
  if git worktree list --porcelain 2>/dev/null | grep -q "branch refs/heads/$b$"; then
    echo "  KEEP-BRANCH (checked out): $b"
    continue
  fi
  echo "  DELETE-BRANCH: $b  (merged into origin/main)"
  if $APPLY; then
    git branch -D "$b" > /dev/null 2>&1 || echo "    could not delete $b"
  fi
done

echo ""
if $APPLY; then
  echo "sweep complete: $removed removed, $skipped skipped"
else
  echo "dry run: $removed would be removed, $skipped skipped (run with --apply)"
fi
