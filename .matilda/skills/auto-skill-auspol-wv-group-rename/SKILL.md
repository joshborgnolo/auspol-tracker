---
name: auspol-wv-group-rename
description: Renaming (or adding/removing) a vote-by-group common-group id in the auspol-tracker demo-groups pipeline (worked 2026-10-09, Rest of Australia → "Non-NSW/Vic/Qld", commit 88e2104; re-labelled to "ACT/NT/Tas/WA/SA" 2026-10-10, commit a723ef4, via a detached worktree). THREE rules from the user's dictate — id/label keys rename everywhere, PROSE copy keeps its own phrasing independently, and INPUT-side source names (crosstab-parse's filed dims keys, harmonize's input reads, data/demographics.json's keys) NEVER rename — then the change lands in ~10 id homes plus the probe fleet's COUNT PINS (pv-group-select option totals, state-election-rings PANELS/ELECTION arrays), and ends with build → validate → test-crosstabs → three probes chain. Third case 2026-10-12 (DemosAU (MRP) education labels, 8794904) is the INVERSE of rule 3: the user asks for the house's own STORED label to rename (MRP_GROUPS value side + hand entries + test pin + demo-groups comment), which DOES rewrite data/demographics.json and needs demographics.mjs --refresh before test-crosstabs can pass.
source: auto-skill
extracted_at: '2026-10-09T00:28:56.798Z'
updated_at: '2026-10-12'
---

# auspol-tracker: renaming a vote-by-group common-group id

Worked 2026-10-09: the `state` set's bucket `Rest of Australia` → `"Non-NSW/Vic/Qld"`
(commit 88e2104; user picked the label via the question UI over "SA+WA+Tas+ACT+NT"
and "SA, WA, Tas & territories"). Also applies when ADDING a group (the SA/WA
addition in 711006a hit the same probe-count pins this session uncovered: two of
them were missed there and a probe went red silently).

## The three-sided contract (user dictate — do NOT blur)

