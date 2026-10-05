---
name: shell-command-pitfalls
description: Shell-command pitfalls that have cost time in interactive Matilda sessions on this repo (macOS) — sleeps need a standalone call with an `# intentional-sleep: <reason>` trailing comment or the policy hook blocks them (and `sleep N && cmd` chains are refused, split the follow-up command into its own call). Never build a multi-line git commit message as `-m "$(cat <<'HEREDOC' … )"` — apostrophes AND double quotes in the body abort the commit (use `git commit -F - <<'HEREDOC'` or literal -m flags); the parse failure kills the WHOLE command line, so a same-line `git add` never runs either and the plain -m fallback retry commits EMPTY (one reached origin 2026-09-30 — run `git show --stat` before pushing after any such hiccup: 0 changes = soft-reset and redo, already-pushed = harmless litter, leave it). A hung `git add` is usually a stray `less` pager from an earlier git diff (pkill it, then retry). BSD grep chokes on brace literals ("invalid repetition count(s)") — use grep -F. `grep -c` exits 1 when the count is 0 — SUCCESS for an absence assertion. There is NO `timeout` command on stock macOS (don't reach for it; split chains instead), chaining several headless probe scripts in one call dies at the 120 s harness cap (run probes one call each), and an inline `node -e "…"` whose JS carries a backtick template literal gets its `${…}` executed by bash (exit 127 "…: command not found", 2026-10-01) — write the probe as a scratch .mjs file instead of fighting the quoting. A single-line sed pattern against the hashed asset sources (`.build/newtracker/assets/*.js`) silently matches ZERO when the JSX copy wraps the phrase across two source lines — read the region first, use the edit tool with the real line breaks, or an `&&` chain half-applies a copy sweep (2026-10-02). A pipe masks exit codes: `npm test 2>&1 | tail -5` shows green even when the tests FAILED (exit status is tail's) — re-verify with an unpiped run (`npm test >/dev/null 2>&1; echo $?`). `git add` of TRACKED files living under a gitignored DIRECTORY (`.matilda/probe/` is ignored but its probe files are committed) prints "The following paths are ignored by one of your .gitignore files" and exits 1 — yet stages them anyway; verify with `git status`/`git diff --cached` and do NOT reach for `-f` (only never-tracked files need it, and a chained `&&` after such an add silently dies even though the add worked) (2026-10-03). Corollary hit 2026-10-04: believing the add had failed wholesale, dropping the path from a RETRY add does NOT unstage it — the staging from the first "failed" add persists, so the commit includes a file the final add never named (a 3-path `git add` followed by commit produced `git show --stat` listing 4 files; harmless only because the probe file was a wanted deliverable). After such a hiccup always `git diff --cached --stat` BEFORE committing. A long-running process launched as a Matilda background shell (even with `completion: detached`) is REAPED when the chat session exits or restarts (vic-polish loop died silently ~15 min after turn end, 2026-10-04) — for anything that must outlive the session use `nohup cmd </dev/null >>log 2>&1 & disown` and verify `ps -o tty=` shows `??` (reparented to launchd). An inline `#` comment INSIDE a submitted one-liner comments out everything to the line's end — the loop's `fi`/`done` terminators die with it and bash dies with `syntax error: unexpected end of file` (2026-10-04).
source: auto-skill
extracted_at: '2026-09-30T12:25:25.215Z'
updated_at: '2026-10-04'
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

