---
name: auspol-clean-artifact-commit
description: auspol-tracker — WRITE-side shared-tree hygiene when your deliverable is the REGENERATED index.html and a sibling session's WIP dirties the worktree. `node .build/newtracker/build.mjs` folds EVERY dirty build input into index.html — template.html AND the hashed rd asset layers (73de0c58/a11e1559/d1a1d215 are hand-edited JSX SOURCE layers the build only inlines, unlike the 9f09dca2 gen-dataset it rewrites) — so committing the build as-is ships the sibling's uncommitted work to origin/main = the live site (Pages deploys instantly). Recipe: `git stash push -m <tag> -- <their modified paths, from git status>` → rebuild → `git diff HEAD -- index.html` must show ONLY your hunk → commit only your source + its artifacts → `git push origin HEAD:main` → `git stash pop` to hand the tree back exactly as found. Worked 2026-10-06: Bonham ?m=0 desktop-pin link shipped as 52f538a with 8 sibling-dirty files + vic untracked dirs sitting in the tree the whole time. Field notes add push races, complementary-feature adoption, the mirrored live case (2026-10-06, RBA 4.6% event 99871f5): the sibling runs THIS recipe against you — your edited file path-vanishes into THEIR stash (pop theirs to restore, never re-apply by hand), `stash pop` aborts "local changes would be overwritten" when an `apply` re-dirties the path under you, and the cheapest unravelling of a mutual-shelving knot is a ~45s wait for their commit to land, then the standard flow on the new HEAD. Sixth case (2026-10-07, income split 0087ceb) covers the sibling STAGED mid-dance: build crashes caused by foreign worktree files vs committed state (diagnose before "fixing" a committed checker — park the cluster instead), `git commit -- <paths>` bypasses a foreign-staged index, `git stash pop --index` can fail where plain pop works, HEAD can move under you mid-restore (verify post-pop state fresh), and `.matilda/probe/*` files are force-add-tracked by convention. Seventh case (2026-10-07, anchor swap dc860e6) covers the SYMMETRIC mirror deadlock — you parked their build input, they parked yours, both waiting: a fully clean tree + unmoved HEAD means YOU were parked (identify stash identity by `stash show --name-only`, not by their park's message text), break symmetry by popping YOUR park of THEIR content first, then the multi-60/90s-window wait; `rd-allpolls.jsx` is a build input (park it with the hashed layers), and recover your files from THEIR park via path-checkout not pop.
source: auto-skill
extracted_at: '2026-10-06T05:12:00.000Z'
updated_at: '2026-10-07T06:39:28.599Z'
---

# Clean-artifact commit: shelve the sibling's WIP, rebuild, ship only yours

The shared-checkout skills (`auto-skill-auspol-stale-main-reconcile` read
side, `auto-skill-shared-repo-session-race` race taxonomy) cover aligned
and diverged mains. This one covers a gap they don't: your change is a
source edit whose deliverable is the REGENERATED `index.html`, and the
working tree is dirty with a sibling session's in-flight edits to OTHER
build inputs. Empirically observed 2026-10-06 while shipping the Bonham
`?m=0` link tweak.

## Why the build leaks the sibling's work — input/output map of .build/newtracker

`node .build/newtracker/build.mjs` rewrites its OUTPUTS: `index.html`,
`feed.xml`, `sitemap.xml`, `robots.txt`, the gen-dataset files
(`.build/newtracker/assets/9f09dca2-<uuid>.js`, `cycle-source.json`), and
root `assets/` content-hashed pieces. But the three main hashed layers
`73de0c58` / `a11e1559` / `d1a1d215` are NOT rewritten by a normal build
— they are hand-edited JSX source layers the build only INLINES (that's
why rd-*.jsx edits in them appear in `index.html` without those files
changing on rebuild). Same for `template.html`. Consequence: a sibling's
uncommitted edit to ANY of those inputs lands verbatim inside YOUR next
`index.html`, and `git commit index.html` then ships their half-finished
CSS/JSX to origin/main — GitHub Pages deploys immediately, no gate.

Detection: `git diff HEAD -- index.html` after your build shows hunks you
don't recognise — foreign CSS rules (worked case: `display:inline` on
`.hi-term`), foreign JSX rewrites (`button`→`a` anchor swaps), aside from
your own hunk(s).

