---
name: auspol-macro-lanes
description: auspol-tracker — the Economic sentiment panel's "Inflation & growth" view subsystem end-to-end (.build/macro.mjs extractor → data/macro.json → gen-data §5m → validate.mjs → RdMacro in rd-panels.jsx → Info copy → test-macro.mjs → .matilda/probe/macro-view.mjs). Adding or renaming a lane touches ALL EIGHT homes. Carries the OECD DF_PRICES_ALL per-member stall map AND the 2026-11-09 fix for it: the OECD monthly "Consumer Prices, OECD" release PDFs carry the per-member panel monthly — oecdCpiMed is the 38-member median, spliced SDMX≤Dec-2025 + release-PDF Table 1 ≥2026-01, with the parser's full hazard list (kerning-split country names, two table editions, OECD-Total spelling, shutdown-era null aggregates). PLUS the 2026-11-10 unemp LEVEL-lane worked instance (ABS LF M13 key discovery, publication-precision rounding, nameplate/csv-header "annual change" copy consequences, lane inherits the daily crosstabs job — no new pipeline).
source: auto-skill
extracted_at: '2026-11-09T10:17:22.709Z'
---

# Adding or renaming a lane in the "Inflation & growth" view

Worked end-to-end 2026-11-07 (added `rnndi` and the `usUkCaCpi`
US/UK/Canada CPI mean, replacing same day's 37-member-median trial
`oecdCpiMed` — the member archive stalls months behind the aggregates)
and reversed **2026-11-09**: `usUkCaCpi` out, `oecdCpiMed` back IN —
now fed past Dec 2025 by the OECD's own monthly release PDFs, whose
per-member Table 1 the SDMX member archive lags. The trio mean survived
exactly two days; the stalls map below still holds (it's WHY the release
feed exists) — only its conclusion changed.
Third instance **2026-11-10**: the `unemp` unemployment-rate lane
(ABS LF `M13`, shipped `f79f8987`/`90a74c2d`) — the view's FIRST
level lane, whose display/copy consequences live in the LEVEL-LANE
section below. Ten lanes, seven pulls, since.

## The subsystem (eight homes per lane)

1. **`.build/macro.mjs`** — the extractor (ABS + OECD public APIs, six
   serial CSV pulls, node:https because UNDICI FETCH GETS DETERMINISTIC
   HTTP 500s from OECD's NSI backend while node:https 200s the same
   request; PLUS the monthly OECD release-PDF probe for the median's
   release era — see the median-era block below). Per lane: a `SOURCES`
   entry (or reuses a pull — see the all-areas move), a derivation
   (`yoyFromLevels` for ABS levels → annual change; `printedRows` for
   printed measures; a computed lane like `medianCpiLane` or the
   `spliceMedianLane` era join), `BAND`/`MIN_ROWS`/`STALE_DAYS` entries
   (breach → exit-2 guard), the `laneGuards` key list, the doc block in
   `_about`, the KEYS array in MACRO_STATUS, header lane docs, and the
   fixture-manifest comment for `--fixture-dir` (fixture mode SKIPS the
   release probe — the store era reads the committed JSON only).
2. **`data/macro.json`** — built output; never hand-edit.
3. **gen-data.mjs §5m** — a key list passes each lane's {label, basis,
   rows} through to the data asset verbatim.
