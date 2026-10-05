---
name: auspol-tab-id-url-hash
description: auspol-tracker — renaming a main-page TAB ID changes the site's URL hash scheme (/#<tab-id>) and has ~8 homes across 4 systems (73de0c58 TABS/readHash/nav, d1a1d215 goHero+IO guard, .build/site-shell.mjs lift contract, test-site-shell.mjs pin, then a rebuild + satellite re-bake). Worked 2026-10-03 for snapshot→now (commit 8a42db6, label rename fd6ff6e the same day). Keep the OLD hash as a readHash alias so links in the wild keep landing.
source: auto-skill
extracted_at: '2026-10-03T12:00:15.839Z'
---

# Renaming a main-page tab id (the URL hash scheme)

The main page's URL hash IS the tab id from `const TABS` in
`.build/newtracker/assets/73de0c58-*.js` — `{ id: "snapshot", label: "Now" }`
meant every deep-link was `/#snapshot`. Renaming the label is template/JSX
work; renaming the **id** is what this skill maps. Worked end-to-end
2026-10-03, commit `8a42db6` ("Now tab id renamed snapshot -> now…").

## The homes of a tab id

1. **73de0c58 asset** (tab system lives here):
   - `const TABS = [` — the `{ id: "…", label: … }` literal itself.
   - `readHash()` — hash → tab id funnel. **Add the legacy alias here** (see
     below), and note the default return names the first tab id too.
   - Nav spots that compare/set the id literally: `gotoNextPolls`
     (`readHash() === "<id>"`, `setTab("<id>")`, `location.hash = "<id>"`),
     `backFromPoll` / `backFromTerm` fallback `{ tab: "<id>", y: 0 }`, the
     view render gate `{tab === "<id>" && (<XView …>)}`. Find them with
     `grep -n '"<oldid>"'` on the asset — expect ~6 hits, all functional.
2. **d1a1d215 asset** (tabbed-views layer): `goHero` pair
   (`if (active !== "<id>") onChange("<id>"); else scrollTo top`) and the
   hero-presence IntersectionObserver effect guard — both compare `active`
   to the first tab's id.
3. **`.build/site-shell.mjs`** (lifts the main page's TABS into the 10
   satellite pages at apply time):
   - the TABS-lift fingerprint regex `id: "<id>", label:` (must match the
     new literal or the lift silently finds nothing),
   - the first-tab guard `tabs[0].id !== "<id>"` + its error string,
   - `const <FIRST>_LABEL = TABS.find((t) => t.id === "<id>").label;`
     (rename the const for readability; the `var snapLab` JS var name inside
     the emitted runtime can stay — cosmetic),
   - baked markup `<a class="sh-score" href="/#<id>" hidden …>`,
   - the runtime reconcile inside the emitted JS:
     `if (n.copy.tabs[sl].id === "<id>") …`.
4. **`.build/test-site-shell.mjs`** — pinned
   `assert.equal(chrome.tabs[0].id, "<id>", …)`.
5. **Generated artifacts** — rebuild the main page
   (`node .build/newtracker/build.mjs` → index.html + `assets/auspol-now.json`,
   whose `copy.tabs` is the runtime reconcile source), then re-apply the shell
   (`node .build/site-shell.mjs`) so all ten satellites' `.sh-tab`/`.sh-score`
   hrefs move to `/#<newid>`; `--check` must say "site shell current on all
   10 pages".

## Keep the old hash as an alias — don't rewrite it

In `readHash()`, above the default return:

```js
if (h === "<oldid>") return "<newid>";   // links shared under the old hash keep landing on it
return TAB_IDS.includes(h) ? h : "<newid>";
```

Return the new id but leave `location.hash` as typed (no redirect/rewrite):
shared links and bookmarks land on the right tab, and the only remaining
`<oldid>` string in the whole bundle is this alias — a one-grep proof the
rename is complete.

## Verification traps (all hit on 2026-10-03)

- **Babel formats the TABS literal with newlines**: built index.html has
  `const TABS = [{` then `id: "now"` on its own line. `grep 'id:"now"'`
  (no space) returns 0 even when correct — grep `id: "now"` with the space,
  or `awk` from `const TABS = \[`.
- **`grep -c` that finds zero exits 1** — a curl|grep chain reporting
  "Exit Code 1" can be the *desired* zero-match, not an error. Check the
  printed count.
- Don't pipe `npm test` through `tail` and trust the tail; confirm the exit
  code separately (`npm test > /tmp/log; echo $?`).
- Sweep the satellites for stragglers:
  `grep -rl 'href="/#<oldid>"' archives/ atlas/ feedback/ prediction/ preference-flows/`
  must be empty.
- After push, live-provenance check origin:
  `curl -s https://raw.githubusercontent.com/<owner>/<repo>/main/index.html | grep -c 'id: "<newid>"'`
  (expect ×1) and old id ×0.
- First build after editing site-shell.mjs prints
  `site shell out of step on …` — expected; it means re-apply, not a failure.

## Sequencing in the shared repo

Don't rebuild while a sibling session's source edits sit uncommitted in the
tree (the torn-build trap — see auspol-torn-build-hotfix). On 2026-10-03 the
label-rename commit (`fd6ff6e`) landed first, then the clean rebuild for the
id rename was safe. Stage only owned paths; leave `.matilda/` dirt and other
sessions' probes out of the commit.
