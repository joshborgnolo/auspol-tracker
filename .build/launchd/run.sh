#!/bin/bash
# Launcher shim for the auspol-tracker launchd jobs. INSTALLED by
# .build/install-launchd.sh to ~/Library/Application Support/auspol-agents/
# — edit this repo copy (.build/launchd/run.sh) and re-run the installer,
# never the installed file.
#
# WHY THIS FILE LIVES OUTSIDE THE REPO
# macOS TCC refuses to let launchd DIRECTLY exec a ProgramArguments script that
# lives under ~/Documents: the job dies with exit 126 and
# "/bin/bash: <wrapper>: Operation not permitted", silently, with no TCC prompt
# and no entry to grant in System Settings. It is not a read block — a job
# started from an unprotected path can cd into the repo and read, write, run
# node and run git there without complaint (probed 2026-08-30, exit 0) — and it
# is not a block on exec'ing those scripts either: a bash already running from
# an unprotected path execs them fine. ONLY launchd's own first exec is
# refused. So the plists point at one-line shims beside this file, and this
# hands off to the canonical wrapper, which stays the single source of truth.
#
# WHY THE JOBS RUN IN THEIR OWN CLONE (2026-09-25)
# The wrappers refuse a dirty working tree — they must never commit someone's
# half-finished edit — and the main checkout is where people and agent
# sessions edit all day. Of ~148 local slots from 1 to 24 Sep 2026, 51 refused
# on a dirty tree, among them every Roy Morgan release slot on 14 and 21 Sep.
# The jobs now run in a clone nobody edits (./repo beside this file). Its
# .build/logs is a symlink to the main checkout's, so the logs stay where the
# skills and the plists' stdout/stderr paths say they are. AUSPOL_RUNNER_CLONE
# tells the wrappers (acquire_slot_lock) that a dirty tree here can only be an
# interrupted run's leftovers, safe to discard under the writers lock.
#
# It also carries a per-job run lock, so every job gets one for free.
# RedBridge spawns headless Chrome per wave and mines 40MB PDFs; two of its
# slots overlapping is how a run ends up fighting itself for the repo
# (observed 2026-08-30 06:00: "Resource deadlock avoided").
#
# WHICH NODE (2026-09-26)
# The one CI runs: the major version in .nvmrc, not whatever `node` Homebrew
# last linked. Until 2026-09-26 these jobs ran Node 23, past its end of life,
# while CI ran the pinned 22, and both write the same generated files.
# Homebrew's versioned formulae are keg-only (node@22 is never on PATH by
# itself), so this puts node@<major> first. If that isn't installed, the job
# still runs on the PATH's node and says so on stderr, and
# install-launchd.sh --check reports it.
#
#   usage: run.sh <wrapper-basename>     e.g. run.sh roymorgan-updater.sh
#          run.sh --which-node           print the node the jobs get (exit 1 if not .nvmrc's)
set -uo pipefail

AGENTS="$(cd "$(dirname "$0")" && pwd)"
REPO="$AGENTS/repo"

pin_node() {
  local want d
  want="$(sed -n '1{s/^[vV]//;s/[^0-9].*//;p;}' "${AUSPOL_NVMRC:-$REPO/.nvmrc}" 2>/dev/null)"
  [ -n "$want" ] || return 0 # no numeric pin: nothing to match
  for d in "/opt/homebrew/opt/node@$want/bin" "/usr/local/opt/node@$want/bin"; do
    if [ -x "$d/node" ]; then PATH="$d:$PATH"; export PATH; break; fi
  done
  [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" = "$want" ] && return 0
  echo "run.sh: .nvmrc pins Node $want, but the jobs get $(node --version 2>/dev/null || echo 'no node'); brew install node@$want" >&2
  return 1
}
if [ "${1:-}" = "--which-node" ]; then
  pin_node; ok=$?
  echo "$(command -v node) $(node --version 2>/dev/null)"
  exit "$ok"
fi

WRAPPER="$REPO/.build/${1:?usage: run.sh <wrapper-basename>}"
LOCKDIR="/tmp/auspol-agent-locks/$(basename "$1" .sh).lock"

[ -d "$REPO/.git" ] || { echo "run.sh: no runner clone at $REPO — run .build/install-launchd.sh from the main checkout" >&2; exit 1; }
[ -f "$WRAPPER" ] || { echo "run.sh: no wrapper at $WRAPPER" >&2; exit 1; }

# mkdir is atomic on every filesystem worth having, needs no flock binary
# (macOS ships none), and leaves a pid behind to diagnose a stuck run.
mkdir -p "$(dirname "$LOCKDIR")"
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  held="$(cat "$LOCKDIR/pid" 2>/dev/null || echo unknown)"
  # A lock whose owner is gone is stale - a machine that slept mid-run, say.
  if [ "$held" != unknown ] && kill -0 "$held" 2>/dev/null; then
    echo "run.sh: $1 already running (pid $held); skipping this slot" >&2
    exit 0
  fi
  rm -rf "$LOCKDIR"
  mkdir "$LOCKDIR" 2>/dev/null || { echo "run.sh: cannot take lock" >&2; exit 1; }
fi
# exec keeps this pid, so the lock stays held for the wrapper's whole run;
# the next slot reaps it once the pid is gone
echo $$ > "$LOCKDIR/pid"

pin_node || true # never skip a slot over it: a warning, and --check's drift
export AUSPOL_RUNNER_CLONE=1
cd "$REPO" || exit 1
exec bash "$WRAPPER"
