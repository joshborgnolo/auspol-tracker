# Ipsos What Worries the World — deterministic direction store

Producer-owned files only:

- `.build/ipsos-direction.mjs` — discovery/downloader plus offline parser
- `.build/ipsos-direction-src/*.txt` and `manifest.json` — committed primary
  report text captures (`pdftotext -layout`) and their provenance
- `data/ipsos-direction.json` — deterministic generated data
- `.build/test-ipsos-direction.mjs` — focused offline regression pins

No figure is hand-entered or model-supplied, and this producer does not edit
`polls.json`, the site generators, renderer, workflows or built pages.

## Run

```sh
# Entirely offline: regenerate from the committed caches
node .build/ipsos-direction.mjs

# Check without writing data/ipsos-direction.json
node .build/ipsos-direction.mjs --check

# Optional refresh from Ipsos, followed by the same guarded offline parse
node .build/ipsos-direction.mjs --fetch

# Offline regression tests (no network and no pdftotext needed)
node .build/test-ipsos-direction.mjs
```

`IPSOS_DIRECTION_SRC` and `IPSOS_DIRECTION_OUT` can redirect cache/output paths
for isolated testing. Refresh needs Node's fetch support, curl and poppler's
`pdftotext`. Discovery reads Ipsos's current report library, its Marketo
current-year downloads and the paginated What Worries the World topic archive.
Secondary country decks, press releases, COVID annexes and annual review essays
are not monthly global tables. Downloads are serial to avoid CDN throttling;
429 is not treated as absence and `Retry-After` is honoured.

The manifest preserves the originally discovered URL separately from
`retrievedUrl` and `recovery`. Only a same-month regional Ipsos article or a
Wayback capture of the exact primary PDF may recover a dead original. Archives
change provenance, never a figure. A refresh cannot erase previously discovered
history because a topic-page fetch failed temporarily.

## Output schema

```js
{
  waves: [{
    month: "YYYY-MM",
    start: "YYYY-MM-DD" | null,
    end: "YYYY-MM-DD" | null,
    fieldwork: string | null,       // printed date-window wording
    source: "Ipsos What Worries the World",
    sourceUrl: "https://…",         // actual primary PDF/capture
    australia:  { right: number, wrong: number, sample: number|null, sampleApprox?: true },
    globalAverage: { right: number, wrong: number, sample: number|null },
    countries: [{ code: "AU", name: "Australia", right: number, wrong: number,
                  sample: number|null, sampleApprox?: true }, …]
  }]
}
```

`globalAverage` is always the publisher's printed World/Global Country Average.
It is not recalculated or averaged from `countries`, and it is never inserted as
a country row. The full printed country cohort is retained so the renderer can
compute q10/q25/q50/q75/q90 on either right-direction share or net lead
(right−wrong). `bands()` uses an index of `(n−1)p` with linear interpolation
between adjacent sorted observations. Country sample sizes do not weight the
quantiles.

Sample/fieldwork nulls are provenance, not zero:

- `globalAverage.sample` is an explicit exact total sample or null; a `c.` total
  is not promoted to exact n.
- For Australia and each country n is assigned only when that wave's own
  methodology explicitly names the country in a sample group, or states the
  complete country-by-country default with/without an explicit exception list.
  The three historical method templates are handled, including 1,000+/500+ and
  `approximately 1,000` groups.
- A supplied country `sample` therefore means the **printed nominal size**, and
  `sampleApprox:true` is retained for all of these approximate 1,000/500 groups.
  It is not a claim about achieved unweighted n. `sample:null` means no such
  printed assignment was proven. Nothing spreads the global total or a generic
  Australian 1,000 over waves lacking that evidence.
- `start`/`end` describe the whole multi-country fieldwork window as printed,
  not a separately proven Australia-only window. An invalid printed end year is
  retained only in `fieldwork`; the ISO `end` is null rather than being repaired
  by inference. Month-only records may have all three date fields null.

## Guards and reconciliation

