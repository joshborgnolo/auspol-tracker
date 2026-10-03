---
name: auspol-latest-next-polls-table
description: "auspol-tracker — RdPolls ('Latest and next polls' section) anatomy: facet tabs (twopp/primary/leadership) via rd.jsx RdSec data-facet, 6-column desktop grid in rd.css (~:557), per-facet grid-template-columns overrides are a media-query leak hazard (@media (min-width:901px) needed), the facet RdSwap crossfade ghost must stay OUT of flow (position:absolute float, fixed 2026-09-28) or the phone's content-sized figs track snaps ~360ms in when the ghost unmounts, the DESKTOP figs cell must stretch to the row top (6142f35), and the expanded row's change markers reuse rdApChg + gen-data chg.d/r keys shared from rd-allpolls.jsx (ce17e27, 2026-09-30 — dec conventions, filtered-index trap, probe expand via $eval click on the figs cell since the name cell is a site link), and a CSS specificity trap: .rd-pld-prim > span > span (19px) swallows any new child span including .rd-apd-chg markers — fix with :not (48131ae), verify cross-table marker parity with computed-style sets since All-polls swaps classes and primary order; probe facet glitches with a per-frame rAF geometry recorder, NOT strided setTimeout samples. 2026-09-30 (9a87ded): facet figures "slow to populate" vs All-polls = RdSwap's .12s arrival delay on .rd-swap-now.in (a 120ms invisible dead zone on every tab switch) — dropped to `.2s ease-out both`; RdSwap serves ONLY this table's figs head+cells so the retime cannot touch RdCrossfade's (deliberate) identical delay, and mixed-precision primary figures (Roy Morgan's .5 halves) render the half as one ½ glyph (a one-on-two superscript form) absolutely positioned RAISED beside the integer inside .rd-pl-halfwrap, out of flow (.rd-pl-half, 9.5px/8.5px, final 2026-10-02 after two in-flow runs were measured and reverted same-day — any in-flow suffix shifts the fixed-lattice figure: desktop row gaps stutter and the phone's right-aligned figs walked every suffixed column's integers 7.3px sideways) — invisible padding inside the stretched grid cells CANNOT equalise ink gaps, and shrinking suffix ink only narrows a shift it can never zero; out-of-flow placement removes the shift entirely." 2026-10-03 (8d472e8): the All-polls rdPinScroll pinned-view contract ported in — pinPl anchors [.rd-pl, .rd-pl-tabs] TABLE FIRST (twopp-only .rd-pl-ctlrow mounts/unmounts in flow between tab row and table on ≤900px) with the fine-pointer opt-in, and every facet-changing input routed through pickFacet/flipPick/basisPick wrappers (RdTabs click+swipe, rdTabsKey arrows, hover keys now closing over live `facet` w/ deps [facet], row-nav, space/p hotkeys, flip + qpop basis switch); full recipe + probe traps in the auspol-rdpinscroll-row-pin skill, probe .matilda/probe-latest-pin.mjs ALL PASS at 480+1440.
source: auto-skill
extracted_at: '2026-09-28T02:47:51.147Z'
---

# RdPolls — the "Latest and next polls" table (redesign)

Source: `.build/newtracker/assets/rd-polls.jsx` (489 lines, plain prop of
`RdSec` from `rd.jsx`) + its CSS block in `rd.css` at ~:545–712.

## Structure

- `RdPolls` (~:26): facet state `twopp | primary | leadership`, `sort` state
  (`pollster|latest|next` + caret), `open` row state, `tl` tooltip state for
  the releases strip.
