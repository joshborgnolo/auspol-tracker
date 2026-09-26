#!/bin/bash
# install-launchd.sh — install, update or check the laptop's launchd backup jobs.
#
#   bash .build/install-launchd.sh           install/update everything; reload changed jobs
#   bash .build/install-launchd.sh --check   report drift and change nothing (exit 1 on drift)
#
# Run it from any checkout of the repo (it installs that checkout's copies).
# What it owns:
#   ~/Library/Application Support/auspol-agents/repo       the runner clone the jobs run in
#   ~/Library/Application Support/auspol-agents/run.sh     from .build/launchd/run.sh
#   ~/Library/Application Support/auspol-agents/<job>.sh   one-line shims (launchd's first exec)
#   ~/Library/LaunchAgents/local.auspol.<job>.plist        from .build/local.auspol.<job>.plist
#
# Why a clone, and why the shims live outside the repo: see .build/launchd/run.sh.
# The clone's .build/logs is a symlink to the directory the plists' own
# stdout/stderr paths name (the main checkout's .build/logs), so every log
# stays where launchd and every skill look for it.
#
# Before 2026-09-25 the plists and run.sh were copied by hand and drifted
# unnoticed: Essential's 05:02 skip-confirm slot was never installed, and Roy
# Morgan's installed plist had a Monday 16:00 slot the repo copy lacked.
# --check makes that visible; a plain run fixes it.
set -uo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)" # the checkout whose copies get installed
AGENTS="$HOME/Library/Application Support/auspol-agents"
CLONE="$AGENTS/repo"
LA="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"
CHECK=false
[ "${1:-}" = "--check" ] && CHECK=true
drift=0
did() { echo "  $*"; }
bad() { echo "  DRIFT: $*"; drift=$((drift + 1)); }

[ "$(uname)" = "Darwin" ] || { echo "launchd is macOS-only" >&2; exit 2; }
# the logs directory is whatever the plists send launchd's stdout to — one place
LOGS=""
for p in "$SRC"/.build/local.auspol.*.plist; do
  d="$(dirname "$(plutil -extract StandardOutPath raw -o - "$p" 2>/dev/null)")"
  [ -n "$LOGS" ] || LOGS="$d"
  [ "$d" = "$LOGS" ] || { echo "$(basename "$p") logs to $d, the others to $LOGS — make them agree" >&2; exit 2; }
done
[ -n "$LOGS" ] && [ "$LOGS" != "." ] || { echo "no plist names a StandardOutPath" >&2; exit 2; }
[ "$LOGS" != "$CLONE/.build/logs" ] || { echo "the plists log into the runner clone itself" >&2; exit 2; }
mkdir -p "$AGENTS" "$LA" "$LOGS"
$CHECK && echo "checking the launchd backup jobs against $SRC" || echo "installing the launchd backup jobs from $SRC"
echo "  logs: $LOGS"

# ---- 1. the runner clone ------------------------------------------------------------
if [ ! -d "$CLONE/.git" ]; then
  if $CHECK; then
    bad "no runner clone at $CLONE"
  else
    # a local clone hardlinks the objects, then points at the real origin
    git clone -q "$SRC" "$CLONE"
    git -C "$CLONE" remote set-url origin "$(git -C "$SRC" remote get-url origin)"
    git -C "$CLONE" fetch -q origin
    git -C "$CLONE" checkout -q -B main origin/main
    git -C "$CLONE" branch -q --set-upstream-to=origin/main main
    did "cloned the runner at $CLONE ($(git -C "$CLONE" log -1 --format='%h %s'))"
  fi
