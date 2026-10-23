---
name: auspol-accuracy-panel
description: auspol-tracker — the "How the final polls did" AccuracyPanel end-to-end: gen-data.mjs accuracyCycles (~:1490-1550; ACC_WINDOW_DAYS=14, one final 2PP poll per house equally weighted, exit polls excluded, ACC_CANON renames-only, houses sorted by |err|; NO window overrides — the 1977 21-day exception shipped and retired 2026-10-23 when Morgan's true final wave surfaced) emits D.accuracy.cycles {year,eDate,result,mean,err,absErr,houses,n,sameSide,worst} + per-firm aggregates; renderer in the d1a1d215 asset (~:1956-2145) with Last-five/More split BY POSITION, lanesFor spread toggle, small .acc-dot per house + big .acc-mean average dot, "All one way" flag, bothWays hint paragraph, by-house grid for firms with n>1. Solo-rule (9c8c6ee + rebuild 83618e0): a one-house election (1993, 1996, 1977) draws ITS OWN poll as the big dot, never an average-of-one stacked on its own small dot. Era cycles (39de76c, 2026-09-12): 1974–1984 era buckets scored on implied LEF 2PP lifted the panel 12→18 cycles; 1977 joined at the STANDARD 14-day window (2026-10-23), bringing it to 24 — see the era-cycles section for the copy-home list and the restored-wave provenance. The redesign branch (window.AP.rd) holds the published-vs-implied basis toggle and the rd-acc-stats "N's pollsters over their whole record" table (statHouses, 5-col; Ipsos pulled + YouGov admitted on one 2025 final poll by user call 7d3b8b30 2026-10-23 — the historical rd-acc-firms leaderboard n>1 grid keeps defunct houses); probe .matilda/probe/acc-basis.mjs pins the exact rendered rows on both bases (baseline-before-edit re-pin recipe; probe files are gitignored-but-tracked, git add -f).
source: auto-skill
extracted_at: '2026-09-04T07:32:32.121Z'
updated_at: '2026-10-23'
---

# auspol-accuracy-panel — "How the final polls did"

## Data side: `gen-data.mjs` (~lines 1476–1560)

The panel's entire methodology is stated in the block comment above
`const ACC_WINDOW_DAYS = 14` — read it before changing anything; it is
the on-page caveat and the reproducibility contract. Distilled:

- **Rule**: every house's LAST poll with a 2PP within `ACC_WINDOW_DAYS`
  (14) of polling day, ONE poll per house, **equally weighted** (not
  sample-weighted — "each house is a separate attempt at the same
  question").
- **Exit polls excluded** (`/exit/i.test(p.firm)`); a house's
  undecided-inclusive pair (Essential) is normalised the same way the
  trend series normalises it *before* scoring, so a 48/47 arithmetic
  artefact isn't scored as a miss.
- **`ACC_CANON` is renames-only** (`Morgan→Roy Morgan`,
  `Newspoll-YouGov→Newspoll`, `Resolve Strategic→Resolve`, …). Galaxy
  and YouGov are deliberately NOT merged — merging houses to build a
  longer record is a claim about continuity of method the table refuses
  to make.
- `accuracyCycles` = CYC_META entries with `!c.current && c.src`; each
  emits `{year: c.src (the election being CALLED, not the one that
  started the term), eDate, result, mean, err, absErr,
  houses: [{firm, date, alp2pp, err}] sorted by |err|, n, sameSide,
  worst}`. Cycles with zero houses in the window are dropped
  (`return null`).
- A second pass builds `accuracy.firms`: per-house `{firm, n, cycles,
  meanAbs}` aggregates. Payload lands in `D.accuracy`; the component
  binds it as `A` (`A.cycles`, `A.windowDays`, `A.meanAbs`, `A.firms`,
  `A.oneSided`-derived flanking).
- Cycle singletons: **1993, 1996 and 1977 have n=1** (1977 joined
  2026-10-23 via Morgan's restored 26–27 Nov final wave); the rest are n=3–11. For
  singletons `c.err === c.houses[0].err` exactly, so any solo-aware
  display logic needs no arithmetic.

## Era cycles in the panel (39de76c, 2026-09-12) — 12 → 18; 1977 at the standard window (2026-10-23) → 24

The 1974–1987 era buckets (see auspol-era-cycle-import) carry an
IMPLIED last-election-flows 2PP (tpp_alp = alp + FLOW_ERAS shares of
dem/dlp/oth on F2F Morgan primaries), and the panel ingests them
exactly like modern cycles — one Morgan final poll per cycle, n=1.

- Era misses scored: 1974 −1.3, 1975 −2.5, 1980 +1.4, 1983 +0.6,
  1984 +3.2 (1984's), 1987 +2.6.
- **1977 at the STANDARD 14-day window** (no override; the
  2026-10-23-morning `ACC_WINDOW_OVERRIDES = { 1977: 21 }` was retired
  the same day): the aeforecasts mirror ends 1977-11-20 (20 days out)
  but The Bulletin's 10 Dec 1977 election-day trend table carries
  Morgan's true final wave, fieldwork 26–27 Nov (committed
  `cyclePolls["1977"]` row dated 1977-11-27, L-NCP 45 / ALP 43 / Dem
  9 / DLP 1 / Oth 2, `tppEra: "1975"`; note on
  `cyclePollBases["1977|Morgan"]`). Scored at **+3.2** (48.6 vs 45.4)
  — the record stays 24 elections, worstCycle is **1977's +3.2** (ties
  with 1984's; first-encountered wins), Roy Morgan's firms record runs 23 cycles (meanAbs 1.9). The
  probe `.matilda/probe/cyc-early-terms.mjs` pins the row (n=1,
  1977-11-27, err 3.2, standard window), and the skill's own former
  21-day-exception text is superseded.
- Provenance comments (not page copy) state pre-1993 rows score
  implied LEF 2PP so "a single-house era's miss folds poll error and
  flow-constant drift into one figure" — comment homes move together:
  d1a1d215 asset header comment ("Twenty-four past elections…"),
  template.html CSS comment ("twenty-four elections' worth"). Dynamic
  copies (`acc.cycles.length` interpolations in build.mjs and the
  panel) self-update.
- **Watch for stale count copy**: hard-coded election counts live in
  comment homes and must move together; any future era/cycle addition
  re-opens this. Grep the count word ("twenty-three", "twenty-four")
  across gen-data.mjs template.html assets/*.js before shipping a
  cycle-count change.
- Probe path for the built payload: the accuracy object is INLINED in
  index.html as `const accuracy = {…}` (brace-match to extract it);
  `assets/cycle-source.*.json` in the repo root does NOT carry it
  (root assets hold fonts/card/sidecars only — `ls assets/*.js` is
  legitimately empty).

## Renderer: `.build/newtracker/assets/d1a1d215-…js` (~lines 1956–2145, `AccuracyPanel`)

- Rows: `byRecency` sorted year-desc, split **by position, never by
  year** — `recent = slice(0,5)` labelled "Last five elections", the
  rest "More elections" — so a newly added election slides in without
  touching the panel. `ri` = global row index across both groups,
  drives tooltip flip on the top row.
- Spread machinery: `lanesFor(c.houses)` / `laneOffset` / `LANE_H`,
  surfaced by an **acc-spread toggle button rendered only when
  `stacked > 0`** ("Separate overlapping dots" — steps identical-miss
  dots into vertical lanes without moving them on the scale; track
  height grows by `26 + maxOff*2`).
- Scale header `acc-scale`: left "← Labor understated" (LNP colour),
  centre "Result", right "Labor overstated →" (ALP colour). Negative
  err = the poll understated Labor.
- Dots: small `.acc-dot` (8px) per house with its own tooltip
  (title=firm, date=poll date, "Poll/Result/Miss"); big `.acc-mean` at
  `pct(c.err)` labelled "Average of N final polls" with row label
  "Poll average". `.acc-err` column = signed `c.err` in `col(c.err)`.
  `.acc-note` = "N house(s)" + **`All one way` flag** when `c.sameSide`
  (title copy: "the signature of an industry-wide problem rather than
  one firm's noise").
- Hint copy (`table-hint`) covers: spread-lane explanation, exit-poll
  exclusion, undecided normalisation, and the **bothWays paragraph** —
  when >1 one-sided election exists and they missed in OPPOSITE
  directions ("not a standing lean that today's figures could be
  corrected for. It is the size of the error, not its direction, that
  carries."). Don't lose that paragraph when editing the hint.
- `acc-firms` grid renders ONLY firms with `n > 1` ("By house, where
  there is more than one election to judge on"); hint notes houses are
  not merged across renames of different operations.

## Solo rule — shipped `9c8c6ee` + rebuild `83618e0` (2026-09-04)

User request: "when there is only one poll for an election, don't
display the average just display the poll". Before the fix, a singleton
cycle drew the big mean dot exactly on top of its only member's small
dot. Implementation, entirely in the renderer:

```js
const solo = c.n === 1 ? c.houses[0] : null;
const accErr = solo ? solo.err : c.err;   // identical, but named
```

- House dots suppressed when solo: `{!solo && c.houses.map(…)}`.
- The big dot renders the poll itself: tooltip title = firm name,
  date = `solo.date` (not `eDate`), first row label "Poll" /
  value `solo.alp2pp`, aria-label rewritten to name the firm; else the
  pre-existing average strings.
- Hint copy gained the clause "…– where only one house was in the
  field, its own figure stands alone; …" (verify compiled output with
  `grep -c 'stands alone' index.html` → 4 repetitions; it also confirms
  on the live site).
- NO CSS change needed: `.acc-mean` was already a plain round dot.
  `.acc-err` already equals `solo.err` for singletons, so the side
  column needed no branch.

## The redesign branch (basis toggle, stats table, firms grid)

`if (window.AP.rd) { … }` inside `AccuracyPanel` (d1a1d215 asset,
~:3038-3235) carries everything the classic branch lacks — edit THAT
branch only; the classic one after it is archived per repo rule 5.

- **Basis toggle** (`rd-acc-basis` chips): "Published two-party"
  (`basis === "pub"`) vs "Primaries on last-election flows"
  (`basis === "imp"`). Every figure runs through `errOf`/`alpOf`/
  `hh(c)` and `firmsSrc` switches `A.firms` ↔ `A.firmsImp`, so the
  whole panel — head, dek, all four summary cells, statHouses and the
  dot board — re-derives with no render fork. `test-acc-basis.mjs`
  (in npm test) pins the DATA side by replaying firmsImp and spots
  (2025 YouGov implied 53.9 vs published 52.2): a renderer-only filter
  change cannot trip it.
- **The stats table** (`rd-acc-stats`, from `statHouses`): five
  columns Pollster / Elections / Average miss / Average lean / Wrong
  side ahead, caption "{last.year}'s pollsters over their whole
  record", one row per `firmsSrc.filter(f.n > 1 && lastFirms.has(f.firm))`
  sorted by miss asc. `lastFirms` = the houses with a final poll in
  the last election's window, so ONLY that election's houses can ever
  appear. A user-quoted row of five cells
  ("Ipsos · 4 · 2.0 pts · 0.1 Coalition · 1 of 4") identifies THIS
  table, not the firms grid (three fields: name, pts, "N elections").
- **Ipsos-out / YouGov-in (7d3b8b30, 2026-10-23, user call)**: Ipsos
  pulled and YouGov let in on its single 2025 final poll — filter is
  now `f.firm !== "Ipsos" && (f.n > 1 || f.firm === "YouGov") &&
  lastFirms.has(f.firm)`, with a dated user-call comment beside it.
  The premise of the table is current houses (lean/wrong-side used to
  judge today's figures), unlike the historical `rd-acc-firms` grid
  below it, which still shows Ipsos alongside Galaxy/ACNielsen/
  ReachTEL — defunct houses legitimately remain in THAT leaderboard.
  Do NOT widen the carve-out into a general n≥1 rule: without the
  gate, all of the last election's one-off houses (Spectre, RedBridge,
  YouGov MRP, DemosAU, Freshwater) would join.
- The `firms` grid (`rd-acc-firms`, n>1) drives `fHead`
  ("X and Y have come closest; Z has missed by most") and `fDek` —
  untouched by the 2026-10-23 call.
- Sort stability trap: `statHouses` row order comes from
  `Array.sort` on miss over `firmsSrc`'s `b.n - a.n` order — ties
  (Essential vs Resolve on 1.6) render in firmsSrc order, which is
  why the probe pin lists rows in an order that does not follow from
  meanAbs alone. Pin rows from an ACTUAL rendered read, never from
  arithmetic.

## Probe: `.matilda/probe/acc-basis.mjs`

Puppeteer probe over the served build (`/cycles/` route): chip
defaults, both bases, summary-strip cells, and EXACT stats-table row
strings on both bases, including an Ipsos-absent / YouGov-present
guard since 7d3b8b30.

- The pins break on every cycle-count change (the 1977 landing left it
  red on 71→72 polls and Roy Morgan 22→23 cycles BEFORE the
  7d3b8b30 edit; the same-day wave-restoration re-pin moved avg-miss
  1.5→1.4, wrong-side 12→11, implied 15→14). RECIPE (worked
  2026-10-23): run the probe on the
  CURRENT build FIRST to harvest a pre-existing-drift baseline, make
  the code change + rebuild, re-run, then re-pin only real rendered
  strings — never pin from hand-computed rows.
- `.matilda/probe/*` is gitignored-by-`.matilda/*` but TRACKED by
  convention: `git add -f .matilda/probe/acc-basis.mjs` (the commit
  otherwise silently lacks the probe; `git add` on it errors
  "paths are ignored").
- Payload cross-check without a browser: brace-match
  `const accuracy = { … }` in built index.html, JSON.parse, read
  `accuracy.firms` / cycle houses directly (see the era/Probe-path
  note above).

## Editing cautions

- Results are stored at AEC precision (2019 = 48.47); everything is
  displayed at 1dp (`toFixed(1)`) — the comment by `.acc-detail` calls
  this deliberate.
- The data rule comment and the page hint copy must stay in sync:
  change the window, weighting, or exclusions in gen-data and the
  `table-hint` text moves with it.
- Precision trap: `sameSide` uses the unrounded signs, so a cycle can
  show "All one way" with rounded misses that look like 0.0.