4. **validate.mjs** (`validateMacro`) — its own BAND/STALE mirrors (the
   same values; the guard's live-file gate) plus the lane-count wording in
   the header comment.
5. **`rd-panels.jsx` `RdMacro`** — a `LANES` entry: `{k, by, house, color,
   solid, q, dash?, rows, history, vfmt, short}`. Australian ABS lanes
   draw solid WITH dots (need a colour token); OECD/G20 comparators are
   dashed `var(--ink-2)`, no dots (`dash: "3 3"`, overridable per-lane via
   `l.dash`). Also the `SHEET` map in `exportCsv`, the `copy.caption`
   provenance text, the `macroStory` head+dek clause, the component header
   comment (lane spans), and the confidence `HowTo` paragraph further
   down (~end of file).
6. **`template.html`** — a `--macro-<name>` oklch token at BOTH rungs
   (light ~:127-129, dark ~:249-251) for a new solid lane. Nothing needed
   for another `var(--ink-2)` dashed lane.
7. **Info-page copy** in `.build/newtracker/assets/d1a1d215-…js`
   ("Inflation & growth is a third tab" paragraph ~:8700) — the lane's
   public-facing description lives there too.
8. **Tests + probe** — `.build/test-macro.mjs` (fixture builders per
   source file, known-value pins, guard-trip blocks, stage-3 live
   structural pins: span starts, MIN_ROWS/BAND/STALE sweeps, KEYS list)
   and tracked probe `.matilda/probe/macro-view.mjs` (headless render: tab
   swap, read-row figures == file's own newest rows, history mode, rungs).
   Mirror the probe's lane set **by lane identity plus a lane-order array
   built with the same concat pattern as the component** — asserting fixed
   row INDICES is exactly the drift that made the probe go red on the
   lane insert (row 3/4 asserted by position).

## Extractor conventions that matter

- **One OECD pull serves three lanes.** `oecdCpi`'s URL uses an EMPTY
  REF_AREA (`.M.N.CPI.PA._T.N.GY/all`, 8-part key:
  REF_AREA.FREQ.METHODOLOGY.MEASURE.UNIT_MEASURE.EXPENDITURE.ADJUSTMENT.
  TRANSFORMATION); the ~3 MB response carries 53 areas (OECD/G20/OECDE
  aggregates AND every member + non-OECD BRA/IND/etc.). That removed the
  separate G20 fetch — don't re-add one.
- **ABS y/y derivation**: quarters-levels → `v_t = lvl_t/lvl_{t−4} − 1`,
  rounded 1dp (`yoyFromLevels`, skip pairs missing the prior year — never
  invent). ABS keys: CPI idx `ABS,CPI,2.0.0/1.10001.10.50.Q`; RNNDI
  `ABS,ANA_AGG,1.0.0/M1.NNDI_PCA.20.AUS.Q` ("M1" levels, sa=20).
  `NNDI_PCA` was found by fetching the codelist
  `…/rest/codelist/ABS/CL_ANA_AGG_ITEM/1.0.0` and grepping "disposable" —
  that's the discovery ladder for any ABS item.
- **ABS DSD discovery ladder for a NEW dataflow** (worked on LF): fetch
  `rest/dataflow/ABS/<FLOW>/1.0.0?references=all` and extract the DSD's
  dimension order (LF: `MEASURE.SEX.AGE.TSEST.REGION.FREQ`), then fetch
  `rest/codelist/ABS/CL_<FLOW>_MEASURE/1.0.0` (the flow-specific codelist
  id — `CL_MEASURE` bare does NOT exist) and grep the measure name.
  Unemployment rate is `M13`; persons is SEX 3, 15+ is AGE 1599,
  seasonally adjusted is TSEST 20 →
  `ABS,LF,1.0.0/M13.3.1599.20.AUS.M` (monthly, 1978-02→).
- **An ABS printed lane can need rounding anyway**: the LF download's
  OBS_VALUE carries ~8 decimals while the ABS prints the rate at 1dp (its
  own CSV's DECIMALS column says 1) — the unemp lane maps printedRows
  through Math.round to the PUBLICATION's precision at file time, so the
  store itself files what the ABS publishes.
- **Bands are empirically set, not copied**: measured on the finished
  computation before committing (RNNDI ran −7.8…+17.9 → band [−12, 25],
  wider than gdppc because terms-of-trade swings; the member-computed
  lanes ride [−5, 30]).
- **MIN_ROWS for a computed lane** = measured span (median lane 660 SDMX
  rows → 600 floor), and the synthetic fixtures must EXCEED the floor
  (the 2026-11-07 trio fixture's 849-vs-848 off-by-one cost a failing
  pin; period count = months between endpoints + 1).
- The all-areas pull's per-country coverage ('distinct REF_AREA: 53')
  tells you NEWZ (NZL) never appears monthly — quarterly CPI only
  (the release-era Table 1 DOES print New Zealand — the two eras have
  different member panels; see the splice's measured handoff).

## OECD DF_PRICES_ALL per-member freshness (measured 2026-11-07)

WHY the median lane needs a second source era: the OECD's member archive
stalls MONTHS behind its aggregates for most members, while the
aggregates stay current (they're OECD-computed, from news release
feeds — release of 2026-11-06 reported 2026-09 at 4.5%). Member coverage
states measured off the live feed + DF_KEI cross-check (identical
stop-dates there, incl. on LEVELS — so levels→y/y derivation can't cheat
it either):

- current through 2026-09: USA, GBR, CAN, DEU, KOR, COL (AUS only joined
  the monthly series 2025-04, ~30 rows)
- stuck at 2025-12: FRA, ITA, ESP, POL, SWE, NOR, CHE, AUT, BEL, TUR,
  CZE, FIN, EST, LTU, LVA, SVK, SVN, GRC, HUN, PRT, IRL, ISL, DNK, LUX…
- older stalls: JPN 2021-06, MEX 2024-07, CHL 2023-12; NZL never.

So an SDMX-only member median was truthful THROUGH 2025-12 (25+ member
months every month 1971→Dec 2025, probe-verified) but displayed as if
stale; extending it from DF_PRICES_ALL monthly would flip the panel from
33 members to the ~8 reporting — a fake composition signal. The 2026-11-07
trio-mean replacement dodged that but froze the panel at three members.
The 2026-11-09 fix keeps the SDMX lane ≤2025-12 and reads the members'
own monthly publication past it (below).

DF_KEI shape note (cross-check probe): measure `CP` (there's also an
unused `IN`), key form `<AREA>.M.CP.GR._Z._Z.GY`; same OECD NSI rate
policing applies — serial probes still 429 after ~15 rapid calls, the
extractor's own patient budgets exist for a reason.

## The oecdCpiMed release era (OECD release PDFs + committed store)

The OECD's monthly "Consumer Prices, OECD" news release carries a
per-country annex that does NOT suffer the SDMX lag — the OECD gathers
from national releases to compute its aggregate, so the member rows are
current (all 38 incl. NZL; 35–38 parse per release in 2026). Discovery
and parse, all proven live 2026-11-09 across releases Dec-2025→Nov-2026:

- **URL (no discovery page needed):**
  `https://www.oecd.org/content/dam/oecd/en/data/insights/statistical-releases/<Y>/<m>/consumer-prices-oecd-<mm>-<Y>.pdf`
  — directory month unpadded (`/2026/5/`), filename month zero-padded
  (`consumer-prices-oecd-05-2026.pdf`). The `/content/dam/` DAM path is
  reachable by plain curl/node:https; the oecd.org HTML pages themselves
  403 a curl even with a browser UA (bot wall) — never route discovery
  through a page scrape.
- **Reference month lives IN the PDF, not the filename:** the Table 1
  subtitle ("March 2026, year-on-year inflation rate (%)…"). Release of
  month R covers reference month R−2 (probe window = newestCommittedRef+2
  … this month — steady state ~2 candidate PDFs a run, ~700 KB each, one
  404 for the not-yet-published month is normal and silent).
- **Table 1 layout** ("Table 1 – CPI and HICP, OECD countries and zone
  aggregates"): aggregate rows first (`OECD`, also spelled `OECD-Total`
  in the Jan-2026-edition era; G7, EU, Euro area — never median
  members), then the member rows. Two editions: the standard 16-cell
  row (headline CPI at token index 2) and the year-end 17-cell row with
  two leading annual-average columns (index 4). The header's first three
  `MMM-YY` tokens are always [ref−12, ref−1, ref] — verify, don't
  assume.
- **Parser hazards (each cost a real fix):** pdftotext's text layer
  splits country names mid-word with kerning gaps ("Norw ay",
  "Colom bia", "Germ any") → match the name allowlist
  whitespace-tolerantly; cells carry `..`/`…` sentinels and an `e`
  estimate suffix; rows present footnote numbers after the name
  ("United States 4, 5"); a header label's stray year ("…from December
  2019") confounds full-grid token alignment — the 16/17-edition rule
  above is what survived all 12 backfill releases.
- **Shutdown-era release (Dec-2025 release, Oct-2025 ref):** OECD-total
  aggregate `..` (US data missing) — the release's median-vs-aggregate
  cross-check must tolerate a null aggregate without vetoing the median.
- **Guards, all measured on the 2026 releases:** ≥25 members grid-valid
  (`MED_MIN`); per-figure band [−15, 100]; median within 2.0pt of the
  same table's OECD-total print (`MED_AGG_DRIFT`; measured gap
  0.9–1.5pt); release/archive overlap (Nov+Dec 2025 in both) within
  0.5pt (`MED_HANDOFF`; measured 0.1–0.2 — NZL joins the panel in the
  release era). A filed entry ALSO re-computes its committed median from
  its own committed figures every run (hand-edit catches).
- **The store**: `.build/macro-src/oecd-member-inflation.json`, refs
  `{ref: {release, url, oecd, median, figures}}`, figures frozen
  as-released (OECD revisions never rewrite a filed month).
  `spliceMedianLane` = SDMX ≤2025-12 + store ≥2026-01 (SDMX rows own the
  overlap era). `crosstabs-updater.sh` commits `.build/macro-src` (its
  FILES array gained it with the lane). Lane `STALE_DAYS` = 110 (release
  lag ~2 months + slow-December headroom) mirrored in validate.mjs.
- Parser test seam: `parseReleaseTable1(pdfText)` is exported pure —
  synthetic pdftotext strings in test-macro (16/17 editions, kerning
  gaps, footnotes, drops) pin the parse without live PDFs.

## test-macro seams that bite twice (both cost debugging time)

- **The fixture subprocess `cwd` is one shared temp dir while fixture
  CSV dirs vary.** `.build/macro-src/oecd-member-inflation.json` is
  CWD-relative, so a store written into fixture-dir D is INVISIBLE to a
  run whose cwd is the shared tmp. Store-exercising tests need a cwd
  override (the test file's `run(dir, {CWD: d})`; the `data/` output
  dir likewise gets made per cwd).
- **Store fixtures must round-trip**: the committed `median` field gets
  recomputed from the committed `figures` every run (corruption guard).
  Hand-writing `{median: X, figures: …}` that doesn't average to X
  within 0.05 trips the CORRUPT guard instead of the guard the test
  meant. Centre the 26-member grid trivially (i-th member at base+0.1i
  → median = base+1.25 exactly).
- **`MACRO_LIB` helpers never process.exit inside pure code** — the
  splice returns `{rows, handoff, corrupt}` and only the main block
  calls `guard()` (exit 2). Guard trips are subprocess-asserted, never
  exercised in-process.

## Adding a LEVEL lane to a view whose copy promises change (worked 2026-11-10, unemp)

The `unemp` lane (unemployment rate, printed monthly, seasonally
adjusted, persons 15+, 1978-02→; measured 584 rows, span 3.4
(Oct 2022)–11.2 (Dec 1992) across the whole series) landed with
BAND [0, 20], MIN_ROWS 550, STALE_DAYS 75 (monthly ABS cadence —
matters: newest reference month ages to ~45d between releases) mirrored
into validate.mjs as ever. Consequences that recur whenever a lane is a
LEVEL rather than an annual change:

- The card's `.rd-un-ptitle` nameplate said "annual change, per cent" —
  now reads "per cent" (per-lane basis text carries the annual-change
  wording). The probe's ptitle pin moved with it. Sweep for the old
  phrase — it was pinned in `.matilda/probe/macro-view.mjs` too.
- The SHEET map's csv export header column `annual_change_pct` became
  `pct` (user-visible column semantics); SHEET gained `unemp:
  "Unemployment rate"`.
- The lane's own `short` says outright it's a level, not an annual
  change — reading 4.7% beside "per cent" can't be mistaken for a
  growth rate.
- Its insertion point in RdMacro's LANES concat was the ABS block
  (after rnndi, before ausGap); test firings use descriptive english —
  lane order only exists as component + probe concat, kept in lockstep.
- Colour token `--macro-unemp: oklch(0.55 0.11 290)` /
  `oklch(0.71 0.11 290)` both rungs; hue chosen to sit clear of gdppc
  230 (blue), rnndi 155 (green), cbigap 330 (magenta).

## Automation for a new macro lane: confirm, don't scaffold

A lane inside macro.mjs needs NO new pipeline: the daily
crosstabs-update.yml job (and fresh_site's refresh_crosstabs path)
already runs macro.mjs, validates, builds, commits and pushes, and the
extractor's own `stale` list surfaces in MACRO_STATUS into the wrapper's
stale-wave alarm → agent-repair. When asked to "automate like the
others" for something that rides macro.mjs, the answer is the lane
itself inherits the daily CI job; say so instead of standing up a
second updater that would double-run the same extractor. The header
comment in `.build/crosstabs-updater.sh` enumerates macro.mjs's scope —
extend that enumeration when the lane joins.

## UI facts for this view

- Read rows + legend labels come from the SAME LANES entries — a rename
  propagates; keep `by` short (longest working: "Real net national
  disposable income per person", fits desktop end labels).
- `macroStory`'s dek composes per-lane optional clauses; both live lanes
  there (oecdCpi average, usUkCaCpi average) …and anything joining later
  needs its own guarded clause, never an unconditional one.
- `deepRows`/`cpiSplice` operate on lane keys `cpi` etc. by NAME; a new
  quarterly lane only needs `q: true` for its dot-date phrasing.

## Verification recipe (order matters)

`node .build/macro.mjs` (live regen, inspect MACRO_STATUS tail rows) →
`node .build/test-macro.mjs` → `node .build/newtracker/validate.mjs` →
`node .build/newtracker/build.mjs` → `node .matilda/probe/macro-view.mjs`
→ full `npm test`. A lane that landed all of those is push-ready.

## Related

- auspol-mood-panel — the confidence panel this tab lives inside.
- auspol-probe-drift-repair — the probe-update discipline.
- auspol-branch-merge-land-race — pushing the land itself.
