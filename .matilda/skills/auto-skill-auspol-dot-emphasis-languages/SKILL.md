---
name: auspol-dot-emphasis-languages
description: "auspol-tracker — the dot-EMPHASIS taxonomy (worked as a consistency audit 2026-10-04): ring+enlarge is ONE machinery, the TrendChart engine's hotDot (08b413e7 ~:1004-1048 — picked dot is REMOVED from the translucent cloud and redrawn ABOVE the lines as a solid 6px disc with 2px chart-bg halo + 11px colour ring @.55, Interaction-board dictate 'the dot grows and rings'), enlarge-only is the past-cycles summary STRIP's rd-cs-dot (rd.css:1752-1754, 7→11px grey→ink, instant — transition is on left only), and election-result rings are rings AT REST with NO hover animation (rd-ring — ringness encodes counted-not-polled; only the tooltip swatch swaps, ringAtX). Non-rd raster mode is the enlarge-in-PLACE fallback (4.2→6.5 via scatter-dot r transition, no ring). The mode switch is page-global: rd = !!(window.AP && window.AP.rd)."
source: auto-skill
extracted_at: '2026-10-04T00:00:00.000Z'
---

# Dot-emphasis languages: ring+enlarge vs enlarge-only vs rest-ring

User ask (2026-10-04): "two poll dot animations — one puts a ring around
the dot and enlarges it ... one just enlarges ... is the ring usage
consistent?" Answer: yes, and it's split by what KIND of dot it is, in
two different systems. This map is for any future "shouldn't dot X ring
like dot Y?" report.

## Language 1 — ring+enlarge: the PICKED POLL on a chart cloud

ONE implementation, in the shared TrendChart renderer
(`.build/newtracker/assets/08b413e7-…js`), so every redesign chart with
a scatter gets it identically — 2PP hero, primary, national direction,
decidedness, leadership, discord, house-lean, AND the poll scatter
inside the past-cycles term charts themselves.

- `hotDot` ~:1004-1048: when a poll dot is picked, it is **removed from
  its live cloud** (`if (rd && live && dot === d) return null;` in
  `dotEls`) and redrawn in `g.rd-dot-hot` AFTER the series lines — a
  dot buried under a line would read half-occluded. Solid disc at
  `DOT_R_LIVE = PX(6)` with a 2px chart-ground halo stroke, inside a
  ring at `RING_R = PX(11)`, 1.5px stroke in `dot.color`, opacity .55.
  The code comment quotes the Interaction-board dictate: "the dot grows
  and rings."
- `ring+enlarge` needs the ring precisely because the pick must be
  lifted OUT of a cloud of identical translucent peers (`DOT_OP` in
  the densified cloud) — the ring reads "this one, not its neighbours".
- Radii constants nearby: `DOT_R = rd ? PX(2/2.6) : 4.2`,
  `DOT_R_LIVE = rd ? PX(6) : 6.5`, `DOT_OP = rd ? 0.5 : 0.6`.
  `hotDot` has NO CSS rule — it follows the pointer instantly on
  re-pick; only its neighbours' fade is timed.
- **Raster fallback**: in non-rd mode the SAME pick just enlarges in
  place (4.2→6.5, animated by template.html's
  `.scatter-dot { transition: r .12s ease; }`), no ring, no lift.
  Mode is page-global: `const rd = !!(window.AP && window.AP.rd)` (:290).

## Language 2 — enlarge only: the summary STRIP entry, not a chart pick

The past-cycles "Every measure N months in" summary table's scale
strips (`rd-cycles.jsx` ~:1051, `rd-cs-dot`; styled `rd.css`:1752-1754):
a 7px `ink-3` dot per past term grows to 11px `ink` on hover (or when
the paired results ladder lights it, `.on`), z-index lifts, and the
term tooltip opens (`{who}, {yr} term` + next-election outcome).
`::after` extends the hit area by 6px. The transition block
(:1759) covers `left` alone — the GROW is instant, not animated.

This is a TABLE glyph on a one-dimensional scale (shared with band
whiskers and a mean tick), not one poll picked out of a cloud — no
ring, because there is nothing it must de-deblend from. Don't "fix"
it to ring without a user ask; same rule as the archive tooltip
squares in auspol-election-ring-tooltip (Out of scope section).

## Language 3 — rest-state ring, NO hover animation: the election count

Election results are `marks` → `circle.rd-ring` — already rings at
rest, because ringness ENCODES counted-result-vs-polled-opinion ("a
point that is a count, not a poll"; the past-cycles key reads "Each
term's election results"). They have **no hover state at all** (no
`.rd-ring:hover`, no pointer handlers on `g.rd-mark`): the only hover
response is the guide tooltip's swatch flipping to a ring at the
election spine x (`ringAtX` → `tip-swatch.is-ring`). Full machinery
in auto-skill-auspol-election-ring-tooltip. The results-ladder rings
(`rd-csl-ring`, rd.css:1842-1846) similarly only darken their border
on the hovered ROW.

## Fourth consumer for completeness

The All-polls detail "How it counts" minis ring a hovered past-release
dot too (`rd-apd-ring`, r=8, rd-allpolls.jsx :392/:501/:694/:772; CSS
rd.css :2376-2378) — see auto-skill-auspol-allpolls-mini-dots. So
"ring on hover" belongs to chart-ish picks everywhere.

## Fifth consumer — enlarge ONLY also runs on the Latest-panel timeline

The "Latest and next polls" releases strip ("Releases, next" column,
spanning `t0 − 43d … + 23d`, rd-polls.jsx `strip()` ~:250-320) is a
SECOND enlarge-only home: an earlier-release `.rd-tl-dotlink` grows
6→8px ink-faint→ink-2 on hover/focus/touch-tip (`.on`), ANIMATED
(transition on width/height/background .15s, rd.css :768-770) with a
20px invisible hit pad (`::before`) — and keyboard focus adds the
accent focus-outline (a11y ring, not a data ring). The row's own
latest poll (`.rd-tl-latest`, fixed 11px ink) never animates. Its
right-edge off-horizon projection marker (`.rd-tl-ring`, a 9px
outline disc next to the projected month) joins Language 3 — outline
encodes an *expectation*, not a realised poll; no hover state.

## Cross-references

- Input side (how a pick is detected, catchments, click chain):
  auto-skill-auspol-trendchart-dot-picking.
- Election rings + tooltip swatch swap + where rings are FORBIDDEN
  (key strips, archive tooltips): auto-skill-auspol-election-ring-tooltip.
