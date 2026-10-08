---
name: auspol-mood-history-backfill
description: auspol-tracker — the mood-series DEEP back-history (data/mood-history.json → confidence-history.json post-rename, shipped adf8abe 2026-10-08, sibling of the live mood/confidence file; RENDERED via gen-data §5l confDeep into the confidence panel's "Show complete history" toggle since 68d1e58 — consumer/westpac/business only): .build/mood-history.mjs reads RM's YEAR×month morgan-poll grids (__NEXT_DATA__ payload, footnote-marked cells) for consumer 1973→ / business 2010→ and RBA H3 csv's NAMED Title-row columns (GICWMICS westpac 2010→, GICNBC NAB conditions deviation 1997→). Sourcing dead-ends map (TradingEconomics guest dead, MI CASiE paid ~$363, NAB confidence contractually restricted), the nabConditions≠cond basis trap (never arithmetic-merge), and the independent-lane fixture-test lesson.
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

1,746 rows as of the 2026-10-08 westpac backfill (the dual-source westpac
lane below). `.build/mood-history.mjs` (contract same as mood.mjs: idempotent,
exit 0/1/2, `MOOD_HISTORY_STATUS {json}` final line, `--check`,
`--fixture-dir` seam, `MOOD_HISTORY_LIB` export seam, writeAtomic),
`.build/test-mood-history.mjs` (3-stage: MOOD_HISTORY_LIB parser/guard pins →
fixture-dir subprocess pipeline → committed-data pins). RENDERED SINCE
2026-10-08 (68d1e58): gen-data §5l `confDeep` maps the consumer /
westpacConsumer / business lanes to `{ym, v}` rows (nabConditions
deliberately EXCLUDED — the basis trap below) into the payload for the
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
- NAB business CONFIDENCE (net balance, monthly since 1989) — NO free
  machine-readable source exists; only H3's conditions-deviation series is
  available.
- ANZ–RM WEEKLY series 2008–2016 — mirrored nowhere free; weekly history
  lives in data/mood.json (Dec 2016→) only.

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

Per lane: first-ym pin (1973-03 / 2010-12 / 1974-09 / 1997-03), row-count
floor (550/170/600/340), value range (RM 40..170; westpac 50..150; nabDev
−60..+60), and MONTH-CONTIGUITY from each lane's regular-cadence start
through its newest row (westpac's is 1974-09 itself). Any trip → exit 2
(structure changed upstream → healer/repair class, never silent partial
data).

## Fixture-test lesson: lanes are INDEPENDENT

`test-mood-history.mjs`'s stage-2 "--check sees a new month, real run files
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

## Related

- `auspol-mood-panel` — the live mood.json pipeline and its own
  "Series history" provenance research (RBA RDP citations, per-electorate
  ancestry). This skill's artifact is the BACKFILL of that research.
