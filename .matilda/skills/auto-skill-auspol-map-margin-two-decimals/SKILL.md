---
name: auspol-map-margin-two-decimals
description: "/map/ seat margins: margin = winPct − 50 (HALF the two-finalist vote gap in points — Bradfield '25's 26-vote gap is 0.01 pt, not 0.02), and the margin list widens decimals until a hairline shows (1dp → 2dp → 3dp) with the raw '(N votes)' beside every figure (shipped c24a6c2e + a534cd35, 2026-11-06). The head is now the Most marginal ↔ Safest TOGGLE pair (up/down-arrow icon, 4299ff27, 2026-11-08) — 'Closest seats' no longer renders. Read this before probing, copy-checking or changing any /map/ margin display."
source: auto-skill
extracted_at: '2026-11-06T05:48:12.223Z'
updated_at: '2026-11-08'
---

# /map/ margin semantics + the Closest-seats decimal ladder

## Where margins are derived

`deriveDiv` in `.build/map/app/app-1-base.js` (~:866-925, frame loader):

```js
const [[ia, va], [ib, vb]] = d.tcp;        // the two finalists' vote totals
const winPct = (100 * Math.max(va, vb)) / (va + vb);
// ...
margin: winPct - 50, votesMargin: Math.abs(va - vb)
```

So **margin = winner's share past 50, i.e. half the vote gap between the two
finalists**, not the gap itself. Worked number (core-2025.json, committed data):
Bradfield tcp `[[6,56114],[5,56088]]` → gap 26 votes, total 112202 →
margin = 26/2/112202 × 100 = **0.0116 points**. Computing
`gap/total×100` gives 0.023 — exactly double. (I wrote a probe expecting
"0.02" off that gap arithmetic; the correct rendered figure is "0.01".)
`votesMargin` is the raw ballot gap; `margin` is the pendulum figure.

## The display rules (user calls 2026-11-06)

The story column's Closest-seats list (`storyArea` in
`.build/map/app/app-4-story.js`) formats rows via TWO local helpers:

```js
// a hairline margin (Bradfield '25, 26 votes) vanishes at one decimal — show
// two, or three if two would still print zeros (the f1 check keeps null/NaN "–" safe)
const closeFmt = (v) => (f1(v) === "0.0" ? (v.toFixed(2) === "0.00" ? v.toFixed(3) : v.toFixed(2)) : f1(v));
const closeRow = (v, d) => `${closeFmt(v)} <small>(${int(d.votesMargin)} vote${d.votesMargin === 1 ? "" : "s"})</small>`;
// the 4299ff27 head emits "Most marginal" or "Safest" off module closeSafe,
// riding SORT order: filter → sort(±margin) → slice(6) → rows below
const close = idx.map((i) => m.divs[i]).filter((d) => !d.by)
  .sort((a, b) => closeSafe ? b.margin - a.margin : a.margin - b.margin)
  .slice(0, 6).map((d) => ({ i: d.i, v: d.margin }));
h += `… linkRows(m, close, closeRow, (i) => colCss(m.divCol[i])) …`;
```

(The two locals are mode-agnostic — Safest mode flips the sort before the
slice, not the formatting; the !d.by by-election exclusion applies to both
reads. The head-toggle machinery itself — state, click wiring, the absolute
icon-button CSS and probe geometry assertions — lives in
`auspol-map-sec-head-toggle`.)

1. **Decimal ladder**: one decimal, but if that prints "0.0" show two
   (Bradfield → 0.01); if two would print "0.00" show three (0.0049 →
   0.005). Ladder stops at three — 0.0004 still prints "0.000"
   (user-specced floor). Guard on the STRING (`f1(v) === "0.0"`,
   `v.toFixed(2) === "0.00"`), never a numeric comparison:
   `null < 0.05` coerces and `.toFixed` would throw; `f1(null)` is "–"
   and passes through unchanged. Unit-check reproduced against the
   shipped helper: 0.01158→0.01, 0.049→0.05, 0.0049→0.005, 0.1→0.1,
   null/NaN/undefined→"–".
