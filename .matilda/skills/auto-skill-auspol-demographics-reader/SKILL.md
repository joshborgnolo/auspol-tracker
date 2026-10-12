---
name: auspol-demographics-reader
description: auspol-tracker — the vote-by-group pipeline (.build/demographics.mjs → data/demographics.json, readers in crosstab-parse.mjs): per-house sources and dims, the sum-to-100 + all-voters gate, KNOWN_SKIP/KNOWN_DROP/pending/stale semantics (weekly crosstabs run fails on stale or dropped), and the 2026-10-08 RedBridge September-wave 12-row drop (standalone page-number line inside the PDF table stopped the reader mid-block; missing groups = Men, all 4 location, all 4 education, all 3 housing). Includes the dims-keys probe for diffing one wave's groups against a healthy wave; YouGov chart-id routing (KNOWN_IG for the Sky News Pulse era vs the News24 extractor cache) with the 27 Jan 2026 pre-switching-columns sheet variant (National column = the wave total, Coalition as party rows summing into lnp); FIRST/FIRST_EXTRA for one-off pre-cutoff waves; and the dateStart/dateEnd field semantics + --refresh backfill rule. Also 2026-10-10: the EMRS (Tas) adjudication — what its two federal waves actually publish (per-Tas-electorate VI charts = fileable per-house-only Other-cuts dim; prose one-cell callouts and sample-profile tables = NOT fileable) and the absence-adjudication protocol (read pdftotext -layout sections with your eyes; zero grep hits on a text-rich PDF = extraction failure, never evidence of absence).
source: auto-skill
extracted_at: '2026-10-08T08:20:00.000Z'
updated_at: '2026-10-10'
---

# auspol-tracker: the demographics reader (vote-by-group pipeline)

`.build/demographics.mjs` assembles `data/demographics.json` — first-preference vote by
group per poll wave — feeding the Snapshot "Who votes for whom" panel and the All-polls
demographics facet (gen-data `§7g`). It runs inside the YouGov/DemosAU/RedBridge/Resolve
updaters (non-fatal, refresh_crosstabs) and inside weekly `crosstabs-update`; it only
ADDS waves (nothing is refetched unless `--refresh`).

## Houses and dims (each house keeps ITS OWN group labels verbatim)

- **YouGov** — wave crosstab chart via `youGovCrosstab` (crosstab-sources.mjs): gender, age
  bands, generations, education, location (Feb 2026 on), housing (Mar on), state +
  language (Jun on); income columns read facet-only (no cross-house cut). Where the
  chart id comes from and the two sheet variants: see "YouGov chart ids and sheet
  variants" below.
- **DemosAU** — charts measured off the report PDF (demosau-charts.mjs) from Apr 2026:
  gender, age, education, location, housing tenure (+ language from May; income
  facet-only).
- **RedBridge/Accent** — the "First preference vote intention" TABLE in the wave's cached
  report text (`redbridgeCache()` maps date → `.build/redbridge-src/*.txt`), from Feb 2026
  (older reports printed figures only). Dims: `softness` (Solid/Soft/Very soft),
  `generation`, `gender`, `location`, `education`, `housing` — 20 group rows total on a
  healthy wave (see Dims-count probe below).
- **Resolve** — SMH interactive per-month series (age, gender, state), rebuilt every run.
- **Roy Morgan** — hand-entered state/city-country tables from `ROYMORGAN_STATE` inside
  demographics.mjs (only release 10363 had them); NOT in HOUSES so stale/dropped checks
  don't misfire on its sparse coverage.

## YouGov chart ids and sheet variants

`youGovSource(date)` routes to the wave's "Generic" crosstab chart at e.infogram.com:

