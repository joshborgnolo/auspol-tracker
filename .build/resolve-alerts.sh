#!/usr/bin/env bash
# resolve-alerts.sh — close ci-alert issues whose workflow has run green since.
#
# alert-issue.sh files an issue when the repair machinery wants a human
# ("Repair circuit breaker: <wf>", "Repair gate blocked: <wf>"), and nothing
# ever closed one: issues #1–#3 (Sep 2026) sat open for days after their
# workflows were green again, so an open ci-alert stopped meaning anything.
# This runs once a day (coverage-check.yml's `alerts` job) and closes each
# such issue whose workflow's newest completed run on main is green AND
# newer than the issue's last update — i.e. something landed after the alert
# and the workflow has passed since. Anything else stays open.
#
# Requires: GH_TOKEN (issues: write, actions: read), gh, $GITHUB_REPOSITORY;
# run from the repo root (it checks .github/workflows/<wf>.yml exists).
set -u
repo="${GITHUB_REPOSITORY:?}"
closed=0

while IFS=$'\t' read -r num updated title; do
  [ -n "$num" ] || continue
  case "$title" in
    "Repair circuit breaker: "*|"Repair gate blocked: "*) wf="${title#*: }" ;;
    *) continue ;;
  esac
  # the Newspoll filer's breaker is labelled by its pipeline, not its file
  [ "$wf" = "newspoll-file" ] && wf="newspoll-watch"
  if [ ! -f ".github/workflows/${wf}.yml" ]; then
    echo "#${num}: no workflow file for '${wf}'; left open"
    continue
  fi
  row="$(gh api "repos/${repo}/actions/workflows/${wf}.yml/runs?branch=main&status=completed&per_page=10" \
    --jq '[.workflow_runs[] | select(.conclusion == "success" or .conclusion == "failure")][0] | "\(.conclusion) \(.created_at) \(.html_url)"' 2>/dev/null)" || row=""
  read -r conclusion created url <<< "$row"
  if [ "${conclusion:-}" = "success" ] && [[ "$created" > "$updated" ]]; then
    gh issue close "$num" --repo "$repo" \
      --comment "Closing automatically: \`${wf}\` has run green since this was last updated — [run](${url}). A new failure files a fresh alert." >/dev/null \
      && { echo "#${num} closed (${wf} green at ${created})"; closed=$((closed + 1)); }
  else
    echo "#${num}: ${wf} newest completed run is ${conclusion:-unknown} (${created:-?}); left open"
  fi
done < <(gh issue list --repo "$repo" --state open --label ci-alert --limit 100 \
  --json number,updatedAt,title --jq '.[] | "\(.number)\t\(.updatedAt)\t\(.title)"')

echo "resolved ${closed} alert issue(s)"
