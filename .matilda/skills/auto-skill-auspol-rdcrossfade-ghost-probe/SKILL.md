---
name: auspol-rdcrossfade-ghost-probe
description: auspol-tracker — headless-probing any RdTabs/RdCrossfade view-switched panel (learnt on the mood panel's consumer/business split, 2026-10-08). RdCrossfade keeps the outgoing view mounted as an .rd-xf-was ghost for MORPH_MS+40 (~360ms), so unscoped panel selectors double-count everything (read rows, dots, series lines, event badges). Scope every query to .rd-xf-now and wait for the ghost to unmount after a programmatic tab click. Applies to RdUndecided, RdMood and any future tab-switched card.
source: auto-skill
extracted_at: '2026-10-08T01:58:41.677Z'
---

# Probing an RdCrossfade view-switched panel

Anatomy (rd.jsx :621): `RdCrossfade` renders the current view in
`.rd-xf-now` and, for the fade, keeps the outgoing view mounted as
`.rd-xf-was` (inert + aria-hidden) for `MORPH_MS + 40` (~360ms).
The trap: a probe or test that clicks a view tab and then queries the
panel sees BOTH cards — with the mood panel (two tab-switched gauge
pairs) that silently doubled read rows, scatter dots, event badges
(`g.evt[role="img"]` count 4 → 8), end labels and series lines
("view's pair drawn, other view absent" checks failed on their own
crossfade).

## The recipe (worked in `.matilda/probe/mood-smooth.mjs`)

1. Scope EVERY panel query to the live card:
   `#panel .rd-xf-now .card-class …`. Do a single bulk replace of the
   card-class prefix — read rows, `.rd-un-rv`, `.rd-ckey`, `.rd-evdrop`,
   chart svg selectors all inherit the ghost otherwise. `RdTabs`
   (`.rd-tab`) and anything ABOVE the crossfade (head, dek, HowTo, foot)
   stay unscoped.
2. After a programmatic tab click (`page.evaluate` — the RdTab buttons
   are plain `<button>`s, found by their label text — `RdTabs` renders no
   dto/tab tokens worth selecting on), wait for BOTH the new view's
   expected series lines/items AND the absence of the old view's, then
   wait a second time for `!document.querySelector("#panel .rd-xf-was")`
   — the ghost outlives the content swap by the fade window.
3. On fresh `open()` there is no ghost — scoping still costs nothing,
   so scope everywhere rather than branching.
4. Force a chart remount per view (`key={"id-" + view}` on the
   TrendChart) so each view prices its own y-domain/labels; the probe
   then FITS its scales from that view's DOM (both need their own
   domain — never reuse the first view's fit).
5. Per-view copy maps (ptitles, dash-key lines, card notes) belong in a
   `VIEW_*` constant table in the probe, asserted per view — the section
   head/dek/foot stay pooled checks since they sit above the tabs.

## Adjacent trap fixed in the same pass

Glossary/source-prose pins: JSX in the asset files wraps prose mid-
sentence across lines, so `src.includes("a long quoted sentence")` fails
spuriously. Flatten once (`src.replace(/\s+/g, " ")`) and pin against
the flattened form.
