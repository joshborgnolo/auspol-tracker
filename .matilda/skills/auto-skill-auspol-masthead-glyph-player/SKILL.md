---
name: auspol-masthead-glyph-player
description: "auspol-tracker — the masthead lockup's dial-only, contour-shaped player (shaped 2026-09-29 on the main page, user: 'wire the glyph player to the glyph only… follow the contours of the glyph itself, not a box around it'), reunified onto the SATELLITES 2026-10-02 (user: 'integrate the Satellite pages with the current design, particularly the mast head'): EVERY page now splits the lockup into a text wordmark beside a DIAL-ONLY control (main: div.lockup > text-only h1.wordmark.stacked + button.wm-glyph; satellites: .sh-lockup > a.wordmark[href=/] + a.wm-glyph[href=/#story] — the page's own title keeps its h1), the control an ellipse of border-radius 50% hugging the 57×39.7 dial with the hover wash SUPPRESSED ON BOTH (clipped to the ellipse the shared 6% ink wash painted a grey oval — user: 'no sort of shape created, no oval or any other shape'). Wordmark 34px (32px phone) and dial 57px (54px phone) are IDENTICAL both sides now; the element-qualified contour rules live in TWO homes (template.html's button.wm-glyph for the main page, site-shell.mjs shellCss()'s a.wm-glyph for the satellites). The 2026-09-29 two-structure split (satellites' whole-lockup anchor, its wash, the 30px wordmark) is SUPERSEDED."
source: auto-skill
extracted_at: '2026-09-29T03:42:14.293Z'
---

# The masthead glyph player: dial-only, contour-shaped, on every page

User ask (2026-09-29): "wire the glyph player to the glyph only, not to the
logo text, and have the wiring follow the contours of the glyph itself (not
a box around it)". The story-replay click used to cover the whole lockup —
words and dial — inside one `.wm-glyph` element. The main page got the
split that day; the 2026-09-24 site shell kept the OLD whole-lockup anchor
on satellites for eight days, then 2026-10-02 the user asked the satellite
pages integrated with the current (rd-redesign) design "particularly the
masthead" and every page unified onto the split structure. The
two-structures-do-not-unify note that used to live here is OBSOLETE — the
unification IS the design now.

## One split lockup, differing only in element KIND

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

**Satellites** (`.build/site-shell.mjs` shellHeader, ~:109):

```html
<div class="sh-lockup">
  <a class="wordmark stacked" href="/" title="The interactive tracker">
    <span class="wm-textcol">…auspol / tracker…</span>
    <span class="wm-sr">– Australian federal polling</span>
  </a>
  <a class="wm-glyph" href="/#story" title="Wind the dial back through the term"
     aria-label="Wind the dial back through the term" aria-describedby="wm-action">
    <img class="wm-dial-img" src="/assets/masthead-dial.svg" width="57" height="39.7">
  </a>
  <span id="wm-action" hidden>Replays the term on the masthead dial</span>
</div>
```

The difference is element kind, forced by the context, nothing else: the
main page owns its h1 and can run a JS player (button + openStory); a
satellite's own article title keeps the `<h1>`, so its wordmark is a plain
link home (its way back to the tracker) and its dial control a link to
`/#story`, which the main page still eats into openStory() (73de0c58
~:318–325). The satellite `<img class="wm-dial-img">` is only the per-build
static stand-in site-shell.js swaps for a live inline `svg.wm-dial`. Sizes
now match exactly: wordmark 34px desktop / 32px phone and dial 57px / 54px
phone on BOTH (the old shell 30px wordmark is gone with the redesign
reskin), ink colours and graduation heights identical, no hover wash on
either.

## CSS homes: the contour rules are element-qualified in TWO places

`.wm-glyph`'s shared base (inline-flex, `padding:3px; margin:-3px`, the
hover `scale(1.06)`, the focus-visible 2px outline — and, buried under two
overrides, the old 8px radius and 6% ink wash) sits INSIDE template.html's
`/* shell-copy:brand */ … /* /shell-copy */` markers and is lifted VERBATIM
into site-shell.css. The contour split itself is element-qualified, one
selector per home:

```css
/* template.html, after /shell-copy (main page only) */
.lockup { display: flex; align-items: center; gap: 12px; }
button.wm-glyph { border-radius: 50%; }
button.wm-glyph:hover { background: transparent; }

/* site-shell.mjs shellCss() (satellites only) */
.sh-lockup { display: flex; align-items: center; gap: 12px; }
a.wm-glyph { border-radius: 50%; -webkit-tap-highlight-color: transparent; }
a.wm-glyph:hover { background: transparent; }
```