- **News24 Pulse era** — the News24 extractor's cache
  `.build/news24-src/news24-<date>.json` (written by the laptop's Chrome run; a CI run
  can't read the article, so those waves report pending until that run) — its
  `infogram.ids`, the chart classed `"crosstab"` first. No KNOWN_IG entry needed.
- **Sky News Pulse era and one-offs** — `KNOWN_IG` in crosstab-sources.mjs records the
  id BY HAND (Sky pages need a browser to read at all). Adding one: fetch
  `https://e.infogram.com/<id>?src=embed`, commit the page as a fixture
  `.build/news24-src/ig-fixtures-<date>/ig-<id>.html`, and PIN the parse in
  `.build/test-crosstabs.mjs` (pure-parser, no network).

`crosstabOfHtml` picks the crosstab sheet of a chart: the modern sheet has ≥4
"2025"-vote columns in the header; the ONE pre-switching-columns sheet (27 Jan 2026)
instead opens `National | Male | Female` (detected as Male/Female at positions 2–3).
Both must carry a "one nation" row. The Jan sheet's quirks (commit 40e3d43):

- **"National" is the whole poll, not a group** — `ygGroup` returns null for it (never
  a group row) and `youGovDims`' `totalAt` accepts National as the all-voters column,
  so `totalProblem` still gates the table against the poll row's primaries.
- **The Coalition prints as its parties** — rows "Liberal Party", "LNP", "National
  Party"; `ygParty` maps all three (plus "labor party" → alp) and `youGovDims`'s
  accumulate (`g[p]=(g[p]||0)+ +r[n]`) sums them into lnp, exactly as a RedBridge
  split table's party rows. The pin asserts BOTH the sum (age 18–24 lnp 13 = Lib 11 +
  LNP 2 + Nat 0) and that 13 does NOT appear as a figures-row total — a future parser
  that emitted a separate printed Coalition row on a party-rows sheet would
  double-count.

## The gates a table must pass (crosstab-parse.mjs)

- `dimsProblem` — every group's shares sum ≈ 100.
- `totalProblem` — the table's all-voters column matches the wave's published primaries.
- A failing table / unreadable layout / unreachable source leaves the wave **pending** and
  it is retired every run — NEVER skipped silently (`KNOWN_SKIP` is the only opt-out, each
  entry hand-checked, e.g. `"RedBridge/Accent|2026-03-27"` = AFR-article-filed wave with
  no PDF cached).
- `STALE_DAYS = 16` from fieldwork end: a still-pending wave is listed `stale` and the
  weekly crosstabs run FAILS on it (`check-crosstabs.mjs` via the updater), alerting a
  human/agent-repair.
- **Dropped-group check**: a group present in two consecutive previous waves that is
  missing from the newest wave is listed `dropped` and the weekly run fails on that too —
  until the reader learns the new layout name, or a hand-checked `KNOWN_DROP` entry
  (`"house|dim|group|first-wave-without-it"` → why) records the house really stopped.
  Existing KNOWN_DROPs: YouGov's 50–64/65+ age bands (house switched to generations
  2026-03-24). Error string builders: house-waves table + reasons.

## Status line

`DEMO_STATUS {"changed":…,"added":[…],"pending":[…],"stale":[…],"dropped":[…],"reminders":[…],"skipped":[…]}`
— `added` entries are `{house, date, dims}`; `dropped`/`stale` are the alarms. Since
2026-10-09 (21c2e99) `reminders` covers the HAND-ENTERED houses (Roy Morgan, Newspoll,
Fox & Hedgehog, Freshwater), which stale/dropped can never catch — see
auspol-demographics-reminders-watch for the demo-watch.mjs machinery, the RM
findings-cache signatures and the tag-strip gotcha.

## Wave date fields and the FIRST cutoff

- `date` = fieldwork END (mirrors the polls.json row); `dateStart` = window start.
- `dateEnd` (added 2026-10-09, commit 40e3d43) sits beside them as
  `dateEnd: p.dateEnd ?? p.date ?? null` at all five push sites — a single-day wave
  carries its own date, 66/83 waves have a real end, Resolve's monthly rows keep the
  null fallback (resolveWaves carries no end). Zero consumers yet: additive groundwork
  for pooled-wave spans as first-class data.
- Candidates are HOUSES polls with `date >= FIRST` (`"2026-02-01"`). A one-off
  machine-readable wave BEFORE the cutoff is admitted via `FIRST_EXTRA`
  (`new Set(["YouGov|2026-01-27"])`) beside FIRST — do NOT move FIRST for one wave.
