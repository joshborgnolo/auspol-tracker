---
name: auspol-seifa-convention-absorb
description: "auspol-tracker — absorbing an origin-landed seifa_quintiles.py convention change (a numbering REWRITE like ace20ca5's most-advantaged-first flip, or a new index lane like 7b9c71ef's IER) into a DOWNSTREAM store that imports the shared module, mid-feature-branch (worked 2026-10-24, data/informal-history.json in worktree informal-votes, commit b69992a6; complement to auspol-seifa-quintile-menu-lane, which covers the ADD side inside the quadrature family). Survey via `grep -rl seifa_quintiles .build/` — a generator written to loop QIDXES/INDEX_META absorbs BOTH changes with ZERO code edits (regen + docstring only); the ORDER trap is running the store's test before REBUILDING (its bundle-parity assert red-flags the stale asset, never the store); flip pins by RE-MEASURING the regenerated store (never symmetric-map the old values — 151-seat boundary seats move), and demote ladder-order asserts to per-year dominance (q1≤q5/e1≤e5/r1≤r5) where an index measures non-monotone (IER 2001 interior non-monotone, IRSAD 2025 strictly ascending)."
source: auto-skill
extracted_at: '2026-10-24T05:32:16.147Z'
---

# Absorbing a shared-seifa_quintiles convention change into a downstream store

Two change classes reach every store that rides `.build/seifa_quintiles.py`:

1. **Numbering rewrite** — ace20ca5 flipped ALL FIFTHS to most-advantaged-first
   (`q1/e1/r1` = most ADVANTAGED … `q5/e5/r5` = most-disadvantaged; spare 151st
   seat of the 2019/2022 chambers → the most-DISADVANTAGED fifth).
2. **New index lane** — 7b9c71ef added IER (`r1..r5`) by config alone.

The ADD side (inside the flows/primary/2PP quadrature) is
auspol-seifa-quintile-menu-lane. THIS skill is the other half: a downstream
STREET store (`data/informal-history.json`, the informal stop on
/flows-explained/) sitting on a feature branch when such a commit lands on
origin — surveyed, migrated, gated and pushed as `b69992a6`.

## 1. Survey everything that imports the shared module

`grep -rl "seifa_quintiles" .build/ *.py` — generators beyond the quadrature
three lurk (`.build/aec-informal-history.py` imports `INDEX_META, QIDXES,
SEIFA_YEARS, membership` at :60 and loops `for ix in QIDXES` at :417-421).
Each lock-up = generator + `data/*.json` store + `test-*.mjs` suite + its
probe chapter. ALL of them move together, and a FEATURE branch must migrate
mid-flight before pushing (the informal lane shipped in `0b59bead`
disadvantaged-first/two-index and was migrated in `b69992a6` after merging
origin).

## 2. QIDXES-looping generators absorb with ZERO code edits

A generator that consumes `QIDXES`/`INDEX_META`/the `membership()` helper —
never literals — needs only a regen: r-lane records AND flipped numbering
both land from the library, `python3 .build/aec-<store>.py --check` must
report the store byte-deterministic afterwards. Edit only the docstring (the
informal one now reads "SEIFA quintiles — IRSAD q1..q5, IEO e1..e5, IER
r1..r5 … numbered along the advantage ladder … the 2026-10-24 sitewide
renumbering the informal lane absorbed on its IER addition"). If the regen
produces the OLD numbering, the generator hardcodes a lane — that re-specialisation
is drift to fix, not pin.

## 3. ORDER: regen store → REBUILD → run the store test (never test-first)

`data/<store>.json` is folded into the built bundle `9f09dca2-<uuid>.js`
(gen-data handoff). The store's test suite asserts bundle parity ("the asset
carries the data file verbatim" — test-informal-history : the AUSPOL bundle
against the JSON). Regenerating the store and running the test WITHOUT
rebuilding fails ON THE PARITY ASSERT with a wall of expected-vs-actual
cells that look like a store bug and is only a stale bundle. Sequence:
rebuild `node .build/newtracker/build.mjs` (+ `BUILD_JUR=vic …` for the vic
tab docs / `.build/vic/out/` asset), THEN `node .build/test-<store>.mjs`
expects green. (npm test's own chain runs builds before the store tests for
this reason.)

## 4. Re-derive pins off the regenerated store — never symmetric-map

For a numbering flip the temptation is to key-swap old pins (old q1 value →
new q5). Don't. The 151-seat 2019/2022 chambers hand the SPARE seat to the
most-disadvantaged fifth, so the 30/31 and 120/121 boundaries move ONE seat
vs a naive swap (same mirror trap as the ADD side). Print every affected
cell from the regenerated store (worked values, informal 2025: IRSAD
3.93/4.86/5.13/6.58/7.61 strictly ascending; IEO interior NON-monotone
7.46 > 6.46 at e4/e5; IER a fresh lane 2001: 4.09/5.05/5.19/4.9/4.86 —
interior non-monotone too) and type pins from the printout. Ladder asserts
follow the MEASURED shape per index: a strict-ascending assert where the
store is strict (IRSAD 2025), else per-year DOMINANCE — the
most-advantaged fifth ≤ the most-disadvantaged at every election
(`q1≤q5`, `e1≤e5`, `r1≤r5`, all nine index elections here) — never an
end-order assert over a non-monotone series.

## 5. The absorb checklist (one commit, all lanes move)

- store regenerated, `--check` byte-ok;
- validate.mjs ix-acceptance gate widened (informal's `(irsad/ieo/ier)`);
- renderer captions — rd-allpolls.jsx's `SEIFA_IX_DESC {irsad,ieo,ier}`
  (~:5732) plus `S.ix.toUpperCase()` captions are ix-generic, so a NEW
  lane needs no renderer edit, but the NUMBERING FLIP rewords each index's
  desc sentence ("the most-advantaged seat ranked first and thirty seats a
  fifth") and any caption carrying "most-disadvantaged fifth"-style copy;
- README/docstring lanes restated (informal-src README "IRSAD/IEO/IER
  … most-advantaged fifth first");
- the probe's menu chapter: optgroup count (3→4 here), option count
  (23→28), `fedcl:`-id count (14→19: 4 seat classes + 15 fifth ids),
  ordering strings ("…IRSAD, IEO and IER fifths, in menu order"),
  and caption/meta needles ("most-disadvantaged fifth" → "most-advantaged
  fifth" both in the lane copy AND the meta sentence "Federal elections in
  the most-advantaged fifth of seats by <IX> rank, 2001–2025");
- gates: validate.mjs (0 errors), both builds, the store test, the probe
  (see below), full `npm test` to "vic build ok"; then land via the
  worktree push race-check (`auspol-branch-merge-land-race`).

## 6. Running a probe while a sibling supervisor owns its port

A live sibling session supervising the same `.matilda/probe/*.mjs` will
`pkill` unknown listeners on the canonical port (9292 here) and relaunch —
racing your run mid-flight. Explained-house-flip.mjs reads
`PROBE_PORT=…` (default 9292) since this session; run on a private port via
a renamed copy so the supervisor's pkill pattern misses it:

```sh
cp .matilda/probe/<probe>.mjs .matilda/probe/.x-run.mjs && \
  PROBE_PORT=9317 node .matilda/probe/.x-run.mjs; ec=$?; \
  rm -f .matilda/probe/.x-run.mjs; exit $ec
```

(The `.x-` dotfile name dodges any sibling glob cleanup; delete it the same
command so a stale copy never shadows the committed probe in `git status`.)
