---
name: auspol-review-autofix-loop
description: auspol-tracker — completing the bundled /review skill to the end on a LOCAL audit/feature fix commit (worked 2026-10-13, /review of 4dcbb02 → 14 findings confirmed → all fixed → verdict Request-changes→Approve → committed as 7166e68). The repo-specific finish line: full `npm test` exit 0 is the ONLY gate, editing .build/site-shell.mjs source turns the chain red at test-site-shell until you run the writer over the 11 satellite/404 pages, the review report goes to .matilda/reviews/ (gitignored, satisfying Step 10), `matilda review cleanup local`, then commit the autofix round with git commit -F staging explicit paths (+ git add -f for any .matilda/probe file). Includes the test-invariants structural-pinning pattern (eval the 9f09dca2 bundle in a window sandbox; assert STRUCTURE not figures) and the feed-vocabulary positive-controls lesson. The follow-through phase after auspol-full-site-bug-audit.
source: auto-skill
extracted_at: '2026-10-13T21:45:00.000Z'
---

# Post-audit /review → autofix → commit loop

After a big fix commit (an audit's 20 problems, a feature round), the
stop-hook-goal pattern used on 2026-10-13 was: fix everything in commit A,
run the bundled `/review` skill on commit A, apply every confirmed finding
in Step 8, re-verify, and land the autofix round as commit B. This skill is
the repo-specific map of the steps AFTER the review agents have reported.

## The loop as it ran (4dcbb02 → 7166e68)

1. **Review scope**: local commit diff. The bundled skill's Steps 1–6 fan
   out 9 agents; verification confirmed ALL 14 findings high-confidence
   (S1/S2 probe-server security, T1–T9 test/estimator gaps, Q1–Q4 polish).
   Under a standing stop-hook goal, Step 8's "Apply auto-fixes? (y/n)" is
   pre-answered yes — the goal IS the authorisation.
2. **Step 8 autofix**: apply each finding, then re-run the gate: the FULL
   `npm test` chain, exit 0. Nothing less counts — the chain is the only
   arbiter (validate → build → every per-area test → probes).
3. **Step 7 verdict re-evaluation**: all Critical/Suggestion fixed ⇒ the
   displayed verdict upgrades (Request changes → Approve). Record the
   pre-fix verdict's findings in the report regardless.
4. **Step 10 report**: write `.matilda/reviews/YYYY-MM-DD-HHMMSS-local.md`
   (timestamp+target+deterministic results+findings+verdict).
   `.matilda/*` is gitignored (`git check-ignore -v` confirms), which
   SATISFIES the skill rule "ensure the report dir is ignored" — the file
   is a session artifact, do NOT force-add it into the commit.
5. **Step 11**: `matilda review cleanup local` — clears the
   `.matilda/tmp/matilda-review-local-*` side files; idempotent.
6. **Commit B**: explicit-path staging (repo hygiene rules still apply —
   never `git add -A`; sibling never-stage paths like data/changelog.json
   stay out), `git add -f` for any `.matilda/probe/*` (plain add exits 1
   on the ignored dir even for tracked files), and `git commit -F` with the
   message file written into `.matilda/tmp/` (also ignored) — a long
   single-paragraph message naming every fixed finding class. Remove the
   message file after. Do not push unless the user asks.

## The site-shell writer trap (turned the chain red once)

Q1/Q2's fixes edited `.build/site-shell.mjs` SOURCE. The next `npm test`
failed at `test-site-shell` ("a satellite is out of step with its shell",
11 pages). The shell writer is NOT part of the build — run
`node .build/site-shell.mjs` by hand; it rewrites 404.html +
preference-flows/ prediction/ atlas/ feedback/ + archives/{newspoll,
acnielsen,morgan,galaxy,aeforecasts,trove}/index.html with the new source.
Those 11 pages must then be staged with the source edit in the SAME commit,
or every later npm test run goes red again. Rule: a shell-source edit and
its 11-page regeneration are atomic.

## The test-invariants pinning pattern (the T2/T4–T8 deliverable)

A new `.build/test-invariants.mjs`, wired into package.json's chain right
before test-vic-build, pins audit-grade structural contracts so a silent
regression re-fires loudly. Authoring rules that cost five fix-rounds to
learn:

- **Eval the data bundle in a window sandbox**: find the
  `.build/newtracker/assets/9f09dca2-<uuid>.js` bundle by readdir prefix,
  `eval(src)` with a local `const window = {}` (the bundle assigns
  `window.AUSPOL = (...)`), then walk `window.AUSPOL`. Assert the wrapper
  with `.includes("window.AUSPOL = (")`, NOT startsWith — the file opens
  with a header comment.
- **Pin STRUCTURE, never figures**: cycle spans run x=0..integer `span`
  and `endRes.x − span < 1.0` (T4); finiteness sweeps over
  firmness/issues/direction (T5); changelog head tags (T7); source-purity
  greps on np-project.js (T8). Structural assertions don't drift when new
  data lands — a figure pin would.
- **Null-tolerant exactly where the emitter's contract allows nulls**:
  issues climate ships `imp: null` today (the top-3 salience guard) —
  asserting `imp.v` unconditionally is instant self-inflicted red. Assert
  only when present; the guard itself is what's pinned.
- **Negative greps need positive controls when the emitter deliberately
  folds vocabulary**: feed.xml's `bits()` folds every non-major cohort key
  (incl. `community-strong`) into a printed `OTH N` cell (PARTY has no
  `oth` label) and the topline prints "Ind/Oth". T6's first draft —
  "assert zero OTH cells" — false-fired on the fold's legitimate output.
  Diagnose the real defect class against `build.mjs`'s bits()/shareLine
  (~:1741/:1732) first, then pin BOTH the rejects (no `community-strong`,
  no `L/NP null`, no und/dnr residue cells — cell-anchored regex so the
  printed "Undecided 4%." sentence and the "2025 dnr voters now:" cohort
  label survive) AND the positive controls (Ind/Oth topline, some
  `OTH N` cell, the Undecided sentence, the dnr label). A negative-only
  pin can't tell "fold working" from "cells missing".
- **Check the real emitted shape before writing assertions**: assuming
  sPrim/sTpp/nextEnd fields on cycles, or `card.png` as the og:image when
  it's `auspol-card.png`, each cost an immediate test-authoring fix. Probe
  the built bundle/page with node first, THEN write the assertion.

## Finally

After commit B, verify `git status` shows only sibling scratch
(`.worktrees/` etc.), report the local-only ahead-of-origin count, and —
when the review/autofix closes out a stop-hook goal — mark the goal
complete with the two commit hashes in the message.
