---
name: auspol-acnielsen-pre1996-lineage
description: auspol-tracker — why the AC Nielsen archive starts at 1996 and "no 1993 Nielsen poll exists": the Fairfax poll 1992–mid-1995 was AGB McNair (face-to-face, the Nielsen precursor); AC Nielsen took over in 1996 (telephone). Map of where 1990–93 figures actually survive (Bonham Keating aggregation, ADA Saulwick AGB McNair DOIs, Age/SMH press) and the source-access gotchas when re-researching this.
source: auto-skill
extracted_at: '2026-09-03T05:30:38.248Z'
---

# auspol-tracker: AC Nielsen pre-1996 lineage (why the archive starts at 1996)

## The answer to "where are the 1993 Nielsen polls"

**There is none.** `archives/acnielsen/index.html` starting at 1996 is historically
correct, not an extraction gap. Three independent confirmations (2026-09-03):

1. **AGB McNair was Fairfax's pollster through the 1993 election cycle** — Kevin
   Bonham, "The Keating Aggregation 1990–1993" (kevinbonham.blogspot.com,
   2018-03-13): the retro-aggregate uses "polls published by Newspoll, Morgan (mostly
   face-to-face…), and, **from the start of 1992, AGB McNair (a precursor of
   Nielsen)**". AGB McNair polled face-to-face and had a noticeable house effect vs
   Newspoll/Morgan (Bonham applied a flat 0.7pt correction).
2. **AGB McNair was still the SMH/Age pollster as late as July 1995** — citable in
   Wikipedia's *1996 Australian Labor Party leadership election* (SMH 26 Apr 1995, Age
   5 Jul 1995 articles attribute the polling to AGB McNair).
3. **The ACNielsen series begins in 1996 with a method switch** — the local
   `data/acnielsen/ACNielsenPoll1996.pdf` opens on "ELECTION 2nd March 1996" and is
   **telephone** ("conducted on the telephone nationwide…"), vs AGB McNair's
   face-to-face. No pre-1996 columns inside any PDF in the set. `au.acnielsen.com`'s
   first Wayback capture is **March 2006** (CDX: `url=au.acnielsen.com&from=1995`
   → 20060303), and the site's poll compilations never reached before 1996.

So: brand + method + web archive all roll over at 1996 together.

## Where 1990–93-era figures actually survive

| Source | Contents |
|---|---|
| Bonham, "The Keating Aggregation 1990–1993" | 2PP aggregate graph of Newspoll + Morgan + AGB McNair (from Jan 1992). Final aggregate 49.8 ALP; Bonham-converted final Newspoll & Morgan both ≈ 50.7; actual 1993 result 51.4. Data credited to John Stirton. Only public analysis of the AGB McNair series. |
| Australian Data Archive (ADA) | "Saulwick AGB McNair Poll" survey microdata series, 1993 waves: #22 (Jan, doi:10.26193/1yof9q), #25 (Feb, doi:10.26193/tnkghd), #29 (Sep, doi:10.26193/f14lj9) — Saulwick Research as author — plus "Federal Election Exit Poll, 1993" (doi:10.26193/6q0ciu). |
| Age / SMH / Canberra Times (Trove digitised to 1995) | Contemporary press reports of individual AGB McNair waves. |

There is NO published ACNielsen-branded table before 1996 and no Wikipedia polling
page for 1993 ("Opinion polling for the 1993 Australian federal election" does not
exist — an action=raw/parse fetch returns empty; the main *1993 Australian federal
election* article cites only the election-eve Newspoll). Wikipedia full-text search
for "AGB McNair" surfaces only scattered citations (1996 ALP leadership, Mundingburra,
etc.) — no trend table.

## Probing gotchas (relevant if this research is re-run or extended)

- **ADA (data.ada.edu.au / ada.edu.au) is bot-walled**: the landing page is an Anubis
  JS proof-of-work challenge, and the Dataverse API path
  (`/api/datasets/:persistentId?persistentId=doi:…`) does not respond to curl from
  shell (HTTP 000). DOI/record metadata is best read via web_search snippets; content
  extraction failed in-session.
- Wikipedia search-API first: `list=search` before assuming an "Opinion polling for
  the <year>" title exists — pre-1996 election polling pages generally don't.
- Wayback CDX from shell works: `web.archive.org/cdx/search/cdx?url=<host>&output=text
  &fl=timestamp,original&from=<year>` for first-capture dating.
- Bonham blogspot posts: `<div class="post-body …">` … `post-footer` is the slice;
  naïve full-page strip dumps thousands of lines of sidebar CSS/labels.

## If the archive page is extended to explain the 1996 floor

Editorial decision still pending with the user (not committed). Suggested shape if it
happens: a one-line lineage note on `archives/acnielsen/index.html` ("Fairfax's
pre-1996 poll was conducted by AGB McNair, the precursor of AC Nielsen; no
Nielsen-branded federal polls exist before 1996") citing Bonham — NOT fabricated
1990–93 rows in the PDF list or `data/acnielsen-polls.csv`. The page is hand-maintained
satellite copy (auto-skill-auspol-satellite-page-branding); bump `ARCHIVE_STAMP` in
build.mjs and re-run the verify-archive-static probe when touching it.
