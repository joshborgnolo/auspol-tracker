---
name: auspol-allpolls-scope-pills
description: "auspol-tracker — the All-polls table's scope/auto-pill machinery in the d1a1d215 asset (AllPollsView): FACET_SCOPE per-facet defs + CONTEST_SCOPE for published-only matchups (lnponp tppAlt2 / 3cp tpp3, self-armed 2026-09-24), defaultScopeFor arming, the scopeSet 'until they touch it' contract, the TWO pill render sites (ap-2line on twopp vs .ap-active elsewhere), s=0 URL persistence, TESTS/without option counts, and the probe-verification gotchas (PAGE=40 pagination, bare 'N polls' = unscoped)."
source: auto-skill
extracted_at: '2026-09-24T02:15:00.000Z'
---

# All-polls scope / auto-pill machinery — auspol-tracker

All inside `AllPollsView` in `.build/newtracker/assets/d1a1d215-*.js` (line
refs at ship time, 2026-09-24). A "scope" is a removable `auto`-styled pill
(dashed, quieter) that pre-filters the table to rows a facet/matchup can
actually fill, so the reader never faces an archive of dashes.

## The moving parts (each edit usually touches several)

- `FACET_SCOPE` (~:4701) — one def per facet `{ has(p), label }`:
  twopp = basis-keyed 2PP presence (`(pubBasis ? p.alp!=null : p.alpImp!=null)
  || p.tppAlt || p.tppAlt2 || p.tpp3`, label "With a 2PP"), primary = null
  (unscoped), leadership, direction. Sits above the state declarations
  because the URL restore's `defaultScopeFor` consults it.
- `CONTEST_SCOPE` (~:4711, added 2026-09-24) — published-only MATCHUPS
  self-arm their own scope when picked in the Contest popover:
  `lnponp → !!p.tppAlt2` ("With an L/NP v ON 2PP", 5 waves), `3cp → !!p.tpp3`
  ("With a 3-cornered figure", 4 waves). It only engages when
  `facet === "twopp"` and REPLACES the facet scope while up — valid because
  any wave passing CONTEST_SCOPE passes FACET_SCOPE.twopp's `|| tppAlt2 ||
  tpp3` clause by construction.
- `defaultScopeFor(f, m)` (~:4726) — what a facet ARMS ITSELF with: null
  facet → false; twopp → `CONTEST_SCOPE[m] ? true : pubBasis` (published
  basis arms, implied stands down; contest matchups arm on any basis);
  everything else → true. Call sites: urlInit scope seed, the reseed effect,
  and `onFacet` — pass the matchup that will be IN FORCE (`onFacet` resets
  measure to default on non-twopp facets, so it passes
  `f === "twopp" ? measure : DEFAULT_MEASURE`).
- The `scopeSet` contract (~:4829) — `const [scopeSet, setScopeSet]` records
  whether the reader has ever touched the scope pill this mount. The reseed
  effect `if (!scopeSet) setScope(defaultScopeFor(facet, measure))` runs on
  [pubBasis, facet, measure, scopeSet] — so the scope follows the
  basis/matchup UNTIL first touch, then stays where the reader put it.
  `chooseScope(v)` = touch + set. `onFacet` and the chart-focus effect reset
  scopeSet to false.
- `scoping` (~:5033) — the ACTIVE def:
  `scope && ((facet === "twopp" && CONTEST_SCOPE[measure]) || FACET_SCOPE[facet])`.
  Feeds the TESTS predicate list (`["scope", p => !scoping || scoping.has(p)]`)
  — one predicate per filter so `without(skip)` can answer "how many polls
  would this option leave" beside popover rows.
- TWO render sites for the pill, gated by facet: on the 2PP facet it's a raw
  `.ap-pill.auto` span inside the `.ap-2line` wrapper right after the Contest
  FilterPop (~:5395); on other facets it's pushed into the `pills` array
  (`if (scoping && facet !== "twopp")`) that renders in the `.ap-active`
  strip — don't add a third site.
- URL: only `s=0` is ever written, and only `if (!scope && FACET_SCOPE[facet])`
  — an EXPLICIT off. No `s=` means "seed from defaults", so `?v=3` alone
  opens scoped, and `?v=3&s=0` keeps the reader's unscoped choice across
  shares/reloads. urlInit lifts `meas` out BEFORE the literal return so the
  scope seed can see it.
- The Contest popover's per-matchup counts
  (`n={rows.filter(r => archLeadInfo(r, m)).length}`) line up with the scoped
  totals for lnponp/3cp since `archLeadInfo`'s published-only branches return
  null exactly when the figure is absent. Note: popover `n=` counts are RAW
  (not inter-filter-adjusted) — by design, don't "fix".

## Verify headlessly — `.matilda/probe/contest-scope.mjs`

Drives the built page over an ephemeral node:http server + system Chrome
(see auspol-headless-geometry-verify for the skeleton). Gotchas hit live:

- The table PAGINATES at PAGE=40 — an unscoped "163 polls" view renders 40
  `<tr.arch-row>`, so don't assert rows === total; the unscoped signature is
  the BARE count text "N polls" with no " of N".
- Scoped signature: `<strong>4</strong> of 163 polls`, rows === 4, and
  `.ap-pill.auto` text === the CONTEST_SCOPE label.
- The pill's `×` (a `<button>` inside the pill span) drops the whole archive
  back in and the URL gains `s=0`; assert persistence with `page.reload()`.
- `?v=lo` / `?v=3` mount paths: the AllPollsView restore reads
  `location.search` on mount, so goto with the query THEN click the
  "All polls" tab — state survives the remount.

Build/validate loop as always: `node .build/newtracker/build.mjs` then
`validate.mjs`; `test-allpolls-url.mjs` only covers the bitmask machinery
(archMask/archUnpack/URL_HOUSES) and won't catch scope regressions — the
probe is the check.