2. **Vote-count companion** (a534cd35): every row's figure is followed
   by a muted `<small>(26 votes)</small>` built from `votesMargin`,
   grouped via `int()` (`toLocaleString("en-AU")` → "1,532 votes"),
   singular "vote" handled. The `<small>` rides INSIDE the row's `<b>`
   (linkRows injects `fmt`'s result raw into the template); its style
   is one rule in `.build/map/app/page.css` beside the `.links button b`
   cell — `.links button b small { font-size: 11px; font-weight: 400;
   color: var(--ink-3); margin-left: 4px; white-space: nowrap; }` —
   which will restyle a `<small>` printed by any OTHER linkRows fmt too
   (today every other fmt is a plain `f1` string, so nothing collides).

## Verifying a margin render headlessly

`node .matilda/probe/map-closest-margins.mjs <baseUrl>` — the committed pin.
Re-pinned a534cd35 for the figure+votes markup (the figure is `<b>`'s FIRST
child text node, `b small` carries the votes parenthesis), and re-pinned again
4299ff27 for the toggle: it now finds the head by `/^Most marginal/` (NOT
"Closest seats" — that label is gone), then clicks
`#story [data-close-toggle]` to assert the Safest round-trip — rows still
six with votes parentheses, margins running wide→narrow, up-vs-down arrow
`stroke` attributes swapping, the button right-flush in and centred on the
head's text line. Pattern, after `map-zoom-residual.mjs`:
serve the repo/worktree root (`python3 -m http.server -b 127.0.0.1 <port>`),
puppeteer-core with the hardcoded Chrome path
(`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`), goto
`/map/#y=2025`, wait ~1.5s, find `#story .st-sec h3` whose text matches the
mode head, read `.links button .nm` / `.links button b`.
The probe is keyed to live data — Bradfield's 0.01 breaks it if the
division's figures are re-filed; recompute `winPct − 50` from the new tcp.

Three session-established flakiness notes:
- Closing a python http.server and rebinding the same port immediately can
  fail silently (fresh "server" never comes up; first navigate dies
  `Failed to fetch`). Use a fresh port and `curl -sf` the index before
  launching the probe browser.
- Starting the server with `python3 -m http.server … &` INSIDE a shell
  command that then exits kills the server with its parent's process group —
  the probe died `ERR_CONNECTION_REFUSED` (2026-11-08). Launch the server as
  its own detached/background task and let it own the terminal.
- A headless boot of /map/ logged a first-attempt `Failed to fetch`
  pageerror TWICE (warm-block `go` fetch racing a freshly started server —
  its log then shows every local fetch at 200); it cleared on a straight
  re-run with no code change. Re-run before suspecting your change.
- The probe must read the figure from `<b>`'s first child text node, not
  `b.textContent`, now that the votes `<small>` rides inside it.

## Shipping a /map/ display change (two sibling lands mid-flight this session)

Per the worktree skills: the main checkout is routinely dirty with sibling
WIP (this session: an Others-breakout lane sat mid-edit in app-4-story.js
itself). Fetch FIRST (`git fetch origin main`) — a sibling landed 6f891883
between my check of one turn and the next worktree add — then take the fix
to a detached worktree (`git worktree add .worktrees/<name> --detach origin/main`), edit, then
`node .build/map/assemble.mjs`. The assembler also restamps
`map/index.html`'s `?v=` hashes whenever the bundle bytes change — commit
`map/index.html` and `map/map.css` alongside `map/map.js` only when the
assembler says it changed them. Regression suite for a story-column change:
`test-map-page.mjs`, `test-map-areas.mjs`, `test-map-draw.mjs`,
`test-map-urban.mjs`, `test-map-history.mjs`, PLUS whatever the in-flight
sibling lane updated (their `test-map-primary-breakdowns.mjs` this session,
to prove the merged build still honours their feature). Commit,
`git fetch origin main` + `git merge-base --is-ancestor origin/main HEAD`,
`git push origin HEAD:main`, then `git worktree remove`.

**Rebase-race recipe (ran twice inside one push attempt)**: sibling lands
arrive mid-verification (7b3a1080 the Others breakout, bc1dcddd polling-place
ids), so the ancestor check fails. `git rebase origin/main` — different
regions of the same app sources auto-merge; the ONLY conflict both times
was `map/index.html`'s generated stamp lines (`map.css?v=…`, `map.js?v=…`,
plus the data-warm block when data files moved). Do NOT hand-merge stamp
lines: `git checkout --ours map/index.html` (takes the rebased base's
internally-consistent page), re-run `node .build/map/assemble.mjs` (prints
"map/map.js unchanged, map/map.css unchanged, map/index.html stamped
<fresh> <fresh>" — the auto-merged bundle already carries BOTH features
and it recomputes the true stamps), `git add map/index.html`
`GIT_EDITOR=true git rebase --continue`. Then grep the bundle for both
features' tokens (`grep -c closeRow map/map.js`, their `data-othx`/`othx`)
and re-run probe + both lanes' tests before the final fetch/push. Second
race brought data-hash churn (bc1dcddd re-filed core-/res-2007…2025): your
commit must NOT carry those json files — the rebase takes them clean.
A THIRD race same-session (37a5919f vote-bands, my Informal deletion beside
its vtScope lines) proved app-4-story.js ITSELF can conflict — resolve the
source hunk by hand keeping both intents (their feature, your deletion),
generated files still via checkout --ours + re-assemble (see
auspol-map-head-stat-rows for that variant, landed as 47dff715).

If you add a companion probe to the commit: write it in the MAIN checkout's
`.matilda/probe/` (that dir is gitignored by `.matilda/*` but probes there
are TRACKED by convention — `git ls-files .matilda/probe/` shows
menu-ledger.mjs, map-zoom-residual.mjs), copy it into the worktree,
`git add -f` it with the commit. Its untracked duplicate stays in the main
checkout under the ignore and neither shows in `git status` nor blocks a pull.
