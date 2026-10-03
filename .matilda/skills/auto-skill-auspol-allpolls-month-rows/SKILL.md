---
name: auspol-allpolls-month-rows
description: auspol-tracker — the All-polls month-average row (.rd-ap-mrow, monthRow(g) in rd-allpolls.jsx ~:1412-1444) anatomy per facet, the equal-specificity CSS trap that made primary-facet rows 61px vs the twopp facet's 54.75px (fix: compound .rd-ap-pic.rd-ap-mpic, 2447997), and the primary facet's ring markers — HOLLOW since 055e117 (2026-10-03), so overlapping month averages cross Venn-style instead of the later-painted ring erasing the earlier. Row heights must match across facets or the facet arrow-walk landings visibly misalign (see auspol-rdpinscroll-row-pin).
source: auto-skill
extracted_at: '2026-10-01T00:00:00.000Z'
---

# All-polls month-average rows

## What they are

The grouped month separator/average rows (`.rd-ap-mrow`) between poll rows
in the All-polls table. Emitted by `monthRow(g)` in
`.build/newtracker/assets/rd-allpolls.jsx` (~lines 1412–1444), keyed
`m{g.ym}`. Markup differs per facet:

- **twopp**: `.rd-ap-mrow > .rd-ap-mlab` ("September 2026 · N polls…") +
  `.rd-ap-mavg` ("Average 56.0 – 44.0") at grid-column 5 / span 2.
- **primary**: `.rd-ap-mlab` (label + "average, drawn as rings") +
  `.rd-ap-pnums.rd-ap-mpn` (grid-column 5; five ring-track figure spans
  from `RD_AP_PRIM`, `A[k.id].toFixed(1)`) + `.rd-ap-pic.rd-ap-mpic`
  (grid-column 6; align-self stretch) holding one `.rd-ap-ring` per series
  at `left: pdx(A[k.id])%`. Both `mpn` and `mpic` are desktop-only —
  the JSX gates them on `A && !phone`.

CSS homes are the block of `body.rd .rd-ap-mrow/mlab/mavg/mpn/mpic` rules
in `rd.css` (the mrow grid: `display: grid; align-items: end;
padding: 24px 0 8px; border-bottom`) — bring these down together when
editing row geometry.

## The rings: hollow since 055e117 (2026-10-03, user call)

`.rd-ap-ring` (rd.css, 9px circle, 1.75px party-coloured border set
inline from `RD_AP_PRIM[k].dot`) USED to carry `background: var(--bg)`.
That fill's only effect was ERASURE: the `.rd-ap-mpic` strip emits
nothing but the five rings (rd-allpolls.jsx ~:1715, `A && !phone` —
phone never renders rings; no gridlines, no whiskers, and the mrow
itself carries no background tint), and paint order is the fixed
`RD_AP_PRIM` order (ALP first, then LNP, GRN, ON, OTH). So whenever two
month averages sat close — precisely the fact the rings exist to show —
the later-painted party's opaque fill ate the earlier ring down to a
crescent (LNP's ring swallowed ALP's when the majors ran level).

The user asked whether overlapping rings should "actually overlap rather
than for one ring to just cover the other" — yes. The fill was dropped
(rd.css:2070ff: hollow centre, comment explains). Overlapping rings now
cross Venn-style; the only collision left is a few pixels at each
crossing where the later stroke wins, which reads as a hand-drawn
intersection. Measured live case: closest pair ALP × ON at 1.7px centre
gap on a 9px ring — formerly ~81% erased, now an intersection. Verify
with the uncommitted-scratch probe
`.matilda/probe-ap-ring-intersect.mjs` (1440px primary facet: every
ring's computed background transparent, 5 party border colours intact,
closest-pair centre gap vs ring width; model: All-polls tab →
`.rd-ap-pint` "Primary" pill → `.rd-ap-mrow .rd-ap-ring`).

Contrast with the ROW dots, which went the other way — `.rd-ap-dot`
KEEPS its `--rd-rowbg` halo deliberately (the halo is invisible against
the row and appears only where dots collide, which is exactly the
separator the routinely-overlapping ALP/LNP dots need). User rulings
landed together in 055e117; see
`auspol-allpolls-party-dots`.

## The bug that shaped this (2026-10-01, commit 2447997)

User: "along with the twopp rows, the highlighted row for the September
2026 primary average, drawn as rings, stands out slightly taller",
visible as the primary view sitting "a tad lower" when arrow-walking
facets. Measured headlessly: twopp facet rows 54.75px (WebKit) / 54.84
(Chrome) vs primary facet 61px in BOTH engines.

