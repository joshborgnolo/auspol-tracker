---
name: auspol-worktree-scratch-files
description: "auspol-tracker — fixing on a detached WORKTREE while the main checkout is dirty (the fixflow clamp fix, 4f2e0c8, 2026-10-05): the loop works (edit+build+probe+commit in .worktrees/<name>, `git push origin HEAD:main`, main tree untouched), but UNTRACKED scratch (probe scripts under .matilda/) created INSIDE the worktree both blocks `git worktree remove` and vanishes with it — and probes are untracked because .gitignore ignores `.matilda/*` except `.matilda/skills/`. Keep probes in the MAIN checkout's .matilda and point BASE at the worktree build, or recreate them in main before removing the worktree. A commit message that references `.matilda/probe-<x>.mjs` must resolve in the main checkout."
source: auto-skill
extracted_at: '2026-10-05T09:00:00.000Z'
---

# Worktree fixes + scratch-file lifecycle (auspol-tracker)

The validated pattern for a surgical fix while the main checkout is dirty
with someone else's WIP (used for the flow-drift ±3.4 clamp fix, shipped
4f2e0c8 on 2026-10-05):

1. `git worktree add .worktrees/<name> <base-sha>` from the dirty main
   checkout.
2. Edit sources + rebuild + probe + commit **entirely inside the
   worktree**. The rebuild there is clean (HEAD + your change only), so
   the regenerated `index.html`/asset diffs are reviewable without the
   main checkout's debris.
3. `git push origin HEAD:main` from the worktree (push_main rebase rules
   still apply — CI writers race).
4. Main checkout stays untouched (local main lagging origin is fine and
   normal; don't fast-forward a dirty tree you don't own).
5. `git worktree remove` — THIS is where the trap lives.

## The trap: untracked scratch inside the worktree

`.gitignore` ignores `.matilda/*` with ONE carve-out: `!.matilda/skills/`.
Consequences:

- **Probe scripts** (`.matilda/probe-*.mjs`) are untracked, so a probe
  created in the MAIN checkout does NOT exist in a fresh worktree — run
  probes from the main tree against the worktree build:
  `BASE=.worktrees/<name> node .matilda/probe-<x>.mjs` (the probes read
  `BASE`/`CHROME` env; this is how probe-flow-drift-dots and
  probe-hero-space run).
- A probe created **inside** the worktree is (a) untracked there, which
  **blocks `git worktree remove`** ("contains modified or untracked
  files"), and (b) destroyed with the worktree if you delete it to
  unblock. If the commit message references it, the reference dangles.
- Rule: write new probes straight into the MAIN checkout's `.matilda/`
  (gitignored scratch, shared), never inside the worktree. If one
  already exists only in the worktree, copy or recreate it in main
  BEFORE removal — `write_file` to the main-tree path from the same
  content (worked 2026-10-05 restoring
  `.matilda/probe-flow-line-clamp.mjs` after the fixflow worktree was
  removed).

## Skills are the one tracked thing under .matilda/

`.matilda/skills/` is committed. If the worktree commit updates a skill,
that update lands on origin/main while the local main checkout's copy
stays stale — do NOT hand-replay the same edit onto the stale local copy
(you'll diverge on the next pull). The review-agent lesson from the
clamp fix: match "skill shipped but file on disk lacks it" to
"local main is behind", not to "skill update lost".
