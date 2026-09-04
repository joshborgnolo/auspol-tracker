---
name: auspol-detail-meta-band
description: auspol-tracker — the expanded-poll meta band (the fact line above the PollLedger) lives in TWO detail renderers (Latest PollDetail in a11e1559 + ArchPollDetail metaItems in d1a1d215) since a174788 both print Fieldwork / Published (pubStamp + pd-est titled fieldwork-end fallback) / Sample / conditional Effective sample at EVERY width, keep them mirrored; BOTH renderers emit the same root `<div className="poll-detail">` inside `tr.detail-row > td[colSpan]` (the panel never prints the pollster itself — identity lives in the preceding sibling row's shared `.pollster-name` cell); the old width-tag CSS classes pd-meta-sm / meta-md / meta-dup were REMOVED in a174788 (any stale doc citing them is pre-that-commit)
source: auto-skill
extracted_at: '2026-09-02T03:10:21.965Z'
---

# auspol-tracker: the expanded-poll meta band

The fact line at the top of every expanded poll detail (above the shared `PollLedger`)
exists in TWO renderers — changes to what the line carries belong in BOTH, rebuilt,
or the two tables disagree.

## Mounted DOM shape (verified 2026-09-04, for any panel-level feature)

Both renderers emit the IDENTICAL mount: the expanded panel opens as
`{isOpen && <tr className="detail-row"><td colSpan={…}> …Detail …</td></tr>}`
straight after the poll's own `<tr>` (Latest mount a11e1559:~2880
`<PollDetail r={r}>`, colSpan 7/9/10 by facet; archive mount d1a1d215:~3742
`<ArchPollDetail p={p} …>` inside `tr.detail-row`, colCount 9/10 by facet).
Each emits `<div className="poll-detail">` as the panel root — one class, two
JSX homes. So a DOM-level feature that targets `.poll-detail` (an injected
button, an observer) covers BOTH tables from one place — this is how
chart-adjacent features ship without touching the compiled assets: the
PLAIN copy layer in copy-chart.js attaches with a MutationObserver and
re-attaches on every React re-render.

Two facts anything panel-scoped must know:
- The panel NEVER prints the pollster's name (its self-contained set is
  dates/sample/method/links). Identity belongs to the collapsed row
  ABOVE it: `detailEl.closest("tr.detail-row").previousElementSibling`
  carries `td.pollster-cell` whose name link is the SHARED `.pollster-name`
  (PollsterName component, window-exported from a11e1559 and consumed by
  both tables — d1a1d215 has no own `pollster-name` source; grep there finds
  nothing because it destructures the shared one). Read the name from the
  row, never invent a panel-side source.
- Archive adds `.pd-meta-tail` (Back-to-chart / Report controls) inside its
  `.pd-meta-split`; Latest has no controls in the panel. Anything that
  captures/re-starts the panel should treat `.pd-meta-tail` as chrome.

## The two sites

- **Latest table**: `PollDetail({ r })` in `.build/newtracker/assets/a11e1559-…js` ~:2084 —
  plain `<div className="pd-meta">` with loose span children; payload fields
  `r.field`, `r.published` / `r.releasedLabel`, `r.mode`, `r.sample`, `r.sampleEff`
  (all emitted by gen-data's pollsterTable emitter ~:981-1017 — data layer already
  carries everything, band-only changes need NO gen-data edit).
- **Archive**: `ArchPollDetail` in `d1a1d215-…js` ~:2024-2048 — items as a `metaItems`
  ARRAY with key= props, inside `<div className="pd-meta pd-meta-split">` (the split
  docks the Back-to-chart / Report controls to the band's right edge — Latest has no
  controls and keeps the plain band). Archive payload diff: `p.client` (also here),
  `p.fullDate` fallback, `p.lean`/`p.hfx` extras.

## Post-a174788 state (replaces the old width-tag system)

The band is the expansion's **self-contained fact line**: Fieldwork · Published ·
(Method, Latest only) · Sample · Effective sample print at EVERY width, in both
tables. Fieldwork/Sample deliberately repeat their row columns so the open panel
stands alone — the user asked for that explicitly (2026-09-02); the old
"a meta item never duplicates a row column" principle and its three CSS tags were
REMOVED in a174788:
- `.pd-meta-sm` (hid the whole Latest band ≥1000px) — gone; the Latest band always shows.
- `.meta-md` (hid archive Sample / Effective sample ≥1001px) — gone.
- `.meta-dup` (display:none at all widths, archived Fieldwork — rendered but never
  visible) — gone.
Any skill/copy/comment still citing these classes predates a174788 — ignore it.

## Post-becf17a state: the release pointers are band rows, not a block

