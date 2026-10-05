---
name: auspol-copy-line-fit-measure
description: auspol-tracker — answering "how wide would this copy string render / would it fit one line?" and testing a PROPOSED string against the phone shells BEFORE shipping (worked 2026-10-03, "tell me: how many pt wide would this be" on the issues-facet placeholder reword). Clone a live element's computed font onto an off-screen white-space:nowrap span to get the string's true px width, and compare per-viewport against the rendered lane width of a live card — never count characters.
source: auto-skill
extracted_at: '2026-10-03T08:31:44.230Z'
---

# Measuring a copy string's rendered width + per-shell fit

The question form: "how many pt wide would `<copy>` be if we made it
`<alternative copy>`?" — i.e. predict the wrap consequence of a wording
change without shipping it. Worked on the All-polls Issues-facet phone
card's dictated literal (2026-10-03): current "Issues unranked, but
performance on cost of living assessed" (measured 351.5px) vs proposed
"Issues unranked, but cost-of-living performance assessed" (337.9px —
the ~13.6px saving would flip the 390px shell from two lines to one:
the old literal overflows that 350px lane by just 1.5px).

## The probe

1. Load `file://<repo>/index.html#allpolls` headless (puppeteer-core +
   local Chrome), click through to the view that renders the target
   element (here: Issues-facet tab `.rd-ap-tabs button` labelled
   `Issues`), then **`await page.evaluate(() => document.fonts.ready)`**
   — measuring before the woff2 swap gives fallback-font widths, which
   are wrong by several px on strings this marginal.
2. Read the LIVE element's computed font: `getComputedStyle(ref)` on
   the real `.rd-ap-csub-sent` — copy `fontFamily / fontSize /
   fontWeight / fontStyle / letterSpacing` verbatim into a node:
   ```js
   const mk = (t) => { const s = document.createElement("span");
     s.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;`
       + `font-family:${cs.fontFamily};font-size:${cs.fontSize};`
       + `font-weight:${cs.fontWeight};font-style:${cs.fontStyle};letter-spacing:${cs.letterSpacing};`;
     s.textContent = t; document.body.appendChild(s);
     const w = s.getBoundingClientRect().width; s.remove(); return w; };
   ```
   `visibility:hidden` (not `display:none`, which has zero boxes);
   `white-space:nowrap` so the span's width IS the single-line width.
3. Measure the string(s) — old and proposed — at ONE viewport: text
   width doesn't depend on viewport. CSS px ≡ pt here, so report as pt.
4. FIT or WRAP per phone shell needs the LANE width per viewport:
   loop `page.setViewport({width: 360|390|402, height: 844})`, re-goto
   + re-drive the tab clicks (navigation resets state), and read
   `ref.getBoundingClientRect().width` on the live block-level sentence
   element. A block element's border-box width is exactly the lane the
   text wraps within.
5. Verdict per shell = `stringWidth <= laneWidth`. Report the table
   (viewport, lane, old, new, fits/wraps) — the interesting output is
   WHICH SHELLS flip, not just the numbers.

## Worked outcome (issues placeholder, 13px/400 csub line)

| Viewport | Lane  | Old 351.5 | New 337.9 |
|----------|-------|-----------|-----------|
| 360px    | 320px | wraps     | wraps     |
| 390px    | 350px | wraps (+1.5px) | fits |
| 402px (iPhone 17) | 361.8px | fits | fits |

## Traps

- CLONING instead of mk() (the shrink-wrap idiom: clone the live node
  into an offscreen host and measure the clone) hits a NEW gotcha when
  the live element is itself a container-query container —
  `container-type: inline-size` applies SIZE containment, which zeroes
  the clone's intrinsic dimensions and every measure returns 0px.
  Always strip it on the clone: `cl.style.containerType = "normal"`
  (alongside the usual `display:inline-block;white-space:nowrap`).
  Worked 2026-10-03 in `.matilda/probe-issmgmt-measure.mjs` when the
  `.rd-ap-csub-sent` sentence div became the `@container` host for the
  mgmt rung ladder.
- Inserting test copy into a CLONED multi-span ladder sentence: the
  first text node of the clone may belong to a HIDDEN future-rung span
  (e.g. the `-s` span's text contains "3rd", not "1st"), so a regex
  anchored on visible-sentence content (`/^(.*? )1st/`) silently
  misses. Append to the first text node's TRAILING WORD
  (`firstText.nodeValue.replace(/\S\s*$/, (m) => m + "ranked ")`) —
  independent of which rung span owns it.
- GUESSING from character counts is worthless — 60 chars vs 57 chars
  said "slightly shorter"; the measure said the 390px shell was
  overflowing by 1.5px and the reword flips exactly that shell.
- Don't re-measure the string per viewport (constant); only the lane
  changes. But DO re-drive the tab navigation after each `goto` — the
  SPA remounts.
- `document.fonts.ready` alone can race the tab remount; re-await it
  after driving the clicks, plus a few hundred ms settle.
- The sentence class matters: measure on the element that will carry
  the string, not a nearby one — the issues facet has same-DOM
  `.rd-ap-csub` (display:flex) vs `.rd-ap-csub-sent` (display:block
  override, rd.css :2286) siblings; the lane width comes from the
  block form.
