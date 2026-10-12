---
name: auspol-satellite-rd-body-assimilation
description: auspol-tracker — assimilating a satellite page's OWN <style> block (not the shell chrome) to the main site's current rd design idioms ("this page is hungover from design=old"). Worked 2026-10-11 on /preference-flows/. Diagnose which layer is stale first: the shared chrome rides the site shell (see auspol-satellite-page-branding) — check it's current BEFORE rewriting; the stale part is the page's own CSS mirroring the classic static-article idiom (680px centred column, serif 600w h1, hairline section rules, serif figure numerals). Recipe: <main class="frame-wrap"> → class="sh-frame" + inner 66ch column; port token ladder from rd.css/template.html (rd-hed 46px/700, rd-dek 18px/1.5 ink-2, rd-eyebrow 2px ink top rule, rd-title sans 22px/600, poll-table 13px/600 thead + tabular-nums, --radius:14px, sh-kicker 11px/700/0.1em); redesign numerals are SANS-face not serif; keep ALL colour in :root tokens so scopeDarkRules keeps working; 640px media rung. Verify: site-shell re-apply + --check + test-site-shell + page-specific tests, then a headless probe (fresh page per width, satellite's own .sh-tabs-set left edge as the frame reference — the main page's .rd-hed is NOT on initial render).
source: auto-skill
extracted_at: '2026-10-11T11:06:19.942Z'
---

# auspol-tracker: assimilating a satellite page's own <style> block to rd idioms

## When this applies

