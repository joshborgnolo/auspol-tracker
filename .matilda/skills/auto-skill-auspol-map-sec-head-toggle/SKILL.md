---
name: auspol-map-sec-head-toggle
description: "/map/ — adding an interactive icon button/toggle right-aligned INSIDE a story-column '.st-sec > h3' section head (worked 2026-11-08, Most marginal ↔ Safest toggle on the margin list, commit 4299ff27). The heads are display:flex baseline-aligned, so an inline control stretches the head's line — park the button ABSOLUTE over the text line instead. State follows the setVtMode idiom, clicks wire in app-6-ui.js's #story handler, and the probe must assert geometry as well as content."
source: auto-skill
extracted_at: '2026-11-08T00:00:00.000Z'
updated_at: '2026-11-08'
---

# Adding a toggle icon to a /map/ story-section head

`.st-sec > h3` heads in `#story` (story column in `.build/map/app/page.css`)
are `display: flex; align-items: baseline; gap: 8px` with a `<small>` carry
line. Adding a right-aligned icon button there has FOUR homes, worked as the
margin list's toggled "Most marginal"/"Safest" head (4299ff27):

## 1. State + setter — app-4-story.js, beside `setVtMode`

Copy the `setVtMode` idiom verbatim — module `let`, no-op guard, whole-story
re-render, refocus the control that fired:

```js
let closeSafe = false;
function setCloseSafe(safe) {
  if (safe === closeSafe) return;
  closeSafe = safe;
  renderStory(true);
  $("#story [data-close-toggle]")?.focus({ preventScroll: true });
}
```

Module-level state persists across lens changes and year walks (same contract
as `vtMode`) — that's the intended behaviour, don't key it per frame.

## 2. Markup — the emitting function, in the h3

Emit the button INSIDE the `<h3>` with `title` + `aria-label` naming the NEXT
read (mirrors the `.st-pv-control` cycle button's aria-label convention), and
an inline SVG. Per-mode arrow emphasis rides inline `stroke` attributes
(`var(--ink)` lit / `var(--ink-3)` dim) — presentation attributes on the paths
beat the `.st-pv-control svg { stroke: currentColor }` inherited default. The
state flips the emitted list's sort upstream of the slice, not in the row
formatter — `closeFmt`/`closeRow` stayed mode-agnostic.

## 3. Click — app-6-ui.js `#story` click handler

One matcher + return, BEFORE the generic cases fall through:

```js
const closeTgl = e.target.closest("[data-close-toggle]");
if (closeTgl) { setCloseSafe(!closeSafe); return; }
```

Cross-file just works: `assemble.mjs` wraps app-1…app-7 in ONE IIFE in fixed
order, so a `let`/function declared in app-4-story.js reads directly in
app-6-ui.js (verified shipped — `closeSafe` is read in the app-6 handler with
no export). Keep a distinct `data-*` attribute: nothing existing starts with
the same prefix (`[data-cls]` vs `[data-close-toggle]` do NOT collide, but
proof-read the document-level generic closest list before reusing a prefix).

## 4. CSS — page.css beside the `.st-sec > h3` rules

The failure mode of the obvious recipe: put the control in flex flow with
`margin-left: auto; align-self: center` and the 34px (`.st-pv-control`; 44px
at `(pointer: coarse)`) hitbox stretches the head's line height, pushing the
icon a probe-measurable 9px+ off the text line's centre. Ship instead:

```css
.st-sec > h3 { …; position: relative; }
.st-sec > h3 .my-toggle { position: absolute; right: 0; top: 50%; transform: translateY(-50%); }
```

Absolute + translateY(-50%) centres the hitbox on whatever height the TEXT
owns the line at, at any viewport. Class the button `.st-pv-control my-class`
(second class carries only placement) to inherit size, hover, focus ring and
the coarse-pointer resize for free.

## Verify headlessly — geometry, not just content

Extend the section's probe: read rect geometry of the button, its h3 and the
h3's `<small>` inside `page.evaluate`; assert right-edge flush
(`h3.right − btn.right < 2`) and line-aligned
(`|btn.centre − small.centre| < 6px` in BOTH modes), plus the content
round-trip: click via `page.click("#story [data-my-toggle]")` + ~300ms,
assert the new head text, row order, title/aria text, and arrow `stroke`
attributes in each mode, then click back. `renderStory(true)` swaps innerHTML
synchronously; no waits beyond a paint are needed.

## Heading note

Any probe that locates a section by its h3 text (`/^(head)/` match) breaks by
design when the head is renamed by the feature — rename and probe-truth must
land in the same commit, and a mode-flipping head means asserting on the
MODE-SPECIFIC text variant, not the old static label. Later the same day the
user asked for "seats" appended (2d4ae3f9): the SHIPPED heads are `Most
marginal seats` / `Safest seats` — pin those exact strings (and the `Show …
seats` titles), not the bare originals. The section sits inside the winner
story's tail cluster — informal line, credit rule, 16px/10px junction rhythm
— whose own contract is auspol-map-story-tail.
