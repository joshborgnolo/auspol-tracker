#!/bin/bash
# Hourly share-card drift backstop: ff main -> probe build -> if the card's
# drawn figures would move (render-card's own staleness gate, pre-empted
# before any validate/commit) validate -> refresh_site -> commit -> push.
# Run in CI by card-watch.yml. The per-poll pipelines already redraw the
# card in refresh_site the moment a wave lands; this job exists for the
# OTHER way the figures move — recency decay and window taper shifting the
# nowcast on a day no writer runs — which otherwise waits for the daily
# prediction-refresh slot (up to 24h stale, and og:image:alt with it).
# The build is idempotent for unchanged inputs, so a current card makes
# this a seconds-long no-op: nothing staged, nothing committed. Any
# failure exits non-zero before any commit, leaving the tree for manual
# review; the central agent-repair.yml picks the failed run up.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR=".build/logs"
LOG="$LOG_DIR/card-watch.log"
mkdir -p "$LOG_DIR"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
. "$REPO/.build/git-push-main.sh"

# Another writer may push between slots. Refresh first; ABORT cleanly if
# the tree isn't clean — a dirty tree means a human or sibling agent is
# mid-edit, and a rebuild commit must not land on a base it did not read.
# The next hourly slot retries.
if git diff --quiet && git diff --cached --quiet; then
 git fetch origin -q || true
 if ! git merge --ff-only origin/main >> "$LOG" 2>&1; then
 log "local main diverged from origin/main; skipping slot"
 exit 0
 fi
else
 log "FAIL working tree dirty (uncommitted changes present); refusing to write & commit on a dirty base"
 exit 1
fi

# Probe build so auspol-latest.json carries today's figures; the gate
# below compares it against the card's own stamp. refresh_site builds
# again on the draw path — idempotent and seconds cheap.
if ! node .build/newtracker/build.mjs >> "$LOG" 2>&1; then
 log "FAIL build (probe)"
 exit 1
fi

# render-card.mjs's staleness gate, verbatim: a draw buys nothing when
# the date AND the figures the card shows are both what build.mjs last
# wrote into auspol-latest.json. Detecting here keeps a current card
# from running validate or refresh_site at all.
if node -e '
const fs = require("fs");
const j = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const drawn = j("assets/auspol-card.json"), latest = j("assets/auspol-latest.json");
const current = drawn && latest && drawn.publishedISO === latest.publishedISO
 && drawn.fig && latest.fig && JSON.stringify(drawn.fig) === JSON.stringify(latest.fig);
process.exit(current ? 0 : 1);
'; then
 log "card current; nothing to do"
 exit 0
fi

FIG="$(node -p '
const l = JSON.parse(require("fs").readFileSync("assets/auspol-latest.json", "utf8"));
const opp = l.fig && l.fig.vs === "onp" ? "One Nation" : "Coalition";
(l.fig ? "Labor " + l.fig.alp + " - " + opp + " " + l.fig.lnp : "figures unknown") + " as at " + l.publishedISO;
')"
log "figures moved -> ${FIG}; redrawing"

if ! node .build/newtracker/validate.mjs >> "$LOG" 2>&1; then
 log "FAIL validate before rebuild; no commit made"
 exit 1
fi

if ! refresh_site; then
 log "FAIL refresh_site (render or build); no commit made"
 exit 1
fi

FILES=("${SITE_FILES[@]}")
git add "${FILES[@]}" || { log "FAIL git add"; exit 1; }
if git diff --cached --quiet; then
 log "nothing staged after redraw; no commit"
 exit 0
fi
MSG="Redraw share card: ${FIG}"
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
 log "FAIL git commit"
 exit 1
fi
if ! push_main "$MSG" "${FILES[@]}"; then
 exit 1
fi
log "OK committed + pushed: $MSG"
exit 0
