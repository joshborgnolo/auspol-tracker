---
name: auspol-font-pipeline
description: auspol-tracker — adding or swapping a self-hosted typeface end-to-end (Fira Sans add 9f2c168, swapped to one variable Archivo cut 7a3451f, hero --hero-num rotation 14d80ef→91801d4→86e444a: Crimson Pro → Newsreader → Source Serif 4; then c6f6d95 retired --hero-num for --heads and FLIPPED the split — Crimson Text owns the hero 2PP figure, Source Serif 4 briefly owned card titles + tab labels until 9ce4a27 reverted card titles to Crimson, leaving --heads TAB-LABEL-ONLY. A pure reassignment with both families already shipped needs NO font-file changes: 2-file commit. The hero figure's decimal-point seam is NO LONGER pure CSS: the static .roll-sep margin kerning era (1e3e66e, letter-spacing direction trap) was scrapped (73a0d33) and replaced by RollNum's dynamic `drift` opt-in (e08e45b → see auto-skill-auspol-rollnum-drift — per-neighbour negative margins computed in JS from measured Crimson metrics). Latin woff2 subsets live in .build/newtracker/fonts/ and are registered in build.mjs FONTS; template.html's @font-face block is GENERATED behind a dead "splice-anchor" rule — never hand-edit it. The hashed assets/fonts/<name>.<hash8>.woff2 outputs ARE git-tracked and must be staged with the commit or Pages 404s the faces. Preload only faces that paint before interaction.
source: auto-skill
extracted_at: '2026-09-02T05:16:14.424Z'
---

# auspol-tracker: font pipeline (self-hosted woff2 subsets)

## Map

- **Source subsets**: `.build/newtracker/fonts/*.woff2` — latin subsets fetched from Google
  Fonts gstatic. The build reads these bytes; nothing references Google at runtime.
- **Registry**: the `FONTS` list in `.build/newtracker/build.mjs` (~:103). One entry per FILE,
  not per weight: `{file, family, style, weight, preload?}`. A static cut takes a single weight
  (`weight: "700"`); a variable cut takes the range (`weight: "300 700"` IBM Plex Sans,
  `weight: "100 900"` Archivo). Each entry emits exactly one `@font-face` rule;
  the file is copied to `assets/fonts/<file-minus-ext>.<sha256-8-of-bytes>.woff2` and stale
  hashed outputs in `assets/fonts/` are auto-swept each build. Build log line: "N faces, X KB".
- **Generated block**: the `@font-face` section at the top of `template.html` is BUILD OUTPUT —
  its header comment says "edit those [FONTS list + files], never this block", and the dead
  `@font-face { font-family: "splice-anchor"; }` rule is the splice anchor the builder
  replaces. Never edit the block by hand.
- **Preload**: `preload: true` emits a `<link rel="preload">`. Reserve it for faces that paint
  in the first viewport (Crimson 400/600/700, IBM Plex Sans, Source Sans 3 wordmark, and
  Crimson Pro since 14d80ef — the 68px hero figures ARE the first paint). Fira
  Sans got **no** preload — it only renders behind a row-expand click.
- **CSS consumers**: template.html `:root` holds family tokens (`--serif` Crimson,
  `--sans` IBM Plex, `--figures` Archivo since 7a3451f, `--heads` Source Serif 4 since
  c6f6d95, ~:91-97 — `--hero-num` had exactly one consumer and was RETIRED by c6f6d95).
  For a new usage class add a token and point
  rules at `var(--figures, var(--sans))` so a missing token degrades to the sans stack — don't
  sprinkle raw family strings into rules. `--heads`' SOLE consumer is now
  `body.editorial .tab-label` (wght 600) — 9ce4a27 moved `.card-title` (wght 540) BACK to
  `var(--serif)` when the user reverted the h2 subheads to Crimson the same week;
  keep `var(--heads, var(--serif))` with the fallback so a missing token degrades to the
  serif stack. The c6f6d95 era put the weight ask
  BACK on Crimson for the hero figure: `.ro-num` declares wght 650 but Crimson Text's
  static set caps at 700, so face matching lands on the 700 cut (comment at :1007 says so).
  A 650→600 lightening (07739f5, crimson's real Semibold cut) was reverted SAME SESSION
  (1e3e66e) when the user asked for 650 back: Crimson's static set has exactly THREE normal
  stops (400/600/700), so between 600 and 700 there is NO drawn step — a "slightly lighter"
  ask below 700 has 600 as its only legal answer, and declaring 650 renders 700, not a
  midpoint. A true in-between needs a variable-cut family; say this aloud BEFORE touching
  the number.
  The reverse era (86e444a→c6f6d95) had the ask on the hero: weight-650 — an in-between
  weight NO static cut ships, so the family had to arrive as a wght variable cut (Source
  Serif 4 ships 200–900 in one file;
  Newsreader rotated through at 91801d4 before the weight ask landed). When the user names a
  weight like 650 AGAINST A FAMILY BEING ADDED, grep css2 for a `font-weight: 200 900` RANGE
  in the family's latin block —
  a family with only static css2 entries (Crimson Pro caps its normal range at 200..900 but
  Newsreader interleaved an opsz axis requiring `ital,opsz,wght@1,40..800` style URLs) can
  still be fine, but a family whose variable range ENDS below the ask cannot be. When the
  family is already shipped, an in-between weight either interpolates (variable cut) or
  face-matches to the nearest static cut — both are valid, just say which in the CSS comment.
- **Reverse lookup (element → font)** — the "what font is X?" question, current as of
  e08e45b (2026-09-02) against template.html (tokens at :91–97):
  - 68px 2PP hero figure (`.ro-num`, :1007) = `--serif` = **Crimson Text**; weight sits at
    72px/600 since c083a8c (the 650→600→650→600 ping-pong is settled there — 650 face-matches
    to Crimson's 700 static cut, see weight paragraph below). Its decimal point no longer
    carries static CSS kerning (the `.roll-sep` margin-left rule was scrapped at 73a0d33);
    the seam is computed PER ROLL by RollNum's `drift` opt-in now (e08e45b — see
    "Kerning the hero figure's decimal point" below and auto-skill-auspol-rollnum-drift).
  - h2 card subheads (`.card-title` :863 — Two-party preferred, Primary vote…) =
    `--serif` = **Crimson Text** again since 9ce4a27's partial revert (wght 540
    face-matches crimson's 600); ONLY editorial tab labels
    (`body.editorial .tab-label` :2633 — Snapshot / Past cycles / All polls) =
    `--heads` = **Source Serif 4** variable cut, interpolated at 600.
  - Still on `--serif` = **Crimson Text** (never moved by c6f6d95, or reverted to it):
    `.static-summary h1/h2` (:217/:221), `.dl-month` (:453), `.method-h`.
  - The hero-interval clause row (`LABOR · 51.4 … Weighted aggregate … 95% interval …
    N polls in D days … 3M/6M/12M/AL`) = **IBM Plex Sans** inherited from the body
    (`--sans`): `.lead-tag` 14px/700, `.hi-method`/`.hi-note` 12px, `.hi-term` buttons
    `font: inherit`, dot separators pinned 12px.
  - **The heads/hero split flips over time**: 86e444a set hero=Source Serif 4 / heads=Crimson;
    c6f6d95 set hero=Crimson / heads=Source Serif 4; 9ce4a27 PARTIALLY reverted (card
    titles back to Crimson, tabs stayed). Both eras keep the two DELIBERATELY
    different faces — never merge them — but always re-grep before answering "what face is
    X?"; a pre-9ce4a27 answer over-assigns Source Serif 4 today.
- **Header and entry comments go stale**: build.mjs's FONTS header ("N @font-face rules over
  N files -> N latin faces") desyncs each addition — cheap to refresh when you change the
  list. Per-ENTRY consumer comments desync on any pure face reassignment too: c6f6d95 left
  "Source Serif 4 sets ONLY the hero's 2PP figures" false, caught and fixed in 07739f5 —
  sweep FONTS comments whenever you repoint a token.
- **Rapid same-token rotations** (14d80ef→91801d4→86e444a in one session): each swap is its
  own self-contained commit — run the WHOLE recipe (source cut → FONTS entry → token value →
  rebuild → verify built CSS → commit BOTH deletions of the predecessor and BOTH additions of
  the successor) fully every time, even minutes apart. The 7-path footprint (template.html,
  build.mjs, index.html, new source woff2, new hashed woff2, old source woff2 DELETED, old
  hashed woff2 DELETED) never shortcuts.

## Adding a typeface (recipe, Fira Sans, 2026-09-02 → commit 9f2c168)

1. FIRST check whether the family ships as ONE variable latin cut: request
   `css2?family=X:wght@100..900` (Chrome UA required) and inspect the latin block. Archivo v25
   returns a single woff2 URL with `font-weight: 100 900`, and even a `wght@400;700;800`
   request returns the same URL repeated per weight (one file, no per-weight statics). An
   `ital,wght@0,200..900;1,200..900` request (Crimson Pro v28) returns the two styles as
   SEPARATE latin blocks with separate woff2 files — download only the styles the CSS will
   actually ask for (the hero figure ships normal-only in one file: `crimsonpro-latin.woff2`,
   FONTS `weight: "200 900"`). A
   variable cut means ONE FONTS entry `{weight: "100 900"}` and a clean swap deletes the old
   family's static cuts. Grep traps on css2: `grep -B1 -A8 "latin */"` matched nothing and
   `grep -A1 "latin \*/" | grep font-weight` returned empty — dump blocks with
   `grep -B2 -A8 "latin \*/"` or the awk block-dumper
   `awk '/^\/\* latin \*\/$/{p=1} p{print} p&&/}/{p=0}'` (proven on Crimson Pro), then pull
   the `src:` woff2 URL + `font-weight` per block. Save as
   `.build/newtracker/fonts/<family>-<weight>-latin.woff2` (static) or `<family>-latin.woff2`
   (variable). Ship the weights the CSS will ask for (Fira: 400 fallback / 700 for `<b>` /
   800 for `.netv`/`.seat-est`).
2. Verify the downloaded cut BEFORE wiring: `file` it (must report "Web Open Font
   Format Version 2"), and sanity-check byte size (~120 KB is normal for one variable latin
   cut — Source Serif 4 landed at 122,168). A curl that pulled an error page or a truncated
   transfer corrupts EVERY commit-2-facing build log (faces count still looks right) — the
   `file` check is the cheapest catch.
3. Append entries to FONTS with a short rationale comment (usage class + preload decision).
4. Add the `--<usage>` token to `:root`; repoint the target selector group.
5. `node .build/newtracker/build.mjs` (validate.mjs runs inside it) — confirm the face count.
6. Verify the built `index.html`: `grep -n "font-family: 'Fira Sans'"` (one per face), the
   token definition, and the consuming rule — **CSS greps verbatim** (no babel escaping; that
   trap is JS-string-only, see auspol-built-html-verification).

## Reassigning faces WITHOUT new font files (recipe, c6f6d95 — heads↔hero flip)

When both families are already shipped in FONTS and the ask is "put face A on element group
X, face B on element group Y", NO woff2/FONTS/preload work is needed — different weights of
an already-shipped variable cut need no registry change, and the build log's face count is
expected to be UNCHANGED (c6f6d95 stayed "10 faces, 321 KB"):

1. Confirm both families are in FONTS (grep build.mjs). If either is missing, this is the
   full add-swap recipe above, not the cheap one.
2. Edit ONLY template.html: define/repurpose a `:root` token (`--heads`) and repoint the
   consuming selectors at `var(--heads, var(--serif))`-style fallbacks. Retire any
   single-consumer token the flip orphans (c6f6d95 deleted `--hero-num`) — grep the template
   for the old name first so no consumer dangles.
3. Scope strictly to the elements the user named; list the nearby lookalikes you deliberately
   left on the old face (c6f6d95 left `.static-summary h1/h2`, `.dl-month`, `.method-h` on
   Crimson) and offer them as a follow-up rather than expanding scope silently.
4. If a declared weight has no static cut in its NEW family (650 on Crimson Text), keep the
   declaration and leave a CSS comment naming the face-match outcome ("crimson ships no 650
   cut - face matching lands on its 700").
5. Rebuild, then verify the BUILT index.html by grepping for the retired token (expect 0 —
   that single check proves no dangling definition or consumer), the new token definition,
   and each repointed selector.
6. Commit is 2 paths: template.html + index.html. No fonts deletions/additions — if
   `git status` shows woff2 churn from a pure reassignment, something else rebuilt them;
   investigate before staging.

## The hero figure's decimal point — static kerning era SUPERSEDED, now dynamic drift

The hero 2PP figures render through `RollNum` (`window.RollNum`, asset 73de0c58 — hero
call sites carry `drift`; the Delta lead line uses the same component without it). Each
DIGIT becomes a reel (`.roll-d` > `.roll-reel`, animated by `--d`) and each NON-digit
glyph becomes `<span class="roll-sep">` — the decimal point is the only separator a
2PP readout ever carries (leads are `Math.abs`'d, so no minus).

- **Static CSS kerning is GONE**: 1e3e66e's `.ro-num .roll-sep { margin-left: -0.08em }`
  (itself the fix for 07739f5's letter-spacing direction trap) was scrapped by user
  request at 73a0d33. Since e08e45b the point's seam is computed in JS per roll —
  RollNum's `drift` opt-in sets per-neighbour margins from measured Crimson metrics and
  transitions them on the reel's curve (the point tucks under a 1's empty shoulder and
  breathes back out for wide digits). Full machinery, metrics probe recipe, and the
  failed uniform-padding attempt (f5ac5b0) are documented in
  **auto-skill-auspol-rollnum-drift** — go there before touching `.roll-sep` or RollNum.
- **Direction trap, learned by live user correction (still true in any kerning ask)**:
  `letter-spacing: -X` tightens the gap AFTER the glyph (point→next digit); `margin-left`
  tightens the gap BEFORE (preceding digit→point). State aloud which PAIR each
  declaration moves before shipping.
- **Why a static seam was doomed** (the user complaint that killed it): Crimson Text
  ignores tabular-nums — measured on the shipped 600 woff2, its 1 advances 0.371em
  against 0.493em for every other digit. The reel slot is the widest figure's 0.493em
  frame, so a 1 leaves 0.122em of shoulder the point then hangs on; one anchorage reads
  wide against 1 and tight against everything else (the 51.2↔54.2 toggle).
- Weight side note: the same era's 650→600→650→600 ping-pong settled at **72px / 600**
  (c083a8c) — Crimson's static set has no notch between 600 and 700, so "slightly
  lighter/heavier" below 700 has whole stops as its only answers (600 or 700).

## Headless probe gotchas (fonts on expansion-rendered UI)

- Expansion markup: rows are `tr.poll-row`, toggled by
  `<button class="exp-btn" aria-label="Expand full breakdown">` in the first `.exp-col` cell.
  There is **no `.arch-row` class** — a probe guessed it, clicked nothing, and got an all-null
  result. If a selector misses, dump table classes/row markup first, then write assertions.
- **`document.fonts.check()` is lazy-load-sensitive**: a face reports not-loaded until some
  element in the DOM actually requests its weight. The Fira 800 check returned false with only
  400/700-weight elements rendered — expected, not a bug; expand rows containing an 800-weight
  figure (`.netv`) and the 800 face loads. `getComputedStyle(el).fontFamily` returns the
  *requested* stack regardless of download state, so prove rendering with the
  `document.fonts` loaded-set filter (`/Archivo/.test(f.family)`), not the computed style
  alone — and prove the face RESOLVED over the fallback (not just was requested) with a canvas
  width probe (Archivo swap, 7a3451f):
  `const c = document.createElement("canvas").getContext("2d"); c.font = '700 20px "Archivo"';`
  then `c.measureText("0564").width` must differ from the same measurement for the next family
  in the stack (Archivo 700 ≈ 47.65 ≠ IBM Plex Sans 700 = 48).
- Not every expansion contains every figure class: `.netv`/`.seat-est` only appear in the
  detail of polls that carry those metrics — expand several rows (all 8 Latest rows) before
  concluding a selector is missing vs. absent-for-this-poll.
- 320px viewport has a pre-existing docOverflowX baseline — known, not a font regression.

## Commit footprint (2 paths for a pure reassignment, c6f6d95 — template.html + index.html only; 9 paths for the 3-cut Fira add; 12 for the Archivo swap, 7a3451f; 5 for the Crimson Pro add, 14d80ef — template.html, build.mjs, index.html, source cut, hashed output; 7 for each hero swap 91801d4 Newsreader and 86e444a Source Serif 4 — the 3 shared files + ONE new source cut + ONE new hashed output + the two predecessor deletions)

- `template.html`, `build.mjs`, `index.html` (sources + regenerated artifact)
- A SWAP also stages: the deleted old source cuts AND the deleted old hashed outputs (the
  build sweeps them, so they appear as pending deletions — in the Archivo case 3+3 fira files)
  plus the new source + new hashed output. `git add` each deleted path explicitly.
- `.build/newtracker/fonts/firasans-{400,700,800}-latin.woff2` (new sources)
- `assets/fonts/firasans-{400,700,800}-latin.<hash8>.woff2` (**git-tracked generated outputs**
  — `git ls-files assets/fonts` shows the Crimson/Plex hashed cut files committed; skip these
  and Pages serves 404s for the faces). If a font's bytes ever change, the sweep means the old
  hashed file shows as a deletion — stage that too.
- Shared repo: re-`git status` immediately before `git add` (a scheduled "Update Essential
  Report data" agent commit landed on origin/main mid-task); stage only owned paths, never
  `.matilda/*`, `.impeccable/`, or foreign scratch — see git-prestaged-commit-sweep /
  auspol-build-pipeline rule 13.

Related: auspol-build-pipeline (never hand-edit index.html), auspol-poll-table-typography
(the consuming type-size map of the expanded rows), auspol-built-html-verification (CSS vs
JS-string grep behaviour in the built page).
