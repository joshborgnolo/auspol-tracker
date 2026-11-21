---
name: auspol-map-now-frame
description: /map/ "Now" frame machinery (2025 House + Farrer by-election overlay) and the assessed case for per-state Now overlays — read this before extending Now to a state frame (nsw etc.) or editing data-now.json
source: auto-skill
extracted_at: '2026-11-04T10:00:00.000Z'
---

# /map/ "Now" frame — how it works, and the per-state question

Mapped 2026-11-04 when the user asked "shouldn't there be a 'Now' view in map for
eg nsw and vic … may sa and qld too". The federal `now` frame is a hand-curated
overlay on the 2025 results.

**Update 2026-11-04 (commit d665011f): NSW's per-state Now now EXISTS.** `nswnow`
rides the 2023 Assembly with the four by-elections since polling day (Epping,
Hornsby, Pittwater — 19 Oct 2024; Kiama — 13 Sep 2025) and member moves. The
"NSW's as it stands" wiring committed by a sibling session: `YEARS` ends
`…,"sa26","nswnow","now"`; `NOW_OF = { now: 2025, nswnow: "nsw23" }`;
`NOW_DATA = { now: "data-now.json", nswnow: "data-now-nsw.json" }`; the
`isNow()` federal-only predicate was generalised to `isNowY(y)` across the app
(~36 renamed sites). Producer: `.build/map/build_nsw_now.py` +
`.build/harvest-nsw-byelections.py` (by-election venue grids committed under
`.build/state-flow-src/nsw/byelections/`). NSWEC publishes no count ladder, so
`fl` stays empty on by-election seats. Vic/SA/Qld per-state Nows remain
unshipped — the generalisation recipe this file describes laid down only the
NSW case so far.

## The federal Now frame, end-to-end

- `YEARS` in `.build/map/app/app-1-base.js` (~:441) ends with `"now"`;
  `YEAR_X.now = 2026.8`; `yearLabel("now")` = "Now". `prevYearOf("now")` → 2025.
- **Write side**: `build_map_data.py` `main()` (~:1001) builds `now = {asOf,
  changes, holders, byelections}` — hardcoded hand-curated entries — and writes
  `map/data/data-now.json`. `build_farrer(out[2025])` produces the Farrer block:
  a `deriveDiv`-shaped div record plus a per-booth record (`Bo`) whose `prev`
  is the index of the matching 2025 booth (for same-place swings), with
  `v/dec/demo/cob` rows absent (null). The by-election count comes from the AEC
  event download (`event: 31633`, see aec-event-downloads).
  `data-now.json` field shapes (2026-11-04, ~45 KB):
  - `asOf` date string — drove the old "as it stands, <date>" banner copy;
    since 2026-11-07 it is the STATE/now frames' banner date and the
    federal walk-preview fallback only (see Consumers below).
  - `changes[]` `{div, date, kind, who, from, to, text}` — kind seen: left /
    joined / resigned / by-election / founded. Story copy, AND the source of
    the federal banner's "last changed" date (the newest entry's date;
    currently 2026-06-25, the Community Strong "founded" pair).
  - `holders{}` seat → `{n, ab}` — **only seats whose holder differs from the
    2025 result** (applyNow rewrites `m.divs[i].hold` for each).
  - `byelections.Farrer` `{date, event, formal, informal, turnout, enrolment,
    div, booths}` — booth-level FULL replacement of the general-election count.
