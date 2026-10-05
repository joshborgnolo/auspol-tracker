---
name: auspol-boot-window
description: "auspol-tracker — the refresh static-article window end-to-end (worked 2026-10-03, commits 12bb0d6 halving + ac705a7 follow-up): why the static-summary article is visible on EVERY refresh (it renders from first paint until the app's first commit adds body.js — so the window length IS the boot time; user chose 'speed up boot' over splash/blank/dimmed-article), how to measure it (.matilda/probe-boot-timing.mjs FCP→body.js window; probe-boot-commit.mjs commit-scoped longtask/Layout anatomy; probe-boot-reads.mjs names every JS layout read before body.js), and the five levers that took it 163–171→72–79ms (tail deferral via the snapshotTailArmed module flag incl. PrimaryVoteMemo in the second round; rAF first-fit in the ticker; viewport-SEEDED widths instead of mount-commit gBCR in RdLeadGauge; RdGlide mount-read skip; geometry layout effects moved off the commit). ALSO the boot-flag placement rule (4181886): body.rd is synchronously derivable so it goes on in the boot script BEFORE createRoot().render() — child layout effects run before the parent's, so a parent-effect-set styling class is measured-through unstyled for 1–2 frames (the 1605px load flash); body.js, which REMOVES pre-app content, stays commit-set."
source: auto-skill
extracted_at: '2026-10-03T03:27:02.907Z'
---

# The refresh static-article window (boot window)

## Why the static article flashes on every refresh — by design

- `template.html` ships `<article class="static-summary">` (built by
  `buildStaticSummary()` in `build.mjs`) as the no-JS / reader-mode
  content. It is visible from FIRST PAINT; the app takes over when the
  first commit lands.
- `body.js` is the "app has mounted" flag: added by App's **layout
  effect** in the `73de0c58-…` asset (~:2009), deliberately at commit
  time (a historic blank-tide-band-frame bug is why it's not set during
  render). `RootBoundary` drops body.js on crash so the article returns.
- Therefore: **the window the user sees on refresh = FCP → body.js = the
  first React commit's long task.** It is a boot-TIME problem, not a
  paint/styling problem — content-visibility and other paint tricks do
  not move it (ComputeStyles measured only ~18ms; nothing to win there).
- 2026-10-03 the user was offered splash / blank-paper / speed-up-boot /
  dimmed-article and chose **speed up boot**: keep the static article as
  the pre-commit content, shrink the time it shows.

## Measuring (uncommitted .matilda probes — keep them untracked)

- **`.matilda/probe-boot-timing.mjs`** — serves the built index.html with
  per-`<script>` `performance.mark` instrumentation, then reports
  FCP→body.js per pass plus per-block script eval ms and Long Tasks.
  Trap that cost a turn: a regex `replace` callback whose 4th argument
  was returned as `(n++, undefined)` made only ONE script block get
  instrumented — use a block-bodied callback.
- **`.matilda/probe-boot-trace.mjs`** — CDP trace of the PLAIN page
  (`categories: ["devtools.timeline"]`), aggregates complete events
  before body.js+50ms. Traps: devtools.timeline carries NO
  `navigationStart` anchor — re-anchor `t0 = min(ts of X events)`;
  CPU Profiler needs `Profiler.start()` after `Profiler.enable` or the
  report is "No recording profiles found".
- Headless-only false signal: the trace's UpdateLayoutTree shows ~137ms
  including a ~74ms PrintPreview inner parse — a headless Chrome quirk
  (~6ms in a real browser). Don't chase it.
- Steady-state numbers (cache disabled, 3 passes): **163–171ms →
  90–94ms**; first-commit longtask **~210ms → ~89ms**.

### Follow-up probes (second round, ac705a7)

- **`.matilda/probe-boot-commit.mjs`** — commit-SCOPED timing, immune to
  run noise: trace devtools.timeline, find the FunctionCall ending
  nearest the body.js timestamp (filter `dur > 20ms` — a 0ms
  MutationObserver microtask also ends exactly at body.js), aggregate
  the events strictly inside it. This is what you optimise when the
  window is commit-bound; probe-boot-timing run-to-run noise (65–144ms
  on the same build) is useless for decisions.
- **`.matilda/probe-boot-reads.mjs`** — names every layout read before
  body.js: wraps `Element.prototype.getBoundingClientRect` + the
  offset/client geometry getters in `evaluateOnNewDocument`, tags each
  call with element + first JS stack frame. This is the exact list of
  forced-layout customers left inside the commit — use it INSTEAD of
  guessing from the source (two prior "suspects" — rd-polls tlTip and
  the TrendChart tip effect — the probe proved cold at boot: tip renders
  only when open, first line `if (!el) return`).
