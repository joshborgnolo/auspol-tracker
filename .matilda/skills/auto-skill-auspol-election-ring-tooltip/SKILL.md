---
name: auspol-election-ring-tooltip
description: "auspol-tracker — the election-result RING machinery end-to-end (shipped 9c07c73, 2026-09-30): why a ring renders BLACK (TrendChart marks take an inline stroke only when m.color is passed; the CSS default is body.rd .rd-ring { stroke: var(--ink) } in rd.css:251, so any call site that omits color gets ink), how the hero wires the 2025-election mark to its contest line's colour (M.alp_lnp.b.color, ring on BOTH matchup views), RdPrimary's per-party marks + base.x, the Who-votes By-state panels' AEC-31496 state rings (fb824bf: DEMO_STATE_ELECTION in gen-data, RoA = national less NSW+Vic+Qld), and the guide-tip EXACT-x rule: a series gets a tooltip row ONLY where its points hold the hovered spine x, so out-of-window election stops need the point prepended to each series (the hero inherits it free from its agg rows), plus the opt-in ringAtX → is-ring swatch swap (renderer 08b413e7 :248/:824/:1765 → template.html :1645; key-strip glyphs stay ink; archive tooltips have NO ring machinery). Probes .matilda/probe/{election-ring,state-election-rings}.mjs COMMITTED (git add -f)."
source: auto-skill
extracted_at: '2026-09-30T00:20:22.094Z'
---

# Election-result rings + the hover-only tooltip ring swap

User ask (2026-09-30): (1) the 2025-election ring on the 2PP hero is
black but "should be the colour of the associated line" like the primary
chart's per-party rings; (2) hovering the election result on EITHER the
primary or the 2PP chart should render the tooltip's coloured-square
swatches as the ring icon — only on that hover.

## The black-ring root cause (diagnose any "ring is black" report)

TrendChart (`08b413e7-…js`) renders each `marks` entry as a
`<circle class="rd-ring">` with an INLINE stroke **only when `m.color`
is set**. Without it, the CSS default wins —
`.build/newtracker/assets/rd.css` ~:251 `body.rd .rd-ring { stroke:
var(--ink) }` — which is near-black. So "ring is black on chart X"
always means: that call site passed no `color` on its marks. The
primary panel already passed `p.color` per party; the hero passed
nothing. The fix is at the CALL SITE, never by overriding rd.css.

## The four homes (edit all four together for ring changes)

1. **`.build/newtracker/assets/rd-hero.jsx`**
   - Election mark ~:244-248: `const elec = D.agg2pp.find((d) =>
     d.election);` then `ringOn` (true on both Labor-contest views),
     and the marks array carries
     `{ x: elec.x, y: elec.alp, color: M.alp_lnp.b.color, label: …}`.
     Note the colour is ALWAYS the Coalition contest's rival colour:
     on the "Labor v Coalition" view the ring belongs to the MAIN
     series, on "Labor v One Nation" to the faint OTHER (v Coalition)
     line — the associated line moves, the colour follows it.
   - `ringAtX={ringOn ? elec.x : null}` on the TrendChart call ~:479.
   - **Deliberately untouched**: the two key-strip ring glyphs
     (`kind: "ring"` items ~:358 and the narrow copyKey ~:371) stay
     ink — they sit inside line-coloured keys where a per-ring party
     colour would fight the key's own accent.
2. **`.build/newtracker/assets/rd-panels.jsx`** — RdPrimary ~:178 on
   its TrendChart: `marks` (already per-party coloured) plus
   `ringAtX={base ? base.x : null}` where
   `base = D.aggPrimary.find((d) => d.election) || null`.
3. **`.build/newtracker/assets/08b413e7-…js` (the TrendChart renderer)**
   - New opt-in prop ~:244-248 (doc + destructure
     `ringAtX = null`) — null everywhere else, so no other chart
     changes (the hero TrendChart and RdPrimary are the only
     passers).
   - Guide-tooltip tip object ~:824:
     `ringSwatch: ringAtX != null && spx != null && Math.abs(spx - ringAtX) < 1e-6`.
     `spx` is the hovered spine row's x, so the flag fires exactly
     when the cursor snaps to the election spine row.
   - Row render ~:1765:
     `className={"tip-swatch" + (tip.ringSwatch ? " is-ring" : "")}`
     with `style={tip.ringSwatch ? { borderColor: r.color } : { background: r.color }}`
     — the per-row colour MOVES from background to border, so the
     primary tooltip's rings come out in the five party colours and
     the hero's in its row's line colour.
   - The hero's no-colour extra row (`{label:"", value:"The election
     result"}`) renders NO swatch before or after — rows without
     `r.color` never draw one, so nothing to handle.
