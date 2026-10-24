---
name: auspol-branch-merge-land-race
description: auspol-tracker — landing YOUR committed worktree ship-branch into the shared main checkout after a sibling land-race (worked 2026-10-11, tab-pages branch 87524cb merged as 4291be9). Local main is N commits behind origin and your ship branch is based on the OLD tip: park the sibling-dirty files blocking `git merge --ff-only origin/main` by MEASURED distance (git diff origin/main -- <file>; 0 diff-lines = landed duplicate → git restore; unique WIP → named "hold:" stash, never silently discard), rm stale UNTRACKED generated dirs the branch adds (allpolls/ cycles/ info/) or the merge aborts, resolve generated-file conflicts by REGENERATING (federal + BUILD_JUR=vic + site-shell), UNION-merge probe conflicts (keep origin's restructure + re-apply your conversion over it), then full npm test on the merged tree BEFORE pushing. PLUS the worktree-direct variant (worked 2026-10-22, direction-merged-groups 65511a95→3aeb91ae): a plain `git push origin HEAD:main` from the worktree is the fast land, but verify `git ls-remote origin main` right before — a `+old…new forced` push over sibling commits means you just clobbered them, and the recovery is merge-the-clobbered-sha-back + regenerate + amend + re-test + fast-forward push. PLUS the ORIGIN-IN-BRANCH lane (worked 2026-10-24, pcti regen land 11bacefc): you already merged origin/main INTO your branch, so merge-base(HEAD, origin/main)==origin tip and the whole land IS `git push origin HEAD:<branch>` + `git push origin HEAD:main` — no main checkout, no sibling-dirt parking, tests run where you stand. PLUS the MID-MERGE CONCLUSION entry into that lane (worked 2026-10-24, merge 47ffe8ed): a sibling can leave .git/MERGE_HEAD + the full resolution STAGED but never committed — "fatal: cannot do a partial commit during a merge" blocks any commit of only your files, so verify the staged resolution, conclude with a plain `git commit` (git reuses MERGE_MSG), and re-check `git log` for followers (11bacefc landed mid-gate) before staging anything. Companion: auspol-clean-artifact-commit (the pre-merge slice/park step), ci-main-writer-races (push side).
source: auto-skill
extracted_at: '2026-10-11T00:00:00.000Z'
---

# Merging your ship-branch through a sibling land-race (write-side land step)

The setup: you built and committed a feature in a clean worktree
(`git stash push --staged` slice → fresh worktree → apply → npm test green →
commit — the auspol-clean-artifact-commit loop). While you were working, a
sibling session landed several squashed commits to origin/main, and the MAIN
checkout still carries sibling dirt (uncommitted WIP, some of it superseded
by what origin now holds). Local main is behind; your ship branch is based
on the old tip. This is the recipe for landing it without destroying anyone's
WIP. Worked 2026-10-11: `worktree-tabpages-ship` (87524cb) onto `910e613`,
merge commit `4291be9`, pushed, live-verified.

## Step 1 — unblock `git merge --ff-only origin/main` by MEASURED parking

The FF merge aborts with "Your local changes to the following files would be
overwritten by merge: <files>" when sibling dirt occupies files origin's
commits touch. For EACH named file, measure its dirty distance to origin
rather than guessing ownership:

```bash
git diff origin/main -- <file> | wc -l
```

- **0 lines** — the dirt is byte-identical to what origin landed (the sibling
  already shipped it): `git restore -- <file>` freely.
- **Non-zero** — genuinely-unlanded or regressive WIP. NEVER `git restore`
  and never silently discard: park it in a NAMED hold stash —
  `git stash push -m "hold: sibling WIP superseded by origin <sha-range>
  (<why>); retained for diff-vs-origin review" -- <files…>`. The repo already
  carries "hold:"-precedent stashes; the message must name the origin commits
  that supposedly supersede it so the owner can adjudicate later. In the
  worked session the sibling's deff-backtest predicate strip CONTRADICTED
  origin HEAD's predicate (local parity failures, clean-tree parity green) —
  parked, not deleted.
- Files the FF doesn't touch (other houses' dirt, probe residue, SKILL.md
  edits) — leave untouched.

## Step 2 — remove stale UNTRACKED generated dirs before the branch merge

