---
name: auspol-aec-count-timing-statements
description: auspol-tracker — when you need a citable AEC statement on what is counted WHEN (election-night count sequencing, first-result times) for a specific federal election 2010–2025. Verified live media-release links per election, the AEC media-archive URL anatomy (incl. its HTTP-200 soft-404 trap), and the era pattern (clock-time pairings exist only from 2025).
source: auto-skill
extracted_at: '2026-11-09T06:48:23.793Z'
---

# AEC election-night count-timing statements, 2010–2025

Verified 2026-11-09 for a user request ("find AEC statements about vote/count
release times for 2022, 2019, 2016, 2013, 2010"); fed by the /map/ "How votes
were cast" panel (see `auspol-map-vote-type-panel`, whose 2025 band labels
trace to the 2025 release below). EVERY link below was fetched and read this
session — all still live on aec.gov.au.

## Verified per-election statements (all live)

- **2025** — "Federal election counting 101: How does it work?" (30 Apr 2025),
  https://www.aec.gov.au/media/2025/04-30a.htm. THE ONLY clock-time statement
  found in any year: count starts 6pm local; smaller polling places "from
  around 7pm", mid-large 8–8:30pm; pre-poll counts "from around 9:30pm"; and
  ~2,000 postal votes per division ALSO counted on election night (first
  federal election to do so; postal results displayed "from around 9:30pm"),
  with postal receipts open 13 days. This is the source of the map's
  VT_BANDS labels: on-day ≈ 7pm, early-centre + postal ≈ 9:30pm — the user
  once restated that pairing INVERTED in a request, so re-verify against
  the release before changing the labels.
- **2022** — "Media advisory: Tonight's count" (21 May 2022),
  https://www.aec.gov.au/media/2022/05-21a.htm. Results on the Tally Room
  from after 6pm AEST; all election-day votes AND the majority of pre-poll
  counted tonight, "large pre-poll counts … not available until late in the
  night"; NO postal votes count tonight — first small postal counts from
  Sunday afternoon (earlier than previously, when postal counts began
  Tuesday); all counting ceases at midnight local.
- **2019** — no clock-time advisory existed. Closest:
  /media/media-releases/2019/05-20.htm (updated 19 May 2019): >20 million
  ballots counted from 6pm including >90% of in-division pre-poll;
  declaration votes sorted/transported Sunday, counted through the week —
  plus /media/media-releases/2019/05-22.htm (1.2m declaration votes join
  counts) and …/05-21.htm (central Senate scrutiny starts 21 May). The
  pre-election delay warning (record pre-poll threatens the night) survives
  in quote form only, ABC News 15 May 2019 (Rogers: "there may well be some
  delays on the night").
- **2016** — "AEC media statement: counting" (3 Jul 2016),
  /media/media-releases/2016/07-03e.htm: >11m HoR votes counted on the
  night (polling places + early centres, Senate first prefs too); Sunday =
  declaration-vote exchange; postal verification Monday, postal COUNTING
  from Tuesday — /media/media-releases/2016/07-05e.htm (results published
  progressively from mid-afternoon Tue); remaining pre-poll ordinary counts
  from Monday; 13-day postal window; …/07-09e.htm covers the weekend.
- **2013** — "Services and information for election day" (6 Sep 2013),
  /media/media-releases/2013/e09-06.htm: VTR live from ~5pm AEST, FIRST
  results "from about 6:30pm (AEST)", constantly updated, no new night
  results after 2am; count priority HoR first prefs → HoR TCP → Senate
  first prefs. /media/media-releases/2013/e09-05a.htm adds the largest
  centres' Senate count "may be finalised on Sunday".
- **2010** — "Counting the votes, 2010 federal election" (updated 30 Nov
  2010, LIVE), /media/media-releases/e2010/counting-the-votes.htm: ordinary
  votes (~85%, incl. — for the first time — pre-poll cast inside the
  voter's own division) counted on election night; declaration votes
  (postal/absent/provisional/out-of-division) counted in AEC offices in the
  following days; postal receipts open 13 days; fresh count afterwards.
- Standing explainer: https://www.aec.gov.au/Voting/counting/election_night.htm
  (updated 9 Feb 2011) — the whole-framework description applying from 2010
  on (ordinary-only on the night; HoR prefs → TCP → Senate prefs).

## Era pattern (established across the releases above)

Per-band clock times are a 2025 NOVELTY. 2010–2022 statements give sequencing
only (ordinary on the night, declaration votes after), with one 2013-unique
detail (first results ~6:30pm). Postal first count: 2010–2016 following days
(Tuesday in 2016), 2022 Sunday afternoon, 2025 election night itself.

## AEC media-archive URL anatomy (verified this session)

- RECENT years live at `/media/YYYY/` with date-keyed files
  (`/media/2022/05-21a.htm`, `/media/2025/04-30a.htm`).
- HISTORICAL years (≤2019) live at `/media/media-releases/YYYY/index.htm`
  (verified 2013, 2016, 2019; sidebar lists 2008–2019) with the same
  date-keyed names; election-period releases carry an `e` in the filename
  (2013: `e09-06.htm`, `e08-20a.htm`; 2016: `07-03e.htm`, `08a-04e.htm`).
- 2010's election-time releases sit in their own directory,
  `/media/media-releases/e2010/` — `counting-the-votes.htm` is live there.
- Stable entry point when filename guesses fail: the historical hub
  `/Elections/Federal_Elections/YYYY/` has a "Media → Media releases /
  Media key facts and figures" link to the correct index.
- SOFT-404 TRAP: aec.gov.au answers missing media URLs with HTTP **200**
  and a page titled "404 - Sauce not found". Probe the `<title>`, never
  the status code (a whole probe run read as "200 OK" while returning
  nothing).
- `/media/YYYY/` for a historical year is one such soft-404 (the 2022 and
  2025 indexes exist; 2019/2016/2013 do not — the right path is
  `/media/media-releases/YYYY/`). Don't conclude a release was deleted
  until you've tried the media-releases path.
- Tally-room archive `results.aec.gov.au/<event>/website/` is live for
  15508 (2010), 17496 (2013), 20499 (2016), 24310 (2019), 27966 (2022) —
  results menus/House defaults only; it carries NO count-timing
  explainers, so timings must come from the media releases above.
- Wayback CDX intermittently answers mid-session with an "Internet
  Archive: Temporarily Offline" HTML page — it resolved after a wait and
  ultimately wasn't needed, since everything above is live.

## Reading the pages

Body extraction one-liner used: strip scripts/styles/tags, split to lines,
start printing from the line `Updated:` — the release body sits right after
it, past the nav boilerplate. For release indexes, anchor regex
`href="...htm"` on the page text works; the same index page holds every
year in its sidebar, so one fetch per year suffices.