- **Read side**: `loadYear(year)` special-cases `"now"`: `ry = 2025`, fetches
  `core-2025.json` + `data-now.json` + `seats-now.json` (SEATED includes "now"),
  then `applyNow(m, now)` (~:1221):
  - `deriveDiv(by.div, fi, "now")` replaces Farrer's div record, stamps
    `D.by = {...prev: m.divs[fi]}` and `D.change = {kind:"by", prev}`.
  - Appends by-election booths to `m.res.booths` (old Farrer booths removed),
    with `prevFp` = the 2025 same-place shares mapped into FAM space
    (`fams25[c[3]]`) for swing lenses. Since bc1dcddd (2026-11-06) every
    BASE federal frame ≥2007 carries its own `booths.prevFp` lane (same
    shape — see the prevfp-lane skill), and `applyNow` keeps those earlier
    districts' rows and appends its own (`nb.prevFp = keep.map(hadFp...)
    .concat(prevFp)`); the overlay no longer monopolises the read.
  - Each `now.holders` seat gets `hold` rewritten (member/party/fam).
  - `m.changes = now.changes; m.asOf = now.asOf`.
- **Consumers of the now-ness** (all keyed off `S.year === "now"` or `m.year`):
  the eyebrow meta line in `metaLine()` (app-6-ui.js ~:1086-1092): federal now
  → "The current House of Representatives, last changed <max changes[].date> ·
  N polling places" (user call 2026-11-07, 7b48c367 — the ISO date strings sort,
  so a reduce over `m.changes` finds the newest), state nows keep "The
  Legislative Assembly as it stands, <asOf>", election frames always keep
  "The `<year>` federal election, <date> · …". metaLine is ALSO called by
  holdEyebrow (~:1101) with a FABRICATED m (`{year, date: f[0], asOf: f[0],
  divs:{length}, booth:{n}}` from META_FACTS) for unloaded frames — any
  overlay-field read in a metaLine branch MUST degrade
  (`(m.changes || []).reduce(…) || m.asOf`), or the walk-preview crashes;
  search labels "Member" vs "Elected" (buildSearch);
  `yearWhen("now")` = "The House today" (timeline tooltip); `isNow()` helper
  (app-1-base.js:774, used sparingly). `YEARS_FED = YEARS.filter(y =>
  !STATE_YEARS.has(y))` — "now" counts as federal there.
- Count before extending: `"now"` appears as ~68 literals across 5 app files
  (app-4-story 25, app-1-base 15, app-6-ui 12, app-7-full 7, app-3b-senate 6)
  — most are neutral (`performance.now()`, comments, `nowFrame`-style copies)
  but every `=== "now"` / `!== "now"` predicate is a potential fork a state-Now
  key must consciously join or skip. There is no `isNowMsOrState()` predicate
  yet — adding one is the cheap way to keep story/copy forks working.
- **Cache bust**: `data-stamp.mjs` covers `data-now.json`; `assemble.mjs`
  warm-script regex `/^(res-\w+|core-\w+|geo-\w+-lo)\.json$/ || data-now.json ||
  islands.json` prefetches it when `#y=now`.
- **"How votes were cast"** (2026-11-07, f4d52c49): Now shows 2025's BAND
  CHART, not the old stacked table — `vtBlock` and storyArea's `castScope`
  gates (app-4-story.js +883/+921) each test `=== 2025 || === "now"`. The
  area pool reads `m.res.divs`, which applyNow never rewrites (it replaces
  the DERIVED div — `D.vt = null` — and appends `m.res.booths` only), so the
  block stays the election's, Farrer's election-day count included
  (15,490,236 formal), flagged by storyArea's "…the base election's" note;
  a by-election seat's detail renders no block at all. The vt/vt2 lane,
  its producer and the adapt-here pins: auto-skill-auspol-map-vote-type-panel.

## Per-state Now — the assessment record (user decision PENDING)

State facts verified 2026-11-04 (web: ABC election pages, VEC/ECQ lists, wiki):

- **NSW (base nsw23, sits to Mar 2027)**: composition genuinely changed —
  Pittwater IND gain from LIB (Oct-2024 super-Saturday; Epping and Hornsby
  LIB holds with new members) and Kiama ALP gain from IND (13 Sep 2025, after
  Gareth Ward's resignation). **The case for a Now overlay.**
- **Vic (base vic22)**: three by-elections (Warrandyte Aug 2023, Mulgrave Nov
  2023, Werribee Feb 2025) ALL same-party holds — composition unchanged, only
  member names. AND the election is 28 Nov 2026 (24 days out at review time) —
  a vic-Now overlay is stillborn; the vic26 frame supersedes it. **Skip.**
- **Qld (base qld24)**: only Gympie (Perrett resignation, Mar 2025) known;
  LNP held — composition unchanged. At most a members-overlay; verify the
  winner from ECQ before trusting memory. **Hold.**
- **SA**: `sa26` frame IS the current parliament (Mar 2026 election). **Ignore.**

My 2026-11-04 recommendation (user not yet confirmed): build NSW Now only.

**Update 2026-11-05 (commit 88dc0644): WA's per-state Now now EXISTS too** —
and with it, the first overlay whose by-election rides **WAEC's own EIS
ByElections API** rather than a page-HTML harvest. `wanow` rides the 2025
Assembly with Paul Papalia's retirement (announced 6 Jul 2026) and Luke
Herdegen's 29 Aug 2026 Secret Harbour gain for One Nation (their first WA
lower-house seat). Same-day sibling: `qldnow` landed a few hours earlier
(commit 7ae22999, Hinchinbrook + Stafford by-elections by build_qld_now.py
off the ECQ VRS media feed).