The parser requires the report-month anchors, a complete all-country direction
table, a declared roster corroborated on the table page or in its own
methodology, a single publisher average, unique country codes and printed pairs
reconciling to 100±1. It handles decimal cells and the changing `pdftotext`
layouts, including split labels and detached cells. A unique reordering of
already printed cells is permitted only when the normal order fails and exactly
one ordering reconciles every pair; it never invents a missing complement.

November 2021's table contains 28 countries but its base says 27. Its own method
and introduction both say 28, which resolves the stale base note only because
all 28 printed rows are present. July 2024 separately and expressly prints World
38/62 in its summary, trend and country table; no complement arithmetic is used.
Sample-group conflicts, unmapped countries, lost rows and anchor drift are hard
failures. Duplicate primary decks must agree figure-for-figure after sorting
countries by code; sample and date metadata are reconciled independently.

## Verified corpus at 2026-11-22

- **103 primary PDFs cached; zero unresolved downloads.**
- **90 accepted waves, 2016-09 through 2026-10; 2,546 country rows.** Early
  publishing is not monthly, so this is deliberately not a fabricated
  continuous calendar series. The archive supplies no earlier complete monthly
  global-country PDF than September 2016; review essays before that are not
  silently converted into data waves.
- **61 waves have exact global totals** (24,527 in October 2026); 29 report only
  an approximate or otherwise unusable total.
- **All 90 Australian rows carry the printed approximate n** (1,000 plus
  `sampleApprox:true`), rather than an exact achieved n.
- **2,523 of 2,546 country rows have explicit approximate sample values; 23 are
  null.** These are India in each accepted wave from 2024-06 through 2026-03
  inclusive, plus Ireland in 2025-07; no substitute was invented for those
  groups. (October 2026 separately prints India at approximately 1,000.)
- **69 waves have an ISO fieldwork start and 64 an ISO end.**
- October 2026 has Australia 36/64, publisher World 37/63, 30 countries,
  total 24,527, fieldwork 25 September–9 October 2026, and every country's
  approximate n as printed.

Nine sources are explicitly omitted because their published PDF contains no
complete all-country direction table. They are logged as `IPDIR_OMIT` by the
producer, not treated as parse failures:

| Wave | Source deck |
|---|---|
| 2020-07 | `www-summary-deck-july-2020.pdf` |
| 2020-08 | `www-summary-august-2020.pdf` |
| 2020-09 | `www-summary-september-2020.pdf` |
| 2020-12 | `www-summary-december-2020.pdf` |
| 2021-01 | `www-summary-january-20201.pdf` |
| 2026-06 | `What Worries the World June 26.pdf` |
| 2026-07 | `What-Worries-the-World-July-2026.pdf` |
| 2026-08 | `What-Worries-the-World-August-26-WEB.pdf` |
| 2026-09 | `What-Worries-the-World-September-26.pdf` |

Full reports cover July, August and September 2020 elsewhere in the corpus;
December 2020, January 2021 and June–September 2026 have no inferred replacement
in this store. A table anchor with broken figures would be a hard guard failure,
not an omission.

The three once-dead 2024 original links are now complete primary captures, not
missing waves: January uses the live `ct/publication/.../2024-01` PDF found via
the Korean mirror, May uses the relocated `news/documents/2024-07` PDF found via
the Dutch mirror, and June uses the live `...June-2024_0.pdf` via the Korean
mirror. April 2024, the older August 2024 original, September 2025 and October
2025 use archived captures of their exact primary URLs. Every URL, hash, capture
path and recovery route is in `.build/ipsos-direction-src/manifest.json`.

## Tests

`node .build/test-ipsos-direction.mjs` checks, offline:

1. Australia's and World's October 2026 figures, dates, 30-country roster and
   approximate sample flags;
2. q10/q25/q50/q75/q90 for both right share and net lead;
3. 2016 exception lists, 2021's roster typo and the June/July 2024 split-cell
   layouts;
4. nulls for unproven dates/exactness and exact-total coverage;
5. per-country methodology group coverage;
6. decimal reads and pair-sum rejection;
7. broken anchors, removed rows and malformed-cell rejection; and
8. the JSON shape, the nine omissions, 2,546 rows and idempotent regeneration.

Current output: all eight groups pass.
