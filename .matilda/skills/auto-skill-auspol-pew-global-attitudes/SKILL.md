---
name: auspol-pew-global-attitudes
description: Extracting Pew Research Center Global Attitudes data (esp. the Australia rows) from a Pew article/short-read — chart JSON embedded in page HTML, topline PDF URL conventions with pdftotext -layout, and the hidden international-methodology-database REST endpoint for per-country n / fieldwork dates / MoE / vendor. Worked 2026-10-12 from the "French Adults Stand Out for Their Economic Pessimism" short-read.
source: auto-skill
extracted_at: '2026-10-12T04:38:14.352Z'
---

# Pew Research Center — pulling the full Australia record out of an article

A Pew short-read shows each country as ONE row of ONE chart. Pew publishes three
more layers of the same survey (full question battery + trends, per-country
methodology) — each in a different, non-obvious place. None of the interactive
layers need a login or JS browser; plain curl works everywhere below.

## Layer 1 — the article's charts: full data is embedded as JSON in the HTML

Every `prc` chart stores its data in the page's interactivity state:

```
curl -sL -A "Mozilla/5.0" <article-url> -o /tmp/pew.html
grep -c '"chartHash"' /tmp/pew.html          # number of charts in the piece
```

Search for `"chartHash"` / `"tableData"` in the HTML: each chart object carries
`tableData: {header, rows}` — the complete table behind the visual, including
rows the prose never mentions (e.g. all 18-country values). The same JSON-LD
block exposes each chart's CSV endpoint:
`/wp-json/prc-chart-builder/v1/charts/<numericId>/data.csv`.

Article body text for prose mentions: tag-strip with node —

```
node -e "const h=require('fs').readFileSync('/tmp/pew.html','utf8');
const m=h.match(/<article[\s\S]*?<\/article>/);
console.log((m?m[0]:h).replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').slice(0,6000))"
```

## Layer 2 — topline PDFs: full question battery + trend rows per country

URL conventions (note the TWO filename families):

- `https://www.pewresearch.org/wp-content/uploads/sites/20/<YYYY>/<MM>/D_<YY>.<MM>.<DD>_fielded-survey_topline.pdf`
  (the "fielded survey" topline — one question per release; 2026 economy release
  was `D_26.06.23_fielded-survey_topline.pdf`)
- `pg_<YYYY>.<MM>.<DD>_<slug>_(report|topline).pdf` — full report chapters; the
  "Report PDF" and "Topline" links on any report chapter page expose these.

Read them with `pdftotext -layout` (installed via Homebrew here) — the COLUMN
alignment survives, per-country rows grep cleanly.

Topline gotchas:

- "Not all questions … are presented in this topline. Omitted questions have
  either been previously released or will be released in future reports" — the
  economic-expectations / children-better-off questions land in LATER releases,
  so "is there more data for Australia" has a moving answer per release date.
- Main tables carry trend rows only in the CURRENT survey mode. Since the
  ~2021/22 mode switch, US and AUS waves are online-panel; pre-switch Australia
  rows live in a tail table literally headed
  `AUSTRALIA AND U.S. PHONE TRENDS FOR COMPARISON` (HU/PL F2F table likewise)
  — cite those rows as comparison-only; Pew explicitly cautions against
  phone↔online comparisons.
- Fieldwork-timeline appendices in report PDFs are GRAPHICS (no text layer) —
  don't burn time grepping them; use layer 3 instead.

## Layer 3 — per-country methodology (n, fieldwork, MoE, vendor) — REST endpoint

The country methodology pages
(`/methods/feature/international-methodology/<survey-slug>/<country>/<year>/`)
are EMPTY skeletons in fetched HTML (`<div id="js-international-methodology">`)
. The loader JS (`…/international-methodology/dist/interactive/main-*.js`)
reveals the data source:

```
GET https://www.pewresearch.org/wp-json/prc-api/v2/interactive?slug=international-methodology-database
```

→ one ~450KB JSON array (~461 rows): `{country, survey, year, sampleSize,
fieldworkDates, mode, marginError, designEffect, primaryVendor, sampleDesign,
weightingVariables, language, representative}`. Filter client-side
(`r.country==='Australia' && r.survey==='Global Attitudes Survey'`).

Caveat: NOT exhaustive — Australia's 2008/2013 GAT waves and some special waves
have no row, and the June-2020/March-2021 AUS rows the Q1 topline lists as its
primary trend don't appear either (they predate the ToSRC panel waves Pew
keeps as 'primary'). Trust the topline for figures, the DB for methodology.

## The Australia record as computed 2026-10-12 (so it doesn't get re-derived)

Spring 2026 Global Attitudes, Australia: n=2,064, fieldwork 30 Mar–13 Apr 2026,
Life in Australia™ mixed-mode probability panel (Social Research Centre, 99%
online/1% phone), MoE ±2.3 (design effect 1.15), English.
Q1 "current economic situation": good 20 (very 1 / somewhat 19) / bad 80
(somewhat 54 / very 25), +18 pts y/y, 2nd-worst of 18 high-income countries
(France 85 first; 3rd of all ~32 incl. West Bank/EJ 90).
Panel-era trend (good/bad): 2022 45/55 · 2023 35/64 · 2024 37/62 ·
2025 37/62 (n=1,829, 17–31 Mar) · 2026 20/80.
Phone-comparison rows: 2015 55/41 · 2016 57/40 · 2017 59/39 · 2018 66/31 ·
2019 65/33 · Sum-2020 37/62 · Spr-2021 74/26 (plus published-only 2008 70/27,
2013 67/30).
Other released AUS-specific content of this wave not economic: the 1 Oct 2026
social-media release (`SR_26.10.01_australia-social-media_topline.pdf`).

## The repo form (SHIPPED 2026-10-12): data/pew-econ-sentiment.json

The record now lives in the repo: `data/pew-econ-sentiment.json` (all 16
waves, full four-point detail {vg,sg,sb,vb} + good/dk per row, panel and
phone series keyed per row as `series`), gated by `validatePewSentiment` in
.build/newtracker/validate.mjs (split↔totals reconciliation, chg ↔
same-series-predecessor, methodology required unless the wave is one of the
four KNOWN_METHOD_GAPS — panel June-2020/March-2021, phone 2008/2013).
pew.txt (repo root) is the human-readable compilation of the same
record. Hand-curated, NOT wired to gen-data or the confidence panel — the
Snapshot renders data/confidence.json and data/confidence-history.json only;
do not merge this file into them (different basis: share-bad, annual, and
the panel/phone mode break). When Pew publishes the next Spring wave (or
the held-back Q1-followup questions land in a later topline), append a row
here and let the validate check adjudicate.

`data/confidence.json` rows are `{date, v, chg, url, slug}` plus advisory
`{n, fwStart, fwEnd}` — the field-shape model used. v/print-basis is
labelled in the file's _about (share-bad, never mixed with a net-balance
lane; see the nabConfidence/nabConditions basis warning in confidence.json's
_about). auspol-tracker has no Pew extractor; Pew Spring waves are annual,
so hand-entry is the appropriate weight class, not pipeline-building.
