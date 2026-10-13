---
name: auspol-half-shipped-feature
description: auspol-tracker — a sibling-agent commit ships a feature's data+CSS+schema+probe but the JSX renderer never lands, so the feature is invisible while the commit message and the sibling's handoff report both claim it's live. Forensics (git show --stat asymmetry → git grep for the classes outside CSS → run the commit's own probe against HEAD) and recovery (the committed probe IS the executable spec; rebuild the minimal renderer to probe+CSS+gen-data shapes). Worked 2026-10-12, DemosAU MRP region chip + diamonds (0671daa → recovered in 3676baa).
source: auto-skill
extracted_at: '2026-10-12T10:22:19.749Z'
---

# auspol-half-shipped-feature: the renderer half of a commit never landed

Repo root = `/Users/joshuaborgnolo/auspol tracker`. Failure class hit
2026-10-12 (DemosAU MRP preference flows): commit `0671daa` carried the
promise "the opened poll's Preferences line cycles Inner metro → Outer
metro → Regional; One Nation voters' national flow as diamonds", and the
sibling session's handoff report to the user said it was verified live.
It wasn't. The user reported: clicking a DemosAU MRP row showed no
Preferences line at all.

## How this failure class forms (multi-session repo)

A long-running session develops CSS + gen-data emits + data + schema +
probe + **the JSX renderer** in its dirty worktree, verifies locally
(their probes pass — the worktree has everything), then commits. Git
greps only what was staged: the JSX edit was lost (session boundary,
compaction handoff, a path-stash that never got popped, or an `add`
list that named the other files but not the `.jsx`). The CSS rules,
data, probe and message survive; the code that creates the DOM
elements does not. No validator catches it: CSS with no emitter is
legal, schema additions are passive, and the probe file in
`.matilda/probe/` is not in npm test's committed set.

## Detection — three cheap checks, in order

Do these BEFORE believing a "feature X is live" handoff or a commit
message — and before blame-assigning user's "I can't see it" to cache
(auspol-live-site-verify remains for genuinely deployed bytes):

1. **`git show <commit> --stat` asymmetry.** The feature commit lists
   rd.css + gen-data.mjs + data/polls.json + polls.schema.json + the
   probe — but NO `.jsx` renderer file. (For `0671daa`: `rd.css | 20`,
   `gen-data.mjs | 18`, `polls.json | 117`, probe, schema — no
   `rd-allpolls.jsx`.)
2. **`git grep -c '<class>' HEAD -- .build/`** for each new CSS class in
   the diff (`.rd-ldg-cyc`, `.rd-ff-dm`). Hits ONLY in rd.css = the
   elements are styled but nothing creates them. Live verification:
   `curl -s https://auspoltracker.com/ | grep -c '<class>'` matches
   HEAD exactly (the CSS ships!), so byte-level "is it deployed"
   checks SAY YES and mislead. The count that matters is JSX-side.
   Beware `-- .build/` with stashes: `git grep -c tok 'stash@{0}'` with
   stderr hidden masquerades errors as zero matches — don't suppress
   stderr when grepping non-HEAD refs.
3. **Run the commit's own probe against HEAD.** The sibling ships its
   probe in `.matilda/probe/` — `node .matilda/probe/<name>.mjs` fails
   at the first missing element ("No element found for selector:
   .rd-ldg-cyc"). This is definitive: if the probe the feature
   claimed to be pinned by fails on the pushed tree, the feature
   isn't live, no matter what the report says. (The sibling's own
   prose gloat — "I checked the pushed build directly" — was written
   against their dirty worktree, not the pushed tree.)

## Recovery — the committed probe is the executable spec

Everything needed to re-derive the renderer sits committed:

- **Probe** (`.matilda/probe/mrp-prefs.mjs`): exact DOM contract —
  selectors (`.rd-ldg-cyc`, `.on` child, `.rd-ldg-lbody`), interaction
  order (Inner metro → Outer metro → Regional → wraps), the constants
  (exactly 3 `.rd-ff-dm`, one `.rd-ff-keydm`), even expected cell text
  per state (`L/NP 48` at Inner metro).
- **rd.css**: class anatomy — the chip's `.rd-ldg-cycw > span` grid
  stack (all names in one cell, only `.on` visible, so the chip never
  resizes), `.rd-ldg-cyca` arrow child, the styling constants.
- **gen-data.mjs**: the emit shape (`p.pf = polls.json.pref_flows`;
  `flowForced.demos = [{date, xm, win, n, onp}]` — `xm` the window's
  true-midpoint fractional month index, `win` its printed window).
- **data/polls.json**: the actual values the probe asserts.

Rebuild the smallest JSX that satisfies all four at once:

- **Hooks can't live in plain helper functions.** `rdLgLines()` is a
  module function returning line descriptors — the stateful chip went
  in a module-scope `<RdLgPrefs>` component with its own `useState`,
  called from the helper as `<RdLgPrefs pf={p.pf}/>`. Units can still
  be plain function calls (`{U(text)}`), not components, so they don't
  remount on state change.
- **The state-swapping trap**: probe asserts line+chip bounding boxes
  are IDENTICAL across presses — every state renders the same unit
  labels and all values are two-digit, so the body wraps identically;
  only the chip's width protection (the grid stack) needs building.
- **stopPropagation on the chip's click**: it sits inside a
  press-to-navigate ledger line.
- Check the class lists for OTHER orphaned CSS (`git grep '<cls>'` on
  the whole worktree+HEAD): the same commit's `.rd-ldg-grpw` wrap-group
  class (from sibling commit 3811792) had no emitter either — its
  markup was part of the lost renderer and landed with the recovery.
- Commit-message copy claims count as intent: 0671daa's message said
  the deck "no longer says RedBridge is the only house…" — the dek
  text at HEAD still did (its edit died with the renderer batch).
  Restoring committed-intent copy is recovery, not a new copy call;
  genuinely UNcommitted copy decisions (the block heading, which the
  sibling's report listed as "tell me if you want it retitled") stay
  with the user.

Then the usual discipline (auspol-clean-artifact-commit governs the
commit side): rebuild federal→vic→federal, run the pinned probe at
every width (mrp-prefs: 1440/1024/768/390 all green before commit),
commit the JSX + regenerated pages by EXPLICIT paths (leave sibling
session dirt like PRODUCT.md and .matilda probes alone), push.

## Also restorable from the same evidence, no redesign needed

- Which component should host the marks: grep where the CSS siblings
  live (`rd-ff-gl`, `rd-ff-line` all in rd-allpolls.jsx's RdForced) —
  the new marks go in the same component, an `extras` prop keeps the
  ON-chart invocations clean.
- A key row needs no new chrome: `<RdKey items={[]}>` + one
  `rd-key-item` span carrying the swatch span is the file's own idiom.
- The svg aria-label gets the diamonds' sentence too (screen-reader
  parity with the visual marks).

## The standing rule for handoff prose

A session's closing report ("it's pushed and live, I checked") is a
CLAIM about a worktree, not about origin. Before relaying it to the
user as truth: `git grep` the renderer classes at HEAD, and if the
feature shipped a `.matilda/probe/` file, run it — thirty seconds of
forensics beats a wrong "it's live" round-trip.
