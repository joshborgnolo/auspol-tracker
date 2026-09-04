---
name: auspol-archive-jump-links
description: "auspol-tracker — the All-polls jump-pills (29c5447) and the site's scroll-to-section conventions: targets carry a section id + scroll-margin-top:72px (.next-polls clearance for .tabs.sticky), smooth scroll needs EXPLICIT behavior:\"smooth\" (no global scroll-behavior exists), a facet-gated panel (HouseLeanPanel is twopp-only) needs switch-facet-then-DEFERRED-scroll (leanJump ref + useEffect on [facet], not setTimeout), and .ap-export's pill shape is display:none ≤1000px so mirror it on a new class rather than reusing it."
source: auto-skill
extracted_at: '2026-09-02T13:08:59.383Z'
---

# All-polls jump-links + the archive view's scroll conventions (29c5447)

Two downward-arrow pills above the All-polls archive table smooth-scroll to the
two diagnostic panels BELOW the 157-row table ("Jump to poll disagreement",
"Jump to house lean"). Lives entirely in the two usual homes:
`assets/d1a1d215-….js` (JSX + helpers) and `template.html` (CSS).

## AllPollsView top-of-view layout map (d1a1d215)

`ap-head` (title/sub left; `ap-head-side` right: facet TextToggle + phone-only
count) → **`.ap-jumps`** → `ap-bar` (search + FilterPops + `ap-bar-end`: count
+ `.ap-export`) → table → `table-hint` → `<VariancePanel>` (`#poll-disagreement`,
both facets) → `<HouseLeanPanel>` (`#house-lean`, **twopp facet only**). Panel
sections: `<section className="ap-var" id="poll-disagreement">` (~:2274) and
`<section className="ap-lean" id="house-lean">` (~:2433). Those ids ARE the jump
targets — don't rename/remove them.

## Scroll-to-section conventions in this codebase

- Targets get an `id` + CSS `scroll-margin-top: 72px` (`.ap-var, .ap-lean` rule
  in template.html, after the `.ap-jumps` block ~:2854). 72px is the
  `.next-polls`-established clearance for the `.tabs.sticky` bar — reuse it for
  any new jump target.
- `scrollIntoView({behavior:"smooth", block:"start"})` — template.html sets NO
  global `scroll-behavior`, so "smooth" must be passed explicitly or you get an
  instant jump. (Exception precedent: table-row scrolls deliberately use
  `behavior:"auto"` + `block:"center"` because a row pinned to the top would sit
  under the pinned bar.)
- Helper `jumpTo(id)` lives in AllPollsView right after `onFacet` (~:2607).

## Facet-gated panel → switch facet first, defer the scroll

`HouseLeanPanel` mounts only when `facet === "twopp"`. Its pill must work from
any facet, so it cannot just scroll (the element doesn't exist) and hiding the
button on other facets was rejected (no dead ends). Solution in AllPollsView
(~:2609-2623): `leanJump` `useRef` flag + `React.useEffect` on `[facet]` —
`jumpToLean()` either scrolls directly (already twopp) or sets the flag and
calls `onFacet("twopp")`; the post-commit effect then finds the freshly mounted
section and scrolls. Deterministic — do NOT swap this for an arbitrary
`setTimeout` guess. Hooks are fine there: `useRef`/`React.useEffect` are already
in scope in AllPollsView's body (no early returns before them).

## The .ap-export trap (why .ap-jump is its own class)

`.ap-export` is the model pill: inline SVG icon (`stroke="currentColor"`,
`strokeWidth="2"`, `aria-hidden`, 14px), 999px-radius border pill, `color-mix`
hover — but its base rule sets `display:none` ≤1000px ("CSV export is a
big-screen affordance"). Reusing the class silently hides your control on
phones, exactly where jump links matter most. `.ap-jump` (template.html
~:2841-2853, beside the `.ap-jumps` wrapper) duplicates the shape with a comment
saying why. Mirror-ap-export-on-a-new-class is the pattern for any mobile-worthy
control.

## Verifying in the built artifact

In the compiled `index.html`, JSX props are minified object literals — grep
`id="house-lean"` returns ZERO even on a correct build; grep the bare ids
(`poll-disagreement`, `house-lean`) and the label strings instead. (Sibling of
the auspol-built-html-verification babel-escape trap.)

Related: `auspol-house-lean-chart` (the gated panel itself, its mount point and
twopp-only rationale), `auspol-poll-table-typography` (the archive table map).
