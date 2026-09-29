---
name: auspol-masthead-glyph-player
description: "auspol-tracker — the masthead lockup's TWO-STRUCTURE split (shipped 2026-09-29, user: 'wire the glyph player to the glyph only… follow the contours of the glyph itself, not a box around it'): the MAIN page's lockup is div.lockup > text-only h1.wordmark.stacked + a DIAL-ONLY button.wm-glyph (border-radius 50% ellipse hugging the dial contour, hover wash SUPPRESSED — clipped to the 50% ellipse the shared 6% ink wash painted a grey oval behind the dial, user: 'no sort of shape created, no oval or any other shape'), while SATELLITES keep the old whole-lockup <a class=wm-glyph href='/#story'> in site-shell.mjs AND its hover wash. All main-page-only rules (.lockup flex row, button.wm-glyph 50% + :hover transparent, the ≤560px 92px toggle clearance retargeted .wordmark → .lockup) live OUTSIDE the shell-copy:brand markers or they'd ship to satellites. Accessibility INVERTED with the words out of the button: h1 names itself, button takes a plain aria-label + aria-describedby."
source: auto-skill
extracted_at: '2026-09-29T03:42:14.293Z'
---

# The masthead glyph player: dial-only button, contour-shaped

User ask (2026-09-29): "wire the glyph player to the glyph only, not to the
logo text, and have the wiring follow the contours of the glyph itself (not
a box around it)". The story-replay click used to cover the whole lockup —
words and dial — inside one `.wm-glyph` element.

## The two lockup structures (this is the point — do not unify them)

**Main page** (JSX in the `73de0c58-…` asset, ~:362–397):

```jsx
<div className="lockup">
  <h1 className="wordmark stacked">…auspol / tracker…</h1>   {/* text only */}
  <button className="wm-glyph" onClick={openStory}
    title="Wind the dial back through the term"
    aria-label="Wind the dial back through the term"
    aria-describedby="wm-action">
    <GlyphDial className="wm-dial" svgRef={glyphRef} width="57" height="39.7" />
  </button>
  <span id="wm-action" hidden>Replays the term on the masthead dial</span>
</div>
```

**Satellites** (`.build/site-shell.mjs` ~:118–120) keep the OLD structure:
`div.wordmark.stacked > a.wm-glyph[href="/#story"]` wrapping the textcol —
the whole lockup is the way home, and the main page still eats the `#story`
hash into openStory() (73de0c58 ~:318–325). Do not port the new structure
to site-shell.mjs; the divergence is deliberate.

## CSS: the shell-copy:brand marker boundary decides where rules go

`.wm-glyph`'s shared base (inline-flex, `padding:3px; margin:-3px`,
`gap:12px`, `border-radius:8px`, hover scale 1.06 + 6% ink wash, focus
outline) sits INSIDE template.html's `/* shell-copy:brand */ … /*
/shell-copy */` markers — anything in there is lifted verbatim into
site-shell.css and styles the satellites' anchor too. Main-page-only
machinery goes AFTER `/* /shell-copy */`:

```css
.lockup { display: flex; align-items: center; gap: 12px; }  /* the 12px that
    lived on .wm-glyph's gap when words+dial shared one element */
