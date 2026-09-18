---
name: auspol-mobile-overflow-probe
description: "auspol-tracker — symptom: on a phone the page is pannable/right-draggable and the site's wave line-art shows top-to-bottom down the RIGHT gutter (worked 2026-09-07: the All-polls implied-flows table, fix dc02e64). Cause is ALWAYS a too-wide element widening the document (iOS shrinks initial-scale; the html-level art + .tile-band fill the growth). Diagnose with a puppeteer-core probe: viewport 390×844 isMobile, compare documentElement.scrollWidth against the ORIGINAL captured innerWidth (never live innerWidth — the ICB EXPANDS and self-consistently hides the bug), then a per-element max-rect-width scan to name the culprit. Fix precedent: wrap it like .table-wrap { overflow-x: auto } (template.html:1883) / .info-work-wrap — keep the wrapper's max-width, don't touch the table. Verify with python3 -m http.server + re-probe at 360/375/390/414/430."
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
