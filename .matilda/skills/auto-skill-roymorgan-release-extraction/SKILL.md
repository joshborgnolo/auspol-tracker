---
name: roymorgan-release-extraction
description: Extract new Roy Morgan federal-voting-intention releases from the live roymorgan.com/findings Next.js feed into data/polls.json — __NEXT_DATA__ data flow (no HTML scraping), candidate filtering by topic+slug, prose-lead normalisation parser, guard suite, sorted-insert row contract (.build/extract-roymorgan.mjs, scheduled by local.auspol.roymorgan).
source: auto-skill
extracted_at: '2026-08-29T02:57:00.610Z'
---

# Roy Morgan live-release extraction (findings feed → polls.json)

Built 2026-08-29: `node .build/extract-roymorgan.mjs [--check]`, scheduled by the
`local.auspol.roymorgan` LaunchAgent (see launchd-scheduled-data-pipeline skill). Distinct from
the one-shot **archive** extractor (roymorgan-archive-extraction): this one is a recurring
live-source job whose output is `data/polls.json`, never the frozen `data/roymorgan-*.csv`
archive (archive ends 2025-05-31 and is not consumed by the site build).

## RM.com is Next.js — pull JSON, never scrape HTML

- Feed `https://www.roymorgan.com/findings`: post cards ride in
  `__NEXT_DATA__` → `props.pageProps.pageData.postData.posts` (slug, `topics[].name`,
  `release_date` "DD/MM/YYYY", `finding_number`, `listing_image`). No pagination walk needed —
  apply the candidate filter straight on this array.
- Each release page `https://www.roymorgan.com/findings/<slug>`: figures live in
  `props.pageProps.findingData.postBy` → `.content` (prose HTML), `.date` (UTC publish datetime),
  `.findings.releaseDate`, `.findingTopics.nodes[].name`.
- Both extracted with one regex over the `__NEXT_DATA__` script tag + `JSON.parse`.

## Candidate filter (verified against the live feed)

`(topics or []).some(t => t.name === "Federal Poll") && /federal-voting-intention/.test(slug)` —
"Press Release"-only roundups never qualify, and specials like
`federal-voting-post-budget-special-sms-morgan-poll` are excluded by the slug half. Deleted posts
still appear as slugs and 404 individually (seen: `10171-federal-voting-intention-march-24-2026`)
— fetch failures per-candidate must not kill the run's other candidates.

## Prose parsing (the part that took iteration — v1 scored 2/20)

RM mixes the week-on-week **change** into the lead sentence: `"ALP primary support is down 1.5%
to 27%"`, `"unchanged at 27.5%"`, `"One Nation 27% (up 2%)"`, `"down 2% AT 12%"`, `"increased
support 1% to 25.5%"`. Anchoring per-party regexes to sentence position fails across eras.
Working approach (v2, 17/19 vs live hand-verified rows):

1. `clean()` the content (strip script/style/tags, decode numeric+named entities, collapse
   whitespace) then **slice the lead to the first "electors."** — scoping to the lead matters
   because the 2PP sentence also contains "One Nation 47%" and will hijack primary extraction.
2. `normaliseLead()`: remove `(...up/down/unchanged...)` parentheticals, change phrases
   (`up|down|rose|fell|… [n]% [points] to/at`), and `unchanged` — leaving `<party> … to/at/on <v>%`.
3. Generic per-party read `\bNAME\b … (to|at|on|is|was|were|are) V%` within the lead; Ind name
   pattern handles both "Independents/ Other Parties" and "Other Parties/ Independents".
4. **2PP**: the first `ALP x%` … `L-NP y%` pair within ~300 chars after the `vote… their
   preferences` anchor — the text ALSO carries an ALP-vs-One-Nation pair and a 2025-election
   preference-flow pair, neither of which is the tracker series. Anchor must come first.
5. Field period `conducted from Month D – Month D, YYYY` (abbrev months, cross-year spans);
   sample `cross-section of N electors`; the `can't say` undecided line is **optional** —
   pre-June-2026 eras omit it, and polls.json rows omit it too (conditional key, not null).
6. `published` = CMS `post.date` (UTC) → Australia/Melbourne `YYYY-MM-DDTHH:MM` via
   `Intl.DateTimeFormat` `formatToParts`.

Era drift is real (mid-2026 releases changed phrasing several times): when extending, walk the
older releases via the site's `relatedFindings` chains and test against live pages — frozen
fixtures miss newer prose shapes. Pre-April-2026 narrative-era leads correctly trip the guard
(missing figures) — hand-entered history stays manual.

## Guard suite (any trip → RM_GUARD on stderr, exit 2, nothing written)

