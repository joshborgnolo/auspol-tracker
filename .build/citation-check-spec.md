# The citation checker (spec)

Drafted 2026-09-01. A slow watchdog over the archive's outbound links — the
provenance every row rests on, and the one thing in `data/polls.json` that
nothing verifies.

## The surface

187 URLs across 26 hosts, in three fields:

| field | count | what it is |
|---|---|---|
| `polls[].url` | 155 | the citation for the wave (155 of 156 rows carry one) |
| `polls[].releaseUrl` | 22 | the pollster's own release, beside the coverage link |
| `pollsterRules[].site` | 10 | the publisher index — **load-bearing** |

Top hosts: roymorgan.com 46, essentialreport.com.au 17, smh.com.au 16,
theaustralian.com.au 15, afr.com 15, skynews.com.au 15, demosau.com 12,
accent-research.com 9, theguardian.com 6, news24.com.au 5. 15 targets are PDFs;
the tail includes drive.google.com, a Wix `usrfiles.com` file host, and one
x.com status.

`pollsterRules[].site` deserves emphasis: `essential-confirm-skip.mjs` and
`demosau-confirm-skip.mjs` verify absence against the publisher index. If one of
those moves, a skip-confirm agent doesn't fail loudly — it loses its evidence
source. These ten are infrastructure, not decoration.

## Why a naive checker is worse than none

Status codes lie in **both directions** on this archive, and the two most-cited
walled publishers lie in opposite ones. Measured 2026-09-01:

| host | what an anonymous GET returns | truth |
|---|---|---|
| `theaustralian.com.au` (15) | **200** + `<title>No Cookies` | alive, but the 200 proves nothing |
| `news24.com.au` (5) | **404** + `<title>Nocookies` | alive; 404 is the bot wall |
| `skynews.com.au` (15) | **404** after 3 redirects → `news24.com.au/nocookies` | alive, via the rebrand redirect |
| `x.com` (1) | 200, JS shell | a deleted post looks identical |
| `drive.google.com` (4) | 200, viewer page | an access-denied page looks identical |

That is ~40 of 187 URLs — better than a fifth of the archive — where the HTTP
status is not evidence. A checker that trusts status codes would report 35 dead
links that are fine and pass 15 walled ones it never actually saw.

**I made exactly this mistake while scoping this work**: I reported all 15
skynews citations as dead 404s. They redirect to News24 and hit its cookie wall.
Encode the rules or don't build the checker.

## Verdicts

- `ok` — resolved, and (for PDFs) `content-type: application/pdf` with non-zero
  length.
- `wall` — matched a known wall rule. **Indeterminate, never an alarm.**
- `moved` — resolved, but the final URL differs from the recorded one. Record
  the final URL and the redirect count. Not a failure.
- `gone` — a real 404/410 from a host with no wall rule, or a wall-ruled host
  returning something that is neither the wall nor the page.
- `error` — DNS, TLS, timeout, 429. Never `gone`; retry next run.

Wall rules are title-based, so the fetch needs the first ~4 KB of the body
(`Range: bytes=0-4095`), not just headers:

```
theaustralian.com.au        200 + /no cookies/i in <title>      -> wall
news24.com.au, skynews.com.au  404 + /nocookies/i in <title>    -> wall
x.com, drive.google.com     any 2xx                             -> wall (unverifiable)
```

These are the same detections `auto-skill-newspoll-extraction` and
`auto-skill-news24-extraction` already carry. Read them; don't re-derive.

## The signal that actually matters: redirect drift

The 15 skynews citations are alive **only because News Corp still redirects the
retired Sky News paths to News24**. Redirects get retired. The valuable output of
this agent is not "is it 200 today" but "this citation now resolves via 3 hops to
a different host" — which is the window in which you can rewrite them to
`news24.com.au` while the mapping still exists, rather than discovering it after
the redirect is dropped and the original article is unfindable.

So `moved` entries are the report's headline, not its footnote.

## Never rewrite the data

The agent proposes; a human disposes. It must not edit `polls.json`. A citation
is provenance, and a redirect can land somewhere subtly wrong — a section index,
a paywall interstitial, a rebranded article with a different ID. This is the same
discipline the Infogram net-sat reconciliation follows: read-only, report
divergence, let a person adjudicate. That rule earned its keep when the
publisher's own chart turned out to be wrong and the tracker right.

## State and cadence

- `data/link-health.json`: one entry per URL — `{url, field, lastChecked,
  verdict, finalUrl, redirects, status, note}`.
- **Write only when an entry's verdict, finalUrl or redirect count changes.**
  `lastChecked` alone must never dirty the file, or the weekly run commits 187
  timestamp churns into a repo that already takes concurrent pushes. Same rule
  `np-score.mjs` follows for its identity tuple.
- Weekly, not daily. Link rot is slow, and 187 requests a day at other people's
  publishers is rude. Sequential with a small delay, one host at a time, honest
  User-Agent, back off on 429.

## Exit codes

Following `coverage-doctor.mjs` (`check-coverage`'s `3` already means
"actionable gap" — don't reuse it):

- `0` — no citation newly `gone`. `moved` and `wall` are report-only.
- `1` — inconclusive: too many `error`s to judge (e.g. >20% of the sweep).
- `2` — at least one URL went from `ok`/`wall` to `gone` since the last run.

Only a *transition* into `gone` fires. A link already known dead and recorded
stays reported, not re-alarmed, or the light is permanently red.

Last stdout line: `LINK_STATUS {json}` with counts per verdict and the list of
new `gone` and new `moved` entries.

## Verification recipe

- Fixture the wall rules first, offline: a saved Australian "No Cookies" page
  must classify `wall`, not `ok`; a saved News24 `Nocookies` 404 must classify
  `wall`, not `gone`. These two are the whole point.
- A genuinely dead URL on a plain host must classify `gone`.
- A known-good redirect (any skynews citation) must classify `moved` with
  `redirects: 3` and `finalUrl` on `news24.com.au` — and must NOT be `gone`.
- Run the full sweep once against live: expect ~40 `wall`, 15 `moved`, 0 `gone`,
  and confirm a second immediate run writes nothing to `link-health.json`.
