---
name: auspol-mobile-overflow-probe
description: "auspol-tracker — horizontal document-overflow probing and causes. Symptoms: on a phone the page is pannable/right-draggable with wave line-art down the RIGHT gutter (worked 2026-09-07, dc02e64); faces the wrong-direction trap that live innerWidth EXPANDS after overflow (capture it once, compare against the constant). ALSO transient classes: the click-triggered view-switch bounce (460a75c: unmeasured-sentinel so the first painted frame is already correct) and the LOAD-TIME flash (4181886: sampler installed via page.evaluateOnNewDocument so it runs before the page's own scripts, per-rAF scrollWidth recording during navigation; three cause classes — mount-time measurement against pre-boot-class DOM [fix: set the boot class in the boot script before render], visibility:hidden absolutely-positioned parked items still counting toward scrollWidth [fix: right: 0], and a persistent mid-width band the phone/desktop gates both miss [fix: a second useNarrow handoff breakpoint]). Probe traps: compare against ORIGINAL captured innerWidth, key the element scan on absolute rect width, return only serialisable values from evaluate, disambiguate shared CSS classes by a distinguishing child, click real tab labels. Verify: serve the rebuilt tree + re-probe a width grid, ship gate is zero overflow frames at every rung."
source: auto-skill
extracted_at: '2026-09-07T07:13:36.161Z'
---

# Mobile horizontal-overflow probe (line-art gutter symptom)

## Symptom → cause

User report shape: "on my phone, after I open <view X>, I can see the
behind-the-site line art down the right quarter/third of the screen,
top to bottom." The wave line-art lives on the `html` element
(`template.html` ~:4274, layered `background: … var(--tile-art)`; ≤640px
`background-size: 100% 3000px, auto 320px, 100% 180px`) and in the
closing `.tile-band` (~:4321-4343) — see `auto-skill-auspol-tile-band`.
The art showing in a full-height right gutter means **the document is
wider than the viewport**: iOS Safari/Chrome shrink or pan to
`documentElement.scrollWidth`, revealing the background past the layout
edge. Don't look at the art — find the element that grew the document.

## Probe recipe (the two traps that cost a pass each)

Run from the repo root (needs its node_modules for puppeteer-core;
`.matilda/tmp-*.mjs` scripts are gitignored scratch by convention):

- Launch `headless: "new"` with
  `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`,
  `--no-sandbox`; viewport `{ width: 390, height: 844, isMobile: true,
  hasTouch: true, deviceScaleFactor: 2 }`; `waitUntil: "networkidle0"`.
- **Trap 1 — live innerWidth lies.** Measure `window.innerWidth` ONCE
  before opening the suspect view and compare every later reading against
  THAT captured constant. After the overflow happens, the initial
  containing block expands (390 → ~550), elements no longer exceed the
  live viewport, and a naive `r.right > innerWidth` scan reports
  `wide: []` on a page that is visibly broken. Symptom signature instead:
  `innerWidth`/`scrollWidth` JUMP between before/after opening the view
  (e.g. 390 → 551).
- **Trap 2 — key the element scan on absolute width.** After finding the
  width jump, scan `body *` for elements whose
  `getBoundingClientRect().width` exceeds the ORIGINAL viewport width
  (+1px). `element.scrollWidth > clientWidth` is a red herring here —
  scrollable ancestors are normal. Then walk parents to find which
  wrapper owns the culprit. (In the worked incident: only
  `table.flow-tab` and its thead/tbody/tr/caption, min-content ≈483–534px,
  parent `.flow-tab-wrap` which had `max-width: 640px` and NO overflow
  handling.)
- Click through UI states headlessly
  (`[...document.querySelectorAll("button")].find(b => b.textContent.trim()
  === "All polls" && b.offsetParent)?.click()`, then settle ~900ms) — the
  overflowing element is often mounted only after the view switch.
