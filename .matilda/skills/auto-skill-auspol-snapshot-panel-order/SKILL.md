---
name: auspol-snapshot-view-panel-order
description: auspol-tracker — reordering the Snapshot tab's panels. SnapshotView in the 73de0c58 asset is the ONE compose site (panel order is runtime JSX, not greppable in built index.html); the adjacency-written JSX comments must move/be rewritten with any reorder; verify with an h2.card-title DOM-order probe; when sibling sessions leave gen-data/flows dirty in-tree build in a detach-HEAD worktree.
source: auto-skill
---

# Snapshot-view panel order

Shipped example: commit 8d7192f (2026-09-23, "Snapshot: Undecided closes the
page, the vote-by-group tables move up") — swapped Demographics and Undecided
so Undecided closes the page, per direct user request.

## The ONE compose site

`.build/newtracker/assets/73de0c58-…js`, `SnapshotView` (~:1743, straight
after the TABS const). A plain JSX sequence: Hero → PrimaryVotePanel →
PollsterTable → LeadershipSection → DirectionPanel → NextPollsPanel → … —
as of 8d7192f the tail is DemographicsPanel → OnSourcesPanel → UndecidedPanel.
The panel components themselves live in the a11e1559 asset (their `h2
.card-title` strings included); order never appears there.

## Adjacent comments travel with the panels

Nearly every JSX entry carries a comment written in the voice of ITS
NEIGHBOURS (e.g. OnSources was "read off the same electorate the undecided
panel above describes"). A bare move of the component line silently turns the
comment into a lie — rewrite/drop the dangling clauses in the same edit.

## Verify DOM order, not file order (order is runtime-only)

The built index.html CANNOT answer "which panel renders where beside which",
even though everything is inlined: the panel titles live in the component
asset, so neither title appears near the compose site in the built file. Also
per the built-html-verification skill, babel escapes non-ASCII, so curly
typography greps fail anyway. Probe the live DOM instead:

- serve the build with a tiny node http server (pattern in
  `.matilda/probe/*.mjs` — scratch, uncommitted) + `puppeteer-core`
  (resolves from the REPO's node_modules — run the script from the repo, NOT
  /tmp, or you get ERR_MODULE_NOT_FOUND)
- Chrome binary: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, headless:"new"
- assert on `[...document.querySelectorAll("h2.card-title")].map(title)` —
  expected 8d7192f tail: …"Next expected polls", "The vote by age, gender and
  education", "Where One Nation's new voters came from", "Undecided".

## Dirty shared tree at build time (recurring)

Sibling Matilda sessions share this checkout and push while you work. In the
8d7192f session HEAD moved from a2710b3 to 330e7c3 (sibling's gen-data work)
mid-task. Escalation rule:

1. `git status`: gen-data.mjs / flows.mjs / assets/cycle-source.* dirty AND
   uncommitted → a rebuild in-tree bakes the sibling's uncommitted data into
   YOUR index.html. Do NOT build in the main tree.
2. `git worktree add /tmp/<name> --detach HEAD`; edit sources in the main
   repo (BOGAN blocks direct writes outside workspace root), `cp` edited
   sources INTO the worktree, run build.mjs + validate there, `cp` artifacts
   (index.html, changed .build assets) back; `git worktree remove --force`.
3. Once the sibling has COMMITTED + pushed their data changes, the worktree
   is skippable (as it became after 330e7c3 landed).
4. Before committing: stage ONLY your files by explicit path (see
   shared-repo-session-race); then pull/push and confirm with
   `git log origin/main -1 --oneline`.

Strictly view-only panel swaps touch nothing in gen-data — validate + the DOM
probe are sufficient; the sim/test suites (sim-next-polls, test-np-score)
don't exercise panel order.
