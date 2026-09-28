---
name: auspol-text-transform-caps
description: auspol-tracker — every ALL-CAPS UI string ("THIS POLL · FIELDWORK …", "HOW IT COUNTS", "V ONE NATION", "LATEST POLL" etc.) is SENTENCE CASE IN SOURCE; the shouting comes from CSS text-transform: uppercase in rd.css. A sentence-case request is a CSS-only diff (never edit JSX/data), and the copy-as-image poll card follows automatically.
source: auto-skill
extracted_at: '2026-09-28T01:17:28.778Z'
---

# Uppercase UI strings live only in CSS text-transform

Worked 2026-09-28 (sentence-case pass on masthead labels + poll header line +
"How it counts" + matchup column heads; four rd.css rules).

## The one fact that shapes the fix

Every all-caps label on the redesign is **sentence case in JSX/source** and
uppercased purely by `text-transform: uppercase` in
`.build/newtracker/assets/rd.css`. A "make X sentence case" request is a
CSS-only diff: remove the transform, tighten letter-spacing. Never touch the
JSX, gen-data, or polls.json.

## String → rule map (rd.css, post-change line numbers)

- Masthead "Latest poll / This term / Next election" →
  `body.rd .rd-head-meta .meta-k` (~:349). JSX is in the 73de0c58 asset
  (~:417/429/435/455) as `<span className="meta-k">Latest poll</span>`; the
  phone compact line (:410) was already sentence case.
- Poll header band "This poll · Fieldwork … · n = … · Published by …" →
  `body.rd .rd-pld-h` (~:653, Latest tab, rd-polls.jsx:335) AND
  `body.rd .rd-apd-h` (~:1638, All-polls detail). The string is built once by
  `rdPollHead(p)` in rd-allpolls.jsx:116-125 and rendered through
  `<span className="rd-apd-h">{rdPollHead(p)}</span>` (:393) — TWO renderer
  CSS homes for one source string.
- "How it counts" → same `.rd-apd-h` rule (rd-allpolls.jsx:453).
- "v One Nation / v Coalition" column heads → `body.rd .rd-apd-th` (~:1650);
  heads defined at rd-allpolls.jsx:333/:336.

## Conventions chosen

- letter-spacing: caps rules used 0.04–0.06em; non-caps small labels use
  **0.02em** (matches `.meta-k` in template.html:761). Use 0.02em when
  de-uppercasing.
- `.rd-nocaps` (rd.css:1637) protects "n = 1,500 (eff. …)" from the parent
  transform. It becomes a no-op once the parent transform is removed — kept
  deliberately as documentation.
- Deliberately untouched in the pass (components the user didn't name):
  `.rd-pl-head` Latest-table column heads (:561), archive `.rd-ap-th` (:1506),
  `.rd-ap-cap` (:1531), `.rd-ap-sheetk` (:1785), plus :1026/:1275/:1327.

## Bonuses / gotchas

- **copy-poll.js inherits for free**: it reads computed `textTransform` per
  glyph when painting the PNG canvas, so removing the CSS transform also
  de-uppercases the copied poll-breakdown card. No copy-poll.js edit.
- Verify headlessly on the BUILT page: probe `getComputedStyle(el).textTransform`
  (expect "none") and textContent — see auspol-headless-geometry-verify.
  Helpers must be inlined inside `page.evaluate` (Node-scope functions are
  invisible there).
- The same string can be exercised by multiple tabs (Latest `.rd-pld-h` vs
  All-polls `.rd-apd-h`) — map each renderer class before editing so a fix
  isn't half-shipped.
