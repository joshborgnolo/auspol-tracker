---
name: auspol-cyc-on-ctl-stack
description: auspol-tracker — the Past-cycles opposition-primary card's two One Nation overlay checkboxes ("Combine L/NP and ON" / "One Nation this term") and their .rd-cyc-ctls wrapper, FINAL contract after four rungs (ac5225c own-row stack → 9ddeb92 same-line seating + color-scheme theme pinning → 51e04ba squeeze/un-bold → e9c9066 One-Nation-on-the-title-line seating + single glyph x): display:contents base keeps the desktop row byte-identical; under 640px the ON card's head alone top-aligns (a :has(> .rd-cyc-ctls) flex-start override — every other head keeps flex-end) and the wrapper hugs the row's right edge as a flex column-reverse corner stack, its rows squeezed (min-height:0 against the site-wide 44px .rd-check touch target, 15px glyph, line-height 1.15, row-gap 0) so One Nation lands ON the chart-name line with Combine tight below it, and align-items:stretch puts the two checkbox glyphs on one x. Covers where the pair lives (RdCycleChart .rd-chead in rd-cycles.jsx ~:226, gated on M.onp — the oppr card only; the Hanson box keeps no wrapper), why a wrapper span not a className (RdCheck rd.jsx:962 takes no className prop), the cyc-ctl-stack.mjs geometry+theme probe (port 9008, pixel-sampled native checkbox faces), and the font-weight/min-height specificity traps (chead 600 inheritance, rd.css:377's 44px floor).
source: auto-skill
extracted_at: '2026-10-01T14:01:37.222Z'
---

# Past-cycles One Nation checkbox pair — phone stacking via display:contents wrapper

User requests (2026-10-02, six follow-ups after the first rung): stack the
pair right-aligned (One Nation on top) — then "in line with Opposition's
primary vote (chart title)", "tighter together still, less linespaced",
"checkbox font should not be bold", "why are those checkboxes black, even
in light mode", then (e9c9066) "one nation this term should be on the
exact same line as the chart title, with Combine just below that" and
"the checkbox icons themselves ought to be aligned with each other".
Desktop layout preserved throughout. Four commits: ac5225c (own-row
stack), 9ddeb92 (same-line seating + theme pinning), 51e04ba (squeeze +
un-bold), e9c9066 (One Nation ON the title line + one glyph x).

## Theme pinning: native controls follow the DEVICE scheme unless told otherwise (9ddeb92)

"Black checkboxes in light mode" was NOT a site bug number one can fix
with a background rule: the site's theme is a `body.dark` CLASS (no
`prefers-color-scheme` CSS anywhere), while native form controls paint
from the RESOLVED `color-scheme` — which the markup's
`<meta name="color-scheme" content="light dark">` resolves from the
DEVICE, not the class. A dark-mode phone shows dark checkbox faces even
on the site's light theme. Fix lives in template.html `body` rules:

```css
body { color-scheme: light; }
body.dark { color-scheme: dark; }
```

Now native controls honour the site's OWN theme (its auto mode still adds
`.dark` when the device goes dark, so nothing regresses). Probe teaches:
Chrome's COMPUTED `background-color` of a native checkbox is unreliable
(nil-bearing surfaces both ways) — verify the face by pixel, not by
computed style (see the theme rung under Verification; per rung + 1s
extra settle time before sampling).

## Where the pair lives

Both checkboxes render inside `RdCycleChart`'s `<div className="rd-chead">`
("the chart's own name over it") in `.build/newtracker/assets/rd-cycles.jsx`
(~:226), each gated on `M.onp`. `Mby.onp = { key: "oppr", leader: "opp",
unit: "%" }` (rd-cycles.jsx ~:390), so the pair appears on exactly ONE card:
the opposition-primary chart in `#cyc-primary` (`#cyc-primary .rd-cyc-chart`
is the probe handle). The `Pauline Hanson this term` box is separate
(`hanCtl`, on a leaders card in `#cyc-leaders`) — anything scoped to the ON
pair must NOT touch the Hanson head; probes assert its head carries no
`.rd-cyc-ctls`.

State (showComb/showOnp + setters) is threaded from the d1a1d215 tabbed-views
layer through `CycleChart` (defined in the d1a1d215 built asset) into
RdCycleChart as props — layout work never needs to touch it.

## The pattern: display:contents base, breakpoint-switched container

`RdCheck` (rd.jsx:962) accepts ONLY {checked, onChange, children, title} —
no className passthrough — so per-check classes are impossible without
touching the shared component. The fix wraps the pair in a container span
instead:

```jsx
{M.onp && <span className="rd-cyc-ctls">
  <RdCheck checked={showComb} onChange={setComb}>Combine L/NP and ON</RdCheck>
  <RdCheck checked={showOnp} onChange={setOnp}>One Nation this term</RdCheck>
</span>}
```

