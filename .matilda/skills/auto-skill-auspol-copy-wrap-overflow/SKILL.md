---
name: auspol-copy-wrap-overflow
description: auspol-tracker — a copy edit that LENGTHENS a string inside a flex-WRAP row (the All-polls .rd-eyebrow: h2 + meta + facet nav) can push the row sum over its container cap and wrap ONE child to a second row — only on some facets, only in a width window — surfacing as a sub-3px jolt in the walk probes. Attribute first (detached HEAD worktree baseline), then measure Σ(children widths) + gaps vs the cap and fix with a targeted gap shave, never a layout restructure. Worked 2026-10-08 (Confidence meta reword, 2343d19).
source: auto-skill
extracted_at: '2026-10-08T00:45:15.220Z'
---

# Copy lengthening a flex-wrap row → facet/width-window wrap jolt

## Symptom (and why it's deceptive)

A pinning probe fails with a TINY number that names your copy commit:

- conf-headline.mjs §3: `FAIL 1280 mid/deep: table held through the walk
  (worst 2.61px)` — the All-polls table walked down ~2.6px when clicking
  onto ONE facet (Confidence), 0.00px on the other six, and only in the
  ≥1240px window.
- The copy swap itself shipped clean everywhere (all strings found in
  built output, all probe-pinned assertions updated and green) — the
  failure is the LAYOUT CONSEQUENCE of the longer string, not the copy.

It's deceptive because "one facet walks 2.6px" looks like pin/scroll
code — it isn't; it's a wrap.

## Mechanism

The All-polls eyebrow row (`.rd-ap > .rd-eyebrow`) is a flex-wrap row:
`h2` + `.rd-meta` (the per-facet eyebrow string) + `.rd-ap-nav` (facet
chips), against the `--rd-maxw 1152px` content cap (minus
`--rd-gutter`). A meta string that grows enough pushes the sum over
1152px, and the `.rd-ap-nav` wraps to a second row — but ONLY on the
longest facets (the poll facets' meta is shorter, so they stay green)
and only on widths where the row nearly fits. The wrapped row is taller,
so the pinned table's anchor shifts ≈ the wrap height — the "walk".

## Diagnose (do not guess)

1. **Attribute first.** Reproduce in a detached HEAD worktree baseline
   (`git worktree add --detach .worktrees/<name> HEAD`, build there, run
   the probe; remove it after, see auspol-worktree-scratch-files). If
   the baseline is green and yours is red, it's YOUR change; if both are
   red, a sibling's drift — don't absorb it (leave alone, note in the
   report; this session: mood-smooth's 6 FAILs traced to sibling
   bf6b4b1, ruled out as yours, left untouched).
2. **Measure the row as an account:** one `page.evaluate` summing
   `getBoundingClientRect().width` of every direct child + `gap ×
   (n−1)`, and compare against the container's inner width. The
   Confidence case: `h2 205.4 + meta 472.1 + nav 445.7 + 2×16 gap ≈
   1155.5` vs a **1152px** cap — overflow ≈ 3px. (Throwaway probe
   pattern: render each facet, log the per-child widths and the wrapped
   state of the row.) Widths are computed once fonts land — await
   `document.fonts.ready` before measuring, per
   auspol-copy-line-fit-measure.

## Fix: shave the row's own slack, not the layout

Hunting for 3px in a near-full row: the fix is a targeted constant on
the row that overflows — never a width/restructure pass on the
container. This session: `.rd-ap-nav { gap: 20px }` →
`body.rd .rd-ap > .rd-eyebrow > .rd-ap-nav { gap: 14px }` (comment it:
"the longer Confidence meta pushed the eyebrow over the content cap")
buys ~12px and costs nothing visually; the walk probe returns 0.00px
everywhere. A left-side trim (meta font-size etc.) would have touched
the site's type tokens for zero benefit.

## Convenient checks after the fix

- Re-run the FAILING pinning probe — it must go all-green; also spot the
  walk numbers qualitatively (0.00px at every width, all facets).
- Rebuild + run the affected copy-probe pins if the copy strings were
  also swapped (conf-headline's CONF_META pins both the string AND the
  layout, so the one probe covers both).

## Related

- auspol-copy-line-fit-measure — the PRE-shipping version of this problem
  (would the string even fit): clone-a-span width measurement.
- auspol-headless-geometry-verify — the general measure-not-screenshot
  harness and probe skeleton.