Below the fact line sits `.pd-meta-items` — a two-column grid
(`grid-template-columns: max-content minmax(0,1fr); align-items:baseline`, CSS
template.html ~:2090) of label ↔ value provenance rows. **"Pollster's release"
(wave page + optional `r.releaseHub` rolling-collection second link, both "here↗")**
and **"APC statement"** (only when `methodUrl && methodUrl !== releaseUrl`; same-URL
houses like DemosAU get an "(includes the wave's APC methodology statement)" note
instead) print as ordinary `.pd-meta-i{display:contents}` rows of that grid — the
"here↗" links sit opposite their labels in the SECOND column at every width.

The rows are built by ONE shared helper **`releaseMetaRows(r)`**, extracted from
`PollLedger` to top level in a11e1559 (~:1990) and window-exported; Latest PollDetail
appends `{releaseMetaRows(r)}` inside `.pd-meta-items`, archive's metaItems spreads
`...(releaseMetaRows ? releaseMetaRows(p) : [])` before `.filter(Boolean)`. Add new
pointer rows inside the helper (or beside it in both append sites) — never reintroduce
a dedicated block.

**History**: 2976db8 ("Reset … to the supplied typographic mock-up") stacked these
pointers in a `.pd-meta-items.pd-rel{display:block}` block (label over value) and that
build went live — the user immediately reported "here should be opposite not under".
becf17a REMOVED the `.pd-rel` block; grid rows are the settled design. If you see
"APC statement here↗ on its own line" reports, check whether a `.pd-rel` style block
resurfaced.

## Post-0ebf814: the "2PP effect" row closes the band

The per-poll aggregate effect (gen-data `eff` payload) prints as the band's LAST
row, an ordinary `.pd-meta-i`: label **2PP effect**, value `+0.1 for Labor vs.
L/NP; −0.4 for Labor vs. ON` (no `%`, no to/from figures; `(implied 2PP)` hi-term
suffix for no-2PP houses; single trailing outside-window note when every clause
is out of window). Built by ONE shared component **`EffLines`** (defined in
a11e1559, window-exported, destructured in d1a1d215), appended after
`releaseMetaRows` in BOTH sites: Latest `{r.eff && <EffLines eff={r.eff}/>}`
(~:2239) and archive `EffLines && p.eff && <EffLines key="aggEff" eff={p.eff}/>`
before `.filter(Boolean)`. It has ZERO dedicated CSS — the old full-width
`.pd-s-eff` caption block in template.html was DELETED in 0ebf814; do not
resurrect a special block for it. Full design/payload detail:
`.matilda/skills/auto-skill-auspol-poll-aggregate-effect/SKILL.md`.

## Component/item conventions (copy these when adding items)

- Item shape: `<span className="pd-meta-i"><span className="pd-meta-k">Label</span> value</span>`
  (`.pd-meta-i` nowraps, `.pd-meta-k` is the small-cap key, CSS near template.html ~:1928).
- **Published**: `pubStamp(x.published, { year: true })` — prints "24 Aug '26, 8:51 am
  AEST"; hour only where the ISO carries `Thh:mm`; returns null with no date, so keep
  the fallback: `.pd-est` span (dashed-underline styling, template.html ~:2036) with
  title "Publication date not recorded for this poll – showing the last day of
  fieldwork". Latest fallback text `r.releasedLabel` (no year — freshness window is
  ~45 days); archive fallback `p.fullDate`. Never fall back SILENTLY.
- **Effective sample**: conditional `sampleEff != null` only, title "Effective sample
  as published by the pollster (APC methodology statement)" — provenance attribute is
  policy (see auspol-effective-sample), never render a derived estimator n here.
- pubStamp, PollLedger and friends are defined ONCE in a11e1559 and window-exported;
  d1a1d215 destructures them from `window` — do not redefine.
- `PollLedger`'s own JSX comment references the band; update it if band composition
  or width behaviour changes (it went stale once already).

## Procedure (proven at a174788)

1. Edit both detail renderers (items + stale comments), adjust band CSS in
   template.html if width behaviour changes, keep the principle comment beside
   `.pd-meta-k` accurate.
2. `node .build/newtracker/build.mjs` (runs validation): verify the built index.html —
   grep compiled JSX for label strings ("Effective sample", "Fieldwork") near
   `react.createElement` sites; confirm removed CSS classes have ZERO matches
   in index.html (babel-escaped unicode means grep ASCII anchors only).
3. Stage ONLY the owned assets + template.html + index.html with explicit paths
   (repo is shared — other sessions leave working-tree noise); two `-m` flags,
   no apostrophes; re-check `git rev-parse HEAD origin/main` right before committing.