4. **`.build/newtracker/template.html`** ~:1643-1645:
   ```css
   .tip-swatch { width: 9px; height: 9px; border-radius: 2px; flex: none; }
   .tip-swatch.is-ring { border-radius: 50%; border: 1.5px solid; background: transparent; }
   ```
   The border colour arrives inline from the row; the global
   `box-sizing: border-box` absorbs the 1.5px border inside the 9px
   box (no size drift).

## Out of scope by design

- **Archive tooltips**: the d1a1d215 asset renders its own plain
  `.tip-swatch` squares (~:2601, ~:2760) with background colour and no
  is-ring machinery — hovering an election row in the All-polls detail
  keeps squares. Don't "fix" that without a user ask.
- Only ONE ring per hero chart (`ringOn` election marks), five on the
  primary panel (ALP/LNP/GRN/ONP/OTH from the party list).

## Headless verification

Committed probe `.matilda/probe/election-ring.mjs` (21 checks, the
probe skeleton from auspol-headless-geometry-verify; committed with
`git add -f` because `.matilda/probe` is gitignored but curated
probes ARE tracked — dir-facet.mjs/masthead-parity.mjs precedent).
What it pins, all with the election x in view (range "All"):

- Hero LvC: exactly one `circle.rd-ring`, and its computed stroke
  EQUALS `path.series-line[data-series="main"]`'s computed stroke
  (both resolve var(--lnp) → oklch(0.5 0.095 250)) and ≠ an
  ink-probe circle's `var(--ink)` stroke.
- Hero LvON: the ring equals the `[data-series="other"]` line.
- Election hover → section-scoped `.tip.tip-guide` whose EVERY
  `.tip-swatch` carries `is-ring` (primary: 5 rings with ≥4 distinct
  border colours; hero: 1 ring in the main colour) and the tip text
  names "The election result"; recent-month hover → 0 is-ring
  swatches among ≥1 plain squares.
- Regression sibling: `.matilda/rd-tpp-hero-probe.mjs` (14 checks,
  untracked) must stay green — see auto-skill-auspol-rd-tpp-hero.

The hero's first probe run failed 11 checks with the APP CORRECT —
the hover coordinates were below the 900px viewport; see the
viewport/scroll section of auspol-headless-geometry-verify before
trusting any tooltip result.

## Third ring consumer: the Who-votes By-state panels (fb824bf, 2026-09-30)

