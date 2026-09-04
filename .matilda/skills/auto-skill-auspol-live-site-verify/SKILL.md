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
