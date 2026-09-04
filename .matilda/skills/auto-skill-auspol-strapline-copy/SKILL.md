---
name: auspol-strapline-copy
description: auspol-tracker — the site-descriptor strap-line ("auspol tracker is an unofficial aggregate of published federal opinion polling") has ELEVEN homes across THREE systems that must all move together — build pipeline ×2 (build.mjs static summary + 73de0c58 asset colophon), satellite GENERATORS ×3 (.build/refresh-{morgan,trove,galaxy}-archive.mjs), and satellite/hand pages ×6 (the five archives/* pages + feedback/index.html) — plus 2 compiled copies in built index.html. For generated satellites edit the generator AND the committed page in one commit (regenerating hits the network). Phrase is pure ASCII so plain grep verifies all copies, unlike curly-typography greps. Satellite copy (incl. <meta> descriptions) uses CURLY apostrophes — the user audits them. Learned 2026-09-04 (commit 3ee127f).
source: auto-skill
extracted_at: '2026-09-04T03:06:31.900Z'
---

# auspol-strapline-copy: the site-descriptor sentence's eleven homes

Learned 2026-09-04 ("…unofficial aggregate of published national polling" →
"…published federal opinion polling", shipped `3ee127f` on top of the sibling's
`7b0ec84`). MATILDA.md Rule 4 (copy moves together) applies at its largest yet:
this strap-line is a THIRD duplicated copy family next to the methodology pair
(user skill auspol-copy-two-homes) and the disclaimer pair
(auto-skill-auspol-disclaimer-copy) — and it is the only one whose footprint
leaves `.build/newtracker` and reaches the satellites.

Current wording everywhere: "an unofficial aggregate of published federal
opinion polling" — main-site frame "auspol tracker is an …polling."; satellite
frame "This is a satellite archive page of <a href="/">auspol tracker</a>, an
…polling. The live, interactive tracker carries…"; feedback page swaps
"satellite archive page" for "the feedback page".

## The eleven homes (all edited together or not at all)

**Build pipeline (2)** — rebuilt into index.html by `node .build/newtracker/build.mjs`:

1. `.build/newtracker/build.mjs` — `<p class="ss-note">auspol tracker is an …` in
   buildStaticSummary (~:455); template literal, entities not literals for curls.
2. `.build/newtracker/assets/73de0c58-\*.js` — `<p className="colo-lede">` inside
   `.colo-about` (~:1331 post-feedback-move; sibling of `.disclaimer`, which has
   its own two-homes skill). JSX text, literal curls.

**Satellite generators (3)** — the committed pages below are GENERATED from these,
so copy changes here protect future regenerations:

3. `.build/refresh-morgan-archive.mjs` (~:395)
4. `.build/refresh-trove-archive.mjs` (~:358)
5. `.build/refresh-galaxy-archive.mjs` (~:302)

**Committed pages (6)** — plain HTML, hand-editable (morgan/trove/galaxy are the
generators' output; newspoll/acnielsen/feedback are purely hand-maintained):

6. `archives/morgan/index.html` (~:2209)
7. `archives/trove/index.html` (~:9692)
8. `archives/galaxy/index.html` (~:563)
9. `archives/newspoll/index.html` (~:180)
10. `archives/acnielsen/index.html` (~:280)
11. `feedback/index.html` (~:251)

Plus **2 compiled copies** in committed `index.html` (one raw-HTML static
summary, one babel-compiled JS string) — never hand-edit, comes out of the
rebuild.

## Procedure

1. Edit all 11 files in one sweep. The phrase `unofficial aggregate of published
   …` is unique per file, so a minimal old_string works; same-file-edit
   sequencing rules apply if a file needs a second, unrelated edit.
2. **Generator↔page pairing (the satellite half):** do NOT regenerate the
   morgan/trove/galaxy pages for a copy change — refresh-morgan hits
   roymorgan.com, refresh-galaxy hits the Wayback CDX, refresh-trove rebuilds
   from harvest JSONLs. Edit the generator AND its committed page(s) with the
   same text in the same commit; the next real regeneration inherits the copy.
3. Rebuild in the isolated worktree (`.matilda/worktrees/…` — the main repo is
   shared/dirty), run validate, expect drift-free output.
4. Verify BUILT output: `grep -c "published federal opinion polling" index.html`
   must be exactly 2, and a repo-wide grep for the retired wording must be 0
   (exclude .git). The strap-line is **pure ASCII — no \uXXXX trap**, plain
   greps work even against the babel-compiled copy (contrast
   auspol-disclaimer-copy's line-wrap trap for phrases that straddle a source
   break: pick a phrase that sits on one source line in each home).
5. Commit footprint = the 11 sources/pages + built `index.html` (12 files for
   `3ee127f`). feed.xml/sitemap.xml/robots.txt rebuild byte-identical when
   nothing else moved. If you touched archives/* CONTENT (not just this
   sentence), also bump ARCHIVE_STAMP in build.mjs and keep sitemap.xml in
   sync — see auto-skill-auspol-satellite-page-branding (a pure strap-line word
   swap shipped without a bump; note if stricter lastmod hygiene is wanted).
6. Shared repo: expect the sibling session to have raced origin while you
   worked (`7b0ec84` landed mid-task) — fetch, rebase, rebuild to prove no
   drift, push `HEAD:main` from the detached worktree
   (auto-skill-shared-repo-session-race).

## Curly-apostrophe convention extends to satellite copy AND meta tags

The user's post-ship audit ("there's a non-curly apostrophe in the feedback
page") targeted a straight `pollster's` in visible copy **and the same-word
copies in `<meta name="description">` / `og:description`** — satellites and
their meta descriptions follow the site's curly-typography standard (’), code
comments do not. Satellite/feedback HTML is NOT babel-compiled, so curly
quotes grep directly with ’. When auditing a page don't stop at one fix:
feedback/index.html had 3 straight + 1 already-curly occurrence of the same
word ("pollster's" in meta description, og:description, ss-sub vs fb-thanks) —
`grep -o "own release"` style counts (`wc` the total a phrase appears vs its
curled form) expose stragglers.