So adding or changing a contour rule = TWO edits, one per home — there is
no single place that reaches both. `border-radius: 50%` is the contour: it
turns the hit target into an ellipse around the 57×39.7 dial
(border-radius shapes the clickable area, so the rectangular pill's dead
corner air no longer fires the player). Padding stays 3px with −3px margin —
snug on a single child; the 12px air between words and dial lives on the
lockup rows' `gap`, not on `.wm-glyph` anymore. A selector worth deleting
one day: `.wordmark.stacked .wm-glyph { align-self: center }`
(template.html ~:752) now matches NOTHING on either page — the dial is a
sibling of the wordmark in both structures; centring comes from the lockup
rows' `align-items`.

## Hover: the wash turned into a grey oval once clipped — suppressed on both

The 6% ink wash made sense for the 8px PILL, but clipped to the 50% ellipse
it painted a grey OVAL swimming behind the dial on hover — the user report
("on hover they should be no sort of shape created, no oval or any other
shape"). Fixed by the element-qualified overrides above. Lessons:

- **A hover wash is a shape**. Once `border-radius: 50%` (or any tight
  clip) bounds the background, the wash stops reading as a tint and reads
  as an outlined figure behind the asset. Any round/ellipse element needs
  the wash question answered explicitly, not inherited from a shared pill
  rule.
- **Keep the rest of the hover contract**: `transform: scale(1.06)` from
  the in-marker base still applies on both sides, and `:focus-visible`'s
  2px outline stays — that's the keyboard user's pointer, not a hover
  shape.
- **Two suppression homes**: `button.wm-glyph:hover` in template.html and
  `a.wm-glyph:hover` in shellCss(). To bring a wash back on one side, flip
  its override; the probe pins transparency on BOTH, so expect the matching
  assertion flip in masthead-parity.mjs.
- The in-marker `.wm-glyph:hover` wash still sits in the shared base but is
  overruled everywhere; site-shell.css regenerating from the markers no
  longer revives a satellite wash.

## Media-query fallout: the phone toggle clearance sits on the lockup row

The top-pinned theme toggle needs `padding-right: 92px` reserved in the
phone rungs, and that clearance must hang on the ROW that spans the lockup:
`.lockup` on the main page (template.html ~:3251, ≤560px), `.sh-lockup` in
the shell (its ≤560px rung also moves `.sh-head` to a column, flattens
`.sh-right` to display:contents and absolutes `.sh-theme` into the corner).
Never put it back on the wordmark — with the dial a sibling, the h1's box
no longer holds the row's width, and the toggle overlaps the dial. Both
sides are probed at a 390px viewport.

## Accessibility (constant through the two designs)

The words and the control are separate elements, so each names itself
plainly: the wordmark (h1, or the satellite anchor with its "– Australian
federal polling" sr tail) announces the site; the dial control announces
its ACTION — `title` + `aria-label` + `aria-describedby="wm-action"`,
whose hidden span sits beside the control in both structures. If words and
button are ever re-merged into one element, the old constraint returns
(the control took its accessible name from "auspol tracker" and an
aria-label made the h1 announce wrong).

## Verification (headless — numbers, not screenshots)

`.matilda/probe/masthead-parity.mjs` (rewritten 2026-10-02, all checks
green) asserts the reunified parity — STRUCTURE as well as parts: each
side's split lockup exists (`.lockup` > text-only h1 + button.wm-glyph;
`.sh-lockup` > a.wordmark[href="/"] + a.wm-glyph whose only rendered child
is one inline `svg.wm-dial`), control boxes 63×45.7 (57+6 × 39.7+6) with
borderRadius "50%", hover backgroundColor exactly `rgba(0, 0, 0, 0)` on
BOTH `button.wm-glyph` and `a.wm-glyph`, wordmark 34px desktop + 32px at a
390px viewport and dial 57px / 54px on both, identical inks / graduation
heights / `--alp` resolution, the rd status block's three notes ("published
N ago" · "N pollsters" · "N months at most") and the phone compact line
naming the newest poll on the satellites, tab-row type parity (read the
main nav as `.tabs-set .tab .tab-label` — a bare `.tabs .tab` also matches
the inner facet tabs at 13.3px and fails falsely), no Archives link on
either navbar, and /#story opening the `.dl-backdrop` overlay.

Traps that stay: the main page's React puts stroke-dasharray in the STYLE
attribute (read `el.style.strokeDasharray` first, and inline style
serialises comma-separated so normalise commas before splitting); the
NEEDLE is never string-equal across two pages (each evaluate() samples
mid-settle) — compare ANGLES θ = atan2(b, a), |Δθ| < 1e-3 rad; the Newspoll
archive's Infogram embed stalls the load event past 30s — navigate with
waitUntil "domcontentloaded". The probe serves the BUILT site from its own
static server — run the build BEFORE the probe, and if an assertion FAILs
right after a sibling commit, rebuild + re-run before touching any code
(bitten live).