If your earlier in-place experiment (pre-worktree) ran builds in the main
checkout, it left UNTRACKED generated outputs whose tracked versions your
ship branch now adds. The merge aborts: "The following untracked working
tree files would be overwritten by merge: allpolls/index.html cycles/index.html
…". They are reproducible build products — `rm -rf allpolls cycles info
vic/allpolls vic/info` and re-run the merge. Only do this when you KNOW the
dirs are yours and derivable (`node .build/newtracker/build.mjs` regenerates
them); never rm untracked dirs of unknown provenance (see
auspol-stale-main-reconcile's forensic ladder first).

## Step 3 — conflict resolution: regenerate, never textual-merge, except probes

- **Generated files** (`index.html`, `vic/index.html`, tab-page dirs,
  sitemap): `git checkout --theirs|--ours` whichever side — the content is
  decided by step 4's rebuild, so either side dissolves. `git add` it.
- **`.build/newtracker/assets/rd.css` and rd-*.jsx sources**: auto-merged
  cleanly when the two sides' hunks sit in disjoint regions (worked here —
  origin's repaint hunks vs the tab flex-wrap hunk). If they conflict,
  union by hand.
- **Tracked probes** (`.matilda/probe/*.mjs` — gitignored dir, tracked
  files, always `git add -f`): when ORIGIN restructured the probe (a feature
  reshape shipped) and YOUR branch converted its mechanical layer (the worked
  case: the probe fleet's `#cycles` → `/cycles/` URL conversion), the union
  is: keep origin's new structure VERBATIM, then re-apply your conversion OVER
  it (both `page.goto` call sites, the new cohort selectors, the header
  comment's page reference). Sweep afterwards:
  `grep -n '<<<<<<<\|=======$\|>>>>>>>\|PAGE *+\|#allpolls' file` — zero
  hits everywhere = clean.

## Step 4 — regenerate ALL artifacts on the merged tree, then commit the merge

```bash
node .build/newtracker/build.mjs            # federal (index.html, tab dirs, feed, sitemap)
BUILD_JUR=vic node .build/newtracker/build.mjs  # vic/index.html + vic tab pages
node .build/site-shell.mjs                  # satellites re-apply
```

Stage the regenerated paths, `git commit` the merge (write the message to a
repo file with write_file and `git commit -F` — long heredoc subjects inside
run_shell_command get mangled; see shell-command-pitfalls).

## Step 5 — verify on the MERGED tree, then push plainly

- Full `npm test` on the merged tree is the gate — especially any parity
  test whose local failures were caused by the parked sibling dirt (the
  clean-tree parity run proves the dirt, not the estimator, was at fault;
  the merged-tree run proves the land is green).
- Push with plain `git push origin main` — do NOT `bash
  .build/git-push-main.sh`: it is a sourced library, the bash invocation
  exits 0 having pushed nothing (silent signature: zero output + status
  still `[ahead N]`; ci-main-writer-races pins this).
- Clean up: drop the superseded pre-merge slice stash (`git stash stash@{N}`
  by MESSAGE, not index — verify with `git stash list` first), exit/remove
  the worktree (one untracked `.matilda-session` marker is the only expected
  holdout; discard it), and — leave the parked hold stash IN PLACE for its
  owner.
- Live-site smoke after Pages deploys: curl each new URL for a 200 and a
  per-page `<title>`.

## Direct worktree push (skipping the main checkout) + the clobber recovery

When the main checkout is too dirty to park cheaply, you can land straight
FROM THE WORKTREE: commit there, then `git push origin HEAD:main`. From a
worktree, pushing the branch name alone usually doesn't resolve the way
you expect (the branch isn't the worktree's checkout), so use the explicit
`HEAD:main` refspec.

The FAILURE MODE reads in the push output: worked 2026-10-22
(direction-merged-groups 65511a95), the branch sat on aa7905c4 while
origin/main had raced to 88300b8e (two sibling flow-explainer commits).
A `+`-prefixed/forced push replaced them:

    + 88300b8e...65511a95 HEAD -> main (forced update)

If you see `forced update` with an `old` sha that ISN'T your parent: you
just deleted sibling commits from main. Recover immediately, in this order:

1. `git fetch origin` — the clobbered commits remain fetchable from the
   remote object store (nothing was deleted, only the ref moved).
2. In the worktree: `git merge --no-ff <clobbered-sha> -m "Merge main's
   …"` — source hunks auto-merge when the lanes are disjoint (this case:
   sibling's rd-allpolls/rd.css/explainer probes vs my rd-panels/gen-data
   direction-groups); the generated tab docs only carried ~6-line build-id
   conflicts that git textually resolves fine.
3. Regenerate on the merged tree: `node .build/newtracker/build.mjs` then
   `npm run build:vic`. A stale-glyph favicon warning is normal when no
   glyph changed.
4. `git add -u` the regenerated pages; `git commit --amend --no-edit` the
   merge so the merge commit carries the coherent build. My first amend
   left sixteen ` M` `*/index.html` behind — `git status --porcelain`
   must be CLEAN before you test or push.
5. Full `npm test` on the merged tree — exit 0 is the gate; this is what
   proves the union (incl. the rewritten direction-groups test + vic JUR
   gate) is coherent.
6. `git ls-remote origin main` — if the remote still sits at YOUR
   pre-merge sha, `git push origin HEAD:main` is now a clean fast-forward
   (`old..new`, no `forced`). If the remote moved again, another sibling
   landed: repeat from step 2 with the new sha — never force again.
7. Probe the live site once Pages deploys (~90s) — dir-gdot-hover against
   auspoltracker.com was ALL CLEAN on the merged land.

PREVENT it: `git ls-remote origin main` within a breath before ANY
worktree push; if its sha ≠ the tip you fetched, merge/rebase it BEFORE
pushing. The sibling's two commits dated the same minute as my push — a
~30 s race window decided it. And never add `+` to the refSpec "just in
case": a plain push REFUSES non-ff and forces you to look, which is the
safety you want.

## Origin-in-branch lane: the land is a push (worked 2026-10-24, 11bacefc)

The cleanest endgame is reached when the LAND phase's merges all happened
on YOUR branch: you ran `git fetch && git merge origin/main` on the branch,
resolved, regenerated + tested there, and left local main wherever it is.
Then `git merge-base HEAD origin/main` == the origin tip, and
`git push origin HEAD:main` is a plain fast-forward — **the land is the
push**. No main checkout, no ff-only dance, no parking of main-checkout
sibling dirt (steps 1–2 above never happen), and the npm-suite gate runs
on the same working tree you're standing in. Sequence:

1. Resume / verify state FIRST — don't re-do work the merge commit already
   holds. `git merge-base HEAD origin/main | xargs git log --oneline -1`
   (if that IS the origin tip, you're in this lane), `git log --oneline
   -6`, then read what the merge commit itself resolved:
   `git show <merge-sha>:.build/<source> | grep -n <feature>`. Worked case:
   post-compaction, the pcti re-base looked uncommitted — but `47ffe8ed`'s
   conflict resolution already carried the re-based source lane; only the
   DOWNSTREAM regenerated artefacts (data stores, built pages, test
   mirrors) were uncommitted dirty. Re-deriving the sources would have
   double-patched them.
2. `npm test` + `validate.mjs` on the dirty tree (it IS the candidate).
3. Commit ONLY owned paths — explicit pathspecs, never `-A`; sibling WIP
   lanes (here: the seat-model voter-footprint files) stay dirty. Traps
   that surfaced: `.build/vic/out/` is a gitignored dir with force-tracked
   members and appears as pre-staged `M ` — it is NOT in `git-push-main.sh`'s
   SITE_FILES (writers never commit it), so `git restore --staged` it and
   leave it dirty; and `git commit -m "$(cat <<'EOF'…)"` leaked the
   terminator into the message (step 4's -F rule — fix with `git commit
   --amend -m "…"` while the sha is still unpushed).
4. Push branch first, race-check, push main:
   `git push origin HEAD:allseats-class-flows` → `git ls-remote origin
   main` (must still be the merge-base; anything else = sibling landed,
   back to fetch+merge) → `git push origin HEAD:main`. Output line
   `faa48108..11bacefc  HEAD -> main` with no `forced` = clean land.
5. Live smoke by BYTE-EQUALITY, stronger than a 200: Pages deploys in
   ~90 s (a standalone `sleep 90` call with the intentional-sleep
   comment), then `curl -s https://auspoltracker.com/ | shasum -a 256`
   vs `shasum -a 256 index.html` — identical hashes prove the deploy IS
   your commit. Then 200-probe the feature's pages
   (`/flows-explained/`, `/vic/`).

