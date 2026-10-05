---
name: auspol-wv-rug-two-lane
description: auspol-tracker — the Who-votes rug corridor is TWO dots tall with a greedy overlap dodge (worked + probe-verified 2026-10-01, commits pending push): .rd-wv-rug is top:-5px height:12px with the dots bottom-anchored so untouched dots sit pixel-identical to the old 1..7px corridor, and touching dots hop up 6px via --v on the anchor's transform (the shared morph-ease transition animates the hop for free). Lanes are computed in WvRug's useLayoutEffect from the MEASURED strip width (dots are px-sized but cqw-placed), guarded against render loops. Probe .matilda/probe-sp-allvoters.mjs replays the same greedy algorithm headlessly and asserts every dot's lane. Pointer-probe trap (worked 2026-10-01 on the DpRug clone): a lane-1 dot's ::before pad (inset -5px -6px) reaches 6px below its face — exactly ONTO the lane-0 dot's centre, since lanes are 6px apart — so elementFromPoint/hover at a dodged pair's lower centre resolves to the UPPER dot; hover/tap expectations must come from elementFromPoint at the target coords, never from document-order selectors.
source: auto-skill
extracted_at: '2026-10-01T03:22:28.351Z'
---

# Who-votes rug: doubled corridor + two-lane overlap dodge

Worked 2026-10-01 (user request: "double the height of this corridor … when poll dots
overlap at all, move one up to the added-height half-corridor"). Implementing + verifying
threw up four load-bearing decisions; record them before touching `.rd-wv-rug` geometry.

## Geometry (rd.css ~1040-1062, comment block + rules)

- Corridor: `.rd-wv-rug { top: -5px; height: 12px; }` inside the relatively-positioned
  `.rd-wv-track` (**36px desktop / 32px phone as of 8a246ee, 2026-10-03**; was 32/28). The OLD corridor was `top:1px; height:6px`.
- **Grow UPWARD, not downward.** The CI bar (`.rd-wv-ci`) and `.rd-wv-dot` both live at
  `top:50%; translateY(-50%)` of the track — any downward growth crashes the rug into the
  interval. The track's free space is its top edge. (The 2026-10-01 assurance "the phone
  rung lets the strip poke 5px above the track without visual collision" held only while
  dots had no halo — the 2026-10-03 `b.ring` halo pokes 2px further and DID collide with
  the phone figures' ink; fixed in 8a246ee, see "Row geometry" below.)
- **Dots are `bottom: 0`-anchored**, so lane-0 dots occupy track px 1..7 — pixel-identical
  to the pre-change corridor — and the added half-corridor is the new band above (-5..1).
  Lane-1 dots additionally `translateY(calc(var(--v, 0) * -6px))` when `--v: 1`.
- The dodge rides the existing `transform` (already `translateX(calc(var(--x)*1cqw - 50%))`),
  so the shared `.rd-wv-rug b` entry in the transition list (~rd.css:1097, `.32s
  var(--morph-ease)`) animates both the party-switch glide and the dodge hop for free.
  Do NOT move the dodge to `top` — that would break the transition and shift the hit-box.
- Phone rung: dots are 5px (rd.css ~1135 media), corridor stays 12px, dodge stays -6px —
  the half-corridor is 6px on both rungs; the 5px dot just gets 1px of clearance.

## Row geometry — touch taller so the halo clears the numbers (8a246ee, 2026-10-03)

The corridor's upward reach above the track top is **5px face / 7px with the ring
halo** — and what sits above the track differs by rung, so the clearance is paid for
differently:

- **Desktop** (single grid row, track centred): row min-height 32→40 with the track
  32→36 inside it, so the row's own penthouse absorbs the first 2px of the reach and the
  rest lands harmlessly in the previous row's air (previous row's digit ink sits ≥10px
  from its edge). Nothing above the track carries numbers on desktop.
- **Phone** (two grid rows: `"lab v d" / "track track track"`): the figures' line is
  DIRECTLY above the track. `row-gap: 0→6px` puts the clearance there — the strip's 6px
  reach (5px dot + smaller phone halo) now spends itself in the gap instead of on the
  value digit ink. Track 28→32. Rows went 58→68px.
- **Verification probe is the RowNum trap's showcase**: any probe measuring "label ink
  vs mark" in Who-votes MUST clip Range.getClientRects by overflow-hidden ancestors —
  RollNum's odometer stacks spill phantom digit boxes far beyond the clip window, and
  unclipped they fake a 118px collision with cells a row below. The worked probe is
  `.matilda/probe-wv-row-height.mjs` (scratch, gitignored; `--assert` mode checks
  both row heights and zero collisions at 390 + 1280).
- **Invariant:** the all-voters allline overlay is `top: 22px; bottom: 26px` of
  `.rd-wv-plot`, derived from sethead (28px) and axis (22px + 4 margin) — if you touch
  either of those, re-derive the pair. Row/track heights don't shift it.

## Lane assignment (rd-panels.jsx, WvRug ~1181-1215)

- `useLayoutEffect` + `ResizeObserver` on the rug span, deps `[g, party, xp]`. The overlap
  threshold is computed from the MEASURED rendered width:
  `gap = (b.offsetWidth / el.clientWidth) * 100` — dots are px-sized but positioned in cqw
  (container-query width units), so only the live strip says how many cqw a dot spans.
  This auto-adapts to the phone's 5px dots and to any track-width change.
