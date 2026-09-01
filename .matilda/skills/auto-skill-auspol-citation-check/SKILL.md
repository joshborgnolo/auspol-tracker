---
name: auspol-citation-check
description: auspol-tracker — the citation link-rot watchdog (check-citations.mjs + citation-check.yml, shipped 464d2e6) sweeps all 175 outbound polls[].url/releaseUrl/pollsterRules.site URLs weekly and ledgers verdicts in data/link-health.json. Hard-won core rules — (1) wall classification is CONTENT-keyed (bodyRe/titleRe), never status-keyed, because status codes lie in both directions (News Corp's titleless 403 crawler-bot page, news24's 404 cookie wall, x.com's 200 JS shell, thenewdaily's Cloudflare "Just a moment") and a status-pinned rule silently rots when the host swaps statuses; (2) a redirect chain's TERMINAL hop can be wall machinery, so entries carry `hops` (the intermediate redirect URLs, in chain order) — hops[0] is the publisher's own 301 1:1 mapping and the actionable rewrite candidate the wall-endpoint finalUrl would otherwise throw away. Exit classes 0/1/2 where 2 = a citation TRANSITIONED to gone; the original standing baseline (three Australia Institute PDFs gone) was adjudicated same-day — rewritten to the institute's OWN cdn.australiainstitute.org.au copies (their 2026-08-18 CDN migration) rather than Wayback snapshots — and the ledger is written only on identity-tuple change.
source: auto-skill
extracted_at: '2026-09-01T06:10:59.381Z'
---

# The citation link-rot watchdog (shipped 2026-09-01, commit 464d2e6)

Sibling of `auspol-site-check` (whose deployed-bytes watchdog guards what the
site SERVES; this one guards what the archive CITES). Map:

- `.build/check-citations.mjs` — the checker. Census: `polls[].url`,
  `polls[].releaseUrl`, `pollsterRules.*.site` — 175 URLs / 28 hosts at
  baseline. Manual redirect following (MAX_HOPS 10), `Range: bytes=0-16383`
  fetch, 429 backoff, error carry-forward from previous state. Last stdout
  line `LINK_STATUS {json}`. Exit classes: `0` ok, `1` inconclusive (>20%
  transient errors), `2` a citation TRANSITIONED ok/wall/moved → gone.
  Env seams for tests: `CITATION_CHECK_POLLS` / `_STATE` / `_DELAY_MS` /
  `_TIMEOUT_MS` / `_WALL_JSON`.
- `.build/test-citation-check.mjs` — 32 assertions driven against local HTTP
  fixture servers (incl. a titleless-403 News Corp bot page, a Cloudflare
  "Just a moment" title shell, a 127.0.0.1-vs-localhost cross-host redirect
  chain with host:port rule pins, a same-host pre-wall chain keeping its
  middle hop, a one-hop move asserting NO hops key, transitions-exit-2,
  steady-gone-exit-0, inconclusive-exit-1, idempotence). Run after ANY
  wall-rule, classify or entry-shape edit.
- `.github/workflows/citation-check.yml` — weekly cron `37 21 * * 0`
  (Mondays 07:37 AEST) + workflow_dispatch; commits `data/link-health.json`
  only on real change; only exit 2 goes red. Deliberately NO repair job —
  read-only against polls.json: "the agent proposes; a human disposes".
- `data/link-health.json` — the committed ledger. Post-adjudication
  2026-09-01: 132 ok / 30 wall / 13 moved / 0 gone / 0 error.
- `.build/citation-check-spec.md` — the design spec (wall table, census,
  verification recipe, "adjudicated baseline" section).

## Core invariant: content-keyed walls, never status-keyed

Status codes lie in BOTH directions — measured on the first live sweep
(21/175 spurious errors before this fix): News Corp hosts serve a titleless
403 "crawler bot" page, news24/skynews answer 404 behind a cookie wall,
thenewdaily returns 200 with a Cloudflare "Just a moment" shell, x.com and
drive.google.com return a 200 JS shell. So `WALL_RULES` are keyed on
host(+port) and matched on CONTENT: `theaustralian.com.au` →
`bodyRe "crawler bot|no cookies"` (survives News Corp's 200-title and
403-titleless incarnations), five more News Corp hosts → `bodyRe "crawler
bot"`, news24+skynews → `status:404 + titleRe "nocookies"`, thenewdaily →
`titleRe "^just a moment"`, x.com + drive.google.com → any-2xx. The **wall
check is hoisted above the status dispatch** in `classify()`, and a
cross-host redirect refines wall → moved. The spec's "And I made the second
mistake too" paragraph is the written confession: a status-pinned rule
silently rots the day the host swaps statuses; key on content.

