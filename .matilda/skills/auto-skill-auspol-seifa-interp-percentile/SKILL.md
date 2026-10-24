---
name: auspol-seifa-interp-percentile
description: "auspol-tracker — the census-INTERPOLATED-percentile (pcti) basis for the IRSAD/IEO/IER fifth lanes, the DEFAULT dividing observation since 2026-10-24 (commit fdb013d0; the CD-era 2004/2007/2010 lanes — the last open window — landed 2026-10-25 as aa07fb99, so ALL SIX census-bracketed elections 2004–2019 interpolate): pcti = (1−f)·pct0 + f·pct1 day-weighted between bracketing censuses, shipped by division-seifa-indexes.json `_pcti.factors` (the six year-keys drive everything downstream) + booth-seifa-{2013,2016,2019}.json pcti cells beside irsad/rankDis. seifa_quintiles.membership() dual-basis (every index ranks pcti DESCENDING at interp years, advantage-rank 1 = q1, the bottom fifth takes the 151-seat spare; census advantage-rank otherwise; rank_membership() retains the raw IRSAD observation), INTERP_YEARS derived from the store's own factor keys by every consumer/test, ELECTIONS_SUFFIX is now just 'of seats by <IX>'. Covers the per-index seat-movement measurements (irsad 21/8/30/12/0/10, ieo 14/2/8/8/0/14, ier 66/12/39/18/0/18 at 2004/2007/2010/2013/2016/2019), the eleven _PCTI_PINS anchors, the CD-era whole-unit allocator (derive-ced-era-alloc.py; oracle 54703 SA1s agree, 69 straddler diffs across 60 pairs), test-division-seifa's three-band delta regime (CD-era 0.08/0.50, SA1-concordance 0.03/0.25, 2016 0.002/0.015), the test-mirror triple, the invariants (pcti ∈ (0,1] all-distinct per year — no tie rule; int-1 trap for a perfect percentile), the stale-built-asset failure signature cured by rebuild, and explicit-path staging (git add refuses .build/vic/out + .matilda/probe pathspecs as ignored even though tracked — they DO stage; verify with git diff --cached)."
source: auto-skill
extracted_at: '2026-10-24T09:06:28.201Z'
---

# auspol-tracker — the pcti census-interpolated-percentile SEIFA basis

User directive 2026-10-24: *"retain the existing data observations for
previous census values, but add an interpolated percentile observation -
and can this be the data that's used by default, and used in the flow
chart?"* Scope approved as divisions + booths, landed 2026-10-24 as the
39-file `fdb013d0` for 2013/2016/2019, and CLOSED 2026-10-25 as the
29-file `aa07fb99` when the CD-era 2004/2007/2010 division lanes joined —
all six census-bracketed elections now interpolate.

## The law

`pcti = (1−f)·pct0 + f·pct1` — the day-share of the census-to-census
interval elapsed at election day, linear on the census **percentiles**
(never interpolated ranks or scores interpolated then re-percentiled:
the store ships the finished pcti ∈ (0,1]).

- `data/division-seifa-indexes.json` gains a top-level `_pcti` block
  whose `factors` map (`<election year>: {f or day-window fields…}`) IS
  the single source of which elections interpolate —
  {2004, 2007, 2010, 2013, 2016, 2019}, all six census-bracketed
  elections (f 0.634/0.259/0.807/0.416/0.979/0.554). Each election
  block's irsad/ieo/ier cells then carry `pcti` beside the recorded
  `rank`/`rankDis`.
- `data/booth-seifa-{2013,2016,2019}.json` carry pcti cells too
  (derive-booth-seifa-hist.py road the same factors).
- The interp years derive from the keys of `_pcti.factors` in EVERY
  consumer (Python `seifa_quintiles.INTERP_YEARS`, gen-data's interpYs,
  all three test mirrors) — never a hard-coded list anywhere else.

## Machinery homes

1. `.build/seifa_quintiles.py` — `interp_years()` read off the store's
   factor keys; `membership(year, ix)` dual-basis for ALL THREE indexes:
   interp years rank pcti DESCENDING (the most advantaged percentile
   files advantage-rank 1; thirty a fifth to q1…q5, the 151-seat spare
   landing at the disadvantaged end), asserting every pcti is numeric in
   (0,1] and ALL-DISTINCT (no tie rule); other years keep the recorded
   census advantage-rank (`rank` for irsad, reflected n+1−rank for
   ieo/ier). `rank_membership()` retains the raw recorded IRSAD cut for
   comparison. A shared `_check()` invariant pack covers both lanes.
   `_PCTI_PINS` (q1/q5 = advantage-first numbering): 2004 Fowler q5 /
   Bradfield q1; 2007 Wakefield q5 / Bradfield q1; 2010 Lingiari q5
   (the lattice moves it to the floor mid-interval, supplanting
   census-pole Wakefield) / Bradfield q1; 2013 Lingiari q5 / Bradfield
   q1; 2016 Lingiari q5 / Wentworth q1; 2019 Spence q5 / Wentworth q1.
   Census-rank pins 2001 Bonython q5/North Sydney q1 and 2025 Lingiari
   q5/Banks q2 stand beside them.
