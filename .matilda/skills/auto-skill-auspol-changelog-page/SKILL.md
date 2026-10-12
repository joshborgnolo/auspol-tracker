---
name: auspol-changelog-page
description: auspol-tracker — the change log subsystem end-to-end (gen-data §8d AUSPOL_SITE_REFRESH-gated writer → data/changelog.json → THREE consumers: Info-tab inline list, static-article newest-ten, the generated /changelog/ page shipped 2026-10-12 as ea284b5) and, through the page build, THE RECIPE for graduating an in-app feature to its own generated URL — FIVE homes that must move together: build.mjs federal-only emit block (5c, inside the `if (!VIC)` zone), site-shell.mjs SHELL_PAGES registration, git-push-main.sh SITE_FILES, sitemap.xml `<url>` entry, test-site-shell.mjs pins. Also the relative-link lesson: in-app copy links must be ROOT-absolute now that tab pages are real documents at path depth (href="feed.xml" 404'd from /info/ 2026-10-12); verifying links in BUILT docs means grepping the compiled JSX prop form `href: "/feed.xml"`, not the html attribute form.
source: auto-skill
extracted_at: '2026-10-12T05:05:36.344Z'
---

# auspol-tracker: the change log, and its standalone /changelog/ page

User request 2026-10-12: "Make the changelog a page like the RSS feed." Shipped as
`ea284b5` (page) beside `9022029` (the feed-link fix that surfaced the same day).

## The subsystem map (feature pre-existed as 53128f7, 2026-10-12)

- **Writer** — `.build/newtracker/gen-data.mjs` §8d (~:6274-6340): appends entries to
  `data/changelog.json` ONLY under `AUSPOL_SITE_REFRESH=1`, a var set by `refresh_site`
  in `.build/git-push-main.sh` — so real site refreshes log, local/test builds never
  touch the file. Entry shape: `{date, label, kind, text, url?}` (label is the display
  date "12 Oct 2026", date is ISO for `<time datetime>` and ordering).
- **Consumer 1 — the app**: `D.changelog` in the d1a1d215 asset Info tab (:7740),
  `!window.JUR`-gated (Vic never shows a change log). Intro paragraph `<b>Change log.</b>`
  links `/changelog/`; the `<ul class="info-changelog">` lists ALL entries
  (`[...D.changelog].reverse()` — the JSON is chronological, the display newest-first).
- **Consumer 2 — the static Info article**: `ssChangelogBlock()` in
  `.build/newtracker/build.mjs` (:683) — newest TEN entries; pointer sentence links
  `/changelog/` ("the change log page lists them all").
- **Consumer 3 — the standalone page**: `changelogPage()` in build.mjs (:691) + the
  "5c. changelog/index.html" emit block (~:1652) between feed writeAtomic (5b) and the
  robots block (renumbered 5c→5d, 2026-10-12). Reads data/changelog.json defensively
  (try/catch → `[]`, so a missing/corrupt file fails soft, never hard), renders every
  entry newest-first as `<li><time class="cl-date" datetime>…</time> text [release ↗]</li>`,
  all strings hesc'd.

## The /changelog/ page recipe — FIVE homes (reusable for any new generated page)

1. **Emitter** — build.mjs, INSIDE the `if (!VIC)` federal-only zone (the Vic pass
   exits before it — no Vic changelog page, and `shellDrift()` is in the same zone and
   skips missing files, so Vic builds never complain about a federal-only SHELL_PAGES
   entry; SHELL_PAGES carries no jurisdiction marker — prediction/index.html is the
   precedent bare entry). `fs.mkdirSync(path.join(path.dirname(OUT), "changelog"), {recursive: true})`
   then `writeAtomic(…, applyShell(changelogPage(), shellOptsFor("changelog/index.html")))`,
   plus a `built changelog/index.html · N entries` log line.
2. **Shell registration** — `{ file: "changelog/index.html" }` in `SHELL_PAGES` in
   `.build/site-shell.mjs` (+ update its header doc-comment that lists the generators
   which applyShell their own pages). After this, the existing `shellDrift()` empty-set
   gate in test-site-shell.mjs covers the new page for free.
3. **Commit list** — `changelog/index.html` in `SITE_FILES` in
   `.build/git-push-main.sh` (with the comment noting when it joined, matching the
   data/changelog.json comment already there). A quiet refresh writes byte-identical
   output, so unattended slots see a clean tree; without SITE_FILES membership every
   refresh commit would drop it.
4. **Sitemap** — `<url><loc>${SITE_URL}changelog/</loc><lastmod>${dataStamp}</lastmod></url>`
   in the build.mjs sitemap heredoc.
5. **Pins** — test-site-shell.mjs: title/canonical/h1 present; entries parsed via
   `/<time class="cl-date" datetime="([^"]+)">([^<]+)<\/time>/g` deep-equal
   `[...entries].reverse()` from data/changelog.json (date + hesc'd label — duplicate
   the tiny hesc in the test rather than importing); every entry's hesc'd text appears;
   SITE_FILES regex `(^|\s)changelog\/index\.html(\s|$)`; sitemap `<loc>` literal.

`changelogPage()` fonts: it read-icons the hashed font files itself —
`pageFont("crimsontext-400-latin.")` etc. greps `FONT_DIR` post-FONTS-sweep for
`startsWith(prefix) && endsWith(".woff2")` and emits `@font-face url("/assets/fonts/<hash>")`
with the shared `LATIN` unicode-range (FONT_DIR/LATIN/hash8 are build.mjs module-scope).
Its CSS is a light standalone block: `:root` tokens + ONE
`@media (prefers-color-scheme: dark)` token block — `applyShell` re-scopes those to
`:root:not(.sh-light)`/`.sh-dark` automatically, so ship the naive form.

## The feed-link 404 (9022029) — link-resolution invariant

"Clicking on the RSS feed link, it says page not found" (12 Oct 2026): the Info copy's
`href="feed.xml"` resolved against `/info/` once tab pages shipped as real documents
(2026-10-10). Exactly ONE relative instance existed in all of .build/newtracker
(swept GF-1 style before the fix); the template head's `<link rel="alternate">` was
always absolute, and Vic copy never mentioned RSS (though the shared Info copy links
the federal feed from Vic too — that's intended; Vic has no feed of its own).
RULE: every URL in in-app copy is ROOT-absolute (`/feed.xml`, `/changelog/`). The
regression pin lives in test-site-shell.mjs: for all SEVEN root documents (federal 4 +
vic 3) assert NO `/href[:=]\s*"feed\.xml"/` (matches both `href="…"` html and
`href: "…"` compiled-JSX relative forms) AND at least one `href: "/feed.xml"`.

**Grep trap**: JSX source `href="/feed.xml"` compiles to `href: "/feed.xml"` in the
hashed asset spliced into built docs — `grep -c 'href="/feed.xml"'` on built docs
returns head-link-only/zero even after a correct build. Grep the prop form.

## Verify + commit choreography

`node .build/newtracker/validate.mjs` (data untouched here, still run — clean
180 polls/0 errors), `npm test` (builds everything incl. changelog/; site-shell test
prints the new pins: "… changelog page N entries, feed links absolute"; ends with
test-vic-build building to a SCRATCH OUT). **npm test's Vic build does NOT touch the
working tree** — `npm run build:vic` separately or the three vic docs ship stale.
Then eyeball `changelog/index.html` on disk (exists ~12 KB, title `Change log –
auspol tracker`, h1, 1+ `cl-date`). Commit with pathspec staging only (sibling dirty
files: PRODUCT.md, `.matilda/*`, `.worktrees/` at the time) — `git add -- <files>` then
`git commit -m "…" -- <same files>`; 14 files in ea284b5 (5 .build sources + the
d1a1d215 asset + 7 root docs + sitemap + the NEW changelog/index.html). Push
`git push origin HEAD:main` after fetch-checking the race count.

Note for the emitter numbering: rss-feed skill's "5b. feed.xml" block now sits between
5a (tab pages) and 5c (changelog); robots became 5d.