- Desktop row (`.rd-pl-row`) is a 6-track CSS grid
  (`name 170 | latest 124 | figs 236 | tl minmax(0,1fr) | next 176 | exp 28`),
  declared at `rd.css:661-667`; the `tl` (releases strip) track is the only
  flexible one. 2026-10-03: the figs track was made UNIFORM across facets
  (the primary facet's 200px override was deleted) — a per-facet figs width
  shifts and re-scales the strip's date→pixel map on every facet switch, and
  the strip must sit still while only the figures change (active design
  principle, user-approved; it also closes the facet-override leak class
  below by removing the override entirely). A `@media (max-width:1100px)`
  narrow-desktop variant and a `@media (max-width:900px)` phone stacking
  variant follow (~:674-710): the phone layout switches to
  `grid-template-areas: "name figs" "tl tl" "foot foot"`,
  hides latest/next/exp cells, and shows `.rd-pl-foot1` instead.
- `figHead`/`figCell` (~:172-217) swap per facet: twopp = Labor-v-rival pair
  (basis=tfff/implied), primary = 5-party `.rd-pl-prim` mini-grid (RD_PL_PARTIES),
  leadership = preferred-PM + net approval line.
- Facet lives on the section: `RdSec` (`rd.jsx:18`) writes `data-facet={facet}`
  on the `<section id="latest-polls">`, and CSS keys per-facet overrides off
  `body.rd .rd-polls[data-facet="primary"]`.

## The facet-override media-query trap (fixed d2c809f, 2026-09-28)

`rd.css` had a per-facet override
`body.rd .rd-polls[data-facet="primary"] .rd-pl-row { grid-template-columns: 170px 124px 200px … }`
sitting unconditionally at top level. Its attribute+class selector beats the
baseline `body.rd .rd-pl-row` media-query rules in specificity, so under
900px the primary tab kept the desktop 6-column template while every other
facet correctly stacked — rows shrank to ~298px of an 480px phone row with a
right-edge gap, exactly the user-visible "squished to the left" symptom. Fix:
wrap any per-facet `grid-template-columns` override in
`@media (min-width: 901px)` so the stacking rule reclaims the row on phones.
When adding another per-facet column tweak, it MUST NOT outrank the
`max-width: 900px` stacking block.

## The facet-swap ghost sizing trap (fixed 2026-09-28, commit 105dfd1)

Figure cells and the figures header swap per facet through `RdSwap`
(rd.jsx): on a key change the outgoing copy stays mounted ~360ms after the
incoming one lands so the first can fade out under it. The original CSS put
BOTH copies in one grid area of `.rd-swap`, so during the fade the cell
computed its box from max(old, new) — on a phone, where the figures track
is `auto` (content-sized) and right-aligned, the right-anchored box kept
the OLD content's width/height for ~360ms, then snapped smaller/wider when
the ghost unmounted. Probe-measured at 390px: after Primary→2PP the first
row's `gridTemplateColumns` flipped `188px 150px → 248.6px 89.4px` at
t≈372ms (cell jumped ~60px right); 2PP→Primary shifted the cell's top +9px
at t≈375ms. That was the user-visible "digits shift a beat late" glitch.

Fix: the outgoing copy is `position: absolute; top:0; right:0; left:0;
min-width: max-content` (out of flow, width-capped to its own natural size
so it never wraps), inside `.rd-swap` now `position: relative`; only the
incoming copy ever sizes the track. Under the 900px phone block the float
is right-anchored (`left:auto; right:0`) inside `.rd-pl` cells so it fades
exactly over the right-aligned figures it replaces. Don't put the ghost
back in flow — desktop's fixed px columns wouldn't bounce, but any
content-sized track (all phone facets, any future auto column) will.

## The desktop figure-align trap (fixed 6142f35, 2026-09-28)

Reported as "on my laptop … numbers start higher momentarily and then
glitch into place" in primary view — sounded EXACTLY like the phone ghost
bounce above, but the per-frame rAF recorder proved there was no transient
at all on desktop: geometry was final within the first sampled frame. The
complaint was a PERSISTENT per-facet mis-registration: `.rd-pl-row`
declares `align-items: center`, and the `.rd-pl-c-figs` cell is a flex
column whose content differs per facet — primary is a single-line
`.rd-pl-prim` mini-grid (15px/600) while twopp/leaders are two-line
main+sub stacks. Centring puts the one-line primary digits ~8–9px LOWER
than the other facets' digits, so switching into primary visibly drops
every figure even with zero animation.

Fix: `@media (min-width: 901px) { body.rd .rd-pl-row > .rd-pl-c-figs {
align-self: stretch; justify-content: flex-start; } }` — exactly one slot
(row top + 10px padding) in every facet. Phone untouched (≤900px block
already stacks and was fixed in 105dfd1).

Probe lesson (cost a wasted diagnostic lap): strided `setTimeout`
sampling discovers STATIC geometry but cannot tell a one-frame transient
from a persistent offset — use a per-frame rAF recorder during the click
(`.matilda/probe-rdpl-desktop2.mjs`) and diff consecutive frames before
concluding "no animation". Trap: synthetic `btn.click()` doesn't set
`window.__rdInput`, so RdGlide/RdSwap input gates stay shut — probe with
real `page.mouse.click` and `scrollIntoView({block:"center"})` + ~300ms
settle first.

## The phone main-line alignment trap (fixed 2026-10-01)

User report: on phone, leadership rows' "Albanese x–y Taylor" ppm strings
left-aligned for SOME houses (Newspoll, DemosAU, RedBridge + Spectre's "No
preferred-PM question" fallback), right-aligned for others. Mechanism: the
phone figs cell is a flex column with `align-items: flex-end; text-align:
right` (rd.css 900px block), and `.rd-pl-lead`/`.rd-pl-fig` inside it
STRETCH to the widest of their two lines (main ppm vs sub net-approval).
`text-align: right` reaches the plain-block `.rd-pl-sub`'s inline text but
NEVER `.rd-pl-main`'s text: base rd.css gives `.rd-pl-c-figs .rd-pl-main`
`display: inline-flex`, so its content is flex items packed at
`justify-content: flex-start` = LEFT. Any row whose sub line is the wider
of the two parked its main line left — hence only some houses. Fix is ONE
property in the 900px block: `.rd-pl-c-figs .rd-pl-main { justify-content:
flex-end; }` — do NOT try `text-align` on a flex main line (inert), and
keep the rule media-gated: desktop's computed jc is `normal` and the
change must not leak (probe trap: computed jc default is `normal`, NOT
`flex-start` — a `=== "flex-start"` desktop gate false-fails). Pinned by
probe `.matilda/pl-lead-align.mjs` (scratch): ranges every row's
main/sub text rects vs the cell's right edge at 390px on Leadership AND
2PP, plus the desktop gate.

## The figures-population timing (user-complaint fix 9a87ded, 2026-09-30)

User report: the table's figures column ("Labor v One Nation",
"ALP/L-NP/GRN/ON/OTH", "Preferred PM, net approval" — the THREE figHead
variants was the tell it was the whole column, all facets) is "a little slow
to populate" compared to All-polls' instantaneous. Diagnosis by measurement,
not code-reading first:

- **Initial page load was exonerated by a cold probe** — rows AND figs
  populated at ~86ms from domcontentloaded, `figOp=1`, zero `.rd-swap-was`
  ghosts. So the complaint was the FACET SWITCH, not the mount.
- **The switch recorder** (`page.evaluate` arms a per-rAF sampler BEFORE the
  synthetic click, samples `has/txt/opacity/wasCount`, prints changes-only):
  the incoming figs mounted at ~12ms ALREADY at opacity 0 and STAYED
  invisible until ~130ms (a 120ms dead zone, all 8 rows + the head at once),
  full opacity at ~330ms. Cause: `.rd-swap-now.in { animation: rd-xf-in .2s
  ease-out .12s both }` (rd.css ~:305) — the `.12s` delay is the RdCrossfade
  "out, then in" hand-off (rd.css :284 comment: two views' headlines
  half-seen read as a double exposure). All-polls' tab figures animate
  `.2s ease-out both` — NO delay, no ghost — hence "instantaneous".
- **Scope check before retiming**: `RdSwap k=` has exactly TWO call sites,
  both in rd-polls.jsx (figHead :500, figCell per-row :527) — the component
  serves only this table, so the timing edit cannot leak into RdCrossfade's
  panels (whose identical `.12s` delay stays).
- **Fix**: `.rd-swap-now.in { animation: rd-xf-in .2s ease-out both }` + a
  why-comment (the ghost still fades out underneath for its 130ms; figures
  are short, no double-exposure risk). Re-probe: first visibility inside 2
  frames (opacity .26 at ~45ms), full at ~210ms.
- **Probing trap**: `#rd-ap-top` does NOT exist on the Snapshot page — the
  All-polls view only mounts under the `#allpolls` hash; a
  `waitForSelector("#rd-ap-top")` on the snapshot view burns the whole 30s
  timeout. (Cost one probe run.)

## Mixed-precision primary figures (Roy Morgan halves) — worked 2026-10-01

User report: "roymorgan uses decimal places and this fucks up the latest and
next polls table primary view: 26 / 22.5 / 14.5 / 25.5 / 11 … the spacing is
a little off". Fix lives in `figCell`'s primary branch (`primFig()` splits
`toFixed(1)` into int + fraction) + the `.rd-pl-frac` rule beside
`.rd-pl-prim` in rd.css. Commit state at write time: CHANGE UNCOMMITTED in
the working tree (rd-polls.jsx + rd.css + rebuilt index.html).