Every figure present; each value 0.5–60; primaries Σ=100±1.0; lib+nat ≈ lnp ±0.75;
2pp Σ=100±1.0; period end is a Sunday; field span 1–15 days; release-date lag 0–10 days;
undecided ≤25; sample 500–10000. The guard is the tripwire for the next prose-format change —
a parser that silently returns partial rows is the failure mode to design against.

## polls.json write contract

- **Adjacent-rows only**: dedupe is "row with this `date` and `pollster:"Roy Morgan"` exists";
  new rows are sorted-inserted into `polls` (validate.mjs demands a globally date-sorted array).
  RM lists polls on the feed in release order — appending naively would misplace rows.
- Row shape must byte-match the hand-entered convention (verified against live releases
  2026-03-30→2026-08-24; the 2026-08-23 extracted row was byte-equal to the hand entry):
  `{date, published, dateStart, pollster, client:"—", sample, undecided?, alp, lnp, grn, onp,
  ind, oth:null, tpp_alp, tpp_lnp, lnpSplit:{Lib,Nat}, url}`.
- Serialisation is byte-identical to `JSON.stringify(D, null, 2) + "\n"` — confirmed round-trip;
  keep it that way or every run diffs the whole file.
- Full automation contract (exit 0/1/2, `RM_STATUS {json}` last stdout line, atomic
  `OUT+".tmp"`+rename, no-change writes nothing, fetch 3× retries w/ `AbortSignal.timeout(30s)`)
  mirrors extract-resolve-rpm.mjs — see resolve-monitor-extraction skill.
- Provenance: save each parsed release's post JSON to `.build/roymorgan-src/release-<slug>.json`
  and commit it alongside `data/polls.json` (the wrapper's add-list covers both).

## Verification recipe that caught the bugs

Prototype against the live feed in a scratch script (BOGAN mode blocks writes outside the repo —
use the gitignored `.build/logs/` dir, not /tmp), parse the last N federal-voting-intention
releases, emit the would-be row for each, and diff against the hand-entered polls.json rows for
the same dates. Divergence classes seen: parser era misses (fix parser), ONE genuine hand-entry
error (dateStart off by one vs release text — the release wins), deleted posts (404). Don't
"fix" hand rows that match the release; don't chase eras the guard rightly rejects.

## Reverse-engineering RM's private flow table from the dual 2PP (analysis, done 2026-08-29)

Each release para-2 carries TWO two-party figures: respondent-allocated (the tracker row) AND a
"based on how Australians voted at the 2025 Federal Election" figure. The flows figure obeys
exactly `F − alp = g·grn + on·onp + o·(ind+oth)` per wave with RM's private constants, so ≥4
waves' numbers identify it by least squares (constants are a fixed table; only rounding noise, ±0.5
on every published value, plus RM computing on unrounded internals ≈ ±0.2–0.3 per wave).

Findings from the 13-wave May–Aug 2026 series: RM's table ≈ AEC 2025 TCP flows nudged ~1pt
Labor-ward on One Nation (effective ON→ALP ≈ 28±2 vs measured 27.1) and a touch more on Others;
net effect ≈ +0.3–0.5pt ALP vs `flows.mjs` constants on current primaries. Pitfalls: (1) with few
waves the Greens and Others columns co-move and (g,o) are unidentifiable — the informative rows
are waves with unusual G/O splits; (2) a two-wave exact solve can produce absurd constants
(259%) from rounding alone — don't report point estimates from <4 waves; (3) RM's stated-pref
respondent figure runs ~1pt ALP-ward of their flows figure, the same stated-vs-actual gap
documented elsewhere.

Go-fetches when reconstructing a wave by hand (all Exa-searchable): RM release URLs pattern
`roymorgan.com/findings/<finding_no>-federal-voting-intention-<date>` (+~7 finding numbers/week)
and weekly `roy-morgan-update-<month>-<day>-<year>` pages; para-1 primaries chain via
"up/down x% to y%" deltas into missing waves (sum-to-100 check). Para-2 numbers: Poll Bludger
Morgan threads put the respondent 2PP in the POST TITLE (`pollbludger.net/2026/…/morgan-…-open-thread`);
Adrian Beaumont's weekly Conversation/National Tribune wrap carries both 2PPs in its Morgan
paragraph and is syndicated full-text to news.net / miragenews.com / thebulletin.net.au /
eveningreport.nz / switzer.com.au — the mirrors are easier to quote than theconversation.com.
The flows figure itself sits too deep for search snippets — fetch the release directly
(external-article-text-extraction skill) rather than hunting 20+ snippets.
