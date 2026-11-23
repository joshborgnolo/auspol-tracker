# Ipsos What Worries the World — Australia/global issue archive

Producer-owned files:

- `.build/ipsos-worries.mjs` — deterministic table reader and archive writer
- `.build/test-ipsos-worries.mjs` — offline full-corpus pins
- `data/ipsos-worries.json` — generated Australian and global observations

Inputs are the primary PDF text captures and manifest in
`.build/ipsos-direction-src/`, already refreshed by `ipsos-direction.mjs`.
The Ipsos updater runs both producers. Source retrieval and manifest discovery
remain owned by `ipsos-direction.mjs`; do not hard-refresh provenance merely
when regenerating the worry archive.

Regenerate and check:

```sh
node .build/ipsos-worries.mjs
node .build/test-ipsos-worries.mjs
```

Orphan/strict checks write nothing:

```sh
node .build/ipsos-worries.mjs --check
```

## Coverage and semantics

Current stored corpus (23 November 2026): **all 103 primary PDF captures**, 96
waves from September 2016 to October 2026, 95 waves with at least one
Australian worry reading, 941 Australian observations and 1,572 publisher
global-average observations. Many waves are two months apart before 2020.

The question is prompted, not unprompted:

> Which three of the following topics do you find the most worrying in your
> country?

The report says the global score is a Global Country Average, not a
respondent-weighted world population figure. `australia` rows never include a
zero for an issue omitted from a report. A top-five-only deck supplies only
those observations; later short decks may carry just one Australian
spotlight. Globally weighted and publisher-average bases are not mixed.

Each wave has:

- its month, printed fieldwork window, text and available exact/approximate
  samples (shared with the direction reader where available);
- every source PDF URL/capture for that wave;
- `australia` and `globalAverage` arrays keyed by a stable issue id and hard
  canonical label;
- the printed share, extraction-table type and per-observation source URLs;
- `changeMonth`/`changeYear` only where those table cells can be read
  deterministically; printed `N/A` is null, while an unprinted/unread cell is
  absent;
- `shareVariants` when reports disagree, retaining every reading and source,
  with the detailed country-comparison table preferred as `share`; and
- `comparisonConflicts` where reprints disagree on a comparison cell instead
  of silently picking one.

Long-term chart lines are not converted into invented monthly observations.
Narrative percentages and colour-coded chart cells are not used as substitutes
for printed table rows. Subject accents, Oxford commas and
Australia/Australasia are deliberately not remapped: Australian facts come
from Australia-labelled rows only.

This archive is storage-only. It does not change `data/issues.json`, the live
Issues panel pool or any aggregate. Issues Monitor's separately shaped
salience/ownership history must not be folded into this 19-topic question
family without an explicit mapping.
