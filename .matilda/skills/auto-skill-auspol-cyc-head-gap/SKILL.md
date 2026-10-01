---
name: auspol-cyc-head-gap
description: auspol-tracker — the Past-cycles sections' dek→chart headroom anatomy (28px row margin + `.rd-cyc-chart .rd-chead` min-height 44px over the svg) and the margin-collapse asymmetry trap between `.rd-cyc-one` (single chart, plain div — the chead's top margin collapses away) and `.rd-cyc-two` (two-chart GRID — the chead margin renders 16px INSIDE each card, putting the primary section 16px lower than its siblings; fixed with margin-top:0 so all three sections measure 28px dek→chead / 72px dek→svg at every width). Probe .matilda/probe-cyc-headgap.mjs.
source: auto-skill
extracted_at: '2026-10-02T02:30:00.000Z'
---

# Past-cycles section head→chart gap — anatomy and the one/two-row margin-collapsed asymmetry

User question (2026-10-02): "isn't the space between the primary vote
headline dek text and the primary vote chart in past cycles too big".
Answer: **yes, 16px too big** — `#cyc-primary` put its charts 88px below
the dek where `#cyc-tpp`/`#cyc-leaders` used 72px. Fixed with one rule:
`margin-top: 0` on `.rd-cyc-chart .rd-chead` (rd.css ~:1692, in the
existing `.rd-cyc-chart .rd-chead` ruleset next to the min-height:44 line).

## The element stack (rd-cycles.jsx RdSec id="cyc-*")

```
div.rd-eyebrow                       (h2.rd-title + rd-meta)
div                                  ← the RdGlide wrapper: rd-hed + rd-dek,
                                       ~161px tall at 1440 (hed 95 + dek 54 + margins),
                                       carries an inline height from the glide
div.rd-cyc-one  OR  div.rd-cyc-two   ← the chart row, margin-top: 28px (rd.css :1682-83)
  div.card.rd-card.rd-cyc-chart  (two = display:grid, one card per column at ≥900px)
    div.rd-chead                     = the card's own name strip, margin-top:16px (was), min-height:44px
    div.chart > svg                  (svg top = chead bottom)
```

`.rd-cyc-chart .rd-chead { min-height: 44px }` (rd.css :1779) is the strip
holding the chart name plus, on `#cyc-primary`'s second card, the
One Nation overlay checkbox pair `.rd-cyc-ctls` (see
auto-skill-auspol-cyc-on-ctl-stack — its 390px corner stack makes that
one card's chead 62.8px tall on phone, so phone svg-top offsets differ
PER CARD; that's by design, not drift).

## THE TRAP: margins collapse through plain divs, not through grid items

The site-wide chart-name rule `.rd-chead { margin-top: 16px }` (rd.css
:273) behaved differently by section:

- **`.rd-cyc-one`** — the card is a normal in-flow block inside a plain
  div, so the chead's 16px collapsed up through the card and combined
  with the row's 28px margin → rendered gap max(28, 16) = **28px**.
- **`.rd-cyc-two`** — the cards are GRID ITEMS; a grid item's child
  margins never collapse through it, so the 16px rendered INSIDE the
  card: gap = 28 (row margin) + 16 (chead margin) = **44px** to the
  chead, 16px lower than the single-chart sections at every width
  (1440/820/390 all showed it — at 390 the `.rd-cyc-two` cards are stacked
  but still grid items).

Measured `@1440` before the fix: dek-bottom→svg 72px (tpp) / **88px
(primary)** / 72px (leaders). After `margin-top: 0` on the cycd heads
only: uniform **28px dek→chead, 72px dek→svg** at 1440/820/390. The zero
rule must stay SCOPED to `.rd-cyc-chart` — the generic `.rd-chead`
margin-top:16 is load-bearing in other cards (e.g. latest/prediction
cards where the chead isn't the grid-item first child).

Rule of thumb for any future one-vs-two-row gap discrepancy in this tab:
check margin collapse first — `.rd-cyc-one` swallows first-child top
margins, `.rd-cyc-two` never does.

## Verification

Probe: `.matilda/probe-cyc-headgap.mjs` (ad-hoc, uncommitted as of this
writing). Serves index.html on **:9021**, CDP on **:9227**, measures the
glide-wrapper children (`rd-dek` bottom) and per-`.rd-cyc-chart` chead /
`.chart` svg tops at 1440×960, 820×900, 390×844-touch. Report-only, no
failures — diff before/after runs. Template gotcha folded into it: the
repo path contains a space, so derive paths with
`decodeURIComponent(new URL("..", import.meta.url).pathname)` — a bare
`new URL(...).pathname` yields `auspol%20tracker` and ENOENTs.

Regression suite for any change here (green 2026-10-02):
`node .matilda/probe/cyc-ctl-stack.mjs` (port 9008 — ALL PASS),
`node .matilda/probe-cyc-chipmove.mjs`, `node .matilda/probe-cycles-pin.mjs`,
`node .build/newtracker/validate.mjs`, `npm test`; rebuild first with
`node .build/newtracker/build.mjs` (index.html is generated — never
hand-edit; see auto-skill-auspol-build-pipeline).

**Run probes one at a time** — each hardcodes its own http/debug port
pair; two live at once makes the second EADDRINUSE (the ctl-stack probe
threw a bare `port: 9008` stack then passed solo, and the other probe
silently raced its navigation).