- Greedy left-to-right over `xp(x)`-sorted dots: lane 0 if the previous lane-0 dot is
  ≥ gap away, else lane 1 if lane 1 is free, else the lane whose last dot is older
  (`last[0] <= last[1] ? 0 : 1`). A per-dot `next[i]` array → `--v` inline style.
- **Why greedy-pair and NOT the Issues `dodge()` precedent** (rd-panels.jsx ~2419-2430,
  sort/cluster/centre at ±9px): that one spreads clusters symmetrically around a common
  centre; the user's spec was the minimal per-pair rule ("when dots overlap at all, move
  ONE up"), lanes are binary, and left-to-right greedy keeps settled dots from moving.
- **Render-loop guard (required):** the effect sets state unconditionally-read per render;
  `setUps((prev) => (prev && prev.length === next.length && next.every((v,k) => v ===
  prev[k]) ? prev : next))` returns the SAME state reference when lanes are unchanged.
  Without the guard, effect→setState→render→effect loops forever on any layout effect
  whose computed state is a fresh array each pass.
- Both dot shapes get `"--v": ups ? ups[i] : 0` (the null case paints pre-effect first
  render; the guard keeps it from sticking).

## Untouched invariants that must stay untouched

- Hit target `b::before { inset: -5px -6px }` is relative to each `<b>` — it follows the
  dodged dot automatically. The `.rd-wv-rtip` tooltip is positioned at the `<b>`'s
  left/top 50%, so it follows too (probe-wv-tip.mjs re-passed after the change).
- **Hit-pad bleed across lanes (probe trap, worked on the DpRug clone 2026-10-01):**
  the pad reaches 6px below each dot's face, and the lanes are exactly 6px apart — so a
  lane-1 dot's pad covers the lane-0 dot's CENTRE on any dodged pair. `elementFromPoint`
  and puppeteer's element-centre hover at the lower dot's centre both resolve to the
  UPPER dot's `<b>`. This is intended UX (pad precedence, same as chart dots); what it
  breaks is probes that assume document order = pointer target. In pointer probes,
  derive the expected dot from `document.elementFromPoint(cx, cy)` at the coordinates
  you will actually hover/tap (probe-dp-rug.mjs's desktopMouse does exactly this after
  its first draft failed `"Essential" ≠ "Resolve"`).
- The blindness recipe (alpha-in-colour face + 2px `--bg` ring, see auspol-wv-rug-tooltip)
  is orthogonal — don't "simplify" the two systems into each other. **Exception since
  2026-10-03 (user call "the dash must not touch the poll dots"):** a dot the all-voters
  dash crosses gets `b.ring` and carries the ticks' own 2px `--bg` halo so the dash stops
  at it; all other dots stay ringless. WvRug's layout pass computes it from the same
  measured width (`|xp(x) − allXp| ≤ dotRadius + 2.75px`, a second reference-guarded
  state `setRings` beside `setUps`; `allXp={xp(all)}` threads in from the dotSet).
  Same-day follow-up: the halo alone leaked the dash THROUGH the translucent face, so
  b.ring also paints its 55% tint over an opaque `--bg` underlay (`linear-gradient` face
  over background-color, the whisker marks' solid-face guarantee) — with a matching
  `--ring-face` swap on lit rows (the plain lit rule's background shorthand would wipe
  the underlay).

## Probe (probe-sp-allvoters.mjs, `rug` IIFE)

The rug section of the all-voters-dash probe now also:
1. asserts corridor height is 12px per row;
2. **replays the exact greedy algorithm** over each row's `--x` values headlessly
   (measuring `drs[0].w / rc.w` for the gap) and fails on any lane mismatch;
3. asserts each dot's bottom sits at strip-bottom − (lane × 6px) ± 0.51;
4. hit-tests `elementFromPoint(d.cx, d.cy)` at each on-dash DOT's own centre — the old
   strip-midline point is meaningless once dots live on two levels;
5. replays the dash-crossing halo test per dot (`dotRadius + 2.75px`, dash x from the
   desktop overlay or the phone's per-row `.rd-wv-all`) and fails if a dot's `.ring`
   class or the face's computed 2px halo doesn't match its crossing state.
Run it (and probe-wv-tip.mjs after edits to the tip) after every rebuild touching rug
geometry: `node .matilda/probe-sp-allvoters.mjs`. ALL PASS 2026-10-01 at 4 widths.

## Related

- **auspol-wv-rug-tooltip** — the tip's own two caller-context traps + the blindness fix;
  same DOM structure, same probe family.
- **auspol-headless-geometry-verify** — why the probe asserts geometry instead of taking
  screenshots (the review model can't read PNGs).
- **auspol-build-pipeline** — rd-panels.jsx + rd.css are build SOURCES; the only generated
  output they dirty is `index.html` (do NOT go hunting for a phantom compiled layer to
  co-commit — a prior session mis-committed a sibling's WIP in `73de0c58` as a "compiled
  layer"; that asset is itself one of the hand-maintained JSX sources in build.mjs §3).
