---
name: auspol-rollnum-drift
description: auspol-tracker — RollNum odometer machinery + the hero's drifting decimal point (shipped e08e45b). Crimson Text IGNORES tabular-nums (measured on the shipped 600 woff2 — 1 is 0.371em vs 0.493em for every other digit, "." is 0.187em), so each reel slot is a WIDEST-glyph 0.493em frame and a narrow figure leaves its slack on the right, hanging the point 0.15em off a 1 against 0.03em off a wide digit (the 51.2↔54.2 toggle complaint). Fix = the `drift` prop on RollNum: per-neighbour LEFT margin SEP_GAP−slack (goes NEGATIVE −0.092em under a 1) transitioning on the reel's own curve. Uniform per-digit padding (f5ac5b0, superseded) moves nothing — the asymmetry is per-digit slack, not per-digit pad. Scope strictly to the hero ro-num call sites: the Delta lead line and a11e1559 callers render genuinely-tabular Plex Sans where a negative pull would overlap the point into a 1. The roll-CSS user-select comment quotes the hero lead line verbatim — a HAND-SYNCED stale-figure trap that false-positives hero-figure greps; sweep with the rendered `<p>` pattern, not the bare phrase (7.6 pts → 2.2 points sync = e1f840b).
source: auto-skill
extracted_at: '2026-09-02T05:43:35.410Z'
---

# auspol-tracker: RollNum odometer + drifting decimal point

## Map (as of e08e45b, 2026-09-02)

- **Component**: `RollNum({ value, className, style, spinIn, drift })` in
  `.build/newtracker/assets/73de0c58-…js` ~:400. `value` is `String()`'d; each digit is a
  `.roll-d` (overflow:hidden, 1em tall) wrapping a `.roll-reel` of ten 0-9 spans translated
  `translateY(calc(var(--d) * -1em))`; each NON-digit becomes a
  `<span className="roll-sep">` with (when `drift`) computed `marginLeft`/`marginRight`.
  Keys are PLACE VALUE (`n - 1 - i`) — never index — because figures can lose characters
  mid-roll. `spinIn` mounts every reel at 0 and rolls up on a `SETTLE_MS` timeout
  (`REDUCED_MOTION` mounts the final figure immediately). `window.RollNum` is exported at
  ~:399 for the second asset.
- **Drift constants** (right above the component): `ROLL_FRAME = 0.493` (slot width =
  widest Crimson digit advance), `ROLL_ADV = { "1": 0.371 }` (the only narrow figure),
  `SEP_GAP = 0.03` (target air either side). `driftMargins(text, i)` returns
  `{ marginLeft: (SEP_GAP − slackOf(text[i-1])) + "em", marginRight: SEP_GAP + "em" }`
  — `marginLeft` is **−0.092em** after a 1, `+0.03em` after any wide digit.
- **Call sites**:
  - hero `ro-num` A/B, ~:1027/:1031 — `spinIn drift` (the ONLY drift consumers).
  - Delta lead line ("Labor leads by 7.6"), ~:1054 — `spinIn`, NO drift.
  - a11e1559 ~:173 / ~:813 / ~:1119 via `window.RollNum` — no drift.
- **CSS** (`template.html` ~:1030 "rolling figures" block): `.roll` inline-flex +
  `font-variant-numeric: tabular-nums`; `.roll-anchor` zero-width baseline anchor;
  `.roll-reel { transition: transform .32s cubic-bezier(.4,.1,.25,1) }` (the MORPH_EASE
  curve every moving-data transition shares); `.roll-sep { transition: margin .32s
  cubic-bezier(.4,.1,.25,1) }` (same curve/length so figure and gap settle as one —
  comment block at ~:1030 says so). Reduced-motion parity: `.roll-sep` is in the
  `@media (prefers-reduced-motion: reduce)` transition:none selector list ~:3360.
