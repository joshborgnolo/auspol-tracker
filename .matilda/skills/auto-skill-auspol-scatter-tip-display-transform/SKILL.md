---
name: auspol-scatter-tip-display-transform
description: auspol-tracker — when a TrendChart dot/point is DRAWN at a transformed y (lift-mapped, offset, normalised), the true figure must ride the datum and the caller's fmt must be point-aware (engine contract fmt(y, point?); precedent the mood panel's NAB line, drawn +100, tips the net balance), with the transform disclosed in the panel chrome (.rd-note) and the copy-card caption — never only in glossary/How-it's-built. Worked 2026-10-08 (07bc2e3): primary-vote group dots are drawn at trend+lift but tip the wave's PRINTED group figure; probe pattern hovers the last solid dot and recomputes the expected figure from window.AUSPOL, never from site copy.
source: auto-skill
extracted_at: '2026-10-08T10:54:08.423Z'
---

# Scatter tip must tip the true value of a display transform

**Trigger.** A TrendChart dot or point is drawn at a y that is NOT the
recorded figure — lift-mapped onto a trend (primary-vote group views:
`monthlyAllVoters + (pollGroup − pollAllVoters)`), offset for comparison
(NAB's deviation series +100), normalised, demeaned.

**Why it matters.** The rest of the panel speaks raw figures: the stat
strip and dek quote printed-style numbers, and a dot's click lands on
All-polls facets that list the printed figures (since 2026-10-08 the
primary group views route to the Demographics facet with the view's split
pre-picked — a user compares dot height vs printed cut directly). A
synthetic number presented unadorned is the screenshot-without-context
trust case. A glossary/How-it's-built paragraph is the DEEP version; near
nobody reads it before reading the chart, so disclosure at least this
level must live where eyes are.

## The four moving parts (edit together)

Worked form: primary-vote group dots in `rd-panels.jsx` (07bc2e3).

1. **Datum carries the true value.** Add it to the scatter object at
   construction (primary scatter ~:229-243): `gv: gv[i]` — the wave's
   printed group figure — beside the lifted `y`.
2. **`fmt` goes point-aware.** Engine contract is `fmt(y, point?)`
   (documented at 08b413e7 ~:156, explicitly for this case). Caller:
   `fmt={(v, pt) => (G && pt && pt.gv != null ? pt.gv : v).toFixed(1)}`.
   The `!= null` guard keeps all-voters dots, series guide points and
   printed `0` figures on the right paths (0 is a real printed figure).
   `fmt` also serves series rows — those points carry no `gv`, so they
   keep the old behaviour; the axis runs on `yTickFmt`, not `fmt`.
3. **Disclosure in the panel chrome.** A `<p className="rd-note">…</p>`
   inside the chart card, gated on the transformed view only, drawn
   between the chart and the `RdKey` row (~:471). Existing convention —
   issues/mood/decidedness panels all use `.rd-note` for view-level
   caveats. Sentence names the transform and where the printed figures
   sit ("never the cut the poll printed, which sits beside every other
   poll's in All polls' Demographics view").
4. **Copy-card caption branch.** The `copy={{ … caption }}` prop rides
   the host as `data-copy` on `.chart` (engine ~:1292) and is what
   copy-chart.js prints under an exported image. The all-voters caption
   "Each dot is one poll; …" is actively wrong under a transform —
   branch it on the same gate as the note.

## Engine facts (08b413e7 asset)

- Scatter tooltip is built in the `if (dot)` branch ~:956:
  `value: fmt(dot.y, dot) + unit` — rows are fixed-shape
  (party row + `Field` row from `dot.meta.dateLabel`; `sub` = n = sample;
  `hint` = click-to-open). To enrich the VALUE you need only the datum +
  caller `fmt`; do NOT fork the engine for a one-panel row.
- Tip DOM ~:1962-1987: `.tip` > `.tip-title`, `.tip-row` >
  `.tip-label`/`.tip-note`/`.tip-val`. `r.note` renders a `.tip-note`
  span — a per-point `note` is the documented seam (series points) if a
  secondary value is ever needed, but the engine's scatter branch does
  not pass one today.
- **Input side is a different skill** — picking/click/opening:
  auto-skill-auspol-trendchart-dot-picking (dot click → All-polls facet
  via `pollFacet`/`pollSplit`).

## Probe pattern (pv-group-select.mjs `hoverTip`, 156/156 checks)

- Solid dots only: filter `circle.scatter-dot` by
  `fill !== "var(--chart-bg)"` (hollow ring marks have no poll). Take the
  last solid dot; approach from (−30,−30) then onto centre; assert
  `.tip .tip-val` appears (4 s).
- **Recompute truth from the payload, never from page copy**: read the
  tip's title (pollster) + `Field` row (dateLabel), find the row in
  `window.AUSPOL.individualPolls` by
  `pollster === title && dateLabel === field`, map the tip's party label
  back via `D.PARTIES` ("Others & independents" special case), and
  compare against `q.grp.v[demoGroups.indexOf(group)][partyIdx].toFixed(1)`
  (group views) or `q.p[party].toFixed(1)` (all voters).
- Assert the `.rd-note` exists **only** in the transformed view and names
  the transform; assert the caption via
  `JSON.parse(chart.querySelector("[data-copy]").dataset.copy).caption`
  — exact string for the untransformed view.

## Anti-patterns

- Shipping the transform with glossary-only disclosure (the pre-07bc2e3
  state — user flagged it within hours: "is it good that the dot numbers
  don't match the recorded poll figures?").
- Tipping the lifted y with a unit-less number that LOOKS like a share.
- Forking the engine's tip rows for one panel — `fmt(`y`, point)` and
  per-point `note` are the seams.
