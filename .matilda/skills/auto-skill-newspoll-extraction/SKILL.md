---
name: newspoll-extraction
description: Extract Newspoll releases from free secondary coverage into data/polls.json — Bing News RSS discovery with apiclick URL decode + publisher-of-record topic-page (theaustralian.com.au/topics/newspoll, NEWSIE_CHROME-only, titles+links never figures), MSN content-view JSON for full text + publisher provenance unroll, The Australian no-cookies-wall detection + ausUrl link recovery + NEWSIE_CHROME=1 last-resort read of the user's logged-in Chrome (NOT rank-0; live-article prose mis-parses), roundup-contamination filtering (OTHER_FIRM + dropForeign firm-block state machine), respectively-positional VI pairing, dual preferred-PM formats (three-way row + head-to-head in extra) and enumeration-tail rejection, Hanson approval detail (hanApp/hanDis), canonical ind/oth + firm/pollster key conventions (.build/extract-newspoll.mjs).
source: auto-skill
extracted_at: '2026-08-29T05:54:58.122Z'
---

# Newspoll extraction via free coverage (Bing/MSN → polls.json)

Built 2026-08-29; topic-page discovery layer added 2026-08-30. Run:
`node .build/extract-newspoll.mjs [--check]`. The Australian (Newspoll's
publisher of record) is paywalled AND bot-walled for us — the extractor discovers and parses
**free secondary coverage** (news.com.au / Sky-ex-News24 / The Conversation / The Nightly via
MSN syndication), plus the publisher's own topic page for DISCOVERY ONLY (titles+links),
and recovers canonical theaustralian.com links where identifiable.

## The Infogram rung (added 2026-08-31) — rank −1 structured publisher data

Newspoll's charts are Infogram projects served ANONYMOUSLY (no cookies/login/Chrome). Two
surfaces, module `.build/infogram.mjs` (self-test: `node .build/test-infogram.mjs` —
the `.build/newspoll-src/infogram-*2026-08*` fixtures are the oracle, hand-verified at
introduction; its static fixture is the full embed page of the 2026-08-28 wave):

- **Rung A — live project**, stable slug `infogram.com/federal-newspoll-regular-1h7v4pdj7oj184k`:
  read `window.infographicData` (brace-match from the first `{` — a lazy `};</script>` regex
  misses the close), walk to the four `live` charts ({title,key}), resolve feeds by TITLE
  (keys rotate — never hardcode), fetch `live-data.jifo.co/<key>` (CDN; the sibling
  `/api/v1/atlas/getLiveData` 401s anonymously). Gives the current wave's primaries, better-PM,
  tpp (all "N/A" → null; a numeric pair would be a real resumption, surfaced in NP_STATUS),
  and a 55+ point PM **netsat archive back to 2022** used for READ-ONLY reconciliation against
  `approval[]` (pair on fieldwork-end ±IG_DAY_WINDOW, ALB within 0.5 pp; divergences print
  `NP_NOTE`, never write). Attach rule: chart label is a PUBLICATION date, so attach to the
  latest fieldwork-end within 0–5 d, requiring the prose ALP (when present) to agree with the
  chart's within 0.5 pp — else `live:"unattached"`. Year comes from the feed's `refreshed`
  timestamp, never the wall clock.
