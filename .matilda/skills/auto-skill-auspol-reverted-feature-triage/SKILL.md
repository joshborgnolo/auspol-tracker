---
name: auspol-reverted-feature-triage
description: auspol-tracker — "feature X I shipped has silently reverted to the old behaviour on main" two-outcome triage. TRUE case (worked 2026-11-07: 3b636e08 rode a working-tree copy that predated 8dab8ffe AND 26accd86, re-verting three shipped features across source AND the map bundle, while its uncommitted leftovers regressed the pin files to match — suite green, page wrong): diagnose by finding the old text as `+` lines in a later commit's diff, sweep that commit's OTHER files for neighbours' work it also clobbered, check the pins for dirty reversals, restore regions verbatim from the feature commits and regenerate — never a wholesale revert of the culprit. FALSE-ALARM case (same evening, middot-title report): local main sat 10 commits behind with a duplicate same-named commit — prove push innocence via the origin reflog's forward-only chain, a range-diff showing the pair differs only in the generated ?v= hash, live site's asset hash matching origin, and the repo's own probe run from the JUDGED commit against the live URL — then drop the duplicate and fast-forward. ONE stale land can revert several features at once (0c08ffe8's Industry picker hit THREE: vt arcs, zoom-jitter, the marital select lens — §5f): the feature commit may be an ancestor of HEAD yet its content absent, the store lanes die regenerated through stale derives, and an unrestored clobber leaves the feature's OWN committed pins RED at origin tip (surviving pins = clobbered, not deliberately removed). RESTORE half (§5g, executed 2026-11-12): fresh worktree at fetched origin tip, cherry-pick -n as the conflict SURVEY, generated stores wholesale to HEAD (re-derived, never hand-merged), union rule = HEAD's order kept + feature tails appended after the later lanes, subagent batches by file family, gitignored 12GB seat-model cache symlink-seeded with tallies copied, missing AURIN table fetched via a lane-arc clone.
source: auto-skill
extracted_at: '2026-11-07T02:01:20.598Z'
---

# Reversal triage — a shipped feature is gone from main

Signature (shown 2026-11-07): the /map/ scope menu's "National"-instead-of-
"Nationwide figures" rename (8dab8ffe) was silently back to the old wording at
HEAD. Culprit: `3b636e08` ("Commissioner font"), authored on a tree whose copy
of `app-4-story.js` predated BOTH 8dab8ffe (the fix) and 26accd86 (separators,
formed-govt tag placement, primaries-label) — committing it re-landed the OLD
text of every hunk those commits owned, and its re-assembled map.js/map.css
shipped the old wording live **while its own committed sources kept parts the
bundle dropped (a torn commit)**.

Rule out cheapos first (both have their own skills): uncommitted/unpushed
session claims (stale-live-page-debug), and "a sibling already shipped it"
(stale-main-reconcile). If the feature commit F IS in `git log HEAD` and HEAD's
source really regressed, this is the recipe.

## 1. Identify the culprit — old text as PLUS lines

```
git log --oneline F..HEAD -- <touched files>
git show <each> -- <file>      # or git diff <prev> <next> -- <file>
```

The tell: the suspect commit's hunks show old wording/structure on the `+`
side and its message names an unrelated feature ("font", "separators") — its
author rode a stale working-tree file and their commit re-clobbered every
region F changed. `git show <culprit> --stat` lists exactly what it touched;
any file there that F or a (F..culprit) neighbour also touched is suspect-per-file.

## 2. Sweep for collateral — one stale copy reverts everything it predates

Do NOT stop at the reported feature. For each neighbour feature commit N in
(F..culprit) touching the same source, ask what of N is still present at HEAD:

```
git diff N HEAD -- <files>          # lines showing N's text as "-" are LOST at HEAD
git grep -c <N's token> HEAD -- <source> <bundle>   # 0 where N ships means lost
```

2026-11-07 sweep found 8dab8ffe's scope wording AND 26accd86's `.st-sep`
emission + names-row tag ALL reverted by the one culprit, and the bundle it
committed had ALSO silently dropped 26accd86's primaries-label line — grep the
committed BUNDLE for a token the committed SOURCE carries (map/map.js vs
app-4-story.js): a divergence proves the culprit's bundle was assembled from a
stale source, i.e. the live page lost changes the tree still claims.

## 3. Pin files may be reverted as UNCOMMITTED leftovers (suite green, page wrong)

The stale session committed its source half and left its pin half dirty:

```
git diff HEAD -- <pin/probe files>
```

If the ENTIRE diff is the reversal of the pin (old expectations back in,
contract comments stripped), restore from HEAD and the suite must then FAIL
against the un-repaired source — that failure is proof the pin is live again:

```
git checkout HEAD -- <pin files>; node <suite>   # expect red until step 4 lands
```

Verify the diff contains NOTHING but the reversal before checkout — these
files are traffic-jammed; a sibling's live WIP looks the same shape. Confirm
hunk/loc counts (`git diff --stat`, `grep -c '^@@'`) match the reversal's
footprint before discarding anything.

## 4. Restore regions, not commits

Never `git revert` the culprit — it contains its own legitimate work (font,
button copy). Hand-restore each reverted region from its original feature
commit (`git show F -- <file>`; copy the hunks verbatim into the current
file), regenerate the assembled outputs (`node .build/map/assemble.mjs`;
`npm run build`, as applicable — NEVER hand-merge generated bundles), then
re-run the suites the pins belong to and, if geometry/copy is user-facing,
the rendered probe.

## 5b. Worked 2026-11-11 — the ReferenceError alarm and the multi-commit stale author

The report shape unlike the polite "behaviour back" alarm: **`npm test` red
at origin HEAD with an eval-time `ReferenceError: <app symbol> is not
defined`** in a committed test whose subject-destructured API list named a
symbol no source file defined. That was test-map-primary-breakdowns asking
the VM for `senChangeNote`: commit dca07c94 ("Map: census lens gains
'Unemployed'") had been authored on an app-4-story.js predating SIX commits
of the 2026-11-10 vote-type/Senate arc (544ea1ff's movements note, 1aa09ef3's
short abbreviations, 906b7e69's vt3 party toggle, 239270c4's vts Senate
piles, 4ede9c5c's 2019/2022 areas, 44394294's 2016 ordinary) and its bundle
reseated all of them live.

The sweep pattern that worked:

1. `git log --oneline -- <reverted-file>` over the window and `git diff
   <arcTip> <culprit> -- <file>` reading ± sides as INCIDENT CONTENT: every
   change not owned by the culprit's subject is collateral. Here the lane
   (DM constants) vs the revert (255 line net reversal) read apart cleanly.
2. `git log -S <each arc token>` proves no commit after the culprit restored
   anything (nothing between dca07c94 and origin/main rebuilt these
   symbols).
3. **Separately measure producers, tests, data, app.** Here the producers
   (build_map_data/build_vote_piles/build_senate_piles/*.py) and the
   contract tests other than the reverted one (test-map-primary-breakdowns'
   senChangeNote section) had SURVIVED — only app sources and
   test-map-page's arc sections went back. Data-wise, the committed res
   files simply never carried vt3/vts after the revert: re-run the
   producers rather than hunting lost bytes (`python3 -I
   .build/map/build_vote_piles.py`, `python3 -I .build/map/build_senate_piles.py`,
   assemble, suites green, oracles match the pinned formal counts).
4. **Restore whole-file from the arc tip as the base, then replay only the
   culprit's lane hunks onto it.** Safer than stitching the revert out:
   `git show <arcTip>:<file>` for app-4-story.js and test-map-page.mjs,
   then re-apply dca07c94's OWN lane edits (its DM-* constants and the
   hiqinc/tuple-width/arena-slog pin remodels) from the
   `git diff <arcTip>..<culprit>` in lane-hunks-only form; assert the final
   `git diff HEAD` of the restore is exactly the reversal of the revert.
   Files whose diffs are a SINGLE change each (app-1-base's 2 vt3/vts
   projection lines, app-2b-draw's strip sizing hunk) keep your by-hand
   edits instead — never re-derive a one-hunk region from the tip.

Note on splinter commits: restoring arc content and landing a new lane
deserve SEPARATE commits even when pushed together — reviewable, and
`git show <sha> --stat` stays truthful for the next reverted-feature
triage.

## 5d. Expect a live race while you repair

In this repo the repair itself races sibling sessions — this repair's own
second half was landed by a DIFFERENT session mid-triage (my fg restore edit
failed with "0 occurrences found" because the sibling's restore had already
landed under my read, and their commit swept my restored hunks along). So:
re-read every file region fresh right before editing it, and end by
re-verifying the FINAL `origin/main` state — the truthful deliverable is the
union of whoever's hunks landed, not your own plan.

## 5e. Pickaxe-first attribution; verification of a verbatim restore (2026-11-11)

The same class recurred one day later — 0c08ffe8 ("Industry picker") had
been authored on app sources predating the PREVIOUS evening's zoom-jitter
fix (9e0561e2) and re-shipped both halves of it live; user-reported as
"jitter … was once removed but it regressed". Two cheap additions to §1:

1. **Find fix AND culprit with `-S`, no diff reading.** `git log -S
   '<regression token>' -- <file>` (count-changed pickaxe) names the
   original fix commit; `git log <fix>..HEAD -S '<token>' -- <file>`
   names the re-regressing one in the same breath (e.g. `'HOME.k * 3'`
   walked straight to 9e0561e2 and 0c08ffe8).
2. **A verbatim restore verifies by shape**: restoring the feature
   commit's hunks into the current tree should reproduce ITS diff-stat
   counts for those files (the jitter restore matched 9e0561e2's
   `app-6-ui.js 17 changed lines / app-2b-draw.js 4` exactly) — a cheap
   proof no neighbouring region was clipped or extended, before you even
   rebuild. Restore commits that carry generated files still land through
   the worktree-off-origin + re-assemble + rebase-on-race loop
   (auspol-worktree-scratch-files); a committed probe that REPRODUCES the
   user symptom on pristine HEAD first makes the strongest oracle
   (map's `.matilda/probe/map-zoom-jitter.mjs` — see
   auspol-map-zoom-stage-feedback for that failure class's anatomy).

## 5f. One culprit, several victims; the RED-pins-at-tip signature (2026-11-12)

Report: "the marital status census lane is gone from /map/, I could see it
before". Established by investigation (diagnosis only — no restore yet):

- The feature: `109379e4` (2026-11-11) added the Marital status SELECT lens —
  `LENS_MAR`/`MAR_NAME`/`MARISMS`/`MAR_RANGE` + `S.mar` + `ma=` hash param in
  `.build/map/app/`, `marKeys`+`mar` lanes in every `map/data/res-*.json`
  store, AURIN/BCP ingest updates under `.build/analysis/seat-model/`, pins in
  test-map-page/test-map-chart. Full content is `git show 109379e4`.
- The SAME culprit as 5e: `0c08ffe8` ("Industry picker") rode app sources
  predating the zoom-jitter fix AND 109379e4; its wholesale app overwrite
  stripped ~50 marital lines, and its store REGENERATION (stale derives run
  again) dropped `marKeys`/`mar` from the res files. Marital is its third
  victim (vt arcs restored by `eff82523`, zoom-jitter by `8dd13969`; marital
  still reverted). One stale land can revert N features — sweep the culprit's
  full `--stat` for victims, not just the reported one.

Pinpoint recipe across refs (needed here because 109379e4 IS an ancestor of
HEAD yet its content is absent — ancestry alone proves nothing):

```
git log --all --oneline -S '<term>' / -G '<token>' -- <paths>   # candidates
git grep -c <TOKEN> <suspect>^ -- <file>   # parent still has it
git grep -c <TOKEN> <suspect>  -- <file>   # suspect drops it
git show <ref>:map/data/res-2025.json | python3 -c 'import json,sys; j=json.load(sys.stdin); print("<storeKey>" in j)'
```

The last line checks DATA lanes the same way — a stale land regenerating
stores through stale derives kills the store lanes together with the app code.

NEW detection signature: the feature's own COMMITTED pins survive in the test
files while its feature code is gone → those suites run RED at origin tip,
and a later commit's message documents tripping over them (`eff82523`: "die
in the sibling marital cohort family (marKeys/marCount pins, 26 of 27 booth
keys), pre-existing on the tree"). Inverse of §3's "suite green, page wrong"
(this case: origin-red, page fine). A deliberate removal deletes the pins
WITH the feature; surviving committed pins = silently clobbered.

Residual-risk note: the stale dirty tree that PRODUCED 0c08ffe8 was left
dirty in the shared checkout (b20 gone from the AURIN fetcher, marital pins
stripped from several seat-model test files, old app shape) — before trusting
a checkout, diff its dirty map WIP against ORIGIN tip; never commit map files
from it. Restore scope deduced (not yet run): re-apply 109379e4's app regions
rebased for the select lenses landed since (LENS_IND/famc/imm sit in the same
chains), re-run the store derives, re-assemble the bundle; the committed pins
then go green.

## 5g. Executing the restore (2026-11-12; deduced recipe executed through conflict resolution)

For a LEAF-sized feature (109379e4: ~165 files — 4 app files, ~36 derive/build
scripts, ~120 generated stores) the §4 "copy the hunks verbatim by hand"
route doesn't scale. What worked, in order:

1. **Fresh detached worktree at origin tip**, after `git fetch` (origin had
   moved past what the shared checkout believed: `git worktree add
   .worktrees/<name> -b <name> origin/main`). Never start in the shared
   checkout — its dirty WIP included the very stale state that authored the
   clobber (5f's residual-risk note proved true in the file-level diffs).
2. **`git cherry-pick -n <feature>` as the survey instrument** — the failure
   then comes out as a precise conflict map instead of a hand-inventory (here:
   143 UU source/store files + 12 AA, the AA set being files a LATER good
   commit also created, e.g. test-map-marital.mjs extended by 9ea8566b's
   chart-swap fix after 109379e4 created it).
3. **Generated stores take HEAD wholesale, sources take manual union** —
   `git checkout HEAD -- map/data map/map.js map/index.html data` (plus any
   generated JSON, map bundle, shells, package.json): hand-merging stores is
   waste because they get RE-DERIVED from the restored scripts next; the
   cherry-pick's store copies are stale duplicates of what the old scripts
   emitted. Also drop leaked session files (`.matilda-session` rode the
   feature commit).
4. **Union rule for source conflicts, stated once for a fleet of files** —
   every hunk here was the same shape: HEAD carries lanes that LANDED AFTER
   the reverted feature (ind, famc/imm folds, unemp/lab), the incoming side
   knows nothing of them. Rule: HEAD's content and order stay EXACTLY; insert
   the feature's lines/blocks adjacent to their sibling constructs; for
   positional sequences (per-SA1 tuple tails, positional call args, enums
   encoding slot order) the feature's elements APPEND at the end of HEAD's
   tail (mar AFTER ind) — the slot layout is a positional contract across
   writers, and HEAD's positions are load-bearing. Comments and closing
   brackets ride their owning line. ~180 hunks were farmed to six parallel
   background agents split by file FAMILY (seat-model derives / map federal /
   nsw-qld builders / sa-vic-wa builders / tests+README), each with that rule
   verbatim + a per-file syntax gate (`python3 -m py_compile` / `node
   --check`) + `git add`, then one integrator re-verified a sample per batch.
5. **Prep the re-derive BEFORE resolving finishes** — the seat-model chain
   needs its gitignored inputs in a worktree that has none: symlink the bulk
   read-only inputs from the MAIN checkout (`.build/analysis/seat-model/cache/*`,
   12 GB of census packs and table CSVs; `.matilda/seifa-irsad-abs`), but
   COPY the three writable tallies (`bcp-*-tally.json`) as real files so the
   restore's extractor writes stay isolated inside the worktree. The one
   genuinely missing source table (1991 AURIN `b06_age_by_marital_status…`)
   was fetched live with a cloned lane-arc fetcher (~/.aurin.env creds, WFS
   GetFeature pagination, the 31,401-CD pin) — extractors read tables from
   the cache dir by name, so the committed tree needs no new fetcher.
6. **Cross-check the union against commits that LANDED BETWEEN feature and
   culprit** — 9ea8566b (chart-swap fix, same night) had already repaired
   109379e4's legendState() omission; `git show <that commit>` told us the
   union should end with `S.mar` in BOTH key enumerations, not the feature's
   original one. Anything the in-between history already fixed lands in its
   fixed form, not the feature-commit's form.
7. **Findings unrelated to the revert stay out of the commit.** Restoring
   surfaced a separately-broken lane (the industry land added `ind.*` to
   AREAS_LANES in app-2b-draw but its `areasLane()` never maps `isInd()` —
   the industry Areas drawing is latent-broken at origin). Diagnosed,
   reported, and parked for its own splinter commit (5b's splinter rule:
   restore and unrelated defect-fix land separately so `git show --stat`
   stays truthful).
8. **Re-derive mechanics: extractors first, then per-era derives as
   background waves, anchored on the feature commit's own stated figures.**
   With conflicts cleared (`git diff --name-only --diff-filter=U` empty) and
   one pass of `python3 -m py_compile` on every resolved `.py`, re-run the
   seat-model chain inside the worktree: the TALLY extractors must come
   before the derives that read them — `extract-bcp-aurin-tally.py 1991` /
   `1996` (reads the cached b06/cd_b04 CSVs; b06 had to be live-fetched per
   step 5) and `extract-bcp-2001-tally.py` (minutes-long; parses the ~90k
   CD files inside the bcp-2001 zips) — then the per-era derives as TWO
   joined background shells in family order (90s→2013→2011 and
   2016→2006→seifa-voter), with demo-2001/demo-2001-frame/2004c1 waiting on
   the 2001 tally and derive-booth-demo-interp last (README-history's
   "Rebuild and verification" states the standing chain). The free
   regression oracle: the feature commit message states its own national
   anchors ("Married 56.1% of the 15+ stated share in 1991, 53.3% in 1996,
   51.5% …") and each extractor prints its lane lines on completion —
   1991's `mar(married) 0.5613` and 1996's `0.533` matched a plain
   eyeball; a drift there fails the chain cheaply, before any store
   builder runs.
