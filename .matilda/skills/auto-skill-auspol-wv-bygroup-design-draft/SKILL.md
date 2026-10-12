---
name: auspol-wv-bygroup-design-draft
description: auspol-tracker — the Who-votes BY-GROUP orientation design mock (.matilda/wv-by-group-design.html), the contract shipped into it 2026-10-08 (chips in their own row at every width, short chip labels with ages moved to the sethead, neutral-ink legend glyphs, the designed phone view — 2-row sethead + tab-strip edge fades), its probe, and the "whose copy is this" triage lesson that separated mock from shipped panel
source: auto-skill
extracted_at: '2026-10-08T05:45:28.488Z'
---

# Who votes for whom — the by-group design DRAFT

`.matilda/wv-by-group-design.html` is a self-contained, interactive HTML
mock (~600 lines: redesign tokens → section CSS mirroring the site's class
contract → markup → an in-page `draw()` with illustrate-only stand-in data)
for a FUTURE by-group orientation of the Who-votes panel (rows = parties,
chips pick the group; the shipped panel in rd-panels.jsx ~:1430 is by-party:
rows = groups, chips pick the party). Nothing consumes it — it's iterated
in the browser, and it is NOT the built site despite carrying the site's
`.rd-*` class contract.

## Triage lesson (moot)

The user reported the group toggles mispositioned and "the legend just
takes the colour of the greens" — symptoms that existed ONLY in this mock.
The disambiguator was verbatim copy: the user's pasted legend items
("Dashed: that party's all-voters share", "Each poll's own reading") match
the mock's key builder, while the shipped What's-the-facet legend reads
"One poll pooled" with a "Right-hand column: difference from all voters"
note (rd-panels.jsx ~:2413). **When a UI bug report names no URL or file,
grep the quoted copy first to learn which artefact owns it before touching
shipped code.** Corollary from the same session: the frozen conversation-
snapshot git status lied — files listed as modified had been
committed/reverted by sibling sessions by the time `git status` ran live.
Re-probe state, never trust the snapshot.

## The contract shipped into the mock (2026-10-08)

1. **Group chips live in their OWN row at every width.** They were
   rendered inside the dimension tab row after a `flex-grow` spacer —
   7 dimension tabs ×~90px plus 4 chips labelled "Gen Z (aged 18–29)"
   ≈1180px vs the 1152px page cap, so chips wrapped mid-row as a lone
   second line ("mispositioned", "take up too much space"). The phone-only
   `.rd-chips-row` became the single home `#wv-chips-row`
   (`display:flex; flex-wrap:wrap; gap:8px; margin-top:12px`); the inline
   `#wv-chips-inline` and `.rd-tabs-grow` are gone.
2. **Chips carry SHORT labels; the age bracket moved to the sethead.**
   Generation groups are "Gen Z"/"Millennials"/"Gen X"/"Boomers" with a new
   per-group `ages:"(aged 18–29)"` field appended to `#wv-glabel`
   ("By generation: Gen Z voters (aged 18–29)") — the mock's echo of the
   shipped RdGenBorn "(aged …)" convention (auto-skill-auspol-gen-born-brackets).
3. **Legend glyphs are neutral, never a party colour.** The plot is
   multi-party, so the key SVGs use `var(--ink)` (dots, all-voters dash),
   `var(--ink-3)` (whisker), `var(--ink-2)` at fill-opacity .55 (per-poll
   speck); they were hardcoded `var(--grn)` and read as Greens. (The
   by-party shipped panel may use `pColor` because it owns a single party;
   the mock owns none.)
4. **Phone: tab row scrolls, chips wrap.** The 7-tab dimension strip
   (~550px) itself overflowed ≤480px viewports — a second, PRE-EXISTING
   defect the probe surfaced (constant width regardless of the active dim,
   because `.rd-tabs` is an unwrapped flex row). Fix: at ≤640px the row is
   `overflow-x:auto; overflow-y:hidden; scrollbar-width:none` — the y-lock
   matters (bare overflow-x:auto computes y to auto), same as the shipped
   pinned strips (auto-skill-auspol-strip-xscroll-ylock). Chips row wraps
   (`nowrap`→`wrap`) at the phone rung; the desktop chips-row-breakpoint
   CSS and `.rd-tabs > .rd-chips{display:none}` were deleted since the row
   is always the row now.