## Concluding a sibling's ABANDONED mid-merge state (worked 2026-10-24, 47ffe8ed)

The other 2026-10-24 entry into the origin-in-branch lane: you resume
(post-compaction or fresh session) and find the branch mid-merge —
`.git/MERGE_HEAD` + `.git/MERGE_MSG` present, the full conflict resolution
STAGED (41 files +32k/−3.9k here), but the merge commit never written: the
sibling session died between resolve and commit. Symptoms:

- `git commit -o -- <only-my-unstaged-files>` → "fatal: cannot do a partial
  commit during a merge". NOTHING about your files can bypass the in-flight
  merge; -o pathspec commits are legal again only after it's concluded.
- `git log --oneline HEAD..MERGE_HEAD` shows what's being pulled in;
  `.git/MERGE_MSG` carries the conflicted-path list verbatim.

Procedure (verify-then-conclude — the user's approved option wording):

1. **Verify the staged resolution IS consistent before writing anything.**
   Run validate.mjs plus every test suite named by the conflicted paths
   (watch subdirs: test-booth-seifa-voter.mjs lives in
   `.build/analysis/seat-model/`, a bare `node .build/<name>` is
   MODULE_NOT_FOUND and a `node a && node b && …` chain reports the FIRST
   failure's exit code only). The check that counts: `node
   .build/newtracker/build.mjs` + `BUILD_JUR=vic node …`, then
   `git status --porcelain` — if the REBUILT generated pages come back
   byte-identical to the STAGED ones, the sibling resolved generated files
   by regenerating on merged sources (trustworthy). In the worked run the
   tree instead held regenerated data stores + test mirrors UNSTAGED beyond
   the staged set — the sibling's downstream regen still in flight: run
   the suites against that combined tree and expect it to land as a
   follow-up commit (it did — 11bacefc, six minutes later). Sibling
   untracked corpora are huge (~600 state-flow-src `??` lines here); filter
   with `git status --porcelain | grep -v '^??'` before any judgement.
2. **Conclude with a plain `git commit`** (or `-m "Merge remote-tracking
   branch 'origin/main' into <branch>"`): git reuses `.git/MERGE_MSG`'s
   exact text and MERGE_HEAD becomes second parent. Keep the standard
   message — 44aae9a/dcdd3042/47ffe8ed all read the same line, and the
   repair/land scripts pattern-match merge subjects.
3. **Re-check `git log --oneline -6` before your next stage/commit** —
   sessions overlap by minutes, and a follower can land DURING your npm
   test gate (here the sibling's regen follow-up 11bacefc arrived between
   my verify and my commit). Consequences: (a) if what you meant to fold
   into the merge commit is now ITS OWN commit on top, amend nothing —
   stacking beats rewriting a merge commit anything else already builds on;
   `git log <merge>^..HEAD --oneline` shows descendants at a glance. (b)
   Reclassify leftover unstaged files against the merge's PARENTS before
   claiming them: `git diff <merge>^1 <merge> -- <file>` then `^2` — debris
   of resolution shows as merge-included, fresh WIP shows as extra.
4. Now `-o`/pathspec commits work again: `git add` only your own
   unstaged files (terminal six were committed with explicit pathspecs as
   3d74d6aa), leave sibling WIP (modified SKILL.md notes, the vic/out
   force-tracked bundle) dirty, run the FULL npm suite on the final tree,
   and land with the origin-in-branch push sequence above (push branch →
   `git ls-remote origin main` race-check → `git push origin HEAD:main` —
   `11bacefc..3d74d6aa HEAD -> main` with no `forced`).

## Related

- auspol-clean-artifact-commit — produces the ship branch this skill lands.
- ci-main-writer-races — the same-area sibling REPEAT-race rebase loop (push
  side), the push_main library gotcha.
- auspol-stale-main-reconcile — read-side "did the sibling already ship it?".