- Local verify: serve the REBUILT worktree
  (`python3 -m http.server 8765` in the worktree dir, probe
  `http://127.0.0.1:8765/index.html`) and re-probe at
  360/375/390/414/430. Expect scrollWidth ≤ viewport before AND after the
  click, and the wrapper now scrollable
  (`wrap.scrollWidth > wrap.clientWidth`). A ±2px rounding quirk at 360px
  present BEFORE the click is an emulation artefact, not the bug.

## Fix convention

Don't shrink fonts/padding or add min-width hacks to the table. Give the
WRAPPER site-precedent scroll containment: `.table-wrap { overflow-x:
auto }` (template.html:1883) and `.info-work-wrap` (~:2064) are the
pattern — keep the wrapper's existing `max-width`/`margin`, just add
`overflow-x: auto`. Check adjacent template comments first: the
archive-ledger wrapper MUST keep overflow visible (sticky-thead
containing-block rule documented in the comment after `.flow-tab-note`)
— the same CSS property is the fix on one wrapper and the bug on
another; `.flow-tab`'s thead isn't sticky so it's safe there.

## The worked fix (dc02e64, 2026-09-07)

`.flow-tab-wrap { margin: 18px 0 0; max-width: 640px; overflow-x: auto; }`
— one property, template.html:3979. Verified live at 390px (document
stays 390 after opening All polls; pre-fix it jumped to 551). Any new
wide ledger/chart-table added to the All-polls facet should get its
wrap's overflow behaviour decided at ship time — run the probe across
360/375/390/414/430 as part of the ship checklist.

## Transient overflow — the settle-state scan sees nothing (worked 2026-09-30, 460a75c)

Report shape: "switching to view X makes the page bounce a bit; sometimes
you see overflow on the right". The document grows past the viewport for
only 2–3 frames DURING the view switch, so every post-state probe
(`wide: []`, scrollWidth == viewport) passes while the bug is real.
Probe it in flight instead:

- Arm a per-rAF sampler BEFORE the click: `[t, scrollY, scrollX,
  documentElement.scrollWidth, innerWidth]` for ~2.6s after it
  (`.matilda/probe/snapshot-tab-overflow.mjs` — served repo root,
  clicks `.tabs .tab` by text).
- On the FIRST frame where scrollWidth > captured-original-innerWidth,
  record the wide elements IN FLIGHT (same absolute-rect scan as Trap 2)
  — they are unfindable one frame later.
- Correlate the overflow window with a per-frame log of the suspect
  component's geometry (`el.getBoundingClientRect().width`,
  `el.parentElement` width, a KEY child's inline `left`) — that is what
  pinned it: parent already 350 while children still held 760-era
  positions.

