---
name: auspol-torn-build-hotfix
description: auspol-tracker — user reports a view's error boundary ("This view hit an error and could not display. Try again") on the live site straight after a push, with a console ReferenceError for an identifier the emitted sources never define (worked 2026-09-29 hotfix 484daa5, mine; 2026-09-30 bcda719→fb824bf, the sibling's — see Variant) — that's a TORN build: index.html was rebuilt in the shared main worktree (or in push_main's rebase rung) while a sibling's half-written build-input WIP sat on disk, so the artifact mixes feature states. If the torn commit is not yours, first check whether a later local commit already self-heals — pushing that IS the fix. Reproduce headlessly against origin/main (probe serves `git show origin/main:index.html`, walks every facet), quantify the tear with static marker greps on the DEPLOYED artifact vs a clean HEAD rebuild, then hotfix: temp `git worktree add` at HEAD, clean rebuild there, commit the artifact ALONE through a private GIT_INDEX_FILE seeded from origin/main, push, re-probe origin, curl the live domain, force-remove the temp worktree. Never hotfix-rebuild in the dirty main tree even when that rebuild goes green — it would sweep the sibling's in-flight payload into prod. Closure once the sibling lands coherently — rebuild in place, zero drift on the generated files is the all-clear and nothing recommits; re-run the feature probe in the main tree for the first green run there.
source: auto-skill
extracted_at: '2026-09-29T06:13:29.299Z'
---

# Torn build: your committed index.html mixes HEAD sources with a sibling's half-written WIP

Worked 2026-09-29: hotfix commit **484daa5** replaced torn build **cc1a199**
(which itself contained the legitimate direction-bar separator fix) —
the deployed All-polls section rendered the view error boundary
("This view hit an error and could not display. The rest of the page is
unaffected. Try again") on ALL FIVE facets (`"" , ?f=t, ?f=p, ?f=l, ?f=d`)
with `ReferenceError: housesAll is not defined`.

## What a torn build is

`build.mjs` reads the **worktree**, not HEAD. In this repo several Matilda
sessions share one checkout; if you rebuild `index.html` while a sibling's
in-flight edit to a build INPUT (`gen-data.mjs`, `template.html`, any
`.build/newtracker/assets/*.jsx`) is half-written on disk, their
half-state is compiled into YOUR committed artifact. The signature is a
page whose pieces disagree with each other: here the app JS referenced
`housesAll`, which the embedded data layer (their unfinished §5i
issues-facet emit) never defined → runtime ReferenceError → the view's
error boundary renders. Nothing is wrong with the data or the page
sources at HEAD; only the generated artifact is self-inconsistent.

The committing session does NOT notice: the rebuild "succeeds", probes
focused on your own change (here the dir-facet probe) still pass because
your feature is intact, and the breakage is in a view you weren't
watching. See `shared-repo-session-race` for the sibling-side mechanics;
this skill is the *my-own-commit-shipped-the-torn-artifact* detection
and hotfix procedure.

## Symptom recognition

- User reports the exact boundary copy: "hit an error and could not
  display … Try again" in one section; the rest of the page works.
- Timing: straight after a push YOU made that included a rebuilt
  `index.html`, while `git status` in the shared tree showed sibling
  dirt in build-input files.
- Console: a ReferenceError for an identifier you never wrote — grep
  the shared tree for it; it belongs to the sibling's WIP feature
  (here `housesAll`, from their §5i issues-facet gen-data edit).

## Diagnosis procedure (probe pattern)

`.matilda/probe/allpolls-crash.mjs` (untracked, main tree) — serves a
tree's built page over a local HTTP server and facet-walks All-polls on
desktop, capturing pageerrors/console errors and testing
`document.body.innerText.includes("hit an error")`. Three target modes:

- `TARGET=worktree` (default) — the main worktree's current index.html.
- `TARGET=origin` — `execSync("git show origin/main:index.html")` into
  /tmp and serves that. **The deployed bytes, deterministically, without
  touching the live domain** — use this to reproduce a live report.
  Needs `{ maxBuffer: 64 * 1024 * 1024 }` on the execSync: Node's 1 MB
  default overflows on the ~2.6 MB index.html.
- `TARGET=hf` — serves a temp hotfix-worktree root (`HF_ROOT` env,
  default `/tmp/auspol-hf`) so a candidate fix artifact can be probed
  before it commits.

Triangulate with STATIC marker greps — the tear is quantifiable:

```bash
git show origin/main:index.html | grep -c housesAll   # torn: 2 (references, no definition)
git show origin/main:index.html | grep -c '"iss"'     # torn: 44 (sibling in-flight payload leaked)
grep -c housesAll /tmp/auspol-hf/index.html           # clean HEAD rebuild: 0
grep -c '"iss"'    /tmp/auspol-hf/index.html          # clean: 0
grep -c "rd-ap-dbar i.u" /tmp/auspol-hf/index.html    # your real feature survived the rebuild: 2
```

A **main-worktree rebuild going green proves nothing about the torn
deployed one**: the sibling's sources may have completed by then (their
worktree state rebuilt cleanly, `housesAll` × 3, no boundary) — but
shipping THAT artifact sweeps their in-flight `"iss"` payload and gen-data
edit into prod uncommitted. The torn-artifact fix must come from HEAD
sources only.