- **Root geometry**: `.rd-pl-prim` is `repeat(5, minmax(0,1fr))` over a
  FIXED track (desktop figs 200px via the facet override → ~36.8px cells;
  phone `min-width:150px`/14px → 26.8px cells), text hugging left. The ink
  gap after a figure = cellW + col-gap − inkWidth, so the alternation
  amplitude between an integer and an x.5 figure is exactly the ".5" suffix
  width (~13px at 15px). Roy Morgan is the only house publishing `.5` halves
  in `p`, so only its row stuttered (24/12px alternating gaps); on the phone
  a full-size 4-char figure (~30.9px) overflowed its 26.8px cell into the
  column gap.
- **The burned-lap trap**: padding integers with an invisible ".0" slot
  (JSX class + `::after { content:".0"; visibility:hidden }`) does NOTHING —
  the items are already stretched fixed cells, so hidden glyphs inside an
  item move nothing. More generally: any per-cell anchor (left, right,
  centre) leaves the ink-gap variance intact, because the gap after figure i
  always depends on someone's ink width. Equal advance widths ≠ equal ink
  gaps. Only shrinking the ink-width DIFFERENCE itself (or altering the
  data: rounding to whole, or printing fake ".0"s — both misstate the poll)
  changes the rhythm — and shrinking only NARROWS a shift it can never
  zero; taking the suffix out of flow (below) removes the shift entirely.
