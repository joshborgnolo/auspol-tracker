---
name: news24-extraction
description: Extract YouGov News24 "Public Data" fortnightly federal polls from YouGov's own yougov.com releases into data/polls.json — global RSS discovery (regional feeds 404), methodology-sentence series gate, Datawrapper public TSV datasets (tab-structure-preserving cell parse, <span> arrows, \\u003C escapes), oth=sum-of-tail-row convention, ppm chart→prose fallback, yearless fieldwork-window year inference from published_at, plus manual NEWSIE_CHROME news24.com.au enrichment layered over Wikipedia-wave discovery (.build/extract-news24.mjs).
source: auto-skill
extracted_at: '2026-08-29T07:23:34.665Z'
---

# YouGov News24 Pulse extraction (yougov.com → polls.json)

Built 2026-08-29: `node .build/extract-news24.mjs [--check] [--url <yougov-url>]
[--news24 <news24-url>]`. Scheduled as `local.auspol.news24` (see
launchd-scheduled-data-pipeline skill).

## Canonical source decision (user-approved)

Canonical = **YouGov's own editorial releases on yougov.com**. Discovery is the
**global** RSS feed `https://yougov.com/en/rss` — the regional AU feeds 404;
the global feed's ~200 items include every AU federal poll article. Parse
`<item>` blocks out of RSS with regex; link is `https://yougov.com/articles/<id>/…`
and the numeric article id keys the `published_at` lookup.

Release cadence caveat (verified 2026-08-29): YouGov publishes AU federal releases only
occasionally (~notable waves), NOT every fortnight — e.g. no releases at all Oct 2025→mid-Mar
2026 and none for the 2026-07-28/-08-10/-08-24 waves. Weeks of `changed:false` from the
launchd job are therefore the expected cadence, not an outage. For locating releases of OLD
waves use Wayback-archived RSS snapshots — see the yougov-poll-provenance skill.

## Fallback chain: Wikipedia discovery + manual News24 Chrome enrichment

Canonical yougov.com runs first and always wins. Wikipedia's
*Opinion polling for the next Australian federal election* wikitext
(`action=raw`, ~480 KB) then discovers YouGov waves with no official release
and supplies the base VI row, citation URL and independents/others split.

With `NEWSIE_CHROME=1`, each candidate news24.com.au citation is then read
through the user's logged-in Chrome via `.build/chrome-article.mjs` (same
pattern as The Australian in Newspoll). News24 supplies the displayed
`published` time/sample where stated, top-party primaries, Coalition 2PP,
leader satisfaction, preferred PM, Albanese–Hanson preferred PM and
Albanese–One Nation TPP. Wikipedia keeps only the fields News24 prose omits
— notably `ind`/`oth`, and sample on articles such as 2026-07-28 that omit
it. Any Chrome/parse mismatch logs `N24_NOTE`-style status and falls back to
Wikipedia-only; macOS Automation consent makes Chrome manual-only, so
`.build/news24-updater.sh` intentionally leaves `NEWSIE_CHROME` unset in
launchd. If launchd gets there first, it writes the News24-linked latest wave
without `published`; a later manual `NEWSIE_CHROME=1` run upgrades that same
latest wave in place and fills the derived `ppm`/`approval`/`altTpp` /
`ppmHeadToHead` rows (`status.news24.upgraded`).

News24 page facts verified against saved captures:

- Displayed publication time comes from byline `<div id="publish-date">…
  July 29, 2026 - 5:00AM …</div>`. The JSON-LD/meta `datePublished` is 8h
  earlier (`…T11:00…Z` → AEST is still the prior evening) and is only a
  fallback.
- Series gate is `News24[.com.au] Pulse / YouGov poll`; fieldwork variants
  include "conducted online between August 18 and 24" and "conducted between
  July 21 and July 28".
- August 2026 article carries sample (`poll of 1510 voters`); July 2026 does
  not, so Wiki's sample is retained.
