---
name: auspol-headless-geometry-verify
description: "auspol-tracker — verifying a layout/spacing OR interactivity fix headlessly in this repo: screenshots are USELESS to the reviewing model (read_file cannot process PNG — no image input), so assert geometry NUMERICALLY via getBoundingClientRect diffs / computedStyle / DOM text inside a puppeteer-core probe instead, and drive interactivity via page.mouse.hover / elementFromPoint with state read off classes and cursor style. Includes the .matilda/probe/*.mjs serve-and-probe skeleton (node:http on an ephemeral port, system Chrome headless: 'new', stub window.AP bridge calls, keep probes untracked). Worked 2026-09-23: house-lean control gap measured 2px, fixed by CSS, re-probed at 12px (77eed98); 2026-09-24: undecided dots unclickable — key/query and overlay causes eliminated with probes, catchment grid-walk showed the pick region displaced down-right, rect comparison found .chart wrapper 30px taller than its svg (toVB measured the wrong box; 0c3d9b7). Also 2026-09-24, PAGE-PARITY probing traps (masthead-parity.mjs asserting a satellite == the main page): React style-prop SVG attrs land in style not attributes and CSSOM serialises dasharrays comma-separated (normalise commas or NaN); compare CSS custom properties at the consuming element not :root (dark tokens sit at body.dark on main vs :root on satellites — documentElement reads legitimately differ); third-party embeds (Infogram) never fire load → goto with domcontentloaded; headless Chrome is dark-scheme by default. 2026-09-28, SCROLL/event verification: wrap window.scrollTo IN-PAGE before triggering the action (empty capture list + a changed scrollY = some other API scrolled, e.g. scrollIntoView via boundingBox-mouse-click coordinates); assert ONE call and a stable docTop trajectory across 60–1200ms (no late layout shift); clicking SVG circles — ElementHandle.focus() is unsupported protocol-side, SVGElements have no .click(), and narrow viewports switch row/card selectors, so drive clicks with el.dispatchEvent(MouseEvent) and select '.rd-ap-row, .rd-ap-card'. 2026-09-28 COPY-ASSERT probing (.matilda/demo-head-probe.mjs, the Who-votes constant headline): assert sentence STRUCTURE not wording when the text re-cuts per UI state; clicking the already-active tab is a no-op so reset to a non-default tab before change-asserting loops; goto file:// is enough for copy asserts (all JS inlines into index.html); BOGAN mode blocks write_file to /tmp — scratch probes belong in the gitignored .matilda/ root. 2026-09-29 (RdQPop '?' popover clamp): click-then-query in ONE evaluate reads the DOM before React flushes (panel 'not open' — split click and measure across waitForSelector), and margin-left is computed but INERT on a right-anchored abspos box so a nudge fix must shift it with the translate property, asserting BOTH the applied style and the moved rect. 2026-09-30 CDP TOUCH probes (Input.dispatchTouchEvent, hero swipe gate 49a6bfe): a touch dispatched below the viewport (scrollIntoView({block:'start'}) on a tall section left the svg centre at y=926 on an 844px viewport) hits document.body — elementFromPoint returns NULL — and this app's page-level touchend handler then page-turns (goTab), making a probe bug look like a product bug; scroll the TARGET to block:'center', assert 0≤cy≤innerHeight, and elementFromPoint-verify the closest() chain before reading state; and the 2PP matchup-flip signal is NOT the chart title (identical across vs-Labor matchups alp_lnp/alp_on) — assert the rival-name node .rd-tpp-side.rd-b .rd-tpp-name." 2026-10-01 (probe-issue-clickout.mjs, the tabpanel focus-park fix): this rig's headless-'new' Chrome cannot synthesise TEXT SELECTIONS at all — mouse drag, double/triple-click AND caret-placement clicks (a click after a programmatic selection doesn't collapse it) all leave getSelection() empty/isCollapsed on the app AND on a clean data: page, so drive selection STATE via the Selection API (setBaseAndExtent/collapseToStart) and assert guards on state not gesture; pointer events themselves dispatch normally, and smooth scrollIntoView drifts mid-glide so read a rect twice ~150ms apart until stable. 2026-09-30 (switching-reverse.mjs, the mosaic encoding reversal 742df1e): pinning probes in .matilda/probe/ ARE force-tracked (the dir is gitignored — git add on a new probe FAILS and an `&&`-chained commit aborts silently mid-command; git add -f it separately after the main add), and page.evaluate returns are JSON-serialised so helper functions passed back in the result object vanish (expected.fmt1 is not a function) — re-declare shared helpers (a fmt1 formatter…) in node scope after the evaluate. 2026-09-30 PANEL-HEAD-DEK probing (switching-title-dek-swap.mjs, three selector traps on the way to green): a panel's user-facing head/dek live in RdHed's .rd-hed h3 / .rd-dek p — "#switching h2 + *" grabs the RdSec META line ("How 2025 voters say…") instead; plainShare prose begins with an OPTIONAL qualifier ("Almost " / "Nearly " / "Just over ") and rdCap capitalises only the FIRST word ("Almost two in five"), so regex the fraction as [A-Za-z]+ in [a-z]+ behind an optional qualifier group; and a phone rung can swap the whole RENDERER, not just class names — RdSwitching's 390px view replaces the SVG mosaic with a .rd-mo-rows DOM list, so SVG text[] probes return [] and the same labels live in .rd-mo-rtop b:last-child. 2026-10-01 SAFARI-ONLY bugs (the rdPinScroll round-4 crawl): a bug the user sees only in Safari is invisible to every Chrome probe (8 pixel-exact green probes in a row meant nothing) — drive WebKit directly via playwright-core + the machine's CACHED ~/Library/Caches/ms-playwright/webkit-* builds, installed in a scratch dir OUTSIDE the repo (~/.matilda-tooling/pw; never the shared package.json), and diagnose scroll drift by wrapping scrollBy/To + the scroll EVENT in-page: a fractional scrollBy that moves nothing = WebKit root-scroller css-px quantisation; scrollY moving with no JS call = the engine; fixed-selector rect tracking across hops kills "something is growing" theories in one run. 2026-10-01 (.matilda/probe-sp-allvoters.mjs, the Decidedness allline port): a RollNum figure assertion must read .roll .sr-only textContent — textContent is a concat of the .roll-anchor '0', the sr-only copy AND every reel's digits ('048.748.7' for real 48.7), and reconstructing from reel --d vars leaks the anchor too; elementFromPoint stacking asserts must accept ANY element of the expected mark-class set (a dot z3 legitimately covers the link z2 where they overlap — requiring exactly one class fails on correct stacking); computed box-shadow colours can serialise oklch(...) not rgba(...), so assert the spread suffix / 2px$/ + 'none'≠ rather than an ^rgba?( colour; and an HTMLElement inside a page.evaluate return payload silently arrives (whole result or field) undefined — return className strings, never nodes (sibling of the functions-don't-survive rule). 2026-10-01 REGRESSION-SWEEP triage: a red sweep probe is not automatically your change — the probe may be DEAD since an earlier redesign (verify-cycle-{lift,outcome} time out on .cyc-legend, zero such elements on the live page; census the awaited selector and its replacement in one evaluate before debugging) and a sibling's COMPLETE-but-stale index.html build passes the size check while serving old inline data (gate the artifact on a data-key grep / an in-probe 'the data landed' assert against AP.D, then rebuild yourself). 2026-10-02 (sig-tables-panels.mjs): getComputedStyle DECLARATIONS ARE LIVE — snapshot the reference span's .color/.backgroundColor to strings BEFORE re-cssText-ing it for the next token or the captured value re-resolves; bare tr selectors net THEAD rows (a No-row quiet-ink check read a header th's explicit --ink and reported a fake product bug — tbody-scope row queries); run probes from the repo root — a /tmp copy dies ERR_MODULE_NOT_FOUND on puppeteer-core. 2026-10-03 TWO infrastructure notes: (1) iss-head-safari.mjs drives REAL Safari via safaridriver's WebDriver REST at http://127.0.0.1:4444 — start it with `/usr/bin/safaridriver -p 4444 &`, and session creation THEN fails "You must enable 'Allow remote automation'" until the user ticks Safari's Develop → Allow Remote Automation (a GUI toggle you cannot set headlessly; ECONNREFUSED 127.0.0.1:4444 = driver not running at all); don't gate a change's acceptance on this probe when the toggle is off — fall back to the Chrome-side overlap/sweep probes and say so. (2) Never acceptance-read a probe through a tail-pipe alone — `node probe.mjs | tail -3` (and `npm test 2>&1 | tail`) returns TAIL's exit code, masking a crashed probe's non-zero; the tell in the chain output was literally the bare crash footer `Node.js v23.7.0` with no PASS/PASS-count line — re-run alone before believing a green exit. 2026-10-06 (probe-flow-tip-close.mjs §c, the flow-tip tipW port 92fc5f4): an element whose DOM node SURVIVES across a user interaction and CSS-transitions (`left` .15s glide) needs rect sampling THROUGH the transition, not a settle-then-measure at rest — probes that dismissed between taps read fresh mounts (no glide) and stayed green for MONTHS while the user's dot-to-dot path sailed 90px past the screen edge; the companion component-side lesson is that getBoundingClientRect inside a layout effect reads where the glide STARTED, so x clamps belong in render with only the width measured (TrendChart's tipW idiom; product detail in auspol-flow-drift-panel)."
source: auto-skill
extracted_at: '2026-09-23T02:20:41.637Z'
---

# Headless layout verification — measure, don't screenshot

Symptom that spawns this: a user reports "X seems too tight / misaligned /
missing" on the live page and the fix is CSS. The natural flow — screenshot
before/after and LOOK at it — does not work in this harness: `read_file`
cannot process PNGs and the agent has no image input. The screenshot files
write fine (`page.screenshot({clip})`); they are simply unreadable. Spend
zero turns on them.

## What works: assert the numbers the screenshot would show

Inside a `page.evaluate`, read geometry directly and return plain numbers:

- **Gaps/alignment** — `getBoundingClientRect()` on the two elements and
  diff the edges: `b2.top - b1.bottom === expected gap`. For wrap/stack
  bugs check `left`/`right` relationships the same way.
- **Computed style** — `getComputedStyle(el).marginTop` etc. confirms WHICH
  rule won (invaluable when a shared class is in play, e.g. the
  `.ap-var-ctl` 2px margin in 77eed98: the value proved the shared rule was
  the culprit before the fix was scoped to `.ap-lean`).
- **Rendered content/state** — textContent of chips/labels, class lists,
  `aria-pressed` (see .matilda/probe/var-default.mjs which verifies the
  Poll-disagreement default view by listing legend chips, not pixels).
- Measure at TWO viewports (`page.setViewport({width: 1280})` and a phone
  rung ~480) — a spacing bug that only wraps at one width is invisible at
  the other.

Then: re-run the SAME probe after the CSS/source change + rebuild and the
asserted numbers must move (2px → 12px). The probe doubles as the
regression check; diffing numbers is also diffable evidence for the user.

## Scroll-behaviour fixes (worked 2026-09-28, All-polls focus scroll)

Verifying a "scrolls to the wrong place" fix needs the SCROLL CALLS
themselves, not just final geometry:

- **Instrument, don't infer.** In-page, BEFORE triggering the UI action,
  monkey-patch `window.scrollTo` to record `{y, docTop, scrollY}` and
  schedule position re-reads at 60/160/320/640/1200ms. What that proves:
  the new code path actually ran (a scroll captured with the NEW formula's
  y = the fix is live; empty capture + moved scrollY = some OTHER API
  scrolled — in one probe scrollY=582 matched `scrollIntoView({block:"center"})`
  arithmetic, meaning the action never fired the effect because the CLICK
  had missed), and the trajectory is stable (row docTop identical at 60ms
  and 1200ms ⇒ no post-scroll layout growth shifting things later).
- **Assert against the right target.** If the fix centres content below a
  pinned bar, the "ideal" is (barBottom + viewport)/2, not viewport/2 —
  otherwise a correct fix reads "off by half the bar height".
- **Re-probe at a phone rung using env-var viewport sizes**
  (`VW=390 VH=844 node probe.mjs`): the tall-group clamp and the
  `.rd-ap-card` layout only exist there.

## Clicking this app's SVG dot buttons headlessly

The mini-chart dots (RdApMini, TrendChart plot points) are `<circle>`
elements with React listeners — three traps in one day:

- `ElementHandle.focus()` on an SVG node fails: "Protocol error
  (DOM.focus)". Focus in-page via `page.evaluate(() => el.focus())`
  instead (SVGElement.focus exists in modern Chrome).
- Puppeteer's `page.mouse.click(boundingBoxCentre)` silently misses when
  the element is offscreen (the click dispatches at viewport coords that
  are outside the window). Don't synthesise coordinates for these:
  `page.evaluate(() => el.dispatchEvent(new MouseEvent("click",
  {bubbles:true, cancelable:true})))` — SVG elements have NO `.click()`
  method (HTMLElement only), so dispatch the event; React's delegated
  onClick at the root still fires.
- Narrow viewports swap component classes — `.rd-ap-row` becomes
  `.rd-ap-card` — so `waitForSelector(".rd-ap-row")` times out at 390px.
  Wait/click `".rd-ap-row, .rd-ap-card"` and match opens with
  `".rd-ap-row.open, .rd-ap-card.open"`.
- Hover-driven tooltips: **puppeteer's `hover()` misses or leaves a
  stale tip on React's root-delegated `onMouseOver` path** (hit
  2026-10-01 in `.matilda/probe-cyc-holder-year.mjs` walking the
  Past-cycles `.rd-cs-dot` peer dots — the learned holder map came back
  incomplete and downstream asserts failed on phantom rows). Dispatch
  the pair directly on the element instead:
  `el.dispatchEvent(new MouseEvent("mouseout", {bubbles: true, relatedTarget: el}))`
  then `mouseover` with `relatedTarget: document.body`, settle ~120ms,
  then read the tip's text from the shared tip node (here
  `.rd-cs-tip .tip-title`). One dispatched mouseout on the new dot also
  fires the old dot's leave leg, so a walk stays clean without
  page-mouse bookkeeping.

