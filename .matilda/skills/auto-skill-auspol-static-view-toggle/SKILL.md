---
name: auspol-static-view-toggle
description: auspol-tracker — the freshness-dot ↔ static-article toggle (shipped d7e669b, 2026-09-03): map of the ss-view machinery (Header staticView state, body-class inversion of the body.js opacity hide, portaled .ss-back pill, compact-mirror span), the rules that keep reader engines happy, and the verify-every-edit-in-built-output lesson from a silently-missing JSX edit.
source: auto-skill
extracted_at: '2026-09-03T00:00:00.000Z'
---

# Static-view toggle: the freshness dot switches page ↔ article

## What it is

The turquoise `.fresh-dot` in the header's "Last poll <date> · <rel>" meta
line is a switch (user request: "tap the turquoise dot … the static site
appears … press it again the normal site appears"). Press → the interactive
app hides and the static-summary article shows in its natural in-flow box;
a "Back to the interactive tracker" pill (bottom-right) or a second toggle
returns.

## Machinery map (all shipped in d7e669b)

**`assets/73de0c58-….js` — `Header`:**
- `const [staticView, setStaticView] = useState(false)` + `useEffect` that
  `document.body.classList.toggle("ss-view", staticView)` (cleanup removes
  the class). Bare `useState`/`useEffect` work — the PLAIN layer
  `ed2260de-…js` installs them as window aliases; `ReactDOM`/`React` are
  globals.
- Desktop control is a real `<button class="fresh-dot fresh-toggle …">`
  inside `.meta-item.meta-updated .meta-v` (aria-label + title
  "Read this page as a plain, static article"). It replaced a
  span-with-aria-hidden.
- The compact mirror (`.head-meta-compact`, shown ≤560px) keeps a plain
  `<span>` with the same `onClick` — its parent block is `aria-hidden`
  decorative, so a button inside would put a focusable control in a hidden
  subtree. Tap works; the a11y tree keeps only the desktop button.
- The way back is `ReactDOM.createPortal(<button class="ss-back">…,
  document.body)` rendered when `staticView` — needed BECAUSE ss-view is
  `display:none` on #root, so every in-tree control (the dot included)
  vanishes. Vendored `react-dom.production.min.js` 18.3.1 carries
  `createPortal`; no second mount point.

**`template.html` CSS:**
- `body.js.ss-view .static-summary { opacity: 1; pointer-events: auto }` +
  `body.js.ss-view #root { display: none }` — the inverse pair of the
  mount-time `body.js` rules right above them (--ss-h machinery). Chain
  `body.js.ss-view` to out-specificity `body.js` / `body.js #root`(id).
- `.ss-back` — fixed pill, z-index 300 (above the 200 overlay tier),
  `--bg`/`--ink`/`--line` vars, `oklch(0 0 0 / 0.16)` shadow (precedent
  exists in the file).
- `button.fresh-dot` chrome reset (appearance/border/padding),
  `.fresh-toggle { cursor: pointer }` for both renderers,
  `button.fresh-dot:focus-visible` ring in `--mood-pos`.

## Rules that keep this working

- **Never `display:none` (or clip/off-screen) the `.static-summary`** — the
  entire reason it hides by opacity at mount is that Safari Reader only
  extracts visibly-rendered in-flow content. ss-view only flips the two
  levers mount already pulls; hiding `#root` with `display:none` is fine.
- The two levers are also the correction axis for any "the two views
  overlap" bug: check both rules changed together, and that `--ss-h` is
  still being set (mount measures the summary's natural height).
- In ss-view the page = article + noscript-less + `.tile-band` — i.e. what
  a no-JS visitor sees, plus the back pill. Anything chrome-like you add to
  the static view must also be body-level/portal, never inside #root.
- `ss-back` label and the toggle's aria strings are plain ASCII —
  deliberately, so greps on built index.html are exact (see below).

## The lesson folded in: verify EVERY edit in the built output

This feature initially shipped with the portal edit missing: four source
edits planned for `73de0c58`, three executed, one silently skipped by the
author (plan/execute drift across turns, not a tool race), and the build
compiled happily — the comment referencing "portaled onto <body>" was
committed without the portal itself. Caught only by grepping the BUILT
`index.html` for the new strings and noticing
`Back to the interactive tracker` matched 0 times.

Discipline for any multi-edit feature in this repo:

1. After `node .build/newtracker/build.mjs`, grep the built `index.html`
   for every NEW user-visible string / class you expected — not just the
   CSS (CSS and JS are both inlined sources; either can lag).
2. Grep tolerantly: babel classic-runtime rewrites JSX to
   `className: "ss-back"` (space after colon) and React props survive as
   object literals — `className:"ss-back"` matches nothing even when the
   code shipped. Prefer the string value itself (`'ss-back'`, the button
   label) over prop syntax.
3. Rebuild once more after the fix, re-grep, THEN commit — the stale
   build sat one rebuild behind the sources.