- News24 prose has no independent/others text. Wiki supplies both; do not
  synthesise a residual because undecided/unknown fields would corrupt the
  tracker's existing ex-undecided convention.
- Parser ignores Albanese–Hanson as ordinary PPM and Albanese–One Nation as
  Coalition 2PP, then writes them to `ppmHeadToHead` and `altTpp`,
  respectively, matching existing canon.

**Wikitext parser shape (all verified against the live article):**

- The VI table is `{|`-chunks containing both "Primary vote" and "2PP vote"; rows split at
  `^\|-`; each poll row's chunk ends with the TPP-vs-Coalition triple, and the continuation
  chunk carries TPP-vs-PHON (rowspan=2 layout). A Wave is `[[YouGov]]`-marked (MRP waves
  excluded via their efn); `[[Essential]]` etc. are skipped the same way.
- Strip `<ref…>` tags and `{{…}}` templates (`{{efn}}`, `{{N/A}}`) FIRST — they embed pipes
  and corrupt cell splitting; only then split cells per line via `lastIndexOf("|")`,
  flagging `!` header cells.
- Percent cells: `WIKI_PCT = /^'{0,3}(\d{1,2}(?:\.\d{1,2})?)%'{0,3}$/` — plain cells
  (`| 21%`) carry NO apostrophes, bold ones carry `'''…'''`. (Real bug: requiring `'''`
  parsed 0/19 waves.) Coalition carries one `colspan=3` cell; Lib/Nat split rows are the
  alternate "form B" shape (triple summed into `lnp`).
- Section headers are `===2026===` with NO spaces — match with `^={2,4}\s*([^=]+?)\s*={2,4}\s*$`
  (`\s+` matched nothing — second real bug). Year falls back to the current section header
  when the date cell is yearless; date cells are ranges `7 – 14 July 2026` or single dates.
- Sample cell: `/^\d[\d,]{2,}$/` (plain 4-digit, not bolded). Client heuristic: test the
  italic client cell AND the citation URL together — `/australia[ -]?institute/i` →
  `"Australia Inst."`, else `"News24"` (the 2026-03-19 and 2025-10-30 AI rows parse
  correctly on this; third bug — the italic cell alone misses them). URLs on wikipedia.org
  are nulled; else `|url=` first, markdown `[link ` second.

**Fallback row + guard shape:** Wikipedia-only rows omit `published`, while
News24-enriched rows include its displayed byline timestamp and any parseable
`ppm` / `approval` / `altTpp` / `ppmHeadToHead` figures. Guard call is
`{requirePublished: !!news24, requireTpp:false, spanMin:0}` (the 107-sum AI
rows legitimately carry no TPP-vs-Coalition cell → tpp null). Hard cap
`MAX_WIKI_ADDS = 4` per run — exceeding it trips the guard (exit 2) as a
sanity check against a Wikipedia restructure. Wiki or Chrome failures are
non-fatal: `N24_NOTE` + `status.fallback.error` / `status.news24` and RSS
results still process. Provenance files are `.build/news24-src/release-*.json`
(yougov.com), `news24-<dateIso>.json` (mixed News24+Wikipedia) or
`wiki-<dateIso>.json` (Wikipedia-only).

**Test hooks:** `N24_OUT` redirects polls.json; `N24_SRC_DIR` redirects
provenance; `N24_WIKI_FILE=<path>` parses saved wikitext instead of fetching;
`N24_WIKI_DEBUG=1` prints parsed waves; `N24_NEWS24_FILE=<saved-html>` parses a
saved News24 article instead of opening Chrome. `--news24 <url>` is the
single-article oracle and prints the parsed record without writing canon.