## Probe skeleton (repo convention — keep in `.matilda/probe/`, untracked*

\* Two probe classes now coexist (learned 2026-09-30, switching-reverse
  reversal 742df1e): one-off scratch probes stay untracked, but
  COMMIT-QUALITY pinning probes — the ones a commit message names as
  "Pinned by .matilda/probe/….mjs" (`dir-facet`, `election-ring`,
  `masthead-parity`, `switching-reverse`) — ARE force-tracked. The dir
  is gitignored, so a plain `git add .matilda/probe/x.mjs` FAILS with
  "paths are ignored" and an `&&`-chained `git add … && git commit`
  aborts silently before committing ANYTHING. Add code files first,
  then `git add -f` the probe separately, then commit.

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8939;                     // 8935+ seen in use; stay ephemeral
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".json": "application/json", ".woff2": "font/woff2" /* … */ };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });
const page = await browser.newPage();
// …collect console/pageerror, goto, drive the UI, evaluate, close both…
```

Working `.matilda/probe/` examples to copy: `var-default.mjs` (drives the
All-polls tab, asserts chip labels across a toggle) and `lean-spacing.mjs`
(bounding-box gap assertion, two widths). Don't commit them — scratch
verification, and the repo's agents have learned the hard way that stray
builders in `.build/` get swept into other sessions' commits.

## Adjacent gotchas

- **`page.evaluate` returns are JSON-serialised — functions don't
  survive the trip back.** A helper passed out inside the result
  object (`return { cols, keptPct, fmt1: (v) => v.toFixed(1) }`)
  arrives as `undefined`, and the probe dies mid-run with
  "`expected.fmt1` is not a function" AFTER half its checks have
  already passed (hit 2026-09-30 in switching-reverse.mjs).
  Re-declare shared helpers (`fmt1` & co.) in node scope, right
  after the evaluate. **The boundary runs INWARD too (hit 2026-10-01
  in probe-sp-allvoters.mjs):** the evaluated function sees NOTHING
  of the probe's node scope — a top-level `const r2 = …` is a
  `ReferenceError: r2 is not defined` inside
  `page.evaluate(() => … r2 …)`. Define such helpers at the top of
  the evaluated body, or pass plain values through `page.evaluate(fn,
  arg)`.
- **HTMLElement values in the return payload silently vanish too**
  (probe-sp-allvoters): a DOM node returned inside the result object
  arrives `undefined` (often taking the WHOLE result down with it) —
  return className strings/rects instead, never nodes.
- Driving the page: click by visible text in `page.evaluate`
  (`[...document.querySelectorAll("button, a")].find(n => /all polls/i.test(n.textContent))`),
  then `page.waitForSelector` the panel — the app mounts async.
- If a check fails against the LIVE site, separate "deploy stale?" from
  "fix wrong?" first (see auspol-live-site-verify) before touching code.
  A third class exists for probes against the LOCAL tree (hit
  2026-10-01): **a sibling session's mid-flight/aborted build leaves a
  TORN index.html** — the probe can't find selectors that obviously
  exist. Before debugging your own change, check the file's byte/line
  size against the ~2.7MB norm and confirm another session's build
  isn't still running; the fix is to probe a clean-room rebuild (your
  git-archive snapshot), not the shared live artifact.
- **A width SWEEP needs a fresh PAGE LOAD per width, not one reused tab
  resizing** (hit 2026-10-03 in `.matilda/probe/frame-margins.mjs`, the
  satellite frame-margin parity gate): stepping ONE page through 18
  sequential `setViewport` shrinks trips scroll-anchoring while the
  ~16kpx document reflows — the masthead's `getBoundingClientRect().top`
  inflated 50→2007px down the sweep even after `scrollTo(0,0)` and a
  settle, while computed paddings held steady and correct the whole way
  (a MEASUREMENT artefact, not layout drift: a fresh 390px load gave
  headTop 19.66 ≈ the 20px pad). The satellite's page (short document)
  showed no artefact, so a two-page comparator reads a phantom
  divergence on the long page only. Working shape: per width, open the
  page, `goto`, measure, close — for BOTH sides. Trust computed style +
  a fresh-load spot check to adjudicate any rect-vs-style disagreement
  before "fixing" the page.
- **A computed CSS value ≠ the authored value can be CORRECT — root-cause
  with a minimal repro before "fixing" the stylesheet, then set the
  probe's expectation to the spec** (hit 2026-10-03 in
  `.matilda/probe/hl-tabs-scroll.mjs`): a probe asserted
  `getComputedStyle(strip).overflowY === "clip"` and got `"hidden"`.
  Chrome 154 repro on a bare `<div>` proved the CSS was right and the
  expectation wrong: CSS Overflow Level 3 compels `clip` to compute to
  `hidden` when the OTHER axis is `auto`/`scroll`, so
  `overflow-x:auto; overflow-y:clip` reads back `hidden` — the locked
  state the stylesheet intended. Probe rewritten to accept
  `hidden|clip` as "y-axis locked"; the bare `overflow-x:auto` case
  (which computes y to `auto` — user-scrollable, the bug being hunted)
  stays distinguished because `auto` fails the set test. When a
  computed value deviates from authored, build a 20-line page-external
  repro BEFORE touching the product CSS.
- **Assert axis-locks as an invariant SET + sub-pixel slack, not by
  simulating a drag** (same probe): for "not user-scrollable
  vertically", `overflow-y ∈ {hidden, clip}` plus
  `scrollHeight − clientHeight ≤ 1` IS the lock. A force-
  `scrollTop = 40` test round-trips through layout state and asserts a
  side-effect of one engine's computed-value choice — on Chrome the
  `clip`-specced value computes to `hidden`, which scrolls identically,
  so the forcing test adds brittleness without signal.
- **Gate "ui must move" assertions on motion being OWED, or the probe
  hallucinates product bugs at boundary widths** (same probe):
  selecting the last tab of a scroll strip should glide it into view —
  but only when it actually sits off-strip at rest (`lastOffStrip`:
  tabRight > stripRight + 0.5 at `scrollLeft = 0`). Near a fit
  boundary the overflow can be a sliver (11px) that sits entirely
  inside the runway so every tab is visible and ZERO motion is the spec
  answer. Probe logs "not owed here, skipping" instead of red at that
  rung. Compute the precondition inside the probe per rung; never bake
  "this width always scrolls" from the day it was measured — a later
  copy/label change moves the boundary.
- **Puppeteer's `page.evaluate(fn)` serialises the function — outer
  node-scope variables are invisible inside it.** A factory like
  `const m = (sel) => () => document.querySelector(sel)` dies with
  `ReferenceError: sel is not defined` in the browser realm (the
  inward-boundary rule's closure variant). Either pass values as
  `page.evaluate(fn, arg)` or splice the literal into the evaluated
  body (`new Function` over a JSON.stringify'd template, as
  frame-margins.mjs's `measure()` factory does).
- **Measuring "label ink vs mark" collisions needs VISIBLE-CLIPPED
  rects, not raw Range text boxes** (hit 2026-10-03 in
  `.matilda/probe-wv-row-height.mjs`, the Who-votes whisker-row drive
  8a246ee): RollNum's odometer renders the full digit stack 0–9 down
  the reel, clipped by an overflow-hidden wrapper — and
  `Range.getClientRects()` returns the UNCLIPPED text-node boxes,
  i.e. phantom digit boxes tens of px beyond the clip window. A naive
  per-text-node ink union reported the figures' cells as 118px taller
  than render (text from the cells one row below!). Fix: clip every
  Range rect to the intersection of all `overflow-*: hidden|clip`
  ANCESTOR boxes before unioning. `getBoundingClientRect` on the
  figure element itself is clipped correctly — but it includes empty
  padding, so for "is the halo touching the ink" either clip manually
  or compare against the inner `b`/`span.font` boxes' rects.

## Keyboard-chord probing (probe-theme-key.mjs, the Option+D theme key, 2026-10-03)

Two event classes, split by what they assert: the HAPPY path deserves a
trusted chord — `page.keyboard.down("AltLeft")` → `down("KeyD")` → the two
ups — while GUARD paths (a `repeat: true` event, a `metaKey` chord, a bare
key) are faster and more precise as synthetic
`document.evaluate`-dispatched `KeyboardEvent`s
(`document.dispatchEvent(new KeyboardEvent("keydown", {bubbles: true,
cancelable: true, …}))`): a synthetic event lets you set flags no real
gesture can (there is no "held autofire" in Puppeteer's API). State flips
the app applies inside `document.startViewTransition(applyFn)` land
ASYNCHRONOUSLY (the class change runs after capture) — settle ~700ms
before reading `document.body.classList`. On the theme rig specifically
the FIRST flip skips the transition (a module-level `chromeSettled` flag
spends animation on flips only) and the SECOND transitions, so settle
after both, and snapshot the initial state and assert RELATIVE to it —
useTweaks persistence means the starting theme isn't guaranteed. An
editable-field guard probe needs a REAL focused
`<input>` (create/focus in-page, drive the trusted chord, assert no flip
and `activeElement` unchanged, then remove). Companion:
auspol-theme-toggle-system.

## Transition-frame sampling (probe-flow-tip-close.mjs §c, 2026-10-06)

When React REUSES a DOM node across a user path (dot-to-dot taps without
unmount) and CSS transitions its position (`.tip` glides `left` .15s), a
rest-state probe is blind: settle → measure reads the destination, which
app code may have already made correct, while every INTERMEDIATE frame
overflows. The flow-tip edge-overflow bug lived exclusively in those
frames — probes that dismissed between taps mounted fresh nodes (no
glide) and reported green for months.

- **Sample THROUGH the transition** — after the gesture, poll the rect
  every ~30ms for ~2.5× the transition duration (12 frames over 150ms),
  keep `worstL`/`worstR`, and assert the INSET (chart box ± 8px) holds on
  every frame, plus a resting check at the end.
- **Reproduce the DOM-reusing user path exactly** — the user's path was
  mid-dot → edge-dot with NO dismiss; a probe that dismisses between
  interactions exercises a different (fresh-mount) code path and is
  worthless for this defect class. When a user says "do A then B"
  and your probe does A, dismiss, B, suspect the probe.
- **Component-side corollary:** `getBoundingClientRect()` inside a
  layout effect on such an element reads where the glide STARTED, so a
  post-commit correction computed from it applies to the OLD position.
  The fix pattern is TrendChart's `tipW` idiom: measure only the
  INVARIANT (element width) in the layout effect, compute the clamp IN
  RENDER so every glide frame is clamped. Product detail and the
  red/green probe: auspol-flow-drift-panel.

## Text-selection synthesis: impossible in this rig's headless Chrome (2026-10-01)

Probing the hover-claims selection guard (`.matilda/probe-issue-clickout.mjs`
P5, the tabpanel focus-park fix) burned a full bisection: no CDP gesture
produces a text selection in this rig's `headless: "new"` Chrome.

- **Drag** (down, stepped move, up) — `window.getSelection().toString()` is
  `""`. **Double/triple-click** word/paragraph select — same.
- **Caret-placement clicks** — a plain click after a programmatic
  selection does NOT collapse it (`isCollapsed` stays false, ranges
  survive). Focus/pointer events all dispatch normally; the gap is
  selection/caret synthesis only.
- Reproduce on a CLEAN page first before debugging the app:
  `data:text/html,<p style="position:absolute;left:100px;top:100px">Who votes</p>`
  — if a drag across THAT is also empty, it's the rig, not your app
  (css `user-select` was a red herring here; the one early "drag worked"
  result was a flake, not a mode).
- **Workaround — drive selection STATE programmatically:**
  `page.$eval(sel, el => { const t = el.firstChild; window.getSelection().setBaseAndExtent(t, 0, t, t.textContent.length); })`
  and `.collapseToStart()` to collapse. Assert the app's guards against
  selection state (`s.isCollapsed`), never against the gesture that in
  real Chrome would have produced it. This preserves what is being tested:
  the guard reads `window.getSelection()` at keydown, and a scripted
  range exercises exactly that read.
- Companion timing trap from the same probe: a geometry read issued right
  after `el.scrollIntoView({block:"center"})` lands mid-glide (smooth
  scroll animates), so the click coordinate computed from it misses.
  Either use `{block:"nearest"}`, or read the rect twice ~150ms apart and
  require two equal consecutive reads before acting.

## Page-parity probing traps (masthead-parity.mjs, 2026-09-24)

When the probe compares ANOTHER page's rendering against the main page's
(the satellite masthead had to be byte-identical), three assertions each
cost a probe iteration before they measured the right thing:

- **React SVG props land in `style`, not as attributes.** The main page's
  dial sets `strokeDasharray` via React style prop, so
  `getAttribute("stroke-dasharray")` is `null` while the shell page sets
  the real attribute. Read `el.style.strokeDasharray ||
  el.getAttribute("stroke-dasharray")` — and CSSOM serialises dash arrays
  COMMA-separated (`"10.5, 10.5"`), so `.replace(/,/g, " ")` before
  splitting/parsing or every value is NaN.
- **Compare CSS custom properties at the CONSUMING element, not
  `:root`.** The main page scopes its dark tokens at `body.dark`, the
  satellites at `:root:not(.sh-light)` — documentElement `--alp` read
  light-token on one and dark-token on the other while the actual strokes
  matched. `getComputedStyle(dial).getPropertyValue("--alp")` resolved
  identically on both. Assert tokens where they're used.
- **Third-party embeds stall the `load` event past the nav timeout.**
  The Newspoll archive's Infogram embed never fires `load`, so
  `page.goto(..., {waitUntil: "load"})` dies at
  `TimeoutError: Navigation timeout of 30000 ms exceeded`. Use
  `waitUntil: "domcontentloaded"` on any page with external embeds, then
  a fixed settle `wait` — the lockup/dial assertions don't need `load`.
- Headless Chrome defaults to prefers-color-scheme DARK, and parity
  asserts on both pages are symmetric in dark token values — fine, but
  know which scheme your numbers are in before "fixing" a mismatch.

The working two-page comparator is `.matilda/probe/masthead-parity.mjs`:
one serve-and-probe skeleton, the SAME `page.evaluate` lockup-measurer fn
run against two `browser.newPage()`s (main `/` and `/archives/newspoll/`),
asserting computed font/weight, per-part dial stroke/geometry plus
interaction (`/#story` opens `.dl-backdrop`). Two further traps found
2026-09-29 when that probe was re-scoped for the masthead's two-structure
split (see auto-skill-auspol-masthead-glyph-player):

