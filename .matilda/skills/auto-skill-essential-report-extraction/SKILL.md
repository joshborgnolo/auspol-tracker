---
name: essential-report-extraction
description: Extract Essential Report polling from essentialreport.com.au past the Sucuri CloudProxy bot wall (base64 JS-cookie challenge solved in-process via new Function with a capturing document.cookie setter, 403/429 backoff, polite pooled pacing) — WP REST reports/questions pages -> Flourish visualisation.json -> data/essential-report.csv in the Resolve 10-col schema via .build/extract-essential-report.mjs (rpm cron contract, ESSENTIAL_STATUS json; side output .build/essential-src/report-index.json publish-date->release-page for the assimilator's releaseUrl stamping). Includes the perl setsid detached long-run trick for macOS (is_background also survived a full 20-min crawl 2026-09-01).
source: auto-skill
extracted_at: '2026-08-29T04:30:26.461Z'
---

# Essential Report extraction (essentialreport.com.au → data/essential-report.csv)

Run `node .build/extract-essential-report.mjs [--check] [--force]` from the repo root. Output
schema is byte-compatible with `data/resolve-political-monitor.csv`
(`dataset,question_id,question,visual,answer,dimension,key,date,value_pct,parties`), so
downstream consumers can treat the two CSVs uniformly.

## Side output: report-index.json (added 2026-09-01, commit 2dcd752)

Because the CSV can't carry URLs (byte-compatibility above), the extractor also persists
`.build/essential-src/report-index.json`: `{ "YYYY-MM-DD": "…/reports/<slug>" }`, the WP
publish date → wave page link for every report (99 entries on the live crawl). Written
on ANY index drift (a renamed slug lands even on a no-change CSV day), with the same
byte-compare + tmp+rename + `--check`-announces-only pattern as the CSV; log line
`updated .build/essential-src/report-index.json: N reports`. The updater wrapper's
`[ -d .build/essential-src ] && git add .build/essential-src/` sweeps it into commits.
Consumed by `assimilate-essential-vi.mjs` to stamp `releaseUrl` on new rows
(waveDate-or-day-before lookup — see the essential-vi-assimilator skill for the
assimilator's retro-fill/self-repair passes, CSV approval vocab, and dup guards). Two
traps the index
encodes: WP `date` is UTC publish time and can key a day BEHIND the Sydney slug
(`2025-10-28` → `29-october-2025`), and slugs are irregular (`28th-january-2026`,
zero-padded `01-september-2026`) — so never regex URLs from dates, and search index
VALUES when checking a slug. Typing guesses fail: `2-september-2026`,
`2nd-september-2026` and `september-2-2026` are ALL 404 while the real slug is
`01-september-2026`.

**Release pages publish ~8h AFTER the wave's charts** (charts ~01:00 AEST Wed; the
2026-09-01 report record is `2026-09-01T23:11:16Z` ≈ 09:11 AEST next day) — so the index
drifts a slot AFTER the CSV wave, which is exactly the trigger the updater wrapper's
retro-fill branch consumes (see the essential-vi-assimilator skill). To answer "is the
release page out yet?" WITHOUT a full ~20-min crawl, hit the WP REST index directly —
a plain curl (no Sucuri dance) is enough:
`curl -s 'https://essentialreport.com.au/wp-json/wp/v2/reports?per_page=5&_fields=id,date,modified,link,title'`
and compare `link`/`date` against the wave date.

## Site shape (true numbers, only visible after Sucuri is defeated)

- **WP REST API, not HTML scraping**: `/wp-json/wp/v2/reports` (99 report pages, Oct 2021 →
  latest, 19–81 question cards each — the script logs a cards-per-report histogram) and
  `/wp-json/wp/v2/questions` (953 standalone question pages).
- Each card embeds Flourish charts; values live at
  `public.flourish.studio/visualisation/<id>/visualisation.json` (embedded data sheets, no auth).
- Full clean crawl (2026-08-29): **4394 report-panel + 4052 question-page embeds → 3998 unique
  flourish ids → 54,482 rows, 699 datasets, dates 2008-12-01 → 2026-07-28**.
- A corrupted earlier crawl "worked" but found only 2292+498→2553 embeds and zero-card pages —
  those were Sucuri interstitials being parsed as real pages. **Truncated structure or
  anomalously small embed counts on this site = bot-wall poisoning, not site structure.**

## Sucuri CloudProxy bypass (the session's hard problem; generalises to other Sucuri sites)

- Detection: interstitial page (`server: Sucuri/Cloudproxy`, `x-sucuri-id` header, title "You are
  being redirected..."); body contains a base64 payload `S='...'` / marker `sucuri_cloudproxy_js`.
- The payload decodes to JS that builds a string `d`, sets
  `document.cookie='sucuri_cloudproxy_uuid_<hex>='+d+';path=/;max-age=86400;SameSite=Lax;Secure'`,
  then calls `location.reload()`. **Cookie name varies** (observed `uuid_7ff9185f8`,
  `uuid_79885a0f8`) — capture it, never hardcode.
- Solve in-process, no deps:
  ```js
  const code = Buffer.from(body.match(/S='([A-Za-z0-9+/=]+)'/)[1], "base64").toString("utf8");
  let pair = "";
  new Function("document", "location", "String", code)(
    { set cookie(v) { if (!pair) pair = v.split(";")[0]; } }, { reload() {} }, String);
  // pair must start with "sucuri_cloudproxy_" — then send it as a cookie header on retries
  ```
- Cache the cookie for the whole run; serialise concurrent solves through one shared promise
  (`sucuriSolving ??= solve(...)`), or parallel workers stampede the challenge endpoint.
- **Cap challenge re-solves** (`>3` → throw): an uncapped challenge→solve→retry loop was the
  cause of a 300 s silent hang (no output at all — hardest symptom to diagnose).
- Rate limiting: raw 403/429 HTML block pages carry **no** challenge marker → clear the cookie +
  shared solve state, back off `4s × attempt`, retry (FETCH_TRIES=24; 403/429 retryable, any
  other 4xx fatal via `!/HTTP (4(?!03|29)\d\d)/`).
- Politeness is not optional — aggressive manual probing got the IP temp-banned for ~7 min
  (silent 403s to everything). CONCURRENCY=3 with a 350 ms per-worker gap on WP pages
  (`pool(items, size, fn, minGapMs)` — worker sleeps between its own tasks);
  FLOURISH_CONCURRENCY=8 (different host, no Sucuri).
- Failure tolerance: per-page and per-flourish try/catch → `failedPages`/`failedFlourishes`
  (first 10 logged, counts surfaced in the status JSON). One bad item must never kill a
  ~20-minute crawl; the merge-shrink guard is the CSV safety net.

## Cron-safe contract

Mirrors extract-resolve-rpm.mjs exactly (see resolve-monitor-extraction skill): exit 0 success /
1 `ESSENTIAL_ERROR` / 2 `ESSENTIAL_GUARD` merge-shrink trip; final stdout line
`ESSENTIAL_STATUS {json}` (reports, question_pages, **failed_pages, failed_flourishes**, charts,
rows_kept/fresh/total, datasets, non_numeric_skipped, verbatim_dates, new_dates);
`--check` computes and prints but never writes; `--force` overrides the guard; byte-compare
no-change skip; atomic `OUT+".tmp"` + `renameSync`.

## Verification recipe (what "clean" looks like)

- Status shows `failed_pages:0, failed_flourishes:0`; histogram has no zero-card reports.
- Validate the CSV with a **quote-aware parser** — answers contain commas
  (`"Neither good, nor poor"`), so `split(",")` miscounts ~5,200 rows. A proper parse showed
  0 malformed rows, all ISO dates, all numeric values, 699 datasets on the 2026-08-29 baseline.
- `grep -c sucuri data/essential-report.csv` must be 0 (interstitial leakage check).

## Long-running a crawl from a Matilda session (macOS tool quirks)

- The full crawl (~20 min) exceeds the 10-min foreground command cap — a foreground run is
  killed mid-crawl with NO output (files are written only at the end, so nothing corrupts,
  but the turn is wasted). 2026-09-01: an `is_background: true` run survived the full
  ~20 min and completed — try that first.
- If background children get reaped at command teardown on your harness (observed with
  `run_in_background` and `nohup … &` on an earlier harness), detach with a perl setsid
  launcher redirecting to a log:
  ```sh
  perl -MPOSIX -e 'POSIX::setsid(); open(STDOUT,">","/tmp/ess.log"); open(STDERR,">&STDOUT");
    open(STDIN,"<","/dev/null"); exec "node", ".build/extract-essential-report.mjs";' &
  ```
- macOS has no GNU `timeout` — use `AbortSignal.timeout(FETCH_TIMEOUT_MS)` inside the script.
- Poll progress with standalone `sleep N # intentional-sleep: <reason>` calls; a combined
  `sleep 60; tail …` command gets blocked ("split into two calls") or killed at the 120 s cap.

## Essential silently edits its historical Flourish series — verify against Wayback, not the live chart

Discovered 2026-08-29 reconciling `data/polls.json` vs `data/essential-report.csv` for the
Sep–Nov 2025 waves (tracker ind 14/14/13 vs CSV IND+UND 12/13/12):

- Essential deleted the **"United Australia Party / Trumpet of Patriots" answer column** from
  its historical Primary Vote+ series between 2026-02-24 and 2026-08. Every other value in every
  shared wave was byte-identical; ToP was 2/1/1% on 30-Sep/29-Oct/26-Nov-25 and 0% from Jan-26.
  **The live chart (and therefore the attention.js CSV) can differ from what was polled in a
  past wave — diff old rows against an archived capture before trusting either side.**
- Wayback recipe: shell pages embed Flourish iframes as lazy `data-src` (no archived
  `attention.js`/object-cache exists), but the **embed itself is archived**:
  query `web.archive.org/cdx/search/cdx?url=flo.uri.sh/visualisation/<id>/embed&…` for captures,
  fetch `…/web/<ts>id_/https://flo.uri.sh/…` (`id_` = original bytes). Response arrives
  **gzip-encoded** — gunzip before parsing, else it looks empty.
- PayLoad is inline JS: `_Flourish_data = {"data":[{"label":"30-Sep-25","value":[…]}, …]}`;
  labels column order in `_Flourish_data_column_names`. Brace-match to JSON.parse (a trailing
  `;` breaks `JSON.parse` on a naive regex slice).
- Tracker/aggregator column conventions that caused the 14-vs-12 mismatch:
  - **Tracker convention** (polls.json, Dec-2025 onward rows): `ind = Independents/Other +
    Undecided`, undecided folded in, **ToP share dropped entirely** (no oth field used; rows
    sum to 98–101, inside validate.mjs ±2 primary-sum tolerance).
  - **Wikipedia's "IND + OTH" cell** additionally folds in ToP, so it overstates the tracker's
    ind by the ToP share — don't transcribe Wikipedia political-polling tables into
    polls.json without decomposing the columns.
  - Resolved values 2025-09-29 / 2025-10-27 / 2025-11-24: ind **12 / 13 / 12** (commit
    f97de17).
- 2PP definition quirk already in conventions: pollsterRules declares Essential
  `tppIncludesUndecided` — tracker stored undecided-EXCLUDED normalised ≤ Feb 2026
  (e.g. 53.7 = 51/44 renorm), as-published undecided-INCLUSIVE from Mar 2026.
- Guardian Essential op-eds usually cite figures only via embedded images — the article text
  cannot confirm numbers.
- Provenance via git history is impractical here: `git log -G/-S`/blame on `data/polls.json`
  exceeds the 240 s tool cap (300 MB+ history scan). Reason from source data instead.