**Known honest divergence:** wiki shows 2026-06-16 ind=7/oth=5 vs canon 6/6 — the parser is
truthful to the source; canon stands (only matters if that date ever falls back, which it
can't while in canon).

**E2E verification recipe:**
1. Save the latest News24 article through Chrome once, e.g. `.matilda/chrome-n24.html`;
2. copy polls.json to `/tmp` minus just that YouGov wave and matching
   `ppm`/`approval`/`altTpp`/`ppmHeadToHead` records; then run
   `N24_OUT=/tmp/polls.json N24_SRC_DIR=/tmp/n24-src N24_NEWS24_FILE=.matilda/chrome-n24.html node .build/extract-news24.mjs`;
3. expect exactly one `via:"news24+wikipedia"` wave with News24 figures and
   Wiki's `ind`/`oth`, provenance under `/tmp/n24-src`, exit 0; rerun to get
   `changed:false`.

## Series gate: methodology sentence, not title keywords

Title pre-screen (`TITLE_HIT`/`TITLE_MISS`) is only a cheap filter; state polls, UK polls and
by-elections can hit title keywords. THE identifier of the federal Public Data series is the
methodology sentence:

> "The YouGov Public Data poll surveyed N Australian voters online between …"

"s.…Australian voters online between" excludes UK releases ("British voters") and every state
poll without needing title keywords. Phrasing variants observed: "eligible/enrolled Australian
voters", "between 7 and 14 July 2026" (single trailing month), "between 29 December 2025 and
4 January 2026", and "between 23 and 30 June" — **no year at all** in the window (the March
2026 release); infer the year from the article's `published_at`, resolving Dec/Jan straddles by
nearest occurrence to the publication date (release lag is 0–10 d, so nearest-year is safe).

`pubIso` pre-screen also drops candidates older than the latest canon YouGov wave before any
article fetch — off-cycle runs are single-RSS-fetch no-ops.

## Figures come from Datawrapper public TSV, never the rendered page

Articles embed charts as `datawrapper.dwcdn.net/<chartId>/<rev>/`; each has a public
machine-readable dataset at `https://datawrapper.dwcdn.net/<chartId>/<rev>/dataset.csv`
(rev pinned exactly as embedded). Parse order of robustness:

1. **VI chart** — rows are `[scope, label, value]`: `Headline voting intention` scope carries
   primaries; `Two-party preferred vote vs Coalition` (kept) and `… vs PHON` (ignored) rows.
2. **Satisfaction chart** — header cells `<Surname> Satisfaction` / `<Surname> Dissatisfaction`
   (sometimes given+family name, e.g. "Anthony Albanese" — match surname ANYWHERE in cell);
   first data row is the latest wave; leader-era surname from olFor(date).
3. **ppm** — a "Column/Total" chart when the article has one; otherwise the prose pair
   "preferred Prime Minister … leading 44% to 35%" (the July 2026 article needed the prose
   path; values agree where both exist).

Parse gotchas that each produced a real bug:

- **Never whitespace-collapse between fetch and tab split.** `clean()`'s `\s+ → " "` destroys
  the TSV structure; and `.trim()` per LINE would drop the satisfaction chart's leading empty
  cell (leader-dissatisfaction columns start with a tab), shifting every column index. Keep
  `filter(line.trim())` only for blank-line removal; split raw on `\t`.
- Cell values can carry literal `<span>` trend arrows in the raw CSV, and the page's JSON
  escapes angle brackets as `\u003C`/`\u003E` — so unescape `\u003C→<` etc. FIRST, then strip
  `<…>` tags, then split.
- Extract per-chart id/rev pairs with `matchAll` and dedupe before fetching.

## Tracker conventions for this series (verified against hand-curated canon)

- `ind` = the "Independents" headline row; `oth` = **sum of all other headline rows**
  (Community Strong Australia, Other, …) — verified against the 2026-07-14 canon row
  (Ind 6 → ind 6; CSA 2 + Other 6 → oth 8). Round `oth` to 1 dp.
