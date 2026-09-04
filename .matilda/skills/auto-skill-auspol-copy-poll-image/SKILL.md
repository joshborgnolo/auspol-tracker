---
name: auspol-copy-poll-image
description: auspol-tracker — the poll-breakdown copy-card in .build/newtracker/assets/copy-poll.js (PLAIN sibling of copy-chart.js), glyph-level DOM painting via Range.getClientRects instead of foreignObject photography (WebKit drops flex/grid gaps there — fatal to the pd-meta band), SYNCHRONOUS widen→measure→restore with no stand-in clone, .copy-wide pin of the desktop ladder on phones, the Poll-row re-title (the capture relabels the band's Fieldwork row "Poll: ‹house›, ‹fieldwork›" in place, first in the list, and restores the original node — card-only provenance, NO painted header), one even 28px card margin with the footer pinning right/bottom, and probe lessons: property-level restore assertions, reading MutationRecords after a synchronous mutate+restore has already detached the nodes, and ink-bounds geometry DERIVED from card+panel+measure constants rather than assumed.
source: auto-skill
extracted_at: '2026-09-04T01:45:14.724Z'
---

# Copy-as-image for the expanded poll breakdown (copy-poll.js)

The `.poll-copy-btn` on every expanded poll-detail row turns the
breakdown into `auspol-breakdown-<slug>.png` (2400 physical px) via the
clipboard, falling back to a download. Landed on origin/main as 7a3a962;
the chrome was then revised twice on 2026-09-04: d98d617 tightened the
chart card's 64px frame to ONE 28px unit on all four sides and tried a
painted "Pollster" header line, and 6072cdb replaced that header with
the current design — the capture re-titles the provenance band's
Fieldwork row in place to "Poll: ‹house›, ‹fieldwork›", first in the
list, and the footer keeps only `auspoltracker.com`. Sibling of chart
copying — read `auspol-copy-chart-image` for shared conventions (inkVar
probe span, delivery fallbacks) — but note the chromes have diverged:
the chart card keeps its generous 64px frame.

## Map

- `.build/newtracker/assets/copy-poll.js` — the whole feature, a PLAIN
  IIFE: `widenPanel`, `retitleFieldworkRow`, `readModel`, `paintCard`,
  `houseName`/`metaValue`/`idLine`/`fileName`, `compose`, `copyPoll`,
  `attach` + MutationObserver at the bottom.
- `.build/newtracker/template.html` ~:1358 (after `.chart-copy-btn svg`) —
  `.poll-copy-btn` pill (28px, right:8px bottom:6px, `--pd-*` tokens,
  `.copied` state), reduced-motion rule, and the `.poll-detail.copy-wide`
  override block (see below).
- `.build/newtracker/build.mjs` ~:73 — PLAIN entry after `copy-chart.js`.
- `.matilda/verify-copy-poll/probe.mjs` — 26-check puppeteer probe
  (`NODE_PATH="$HOME/node_modules" node .matilda/verify-copy-poll/probe.mjs`
  from the worktree root; serves the tree over local http port 8743).
  Beyond behaviour checks it measures ink BOUNDS on the painted canvas
  and reads the capture-time DOM re-title through MutationRecords (see
  "Probing the chrome" and the probe lessons below).

## Architecture: paint the DOM's own layout, don't photograph it

copy-chart.js photographs a re-laid-out chart. copy-poll.js paints:

- The panel's beauty IS authored CSS (the word-spacing / figure-size
  `--pd-*` ladder, the pd-meta band's grid gutter), and the foreignObject
  rasteriser re-lays CSS out — **WebKit drops flex/grid gap inside
  foreignObject**, which is precisely what the provenance band's grammar
  depends on. So `readModel` captures the LIVE computed layout instead.
- `readModel(panel)`: element walk for backgrounds / hairline borders on
  all four sides / gradient stripes (`.skey-dot.resid`), then a TreeWalker
  over text nodes recording per-glyph records from
  `range.getClientRects()[0]` (x/y panel-relative, font style+weight+size+
  family, fill colour, underline flag). Per-glyph capture means tracking,
  word-spacing and inline margins all survive verbatim.
- `paintCard(model)`: canvas 2400×dynamicH, glyph scale
  `f = CONTENT_W/rootW` (CONTENT_W=1144), baseline from
  `measureText("MgQqy").fontBoundingBoxAscent/Descent`, underlines drawn
  from the glyph's decoration record, `toBlob` PNG. The card chrome
  paints ONE line of its own: the footer.

## Card chrome: one even margin, footer only

Constants: `CARD_W=1200, PAD=28, SCALE=2, CONTENT_W=1144, TEXT_H=15`.
The rule is **PAD everywhere** — around the card AND between the panel
and footer line inside, so height composes as
`PAD + panelH + PAD + TEXT_H + PAD` and no side of the sheet reads
emptier than another; panel origin is `ox=oy=PAD`. (d98d617's art
direction against the original 64px chart-style frame; copy-chart.js
kept 64px, so the siblings no longer share chrome numbers.) 6072cdb
removed the short-lived painted header — see the next section.

- Footer: only `auspoltracker.com`, right-aligned at `CARD_W-PAD`,
  y=`H-PAD-3`, `600 15px` ink2. Because it is the only chrome ink, it
  is what pins the card's right and bottom ink bounds (probe).
- `idLine()` still joins `houseName · Fieldwork` — its survivor is the
  download FILENAME only. `fileName()` runs in `copyPoll` AFTER
  `compose()` has returned, i.e. after the restore, so
  `metaValue(panel, "Fieldwork")` still finds the row the capture
  temporarily re-labelled. Keep that call order.

## The Poll row: provenance as a band row, not chrome (6072cdb)

The band carries Fieldwork/Published/Sample/… but never names the firm
(the house labels the row ABOVE the panel, which the card doesn't
take). First fix (d98d617) painted a "Pollster" header line; the user
sent it back twice — the pollster belongs IN the band's column of
facts, then more specifically the row should read "Poll: ‹pollster›,
‹fieldwork›" with the separate Fieldwork field gone. The current shape
is `retitleFieldworkRow(panel, house)`:

- Finds the band item whose `.pd-meta-k` trims to `"Fieldwork"`
  (`.pd-meta-i` wrapper, `.pd-meta-v` value).
- CLONES the item, sets the clone's k to `Poll` and v to
  `house + ", " + fieldwork` (comma-space; the filename slug keeps its
  own mid-dot register), removes the original and inserts the clone as
  the first child of `.pd-meta-items`. The clone is real DOM, so the
  row lays out and paints in the band's own label/value voice for free.
- The ORIGINAL node is kept in memory and restored verbatim
  (`clone.remove(); parent.insertBefore(item, oldNextSibling)`) — no
  textContent round-trip, so no markup the band row might carry is lost.
- Called inside `compose()` between `widenPanel` and the forced reflow,
  so the swapped row participates in the same synchronous
  widen→measure→restore block and never reaches the screen. It returns
  an untitle closure; `compose`'s `finally` runs untitle, then the
  widen restore. `house` comes from `houseName(panel)` — the row
  above's `.pollster-name`, `↗` stripped.

Layout consequences worth knowing: the label column of
`.pd-meta-items` (`grid-template-columns: max-content minmax(0,1fr)`)
shrinks during the capture because "Poll" is shorter than
"Commissioned by", and the template rule
`.pd-meta:has(.pd-meta-tail > :only-child) .pd-meta-i:first-child .pd-meta-v
{padding-right:42px}` now lands on the Poll row — harmless for a short
left-aligned value.

## The synchronous widen — no stand-in clone needed

`widenPanel(panel)` snapshots BOTH the panel's and its host `<td>`'s style
attributes, pins the host (height + overflow:hidden + position:relative
if static), adds `.copy-wide`, parks the panel `absolute; left:-99999px;
width: CONTENT_W px` (1144 — it tracks the content constant, so a margin
change never strands the park width), returns an attribute-faithful
restore closure (null → `removeAttribute`). Since the park width equals
CONTENT_W, the glyph scale factor is ≈1 — the painted panel is life-size,
not resampled. `compose` then does reflow → readModel → (paintCard
inside the try) → restore **in one synchronous block**.

Unlike charts, nothing re-renders the poll detail during that window
(its styling is stylesheet-only; React is not involved between widen and
restore), so the park NEVER paints — no frozen-clone stand-in, no sibling
freeze, none of copy-chart's widenForCopy complexity. Don't copy that
machinery over.

Note: `.poll-detail` is the only child of a `<td>` in BOTH the Latest
table and the All-polls archive table; the host pin keeps rows below from
climbing while the panel is out of flow.

## `.copy-wide` pins the desktop ladder on every rung

The pd-type ladder lives on `--pd-*` tokens with narrow-run media-query
overrides (template.html ~:2051–2530). During capture,
`.poll-detail.copy-wide` re-pins the BASE values (–pd-gut:26px,
–pd-hero:40px, –pd-fig:20px, –pd-body:13.5px … padding 28px 24px).
Mechanics: the doubled-class specificity beats the media-query rules,
and because both sides assign the same `var()` token names, token values
survive media-vs-class ties. Also hides `.poll-copy-btn` and
`.pd-meta-tail` (STRIP_SEL) during capture. Result: a 390px phone still
emits the 2400px desktop-ladder card — the probe asserts this.

## Delivery + attach wiring

Same shape as copy-chart: promise-valued `ClipboardItem` write first
(keeps the user gesture alive across the async rasterise), blob-valued
fallback, then a tagged-objectURL download; `flash(btn)` swaps to a tick
for 1600ms. `attach()` mounts one button per `.poll-detail` (guarded by
`:scope > .poll-copy-btn` existence); a MutationObserver (childList,
subtree) → rAF-queue re-attach covers React mounting/collapsing rows.
The click handler stopPropagation()s — a click on the button must not
close the row that expansion toggles.

## Probe lessons (this WILL bite again)

Restore-invariant failures on the first run were probe-bugs, not
feature-bugs. Diagnostics three ways (MutationObserver with
attributeOldValue; stack-trapping `setAttribute`/`removeAttribute` and
the `style=` setter; 50ms attribute sampling) all proved
`copy-poll.js` restores faithfully (`removeAttribute`, attribute absent,
zero mutations for 3.2s) — yet `getAttribute("style")` occasionally
returned `""` AFTER the capture, written by app-side actors asynchronously
and uncorrelated with the copy.

Rules extracted:

1. **Assert the property-level contract your feature owns**, never
   whole-attribute identity. The probe checks
   `panel.style.{position,top,left,width}` all empty,
   `td.style.{height,overflow}` empty, and `.copy-wide` gone — evaluated
   synchronously right after the click (restore completes inside the
   click dispatch). It's green 3/3; attribute-identity checks flaked 2/4.
2. In a React+plain-script hybrid DOM, other actors legitimately cycle
   inline styles around your capture window (a `setProperty` cleanup
   leaves `style=""` behind, which `hasAttribute` reads as "dirty").
3. To find who dirties an attribute: MutationObserver on the element
   with `attributeOldValue:true` for sequencing, plus own-property
   overrides of `setAttribute`/`removeAttribute`/the `style=` setter
   capturing `new Error().stack` for authorship. CSSOM property writes
   (`el.style.foo = …`) bypass setAttribute — trap the cssText setter or
   use the observer for those.
4. Download-fallback testing: force `navigator.clipboard.write` to
   reject, hook `HTMLCanvasElement.prototype.toBlob` to sample painted
   colours (a blank sheet fails `colors > 6`), tag downloads per page so
   parallel probe pages can't claim each other's files, and drive
   downloads via CDP `Browser.setDownloadBehavior` into a per-page mkdtemp
   dir.
5. **Probing DOM mutations that live and die inside one synchronous
   block** (the Poll-row re-title): MutationObserver callbacks fire only
   after the block — by then the swap is undone and the involved nodes
   are detached. The RECORDS still carry everything: `previousSibling`
   is recorded at mutation time (so "inserted first" survives the
   restore), and a removed/added node's OWN text is readable from the
   detached node at callback time. To prove "the Fieldwork item left and
   returned as the same node", stamp nodes with WeakMap ids inside the
   page (returned records must be JSON — DOM nodes don't cross
   `page.evaluate`) and pair a `remove(k=Fieldwork)` record with a later
   `add` of the same id. Filter by label text (`k === "Poll"`), not
   position in the record stream — React's own expand renders also add
   `.pd-meta-i` rows.
6. **Ink-bounds geometry must be DERIVED, not assumed.** The probe's
   `toBlob` hook samples the canvas at 1/4 scale and records
   `{minX,maxX,minY,maxY}` of dark pixels. Only the footer ink reaches
   the card chrome, so it pins right (`2400−maxX ≈ 56`) and bottom
   (`H−maxY ≈ 56`) exactly. Left/top are layout derivations:
   left = 2×(28 PAD + 24 panel pad + (1144−2×24−820)/2 centred
   --pd-measure inset) = 380 physical; top = 2×(28+28) + first-line
   leading ≈ 116. Pin DERIVATIONS with ±bands around the computed value,
   log the raw bounds on every run (`console.log(card.ink)`) — when the
   painted header was deleted mid-iteration, minX silently jumped
   56→380 and two probe rounds were lost to incorrect assumed constants.

## Verification checklist when touching this

build.mjs rebuild → validate.mjs → probe green (run it twice — its own
flakiness history is documented above) → commit feature + rebuilt
`index.html` + regen sidecars (`assets/9f09dca2-*.js`, `feed.xml`)
together, with explicit `git add <paths>` never `-A` (see
auto-skill-shared-repo-session-race).