- **Rung B — per-wave static embeds** (`div.infogram-embed[data-id]` in the rendered article,
  caps 6, needs NEWSIE_CHROME like the rest of rung B's DOM): fetch each
  `e.infogram.com/<id>?src=embed`, values sit INLINE at `chartData.data` (`{value:"47%"}`
  cells — so the live CDN path is not needed here). Yields Hanson's 4-wave satisfaction table
  (with TRUE fieldwork window, e.g. "August 24-28"), the three-way "Ranked 1st PM", and the
  ALB–Hanson distributed pair → queues `ppmHeadToHead`. Live projects riding an old article
  are detected and skipped (`live-skip`).

**Governing trap: embeds are NOT pinned to their article.** The Australian republishes the same
project each wave, so an old story's charts roll forward — date figures ONLY from chart labels,
never from the hosting story. Embed records merge as rank −1 (they outrank prose, rank 0 =
walled theaustralian.com) but are excluded from provenance picks (`cl.find((c) => !c.embed)`)
so row `url`/`client` still come from a real article when one exists; if an embed is the only
record, the cluster comes from rung B (NEWSIE_CHROME) anyway. Full spec:
`.build/newspoll-infogram-rung.md`.

Netsat reconciliation (READ-ONLY, reported in `NP_STATUS.embed.recon`). When tracker and feed
figures disagree, adjudicate against the PUBLISHED RELEASE — inter-wave deltas
("slumped N points to −X") cross-check a single scraped figure. 2026-08-31 adjudication of the
three initial divergences (Conversation + archive copies): Infogram correct on 2025-10-02
(−20) and 2026-06-04 (Taylor −10) → tracker rows corrected/filled; tracker correct on
2026-02-08 (−39; the −35 is a The Nightly misprint + the chart inherited it) → kept. The
2026-02-08 divergence is PERMANENT chart error (`infographicData` is a mutable chart, not the
release) and will keep printing NP_NOTE every run — expect recon ≈ 15/16 exact with that one
divergence and do not re-adjudicate.

Regression note: this skill suite ran fully green 2026-08-31 — `test-infogram.mjs` ALL PASS,
extract `--check` exit 0 (`changed:false`, recon 15/16 exact — one permanent chart error),
polls.json byte-identical across the extractor run, validate.mjs errors 0. A static-nesting
bug (sheet is `data[0]`, not `data[0][0]`) initially made the rung silently return
`live-skip` on every static page — if rung B ever reports nothing for a wave, re-check
`staticChartsOf` against a fresh fixture first.

## The release watchdog on CI (added 2026-09-01)

`.build/check-newspoll-release.mjs` + `.github/workflows/newspoll-watch.yml`. The extractor
itself cannot run on CI (paywall + rung B needs the user's Chrome), but **rung A can**: the
live project is addressed by a stable slug, so it needs no article, no cookies and no Chrome.
CI therefore detects a published wave days before free coverage clusters — the 2026-08-28 wave
sat as a candidate for four days and landed manually.

Convention: like coverage-check, **the job's failure IS the message** (exit 1 → GitHub
notification email); last stdout line is `NP_WATCH {json}`.

- **Detects only, never writes.** The live project rolls forward and its label is a
  PUBLICATION date; a writer would reintroduce exactly the dating trap rung A exists to avoid.
  Figures still land through the extractor and its guards.
- **The window is the whole trick.** "Label newer than canon" is a FALSE POSITIVE for the wave
  already recorded — the 2026-08-30 label belongs to the 2026-08-28 row. Fire only when the
  label is beyond `latest + IG_DAY_WINDOW` (5 d). Verified 2026-09-01: quiet against real canon
  (`state:"current"`, threshold 2026-09-02), fires with correct figures (29/19/30/13/9, ppm
  44/35, nets −21/−17) against a canon copy with the 2026-08-28 wave stripped.
- `state:"unavailable"` (CDN blip) exits 0 — a watchdog that cries wolf gets muted. Only
  `guard` (structure changed) and `release` exit 1.
- A 2PP resumption is REPORTED in the alert but is not an independent fire condition, or the
  watchdog would stay permanently red until canon modelled it.
- The alert prompts the operator to settle the rung-B open question (refetch
  `8b461452-…` — if it serves the new wave, rung B is article-free too), so that question
  resolves itself the next time a wave lands.

## The automation contract (mirrors all sibling extractors)

Exit 0 ok / 1 fetch-parse error / 2 guard trip; last stdout line `NP_STATUS {json}`; atomic
`OUT+".tmp"`+rename writes; no-change writes nothing; `--check` mutates nothing and reports
`changed:false` + `skipped_existing`. Guard trips print `NP_GUARD ...` to stderr and write
nothing. See resolve-monitor-extraction skill for the full contract rationale.

## Discovery: Bing News RSS, not a search API

- Feed: `https://www.bing.com/news/search?q=newspoll&format=rss&mkt=en-AU`. Item titles are
  prose candidates; item `link` is `bing.com/news/apiclick.aspx?...&url=<encoded publisher>` —
  decode in-process with `URLSearchParams` (regex must be `\bbing` word-bounded, not a bare
  substring, or publisher hosts containing "bing" corrupt the match).
- Undated or stale items: pre-filter `pubIso < latestNewspollDate` → skip; undated items attach
  to a clustered release only when exactly one cluster sits within a 0–10 d window (unique match
  only — ambiguity must not force a date).

## Discovery rung 2: the publisher-of-record topic page (titles+links ONLY)

Added 2026-08-30 per user: Newspoll releases appear on
`https://www.theaustralian.com.au/topics/newspoll` with headlines beginning `Newspoll:`.
`discover()` ingests them via `topicHtml()`:

- **Wall behaviour**: plain fetch returns the 200 "No Cookies" challenge (detect
  `<title>no cookies`), so the rendered read falls back to the same NEWSIE_CHROME=1
  `.build/chrome-article.mjs` rung article fetches use. With the env var unset `topicHtml()`
  returns null and discovery is Bing-only — **launchd runs never get this layer**; it's
  interactive-only by construction. Verify this by diffing `NP_STATUS` of a default `--check`
  against `git show HEAD:...` output — they must be byte-identical.
- **Tile shape**: `<h3><a href="https://www.theaustralian.com.au/.../news-story/<hex>">
  HEADLINE</a></h3>`; keep only titles matching `^newspoll:` (i.e. release + release-adjacent
  headlines; the stream also mixes state polls, commentary, issue stories).
- **TITLES AND LINKS ONLY — NEVER FIGURES from tiles** (the 1c5c3ea incident, reverted
  f14a46f): topic tiles can be STALE and mix waves; transcribing a satisfaction split off a
  stale tile once poisoned the 2026-08-07 approval row. Candidates enter `discover()`'s
  `out` list with `pubIso: null` and go through the full fetch→parse→guard pipeline like any
  Bing candidate; figures only ever come from fetched article text.
- Issue stories that pass the `^newspoll:` gate (e.g. "Newspoll: Left-leaning voters not so
  spooked on China threat") are harmless: they fetch, find no VI table, never form a cluster,
  exit cleanly. Verified 2026-08-30 live: `NEWSIE_CHROME=1 --check` yielded 3 topic headlines,
  both federal releases dated to already-recorded waves (2026-07-16, 2026-08-07) →
  `changed:false`, exit 0.
- Honour-system interplay: an undated topic candidate attaches to a cluster via the same
  unique-0–10d rule, and the `failedAus`/ausUrl provenance (written when exactly one walled
  theaustralian.com URL falls in the release window) picks these up automatically since they
  are theaustralian.com links.

## Body fetch: MSN content-view JSON > MSN HTML, and the no-cookies wall

- MSN HTML pages are JS shells. The real body is
  `https://assets.msn.com/content/view/v2/Detail/{locale}/{id}?disableEdgeCache=true`
  (id from the `/ar-{id}` URL segment; lowercase locale like `en-au` works). Returns the full
  figure-bearing article text plus provenance: `provider.name`, `provider.companyLegalName`,
  and `sourceHref` (the aggregated outlet's canonical link).
- **Provenance unroll**: row `client`/`url` must come from `provider.name`/`sourceHref`, never
  the literal "MSN" or the msn.com URL. Observed provider names: `NewsWire`, `News24`
  (ex-Sky-Australia brand on MSN), `The Conversation`. Canonical polls.json uses the
  publisher-of-record; these coverage names are a documented, accepted shim.
- **The Australian bot wall** returns HTTP **200** with a "No Cookies" challenge page —
  status-code checks pass silently, so detect by `<title>no cookies` in the body and fall back
  (archive.md `/newest`). An archive.md snapshot whose title still says "no cookies" counts
  as unusable. Keep a `failedAus` list of walled theaustralian.com URLs + their
  pubDates; at cluster write-time, if exactly one falls in the release window
  (`pubIso >= fieldworkEnd`, lag ≤ 10 d), write it as the row `url` (`ausUrl`) — this is how
  canonical rows carry theaustralian.com links without ever fetching the page.
- **Third fallback rung — NEWSIE_CHROME=1 (added 2026-08-29, see chrome-session-piggyback
  skill)**: when archive.md is down, `.build/chrome-article.mjs` drives the user's logged-in
  Chrome (AppleScript) and returns the rendered paywalled page. Strictly opt-in and LAST —
  launchd never sets the env var (GUI Automation consent), and a fetched page is parsed by the
  same pipeline, not trusted blindly.
  **Do NOT promote Chrome to rank-0 / parse-first**: verified 2026-08-29 that the full
  paywalled article prose mis-parses through the coverage-tuned pipeline —
  historical-aside sentences poison figure picks (2026-08-09 wave: real 29/18/29/14/10 parsed
  as alp 29 lnp 18 onp 15 grn 12 ind null, phantom tpp 37/63, pmNet −3 borrowed from
  Hanson's "minus-3", "others bucket" missing). Even a clean `<p>`-only reprojection of the
  DOM parses identically-wrong — it's the article's own text (e.g. "One Nation, which fell a
  point to 29 per cent" sits one sentence from "The Greens' primary vote increased from 12 per
  cent to 14 per cent", and last-year recap sentences quote 2PP 58/42), not DOM cruft.
  Merge-layer safeguards that keep this safe when Chrome IS used: same-field cross-source
  disagreement > 0.5 pp is a cluster guard failure (loud, exit 2), and already-recorded dates
  land in `skipped_existing` — observed end-to-end: NEWSIE_CHROME=1 `--check` with the live
  paywalled story yielded `changed:false`, no write.

## Prose parsing: roundup contamination is the main enemy

Columnists (esp. The Conversation) write **multi-poll roundups** — one article quotes Newspoll,
state Redbridge/Freshwater, Essential, etc. Unscoped regexes over the full text yield another
firm's figures (observed: 2PP 57/43 planted from a Redbridge error-correction paragraph).

Working order of operations:
1. Sentence-split, then run `dropForeign(sentences)`: the OTHER_FIRM regex
   (redbridge|freshwater|essential (poll|report|media)|roy morgan|\bmorgan\b|resolve
   (poll|strategic)|demosau|yougov|ucomms|jws|accent research) still matches by sentence,
   but since the 2026-08-30 roundup it opens a STATE MACHINE — once a rival firm is named,
   drop sentences until one re-anchors on "Newspoll". Dropping only the naming sentence is
   NOT enough: The Australian quoted RedBridge's three-way PPM ("In a three-way preferred
   PM question, Albanese had 31%…") in sentences that never re-name the firm, right under a
   "Redbridge and Accent Research poll" intro. Run ALL whole-text fallbacks
   (fieldwork window, "Mon–Fri" relative window, sample regex) on the filtered text `tNP`,
   never the raw text.
2. **"respectively" chains pair positionally** (`respectivelyMap`): "core support for the
   Greens and Others fell to 13% and 9% respectively" maps entities to figures IN ORDER
   (Greens→13, Others→9). A naive forward regex assigns the FIRST figure to every named
   party — the 2026-08-28 wave read ind as 13 (the Greens' figure). Only the clause before
   "respectively" pairs (the sentence can run on into other questions' numbers); these
   positional pairs OVERRIDE the regex grabs for alp/lnp/onp/grn/ind.
3. **2PP scope excludes pairwise matchups**: Newspoll now reports an ALP–One Nation preference
   figure ("Albanese led Hanson by 56–44 after preferences") — that is NOT the Coalition 2PP the
   tracker models. Filter `hanson|one nation` sentences from `tppScope`.
4. **Dual preferred-PM formats since mid-2026** — a release prints BOTH a head-to-head
   ("Albanese leads the Opposition Leader … by a margin of 44% to 35%") AND a three-way
   ("Mr Albanese leads with 46% of support, ahead of Senator Hanson on 31% and Mr Taylor on
   23%"). Capture them separately: head-to-head → `ppmA/ppmO` (ownership fill for the
   unnamed-leader margin phrasing is ARMED only when the sentence lacks "Hanson", else
   Hanson gets mis-cast as the OL); three-way → `ppm3A/ppm3H/ppm3O` via the
   albanese-leads-with / hanson-on / OL-on tri-regex. Canonical rows pack **three-way in
   ppm.alb/opp/han and the head-to-head pair in ppm.extra=[{alb,opp}]**. The ppm-sum guard
   sums ONE consistent set (three-way if captured else the classic pair) — mixing both
   double-counts ppmH. Old traps that still apply: enumeration-tail rejection tests
   `s.slice(m.index, m.index + 100)`, not `m[0]` (v1's 46/46 ppm); bare-pair regex needs
   era-dynamic surnames; `pairOf` keeps its `(?<!dis)` lookbehind.
5. Leadership nets AND Hanson approval: `hanNet = netOf(leadScope(/\bhanson\b/i))` and the
   `hanApp/hanDis` pairOf fields (FIELDS list carries them — Hanson's approve/disapprove
   sentence, e.g. 47/48, sits among the leader ratings). Leader-era table assigns
   oppName by fieldwork-end date — Dutton ≤ 2025-05-12, Ley 2025-05-13..2026-02-08, Taylor from
   2026-02-09. Guard includes a leader-era mismatch trip.

## Guards (any trip → NP_GUARD, exit 2, nothing written)

Primaries Σ ~100; tpp Σ ~100; ppm bounds incl. `ppmH` 5–70; **ppm tie rejection** (`ppmA ===
ppmO` → parse suspect); ppm Σ ≤ 100.5 across all three parts; leader nets −80..80 incl. hanNet;
field span 1–7 d; release lag 0–10 d; sample 800–3000.

## Canonical polls.json conventions (Newspoll-specific, verified against 16 rows)

- `polls` rows key on `pollster`, but `ppm`/`approval` rows key on `firm` — a strip/test filter
  using the wrong key silently under-matches.
- Newspoll ALWAYS buckets others+independents into `ind` (16/16 rows), `oth` is always null:
  when coverage states only one of the two, write it as `ind`, never `oth`.
- Cite ALL cluster sources into provenance; row `client` = unrolled provider; `url` = `ausUrl`
  ?? best coverage URL. All canonical Newspoll rows carry a `url`.
- `published` (embargo datetime) exists on 9/16 canonical rows at hour precision (varies
  19:00–21:00) but coverage timestamps are date-only → leave unset; do NOT fabricate precision.
- `ppm.extra` = null from coverage; the pairwise Albanese–Hanson preferred-PM figure (e.g.
  44/37) only exists in paywalled primary data — accepted gap, not a parse bug.
- The **ALB–Hanson pairwise (after-preferences)** figure (e.g. 56/44) has its OWN top-level
  polls.json section `ppmHeadToHead` (`{date, firm, alb, han}`) — rows are sorted-inserted by
  date (validate.mjs enforces per-section date order). Since 2026-08-31 the Infogram rung
  (below) QUEUES this row from the static distributed chart when it isn't already recorded;
  before that they were inserted manually (2026-08-07 and 2026-08-28). If your ingest brief
  includes an "Albanese led Hanson by X–Y after preferences" number, check it lands there.

## Verification recipe

- Oracle fixture: `--file /tmp/np-tnightly.html --pubdate 2025-09-11` prints `{figures}` as JSON
  — assert against the 2025-09-11 hand-verified oracle (alp 36 lnp 27 onp 10 grn 13 ind 14 tpp
  58/42, dateStart 2025-09-08, oppSurname ley, oppNet −17, oppDis 49).
- E2E sandbox: copy data/polls.json to `/tmp/np-e2e/data/`, strip the target release's three
  canonical rows (remember the pollster-vs-firm key difference), `mkdir -p` before writing
  (reset script once ENOENT'd on `rm`+write without mkdir), run the extractor from that cwd,
  then field-diff the written rows vs canonical.
- Known-acceptable diffs on diff-clean runs: `client` (NewsWire/News24 vs The Australian),
  `ppm.extra` (null vs pairwise), `published` (absent). Anything else is a parser regression.
- Finish with live `--check` in the repo (expect `changed:false`, exit 0, file untouched) and
  `node .build/newtracker/validate.mjs` (expect errors 0).
- When editing discovery: prove the default path is untouched by diffing the `NP_STATUS` line
  of a `NEWSIE_CHROME`-unset `--check` run against `node /tmp/<git-show-HEAD-copy>.mjs --check`
  — must be byte-identical. If the `--file` oracle fixture has been cleaned from /tmp, note
  that `--file` mode bypasses `discover()` entirely, so discovery-only edits don't need it.
- Status-line display path gotcha (bit us in final verification): `status.added` must print the
  UNROLLED `best.client` (MSN provider name), not `best.src.client` (the raw RSS source — showed
  "MSN" as client). When touching the provenance unroll, grep for every `src.client`/`src.url`
  consumer and unroll each one.
- Suite ran fully green 2026-08-29 on the final build: oracle PASS, sandbox rows diff-clean vs
  canonical except the three known-acceptable diffs, live `--check` `changed:false` on
  2026-08-07, validator 0 errors. Sandbox strip filter had to split keys
  (`polls` → `r.pollster`, `ppm`/`approval` → `r.firm`) or it silently under-matches.
