---
name: auspol-historical-final-demographics
description: auspol-tracker — the pre-2025 final-election demographic polling stores (data/demographics-{2013,2016,2019,2022}-election.json) built by .build/analysis/election-demographics via a lanes-and-evidence pipeline. Read BEFORE extending the stores (new house, new election, re-scrape) or trusting a 2013–2022 demographic figure. Lives or dies by three rules: never invent a figure, every figure traces to a saved file under src/, and several houses flatly never printed what you would expect.
source: auto-skill
extracted_at: '2026-11-10T06:07:35.066Z'
---

# Pre-2025 final-election demographic stores — kit and source map

Built 2026-11-10 after the user asked to "scrape it all, store it" (final-poll
demographic breakdowns for elections before 2025). Inert stores only —
nothing renders them.

## Kit anatomy (.build/analysis/election-demographics/)

- `manifest.json` — the four cycles (election dates 2013-09-07, 2016-07-02,
  2019-05-18, 2022-05-21) and the lane JSON schema.
- `lanes/<house>.json` — one per source house, agent/hand-authored: `waves[]`
  (verbatim printed figures, `und` if printed, dims with AS-PRINTED band
  labels), `sources[]` (url + `archived: src/<lane>/<file>` + note),
  `notes[]`, `gaps[]` (a documented miss is a required deliverable, NOT a
  failure — record what was probed).
- `src/<lane>/` — verbatim evidence (wayback HTML/PDF, a NOTES.md mapping
  file → URL → wayback timestamp). A figure without a file here does not
  belong in a lane.
- `build-stores.mjs` — the ONLY thing that touches data/. Merges lanes →
  `data/demographics-<year>-election.json`. Rules inside: re-base to decided
  voters where a wave printed `und` (keeping und on the wave, same
  convention as the 2025 store); keys normalised to alp/lnp/grn/onp/oth with
  house extras (uap/nxt/pup/ind…) riding through; gender labels
  Male/Female→Men/Women, every other dim label verbatim; PASSTHRU fields
  `publication`/`pool`/`adjacentQuarter` survive to the store; totals/cell
  sums checks are NOTES (±1.5), never silent drops — old houses printed
  whole numbers (GF-5 review note). Mirrors data/demographics-2025-election.json's
  shape (pollster/date/dateStart/sample/total/dims/parts) plus und/tpp blocks.
- `probe-feeds.mjs` — the dead-end probe that established §below's negatives.

## Verified source map (the hard-won part; dates of verification 2026-11-10)

- **BludgerTrack machine tables: NOTHING pre fed2025.** `/fed2022/…/xml/
  current.xml` 404s on live and a whole-host CDX `.*current\.xml$` filter is
  empty — see the auspol-bludgertrack-archive skill (reads like authored
  against this check; the two agree). Do not retry Wayback for it.
- **Essential Research**: suspended VI after its 2019 failure, resumed
  ~late-2023 → NO 2022 final exists, and the rebuilt site only carries
  2021→ on WP. 2013/2016/2019 finals live at **essentialvision.com.au**
  (Wayback; e.g. /federal-voting-intention-{7,22,131} posts +
  uploads/YYYY/MM/Essential-Report_*.pdf table packs). **Their weekly PDFs
  printed NO gender/age/state VI crosstabs** (verified full-text 2013/2016/
  2019 finals) — a documented null, not a fetch failure. 2016 final's only
  split: already-voted 22%. 2013-era Essential PDFs use subsetted fonts —
  pdftotext output is garbled beyond recovery (their About-page sample n
  is unrecoverable; file `sample: null` honestly).
- **Newspoll**: NO quarterly demographics for Q3-2013 or Q2-2019 (cadence
  gone post-2019). Poll Bludger open WP REST (`/wp-json/wp/v2/posts?search=
  newspoll&after=…`) reproduces the real tables in post bodies
  (content.rendered HTML). Jan–Mar 2022 quarterly = 2PP-only dims (state /
  age 18–34 66-34 … 65+ 42-58 / gender / $150k+ income) published 25-03-2022.
  The Australian's 2016-era breakdown articles are paywalled on
  theaustralian.com.au; live origin-host PDF probes (per the
  auspol-newspoll-tables-pdf ladder) all 404'd for pre-2025 finals months.
- **Resolve Strategic**: first federal poll April 2021 — 2013/2016/2019
  Resolve rows cannot exist. 2022 final campaign poll (fieldwork 12–17 May
  done n=2,049; Age/Herald) + age×party retrospective in Poll Bludger's
  2023-07-05 'resolve-strategic-state-and-age-breakdowns-open-thread' post
  (18–34: ALP 31/LNP 27/GRN 22 verified verbatim). Note its 2023 'state'
  figures are the Apr–Jun 2023 wave, do NOT merge them into the 2022 wave.
- **Roy Morgan**: roymorgan.com/findings live archive + wayback. 2013 final
  (finding 5169, fieldwork 4–6 Sep, n=4,937) carries a FULL demographic pack:
  6 state tables, cities/country, 5 age bands, gender-2PP. 2019/2016 finals
  existed as findings ~7980/6869-79 (Lane cat-and-mouse: CDX `findings/…`
  slugs + `findings?id=` probes).

## Procedure when extending (new house / new election)

1. Read the kit README for the current houses × finals coverage matrix; only
   probe GAPS, never re-scrape what's filed.
2. Evidence first: fetch the source doc into `src/<lane>/` (wayback
   `https://web.archive.org/web/<ts>id_/<url>` raw originals; CDX with
   `matchType=prefix` and NO trailing `*`; IA goes "Temporarily Offline" for
   stretches — retry later, don't accept failure as absence).
3. Parse to lanes/<house>.json. Every figure cross-checks against the saved
   file before filing; figures that can't be verified from the saved copy
   are NULL (never from agent-report memory; the 2013 Essential sample was
   dropped this way).
4. `node .build/analysis/election-demographics/build-stores.mjs`, read its
   CHECK lines, regenerate stores, then update the README matrix.
5. `node .build/newtracker/validate.mjs` and `npm test` must stay green —
   stores are inert, used by nothing; validate.mjs and gen-data get NO edits.

## Pitfalls

- Paywalled sources: never .build/chrome-article.mjs inside background
  agents (it opens tabs in the user's browser) — use origin hosts/wayback.
- Undecided handling varies: Newspoll 'quarterly' 2PP blocks exclude
  undecided silently; Morgan prints `und` — lanes record `und` and stay
  verbatim, theBUILDER does the re-basing.
- WordPress permalink-guess 301s make dead pollbludger.net URLs look 200 —
  check %{url_effective}.
- Reach into polls.json-era conventions for names: the stores record the
  house-printed as of print time, not site-normalised names (e.g. Minchin
  'Essential Research' in Bludger feeds → 'Essential' via lane HOUSE map).
