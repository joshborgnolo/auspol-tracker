---
name: auspol-party-colour-tokens
description: auspol-tracker — changing a party colour or adopting a party palette across the WHOLE site (worked 2026-11-06, adopting the map's poster-flat palette sitewide as 4bd2f713 — REVERTED the same day as 2de47b44 on a user call: the bright palette stays map-only and the main site keeps its muted family; the revert recipe is below). Traced homes: template.html is the ONLY token home (six regions), rd.css carries the ramp ladders + onp-deep, refresh-morgan-archive.mjs a standalone copy; everything else resolves var(--x) at runtime (gen-data PARTIES, inkOf's string transform). Satellites inherit via shellCopy→site-shell; the apply/re-stamp order and the contrast-derivation procedure are inside.
source: auto-skill
extracted_at: '2026-11-06T03:20:51.000Z'
---

# Party-colour tokens — every home, and the exact change flow

**Current state (2026-11-06 evening):** the main site runs its ORIGINAL
muted family (alp oklch(0.55 0.150 27), lnp oklch(0.50 0.095 250), grn
oklch(0.60 0.120 150), onp oklch(0.66 0.130 58)…); the map alone keeps the
poster-flat palette (T.party in .build/map/app/app-1-base.js). The
sitewide adoption described below (4bd2f713) was shipped, then REVERTED
as 2de47b44 a few hours later on a user call — do not assume site and map
share a palette when colour plans come up.

Worked 2026-11-06: took the map's 201cb659 palette (alp #f7310a, lnp
#014dff, grn #14ad4a/#22c35a, onp #ff8c00/#ff9500, ind #9b62d0/#b07ee0,
oth #9a9a9a/#7d7d7d, csa #00a9c4/#00c2e0) and made it the site's one
palette (commit 4bd2f713, 33 files — of which exactly THREE were real
sources). The machinery below is how ANY sitewide palette change lands
(and how it comes off again).

## Homes (edit ONLY these)

1. **`.build/newtracker/template.html`** — the sole token home, SIX regions:
   - light marks + light `--*-text` (inside `shell-copy:tokens` markers),
   - `--lean-alp/lnp/onp-bg` light tints (duplicated oklch triples at "/ 0.08-0.09" alpha — they do NOT derive from the marks; retint by hand),
   - dark marks + dark `--*-text` (inside `shell-copy:tokens-dark` markers),
   - dark `--lean-*-bg` ("/ 0.14" alpha) beside them.
   Find them with `grep -n -- "--alp: oklch" .build/newtracker/template.html`.
   `--cyc-fill: color-mix(in oklch, var(--alp) 50%, var(--lnp))` follows for free.
2. **`.build/newtracker/assets/rd.css`** — two `--ramp-{onp,grn,alp,lnp,oth}-{1..4}`
   ladder blocks: `body.rd` (light: pale→dark) and `body.rd.dark` (dim→bright),
   plus `--onp-deep` in both blocks (hue tracks the ONP mark). Ladders are for
   >2-series party charts via ONE consumer, `rdRamp(party,n,i)` (rd-panels.jsx
   ~:3494); recolour by keeping each rung's LIGHTNESS, moving hue to the new
   mark's hue, chroma to the new family (rung tapers: old shapes were
   ~{0.87,1,0.87,0.65} of peak chroma).
3. **`.build/refresh-morgan-archive.mjs`** (~:258) — a HAND-COPIED token block
   (`--alp`…`--onp`, light only) for the standalone Morgan archive page. The
   acnielsen/newspoll/galaxy/aeforecasts archive generators have NO copy —
   they're re-stamped by the shell below.

Everything else is runtime CSS-var resolution — no other homes, verified by
zeroing the old triples repo-wide:
- gen-data.mjs `PARTIES` (incl. LEADERS) emit `color: "var(--alp)"` — no change.
- `window.inkOf(c)` (sources for the ed2260de asset) is a pure string rewrite:
  `var(--X)` → `var(--X-text)` for the 11 party ids. The whole mark-vs-glyph
  split is the `--*` / `--*-text` token pair; glyphs always get `--*-text`.
- `--tint-*`/approval/confidence tokens are `color-mix(... var(--x) ...)` — follow.
- `--on-fill-*` (text inside party fills) are constants — deliberately left.
- Minor historical parties (dem/dlp/uap/jln) exist ONLY site-side (no map
  counterpart) — decide per request; today they stayed untouched.

