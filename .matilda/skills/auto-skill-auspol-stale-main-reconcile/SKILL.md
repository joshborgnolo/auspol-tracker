---
name: auspol-stale-main-reconcile
description: auspol-tracker — multi-session repo hygiene, read side. Before re-fixing a reported bug, check whether a sibling session already shipped it to origin/main while your local main lagged behind with DUPLICATE commits of the same patches (git cherry proves patch-equivalence; rebase drops the dupes automatically). Safe reconcile recipe: snapshot porcelain → stash tracked-only (NEVER -u) → rebase → pop → comm-verify nothing vanished. Plus the forensic ladder for "files vanished from git status mid-session" (sibling relocated WIP to a worktree branch; dropped-stash objects are resurrectable by hash), and the resume-after-compaction SWEEP case: a pending staged edit of YOURS can already sit inside a sibling's pushed commit (their add-all/commit swallowed it — prove with git show HEAD:<file> | grep <unique text>, don't re-apply, commit only what remains). Worked 2026-10-05 (74ce1fa/55f209c dupes; vic WIP as vicwt-branch 1293361) and 2026-10-10 (MATILDA.md clock paragraph swept into 236b8a5, remainder committed dfcc9cc).
source: auto-skill
extracted_at: '2026-10-05T09:11:28.871Z'
---

# Stale/duplicate main reconcile + vanished-WIP forensics (shared multi-session repo)

This checkout is SHARED with sibling sessions that push from their own
worktrees (see `auto-skill-shared-repo-session-race` for the commit/push-side
races, `auto-skill-auspol-worktree-scratch-files` for the worktree loop).
This skill is the read-side mirror: triaging "is it already done?" and
safely re-aligning a stale local main WITHOUT losing anyone's dirt.

## Step 0 — is the reported bug already fixed? Check origin FIRST

Sibling sessions ship within hours, and commit messages in this repo quote
the user's report VERBATIM. Before writing any code for a fresh report:

```
git log --oneline -15 origin/main        # scan subjects for the report's words
git cat-file -t <sha>                    # object exists locally?
git branch -a --contains <sha>           # where does it live (origin/main? vic-rebuild?)
```

A fix can be fully shipped and LIVE while `HEAD -> main` sits on an older
sha: the live site deploys from origin/main. Prove the live result
headlessly FROM GIT (no browser needed):

```
git show origin/main:index.html | grep -o '<selector-text>'
```

**Gotcha that cost a cycle:** CSS selector lists in the built page span
lines and carry `body.rd` prefixes, so a pattern like
`'\.\.rd-fl-chart[^{]*{[^}]*}'` MISSES the rule entirely and falsely reads
as "fix not in the built page". Grep for the bare selector/class token
(e.g. `grep -c 'rd-fl-line'`) and read context windows with
`grep -o '.\{0,100\}TOKEN.\{0,120\}'`. (Built-page/escaping verification
generally: see auspol-built-html-verification.)

## Compaction-summary git claims are HYPOTHESES — prove every sha against git before reconciling

A context-compaction summary can assert sibling git activity with full
confidence and be WRONG — the 2026-10-09 Other-cuts ship half claimed
"a sibling session committed ea0c167 containing the generalisation mid-
flight", with a next-step plan to reconcile my staged work against it.
Every piece of evidence refuted it: `git log --oneline` showed HEAD still
at the pre-work commit (`bbc7153`), origin/main the same, and `git
cat-file -t ea0c167` the object did not exist at all. The staged
six-file set was the ONLY copy of the work — changing course would have
meant abandoning it to chase a phantom (the numbered reconstructions of
"where a sibling commit lives" in this skill all assume the object
exists); the right move was commit + push it yourself (7001f17).

Rule: ANY git-state assertion in a compaction summary — "sibling
committed X", "staged", "pushed", "stash Y holds Z" — is a hypothesis
reconstructed from partial logs, not a fact. Prove it against git BEFORE
acting: `git log --oneline -5`, `git cat-file -t <named sha>`,
`git status --porcelain`, `git stash list`. If the named object doesn't
exist, discard the reconciliation plan the summary built around it and
re-derive the next step from ACTUAL git state.

## Divergence classification: duplicates vs unique commits

When `git log origin/main..main` shows local commits AND
`git log main..origin/main` shows origin commits (diverged):

```
git cherry origin/main main     # marks each local commit:
                                #   '-' = patch-equivalent already on origin (rebase will DROP it)
                                #   '+' = unique work, must survive
git cherry main origin/main     # same read on origin's side
```

