---
name: auspol-mood-history-backfill
description: auspol-tracker — the mood-series DEEP back-history (data/mood-history.json → confidence-history.json post-rename, shipped adf8abe 2026-10-08, sibling of the live mood/confidence file; RENDERED via gen-data §5l confDeep into the confidence panel's "Show complete history" toggle since 68d1e58 — NAB's deep CONFIDENCE lane joined 2026-10-08, nabConfidence→payload nabBusiness): .build/confidence-history.mjs reads RM's YEAR×month morgan-poll grids (__NEXT_DATA__ payload, footnote-marked cells) for consumer 1973→ / business 2010→, RBA H3 csv's NAMED Title-row columns (GICWMICS westpac 2010→, GICNBC NAB conditions deviation 1997→), and the two-wire NAB CONFIDENCE composite (Moneycontrol calendar base + Tradays figure-history export on [2008-12, 2014-09), NAB_OVERRIDES 2011-08=-8, contiguous Mar 1997→). Sourcing dead-ends map (TradingEconomics guest dead, MI CASiE paid ~$363), the nabConditions≠cond basis trap (never arithmetic-merge), the independent-lane fixture-test lesson, and the deep-lane TOOLTIP fix (5dd5c85 — TrendChart's hover guide only fires on SPINE entries; the hist window merges the deep lanes' own months into the live-release spine so 19xx months tip).
source: auto-skill
extracted_at: '2026-10-08T01:36:39.903Z'
---

# Mood deep back-history — data/mood-history.json

Built 2026-10-08 (commit adf8abe) to the user's "get all this data, store it
like past cycles data is stored": a committed, extractor-generated artifact
sibling of `data/mood.json`, one row per SURVEY MONTH `{ym, v}`, four lanes:

| lane | series | depth | source |
|---|---|---|---|
| `consumer` | ANZ–RM Consumer Confidence monthly | Mar 1973→ (quarterly to 1986, monthly from Jan 1987) | RM monthly-ratings table page |
| `business` | RM Business Confidence | Dec 2010→ (series inception) | RM mirror table page |
| `westpacConsumer` | Westpac–MI Consumer Sentiment (sa) | Sep 1974→ (series inception) | dual-source: RBA H3 csv GICWMICS (2010→, one decimal) + OECD mirror FRED CSCICP02AUM460S (pre-2010, balance+100, whole points) |
| `nabConditions` | NAB business conditions, DEVIATION FROM AVG (sa, pp) | Mar 1997→ | RBA H3 csv, GICNBC |
| `nabConfidence` | NAB business CONFIDENCE, printed net balance (whole points) | Mar 1997→, contiguous | two-mirror composite: Moneycontrol calendar base + Tradays export window [2008-12, 2014-09) |

2,100 rows as of the 2026-10-08 westpac backfill + NAB-confidence composite
(both below). `.build/confidence-history.mjs` (contract same as confidence.mjs:
idempotent, exit 0/1/2, `CONFIDENCE_HISTORY_STATUS {json}` final line,
`--check`, `--fixture-dir` seam, writeAtomic), `.build/test-confidence-history.mjs`
(5-stage: parser/guard pins → fixture-dir subprocess pipeline → committed-data
pins, incl. the NAB-merge seam and the Moneycontrol hole→Tradays fill).
RENDERED SINCE
2026-10-08 (68d1e58): gen-data §5l `confDeep` maps the consumer /
westpacConsumer / business lanes to `{ym, v}` rows, plus the nabConfidence
lane renamed to the payload's `nabBusiness` (nabConditions deliberately
EXCLUDED — the basis trap below) into the payload for the
confidence panel's "Show complete history" toggle (full map in
`auspol-mood-panel`; probe `.matilda/probe/conf-history.mjs` pins the
round-trip). Post-rename the file is `data/confidence-history.json`.

## Sourcing map (what is free, and the dead ends verified 2026-10-08)

FREE and used:
- **RM morgan-poll table pages** render tables inside the `__NEXT_DATA__`
  JSON at `props.pageProps.morganPollData.morganPollBy.content`
  (`nextDataContent()`). Consumer slug
  consumer-confidence-anz-roy-morgan-australian-cc-monthly-ratings; business
  slug consumer-confidence-roy-morgan-business-confidence. `parseYearGrid`
  reads the FIRST YEAR×JAN..DEC table: footnote-marked cells parse
  (`"94.7#"` → 94.7, `"72.1**"` → 72.1), the YEARLY AVERAGE column is
  ignored, and the grid ends at the first non-year row (component tables
  sit behind the main one and must never join). A non-empty cell that
  isn't a number THROWS (exit 2), never files as a hole.
