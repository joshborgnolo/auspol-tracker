---
name: auspol-headless-geometry-verify
description: "auspol-tracker — verifying a layout/spacing OR interactivity fix headlessly in this repo: screenshots are USELESS to the reviewing model (read_file cannot process PNG — no image input), so assert geometry NUMERICALLY via getBoundingClientRect diffs / computedStyle / DOM text inside a puppeteer-core probe instead, and drive interactivity via page.mouse.hover / elementFromPoint with state read off classes and cursor style. Includes the .matilda/probe/*.mjs serve-and-probe skeleton (node:http on an ephemeral port, system Chrome headless: 'new', stub window.AP bridge calls, keep probes untracked). Worked 2026-09-23: house-lean control gap measured 2px, fixed by CSS, re-probed at 12px (77eed98); 2026-09-24: undecided dots unclickable — key/query and overlay causes eliminated with probes, catchment grid-walk showed the pick region displaced down-right, rect comparison found .chart wrapper 30px taller than its svg (toVB measured the wrong box; 0c3d9b7). Also 2026-09-24, PAGE-PARITY probing traps (masthead-parity.mjs asserting a satellite == the main page): React style-prop SVG attrs land in style not attributes and CSSOM serialises dasharrays comma-separated (normalise commas or NaN); compare CSS custom properties at the consuming element not :root (dark tokens sit at body.dark on main vs :root on satellites — documentElement reads legitimately differ); third-party embeds (Infogram) never fire load → goto with domcontentloaded; headless Chrome is dark-scheme by default. 2026-09-28, SCROLL/event verification: wrap window.scrollTo IN-PAGE before triggering the action (empty capture list + a changed scrollY = some other API scrolled, e.g. scrollIntoView via boundingBox-mouse-click coordinates); assert ONE call and a stable docTop trajectory across 60–1200ms (no late layout shift); clicking SVG circles — ElementHandle.focus() is unsupported protocol-side, SVGElements have no .click(), and narrow viewports switch row/card selectors, so drive clicks with el.dispatchEvent(MouseEvent) and select '.rd-ap-row, .rd-ap-card'. 2026-09-28 COPY-ASSERT probing (.matilda/demo-head-probe.mjs, the Who-votes constant headline): assert sentence STRUCTURE not wording when the text re-cuts per UI state; clicking the already-active tab is a no-op so reset to a non-default tab before change-asserting loops; goto file:// is enough for copy asserts (all JS inlines into index.html); BOGAN mode blocks write_file to /tmp — scratch probes belong in the gitignored .matilda/ root. 2026-09-29 (RdQPop '?' popover clamp): click-then-query in ONE evaluate reads the DOM before React flushes (panel 'not open' — split click and measure across waitForSelector), and margin-left is computed but INERT on a right-anchored abspos box so a nudge fix must shift it with the translate property, asserting BOTH the applied style and the moved rect. 2026-09-30 CDP TOUCH probes (Input.dispatchTouchEvent, hero swipe gate 49a6bfe): a touch dispatched below the viewport (scrollIntoView({block:'start'}) on a tall section left the svg centre at y=926 on an 844px viewport) hits document.body — elementFromPoint returns NULL — and this app's page-level touchend handler then page-turns (goTab), making a probe bug look like a product bug; scroll the TARGET to block:'center', assert 0≤cy≤innerHeight, and elementFromPoint-verify the closest() chain before reading state; and the 2PP matchup-flip signal is NOT the chart title (identical across vs-Labor matchups alp_lnp/alp_on) — assert the rival-name node .rd-tpp-side.rd-b .rd-tpp-name." 2026-09-30 (switching-reverse.mjs, the mosaic encoding reversal 742df1e): pinning probes in .matilda/probe/ ARE force-tracked (the dir is gitignored — git add on a new probe FAILS and an `&&`-chained commit aborts silently mid-command; git add -f it separately after the main add), and page.evaluate returns are JSON-serialised so helper functions passed back in the result object vanish (expected.fmt1 is not a function) — re-declare shared helpers (a fmt1 formatter…) in node scope after the evaluate. 2026-09-30 PANEL-HEAD-DEK probing (switching-title-dek-swap.mjs, three selector traps on the way to green): a panel's user-facing head/dek live in RdHed's .rd-hed h3 / .rd-dek p — "#switching h2 + *" grabs the RdSec META line ("How 2025 voters say…") instead; plainShare prose begins with an OPTIONAL qualifier ("Almost " / "Nearly " / "Just over ") and rdCap capitalises only the FIRST word ("Almost two in five"), so regex the fraction as [A-Za-z]+ in [a-z]+ behind an optional qualifier group; and a phone rung can swap the whole RENDERER, not just class names — RdSwitching's 390px view replaces the SVG mosaic with a .rd-mo-rows DOM list, so SVG text[] probes return [] and the same labels live in .rd-mo-rtop b:last-child.
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
  after the evaluate.
- Driving the page: click by visible text in `page.evaluate`
  (`[...document.querySelectorAll("button, a")].find(n => /all polls/i.test(n.textContent))`),
  then `page.waitForSelector` the panel — the app mounts async.
- If a check fails against the LIVE site, separate "deploy stale?" from
  "fix wrong?" first (see auspol-live-site-verify) before touching code.

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
