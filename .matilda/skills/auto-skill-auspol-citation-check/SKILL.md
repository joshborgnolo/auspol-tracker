---
name: auspol-citation-check
description: auspol-tracker — the citation link-rot watchdog (check-citations.mjs + citation-check.yml, shipped 464d2e6) sweeps the archive's outbound polls[].url/releaseUrl/methodUrl and pollsterRules[].site/releaseHub URLs weekly (started at 175 unique polls[].url/releaseUrl/pollsterRules[].site URLs on 2026-09-01; the methodUrl and releaseHub categories joined 2026-09-02, see "Adding a sweep category") and ledgers verdicts in data/link-health.json. Hard-won core rules — (1) wall classification is CONTENT-keyed (bodyRe/titleRe), never status-keyed, because status codes lie in both directions (News Corp's titleless 403 crawler-bot page, news24's 404 cookie wall, x.com's 200 JS shell, thenewdaily's Cloudflare "Just a moment") and a status-pinned rule silently rots when the host swaps statuses; (2) a redirect chain's TERMINAL hop can be wall machinery, so entries carry `hops` (the intermediate redirect URLs, in chain order) — hops[0] is the publisher's own 301 1:1 mapping and the actionable rewrite candidate the wall-endpoint finalUrl would otherwise throw away. Exit classes 0/1/2 where 2 = a citation TRANSITIONED to gone; the original standing baseline (three Australia Institute PDFs gone) was adjudicated same-day — rewritten to the institute's OWN cdn.australiainstitute.org.au copies (their 2026-08-18 CDN migration) rather than Wayback snapshots — and the ledger is written only on identity-tuple change. Acting on a bank-wide `moved` finding is a heal chain in a fixed order (extractor contract first — a polls.json-only edit self-reverts — then extractor rerun, downstream generators, rebuild with URL-only artifact proof, and the re-sweep LAST because the census enumerates from the data files at launch; worked on the seven SEC Newgate posts→PDFs, commit 4046c12). Since 2026-10-09 the same weekly run also ARCHIVES (commit bbc7153): every ok/wall/moved link is submitted to web.archive.org/save/<url> and a 2xx/3xx earns a `wayback: <date>` stamp on the ledger entry — decided over self-hosting after measuring the corpus at ~600 MB (~75% of it Accent's 10–41 MB monthly report PDFs).
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
5. Background-sweep notifications arrive LATE and out of order (2026-09-01:
   six completions landed long after the ledger was committed and pushed,
   including a pre-rewrite run announcing `gone: 3` — its log tail described
   state the commit had already superseded). When several sweeps are in
   flight (cite-live-N.log relaunches), the LAST `state changed — wrote`
   wins the ledger file, so never trust a notification's counts after
   overlaps: verify the tree directly (`git diff -- data/link-health.json`,
   grep the verdict counts) before believing, committing, or re-running
   anything on the strength of a stale tail.

## Acting on a moved finding: heal data, THEN re-sweep (worked 2026-10-09)

When a `moved` finding is bank-wide (a publisher starts 301-ing a class of
article pages to their documents), the response is a full heal chain, and
ORDER MATTERS because the checker enumerates its census from the data files
on disk at launch. The worked case: all seven SEC Newgate Mood-of-the-Nation
report posts began 301-ing straight to their report PDFs (commit 4046c12):

1. **Fix the EXTRACTOR contract first, not the data file.** The rows a
   house extractor owns are healed whenever its candidate and the row
   differ (`cur.url !== row.url`), so a polls.json-only edit silently
   self-reverts on the next extractor run. For SEC Newgate the change was
   one line: `page = url || it.link || null` (the media item's vetted PDF
   `source_url` first; the article-page `link` demoted to fallback).
2. **Run the extractor** — its heal rewrites every owned surface in one
   pass: the `<house>-src/*.json` sidecars (rewritten every run) AND
   `data/polls.json` (all 7 direction rows healed clean).
3. **Re-run every downstream generator that reads the row URL.** SEC
   Newgate's direction rows feed `.build/issues.mjs` (ownership
   `source: p.releaseUrl || p.url`), so 3 `data/issues.json` sources only
   moved on that rerun — a data item, not a code change.
4. **Rebuild the site and prove the artifacts URL-only** before
   committing (shared-tree hygiene): a normalising node one-liner (rewrite
   every affected-host URL string to a constant, string-compare current
   artifact vs `git show HEAD:<artifact>`) proves index.html / feed.xml /
   the data asset / auspol-now.json carry ONLY the citation change — this
   guards against a sibling session's WIP gen-data.mjs leaking into your
   committed artifacts (gen-data went dirty DURING this session AFTER the
   rebuild; the artifacts stayed clean because they were built before).
5. **Re-run the sweep LAST.** The first re-sweep (launched before
   issues.mjs re-ran) ledgered the 3 stale post URLs under
   `fields:["issues.source"]` even though polls.json was already healed —
   entries gone only after a second full sweep. A transient `error 1`
   (unidentified host flakiness) also appeared between sweeps and
   SELF-CLEARED: confirm a single new error persists across a re-run
   before investigating it.
6. **Cosmetic redirects may be deliberately left.** The one Infogram
   `?src=embed` `moved` entry is a cosmetic redirect to a tokenised embed
   URL — the citation stays ON the post URL because the token target is
   more fragile than the redirect; named as intentional in the commit and
   reported so nobody "fixes" it later.

## The Wayback archiving pass (added 2026-10-09)

