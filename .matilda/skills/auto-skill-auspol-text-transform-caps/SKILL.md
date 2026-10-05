---
name: auspol-text-transform-caps
description: auspol-tracker — every ALL-CAPS UI string ("THIS POLL · FIELDWORK …", "HOW IT COUNTS", "V ONE NATION", "LATEST POLL", the glyph player's "THE TERM SO FAR · N OF N POLLS" etc.) is SENTENCE CASE IN SOURCE; the shouting comes from CSS text-transform: uppercase in rd.css (plus template.html's .gp-* glyph-player block). A sentence-case request is a CSS-only diff (never edit JSX/data), and the copy-as-image poll card follows automatically.
source: auto-skill
extracted_at: '2026-09-28T01:17:28.778Z'
---

# Uppercase UI strings live only in CSS text-transform

Worked 2026-09-28 (sentence-case pass on masthead labels + poll header line +
"How it counts" + matchup column heads; four rd.css rules).

## The one fact that shapes the fix

Every all-caps label on the redesign is **sentence case in JSX/source** and
uppercased purely by `text-transform: uppercase` in
`.build/newtracker/assets/rd.css` — with one exception: the glyph player's
strip (`.gp-eyebrow`/`.gp-count`s rules) lives in **template.html's `.gp-*`
block** (~:538-543), not rd.css, because the player overlay is plain CSS in
the template (JSX in `assets/wm-story.jsx`). A "make X sentence case" request
is a CSS-only diff: remove the transform, tighten letter-spacing. Never touch
the JSX, gen-data, or polls.json.

## String → rule map (rd.css, post-change line numbers)

- Masthead "Latest poll / This term / Next election" →
  `body.rd .rd-head-meta .meta-k` (~:349). JSX is in the 73de0c58 asset
  (~:417/429/435/455) as `<span className="meta-k">Latest poll</span>`; the
  phone compact line (:410) was already sentence case.
- Poll header band "Conducted on … from a sample of … , published by …" →
  `body.rd .rd-pld-h` (rd.css :739, Latest tab, rd-polls.jsx:335) AND
  `body.rd .rd-apd-h` (rd.css :1824, All-polls detail, rd-allpolls.jsx:454).
  The string is built once by `rdPollHead(p)` in rd-allpolls.jsx — TWO
  renderer CSS homes for one source string. **Letter-spacing REMOVED from
  both rules (and from `.rd-nocaps`, rd.css :1823) by 3e34bc1, 2026-09-29**
  — see the de-spaced note below; the heads now set at default spacing.
- "How it counts" → same `.rd-apd-h` rule (rd-allpolls.jsx:514); also
  de-spaced by 3e34bc1 (shared class — splitting it out would need a JSX
  modifier, which the user did not ask for).
- "v One Nation / v Coalition" column heads → `body.rd .rd-apd-th` (~:1650);
  heads defined at rd-allpolls.jsx:333/:336.

Once caps-laden, now de-capped (kept here so no one hunts for transforms
that no longer exist):

- Issues tally label, `body.rd .rd-is-tallab b` (rd.css) — REMOVED by
  355a6e2 (2026-09-28): the 12px caps+tracking eyebrow "Weighted by
  importance" became the plain 14px/600 sentence-case label
  "Issue-importance-weighted trust score" (user-requested).
- Issues scoreboard chip party names, `body.rd .rd-is-score i` (rd.css
  ~:1146) — REMOVED by 6ca8ea8 (2026-09-29): the user's "make these party
  names sentence case" was again a CSS-only ask — ISS_PARTY_CAP already
  stored "Labor"/"Coalition"/"One Nation", so the fix was deleting
  `letter-spacing: 0.04em; text-transform: uppercase` from the one rule
  (no letter-spacing at all after: the de-capped label is a chip part, not
  a meta label, so the 0.02em meta convention below didn't apply). Pinned
  by `.matilda/probe-issues-tally.mjs` asserting chip `text-transform: none`
  + the exact rendered texts.

De-SPACED (tracking removed after de-capping; do not re-add):

- Glyph player eyebrow "The term so far · Winding back · N of N polls"
  (7edab5b, 2026-10-04): template.html `.gp-eyebrow` lost
  `text-transform: uppercase` with tracking .14em→.02em, and the `.gp-count`
  figure span ("N of N polls") dropped its own .06em to inherit — the
  de-spaced-figure-span lesson below, and with no letter-spacing left on the
  span it now carries ONLY colour + tabular-nums. The mid-strip "Winding
  back" rwmark rode the shared parent rule and de-capped with it. User ask:
  "make eg this text in the glyph player sentence case … adjust the
  character spacing accordingly".

- Poll head sentence + its figures (3e34bc1, 2026-09-29): the rdPollHead
  "Conducted on … …" sentence kept `letter-spacing: 0.02em` on `.rd-pld-h`,
  `.rd-apd-h` AND the `.rd-nocaps` figure span as a leftover from the caps
  pass; the user's read: "leftover from when it was small caps … runs a
  little large" on a full sentence. Lesson: **0.02em is the convention for
  short meta LABELS; a full de-capped SENTENCE sets at default (no
  letter-spacing declaration at all)** — and a nowrap figure span inside
  such a sentence must drop its own tracking too, or the figures set wider
  than the words around them. Pinned by
  `.matilda/probe/head-letter-spacing.mjs`: expands the Latest row
  (`.rd-pl-row` click) and the first archive row (`.rd-ap-row` click —
  role=row divs, NOT tbody tr) and asserts computed `letter-spacing:
  normal` + the rendered text on both heads and How-it-counts.

## Conventions chosen

- letter-spacing: caps rules used 0.04–0.06em; non-caps small labels use
  **0.02em** (matches `.meta-k` in template.html:761). Use 0.02em when
  de-uppercasing a short LABEL — never on a full sentence or a component
  that isn't a tracking-styled meta tag at all (poll heads, tally label,
  chips above all take none).
- `.rd-nocaps` (rd.css :1823) protects "n = 1,500 (eff. …)" from the parent
  transform. Its `text-transform: none` is vestigial (NO ancestor
  uppercases) and its letter-spacing was dropped in 3e34bc1 — the rule now
  exists only for `white-space: nowrap`.
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