- **RBA H3 csv** (`/statistics/tables/csv/h3-data.csv`): locate columns by
  TITLE-ROW NAME ("Consumer sentiment" / "Business conditions"), never by
  column index — the sheet gains columns over time. Date rows are
  `DD/MM/YYYY` stamped at MONTH-END: the row labelled 31/10/2026 IS the
  October survey (H3's own Publication-date row says 07-Oct-2026); never
  read the stamp as a day-of-day figure. Empty cells file nothing (a lane
  keeps its own tail). H3's Westpac–MI sentiment column starts Jan 2010,
  one decimal — the source of record wherever it prints.
- **FRED/OECD CSCICP02AUM460S** — the pre-2010 Westpac–MI backfill
  (shipped 2026-10-08): the OECD's republication of the SAME Consumer
  Sentiment Index as a net balance (index−100) rounded to whole points,
  monthly Sep 1974→, free CSV no auth
  (`fred.stlouisfed.org/graph/fredgraph.csv?id=CSCICP02AUM460S`).
  `parseFredCci` rebases +100, so pre-2010 months are whole index points
  (±0.5 of MI's printed decimals). Proven against H3 across all 200
  overlap months (max |diff| 0.5 = pure rounding; iconic prints match —
  Apr 2020 75.6→76, Jul 2008 79); the extractor GUARDS the merge before
  filing (any overlap month |diff| > 0.55, or fewer than 12 overlap
  months → exit 2; a FRED fetch/parse failure → exit 1, files nothing,
  never silently H3-only). Located by header name, never position;
  FRED's `"."` gaps file nothing. NOT the nabConditions basis trap: the
  OECD balance+100 IS the CSI, one basis both sides of the 2010-01 seam.

DEAD ENDS (don't re-explore):
- TradingEconomics "guest" API — discontinued, endpoint replies that the
  guest account has been discontinued. Page is a paid-download CTA.
- Melbourne Institute CASiE 1974–2009 Westpac archive — paid product
  (~$363/item via unimelb ecommerce); melbourneinstitute site is
  Cloudflare-walled for curl anyway. The OECD mirror above is the
  accepted free substitute — whole index points, ±0.5 of MI's decimals;
  CASiE would add only the dropped decimal.
- RBA chart-pack zips — GIF/SVG images only; the "Data availability" page
  states the Westpac sentiment and NAB CONFIDENCE series are "not publicly
  available due to contractual obligations" — H3's two series are ALL the
  RBA is allowed to republish.
- NAB business CONFIDENCE (net balance, monthly since 1989) — NAB
  publishes no historical workbook and the RBA is contractually barred
  from republishing it, but the record FOUND (shipped this same day) is
  the two-wire calendar-mirror composite below; only H3's
  conditions-deviation series comes from an official body.
- ANZ–RM WEEKLY series 2008–2016 — mirrored nowhere free; weekly history
  lives in data/mood.json (Dec 2016→) only.

## The NAB-CONFIDENCE composite (nabConfidence, Mar 1997 → contiguous)

NAB publishes no historical workbook and the RBA is contractually barred
from republishing the series (affects H3's dead-end note above), so the
deep CONFIDENCE lane is built from two public economic-calendar
republications of NAB's printed figure, merged at wire-verified seams
(constants `NAB_TR_FROM`/`NAB_TR_TILL`, `NAB_OVERRIDES` in
`.build/confidence-history.mjs`):

- **Moneycontrol ecalendar API**
  (`api.moneycontrol.com/mcapi/v1/ecalendar/get-history-data?calendarId=4415070&page=`,
  ~10 rows a page, `NAB_MC_PAGES_MAX=80`) is the BASE: identical to
  Tradays on every shared month from Sep 2014 forward, and the only
  free record that reaches the **1997–2008 head (sole-witness)** — treat
  that head as one mirror's republication, not two-source verified.
- **Tradays figure-history export** (tradays.com, MQL5's calendar site,
  whole-history tab-separated export) is source of record on
  **[2008-12, 2014-09)**: its chain matches the contemporary press
  figure-for-figure there (Crikey Dec-08 −20 / Jan-09 record low −32;
  ibtimes Dec-10 −3) where Moneycontrol's old rows are MONTH-MISLABELLED.
  Tradays also carries the Jul 2012 – Jan 2013 months that Moneycontrol's
  calendar alone MISSES (4,−3,0,−1,−9,2,3), so the merged lane is
  complete from Mar 1997 with no hole and no backfill carve-out.
- **`NAB_OVERRIDES = {"2011-08": -8}`** — wire adjudication where the
  mirrors disagree (they print −9 and −7): SMH/AAP 13 Sep 2011, "dropped
  10 points to be minus eight in August"; NAB's next print of −1 then
  matches the reported "up seven points" (−8→−1) while neither mirror
  value does. Only ever add an override with the wire citation.

Guard pins: `guardLane("nabConfidence", …, { first: "1997-03",
min: −80, max: 80, floor: 340, contiguousFrom: "1997-03" })`. gen-data
§5l renames the payload key to `nabBusiness` (the live confidence block
at gen-data.mjs:2427 keys NAB business that way); rd-panels'
`deepPoints` draws it automatically — the lane's +100 shift is its own,
so `histX0` (=1997) and the "Monthly history back to {histX0}" key label
derive themselves. Years before Mar 1997 (the survey runs from 1989) are
mirrored nowhere free.

## The basis trap: nabConditions ≠ mood.json's cond

H3's GICNBC is NOT the raw net balance the NAB lane in mood.json carries —
it is seasonally adjusted DEVIATION FROM THE LONG-RUN AVERAGE in percentage
points. The month-to-month difference vs raw `cond` WOBBLES (measured
−4.9..+8.2), so no constant conversion exists. `data/mood-history.json`'s
`_about` says "never arithmetic-merge" — honour it; merging them IS a data
corruption even though both are called "NAB business conditions".

(westpacConsumer, by contrast, reconciles 1:1 with mood.json's live westpac
lane over the 2022→ overlap — all 53 rows verified equal.)

## Guard shape (guardLane)

Per lane: first-ym pin (1973-03 / 2010-12 / 1974-09 / 1997-03 for both
nab lanes), row-count floor (550/170/600/340/340), value range (RM
40..170; westpac 50..150; nabDev −60..+60; nabConf −80..+80 — the
2008-09 trough prints −34, the 2021 spike +39), and MONTH-CONTIGUITY
from each lane's regular-cadence start through its newest row
(westpac's is 1974-09 itself; nabConfidence's is its 1997-03 head — the
contiguity pin is what excludes any Moneycontrol-hole regression). Any
trip → exit 2 (structure changed upstream → healer/repair class, never
silent partial data).

## Fixture-test lesson: lanes are INDEPENDENT

`test-confidence-history.mjs`'s stage-2 "--check sees a new month, real run files
it" step cost two bugs — pin these before touching the fixtures:

1. **Appending a fixture row for a month a lane ALREADY HAS files nothing**
   (`changed:[].length>0` maybe, but `added:[]`) — Map.set just overwrites
   the value. To exercise "a new month lands", append a month beyond EVERY
   lane's own newest (the lanes' tails differ: westpac runs ahead of nab).
2. **A new month on ONE lane trips the OTHER lane's contiguity guard** if
   the new row carries (say) westpac 2026-11 but nab still ends 2026-08
   with 2026-09/10 empty — nab's interior-contiguity check then sees a
   2026-11 tail over a 2026-09 hole → exit 2. Realistic H3 rows for the
   gap months must be appended too (nab fills its lagged cells, westpac
   cell empty on those rows), matching how the RBA actually backfills.

Ordering demo in the shipped test: append 2026-09/10 rows (nab only) +
2026-11 (both) → `--check` reports `changed:true`, disk stays at 2026-10
westpac (check never writes), real run files `added.westpacConsumer
["2026-11"]` and `added.nabConditions ["2026-09","2026-10","2026-11"]`.

## Tooltips on the deep lanes (5dd5c85, 2026-10-08)

First pass of the "Show complete history" view drew the pale lines with NO
tooltips over the pre-live-file years: TrendChart's hoverguide only fires
where the pointer x lands on a SPINE entry (`nearestSpine` → `ptAtX` exact
`===` on each series' x), and the hist window still spined on `wideRaw`
(the live releases, ~2022→) — pointing at 1980 snapped to the first live
release. Fix lives in RdConfidence's hist branch: when `histOn`, build a
merged spine of the deep lanes' own months PLUS the release dates —

```js
const histSpine = [...new Map(
  deepDrawn.flatMap((k) => deepPoints.get(k))
    .concat(wideRaw.get(viewLanes[0].k))
    .map((p) => [p.x, p])).values()].sort((a, b) => a.x - b.x);
```

(Map dedupes coincident x; the sort keeps release months interleaved.)
Works because the renderer computes deep-point x with the SAME
`year + (m-1)/12` fraction the live-file x-axis uses, so exact-equality
matching lands; deep series ids are `deep-<lane>` with label
`<by> (monthly history)`. REUSABLE: any full-history/enduring-lines chart
needs its hover spine extended to cover the non-live series' x positions —
spine membership, not series membership, is what makes a point hoverable.

Probe is the same `.matilda/probe/conf-history.mjs`, now with a pointer
sweep over the deep years + recent window. TWO selector/run lessons:
- `#confidence .rd-confidence-chart svg` ALSO matches the 24×14 inline
  ICON svg RdKey renders (arrow glyph) — pin the chart by
  `svg.chart-svg`, the TrendChart root class.
- The full-history axis spans 1973→now: recent-release x positions sit in
  the rightmost ~15% of the width. Sweep fractions must reach ~0.93 or
  the "recent window still tips" assertion never visits a live month.

## Related

- `auspol-mood-panel` — the live mood.json pipeline and its own
  "Series history" provenance research (RBA RDP citations, per-electorate
  ancestry). This skill's artifact is the BACKFILL of that research.