Cause class to suspect: a component mounts with a DESKTOP-default
measured-width state (RdLeadGauge's `useState(760)`) whose layout-effect
ResizeObserver fit corrects AFTER one painted frame on remount, and the
children's CSS `left`/`width` transitions then interpolate
default→real geometry — absolutely-positioned children don't size their
parent but DO extend `documentElement.scrollWidth`, so mid-interpolation
frames overshoot a phone viewport (dot right edge observed at 408 on a
390px viewport). Fix pattern (460a75c): an unmeasured sentinel
(`useState(0)`, render `width: w || "auto"` +
`visibility: w ? visible : hidden`) so the FIRST painted geometry is
already correct — never let a default-width frame paint when positions
are CSS-transitioned. See `auspol-rd-tpp-hero` for the gauge specifics.

## Load-time overflow flash — the per-rAF sampler during NAVIGATION (worked 2026-10-03, 4181886)

Report shape: "on page load/reload a chunk of the right side of the
screen flashes with the behind-area" (most visible on #allpolls). This
is a third transient class: the overflow happens DURING the load
sequence itself, so both post-state probes AND click-armed samplers
miss it. Recipe (`.matilda/probe-load-overflow.mjs`, scratch):

- Install the sampler with `page.evaluateOnNewDocument` (it must run
  BEFORE the page's own scripts): per-rAF record
  `[t, documentElement.scrollWidth, innerWidth, window.scrollX]`,
  accumulate `maxSW`/frames, and on every overflowing frame run the
  absolute-rect wide-element scan (Trap 2) — the wide elements only
  exist for those frames. `window.__stopRec()` to halt; read state after
  `waitUntil: "networkidle0"` + a settle sleep; also record final
  `body.className` and compare final scrollWidth vs innerWidth.
- Grid it: N desktop widths × every tab hash (pass hashes bare,
  `"#allpolls"`) + a few mobile-emulation rungs. "frames: 0 at every
  rung" is the ship gate. Note a real run can show overflow at only ONE
  width (the 1024px rung caught the 1605px flash) — a single width is
  not a sample.

**Three cause classes found, each fixed at its root:**

1. **Mount-time measurement against pre-boot-class DOM** — the load
   flash itself. A boot class (body.rd) was applied by a PARENT layout
   effect, and React runs child layout effects first, so a child's
   mount-time width measurement (RdHouseLean svg: 912px) ran against
   unstyled inline elements and grew the document to 1605px for 1–2
   frames. Fix: apply synchronously-derivable boot classes in the boot
   script BEFORE createRoot().render(). Full rule + safety checks in
   auto-skill-auspol-boot-window.
2. **visibility:hidden absolutely-positioned items still count toward
   scrollWidth.** The NextPollTicker's parked items (.tn-item.tn-park)
   are invisible but laid out; before the rAF first-fit pass the strip
   is at its label-only width, so a default-static parked pile overshot
   the right edge. Fix is one property: `right: 0` pins the park slot
   inside the bar. Remember the mirror: `.sh-tn-item.sh-tn-park` in
   `.build/site-shell.mjs` needs the same rule (re-render the 10
   satellites with `node .build/site-shell.mjs`).
3. **A persistent mid-width band neither phone nor desktop gates
   cover.** The All-polls 2PP tab-row control (.rd-pl-ctl) was gated
   only by `phone` (max-width 760), so at 761–~809px the tab row +
   control exceeded the document by ~40px on EVERY frame (220 frames —
   the sampler distinguishes persistent bands from flashes trivially).
   Fix mirrors the Latest table's 900px ctlrow handoff: a second
   `useNarrow("(max-width: 900px)")` keeps the control inline in the tab
   row ≥901px and mounts it on its own `.rd-ap-pctl` row ≤900px (the
   class is shared with house-lean's narrow strip and its rd.css rules
   are width-ungated, so it dresses itself at any width).

**Probe traps that cost turns this time:**

- `page.evaluate` returning an object that contains a DOM element
  resolves to `undefined` (not an error) — coerce to booleans INSIDE the
  evaluate (`inline: !!el`) before returning anything.
- The `.rd-ap-pctl` class is SHARED (house-lean's narrow strip at
  rd-allpolls.jsx ~:2788 has it too) — `querySelector(".rd-ap-pctl")`
  found the wrong component and made every failure look inverted.
  Disambiguate by a distinguishing child (`find(el =>
  el.querySelector(".rd-grow"))` for the table's row) or scope to a
  known ancestor section.
- Facet-walk probes must click the REAL tab label: the All-polls tabs
  are "2PP"/"Primary"/"Leadership", not "Two-party" — a no-match click
  silently did nothing and the "walk back" assertions failed on stale
  state.

Verification matrix at ship: zero overflow frames at 12 desktop widths
× {#allpolls, #now, #cycles, #info} + mobile emulation at
360/390/414/430, plus the interactive 850/1000px handoff probe through
a twopp→primary→twopp facet walk.

## Probe-authoring trap: the double-slash URL

Building the probe URL as `origin + "/" + "/#allpolls"` yields
`http://host:port//#allpolls` — path "//", which the naive static server
fails to read → 404 with no obvious signal, and
`waitForSelector(".site-head")` then times out, masquerading as a
cold-compile flake. Debug with a stripped-down mount check
(readyState/body class/tab list after a fixed sleep) before believing a
selector timeout; pass the hash bare (`"#allpolls"`) when concatenating.
This cost a full "cold compile" misdiagnosis before the real repro ran.
