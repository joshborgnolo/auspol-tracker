---
name: auspol-live-site-verify
description: auspol-tracker — "I can't see the change on the live site" after a confirmed push. Verify deployment state from the shell (CNAME → auspoltracker.com, git ls-tree origin/main vs raw.githubusercontent vs curl of the live page), then the GitHub Pages cache-control max-age=600 window means the user's browser is the stale layer — hard refresh. Learned 2026-09-03 (2004 cycle pill "missing" after a correct push).
source: auto-skill
extracted_at: '2026-09-03T01:30:00.000Z'
---

# auspol-live-site-verify: prove what's deployed before saying "it's cache"

Repo root = `/Users/joshuaborgnolo/auspol tracker`. Trigger: user reports a
pushed change missing from the live site. Learned 2026-09-03 when the 2004
Past-cycles pill was "invisible" immediately after pushing `d2fa826` — every
server-side check passed; the user's browser had the 10-minute-cache copy.

## Step 0 — rule out the other direction first

Defer to the user skill **stale-live-page-debug**: uncommitted/unpushed WIP
is the usual culprit. This skill is for AFTER `git log origin/main` confirms
the commit is pushed. Push proof: `git fetch origin main -q && git log
--oneline -3 main origin/main` — same hash on both lines.

## Step 1 — get the domain from CNAME; never guess it

`cat CNAME` → **auspoltracker.com**. Wasted-step lesson: guessing
auspoll.info returns *silent empty output with exit 0* from curl, which
momentarily looks like "the live site is broken". Two greps of nothing cost
a wrong hypothesis.

## Step 2 — the three-layer comparison (all from the shell, no browser)

1. **What SHOULD be live** (git-side):
   `git ls-tree origin/main --name-only assets/ | grep cycle-source` and
   `git show origin/main:index.html | grep -o "cycle-source\.[a-f0-9]*\.json" | sort -u` —
   the hashed JSON name in origin's tree must equal the one origin's
   index.html references (app JS is all inlined; root `assets/` holds only
   fonts + auspol-card + cycle-source — per auspol-build-pipeline).
2. **raw.githubusercontent.com** serves HEAD with no Pages cache —
   `curl -s https://raw.githubusercontent.com/joshborgnolo/auspol-tracker/main/index.html | grep ...`
   confirms the repo state a moment after push.
3. **The live page**: `curl -sL --max-time 20 https://auspoltracker.com/ | grep ...`
   (also `curl -sL .../assets/<hashed>.json | head -c 300` for the JSON).
   `curl -sIL https://auspoltracker.com/ | grep -iE "cache-control|age|etag|last-modified"`.

## Step 2.5 — server-side deploy lag: re-probe before concluding ANYTHING

Right after a push (measured 2026-09-03, cycle-source rollout) the live
site itself can still serve the PREVIOUS deploy to curl: new hashed asset
404s, old deleted asset 200s, root serves old HTML. This is GitHub Pages'
build/deploy window (~1-2 min), not browser cache and not a failed push —
`git ls-tree origin/main` already showed the new files. Correct move: sleep
~60 s and re-curl; the new asset flips to 200. Do NOT rebuild/re-push on
the strength of one immediate post-push probe. Only after the live curl
shows the new content does the browser-cache story (Step 3) apply to user
reports.

## Step 3 — the Pages cache window is the answer 9 times in 10

GitHub Pages serves (measured 2026-09-03): `cache-control: max-age=600`,
`expires` ≈ now+10 min, `last-modified` = deploy time, `age` = seconds since
deploy. Browsers keep index.html for up to 10 minutes, so a correct push
looks stale to the user for that window. If step 2's live curl shows the new
content, the fix is user-side: **hard refresh (Cmd+Shift+R)** or wait ≤10
min. `Cache-Control: no-cache` on curl doesn't matter — curl has no browser
cache; it always reflects the server's current object.

### Quote-matching: the user's exact words fingerprint the stale payload

When the user quotes literal UI strings, compare them against what the
PRE-change payload would render — an exact match proves they hold the old
index.html. Second instance 2026-09-03: after the oppSpl era-split shipped,
the user reported PM hover "2007 · Rudd" vs OPP hover "2007 · Nelson →
Turnbull → Abbott". Those exact strings are what the PRE-split payload
produces: PM already era-split (per-era label), OPP pooled with the
renderer falling back to the full `c.oppLead` chain. The live payload had
per-leader eras on BOTH charts (verified by grepping the curl for
`"oppEras"` + era names). Conclusion = cached page again, same
max-age=600 window — no code defect at all. Detailed fallback map lives in
auspol-past-cycles → "Splicing and eras".