- **2026-10-09 staleness finding (the wiki-subpop audit, see
  auspol-wiki-subpop-audit)**: the FIRST comment ~:143 claiming "no house published
  these breakdowns earlier this term" is FALSE (RedBridge own PDFs through 2025,
  DemosAU from Jul-2025, TAI 2026-03-19, Climate Council MRP 2025-11); two KNOWN_SKIP
  entries are contradicted by their sources — `YouGov|2026-03-19` (the TAI PDF carries
  full gender/age/state crosstabs) and `DemosAU|2026-02-20` (its own report has the
  breakdowns). Verify current state before acting — these may be fixed by the time you
  read this.
- **Schema backfills need `--refresh`**: the default fast path keeps on-disk rows
  (`have.get(k)`), so a new ROW FIELD only materialises on a `--refresh` run — a plain
  run reports `changed:false` even though the generator now emits the field. Parse-only
  fixes (reader learns a new layout) re-try pending waves on any run, no refresh
  needed.
- Validator is `.build/newtracker/validate.mjs` — `.build/validate.mjs` doesn't exist
  (MODULE_NOT_FOUND).

## Dims-count probe (diff one wave's groups against a healthy wave)

The recipe used on 2026-10-08 to enumerate the Sept-2026 RedBridge drop:

```sh
git show origin/main:data/demographics.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
for w in d['waves']:
    if w['pollster']=='<House>' and w['date'] in ('<bad>','<good>'):
        print(w['date'])
        for dim,groups in w['dims'].items():
            print(' ',dim,':',list(groups.keys()))
"
```
Group-row deltas appear immediately (Aug 2026 = 20 rows, Sep 2026 = 8 rows, 12 missing).

## Worked case: RedBridge September 2026 wave dropped 12 of 20 group rows

Wave `2026-10-02` kept `softness`(3) + `generation`(4) + `Women`(1) and lost
**Men** (gender), **Inner metro / Outer metro / Provincial / Rural** (location ×4),
**Below Year 12 / Year 12 / TAFE or trade / University** (education ×4),
**Own outright / Mortgage / Renting and other** (housing ×3) — the row boundary was a
STANDALONE PAGE-NUMBER LINE the Sept Accent PDF paginated into the middle of the by-group
table (between Women and Men); `redbridgeTable` in crosstab-parse.mjs stops reading at the
first unparseable line, so everything below the page break vanished. Flagged in
`b46e8b6`'s commit message as crosstabs-owner work. Fix ladder:

1. PREFERRED — teach `redbridgeTable` to skip standalone page-number lines
   (`/^\s*\d+\s*$/`) mid-table, then `node .build/demographics.mjs` (the pending wave is
   re-tried automatically; the wave's cache txt already carries the full table, so no
   network is involved) and check the wave now has 20 rows. Layout changes that rename a
   column/heading instead get the same reader treatment — the reader learning the new
   name is always preferred over KNOWN_DROP.
2. FALLBACK — if the house genuinely stopped printing the groups: append KNOWN_DROP
   entries per group ("house|dim|group|2026-10-02") with the reason, so the dropped
   alarm silences honestly.
3. Verify with the dims-count probe above, then the weekly crosstabs run goes green.

## Adjudicating "this house has no breakdowns" — read the source, never a truncated grep (EMRS worked case, 2026-10-10)

User asked why demographics.json carries one Roy Morgan birth-country wave but no
EMRS (Tas) entry. EMRS — the Tasmanian omnibus house — has two FEDERAL waves in
polls.json (2026-02-19 n=953, 2026-08-18 n=968; emrs.com.au PDF reports), filed as
`EMRS (Tas)`, but had zero demographics-pipeline presence. First-pass investigation
grepped the `pdftotext` output for gender/age keywords with `head -20` truncation,
saw only the sample-profile table, and declared "no demographic data exists" —
WRONG (the user pushed back immediately). What the federal sections actually carry
once read properly (`pdftotext -layout`, then read the VI sections):