## The chain IS the data: ledger `hops`, not just the terminal URL

Second hard-won rule (user review of the first shipped ledger, same day):
the 13 skynews `moved` entries all recorded `finalUrl` as
`news24.com.au/nocookies?a=A.flavipes` — the wall's 404 endpoint. Traced by
hand, hop 1 of every chain is a clean **301** mapping the retired skynews
path 1:1 onto the same article path on `news24.com.au`; only hops 2–3 are
cookie-check machinery (`/remote/check_cookie.html?url=…` → `/nocookies?…`).
So the terminal URL is *wall machinery*, and recording only it throws the
one actionable fact away. The fix: `fetchFinal` tracks `visited`
(original … terminal) and entries gain **`hops`** — the intermediate
redirect URLs in chain order, original and terminal excluded (they are
already `url`/`finalUrl`; invariant: the resolution path is always
`[entry.url, ...hops, entry.finalUrl]`). Written only when the chain ran
more than one redirect — 0/1-redirect entries have NO `hops` key, so the
field stays minimal. Design choices worth copying:

- Ledger all intermediates, not "the last pre-wall hop": same byte cost,
  and the classification of *which* hop is wall machinery can change
  (walls re-skin — see the status-pinning mistake above) while the raw
  chain stays evidence.
- **Check a terminal URL is stable across fetches before ledgering it** —
  a volatile wall token in a recorded URL would dirty the ledger every
  weekly run. The `nocookies?a=A.flavipes` token was curl'd several times
  over minutes and never moved, so it's fine to commit.
- When writing up the finding, hand the user the *verbatim* capture
  (curl `-sSI` chain, one block per hop) — a restated table invites
  transcription slips; the raw headers are the evidence.

## State discipline and exit semantics

- The ledger is written ONLY when an entry's identity tuple
  (url, verdict, finalUrl, redirects, hops, lastError) changes —
  `lastChecked` never dirties the file (np-score.mjs pattern). Proof of
  idempotence: a second immediate run prints `citation-check: no state
  change — link-health.json untouched`; the spec's verification recipe
  demands this before committing the ledger. Note the one-time wrinkle when
  a NEW field joins the tuple: every old committed entry lacks `hops`, so
  the first run after the change counts as "different" and rewrites the
  ledger (the `hops` rollout rewrote the 13 moved entries exactly once,
  then went quiet — the workflow's commit-on-real-change is what lands it).
- A first-SEEN gone never fires exit 2 — only a transition does. The three
  baseline gones were australiainstitute.org.au PDFs cited by YouGov
  2025-10-30, Redbridge 2026-02-12 and YouGov 2026-03-19 (all plain 404s) —
  adjudicated 2026-09-01: the institute migrated wp-content/uploads/… to
  cdn.australiainstitute.org.au/<YYYY/MM>/<id>/… without redirects, and the
  three citations were rewritten to the SAME filenames on the CDN (found
  via AI's own post pages + wp-json `/wp/v2/media` search, each verified
  200 application/pdf before the edit; canonical copy preferred over
  Wayback). When a publisher moves uploads, check the CDN + media API
  BEFORE falling back to snapshots. The standing gone count is now zero.

## Verifying and committing a sweep

1. `node .build/test-citation-check.mjs` → "all expectations held".
2. Full live sweep (≈30 min at ~1–2 URLs/s; slow tail is skynews/News Corp):
   tail the log for the final `LINK_STATUS {"verdict":0,...}` line, then
   confirm the counts match expectations and `newGone`/`newMoved` are empty.
   For any `moved` entry with redirects > 1, check `hops[0]` is on a real
   article path (e.g. news24.com.au `…/news-story/<id>`) — that hop is the
   rewrite candidate the human acts on.
3. Re-run immediately → expect "no state change" (idempotence) before
   committing `data/link-health.json`.
4. Session tooling traps learned the hard way: a foreground `sleep N && cmd`
   is REJECTED by the shell tool — fire a standalone background
   `sleep N # intentional-sleep: …` and poll the log file separately. And
   before panicking over a "stalled" progress log, check with `ps`/`stat`
   whether a restarted process (fresh pid+lstart) is writing steadily — a
   resumed session can restart the sweep silently.

## Related

- `auspol-site-check` — the sibling deployed-bytes watchdog; the two specs
  are cross-referenced siblings in `.build/`.
- `auspol-actions-data-pipeline`, `launchd-scheduled-data-pipeline` —
  scheduled-job conventions (cron identity, github-actions[bot] commits,
  `git pull --rebase` in-workflow).