Third instance 2026-09-03 (6869b37, poll-detail type ladder): user said "I
see no change after a couple mins". fingerprint grep `pd-sec-lead` showed
count 2 in local index.html, origin/main, raw.githubusercontent AND the
live page; headers `last-modified` = deploy time + `age: 1`. But the new
CSS rules sit ~2108 alongside much older detail rules, so a user looking AT
the served HTML can mistake the grow for "always been there" unless you
point them at the exact commit's rule. Write the "it IS deployed" answer
with the commit's own identifiers (rule name, prop name, commit hash), cite
`age: 1` as proof the deploy just landed, then the max-age=600 / Cmd+Shift+R
advice. Also warn the user the change may be intentionally subtle (a 14→16px
lead figure is easy to miss) — a correct deploy can still LOOK unchanged.

## Grep traps in the built index.html (minified)

- **CSS rules are safe grep anchors**: classes like `pd-sec-lead` pass
  through build.mjs as literal text, unquoted and unescaped — `grep -c
  "pd-sec-lead"` on local index.html / git show / raw / live curl are
  directly comparable counts. (JS strings and object keys are NOT — see
  below.)
- **Era data is NOT in cycle-source.<hash>.json** — that file is raw
  `{polls, approval}` from the historical archives only. Display objects
  with `netEras`/`oppEras` live in the inlined `D.cycles` inside index.html
  itself. Grep the HTML for `"oppEras"` (returns ~4 hits) or an era name;
  grepping the JSON and finding zero eras looks like "not deployed" and is a
  false alarm (burned a probe 2026-09-03). Same class of trap: the past-cycles
  skill's "Emitted JSON key names" note (keys are `oppnet`/`oppr`, lowercase).

- **Object keys are double-quoted**: `"year":2004`, so `grep 'year:2004'`
  matches NOTHING even when present — grep the quoted key `"year":2004` or,
  safer, a string value (`"2004-10-09"`).
- Non-ASCII in JS strings is babel-escaped (`’` → `’` apostrophes)
  — see user skill **auspol-built-html-verification**.
- **Anchor marker counts to origin, never the working tree** (2026-10-02,
  `wvGridH` deploy check): with sibling sessions rebuilding in the shared
  tree, YOUR local index.html can be dirty mid-rebuild and its `grep -c`
  unstable — a remembered "×13 in HEAD" vs the live page's ×2 looked like a
  mismatch until `git show origin/main:index.html | grep -c wvGridH` read
  ×2 exactly like the live curl. The comparison pair is ALWAYS
  `git show origin/main:index.html | grep -c <marker>` vs
  `curl -sL https://auspoltracker.com/ | grep -c <marker>`; equal counts =
  deployed regardless of what the dirty tree says.

## One anti-redherring check before concluding "cache"

