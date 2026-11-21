---
name: auspol-nownav
description: "auspol-tracker — the Now tab's sticky topic strip RdNowNav (shipped 2026-11-09, commit 1b355b37, replacing the rd-snap-nav eyebrow sentence links): chip list re-derived EVERY render because data-gated fields of window.AP.D land in stages like the sections do and a first-render memo freezes the short early list; the scroll-spy marks a section current once its head crosses its OWN scroll-margin line (the place a jump lands it), never a fixed offset from the strip; a chip's jump re-lands after the page height goes quiet because content-visibility placeholders resize mid-glide and strand a one-shot smooth scroll (~300px off measured); phone rung locks y with overflow-y:clip AND padding-bottom:1px on the scroller (the chips' margin-bottom:-1px underline trick otherwise reads as 1px vertical slack). Probe .matilda/probe/now-nav.mjs."
source: auto-skill
extracted_at: '2026-11-09T06:40:00.000Z'
---

# The Now tab's topic strip (RdNowNav)

Impact/area: the Now tab of the front page only. Lives in
`.build/newtracker/assets/73de0c58-…js`, defined just before `SnapshotView`
and rendered as `<RdNowNav />` at the top of its fragment (ahead of `<Hero>`).
Styles: `rd.css` block "the Now tab's topic strip" (~:199). It replaced the
hero eyebrow's `rd-snap-nav` sentence links (retired same commit — that JSX,
its CSS, and `.matilda/probe/snap-nav.mjs` are all gone).

## What it renders and gates

`NOW_CHIPS()` — Vote→#two-party, Latest polls→#latest-polls, Leaders→#leadership,
Mood→#direction, Voters→#who-votes, Issues→#issues, Decided→#undecided,
Economy→#confidence. Each chip carries an optional third tuple item: the same
guard the section's own `Rd*` component early-returns on
(`D.direction.length`, `D.demographics.tabs.length`,
`D.issues.list.length`, `D.undecided.series.length`,
`D.confidence.consumer.polls.length`). /vic/ drops Voters and Issues under
these, as intended.

**Never memoise the gated list** (`React.useMemo(NOW_CHIPS, [])` was the
shipping bug the probe caught): guards read deep fields of `window.AP.D`,
which arrive in stages during the app's boot choreography — at first commit
four of eight gates were false, the memo froze the strip at four chips, and
the missing sections existed seconds later. Chips are re-derived on every
`RdNowNav` render (a few property reads); the spy effect re-arms only when
the ordered chip-id set changes (`chipKey` dep). Same-class rule for any
future chrome listing gated on D.*: derive per render or subscribe.

## The scroll-spy

A `scroll` listener (rAF-throttled) on the window — deliberately NOT an
IntersectionObserver over sections, because sections mount in the SnapshotView
tail stages and a folded section (rd-shut) shrinks; re-measuring positions
reads fine through both. A section is current when its head's viewport top
crosses **its own cached `scrollMarginTop` + 6px** — i.e. the pixel a
`scrollIntoView` would land it at (56px on rd sections). The first-order bug:
comparing against `<strip bottom> + 6` left a clicked section 4px below the
spy line, so the spy stayed on the previous section. Margins are read once
per element and cached in a Map (they never change). Absent the spy crossing
anything, the first chip stays current.

## The jump settle

`go(id)` = `scrollIntoView({behavior: SM, block:"start"})`, then a poll loop
(until the page's `documentElement.scrollHeight` is unchanged for 4×100ms, or
2.5s elapses) that issues one more identical smooth scroll. Why: a jump can
cross `content-visibility: auto` sections whose 1200px
`contain-intrinsic-size` placeholders resize as their skipped layout finally
runs — a one-shot smooth pass came to rest with #issues at top 364 instead of
56. The re-land is a no-op when nothing moved (Chrome skips no-op smooth
scrolls), and any of wheel/touchstart/keydown stops the hold, mirroring the
boot hash-landing's contract.

## Phone/geometry contract

- Sticky `top:0`, z-5, `background: var(--bg)`, hairline `border-bottom`.
- Sideways-only scroll on narrow widths: `overflow-x:auto;
  overflow-y:hidden; overflow-y:clip;` (auspol-strip-xscroll-ylock) **plus**
  `padding-bottom: 1px` on the scroller — the chips wear `margin-bottom:-1px`
  + 2px underline borders (rd-tab idiom so the active chip's line merges the
  container rule), and a scroller is sized by child MARGIN boxes: 44px child
  ⇒ 43px content box, but scrollHeight counts the border box (44) ⇒ 1px
  vertical slack, `scrollHeight !== clientHeight`, thumb-wobble. The 1px
  padding makes both sides 44. Existing shipped pattern:
  `rd.css` `.rd-wv-tabs > div[role=group]` (~:1907).
- Chips are `flex: 0 0 auto`, min-height 44px (no ::after inflation needed,
  so no hidden y-slack), `aria-current="true"` on the active one (bold 600 +
  ink underline; not rd-pressed).
- `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`.

## Integration notes & hazards

- `getElementById` targets: `#issues`, `#undecided`, `#confidence` etc. are
  the `RdSec` ids in rd-panels.jsx; `#two-party` and `#primary-vote` sit in
  rd-hero.jsx / the PrimaryVotePanel. A missing target is a no-op, not a
  crash.
- The strip renders only when `window.AP.rd` (returns `null` otherwise, and
  the effect early-outs) — `?design=old` gets nothing.
- All tab documents are rebuilt together; the Info tab's `.info-toc` /
  All-polls pinned `.rd-ap-headwrap` are separate sticky elements — no
  interaction.
- The strip sits OUTSIDE every `section.rd-sec`, so nothing in
  `warmSections`/`rd-shut`/`content-visibility` code paths touches it.
- Test surface: `.build/test-tab-pages.mjs` doesn't know the strip exists;
  nothing to update when its chip copy changes.

## Probe

`.matilda/probe/now-nav.mjs` (tracked via `git add -f`, PORT 8963): 15 widths
including the 561–700 head band and 360; asserts sticky position, no document
horizontal overflow, single ≤46px row, the 8-chip set, zero vertical slack
(`scrollHeight == clientHeight`, injected `scrollTop` reads back 0), stick at
top after scroll, chip click → section top ≈56 within 1.8s and
`aria-current` follows, last chip current at the page foot, `.rd-snap-nav`
absent from DOM and CSS, and no strip on the All-polls document. Companions:
`.matilda/probe/now-frames.mjs` (frames/wells/labels/fold/density). Related:
`auspol-eyebrow-onthispage-nav` (the cycles/allpolls siblings, and this
history of the one it replaced), `auspol-section-fold`,
`auspol-headless-geometry-verify` (why geometry, not screenshots).