CSS (rd.css ~:1685–1703, right after the chead wrap rule) — the FINAL
contract as of e9c9066:

```css
body.rd .rd-cyc-chart .rd-check { font-size: 13px; font-weight: 400; }
body.rd .rd-cyc-ctls { display: contents; }

/* 2026-10-02 headgap fix: the .rd-cyc-chart .rd-chead ruleset just above
   these now ALSO carries margin-top: 0 — the generic 16px chead margin
   collapsed away inside .rd-cyc-one but rendered inside the .rd-cyc-two
   grid cards (primary/charts sat 16px low). Intra-head-row geometry this
   skill asserts is unaffected. See auto-skill-auspol-cyc-head-gap. */
@media (max-width: 640px) {
  body.rd .rd-cyc-chart .rd-chead { align-items: flex-end; }
  body.rd .rd-cyc-chart .rd-chead:has(> .rd-cyc-ctls) { align-items: flex-start; }
  body.rd .rd-cyc-ctls { display: flex; flex-direction: column-reverse; align-items: stretch; row-gap: 0; margin-left: auto; }
  body.rd .rd-cyc-chart .rd-check { line-height: 1.15; min-height: 0; }
  body.rd .rd-cyc-chart .rd-check input { width: 15px; height: 15px; margin-top: 1px; }
}
```

Why each part:

- **`display: contents` base** — the wrapper vanishes from the box tree, so
  its two children remain direct participants in the chead's flex row
  (gap, order, wrap all identical). Desktop is byte-identical to the
  pre-wrapper layout; no desktop probe rung needed to catch a regression.
- **`flex-direction: column-reverse`** — DOM order stays Combine→One Nation
  (desktop left-to-right order unchanged); column-reverse puts the LAST DOM
  child on top, i.e. One Nation's own overlay on top on phone, without any
  desktop-visible reordering. (Swapping DOM order and compensating with CSS
  `order` on desktop is the worse route — two decorations instead of one.)
- **`margin-left: auto`, NO flex-basis:100% (9ddeb92)** — the first rung
  (ac5225c) forced the pair onto its own row under the name with
  `flex-basis: 100%`; the user's "in line with Opposition's primary vote
  (chart title)" line killed it. NO flex-basis + auto left margin seats the
  stack on the SAME line as the name, pushed right. The MARGIN absorbs all
  per-card width variance (the pair's width is font-fixed) — a
  content-box-pinned stack absorbed nothing and overflowed at 640–700px.
  Anchor the margin on `.rd-cyc-ctls`, not a bare `.rd-check` — the latter
  would inject unmeasured space into the desktop row.
- **Head seating: `flex-end` base + a `:has(> .rd-cyc-ctls)` `flex-start`
  override (e9c9066)** — 9ddeb92 bottom-aligned every chead so Combine
  shared the name's BOTTOM (the name's line-height is taller: bottoms
  coincide, centres don't). The user's "exact same line as the chart
  title" follow-up re-seats ONLY the ON card's head to the top:
  `.rd-cyc-ctls` is a DIRECT child of the chead, so
  `.rd-cyc-chart .rd-chead:has(> .rd-cyc-ctls)` targets exactly that head
  (`:has()` is already an established rd.css pattern, ~11×, e.g. :294
  `.chart:has(> .chart-copy-btn)`); Hanson's bare-RdCheck head has no
  wrapper child and is untouched, as is every other card's head (the
  `flex-end` base rule still covers them). Top alignment drops the
  two-row column one row: One Nation's TOP ≡ the name's top (the name is
  one line at 390px — verified both 4568.8px), Combine hangs one squeezed
  row below, gap 0.
- **`align-items: stretch` on the wrapper, not `flex-end` (e9c9066)** —
  the labels differ in width ("Combine L/NP and ON" vs "One Nation this
  term"), so right-aligned rows put the GLYPHS (each row's first child,
  `gap:10px` before the label) on staggered x's — the exact stagger the
  user flagged. Stretch makes both rows span the widest label, so the two
  checkbox inputs share one left x, while their right edges still
  coincide at chead.right (the auto margin anchors the column as one
  block). Verified pixel-exact at 390px: combInX = onpInX = 214.6.
- **The squeeze (51e04ba)** — rd.css:377's SITE-WIDE touch-target rule
  `body.rd .rd-check { min-height: 44px; display: inline-flex; align-items: center; gap: 10px; … }`
  gave each row 44px of line-spacing; row-gap, line-height and the 15px
  glyph alone can't beat it. The phone block drops `min-height: 0` on
  these two rows (each 44px → 16px), row-gap 0, native 18px glyph → 15px
  (`width/height: 15px; margin-top: 1px`), label line-height 1.15 — the
  pair reads as one control. Trap: a squeeze that only touches
  row-gap/line-height STILL renders 44px rows; probe `comb.h` to catch the
  silent min-height.