## The recipe

1. **Snapshot and classify.** `git status --short`. Tag each modified
   path MINE vs SIBLING. Untracked dirs (`.build/vic-*`, `.worktrees/`,
   scratch probes) are NOT stashed by default and must stay — leave them.
2. **Shelve theirs by path list**:
   `git stash push -m "hold: sibling WIP during <topic> commit" -- <each
   of their modified files>`. A path-limited stash touches only those
   files and never untracked siblings. Nothing is lost — the stash is a
   commit.
3. **Rebuild**: `node .build/newtracker/build.mjs` (runs validate itself).
4. **Verify the artifact is only yours**:
   `git diff HEAD -- index.html` → exactly your hunk(s). If foreign text
   remains, a file you classified as generated/yours is really a dirty
   input — add it to the stash and rebuild.
5. **Commit only yours.** `git add` by explicit path: your source file,
   and its artifacts — `index.html`, PLUS `.build/newtracker/assets/
   9f09dca2-*.js` when the source was `gen-data.mjs` (GEN_DATASET
   convention in `.build/git-push-main.sh` `stage_dataset`: a commit that
   carries index.html must carry the dataset or the tree stays dirty and
   the laptop's next launchd slot REFUSES every slot after it — the
   2026-09-23 News24 lesson). Any other SITE_FILES the build actually
   changed will show in `git status`; unchanged ones are byte-identical
   and don't dirty. NEVER `git add -A` / `git commit -a` / `-am` here —
   that sweeps the sibling's paths (git-prestaged-commit-sweep).
6. **Push**: `git push origin HEAD:main`. This main is continuously
   writer-raced by CI/launchd/agents; a non-FF rejection is an expected
   push race, handled exactly like push_main's rungs: rebase onto
   origin/main with generated paths resolved by the `auspol-regen`
   driver (`true` — never textually merge two builds), rebuild, amend,
   re-push. See the header of `.build/git-push-main.sh` for the driver's
   invocation shape; `auto-skill-auspol-stale-main-reconcile` covers
   divergence adjudication (`git cherry`) when it looks worse.
7. **Restore their work**: `git stash pop`. If stashes accumulated from
   siblings, identify YOURS by message, not `stash@{0}`.
8. **Hand-back proof**: `git status --short` shows exactly the sibling's
   original dirty paths plus untracked dirs, no orphans of your own;
   `git log -1` (local) == `git log -1 origin/main` (remote) == your
   commit. Their next build re-derives their own index.html from their
   intact sources.

## Why not the shortcuts

- Committing `index.html` WITH the foreign hunks and "letting the sibling
  finish later" ships their WIP live NOW, and if their session abandons
  or pivots, the half-finished JSX stays on the page till someone
  re-reconciles.
- Committing only your source and NOT rebuilding + shipping artifacts
  leaves the live site without the change, and leaves `index.html` +
  `9f09dca2` dirty for the next writer (launchd refusals).
- `git checkout -- <their files>` instead of stashing destroys their
  work. The stash-push-by-path variant is the only zero-loss shelf.

