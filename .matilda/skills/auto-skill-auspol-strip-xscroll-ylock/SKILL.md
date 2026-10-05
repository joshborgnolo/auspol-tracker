---
name: auspol-strip-xscroll-ylock
description: auspol-tracker — a pinned phone strip "scrolls/wobbles vertically" (user: "can scroll the sticky section on the y-axis… allow horizontal scroll only"). Mechanism: overflow-x:auto computes overflow-y to auto; inflated ::after tap targets (44px) protrude past the row's box and that slack becomes scrollTop range. Fix = overflow-y:hidden(+clip) AND pad the row to contain the hit areas so scrollHeight==clientHeight; beware the body.rd specificity trap where template.html base-class edits silently lose to rd.css overrides. Two shipped fixes: rd-hl-tabs (rd.css ~:2751, report 2026-10-03) and .info-index (24f3ee0, 2026-10-04).
source: auto-skill
extracted_at: '2026-10-04T04:13:17.635Z'
---

# Phone strip y-wobble: overflow-x:auto ⇒ overflow-y computes auto

Symptom class (recurred twice in two days): "on my phone I can drag the
pinned row up and down, it should only scroll sideways."

## Mechanism

1. A phone media query sets `overflow-x: auto` on a sticky/flex strip.
2. CSS Overflow spec: beside a non-`visible` overflow-x, `overflow-y`
   COMPUTES from `visible` to `auto` — the element becomes a vertical
   scroll container.
3. Anything overflowing the row's box vertically supplies scrollable
   slack. The usual supplier is the inflated tap-target pattern
   (`el::after { content:""; position:absolute; left:50%; top:50%;
   width:max(100%,44px); height:44px; transform:translate(-50%,-50%) }`
   — template.html ~:916 for `.hb-q` and `.info-index button`): a 44px
   ::after centred on a ~19px button reaches (44−19)/2 ≈ 12.5px each
   side; against 12/10px row padding it protrudes ~2px. Even sub-pixel
   fractional slack is enough for a thumb-wobble.

## Diagnose headlessly (no screenshots — geometry only)

Serve the repo root over a local http server, puppeteer phone viewport
(e.g. 390×800), land the tab via its URL hash, then evaluate:

```js
const el = document.querySelector(SEL);
const cs = getComputedStyle(el);
el.scrollTop = 40;
({ oy: cs.overflowY, scrollH: el.scrollHeight, clientH: el.clientHeight,
   bought: el.scrollTop });          // scrollTop > 0 ⇔ vertical slack exists
```

Also measure the hit-area intrusion: `getComputedStyle(btn,"::after").height`
vs button height and row padding — predicts the slack before fixing.
Probe scratch lives in `.matilda/probe/` (gitignored); worked probe:
`.matilda/probe/info-index-yscroll.mjs` (convention per
auspol-headless-geometry-verify).

## The fix — BOTH levers, each answers a different level

1. **Lock the axis**: `overflow-y: hidden; overflow-y: clip;` on the same
   rule as overflow-x:auto. `clip` computes to `hidden` beside
   overflow-x:auto (write it anyway, harmless upgrade if engines loosen).
   This kills touch PANNING…
2. **…but not the slack**: on an `overflow:hidden` scroll container
   `scrollTop` CAN still be set (scroll-snap, scrollIntoView, scripts),
   so to make the row truly inert you must also REMOVE the scrollable
   content — pad the row vertically so the 44px ::afters fit inside it
   (e.g. `padding: 14px 0` when the button is ~19px), or shrink the
   ::after into the box. Verification bar: `scrollHeight == clientHeight`
   and the scrollTop write above reads back 0. Don't shrink the hit
   target for the fix unless the a11y 44px intent is reconsidered —
   padding containment preserves it (cost: a few px taller strip).

## Specificity trap — template.html base classes lose to rd.css redesign layer

Setting the phone padding on `.info-index` in template.html **silently
did nothing**: the redesign restyles the template's classes behind
`body.rd` in `.build/newtracker/assets/rd.css`
(`body.rd .info-index { padding: 12px 0 10px }` at (0,2,1) beats the
template's (0,1,0) — even inside a media query). The probe still read
padding 12/10 after the template edit applied cleanly to the built
index.html. Rule: **whenever an element has both a template.html rule
and a `body.rd …` rule in rd.css, put layout-affecting property changes
in the rd.css rule** (template keeps the cross-layer fallback);
grep rd.css for the class before editing template, not after probing
fails. The split that shipped for .info-index (24f3ee0): overflow-y lock
in template.html's @media block (applies everywhere), padding 14px 0 in
rd.css's `body.rd .info-index` phone block next to `top: 43px`.

## Shipped precedents

- **rd-hl-tabs** (the hero lead strip, All polls tab): rd.css ~:2744-2775
  comment + `overflow-x:auto; overflow-y:hidden; overflow-y:clip` —
  user report 2026-10-03. Its padding trick is `padding-right:24px` for
  the fade runway (horizontal, unrelated).
- **.info-index** (Info tab's pinned About/Questions/Method/… chapter
  index, sticky `top:39px`/43px, `flex-wrap:nowrap; overflow-x:auto`
  ≤640px): 24f3ee0 — overflow-y lock in template.html ~:2256 media
  block, `padding:14px 0` in rd.css info block ~:2825. Row went 41→47px.
  44px tap targets came from 2d32ef2 (the a11y hit-area audit;
  `.hb-q::after, .info-index button::after` shares one rule with `.hb-q`,
  so edits fan out to the hero's `?` buttons too).
- rd.jsx `RD_PIN_STICKY` lists `.info-index` among pinned strips — the
  class of element this failure class keeps hitting.
