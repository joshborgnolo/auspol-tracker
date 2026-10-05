---
name: auspol-audit-diff-causality
description: "auspol-tracker — a visual-audit/reference comparison flags a layout difference: attribute causality BEFORE touching code by measuring the same geometry in three states (current HEAD, a detached git worktree of the baseline commit rebuilt in place, and the live auspoltracker.com fetched directly by puppeteer). Identical numbers in all three = pre-existing bug, not a regression (worked 2026-10-03: All-polls .rd-ap-tabs five-tab row ≈376px overflows the 350px phone shell — 6px page scrollX at 390px / 76px at 320px — identical at HEAD, at f67f598, and on live; HEAD/parent exonerated)."
source: auto-skill
extracted_at: '2026-10-03T08:11:56.097Z'
---

# Audit-diff causality triage (three-state geometry measurement)

## When

The visual-audit / reference-comparison workflow (or any
screenshot-diff report) marks elements as "different" and the question
is "did commit X (or its parent) cause this?". Do not read the diff
first — MEASURE. The reference pipeline renders the same code the audit
does, so a flagged difference is frequently a pre-existing issue the
audit newly visualises, not a regression.

## The three states

Build ONE parametric probe script that takes a checkout root as `argv`
and (for live) a URL variant, then run it three times:

1. **Current HEAD** — serve the repo root (`createServer` reading
   `index.html`/assets from ROOT, `waitUntil: "networkidle0"`, deep-link
   straight to the view with `…/index.html#allpolls` instead of
   clicking through — deep links also work on phone viewports where a
   nav control may be hidden/relabelled, which cost one wasted pass).
2. **Baseline commit** —
   `git worktree add --detach .worktrees/audit-<sha> <sha>`, run
   `node .build/newtracker/build.mjs` INSIDE the worktree (index.html
   is a generated artifact — the old commit's data + old sources must
   be rebuilt; serving a stale artifact measures the wrong thing), then
   point the probe at that root.
3. **Live** — puppeteer straight at
   `https://auspoltracker.com/index.html#<view>` with the same viewport
   and the same `page.evaluate` measurement. Live IS the deployed build
   of main; for layout forensics it is a first-class state, not just a
   deployment check (see `auspol-live-site-verify`).

Verdict rule: identical geometry in all three states ⇒ the flagged
difference pre-exists and is on live ⇒ HEAD/parent are exonerated and
the reference update is safe; the fix (if wanted) is a separate change.

## Measurement shape that worked

Per viewport width, a single evaluate returning, for the suspect row:
page `scrollX` (`documentElement.scrollWidth - clientWidth`), outer
rect, inner group rect, each child's rect, and child label texts (the
labels prove you measured the right element — e.g. tabs
`[2PP | Primary | Leaders | Direction | Issues]`). Expect the
page-level scrollX to be SMALLER than the element's own overshoot where
the rest of the page caps at the viewport (worked case: group overflows
its shell by ~26px but page scrollX was only 6 at 390px, 76 at 320px —
compute consistency `shell.left + group.width ≈ viewport + scrollX` to
confirm one offender).

## Traps

- **Assert the root exists.** A probe that silently falls back to a
  missing path serves 404s on every URL; the symptom is
  `waitForSelector` timing out with an empty `nav: []` dump, not a
  clear error. `git worktree add` output must be checked before
  probing, and scratch audit worktrees may vanish between steps
  (re-add; `git worktree remove --force` to clean up — they hold only
  rebuilt artifacts).
- Keep audit worktrees on detached HEAD under `.worktrees/` and only
  build there — never commit from them.
- Probe infrastructure (headless Chrome path, traps around innerWidth /
  ICB expansion, transient-overflow rAF sampling) lives in
  `auto-skill-auspol-mobile-overflow-probe`; geometry-assertion
  conventions in `auto-skill-auspol-headless-geometry-verify`.
