---
name: auspol-map-story-lens-font
description: "auspol-tracker /map/ — which story prose takes Commissioner under which lens (the data-lens hook). renderStory stamps #story's data-lens (winner / senate / other lens ids). CURRENT contract (2026-11-09, 6b5539a5): the view-written findings + qualifier notes (.st-find, .st-note) wear Commissioner in EVERY lens ('view-dependent text … commissioner font'); section bodies (.st-sec) and the credit line (.st-foot) keep it winner-scoped; booth deks carry it under every lens. Winner-only was the 3b636e08 (2026-11-07) state."
source: auto-skill
extracted_at: '2026-11-07T01:16:37.428Z'
---

# /map/ Winner story in Commissioner — the data-lens hook and scope

User-dictated 2026-11-07 ("make this text … in winner, commissioner font",
generated on a Now-frame story paste that covered sections, notes, the
toggle, closest seats and the credit line but NOT the head blocks). Shipped
as 3b636e08: the Winner lens's running copy is Commissioner; the story
noodle's own sections only, in every frame.

## The hook (app-4-story.js, renderStory ~:1254-1276)

`renderStory` stamps the story column's element for the CURRENT lens on
every render:

- main branch: `el.dataset.lens = S.lens` before assigning innerHTML
  (lens is in the story key, so the stamp always matches the content's lens)
- senate branch: `$("#story").dataset.lens = "senate"` — required: without
  it a winner story rendered earlier would leave `data-lens="winner"` stale
  on the senate story and the section CSS would leak across.

Before this, `#story` carried no lens hook and lens-scoped story styling
was impossible from CSS; the key-already-includes-lens fact makes the stamp
free.

## The contract (page.css, right after `.st-foot`)

Since the 2026-11-09 generalisation (6b5539a5), TWO tiers:

```css
/* the finding alone wore it day one; the prose family joined 2026-11-09 */
#story .st-find { font-family: "Commissioner", var(--sans); }
#story .st-note { font-family: "Commissioner", var(--sans); }
#story[data-lens="winner"] .st-sec,
#story[data-lens="winner"] .st-foot { font-family: "Commissioner", var(--sans); }
```

`.st-find` caught up with `#story` scope (was winner-scoped) after the
user pasted a tpp-ish lens's finding ("5.6% of ballots were informal…")
and called out that view-dependent text should be Commissioner; `.st-note`
(the coverage/basis notes, e.g. "The figures below are the 2025
election's.") went with it as the same view-written prose family. The
sections' bodies and the `.st-foot` credit line stayed winner-scoped —
findings' content varies per lens while section interiors and the sources
line are furniture; that remains the lens-identity line. Pre-6b5539a5
(3b636e08's winner-only state) the whole family was winner-scoped:

```css
#story[data-lens="winner"] .st-sec,
#story[data-lens="winner"] .st-note,
#story[data-lens="winner"] .st-foot { font-family: "Commissioner", var(--sans); }
```

What that catches in a Winner story: section heads `.st-sec > h3` and
their `<small>` ("How votes were cast", "The new chamber", "Since the
election", "Closest seats"), every `.st-note` (including bare st-note
paragraphs BETWEEN sections, e.g. the Now frame's "The figures below are
the 2025 election's."), the `.links` seat rows, the vote-type `.vt-modes`
toggle + bands + labels, the `.changes` entry text for now frames, and the
`.st-foot` credits. What it deliberately does NOT take (the user's paste
excluded it): the story head — `.st-head h2`, the scope menu, `.st-hed`
(serif), `.st-dek`, `.st-stat` (which was already Commissioner).

## Font facts the change could lean on

Commissioner needs NO font-pipeline work on /map/: map/index.html declares
its own inline `@font-face` for it (variable 400-700 cut,
`/assets/fonts/commissioner-latin.737ec8f2.woff2`), independent of the
main build's font lane. It was already the story's figure face
(`.st-stat`, `.st-pv-row b`, the vote-type band `.vt-share`/`.vt-skew`).

## Consequences to know before extending

- Since 6b5539a5 the prose finding/note classes are TIERED, not gated:
  only `.st-sec` and `.st-foot` stay sans outside winner. A future rule
  that should stay lens-scoped gates on `data-lens`; a rule that should
  follow view-written prose follows the `.st-find`/`.st-note` tier. The
  booth story's `.st-dek`/`.st-find` were ALREADY Commissioner in every
  lens from the booth rules (and survive the retro chrome that way —
  retro's `html.mp-retro .mp *` font-family reset loses to any `#story`
  rule since the ID tier outranks classes; retro clearance would have to
  be an explicit retro.css line and was deliberately not added — senate
  deks keep sans).
- font-family inherits INTO canvases? No effect — `paintMiniChamber`/
  `hydrateDists` paint onto canvas with their own JS font strings.

## Verification

`.matilda/probe/map-now-vt.mjs` asserts the legacy contract headlessly
(pre-6b5539a5): `.st-sec > h3`, `.st-note`, `.st-foot`, `.links .nm`,
`.vt-mode` are Commissioner under winner; after `__map.setLens("tpp")`
`.st-sec` sections fall back to the page sans — still true for sections
and the credit line, but `.st-note` and `.st-find` now read Commissioner
in every lens, so that probe's tpp notes assertions are drifted and need
the tiered expectation when it next runs. (Probes under `.matilda/probe`
are gitignored-new; model new ones on it: serve repo, `__map.setYear`,
await `__map.Y[y].ready`.)

Related: auspol-map-vote-type-panel (the section land this started with;
toggle labels "Skew"/"Effect" shipped in the same commit),
auspol-headless-geometry-verify (computed-style assertion style).