## The EIS ByElections API (one family under the SGE one)

- Catalogue: `https://eis.waec.wa.gov.au/api/ByElections` (14 events since
  2001; the newest 2026 Secret Harbour By-Election).
- An event's bundle is the DASHED name:
  `GET /api/ByElections/2026-Secret-Harbour-By-Election/overview` — note the
  raw-space form is ALSO accepted for lists but the app uses the dashed one.
  Everything an overlay block needs rides one JSON (198 KB, same families as
  the SGE district payloads): `ElectionEvent` card (date), `toptotals`
  (enrolled/FORMAL/INFORMAL_…), `districtCandidates` (16 × `BALLOT_PAPER_NAME`
  = "HERDEGEN, Luke" **plus long party names** — pn joins verbatim by surname
  to resultsCandidates' short codes), `resultsCandidates` (SGE-style short
  codes + votes), `results2CP` (2 rows), `resultsPollingPlace` (14 rows: 4
  Count-Centre pseudos, "Mobile Polling", 9 real venues at full FP per-candidate
  columns), `districtPollingPlaces / earlyPollingPlaces / earlyPollingPlacesOther`
  (venue registers **with LATITUDE/LONGITUDE** — the overlay's booths never
  ride the base frame's placemarks; 2023-redistribution-era Secret Harbour's
  EPP is brand-new, and Madora Bay Community Hall lapsed),
  `resultsNotional`, `resultsFullDistribution`.
- Payload quirks follow the SGE family: UTF-8 BOM (`utf-8-sig`), pseudo-rule
  `BREAKDOWN_GROUP == "Count Centre"` + "Mobile Polling" (2026's era form —
  no `Special Institutions…` row here), per-row `Σcand == Total − Informal`,
  column headings strip apostrophes anywhere.
- By-election drupal export (`/rest/export/json/by-election-content?title=…`)
  returns `[]` for everything — dead endpoint; don't chase it.

## Producer + wiring specifics that applied this land

- Scripts: `.build/map/harvest-wa-byelections.py` (catalogue + dashed-overview
  mirrors under `.build/state-flow-src/wa/byelections/<slug>/overview.json`,
  fail-loud guards) and `.build/map/build_wa_now.py` (producer →
  `map/data/data-now-wa.json`).
- **`asOf` is ISO `YYYY-MM-DD`** (longDate splits it; a "5 November 2026"
  long string renders "…stands, undefined undefined" — checked in-page).
- The chamber oracle is fam-space, not code-space: base wa25 `{ALP 46·LIB 7·NATS 6}`
  folds to `{alp 45, lnp 13, onp 1}` — write `EXPECTED_CHAMBER` in fam vocab
  when asserting. Winner codes stay the election body's (`PHON`): `bucket()`
  is where fam happens; the holder `ab: "ONP"` works because FAM maps it.
- NOW_OF/NOW_DATA live in **four homes** (app-1-base.js, `.build/map/assemble.mjs`
  warm-script literal, `.build/map/data-stamp.mjs` metaFacts, plus the
  producer-side knowledge) — touch all four in one land; test-map-page's
  NOW_OF literal pin gained the wa form the same day (`SEN_YEARS` exclusion
  predicates etc. follow the auspol-map-new-state-frames refresh recipe).
- wanow's own constants: `YEAR_JUR.wanow="wa"`, `WA_YEARS∋wanow`,
  `FRAME_YEAR.wanow=2026`, `YEAR_X.wanow=2026.84`, `GOV/PM` carried from
  wa25, `PREV_YEAR: 2021`, `SPEAKER_DIV: Forrestfield` (base speaker), decade
  timeline row = the WA one (row 5).
- Banner sanity check: "The Legislative Assembly as it stands, 5 November
  2026 · 744 polling places" — 743 base − 9 lapsed/base-replaced Secret
  Harbour rows + 10 new stalls = 744. The overlay audit probe
  (.matilda/probe/map-wa-frames.mjs) asserts the holder + fam + by-window.
