---
name: shell-command-pitfalls
description: Shell-command pitfalls that have cost time in interactive Matilda sessions on this repo (macOS) — sleeps need a standalone call with an `# intentional-sleep: <reason>` trailing comment or the policy hook blocks them (and `sleep N && cmd` chains are refused, split the follow-up command into its own call). Never build a multi-line git commit message as `-m "$(cat <<'HEREDOC' … )"` — apostrophes AND double quotes in the body abort the commit (use `git commit -F - <<'HEREDOC'` or literal -m flags). A hung `git add` is usually a stray `less` pager from an earlier git diff (pkill it, then retry). BSD grep chokes on brace literals ("invalid repetition count(s)") — use grep -F. `grep -c` exits 1 when the count is 0 — SUCCESS for an absence assertion. There is NO `timeout` command on stock macOS (don't reach for it; split chains instead), and chaining several headless probe scripts in one call dies at the 120 s harness cap — run probes one call each (worked across the 2026-09-30 sessions).
source: auto-skill
extracted_at: '2026-09-30T12:25:25.215Z'
---

# Shell-command pitfalls in interactive sessions (macOS, this repo)

Small traps, one wasted loop each — all hit during the 2026-09-30
issues-panel / others-&-independents session.

## Sleeps: standalone, with a reason comment

The policy hook REFUSES bare `sleep` and any compound that hides one
(`sleep 20 && curl …`). The form that passes:

```
sleep 20 # intentional-sleep: give GitHub Pages a moment to deploy the push
```

— standalone call, one line, trailing `# intentional-sleep: <reason>`.
Then run the command you were waiting for as a SEPARATE call.

## Multi-line commit messages: never `$(cat <<HEREDOC)`

`git commit -m "$(cat <<'HEREDOC' … HEREDOC)"` breaks the moment the
body carries an apostrophe OR a double quote — either lands inside the
outer double-quoted substitution and bash aborts with `unexpected EOF
while looking for matching …`, staging intact, commit lost (hit twice:
2026-09-30 issues session with an apostrophe, 2026-09-30 drift-fix
commit 7c4bba4 with a quoted user report in the body). Two safe forms:

```
git commit -m "Subject line" -m "Body paragraph with an apostrophe's worth of text."
```

or, for a long message with many quotes (robustest — the body never
goes near shell quoting):

```
git commit -F - <<'EOF'
Subject line

Body with "quotes" and apostrophes' aplenty.
EOF
```

Check `git log -n 1 --oneline` afterwards — this failure mode leaves the
files staged and the commit silently unmade.

## A "hung" git add is usually a stray pager

If `git add` / `git commit` appears to freeze with no output, a `less`
pager from an earlier `git diff` (or another `git` read) is holding the
terminal. Fix, then retry:

```
pkill -9 -f less ; pkill -9 -f "git diff"
```

Check for a stale `.git/index.lock` afterwards (there usually isn't one)
before re-staging. In this SHARED checkout, kill only the pager — never
`git checkout --` or reset anything; sibling sessions' work is in the
tree (see shared-repo-session-race).

## BSD grep brace literals → grep -F

macOS grep rejects patterns whose `{`/`}` look like a bad repetition
("invalid repetition count(s)" — e.g. searching for a CSS block ending
`chips \{$`). Use fixed-string mode: `grep -nF 'chips {$' file`.

## grep -c exit 1 on zero matches is the answer you wanted

`curl -s https://auspoltracker.com/ | grep -c "<old string>"` printing
`0` exits with code 1 — the tool harness reports that as the command's
exit code, not as failure. When asserting an ABSENCE on the live site,
exit 1 + printed 0 = pass. Don't "fix" anything and re-run.

## No `timeout` command on stock macOS

GNU coreutils' `timeout` does not exist on a stock Mac (it ships as
`gtimeout` only if coreutils is brew-installed — it isn't here). Don't
reach for it to bound a command; run the command plainly, or split the
work into time-boxed calls.

## Probe suites blow the 120 s harness cap — run one per call

Chaining several headless-Chrome probe scripts in one shell call
(`node .matilda/probe-a.mjs && node .matilda/probe-b.mjs && …`) dies at
the 120000 ms harness timeout partway through — the earlier scripts
printed, everything after is lost, and it LOOKS like a probe hung
(hit 2026-09-30 with a panels/cycles/rdtabs probe batch). Run each
probe script in its own call so each gets the full cap.
