---
name: auspol-rdqpop-popover
description: "auspol-tracker — the RdQPop '?' method popover end-to-end (component rd.jsx ~:491 shared with the whole page; call sites rd-hero.jsx:135 hero / rd-polls.jsx:393 Latest facet controls / rd-allpolls.jsx:1038; CSS rd.css :355-374). Default panel is CENTRED under the button (left:50% + translateX(-50%)); the align=\"left\" prop re-anchors the panel's RIGHT edge at the button (right:-8px) — the convention for any call site whose '?' sits near the right screen edge (ALL THREE sites currently pass it; the hero's overflow report 2026-09-29 was it missing it). A viewport clamp also lives inside RdQPop itself (useLayoutEffect on [open], shifts via the translate property into an 8px page gutter). Trap: margin-left is INERT on the right-anchored (.left) panel — measured computed 118px with the rect unmoved — so never clamp this box the rd-polls.jsx tooltip way; use style.translate. Worked example .matilda/probe/hero-qpop.mjs."
source: auto-skill
extracted_at: '2026-09-29T06:40:00.000Z'
---

# RdQPop — the "?" method popover

The little circled-`?` button ("How this is counted" and friends). One
shared component, three call sites; the 2026-09-29 report was its panel
opening past the right screen edge at narrow widths.

## Anatomy

- **Component**: `RdQPop({label, children, align})` in
  `.build/newtracker/assets/rd.jsx` (end of the file, exported with the
  other Rd helpers). Owns open state, `window.useDismissOutside`, Escape
  to close, and (since 2026-09-29) the viewport clamp. Renders
  `.rd-qpop > .rd-qbtn` + (when open) `.rd-qpanel[role=dialog]`.
- **CSS**: `rd.css` :355-374. `.rd-qpop { position: relative }`; panel is
  `position: absolute; top: calc(100% + 14px); width: 320px;
  max-width: calc(100vw - 32px)`:
  - DEFAULT (no align): `left: 50%; transform: translateX(-50%)` —
    centred under the button, so it overflows the right edge whenever the
    button sits within ~160px of it.
  - `.rd-qpanel.left` (the `align="left"` prop — confusingly named): the
    panel's RIGHT edge anchors at the button (`left: auto; right: -8px;
    transform: none`); the panel extends leftwards, safe for
    right-edge-adjacent buttons but it can overflow the LEFT edge when
    the button sits mid-viewport (~-110px measured at 360px).
- **Call sites** (all three pass `align="left"` today):
  - hero provenance line — `rd-hero.jsx:135`, inside
    `<p className="rd-tpp-prov">` (the "How this is counted" one);
  - Latest-polls twopp facet controls — `rd-polls.jsx:393`;
  - All-polls summary — `rd-allpolls.jsx:1038`.

## The fix pattern for "opens over the screen edge"

1. Pass `align="left"` at any call site whose button can sit near the
   right edge (the hero site was simply missing it; that was the whole
   gap vs its siblings).
2. Rely on the component-level clamp for the rest: a `useLayoutEffect`
   on `[open]` clears the shift, measures `getBoundingClientRect`, and
   clamps into an 8px page gutter on both sides:

```js
let dx = 0;
if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right;
if (r.left + dx < 8) dx += 8 - (r.left + dx);
if (dx) el.style.translate = dx + "px 0";
```

## The trap: margin-left does NOT move the right-anchored panel

First attempt copied the established tooltip idiom (rd-polls.jsx tlTip /
RdApMini dot tips nudge via `el.style.marginLeft = dx + "px"`). On the
`.rd-qpanel.left` box — absolutely positioned with `right: -8px`, no
`left` — Chrome **computes** the margin (probe read
`style.marginLeft: "118px"` and `computedStyle.marginLeft: "118px"`)
but the rendered rect does not move one pixel. The standalone CSS
`translate` property moves it reliably and composes BEFORE the base
`transform`, so it is also safe on the centred default variant (whose
`transform: translateX(-50%)` it must not clobber). Rule of thumb:
clamping ANY abspos box that is right- (or bottom-) anchored — use
`translate`, not margins; margins are fine only when the box is
left/top-anchored.

## Verify

Rebuild (`node .build/newtracker/build.mjs`), `validate.mjs` clean, then
probe with `.matilda/probe/hero-qpop.mjs` (serve skeleton per
auspol-headless-geometry-verify): open `.rd-tpp-prov .rd-qbtn`, assert
`.rd-qpanel` rect `left >= 0` and `right <= innerWidth` at 1280 / 480 /
360 rungs, and that `style.translate` is only set when a clamp was
actually needed. Measure-button and panel in `page.evaluate` side by
side — see that skill for the React-render-flush click trap.
