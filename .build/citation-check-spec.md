# The citation checker (spec)

Drafted 2026-09-01. A slow watchdog over the archive's outbound links — the
provenance every row rests on, and the one thing in `data/polls.json` that
nothing verifies.

## The surface

175 unique URLs across 28 hosts, in three fields (measured off the built
ledger, 2026-09-01):

| field | unique URLs | what it is |
|---|---|---|
| `polls[].url` | 146 | the citation for the wave |
| `polls[].releaseUrl` | 22 | the pollster's own release, beside the coverage link |
| `pollsterRules.*.site` | 7 | the publisher index — **load-bearing** (10 deployments, 7 unique) |

Post-census: `polls[].methodUrl` joined the sweep 2026-09-02 (the YouGov /
Newspoll APC statement links — YouGov's CloudFront
document host and pyxispolling.com statement pages/PDFs; the Newspoll
enumerator switched to Pyxis's live collection API the same day when the
sitemap.xml enumeration turned out to have frozen at Jan 2026 in a CMS
migration → 36 URLs on the sweep at close of day), and the RedBridge /
Accent leg landed later the same day — nine usrfiles.com report PDFs
re-read from the extract-redbridge.mjs caches, plus two from a one-off
CDP-click probe → 45 URLs on the sweep.

Top hosts: roymorgan.com 44, theaustralian.com.au 15, smh.com.au 15,
afr.com 14, essentialreport.com.au 13, skynews.com.au 13, demosau.com 11,
accent-research.com 9, theguardian.com 6, drive.google.com 4,
news24.com.au 4, cdn.australiainstitute.org.au 3 (the institute moved its
uploads to a CDN on 2026-08-18 — see the adjudicated-baseline note below;
the census was refreshed against the post-rewrite ledger the same day).
The tail includes a Wix
`usrfiles.com` file host, one x.com status, and a string of News Corp
mastheads (`heraldsun`, `dailytelegraph`, `couriermail`, `thechronicle`,
`news.com.au` — one each).

`pollsterRules.*.site` deserves emphasis: `essential-confirm-skip.mjs` and
`demosau-confirm-skip.mjs` verify absence against the publisher index. If one of
those moves, a skip-confirm agent doesn't fail loudly — it loses its evidence
source. These seven are infrastructure, not decoration.

## Why a naive checker is worse than none

Status codes lie in **both directions** on this archive, and the two most-cited
walled publishers lie in opposite ones. Measured 2026-09-01:

| host | what an anonymous GET returns | truth |
|---|---|---|
| News Corp mastheads (20: `theaustralian.com.au` ×15, `heraldsun`, `dailytelegraph`, `couriermail`, `thechronicle`, `news.com.au` ×1 each) | **403** + a 1.3 KB "You might have been detected and blocked as a crawler bot!" page | alive; News Corp's own bot wall. Browserish UAs get the older **200** + `<title>No Cookies` incarnation |
| `news24.com.au` (4) | **404** + `<title>Nocookies` | alive; 404 is the bot wall |
| `skynews.com.au` (13) | **404** after 3 redirects → `news24.com.au/nocookies` | alive, via the rebrand redirect |
| `thenewdaily.com.au` (1) | **403** + Cloudflare "Just a moment…" shell | alive; the challenge eventually yields |
| `x.com` (1) | 200, JS shell | a deleted post looks identical |
| `drive.google.com` (4) | 200, viewer page | an access-denied page looks identical |

That is ~43 of 175 URLs — roughly a quarter of the archive — where the HTTP
status is not evidence. A checker that trusts status codes would report 16 dead
links that are fine (13 skynews + 3 walls it read at face value) and pass 26
walled ones it never actually saw.

**I made exactly this mistake while scoping this work**: I reported all
skynews citations as dead 404s. They redirect to News24 and hit its cookie
wall. Encode the rules or don't build the checker.

**And I made the second mistake too**: the first table draft pinned the
Australian's wall to `200 + No Cookies` because that's what a browser UA saw
in the morning. The afternoon's sweep — honest UA, no cookies — got a hard
403 with a *different* wall page. A status-pinned title rule silently matched
nothing, and 21 URLs reported `error` until the rule moved to the page body,
the one thing both incarnations share. Key wall rules on **content**, not
status — statuses are the most-volatile part of a bot wall.

## Verdicts

- `ok` — resolved, and (for PDFs) `content-type: application/pdf` with non-zero
  length.
- `wall` — matched a known wall rule. **Indeterminate, never an alarm.**
- `moved` — resolved, but the final URL differs from the recorded one. Record
  the final URL, the redirect count, and (for chains longer than one hop) the
  intermediate `hops`. Not a failure.
- `gone` — a real 404/410 from a host with no wall rule, or a wall-ruled host
  returning something that is neither the wall nor the page.
- `error` — DNS, TLS, timeout, 429. Never `gone`; retry next run.

