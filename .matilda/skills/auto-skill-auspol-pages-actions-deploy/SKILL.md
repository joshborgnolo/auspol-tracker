---
name: auspol-pages-actions-deploy
description: "auspol-tracker — the GitHub Pages deployment pipeline itself (pages-deploy.yml, Actions-deployed since 2026-11-07 commit 65fc7a11 after the legacy whole-branch builder died over the 1 GB published-site limit): safe allowlist edits, the local rsync rehearsal recipe, test-workflows.mjs's pin constraints on any new/edited workflow, action-SHA resolution, site-check's deploy-trigger coupling, and retry doctrine — gh run rerun normally, but for deploy-pages' 'Multiple artifacts named github-pages (count 2)' wedge a fresh workflow_dispatch instead (rerun worsens the count)."
source: auto-skill
extracted_at: '2026-11-07T00:51:55.506Z'
updated_at: '2026-11-10'
---

# auspol-pages-actions-deploy: the live-site deployment pipeline

The site deploys through `.github/workflows/pages-deploy.yml` (named
`pages-deploy`), flipped on 2026-11-07 by 65fc7a11 with
`gh api -X PUT repos/joshborgnolo/auspol-tracker/pages -F build_type=workflow`
— the legacy whole-branch builder had failed permanently once the tracked
tree measured 1.209 GB vs Pages' 1 GB limit (state-frame map data +
booth-level stores; every push from c76d47e1 errored in ~3 s with the
detail-free "Page build failed.", earlier builds flapped near the limit:
189465ab errored, 76df0152 built, then deterministic failure).

Pipeline shape: checkout → `rsync`-staged allowlist → **900 MB size gate**
→ configure-pages v6 → upload-pages-artifact v5 → deploy-pages v5,
concurrency `group: pages-deploy, cancel-in-progress: true` (the newest
push wins; a cancelled deploy publishes nothing partial). Every push to
main deploys; runs take ~2–4 min; `site-check.yml` fires on the run's
completion.

## The allowlist mechanics (the whole point)

The deployed artifact ≈296 MB of ~1.21 GB tracked. Exclusions (each one
= content that STOPS publishing; a runtime-fetched file must never join
this list):

- `.build/` (430 MB of sources), `.claude`, `.github`, `.impeccable`,
  `.matilda`, `.matilda-session`, `.worktrees`, `worktrees-seifa-land`,
  `.git`
- `data/`: `booth-demo-*.json`, `booth-seifa-*.json` (the `*` also
  swallows `-voter-`), `booth-locations-history.json`,
  `division-seifa-indexes.json`, `essential-report.csv`,
  `resolve-political-monitor.csv` — ~480 MB that no web page fetches
  (proven unreferenced 2026-11-07: basename-grep of every site `.html`
  and `.js` found zero refs; map.js mentions one only in a comment).

`data/` that DOES publish (22 MB): polls.json, the trove trio (linked
from archives/trove), seat-model JSONs, acnielsen CSVs, everything else.
`map/` (243 MB) publishes whole — `map/data/*.json` IS runtime-fetched
via the data-stamp URLs.

## Before adding an exclusion

- Prove zero web references: basename-grep across the site's committed
  `.html`/`.js` (`git archive origin/main | tar -x --include=…`), AND
  check the string isn't assembled at runtime (e.g.
  `"/data/booth-demo-"+year` constructions) — the safe negative is
  grepping the bare prefix too.
- Rehearse LOCALLY before pushing: the exact rsync from the workflow
  into /tmp, then `du -sm` (must stay <900), `find … | wc -l`
  (≈508 files at werk), and a presence spot-check of load-bearing paths
  (index.html, map/{index,map.js,map.css}, vic/index.html,
  allpolls/index.html, data/trove-text.jsonl, data/polls.json, CNAME,
  feed.xml) plus absence of every excluded class.
- Bonus trap found by exactly this rehearsal: token-grep the staged
  assets (`st-sep` in staged map.js/map.css returned 0 → turned out a
  newer sibling commit had REMOVED the feature the session thought it
  had shipped an hour before).

## Editing the workflow itself — fleet constraints (test-workflows.mjs)

1. `runs-on:` accepts only `ubuntu-24.04` (poll-agent's input may pair
   with `macos-15`).
2. Every `uses:` must pin a 40-hex SHA with a `# vX.Y.Z` comment.
3. Resolving a fresh pin: `gh api repos/actions/<action>/git/refs/tags
   --jq '.[] | select(.ref|test("refs/tags/v[0-9]+$"))'` and take the
   newest's `.object.sha`. Those tags are LIGHTWEIGHT: the refereed sha
   IS the commit (a follow-up GET on `/git/tags/<sha>` returning 404 is
   the tell it's a lightweight tag, not a mistake).
4. Reuse the repo's existing checkout pin (currently
   `actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0`).
5. `name:` must be unique across `.github/workflows/`; the file must not
   enter agent-repair/schedule-tune/healer watch lists (they're
   name-keyed and test-pinned).

## site-check is coupled to the deploy workflow's NAME

`site-check.yml`s fast trigger is `workflow_run: ["pages-deploy"]`.
Renaming or replacing the deploy workflow WITHOUT updating that list
kills the watchdog's per-deploy check (only its daily backstop survives),
and test-workflows.mjs will NOT catch it (it doesn't validate
site-check's list). site-check already exits gracefully on non-success
deploy conclusions ("nothing to compare"). `.build/site-check-spec.md`
names the same workflow — edit both together (committed in bc4eacf1
alongside the live-site-verify skill's migration section).

## Retry and verification

- Retry a failed deploy: `gh run rerun <id>`, NOT `POST /pages/builds`
  (that endpoint was legacy-builder-only; the old "builds can lie
  errored, Actions lane is authoritative" lore in auspol-live-site-verify
  Steps 2.6–2.7 is pre-migration history).
- KNOWN WEDGE (hit 2026-11-10 on the 906b7e69 deploy): when GitHub
  retries a run whose FIRST attempt's upload step had already
  completed, `deploy-pages` fails with "Multiple artifacts named
  'github-pages' were unexpectedly found for this workflow run.
  Artifact count is 2." A `gh run rerun` uploads AGAIN (the count
  grows to 3) — the rerun doctrine WORSENS this signature. Remedy: a
  fresh `gh workflow run pages-deploy.yml --ref main` (the run id is
  clean of artifacts; concurrency's cancel-in-progress keeps it
  single), done 2026-11-10 → success in the normal window. Diagnose
  from `gh api repos/joshborgnolo/auspol-tracker/actions/runs/<id>
  /artifacts` (two `github-pages` entries, one per attempt); the
  alternative school solution, DELETE-ing the stale artifacts then
  rerunning, was not needed.
- Watch: `gh run list --workflow pages-deploy --limit 5`;
  `gh run watch <id> --exit-status`.
- Post-deploy verification (recipe verified four times on first day):
  live stamp `curl /map/ | grep -o 'map\.js?v=[0-9a-f]*'` == `git show
  origin/main:map/index.html`'s stamp; root returns the full ~228 KB
  with the right <title>; then site-check's own workflow_run run goes
  green minutes later.
- The EXPECTED next failure class is the 900 MB gate firing as
  `map|data` growth rebuilds toward 1 GB — the remedy is conscious new
  EXCLUSIONS (each = a page/asset that stops publishing), never raising
  the gate toward the hard 1 GB public limit.