5. **The phone view is DESIGNED, not just safe.** Two defects remained
   after item 4: the sethead's label collided with the "vs all voters"
   columnheader (they shared one grid row of minmax(0,1fr) auto auto, so
   the label wrapped early at ~39px sethead height), and the tab strip's
   sideways scroll was invisible (no affordance, 134–164px hidden). The
   phone rung now re-grids the sethead to two deliberate rows —
   `.rd-wv-sethead > span:first-child { grid-column: 1 / -1; grid-row: 1 }`
   with `#wv-ghouses { display: block }` inside it (houses get their own
   line so the bold "By …: group (aged …)" headline always renders one
   line — "By generation: Gen Z voters (aged 18–29) · Resolve" as one
   full-width inline cluster still wrapped at the 320px rung because the
   bold 600-weight headline runs ~280px and appending the houses inline
   pushed past the ~290px usable width), and
   `.rd-wv-vs { grid-column: 1 / -1; grid-row: 2; text-align: right }`
   beneath, over the delta column. The tab strip got the site's
   `.ovf-l`/`.ovf-r` edge-fade contract verbatim: mask-image 28px
   gradients per edge (both-edge form when mid-scroll), toggled by the
   strip's own scroll listener (`scrollLeft > 1` /
   `scrollLeft < scrollWidth - clientWidth - 1`, a `+1` slop over the
   overflow test) plus a resize re-mark; the strip also takes
   `overflow-y: clip` with `padding-bottom: 1px; margin-bottom: -1px` so
   the chosen tab's 2px underline — which hangs 1px over the row's rule —
   stays inside the clip (the pattern as shipped in rd-allpolls.jsx
   :2251 + rd.css :2626–2648, not an invention).

## Verification — `.matilda/probe/wv-bygroup-probe.mjs`

puppeteer-core + real Chrome (harness copied from
`.matilda/probe/dir-facet.mjs`: cwd-then-home createRequire, file:// URL).
Re-run after any edit to the mock. It sweeps 9 widths (1440→320) and, at
each, clicks all 7 dimension tabs asserting
`scrollWidth ≤ clientWidth` — the dim-click sweep is the bit that would
have caught every variant of this bug — plus: no `#wv-chips-inline`, tab
row height ≤48px, chips row top ≥ tab row bottom, phone-rung chips fully
inside the viewport (Place and Generation dims), short chip labels, sethead
carries "(aged 18–29)", and legend neutrality. The phone-design assertions
(≤640px rungs): the `#wv-glabel` bold headline renders ONE line (≤24px,
its own getBoundingClientRect, not the cell's — the cell legitimately
holds two text lines at phone), `#wv-ghouses` starts a line below the
headline, "vs all voters" a line below that; and the tab strip carries
`ovf-r`-and-not-`ovf-l` at rest exactly when it overflows, flipping to
`ovf-l`-not-`ovf-r` with a non-`none` maskImage when scrolled to max
(drive it with `sc.scrollLeft = ...` inside evaluate and ~80ms waits —
the classes are listener-set, so they lag a frame). 125 checks, 0 failures
on the shipped contract.

Two reusable probe idioms from this session:

- **Comparing against a TOKEN colour**: you can't string-match `var(--grn)`
  on computed styles — mount a temp element with `background: var(--grn)`,
  read its computed rgb, then assert every `#wv-key svg *` computed
  `stroke`/`fill` differs.
- **Diagnosing "page overflows but my fix is in":** one page.evaluate
  walking all elements reporting `getBoundingClientRect().right >
  clientWidth` with their selector printed the overflowing `.rd-tab`
  immediately — the constant-across-tabs overflow amount was the tell that
  the fault was the tab strip itself, not the chips.

## Scope boundary

The mock's fixes touched NOTHING in the shipped panel. If the by-group
orientation ever ships, the work happens in rd-panels.jsx/rd.css (and the
skills named above apply), and the mock is scaffolding with the same
"agent as scaffolding" status as the first-contact prototypes — never a
target to keep in sync per-commit.