Wall rules key off page **content**, so the fetch needs the first ~16 KB of
the body (`Range: bytes=0-16383` — the title alone wasn't enough once News
Corp's 403 page shipped without one), not just headers:

```
theaustralian.com.au + News Corp mastheads
                            body matches /crawler bot|no cookies/i   -> wall (any status)
news24.com.au, skynews.com.au  404 + /nocookies/i in <title>         -> wall
thenewdaily.com.au            <title> matches /^just a moment/i      -> wall
x.com, drive.google.com       any 2xx                                -> wall (unverifiable)
```

These are the same detections `auto-skill-newspoll-extraction` and
`auto-skill-news24-extraction` already carry, plus the News Corp block page as
measured above. Read them; don't re-derive.

## The signal that actually matters: redirect drift

The 13 skynews citations are alive **only because News Corp still redirects the
retired Sky News paths to News24**. Redirects get retired. The valuable output of
this agent is not "is it 200 today" but "this citation now resolves via 3 hops to
a different host" — which is the window in which you can rewrite them to
`news24.com.au` while the mapping still exists, rather than discovering it after
the redirect is dropped and the original article is unfindable.

Trace one of those chains and the first hop is a clean **301**: the skynews
citation maps 1:1 onto the same article path on `news24.com.au`, and only the
*next* hop 302s into the cookie-check machinery that ends on the
`/nocookies?a=…` wall. So a `moved` entry whose chain ran more than one hop
records the intermediate URLs as `hops` — original and terminal are already
`url`/`finalUrl`, so `hops` holds exactly what's between them, first hop's
Location first. `hops[0]` is the publisher's own permanent mapping: the rewrite
candidate a human acts on, which recording only the wall-endpoint `finalUrl`
would throw away. (The `/nocookies?a=…` token was checked stable across
fetches before this ledgered anything — a volatile terminal URL would churn
the write-only-on-change rule weekly; it does not.)

So `moved` entries are the report's headline, not its footnote.

## Never rewrite the data

The agent proposes; a human disposes. It must not edit `polls.json`. A citation
is provenance, and a redirect can land somewhere subtly wrong — a section index,
a paywall interstitial, a rebranded article with a different ID. This is the same
discipline the Infogram net-sat reconciliation follows: read-only, report
divergence, let a person adjudicate. That rule earned its keep when the
publisher's own chart turned out to be wrong and the tracker right.

## State and cadence

- `data/link-health.json`: one entry per URL — `{url, fields, lastChecked,
  verdict, finalUrl, redirects, status, note}`, plus `hops` (the intermediate
  redirect URLs) when the chain ran longer than one hop.
- **Write only when an entry's verdict, finalUrl, redirect count or hops
  change.** `lastChecked` alone must never dirty the file, or the weekly run
  commits 175 timestamp churns into a repo that already takes concurrent
  pushes. Same rule `np-score.mjs` follows for its identity tuple.
- Weekly, not daily. Link rot is slow, and 175 requests a day at other people's
  publishers is rude. Sequential with a small delay, one host at a time, honest
  User-Agent, back off on 429.

## Exit codes

Following `coverage-doctor.mjs` (`check-coverage`'s `3` already means
"actionable gap" — don't reuse it):

- `0` — no citation newly `gone`. `moved` and `wall` are report-only.
- `1` — inconclusive: too many `error`s to judge (e.g. >20% of the sweep).
- `2` — at least one URL went from `ok`/`wall`/`moved` to `gone` since the
  last run.

Only a *transition* into `gone` fires. A link already known dead and recorded
stays reported, not re-alarmed, or the light is permanently red.

Last stdout line: `LINK_STATUS {json}` with counts per verdict and the list of
new `gone` and new `moved` entries.

## Verification recipe

- Fixture the wall rules first, offline: a saved News Corp 403 crawler-bot
  page must classify `wall`, not `error` (no `<title>` to lean on — the body
  regex is the detector); a saved News24 `Nocookies` 404 must classify
  `wall`, not `gone`. These are the whole point.
- A genuinely dead URL on a plain host must classify `gone`.
- A known-good redirect (any skynews citation) must classify `moved` with
  `redirects: 3`, `finalUrl` on the `news24.com.au` wall endpoint and
  `hops[0]` on the `news24.com.au` article path — and must NOT be `gone`.
- Run the full sweep once against live: expect ~30 `wall`, 13 `moved`, and
  zero `gone` entries (the three Australia Institute briefs were
  adjudicated — below), and confirm a second immediate run writes nothing
  to `link-health.json`.

## Adjudicated baseline: the three gone Australia Institute briefs

The 2026-09-01 baseline recorded three institute PDFs — citations on YouGov
(2025-10-30, 2026-03-19) and Redbridge (2026-02-12) waves — as `gone`
(404 with or without a Range header, so genuinely absent). Three consecutive
briefs suggested a reorganisation, not individual deletions, and that is
what it was: the institute migrated `wp-content/uploads/…` to
`cdn.australiainstitute.org.au/<YYYY/MM>/<id>/…` on 2026-08-18 (CDN
last-modified headers) without redirects from the old paths.

Adjudicated the same day (the agent proposes; a human disposes): all three
citations were rewritten in `polls.json` to the same filenames on the CDN —
`2025/11/18020544/Aus-Institute-Poll-on-US-Oct25-summary-30102025.pdf`,
`2026/02/18022711/Polling-brief-One-Nation-voters-and-gas-exports-Web.pdf`,
`2026/03/18023552/Aus-Institute-Mar26-poll-summary-20032026-votingintention_GAS.pdf`
— each verified live (200, `application/pdf`) before the edit. The
replacement paths surfaced from the institute's own post pages and WP
media API, not guesses; the canonical CDN copy was preferred over a
Wayback snapshot. The standing `gone` count is now zero; the next `gone`
this ledger ever logs is a genuine regression by construction.
