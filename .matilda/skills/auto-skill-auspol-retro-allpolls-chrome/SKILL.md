---
name: auspol-retro-allpolls-chrome
description: auspol-tracker — the retro pages' shared chrome (.build/retro/chrome.css, worn by the /map/ retro view and /allpolls/retro/), the :visited recolouring failure class (chrome links must declare their visited inks because a page's bare a:visited rules load later and outrank lone classes — worked 2026-11-09, commit 71fa45e3), and why :visited colours can never be probed headlessly.
source: auto-skill
extracted_at: '2026-11-08T22:09:17.793Z'
updated_at: '2026-11-09'
---

# The retro pair and their one chrome (auspol-tracker)

Two pages wear the old-system "retro" look:

- **/map/'s retro view** (toggled; `retro=1` hash) — built by
  `.build/map/app/app-8-retro.js`; its stylesheet is `map/map.css` =
  `.build/map/app/page.css` + **`.build/retro/chrome.css`** +
  `.build/map/app/retro.css`, concatenated by `node .build/map/assemble.mjs`
  (which also restamps `map/index.html`'s `?v=` hashes).
- **/allpolls/retro/** — a real generated document written by the FEDERAL
  build only (`build.mjs` "5a'" block imports `.build/retro/allpolls.mjs`;
  /vic/ has none). It INLINES chrome.css first, then its own
  `.build/retro/allpolls.css` — the page css always loads after the chrome.
  Data/behaviour: rows from the committed gen dataset via `allpolls.mjs`,
  rendered/filtered/sorted by `.build/retro/allpolls.client.js`.

Cross-links: the map's retro navbar opens the twin instead of the modern
page (`RT_TWIN` in app-8-retro.js), both share one localStorage Favorites
key, and links back carry `retro=1`.

Pins: `.build/test-retro-allpolls.mjs` asserts the committed page equals a
fresh render from the committed dataset AND that both consumers include
chrome.css verbatim; `.build/test-map-page.mjs` asserts map.css currency.
`.build/git-push-main.sh` SITE_FILES carries `allpolls/retro/index.html`.

## The :visited recolouring failure class (worked 2026-11-09, 71fa45e3)

Symptom: retro chrome anchors — the masthead's "auspol tracker" kicker
(`.rt-kicker`), the navbar's page links (`.rt-pages a`), a menu item —
render browser-default PURPLE instead of the chrome's own inks, ONLY on
links the reader has visited.

Mechanism: a retro page's own content-link era rules (`.build/retro/
allpolls.css`: `a { color: #0000ee } a:visited { color: #551a8b }`) load
AFTER the shared chrome. `a:visited` (element+pseudo-class, 0,1,1):

- OUTRANKS a lone-class chrome rule — `.rt-kicker { color: #ffd94a }`
  (0,1,0) lost to it;
- TIES an equal-specificity chrome rule — `.rt-pages a` (0,1,1) lost on
  source order;
- LOSES to two-class chrome rules — `.rt-nav .rt-ni` (0,2,0) was immune,
  which is why the navbar's own items never went purple: the specificity
  arithmetic itself explains which anchors show the bug.

Fix/contract: the SHARED chrome.css declares the visited inks of its own
anchors — `.rt-nav .rt-ni:visited, .rt-pages a:visited { color: #fff }`,
`.rt-kicker:visited { color: #ffd94a }`, `.rt-drop a:visited { color: #000 }`
— placed BEFORE the hover rules so hover still wins the
visited+hover tie. When adding any anchor to chrome.css, give it a
`:visited` colour in chrome.css, never in a page css; a retro page's own
content-link colours live in its own css and must never target chrome
anchors. (`auspol-content-link-colour` is the mirror invariant for the main
page's CONTENT links.)

## Verification: :visited is unobservable — pin statically

`.getComputedStyle()` deliberately hides visited styling (privacy), so NO
headless/DOM probe can ever see the purple or prove its absence. Pin by
static assertion on the source (the visited rules' presence in chrome.css —
see test-retro-allpolls.mjs), and NEGATIVE-CONTROL it: run the same include
checks against `git show HEAD:.build/retro/chrome.css` — they must FAIL on
the pre-fix source, or the pin binds nothing.

## Regen circuit when chrome.css (or any retro part) moves

1. Edit in a clean worktree off origin/main — the main checkout is shared
   and running `.build/map/assemble.mjs` against a dirty tree bakes foreign
   WIP app sources into `map/map.js` (see auspol-worktree-scratch-files).
   In a clean tree the assemble step prints `map/map.js unchanged`.
2. `node .build/map/assemble.mjs` → map/map.css + map/index.html restamp.
3. `node .build/newtracker/build.mjs` → rewrites allpolls/retro/index.html
   with the new chrome inlined.
4. `node .build/test-retro-allpolls.mjs` + `node .build/test-map-page.mjs`,
   then `npm test`; audit any swept asset deletions (see
   auspol-clean-artifact-commit) before `git push origin HEAD:main`.
