---
name: auspol-wv-rug-tooltip
description: auspol-tracker — the Who-votes rug-dot tooltip (.rd-wv-rtip) inside the WvRug <b> marks (rd-panels.jsx ~1182-1246): the absolute-positioned shared .tip card re-anchored at the dot. TWO caller-context traps fixed 2026-10-01 (span→div c49673e, <b> weight-leak same morning): .tip sets NO display/font-weight normalisation, so whatever element context renders the card leaks in — inline spans flow .tip-sub/.tip-hint onto ONE line, and the rug dot's <b> leaks font-weight:bolder into every weight-inheriting line. Caller's tip content must use <div> for block lines (every other tooltip does), and .rd-wv-rtip must carry font-weight:400. Probe .matilda/probe-wv-tip.mjs; rug transparency/ring fixes in rd.css ~1048-1069.
source: auto-skill
extracted_at: '2026-10-01T03:06:57.856Z'
---

# Who-votes rug-dot tooltip (rd-wv-rtip)

The per-poll tooltip on the Who-votes rug dots. Worked twice on 2026-10-01: the n≈/open-call
lines flowed onto one row (span→div fix, pushed as `c49673e`), then the card read bolder
than every other chart's poll-dot tip (`font-weight: 400` added to `.rd-wv-rtip`).

## Anatomy

- **JSX:** `WvRug` in `.build/newtracker/assets/rd-panels.jsx` (~1182-1246). Each poll =
  `<b>` (rug mark, `style={{ "--x", "--pcolor" }}`) containing the `<i>` face; the tooltip
  renders conditionally as the last child: `{on && <span className="tip tip-dot rd-wv-rtip">…}`
  with `.tip-title`, two `.tip-row`s, `.tip-sub` ("n ≈ …"), `.tip-hint` (click/Enter/release
  fallback). `tipBox` ref + `useLayoutEffect` recentres the abspos card inside the viewport
  via `marginLeft`. Hover-claims pattern: `tip` state `{ i, src }`, mouse
  `onPointerEnter/Leave`, keyboard `focus-visible` (`tabIndex` only when row-keyed),
  touch toggles on click. **The hint is deliberately ABSENT on touch** (`tip.src !==
  "touch"`) — a 390px probe asserting its presence fails by design.
- **Shared card styles:** template.html ~1594-1684 — `.tip` (abspos, border-radius,
  tip-in animation; sets pointer-events/z but **no font normalisation**), `.tip-title`
  (700), `.tip-label`/`.tip-val` (700), `.tip-sub` and `.tip-hint` (600) with NO display
  or weight rules of their own.
- **Positioning rule:** `rd.css` ~1069 — `body.rd .rd-wv-rtip` (left/top 50%, z 20,
  nowrap, `text-align: left`, and now `font-weight: 400`).

## The two traps (the reusable lesson: `.tip` inherits its caller's text context)

`.tip` is abspos (blockified) but that only affects the CARD itself — its text content
still inherits `font-weight` etc. from the element the caller mounts it on, and its
children keep their own default display. Two bugs fell out of that:

1. **span→div (c49673e):** `WvRug` was the page's ONLY caller affixing `.tip-sub` /
   `.tip-hint` to `<span>`s (rd-allpolls.jsx, rd-polls.jsx etc. all use `<div>`). Inline
   elements flowed onto one line: "n≈ … · Click to open…". Fix: both to `<div>`.
2. **<b> weight leak:** the rug marks are `<b>` elements, and the user-agent gives them
   `font-weight: bolder`. `.tip` resets nothing, so every weight-inheriting line (rows'
   labels, `.tip-sub`) computed 700 instead of 400 — read visibly bolder than the other
   charts' tips. Fix: `font-weight: 400` on `.rd-wv-rtip`. The absolute-weight pieces
   (`.tip-title`/`.tip-val` 700, `.tip-hint` 600) were never affected — that's why the
   card looked "a bit" bolder rather than all-bold.

General rule when a shared `.tip` (or any shared popup without text normalisation) is
mounted in a new spot: check the ANCESTOR's element type and text styles — headings,
`<b>`, `<strong>`, line-box contexts all leak past the portal-less mount.

## Touch dismiss-outside contract (9ccaf8b, same day)

