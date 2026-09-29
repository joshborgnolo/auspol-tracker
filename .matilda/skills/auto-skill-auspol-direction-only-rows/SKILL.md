---
name: auspol-direction-only-rows
description: "auspol-tracker — the All-polls Direction facet's direction-only rows (SEC Newgate's waves + Essential's three 2025 national-mood-only waves, shipped 2026-09-29): extract-secnewgate files sample+url+published in the direction row (Essential's assimilator heals url/published onto all its direction rows), gen-data emits directionOnlyPolls (sample carried over from the VI join or the house's own n, dir.eff footprint) + directionPolls dots, d1a1d215 merges dirOnly on facet==='direction' only (housesDir, housesV, URL_HOUSES append), EVERY facet's tally denominates against totalAll ('163 of 173'), the RdApDetail direction 'How it counts' rail (net mini chart + usual lean + today's net, release link and publish stamp in the head), ed2260de ROW_KEYS joins them so Snapshot dots can 'open this poll', ?f=d URL state, phone-card field/sample join quirks ('Leaders' tab label), no-VI waves drop the RdApDetail 2PP matchup grid wholesale (hasMatchup OR of every matchup cell's nulls), the rd-ap-dbar drops its zero-width unsure strip (the flex gaps each side of it doubled the divider), and the dir-facet.mjs acceptance probe."
source: auto-skill
extracted_at: '2026-09-29T01:00:00.000Z'
---

# Direction-only archive rows — auspol-tracker

SEC Newgate asks national direction and nothing else; Essential's VI series
paused between the 2025 election and its 2025-09-30 wave, leaving three
national-mood-only waves (2025-05-11, 2025-07-29, 2025-08-26, sample:null).
Both exist only as `direction[]` rows in `data/polls.json` — `polls[]` rows
key off the wave that measured voting intention, so neither has one. The
Direction facet of the All-polls table files them as REAL rows (shipped
2026-09-29), with each wave's own n where the writer filed one and the
placeholder dash `—` where not.

## Data path (what writes what)

- `.build/extract-secnewgate.mjs` — pulls the wave's n from the report's
  methodology block into the `direction[]` row as `sample` (spread-optional:
  no `sample` key when the report has none), plus `url` = the WP ARTICLE
  page (the media item's `link`, NOT the PDF `source_url`) and `published` =
  the media item's site-local upload stamp (`date.slice(0,16)`, UTC+10 —
  it trails the fieldwork by days). Essential's direction rows carry the
  same pair from `assimilate-essential-vi.mjs` (`url` = the
  essentialreport.com.au report page — a mood-only wave has no Guardian
  write-up — and `published` = the wave date + 1d "T01:00" stamp); its heal
  block back-fills the pair onto ANY Essential direction row lacking `url`,
  so all twelve carry the link (healed 2026-09-29), and SEC's heal path
  recovers rows filed before the fields existed. Pinned in
  `.build/test-secnewgate.mjs` (the direction-rows expectation includes
  the optional sample/link/stamp). validate.mjs's direction block gates
  `published` (ISO "YYYY-MM-DDTHH:MM", not future, not before the
  fieldwork) exactly like the poll-row check.
- `gen-data.mjs` §5:
  - `dirSample` — a direction reading's series weight is the joined VI poll
    row's n where the same wave has one, else the direction row's own
    `sample` (SEC Newgate), else the standing 1200 default, always capped
    (`Math.min(…, SAMPLE_CAP)`).
  - `directionPolls` (Snapshot dots, `D.directionHouses` beside it) — each
    dot's tooltip sample is `(p && p.sample) || d.sample || null` (VI join
    first, writer-filed n second).
  - `directionOnlyPolls` (~:1351) — readings whose `(date|pollster)` has NO
    `polls[]` row, emitted shaped like an `individualPolls` row, with empty
    stubs (`p: {}`, no `appr`) where the wave measured nothing so every
    downstream per-row reader needs no special case. Client label comes
    from `CLIENT_BY_HOUSE` (latest wave's `client`, "Self-published" in the
    views when absent) — a direction-only house has no poll row to copy
    it from. `url` and `published` pass straight through from the
    direction row (the detail head and "Read the release" need them), and
    like every direction row on ALL facets it carries `sample` plus
    `dir.eff` (the nowcast footprint `{lo,hi,w,t?}` the detail rail reads).
- `d1a1d215` (`AllPollsView`):
  - `dirOnlyAll = D.directionOnlyPolls || []`; `housesDir` = houses + the
    direction-only ones. Rows merge as `dirOnly = facet === "direction" ?
    dirOnlyAll : []` into the ONE `rows` array every filter/count/panel
    derives from — never inject elsewhere; off-facet a SEC row is a row of
    dashes.
  - `housesV` (the facet-following house list) feeds `RdAllPolls`, the
    Pollster popover counts, and `houseRank`; the URL `w=` restore filters
    stale house selections against `housesDir` only on the direction facet
    (a direction-only chip would select an empty table elsewhere).
  - `FACET_SCOPE.direction = { has: (p) => !!p.dir, … }` scopes the facet to
    rows that published a direction reading.
  - `URL_HOUSES` got "SEC Newgate" APPENDED — the arch-mask is a positional
    bitmask, so a new house goes at the END or every saved `w=` silently
    re-points.
