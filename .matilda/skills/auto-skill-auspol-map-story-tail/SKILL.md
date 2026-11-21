---
name: auspol-map-story-tail
description: "/map/ — the winner story's tail blocks (vote-cast section, margin list, informal line, credit '.st-foot') when their ORDER or the separators' spacing needs changing (worked 2026-11-08, commits 2d4ae3f9 head copy, 50a2fd35 informal-below-margin + gap repair after the user reported the credit's double rule floated off the last row). The junction idiom is 4px double rules at a 16px rhythm with the informal line CENTRED in its rule pair (10px pad = 10px margin); a reorder of these blocks lives in four homes: app-4-story call order, the winner-scoped sibling-selector CSS in page.css (the old neighbour's adjacency rule goes DEAD — delete it), each block's own .st-* margins, and the probes in .matilda/probe/."
source: auto-skill
extracted_at: '2026-11-08T09:15:00.000Z'
---

# /map/ winner-story tail: order and rule spacing

`storyArea` in `.build/map/app/app-4-story.js` closes with (current order,
50a2fd35): `vtBlock` (How votes were cast) → the margin list section (Most
marginal/Safest toggle, see auspol-map-sec-head-toggle) → `informalHTML(m, st)`
→ `foot(m)`. `informalHTML` (:559) is `<div class="st-inf"><b>Informal
votes:</b> …</div>`, pooled by `poolParts(m).cls` so a class pick inside a
sliced state pools the class ∩ state rate. `foot(m)` (:1416) is the
`<p class="st-foot">` credit.

## The spacing idiom (page.css :400-420 and :570-590)

- Every winner junction is a 4px double rule; the element before it owns a
  **16px margin** to it (`.st-sec { margin-top: 16px }`, `.st-inf` same),
  then the section's own padding (7px) sits UNDER the rule before text.
- The informal line is CENTRED inside its rule pair: `padding-top: 10px`
  above its text and a **10px gap** to the next rule below. The below-side
  gap is a sibling adjacency rule on what follows it — today
  `#story[data-lens="winner"] .st-inf + .st-foot { margin-top: 10px }`,
  moved when its neighbour moved (it was `.st-inf + .st-sec` before the
  reorder). **The old adjacency selector goes dead on a reorder — delete
  it in the same commit.**
- `.st-foot { margin-top: 28px }` is the DEFAULT for stories whose last
  block is not informal (frames lacking an informal rate). Do not tighten
  it globally: a complaint about 28px air after the last content block was
  fixed by STRUCTURE (the informal line's own rule now closes the list at
  16px), not by shrinking the default.
- 2026-11-09 (c3329161): the double junction rules are no longer
  winner-specific — `.st-sec`, `.st-inf`'s twin rule and `.st-foot`'s
  closing rule are the LENS-WIDE base (user call: winner is the model for
  every view). See auspol-map-lens-style-generalise for the generalisation
  recipe and its retro/booth/senate specificity traps.

## Reorder recipe (worked 50a2fd35)

1. Move the `h +=` line in `storyArea` (informal moved from after `vtBlock`
   to just before `foot(m)`).
2. Sweep the winner-scoped CSS sibling selectors touching the moved block;
   add the adjacency rule for the new neighbour with the mirrored gap.
3. Leave block-level margins alone (`.st-inf` keeps 16px/10px) — the rhythm
   comes from the neighbour selectors, not per-case padding.
4. Update every probe touching the tail — this shipped with edits to
   `.matilda/probe/map-informal-line.mjs` (see below); the margins probe
   (`map-closest-margins.mjs`) was unaffected because it scopes inside its
   own section.

## Pinning it in `map-informal-line.mjs`

- Order: `el.previousElementSibling` is the margin `.st-sec`
  (`/^(Most marginal|Safest) seats/` on its h3 — heads renamed in
  2d4ae3f9, any probe matching `/^Closest seats/` is dead), and
  `el.nextElementSibling` is `.st-foot`.
- Spacing: `elRect.top − listSecRect.bottom === 16±1.5` (the rule-to-row
  gap); centring `paddingTop ≈ (nextRect.top − elRect.bottom) ≈ 10±3`.
- Figure truth: pool `core-2025.json` divs in-page
  (`inf / (formal + inf)`), and build both `byCls` and `byState+cls` stores
  — a class pick inside a sliced state verifies against the intersection.
- Driving the class pick: the winner-scope dropdown offers `st:` items
  FIRST, and only after a state slice does `statScopeOpts` emit `cls:*`
  items ("Filter by seat type"). Click `[data-scope-trigger]`, pick
  `st:*`, wait ~500ms, click the trigger again, pick `cls:*`. Read the menu
  FROM THE TRIGGER'S WRAP (`trig.parentElement.querySelector(".st-scm")`),
  never `document.querySelector(".st-scm")` — the legend's Base dropdown
  (`lg-bmenu .st-scm#base-menu`, landed same-day in 9fe55933) sits earlier
  in the DOM.