or skip heredocs entirely when the message is long and you control the
editor: write the message body to a scratch file with write_file
(`.matilda/<msg>.txt`), `git commit -F .matilda/<msg>.txt`, then delete
it — zero shell quoting anywhere (the form that finally landed the
2026-10-01 round-3 pin-fix commit 87181b1: a `-m "$(cat <<'EOF' …)"`
with apostrophes in BOTH the subject and body blew up with
`unexpected EOF …` even under a quoted heredoc delimiter, because the
outer harness layer re-wraps the whole command). Recurrence count of
the root trap is now SEVEN (two 2026-09-30, 2026-10-01 late night,
2026-10-01 night rdpin-scroll hed-slot fix commit 0f8eca0 — the
recovery that time was precisely safe form 1: one plain double-quoted
single-line -m carrying apostrophes landed CLEAN; apostrophes are
literal inside double quotes and only break under the $(cat <<
wrapper, not in a literal -m string — and 2026-10-01 evening, the
cyc-rings commit 6619fb2: apostrophes in the body again, `unexpected
EOF looking for matching '`; recovered with the scratch-file -F form,
message written with write_file to `.matilda/commitmsg-cyc-rings.txt`
— same pattern as the pre-existing `commitmsg-cycles-url-test.txt` —
and 2026-10-02, the Past-cycles story-freeze commit 8f96b5b: the body
carried BOTH double-quoted phrases and apostrophes and the harness's
own bash -c wrapper rejected the line (`unexpected EOF while looking
for matching ''`) — recovered with the scratch-file -F form again,
plus ONE new wrinkle: write_file to /tmp is REFUSED in BOGAN mode
("out-of-workspace write" — the workspace root must contain it), so
the scratch file has to live inside the repo;
`.matilda/.commit-msg-tmp` worked — commit, `rm` it, done; SEVENTH
recurrence same day, the cyc-chipmove headroom-refit commit a8e9b41 —
apostrophes in subject and body again, same `unexpected EOF`, same
recovery: write_file to repo-root `.commit-msg-*.tmp`, `git commit -F`,
`rm`; EIGHTH 2026-10-02, the hero-overlay restyle commit 96409fe —
`git commit -m "$(cat <<'EOF' …)"` with a user-quoted report and
apostrophes in the body blew up with `unexpected EOF` despite the
quoted delimiter; `/tmp` retry refused in BOGAN mode, so the message
went to `.matilda/scratch-ext-overlay-commit.txt` via write_file,
`git commit -F`, `rm`; NINTH 2026-10-02 afternoon, the rd-polls
out-of-flow ½ commit 28c47d4 — `-m "$(cat <<'EOF' …)"` with
double-quoted phrases in the subject and body, same `unexpected EOF`,
same recovery: `.matilda/commit-msg-scratch.txt` via write_file,
`git commit -F`, `rm`. The scratch-file -F form is now the DEFAULT for
any message carrying quotes — don't try heredoc-in-substitution at
all).

Check `git log -n 1 --oneline` afterwards — this failure mode leaves the
commit silently unmade, and "staging intact" holds ONLY when the `git
add` ran in an EARLIER call: the parse failure kills the whole command
line, so a same-line `git add … && git commit -m "$(cat <<'EOF' …)"`
never stages anything either (hit 2026-09-30). The follow-on trap is
worse than the failure — the plain -m retry then fires a bare `git
commit` that the repo's hooks let through as an EMPTY commit (0 files,
landed as 6ef0c47), which sailed to origin on the next push. Defence:
stage in its own call, and after any commit whose chain hiccupped run
`git show --stat` BEFORE pushing — 0 insertions/0 deletions means
`git reset --soft HEAD~1` and redo; once an empty commit is pushed it's
harmless litter, leave it (a force-push needs the user's say-so anyway).

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

## `node -e` inline code: backtick template literals still run as shell

Bash expands backticks and `$( )` INSIDE double quotes, so a `node -e
"…"` one-liner whose JS contains a template literal with an
interpolation (`…\`${x}\`…` or `\n` sequences joined by substitution)
has the JS's `${…}` content executed BY THE SHELL before node ever
sees it. Symptom: exit 127 and nonsense like `odemeter: command not
found` (hit twice 2026-10-01 building a rug-payload probe inline —
the template literal's `$()` fragment was a partial identifier).
Fix: don't fight the quoting — never inline a `node -e` that contains
backticks/`${}`. Write the probe as a `.mjs` file (`.matilda/probe/
<id>/…`) and run `node file.mjs`; zero shell quoting anywhere. Single
quoted `node -e '…'` survives backticks but then any apostrophe in the
JS is the next trap — the scratch file is the robust end state.

## A sed/grep pattern spanning two source lines silently matches nothing

The hashed asset sources (`.build/newtracker/assets/<uuid>.js`) are JSX where
copy wraps at ~90 columns, so a user-quoted phrase can straddle a newline
("…political sentiment, of how\n      Australians intend to vote, and their
views…"). A single-line `sed -i '' 's/how Australians intend to vote, and
their views/…/'` matches ZERO — and in an `&&` chain the quiet zero exit
either shrugs through or the follow-up `grep -c` returning 1 kills the chain
MID-SWEEP, half-applied (hit 2026-10-02 mid-Info-About copy sweep; the first
edit of the pair landed, the second never ran, everything downstream of the
grep was skipped). Fix: `read_file` the JSX region FIRST and use the edit
tool with the real line breaks in `old_string` — never sed a user-quoted
copy phrase against the asset files without confirming it sits on one line.

## Tenth heredoc-in-substitution recurrence (2026-10-02)

The `-m "$(cat <<'EOF' …)"` commit trap recurred again the same
afternoon on the hero-key Bonham-figure commit cca68f4 — one apostrophe
in the user's quoted symptom line ("…it's actually 52.3 right now")
aborted the whole command with `unexpected EOF`. Recovery: write_file
to `.git/COMMIT_EDITMSG_MATILDA.txt`, `git commit -F`, `rm` — one new
scratch-location option: a path INSIDE `.git/` works fine (workspace-
contained for BOGAN, inherently untracked so it can never be swept
into a sibling's commit either). ELEVENTH recurrence 2026-10-02
evening, the share-card rival-contest commit 19f65cb — apostrophes
all through the body, `unexpected EOF` again; write_file to
`.matilda/commitmsg-card-contest.txt`, `git commit -F`, `rm`.
TWELFTH same night, the first-contact importer commit 04f7967 —
apostrophes in the user-quoted design line, `unexpected EOF`;
`.matilda/first-contact-commit-msg.txt` via write_file, `git commit
-F`, `rm`. THIRTEENTH 2026-10-03, the wv-rug dash-halo commit
0fd57ca — the message was planned pre-COMPACTION and the resumed
session re-issued it verbatim as `-m "$(cat <<'EOF' …)"` with
apostrophes in the body: `unexpected EOF`, nothing staged
(parse-time kill, the git add never ran either). Recovery:
write_file `.matilda/wv-ring-msg.tmp`, `git commit -F`, `rm` —
with the twist that /tmp is still refused in BOGAN mode, so the
scratch file lives repo-side as before.
Heredoc-in-substitution remains
banned for any quoted commit body; scratch-file `-F` is the default —
note it can survive a compaction boundary, since the pre-compaction
summary replays the WHOLE command (incl. the heredoc form).
FIFTEENTH 2026-10-03, the issues-facet phone-sentence commit
f4e52b3 (mid-compaction-resume again): `-m "$(cat <<'EOF' …)"`
with quoted user text and apostrophes in the body, `unexpected
EOF`; staging survived (add ran in a prior call). Recovery:
write_file `.git/ISS_SENT_MSG.txt`, `git commit -F`, `rm`; the
follow-up sentence-case commit 1c8ef8b skipped the trap
pre-emptively via `.git/SENT_CASE_MSG.txt` — the `.git/`
scratch path (documented at recurrence TEN) is now the routine
form since it is workspace-contained and never staged.
FOURTEENTH 2026-10-03, the all-polls issues-facet commit
dbac426 (mid-compaction-resume): `-m "$(cat <<'EOF' …)"` with
quoted user brief and apostrophes in the body, `unexpected EOF
while looking for matching ''' again; the staging from the
PRIOR command survived (add and commit were separate calls).
Recovery: write_file + `git commit -F` + `rm` — with a NEW
wrinkle: the obvious scratch name `.matilda/tmp-commit-msg.txt`
was ALREADY TAKEN by a live sibling session (write_file refused
the overwrite; reading it showed their pending Snapshot
commit's draft message). Namespace scratch files per task —
`.matilda/tmp-commit-msg-<feature>.txt` — the shared repo makes
even scratch-file names a collision surface (same force as
shared-repo-session-race).
SIXTEENTH 2026-10-03, the 2007-ring clamp commit cb297e7
(mid-compaction-resume again): `-m "$(cat <<'HEREDOC' …)"` with
the quoted user report + apostrophes, `unexpected EOF`, and the
parse kill took the SAME-LINE `git add` down with it — nothing
staged, exactly as documented here. Recovery: write_file, and the
namespacing rule from recurrence 14 paid off at once —
`.matilda/tmp-commit-msg.txt` was takeable only after a read (a
sibling's draft), so `--2007ring` went on the scratch name;
`git commit -F`, `rm`.
SEVENTEENTH 2026-10-03 afternoon, the vicpoll
satellite LANDING commit 69f0061: the resumed-session summary
replayed `-m "$(cat <<'EOF' …)"` whose subject carried
double-quoted user words ("given that there's…") and the body
more quoted phrases — `unexpected EOF`, nothing staged.
Recovery per the recurrence-14 rule: task-suffixed scratch name
`.matilda/vicpoll-commit-msg.txt` via write_file (BOGAN refused
/tmp first), `git commit -F`, `rm`. When a compaction summary
says "commit pending", skip re-issuing the heredoc form the
summary replays and go straight to the scratch-file `-F`.

## Background "detached" shells die with the session — nohup+disown survives

Anything launched via the Matilda background-shell tool
(`is_background: true`), even with `completion: detached`, is killed
when the chat session exits or restarts (context-compaction restarts
count). Proven 2026-10-04: an 8-hour vic-polish loop launched detached
died ~15 minutes after the turn ended, mid-round, silently — no exit
line in its log, an empty report dir for the in-flight round. The form
that empirically survives on this machine:

```
nohup bash .build/some-long-runner.sh --args </dev/null >> .build/logs/runner.out 2>&1 & disown
```

All four pieces matter: `nohup` (immune to SIGHUP), `</dev/null` (no
stdin hang), `>>log 2>&1` (output to a repo file, not the harness pipe
that dies with the session), `disown` (out of the shell's job table).
Verify it detached properly: `ps -o pid,tty= -p <pid>` shows `??` (no
controlling terminal, reparented to launchd). Check liveness by the
process FAMILY (child pids shift as it spawns workers), e.g.
`pgrep -fl "<runner-name>"`, not by one recorded pid.

## A pipe masks the exit code you actually care about

`node build && node validate && npm test 2>&1 | tail -5` printed a
clean tail and the harness reported exit 0 — but that's `tail`'s
exit code, not npm's: a failing test suite would have sailed
through hidden behind the truncation. (Hit 2026-10-03 mid-verify
of the 2007-ring clamp; the suite was green, but the status had to
be re-proven with `npm test >/dev/null 2>&1; echo $?`.) Any
verification whose output needs truncating should prove the status
separately — the grep-filter form (`… | grep PASS`) has the same
hole. `/dev/null` redirects are fine; it was the write_file-to-/tmp
form that BOGAN refused (recurrence 10 above).

## An inline `#` comment inside a one-liner eats everything after it

(2026-10-04, AEC cache-prune / mac-laptop-cleanups session): a
`for …; do … else # DOP files: check the parent …\n dz=…` form —
the `#` started a comment that swallowed the `fi`/`;;`/`esac`/`done`
terminators through to end of line, and bash died before anything ran
with `bash: -c: line 1: syntax error: unexpected end of file`. Never
put a `#` comment in the MIDDLE of a submitted one-liner. A comment is
only safe as a trailing `cmd # intentional-sleep: <reason>` at the very
end of the line (the policy-friendly sleep form), otherwise restructure
the command without it — the identical retry minus the comment ran
clean.