- **Quoted hero line in the user-select comment** (`template.html` ~:1039, directly
  above `.roll-d, .roll-sep, .roll-anchor { -webkit-user-select: none; user-select:
  none }`): the comment explains the selection-suppression by quoting the CURRENT
  hero line ("copying \"Labor leads by 2.2 points\" would paste every digit on every
  reel"). The static-summary hero regenerates every build; this comment does NOT —
  re-quote it by hand when the lead-figure story materially moves. Was stale on
  "7.6 pts" (and the wrong unit style vs the hero's "points") until e1f840b.
- **`.ro-num`** (:1007): `font-family: var(--serif)` (Crimson Text), 72px / 600 since
  c083a8c. NO other kerning rules — the static `margin-left: -0.08em` kerning of 1e3e66e
  was scrapped at 73a0d33.

## The mechanism (why the point needs to drift)

`font-variant-numeric: tabular-nums` on `.roll` is a NO-OP for Crimson Text — the face
ships no `tnum` table (canvas-measured, unchanged widths). So:

- Each `.roll-d` slot sizes to the reel's WIDEST span = 0.493em (digits 0,2-9 all measure
  exactly 0.493em; do NOT rederive this by hand — the first fix's comment claimed
  "narrowest glyph", encoded the wrong model, and produced the failed uniform pad).
- The glyph is left-aligned inside its slot; a `1` (0.371em advance) leaves 0.122em of
  empty shoulder on its RIGHT.
- The point sits between two slots, so its left gap = left-figure slack + margin:
  0.152em after a `1` vs 0.03em after a wide digit. That asymmetry is the "roller messes
  up the spacing around the full stop" complaint; the 2PP toggle flips the tens figure
  (51.2 ↔ 54.2) and the gap flicked open/shut.
- The fix RECLAIMS the slack: `margin-left: −0.092em` when the left neighbour is a `1`.
  Emotion: the point's margin is itself transitioned, so it drifts in under the 1's
  shoulder DURING the roll and back out on a wide figure. The whole readout's width does
  NOT change by a slot (digits keep their frames — only the point's seam tightens), and
  the anchor of "51.2" vs "54.2" differs by the ~0.09em that was reclaimed.

## History / failed approaches (do not repeat)

1. `letter-spacing: −0.08em` on `.roll-sep` (07739f5) — tightened the wrong pair
   (letter-spacing applies AFTER the glyph, i.e. point→next digit). User: "you kerned it
   in the opposition direction". Live lesson: `letter-spacing` on a character = gap to
   RIGHT neighbour; `margin-left` = gap to LEFT neighbour. State the pair aloud first.
2. `margin-left: −0.08em` static kerning (1e3e66e) — correct direction, but a STATIC
   offset anchors all digits to one seam; user had it scrapped (73a0d33).
3. Uniform per-digit `ROLL_PAD` margins on every `.roll-sep` (f5ac5b0) — moved nothing
   visible: every digit carried the same padding, so no drift, AND it touched nothing of
   the real asymmetry (it added pad where slack needed reclaiming). It also polluted the
   Delta line and archive tables with +0.03em seams. Superseded by e08e45b (which scoped
   drift behind the opt-in prop and restored non-hero separators to margin-free, their
   pre-f5ac5b0 state).

## Scoping rule

Drift is FACE-SPECIFIC to Crimson Text's measured metrics. EVERY other RollNum
consumer renders IBM Plex Sans (`--sans`): the hero "leads by X.X" (.lead-tag,
Plex 700), the Delta chips (.delta, Plex 700), the preferred-PM tiles
(.leader-num, Plex 800 → clamps to the shipped 300-700 variable range → 700)
and the approval nets (.net, same clamp). Shipped woff2 measured 2026-09-02
(canvas probe at 720px, wght 600 + 700): every digit is EXACTLY 0.60em with
and without tabular-nums (the tnum descriptor is a no-op because the face is
tabular by default); the point is 0.2988em (w600) / 0.310em (w700). Slack is
zero, so there is no asymmetry for drift to reclaim: with Crimson constants a
−0.092em pull would overlap the point into a preceding 1, and with Plex-true
constants (slack 0) the margins degenerate to a UNIFORM +0.03em pad — the
already-rejected f5ac5b0 approach. Two of those consumers don't even carry a
decimal separator (leader tiles are integers; nets carry a +/- sign). New
RollNum consumers default drift-free; add `drift` only after measuring that
consumer's actual font and finding per-digit slack. Probe harness:
`.matilda/verify-rollnum-drift/measure-sans-digits.mjs` (never commit
`.matilda/*`).

## Measuring per-glyph metrics of a shipped woff2 (no font tooling)

The repo has NO python fontTools/brotli, NO node_modules, and render-card.mjs's
puppeteer-core isn't available — but the user's Chrome is (see chrome-session-piggyback):

1. Read the woff2 (`assets/fonts/crimsontext-600-latin.<hash>.woff2`), base64 it.
2. Write a tmp HTML (MUST live in the repo, e.g. `.build/newtracker/tmp-*.html` — BOGAN
   approval mode refuses /tmp writes) that constructs `new FontFace("Probe", bytes)` from
   the base64, `ctx.font = "600 720px Probe"`, and `ctx.measureText(ch).width / 720` per
   character, once with and once without `ctx.fontVariantNumeric = "tabular-nums"`
   (canvas supports it — check `"fontVariantNumeric" in ctx`). Emit `RESULT:<json>` into
   a `#out` element.
3. Drive it via osascript exactly like `.build/chrome-article.mjs`: make a tab, poll
   `document.getElementById('out').innerText` each 0.5s ≤ ~20s for the RESULT prefix,
   close the tab, parse JSON.
4. Probe-script gotchas: the repo path contains a space, so use
   `fileURLToPath(new URL(...))` for both the woff2 and the HTML path (never
   `new URL(...).pathname` — keeps `%20`); treat the probe + its tmp HTML as one-off
   files under `.build/newtracker/tmp-*` and DELETE them before committing.
   (The probe was `.build/newtracker/tmp-measure-digits.mjs`, deleted in the e08e45b
   prep — re-create from this recipe when metrics are needed again.)
5. Measured Crimson Text 600 numbers (em units): `0`=0.493, `1`=0.371, `2–9`=0.493 each,
   `.`=0.187; identical with tabular-nums. If the family/weight anchor changes (e.g. the
   ro-num weight ping-pong resumes), re-run the probe before touching ROLL_ADV.

## Hero-figure sweeps false-positive on quoted sentences

The built `index.html` contains the hero lead line somewhere BESIDES the rendered
`<p>` — the user-select comment above quotes it, and editorial copy may too. Lessons
from the 2026-09-02 "stale lead" chase (live hero read 2.2 points; the lone
"7.6 pts" hit was this comment; live == local byte-identical all along):

- A bare `grep -c "Labor leads by X.X"` proves NOTHING about staleness — sweep the
  RENDERED pattern (`<p>Labor leads by`) plus `grep -n "Labor leads by"` to list
  every quoted-instance home before concluding anything is stale.
- The meta/og `description` REGENERATES per build (figures + poll count + date all
  pipeline-derived — 2026-09-02 it read 51.1–48.9 ±2.5, consistent with the hero).
  Don't flag it as rot; only template copy/comments are hand-synced.
- BSD grep on this mac caps repetition at 255 (`.{260}` → exit 2 "maximum repetition
  exceeds 255"), and `.{N}` lead-context windows silently MISS a hit with fewer than
  N same-line characters before it (`.` never crosses newlines; the built page's
  long lines make this common). Fallback that worked: `grep -n "<phrase>" file` for
  the line number, then read that line directly.

## Verification + commit

Rebuild (`node .build/newtracker/build.mjs`); in built `index.html` grep for
`const ROLL_FRAME`, `drift: true` (expect exactly 2 — the hero call sites; babel rewrites
the JSX to `drift: true` in object literals — do NOT grep the word "prop") and confirm
`sepPad|ROLL_PAD` return zero (superseded). Commit = 3 paths: asset JS, template.html,
index.html. Fetch + compare origin/main first — another session (851cc17 "hero restack")
raced in on top of the drift work in the same window; the drift edits applied cleanly on
top but always re-read the asset section after any race. Never stage other sessions'
`.matilda/*`, `.impeccable/`, or untracked sim scripts (see git-prestaged-commit-sweep).

Related: auspol-font-pipeline (the faces, the static-kerning era), auspol-built-html-
verification (babel greps), auspol-build-pipeline (never hand-edit index.html),
chrome-session-piggyback (osascript-Chrome driver pattern).