Each of the four Place-tab state panels (NSW/Vic/Qld/Rest of Australia)
rings the 2025 election's STATE first-prefs in the series colour, and
the May-2025 hover tip reads both rows (state result + the All-voters
line's NATIONAL result) with ring swatches.

- **Data**: `DEMO_STATE_ELECTION` in `gen-data.mjs` §7g (~:2572-2602),
  emitted as `D.demoStateElection`. State shares from the AEC
  event-31496 per-state first-prefs pages (`HouseStateFirstPrefsByPartyByVoteType-31496-<state>.htm`),
  Coalition bucketed (Liberal+Nats; +LNP Qld, +CLP NT); **RoA is
  derived as national less NSW+Vic+Qld** (== direct SA+WA+Tas+ACT+NT
  sum) — the user's own suggestion, verified. The `"Nat"` groups key
  holds the national shares (34.56/31.82/6.40/12.20/15.01) purely so
  the All-voters line gets its own election point; it draws no ring.
- **Renderer**: rd-panels.jsx panelled branch ~:1377-1430. Because the
  election x (mx("2025-05")) sits LEFT of the monthly run (starts Jul
  2025) the branch widens its edge test (`se.x >= xDom[0] − 0.25 − 1e-6`)
  AND the x-domain per panel (`xDomP = [se.x − 0.05, xDom[1]]`); the
  spine is prepended with the mark, `ringAtX` + `marks` follow the
  hero's pattern, and `tooltipTitle`/`extraRows` are index-shifted
  (election stop is i===0, months are i−1; election returns NO CI
  extraRow — it's a count, not a poll).

## TrendChart guide rows are EXACT-x (the rowless-election trap)

The guide tooltip lists a series ONLY where `series.points` holds a
point at the hovered spine x (`ptAtX` ~:266-270 in 08b413e7). Adding a
spine stop and a ring mark is NOT enough — with no series point there
the tip shows only extraRows, which is exactly the bug the state panels
hit first. Fix pattern: prepend a point to each series at that x — the
hero gets it free because agg2pp/aggPrimary rows already include the
election row; a hand-built series (lineOf output, `...allSeries`
spreads) must concatenate `{x, y}` explicitly. In rd-panels the
override rides lineOf's trailing `...over` spread:
`lineOf(r, color, {rdWidth…, points: elPts.concat(r.rows.map(...))})`.
Do NOT extend the renderer with a marks-based fallback — the series
prepend mirrors the hero and touches no shared component.

Gotchas pinned by the probes:
- Mark labels render as `text.rd-note-text` INSIDE `g.rd-mark`
  (renderer ~:1485) — there is NO `text.rd-mark-label` selector; a
  probe grep for one always finds nothing.
- Tip ROW ORDER is not the series order (observed both "All voters
  first" and "state first" across party chips) — assert rows by label,
  never by index.
- Curated probes live in `.matilda/probe/` and serve the repo with
  ROOT = probe-dir + `../..` — `..` silently serves `.matilda/` and
  everything times out (this broke the hero regression probe when it
  was moved into probe/).
- `.matilda/probe` is gitignored; curate with `git add -f`.
  `state-election-rings.mjs` (105 checks, committed fb824bf) pins the
  state rings; `election-ring.mjs` (hero/primary) is the regression
  sibling — run both after ANY TrendChart tooltip change.

## Fourth ring consumer: Past-cycles vote-card per-term rings (2026-10-01)

The redesign Past-cycles vote cards — 2PP, government primary and
opposition primary — ring EVERY drawn term at both its elections:
opening at x=0, closing at the next election's counted result, each in
its line's own colour on that card (the opposition card's rings wear
the opposition party's paint via `colorOf`'s isOpp branch). The hero
rule generalised, reaching each mark with `color` set (never the ink
CSS default). The TrendChart renderer contract is untouched. Data
shape `endRes = { x, tpp, primary, oppr }` (gen-data ~:3790, the
primary/oppr counts keyed off `c.gov`/`c.opp` so all three vote cards
close the SAME term on their own measure) → `ringTerms` collection
gated to the three vote keys (d1a1d215 :1528, :1553) → `rings=` prop →
per-term marks reading `rt.close[M.key]` in rd-cycles.jsx :139-147.
The same door carries the vote cards' DOTTED lead-in AND lead-out:
obsRuns flags `lead: ringTerms != null && run.dashed &&
run.points[0].x === 0` (d1a1d215 :1590 — the ringTerms gate is what
keeps leader cards dotless), and a separate two-point `tail` series
per drawn past term bridges its final poll to `endRes` (same block,
gated on `c.endRes[M.key] != null`; the sitting term and leaders get
none). rd-cycles restyles both `RD_CYC_LEAD = "0.5 4"` (:53, lead
branch :77, tail branch next — tail is `endCap: false` so no end-dot
paints over the closing ring), matching the by-state panels'
RD_ELECTION_LEAD and the by-location panel's election→first-poll
bridge the tail mirrors. Full map, the ePrim/eTpp elections-table
single-sourcing and the data fixes it retired (1996/1998/1974), the
fade-in-place change-mode rule, which cycles actually dot
(1972/1984/2001/2019 as of 2026-10-01) and the probe traps (the
peer-mean dot shares `.rd-mark`, first series-line is the mean line,
tick-label px fit, stale-data silhouette) live in
auto-skill-auspol-past-cycles "Election-result rings + dotted lead-in
on the redesign vote cards". Probe: `.matilda/probe/cyc-rings.mjs`
(~120 × {1280,390} — the 2019 lift exercises the dotted lead and its
tail, the 1996 lift the canonical 2dp close rings and c1996-tail's
end position).