- **`font-weight: 400` on every cyc-chart check (51e04ba)** — `.rd-chead`
  carries `font-weight: 600`, which inherits INTO the checkbox labels;
  RdCheck sets no weight of its own. Dummy-probe diagnosis (inject a bare
  position:fixed check → weight 400 confirms the chead is the source).
- **Breakpoint 640px, not 900px** — the tab's layout collapse is 900px, but
  at 641–900 the card is already full-width and the pair still fits beside
  the name; the user asked for PHONE. 640px is the rd.css phone rung. Probe
  proves 760 still rows.

## Verification

Probe `.matilda/probe/cyc-ctl-stack.mjs` (PORT 9008; `.matilda/probe` is
gitignored — force-add with `git add -f` when committing). Bootstraps
`/#cycles`, waits for `#cyc-primary .rd-cyc-ctls`, one collector
(`readLayout`, hoisted geometry read before any scroll) serves all
asserts. Covered rungs 390×844-touch, 760×900, 1440×960, plus a 390-dark
theme rung. Asserts after the e9c9066 geometry:

- **all rungs** — wrapper only on the ON card (Hanson head carries none);
  DOM order Combine→One Nation (asserted separately from VISUAL order —
  column-reverse makes those two different questions); label font-weight
  400 on both boxes (defeats the chead's inherited 600).
- **390** — wrapper `flex column-reverse`; One Nation's TOP ≡ the chart
  name's top (the e9c9066 on-the-line seating — pre-e9c9066 this asserted
  Combine's BOTTOM ≡ the name's bottom); One Nation fully above Combine;
  pair gap ≤2px; rows squeezed (≤17px each — catches a silent rd.css:377
  min-height); the name clears the column to its left (title.right ≤
  ctls.x + 1); the two GLYPHS share one left x (collector gained
  `combInX`/`onpInX` — the input rects' x, ±1px); right edges coincide
  AND reach chead.right (auto-margin proven, not merely
  siblings-aligned); wrapper < 0.7×chead.w (corner stack, not a
  full-width band); both boxes right of the head row's left half;
  `docW ≤ vw + 1`.
- **760 / 1440** — wrapper `display: contents`; both boxes one row (same
  centre-y ±4px), Combine left of One Nation, on the name row; no
  overflow.
- **theme rung** — emulate a dark OS; auto theme puts `.dark` on body,
  computed `color-scheme: dark` on the input, and the native unchecked
  face reads DARK by PIXEL SAMPLING (clip an 8px box at the input's
  screen position pre-scroll — the collector hoists the coords before
  any scrollIntoView throws the rect off); strip `.dark` and the face
  reads light while the device still says dark (000,0,0 meta isolates
  the body's `color-scheme: light`). Headless Chrome tip: a full-page
  shot keeps fixed-position overlays PAINTED (real compositing) — flags
  that skip the compositor hide the pill stack bug the theme rung guards.

`node .build/newtracker/build.mjs` rebuild, probe green at all four rungs,
`validate.mjs` exit 0, `npm test` green — all confirmed 2026-10-02
(e9c9066; the 760/1440 display:contents rungs and the theme rung carry
over untouched from 51e04ba).

## Adjacent traps hit during this rung

- **Build pipeline**: rd-cycles.jsx is a FIRST-CLASS source in the JSX list
  of build.mjs (~:90) — edit it directly; only `CycleChart` (the state
  wrapper) lives in the d1a1d215 compiled layer.
- **Sibling artifact swap**: a probe red on freshly-shipped CSS with
  `display` computing to a default (`block` for the span) at EVERY width
  meant the built index.html no longer carried the CSS — a sibling's
  stash→commit→pop had replaced the dirty artifact while git status stayed
  ` M`. Re-grep the marker in index.html and `git log -3` before debugging
  the CSS (see auto-skill-shared-repo-session-race, 2026-10-01 cyc-ctls
  rung section).
- **Probe collector key drift**: reading `.top` from a collector that
  emitted `y`/`cy`/`bottom` yields undefined → NaN comparisons → phantom
  reds that look like layout bugs.
- **A sibling's DIRTY probe pairs with THEIR uncommitted work** — the
  worktree `probe-cyc-chipmove.mjs` asserted a sibling's unlanded
  eye-restore row and red against a clean HEAD build (e9c9066
  verification). Run HEAD's copy instead:
  `git show HEAD:.matilda/probe-cyc-chipmove.mjs > .matilda/.chipmove-head.mjs && node .matilda/.chipmove-head.mjs` —
  never trust a gitignored probe at face value in a shared tree (see
  auto-skill-shared-repo-session-race).