Worked run, 2026-10-06 (commit 52f538a, "Outside estimates: pin Bonham's
blog to its desktop layout (?m=0)"): tree held 8 sibling-modified files
(template.html, .build/site-shell.mjs, 3 SKILL.md auto-files, the three
rd asset layers) + vic untracked dirs. Shelved the 8, rebuilt, index.html
diff was the single `"site"` line, committed
`gen-data.mjs` + `9f09dca2-*.js` + `index.html`, pushed clean, `git
stash pop` returned all 8 paths (`83 files changed` untouched by me at
the end; their vic work in flight didn't notice).

## Field notes, second worked run 2026-10-06 (RBA event commit 6ee15af)

- **Rebase refuses on ANY tracked dirt, not just build inputs.** While
  the sibling's build inputs were path-stashed, eight modified SKILL.md
  files still made `git rebase origin/main` fail with "cannot rebase:
  You have unstaged changes". `git rebase --autostash origin/main`
  shelves and re-applies the unrelated dirt automatically — your
  path-limited build-input stash stays untouched underneath.
- **A textually clean rebase of generated files still needs proof.**
  When the sibling's raced commit (their mood panel) and yours both
  touch `index.html`/`9f09dca2` but in non-overlapping hunks, git merges
  both silently. Trust it only after a fresh rebuild from the merged
  sources: if `git status` then shows NO modification to the generated
  files (byte-identical regen), the merge was genuinely consistent and
  there is nothing to amend — push straight away. Grep the built page
  for BOTH features' strings as the spot-check (worked: "RBA lifts cash
  rate" ×1, "economic mood" ×4).

## Field notes, third worked run 2026-10-06 (mood panel, 283984d) — raced by a sibling's COMPLEMENTARY FEATURE commit on the SAME component

Push rejected non-FF; upstream gained not just a CI data commit but
b42de69 — a sibling FEATURE commit (render-side half-life smoothing) on
the very component your in-flight feature (four-gauge mood panel) was
rewriting, probe included. Dropping either side loses real work; the
resolution is ADOPTION, not choice:

1. Rebase onto origin/main. Source files genuinely conflict (UU) —
   `git checkout --theirs` the conflicting SOURCES wholesale (upstream is
   the committed truth), never textually hand-merge a file you can
   instead re-apply a known edit list onto.
2. Re-apply YOUR feature on top in GENERALISED form: their machinery
   becomes a per-lane parameter (smoothing hl 14d/60d over your four
   lanes; NAB smoothed on true balances then shifted — a constant shift
   commutes through the linear kernel, so order is free). One commit
   now carries both features coherently.
3. Trust auto-merge on COMMENTS least: gen-data.mjs textually merged
   "clean" but kept the sibling's stale "two series" §5j comment — a
   semantically false merge that only a human read catches. Audit every
   comment/copy block in the conflict zone after rebase.
4. REGENERATE conflicted build artifacts (index.html, 9f09dca2) from the
   merged sources — discard both conflicted sides; never resolve two
   generated files textually (the auspol-regen rule, repeated).
5. GENERALISE the sibling's probe rather than orphaning or duplicating
   it: their mood-smooth probe became a four-lane LANES table and still
   greps their smoothing strings. A probe pinning the OLD contract is a
   live test failure waiting for the next CI run.
6. Amend the commit message to credit BOTH features before pushing.
7. Afterwards `git stash pop` every WIP stash you held (skill notes,
   sibling's uncommitted build-input WIP) and hand the tree back dirty
   exactly as found — the sibling's next build re-derives their artifact
   from their intact sources.

Also: `git add -A -- . ':!<dir>'` still swept the embedded repos inside
`.worktrees/` and vic scratch (warnings) — `git reset -q` and re-add the
exact intended paths; pathspec magic is not a sandbox.

## Field notes, fourth case (complement to #3 above)

When the sibling's raced commit touches only GENERATED files and yours,
a rebuild closes it; when it touches the same SOURCE component
complementarily, rebuild alone cannot invent the merge — that is the
adoption case above. Classify the racing commit first:
`git show --stat origin/main@{1}..origin/main` before choosing.

## Field notes, fifth case (2026-10-06, RBA 4.6% event commit 99871f5) — the sibling runs THIS recipe live, against you

A mood-colour sibling session was composing its commit while I composed
mine, and its moves are the mirrored image of this skill's recipe:

- **Your edited file can vanish from `git status` — check `git stash
  list`, not panic.** The sibling path-stashed MY `data/polls.json`
  edit twice (owningly-named stashes like
  `hold-RBA-pollsjson-during-mood-colour-commit-2`) to keep its commit
  clean, exactly as this recipe would. Popping THEIR stash restores
  YOUR file safely (the stash holds nothing of theirs on that path).
  Don't re-apply the edit by hand — you'd duplicate it under a
  different hash.
- **`git stash pop` aborting "Your local changes … would be overwritten
  by merge: <path>"** with the stash entry REFUSED only means an
  `apply` (not `pop` — their stash entry stayed in the list) re-dirtied
  the same path underneath you with an OLDER copy. The similar-named
  stash{0}..{2} you froze on a snapshot is already shifting under you
  — `git stash show --name-only 'stash@{N}'` fresh, never from
  minutes-ago output.
- **The cheapest unravelling of a mutual-shelving knot is to wait.**
  Head of main moved (283984d → 0b18d04, their mood-colour commit)
  ~45s after I stopped trying to win the stash war; their stash entries
  collapsed and my template.html WIP came back in place. Poll with a
  standalone `sleep 45 # intentional-sleep: waiting for the sibling's
  <topic> commit to land` (policy blocks a chained `; git log` — the
  follow-up check is a second call), then re-run
  `git status --short | grep -v '^??'` + `git stash list` together as
  the freeze-frame before deciding anything.
- **Verify the SHIP-state of HEAD before re-committing.** Their commit
  landed clean of my edit (`git show HEAD:data/polls.json | grep
  -c 4.60%` = 2, my pending edit intact in the worktree). If their
  rebase had textually swept my hunk in, the right move is to verify
  the remote site-marker and drop your duplicate, not to commit again.
  After their landing, the standard flow was then trivial: one
  11-path shelf, rebuild, index.html diff = my events hunk only,
  commit `data/polls.json` + `index.html` + `9f09dca2-*.js`, push
  (0b18d04..99871f5 fast-forward, no race), pop.

## Field notes, sixth case (2026-10-07, income demographics commit 0087ceb) — sibling STAGED mid-dance, park-with-provenance, HEAD moves mid-restore

The income sixth-split push met a sibling executing its own
clean-artifact dance LIVE: foreign files flickered dirty→staged while I
classified. New moves beyond the fifth case:

- **`M ` (staged) in `git status --short` that you never ran `git add`
  on = a sibling is mid-flight RIGHT NOW.** Poll frozen frames a few
  times (~30s cadence, four minutes was long enough here to see them
  stall) before assuming they'll commit promptly; a stalled sibling is
  fine to work around, a live one is not worth stash-jousting.
- **A build crash can be caused by FOREIGN WORKTREE files, not the
  committed tree.** The rebuild died in site-shell.mjs's drift gate
  ("colophon Info signpost not found") — the committed b8a5ce9 state was
  never broken: the sibling's uncommitted 73de0c58 `<a>`-swap sat in the
  tree against the committed `<button>`-only parseChrome regex. Before
  editing a committed checker to make a build pass, diff the foreign WIP
  stash for the same fix — my one-line "fix" turned out byte-identical
  to the sibling's own staged hunk. If your repair duplicates foreign
  WIP, it is not yours to ship: park the WHOLE cluster and rebuild
  instead (b8a5ce9 parked-clean built green with no code change at all).
- **Parking a cluster that contains STAGED files**: one
  `git stash push -m "park: <what> - restore with pop; provenance" --
  <paths>` shelves index+worktree atoms together. On restore,
  `git stash pop --index` FAILED ("patch does not apply",
  "conflicts in index") and kept the entry; plain `git stash pop`
  applied fine. Don't fight `--index`; staged-ness of foreign files is
  their owner's to re-establish — content preservation is what matters.
- **`git commit -m … -- <paths>` commits worktree content of named
  paths and BYPASSES the index entirely** — the correct commit form
  while the sibling's files sit staged. Never `git add <mine> &&
  git commit` there: the pre-staged foreign set rides along
  (git-prestaged-commit-sweep). For UNTRACKED files of your own, an
  explicit `git add <path>` first is still safe (and `.matilda/probe/*`
  is gitignored-by-`.matilda/*` yet probe files are TRACKED by
  convention — `git add -f`, see sibling commit b8a5ce9's probe).
- **HEAD can move under you mid-restore.** The sibling committed
  3fc015f (their mood half) on top of my pushed 0087ceb between my push
  and my stash pop; the pop then applied ONTO their commit and, where my
  parked hunks duplicated what they'd just committed (or what my own
  commit had landed — my keysheet line lived in the same 73de0c58 as
  their infoClick hunk), git resolved silently. Verify post-pop state
  FRESH, never from pre-pop snapshots: `git log -1 --format=%h` vs
  origin, `grep -cF <your dedup-able string>` for accidental
  double-application (1–6 keysheet ×1), `git status --short` for the
  returned-path set.
- **One file can legitimately carry BOTH sessions' edits** (73de0c58:
  my keysheet bank line + their infoClick conversion). To park their
  cluster whole-file without losing yours: park it, re-apply YOUR small
  known edit by hand (a one-line keysheet swap), then commit — the
  parked stash still carries the original line; the later pop layers
  over your commit harmlessly as long as your committed bytes and the
  stashed bytes for that hunk are identical.
- **Hand-back proof is per-side**: after my push, sibling landed
  3fc015f; local HEAD ≠ their eventual push ≠ origin. Final proof is
  `git log origin/main -1` == my commit AND `git status` shows only
  their returned WIP — `git log -1` local may already be PAST my commit.
- **Shell taxonomy trap in verification greps:** `grep -c '(button|a)'`
  plain-greps `(`/`|` literally and exits 1 mid-chain — use `grep -cF`
  fixed strings for regex-shaped needles.

## Field notes, seventh case (2026-10-07, anchor-swap commit dc860e6) — the SYMMETRIC mirror deadlock: you hold theirs, they hold yours

Both sessions ran THIS recipe live and full-mirrored each other: my park
held THEIR `gen-data.mjs` (the sample-law WIP for their 5adfeb5
confidence-sample commit); their parks held MY four anchor-swap files
(template.html, site-shell.mjs, the 73de0c58 and a11e1559 layers). New
moves beyond the fifth/sixth cases:

- **A fully CLEAN tree with HEAD unmoved = the sibling parked YOU
  mid-dance; nothing is lost.** My `git status` went silent at f9c2b9b
  because their build had regenerated `index.html` byte-clean and every
  foreign input (including mine) sat in their parks. Diagnose from
  `git stash show --name-only stash@{N}`: their park message names
  THEIR classification of captured files ("confidence-menu/
  anchor+site-shell WIP"), so trust the NAME LIST, never the park's
  message text — "anchor" in their phrasing was my whole lane.
- **The symmetric knot resolves by you going second — release YOUR park
  of THEIR content first.** They cannot commit their gen-data diff
  while MY park holds it; I cannot commit while THEIR parks hold my
  sources; both are executing the same wait-for-their-commit logic and
  neither can win. Your park of their files was only a build-window
  shelf — pop it back (their WIP returns exactly as their recipe
  expects it pre-build), then take the field-note-5 wait. Their commit
  landed ~3 minutes after my pop; their pops then returned my lane
  intact (the keysheet `1–6` overlap deduped silently against their
  committed bytes).
- **The wait can take MINUTES, not 45s.** Two 60–90s sleep windows with
  frozen-frame reads between them, then a third — their full
  park→rebuild→verify→message→push cycle ran over three minutes. All
  windows keep polling `git log -1 | cut -c1-90`, `status --short
  --untracked-files=no`, `stash list` together.
- **Recover your files from THEIR park via `git checkout stash@{N} --
  <paths>`, not `git stash pop`.** Pop mutates their stash list mid-
  plan (the sibling writes restore notes into park messages, e.g.
  "restore: stash pop x3, newest first") and can abort on a drifted
  base; checkout applies nothing destructively, leaves their strip for
  their own restore, and the strip's base (`git diff HEAD stash@{N}^
  -- <paths>` empty ⇒ drift-free) tells you whether the bytes are
  trustworthy.
- **`.build/newtracker/assets/rd-allpolls.jsx` sits beside the hashed
  layers and IS a build input** (listed in build.mjs's asset-layer
  array with the redesign comment) — a dirty foreign copy folds into
  YOUR index.html; park it with the hashed layers. Generalise: the
  build.mjs input list, not memory, is the authoritative enum of
  "hand-edited sources the build inlines" — a NEW layer can appear
  between sessions.
- **Fixed-string verification greps need the file's EXACT punctuation.**
  `grep -cF '(button|a)'` found 0 in site-shell.mjs and briefly said my
  widened regex was gone — the shipped form is `<(?:button|a)\b…`, so
  grep the literal `(?:button|a)` or any distinctive verbatim chunk
  (sixth-case `grep -cF` rule, sharpened). Same class of trap got me on
  `<(button|a)` vs `<(?:button|a)` earlier in the same run.
- **End-state proof after THEIR push**: their commit, pop cycle and
  push all completed around mine; final invariant was local `git
  status` == only their returned WIP, `origin/main -1` == my dc860e6,
  and every stash I created this session popped or dropped — remaining
  stashes were all their owns.