2. Store writers `.build/fed-class-flows.py`,
   `.build/aec-primary-history.py`, `.build/aec-2pp-history.py` — call
   membership() so the basis follows automatically; docstrings/name the
   suffix.
3. `.build/newtracker/gen-data.mjs` — emits ELECTIONS_SUFFIX beside
   interpolated-percentile scope text.
4. `.build/newtracker/assets/rd-allpolls.jsx` — the three chart captions
   carry the suffix sentence.
5. Test mirrors — `.build/test-primary-history.mjs`,
   `.build/test-2pp-history.mjs`, `.build/test-fed-class-flows.mjs` each
   pin ELECTIONS_SUFFIX as `of seats by ${IX}` for all three indexes
   (until 2026-10-25 IRSAD carried the long interpolation-window phrase
   and IEO/IER "… rank"; the flows-explained review unified the basis).
   Membership probes branch on INTERP_YEARS for EVERY index: interp years
   assert pcti window/distinctness/pcti-sorted positions and the
   per-index movement count vs the census-rank cut — irsad
   {2004: 21, 2007: 8, 2010: 30, 2013: 12, 2016: 0, 2019: 10}, ieo
   {14, 2, 8, 8, 0, 14}, ier {66, 12, 39, 18, 0, 18}; rank years assert
   the permutation. 2016 moves nothing because the census fell five
   weeks after the election (pcti = pct1's reading). The CD-era lanes
   move most — whole-unit CED polygon allocation is coarser than the
   SA1 concordance, and 2004's f 0.634 / 2010's f 0.807 lean far from
   the measured census side; test-division-seifa's delta-band invariant
   (its #15) prices three regimes: 2016 tightest (median 0.002 / max
   0.015), SA1-concordance 2013/2019 (0.03/0.25), CD-era
   2004/2007/2010 (0.08/0.50).

## Failure signatures

- After switching copy, the three test suites fail "the asset carries
  the data file verbatim" / "q1: the chart head's scope line names the
  grouping and its basis" — these compare against STALE built assets.
  `node .build/newtracker/build.mjs` cures them; don't re-pin first.
- pcti type trap: a perfect percentile comes back as Python int `1`,
  so guards take `(int, float)` not just `float`.

## The CD-era follow-on (aa07fb99 — landed 2026-10-25)

The 2004/2007/2010 lanes needed the banned-period CED polygons the ABS
never published as SA1-concordance-ready products; they are DERIVED by
whole-unit allocation in `.build/analysis/seat-model/derive-ced-era-alloc.py`
(one committed source JSON per boundary set under `seifa-src/`:
cd-2006-ced-2003ed, sa1-2011-ced-2006ed, sa1-2011-ced-2010ed), validated
against an oracle envelope: 54703 SA1s agree, 69 straddler differences
across 60 pairs. The recipe for any future factor year stays: compute
pcti cells + add the factor key — NOTHING else needs code; the copy
year-list auto-extends and BREAKS the three mirrors' literal suffix pins
BY DESIGN so a human reviews the wording; movement literals and e5/r1/r5
flow runs re-pin from the regenerated stores. Housekeeping: the informal
store rides the same membership pass (`aec-informal-history.py`, its
seifa lanes move with the others — regenerate it too or its class cut
diverges silently).

## Land shape (fdb013d0 — 39 files)

Sources + tests (seifa_quintiles.py, extract-division-seifa.mjs,
derive-booth-seifa-hist.py, the three store writers, gen-data.mjs,
rd-allpolls.jsx, test-division-seifa.mjs, test-booth-seifa-hist.mjs,
the three fed mirrors) + 8 data stores (division-seifa-indexes.json,
booth-seifa-{2004..2019} six files — their _about/_pcti.method blocks)
+ rebuilt index.html + tab docs + the built 9f09dca2 asset +
.build/vic/out + .matilda/probe/explained-house-flip.mjs + two
.matilda/skills SKILL.md updates (booth-seifa-store, live-site-verify).
Stage EXPLICIT PATHS — the tree was filthy with sibling lanes
(.matilda-probe edits, seat-model derive/test scripts). Trap: `git add
.build/vic/out/9f09dca2-*.js .matilda/probe/explained-house-flip.mjs`
exits 1 with "paths are ignored by one of your .gitignore files" even
though they ARE tracked — the add still stages them; confirm with
`git diff --cached --name-only | grep` before committing (`git add -f`
also works). Gates before commit: validate.mjs, main build green, all
three test mirrors, test-division-seifa, test-booth-seifa-hist, full
`npm test` ending "vic build ok".