## Hotfix recipe (what shipped 484daa5)

1. **Temp worktree at the committed state** — sources are HEAD, immune
   to whatever the sibling does next:
   ```bash
   git worktree add /tmp/auspol-hf HEAD
   ln -s "$PWD/node_modules" /tmp/auspol-hf/node_modules
   ```
   (`ln -s data /tmp/auspol-hf/data` fails "File exists" — a worktree
   checkout already HAS `data/` from HEAD. Repeating the mistake as
   `ln -s data data/` creates a stray nested `data/data` symlink;
   harmless, untracked, /tmp-only.)
2. **Rebuild there**: `node /tmp/auspol-hf/.build/newtracker/build.mjs`
   (paths anchor to the script's own root; output lands in the temp
   tree). Grep the artifact for markers (step above) before probing.
3. **Probe the candidate artifact from the main tree** with TARGET=hf —
   do NOT copy probes into the temp worktree: bare `puppeteer-core`
   imports fail MODULE_NOT_FOUND from /tmp because ESM resolution walks
   up from the script's location. Exit-code hygiene: redirect to a log
   and `echo $?`; piping probe output through `tail` masks real exits.
4. **Commit the artifact ALONE through a private GIT_INDEX_FILE** — no
   main-worktree file is touched, the sibling's staging area is ignored,
   nothing foreign rides along:
   ```bash
   BLOB=$(git hash-object -w /tmp/auspol-hf/index.html)
   GIT_INDEX_FILE=.git/hfidx git read-tree origin/main
   GIT_INDEX_FILE=.git/hfidx git update-index --cacheinfo 100644 $BLOB index.html
   GIT_INDEX_FILE=.git/hfidx git commit -m "<torn-build explanation>"
   rm -f .git/hfidx
   ```
   `git commit` here creates the commit on the branch HEAD points to
   with HEAD as parent — correct because local HEAD == origin/main in
   this incident. If local HEAD has drifted from origin/main, either
   fast-forward local first or use plumbing (commit-tree + update-ref)
   so the parent is origin/main and no other local commits sneak in.
   Seeding the private index with `read-tree origin/main` (not HEAD)
   guarantees the committed tree is "deployed state + replaced
   artifact", with zero contribution from the dirty main worktree.
5. **Push, then verify on origin**: `TARGET=origin node .matilda/probe/allpolls-crash.mjs`
   → expect `NO BOUNDARY FIRED` on all facets.
6. **Verify the live domain** (GitHub Pages redeploy takes under a
   minute — wait ~45 s): `curl -s https://auspoltracker.com/ | grep -c
   housesAll` → 0, and your legitimate feature marker still present.