Verify the served page actually CONTAINS the missing feature's data with the
quoted-value greps (e.g. the Past-cycles pills render from the inlined
CYCLE_DEFS Array — `"year":2004` present + the `cycle-source.<hash>.json`
reference current = data is there; it's cache, not code). Only then tell the
user to hard-refresh.

## Probing live BEHAVIOUR, not just bytes (2026-09-04 instance)

Fourth cache-window instance (events-off-the-ribbon fix, 5ae7d35): user
reported "can't see it" ~3 min after push. Every byte-level check passed at
once — `git ls-remote origin main` = the new sha, `last-modified` on the
live page = the commit's minute, `curl … | grep -c pastForward` = 2 in the
served HTML (handy invariant: an identifier introduced by the change usually
survives babel unminified, so `grep -c` on the served page is a direct
"is the new code deployed" test). But bytes deployed ≠ feature proveable to
a sceptical user, so the check went one level deeper: a headless-puppeteer
poke AT THE LIVE SITE (no local server — `page.goto("https://auspoltracker.com/")`)
performed the user's exact gesture and asserted the DOM outcome:

- open Past cycles, count `document.querySelectorAll(".evt-line").length` → 0 at rest
- click one past chip's `.cyc-main` → 18 event markers (2019)
- click a second chip → 0 again (gate holds both directions)

Interactive passes, so the answer was the standard max-age=600 +
Cmd+Shift+R one — plus spelling out the gesture ("tap a term's chip to
lift it"), because for interaction-gated features the user's "can't see
it" is just as often "didn't do the gesture" as a stale page. Probe kept
at `.matilda/cyc-evts-live-check.mjs`; the pattern (live URL + real click
+ element-count assert) generalises to any "is the interaction actually
live" question and takes under a minute to write.

## Declared ≠ exposed: the window.AUSPOL return list (2026-09-24 instance)

Fifth "can't see it" — and the first where the answer really was CODE, not
cache. Commit `157f35c` added two new data-bundle consts
(`directionHousesAll`, `favHouses`) and updated the panels to read
`D.directionHousesAll || D.directionHouses` / `houseList(D.favHouses)`.
Every check passed: build clean, validate green, both consts present
verbatim in the SERVED live HTML, headers `age: 1`. The user was told
"hard refresh" — and was right to push back.

The defect: gen-data.mjs exposes bundle consts to the page through an
EXPLICIT name-by-name shorthand `return { PARTIES, MONTHS, …, directionHouses,
directionPolls, … }` inside `window.AUSPOL = (function () {…})()`
(gen-data ~:3773). The new consts were never added to that list, so at
runtime `D.directionHousesAll` / `D.favHouses` were `undefined` — the
`|| D.directionHouses` fallback silently rendered the OLD active-only
list (exactly the "no change" the user reported) and the favourability
subtitle rendered no roster. Fix shipped `88aaf46` (both names added to
the return). Nothing catches this class: a declared-but-unreturned const
compiles and validates clean, and an `|| fallback` consumer masks the miss
perfectly.

**Rule pinned** — when byte-greps decide "is it deployed", the anchor must
sit at the WIRING boundary, not just anywhere in the payload. For a new
data-bundle const the checklist is:

1. const declaration present in the served HTML (necessary, NOT
   sufficient),
2. `<name>,` present inside the `return {…}` list of `window.AUSPOL`:
   `grep -A2 "directionHouses," index.html | grep directionHousesAll`
   (compare with the SAME grep on origin's index.html before concluding),
3. only then run the consumer/DOM-level assertions of the previous section.

Debug corollary: when the user says "it's not there" and every server
check passes, re-read the code path BEFORE writing the cache answer —
the max-age=600 / hard-refresh story had become a reflex, and it was flat
wrong here.

## Message ≠ diff: the commit never carried its own fix (2026-10-12 instance)

Sixth "can't see it" — the first where the push, the deploy AND the code
layout were all fine, but the change **was never in the commit**. User:
"fix is pushed (0c642e9, build b0812bb) — i can't see this in live". Every
check passed: origin/main == HEAD, live curl had `last-modified` at the
push minute, `age: 1`. The cache answer was NEVER plausible — but so was
blaming the build: `b0812bb` ("Build: …") had regenerated index.html.

The defect: `git show 0c642e9 --stat` → ONE file, and `git show 0c642e9`
→ a single hunk implementing an UNRELATED sibling change (the RdLgPrefs
All-regions default — fd8010e's own message admits it "rode in with
0c642e9's build off this tree"). The width-lock code the message described
("an invisible `{total} of {total} releases` twin") appeared NOWHERE —
not in the source rd-allpolls.jsx, not in rd.css, not in the built HTML.
The commit's message survived a **shared-tree session race** that its
payload did not: the committing session staged only the sibling hunk it
found in the tree; the described fix lived in another session's tree and
was never committed. The later commit 4305e72 re-landed it from scratch
using the message as the spec.

**Signature checklist — cheap to run, do it before any "cache" conclusion:**

1. `git show <sha> --stat` — does the commit's file list even cover the
   files the change would have to live in? (Here: source rd-*.jsx present
   yes, but the file's own diff showed a different change.)
2. grep the **source assets** for the identifiers the change must add
   (a grep of only the built HTML is not enough — see the grep traps; an
   identifier absent from SOURCE is absent everywhere).
3. If the commit message cites a pinning probe and the probe exists
   locally, **run it on HEAD** — decisive. `.matilda/probe/ap-pin-steady.mjs`
   (untracked; `.matilda/probe/` is gitignored — probes cited in commit
   messages as "the local probe" are gitrepo-external by design, `git add`
   on them errors and you never commit them) measured drift 28.9px at
   1024px — proof, not warming cache, that the fix was missing.
4. The repair is experience-shaped: re-implement from the commit's own
   message (it doubles as a written spec), revive the surviving probe as
   the acceptance gate, rebuild, re-probe, then **diff-audit the rebuilt
   index.html** (`git diff HEAD -- index.html | grep "^[+-]"`) for foreign
   WIP before staging explicit paths only (shared-repo-session-race rules
   apply all over again when remaking lost code in the same shared tree).

Jurisdiction corollary from the same repair: after the re-implemented fix
went green on the federal build, the /vic/ probe line STILL failed
(drift 33.2px, count widths 46.9→80) — `node .build/newtracker/build.mjs`
alone does NOT touch vic pages. `npm run build:vic` rebuilt them and the
"twin" then read `64 of 64 polls` (vic's no-Confidence-facet branch; the
federal twin says `releases`). Probes in `.matilda/probe/` take `SUB=vic/`
to re-verify the second jurisdiction — always probe both before telling
the user a shared-view fix is live.

## Convention flips are their own ladder (2026-10-24, SEIFA q1↔q5 instance)

Seventh "still broken" report — user: top fifth "still \"most
disadvantaged\"" right after the advantaged-first renumbering ace20ca5
landed. A flip has N independent label copies (stores, generators,
hardcoded renderer captions) to be missed individually, so BEFORE giving
the standard max-age=600 / hard-refresh answer run the per-lane audit in
`auspol-convention-flip-audit`: check origin head for sibling absorbs
(your pushed sha is rarely head an hour later), dump every store blob's
labels AND one figure-orientation read per lane, grep renderer caption
templates, then the decisive NEGATIVE test on the SERVED page
(`curl -s https://auspoltracker.com/` + contradiction regexes — old-word
counts must be zero; positive-marker counts alone are necessary-not-
sufficient since old and new strings coexist when exactly one lane was
missed). Worked instance: all layers clean → cache answer, with the
measured counts as evidence.