## Value derivation (do not eyeball)

- Convert hex ↔ oklch triples with a scratch node script (sRGB→linear→OKLab)
  — the map's own `lch()`/lab2rgb in `.build/map/app/app-1-base.js` is the
  inverse reference implementation; oklch triples to 3dp match site style.
- Text tokens: same hue+chroma as the mark, L moved until ≥ 4.5:1 against the
  theme's `--surface` (light 0.992 / dark 0.252 rel-lum). Measured 2026-11-06:
  light alp .55, grn .52, onp .55, oth .55(neutral C0), ind .55, xnt .52, lnp
  aliases the mark (5.9:1). Dark: alp/lnp text .66, oth .64; the lifted rest
  alias. Record the measured ratios in the block comment (the file does that).
- Decision recorded (user, 2026-11-06): marks go VERBATIM from the map both
  themes — Coalition blue ~2.5:1 as a dark-mode mark is the accepted
  trade-off; lifted `--*-text` keeps figures legible.

## Rebuild + verify sequence (order matters)

1. `node .build/newtracker/build.mjs` — regenerates root + tab pages +
   satellite generated pages + `assets/site-shell.css` (build.mjs writes it
   from site-shell.mjs's shellCss(), token blocks verbatim from template).
2. `npm run build:vic` — vic pages embed the same tokens.
3. If map sources moved too: `node .build/map/assemble.mjs`.
4. `node .build/site-shell.mjs` — RE-STAMPS the shell into the 14 committed
   SHELL_PAGES (404, archives/*, atlas, prediction, model, map, feedback,
   provenance, lef-success). It also rewrites the shared `?v=` hashes
   (site-shell.css/js changed with the tokens), so map/index.html changes
   even when no map source moved. Finish with `node .build/site-shell.mjs
   --check` = "current on all 14 pages".
5. Grep-verify: zero hits for every old triple across committed
   html/css/js, excluding `.build`, `.matilda`, stale worktrees
   (`.claude/worktrees`, `worktrees-seifa-land`); confirm new triples in
   `index.html`, `vic/index.html`, `assets/site-shell.css`.
6. Gates: `node .build/newtracker/validate.mjs`, test-map-page,
   test-site-shell, full `npm test`.
7. Commit sources + regenerated artefacts together.

## Traps hit in the worked session

- After a TOKEN change, .build/map/index.html dirties purely from the
  site-shell `?v=` hash — expected; covered by step 4, and test-map-page must
  be run AFTER it (its expected bundle accounts for the shell).
- `.matilda/probe/` needs NO re-pin for palette swaps: probes assert var()
  NAMES (`var(--onp-text)`), never values. The only files carrying captured
  triples are orphan snapshots (`head-index-serving.html`, `tmp-old-index.html`) —
  nothing loads them.
- The archived `?design=old` view shares :root and silently takes the new
  palette (freeze rule 5 concerns copy/layout, not inherited tokens).

## Reverting a palette change (worked same session, 2de47b44)

`git revert <adoption>` is the WRONG tool here: the adoption commit carries
30+ regenerated pages, and sibling commits since may have legitimately
re-stamped some of the same files (94fff034's map work) — the revert diff
gets messy without adding any confidence. The clean reversal, proven this
session:

1. `git checkout <adoption>^ -- .build/newtracker/template.html
   .build/newtracker/assets/rd.css .build/refresh-morgan-archive.mjs`
   — restore ONLY the three real sources to pre-change state.
2. Regenerate everything from them: `node .build/newtracker/build.mjs`,
   `npm run build:vic`, `node .build/map/assemble.mjs` (if map sources also
   moved since), `node .build/site-shell.mjs` (+ `--check`).
3. Grep-verify both directions (old triples ≥1 in built index.html, new = 0;
   map files keep whatever later map commits added — re-assembling does NOT
   touch app/page.css / app-4-story.js, their work survives).
4. Gates (validate + test-map-page + test-site-shell + test-tab-pages),
   then the full `npm test` BEFORE pushing — a revert immediately redeploys.
5. Commit source-restores + regenerated pages in one commit naming the
   reverted adoption sha.
