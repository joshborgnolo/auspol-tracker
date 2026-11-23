# Ipsos Issues Monitor — complete source and history store

Producer-owned files:

- `.build/ipsos-history.mjs` — one-time/backfill downloader and manifest
- `.build/ipsos-history-src/*.txt`, `manifest.json` — primary PDF text cache
- `.build/ipsos-issues-history.mjs` — deterministic history reader/writer
- `.build/test-ipsos-issues-history.mjs` — offline full-corpus tests
- `data/ipsos-issues-history.json` — generated archive

Download or refresh source statements and run the reader:

```sh
node .build/ipsos-history.mjs --fetch
node .build/ipsos-issues-history.mjs
node .build/test-ipsos-issues-history.mjs
```

The reader's `--check` emits a coverage status without writing. Do not lower
`IP_FIRST` or feed old observations into `data/issues.json`: this is a separate
archive, not a change to the Snapshot's current-term pool.

## Corpus

Current coverage: **105 source documents**, 265 reports from **August 2013 to
October 2026**, 102 national reports and 163 NSW/Victoria/Queensland/WA state
reports, 4,362 salience rows and 35 parsed methodology statements. Every
identified table in the cached corpus reads.

Includes:

- the recovered 2013–2015 monthly/mixed-period national reports;
- all available national packs for 2016–2024, including their annual history;
- the two 2013 Victorian sections, all 17 verified 2014–2015 state reports,
  and the 2016–2024 quarterly state packs;
- the current committed `.build/ipsos-src` reports/statements;
- the archived commentary bundle and all currently linked Issues Monitor
  methodology statements, including pre-standardisation filenames.

Annual averages reach 2010. Monthly national figures reach July 2012 apart
from the October–December 2015 column not published in the verifiable archive;
older series include two-month and quarterly windows. These remain
explicitly `two-month pool`, `quarter` and `annual average` rows, never
invented monthly estimates. Reprints and source revisions stay attached to
their source rather than being collapsed into a false canonical timeline.

The full pdftotext cache preserves cohort/demographic leaders, special COVID
presentations and all commentary. The structured store includes national and
state issue salience, current and reprinted tables, party capability,
previous/election comparisons, state/rest-of-Australia comparisons, fieldwork
and sample metadata that can be read deterministically.

## Schema and verification

`reports[]` records each source/scope/report month, with:

- `salience[]`: labelled period, basis, start/end months, and every printed
  issue share by the existing hard-coded `IP_ISSUE` keys;
- `current`: the source's own current column;
- `ownership` and `top5` where printed, including legacy bar-chart layouts;
- `comparisons`, `restOfAustralia`, exact fieldwork/sample where available;
- primary PDF URL and committed text-capture identity.

`methods[]` carries exact raw/effective samples and dates when a statement
provides them. `sources[]` gives every document's primary URL, capture path
and text SHA. `documents[]` retains commentaries/special presentations that
are not ordinary monthly tables. `unread` is a hard coverage audit; currently
empty, not a silent "no data" placeholder.

National/NSW/Victoria/Queensland/WA scopes are closed mappings, including the
printed NSW/QLD/WA abbreviations. The source's August 2020 `JU 2020` typo and
June 2018 Victoria repeated-March-page typo are pinned source corrections,
not generic aliases or cross-country data substitution. Party figures are
preserved even when a publisher's old printed bar chart does not sum to 100;
the tests reject column corruption, not historical printed conventions.

This archive does **not** alter page copy, aggregates or the existing Issues
panel. What Worries the World is a different prompted question family and is
stored separately in `data/ipsos-worries.json`.
