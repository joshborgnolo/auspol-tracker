---
name: auspol-seo-head-meta
description: auspol-tracker — "Google's search preview shows the wrong text" triage and the full head-meta map. template.html only carries title + og:title/og:type; description, OG/Twitter, canonical, JSON-LD are INJECTED by build.mjs §5b (OG_ANCHOR block ~:660-725) and robots.txt/sitemap.xml by §5c (~:797-876), so grepping the template alone lies. Diagnose against the BUILT index.html + live curl + git dates before writing any tag (worked 2026-09-23, JSON-LD shipped 78ff8db).
source: auto-skill
extracted_at: '2026-09-23T03:37:25.503Z'
---

# SEO / head-meta map for auspoltracker.com

## Where every head tag is generated (don't grep template.html and conclude "missing")

- **template.html** `<head>` (~:2-25) has only: charset/viewport, `<title>auspol tracker – Australian federal opinion polling`, `og:title`, `og:type`, `color-scheme`. The comment above the title even describes Reader-mode tagging interplay — read it before renaming anything.
- **build.mjs §5b** finds the anchor `<meta property="og:type" content="website">` (const `OG_ANCHOR`, ~:672) and replaces it with the whole SEO block: `metaDesc` as `<meta name="description">` + `og:description`, `og:site_name` ("auspoltracker.com", deliberately NOT "auspol tracker" — Safari Reader de-dup, comment at ~:668), `og:locale`, `og:url`, `og:image` (+dims, +alt from latest figures), `twitter:card`, `google-site-verification` (site IS Search-Console verified), theme-color pair, `<link rel="canonical">`, RSS `<link rel="alternate">`, favicon links, `${fontLinks}`, and (since 78ff8db) `${websiteJsonLd}`.
- **build.mjs §5c** (~:797-876) writes robots.txt (`Allow: /` + Sitemap pointer) and sitemap.xml (root + /archives/*, /atlas/, /feedback/, /preference-flows/, /prediction/; `ARCHIVE_STAMP`, `PREDICTION_STAMP`). `auspol-polling.html` is deliberately in neither (it carries noindex).
- The ogi share-card URL is cache-busted by stamp (`cardUrl` ~:653) — see `auspol-share-card`.

## The meta description is self-dating ON PURPOSE

`metaDesc` (~:664) = static lead sentence (`Aggregrated opinion polling … set against the last ${pastCycleWord()}`) + live race sentence from `raceLine(cl)`/`basisClause(cl)` (~:348-362) + "updated <date> from N polls across M houses". Rationale (comment at ~:660): figures and their date share a sentence so a stale cached snippet stays self-dating. Don't "tighten" it to static copy, and don't fix the 160-char truncation worry by reshaping — front-loaded lead already handles it. `cardAlt` reuses the same `cl = grabLatest()` numbers.

## Triage drill for "the Google preview/title/description is wrong"

1. Grep BUILT `index.html` for `meta name="description"` — if present with fresh figures/numbers (51.6–48.4, "21 September 2026"), the site itself is fine.
2. `curl -s https://auspoltracker.com/ | grep -o '<meta name="description" content="[^"]*"'` — confirm the LIVE page serves it (kills the "stale deploy" hypothesis).
3. `git show -s --format='%ci' b5680d0` style — date the tag's introduction. If it's been live for weeks, Google's cache/preference, not the site, is the problem.
4. Diagnose WHAT Google is showing: the format "sitename / URL / body-sentences … Read more" is Google's auto-derived description (About-this-result source panel), lifted from BODY copy — it ignores the meta description when there's no Wikipedia entry for the site. Our body-text source was the colophon strapline + the disclaimer ("Best efforts are made…"). Don't try to fix that by rewording the colophon (strapline has 11 homes — see `auspol-strapline-copy`); the lever is structured data.
5. Fix that ships control, not hope: schema.org JSON-LD `WebSite` + publisher `Organization` in the head (shipped 78ff8db, 2026-09-23, as `websiteJsonLd` in the §5b block). It declares name/alternateName/url/description/inLanguage/publisher.logo (`favicon-192.png`, and the logo key is conditional on `favPng` — don't make it unconditional, the .icon link right above it already isn't). It REUSES `metaDesc` so declared and crawler-facing descriptions can't drift. JSON is `.replace(/</g, "\\u003c")`-escaped so a "</" substring can't end the script early.
6. The step CODE can't do: recrawl. Site is Search-Console-verified (meta in §5b block), so the final instruction is URL Inspection → Request Indexing on `https://auspoltracker.com/`.

## Verify + ship

- After build, verify JSON-LD parses: `node -e` reading index.html, regex `/<script type="application\/ld\+json">([\s\S]*?)<\/script>/`, `JSON.parse`. (BSD grep's `\{0,700\}` repetition caps at 255 — use `[^<]*` patterns or node for the check.)
- Commit = `.build/newtracker/build.mjs` + `index.html` (+ `sitemap.xml` only if the sitemap content actually changed — it didn't here; dataStamp moves it on data builds anyway).

## Shared-checkout wrinkle that WILL recur (2026-09-23)

A sibling session committed `cd5485e` (srcTerms memo fix) source-only WHILE my rebuild sat uncommitted, because its commit message says it could see my uncommitted build.mjs change and deliberately left index.html to the next build. My rebuilt index.html therefore carried TWO changes (theirs compiled + my JSON-LD). Before committing, verify what you're about to sweep: `git show <sibling-sha> --stat` → if it says "source only … left for the next build", your rebuild legitimately fills that gap and committing index.html with build.mjs is correct, not a sweep. See `auspol-shared-repo-session-race` for the general drill; this is the particular case where the extra hunk BELONGS in your commit.

Also: `git commit -m "$(cat <<'HEREDOC' … HEREDOC)"` broke on this repo's shell (unexpected EOF — the message contained an apostrophe inside the heredoc). Working pattern: write the message to `/tmp/x.txt`, `git commit -F /tmp/x.txt`.
