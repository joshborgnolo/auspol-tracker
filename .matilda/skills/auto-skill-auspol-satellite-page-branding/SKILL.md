---
name: auspol-satellite-page-branding
description: auspol-tracker — pages outside the main build (/preference-flows/, /prediction/, /atlas/, /feedback/, the /archives/* five; redirect stubs aside). CURRENT RECIPE (user request, 2026-09-24): every satellite carries the SITE SHELL from .build/site-shell.mjs – the EXACT main-page masthead (wordmark lockup shellCopy'd from template.html's brand CSS + a LIVE dial glyph swapped in by site-shell.js off /assets/auspol-now.json's dial spec, lockup linking /#story to open the DialStory overlay on the main page), the FOUR-VIEW tab bar (Snapshot/Past cycles/All polls/Info – the Archives link was REMOVED from both navbars), the colour-theme switch (shares localStorage auspol.tweaks with the main page), the live 2PP (auspol-now.json), the main colophon and tide band – written between <!--shell:…--> markers by node .build/site-shell.mjs and by every satellite generator (applyShell before write). build.mjs publishes assets/site-shell.css|js, auspol-now.json, masthead-dial.svg and tile-art(-dark).svg each build and warns on drift; npm test fails on it (test-site-shell.mjs). /prediction/ and /atlas/ carry the shell but must stay UNLINKED (user: 'they're not very good'). The 2026-09-03 no-masthead/no-glyph/.ss-back recipe below is SUPERSEDED. Still true: sitemap ARCHIVE_STAMP trap, the archives' own tab strip homes, favicon link, font hashes, curly apostrophes.
source: auto-skill
extracted_at: '2026-09-03T00:00:00.000Z'
---

# auspol-tracker: standalone satellite pages + brand reproduction

## CURRENT (2026-09-24): the site shell – every satellite joins the site

The user found the satellites "very separate, which makes the site seem less
well-executed", and asked for every suggestion made to fix it, except that
**/prediction/ and /atlas/ stay orphaned** ("they're not very good"): they carry
the shell, but no page, tab or footer links to them (pinned by
.build/test-site-shell.mjs, which also scans the built index.html). This
supersedes the 2026-09-03 "no masthead, no glyph" recipe further down.

**One module, `.build/site-shell.mjs`**, owns it all:
- `SHELL_PAGES` – the nine pages and their options (`page: "feedback" | "archives"`
  drops the colophon's self-reference). Adding a satellite = one entry here;
  `applyShell` inserts the markers itself. The tab bar is the SAME four views as
  the main page (Snapshot / Past cycles / All polls / Info, hrefs `/#<view>`);
  there is no Archives entry anywhere (user asked for it off BOTH navbars
  2026-09-24, and the archives are instead reachable from the footer colophon).
- `applyShell(html, opts)` – idempotent. Writes `<!--shell:head-->` (link to
  /assets/site-shell.css, the inline pre-paint theme script, and `:root.sh-dark`
  copies of the page's own dark rules), `<!--shell:header-->` (skip link,
  masthead, theme switch, tab bar, 2PP slot) and `<!--shell:footer-->` (colophon,
  tide band, /assets/site-shell.js). It also scopes the page's own
  `@media (prefers-color-scheme: dark)` rules to `:root:not(.sh-light)`, strips
  the retired `.ss-back` pill (markup, rules, comment) and the "This is a
  satellite … page of auspol tracker" notes (keeping any extra sentences, e.g.
  the atlas's AEC note), and ids the page's `<main>` for the skip link.
- `shellCss()` / `shellJs()` – published by build.mjs to assets/ every build
  (the updaters' stage_dataset commits assets/ whole), so styling or script
  changes reach every page with no page edit. Header/footer MARKUP changes need
  `node .build/site-shell.mjs` + committing the pages: build.mjs only WARNS on
  drift, because the build must never rewrite satellites (the updaters' commit
  lists name none of them – a rewritten page would leave the tree dirty).
- Generators call it before writing: refresh-prediction (daily in CI),
  refresh-morgan-archive, refresh-galaxy-archive, refresh-trove-archive. Their
  templates no longer contain the pill or the satellite note.

**Theme**: the main page stores `{theme, accent, …}` in localStorage
`auspol.tweaks`; the pre-paint script maps theme light|dark → `sh-light|sh-dark`
and accent cool → `sh-cool` on `<html>`. "auto" leaves each page's media queries
in charge. The header switch writes the same key (merging), so a choice made on
any page holds everywhere – verified both ways (.matilda/probe/shell-theme.mjs).

**The masthead is not a copy of the main page's lockup – it IS the lockup**
(user, 2026-09-24: "just duplicate it, or better still wire it to it so that it
is one and the same", extended to all satellites). Four wiring channels:
- **CSS** – `shellCopy(name)` in site-shell.mjs lifts the four regions between
  `/* shell-copy:<name> */ … /* /shell-copy */` markers in newtracker/
  template.html VERBATIM into site-shell.css (throws when markers go missing):
  tokens, tokens-dark, brand, dial. A brand-CSS change on the main page reaches
  every satellite with the next build, no page edit.
- **Dial** – build.mjs's buildFavicon() computes the glyph at MASTHEAD weights
  (r+2 bars, 3.4 stroke, needle 1.7 + tip r1.9, pivot r1.7 – NOT the favicon's
  2.4/4.6/3) and ships it twice: static `/assets/masthead-dial.svg` (the header
  markup's `<img class="wm-dial-img">` stand-in) and a `dial` spec in
  auspol-now.json (`{vp,cx,cy,arcL,arcR,right,leader,settle,max,nd,bars:[…]}`).
  site-shell.js fetches auspol-now.json, paints the `.sh-score` figure AND
  swaps the img for a live inline `svg.wm-dial` whose parts carry the
  extracted `wm-arc`/`wm-bar`/`wm-needle-g`/`wm-pivot` classes – so the
  shell-copy:dial CSS transitions replay the settle (bars dasharray
  settle→h, needle rotate 0→nd after a double-rAF, skipped under
  prefers-reduced-motion) and the parts take var() strokes, following the
  page's theme exactly as the main page's does.
- **Story link** – the lockup is `<a class="wm-glyph" href="/#story">`; the
  main page's Header (73de0c58 asset, after the `window.AP.openStatic` effect)
  eats hash `#story` on mount into openStory() and clears the hash, so the
  click does exactly what clicking the main masthead does.
- **Ink-width squaring** – the wordmark aligns auspol/tracker by MEASURED ink
  width: site-shell.js runs the same letter-spacing align on load +
  document.fonts.ready.

**Live 2PP**: build.mjs's favicon code already decides the masthead dial's
contest (rivalLead, implied basis); it returns it as `fav.score` and writes
/assets/auspol-now.json `{...fav.score, dial: fav.masthead.spec}` – the pinned
bar's own figure plus the dial spec above. The score paints with
`var(--alp)`/`var(--onp)`/`var(--lnp)` directly (the old sh- token aliases are
gone).

**Main page navbar**: NO Archives link in `.tabs-set` (removed 2026-09-24, user
request; the d1a1d215 Tabs JSX no longer carries it, the `.tab-link` CSS is
out of template.html). The Info glossary's implied-2PP and preference-flows
entries link /preference-flows/.

**Verify**: add `.matilda/probe/masthead-parity.mjs` to the probes below – it
asserts a satellite's lockup is byte-identical to the main page's (type,
ink-width squaring, one inline `svg.wm-dial` at 57px, per-part colours,
graduation heights, settled needle angle), no Archives link on EITHER navbar,
and /#story opening the `.dl-backdrop` overlay. Two probe traps: the main
page's React puts stroke-dasharray in the STYLE attribute (read
`el.style.strokeDasharray` first, and inline style serialises comma-separated
so normalise commas). The Newspoll archive's Infogram embed stalls the load
event past 30s – navigate with waitUntil "domcontentloaded".

**Labels**: small `sh-kicker` labels above three titles – Methods
(preference-flows), Forecast (prediction; also in refresh-prediction's template),
Atlas.

**Verify**: `node .build/site-shell.mjs --check`, `node .build/test-site-shell.mjs`,
and the probes in .matilda/probe/ (satellite-shots.mjs [OUT, W, DARK, PAGES],
shell-theme.mjs, shell-tabs-width.mjs, main-archives-tab.mjs,
masthead-parity.mjs). Serve the repo over HTTP (file:// breaks the /assets/
paths).

## HISTORY: the 2026-09-03 recipe (SUPERSEDED by the site shell above)

## Which pages are standalone (NOT the newtracker build)

- `archives/newspoll/index.html` — Infogram "Federal Newspoll Archive" embed, hand-maintained.
- `archives/acnielsen/index.html` — 1996–2012 self-hosted PDF list, hand-maintained.
- `archives/morgan/index.html` — **GENERATED FILE, do not hand-edit** (header comment says
  so): Roy Morgan's four morgan-poll table pages replicated verbatim. Rebuild with
  `node .build/refresh-morgan-archive.mjs` (offline: `--offline`, uses
  `.build/morgan-archive-src/` cache and leaves data/roymorgan/*.csv byte-identical when
  the cache is unchanged). See auto-skill-roymorgan-table-mirror.
- `atlas/index.html` — the Electoral Atlas (shipped 2026-09-05): hand-maintained page +
  a GENERATED data sibling `atlas/atlas-data.js` (rebuild with
  `node .build/refresh-atlas-data.mjs`; source CSVs in `atlas/data/`). Interactive
  (vanilla-JS SVG charts + sortable seat table) unlike the static archives, but follows
  the same satellite chrome: .tabs strip, Crimson/Plex fonts, oklch palette, .ss-back
  pill. See auto-skill-auspol-electoral-atlas for the data/renderer map and its CDP QA
  harness (.build/qa-atlas.js — serve over local HTTP, file:// 404s the /assets/ fonts).
- `feedback/index.html` — standalone report-an-error form (moved out of the main page's
  footer, `1394856`), hand-maintained. Posts to Formspree; `?msg=` URL prefill is the
  inbound deep link the archive-row "report" anchors target. Same static-article chrome
  (no tabs strip; 680px column; fb-* form CSS ported from template.html). Its trailing
  ss-note sentence is one of the strap-line's eleven homes — auto-skill-auspol-strapline-copy — and
  curly-apostrophe copy rules apply even to its <meta> descriptions (user-audited).
- `newspoll-archive/index.html` — **redirect stub only** (meta refresh + JS
  `location.replace`, hash-aware: `#acnielsen` → /archives/acnielsen/, everything else →
  /archives/newspoll/). Hand-maintained. Deliberately NOT in the sitemap.
- `archives/index.html` — **redirect stub only** (bde0afb): meta-refresh 0 + JS
  `location.replace("/archives/newspoll/")` + canonical to /archives/newspoll/. Deliberately
  minimal (palette tokens + favicon only). NOT in the sitemap. **Referenced from the main
  site**: the footer disclaimer's "Full archives here" link targets /archives.
- `auspol-polling.html` — older standalone page; **may still carry the RETIRED masthead
  recipe below** — it has not been re-assimilated. Check before copying anything from it.
- The five real archive pages (newspoll / acnielsen / morgan / galaxy / trove) share the
  same tabs strip; it is `<nav class="tabs">` of `<a class="tab">` links (no JS tabs).
  The strip lives in SIX homes that do NOT auto-sync: the two hand-maintained pages
  (newspoll, acnielsen), atlas/index.html (its active tab is "Atlas" — atlas is NOT
  linked from the archives' own strips; it was added one-way 2026-09-05), + the
  renderPage templates in `.build/refresh-morgan-archive.mjs`,
  `.build/refresh-galaxy-archive.mjs`, `.build/refresh-trove-archive.mjs`. Adding an
  archive tab means editing ALL of them. Lived example (fixed 2026-09-05): the Trove tab
  shipped to every home EXCEPT the morgan template — HEAD's generated morgan page had it
  (hand-synced) but the template didn't, so any offline regeneration silently dropped it
  and the template↔output diff only surfaced on the next unrelated rebuild.

## SITEMAP TRAP (d2fa826, b89d44e): archive routes are BUILD OUTPUT

`sitemap.xml` is regenerated by `.build/newtracker/build.mjs` on every rebuild. Hand-edits
get silently reverted. Archive routes live in build.mjs as a template with a pinned
`ARCHIVE_STAMP` lastmod ("the build can't know when hand-maintained pages changed").
**When you touch an archive page: edit the routes in build.mjs if adding a page, and bump
`ARCHIVE_STAMP`** — and keep the committed sitemap.xml in sync. dataStamp for `/` is
derived from poll data. (No bump needed when the stamp already equals today.)

## Current recipe: the /archives/ pages ARE the static article (2026-09-03, user correction)

First assimilation (96403eb) kept the vintage site masthead on the archive pages; the user
corrected: **"when i said assimilated i meant fully as possible: same font, no glyph, etc"**.
The static-article view (buildStaticSummary in build.mjs ~:344–460) opens with NO site
masthead at all — just an `<h1>` and a sub paragraph — so the archive pages now do the same:

- **NO `<header class="site-head">`, NO wordmark lockup, NO GlyphDial SVG, NO tagline, NO
  head-right meta-item.** Deleted wholesale (kept effort: `.tabs` is the top strip directly
  under `<body>`, the article column sits below).
- **Structure**: `<nav class="tabs">` (max-width matches the column; `margin:40px auto 0`),
  then `<main class="frame-wrap">` containing `<h1>{Archive} archive</h1>` +
  `<p class="ss-sub">… as at the latest aggregate (ALP 51.1 · Coalition 48.9, 31 August
  2026).</p>` (freshness tail mirrors the static summary's "as at" cue — figures come from
  the `9f09dca2` data asset), then content, then the `.ss-note` footer(s), then
  `<a class="ss-back" href="/">← Back to the interactive tracker</a>` before `</body>`.
- **h1**: var(--serif) = Crimson Text, 34px/600, letter-spacing −0.01em, `margin:0 0 6px`
  — the template.html `.static-summary h1` values (~:217–257).
- **ss-sub / ss-note — THE RENDERED-VALUE TRAP**: template.html declares `.ss-sub` at
  15px/1.55 and `.ss-note` at 12.5px ink-3, but on the live page `.static-summary p`
  (specificity 0,1,1) outranks both (0,1,0), so they actually render at **14.5px/1.6 ink-2**
  like every other paragraph. Copy the RENDERED values; each archive file carries a comment
  documenting this. The probe (below) is what caught it — 12 failures before the fix.
- **Fonts — only the two cuts the static article runs**: `crimsontext-400-latin.aac0df38`,
  `crimsontext-600-latin.94af2060` (h1/h2 weight 600), `ibmplexsans-latin.056e4e24`.
  Source Serif 4 and Source Sans 3 faces are NO LONGER referenced by /archives/*. Verify
  via the woff2 request log (fonts.check passes on synthetic fallback for known families).
  Absolute `/assets/fonts/…` paths (depth-2 pages can't use `../assets`).
- **body extras copied from the live body**: `font-feature-settings:"tnum" 1,"ss01" 1`,
  `-webkit-font-smoothing:antialiased`, `text-rendering:optimizeLegibility`,
  `line-height:1.45`.
- **680px article column** on newspoll/acnielsen (`.tabs` and `.frame-wrap` both 680px,
  padding `40px 28px calc(64px + env(safe-area-inset-bottom,0px)) 28px`). **Morgan keeps
  1200px** — verbatim data tables are unreadable at 680px — but takes everything else.
- **Serif section h2s** ("The archive" etc.): var(--serif) 20px/600,
  `margin:28px 0 8px; padding-top:14px; border-top:1px solid var(--line)` (Morgan:
  `.rm-sec h2` + `:first-of-type` un-bordering).
- **`.ss-back` pill**: the main site's CSS (fixed; right:18px; bottom:18px; z-index:300;
  10px 16px; 999px radius; oklch(0 0 0 / 0.16) shadow) as a plain `<a>` — no portal,
  no ss-view machinery on a static page.
- **`.ss-note` satellite footer**: "This is a satellite archive page of
  <a href="/">auspol tracker</a> …", rendered-value styling above, `margin-top:20px`.
- **Favicon (2026-09-05)**: `<link rel="icon" href="/assets/favicon.svg">`. build.mjs
  writes its live `buildFavicon()` masthead-glyph SVG (quarter arcs + graduation bars from
  the aggregated primaries + 2PP needle, oklch→rgb) to that STABLE unhashed path on every
  build — satellites link it, so their tab icon tracks the main site's glyph automatically.
  The pre-2026-09-05 topology was the lesson: every satellite carried its own frozen copy
  of the 2024-era bars data-URI (`viewBox='0 0 32 32'`, bg `%230b1d2c`, bars
  `%23d62828/%23b08d39/%23ec7a08`) while the main site regenerated its icon per build —
  never re-freeze a data-URI icon into a satellite. The link lives in all four generator
  templates (refresh-{morgan,galaxy,trove}-archive.mjs, refresh-prediction.mjs) and the
  hand-maintained pages. **feedback/index.html and auspol-polling.html STILL carry the old
  bars icon (deliberately untouched 2026-09-05, out of the user's scope)** — flag, don't
  silently propagate either way.

## RETIRED recipe (kept for reference — auspol-polling.html may still use it)

Pre-2026-09-03 the archives ran a reproduction of the live masthead: `.site-head` flex
header, Myriad→Source Sans 3 wordmark lockup (`.wm-name` 30px/800 + `.wm-track` 30px/400),
a precomputed static-SVG GlyphDial snapshot (`.wm-arc`/bars/needle around pivot 22,24.5),
a Crimson Text 15px tagline with forced `<br class="tagline-br">`, and a head-right
`.meta-item` ("Pollster archive" / back-link). That machinery is deleted from /archives/*;
do not resurrect it there. If auspol-polling.html still carries it, flag it to the user
rather than silently propagating either style.

## THE PALETTE TRAP (found by verification, bbccf60)

The live site renders in **`body.editorial` mode by default**, which overrides `--bg`:

- light editorial `--bg`: `oklch(0.975 0.009 80)`  ← NOT `:root`'s `oklch(0.970 0.008 78)`
- dark editorial `--bg`:  `oklch(0.205 0.010 65)`  ← NOT `body.dark`'s `oklch(0.215 0.010 65)`

Copying `:root`/`body.dark` values verbatim puts the satellite page on a visibly different
paper. Archive palettes define the EDITORIAL values in their own `@media
(prefers-color-scheme: dark) { :root {…} }` mirror (no site JS to toggle `.dark`).
Tokens carried: --bg/--ink/--ink-2/--ink-3/--ink-faint/--line/--line-2 (the `ink-2`/`line-2`
pair was ADDED for the chrome — old skeletons lack them). theme-color metas: `#faf6f0`
(light) / `#1a1612` (dark).

## Verification: .matilda/verify-archive-static/probe.mjs

The repo has no package.json; the probe imports puppeteer-core via
`createRequire(path.join(os.homedir(), "node_modules", "."))` and uses system Chrome
(`CHROME` env or `/Applications/Google Chrome.app/...`). It serves the repo on
127.0.0.1:8733 IN-PROCESS (an http server inside the probe, so no nohup dance), then for
EACH of light and dark (`page.emulateMediaFeatures`):

1. Loads `/` with no app JS and pins `document.body.classList.add("editorial"[,"dark"])` —
   that's the baseline oracle (the live page IS the ground truth, not template source CSS,
   per the rendered-value trap above).
2. Loads each archive page and compares computed styles: body background, h1 (family/size/
   weight/letter-spacing/margin/colour), ss-sub, ss-note, column max-width + paddings,
   .ss-back (fixed + 999px radius); asserts the page's `<link rel="icon">` href is
   `assets/favicon.svg`.
3. Checks the retired chrome is gone (`.site-head`, `.wm-dial`, `.wordmark` absent) and the
   server-side woff2 log shows crimsontext-600 served and NO sourceserif4/sourcesans3
   requests.

Expected output: `ALL CHECKS PASSED` (exit 0). Each page's column max-width is asserted
against its own PAGES entry (newspoll/acnielsen 680px, morgan 1200px, galaxy/trove 1080px,
all deliberate) — key ANY width exemption on `spec.maxw === "680px"`, NEVER on page name:
the original `spec.name !== "morgan"` exemption 4-FAILED the moment galaxy/trove shipped.
Only maxw-680 pages get the "aligns with live .static-summary" parity check; wide pages
skip it. Headless Chrome defaults to DARK — the dual-scheme loop is load-bearing.

## Self-hosted archival assets (04c5208 → f86d9b5)

Wayback permalinks are very stable but not guaranteed (Oct 2024 outage) — mirror files into
the repo: AC Nielsen PDFs live at `/data/acnielsen/ACNielsenPoll<year>.pdf` (1996–2012, no
2002 polls), the Morgan tables at `/data/roymorgan/*.csv`. When downloading Wayback captures
use the `id_` suffix (`…/web/20060627052718id_/http://…`) to get the raw original file, not
the Wayback-wrapper page; verify with `file` or a `%PDF-` first-bytes check. A lone
long-running curl batch can be interrupted — re-check the directory and refetch the
stragglers individually rather than re-running the lot.