The watchdog gained its second half: detection AND a copy. After
classification lands, every ok/wall/moved entry without a `wayback` stamp
is submitted to `https://web.archive.org/save/<citation-url>`; a 2xx/3xx
earns `wayback: "YYYY-MM-DD"` on the ledger entry. The full contract lives
in `.build/citation-check-spec.md` ("The Wayback archiving pass"); the
hard-won points:

- **Off by default, on in CI only** (`CITATION_CHECK_WAYBACK=1` on the
  workflow step) — a manual sweep never fires 300 saves.
- **The stamp goes in the identity tuple**, so the weekly commit-on-change
  lands new stamps and quiet weeks stay byte-identical.
- **main() rebuilds every entry from scratch each run — any new per-entry
  ledger field must be explicitly carried off `base`.** `hops` already
  was; the first version of the save pass forgot to carry `wayback`, so
  nothing ever counted as saved and every living link was re-saved every
  run. `.build/test-wayback-save.mjs` (16 fixture assertions, a stub
  `/save/` server) pins the carry-forward with its pre-stamped case.
- Serves the ORIGINAL citation URL (Wayback follows today's redirects
  itself); save failures NEVER move exit classes; inconclusive sweeps
  fire none; budget-capped 30 min, resumable across runs — the mechanism
  is the backfill, so the ~300-URL day-one backlog retires over runs, and
  the workflow timeout went 25 → 75 min to fit sweep + pass.
- Known deliberate edge: living documents (Essential's shared disclosure
  PDF) are stamped once and never re-saved — the capture drifts behind
  the file; named in the spec as accepted.
- **Why the weekly sweep owns the firing, not the 13 house updaters:**
  single writer to link-health.json, no new shared-file push-race surface
  across the writer fleet, and the ~300-link backfill is just the first
  run — the cost is ≤7-day capture latency for a brand-new link (accepted;
  rot is slow, and a per-updater hook can sit on top later if same-day
  ever matters).

### First live run (2026-10-09 backfill, run 37929262631)

Day one's numbers looked alarming and were normal — pin them so nobody
"fixes" them: `wayback {"attempted":177,"saved":50,"failed":127,
"pending":143}` over 41 min (sweep ~22 min + the budgeted pass), the
run green, `LINK_STATUS` verdict 0, and exactly the 50 stamps landing in
the actions-bot commit (`085e9c2`). Reading the failure spread:

- **Failed saves spread across EVERY host** (roymorgan 21,
  theaustralian 12, smh 12, essential 12, news24 9, pyxis 7, afr 6 …) —
  both open and walled. Host-independent spread = Wayback SPN throttling
  back anonymous saves under concurrency 3, NOT content refusals, so no
  per-house rule tuning is warranted. A save failure retries next weekly
  run for free (the stamp never landed); only a host that keeps failing
  week after week is worth a look — single-run failures are noise.
- `pending 143` is the 30-min budget doing its job; "the mechanism is the
  backfill" — expect the day-one backlog to retire over 2–3 weekly runs.
- Verifying the run's commit when the LOCAL tree has sibling WIP:
  `git pull --rebase` is refused on unstaged changes. Skip the stash
  dance — the commit is already on origin, so verify read-only:
  `git fetch origin main`, then
  `git show origin/main:data/link-health.json | grep -c '"wayback"'`
  must equal the run's saved tally, and `git log origin/main -1` is the
  actions-bot commit. Only pull once local is clean again.
- Mid-run log greps show NOTHING: `gh run view --log` only publishes
  steps that have completed, and both sweep and save pass live inside
  the ONE "Run the citation sweep" step — a run can sit at in_progress
  for ~55 min with no visible output. Poll status, read the log after
  completion.

### Archive, don't host: the corpus measurement (2026-10-09)

The archiving choice was evidence-backed. Asked "what would self-hosting
the linked PDFs cost?", measured live: ~300 linked documents over 177 poll
rows (176 `url` / 41 `releaseUrl` / 82 `methodUrl` pre-dedupe; DemosAU's
releaseUrl mostly EQUALS its methodUrl). HEAD/GET-sampled real sizes per
house — Accent's monthly report PDFs are the whale at 10.9–41.3 MB each
(~32 MB mean × 15 ≈ 450 MB, ~75% of the corpus); DemosAU 1.3–3.9 MB;
everything methodological is small (YouGov APC 160–304 KB, Essential
265–374 KB, Pyxis Newspoll ~261 KB PDF or ~11 KB HTML-page links); HTML
release pages ~90–750 KB each. Corpus ≈ **600 MB**; laptop-side that's
~1.8 GB of transfer (download → push → second-clone pull) and ~2.4 GB of
disk across the two checkouts since PDFs don't compress in git. Wayback
SPN captures all of it for free, Accent monsters included — hence
archive-don't-host. **Recipe if the question returns:** enumerate link
fields out of data/polls.json with a node one-liner (group by pollster ×
field), curl `-sIL` HEAD content-length for each house's newest URLs
(pyxispolling's API doesn't honour HEAD — use a ranged GET instead;
usrfiles gives clean content-lengths), then mean × count per house.

## Related

- `auspol-site-check` — the sibling deployed-bytes watchdog; the two specs
  are cross-referenced siblings in `.build/`.
- `auspol-actions-data-pipeline`, `launchd-scheduled-data-pipeline` —
  scheduled-job conventions (cron identity, github-actions[bot] commits,
  `git pull --rebase` in-workflow).
