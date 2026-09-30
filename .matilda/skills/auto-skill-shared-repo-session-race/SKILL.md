---
name: shared-repo-session-race
description: Shared auspol repo — sibling Matilda sessions can sweep YOUR uncommitted work into their commits (git add -A), overwrite your staged index entries, and even land their half-finished hunks INSIDE files you're editing. Locate vanished work by unique phrase; never rebase-split a sibling commit; for contaminated shared sources, re-derive clean copies (sed-revert their hunks, diff vs HEAD to prove) and commit your exact tree through a private GIT_INDEX_FILE without touching their staging area. Also: a fresh build at HEAD can fail to reproduce HEAD's own committed generated data asset (sibling shipped mid-WIP build output) — character-diff the drift, revert the regenerated asset in the worktree, never silently roll back live numbers. If index.html itself IS the deliverable while sibling dirt sits in build inputs: /tmp-snapshot foreign files byte-exact, checkout HEAD copies, rebuild, gate on `git diff -U0 index.html | grep '^@@'` listing only your hunks, PATHSPEC-commit (`git commit -m msg -- <paths>`), push, restore snapshots. Foreign STAGED revert in the index: staged blobs hash-equal HEAD~1 (diff the INDEX, not worktree), prepare HEAD+mine file versions in scratch, plumbing-commit via private GIT_INDEX_FILE (read-tree/write-tree/commit-tree/update-ref, explicit pathspecs never bare -A) so the revert stays staged — post-commit `git status` inversion showing your files as D/M is cosmetic when it's unstaged-direction, never `git reset` to fix THAT; but after HEAD moves past the sibling's stale index, STAGED deletions of your newly tracked files are NOT cosmetic (their next blind commit deletes your feature) — sweep with `git reset -q HEAD --` on exactly those paths, never their revert files. Sibling RESETS your committed work OFF main (survives on a dangling branch; committed files turn untracked while "up to date with origin" — reflog + merge-base confirm): re-land by cherry-picking the orphan inside a DETACHED scratch worktree (zero-drift rebuild is the gate), move main via plumbing update-ref, re-replay cheaply when origin races mid-landing. Sibling hunks staged INSIDE your data file (MM) + data-only deliverable: snapshot the commixed file, checkout HEAD copy, re-apply ONLY your rows, pathspec-commit (replaces that path's index entry — restore the snapshot post-push so their hunks return), and SKIP the index.html rebuild that would compile their template/gen-data WIP into the live site — a data-only commit keeps site-check green and the next pipeline build ships the rows. Sibling staged rollback in the SAME source file you must extend: park BOTH a patch and a same-version reference copy in /tmp, reset exactly that file, pathspec-commit your feature at HEAD, then restore their hunks — if `git apply` fails from drifting context, re-apply manually and prove reference-vs-worktree is exactly your feature before restaging. Origin ahead of local + dirt everywhere + tiny deliverable: detached worktree at the explicit REMOTE sha inside the workspace, build/validate/commit there, `git push origin HEAD:main` — local tree and shared index never touched; old git needs the sha (not `origin/main`) and has no worktree-remove. A crashed commit/amend/reset dance can roll the INDEX back instead (mixed reset = HEAD+index, worktree stays): a SHIPPED feature then masquerades as an uncommitted half-built one (`git diff HEAD` empty, staged diffstat exact-mirrors unstaged, feature commits found via `git log --oneline -- <file>`, reflog shows `reset: moving to`); unstage with `git reset -q HEAD -- <paths>`, never commit it. Machine git is 2.15.0: `git restore` is ABSENT, and `git checkout HEAD -- <paths>` repairs staged file deletions (index entry + worktree in one command). Sibling amend/reset/push races past YOUR pushed data commit while your build commit sits prepared in a detached worktree: survival check is `git merge-base --is-ancestor <yours> origin/main` + row greps on the pushed tree + blob equality (`git hash-object <worktree-output>` == `git rev-parse origin/main:<asset-path>`) — their own rebuild regenerated the content-addressed sidecar byte-identically, so the correct finish is NO commit: prune the worktree and report; amend+`reset: moving to HEAD` in the reflog does NOT mean your commit is gone, only ancestry proof settles it. Beware dead-worktree git-fallback (2026-09-05): a worktree that lost its .git gitdir FILE silently resolves all git commands against the MAIN repo (toplevel falls back to the parent through the gitignored `.matilda/worktrees/` gap) — status/diff then show foreign main-tree state as if it were worktree state, and a repo-wide `git reset --hard` from inside wipes EVERY sibling's uncommitted WIP; verify `git rev-parse --absolute-git-dir` contains `.git/worktrees/<name>` before any mutating command, and recover post-mortem via `git fsck --lost-found` (staged content survives as dangling blobs/commits; purely unstaged WIP is unrecoverable). Happy-path variant (2026-09-07): upstream commits landed coherently while YOUR feature sat uncommitted and your index.html was built pre-upstream — staging that stale artifact silently reverts their committed hunks, so `git show --stat` classify overlap (same-artifact or build-input touch = rebuild in place), marker-grep the rebuilt artifact BOTH directions (their method name from their commit subject survives; your feature string present), confirm `git diff --stat HEAD` is insertions-dominated, then stage explicit paths and push. In-place rebuild is correct ONLY because their work is committed; uncommitted dirt in build inputs still needs the isolation machinery. One-liner source change whose compiled form is known-exact: skip rebuilding entirely — scratch-copy `git show HEAD:<file>` + your hunk into .matilda/, hash-object, commit through a private GIT_INDEX_FILE (cacheinfo order is <mode>,<sha>,<path>); empty `git diff` + M-status means a sibling STAGED your files — read `git diff --cached` before anything else. Lightest isolation form (2026-09-29): ONE foreign tracked file in the build inputs — `git stash push -- <foreign>`, rebuild, commit your exact paths, `git stash pop`; git parks byte-exact and the sibling's WIP returns untouched. Scaled same day (21 foreign paths + a foreign-baked index.html to `git checkout --` discard before rebuilding, probes re-run on the CLEAN build): `git stash pop` can abort 'Entry … would be overwritten by merge' when the LIVE sibling re-writes a stashed file during the hold — never checkout-revert their live copies to force it; restore only uncontested paths with `git checkout stash@{0} -- <paths>` (this STAGES — `git reset -q --` them back to plain WIP), leave the sibling's fresh files alone, and keep stash@{0} as their parked superseded copies, reported in the summary. Inverse race same session: a user-requested `git push` reported "Everything up-to-date" because the sibling (or CI push_main) had committed their features and pushed — your still-unpushed commits ride along as fast-forward ancestors (your hashes appear UNDER foreign commits in `git log`; nothing to do but report whose push shipped them). Verifying in the live tree can BE the contaminator: npm test RUNS build.mjs, leaving index.html with sibling WIP compiled in — split verification from artifact production: fresh checkout-index at CURRENT HEAD (earlier scratch snapshots go stale when HEAD moves mid-task; in-repo scratch dirs resolve root node_modules by ancestor-walk, no install needed), gate on `git show HEAD:index.html | diff - <snap>/index.html` printing ONLY your hunks, then plumbing-commit both files via private GIT_INDEX_FILE. 2026-09-30: checkout-index is itself polluted — it reads the LIVE SHARED INDEX, so sibling-STAGED file versions silently overwrite HEAD copies in the snapshot (first clean room shipped 67 spurious diff lines incl. a deletion of the previous rung's hover block); snapshot with `git archive HEAD | tar -x -C <snap>` (HEAD tree only, index is irrelevant), pin the manifest by hashing every file pre/post build, and let the gate carry INTENTIONAL `^<` lines (enumerate them — one per deliberate in-place replacement like a ref prop swap) instead of requiring zero. Sources-only deliverable (2026-09-30, 89fde66) whose rebuild compiled a sibling's UNCOMMITTED build-input WIP (rd.jsx/rd-allpolls.jsx focus hunks) into index.html: audit the artefact first (`git diff index.html | grep '^[+-]'` — foreign hunks out themselves), then `git checkout -- index.html` the contaminated rebuild and pathspec-commit sources + probe alone (c7e06d7 precedent: the regenerated artefact legitimately lands with the sibling's or CI's next rebuild; report that the copy is not live until then). Push then rejected on a fresh CI data commit + rebase refused on the dirty tree (~26 foreign paths): plain `git stash push` (nothing staged of yours left), rebase, push, `git stash pop` — sibling WIP returns byte-exact.
source: auto-skill
extracted_at: '2026-09-04T04:00:29.830Z'
---

# Shared-repo session race: your uncommitted work can ship under a sibling's commit

## What happened (2 Sep 2026, auspol-tracker)

Task in flight: commit + push an uncommitted glossary edit (one hunk in
`assets/d1a1d215-…js` + its built line in `index.html`). Between turns,
a sibling session landed its `houseLean` WIP in the same tree, then ran a
sweep-style commit (`a4618f3`) that absorbed **my unstaged changes** into
ITS feature commit — then pushed while I was still verifying. My push
returned "Everything up-to-date": origin/main had moved without my fetch
because both sessions share one `.git`.

Neither sweep direction errors or warns. The user-level skill
`git-prestaged-commit-sweep` covers MY commit vacuuming THEIR staged work;
this is the reverse — unstaged work is not safe either, `git add -A` /
`git commit -a` in a sibling session takes it, and its commit message will
describe only the sibling's feature.

## Diagnosis signatures

- `git status` no longer shows your files but you never committed →
  `git log --oneline -2`; HEAD moved. Your work is inside their commit.
- **Locate your work by a unique phrase**, not by filename:
  `git grep -c '<phrase>' HEAD -- .` and `grep -c <file>` on the working
  tree. Rule out stashing with `git stash list` then
  `git stash show stash@{N} -p | grep -c '<phrase>'` (sessions here
  genuinely stash each other's WIP — stash@{0} was labelled
  "other-session WIP held aside").
- Mixed source file: `git diff <asset>` shows their 130-line feature +
  your one hunk in the SAME asset (here: HouseLeanPanel + glossary term
  both in d1a1d215). Whole-file `git add` would ship their unstaged WIP.
- Push race: `git log origin/main..HEAD` lists unpushed commits, then
  `git push` says "Everything up-to-date" seconds later → sibling pushed.
  Confirm with `git status -sb` (`## main...origin/main`, no ahead count).
- **Mid-build head-slip (2026-09-02 variant)**: sibling can also commit
  and push its OWN finished work on top of your pushed commit WHILE you
  are mid-edit. Signature here is a data-artifact surprise, not vanished
  work: the build emits a `cycle-source.<hash>.json` that doesn't match
  the hash in HEAD even though you changed no data — because HEAD is no
  longer the commit you fetched. Response: `git log --oneline -3` first,
  confirm the intervening commit is coherent (contains its own rebuilt
  cycle-source + index.html), and verify YOUR rebuild reproduces the
  sibling's hash byte-identically (`git status` then shows the asset
  untouched) — if it does, there is no collision; commit only your
  source/asset deltas on top. Do NOT "fix" a hash mismatch by reverting
  to the hash from YOUR stale snapshot.

## Procedure when this bites

1. **Re-check `git log` + `git status` immediately before staging/committing** —
   the tree moves between turns, and crossing a context-compaction boundary
   is the riskiest moment (the snapshot's plan was already obsolete).
2. If your work is inside THEIR commit: check coherence (their stat should
   carry sources AND generated artifacts together — here gen-data.mjs +
   9f09dca2 + d1a1d215 + template.html + index.html in one commit), run
   `node .build/newtracker/validate.mjs`, verify your text survived into
   the built index.html (babel escapes unicode; grep the escaped phrase).
3. **Never rebase-split or amend the sibling's commit** — the session is
   live and the commit may already be pushed. Entangled-but-green beats
   surgically-separate.
4. Push if still unpushed and push-authorised, else confirm their push
   landed. Then report the entanglement to the user: which commit and
   whose push shipped your work.
5. Prevention on MY side: stage exact paths, never `-A`/`-a`; if I must
   commit a subset of one file, filter hunks non-interactively —
   `git diff -- <file> | awk '<pick hunks matching my phrase, keep file
   header>' | git apply --cached` then eyeball `git diff --cached` before
   committing. (Prepared here; pre-empted by the sibling commit.)
   2026-09-28 working recipe (shipped in the 36e73c3 tally commit, kept a
   sibling's RdHero hunk OUT of my index.html staging):
   `git diff -- <paths> | awk 'BEGIN { keep = 1 } /^@@/ { keep = ($0 !~ /<foreign marker>/) } keep' > /tmp/x.diff`
   — drop foreign hunks by their `@@ … @@` CONTEXT HEADER (e.g. the
   sibling's `function RdHero(p)`), and the `BEGIN { keep = 1 }` seed is
   load-bearing: awk booleans default falsy, so a naive flag swallows the
   diff's file-header lines before the first hunk and `git apply` dies
   "patch fragment without header at line 1". `git apply --check --cached`
   first, then verify `git diff --cached | grep -c <marker>` == 0 and the
   staged path list before committing.
   2026-09-30 POSITIVE-match variant (foreign hunks outnumber yours —
   sibling's whole RdDemographics state-ring feature in your file, you
   have one line): keep only the hunks whose `@@` OFFSET matches yours —
   `awk '/^diff --git|^index |^--- |^\\+\\+\\+ / { keep=1; print; next }
   /^@@ / { keep = ($2 ~ /^-941,/ || $2 ~ /^-65643,/); if (keep) print; next }
   keep { print }'` over the combined two-file diff. Two traps hit live:
   (a) the `@@` header belongs to its hunk — printing it unconditionally
   while skipping the body yields "corrupt patch" (a header with counts
   promising lines that never come); (b) DON'T hand-type a single hunk
   into a heredoc patch — a hand-copied `@@` header/context drifted and
   `git apply` rejected at the hunk line; always generate the patch from
   `git diff`, never reconstruct it. Applied hunks verified by
   `git diff --cached --stat` showing exactly 2 files / 2 lines.
   Flip-side observation same session: pushing does not just face
   incoming races — your `git push` silently carries any sibling COMMIT
   ahead of origin (8bdbf23 "Heal the tests run" sat unpushed locally)
   as a fast-forward ancestor. That's expected ancestry
   semantics, not a sweep — report whose commits rode along, don't try
   to unpick them off a pushed main.

## Resume-after-compaction in the shared tree (2026-09-29 variant)

Resumed a compacted session whose summary's git snapshot ("Recent commits:
a72a0d9…", status listing `template.html` and `rd.css` modified) was stale
by TWO sibling commits — 4a8cc90 and 5f1d299 had landed in the compaction
gap, so files the snapshot called dirty were now simply HEAD, and the tree
held ~20 dirty paths of which only 13 were mine (the G4 SEC-Newgate
feature). Working procedure that shipped a92c2c2:

1. **Re-attribute ownership by diff CONTENT, never by the summary's path
   list.** `git diff <path>` on each candidate and match hunks to the
   feature intent — the d1a1d215 asset's 11-line hunk was MY Info
   "Who's best" copy update; the rest (auto-skill SKILL.md churn +
   untracked auto-skill-* dirs from sibling sessions' auto-extractor)
   belonged to nobody's commit plan.
2. **Siblings committing in the gap is not a sweep.** Vanished "modified"
   paths + `git log` showing coherent feature commits in old-HEAD..HEAD
   = normal parallel work; don't forensics it. (Mirror corollary: a
   summary-listed modified path may also be a commit the summary's own
   session already landed — check `git log -- <path>` before re-doing.)
3. Commit the verified feature IMMEDIATELY on resume — every uncommitted
   hour in the shared tree is exposure to a sibling `git add -A` sweep.
   Pre-flight: `git diff --cached` must be empty (no foreign staged
   state), stage the explicit path list, and post-commit
   `git status --porcelain | grep -c '^'` should equal the known-foreign
   count (20 here) — a lower number means your staging swept something.

## Push rejected mid-task (2026-09-03 variant): the quiet rebase, with autostash

Your commit lands fine (you staged exact paths), but `git push` returns
`! [rejected] main -> main (fetch first)` — a sibling pushed in the
seconds between your last fetch and your push. Procedure that works:

1. `git fetch`, then **diff the COMMON BASE against origin, not HEAD
   against origin**: `git log --oneline HEAD..origin/main` names the
   interloping commit; `git diff <your-parent-sha> origin/main --stat`
   shows what IT touched. (`git diff HEAD origin/main` instead shows
   YOUR feature as `-` removals — alarming and useless; both commits
   share your parent as base, so base-vs-origin is the sibling's true
   footprint.)
2. If the footprints are disjoint (their commit touched only files you
   never edited — here it was `.build/extract-demosau.mjs` alone), a
   rebase is conflict-free even when both of you "touched" the same
   repo.
3. `git rebase origin/main` will refuse with `Cannot rebase: You have
   unstaged changes` when a sibling's working-tree WIP (.matilda
   probes/skills, data files) is sitting uncommitted. Do NOT stash
   manually and risk forgetting the pop — use
   **`git rebase --autostash origin/main`**: git stashes the tracked
   unstaged changes, replays your commit, and re-applies the stash
   ("Created autostash" / "Applied autostash" in the output). Sibling
   WIP survives untouched. Untracked sibling files never block a
   rebase, so don't chase them.
4. Push. If index.html had conflicted (both sessions rebuilt in their
   commits), take either side at the conflict hunk, continue, then
   rebuild from sources and amend — index.html is generated, so the
   regenerate-and-amend route always beats hand-merging it.

## Bash hazard from the same workflow

`git commit -m "$(cat <<'EOF' … EOF)"` dies
`unexpected EOF while looking for matching '''` — and the parse failure
kills the WHOLE command line, including a `git add` earlier in it (so the
next commit attempt lies "nothing to commit"). Use
`git commit -m "title" -m "body…"`. /tmp writes are refused in BOGAN mode
for commit-msg files; chain `-m` flags instead.

## Sibling hunks INSIDE your own files + private-index commit (2026-09-03 variant)

Nastiest form yet: the sibling's in-flight feature (1993 past-cycles) was
edited directly into the SAME source files I was mid-edit on
(d1a1d215-…js, template.html) — three stray hunks ("Twelve past
elections", "since 1987", "twelve elections' worth") whose data backend
(polls.json, gen-data.mjs, cycle-source) lived elsewhere in the tree. Then
their `git add` sweep **overwrote my carefully-staged index entries**
with the dirty working-tree versions (`MM` status: staged = their dirty
version, worktree = identical). Committing ANY staged state would have
shipped their half-finished copy without its backend — a broken site.

Two failure modes of my first defence, learned the hard way:

- **Blobs from `git hash-object -w` are unreferenced and can VANISH.**
  Hashes recorded in the session notes returned
  `fatal: could not get object info` a turn later — never rely on
  recorded blob hashes across a turn; re-derive the content instead.
- **Re-derivation recipe** (deterministic): `cp` the dirty working file
  to a temp path, `sed -i ''` the sibling's exact strings back (e.g.
  'Twelve past elections'→'Eleven past elections'), then PROVE it's
  chart-only: sibling-marker greps = 0 and
  `diff <(git show HEAD:<path>) <tmpfile>` shows only your expected
  additions (here: template +6, asset +63 — matched my earlier stat).

### Clean commit without touching the shared index — GIT_INDEX_FILE

Don't fight over `.git/index` with the live sibling. Commit your exact
tree through a PRIVATE index file; `git commit` honours it and advances
HEAD, while the sibling's staging area stays byte-for-byte intact:

```bash
export GIT_INDEX_FILE="$PWD/.git/fc-index"   # any scratch name
git read-tree HEAD                            # seed private index from HEAD
for each of my files:
  git update-index --cacheinfo 100644,$(git hash-object -w <clean-copy>),<path>
git commit -m "<subject>"                     # commits private index only
unset GIT_INDEX_FILE && rm -f .git/fc-index
```

For a generated `index.html` that must pair with the sources, build it
clean-room FIRST (paths are `import.meta.url`-anchored, so builds run
from anywhere): **2026-09-30 — use `git archive HEAD | tar -x -C <snap>`,
NOT `git checkout-index --prefix=<snap>/ -a`** (see the trap section
below). Overlay your clean source copies, `node <snap>/.build/newtracker/
build.mjs` + validate there, then hash THAT output as the index.html
blob entry. Verify the built file before staging: marker greps for your
feature (watch babel unicode-escaping), zero sibling markers, and cycle/
asset hash references consistent with HEAD.

Afterward `git status` shows your committed files as unstaged-modified
(` M`) where the worktree still carries the sibling's hunks — correct;
leave their work entirely alone. Then `git fetch && git push`; if raced,
rebase as above.

## checkout-index reads the polluted shared index (2026-09-30)

The clean-room recipe above said `git checkout-index --prefix=<snap>/ -a`.
That is WRONG in a repo with a live sibling: checkout-index materialises
the SHARED INDEX, not HEAD, and sibling-staged versions silently replace
HEAD copies inside the "clean" room. Caught live: the first hover-rung
snapshot diffed 67 lines against HEAD's index.html including a spurious
deletion of the previous rung's shipped block. `git archive HEAD | tar -x
-C <snap>` is immune — it reads the HEAD tree only. Recipe that shipped
`9730f02`/`0f163f6`:

```bash
SNAP=.matilda/<task>-$(openssl rand -hex 4)
git archive HEAD | tar -x -C "$SNAP"
cp <my edited sources> "$SNAP/<same paths>"
find "$SNAP" -type f -not -path '*/node_modules/*' | xargs shasum | sort > /tmp/before
(cd "$SNAP" && node .build/newtracker/build.mjs)   # resolves root node_modules by ancestor walk
find "$SNAP" -type f -not -path '*/node_modules/*' | xargs shasum | sort > /tmp/after
# manifest diff must list ONLY index.html (and any asset the feature legitimately regenerates)
git show HEAD:index.html | diff - "$SNAP/index.html"
```

Gates, and an important generalisation: the '<'-line count need NOT be
zero when the change deliberately replaces a line (the vote-cards rung
swapped `ref={swipeMark}` → `ref={chartMark}` — compile → one
`< ref: swipeMark,` / one `> ref: chartMark,` pair). Enumerate every
`^<` line and confirm ONE per intentional replacement; additions still
purely additive otherwise. Hash the two sources from the SNAP copies too,
so sources and built artifact are provably from the same tree. Probe the
SNAP build as well as the live tree (`PROBE_ROOT=<snap> node probe.mjs`)
before plumbing-committing: it is the exact byte-set HEAD will carry.

## Post-commit sibling push mid-flight + regenerable assets (2026-09-03 late variant)

Sequence that worked cleanly when the sibling COMMITTED + PUSHED their
feature (`9f29ae5`, their own flowChart work, coherent) between my
verified-rebuild and my stage/commit:

1. **`git log --oneline -3` BEFORE "un-staging foreign hunks".** After the
   sibling push, their hunks vanished from `git diff` — not because they
   were reverted, but because they became HEAD. If I'd reset/rewritten my
   staged copies to strip "foreign" hunks, I'd have DELETED their
   committed feature from MY commit. The tell that staging was clean all
   along: `git show HEAD:<file>` already contains their markers, so the
   whole-file staged version introduces nothing new of theirs.
2. **Marker-phrase lists rot across days.** The compaction summary said
   "Twelve past elections"/"twelve elections' worth" were SIBLING hunks —
   true on 2 Sep, but by 3 Sep that exact wording was MY legit ship-copy
   for this feature (the sibling's draft had been reverted and I rewrote
   it). Filter regexes built from a stale phrase list flagged my own
   `template.html` :2101 copy as foreign. Identify hunks by diff-position
   and content-understanding, never by phrase alone.
3. **Vanished generated assets ≠ sabotage; don't archaeology.** Mid-flight
   the new `assets/cycle-source.<hash>.json` and its `.build` dev copy
   404'd / leaked into `../auspol_clean_base/` (hard-link fallout from a
   sibling working in a second worktree). Exact mechanism never resolved —
   and it needn't be. Generated artifacts are deterministic: when a
   staged-path goes missing, `node .build/newtracker/build.mjs` in the
   MAIN worktree regenerates whatever is missing (idempotent, fast),
   `node .build/newtracker/validate.mjs` proves the data, then `git add`
   the exact path again and proceed. Burning turns on WHY a regenerable
   file disappeared is the failure mode.
4. Trailing untracked files that RESPAWN after `rm` + `git clean -f`
   (here `.build/newtracker/sim-oppr-labels.mjs`, a sibling probe whose
   original survived in the other worktree via hard-links) — stop deleting,
   just never stage it; lingering in `??` forever is the correct steady
   state.
5. **The sibling's dirt can become their COMMIT between your planning and
   execution** (2026-09-03, 0ac1c14 session): mid-task I snapshotted
   `git diff template.html > /tmp/…` ahead of a clean-room isolation
   build; the snapshot came back EMPTY minutes later — `git log` showed
   the sibling had committed (and pushed) their tile-band work as
   `23e34a7` in the interim. Two consequences: (a) an empty `git diff
   <file>` against worktree that "should" be dirty is not proof of
   reversion — check `git log --oneline -3` before concluding anything;
   (b) recovery/isolation machinery built on snapshots ages in MINUTES
   against a live sibling — take snapshots as late as possible, re-run
   the diff check immediately before each irreversible step, and drop
   the clean-room plan without ceremony the moment the dirt lands as a
   coherent commit (mine did: source + built index.html together, from
   the same session's work). The simple path (edit clean HEAD, build,
   stage exact paths, commit) then needs no apology.

Ancestor technique for the snapshot route: `git worktree remove` is
UNSUPPORTED by this checkout's git (usage error) — `rm -rf` the worktree
dir plus `git worktree prune`.

## Sibling REBUILD inlines your uncommitted source into THEIR commit (2026-09-03 variant)

Subtle inverse of the sweep: you never stage anything, yet your fix still
ships early. My uncommitted edit to a PLAIN-list build source
(`.build/newtracker/assets/copy-chart.js`) was sitting in the shared
working tree when a sibling ran `build.mjs` for their own feature — the
build inlines the WORKING-TREE source, so their commit (`2976db8`)
carried a built `index.html` containing my fix while the source file in
git was still the old version. Detection: live site shows your fix but
`git log -- <source>` shows no commit; `git show HEAD:index.html |
grep -c <marker>` = 1 with the source untouched. Response: verify their
commit is coherent (`git show --stat` — sources + rebuilt index.html
together), then commit your source-file change separately so the repo
gets back to source-matches-build; do NOT try to untangle their commit.

Recovery footnotes from the same session (old git on this machine):
- `git restore` does NOT exist — use `git checkout -- <paths>`.
- `git stash push -- <deleted-file>` fails "pathspec did not match"
  (stash can't pathspec-match deleted files): `git checkout HEAD --` the
  deleted file first, then exclude it from the stash path list.
- Rebuilding while OTHER sessions' WIP sits in the tree compiles THEIR
  dirt into index.html too — before any recovery rebuild, isolate (stash
  push the foreign paths) and on any build-drift in generated assets
  (`cycle-source.<hash>.json`) revert those files before committing
  (consistent with the "sidecar rename" watch in auspol-build-pipeline).

## Sibling WIP sits in the BUILD-SYSTEM files — worktree-isolated build (2026-09-03 variant)

Variant of the rebuild hazard above: I needed a rebuild for my
copy-chart fix while a sibling's in-flight Trove feature sat dirty in
`.build/newtracker/build.mjs` (sitemap entry), `gen-data.mjs`
(troveByTerm block) and the `9f09dca2` data-asset source — all files the
build READS. Building in the main tree would have compiled their
half-feature into MY index.html commit; stashing their build files is
rude to a live session, and the untracked half (archives/trove/, data
CSVs) makes stash hygiene fragile anyway. The cleaner isolation is a
throwaway WORKTREE, not surgery on the shared tree:

1. `git worktree add --detach .matilda/worktrees/<name> HEAD` —
   detached at HEAD so no branch name is consumed; the existing
   `.matilda/worktrees/` dir is the conventional spot (already ignored).
2. `cp` ONLY my changed source file(s) into the worktree at the same
   relative path.
3. Build + validate THERE (build.mjs/gen-data.mjs paths anchor to their
   own ROOT, so builds run fine from a worktree): `validate.mjs` then
   `node .build/newtracker/build.mjs`.
4. **Prove the delta**: `git show HEAD:index.html > /tmp/base.html`
   then `diff` against the worktree's built index.html — the diff must
   be EXACTLY my change (45 lines, all inside my inlined script) and
   nothing of theirs. This is the gate that makes step 6 safe.
5. `cp` the worktree's built `index.html` back over the main tree's.
6. Main tree: `git add <my-source> index.html` (exact paths only),
   `git diff --staged --stat` sanity (2 files), commit, push.
7. Old git: `git worktree remove` does NOT exist — `rm -rf` the
   worktree dir + `git worktree prune`.

Relationship to the GIT_INDEX_FILE private-index technique above: that
one isolates WHICH FILES a commit sees; this one isolates WHICH
SOURCES a build sees. Use the private index when sibling dirt shares
files you must commit; use the worktree build when sibling dirt lives
in build INPUTS (build.mjs/gen-data.mjs/data assets) and you only need
a clean generated artifact. Detection cue that this is the variant
you're in: `git status` shows `M` on build.mjs/gen-data.mjs/.build
data assets and `git diff` on them shows a coherent mid-feature (don't
assume harmless — gen-data.mjs edits DO alter built output).

## Multi-session feature on a NAMED-BRANCH worktree (2026-09-04, show-your-working)

Stronger commitment of the same isolation: when the work itself will
span sessions and the main tree is wedged (sibling's HEAD=unpushed
`d6b50f0` PLUS a half-applied revert sitting in their shared index —
committing anything in main risks entangling with both), create the
worktree on a real BRANCH off the deployed HEAD and live there until
the main tree settles:

- `git worktree add -b <branch> .matilda/worktrees/<name> <deployed-sha>`
  (NOT `--detach` — the branch is where commits land; a detached worktree
  forces a branch dance at exit). Base it on the DEPLOYED commit, not
  HEAD, when HEAD is unpushed sibling work whose fate (the revert) is
  undecided — verify with `git diff --stat <deployed> HEAD <files>`
  that your files' estimator-relevant content is identical first.
- **The worktree MUST live inside the workspace** — a first attempt at
  a sibling-dir path (`../auspol-tracker-<name>`) was refused by BOGAN
  ("out-of-workspace write"); `.matilda/worktrees/<name>` is the
  established ignored convention (navfit worktree lives there too).
  Cleanup of a mis-placed EMPTY worktree: `rm -rf` + `git worktree
  prune` (old git has no `git worktree remove`).
- Edit/build/validate/commit ENTIRELY inside the worktree, 5-file
  explicit `git add` list (never `-A`). The main tree is simply not
  touched — no snapshots, no index plumbing, no race window.
- Merge to main only after (a) the sibling's revert either commits or
  gets discarded and (b) `git log --oneline -3` confirms nobody moved
  HEAD again; then `git merge` from the main tree, resolve, rebuild,
  revalidate, push. The branch's self-contained commits make conflict
  resolution mechanical.

## Main-tree snapshot → revert → rebuild → restore (2026-09-03 later variant)

Same build-input-dirt situation (sibling WIP in template.html, build.mjs,
gen-data.mjs + two asset sources; sibling had ALSO wired their feature
into d1a1d215 — the asset I'd added glossary entries to), but the
DELIVERABLE was index.html itself (glossary copy compiles INLINE into
index.html; there is no sidecar to ship instead), so the prior session's
move of "just exclude index.html from the commit" was not available.
Worked without a worktree by briefly cleaning the MAIN tree:

1. `cp` every non-owned dirty file plus index.html to
   `/tmp/sibling-wip-<date>/` — BYTE-EXACT snapshot before any reversion,
   because `git checkout --` is unrecoverable.
2. Re-check `git log --oneline -3` FIRST: mid-operation the sibling
   COMMITTED + PUSHED four commits (their template/asset work), so files
   that were dirty a minute earlier were clean AT HEAD — restoring my
   /tmp copies over them would have reverted their committed work in the
   worktree. Diff contents CHANGING between two of your own diff commands
   (a hunk visible in `git diff` gone from the next one) = HEAD moved;
   re-run `git log`, reclassify "foreign WIP" vs "foreign COMMITTED",
   and only revert what's still uncommitted. `git log origin/main..HEAD`
   empty confirmed their commits were already pushed (so my push would
   carry only mine).
3. For the ONE shared source file (d1a1d215) that now contained only my
   hunks vs the new HEAD — verify with the RAW `git diff` (a piped
   `-U1 | grep '^[+-]'` view had concatenated hunks from the sibling's
   pre-commit state in the same file and looked scarier than reality).
   Files whose foreign content is now committed stay at HEAD untouched.
   Files still dirty and foreign (build.mjs, gen-data.mjs, 9f09dca2):
   `cmp` live file vs /tmp snapshot (proves sibling hasn't re-edited),
   then `git checkout --` them.
4. Rebuild in the main tree, then GATE on the artifact diff:
   `git diff -U0 -- index.html | grep '^@@'` must list EXACTLY your
   expected hunk regions (here: one `infoTerms` hunk, +8 lines). Any
   extra hunk = foreign content still compiled in; do not commit.
5. PATHSPEC COMMIT instead of staging:
   `git commit -m "…" -- index.html .build/newtracker/assets/<my-source>` —
   commits HEAD+those working-tree paths, leaves the shared index
   untouched, and can't vacuum a sibling's pre-staged work. Simpler than
   the GIT_INDEX_FILE dance for the common mixed-tree case. Eyeball
   `git diff --cached --stat` shows nothing unexpected was already
   staged (pathspec commit ignores the index anyway), then
   `git show --stat` the result: exactly 2 files, 22 insertions.
6. Push. Then restore sibling WIP: `cp` the /tmp snapshots back over the
   reverted paths (cmp-verified in step 3), confirm `git status` shows
   the same `M` set as before. Their earlier compiled WIP inside
   index.html is NOT restored — regenerable from their sources on their
   next build; that's the correct steady state, and committing a clean
   HEAD+own-changes index.html to main beats shipping their half-finished
   feature to the live site.

Tradeoff vs the worktree-isolated build: this route is faster (no
worktree/cleanroom) but has a RACE WINDOW between snapshot and restore
in which a sibling's new edit to those same files would be clobbered —
keep the window minutes-small, `cmp` before reverting AND the moment
before restoring, and note the sibling's /tmp snapshot path in the
final report so a human can recover if the window lost something.

## Foreign STAGED REVERT of your own feature sits in the index (2026-09-03, Trove commit)

New race form: a sibling had staged — but never committed — a full REVERT of an
already-committed feature (d10c376, the aggregate-effect work) inside the shared index.
Detection signature: for the affected files, the STAGED blobs hash-equal the HEAD~1
versions (`git rev-parse :file` vs `git rev-parse HEAD~1:file`), and
`git show d10c376 -- file` is the exact inverse of the staged hunks. Note a plain
worktree-vs-HEAD diff does NOT reveal it — you must diff the INDEX. My Trove files were
entangled with partial revert-parts in TWO shared sources (gen-data.mjs, index.html), and
the sibling's revert had to SURVIVE for its owner to decide its fate.

Separation + commit recipe that worked (d6b50f0):

1. **Prepare HEAD+mine versions in scratch, never in the worktree** — for each shared
   file: `git show HEAD:file > prep/file` then apply ONLY my changes
   (`git diff -- <file> | filterdiff/patch` of my hunks). PROVE separation: diff the
   prepared file against the worktree file and check every delta is one of the
   foreign-revert hunks, nothing else.
2. **Plumbing commit through a PRIVATE index, no `git commit` at all** — STRONGER than
   the read-tree+`git commit` form above (which still respects hooks/status of the
   private index but, crucially, here we also needed `git add -A`-style semantics on an
   explicit path list):
   ```bash
   export GIT_INDEX_FILE=/tmp/…/idx
   git read-tree HEAD
   # prepared files: git hash-object -w prep/f → update-index --cacheinfo 100644,<oid>,<path>
   # whole-path-owned files: git add -A -- <explicit 20-path list>   (NEVER bare -A)
   tree=$(git write-tree)
   c=$(git commit-tree $tree -p HEAD -F msg.txt)
   git update-ref refs/heads/main $c
   unset GIT_INDEX_FILE
   ```
   HEAD advances; the real `.git/index` is byte-for-byte untouched, so the sibling's
   staged revert stays staged.
3. **AFTERWARD: cosmetic status inversion — DO NOT "fix" it.** The real index still
   reflects the pre-commit state, so `git status` now shows YOUR committed files as
   `D`/M against the new HEAD. The reflex `git reset` / `git add` to clean this up
   is the trap — it rewrites the shared index and would UNSTAGE the sibling's revert.
   Leave the index alone; call the inversion out in the final report and hand the
   decision to the revert's owner or the user.
4. Verify the committed tree, not the status: `git show HEAD:gen-data.mjs | grep -c
   troveByTerm` (=2) AND `grep -c effByKey` (=4) — proves my feature landed AND the
   d10c376 feature survived at HEAD.

## Sibling WIP staged INSIDE your data file; ship data-only, skip the rebuild (2026-09-04 variant)

Simplest form yet, and the first choice when the commit deliverable is DATA-ONLY.
Situation: `data/polls.json` was `MM` — the INDEX held a sibling's staged RedBridge
hunks (sampleEff deletions, an approval-row rewrite, part of a 15-file feature) while
the WORKTREE carried my five additive rows on top. Meanwhile their half-finished
template.html/gen-data.mjs edits (staged AND unstaged) would have flowed into any
`index.html` rebuild → shipping their WIP to the live site. Ordering insight: the
watchdog I needed to satisfy (coverage-check) reads `data/polls.json` from the repo,
not the built site, and committed-HEAD index.html stays self-consistent with HEAD
sources (site-check green) if no built artifact changes — so the correct commit is
polls.json ALONE; the next pipeline/sibling build ships the rows to the site.

Recipe (non-destructive, no index plumbing, no rebase):

1. Attribute hunks first: `git diff --staged -- data/polls.json` (theirs — RedBridge
   blocks) vs `git diff -- data/polls.json` (mine — additive rows). Both sets in one
   file, no hunk overlap (far-apart regions).
2. `cp data/polls.json <ignored-scratch>/snapshot` — their edits' ONLY other copy is
   the index; double-preserve before touching anything.
3. `git checkout HEAD -- data/polls.json`, then re-apply ONLY my rows (small text
   inserts) and PROVE it: `git diff --stat -- data/polls.json` shows exactly my
   insertions (here +57, nothing else), plus JSON.parse + validate + watchdog.
4. `git commit -F msg.txt -- data/polls.json` — PATHSPEC commit takes the worktree
   content of that path only; the rest of the shared index stays staged for the
   sibling untouched. NOTE: the pathspec commit also REPLACES the index entry for
   that path — the sibling's staged hunks on polls.json itself would be dropped from
   the index, which is why step 5 is mandatory.
5. Push (fetch+log first; this repo races), then `cp` the snapshot back:
   their hunks return as unstaged ` M` changes against my new commit — same content,
   merely relocated staged→unstaged for that one path. Verify `git diff --stat --
   data/polls.json` shows only their hunks and JSON still parses.
6. Do NOT commit the rebuilt index.html/assets from the dirty tree. My build had
   also emitted a new `assets/cycle-source.<hash>.json` (untracked) and the working
   tree's index.html compiled their unstaged WIP — leave both; their eventual
   `git add -A` build-commit regenerates everything coherently.

Contrast with the earlier variants: private-GIT_INDEX_FILE/plumbing is stronger but
needed only when you must commit SEVERAL shared files including built artifacts;
the worktree-isolated build is needed when the DELIVERABLE is index.html; for a
data-file-only deliverable the pathspec commit after clean re-apply is the cheapest
safe route and leaves zero residue in the sibling's staging area.

## Parked sibling patch drifts after your same-file commit (2026-09-04 sample-eff variant)

A sibling had staged a rollback of `.build/extract-sampleeff.mjs` (removing the
RedBridge `sampleEff` leg) in the shared index while I needed to add a new
raw-sample reconciliation tail in the same file. The scalable dance was:

1. Park BOTH forms before touching the file: `git diff HEAD -- file > /tmp/sibling.patch`
   and `cp file /tmp/sibling-reference.mjs`. The patch is the recipe; the full
   reference is the review baseline when the recipe rots.
2. `git checkout HEAD -- file`, make ONLY my feature edits, syntax-check, and
   `git commit -F msg.txt -- file`. The pathspec commit leaves the rest of the
   sibling's staging area untouched.
3. Restore their hunks. `git apply /tmp/sibling.patch` failed here because my
   new header/status edits shifted and rewrote nearby context — do NOT force it
   or `checkout --patch` over a newly committed feature without understanding
   each hunk. Re-apply the small removed blocks by hand using the patch.
4. Prove the restoration before restaging: `node --check file`, then
   `git diff --no-index --stat /tmp/sibling-reference.mjs file`. Because the
   reference is sibling-state-without-my-feature, the resulting delta must be
   exactly my feature (here 89 insertions / 3 deletions); any other delta means
   a sibling hunk was lost or mine was infected.
5. `git add -- file` to return their hunks to the shared index. Afterwards the
   staged file can differ from HEAD in BOTH directions: their rollback plus my
   feature. Leave ownership and resolution to that sibling; do not "clean" the
   index.

## Origin ahead + dirt everywhere — detached worktree at the REMOTE sha, push HEAD:main (2026-09-04 variant)

Lowest-friction form when ALL of these hold: local `main` is BEHIND
`origin/main` (siblings pushed since; `git ls-remote origin main` ≠ local HEAD),
the main tree carries ~65 foreign dirty files PLUS a stale staged changeset
(staged deletions of sibling features like `copy-poll.js` — an index frozen
mid-investigation), and your change is tiny (a 2-line title edit) whose
deliverable includes `index.html`, so a data-only/pathspec commit won't do.

First mistake, caught only by inspection: building in the MAIN tree. `node
.build/newtracker/build.mjs` baked the sibling's uncommitted `data/polls.json`
(51.1 figures vs committed 50.9) AND their feature-less stale source state into
`index.html` — `git diff HEAD -- index.html` came back 525 lines instead of 8.
**Run `git diff HEAD -- <deliverable>` BEFORE choosing where to build**; that
diff being anything but your edit means build inputs are foreign and main-tree
building is out — do not then revert sibling data files to retry (I did park
`data/*` via /tmp copies + `git checkout HEAD --` + byte-restore with a
`git add` to recover their staged one; it still left the stale-feature source
problem, and any /tmp save/restore has a loss window).

Route that was completely clean:

1. `git fetch origin`, note the remote sha.
2. `git worktree add --detach .matilda/worktrees/<name> <sha>` — INSIDE the
   workspace (BOGAN refuses /tmp writes), pinned to the EXPLICIT sha. This old
   git rejected `git worktree add --detach <path> origin/main` with a bare
   usage error (flag+refname form unsupported); the sha works.
3. Edit + `node .build/newtracker/build.mjs` + `validate.mjs` IN the worktree;
   `git diff --stat` there must show exactly your files (here 2 files, 4/4).
4. `git add <exact paths>` (status showed only the 2), `git commit -F COMMITMSG`.
5. `git push origin HEAD:main` from the DETACHED worktree — no branch needed;
   lands `a72f34c..6532a00` on origin without touching local main, the shared
   index, or any sibling WIP. Nothing merges back into the dirt-caked tree.
6. Cleanup: this old git has NO `git worktree remove` — `rm -rf` the worktree
   dir + `git worktree prune` (re-confirmed this session).

Aftermath worth reporting, not fixing: local `main` stays behind `origin/main`
(siblings pull to catch up); the 2-line edit may still sit in the main tree's
foreign dirty set — leave it; when a sibling pulls/merges, the identical lines
make it a no-op. Rebuilt artifacts my exploratory main-tree build LEFT BEHIND
(index.html/feed.xml/sitemap.xml regenerated from HEAD data) are regenerable
by the sibling's next pipeline run — leave those too; only DATA files I had
parked were restored byte-exact before the isolated route ran.

## Crashed commit/amend/reset rolls the INDEX back: shipped work LOOKS uncommitted (2026-09-04, "trand A")

The user triaged a 104-line dirty main checkout and handed over a finding:
"+247 uncommitted gen-data.mjs lines adding a leave-one-out `eff` payload,
216 template.html lines — a half-built site feature, not shipped." All of
that was wrong except the dirty files list. The per-poll aggregate-effect
feature is SHIPPED (d10c376 → 77dd1f3 → 0ebf814, all in HEAD ancestry)
and has its own matured skill. What sat uncommitted was an INDEX-ONLY
staged deletion of it — debris from a crashed sibling session.

Refold the state with three checks, cheapest first:

1. **Is the work already shipped?** `git log --oneline -10 -- <file>` —
   the feature's own titles (d10c376 etc.) deep in HEAD ancestry.
2. **`git diff HEAD --stat -- <paths>`** — EMPTY: the working tree IS the
   shipped content. Nothing uncommitted exists content-wise; only the
   index disagrees.
3. **The mirror.** `git diff --cached --stat` = `+114/−473`,
   `git diff --stat` = `+473/−114` — staged and unstaged diffstats are
   exact negatives. Net zero ⇒ the index carries an old tree. Confirm
   content: `git diff --cached -- <file> | grep '^-' | grep -cE
   'effByKey|EffLines'` > 0 — the index is staged to DELETE shipped
   machinery. `git status` still shows `MM` (index≠HEAD, worktree≠index)
   even though worktree==HEAD — MM does not imply real drift.

Cause, from the reflog: `commit` → `commit (amend)` → `reset: moving to
<old-sha>` → `commit (amend)`, 33 seconds — a session committing the
Essential-APC work, amending, then a MIXED reset (moves HEAD **and the
index**, leaves the worktree), then one more amend, then it died. Every
line newer than that old tree now reads as staged-deletion + unstaged/
re-add across every touched path (sources, assets, index.html, feed,
sitemap). The prior "post-commit inverted status is cosmetic" section's
opposite twin: there the fix was to NOT touch the index; here the index
is the only broken thing.

- **Hazard**: any blind `git commit -a` / full-tree sweep from this state
  packages the staged deletion — the shipped feature silently leaves the
  repo (the same trap as the frozen copy-poll.js staged deletions).
- **Fix**: unstage only — `git reset -q HEAD -- .build/newtracker/
  gen-data.mjs .build/newtracker/template.html …` (or bare `git reset
  HEAD` to unstage everything). Index-only operation; the worktree is
  untouched (it already equals HEAD) and the sibling's genuine WIP
  elsewhere in the tree survives as ordinary unstaged edits. Nothing to
  keep from the "feature": it was shipped long ago.
- **Old-git exactness** (this machine is git 2.15.0): `git restore` does
  NOT exist ("not a git command" → the most-similar suggestion is
  `remote`). For STAGED FILE DELETIONS (files deleted on disk AND staged),
  `git checkout HEAD -- <paths>` is the single-command surgical restore:
  it repairs the index entry AND rewrites the worktree file at HEAD
  content — verified: status/diff for those paths goes fully empty,
  everything else in the dirty tree untouched.
- **Live-repo trap that compounded the triage**: sibling sessions were
  ACTIVELY shipping (075030d, 80f9b7b, 053f7b8… arrived during the
  diagnosis), and the checkout's file contents changed BETWEEN my probes
  (a `cp`-rescued copy-poll.js appeared at 13:42 hash-equal to a commit
  landed at 13:43 — the sibling committed right after the copy). Re-run
  `git log --oneline -3` and per-path `git diff HEAD` immediately before
  each conclusion; a snapshot older than minutes is archaeology, not
  state. Also: hash-compare recovered/stray files against HEAD blobs
  (`git show HEAD:<path> | shasum` vs `shasum <path>`) before deciding
  whether they need restoring — identical means leave them alone.

## Sibling raced past YOUR pushed data commit; their rebuild already shipped it — stand down with NO commit (2026-09-04, AGB f30ad41)

Mirror case of every variant above: this time MY data commit (`f30ad41`,
8 AGB McNair cyclePolls rows) was already pushed and my build-output
commit (sidecar rename 92f981b3→15e5ed11 + regenerated index.html) was
prepared in a detached worktree but not yet landed, when the sibling ran
`commit (amend)` → `reset: moving to HEAD` and pushed five more commits
(ending 053f7b8). The reflog's amend/reset dance between your push and
their later commits does NOT tell you whether your commit survived —
only ancestry proof does.

Survival check (~90 s, all shell), then act on the outcome:

1. `git fetch origin; git merge-base --is-ancestor <your-commit> origin/main`
   — exit 0 = it survived the rewrite. (Exit 1 ⇒ orphaned; switch to the
   "sibling RESETS your committed work OFF main" variant's cherry-pick/
   update-ref recovery instead.)
2. Rows still in the pushed TREE: `git show origin/main:data/polls.json |
   grep -c '<unique marker>'` — ancestry alone doesn't prove content if
   the sibling overwrote the file from an old snapshot (their main-tree
   polls.json had exactly that corruption here; origin's blob was clean).
3. **Blob equality — the decisive check.** The build is deterministic and
   the cycle sidecar content-addressed, so a sibling who fetched your
   data commit and rebuilt for THEIR OWN feature regenerates
   `assets/cycle-source.<same-hash>.json` byte-identically:
   `git hash-object <your-worktree-built-file>` ==
   `git rev-parse origin/main:assets/cycle-source.<hash>.json`.
   Equality ⇏ coincidence — it means the pushed artifact IS your build's
   output; also grep the pushed sidecar for your rows and confirm
   pushed index.html references the new hash (`git show origin/main:
   index.html | grep -o 'cycle-source\.[0-9a-f]*\.json' | sort -u`).
4. All three pass ⇒ **commit NOTHING.** Your prepared build commit is
   redundant (identical blobs already pushed); landing it adds an empty
   or drift-risk commit. Prune the worktree (`rm -rf` + `git worktree
   prune` — old git has no `worktree remove`) and report "their push
   already shipped everything" with the blob-hash proof.
5. Fallback when the sidecar on origin is MISSING/different but the data
   survived: land the prepared build commit atop the new origin via the
   temp-index/plumbing recipes above — but `git rm --cached` ONLY the
   old-sidecar path after confirming it EXISTS in the TARGET tree
   (`git ls-tree`): my first chain aborted at "pathspec did not match"
   because `read-tree HEAD` had snapshotted the sibling's NEW head whose
   tree had already dropped 92f981b3. A remove-list from a stale
   snapshot is the abort cause, not damage — the chain died before
   update-ref touched anything.

Probe trap: `grep -c '<firm>'` on the minified sidecar returns **1**
(one LINE) with 8 rows inside — count occurrences:
`grep -o '<firm>' | wc -l`.

Aftermath worth reporting (not fixing): the main-tree `data/polls.json`
was still the sibling's corrupted copy with my rows absent — flag it to
the user ("their next main-tree build regresses those rows unless they
re-checkout the file") but do NOT restore it while their session is
live.

## Triage-only sessions: reading the repo's in-flight state without touching it (2026-09-04, title/outcome session)

A session where the user asked only questions ("did you ship X?",
"can you see WIP re Y?") — the deliverable is a correct READ of the
shared tree, and the failure mode is acting on a reading that's minutes
old or mistaking in-flight sibling state for damage to fix.

- **Staged–unstaged EXACT INVERSES = sibling mid ship/revert churn.**
  `git diff --cached <file>` removes a feature while `git diff <file>`
  puts the same content back (mirror-image hunks, opposite signs). That
  is NOT the "index rolled back over a shipped feature" signature from
  the reset-dance variant (there the diffs are exact MIRRORS with the
  same sign); it's a session caught between committing a revert and
  reverting the revert. Neither side is a steady state — do not stage,
  unstage, or conclude; report what you found and leave everything alone.
- **A probe that contradicts the one you ran two commands ago is
  normal.** `git diff HEAD -- <file>` printed empty while `git diff
  --stat` on the same file showed 65 lines because the sibling committed
  between the two calls. Live-repo rule already stands, sharpened: a
  conclusion is only as fresh as the last `git log --oneline -3` +
  `git status --short` run in the SAME breath as the action.
- **Recipe for "is there WIP about X?"** (cheap, read-only):
  1. `git log --oneline origin/main..worktree-<name>` for every sibling
     branch (`git worktree list`), plus `git -C .matilda/worktrees/<n>
     status --short` for dirty-but-uncommitted state in each;
  2. `git status --porcelain`, then grep the STAGED and UNSTAGED diffs
     separately for the feature's string (`git diff --cached -- <path> |
     grep …`) — inverse hunks hide from `git diff HEAD`;
  3. read the header COMMENT of any `.matilda/verify-*/probe.mjs` —
     these are dated intent documents ("Past cycles: the board cut by…"),
     the fastest record of what a sibling session is building;
  4. for minified single-line assets, extract context with `node -e
     's=…readFileSync…; s.indexOf(needle); s.slice(i-420,i+180)'` —
     BSD `grep -o '.\{N\}'` errors "maximum repetition exceeds 255"
     for any context window over 255 chars, so the usual
     `grep -o '.\{500\}needle.\{300\}'` idiom silently fails here.
- **Uncommitted "deletions" in data/polls.json can be an extractor
  rerun, not intent.** Signature found live: 8 `sampleEff` removals whose
  values matched `git log -p`-visible `+"sampleEff"` lines from an
  earlier authored commit (6f12336) ONE-FOR-ONE, plus regenerated rows
  for the same pollster (urls/nets rewritten), and the file's mtime
  AFTER both commits. A reran extractor rewrote the rows it owns,
  dropping attributes a human stamped on top. That's a diag to REPORT:
  the rerunning session is live, and "restoring" the lines yourself
  (`git checkout HEAD -- data/polls.json`) would clobber whatever else
  that session's diff holds.
- **Worktree-base pinning when fetch misbehaves**: one `git fetch
  origin` mid-session returned cleanly but did NOT advance origin/main.
  `git ls-remote origin main` gives the true tip sha; create the
  isolation worktree FROM THAT SHA (`git worktree add --detach
  .matilda/worktrees/<name> <sha>`) rather than trusting the
  possibly-stale ref. (This machine's git also mangles relative paths
  in `git worktree remove --force <relative>` — prints usage, does
  nothing; `rm -rf` + `git worktree prune` as ever.)

## Patch-transfer from a dirty main tree into a /tmp detached worktree (2026-09-04, solo-accuracy session)

The work was already DONE in the main tree (a sibling session owned
uncommitted WIP elsewhere in it) before the isolation decision was
made — no clean room existed at edit time. The recipe that shipped
`9c8c6ee`+`83618e0` without touching sibling state:

1. **Extract, then revert**: `git diff -- <my-file> > /tmp/acc.patch`,
   then `git checkout -- <my-file>` so the main tree returns to
   pristine-vs-HEAD for my paths (their WIP elsewhere untouched).
   Keep the patch around as the backup until the push lands.
2. **`git worktree add --detach /tmp/<wt> origin/main`** — the /tmp
   path WORKED here (an earlier session needed `.matilda/worktrees/`
   for tool-writes that BOGAN blocked out-of-workspace, but git's own
   worktree subprocess writing to /tmp was fine). Base it on the
   ORIGIN tip, not local main — local main may be behind.
3. **Verify patch context against the new tip before applying**:
   sibling captions commits (`08f2cca…06eebc4`) had touched the SAME
   asset since my edits; diffing those commits line-by-line showed zero
   overlap with the accuracy-panel region, so `git apply` in the
   worktree was safe. If they'd overlapped: apply with `--3way`, or
   re-do the edit manually against the new version.
4. Build + validate + compiled-string greps inside the worktree
   (`grep -c 'stands alone' index.html` → 4), diff must be exactly the
   two files (source asset + index.html).
5. **Two commits**: source edit alone (imperative subject + one-para
   body in repo voice), then `git add -A && git commit -m "Rebuild the
   tracker with …"` for the generated artifact. Mirrors how earlier
   data fixes in this repo kept the authored change reviewable vs the
   mechanical rebuild.
6. `git push origin HEAD:main` from the detached HEAD; then
   `rm -rf /tmp/<wt> && git worktree prune` from the main repo.
7. **Leave local main BEHIND origin on purpose** — do not pull into a
   tree carrying a live sibling's WIP. Verify the ship instead by
   curling the live site (~45–60 s deploy) for the compiled marker
   string, per the live-site-verify skill.

## Dead worktree + git parent-fallback = reset --hard in the MAIN repo (2026-09-05 incident)

The most destructive variant yet, and no sibling was even needed — the
trap was a DEAD worktree directory. The `.matilda/worktrees/ship-feedback`
worktree's `.git` FILE (the `gitdir: …` pointer) went missing at some
point (session restart, prune, or an interrupted `rm -rf`), leaving a
plain directory tree inside the workspace. Because `.matilda/worktrees/`
is **gitignored**, git scanning upward from that directory finds the MAIN
repo's `.git` — and every command (status, diff, log, reset) silently
operates on the MAIN repository while the prompt/mental model says
"worktree". The tell-tale state that got read as "sibling trashed my
worktree": `git status` clean, HEAD == origin/main, but the working
directory full of scratch files that aren't in the tree (they were the
dead worktree's untracked leftovers) and puzzling untracked `??` entries
in status with NO file paths that matched the cwd. `data/polls.json`
"gone" was the final confusion — ENOENT from the extractor — actually
the main-tree file was fine; the dead worktree simply had no checkout of
it... except the directory DID have one, because untracked leftovers from
earlier sessions linger. Diagnosis dissolved once a shell `pwd; ls` was
compared against `git rev-parse --show-toplevel` — the toplevel was the
MAIN repo root, not the worktree path.

The actual damage: while "cleaning" what looked like corrupted worktree
state, a `git reset --hard origin/main` ran against the MAIN repo — which
two sibling sessions were using for live WIP (~60 files modified,
including template.html, build.mjs, 15 SKILL.md files). That WIP was
unstaged, hence unrecoverable from git. Data-loss class, not
entanglement class.

### Pre-flight for any mutating git command in a claimed worktree

```bash
git rev-parse --absolute-git-dir        # MUST contain .git/worktrees/<name>
git rev-parse --show-toplevel           # MUST equal the worktree path
git worktree list                       # path MUST appear as a live worktree
```

Run all three when (a) a worktree directory was created in a previous
session or survived a restart, (b) `git status` output doesn't square
with `ls` of the cwd (files on disk that git calls untracked when they
should be committed; tracked files "missing" that live one directory
level out), or (c) stale file mtimes contrast with a fresh `git status`.
`git status`/`git diff` alone CANNOT detect the fallback — from inside
the dead directory they happily report main-repo state.

### Post-mortem recovery ladder (after reset --hard, stray checkout, etc.)

1. STOP. Fatal if you re-enter mutating commands. `git log --oneline -3`,
   `git stash list`, and `git status | head` are the read-only triage —
   the stashes here survived untouched.
2. `git fsck --lost-found` — everything ever STAGED or committed is a
   dangling object. Recovery auto-writes `.git/lost-found/commit/` (full
   commits with subjects — `git log -1` each to identify; one was a lost
   ship-branch tip) and `.git/lost-found/other/` (blobs: staged file
   versions — here 5 staged index.html builds and sim scripts, i.e. the
   skill instructions the reset had wiped were restorable from a staged
   blob).
3. Never-staged working-tree edits are NOT in the object store — gone
   unless editor backups/Time Machine exist. The subset of the wiped
   WIP that had never been staged (template.html/build.mjs/SKILL.md
   edits above blob level) stayed lost.
4. Re-apply recovered blobs to files by hash-match or content inspection
   (`git cat-file blob <sha> > path`), one read-only inspection at a
   time, then let the owning sibling sessions re-do their own residual
   edits — don't invent their content for them.

Rule of thumb: `git reset --hard`, `git checkout --`, `git stash drop`,
`git clean -fd` — the four commands that destroy uncommitted work — get
the full pre-flight check (git-dir, toplevel, worktree list) EVERY time
in this repo, no matter how safe the directory feels.

Follow-on operational fact (same incident, verified later that day):
`git worktree prune` de-registers stale worktree METADATA but leaves the
directory contents untouched on disk. An orphaned dir therefore survives
as plain gitignored scratch inside `.matilda/worktrees/` — and git
commands from inside it fall back to the MAIN repo exactly like the
dead-worktree case above, so it is useless and dangerous as a commit
source. To salvage finished work from one: `git worktree list` to confirm
it is de-registered, `cp` the artifacts into a FRESH `git worktree add`
whose `.git` file passes the pre-flight above, re-verify there (re-run
the artifact's own oracle/check), then commit. Never try to "re-adopt"
the orphaned dir; never `git add` its files from outside via the main
repo's index (`.matilda/worktrees/` is gitignored — invisible to the
main repo's index until a sweep-style `git add -f` finds them).

## Your OWN stale build overlaps upstream's committed hunks (2026-09-07, the happy-path variant)

The routine case, no isolation needed: my flow-table feature was fully
verified in the working tree but uncommitted when a sibling landed and
pushed `2de330c` (d1a1d215 asset + index.html — two of my files) and
`0645e52` (build.mjs stamp logic — changes what the BUILD EMITS in
index.html's og:image URL). Their commits were coherent; my uncommitted
edits sat cleanly on top. The trap: my index.html had been built BEFORE
their commits — staging it would have committed a diff that REVERTS
`2de330c`'s committed index.html hunks and emits the pre-`0645e52` card
stamp, silently re-opening both of their shipped features.

Procedure when `git status`/`git log` shows upstream commits landed
after your last build while your feature is dirty:

1. `git show --stat <each upstream sha>` — classify overlap. Three
   classes: (a) files you also touched (their d1a1d215/index.html —
   merge-by-coexistence in the tree is FINE, edits in different regions
   coexist since theirs are committed and yours are layered on top);
   (b) build INPUTS (build.mjs, gen-data.mjs, template.html, any
   .build/newtracker source) — changes what a rebuild emits, so your
   staged artifact MUST come from a fresh build, not your stale one;
   (c) disjoint files — ignore. Either (a)-on-the-artifact or (b) means
   rebuild before staging.
2. Rebuild in place: `node .build/newtracker/build.mjs`. The working
   tree already contains their committed sources plus your edits, so
   the rebuilt artifact contains BOTH — no worktree, no index plumbing
   needed precisely because their work is COMMITTED (contrast the
   WIP-dirt variants above, where in-place rebuild is the poisoning
   move).
3. Marker-grep BOTH directions on the rebuilt artifact before staging:
   `grep -c releaseMins index.html` = 3 (their feature survives — the
   grep target comes from THEIR commit message/subject, e.g. the method
   name it introduced) and `grep -c flow-tab index.html` = 21 (mine is
   in). Then `git diff --stat HEAD -- <my paths>` should be
   insertions-dominated (~324 insertions / 13 deletions here; the
   handful of deletions were the flowDrift payload line in the data
   asset being replaced, expected). A diff showing deletions of lines
   you never wrote = you're about to revert somebody; stop.
4. Stage exact paths (never -A — sibling SKILL.md edits and their
   spectre-src JSONs were still dirty, and several of their new
   auto-skill dirs were untracked; `git add <7 explicit paths>` only),
   commit with chained -m, then `git fetch &&
   git rev-list --left-right --count main...origin/main` = `1  0`
   before `git push`. Post-commit `git status` showing only THEIR files
   modified/untracked confirms the sweep didn't happen.

Key contrast table for choosing the variant: upstream COMMITTED +
coherent + your tree sits on top → in-place rebuild + marker-greps
(this section). Upstream work is UNCOMMITTED dirt in the tree → all the
isolation machinery above (worktree, private index, snapshot-restore).
Upstream work is INSIDE your staged/staged-over state → the
private-GIT_INDEX_FILE section.

## Sibling sweep absorbs YOUR REBUILT ARTIFACT mid-flight (2026-09-23, house-credit-lists)

New manifestation of the classic sweep, one step subtler than the 2026-09-03
"Sibling REBUILD inlines your uncommitted source" variant: there, THEIR build
compiled my source into their artifact. Here, MY OWN rebuilt `index.html` +
data asset were sitting in the tree mid-task (built by me, not yet committed)
when the sibling's feature commit `a2710b3` ran its `git add -A`-style sweep —
so their commit shipped my FIX while my gen-data.mjs SOURCE stayed uncommitted
in the shared tree. HEAD/src and HEAD/artifact disagree: a rebuild from HEAD
alone would REVERT the live fix.

Detection probes (cheap, run them before concluding a commit "should" be
uncommitted):

```bash
git show HEAD:index.html | grep -o 'const directionHouses = \[[^]]*\]'  # fix IS in artifact
git show HEAD:.build/newtracker/gen-data.mjs | grep -c creditHouses     # 0 => NOT in source
git status --short -- <built-artifact paths>                            # clean (swept)
```

Response is the reconciliation move already established for the foreign-
absorption family: never rewrite/rebase-split their (pushed) commit — commit
the SOURCE file separately, exact pathspec only, so HEAD reaches
source-matches-build. Whole-file `git add <source>` also swept in some prior
in-flight gen-data edits (they belonged to the sibling's own just-shipped
feature family, so entangled-but-coherent was acceptable; hunk-splitting a
live session's leftovers is worse). Report: the fix was live on `origin/main`
BEFORE its source commit existed; the local source commit (`8d1cc7e`) only
reconciles the repo — remember to say so, because pushing it changes nothing
visible.

## User-requested "commit and push" lifts FOREIGN unpushed commits (2026-09-24, APC-terminology)

Benign-invert of the sweep: my WIP was ALREADY committed *for me* by a
sibling (`ca1f18d`, exactly my two files, coherent) — and one fully FOREIGN
unpushed commit (`802effb`, a PRODUCT.md doc edit) sat on top. The user's
"commit and push" then lifted `802effb` to origin along with mine. Two
habits added: (1) before pushing a user-requested push, enumerate
`git log --oneline origin/main..HEAD` and classify every entry — a foreign
unpushed commit riding your push is fine (it's a fast-forward; there's no
clean way to push around a commit already on the tip) but MUST be named in
the report so the user knows whose unpublished work just shipped; (2) a
sibling committing YOUR work under THEIR wording is the happy path — verify
`git show --stat <their-commit>` matches your file set before treating it
as yours, and remember your go-to defence (private GIT_INDEX_FILE etc.)
is unneeded when their commit is clean.

## Foreign feature compiled into MY rebuilt artifact — WAIT is an option (2026-09-29, others/independents copy)

The 2026-09-03 "sibling WIP sits in build inputs" case, but discovered
AFTER my rebuild: my copy-change deliverable (2 source files +
index.html) was verified green, and the pre-commit census showed a
sibling's UNCOMMITTED tab-arrow-key feature (rdTabsKey in rd.jsx +
call sites in rd-allpolls/rd-cycles — plus, nastiest, one hunk inside
rd-panels.jsx, one of MY files) had been compiled into my index.html,
because build.mjs inlines working-tree sources. Committing my three
paths would ship their unverified feature live with zero of their
sources committed. Census procedure (fast, do it before staging):

1. `git status --short` — every modified build source you don't
   recognise is suspect;
2. `git diff --stat` + the real diff on the foreign files to classify
   the feature and judge completeness;
3. `git diff <shared-file> | grep '^@@'` hunk census on files you BOTH
   touched — attribute each hunk before claiming the file;
4. grep the BUILT index.html for their feature's unique identifier
   (`rdTabsKey`) — an artifact hit means YOUR rebuild already absorbed
   their WIP and the clean/surgical machinery from the earlier
   sections applies to committing at all.

The established answers were snapshot-restore isolation or the
private-index commit; the SIMPLER correct move when nothing on the
site is broken and the sibling is live: present the user the choice
(ship both / surgical separation / wait) — the user picked WAIT: my
edits stay uncommitted in the tree, the sibling lands their feature
commit first, then I rebuild-if-needed and commit my copy on top.
Don't reflexively reach for the isolation machinery when waiting a
turn costs nothing — surgery on a live sibling's WIP is the dangerous
option, not the default.

## ONE foreign build-input file: stash-park it, not /tmp (2026-09-29, swipe-wrap commit)

Lightest form of the snapshot-restore isolation (here: a sibling's
uncommitted rd.css work — centre the direction net under its bar on
phones — would have been compiled into MY rebuilt index.html alongside
my swipe feature). When the foreign dirt is exactly ONE tracked file,
git does the parking for you, byte-exact, no manual snapshot/restore:

```bash
git stash push -- <foreign-file>        # parks ONLY that file's WIP
node .build/newtracker/build.mjs        # rebuild now reads HEAD's copy
git add <my sources> index.html         # exact paths as always
git commit -m "…"                       # my commit carries zero foreign CSS
git stash pop                           # their WIP returns to the worktree
```

`git stash pop` restores exactly what was parked even as the session
continues (their next build re-absorbs their own WIP — correct). Verify
post-pop that `git status` shows their file modified again before
reporting "their work is untouched".

**Sibling push lifts YOUR unpushed commits too.** Minutes later the user
said "push" and `git push` said "Everything up-to-date" — a sibling
session (or CI's push_main) had committed THREE of their own features and
pushed; my two still-unpushed commits rode along as ancestors (fast-
forward needs no permission from the commits' author). Signature: local
branch not ahead, `git log --oneline` shows your hashes UNDER foreign
commits (`git show <their-hash> --stat` confirms each is coherent);
`git ls-remote origin main` equals local HEAD. Response: nothing to do —
report whose push shipped your work, and that any sibling-flavoured
leftovers in `git status` (here rd.css as `MM` = staged version +
their newer unpushed edit) belong to the live session, so leave them.

## Hand-increment the artifact + private-index commit (2026-09-29, rd-dir-net caption)

Cheapest variant yet of the private-index family, for a ONE-LINER source
change whose compiled form is known-exact. Situation: my phone-CSS rule
(`text-align: center` + 14px on `.rd-dir-net`) was hours-old uncommitted
in rd.css when a live sibling BOTH staged my files (mixing my hunk with
their own `.rd-ap-card .rd-ap-cprim` scoping hunk) AND left unstaged
d1a1d215-asset WIP in the tree — so (a) committing the staged state
ships their hunk, (b) any `build.mjs` rebuild ships their unstaged
inputs, and (c) HEAD was moving every ~2 min (`git log` churned between
consecutive commands — four sibling commits inside ten minutes).

- **New diagnostic: empty `git diff -- <file>` while `git status` shows
  the file modified means the INDEX already equals the worktree** —
  someone staged your files. The first letter of the `XY` status pair
  carries it (`M ` = staged diff exists). Run `git diff --cached --
  stat` before anything else; that listed THEIR hunk sitting inside my
  two files for free.
- **Recipe — no rebuild, no building anything.** For each of my files,
  make `HEAD-version + my-hunk` in scratch and let git plumbing do the
  rest:
  1. `git show HEAD:.build/newtracker/assets/rd.css > .matilda/scratch/
     <name>` (and `git show HEAD:index.html > …` — 70k-line file copies
     fine, scratch lives in gitignored `.matilda/` since /tmp tool
     writes are refused).
  2. Apply exactly my hunk to each scratch copy: edit tool for the
     source; one anchored `perl -pi -e 's/…old rule…/…new rule…/'` for
     the compiled line in the index.html copy (grep-count the old
     string == 1 first, so the substitution can't fan out).
  3. `git hash-object -w` both scratch files, then
     `GIT_INDEX_FILE=$PWD/.git/mine-idx git read-tree HEAD` and
     `git update-index --cacheinfo "100644,<sha>,<path>"` per file —
     **argument order is `<mode>,<sha>,<path>`**; the tempting
     `<sha>,<mode>,<path>` fails "option 'cacheinfo' expects
     <mode>,<sha1>,<path>" (and a prior `-w`-less `git hash-object`
     also failed because the object didn't exist yet — write it once
     and it stays resolvable within the turn).
  4. `GIT_INDEX_FILE=… git commit -m "…"` — commits the private index
     ONLY; remove the temp index file after. `git show --stat HEAD`
     must list exactly your files (mine: 2 +4/-2); `git status` will
     keep showing `MM` on them — that's the sibling's hunks still
     sitting staged+worktree, i.e. their state preserved, NOT damage.
- **Re-extract the scratch copies as late as possible.** Between my
  failed cacheinfo attempt and the retry, HEAD had moved commit
  `6e6c964`; a scratch file extracted from the stale HEAD and
  plumbed in would have SILENTLY REVERTED the intervening commit's
  content for that path. Extract → patch → hash → commit is a
  seconds-long chain precisely so `read-tree HEAD` at step 3 and the
  scratch files share one HEAD.
- Push lifted the sibling's three coherent local commits along with
  mine (normal; name them in the report per the 2026-09-24 section).

## Stash-park at scale + pop FAILS on live sibling writes (2026-09-29, glyph-hover commit)

Scale-up of the "ONE foreign build-input file" form above, with a new
failure mode. Deliverable was a 7-line template.html CSS rule whose
index.html is the paired artifact — but the tree held 21 foreign dirty
paths (sibling issues-panel WIP: gen-data.mjs +172, two compiled
assets, rd.css, a probe, 15 skills), AND the working index.html was a
stale sibling rebuild that BAKED their uncommitted gen-data output in
(their `iss:` blocks were greppable in its diff). Sequence that
shipped cleanly:

1. `git diff -- <each of my files>` to prove my dirt is only mine
   (their template.html had zero foreign hunks).
2. Stash ALL foreign paths by explicit pathspec —
   `git stash push -m '…' -- <13 paths>`; untracked sibling skill dirs
   don't stow (untracked isn't taken) and don't need it.
3. **`git checkout -- index.html` to discard the foreign-baked
   artifact** — it's generated, never hand-edited, so their output is
   a deterministically regenerable file, not work (their SOURCES are
   safely stashed). Then rebuild: the new index.html diff must show
   only MY hunk. A small amount of unrelated drift (~5 lines) is
   legitimate when an earlier sibling commit forgot to rebuild —
   identify it as HEAD-source lag and let it ride at your discretion.
4. Re-run the designed-for-purpose probes against the CLEAN build
   before committing — a green probe run against the foreign-mixed
   build proves nothing about the tree you're committing.
5. Commit by pathspec (a gitignored `.matilda/probe/` file needs
   `git add -f`), then push BEFORE the window widens.

**The new failure mode**: minutes into the hold, `git stash pop`
aborts with `error: Entry '<file>' would be overwritten by merge.
Cannot merge.` — the LIVE sibling re-WROTE two of the stashed files
themselves (their editor/agents are still running; stash reverted
their files to HEAD under them mid-session, and they re-dirtied).
The stash entry survives intact (`stash@{0}`). Recovery, in order:

1. **Never `git checkout -- <their-file>` to force the pop** — that
   discards live edits made seconds ago, real lost work (their own
   session may just have re-created what it doesn't know you stashed).
2. Verify scope: `git diff 'stash@{0}^' 'stash@{0}' -- <contested>` vs
   fresh `git diff -- <contested>` — here the fresh edits were NEW
   small hunks (a live `housesAll` fix) NOT present in the stash,
   i.e. the sibling genuinely worked past the stashed state.
3. Restore ONLY the uncontested paths:
   `git checkout 'stash@{0}' -- <19 non-contested paths>`. NOTE this
   STAGES them — follow with `git reset -q -- .build .matilda` (or
   the path list) to return them to plain unstaged WIP, or your own
   next commit (or any index consumer) sees them staged.
4. LEAVE the live-edited files as the sibling wrote them; their
   stashed older versions stay parked in `stash@{0}` — do NOT drop
   the stash. Report to the user that stash@{0} holds the sibling's
   superseded copies of exactly those files, available if their
   session needs them back, so the user (or follow-up review) can
   reconcile instead of discovering a mystery stash later.

The generalised lesson: a stash hold across ACTIVE sibling minutes
carries a pop-blocking probability that grows with the hold duration
— keep holds short (commit+push immediately after the clean rebuild),
and run `git stash list` before reporting done so no one's parked
work sits silent.

## Intentionally overwriting a sibling's PRE-STAGED entry for YOUR generated file (2026-09-29, demoTrend commit)

A gentler `MM` form: the sibling had pre-staged a stale rebuild of
`index.html` (+3784 vs HEAD) while their sources were still WIP —
status showed `MM index.html` with the STAGED side theirs and the
WORKTREE side my verified copy. Restaging the same path with
`git add index.html` is not the accident this skill usually guards
against; it's the mechanism — the index holds ONE version per path,
so the last `git add` wins and my blob replaces theirs in the
commit. The risk to manage is verification, since
`git diff --cached --stat` shows only line counts. Prove the staged
blob is the copy you verified BEFORE committing:

```bash
git show :index.html > /tmp/staged-index.html   # `:` syntax reads the INDEX, not the worktree
grep -c "<my feature phrase>"  /tmp/staged-index.html   # present at expected count
grep -c "<sibling breakage>"   /tmp/staged-index.html   # match HEAD's count, not zero
```

Two marker gotchas burned in this pass:

- An identifier implicated in the sibling's breakage can still appear
  legitimately many times in the committed inline app layer (one
  declaration plus ~18 usages ×19). Judge by comparison with a
  KNOWN-good copy's count (`git show HEAD:index.html | grep -c …` or
  your isolated worktree build's), never against zero — the breakage
  signal was a DUPLICATE declaration, not the identifier existing.
- Runtime-composed copy (React assembles sentences client-side) does
  NOT appear as rendered sentences in the built file: grep the SOURCE
  phrase-pieces ×1 and expect the rendered strings to be absent.
  "×0" is the PASS for a removed-bug phrase here, "×39" for a CSS
  class is normal; static-looking copy that is really assembled pays
  one failed grep per session otherwise.

Post-commit, `git status` still lists the sibling's untouched WIP
paths — correct. The check that matters is the staged set held no
foreign path (`git show --stat HEAD` lists exactly your files) and
the push fast-forwards (a sibling's coherent commit as your parent
is fine — name it in the report).

## Sibling `git restore` + rebuild wiped my uncommitted fix (2026-09-30)

Newest, cheapest-to-hit variant: between two of MY OWN tool calls a
sibling session committed three features (4d4d587/7410314/d409ee5),
RESTORED shared tracked sources to HEAD (`rd.jsx` went clean-to-HEAD: my
probe-green hunk gone, marker phrase nowhere in tree or index.html), and
rebuilt the generated files over my build. Probes I had just re-greened
were testing a STALE index.html the sibling promptly replaced. The
signature checks are the same as ever (`git log` moved, marker-phrase
grep ×0) — the lesson is the DEFENCE, because re-applying is cheap only
if the diff is saved: **the moment an uncommitted edit passes its
probes, `git diff -- <files> > .matilda/<name>.patch`** (gitignored
probe space survives anything git does); then re-apply after sibling
waves and verify marker grep in the SOURCE (the build output cannot be
trusted until YOU last built). A sibling may also sweep your uncommitted
source into their OWN feature commit mid-session (7410314 shipped my
freeze/thaw) — fine and unrecoverable-and-OK (it ships), but confirm
with `git log -- <file>` + marker grep on HEAD before deciding the work
is lost, and note it in the report so nobody "fixes" the revert that
isn't one.

Related race shape: a `git pull --rebase` mid-session is NOT the only
mutator — `git checkout/restore HEAD -- <file>`, a manual
restore-then-build, and plain `git stash push -- <paths>` by a sibling
all make the SAME surface (your file clean vs HEAD, phrase gone). When
the working copy's mtime on your source is NEWER than your last edit
but the content is older than your last edit, a sibling touched it —
re-apply from the .matilda patch, never "git restore" yourself to
"clean up".

## npm test rebuilds index.html OVER sibling WIP — verification and commit artifact are different builds (2026-09-30, hover-arrow 8e305ae)

Contamination trigger of a new colour: not a sibling's build, but YOUR
OWN verification. Deliverable was one source hunk (`rd-polls.jsx`, +34
transient hover-arrow scoping) plus its paired index.html; sibling WIP
sat uncommitted in `d1a1d215` and `rd-cycles.jsx`. The final gate —
full `npm test` in the live tree — RUNS `build.mjs`, so the index.html
it leaves behind has the sibling hunks compiled in. Proof that flagged
it: `git diff -- index.html` showed hunks inside functions nobody in my
session touched (`function cycDomain`, a `showComb` destructure —
rd-cycles-derived). That working copy was uncommittable no matter how
green the suite was, and it could only be regenerated, never reverted
(sibling dirt is live work, not a stray).

Sequence that shipped, given the hazard was known BEFORE the commit:

1. Verify as normal in the live tree (npm test + the DOM probe both
   green) — and treat the built artifact as contaminated from then on.
2. Fresh scratch checkout at CURRENT HEAD — never reuse an earlier
   scratch snapshot after mid-task HEAD drift (the sibling pushed
   `cd6cdd4` during verification, obsoleting a snapshot taken at the
   previous HEAD): `SNAP=$(mktemp -d "$PWD/.matilda/<task>-XXXXXXXX")`
   then `git checkout-index --prefix="$SNAP/" -a`, then `cp` ONLY your
   edited source files into it. `.matilda/` is gitignored, so snapshots
   never appear in status or get committed. Node fact that makes this
   cheap: a checkout INSIDE the repo root resolves the root's
   `node_modules` by ancestor-walk — no `npm install` needed (a
   `ln -s "$PWD/node_modules" "$SNAP/node_modules"` is harmless
   belt-and-braces only).
3. `node "$SNAP/.build/newtracker/build.mjs"` — paths are
   import.meta.url-anchored, cwd-free. Content-addressed sidecars must
   match HEAD's (cycle-source stayed `4eb218d0`), or the commit needs
   those too — here zero.
4. GATE before staging anything:
   `git show HEAD:index.html | diff - "$SNAP/index.html"` must print
   ONLY your hunks (one 34-line transpiled block). Any sibling-derived
   hunk means the snapshot itself is contaminated (wrong HEAD pin, or
   you cp'd a dirty file).
5. Commit the two files through a private GIT_INDEX_FILE exactly per
   the 2026-09-03 recipe (read-tree HEAD; `hash-object -w` each file —
   the worktree source is pure mine, the artifact comes from $SNAP;
   update-index --cacheinfo; commit; `rm .git/fc-index`). Never
   `git add`: the shared index held a stale STAGED copy of the same
   source file, and post-commit its `MM` status is cosmetic — leave it
   exactly as found.
6. `git fetch` → 0-behind → `git push`. Post-commit `git status` must
   list every sibling path untouched (theirs sat there, mutating
   between my commands — d1/rd-cycles/copy-chart.js churn visible
   command to command; nothing of theirs moved).

Generalised rule: treat any verification command that runs the builder
(npm test here) as a potential artifact-contaminator in the shared
tree. When it is, verification and artifact-production are DIFFERENT
builds — produce the commit copy LAST, in a HEAD-pinned scratch
checkout, and prove it with a `git show HEAD:<artifact> | diff` gate
before the plumbing commit.