fi
if [ -d "$CLONE/.git" ]; then
  # the jobs push as whoever this checkout commits as
  [ -n "$(git -C "$CLONE" config user.email)" ] || bad "runner clone has no git user.email"
  [ "$(git -C "$CLONE" remote get-url origin)" = "$(git -C "$SRC" remote get-url origin)" ] || bad "runner clone's origin differs from this checkout's"
  # puppeteer-core, for the share-card redraw
  if [ ! -d "$CLONE/node_modules/puppeteer-core" ]; then
    if $CHECK; then bad "runner clone has no node_modules"
    else (cd "$CLONE" && npm ci --ignore-scripts --no-audit --no-fund > /dev/null 2>&1) && did "installed node_modules in the runner clone" || bad "npm ci failed in the runner clone"
    fi
  fi
  # the logs live where the plists point launchd's output
  if [ "$(readlink "$CLONE/.build/logs" 2>/dev/null)" != "$LOGS" ]; then
    if $CHECK; then
      bad "runner clone's .build/logs is not a link to $LOGS"
    else
      if [ -d "$CLONE/.build/logs" ] && [ ! -L "$CLONE/.build/logs" ]; then
        cp -Rn "$CLONE/.build/logs/." "$LOGS/" 2>/dev/null || true # keep what a run wrote there
        rm -rf "$CLONE/.build/logs"
      fi
      rm -f "$CLONE/.build/logs"
      ln -s "$LOGS" "$CLONE/.build/logs"
      did "linked the runner clone's .build/logs to $LOGS"
    fi
  fi
  # .gitignore's `.build/logs/` matches directories only; the link needs its own line
  if ! grep -qxF '.build/logs' "$CLONE/.git/info/exclude" 2>/dev/null; then
    if $CHECK; then bad "runner clone does not ignore its .build/logs link"
    else echo '.build/logs' >> "$CLONE/.git/info/exclude"; did "ignored the logs link in the runner clone"
    fi
  fi
fi

# ---- 2. run.sh and the shims ----------------------------------------------------------
if ! cmp -s "$SRC/.build/launchd/run.sh" "$AGENTS/run.sh"; then
  if $CHECK; then bad "installed run.sh differs from .build/launchd/run.sh"
  else install -m 755 "$SRC/.build/launchd/run.sh" "$AGENTS/run.sh"; did "installed run.sh"
  fi
fi

# the Node the jobs will run: launchd's bare environment (the plists' PATH),
# through run.sh's own choice, against this checkout's .nvmrc
jobpath="$(plutil -extract EnvironmentVariables.PATH raw -o - "$(ls "$SRC"/.build/local.auspol.*.plist | head -n 1)" 2>/dev/null)"
if node_line="$(env -i HOME="$HOME" PATH="${jobpath:-/usr/bin:/bin}" AUSPOL_NVMRC="$SRC/.nvmrc" \
     bash "$SRC/.build/launchd/run.sh" --which-node 2>/dev/null)"; then
  echo "  node: $node_line"
else
  bad "the jobs would run ${node_line:-no node}, but .nvmrc pins $(head -n 1 "$SRC/.nvmrc"): brew install node@$(head -n 1 "$SRC/.nvmrc")"
fi

# plist → a canonical JSON form (key order and whitespace don't count)
canon() { plutil -convert json -o - "$1" 2>/dev/null | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
    process.stdout.write(JSON.stringify(sort(JSON.parse(s || "null"))));
  });'; }

for p in "$SRC"/.build/local.auspol.*.plist; do
  label="$(basename "$p" .plist)"
  job="${label#local.auspol.}"
  shim="$AGENTS/$job.sh"
  want_shim="$(printf '%s\n' '#!/bin/bash' '# Thin per-job launcher; see run.sh for why these live outside the repo.' \
    "exec bash \"$AGENTS/run.sh\" \"$job-updater.sh\"")"
  if [ "$(cat "$shim" 2>/dev/null)" != "$want_shim" ]; then
    if $CHECK; then bad "$job.sh shim missing or different"
    else printf '%s\n' "$want_shim" > "$shim"; chmod 755 "$shim"; did "wrote $job.sh"
    fi
  fi
  [ -f "$SRC/.build/$job-updater.sh" ] || bad "$label runs $job-updater.sh, which the repo does not have"

  installed="$LA/$label.plist"
  if [ "$(canon "$p")" != "$(canon "$installed")" ]; then
    if $CHECK; then
      bad "$label.plist differs from the repo copy"
    else
      launchctl bootout "$DOMAIN/$label" 2> /dev/null || true
      cp "$p" "$installed"
      launchctl bootstrap "$DOMAIN" "$installed" && did "installed and loaded $label" || bad "launchctl bootstrap failed for $label"
    fi
  elif ! launchctl print "$DOMAIN/$label" > /dev/null 2>&1; then
    if $CHECK; then bad "$label is installed but not loaded"
    else launchctl bootstrap "$DOMAIN" "$installed" && did "loaded $label" || bad "launchctl bootstrap failed for $label"
    fi
  fi
done
for installed in "$LA"/local.auspol.*.plist; do
  [ -e "$installed" ] || continue
  [ -f "$SRC/.build/$(basename "$installed")" ] || bad "$(basename "$installed") is installed but the repo has no such job (left alone)"
done

if [ "$drift" -gt 0 ]; then
  echo "$drift problem(s)$($CHECK && echo "; run without --check to fix")"
  exit 1
fi
echo "  all in step"
exit 0
