---
name: demosau-extraction
description: DemosAU poll agent (extract-demosau.mjs) — PDF structure (trend table "May 25 Election" anchor, name-shuffling preferred-PM bar chart, two-panel head-to-head, wrapped Leader Ratings rows, image-only charts), whole-poll insertion (VI+ppm+approval), replay-test acceptance, row-url fallback for rolled-off releases, backfill of parseable-missing rows, `published` on VI rows is hand-curated only (verify via the PDF's Last-Modified header), and never silently reporting ok when a committed row can't be re-verified.
source: auto-skill
extracted_at: '2026-09-01T05:24:46.078Z'
---

# DemosAU whole-poll extractor (.build/extract-demosau.mjs)

Direct-to-polls.json agent (NOT the assimilate-from-CSV pattern of
`polls-json-assimilation` — DemosAU publishes PDFs only, parsed on discovery).
Upgraded 2026-08-30 from VI-insert-only to whole-poll coverage; the regression
harness and honesty rules below are the transferable parts.

## DemosAU PDF structure (poppler `pdftotext -layout`, cached per slug in .build/demosau-src/)

- **Voting intention trend table**: every topline table has a "May 25 Election"
  calibration row — it is the parse anchor. `trendError` "no 'May 25 Election'
  anchor row" = the topline is an image in that release.
- **Preferred PM**: bar chart, names row then value rows. **Name order varies
  per release** (May/Jun 2026 put Hanson second). Read roles positionally from
  the names row, never assume Albanese/Hanson/Opposition ordering.
- **Head to Head**: two-panel chart in ONE figure — Albanese-vs-Hanson on one
  side, Albanese-vs-Liberal-leader on the other. Cluster data points by x
  position around the panel midpoint (`parseHeadToHead`); the committed
  `ppm.extra` is the Liberal-leader pair.
- **Leader Ratings**: real text table, rows "Prime Minister X / Opposition
  Leader Y / One Nation Leader Z", columns Positive/Neutral/Negative/Net/
  Change %. Net+Change frequently **wrap to a continuation line of lone signed
  tokens** (`-5%  -4%` on the line after the numbers) — merge it back before
  parsing or Hanson's row reads as truncated.
- **Image-only releases**: Jan 2026 renders ALL leadership charts as images;
  Feb 2026 image-only for Leader Ratings ONLY (its preferred-PM bars parse).
  There is no text to recover — do not attempt OCR or fabrication; flag and
  move on.
- **MRPs** are a separate `DemosAU (MRP)` pollster; state/territory releases
  (Vic/Tas/Qld/WA/SA/NSW, greyhound, super, republic...) must be title-filtered
  out (`STATE_RE`) or the skip list grows with junk.

## Whole-poll row shapes (match hand-entered rows EXACTLY)

- ppm: `{date, firm:"DemosAU", alb, opp, oppName, han, extra:[{alb,opp}]|null}`
  — `oppName` drops when undefined, `extra` is null when the head-to-head
  didn't print a Liberal-leader pair.
- approval: `{date, firm, alb, opp, oppName, han (all NET score), detail:{alb/opp/han:{app,dis}}|null}`.
  Historical rows Jan–Apr 2026 have `detail:null` (hand era); May–Aug have it.
- `guardNewWave` (non-MRP) requires ppm + approval + oppName alongside VI;
  plausibility: ppm 2–75, |net| ≤ 85. Guards fail LOUDLY into
  `DEMOSAU_GUARD` stderr, never write.
- Leadership insertion dedupes ±10 days against committed rows in the target
  section — DemosAU's waves can sit that close to hand-entered rows.

## Verify contract — never silently pass

`--check` compares parseable data against the hand-curated file, which stays
authoritative: differences go to `status.mismatches` (e.g. the April 2026
`ppm.alb: pdf=35 vs file=36` adjudication — user ruled the PDF wins), they are
NEVER imposed. Four status buckets, each with a distinct meaning:

- `verified[]` — committed row and parse agree (wave-level VI/seats +
  leadership). Carries `note:` (e.g. topline image-only) and, when a committed
  leadership row cannot be re-checked because the chart is an image, an
  explicit **`unverifiable:["ppm"|"approval"]`** field — an unverifiable row
  must never surface as a bare `ok:true`, or coverage rot becomes invisible.
- `backfilled[]` — parseable data for a wave whose committed section row is
  ABSENT: regenerated and inserted on the spot (same rows the new-wave branch
  writes). Only insert; updating existing values stays forbidden.
- `missing_rows[]` — data genuinely not in the PDF (image-only) for a wave
  with no committed row: human must read the image, agent reports the hole.
- `added[]` — brand-new wave, VI + ppm + approval inserted together.

### Row-url fallback (index-page drift)

Discovery reads only the DemosAU index's current PDF links; old releases roll
off. Second pass: for every committed DemosAU row not matched, refetch through
the row's OWN `demosau.com/wp-content/uploads/...pdf` url (regex-guarded) and
verify through it (`verified[].via:"row-url"`). Verify coverage must never
depend on what the index happens to list today.

### Cache versioning

`.build/demosau-src/<slug>.json` carries `cacheV` (currently 2). Bump
`CACHE_VER` whenever the derived-field schema grows (leadership fields were v2)
— stale caches re-derive from the committed `.txt` WITHOUT re-downloading
(`loadWave`); `--force` re-downloads. The `.txt` files are committed: they are
the provenance, and reparse-after-upgrade must not hit the network.

## `published` on the VI rows is hand-curated — the extractor will NEVER fill it

Every extractor route into `polls.json` omits `published`: the new-wave row
builder has no such field, the matched/backfill branch regenerates only missing
LEADERSHIP sections (ppm/approval), and existing rows are never overwritten. A
wave committed without `published` (the hand-entered Jul 2025 wave sat that way
until 1 Sep 2026) stays that way until a human edits the row — `DemosAU (MRP)`
rows never carry one at all. So curation of this field is legitimate and
expected, not a "never hand-edit polls.json" breach: add it in the house's
convention (Sydney-local `…T HH:MM`, placed directly after `date`), then
validate + rebuild.

Verify the date from the source, not memory or the PDF text:
`curl -sI <pdf-url> | grep -i last-modified` — WordPress's media store stamps
the upload moment (Jul 2025: `Wed, 09 Jul 2025 02:24:30 GMT` → +10h AEST →
`"published": "2025-07-09T12:24"`). Downstream consequences of backfilling
(cadence/spread re-derive off the extended published tail; calDays min/max can
only move if the new date extends them) live in the
auspol-next-polls-projection skill.

## Replay-test acceptance (delete-and-regrow)

The proof that the agent can do the hand curation: grow a worktree, delete the
canonical rows, re-run, diff. Additive upgrades like this one are exactly when
the matched-branch backfill gap bites — first replay reported everything as
`missing_rows` but regenerated NOTHING because the matched branch only
verified. Recipe:

```sh
git worktree add /tmp/demosau-replay HEAD
cp .build/extract-demosau.mjs /tmp/demosau-replay/.build/   # worktree has committed version
cd /tmp/demosau-replay
# python: delete the ppm/approval rows for your target dates + newest VI row
node .build/extract-demosau.mjs
# python: diff regenerated rows vs the live repo's data/polls.json
```

Expect byte-identical EXCEPT whitelisted hand-curation classes: (1) adjudicated
figure diffs where curation overrode the PDF; (2) hand-read image-chart values
(Jan/Feb 2026 leadership) that appear as `missing_rows`/`unverifiable` instead;
(3) enrichment the PDF can't source (`seats.rangeOnly` Monte-Carlo note,
`published` timestamp on the VI row — user re-curates after regen); (4)
`detail:null` rows that legitimately GAIN detail once parsing exists (favoured
upgrade — promote via user ask, then verify **10/10 clean, zero mismatches**).
Clean up with `rm -rf <worktree> && git worktree prune` (older git lacks
`worktree remove`).

## Traps from the upgrade session

- **Mid-edit clipping**: inserting a large helper block between two functions
  with search-and-replace can silently eat the following function's tail
  (guardNewWave's plausibility checks were left dangling after the helpers
  until an error surfaced). After ANY multi-hundred-line insert: `node --check`
  AND grep that the surrounding functions still end where they should.
- Committed 2026 caches derived pre-upgrade have `extractedAt` from the old
  era — cache re-derivation rewrites them; commit the cache dir WITH the
  extractor (one commit), or the next run diverges.
- Per-shape verification: run the parser's numbers back against a grep of the
  PDF text before trusting a new table parse (April leader-ratings was
  confirmed cell-by-cell against lines 106–118 of the cached txt before the
  detail was promoted into polls.json).