- **Shipped fix** (final, same day — two in-flow runs measured and
  reverted first): the half casts as one ½ glyph (U+00BD — already a
  one-on-two superscript form, so sup/sub markup on "1/2" buys nothing
  and prints wider) ABSOLUTELY positioned out of flow. primFig wraps
  halves in `<span class="rd-pl-halfwrap">{i}<b class="rd-pl-frac
  rd-pl-half">½</b></span>` (inline-block relative wrap); the suffix
  sits `left:100%; bottom:0.85em` (0.55em sat too low — anchor cap-top,
  not baseline) at 9.5px/8.5px, raised like an edition
  marker — ink floats 4.8px/5.4px above the integer baseline
  desktop/phone, its top 1.2/1.6px below the digit cap line. The
  integer alone sets the layout, so every poll's primaries share the
  column exactly (probe spread 0 on all five mini-columns at both
  widths) and the near-wrapping 4-char phone figure can never return.
  Non-.5 decimals keep a plain in-flow 11px/10px `.x` suffix; `.0`
  drops. The load-bearing failure of the in-flow runs (user catches,
  same day): (a) ½@11px's ink (9.5px) TOPPED the ".5" pair (~8.25px) it
  replaced — IBM Plex Sans advances U+00BD at ≈0.86em; (b) ½@9.5px in
  flow fixed the desktop rhythm (gaps 22.8/14.6×3) but the phone's
  right-aligned figs cell walked every suffixed column's integers 7.3px
  left of every other row's — shrinking ink only narrows that shift, it
  never zeroes it. DOM text still reads "32½" — the true figure, no
  aria games. Measured after (.matilda/probe-pl-frac.mjs, scratch,
  rewritten for the out-of-flow contract: per-column integer-edge
  spreads, lift/cap-top windows, collision + horizontal-overflow +
  row-height gates): ALL PASS at 1280 and 390.
- **Probe lessons** (`.matilda/probe-pl-prim-decimals.mjs`, scratch):
  (a) a stretched grid item's `getBoundingClientRect` returns the CELL, not
  the text — one whole probe pass measured "uniform gaps" that were just the
  equal columns; measure ink with
  `Range.selectNodeContents(el).getBoundingClientRect()`.
  (b) The phone figs cell inherits `text-align: right`, so phone ink
  right-aligns inside each cell — shifted ink on ≤900px is NOT a broken
  grid (the deep dump `.matilda/probe-pl-prim-phone.mjs` confirmed uniform
  26.8px tracks while ink wobbled).
  (c) Clicking the facet tab at phone widths: scroll the TAB BUTTON into
  view and clamp the mouse coords; the tabs are `.rd-tab` buttons (no ARIA
  tab roles on this table) and bare synthetic `.click()` never switched the
  facet (first pass silently measured zero rows).
  (d) Out-of-flow absolute suffix probe traps: an element rect on a PADDED
  absolute suffix includes its `padding-left` gap (would read ~1.5px too
  much "ink") — measure glyph ink on `sfx.firstChild` (the text node);
  keep the ELEMENT rect for collision checks, since the pad is part of
  its footprint. And a prefix-range text node's `int.b` lands ~3px BELOW
  the true baseline when the line box hosts an out-of-flow child — anchor
  superscript-lift assertions to the digit cap-top, not the baseline.