button.wm-glyph { border-radius: 50%; }   /* ellipse, not the 8px pill */
button.wm-glyph:hover { background: transparent; }  /* see below */
```

`border-radius: 50%` on a `button` element matches ONLY the main page — the
satellites' is an `<a>` — so the selector itself enforces the split even
though the rule sits next to shell-copied code. The 50% is the contour: it
turns the hit target into an ellipse around the 57×39.7 dial (border-radius
shapes the clickable area, so the rectangular pill's dead corner air no
longer fires the player either). Padding stays 3px with −3px margin — snug
on a single child.

## Hover: the wash turned into a grey oval once clipped — suppress it here only

The in-marker `.wm-glyph:hover` 6% ink wash made sense for the 8px PILL, but
clipped to the new 50% ellipse it painted a grey OVAL swimming behind the
dial on hover — the user report ("on hover they should be no sort of shape
created, no oval or any other shape"). The fix is ONE override after the
markers: `button.wm-glyph:hover { background: transparent; }`
(template.html ~:465). Lessons that hold beyond this case:

- **A hover wash is a shape**. Once `border-radius: 50%` (or any tight clip)
  bounds the background, the wash stops reading as a tint and reads as an
  outlined figure behind the asset. Any round/ellipse element needs the
  wash question answered explicitly, not inherited from a shared pill rule.
- **Keep the rest of the hover contract**: `transform: scale(1.06)` from the
  in-marker rule still applies (it was never overridden — the transparent
  background replaces only the wash), and `:focus-visible`'s 2px outline
  stays — that's the keyboard user's pointer, not a hover shape.
- **Satellites keep the wash**: their `<a>` is the whole lockup and the pill
  wash remains right for it. Never move the hover rule into the in-marker
  block to "fix" it globally; the split is enforced by element selectors
  (`button.wm-glyph` vs the satellite `<a>`).
- The in-marker `.wm-glyph:hover` is deliberately UNTOUCHED — site-shell.css
  is regenerated from template.html's markers, so satellites re-derive their
  wash on every build (a grep for `button.wm-glyph:hover` returns 1 in
  index.html, 0 in assets/site-shell.css — pin that).

## Media-query fallout: the ≤560px toggle clearance moved element

`.site-head` ≤560px reserves room for the top-pinned theme toggle with
`padding-right: 92px`. It used to hang on `.wordmark` (the button was a
descendant, so the h1's box held the whole lockup's width). With the button
OUT of the h1 the clearance must sit on the new row container:
`.lockup { padding-right: 92px; }` (template.html ~:3251, comment updated
"lockup row"). Miss this and the theme toggle overlaps the dial on phones.

Other selector that quietly changed meaning: `.wordmark.stacked .wm-glyph
{ align-self: center }` (template.html:752) now matches ONLY satellites —
on the main page centring comes from `.lockup { align-items: center }` plus
`.wm-glyph`'s own shared `align-self: center`.

## Accessibility inversion (the reason the JSX comments look odd)

Old puzzle: the wordmark lived INSIDE the button, so the button took its
accessible name from "auspol tracker" and an aria-label on the button made
the h1 announce wrong — the fix then was words-as-name. With the words out
of the button the puzzle inverts: **the h1 names itself plainly and the
button names itself by its action** — plain `aria-label` +
`aria-describedby="wm-action"` (hidden span beside the button) is all it
takes. If you ever re-merge words and button, resurrect the old constraint.

## Verification (headless — numbers, not screenshots)

`.matilda/probe/masthead-parity.mjs` WAS re-scoped for the split (same day,
all checks green): parity asserts on the dial PARTS (colours, angles,
heights, 57px width) and wordmark type, not the wrapper — the dial lookup
is `document.querySelector("svg.wm-dial")` (document scope) because it sits
INSIDE `.wordmark` on satellites but BESIDE it (in `.lockup`) on the main
page. New structure assertions: h1 text-only, button's only child is the
dial svg, button box 63×45.7 (57+6 × 39.7+6), borderRadius "50%", and at
390px viewport `.lockup` paddingRight "92px" + toggle-left ≥ button-right.

Two REAL-HOVER pins were added with the oval fix (2026-09-29): after
`page.hover("button.wm-glyph")`, the main dial button's computed
`backgroundColor` is exactly `rgba(0, 0, 0, 0)`, and after
`sat.hover("a.wm-glyph")` the satellite anchor's is NOT transparent
(currently `oklch(0.27 0.012 55 / 0.06)`). Note the probe serves the BUILT
site from its own static server — run the build BEFORE the probe, and if a
hover assertion (or any check) FAILs, suspect a stale index.html raced with
a sibling commit and rebuild+re-run before touching code (bitten live).

Two pre-existing probe assertions also broke and are now DESIGN-PINNED, not
removed:

- **Wordmark SIZE is split on purpose**: the rd layer (`rd.css:402`, and
  :450 for the 32px narrow rung — `body.rd .wordmark, body.rd .wm-name, …
  font-size:34px`, shipped ad50e31 redesign-live) wears the main wordmark
  bigger than the shell's 30px (`.wm-name`, assets/site-shell.css:142). The
  probe failed "type identical" on 34≠30 — correct behaviour. Now asserted
  as `main === "34px" && arch === "30px"` so an accidental change trips.
- **The needle is never string-equal across two pages**: each evaluate()
  samples it mid-settle ~1.6s apart (matrices differed at 1e-4). Compare
  ANGLES: θ = atan2(b, a) from matrix(a,b,c,d,e,f), |Δθ| < 1e-3 rad.