User reports a satellite page (/preference-flows/, /prediction/, the
/archives/* pages) "looks hungover from design=old" / "hasn't been updated".
BEFORE editing, diagnose WHICH layer is stale — two independent layers:

1. **Shared chrome** (masthead, tab bar, footer colophon, theme switch,
   tile band) — owned by `.build/site-shell.mjs` + `applyShell()`. Check
   the page is in `SHELL_PAGES` and its `?v=` stamp matches `SHELL_V()`.
   If it's current, the chrome needs NOTHING — see
   auspol-satellite-page-branding for that layer.
2. **The page's OWN `<style>` block** — this is what this skill handles.
   The 2026-10-01/02 shell reskin only moved the chrome; the satellite
   bodies kept their classic-era CSS. Tells: 680px centred `.frame-wrap`
   column, serif 600w 34px h1, hairline (`1px var(--line)`) section rules,
   serif-face figure numerals, `.info`-era paragraph measures.

Also check what's **NOT stale** before rewriting: on /preference-flows/
the fonts (Crimson Text + IBM Plex Sans, self-hosted) and the editorial
oklch palette already matched the live site — assimilation was frame +
type scale + components only, NOT a font/palette swap.

## The assimilation recipe (worked on /preference-flows/, 2026-10-11)

Structural moves, in order:

- **`<main>` swaps its frame class**: `class="frame-wrap"` →
  `class="sh-frame"`. `.sh-frame` IS the main page's `.page` box
  (`--sh-gutter`/`--sh-maxw` mirror rd's tokens, bumped by SHELL_V), so
  future frame changes propagate by construction — do NOT re-declare
  max-width/gutter on the page.
- **Inner reading column**: `main > * { max-width: 66ch }` — the main
  site's `.info` column idiom (template.html :2275), replacing the old
  680px fixed width.
- **Token ladder ported from the main site's sources of truth** (verify
  values at edit time — rd.css/template.html line numbers drift):
  - h1 ← `.rd-hed` (rd.css ~:118-145): serif 700, 46px/1.08/−0.01em,
    `text-wrap: pretty`; the ≤640px media gives 30px/1.1 + 14px
    margin-top. /preference-flows/ uses the SAME 46→30 ladder.
  - deck (`p.ss-sub`) ← `.rd-dek`: 18px/1.5 ink-2, ≤640px: 15px/1.4.
  - h2 ← `.rd-title` + `.rd-eyebrow`: sans 22px/600/−0.005em (phone
    19px), `border-top: 2px solid var(--ink); padding-top: 12px` —
    the 2px rule replaces the old hairline.
  - body p ← `.info-term`: 15px/1.62 ink-2, `text-wrap: pretty`.
  - kicker labels ← shell's `.sh-kicker` idiom applied to `.pred-fam`
    etc.: sans 11px/700/0.1em tracking uppercase — leave the class
    transform to CSS (`text-transform: uppercase`), sentence case in
    markup (see auspol-text-transform-caps).
  - tables ← `.poll-table` (template.html ~:2118): thead th 13px/600
    ink-3/.02em tracking, td/tabular-nums, tighter padding (6px 8px).
  - cards/callouts ← `--radius: 14px` (the redesign's radius token),
    `border: 1px solid var(--line)` instead of hairline-top idiom.
  - figure numerals ← `.rd-tpp-num`: the redesign's big numerals are
    **SANS-face** (`var(--sans)` 54px/1/−0.03em at page scale) — a
    satellite carrying serif-display numerals is the classic idiom
    showing through.
  - 640px media rung on the page laddering h1 46→30, h2 22→19, dek
    18→15, table cells 13.5→13 (mirror the rd.css 640px block).
- **Compat anchors keep working**: the page's old `#why`/`#estimator`/
  etc. URLs must still land. `main h2 > span[id] { display:block;
  height:0; scroll-margin-top:56px }` — the zero-height compat spans
  the content rewrite inserted get the 56px scroll-margin for the
  sticky tab bar (NOT 72px — that's the main-page `.tabs.sticky`
  clearance; the shell bar is 56px).
- **Dead-CSS sweep**: a sibling content rewrite may have dropped
  components whose CSS remains behind — `.pred-code` and all h3 rules
  on /preference-flows/ were dead after commit 6c19986. Delete the
  rules with the satellite's own tests
  (`.build/test-flow-splits.mjs` pins the retired machinery for that
  page) — never a bare grep-trust.
- **Colour lives in `:root` ONLY**: `applyShell`'s `scopeDarkRules()`
  hoists the page's `@media (prefers-color-scheme: dark)` blocks into
  `:root:not(.sh-light)` + emits `:root.sh-dark` copies at apply time.
  Selector-level dark rules (e.g. `.foo { color: }` inside a dark
  media block) would still hoist fine, but tokens only in `:root` is
  the established pattern and keeps the diff reviewable. colours:
  `--ink`, `--ink-2`, `--ink-3`, `--line`, `--bg` — never re-declare
  in the page.

## Verification ladder

1. `node .build/site-shell.mjs` — re-apply (regenerates the
   `<!--shell:…-->` regions + dark-token copies; the `?v=` link stamp
   bumps if SHELL_V moved).
2. `node .build/site-shell.mjs --check`,
   `node .build/test-site-shell.mjs`, and any page-specific pinning
   test (`.build/test-flow-splits.mjs` for /preference-flows/).
3. Headless geometry probe — `.matilda/probe/preflows-rd-geom.mjs` is
   the worked example; the load-bearing assertions:
   - `h1 left == .sh-tabs-set left` at every width (the frame
     contract). **Use the SATELLITE's own tab bar as the reference,
     NOT the main page's h1** — the main page's `.rd-hed` lives inside
     React tab views and does NOT exist on initial render, so a
     main↔satellite h1 comparison returns null (cost one failed probe
     iteration; see auspol-headless-geometry-verify).
   - `document.documentElement.scrollWidth <= innerWidth` at every
     width (no horizontal overflow).
   - h1/h2/table computed styles match the expected tokens
     (Crimson/700/46px→30px, sans 600 h2 with 2px top rule, 13px/600
     thead + tabular-nums td).
   - Force dark (`document.documentElement.classList.add("sh-dark")`
     + `page.emulateMediaFeatures([{name:"prefers-color-scheme",
     value:"dark"}])`) and re-assert alignment + token swap
     (e.g. `--ink` actually changes).
   - Fresh page + viewport per width (see the width-sweep trap in
     auspol-headless-geometry-verify — reusing a tab and resizing
     trips scroll-anchoring on long documents).
4. Serve the repo over HTTP (file:// breaks `/assets/` links) —
   `python3 -m http.server` answered `ERR_EMPTY_RESPONSE` under
   puppeteer's concurrent fetches for this page (single-threaded);
   `npx http-server -p <port> -s` (node) held. The probes' in-process
   `node:http` skeleton (auspol-headless-geometry-verify) avoids the
   question entirely for satellites whose assets are relative.

## Sibling sessions and the shared tree

The content rewrite of the SAME page landed the same day (commit
6c19986) from a sibling session — its CSS skeleton + component class
names survived verbatim, so the body-CSS edit didn't conflict. Read
`git log` on the page BEFORE starting and re-verify anchor strings
against the on-disk file before each `edit` call; a sibling's edits
can shift line numbers out from under your strings.