- **DELIBERATE divergence ≠ regression — pin design values, not equality.**
  The main page's rd layer sizes its wordmark 34px vs the shell's 30px
  (rd.css:402); a "type identical" assert fails on 34≠30 although both are
  correct. Assert each page against its design constant
  (`main === "34px" && sat === "30px"`) so a genuinely lapsed rule trips.
- **Animated/settling values are never equal across two loads.** The dial
  needle's transform matrix sampled ~1.6s after each goto differs at 1e-4
  between pages (mid-settle). Derive the QUANTITY and compare within
  tolerance: θ = atan2(b, a) from matrix(a,b,c,d,e,f), |Δθ| < 1e-3 rad.
- **Moving an element between wrappers re-scopes every ancestor query.**
  The dial moved out of the h1 (main) but stayed in `.wordmark` on
  satellites — `wm.querySelector("svg.wm-dial")` returned null on one page
  while passing the other. Query relocated elements at document scope.

## Copy-assert probing (Who-votes constant headline, 2026-09-28)

When the change under test is rendered TEXT (a headline/dek restructure),
textContent assertions have their own traps — discovered in one probe
iteration round (6 of 21 initial "failures" were all assertion bugs, the
app was right):

- **Assert sentence STRUCTURE, not wording, when wording re-cuts per
  state.** The dek's first sentence varies per tab AND may name a group
  instead of the party ("University graduates are less likely…") — a
  regex keyed to "One Nation" fails on those tabs while the design is
  correct. Assert the invariant instead: `dek` = finding sentence +
  ". " + figures sentence, and the figures sentence always contains
  " back " in this panel.
