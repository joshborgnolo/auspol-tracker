#!/bin/bash
# Lock probe: can a writing wrapper take the repo-wide writers lock right now?
#
# Why this exists: acquire_slot_lock() failing is indistinguishable from a
# healthy wrapper run in the logs it leaves behind — "lock lost ...; skipping
# slot" exits 0, so the 2026-09-05..07 outage (a gitignored .build/locks
# parent broke the mutex mkdir in every checkout) ran for two days with every
# pipeline self-reporting success. A probe that actually ATTEMPTS the
# acquisition turns that config failure into a loud, pageable signal.
#
# Read-only by construction: acquire_slot_lock installs an EXIT trap that
# rmdirs the lock again, so a successful probe leaves the lock free.
#
# Outcomes (exit code):
#   0  acquired the lock, or a genuine live holder has it (local runs only)
#   1  refused in a context where refusal is impossible — CI checkouts are
#      private, so nothing can legitimately hold the lock there — or refused
#      with the config-failure signature line ("lost to a concurrent wrapper"
#      with no verified holder), locally or in CI
#   2  probe-internal fault (inconclusive — inconclusive is not an alarm)
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

PROBE_LOG="${TMPDIR:-/tmp}/writers-lock-probe.$$.log"
trap 'rm -f "$PROBE_LOG"' EXIT
: > "$PROBE_LOG" || exit 2

# git-push-main.sh expects its caller to have defined LOG and log() — give
# the helpers ours, pointed at the probe log, then behave like a wrapper.
# Without log() the refusal line dies with "command not found" inside the
# subshell and this probe reports success precisely in the failure case.
LOG="$PROBE_LOG"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$PROBE_LOG"; }
. "$REPO/.build/git-push-main.sh" || exit 2

# acquire_slot_lock exit()s even on refusal, so run it in a subshell; the
# verdict is in the log line it emits.
( acquire_slot_lock ) > /dev/null 2>&1

if ! grep -q 'skipping slot' "$PROBE_LOG"; then
  echo 'PROBE_STATUS {"ok":true,"lock":"acquired"}'
  exit 0
fi

LINE="$(grep 'skipping slot' "$PROBE_LOG" | tail -1)"

if echo "$LINE" | grep -q 'another wrapper holds the writers lock'; then
  if [ "${CI:-}" = "true" ]; then
    echo "PROBE_STATUS {\"ok\":false,\"lock\":\"held-in-ci\",\"detail\":\"$(echo "$LINE" | sed 's/^[^ ]* [^ ]* //')\"}"
    echo "writers-lock probe: a lock holder in a private CI checkout can only be wedged state" >&2
    exit 1
  fi
  # Local: a holder passed the helper's liveness and 45-min staleness checks
  # a moment ago — that is genuine contention, which is healthy behaviour.
  echo "PROBE_STATUS {\"ok\":true,\"lock\":\"held-by-live-wrapper\"}"
  exit 0
fi

# "lost to a concurrent wrapper" — the exact signature of the two-day outage:
# the mutex mkdir itself failed. No verified holder exists in this case.
echo "PROBE_STATUS {\"ok\":false,\"lock\":\"refused\",\"detail\":\"config-failure signature: mutex mkdir failed\"}"
echo "writers-lock probe: $LINE" >&2
exit 1