- `ed2260de` — `ROW_KEYS = new Set([...D.individualPolls,
  ...(D.directionOnlyPolls || [])].map(p => p.pollster + "|" + p.released))`
  so a Snapshot direction dot's "open this poll" trip (`pollRowKey` →
  AP.openPoll → `#allpolls?…`) has a row to land on. Before this join the
  three Essential dashed dots went nowhere; `pollRowKey` still returns null
  for keys outside the set, so a chart asks first.

## Direction detail rail + head (facet === "direction")

- RdApDetail in rd-allpolls.jsx (~559-682): on the Direction facet the
  "How it counts" rail answers the same question against the DIRECTION
  headline figures — the descriptor line reads "{pollster}'s readings
  since {Month} against the monthly average, net right direction minus
  wrong track" over RdApDirMini (the house's nets vs the monthly-average
  net line, mood-pos/mood-neg), and the facts list "Against {Month}"
  (the reading's net vs dirAvgRow.net, "level with"/"N more
  right-direction/wrong-track than the month's average net of ±X",
  ±dirMoe margin from the row's own pq/sample), "{pollster}'s usual lean"
  (directionHouseEffects.net — "N more right-direction/wrong-track, taken
  out before the readings are averaged"), and "In today's {dirNow.net}
  net" (dir.eff footprint: one of the rdNumWord(dirNow.n) readings it is
  built from and how much it moves the figure, or "not one of them" once
  the wave ages out of the three-week window). The 2PP rail facts are
  wrapped `{!isDir && …}` so no 2PP copy leaks onto the facet; a
  `isDir && !d` fallback sentence stands in when a poll asked no
  direction question.
- The detail head (rdPollHead :115-134) ends "published by
  {the Client|pollster} on {rdApOut(published)}" when the row carries
  `published` — rdApOut renders "Tue 22 Sep, 3 pm". The client keeps its
  own capitalisation: "The Guardian", never "the Guardian" (rdApThe only
  ADDS "the" when the label lacks one).
- The pollster-cell ↗ (p.url) and the detail's "Read the release"
  (p.releaseUrl || p.url) need no direction special case — the fields
  ride the emitted row.

## No matchup grid when there's no VI; the direction bar's separator stays 2px

- RdApDetail's 2PP matchup block (rd-allpolls.jsx, the `.rd-apd-grid`
  with its `.rd-apd-th` "v One Nation" / "v Coalition" heads and the
  "Implied, on 2025 flows" / "As {pollster} published" / "Better prime
  minister" rows) renders only when the wave measured something the
  grid can quote: `hasMatchup` (:528-533) is the OR of the same nulls
  that already dash each cell — the implied pair (alpOnImp/alpImp), the
  alt matchup (ta), the printed pair (alp && lnp), and any better-PM
  cell. SEC Newgate and the mood-only Essential waves publish none of
  those, so NO grid at all renders — not a head row over dashes. The
  leaders/direction/seats `.rd-apd-grid1` grids are separate and
  unaffected; the non-redesign ArchPollDetail in d1a1d215 never had the
  grid (meta band + PollLedger), so it needed no co-edit.
- The row's direction-bar picture `.rd-ap-dbar` (rd-allpolls.jsx
  ~:1133-1141; css rd.css :1785-1790 + phone :1945) is `display:flex`
  over `flexGrow: d.right/unsure/wrong` items. Two separator lessons,
  both pinned by the probe:
  - A zero-width item still took the flex `gap: 2px` on BOTH sides, so
    SEC's `unsure: 0` strip left 2px+2px=4px of white dividing
    right-direction from wrong-track while bars carrying an unsure
    share showed single 2px separators. The middle `<i className="u">`
    renders only when `d.unsure > 0` — one separator in every case, and
    the first/last-child border-radius ends never move. The DOM tell
    of the bug: a mounted `i.u` whose inline `flexGrow` is 0.
  - Even then the gaps did not RENDER uniformly: segment widths are
    fractional (percent splits across an absolute-width bar), so each
    transparent 2px gap landed at a different fractional device-pixel
    offset and anti-aliased into a visibly different thickness across
    rows — and between the two dividers inside one bar (user report
    2026-09-29; headless dump confirmed every gap measured 2.00 CSS px
    in layout). The separator is therefore an OPAQUE `border-left: 2px
    solid var(--line)` on every `i + i` (no `gap` on the bar):
    border-boxes pixel-snap to the device grid, so every divider paints
    the same thickness. With content-box sizing and `flex-basis: 0`
    the border sits between segments exactly where the gap did.
    Never reintroduce a transparent-gap separator in a bar with
    proportional widths — on any facet.

