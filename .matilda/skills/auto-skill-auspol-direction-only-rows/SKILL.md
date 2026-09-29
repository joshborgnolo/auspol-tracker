---
name: auspol-direction-only-rows
description: "auspol-tracker — the All-polls Direction facet's direction-only rows (SEC Newgate's waves + Essential's three 2025 national-mood-only waves, shipped 2026-09-29): extract-secnewgate files n in the direction row, gen-data emits directionOnlyPolls (sample carried over from the VI join or the house's own n) + directionPolls dots, d1a1d215 merges dirOnly on facet==='direction' only (housesDir, housesV, URL_HOUSES append), ed2260de ROW_KEYS joins them so Snapshot dots can 'open this poll', ?f=d URL state, phone-card field/sample join quirks ('Leaders' tab label), and the dir-facet.mjs acceptance probe."
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
  no `sample` key when the report has none). Its heal path now replaces an
  exact-date row whose figures, span OR `sample` moved — a back-filled n is
  picked up on the next run. Pinned in `.build/test-secnewgate.mjs` (the
  direction-rows expectation includes the optional sample).
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
    it from.
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