- **Full federal-VI charts per Tasmanian electorate** (Tasmania + Bass / Braddon /
  Lyons / Franklin / Clark, n≈174–223 each) — complete printed crosstabs. Fileable
  as a PER-HOUSE-ONLY dim riding the All-polls demographics facet's "Other cuts"
  tables (the same mechanism as the RM `country` one-off 2026-07-31 and YouGov's
  children/class/working dims). They can never join the common `state` axis —
  they partition WITHIN Tasmania, and Tas is itself one state group.
- **Prose one-cell callouts** (Feb: 18–34→GRN 24, male→ON 30, uni-degree→GRN 23…;
  Aug: 18–34→GRN 26, 70+→LNP 29, uni→ON 11…) — NOT fileable: the pollster's own
  cherry-picks, one (group, party) cell per dim, no full partition, can't pass
  dimsProblem/totalProblem gates. The methodology note confirms cross-tabs are
  computed internally "to ensure robustness" but not printed (beyond the
  electorate charts).
- **No age×party or gender×party TABLES** anywhere in either report. The "sample
  profile" tables are quota counts of respondents, not vote shares — don't file
  sample composition as a demographic cut.

EMRS stays out of HOUSES (no machine reader; two waves a year, sporadic content).
If the user ever wants the electorate dim entered, it's a hand-entry one-off in the
ROYMORGAN_STATE pattern (see auspol-demographics-hand-entry).

### Absence-adjudication protocol (KNOWN_SKIP/KNOWN_DROP/first-contact claims)

An absence claim that will be RECORDED — a KNOWN_SKIP "carries no crosstab", a
house-note "files nothing", a triage answer to the user — needs the same evidence
standard as a filed figure, because it is far harder for anyone to disprove later:

1. `pdftotext -layout` (NEVER the default reflow — table columns interleave), then
   READ the VI sections with your eyes. A keyword grep misses narrative callouts
   ("Respondents aged 18 to 34 (24%) were more likely…") and any `head -N`
   truncation hides whatever sorts below the fold.
2. Zero keyword hits across a clearly text-rich multi-page PDF is an EXTRACTION-
   FAILURE signal, not evidence of absence — these EMRS PDFs defeated a crude
   zlib-stream extractor entirely (font-encoded streams decompress empty). Fall
   to `pdftotext` (Homebrew poppler is installed here) then to image-OCR paths.
3. When the claim lands somewhere durable, say what the source DOES print
   (sample-profile tables, methodology cross-tab mention, prose callouts), not
   just what it lacks — that records the check actually ran.

## Worked case: YouGov 27 Jan 2026 — a pre-cutoff one-off through the real reader (40e3d43)

The Sky News Pulse wave of 20–27 Jan 2026 (n=1500; totals 31/20/25/12/12) sat outside
the pipeline on three counts: dated before FIRST, Sky-era so no extractor cache, and
its sheet predates the 2025-vote switching columns. Filed via reader extensions, not
hand-entry, because the house is already in HOUSES and the chart is machine-readable:
KNOWN_IG entry + committed `ig-fixtures-2026-01-27/` page + a test-crosstabs pin + the
jan26 sheet gate + the ygGroup/ygParty/totalAt handling above + FIRST_EXTRA admission.
Five dims landed (gender, location, age, state, income — the Sky-era sheet's full set;
no education/generations/housing/2025-vote dims exist on it, and 2PP-by-group does not
exist in the source at any date). The general rule this establishes: for a house
already in HOUSES with a machine-readable chart, extend the reader and PIN the new
variant — hand-entry constants (auspol-demographics-hand-entry) are for houses OUTSIDE
HOUSES with sporadic tables.

## Related

- auspol-demographics-reminders-watch (the 2026-10-09 watch over the hand-entered blocks this file documents — POOLED key-match, NP cadence, RM findings-cache probe).
- auspol-extractor-defect-review (fleet-wide extractor audit recipe).
- auspol-thinness-backfill (the OTHER data-completeness watchdog, polls.json fields).
- auspol-vote-by-group-pool-membership (site-side pooling of these groups).