1. **Id/label keys rename** — every `Object` key and array entry that IS the group.
2. **Prose values move independently** — dek/glossary/hint sentences keep their
   own natural phrasing (here they became/stayed "the non-eastern-mainland
   states"); the user said "keep it non-eastern-mainland in eg dek text though".
   So never mechanical `s/old/new/` on VALUES; only keys and headline labels.
3. **Input-side source names NEVER rename** — a house's own printed cut stays
   filed verbatim. Resolve's fourth cut is still `"Rest of Australia"` in
   `crosstab-parse.mjs` (~:233, `st["Rest of Australia"]` read in harmonize) —
   only harmonize's OUTPUT key changed. Renaming the input read would orphan
   every Resolve wave's state set with zero tests failing loudly.

## Id/label homes (grep-checked 2026-10-09)

- `.build/newtracker/demo-groups.mjs` — header comment's state paragraph,
  `DEMO_SETS` group list, `DEMO_SHARE` weight key, harmonize() `put("state", …)`
  emit (NOT the `st[…]` input read beside it).
- `.build/newtracker/gen-data.mjs` — `DEMO_STATE_ELECTION.groups` key + its
  comment (~:3500; the panel's election-mark rows).
- `.build/newtracker/assets/rd-panels.jsx` — `RD_DEMO_SHORT` (:1602),
  `RD_TREND_STATE` (:1887) and `RD_TREND_STATE_ORDER` (:1888).
- `.build/newtracker/assets/a11e1559-….js` — `DEMO_WHO` (:2218) and the
  state table-hint prose (:2608); build regenerates `9f09dca2-….js` and
  `d1a1d215-….js` (the glossary "Which pollsters count where" entry lives in
  `d1a1d215` source — it is a SOURCE asset, edit it too).
- `.build/test-crosstabs.mjs` — the ygPlace expected-keys block, the morganLike
  "doesn't join" message, and the Resolve case's EXPECTED-output assertion
  (:293) — its INPUT fixture key at :292 stays the old name, by rule 3.

## The sunk cost: probe COUNT and ARRAY pins

The red probe after the rename was NOT the name — it was stale counts left by
the EARLIER SA/WA addition (711006a) that only updated `pv-group-select.mjs`.
Ladder of pins to sweep for any membership change of a DEMO_SETS set:

- `.matilda/probe/pv-group-select.mjs` — option total (`1 + Σgroups`; 28 after
  SA/WA), menu-order length, walk-list entries, its SHORT map, header comment.
- `.matilda/probe/state-election-rings.mjs` — `PANELS` array, per-party
  `ELECTION` shares keyed to DEMO_SETS order (add the new groups' own AEC
  31496 first-prefs from gen-data), the `panels.length === N` guards (TWO
  places: the pin-tail loop AND the phone-fallback check), header comment's
  panel count. Four→six here when SA/WA landed.
- `.matilda/probe/sig-table.mjs` — one `againstRow(…, "By state", "<group>")`
  call per affected group label.
- `.matilda/probe/state-election-rings.baseline`/fixtures are LOCAL-ONLY
  (untracked) — never commit them and never "fix" their old strings.

`git add` against `.matilda/probe/*` prints "paths are ignored … exit 1" but
stages anyway — verify with `git diff --cached --name-only`; probe files there
ARE tracked despite the gitignored dir.

## End-to-end order

demographics regen (`node .build/demographics.mjs` — writes harmonised group
keys into `data/demographics.json`) → `node .build/newtracker/build.mjs` →
`node .build/newtracker/validate.mjs` → `node .build/test-crosstabs.mjs` →
full `node .matilda/probe/pv-group-select.mjs` + `sig-table.mjs` +
`state-election-rings.mjs` (all must pass BEFORE committing; six RED ring
checks is the signature of a missed probe pin, not a product fault) →
stage by EXACT path list (shared-tree rule: never `git add .matilda/skills
/` folder-wide — sibling skill dumps ride along; stage the ~11 paths one by
one) → `git commit -F` (scratch message file — the body WILL carry the
quoted group names; heredoc-`$(cat …)` commits die on the apostrophes, see
shell-command-pitfalls #19) → push; a same-hour sibling commit racing you
(stash `.matilda/skills`, `git pull --rebase`, re-verify, push) is routine,
then `git stash pop`. Rest-of-bucket member COMPOSITION and merge weights
are untouched by a rename — the YG_REST/Resolve merge machinery needs no
diff and the demographics regen re-derives identical figures (in the MAIN
checkout with warm caches; see the worktree caveat in case two).

## Second case (2026-10-10): the label itself renamed, "Non-NSW/Vic/Qld" → "ACT/NT/Tas/WA/SA" (a723ef4)

Same three-sided contract (keys moved, "the non-eastern-mainland states"
prose values stayed, `Rest of Australia` input side untouched); replace_all
per file was safe because the string only ever appears AS the label (~8
files, ~25 occurrences). New lessons:

- **`data/demographics.json` never contains the display label** — it keys
  INPUT names ("Rest of Australia"); the display key exists only in
  demo-groups/harmonize/gen-data and the renderers. A pure label rename
  needs NO demographics regen. Worse, running `.build/demographics.mjs`
  in a COLD worktree drifted it: its live re-fetch dropped
  RedBridge/Accent …2026-04-30 rows "missing from the newest wave" and
  dirtied the file — revert (`git checkout -- data/demographics.json`),
  never commit it. The case-one "regen is byte-identical" holds only in
  the main checkout with warm source caches.
- **Worktree beats the stash dance when the sibling's WIP shares YOUR
  files.** The main checkout carried sibling hunks in gen-data.mjs (an
  unrelated feature) and in the sig-table/state-election-rings probes (a
  six-panel rework intersecting the same PANELS/`againstRow` lines).
  `git worktree add .worktrees/<name> HEAD`, the whole edit-build-test-
  commit-push loop inside it (probes run there too — they're tracked
  HEAD copies, `.matilda/probe/pv-group-select.baseline.json` absent is
  just a soft skip), then `git push origin HEAD:main` and
  `git worktree remove`. Main checkout handed back byte-untouched.
- **`git commit -F`'s scratch file cannot live in /tmp** — BOGAN mode
  refuses out-of-workspace writes. Write it to the MAIN checkout's
  gitignored `.matilda/.msg-<topic>.txt` instead (reachable from a
  one-level-deep worktree as `../../.matilda/.msg-<topic>.txt`), delete
  after the commit so `worktree remove` stays unblockable (never inside
  the worktree — untracked files block removal, worktree-scratch-files).
- **A shared-source label change drags /vic/ along, stale drift included.**
  `BUILD_JUR=vic node .build/newtracker/build.mjs` picks the label up, but
  vic/index.html had never regened for rd.css's already-committed rd-isc
  restyle, so the vic diff carried ~610 foreign lines of pure regen —
  ship it and NAME it in the commit message (clean-artifact-commit
  case-14 pattern); verify with `node .build/test-vic-build.mjs` (and
  `test-primary-order.mjs` while at it). The main index.html diff was
  label-only by contrast — the label homes fed no other drift.
- Extras green in that run: validate 0 errors, test-crosstabs PASS,
  pv-group-select 180/180, state-election-rings all checks passed,
  sig-table ALL GREEN.

## Third case (2026-10-12): renaming the house's own STORED label — DemosAU (MRP) "Didn't Finish Grade 12" → "Less than year 12", "Grade 12" → "Year 12" (8794904)

The user asked for the group's filing label itself to change ("in demosau
mpr poll column: 'Didn't Finish Grade 12' should be …"), which is the
INVERSE of rule 3 above: rule 3 protects the input reads during a
common-id rename; here the rename target IS the label the house's rows
are stored under, so every home of the stored label moves and
`data/demographics.json` rewrites. Invariants:

- **Parser keys (MRP_GROUPS LEFT side) never move.** In
  `.build/crosstab-parse.mjs` (~:202) the map's keys are the PDF-printed
  titles after `mrpKey()` normalisation (`"Didn't Finish G12"`,
  `"Grade 12"`) — they name the source text, not the display. Only the
  VALUES (the canonical stored labels) change.
- **Other homes of the stored label** (grep the old label to sweep):
  the hand-entered `DEMOSAU_MRP_DEMO` waves in `.build/demographics.mjs`
  (here "2025-11-11" and "2026-03-03"), the `test-crosstabs.mjs`
  assertion keys (the deepStrictEqual expectation and its readable fail
  message), the `demo-groups.mjs` header comment where the house's
  pairing into the common groups is described, and
  `data/demographics.json` itself.
- **`data/demographics.json` needs `node .build/demographics.mjs
  --refresh`** — the default fast path keeps on-disk rows
  (`have.get(k)`), so a key rename silently does NOT propagate (this is
  the reader skill's "--refresh backfill" rule applied to renames; in
  the main checkout, warm caches, the regen diff is rename-only).
  Verify the diff is EXACTLY the rename lines (here 4 old keys → 4 new
  keys, 2 waves × 2 labels, plus the two MRP-filed machine-read waves).
- **The test pin fails transiently, and that's expected.** Order is
  edits → `--refresh` → `node .build/test-crosstabs.mjs`. Before the
  refresh the test compares dims parsed fresh from the cached MRP txt
  (new names) against the hand entries it reads back from the still-old
  demographics.json (old names) and deepStrictEqual explodes. If ALL of
  the failure is new-name-vs-old-name, refresh and re-run — do NOT
  "fix" the expectation against the stale data file.
- Contrast with case two above: that one renamed a DISPLAY-only common
  label absent from demographics.json (no regen); this one renames a
  stored per-house label present in it (regen mandatory). Decide which
  side of the demo-groups `harmonize` mapping the string sits on BEFORE
  planning the run.
- Be careful how you grep: `"Didn't Finish"` matches the minified data
  bundle and explodes the tool result; grep per-file or restrict to
  source paths.
- **Sibling landing nuance** (clean-artifact-commit case-12 benign
  sweep, witnessed live here): the sibling's 8c06dd5 build ran after
  the source edits were on disk and folded the rename into the
  COMMITTED tab pages, so the display went live before the data commit
  and the remaining own commit shrank to the 6 source/data files
  (MRP_GROUPS, demographics.mjs, demo-groups.mjs, test-crosstabs.mjs,
  demographics.json, the 9f09dca2 data asset). Prove the feature is
  live with `git grep -c 'Less than year 12' HEAD -- index.html`,
  then commit what remains — never a duplicate artifact commit.
