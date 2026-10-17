---
name: auspol-essential-one-offs
description: auspol-tracker — the Essential Report one-offs aggregator (.build/essential-oneoffs.mjs → data/essential-one-offs.json, the fourth /ad-hocs/ store; guard-repair worked 2026-10-17, 191 entries/16 waves exit 0). MANIFEST/EXCLUDE adjudication law, the fold machinery (foldGroup/FOLDISH_*/CONTEXT_GROUPS/DIM_OF_VIS reciprocal-cut rollout), the two garble classes the file already documents, and the garbled DUPLICATE-CUT compensation (block-level raw (ans,key,val)-multiset signature — post-foldGroup dedupe CANNOT see un-foldable rows; repaired the 2026-09-29 steps_to_control_immigration exit-2 of 36 "unmapped context" dies). Land state: script+store still UNTRACKED and gen-data/build.mjs read only the three committed sibling stores.
source: auto-skill
extracted_at: '2026-10-17T02:09:24.294Z'
---

# Essential one-offs aggregator (.build/essential-oneoffs.mjs)

Use when a run of `node .build/essential-oneoffs.mjs [--check]` fails
(exit 2 with GUARD lines), when extending MANIFEST/EXCLUDE for a new
Essential one-off dataset, or when landing the store. Sibling stores,
same /ad-hocs/ page: `auspol-secnewgate-one-offs`,
`auspol-newspoll-one-offs`, `auspol-redbridge-one-offs`.

## What it is (header contract)

- `data/essential-one-offs.json` — Essential Report one-off/occasional
  questions behind `/ad-hocs/`. Everything is DERIVED, never
  hand-transcribed: figures from `data/essential-report.csv` verbatim;
  wave anchors from `.build/essential-src/report-index.json`; samples
  from polls.json Essential rows (±7d); urls releaseUrl→report index.
- Scope: 48th parliament (reads ≥ 2025-05-12). The standing battery is
  EXCLUDED (primary/2pp/approvals/national_mood/demographics/
  consideration already channelled elsewhere).
- **Every dataset id with a reading ≥ window start must be in MANIFEST
  or EXCLUDE — an unadjudicated dataset fails the build.** Duplicate id
  spaces sit in a stanza's `also:`; the builder asserts figure equality
  on shared cells, then merges cells the canonical lacks.
- Usage `node .build/essential-oneoffs.mjs [--check]`; exit 2 =
  adjudication or guard failure. `--check` prints the same tally, writes
  nothing.

## Fold machinery (where most guards live)

- `foldGroup(r)` decides a row is a demographic-fold row and resolves
  its cut name (`By gender`/`By age`/`By voting intention`/
  `By vote at the 2025 election`/`By One Nation consideration`).
  Vocab: `G_GENDER/G_AGE/G_PARTY/G_ONC` → `CONTEXT_GROUPS[cut]`.
  Group label may sit in `ans` OR `key`; both-sides = die.
- `FOLDISH_VIS`/`FOLDISH_DIM` gate "this row NAMES a cut" — a foldish
  row that matches no group vocab dies `fold row in an unmapped
  context` (refuses to silently file as all-voters).
- `DIM_OF_VIS` rollout = **reciprocal-cut compensation** (already in
  the file): vis names a cut but the groups are the DIM cut's
  (jewish_friends' genuine vis=Age/dim=gender SWAP folds correctly).
  steps_to_control_immigration's vis=Gender rows name AGE bands with
  dim=gender — the rollout loops back to the same gender vocab, fails,
  and those rows are NOT the swap case.

## Garble class 2: duplicate-cut carry (compensation added 2026-10-17)

steps_to_control_immigration @ 2026-09-29: the extractor carried the
By-age fold's rows TWICE MORE, verbatim, under extra `vis=Gender` and
`vis=By gender` heads (real gender chart never landed — 36 dies).
Repair (the `blockRows` pre-pass before the row loop):

- Group foldish rows into blocks per `wave|norm(vis)|norm(dim)`.
- Block signature = sorted list of
  `[norm(ans), norm(key)].sort().join("~~") + "|" + val` joined — a
  COLUMN-ORDER-INSENSITIVE (ans/key pair, value) multiset.
- A block is skipped (NOTE printed, not GUARD) iff (a) **not every row
  folds** (`!brs.every(foldGroup)`) AND (b) its signature exactly equals
  a cleanly-folding block's in the SAME wave.
- Skip is per-BLOCK (all rows), note emitted once per block.

Why this shape, after a failed first attempt:

- **Dedupe at the post-foldGroup level cannot see these rows at all.**
  The bogus rows die inside foldGroup (age bands∉{male,female}), so a
  dedupe keyed on folded cut names (`wave+cut → sorted(group|val)`— the
  rejected first patch) leaves them untouched and the guard still
  fires. The signature must be computed on RAW rows.
- Column-order-insensitive pairs are required: the bogus head may carry
  ans=group/key=metric while the clean twin carries the same pair
  swapped — same multiset either way, but foldGroup's per-row verdict
  differs, which is exactly what makes the bogus head non-clean.
- A no-clean-twin block STILL dies (new contexts are never swallowed);
  jewish_friends' true swap is untouched (its blocks' figures differ
  from every clean block's); international_relations' vis=Voting-
  intention rows have no clean twin and stay guard failures by design.

## Verification recipe

`node .build/essential-oneoffs.mjs 2>&1 | tail` — expect only the two
NOTE lines (duplicate blocks, both steps_to_control_immigration @
2026-09-29) and `wrote data/essential-one-offs.json: 191 entries across
16 waves`, exit 0. Then `--check` must also exit 0. Any new GUARD =
a new garble class or a genuinely new fold context: adjudicate, don't
bulk-skip (the compensation's byte-identity requirement is the licence
— never widen it to a fuzzy match).

## Land state as of 2026-10-17 (the finish line, NOT yet done)

- `.build/essential-oneoffs.mjs` and `data/essential-one-offs.json`
  are BOTH **untracked** (`?? git status`); the store regrew locally but
  nothing is committed. NOT gitignored — check-ignore returns nothing.
- gen-data.mjs (:7098-7126) and build.mjs (:761-778) read only the
  THREE committed stores (news24 `one_offs`, redbridge/secnewgate
  `entries`); landing the essential store = add the fourth reader branch
  (`j.entries || []`, same shape as redbridge) in BOTH files, plus commit
  script + store. The /ad-hocs/ page degrades to an empty catalogue for
  absent stores, so there is no broken-build risk, only invisible data.
- data/secnewgate-one-offs.json was also untracked the same day (a
  sibling session's in-flight land) — coordinate before committing
  anyone else's files (shared-repo-session-race rules).