## Tally denominators — the archive extent, not the facet's rows

`totalAll = D.individualPolls.length + dirOnlyAll.length` (d1a1d215) is
passed into RdAllPolls as `ofTotal`; rd-allpolls.jsx renders
`ofTxt = ofTotal != null && ofTotal !== total ? " of "+ofTotal : ""`.
Sorting/paging/shuffling cuts the VISIBLE count but the denominator is
always the ARCHIVE EXTENT, not the facet's own total — so with 10
direction-only rows filed, 2PP and Primary read "163 of 173 polls",
Leaders "97 of 173", Direction "75 of 173". The Direction facet's scope
filter legitimately drops the 98 individual polls with no direction
reading: it must NOT read plain "173". The non-redesign fallback in
d1a1d215 uses the same totalAll at its four count sites (ap-head-side
ap-count, ap-jumps-count, ap-bar-end ap-count, the sr-only table caption
— the bar's "{h} of {t} houses" line is forever fragment-shaped and its
`{t}` is a house count, NOT this poll total).

## URL state

`?f=d` (urlInit in d1a1d215) opens the All-polls view straight on the
Direction facet — combined with `#allpolls` for the view itself:
`index.html?f=d#allpolls`.

## Table rendering notes (both layouts)

- Desktop `.rd-ap-row`: pollster in `[role='rowheader'] b`, client in
  `rd-ap-sub`, sample in `.rd-ap-n` (`p.sample != null? toLocaleString() :
  "—"` — thousands separators are toLocaleString's).
- Phone `.rd-ap-card`: NO rowheader/`.rd-ap-n` — pollster in `.rd-ap-firm`
  (trailing "↗" ext icon inside its `<a>` if linked), and
  `client, fieldTxt, sample?` joined into one `.rd-ap-c2 .rd-ap-sub`
  (sample omitted, not dashed, when null). `fieldTxt` adds the ` ’YY`
  suffix only when the byDate toggle is OFF — the default view shows no
  year, so don't probe 2025 rows by a year string.
- The facet tab LD "Leadership" shortens to "Leaders" on the phone rung;
  match with `/^Leaders(?:hip)?$/` when driving it headlessly.

## Acceptance probe — `.matilda/probe/dir-facet.mjs`

Asserts: 7 SEC rows with their 7 samples carried over; exactly 3 dashed
(no-sample) Essential rows and they are the May/Jul/Aug waves; zero SEC rows
on 2PP/Primary/Leadership; no page errors; `?f=d#allpolls` lands with the
Direction tab pressed and the 7 SEC rows listed; a Snapshot direction dot's
tooltip carries its wave's `n = …`. Run desktop plain, then the phone rung
as `VW=390 VH=844` (the tooltip leg skips itself under vw ≤ 500). Probe
pitfalls hit live: rows paginate behind "Show all N" (click the
`.rd-ap-more .rd-link` before counting); the dot picker is root-level
POINTER picking, so synthesise `new PointerEvent("pointermove",
{pointerType:"mouse", clientX, clientY, bubbles:true})` at a circle centre
(`MouseEvent("mousemove")` never raises the tip); scope that sweep to
`section#direction .rd-dir-chart` — the text match /national direction/i
catches an outer section with 150+ circles from every chart on the page.

The probe also walks each direction-only row's OWN affordances
(`.matilda/probe/dir-facet.mjs`'s page4 section): tallies parse
`.rd-ap-count` as /^(\d+)(?: of (\d+))? polls$/ on every facet (163 of
173 / 163 of 173 / 97 of 173 / 75 of 173 — numerator AND denominator
both pinned); `openRow(regex)` clicks the row and reads the mounted
`.rd-ap-open .rd-apd` — `rowHref` off `.rd-ap-row.open [role='rowheader']
b a` / `.rd-ap-card.open .rd-ap-firm a`, the head sentence, the
`.rd-apd-links` anchors, the rail text + whether it carries an svg, and
(since the grid suppression) `grids` (each mounted `.rd-apd-grid`'s
text) + `thCount` — SEC's and the May Essential wave's details pin 0 th
and no "Implied, on 2025 flows" anywhere, while a poll opened on the
2PP facet pins 2 th WITH the Implied row. The direction-bar checks run
off the mounted rows: no `i.u` survives with a non-positive inline
flexGrow, every SEC row's `.rd-ap-dbar` is exactly two `<i>` children,
the facet still mounts the middle strip where a reading carries an
unsure share, every bar's computed `column-gap` is `normal`/`0px`, and
every non-first segment carries the one computed `2px` `border-left`
in the resolved `--line` colour (resolving the var through a scratch
element). Two traps hit live: (1) the 2025-05-11 Essential
mood-only wave must be opened via /Essential[\s\S]*7–11 May/ —
plain /Essential/ matches a VI
row first and its detail has no direction rail; (2) the head credits
"published by The Guardian" with a capital T (rdApThe ADDS "the", never
lowercases the client), so a /the Guardian/ expectation fails.
