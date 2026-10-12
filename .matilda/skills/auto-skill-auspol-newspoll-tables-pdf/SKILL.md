---
name: auspol-newspoll-tables-pdf
description: auspol-tracker — finding The Australian's demographic-tables PDF for a Newspoll (pooled) quarterly wave on origin.theaustralian.com.au (uploads/YYYY/MM of the wave's PUBLISHED month, filename varies wildly; WP REST media API disabled, Wayback CDX prefix-query recipe, only 2 of the first 5 pooled waves have one — the rest are Infogram-only). Ship the URL as polls[].tablesUrl; see auspol-poll-links-list for the "tables" link kind consumer
source: auto-skill
extracted_at: '2026-10-09T03:13:53.868Z'
---

# The Australian's Newspoll (pooled) demographic-tables PDFs — discovery recipe

Worked 2026-10-08/09 (commit 2ce32ed): user asked for a link to "the pdf
the australian publishes to the demographic data in each newspoll pooled
all polls table entry (eg
https://origin.theaustralian.com.au/wp-content/uploads/2025/12/Newspoll.pdf)".
The discovery took more effort than the wiring — this skill is the
source knowledge so the next pooled wave's PDF is a five-minute find.

## URL anatomy (verified on both waves that have one)

- Host: `https://origin.theaustralian.com.au/wp-content/uploads/<YYYY>/<MM>/<file>.pdf`
  — the OPEN origin CDN. It serves any probe directly (206
  application/pdf), no cookie wall: fetch/probe THIS host, never
  www.theaustralian.com.au (302 → subscribe wall) — an origin-host
  candidate URL can be verified with a plain `curl -I`.
- **Folder month = the wave's PUBLISHED month, not fieldwork** — validated
  twice: 2025-11-20 wave (published 2025-12-25) → `/2025/12/Newspoll.pdf`;
  2026-03-26 wave (published 2026-04-05) → `/2026/04/newspoll5april2026.pdf`.
  For later waves: probe the month of the row's `published` datetime.
- Filename is unpredictable: `Newspoll.pdf`, `newspoll5april2026.pdf`
  (lowercase, no separators, month spelled out). Nothing has been pinned
  to a single scheme, so blind-probing tries the date-keyed variants.

## Only SOME pooled waves have one — check before promising

Verified inventory of the first five "Newspoll (pooled)" rows (hours of
negative evidence behind this, do not redo it casually):

- 2025-11-20 → `/2025/12/Newspoll.pdf` ✓
- 2026-03-26 → `/2026/04/newspoll5april2026.pdf` ✓ (this one was
  body-linked from its own article, the only one that was)
- 2025-09-11, 2026-06-26, 2026-09-18 → Infogram-only demographics, NO
  PDF: the Chrome-fetched full article bodies contain zero PDF
  references, Poll Bludger's threads link the articles only, Wayback has
  no capture, and ~30 blind filename probes on the origin host all 404'd.

## Discovery ladder for a NEW wave (in cost order)

1. **Fetch the article body and grep it for `.pdf`** — the Q1 2026
   article body-linked its tables PDF. Paywalled body read via
   `.build/chrome-article.mjs <url>` (user's logged-in Chrome; see
   chrome-session-piggyback). If `CHROME_JS_ERROR: Can't get window id`
   fires, it's transient — retry.
2. **Wayback CDX prefix scan of the uploads month folders** —
   `https://web.archive.org/cdx/search/cdx?url=origin.theaustralian.com.au/wp-content/uploads/<YYYY>/<MM>&matchType=prefix&filter=original:.*pdf`
   — the traps: drop the trailing `*` (returns empty with it) and use
   `matchType=prefix`; coverage of these uploads is SPARSE (a couple of
   captures per year), so an empty result proves nothing by itself.
3. **Blind filename probes on the origin host** (fast curl HEAD loop):
   `Newspoll.pdf`, `newspoll<D><month><YYYY>.pdf` (lower + Title case),
   `Newspoll_D_Month_YYYY.pdf`, date-less casings. 404 ≠ absent forever
   — the PDF can land a few days after the article.
4. **Poll Bludger WP REST** (`pollbludger.net/wp-json/wp/v2/posts?search=Newspoll&after=…`)
   once found the Q1 PDF in a post; check whether the thread links a
   tables PDF for the wave.

## What does NOT work

- WP REST media API: `origin.theaustralian.com.au/wp-json/wp/v2/media`
  is disabled (WordPress error page / 403). `wp-json` on
  www.theaustralian.com.au likewise. No enumeration endpoint exists —
  that's why blind probing is on the ladder.
- fetchWithCookies / plain fetch against the ARTICLE: 302 → subscribe
  wall every time; the Chrome piggyback is the body-reading rung.

## Wiring the find into the site

`data/polls.json` row gets `"tablesUrl": "<origin URL>"`, gen-data §6a
`linksOf` emits the `tables` link kind, validate.mjs 2c3 gates the field
to Newspoll (pooled) rows — see the auspol-poll-links-list skill.