In this repo a feature is often committed TWICE: the sibling's worktree
shipped e.g. `cbb498c` to origin, while the main checkout's copy of the
same patch was committed locally as `55f209c` — same diff, different sha.
`git cherry` sees through it. If every local commit marks `-`, the
reconcile is pure bookkeeping.

## The reconcile recipe (local main follows origin; you push NOTHING)

1. **Snapshot the dirty state** — `git status --porcelain > /tmp/<tag>.txt`.
   This path list is later your proof that YOUR sequence lost nothing.
2. **Stash tracked files only** — `git stash push -m "<tag>"`. NEVER `-u`:
   untracked dirs (`.build/vic/`, `.worktrees/`, new untracked skill
   folders, sibling scratch) must stay exactly where they are. Then
   `git stash list` to note YOUR entry (sibling stashes accumulate here —
   seven pre-existed in the worked session; only ever pop YOURS, and
   identify it by message, not `stash@{0}`).
3. **Rebase** — `git rebase origin/main`. Patch-duplicates drop with
   `warning: skipped previously applied commit <sha>`; HEAD lands on the
   origin tip. Verify: `git cherry origin/main main` prints nothing,
   `git diff main origin/main` empty.
4. **Pop** — `git stash pop`. Overlaps between the WIP and the newly
   landed upstream commits resolve keep-BOTH-sides (upstream feature +
   in-progress dirt), never discard either.
5. **Verify nothing vanished** —

   ```
   comm -23 <(awk '{print substr($0,4)}' /tmp/<tag>.txt | sort -u) \
            <(git status --porcelain | awk '{print substr($0,4)}' | sort -u)
   ```

   EMPTY output = every pre-op dirty path is still dirty. Also confirm
   `git stash list` shows only the pre-existing sibling stashes.

## Forensic ladder: files VANISHED from git status mid-session

Files that were ` M` in an early survey can drop out of `git status`
between two of your own commands (a sibling is active in the same tree).
HEAD unmoved + no commit of yours = work the ladder IN ORDER before
concluding loss:

1. **Stash timeline** — `git stash list --date=iso`. No new stash in the
   window ⇒ nothing was parked by stash-cycling (the cyc-ctls variant in
   shared-repo-session-race). In the worked session the newest stash was
   days old — eliminated.
2. **Sibling worktrees** — `git worktree list`; for each suspicious one
   `git -C <path> status --porcelain` and `git -C <path> log --oneline -3`.
   In the worked session the vic-satellite session had RELOCATED its own
   WIP out of the shared checkout into its worktree branch as commit
   `1293361` ("WIP ... not for push"), even `mv`-ing `.build/vic/` out of
   the main tree. `git show --stat <their-sha>` listed the vanished files
   with line counts matching the session-start `git status` snapshot
   **exactly** (rd-panels.jsx 252, build.mjs 189, flows.mjs 13...) —
   relocation proved, zero loss. Keep the frozen conversation-start git
   status: it is evidence.
3. **Dropped-stash resurrection** — the full stash commit hash prints on
   `Dropped stash@{0} (<sha>)`, and the object survives the drop. Two
   diffs adjudicate everything:
   - `git diff <base> <stash-sha> -- <paths>` EMPTY ⇒ those files were
     NOT dirty at stash time ⇒ they vanished BEFORE your stash (your
     round-trip is exonerated).
   - `git diff <stash-sha> HEAD -- <paths>` ⇒ shows what current HEAD has
     that the stash lacked. Read hunks: if every `-`/`+` is upstream
     feature text (commit messages of the new origin commits name the
     features), the vanished WIP was an earlier draft of work that
     shipped; any leftover unique hunk is genuine loss to re-apply
     (`git diff <base> <stash-sha> | git apply --3way`).
4. **Upstream coverage check** — `git diff <old-base> origin/main --stat
   -- <vanished paths>`. Files upstream touched = their dirty drafts
   shipped. Files upstream did NOT touch = the real risk set; those MUST
   be found via (2) or (3). In the worked session all 6 uncovered files
   were inside sibling commit 1293361.

## Reporting shape

Answer the user's actual question first (bug: done/not-done, where the
fix commit lives, live-or-not), then the reconcile result (old sha → new
sha, N duplicates dropped), then ANY directory-level surprises with their
owner and location ("your vic WIP is now on the vicwt branch at 1293361,
relocated by its sibling session; nothing lost"), then what dirt you left
exactly as found.