7. **Cleanup**: `git worktree remove /tmp/auspol-hf --force` (force:
   untracked node_modules symlink inside). Leave ` M index.html` in the
   MAIN worktree alone — it's the sibling's in-flight rebuild, their
   generated file to manage; do not checkout/reset it.

## Don'ts

- Don't debug the breakage by curling eyeballing the live domain —
  `git show origin/main:index.html` served headlessly reproduces the
  exact deployed bytes with console/pageerror capture.
- Don't "fix" the torn build by rebuilding in the dirty main tree and
  shipping that (see above — sweeps sibling WIP into prod).
- Don't chase probe failures that exist ONLY against
  sibling-contaminated main-tree sources (e.g. a facet-row selector
  timing out on their half-built feature) — not deployed, not your bug.
- Don't refresh/reset the shared index entries for the committed
  artifact path; the sibling's index state is theirs.

## Prevention

Before ANY rebuild whose index.html output you intend to commit in the
shared tree: `git status --porcelain` and grep for dirty build inputs
(`gen-data.mjs`, `template.html`, `.build/newtracker/assets/*`). Any not
yours ⇒ build isolated (temp worktree at HEAD, or the stash-hold pattern
in `shared-repo-session-race`) rather than in place — even when nobody
has reported drama yet. A torn build is silent until a view your probes
don't visit hits the production boundary.

## Variant (worked 2026-09-30): the SIBLING's commit is torn — fix = push their self-heal, no hotfix dance

Second live incident: user reported the Who-votes panel's **Place**
facet hitting the error boundary on the live site. Torn commit `bcda719`
was the *sibling's* (their National-direction margin chip: 2-line
rd-panels.jsx + regenerated index.html). `push_main`'s **rebase rung
rebuild** (refresh_site during the rebase) compiled their half-written
By-state election-rings WIP into the committed artifact → index.html
carried a free `pty` identifier (`const seI = se && !pm ?
T.order.indexOf(pty) : -1;`) → `ReferenceError: pty is not defined` on
Place click. Same class of bug, two simplifications differed:

- **It was a CODE tear, not code-vs-data**: the sibling's in-flight
  *source* edit (rd-panels.jsx) was compiled in, leaving an identifier
  referenced before its defining sibling edit was finished — no data
  payload involved. Detection is the same static-grep trick, but you
  grep for the identifier from the console error, and for the feature's
  other markers, to prove the artifact mixes feature states.
- **Provenance proof**: show the committed source files at the broken
  commit ALONE cannot produce the committed artifact — `git show
  bcda719:index.html` had `pty` free while `git show
  bcda719:.build/newtracker/assets/rd-panels.jsx` differed from what
  generated it. Committed-source/committed-artifact mismatch ⇒
  dirty-tree rebuild, full stop.
- **Repro before fix**: `git worktree add /tmp/auspol-origin origin/main`
  (detached), serve it headlessly, click the user's exact facet button
  (match `innerText.trim().toLowerCase() === "place"`), assert
  `body.innerText.includes("hit an error")` + capture the pageerror.
  Do NOT trust absorption of the user's screenshot alone — one headless
  click reproduces it deterministically.
- **Resolution was NOT the hotfix recipe**: by the time the diagnosis
  finished, the sibling had COMPLETED their feature as local commit
  `fb824bf` (pty properly scoped, index.html regenerated) — origin/main
  was still the torn bcda719. Run `npm test` on the completed commit
  (exit 0), headless-verify the user's exact click against the local
  checkout's built tree (boundary gone, errors empty), then **just
  `git push`**. The completed feature IS the hotfix; no temp worktree,
  no GIT_INDEX_FILE. Cleanup: `git worktree remove` the /tmp repro
  worktree, kill the probe server.

Lesson: before building the private-index hotfix, CHECK whether the
sibling already self-healed in a later local commit — diagnose on the
torn origin commit but fix on the completed one, and push that.
