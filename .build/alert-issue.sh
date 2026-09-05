#!/usr/bin/env bash
# alert-issue.sh "<title>" "<body>" — file (or append to) a GitHub issue.
#
# Why this exists: every watchdog's failure notification was one email to one
# maintainer ("failure is the message"). An issue is a second, shared queue a
# sibling session can also act on. The caller decides WHEN to alert (its own
# class gate); this script only dedupes: an open issue with the same title
# gets a comment, not a duplicate.
#
# Requires: GH_TOKEN in env, gh on PATH, $GITHUB_REPOSITORY.
# The workflow step needs `issues: write` on the token.
set -u

title="${1:?title}"
body="${2:?body}"
repo="${GITHUB_REPOSITORY:?}"

gh label create ci-alert --force --description "CI wants a human" --color B60205 >/dev/null 2>&1 || true

existing="$(gh issue list --repo "$repo" --state open --label ci-alert \
  --search "in:title \"${title}\"" --json number --jq '.[0].number // empty' 2>/dev/null || true)"
if [ -n "${existing}" ]; then
  gh issue comment "${existing}" --repo "$repo" --body "${body}" >/dev/null
  echo "appended to open issue #${existing}"
else
  url="$(gh issue create --repo "$repo" --title "${title}" --body "${body}" --label ci-alert)"
  echo "opened ${url}"
fi
