---
name: auspol-content-link-colour
description: auspol-tracker — every content-link anchor class in template.html must get colour from an AUTHOR rule (inherit, explicit, or a colour-bearing class on the same element); a colourless anchor falls to the UA default link blue, which is illegible on the dark paper. a.pd-release was the last offender (fixed 42a0c56); covers the three conformant patterns and the audit procedure for new link classes.
source: auto-skill
extracted_at: '2026-09-02T00:00:00.000Z'
---

# auspol-tracker content-link colour invariant

## The failure class (reported 2026-09-02, fixed 42a0c56)

`a.pd-release` — the "here↗" anchor in the *Pollster's release* and *APC
methodology statement* ledger sections (JSX in PollLedger, a11e1559 ~:1980) —
named no colour, so it rendered in the UA default link blue. Passable against
the light paper, illegible against `body.dark`'s oklch(0.215) newsprint: the
user's "release link is not super legible in dark mode" bug.

**Key specificity fact:** parent ink does NOT save a colourless anchor —
`.pd-s { color: var(--ink-2) }` on the enclosing `<p>` loses to the UA
`a:-webkit-any-link` colour targeting the anchor itself. But an AUTHOR-normal
declaration beats the UA rule, so a colour-bearing class on the same element
works. That's exactly the trap: `a.pollster-link` and `a.npd-pub-link` are
fine without `color:` of their own (see pattern 3) while a
naked `a.pd-release` was not.

## House link language (do not re-litigate)

Text first, link second — deliberately NO blue, NO standing underline. The
affordance is the `↗` plink-mark (ink-3, →ink-2 on hover, tuned to clear the
text-contrast bar) + hover/focus underline + focus-visible `--accent` outline.
See the comment block above `a.pollster-link` (template.html ~:1736).

## The three conformant ways a link class gets colour

1. **`color: inherit` on the link class** — inherits the parent sentence ink.
   Used by `a.tn-link` (~:2539) and `a.np-link` (~:3040). `a.pd-release` now
   conforms this way (takes `.pd-s`'s ink-2).
2. **Explicit colour on the link class** — e.g.
   `.pollster-method { color: var(--ink-3) }` (~:1773).
3. **A colour-bearing class on the SAME element** — the anchor carries
   `.pollster-name` (ink) beside `.pollster-link`, and `.npd-pub` (ink) beside
   `.npd-pub-link`. Works because author-normal beats UA-normal; to a grep
   for `color:` on the link-class rule itself these look "colourless" — check
   the JSX for the companion class before flagging one.

## Audit procedure (run when adding any new link class, or on a report)

1. List the link base rules: `grep -n "^a\.\|^a:" .build/newtracker/template.html`
   AND `grep -n "^\.[a-z-]* a" .build/newtracker/template.html` — since bde0afb a
   link can also be coloured by a bare DESCENDANT selector with the anchor carrying
   no class of its own (`.ss-note a { color: var(--ink-2) }`, the "Full archives
   here" link in the build.mjs static summary — pattern 2 by another shape). A
   class-only grep misses those. Check each rule falls into pattern 1, 2, or 3
   (for 3, grep the JSX for both class names on the same element). A link
   rendered by an rd-* asset (the `body.rd` layer) is styled in
   `.build/newtracker/assets/rd.css`, NOT template.html — grep the `body.rd`
   rules there too (`.rd-tbc` is the first instance); the same invariant applies.
2. Verify against the BUILT `index.html` — the CSS is inlined verbatim (ASCII
   anchors like `a.pd-release { color: inherit` grep fine; the babel string
   escaping caveat in auspol-built-html-verification applies to JSX strings,
   not the stylesheet).
3. Fix = edit the base rule in template.html, `node .build/newtracker/build.mjs`,
   commit template.html + index.html together (CSS-only build leaves the hashed
   assets and feed/sitemap untouched).

Post-42a0c56 all six content-link classes conform: `a.pollster-link`,
`.pollster-method`, `a.pd-release`, `a.npd-pub-link`, `a.tn-link`, `a.np-link`;
plus the classless `.ss-note a` descendant rule (bde0afb, template.html ~:255).
Its sibling instance — the "archives" link inside the MethodNote footer's
`.disclaimer` — was already covered by the pre-existing `.method a { color:
var(--ink-2) }` (~:2197); each home of the disclaimer copy needs its OWN
selector check (`:is(.ss-note, .disclaimer)` is not how the stylesheet expresses it).
`button.npd-field-link` is a button — UA link colour does not apply.

2026-09-28 addition, the first link class outside template.html: `.rd-tbc`
(rd.css ~:1558, commit 42491f8 — YouGov's "eff. TBC" APC-listing link in
rd-allpolls) conforms via pattern 1 (`color: inherit`). Its affordance is a
standing DOTTED underline, a recorded exception to the
no-standing-underline link language: an inline three-letter abbreviation
inside 12px `.rd-ap-sub` text has no room for the ↗ plink-mark, and
`.rd-link` (rd.css:324, bold + standing solid underline) was considered and
rejected as too loud for sub-text. Do not "fix" it to the plink-mark form
without asking.

2026-09-30 addition, `a.mh-latest` (rd.css ~:431, commit e00d2e6 — the
masthead's latest-poll release link): pattern 1 via `color: inherit`.
BY USER REQUEST it carries NO hover underline either ("make it invisible:
there's no underline or link icon") — a recorded second exception: there
is no ↗ plink-mark, no standing underline, and no hover underline; the
only affordance is the `focus-visible` accent outline for keyboard
users. Do not add the hover underline back without asking. See
auspol-masthead-latest-status for the two-home wiring.