- Row shapes mirror existing YouGov canon rows: polls `{date,published,dateStart,
  pollster:"YouGov",client:"News24",sample,alp,lnp,grn,onp,ind,oth,tpp_alp,tpp_lnp,url}`;
  ppm rows key `firm:"YouGov"` (ppm/approval key on `firm`, polls on `pollster` — same
  split as Newspoll); approval rows carry `detail{alb,opp:{app,dis}}` plus computed nets.
- `published`: the article JSON block inside the page's transfer state —
  find `"id":<articleId>` then `"published_at":"isoZ"` in the following ~6 KB; convert
  UTC→**AEST fixed (UTC+10)** because canon `published` strings are local-without-offset
  (series publishes ~05:00 AEST Wednesday, fortnightly).
- Known accepted divergence: YouGov's own sample figures can differ from media-reported
  figures (e.g. 2026-07-14: skynews 1500 vs YouGov 1468). User policy: YouGov's own numbers
  win — canon was aligned 2026-08-29 (2026-07-14 row corrected 1500→1468); going forward,
  never "correct" YouGov-sourced values back to media-reported ones.

## The automation contract (same as siblings; see resolve-monitor-extraction)

Exit 0 ok / 1 fetch-parse / 2 guard trip; last stdout line `N24_STATUS {json}` with
`changed, check, added[], skipped_existing[], candidates[]`; guard trips additionally print
`N24_GUARD` to stderr and write nothing. Idempotent: unchanged upstream → writes nothing.
Atomic `OUT+".tmp"`+rename. `--check` computes + prints but never writes. `--url <article>`
parses ONE official YouGov article; `--news24 <url>` parses ONE News24 article through
Chrome when `NEWSIE_CHROME=1` (or from `N24_NEWS24_FILE`) and prints the record without
touching polls.json. Per-wave provenance is written under `.build/news24-src/` — **only
on changed:true** — as `release-<date>.json`, `news24-<date>.json`, or
`wiki-<date>.json`; the wrapper's `git add .build/news24-src/` is safe because it only
runs when changed:true.

## Guards (any trip → N24_GUARD, exit 2, nothing written)

Missing date/dateStart/sample/published; missing any VI component (needs ind OR oth);
primaries each 1–70 and Σ ~100±1.5 (when ≥5 parts); 2PP and Albanese–One Nation TPP Σ
~100; ppm and Albanese–Hanson PM in plausible leader ranges; ppm tie rejection; leader
nets −80..80; date not future; field span 1–14 d; release lag 0–10 d; Albanese-era only;
sample 1000–2500.

## Verification recipe

- Oracle via `--url`: test article 55192 (2026-07-14 wave, prose-ppm case) expects
  `sample 1468, alp/lnp/grn/onp/ind/oth = 28/20/12/26/6/8, TPP 53/47, pmNet −18, oppNet −16,
  ppm 44/35`. The March 2026 chart-ppm article (2026-06-30 wave, yearless fieldwork window)
  expects `29/17/13/30/6/5, TPP 54/46, sample 1502, ppm 44/35, nets −21/−11` (matches
  canon exactly; canon detail alb 36/57, opp 36/47).
- News24 oracle via `--news24` with `N24_NEWS24_FILE=.matilda/chrome-n24.html`: 2026-08-24
  expects `published 2026-08-26T05:00`, sample 1510, top parties 29/21/12/26, TPP 53/47,
  satisfaction -24/-16 (35/59, 33/49), ppm 44/37, Albanese–Hanson 52/37, alternate TPP
  56/44. The 2026-07-28 capture expects the same time format, top parties 28/22/13/25,
  TPP 53/47, satisfaction -18/-16, ppm 43/37, Hanson 52/37, alternate TPP 56/44; it legitimately
  omits sample and PM satisfied/dissatisfied details in News24 prose, so Wikipedia supplies
  those gaps at merge time.
- Finish with a live full run in the repo (expect `changed:false`, exit 0, no writes — the
  RSS pubDate pre-screen yields zero candidates between waves) plus `node
  .build/newtracker/validate.mjs`.
