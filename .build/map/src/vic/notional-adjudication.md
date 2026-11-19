# Victoria notional Labor-v-Coalition 2PP — adjudication

Started 2026-11-19 (the same session as the NT programme — the user call:
"a notional 2pp where 2pp is not classic … where are the other
states/territories?", Victoria first by explicit choice since the VEC
publishes official figures).

## What the VEC itself publishes

Unlike the 仮定 message the map used to run ("the commission publishes no
notional two-party count"), the VEC maintains a full per-district majors
two-party product for every Assembly election:

- **2014 & 2018** — the `2ppvote2014.xls` / `2ppvote2018{,-final}.xlsx`
  workbooks (owned mirrors in `.build/state-flow-src/vic/<year>/`). One
  integer pair per district; a totals row the builders already pin
  (REF_2PP_SUMS). vic18's 2018 product omits Richmond outright
  (`PP_MISSING`) and ships the Albert Park off-by-one (`PP_TYPOS`),
  both pinned in the vic18 builder.
- **2022** — the live hub's *"Two-party-preferred results – all
  districts (Excel)"* workbook, committed 2026-11-19 as
  `.build/map/src/vic22/2ppvote2022.xlsx`, with a **Method** column per
  district: `Preference distribution` (a formal distribution — the
  certified finals lane AND, for Hawthorn and Kew, the majors-continuation
  alternative distributions) and `2PP` (the VEC's own alternative
  two-party count for the remaining non-classic finals) versus `2CP`
  (the election-night indicative class — VEC's own caveat text marks it
  provisional; **never filed anywhere in this repo**). The workbook
  carries no Narracan row at all (the supplementary election post-dates
  it and the product was never re-cut); Hits: `PP_GAP`.
  Its untitled %-columns and `(ALP v Nat)` name suffixes (the Coalition
  pairing is The Nationals in those districts) are handled at load;
  a `Sheet1` TOTAL row is asserted against the column sums, and the
  `2PP candidates` sheet names the majors pair the row counts.

## Semantics decisions (now identical across nt/vic)

1. **Official-jurisdiction figures ship with the `tppn` marker** (nt16's
   NTEC alternative counts, the VEC workbook notional rows and the 2022
   workbook's two official method families). They display under the
   existing `Two-party preferred (notional, …)` head-block label.
2. **The traditional recomputation stop was wrong in doctrine, kept as
   doctrine**: this frame's certified/tcp/published-page finals stay
   canonical and are never "corrected" into another vintage. When the
   workbook's `Preference distribution` print drifts from the frame's
   certified lanes (vic22-era recheck deltas, e.g. Albert Park
   23,916/15,194 vs certified 23,824/15,310) the build logs the list
   (informational); canonical lanes don't move. Same disposition as the
   nt DOP_SUMMARY_DIVERGENCES pins.
3. **No notional swings across eras**... except official-vs-official:
   official majors figures (classic lanes, tppn) swing normally;
   estimated rows (`tppe`, presently nt20/nt24 only) never carry a
   swing. The gates: past-chain stampers skip `tppe` only, so
   vic18's 11 notional rows swing against 2014's certified classics
   where computable (81 2PP swings in the vic18 print) and nt16's
   NTEC-alternative districts swing against 2012 the same way.
4. **Aggregates mix** (the user's check-it answer for NT, applied
   everywhere): frame 2PP totals pool classic lanes with the official
   notional rows. For vic22 that's ALP 54.95 over 87 of 88 (73 certified
   lanes + 14 official notional); the printed wing total consequently
   differs from the workbook's post-recheck TOTAL row (its classic rows
   use a rechecked-vintage lane the frame's canonical count doesn't) —
   relationship documents above, never smoothed.
5. **Filing sets are closed pins** (`EXPECTED_NOTIONAL` of 7/11/14 in
   the vic14/vic18/vic22 builders), computed from the lane classes every
   build; a new page-classic/lane-classes drift trips the recon,
   adjudicated deliberately, never auto-admitted.

## The per-frame filing cohorts

- **vic14: all 7 bare districts** (Brunswick, Melbourne, Mildura,
  Northcote, Prahran, Richmond, Shepparton). Prahran's line-class case
  (page-classic totals vs override certified pair) verifies its workbook
  row against the page's own totals before filing.
- **vic18: 11 of 12** — Benambra (its special certified-final override
  species, the row verifies against the page totals) plus Brunswick,
  Geelong, Melbourne, Mildura, Morwell, Northcote, Pascoe Vale,
  Prahran, Preston, Shepparton. **Richmond stays bare**: the official
  product never carried its row (`PP_MISSING` was already pinned for
  unrelated reasons and survives as the gap's own pin).
- **vic22: 14 of 15** — Narracan is the VEC's own hole (`PP_GAP`),
  everything else official (incl. Hawthorn and Kew via their
  `Preference distribution` majors-continuations).

## Manifest note

`map/data/data-vic22.json` is produced by the staged chain at
`.build/map/vic22/data-vic22.json` (data → boothcensus → past →
geo_build) and copied into place; `map/data/res-*.json` and the core
splits derive from geo/cores assembly (`map-build.sh` order matters —
the null-lane build output was once briefly shipped in error by running
the machinery out of recipe order).