## Headless verification recipe

Probe `.matilda/probe/pl-primary-width.mjs` (scratch, not committed) and
`.matilda/probe-rdpl-glitch.mjs` (ghost-bounce atlas, values above) drive
the fix-proofs. Pattern for a facet-rendering change:

1. Serve the repo over a local http server (one-shot `createServer` + puppeteer-core,
   the standard `.matilda/probe/` skeleton), `waitForSelector(".rd-pl-row")`.
2. Click a facet tab by visible text within `#latest-polls`
   (`.rd-tab` buttons — "2PP" / "Primary" / "Leadership", "Leaders" when
   narrow; no ARIA tab roles, so `[role='tab']` selectors match nothing).
3. Assert `getComputedStyle(row).gridTemplateColumns`,
   `getComputedStyle(row).gridTemplateAreas`, and per-cell
   `getBoundingClientRect()` (hidden cells report width 0). For TEXT-level
   spacing inside a grid item (figures, labels), element rects are the
   stretched cell, not the ink — use a Range; see the decimals section
   above.
4. Run at ≥2 viewports: 1280 desktop AND a phone rung (480×860 or 390).
   The 2026-09-28 bug was invisible at 1280 and fully broken at 480 — a
   desktop-only probe would have passed.
5. Expected healthy values at 480px for ALL facets: `rowCols` two tracks
   (name+figs), `gridTemplateAreas` `"name figs" "tl tl" "foot foot"`, tl cell
   spanning the full row width (equal to `.rd-pl` width). Primary facet at
   480 is `270px 150px`; twopp `330px 89px`; leaders `239px 180px` — the
   name/figs split differs per facet by content, but no desktop 6-track
   template may survive under 901px.

## Adjacent notes

- The releases strip in each row (`.rd-pl-tl`, pos() maps releases onto a
  t0−43d…t0+23d window) and its `.rd-tl-tip` readout tooltip are a separate
  machine with an unfixed as-of-this-date bug: the tip sometimes opens past
  the screen edge on the SECOND dot click after another dot was clicked
  (first click is fine). Investigated 2026-09-28, root cause not landed.
- Fonts: `tabular-nums` on `.rd-pl`; heavy `.rd-pl-main`/`rd-pl-sub` sizing map
  lives in `rd.css:588-598` with phone overrides in the 900px block.

## The expanded row's change markers (shipped ce17e27, 2026-09-30)

User asked for the All-polls expansion's DELTAS ("add detlas … like in the all
polls table") on `detail(e)` in rd-polls.jsx. Implementation notes that hold:

- **`rdApChg` is shared across same-layer files**: like `rdPollHead`, it is
  defined top-level in rd-allpolls.jsx and called from rd-polls.jsx at
  runtime — no import/export needed, the built layer concatenates both.
- **chg payload** (gen-data.mjs `chgByKey`, per-poll `{d, r}`, ~:1703-1757):
  keys `pAlp pLnp pGrn pOnp pOth`, `imp`, `impOn`, `alp2pp`, `altAlpOn`,
  `albNet taylorNet hansonNet`, `ppmAlb ppmOpp ppmHan`, `und`, `flows`;
  `d[k]` is the delta on the pollster's previous wave publishing that key,
  `r[k]` that wave's ISO date. **Decimal places differ per measure** in
  RdApDetail and must match there: primaries/nets/published-2PP dec 0,
  implied dec 1.
- **The filtered-index trap**: mapping delta keys by index over a FILTERED
  array breaks when a middle element is null (e.g. `taylorNet` absent shifts
  Hanson onto `"taylorNet"`). Carry the key inside the tuple through
  `filter` then `map`: `[["Albanese", a.albNet, "albNet"], …]`.
- **`.rd-apd-chg`** (rd.css:1863, 12px ink-3 nowrap) is plain `body.rd`
  scoped — reusable inside rd-pld with no new CSS. Primary cells render
  `rdApChg(…) || "\u00a0"` so every figure keeps its delta slot and the
  columns' baselines stay level (All-polls uses `|| " "`).
