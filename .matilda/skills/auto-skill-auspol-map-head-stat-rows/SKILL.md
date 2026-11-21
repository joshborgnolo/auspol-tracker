---
name: auspol-map-head-stat-rows
description: "/map/ Winner-head plain stat rows — adding a label figure row to seatStat's head grid (informal 47dff715) AND embedding the Now frame's word-note inside the Seats section (.st-seat-note under the make-up legend, in the head's inherited Commissioner; 4th seatsNote param + NOW_AUS_DEK, user call 2026-11-07), the per-section .st-sep separators (removed 72ab2240 → RESTORED and crowned cf656274/370e5cf1 same morning), statClassArea pooled payloads for seat-class scopes, and what moving a figure/line INTO the head does to non-winner lenses."
source: auto-skill
extracted_at: '2026-11-06T07:02:35.780Z'
updated_at: '2026-11-08'
---

# /map/ Winner-head plain stat rows + scope pooling

The winner head's figure grid is `seatStat(m, st, label, seatsNote = "")`
in `.build/map/app/app-4-story.js` (the 4th param shipped 2026-11-07 for
the Now word-note — see its section below). Turning a story `.st-sec`
figure into a
plain label row in that grid (user call 2026-11-06: "keep it simple: just
say 'Informal: x%', in the same font as 'Seats (…)'"): the row is one
`<span class="st-lab">`; the job is mostly getting SCOPE payload
correctness, not markup.

## Where the row goes

Layout inside seatStat's returned `<h3 class="st-stat">` as of 2026-11-07
(the separators' same-morning removal at 72ab2240 was reversed hours
later by 370e5cf1's restore + cf656274's crown: the body is now a
`sections[]` array emitted `${sep}${sections.join(sep)}${sep}`):

- `two` — Two-party `<span class="st-lab">…` + `.st-tpp` pair + swing span
- `fg` — the formed-govt/govt ink tag, rides INSIDE the two-party block
- `fpRow` — "Primaries" label + `statPrimaryGrid(m, A, "", true)`
- ONE combined Seats section: `<span class="st-lab">Seats${shareTxt}</span>`
  + seats `row()` grid + optional change line + `mk` (`statSeatMakeup`'s
  `.st-makeup` bar + `.st-seat-legend`) + `seatsNote` — **the Now
  word-note lands inside this section, after the legend** (see below)
- `infLine` — the last section, `<span class="st-lab">Informal:
  ${f1(A.infPct)}%</span>` — Informal does NOT sit next to `mk` since the
  sections reshape; the seats section's closing `.st-sep` precedes it

CSS is bought from **page.css** (`.build/map/app/page.css` is the ONLY css
source — `.build/map/assemble.mjs` regenerates **map/map.css** from it, so
a rule edited into map/map.css directly is lost at the next assemble;
always edit page.css, then `node .build/map/assemble.mjs`). `.st-lab` is
the label font (13px / w500 / left); a plain `.st-stat`-child label needs
no new rule. A free-running NOTE (running text, not a figure label) is the
one case that does want its own class: `.st-seat-note`, added beside
`.st-seat-key`.

`.st-seat-note` gap mechanics (loosened 2026-11-08, commit 2d10bfbf):
the element directly above is `.st-seat-mix { margin: 12px 0 18px }`, so
legend→note gap = 18px + the note's own `margin-top`. It shipped with
`margin-top: -8px` (a deliberate 10px tuck); the user called the gap too
tight and `margin-top: 0` landed, taking the gap to the full 18px — the
negative tuck was removed on a user call, not by accident. Probe recipe
when touching it: served `/map/#y=now`, `getBoundingClientRect()` on
`.st-seat-note` vs `.st-seat-mix` (10px read pre-loosen, 18px after,
identical at 1280 and 390px, document overflow 0 both).

## The .st-sep section separators (fb453bd4) — REMOVED the same morning

**2026-11-07 status: 72ab2240 ("the two-party figures name their sides;
the formed-govt tag sits under the eyebrow") deleted this entire lane six
minutes after it landed** — `.st-sep` CSS, the `sep` span and emissions
all gone, replaced by an `.st-tpp` inline-grid with per-side `.st-nm`
name captions and the fg tag moved up beside the eyebrow. The committed
probe `.matilda/probe/map-head-separators.mjs` is still in the tree but
targets removed classes — RED at tip, orphaned. Re-landing (user
decision pending) = re-add against the 72ab2240 layout and re-sync the
probe; the mechanics below are the full recipe. The working-tree tell
that caught it: a staging rehearsal grepping the tip's assets for
`st-sep` found zero — always token-grep the CURRENT tip before
re-verifying, sibling lanes reshuffle this head daily.

Each head section closes on a full-width double hairline
(`<span class="st-sep" aria-hidden="true">`, emitted once as
`const sep = …` in seatStat). Three traps, all verified live this session:

1. **Conditional sections take no stray rule.** `two` and `fpRow` are ""
   on frames lacking the data, so the separator rides INSIDE the ternary
   (`two ? two + fg + sep : ""`) — never emitted bare between them.
2. **`.st-stat` is `flex-direction: column; align-items: center`, so a
   full-width child needs explicit stretch** (`.st-lab` uses
   `align-self: flex-start`, `.st-seat-mix` `width: 100%`); the rule gets
   `align-self: stretch`.
3. **border-box bites two-border rules**: page.css inherits the sitewide
   `* { box-sizing: border-box }`, so `height` INCLUDES the borders.
   First cut `height: 2px` + two 1px borders rendered the borders
   ADJACENT — a single 2px bar, not two lines (probe read h=2 back).
   `height: 4px` = 1px rule + 2px gap + 1px rule. Assert the rendered
   bounding-box height, not the authored numbers.

Spacing rhythm: `.st-sep { margin-top: 20px }` +
`.st-sep + .st-lab { margin-top: 20px }` (the bare `X + .st-lab` 22px
adjacencies go dead between sections once a rule sits there — the
selectors still serve bare rows elsewhere).

`.matilda/probe/map-head-separators.mjs` pins it: child-kind sequence of
`.st-stat` (2025 and the fg-bearing 2022 frame: `… swing fg SEP lab …`),
every separator 1px/1px borders at exactly 4px tall, full head width,
still exactly three after a scope swap, 390px overflow 0. A new tail row
or a new head section joins the chain by emitting `… + sep` and extending
this probe's expected sequence.

## Scope payloads — the actual work

`seatStat`'s `A` is scope-dependent via `statScopeArea(m, st, sel)`:

- **Nationwide / a state**: `A = m.areas[…]` — the STORED aggregate, already
  carries `infPct` etc.
- **A seat class (`cls:` scope)**: `A` is POOLED LIVE by
  `statClassArea(m, idx)` (~:279) from `m.res.divs` raw rows (res.divs stays
  the BASE ELECTION on Now frames — by-elections only replace m.divs, per
  its header comment). Its old payload had no informal count at all: no
  per-class informal figure existed anywhere. Adding a pooled quantity is
  one accumulator in its loop + one return field — the shipped diff:
  `let inf = 0;` → `if (d.inf != null) inf += d.inf;` →
  `infPct: formal + inf ? (100 * inf) / (formal + inf) : null`.
  Mirror the shipped basis EXACTLY: `infPct = 100·Σinf /(Σformal + Σinf)`
  where formal = Σ candidate votes (`d.c` rows' `c[4]`) — the same shape as
  `deriveDiv`'s per-seat `infPct` (app-1-base.js ~:925) and the printed
  check in `.build/map/build_map_data.py` (:874). Sometimes the class
  payload differs silently from the stored aggregate's basis — recompute a
  class figure from raw rows to be sure before trusting it.

Guard tail rows with `A.infPct != null` regardless: `f1(undefined)` prints
"–" and "Informal: –%" looks broken.

## The lens consequence of moving INTO the head

`areaHedDek`'s switch returns `stat: seatStat(…)` ONLY in
`case "winner"` (both Now and election branches); every other lens returns
`{ hed, dek }` with NO stat. A story `.st-sec`, by contrast, renders under
EVERY lens (the old Informal block did). Moving a figure to the head
therefore REMOVES it from all non-winner lenses: accept that the figure
survives per-lens only where that lens says it itself (the informal lens
keeps its own hed/dek, `case "informal"` ~:598). Before deleting an
st-sec, grep its heading over `.build/test-map-*.mjs` + `.matilda/probe/` —
"Informal votes, % of ballots cast" hits in `.matilda/probe/explained-
house-flip.mjs` are an UNRELATED analysis-page title, not a map pin.

## Verification (head-label changes)

`.matilda/probe/map-informal-line.mjs` (committed; boot/serve/puppeteer
setup identical to `map-closest-margins.mjs` — fresh port, `curl -sf` the
index first). Its four mechanics:

1. **Sequence + text**: read
   `[...document.querySelectorAll(".st-stat .st-lab")]` and assert the exact
   sequence order and new line — observed
   `["Two-party preferred (margin of 5.2)","Primaries","Seats (Labor won
   62.7% of 150)","Informal: 5.6%"]`.
2. **In-page oracle**: inside the page, `fetch("/map/data/core-2025.json")`
   and pool rows with THE SAME arithmetic the app ships
   (`Σinf`, `Σ c[4]`; per-class group via `d.cls`), then assert the
   displayed string IS `Informal: ${f1(pool)}%`. National 5.6% matched;
   this catches a wrong basis (seat averages vs pooled counts) the eyeball
   can't.
3. **Scope-drive**: click `[data-scope-trigger]`, then the first
   `[data-scope^="cls:"]` item ("Inner Metropolitan|Inner-metro figures"),
   re-read the labels, assert the figure equals a per-class pool computed
   the same way (Inner Metropolitan 4.5% vs national 5.6%) — proves the
   pool feeds the head, not a stored national leftover.
4. **Phone width** at 390px after adding head text:
   `documentElement.scrollWidth - clientWidth <= 0` — 0px observed.

Don't assert REMOVED copy by grep alone — also assert the old
`#story .st-sec h3` heading is gone in-DOM.

## Merging it (same session's third sibling land)

This lane collided HARD with the sibling vote-bands commit 37a5919f (it
rewrote the `vtBlock` cast lines immediately beside the removed Informal
st-sec — `app-4-story.js` itself conflicted, not just generated files):
resolve the source by hand keeping BOTH intents (their `vtScope` code, my
deletion), then `git checkout --ours map/map.js map/index.html` +
`node .build/map/assemble.mjs`, continue the rebase, grep the bundle for
both features (`Informal: ` ×1, `vtScope` ×2), and re-run both lanes'
tests — their `test-map-vote-bands.mjs` plus the informal probe — before
pushing (`47dff715`, assembled from resolved sources).
