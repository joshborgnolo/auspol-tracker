---
name: auspol-archive-fieldwork-year
description: auspol-tracker — the All-polls archive fieldwork date cell and its out-of-year 'YY suffix (shipped 748cdd5, 2026-09-23). fwLabel in gen-data (~:214) emits day–month ranges with NO year; AllPollsView in the d1a1d215 asset computes fieldLabel from p.ym and appends " ’YY" when the fieldwork year isn't the current calendar year. Map of the one renderer that changed and the four date surfaces deliberately left yearless, plus the sumNote→impOk implied-2PP dash that prompted the work.
source: auto-skill
extracted_at: '2026-09-23T03:08:56.759Z'
---

# All-polls fieldwork year suffix (auspol-tracker)

Worked 2026-09-23: user pasted the row "YouGov … 2PP PPM APRV 25–30 Sep" and
asked (a) why no implied 2PP, then (b) "when fieldwork dates are not 2026,
add '25, or whatever the year is" in the All polls table. Fix shipped as
748cdd5.

## Where the archive date cell comes from

- Archive rows derive `[y, mo]` from `p.ym`; the cell printed **gen-data's
  `fwLabel`** (`~gen-data.mjs:214`) — a day–month range like `25–30 Sep`
  with NO year. That yearless display is what made the Sep-**2025** YouGov
  wave read as an upcoming one (and as a data mystery).
- The fix lives in ONE renderer: `AllPollsView` in
  `.build/newtracker/assets/d1a1d215-….js`. Before the rows map:
  `const NOW_YEAR = new Date().getFullYear();` and per row
  `const fieldLabel = y === NOW_YEAR ? p.field : `${p.field} ’${String(y).slice(2)}`;`
  (added to the row object as `fieldLabel`); the date cell (~:5128)
  renders `{p.fieldLabel}`. Current-year rows stay unmarked; a prior-year
  row renders **25–30 Sep ’25**. NOTE: dynamic comparison to the CURRENT
  calendar year — on 1 Jan 2027 every 2026 row gains a suffix automatically.
- View-only: gen-data emitters untouched, so nothing else (sorting, JSON,
  Latest table) changed. index.html is rebuilt by
  `node .build/newtracker/build.mjs` and committed with the asset.

## Deliberately yearless surfaces (do NOT "fix" these without a request)

- **CSV export** "Fieldwork" column (~:4793) still emits bare `p.field` —
  defensible because the adjacent "Fieldwork end" column carries the full
  ISO date.
- **Search haystack** still uses `p.fullDate` + month tokens (already
  carried the year via `fullDate`).
- **Expanded-detail fieldwork line** (~:3235) and the a11e1559 detail
  imprint — untouched.
- Latest-polls table (a11e1559 PollsterTable) — recent waves only, no year
  needed.

## The diagnostic that preceded it (see auspol-pollsjson-schema for depth)

"Why no implied 2pp for the 25–30 Sep YouGov wave" — the row is the Sep-2025
self-published wave whose printed OTH folds in 7% undecided (primaries sum to
107), so polls.json files a `sumNote`; gen-data's `impOk` (~:271: full
primary set AND no sumNote) excludes it, the bundle emits no alpImp, and the
archive renders em-dashes in the implied cells. Published 2PP still shows.
Triage trap: don't start from the Next-expected-polls projection script —
probe the LIVE page for the pasted row text first to locate which table it's
in, then check the row's flags in polls.json before suspecting a renderer.

## Verification pattern

`.matilda/probe/where-is-25-30-sep.mjs` (untracked scratch): puppeteer-core
+ ephemeral static server over the repo, opens index.html, clicks the "All
polls" toggle in-page, and asserts rendered row text (found "25–30 Sep ’25",
current-year rows unmarked). Screenshots are useless to tools — assert text
in the DOM (see auspol-headless-geometry-verify).