The rug's tap-opened tip was the page's one touch popup missing
`window.useDismissOutside` — the document-level pointerdown-capture hook the
TrendChart dots, Latest-table touch tips and RdQPop all run. The rug now wires it on
`rugBox` gated on `tip.src === "touch"` (mouse/focus tips still leave on
pointer-leave/blur; the same-dot tap still toggles). A trap when PROBING it: the
absl-positioned `.rd-wv-rtip` card renders ABOVE the strip and overlaps the row's
text label, so a label tap is *inside* `rugBox.contains(e.target)` and correctly does
NOT dismiss — `.matilda/probe-wv-tip-dismiss.mjs` taps a computed `r.top - 250`
coordinate instead (390px, plus same-dot toggle + second-dot-move + head-tap-close).
ALL PASS 2026-10-01. Committed via the clean-room/private-GIT_INDEX_FILE recipe from
the shared-repo-session-race skill (a sibling's rd-evdrop WIP sat in the same live
files; `git archive HEAD` snapshot, overlay hunk, rebuild, one-line gate on
`git show HEAD:index.html | diff - <snap>/index.html`).

## Adjacent rug-dots facts (same edit session)

The rug's transparency/blindness fix also lives here: `rd.css` ~1048-1066 — dot faces
carry their alpha in the COLOUR (`color-mix(in oklab, var(--pcolor) 55%, transparent)`),
NEVER in `opacity`, because only a solid element can carry the 2px `--bg` ring that erases
the all-voters dash under the dot (a translucent element's ring ghosts with it — the same
recipe the ci ticks already used). Hover/focus flips to `background: var(--pcolor)`;
`b.hi > i` grows inset -3px and the `.hi ::after` echo ring uses the same colour-mixing.
`.lit b:not(.hi) > i` = 28% colour-mix. See probe-sp-allvoters.mjs's `rug` IIFE.

**Update 2026-10-03 (user call "the dash must not touch the poll dots"):** the rest-state
"no ring" rule now has ONE exception — `b.ring > i` borrows the ci ticks' 2px `--bg`
halo, applied only to dots the all-voters dash crosses (whichever dot the dash runs
through, computed in the same WvRug layout pass as the lanes — see the two-lane skill).
Ringing every dot would re-introduce the beb28b3 blindness in dense rows, which is why
the user chose the conditional over the uniform ring.

**Follow-up same day ("it goes on top of the dots"):** the halo alone only erased the
dash AROUND the disc — the face's 55%-alpha tint still lets the dash beneath show
through the disc itself (the whisker circle/ticks never had the problem because their
faces are solid). b.ring now composites its face over the page ground:
`--ring-face: color-mix(55% tint); background: linear-gradient(var(--ring-face),
var(--ring-face)), var(--bg)` — the disc reads pixel-identical to ringless neighbours
while nothing beneath the disc is visible. The lit-row dim (`.rd-wv-rug.lit
b.ring:not(.hi) > i`) keeps the underlay and swaps only `--ring-face` to the 28% mix —
the plain lit rule's background shorthand would otherwise wipe the gradient layer.
probe-sp-allvoters.mjs pins it: ringed ⇒ linear-gradient over an opaque bg;
unringed ⇒ neither. ALL PASS 2026-10-03.

## Probe

`.matilda/probe-wv-tip.mjs` (uncommitted scratch; run after build.mjs): serves the built
index.html at 1280 + 390, hovers (or taps on 390) the first `.rd-wv-rug b.on`, and asserts
(1) `.tip-sub` and `.tip-hint` occupy separate vertical bands, single-line heights ≤26px;
(2) **font parity with every other chart's tip** — computed weights tip 400 / title 700 /
label 400 / val 700 / sub 400 / hint 600 plus the "IBM Plex Sans" family stack. Skips hint
assertions on the touch tip (absent by design). ALL PASS on 2026-10-01.

## Related

- **auspol-wv-rug-two-lane** — the rug corridor is now 12px with a greedy two-lane
  overlap dodge (2026-10-01); the tip needs no change because it rides inside the dodged
  dot's `<b>`, but geometry assumptions there (single 6px band) are stale.
- **rdqpop/hover-claims skills** for the site's other key/claim patterns;
  **auto-skill-auspol-text-transform-caps** for the parallel "context leaks past the shared
  class" lesson (CSS text-transform vs source case).
- Auto-push note: `.build/git-push-main.sh` is a source-only library — plain `git push
  origin HEAD:main`, `git rebase --autostash` on a race; covered in ci-main-writer-races.
