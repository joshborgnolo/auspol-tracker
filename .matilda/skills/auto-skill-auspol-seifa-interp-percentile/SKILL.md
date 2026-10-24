---
name: auspol-seifa-interp-percentile
description: "auspol-tracker — the census-INTERPOLATED-percentile (pcti) basis for the IRSAD fifth lanes, switched to the DEFAULT dividing observation 2026-10-24 (commit fdb013d0, branch allseats-class-flows): pcti = (1−f)·pct0 + f·pct1 day-weighted between bracketing censuses, shipped by division-seifa-indexes.json `_pcti.factors` (2013/2016/2019 division lanes CD-era 2004/2007/2010 pending banned-period CED polygons) + booth-seifa-{2013,2016,2019}.json pcti cells beside irsad/rankDis. seifa_quintiles.membership() dual-basis (SINCE 2026-10-25 every index — IRSAD, IEO, IER — ranks pcti DESCENDING at interp years, advantage-rank 1 = q1, the bottom fifth takes the 151-seat spare; census advantage-rank otherwise; rank_membership() retains the raw IRSAD observation), INTERP_YEARS derived from the store's own factor keys by every consumer/test, ELECTIONS_SUFFIX is now just 'of seats by <IX>' (the interpolation window moved to the flow-history How it's built entry 2026-10-25). Covers the per-index seat-movement measurement (irsad 12/0/10, ieo 10/0/14, ier 16/0/18 at 2013/2016/2019), the ten named anchors, the test-mirror triple (test-primary-history / test-2pp-history / test-fed-class-flows pin the suffix literally), the invariants (pcti ∈ (0,1] all-distinct per year — no tie rule; int-1 trap for a perfect percentile), the stale-built-asset failure signature cured by rebuild, and the 39-file explicit-stage land (git add refuses .build/vic/out + .matilda/probe pathspecs as ignored even though tracked — they DO stage; verify with git diff --cached)."
source: auto-skill
extracted_at: '2026-10-24T09:06:28.201Z'
---

# auspol-tracker — the pcti census-interpolated-percentile SEIFA basis

User directive 2026-10-24: *"retain the existing data observations for
previous census values, but add an interpolated percentile observation -
and can this be the data that's used by default, and used in the flow
chart?"* Scope approved as divisions + booths, CD-era division lanes
deferred (banned-period CED polygons pending), landed as ONE 39-file
commit `fdb013d0` on branch `allseats-class-flows`.

## The law

`pcti = (1−f)·pct0 + f·pct1` — the day-share of the census-to-census
interval elapsed at election day, linear on the census **percentiles**
(never interpolated ranks or scores interpolated then re-percentiled:
the store ships the finished pcti ∈ (0,1]).

- `data/division-seifa-indexes.json` gains a top-level `_pcti` block
  whose `factors` map (`<election year>: {f or day-window fields…}`) IS
  the single source of which elections interpolate — today
  {2013, 2016, 2019}. Each election block's irsad cells then carry
  `pcti` beside the recorded `rank`/`rankDis`.
- `data/booth-seifa-{2013,2016,2019}.json` carry pcti cells too
  (derive-booth-seifa-hist.py road the same factors).
- The interp years derive from the keys of `_pcti.factors` in EVERY
  consumer (Python `seifa_quintiles.INTERP_YEARS`, gen-data's interpYs,
  all three test mirrors) — never a hard-coded list anywhere else.

## Machinery homes

1. `.build/seifa_quintiles.py` — `INTERP_YEARS` set; `membership(year)`
   dual-basis: interp years sort pcti ASCENDING (0 = most disadvantaged)
   into 30-seat fifths with the 151-seat spare → q5, asserting every
   pcti is numeric in (0,1] and ALL-DISTINCT (no tie rule exists);
   other years keep the recorded rankDis lane. `rank_membership()`
   retains the pre-interp basis verbatim for comparison. A shared
   `_check(year, out, sizes_note)` invariant pack covers both lanes
   (30 a fifth, q5 balance on 151). Named PINS: 2013 Lingiari q1 /
   Bradfield q5; 2016 Lingiari / Wentworth q5; 2019 Spence q1 /
   Wentworth q5; rank years 2001 Bonython q1/North Sydney q5 and 2025
   Lingiari q1/Banks q4 unchanged. `ELECTIONS_SUFFIX`/`interp_label()`
   compose the copy window from INTERP_YEARS.
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
   {2013: 12, 2016: 0, 2019: 10}, ieo {10, 0, 14}, ier {16, 0, 18};
   rank years assert the permutation.
   2016 moves nothing because the census fell five weeks after the
   election (pcti ≈ pct1's exact reading).

## Failure signatures

- After switching copy, the three test suites fail "the asset carries
  the data file verbatim" / "q1: the chart head's scope line names the
  grouping and its basis" — these compare against STALE built assets.
  `node .build/newtracker/build.mjs` cures them; don't re-pin first.
- pcti type trap: a perfect percentile comes back as Python int `1`,
  so guards take `(int, float)` not just `float`.

## Adding a pcti factor year (the CD-era follow-on)

When 2004/2007/2010 division interp lanes land (CED polygons), compute
their pcti cells + add factor keys in division-seifa-indexes.json and
make booth-seifa-{2004,2007,2010}.json match. NOTHING else needs code:
membership/INTERP_YEARS/the suffix all derive from the factors map.
The copy string's year list auto-extends ("interpolated at the 2004,
2007, 2010, 2013, 2016 and 2019 elections…") — which BREAKS the three
test mirrors' literal suffix pins BY DESIGN so a human reviews the
wording, and the movement-count pins need the measured values.
update anchors if a new year's extrema change.

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