- **Clicking the already-active tab is a no-op**, so a "value changes on
  click" loop reports a fake failure on the tab that was current at
  load. Click a NON-default tab first, take the baseline there, then
  loop through all of them.
- **`goto "file://" + cwd + "/index.html"` suffices for copy asserts** —
  no http server skeleton needed: every JS asset is inlined into
  index.html by the build, so all logic runs off the file URL (only
  fonts and hashed sidecars 404, which text checks never touch).
- **Probes cannot be written to /tmp** (`write_file` refuses
  out-of-workspace paths in BOGAN mode). Keep them inside the repo under
  the gitignored `.matilda/` scratch root — `.gitignore` covers
  `.matilda/*` with only `!.matilda/skills/` re-included, so anything
  `.matilda/*.mjs` is safe from other sessions' sweeps. The worked
  example is `.matilda/demo-head-probe.mjs`; older probes follow the
  `.matilda/probe/` subdir convention above.

## Panel head/dek probing (RdHed; switching-title-dek-swap, 2026-09-30)

Verifying a title/dek SWAP on a Snapshot panel cost three probe-side
failures before green — all selector/shape traps, the app was right:

- **The user-facing head/dek are NOT next to the h2.** RdSec renders the
  h2 + a meta line ("How 2025 voters say they'd vote now, YouGov and
  DemosAU, last six weeks") and RdHed separately emits
  `<h3 class="rd-hed">{head}</h3>` + `<p class="rd-dek">{dek}</p>` (both
  level-3 by default; rd.jsx ~:58). `sec.querySelector("h2 + *")` returns
  the META line — the probe then reports the head unchanged. Read
  `sec.querySelector(".rd-hed")` / `.rd-dek` instead.
- **plainShare prose defeats naive casing/wording regexes.** It prefixes
  an OPTIONAL qualifier ("Almost ", "Nearly ", "Just over ") and rdCap
  capitalises ONLY the first word: `"almost two in five"` → "Almost two in
  five", so "two"/"five" stay lowercase. A `/[A-Z]\w+ in \w+/` probe fails
  on the qualifier; a `/[A-Z][a-z]+ in …/` fix-up fails on the lowercased
  fraction. Pin structure with an optional-qualifier regex:
  `/^(?:Almost |Nearly |Just over |Over )?[A-Za-z]+ in [a-z]+ 2025 …/`.
- **A phone rung can swap the whole RENDERER, not just class names.** At
  390px RdSwitching replaces the desktop SVG mosaic with a `.rd-mo-rows`
  DOM list: SVG `text`-filtering probes return `[]` (the panel renders
  fine) and the same labels live at `.rd-mo-row .rd-mo-rtop b:last-child`
  ("≈ 12.4 pts"). Read the copy from whichever renderer the width mounts
  — mirror the existing `.rd-ap-row, .rd-ap-card` class-swap rule above,
  one level deeper.

The extended probe also recaps two skeleton lessons that remain true: its
http server maps `/` → `/index.html` before the path join (a bare
`isDirectory()` 404 looks like a broken build — the whole page 404s and
`waitForSelector` times out), and live expectations come from evaluating
the `9f09dca2` data asset with `new Function("window", src)(win)`, where
`AP.D.onSources.series` is an ARRAY of `{id,…}` entries (a keyed-object
assumption dies on `Cannot read properties of undefined`). The probe is
`.matilda/probe/switching-title-dek-swap.mjs` (force-tracked).

## Rect-overlap and wrap asserts on RESPONSIVE layouts (shift-plot title, 2026-10-01)

Pinning a "title stays on one line" CSS fix (Decidedness RdShiftPlot,
commit 9164ed8, probe `.matilda/probe-shifttitle.mjs`) produced three
probe-side failures, all assertion bugs while the app was right:

- **Tab-mounted DOM needs click THEN waitForSelector.** The probed card
  (`#undecided .rd-sp-head b`) exists ONLY after the By-party tab is
  clicked — waiting on it at page load
  (`waitForSelector("#undecided .rd-sp-head b")`) times out. Sequence:
  wait for a stable ancestor (`#undecided`), click the tab inside one
  `page.evaluate` (+settle wait ~700–900ms), THEN `page.waitForSelector`
  the newly-mounted node, THEN measure. Same shape as the click-then-query
  pre-flush trap, one level up (the node doesn't exist at all yet).
- **Overlap asserts must intersect BOTH axes.** A horizontal-only check
  (`titleRight > captionLeft`) false-reported COVER at 390px: the ≤640px
  re-flow STACKS the cousins (title promoted to its own row, caption
  pushed to row 3), so their x-ranges cross legitimately while their
  y-ranges never meet. Intersect
  `(a.t < b.b) && (a.b > b.t) && (a.l < b.r) && (a.r > b.l)`.
- **One-line vs wrapped = inline-rect height vs the known line box.** An
  inline `<b>` has no safe line-box API; assert
  `getBoundingClientRect().height` against the single-line height
  (21.8px at 15px/600; wrapped ≈ 42). A `> 30px` threshold is robust.
  For true TEXT extent independent of the element box (needed when the
  box is a spanned grid area), Range-select the contents:
  `range.selectNodeContents(el); range.getBoundingClientRect()`.

## Popover/nudge probing traps (RdQPop clamp, 2026-09-29)

Two failures of the same probe, both probe-side before the app was at
fault:

- **Click-and-query in ONE `page.evaluate` reads pre-flush DOM.**
  Dispatching a `click` on a React button and immediately returning
  `document.querySelector(openStateSelector)` in the same evaluate sees
  the render BEFORE React committal ("panel not open"). Split it:
  evaluate the click, `page.waitForSelector` the newly-mounted node,
  then evaluate the measurements.
- **The margin-left nudge idiom does not transplant to right-anchored
  boxes.** The repo's tooltip shift pattern (`el.style.marginLeft =
  dx + "px"`, rd-polls.jsx tlTip / RdApMini) works because those tips
  are left-anchored. On an abspos element positioned via `right:` (e.g.
  `.rd-qpanel.left { right: -8px }`), Chrome computes the margin —
  probe reads `style.marginLeft = "118px"` and
  `getComputedStyle().marginLeft = "118px"` — yet the rendered rect
  moves 0px. The standalone `translate` property (`el.style.translate =
  dx + "px 0"`) moves it and composes before the base `transform`, so
  it can't clobber a `translateX(-50%)` centring rule either. When a
  nudge-verify shows "style applied, rect unmoved," suspect THIS before
  re-checking your effect order. Component-side fix shipped inside
  RdQPop; details in auspol-rdqpop-popover.

## CDP touch-swipe probes (hero swipe gate 49a6bfe, 2026-09-30)

Driving the phone swipe handler via `page.createCDPSession()` +
`Input.dispatchTouchEvent` produced two probe-side failures that each
looked like a product bug and weren't. Verify these BEFORE reopening
the product code:

- **A touch dispatched below the viewport hits `document.body`.**
  `scrollIntoView({ block: "start" })` on `section.rd-tpp` puts the
  section's heading at viewport top; the tall card's svg CENTRE then
  sits at y≈926 on an 844px viewport. `document.elementFromPoint(cx,
  926)` returns **null**, the dispatched TouchEvent's `target` is
  document-level, and the page-level touchend handler
  (73de0c58 ~:2119–2215) finds no row claim and fires `goTab` — the
  probe sees sections swap `two-party…` → `cyc-summary…final-polls`
  with no pageerror and concludes "swipe broke the tab bar." The
  product was fine. Fix: `scrollIntoView({ block: "center",
  behavior: "instant" })` on the TARGET element (the svg itself, or
  the list button), re-read its rect, and assert
  `r.y >= 0 && r.y + r.height <= innerHeight` (or at least cy ≤
  innerHeight) before dispatching. First diagnostic when a swipe probe
  "navigates away": evaluate `elementFromPoint` + its
  `.closest("[data-rd-swipe-exact]")` / `.closest(".chart")` chain at
  the dispatch point.
- **Assert a signal unique to the variant, not a shared label.** The
  2PP hero's `chartTitle` is "Labor's two-party-preferred vote, %" for
  BOTH vs-Labor matchups (`MATCHUPS[id].vsLabor` covers alp_lnp AND
  alp_on — rd-hero.jsx :307), so a title-diff probe reads "no flip"
  while `__rdSwipe(1)` demonstrably flipped the contest. The
  variant-unique signal is the rival name:
  `section.rd-tpp .rd-tpp-side.rd-b .rd-tpp-name` ("One Nation" →
  "Coalition"). The hero readout sides are `.rd-tpp-side.rd-a` /
  `.rd-tpp-side.rd-b`.
- **Swipe gesture shape the handler accepts**: single-touch start
  (not within 28px of either screen edge), ~10 × 12px moves at 16ms
  (≈120px in ~160ms), end. The onEnd gates are dx ≥ 60px,
  |dy| ≤ |dx|/2, dur ≤ 800ms, scroll drift ≤ 12px, no text selection
  — a stutter-free CDP sequence passes all of them; wait ~500–600ms
  after touchEnd before reading (morph + state commit).
- **Verify a flip-call chain by spying, not by instrumenting
  source**: wrap the DOM callback in-page
  (`card.__rdSwipe = (d) => { spy.push(d); return orig(d); }`) to
  separate "handler fired" from "handler's effect invisible" — in
  this case the spy proved `__rdSwipe` fired and returned true while
  the title assertion (wrong signal) reported failure.

The extended probe is the swipeProbe section of
`.matilda/probe/phone-evlist-tap.mjs` (still untracked scratch). After
a0b0d97 (the swipe claim-map revert) its assertions are ROUND TRIPS:
figures/svg swipes flip the rival name; scale and event-list swipes
turn the page (first `section.rd-sec` id CHANGES), then a
right-direction swipe returns it and only THEN is the rival name
asserted unchanged (the unmounted hero reads null while off-page).
Two mechanics that round-trip probing taught:

- **Parameterise swipe direction.** One `dir` arg on the dispatch
  helper (−1 = x decreasing = "next page" in the handler's
  `dir = dx < 0 ? 1 : -1`; +1 = "previous") — the gesture layer maps
  finger direction to tab delta, so a left-probe always exiting on
  "next" means the return needs an explicit rightward pass.
- **Return-swipe on a surface that is PRESENT.** The return helper
  (`backToFirst()` in phone-evlist-tap.mjs) swipes on `section.rd-sec
  h2` — a section head is never a claimer in this app, and it exists
  on every page. An early version return-swiped on `section.rd-tpp
  .rd-lg`, but that element is UNMOUNTED the moment the page turned
  (the hero section re-renders away), so `centreInView` returned null
  and every downstream probe failed with misleading "list not found"
  errors. Rule: a probe that turns the page away from its subject
  must (a) record what it needs BEFORE the turn, (b) resume via a
  pan-page anchor, and (c) assert subject state after resumption, not
  mid-turn.

## Safari-only bugs — drive WebKit, Chrome cannot see them (2026-10-01)

Worked end-to-end on the rdPinScroll round-4 crawl (the full
engine-fix story is in auto-skill-auspol-rdpinscroll-row-pin): the
user reported the All-polls facet walk drifting down a pixel a lap,
forever, **Safari only**. Every Chrome probe — creep walks, twopp↔
primary ping-pong, 400ms chains, shallow parks — was pixel-exact
green, and could never have caught it; the disease was WebKit
scroll quantisation, and Blink doesn't quantise. Lesson one: when
the report names Safari (or "not Chrome"), budget for a WebKit run
BEFORE trusting a green Chrome battery.

**Tooling recipe.** Playwright WebKit, no repo changes:

1. Check `~/Library/Caches/ms-playwright/webkit-*` FIRST — some
   playwright install on the machine usually leaves cached engine
   builds (this machine had webkit-2203 and webkit-2359).
2. Install `playwright-core` (pure JS, no browser download) into a
   scratch dir OUTSIDE the repo — `mkdir ~/.matilda-tooling/pw &&
   npm i playwright-core` there. NEVER add it to the repo's
   package.json/package-lock: those files are shared with sibling
   sessions and CI. If `webkit.executablePath()` wants a revision
   the cache lacks, pin the playwright-core version that wants a
   cached one (the error names the wanted `webkit-XXXX` dir).
3. Import it from a probe inside the repo with
   `createRequire("/Users/…/.matilda-tooling/pw/node_modules/playwright-core/package.json")`
   — the probe itself still lives gitignored under `.matilda/`
   (`.matilda/dbg-ap-webkit.mjs` is the round-4 template: node:http
   serve skeleton identical to the puppeteer one, API swaps are
   `page.waitForTimeout(ms)` for sleeps and `page.keyboard.press`
   works the same; `page.addInitScript` for pre-load wrapping).
4. Real Safari via `safaridriver` is NOT worth it: enabling needs
   interactive sudo, and WebKit has matched Safari on most scroll /
   RO / paint behaviour probed — BUT NOT ALL: 2026-10-01 a user-visible
   drift (the twopp-facet RdHed mount) was clean in webkit-2359 over 30
   ping-pong pairs yet real in the user's Safari, so bundled WebKit ≠
   real Safari and a green WebKit battery no longer clears a Safari
   report (see the divergence section below).

**WebKit-specific diagnostics that paid off** (all in-page wraps,
no source instrumentation — serve modified JS only if desperate):

- **Wrap the scroll API surface, not just scrollTo.** `scrollBy`,
  `scrollTo`, `scroll` — log args + `scrollY` before/after + a
  timestamp, plus a scroll EVENT listener so engine-side moves are
  distinguishable from script moves. Verdicts: a fractional
  `scrollBy` whose scrollY never changes = **root-scroller css-px
  quantisation** (WebKit truncates a fractional scroll target to
  integer CSS px; `window.scrollY` is always an integer in WebKit
  while rects are fractional); scrollY changing with NO logged call
  = the engine scrolled (touch, momentum, restoration); a jittering
  alternate between two ±quantum positions = a fix-loop fighting
  the quantiser (that's what the rd.jsx round-4 chase looked like
  — ~40 dead scrollBy calls per hop).
- **Kill "something is growing" theories cheaply**: snapshot a FIXED
  selector set (`getBoundingClientRect().top + scrollY` and height)
  per hop and diff — query fresh each hop because React may remount
  nodes, defeating identity/path-keyed tracking (a culprit-hunt
  probe keyed by DOM index-path went NEW-noisy when a conditional
  sibling shifted child indices, hiding the answer). If every
  candidate is byte-constant across hops while scrollY walks, the
  document isn't moving — the scroller is. Careful: `position:sticky`
  children track the scroll, so their "doc tops" move with scrollY
  — don't misread them as growth.
- A genuinely content-side WebKit-only growth to keep in the back-
  pocket (probed and cleared that round): WebKit applies an
  inherited positive `line-height` to a bare `font:inherit` button
  under `text-transform:uppercase` and shifts its content box
  (+0.39–0.55px) where Blink holds the CSS pixels — mini-repro
  `.matilda/dbg-ap-cssom.mjs`. If the fixed-selector sweep DOES find
  a grower, an uppercase styled flex parent inheriting line-height
  late is the first suspect.

## Regression-sweep triage: dead probe or product regression? (2026-10-01)

A failing probe in a post-change regression sweep is NOT automatically
your change. Two failure classes got conflated this session and only a
live-DOM census separated them (cyc-rings feature, commit 6619fb2):

1. **The probe is dead since an earlier UI change.** Symptoms:
   `waitForSelector` burns its full timeout on a selector from an
   older design. Diagnose BEFORE debugging your own work — one
   `page.evaluate` on the served page counting (a) the awaited
   selector and (b) the replacement UI's selector: both zero hits for
   the old and nonzero for the new = the probe's page contract is
   obsolete. Worked case: `.matilda/verify-cycle-{lift,outcome}/`
   waited on `.cyc-legend .ap-popbtn` — the live page carries ZERO
   `.cyc-legend` elements since the rd-cycles redesign renders
   `.rd-cc-board`/`button.rd-chip` instead; the probes' last commit
   (2026-09-19) predates it. Verdict: pre-existing bit-rot, sweep
   verdict "not a regression"; their contracts had already moved to
   the redesign-era probes. Record the finding in the task's domain
   skill (a dated caution above the stale section in
   auto-skill-auspol-past-cycles) and propose port-or-retire — do not
   leave a silently-red probe for the next sweep to re-diagnose.
2. **A COMPLETE but stale-content build** (the torn-build bullet's
   stealth sibling): a sibling session committed the UI sources but
   its `index.html` was built from a source mix predating your data
   change. The artifact is normal size — the byte/line-size check
   PASSES it — and the page boots clean with the new UI code but old
   inline data, so DOM behaviour driven by the new payload silently
   degrades (the closing rings just never rendered: consumer was
   `c.endRes || null`). Gate the artifact on a DATA-key grep
   (`grep -c '"endRes"' index.html` — or an in-probe
   "the data landed" assert against `AP.D`, which is what
   cyc-rings.mjs now does) before believing any probe failure, and
   rebuild yourself: `node .build/newtracker/build.mjs`.

Only after both are excluded does a red sweep probe point at the
change under test.

## Collision-sweep false positives: measure the right node (2026-10-07)

The Issues-facet head-jumble width sweep (`.matilda/probe/iss-head-sweep.mjs`,
ship 66a078a) reported `dots∩dots` and "picture runs past the Best cell"
at EVERY width — all probe artifacts, the page was clean. Three kinds:

- **Only the dot-halo ELEMENTS are dots.** The picture track renders its
  gridlines as `.rd-ap-gl` `<i>` elements inside the same pic — a bare
  `.rd-ap-pic *` or "any mark in the track" selector counts gridlines as
  dots and reports fabricated intersections. Scope dot queries to
  `.rd-ap-pic .rd-ap-dot` (the halo+dot pair is the design; siblings are
  furniture).
- **A right-aligned th's glyph rect ≠ its track.** `justify-self:end`
  means the cell's TEXT box ends at the track edge but starts wherever
  the text's width puts it — under a starving grid that glyph box
  overflows LEFT across neighbouring tracks, so intersecting it against
  "the next column's cell" misreports which columns collided. Compare the
  pic cell against a fixed-grammar peer that ALWAYS fills its track
  (`.rd-ap-netcell`), never against a right-floated header's text box.
- **A sanctioned overlap is not a collision.** Newest SEC Newgate row:
  ALP 23 / ONP 22 ownership — dots 1 scale-point apart overlap halos at
  every width BY DESIGN (`.rd-ap-dot` halo, dbac426). A sweep's dot∩dot
  assert needs a known-adjacency exemption or it flags one everlasting
  false positive.
- **Phone rungs null-out desktop selectors** — a budget probe that reads
  `.rd-ap-hrow` crashes at 390px (cards, no hrow). Print `row=null` /
  skip instead of throwing, so one rung's crash doesn't truncate the
  sweep's other widths; the crash itself is the rung-boundary detector.
- Cross-check the sweep's arithmetic against a budget probe
  (`.matilda/probe/iss-head-budget.mjs`: per-vw actual inner width +
  resolved `grid-template-columns`, plus max per-column `scrollWidth`
  across ALL rows at a wide viewport for content-true floors) — a
  collision report whose template already sums under the inner width is
  a probe bug, not a layout bug.
