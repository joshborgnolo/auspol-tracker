---
name: find-remembered-article
description: When the user asks to find a half-remembered article on crikey.com.au ("a while back I read…", engines miss it) — enumerate the publisher corpus via its Yoast sitemap chain (sitemap.xml → post-sitemap*.xml, ~106k URLs), grep slugs for topic words, fetch og:title/og:description/author meta in parallel, and reserve the user's logged-in Chrome (.build/chrome-article.mjs) for full body text of paywalled finalists. Worked 2026-11-08 locating a remembered Crikey reader-reply letter (single citation: interactive session, ~25 tool rounds).
source: auto-skill
extracted_at: '2026-11-08'
---

# Finding a half-remembered publisher article when search engines miss it

Situation: user remembers theme + maybe a catchphrase + a vague byline ("short
piece, unusual contributor"), web searches don't surface it. This hunt ran
2026-11-08 against crikey.com.au and found the target (a reader-reply letter).
All commands below are the verified ones; everything Crikey-shaped is verified
ONLY on crikey.com.au — other WordPress sites likely share the Yoast structure
but were NOT exercised. Engines were given a fair run first (~12 Exa web_search
queries + direct DuckDuckGo-html + Bing curls — all returned nothing usable —
so don't skip engine passes, just timebox them).

## The ladder that won

1. **Corpus via sitemap chain.** `https://www.crikey.com.au/sitemap.xml` is a
   Yoast sitemapindex → `post-sitemap.xml` … `post-sitemap107.xml` (107 chunks).

   ```
   curl -sL -A "Mozilla/5.0" "https://www.crikey.com.au/sitemap.xml" \
     | grep -oE 'https://www\.crikey\.com\.au/post-sitemap[^<]+' | sort -u > /tmp/crikey-sitemaps.txt
   cat /tmp/crikey-sitemaps.txt | xargs -P 8 -I{} sh -c \
     'curl -sL --max-time 30 -A "Mozilla/5.0" "{}" | grep -oE "<loc>https://www\.crikey\.com\.au/[^<]+</loc>" | sed "s/<[^>]*>//g"' \
     > /tmp/crikey-urls-all.txt
   ```

   → 106,337 article URLs, ~1 min parallel (a sequential loop with sleep
   projected ~30 min; don't). Alphabetical chunk order ≠ chronological era —
   `post-sitemap.xml` is the freshest chunk; URLs carry `/YYYY/MM/DD/<slug>/`,
   so filter by year and topic straight from the URL string.

2. **Slug grep → candidate pool**, then per-candidate META fanout with
   `xargs -P 8..12` against a small SCRIPT FILE (an inline `sh -c` with nested
   quotes died as `bash: -c: line 0: syntax error near unexpected token '|'`
   — see shell-command-pitfalls). Keep one line per candidate:

   `URL ||| published ||| author ||| og:title ||| og:description`

   via `grep -oE '<meta (name|property)="(author|og:title|og:description|
   article:published_time)"[^>]*content="[^"]*"'` + sed. og:description usually
   *is* the standfirst/thesis — thesis-phrase greps ("behind", "decade", "ten
   years", "immune", "complacen", "will come") over this table replaced
   full-text fetches for 99% of the pool (3,694 candidates in the hunt).

3. **Paywall gate before any body grep.** Plain-curl Crikey article pages are
   truncated by Zephr to ~2 paragraphs (measured 730 body chars on a 2017
   analysis piece) — a body grep on curl output silently covers the ledes only.
   For full text of finalists:

   `node .build/chrome-article.mjs "<url>" > /tmp/<key>.html` (exit 0, ~850 KB
   subscriber HTML — works on crikey.com.au, incl. old news and reader-reply
   letters; ~15 s/article, one tab at a time; user consent per
   chrome-session-piggyback). A 14-article background batch ≈ 4 min. When
   grepping the fetched file, flatten the WHOLE page, not an extracted
   container (letter/short-form pieces have thin, differently-sized
   `.entry-content` regions).

4. **Discovery lane when the keyword net misses:** harvest article links off
   fetched candidate pages (recommendation sidebars, "Related Article" blocks):

   `cat /tmp/cr-*.html | grep -oE 'href="https://www\.crikey\.com\.au/2[0-9]{3}/[0-9]{2}/[0-9]{2}/[^"]+"' | sort -u` → `comm -23` vs the pool.

   Netted 34 new links incl. 3 the slug greps had missed outright — one of
   those (a slug containing "authoritarianism", dropped by MY OWN exclusion
   pattern, see 5) was the freshest lead of the whole hunt.

5. **Grep-exclusion trap.** `grep -v author` (meant to drop author-profile
   pages) also drops slug words like "authoritarianism". Before trusting any
   candidate absence, sanity-check exclusion words against the content
   vocabulary, and re-run the include-grep minus each exclusion on a
   known-good subset.

6. **Wayback only if engines+corpus fail:** full-domain CDX
   (`matchType=domain`, slug-regex filter) on crikey.com.au 504s; per-year
   `url=crikey.com.au/YYYY` `matchType=prefix` queries are the workable shape
   but slow (~13 × 30 s) — abandoned once sitemaps delivered.

## Judgement notes

- **The remembered catchphrase is evidence, not a filter.** The user recalled
  "Australia is 10 years behind the US" — that exact class of phrase exists in
  ZERO Crikey titles/descriptions/LEDES and in none of the 16 finalist bodies
  pulled through Chrome. The actual target (Gabe Garbowit's 2025-09-22
  reader-reply, "I was a US Senate staffer during Trump's rise. Here's where
  the LNP goes next") made the remembered THESIS ("America today is Australia's
  near future, don't be complacent") without containing the phrase. Rule: rank
  candidates by argument-alignment, present author+date+title+link shortlists,
  and let the user confirm — they recognised theirs instantly once the unusual
  byline was in view.
- Ask ONE targeted clarifier (rough era? byline profile? outlet certainty?) at
  the point the corpus work plateaus, not up front — the user offered better
  hints each time new candidates were in front of them.