- The "Changes are on pollster's field poll." provenance note under the
  dl takes its ref date from `chg.r.pOnp || pAlp || impOn || imp || alp2pp`
  (same priority as RdApDetail) and looks the wave up in
  `D.individualPolls` for its `field` label.
- Preferred-PM deliberately has NO delta there because RdApDetail's
  better-PM row carries none — "like the All-polls table" means matching
  its omissions too.
- **Probe lesson**: expanding a row headlessly, DON'T coordinate-click the
  row — the name cell is an external site link (`a[target=_blank]`) when the
  pollster has a projection `site`, so a click there navigates and the await
  dies with `frame got detached` (burnt one probe run at 390px). Expand with
  `page.$eval(".rd-pl-item .rd-pl-c-figs", el => el.click())` — the figs
  cell is plain in every facet, and plain React onClick works synthetic
  (the row toggle has no `__rdInput` gate, unlike RdGlide/RdSwap).
- **The `.rd-pld-prim` number-rule swallows inserted spans (fixed 48131ae,
  2026-09-30)**: user reported the new markers rendered much BIGGER in the
  Latest expansion than in All-polls — because
  `body.rd .rd-pld-prim > span > span { font-size: 19px; font-weight: 600 }`
  (rd.css ~:757) matches EVERY span under each primary party cell, including
  the third-child `.rd-apd-chg` span ce17e27 appended there, overriding its
  12px class rule (element+descendant+structure selectors at body.rd scope
  beat the bare `.rd-apd-chg` class). Fix is ONE selector:
  `.rd-pld-prim > span > span:not(.rd-apd-chg)` — excluded classes, don't
  add a competing override. Lesson: when reusing a shared marker class
  inside a cell whose original author sized children by POSITION
  (`> span > span`), any new child enters that rule too. Values were never
  wrong — both tables render the same gen-data `chgByKey` object — so probe
  computed style on the marker spans before touching data.
- **Cross-table parity probe** (`.matilda/latest-delta-probe.mjs`, scratch):
  expand the Latest row BEFORE clicking the All-polls page-level tab — that
  tab switch unmounts the Snapshot view holding the table and kills cached
  element handles. In All-polls, primary markers are `.rd-apd-sub` spans,
  not `.rd-apd-chg` (that's the clause-marker class there), and primary
  ORDER differs (All-polls sorts parties by value; Latest is fixed
  order) — compare marker strings as SORTED SETS. Row identity: All-polls
  row text is like "Essential↗The Guardian", so split on `↗` to match the
  Latest row's pollster name.
- `rdPollRow` (rd-polls.jsx top) maps a quiet house's last individualPoll
  into pollsterTable shape for rows with a projection but no Latest row. It
  forwards `chg` already, so the delta work needed no gen-data edit — but it
  DROPS fields (`sampleEff`, `eff`, `dir`, `iss`, `releaseUrl`), so a future
  detail feature that needs one of those for a quiet house extends
  `rdPollRow`, nothing else.

## The pinned-view facet walk (rdPinScroll, shipped 8d472e8 2026-10-03)

User call: port the All-polls "table holds its spot while the text above
changes" contract here. `rd-polls.jsx` declares `pinPl()` (anchors
`[.rd-pl, .rd-pl-tabs]`, table first, `fine=true`) plus wrappers
`pickFacet` / `flipPick` / `basisPick`, and EVERY facet-changing input
routes through them — `RdTabs swipe value={facet} onChange={pickFacet}`,
the rdTabsKey arrow walk, the hover ArrowLeft/Right keydown (effect
closes over the live `facet`, deps `[facet]` — a functional `setFacet`
form with `[]` deps was the predecessor), `rowNav`, `spaceFlip.current`/
`pubFlip.current` hotkeys, the `.rd-pl-flip` button and the qpop
published/implied RdSwitch. Row keys are the pollster (stable across
facets), so a facet hop never disconnects the rows under the pin — the
All-polls reseat hazard does not exist in this table. The anchor-order
justification and the full probe trap list (hover-inside-a-row,
`focus({ preventScroll: true })`) live in the
**auspol-rdpinscroll-row-pin** skill; regression probe is
`.matilda/probe-latest-pin.mjs` (scratch, ALL PASS at 480 touch + 1440,
`__rdPinROn` fires ~11-13 per session, ctlrow 44px phone / 0 desktop).
