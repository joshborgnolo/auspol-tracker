---
name: poll-figure-recovery
description: Recover a poll's topline/crosstab figures when the primary article is paywalled/bot-walled (News Corp "Nocookies" walls, dead pollster pages). Ladder — Poll Bludger WP REST API regex scan (most reliable), web mirrors, Wayback (usually EMPTY for News Corp URLs), repo caches (.build/logs/wiki-polls-cache.txt pins poll+citation), Chrome piggyback LAST (often broken: needs user's Apple Events toggle). Write scratch .mjs into .matilda/ (gitignored); inline `node -e` regex corrupts under shell quoting.
source: auto-skill
extracted_at: '2026-09-29T00:00:00.000Z'
---

# Poll-figure recovery when the primary source is walled

Session of 2026-09-29 (worked example at bottom): user needed the One Nation-voter vs
Coalition-voter breakdown of a YouGov question ("the Coalition and One Nation should work
together to form government"). Every direct route failed; Poll Bludger's WordPress API won.

**First orient inside the repo before going online** — `.build/logs/wiki-polls-cache.txt` has
the Wikipedia poll table with citations; one grep pins the exact poll (firm, fieldwork
window, n, publisher, article title/URL) so every later search is targeted, not blind.

## The ladder (in order of demonstrated reliability)

1. **Poll Bludger WordPress REST API — the workhorse.** William Bowe writes up most major
   poll releases with topline + voter-group breakdowns in prose, and the API is open:

   ```
   https://www.pollbludger.net/wp-json/wp/v2/posts?per_page=30&page=N&after=YYYY-MM-DDT00:00:00
   ```

   Also `?before=` and `me/pattern:` — fetch pages in a loop (works fine from plain fetch,
   no auth), strip tags + entities from `content.rendered` with
   `replace(/<[^>]+>/g," ")`, then regex for a KNOWN fragment (a number seen in a search
   snippet, e.g. `46 per cent|Forty-six`, or the question's exact verb phrase) with ~350–600
   chars of context either side. Print `p.id / p.date / title / link / match`. Two passes
   pay off: pass 1 on the number to FIND the post, pass 2 on the question phrase to confirm
   there's only one wave carrying it (a later same-question wave shows different numbers).

2. **Web mirrors / syndication copies.** News Corp (News24/Sky) copy is syndicated onto
   mirrors — found live: nationaltribune.com.au, europesays.com, newsbeep.com, aggregators
   like aussieconservative.com. Search the article's exact headline in quotes; mirror bodies
   are fetchable with plain curl. Quality varies — mirrors may carry only the topline, not
   crosstabs; two mirrors of the same wave can disagree, so prefer Poll Bludger's own
   recount when both exist.

3. **Wayback — expect ZERO captures for News Corp article URLs.** Both the availability
   API (`archive.org/wayback/available`) and the CDX query returned nothing for the News24
   news-story/<hash> URL. Don't burn time retrying alternate URL forms; one CDX miss is
   diagnostic. (Contrast: non-News-Corp pollster report pages DO get captured — Wayback
   stays worthwhile there, cf. extract-galaxy-archive.)

4. **Direct curl of News Corp.** news24.com.au (and theaustralian.com.au per
   newspoll-extraction) return a "Nocookies" bot-wall page (HTTP 200, ~126 KB, no article
   text). Detect and move on — never regex a 126 KB wall page hoping body text is inside.

5. **Chrome piggyback (.build/chrome-article.mjs) — LAST rung, and check it's alive.** In
   this session it hard-failed with `CHROME_JS_ERROR: Executing JavaScript through Apple
   Script is turned off` (user's Chrome ▸ View ▸ Developer ▸ "Allow JavaScript from Apple
   Events" toggle was off). The tool's exit contract reports this; do NOT retry in a loop —
   surface the one-line fix to the user and continue down the ladder. See
   chrome-session-piggyback skill.

## Tooling traps hit in this session

- **Inline `node -e` with regex is a trap**: triple-quoted shells + `$` in patterns + `<`
  redirects gave three "Expected '}', got '<eof>'" SyntaxErrors in a row. The fix that
  worked: write a real `.mjs` script and `node` it. `write_file` to `/tmp` is REFUSED under
  BOGAN approval mode ("out-of-workspace write") — write scratch into the repo's
  `.matilda/` directory instead (gitignored, and the session leaves an auditable script,
  e.g. `.matilda/scan-pb.mjs`).
- **Verify the wave, not just the question.** The first scan pass matched a post with the
  exact "Forty-six per cent" figure — but it was the 3 June wave (n=1,471), NOT the 4–10
  Aug News24 wave the repo citation pointed at. Initial "source found" instinct was wrong:
  the question question rides whichever wave asked it; confirm fieldwork dates + n embedded
  in the matched prose BEFORE reporting. Poll Bludger sentences conventionally end
  "conducted last Tuesday through to yesterday from a sample of NNNN" relative to the post
  date — use that to recompute the fieldwork window.

## Worked result (kept so the provenance is self-contained)

Poll Bludger post 2026-06-03 "Federal polls: YouGov and Roy Morgan (open thread)"
(https://www.pollbludger.net/2026/06/03/federal-polls-yougov-and-roy-morgan-open-thread-3/),
reporting YouGov fieldwork ~26 May–2 June 2026, n=1,471: "Coalition and One Nation should
work together to form government" — all respondents 46% yes / 31% opposed; **Coalition
voters 45%/28%; One Nation voters 53%/25%** (gaps ≈ don't-knows). Only wave in Poll
Bludger's coverage since 1 June 2026 carrying that question.