Root cause was dead CSS. The month-track rule read
`.rd-ap-mpic { grid-column: 6; align-self: stretch; min-height: 22px }` —
but `.rd-ap-mpic` (1 class) has the same specificity as the poll-row
scale-track base rule `body.rd .rd-ap-pic { position: relative;
align-self: stretch; display: block; min-height: 28px }`, which sits
LATER in rd.css. Equal specificity → source order wins → the mpic's
`min-height: 22px` was silently overridden by 28px, and 28px of
stretch-align floor made every primary month row ~6px taller than its
twopp counterpart (whose `.rd-ap-mavg` carries no scale track).

Fix: compound selector `body.rd .rd-ap-pic.rd-ap-mpic { … min-height: 0 }`
— two classes beat the base rule regardless of source order, and the
month track needs no floor at all (the rings are absolutely positioned
inside `.rd-ap-in`, which stretches). Post-fix rows measure identically
on both facets in both engines (54.75 WebKit / 54.84 Chrome).

## The general rule for rd.css variants

When a namespaced variant class (`.rd-ap-mpic`, analogues:
`.rd-ap-hpic`, auto-pill/`ctx` variants) is meant to override a property
the BASE class sets (`.rd-ap-pic`, `.apd-*`), check:

1. Does the base rule set that property at all, and WHERE? Equal
   specificity resolves by source order — a variant rule placed BEFORE
   its base in rd.css silently loses; the variant's value is dead CSS
   and the base's value ships.
2. Fix by compounding (`.base.variant`) or by placing the variant after
   the base — compounding is order-proof.
3. Verify headlessly what actually renders:
   `getBoundingClientRect().height` on the row per facet in BOTH WebKit
   and Chromium (probe model: `.matilda/dbg-ap-mrow.mjs`, which dumps
   labelled `.rd-ap-mrow` heights per facet; built on the
   `~/.matilda-tooling/pw` playwright-core install, never repo-local).

## Why row-height parity matters

The facet arrow-walk / rdPinScroll fixed-view (see
`auspol-rdpinscroll-row-pin`) parks the table so the landing constellation
looks identical across facets; if one facet's month rows are even ~1px
taller, that facet's landings drift visibly off the others and it reads
as "the primary view sits lower". After any month-row change, re-run the
facet-walk probes (`.matilda/dbg-ap-webkit.mjs`,
`.matilda/dbg-ap-pingpong.mjs`) — lap ends must be byte-identical per
facet across laps.

## The phone card-height floor (2026-10-03, user call)

The PARITY contract above has a phone-only twin. On ≤760px the table
collapses to `.rd-ap-card`s whose heights were facet-different *by
anatomy* (each facet's card stacks a different set of slots). User
calls, in order: "each facet … excluding the two PP facet … rows of
identical height" → on being told the landing values, "Why fix the
other facet row heights all to the primary facet row heights?" →
confirmed the floor with the recommended option.

Measured naturals (width-independent across the 320/340/360/390/402
rungs — the sent/issph width ladders keep every issues card one
sentence-line deep): **twopp 93.94 · primary 121.69 · leadership
116.23 · direction 114.78 · issues 114.78**. Primary is the ceiling
by actual content (c1 21.75 + c2 16.19 + gap 2 + five-party figures
row 21.75+4mt + gap 2 + cpic 28+4mt + padding 11+8 + border 1), so
the fix is ONE rule in the `≤760px` block — `min-height: 122px` on
`.rd-ap-card:is(.rd-ap-cprim, .rd-ap-clead, .rd-ap-cdir, .rd-ap-ciss)`
(rd.css, right after the base card rule; the comment there carries
the arithmetic). min-height can only ADD room, so the primary ceiling
is the only uniform value a pure-padding rule can reach; the offered
alternative (shrink primary to ~115px via figures-row type/margin
surgery) was rejected by the user. `.rd-ap-c2pp` is deliberately not
in the selector — user: "excluding the two PP facet".

Two traps this surfaced:

- **The issues facet is NOT internally uniform either** — ranked
  sentences (`.rd-ap-csub-sent` with `<sup>` ordinals, e.g. "Cost of
  living ranked 1st, housing 2nd, crime 3rd") render cards at 118.11px
  vs 114.78px for the unranked placeholder (`.rd-ap-issph`): the `<sup>`
  ordinals grow the sentence line box ~3.3px. The user initially said
  "there's no intra-issues row height variation" — wrong, but moot:
  the 122px floor swallows the 3.33px delta as well as the
  cross-facet ones.
- The floor is on the CARD element only. The month separators
  (`.rd-ap-mrow` on phone: flex-baseline, 22px/0/6px padding,
  ~50.75px) are headers, not poll rows — outside the floor, but the
  probe asserts them facet-identical (span < 1px) because the
  row-parity principle covers headers too.

Pinned by `.matilda/probe/ap-phcard-heights.mjs` (committed): at each
of the five golden phone rungs, every card in each of the four
floored facets is EXACTLY 122px (±0.51), twopp cards stay below the
floor with no min-height, month separators facet-identical, no page
errors.
