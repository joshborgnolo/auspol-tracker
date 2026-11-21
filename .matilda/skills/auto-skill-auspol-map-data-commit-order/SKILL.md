---
name: auspol-map-data-commit-order
description: When adding a new map/data/*.json file, `npm test` dies at `map/map.js is current, its data stamps too` — git add the data file BEFORE re-assembling, and land data + map/map.js + map/index.html in the SAME commit. Also covers mid-session map.js drift under a shared checkout.
source: auto-skill
extracted_at: '2026-11-04T12:11:57.362Z'
---

# /map/ — adding a new data file without tripping the stamps pin

Worked 2026-11-04 while landing `map/data/senate-prefs-nsw{15,19,23}.json` (commit
83865492): the first commit landed data + builder + README but not freshly
assembled artefacts, and `test-map-page.mjs` immediately went red until amended.

## The machinery behind the assertion

`.build/test-map-page.mjs` (~:86) asserts byte-equality:

    R("map/map.js") === stampMeta(stampData(wrapper, dataStamps(ROOT)), metaFacts(ROOT))

where `dataStamps()` (`./.build/map/data-stamp.mjs` :19) enumerates the ledger
via **`git ls-files map/data/*.json`** (tracked files only — a `readdirSync`
fallback exists only when git itself errors). Consequences:

- A **new untracked** `map/data/foo.json` does NOT enter the hash ledger; the
  assembled bundle stays identical with or without it. So you can develop,
  assemble, and test happily with the file sitting untracked.
- The moment you `git add` (or commit) the file, the ledger changes — every
  previously assembled `map/map.js` is now stale, and the test fires until you
  re-run `node .build/map/assemble.mjs` **after staging**.

`assemble.mjs` also runs `writeCores(ROOT)` before stamping (regenerates
`core-*.json` from `res-*.json`); verified idempotent — two consecutive runs
leave identical bytes.

## The safe commit shape

1. Write/build the new data file(s) + their builder.
2. `git add` the data files FIRST.
3. `node .build/map/assemble.mjs` (this stamps the now-tracked files in).
4. Stage `map/map.js` + `map/index.html` together with the data + builder and
   commit as ONE commit. Committing the data without the fresh artefacts (or
   vice versa) leaves the committed tree red — CI and any clone reproduce the
   pin failure.

## Mid-session drift of the same assertion (shared checkout)

If the pin fires with a diff you never wrote (worked case: assembled bundle
showed `isNow()` while sources said `isNowY(S.year)`) — check whether a
sibling session is mid-refactor on this checkout before debugging your own
build: `git status --short`, `git log --oneline -5`, `stat -f "%Sm %N"` on
`.build/map/app/*.js`, and check `.matilda/worktrees/*`/`.claude/worktrees/*`
copies for the old text. Two traps that wasted time here:

- Byte-diffing **expected vs assembled** can land on a *different* occurrence
  of the same text (the 635 KB bundle has many `isNow`-family sites) — use a
  wide context window (`expected.slice(i-180, i+200)`), not ±40 bytes, before
  concluding a transform rewrote an identifier.
- `node .build/test-map-page.mjs | grep ... | head -16` kills the suite with
  SIGPIPE mid-run: node dies silently and the grep sees a misleading partial
  tail. Run the suite to a file (`> /tmp/x.log 2>&1; echo exit=$?`) before
  judging pass/fail; 124 `PASS:`-class lines = full green.

Also from this session: `test-worktree-sweep.mjs` and the launchd
`.build/worktree-sweep.sh` share `/tmp/auspol-agent-locks/worktree-sweep.lock`
(mkdir-held). A concurrent sweep (scheduled job or a sibling `npm test`) makes
the fixture's dry-run print `cannot take lock` instead of `dry run`, failing
`dry run says so` spuriously — litter is re-run, never a code fault.
