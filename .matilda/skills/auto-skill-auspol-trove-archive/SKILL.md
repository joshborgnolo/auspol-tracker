---
name: auspol-trove-archive
description: auspol-tracker — the Trove newspaper poll-mention archive end-to-end (harvester .build/harvest-trove.mjs → scratch JSONLs in .matilda/trove-harvest/ → generator .build/refresh-trove-archive.mjs → data/trove-mentions-monthly.csv + data/trove-poll-articles.csv + archives/trove/ satellite page + gen-data cycleSource.trove + solo-term note in the Past-cycles primary panel). Covers the SPA /api/search/137 endpoint with its public client apikey header, the 5000-record startPos wall and window-splitting, pollster/figures regex triage, the copyright cliff (newspapers end 1995, gazette tail after), and the ≤8MB rule for committing data/trove-text.jsonl OCR text.
source: auto-skill
extracted_at: '2026-09-03T00:00:00.000Z'
---

# auspol-tracker: Trove newspaper poll archive

The repo keeps a full-copy harvest of every Trove newspaper article whose
metadata matches the token query `( poll )` — ~3.05M hits across 1803–2025 —
and derives a satellite archive page (`/archives/trove/`), two committed CSVs,
and a Past-cycles newspaper-coverage note from it.

## Pipeline (order matters)

1. `.build/harvest-trove.mjs [startYear] [endYear] [budgetSec]` — the crawler.
   Resumable: writes `.matilda/trove-harvest/poll-YYYY-MM.jsonl` (scratch, NOT
   committed) + checkpoints `harvest-state.json` (`months[ym]={ok,n}`). A null
   crawl result (any failure) deletes the month's tmp file and marks
   `{ok:false}`; re-runs redo only not-ok months. Budget-arg lets you run it in
   bounded batches; loop it until it prints `remaining months in range: 0`.
   A failed month pinned to exactly n=5000 means it hit the startPos wall
   before window-splitting landed — that is a CRAWL BUG to fix in crawlRange,
   not a fact about the corpus (1901-03 truly holds 8,085 hits).
2. `.build/refresh-trove-archive.mjs` — the generator (galaxy/morgan model).
   Reads the JSONLs (no state file), emits `data/trove-mentions-monthly.csv`
   (year,month,articles,figures), `data/trove-poll-articles.csv`
   (id,date,masthead,title,page,words,pollster,url), optionally
   `data/trove-text.jsonl`, and `archives/trove/index.html`.
3. `.build/harvest-trove-text.mjs [budgetSec]` — OCR text fetcher for the poll
   reports only (reads the CSV's id column), into
   `.matilda/trove-harvest/text/<id>.txt`. Resumable. Re-run (2) after it so
   the jsonl bundle appears (committed only if ≤8MB — the data/ norm).
4. `node .build/newtracker/build.mjs` — gen-data injects `cycleSource[year].trove
   = {articles, pollArticles}` per term (window [eDate_i, eDate_{i+1})), the
   d1a1d215 renderer prints one `cycle-insight` line under the solo term's
   PRIMARY panel linking `/archives/trove/#y<year>`, and the sitemap gets the
   /archives/trove/ `<url>`.

## Access recipe (also in the page's "How this was collected")

- Search: `GET https://trove.nla.gov.au/api/search/137?terms=( poll )&limits=
  {"date.from":[from],"date.to":[to]}&pageSize=100&startPos=n` with header
  `apikey: <SPA public client key>`. Records in `works[]` (NOT
  resultGroups.records). In-page fetch from an SPA-bootstrapped tab carries
  session cookies; bare curl with the key also works.
- The key is NOT a secret — it ships in the site's JS to every visitor. The
  committed script defaults to the captured literal with a `TROVE_API_KEY`
  env override; if it ever rotates, re-capture via headless-Chrome
  `page.on('request')` on any trove search URL (probe5 pattern).
- 5000-record wall: startPos≥5000 hard-500s. Windows with total>4950 are
  halved down to single days. Windows are disjoint; a `seen` Set dedupes per
  window only.
- Full OCR text (free, no key ceremony beyond the session):
  `https://trove.nla.gov.au/newspaper/rendition/nla.news-article<ID>.txt`
  returns a small HTML doc; text lives in `<div class='zone'><p>` nodes.

## Corpus facts that shape display/copy

- Volume: ~30k/yr 1900–1950 (federation-era "poll" = the vote itself),
  ~1.8–2.4k/yr 1966–1995 (the Canberra Times seam — real opinion-poll
  reporting), 684 total in 1996 (copyright cliff), ~200/yr gazette tail to
  2020. Newspapers in Trove effectively END at 1995 — never present post-1995
  silence as pollsters stopping.
- Triage is regexes over `title + abstrct + snippets`: POLLSTERS (roy
  morgan/morgan gallup, gallup poll, nielsen, newspoll, saulwick|age poll,
  spectrum research, ANOP, AGB (mcnair|poll|survey), quadrant, harrison) marks
  "poll reports"; FIGURES (opinion poll / two-party-preferred / primary vote /
  voting intention / poll results / party support / polls gave-showed-put)
  marks "about polling". Poll reports are the SUBSET naming a house; both
  counts live in the monthly CSV (articles vs figures).
- Pre-1920s hits are overwhelmingly council polls/poll tax/polling-day news —
  ~0 poll reports there is the TRUE answer, not an extraction bug (verified
  on 1901 corpus).

## Don't-trip wires

- Tab strip: `archives/trove/` was added to FIVE places — the three static
  archive pages, `.build/refresh-morgan-archive.mjs` and
  `.build/refresh-galaxy-archive.mjs` nav templates. Editing tabs later means
  all five.
- The solo-term note is M-keyed to `"primary"` so it renders once; moving it
  re-repeats it under every measure panel.
- gen-data CSV reads are null-safe (missing files → no trove key) — the site
  builds fine on a fresh clone with no harvest.
- `.matilda/trove-harvest/` is scratch: never commit; the committed artefacts
  are the two CSVs (+ optional trove-text.jsonl) and `archives/trove/`.
- Verify the page chrome with `.matilda/verify-archive-static/probe.mjs`
  (trove row ships inside its PAGES list at maxw 1080px).
