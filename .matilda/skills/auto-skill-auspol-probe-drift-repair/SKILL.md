---
name: auspol-probe-drift-repair
description: auspol-tracker — a COMMITTED pinning probe in .matilda/probe/ goes red right after features ship elsewhere (dozens of failures in thematic clusters): this is usually PROBE DRIFT behind a legitimately-shipped contract, not a product regression. Triage by kernel-vs-model (in confidence-smooth 2026-10-08 the smooth() kernel was unchanged — the x-scale MODEL had shipped from a year-fraction domain to a months-since-election ruler), repair by re-pinning the probe's expectations ONLY (never touch the panel; the user's scoped approval is for probe edits), fix failure-clusters per cluster (source greps / scale model / palette tokens / copy strings), diagnose DOM truth with a THROWAWAY debug scratch probe created-used-DELETED inside .matilda/probe/ (BOGAN blocks /tmp), verify green against BOTH the sibling-WIP worktree (BASE=.worktrees/<n>) and the main checkout while the sibling probes stay green, then commit the probe ALONE: git add -f -- <probe> (the dir is gitignored — plain add fails even on an ALREADY-TRACKED file, exit 1 with "paths are ignored"; confirm trackedness with git ls-files --error-unmatch + git log -3 -- <path>), git diff --cached --name-only must list exactly the probe before committing (sibling add -A races), long-summary commit-message style per git log -- .matilda/probe/. Trap: deleting a field from the probe's expectation table without grepping its IN-PROBE consumers is a runtime TypeError (l.lab removed, sideOf still called l.lab.split). Worked 2026-10-08 on confidence-smooth.mjs (commit 6719c24): 79-check drift → 401 ok checks.
source: auto-skill
extracted_at: '2026-10-08T09:12:29.936Z'
---

# Probe-drift repair: re-pin a committed pinning probe to the shipped contract

The `.matilda/probe/` fleet has two classes (see auspol-headless-geometry-verify):
throwaway scratch probes (never committed) and **commit-quality pinning
probes** — the ones a feature commit names as "Pinned by .matilda/probe/…".
When a later feature rightfully changes the panel's markup/scale-model/copy,
its pinning probe goes red *through no fault of the product*. A red pinning
probe right after unrelated feature commits is drift until proven otherwise.

## First fork: product regression or probe drift?

Read the failing checks before touching anything:

- **Kernel unchanged ⇒ the drift is in the MODEL or the CONTRACT, not the
  data.** In confidence-smooth the smoothing kernel `smooth()` was byte-
  untouched; what had shipped was a new x-scale model (year-fraction domain
  → months-since-election ruler `toM = (x - x0) * 12`), a palette swap
  (`--confidence-main`/`--confidence-alt`), and copy changes. All three are
  expectation-side re-pins.
- Confirm the feature commits that moved the contract
  (`git log --oneline -n 8 -- <panel-source.jsx>`) are product commits, not
  accidents. If they look accidental, drift assumption fails — escalate,
  don't re-pin.
- The panel source of truth is the SHIPPED source (`rd-panels.jsx` etc.) —
  never the probe's own memory of the contract.

Get the user's explicit approval of the classification before repairing:
the approved scope is *probe edits only; never touch the panel*.

## Repair loop, failure-cluster by failure-cluster

The red output falls into thematic clusters (source-grep pins, geometric
model, colours, copy). Fix one cluster, re-run, move on — a 79-failure run
is four clusters, not 79 bugs.

Re-pinning idioms from the worked case (confidence-smooth, months ruler):

- **Scale-model re-pin**: compute expected x by the SHIPPED model. Read the
  shipped domain math (`xMax = Math.max(36, Math.ceil(nowM)) + 0.6`),
  re-derive the probe's `sx(m)` linear map from viewBox/padding constants,
  and expect dots at `sx(toM(p.x))`. A scratch DOM-truth probe (below) proves
  the model: observed dot cx positions matched the months-ruler predictions
  exactly, killing the old-year-domain expectation.
- **Palette re-pin**: lanes fill `var(--confidence-main)` /
  `var(--confidence-alt)` in source order — read the JSX fill props, not the
  old hex constants.
- **Copy re-pin**: dash key and read-row strings come from the shipped JSX
  (`rd-un-rtop b` now renders house names via `l.by`).
- **Source greps**: update them to the new ternaries having BOTH the old
  and new forms in grep style is wrong — pin the shipped form only
  (`xTicks={histOn ? histTicks : xTicks}`, the `-hist` remount key,
  `spine = histOn ? …`, `chartRaw = histOn ? …`).
- Where sibling probes already own a behaviour (interpHover,
  board-dismissal), DELETE the duplicate coverage from the drifting probe
  and say so in its header comment, so the drift zone stays single-owner.

### The expectation-table deletion trap

Removing a field from the probe's expectation table (`lab: …` dropped from
LANES) while any in-probe consumer still references it
(`l.lab.split("[")[0]` inside `sideOf`) is a RUNTIME TypeError that fires
half-way through the run, *after* dozens of green checks — identical
symptom class to genuine drift failures. Before deleting any expectation
field, grep the probe file for every key of that table and repoint each
consumer (here `sideOf` re-keyed on `l.view`).

## Diagnose with a throwaway DOM-truth probe

When expected-vs-observed disagrees and you cannot tell which side moved,
write a tiny scratch probe inside `.matilda/probe/` (workspace-only; BOGAN
blocks /tmp) that DUMPS the live DOM fact — every lane fill, every
scatter-dot cx next to its tooltip text, every ruler tick's transform and
label — with zero assertions. Run it, read the dump, fold the finding into
the real probe, then DELETE the scratch file. Two scratch probes were born
and died in the worked session (`conf-dom-truth-scratch.mjs`,
`conf-dot-debug-scratch.mjs`). Report `ls .matilda/probe/` clean at the end.

## Verification matrix (all four before commit)

1. `BASE=.worktrees/<sibling-wip-worktree> node .matilda/probe/<probe>.mjs`
   — green against the tree where the contract actually shipped (the probe
   reads `process.env.BASE`; default is the main checkout).
2. `node .matilda/probe/<probe>.mjs` — green against the MAIN checkout too
   (the sibling may land their WIP mid-repair; the probe must pin the
   committed state, and did so here once the sibling committed).
3. Every sibling probe of the same panel green:
   `conf-history-interp.mjs`, `conf-history.mjs` in the worked case — never
   leave a neighbouring pin broken by your re-pin.
4. `ls` the scratch targets — they are gone.

## Commit protocol (probe alone, in a dirty shared tree)

- `git add -f -- .matilda/probe/<probe>.mjs` — **the `-f` is required even
  for a MODIFIED, ALREADY-TRACKED probe**: plain `git add` exits 1 with
  "The following paths are ignored … .matilda/probe" because the pathspec
  pass applies ignore rules regardless of tracked status. Confirm
  trackedness with `git ls-files --error-unmatch <path>` and history with
  `git log --oneline -3 -- <path>` before assuming the file was never
  committed.
- `git diff --cached --name-only` must print **exactly** the probe before
  `git commit` — sibling sessions run `git add -A` sweeps in this repo
  (see shared-repo-session-race), and their WIP (skill auto-edits, other
  probes, panel sources) must NOT ride along.
- Message style: long single-summary sentence naming what is now pinned —
  model after `git log --format=%s -- .matilda/probe/`
  ("Confidence panel probe: re-pin to the shipped months-ruler contract —
  … history-window ternaries … pinned in source … 401 checks green").
- Do not push beyond the approved scope ("commit by explicit paths" ≠ push);
  report the ahead-of-origin count instead.