- **`.matilda/probe-gauge-seed.mjs`** — asserts the lead gauge paints at
  exactly `min(760, parentRect)` at 1440/768/390px, survives a viewport
  resize (ResizeObserver correction fires), and never overflows the
  document horizontally.

## body.js vs body.rd — which boot flag goes WHERE (worked 2026-10-03, 4181886)

The boot-flag placement rule that generalises from the original body.js
choice:

- **`body.js` is deliberately effect-set** (App's first-commit layout
  effect, ~:2009 in the 73de0c58 asset): its CSS pulls the app over the
  static summary, so setting it early would collapse the article before
  the app can paint.
- **`body.rd` is the opposite case**: it gates every rd.css redesign rule
  and is *synchronously derivable* from the `?design=` query at boot, so
  it must go on in the **boot script BEFORE `createRoot().render()`**.
  Why: React runs child layout effects BEFORE parent layout effects, so
  with rd parent-effect-set, every mount-time geometry measurement
  (RdHouseLean's useRdWidth was the caught one) ran against UNSTYLED
  inline pre-body.rd elements for 1–2 frames — svg width 912px, document
  scrollWidth 1605px, a visible right-edge overflow flash on every load
  at ~1024px. Fix commit 4181886: boot script now does
  `document.body.classList.toggle("rd", new URLSearchParams(
  window.location.search).get("design") !== "old")` in a try/catch
  (fallback `add("rd")`), and App's layout effect remains as the class's
  owner after mount.
- General rule: **a boot class whose rules only style (body.rd) goes in
  the boot script; a boot class whose rules REMOVE/REPLACE pre-app
  content (body.js) stays commit-set.**
- Safety checks before moving a class earlier: confirm NO `body.rd`
  selectors exist in `template.html` (so the static-
  article/legacy `?design=old` rendering can't change appearance) and NO
  `ss-*` selectors live in rd.css. Both checked clean at 4181886.
- Verification of the fix: per-rAF scrollWidth sampler (see
  auto-skill-auspol-mobile-overflow-probe, load-flash section) — zero
  overflow frames on every tab/width rung.

## The two splits that halved it (commit 12bb0d6)

1. **SnapshotView analytical tail → second commit.** Six sections
   (LeadershipMemo, DirectionMemo, DemographicsMemo, OnSourcesMemo,
   IssuesMemo, UndecidedMemo) now render behind a module-level
   `snapshotTailArmed` flag in the `73de0c58` asset: first mount runs
   `useEffect(() => { snapshotTailArmed = true; setTail(true); }, [])`,
   so commit 1 carries only Hero/PrimaryVote/PollsterTable/NextPolls and
   the tail mounts ~25ms AFTER body.js (its ~80ms commit shows as a
   SECOND longtask outside the static window). The flag persists for the
   session — tab remounts (leaving and returning to the "Now" tab)
   render the tail synchronously, never a repeat deferral. The module
   flag lives in the JSX file's plain-script body, so the live binding
   works across the bootstrapped layers. **(Round 2, ac705a7, moved
   PrimaryVoteMemo into the same gated set: `{tail && <PrimaryVoteMemo
   />}` — worth the move only once the reads below were gone; it shaved
   first-commit DOM 1920→923 nodes.**)
2. **NextPollTicker fit pass → rAF** (`d1a1d215` asset ~:229): the first
   `compute()` (a chain of getBoundingClientRect / scrollWidth reads)
   ran inside a synchronous layout effect and forced a ~50ms full sync
   layout INSIDE the first-commit long task. First call is now
   `requestAnimationFrame(compute)`; settle/RO/fonts passes unchanged,
   cleanup cancels the rAF. General rule: **any layout-measuring work in
   a mount-time layout effect inflates the boot window — defer the first
   pass one frame.**

## Round 2 (commit ac705a7): 90–94 → 72–79ms, three more levers

The pattern that generalises from the ticker fix: **any mount-time
layout measurement whose true value is derivable from the viewport
should be SEEDED at render (window.innerWidth is a viewport read — no
layout forced) and corrected by ResizeObserver**, instead of read
synchronously inside the commit. The bootstrap "start hidden until
measured" contract dies in this trade: a viewport-seeded wrong-by-a-
scrollbar guess is rarer AND smaller than a 0/760-flash the observer
then fixes.

1. **RdLeadGauge width seed (rd-hero.jsx, `rdGaugeSeed`).** The lead
   gauge read `getBoundingClientRect(.rd-tpp-top)` in a sync
   useLayoutEffect — one forced full-document layout inside the commit.
   Replaced by `useState(rdGaugeSeed)` where the seed computes the
   content width arithmetically: `min(1152, vw − 2·clamp(20,5vw,64))`
   (the --rd-maxw 1152px / --rd-gutter clamp(20px,5vw,64px) design
   tokens) capped at the gauge's own 760 max, floored at 280. Exact on
   phones and every desktop band; at most a scrollbar's width out in
   the narrow tablet band. The ResizeObserver survives
   (resize still corrects live), but the first-fit sync call is gone —
   its correction now lands one frame later instead of in-commit. The
   old `w=0 → visibility:hidden / width:auto` unmeasured contract is
   DELETED with it (`style={{width: w}}` plain). The RO-correcting
   pattern keeps the gauge swapping cleanly on window resize — verified
   by probe-gauge-seed.mjs.
2. **RdGlide first-mount read skip (rd.jsx:512).** After
   `seen.current.w = watch`: `if (watch !== undefined &&
   last.current == null && typeof ResizeObserver !== "undefined")
   return;` — first mount has no `prev` to glide FROM anyway (returned
   below either way), and the height baseline now comes from the
   component's existing passive ResizeObserver post-commit. All 25 call
   sites audited before landing: only RdGlide's own watch-less wrappers
   could see the change, and watch-less calls keep the old inline-read
   semantics by construction.
3. **Dead-suspect pruning (probe-boot-reads).** Five reads remained
   before the round: setStaticSummaryHeight offsetHeight ×2 (static
   HEAD script, template.html), textWidth gCS(BODY) (font-metric probe,
   TrendChart engine), RdLeadGauge fit gBCR (→ lever 1), one chart
   mount fit gBCR(.chart) (shared TrendChart/sizing machinery — left
   alone; touching the shared engine to save one measurement is not
   boot-work). After lever 1: four.

Measured outcomes, steady-state (cache disabled): mount-commit
FunctionCall **83–85ms → 71–73ms** (probe-boot-commit, two passes each
side); Layout+UpdateLayoutTree inside the commit 51→45ms; refresh
window **90–94 → 72–79ms** (probe-boot-timing window pass). What
remains in-commit is not mostly dirty-read layout — ~43ms Layout is the
UNAVOIDABLE post-commit first-frame layout over the 923-node first
commit (hero chart ~463 nodes + latest table ~444); shrinking it means
shrinking commit-1 DOM further, not deleting reads.

## Verifying (both rounds)

- `.matilda/probe-boot-tail.mjs` — five assertions: tail absent AT the
  body.js frame (synchronous MutationObserver read — see
  auto-skill-auspol-headless-geometry-verify: waitForFunction→evaluate
  round-trips race the ~20ms later second commit and report it present),
  tail mounts afterwards, ticker chips unpark (7/7), tab re-entry renders
  the tail instantly, zero console/page errors. Trap fixed there: the
  tab strip labels are "Now"/"Past cycles"/"All polls"/"Info" with
  `[role=tab]` — there is no "Snapshot" label to click.
- Regression shape: ONE ~210ms longtask again, or #leadership present in
  the at-frame record. Healthy shape: window ≤ ~120ms and TWO longtasks
  (~89ms then ~80ms, the second starting after body.js).
- Declined on purpose: lazy-evaluating the ~30ms dataset IIFE /
  narrowing the bootstrap subset — estimator-arms-race territory
  (see auto-skill-auspol-estimator-arms-race) for marginal user-visible gain.
- Round-2 verification: probe-boot-tail gained a `#primary-vote`
  assertion (absent AT the body.js frame, mounts after, instant on tab
  re-entry) when PrimaryVoteMemo joined the deferred set; the round-2
  ship gate was probe-gauge-seed ALL PASS + probe-boot-tail ALL PASS +
  probe-boot-commit 71–73ms × 2 + validate.mjs + npm test.

## Race note from shipping it

A sibling session's clean-room rug commit (97ef55d) had reset these two
in-flight sources to HEAD mid-task (then restored them), silently
reverting the built index.html — tell was `grep -c snapshotTailArmed
index.html` = 0 while sources were still dirty. Rebuilt in a temp
worktree at HEAD + only the two edited files, copied the artifact back,
committed just the three paths (f1a0828 local; a sibling's
`git pull --rebase` replayed it as 12bb0d6 with my push reporting
"Everything up-to-date"). Full machinery in
auto-skill-shared-repo-session-race.
