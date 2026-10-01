---
name: auspol-cyc-chipmove-band
description: auspol-tracker — the Past-cycles ".rd-cyc-chipmove" band floating 12px above the #cyc-tpp eyebrow divider, FLUSH LEFT (ship 7964e12, follow-ups 204654b, COLUMN STACK ba613b3; left move + 12px gap + ≤640px 60px headroom 2026-10-02 after user: "move it to the left… breathing room from the line below it"; JS HEADROOM REFIT same day after user: "more than 5 drawn → causes mayhem with the text already in the page… the rest of the page content is not pushed up"): RdSec tools-slot anchoring (top: pad+1px of --cyc-chip-pad-fallback --rd-sec-pad, translateY(-100%−12px)), band is a COLUMN flex — chip on top, the drawn-pills row stacked beneath it, both flush left — plus the read-only .rd-cc-cur sitting-term pill and RdCycleChart's nonDefault note-gating; the BAND IS OUT OF FLOW, so rd-cycles.jsx's chipmove fit() measures the wrapped band and GROWS --cyc-chip-pad + padding-top INLINE on #cyc-tpp when the stack needs more than the CSS floor (a tall stack pushes the page down instead of climbing over the Summary foot). Probe .matilda/probe-cyc-chipmove.mjs.
source: auto-skill
extracted_at: '2026-10-01T13:50:56.926Z'
---

# Past-cycles chip band: anchor, drawn pills, verdict-word gating

All line numbers are for commit `ba613b3` (204654b + the column stack; the
sibling session's WIP in the working tree can shift `rd-cycles.jsx` and
`d1a1d215-….js` line offsets — trust tokens, not raw numbers). The headroom
refit shipped on top of `14ddd71` (2026-10-02) — search `chipmoveRef`.

## Homes

| Piece | Where |
|---|---|
| CSS anchor recipe | `rd.css` ~:1590-1600 (`body.rd .rd-cyc-chipmove`, comment block above it) |
| ≤640px headroom floor + label hide | `rd.css` :98-116 (`body.rd #cyc-tpp` + `.rd-cc-drawn .rd-cc-l` in the 640 block) — a FLOOR now, not the whole story |
| JS headroom refit | `rd-cycles.jsx` `chipmoveRef` + `useLayoutEffect(fit)` right after the story-floor effect inside `RdPastCycles` (~:341-376); ref hung on the `<span className="rd-cyc-chipmove" ref={chipmoveRef}>` in the tools JSX |
| Tools JSX (band contents) | `rd-cycles.jsx` ~:953 — `tools={…}` on `<RdSec id="cyc-tpp" …>` |
| Drawn-row styling | `rd.css` (.rd-cc-drawn no longer has `margin-top: 12px`; .rd-cc-pill / .rd-cc-cur unchanged from the controls-row era) |
| `nonDefault` gate const | `rd-cycles.jsx` ~:60, in `RdCycleChart` (~:49) |
| Gated notes | gap note `{ k: "gap" …" average" }` ~:116; ▲/▼ pair `if (!chg && M.key === "tpp" && !nonDefault)` ~:131 |
| Prop threading | `d1a1d215-…js`: `CycleChart` :1373 (destructures `lifted`) → `<RdCycleChart … liftedN={lifted.size} …>` at :2001-2005 |
| `useDismissOutside` 4th arg `ignoreSel` | `rd.jsx` + call site in `rd-cycles.jsx` (chip clicks don't count as "outside") |
| Probe | `.matilda/probe-cyc-chipmove.mjs` (tracked) |

## The anchor recipe (rd.css)

```css
body.rd .rd-cyc-chipmove {
  position: absolute; top: calc(var(--cyc-chip-pad, var(--rd-sec-pad)) + 1px); left: 0; z-index: 1;
  transform: translateY(calc(-100% - 12px));
  display: flex; flex-direction: column; align-items: flex-start;
  row-gap: 8px; max-width: 100%;
}
body.rd .rd-cyc-chipmove .rd-cc-drawn { justify-content: flex-start; }
/* and in the @media (max-width: 640px) block: */
body.rd #cyc-tpp { --cyc-chip-pad: 60px; padding-top: 60px; }
body.rd .rd-cyc-chipmove .rd-cc-drawn .rd-cc-l { display: none; }
```

**The band is a COLUMN** — chip on top, drawn row directly beneath it, both
flush with the section's LEFT edge (user dictate 2026-10-02: "move it to the
left of the screen, both on phone and on laptop, and give it some breathing
room from the line below it" — that's the `left: 0` + `flex-start` +
`translateY(…-12px)` trio; it was flush RIGHT at 6px from 204654b/ba613b3).
Column order Y-down means "underneath the chip" in DOM order == visually
below: the chip is the FIRST child of the tools span, `.rd-cc-drawn` second.
`.rd-cc-drawn`'s own `justify-content` must be overridden to `flex-start`
inside the band or its pills hug the middle of the column.

**The ≤640px pair**: the anchor reads `--cyc-chip-pad` falling back to
`--rd-sec-pad` (36px on phones), and the 640-block sets #cyc-tpp's
`--cyc-chip-pad` AND `padding-top` to 60px as a FLOOR so the floating
stack has headroom; the same block hides the drawn row's "Drawn over the
band" label (`.rd-cc-l`) because label + two pills wrap to an ~120px-tall
stack on a phone — taller than ANY headroom that keeps the default view
sane — while one pill row stays ~78px and clears the Summary foot above
(probe asserts `wrapT >= #cyc-summary .rd-foot bottom − 0.6`).

- `top: pad+1px` is where the eyebrow's 2px border-top rule sits (its centre).
  `translateY(calc(-100% - 12px))` lifts the whole band so its **bottom edge
  rests 12px above the rule** — user dictate: "i didn't mean literally on the
  line - i meant just above it", then 2026-10-02 "some breathing room from
  the line below it". Never go back to `translateY(-50%)`
  (straddles the rule) and never re-add the opaque `--bg` patch + side padding:
  there is no line behind the band to break any more, and padding: 0 6px pushed
  the chip 6px in from the section's edge (the probe asserts the chip is
  flush with `.rd-eyebrow`'s left edge).
- The `tools` slot of `RdSec` exists only to hang absolutely-positioned UI
  inside the already-relative `.rd-sec`; the nav pills themselves are flex
  children of `.rd-eyebrow`. A second float inside the same tools span also
  works (`rd-cyc-nav` in #cyc-summary uses it for the on-this-page nav).
- `max-width: 100%` caps the band at the section width; a second or later
  drawn term can still wrap the pills row and the translate keeps the
  wrapped block's bottom 12px above the rule whatever its height —
  growing UP out of the section's fixed headroom is exactly the bug the
  headroom refit below exists for.

## The headroom refit (rd-cycles.jsx `chipmoveRef` + `fit()`)

The band is absolutely positioned — OUT OF FLOW — so once enough terms are
drawn that the pill row wraps (a phone hits it at ~4 pills, a desktop at
~6-7), the stack is taller than ANY CSS floor that keeps the default view
sane, and without help it simply climbs over the Summary section's foot
content (reader report 2026-10-02: "more than 5 → causes mayhem with the
text already in the page, e.g. 'how it's built' … the rest of the page
content is not pushed up"). A layout effect right after the story-floor
effect in `RdPastCycles` owns it: `fit()` clears its own inline work,
reads the section's computed `padding-top` as the base floor (56px / 60px
media default), measures `band.offsetHeight`, and — only when
`ceil(bandH) + 19 − gap > base + 0.5` — sets `--cyc-chip-pad` and
`padding-top` inline on `#cyc-tpp` to that figure (19 = 12px above the
rule + 1px anchor + ~8px spare kept under the previous section's content,
minus its 2px of section-top arithmetic; `gap` is the measured space
between the previous section's content bottom and #cyc-tpp's border edge,
i.e. the inter-section air the stack was previously allowed to borrow —
36px at ≤640px, 56 above). When the pills unwrap the clause fails and the
inline pair is GONE again, so the default view never carries a phantom
gap. The refit re-runs on band ResizeObserver (pills wrapping and
unwrapping) and on window resize (the 640px floor swap, and pill
re-wrapping at new widths); the observer target is the band span itself,
hung as `ref={chipmoveRef}` in the tools JSX. CSS and inline
`--cyc-chip-pad`/`padding-top` are the same knob — the probe asserts the
inline var is set once rows wrap and REMOVED once the board is cleared,
and that `padding-top` returns to ≤60.5px.

## Band contents (tools JSX)

Since ba613b3: **chip first, `.rd-cc-drawn` second** (top → bottom in the
column; in the pre-ba613b3 row layout the order was `.rd-cc-drawn` → chip).
The drawn row renders only when `liftedList.length > 0`; the chip is always
present.

- **Drawn row moved out of the Compare/Measure controls row** (`{controls}` in
  #cyc-summary) into this band — user: "the 'drawn over the band' section
  should be brought down with it". Cosmetic rule to remember: drop the
  controls-row `margin-top: 12px` when relocating a row-less block (centred
  flex alignment otherwise misaligns it against the chip).
- **`.rd-cc-cur` sitting-term pill**: renders when
  `liftedList.length > 0 && !hidden.has(cur.year)` — the sitting term draws
  over the band too, so it says so ("2025 Albanese"), but it was never IN the
  band to lift out of: `lift()` in d1a1d215 no-ops on the current year
  (`if (year === currentYear) return; // nothing to lift it out of`), so the
  pill must have **no × button** and no onClick. The probe asserts exactly
  that (no `button` child).
- The current term's only exit from the band is `hidden` (`toggle`); the
  board's per-term eye button (`rd-cc-x`) renders for non-current terms only,
  and `chipClick`/the main button are disabled on `.current`. `setCompare`
  legally hides the current term transiently via `showOutcome` + re-`toggle`,
  so `hidden.has(cur.year)` CAN be true — keep the gate alive even though no
  UI path reaches it in the redesign today.

## `nonDefault` verdict-word gating (RdCycleChart)

```js
const nonDefault = (liftedN || 0) > 0 || (cur ? hidden.has(cur.year) : false);
```

User: "the 'Government ahead', 'Opposition ahead' and 'x points above average'
text … should disappear - ie as soon as the non-default is selected". Gated:

- `notes.push({ k: "gap", … Math.abs(d).toFixed(1) + " above"/" below" + " average" })` (~:116)
- the `▲ Government ahead` / `▼ Opposition ahead` pair (~:131, plus its
  pre-existing `!chg && M.key === "tpp"` conditions — change-mode and non-tpp
  cards never had them)

Deliberately NOT gated (asked for chart fidelity, not emptiness):

- `{ k: "cur", text: subj + " " + fmt(curVal) }` — the sitting term's own
  figure ("Labor 55.1") stays in every view
- the mean dot `marks.push({ k: "mean" … })` and the election-ring `brackets`

`liftedN` is threaded as a NUMBER (`.size`), NOT the Set — `RdCycleChart` has
no other use for the set and an in-scope `cur`+`hidden` pair. Every
`CycleChart` call site passes `lifted` (:843 in rd-cycles.jsx, :3247 in
d1a1d215's own grid), and JSX props evaluate eagerly, so a missing `lifted`
would crash the `<RdCycleChart>` branch via `lifted.size`.

## Probe contracts (.matilda/probe-cyc-chipmove.mjs; 1440×960 / 820×900 / 390×844-touch)

- Geometry: `wrap.b ≈ ruleY − 12` (±1.6px) checked against the WRAP — not the
  chip — so the same assertion holds with pills in the band (min-height 34px
  pills are taller than the chip).
- **Stack assertions (left-flush since 2026-10-02):** with a term lifted,
  `chipB <= drawnT + 1` (chip's bottom at or above the drawn row's top —
  the chip is visibly ABOVE the pills it spawns) and
  `|drawnL - eyebrowLeft| <= 1.5` (drawn row itself flush left, catching
  a missing `.rd-cc-drawn { justify-content: flex-start }` override — in the
  column the row fills the band width, so centred/right pills would be
  visibly wrong even when the band's left edge is correct).
- **Foot clearance:** the lifted stack's top must not cross
  `#cyc-summary .rd-foot`'s bottom (±0.6px) — at ≤640px this passes only
  because #cyc-tpp takes 60px of headroom and the drawn row's `.rd-cc-l`
  label hides keeping the stack one pill-row tall.
- `.rd-cc .rd-cc-drawn` must not exist (row is relocated); chip left edge ==
  eyebrow left; `.rd-cyc-chipmove` computed `position: absolute`; chip label
  regex `/^＋ Draw a( past)? term$/`.
- Default svg text (ALL `#cyc-tpp svg` concatenated): contains
  `Government ahead`, `Opposition ahead`, `(above|below) average`, `Labor`.
  **Trap**: the band mean-line end label is literally `"Average"`
  (capitalised) — assert lowercase `average` only in the
  `(above|below) average` form, or the end label false-positives a
  case-insensitive `/average/`.
- Lift round-trip: click first `.rd-cc-term:not(.current) .rd-cc-main` inside
  the open board → drawn row appears in the chipmove band with the label, a
  pill starting with the picked year WITH a button, and exactly one
  `.rd-cc-cur` pill (text `^20\d\d `, NO button); svg loses the three verdict
  strings but keeps `Labor`; unlift via the pill's × → row gone, verdicts
  back.
- MANY-DRAWN round-trip (the headroom-refit rung, shipped 2026-10-02): click
  six terms as their own line (one `page.evaluate` loop clicking
  `.rd-cc-main` — React batches, the one-tick DOM nodes all stay live);
  assert band top ≥ Summary `.rd-foot` bottom − 0.6, the 12px rule gap
  holds, no horizontal page overflow, and — once the pills wrap to ≥2 rows —
  the inline `--cyc-chip-pad` is SET on #cyc-tpp. Then click every drawn
  pill's × ALL in one synchronous evaluate (React coalesces the unlifts),
  then assert the drawn row is gone AND
  `--cyc-chip-pad` was removed from the element's inline style AND
  computed `padding-top` ≤ 60.5 (the refit let go; the ≤640px floor is
  60px exactly and must not have been inflated by the fit).
- Toggle/dismiss round-trip unchanged from 7964e12: chip-close, outside click/
  tap close, board `×` close. At ≤900px `.rd-cc-board` is a FIXED bottom sheet
  hugging up to 75vh — anchor the chip at viewport y≈110 (below the 72px
  sticky tabs, above the shallowest sheet top ~211px at 844 tall) before
  clicking, or the sheet eats the click.

## Session logistics that shipped it (worth repeating)

The follow-up build ran in a `git worktree add --detach` at HEAD with the two
sibling-WIP-contaminated sources replaced by clean HEAD+edits scratch copies;
index.html was `cp`'d back, tokens marker-grepped (`rd-cyc-chipmove`,
`liftedN`, `rd-cc-cur` present; `RD_CYC_LEAD` — the sibling's marker — absent)
BUT a sibling sweep between verification and staging reverted `rd.css` to HEAD
and rebuilt index.html ejecting the edits. The worktree copies were still
intact, so restores were byte-exact; stage + commit + push followed
immediately after the second restore. See auto-skill-shared-repo-session-race
for the pattern.

ba613b3 logistics (2026-10-02): attempts to keep the sibling's `rd-cyc-ctls`
WIP hunks OUT of my commit hit the sibling committing `ac5225c` mid-flight
(their own ctls stack, built index.html included). Their rebuild ran in the
shared tree so it **swept my chipmove compiled output into THEIR
index.html** — after landing, my in-tree rebuild of index.html on
ac5225c+my sources produced a ZERO diff (their built artifact and mine are
bit-identical since rd.css/rd-cycles.jsx are the only chipmove inputs).
The commit therefore shrank to three source paths (rd-cycles.jsx reorder,
rd.css column hunk, probe assertions) and still shipped a coherent site: the
staged source diff was re-verified against the NEW HEAD before commit (the
`git status` flip-in-flight was the tell — re-check `git log -3` whenever a
staged stat looks wrong), and empty `git diff` on index.html after a HEAD
adoption is NOT a regression sign when the sibling committed the build that
already contained your sources' output.
