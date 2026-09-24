---
name: auspol-newspoll-missing-wave-filer
description: auspol-tracker — the missing-wave FILING agent (shipped 076c022, 2026-09-05): the LLM last resort for a Newspoll wave unlanded ≥3 days. Signal rides the NP_WATCH JSON (ageDays/escalate, exit codes untouched), the gated file-missing job in newspoll-watch.yml re-runs the cheap watchdog itself (failed-job outputs unreliable; GHA runs bash with pipefail so the grep needs `|| true`), and .build/newspoll-file-missing-prompt.md may append ONE cited row or commit nothing. Why NP_WATCH not NP_STATUS, the step-0 deterministic-last-chance, the NP_OUT/NP_NOW test recipes, and the FOURTH matilda-CLI pin site.
source: auto-skill
extracted_at: '2026-09-05T15:00:00.000Z'
---

# Newspoll missing-wave filing agent (LLM last resort)

Shipped 2026-09-05, commit `076c022` ("Add missing-wave filing agent for unlanded
Newspoll waves"). The user-approved design principle: **no LLM in the happy path.**
The deterministic extractor and its repair agent get their full window; only a wave
the pipeline *demonstrably cannot land* — positively detected while polls.json still
lacks it for ESCALATE_AFTER_DAYS (3) — escalates to a headless Matilda filing agent.

This is the FIRST agent allowed to hand-write `data/polls.json`: it may append ONE
wave's `polls` row (optionally its `ppm`/`approval` companions, same corroboration
bar) — or commit nothing, which is a SUCCESS outcome. It lives in its OWN prompt
file; the eight `*-repair-prompt.md` files keep their absolute NEVER-hand-edit
rules — the filer is a separate contract, not an exception carved into theirs.

## The three moving parts (they name each other — keep in sync)

1. **Detector — `.build/check-newspoll-release.mjs`.** A `release` verdict now carries
   `ageDays` and, past `ESCALATE_AFTER_DAYS = 3`, `escalate:true`. Escalation rides the
   NP_WATCH JSON, never the exit code: 1 still means "wave unlanded" exactly as before
   (the watch job's failure is still the email). `NP_NOW` env overrides the clock in
   the age arithmetic — test hook only, CI never sets it.
2. **Trigger — `.github/workflows/newspoll-watch.yml`, `file-missing` job.**
   `needs: watch` + `if: always()`. Gate step re-runs the watchdog itself and parses
   the last `NP_WATCH` line; only `fired===true && escalate===true` installs pinned
   `matilda@0.21.4` and runs the filer (25m wall / 80 tool calls, same as repair jobs;
   `MATILDA_API_KEY` unset → warns and exits 0). Since 2026-09-25 the gate is its own
   `escalation` job and `file-missing` runs only when it says escalate, in its own
   `newspoll-file` group (it pushes a branch, never main). This repo does not let Actions
   open PRs, so the filer pushes `repair/newspoll-file-<run>` and files a ci-alert issue
   ("Newspoll filing ready for review") carrying the compare link to open the PR by hand;
   its breaker is `repair-gate.sh newspoll-file newspoll-watch.yml file-missing`.
3. **Contract — `.build/newspoll-file-missing-prompt.md`.** Structured like
   coverage-doctor's prompt. Filing threshold (ALL FOUR or file nothing): canon still
   lacks the wave ±3 d; rung A still publishes it (`state:"release"`); ≥1 INDEPENDENT
   source fetched by the agent itself corroborates EVERY filed field within 0.5 pp
   (the Infogram chart alone is not enough); true fieldwork window known from a chart
   label or release prose — never the carrier article's date. Absent-not-zero for all
   optional fields (tpp null while Newspoll's 2PP is suspended, sampleEff/published
   only from stated sources, `oth` null). Validate exit 0 gates the commit; commit
   message `File unlanded Newspoll wave <fieldwork-end date>` with source URLs in the
   body, then `git push origin HEAD:main` with one rebase retry. Abort = revert +
   report, commit nothing.

## Design decisions worth knowing before changing it

- **Why NP_WATCH, not NP_STATUS.** The proposed design had the signal in the
  extractor's NP_STATUS — rejected on investigation: the extractor is blind precisely
  in the failure mode being caught (no free coverage clustered → empty candidates →
  exit 0), only rung A positively knows a wave exists; and plumbing a signal through
  `poll-agent.yml`'s wrapper-log step would have touched the shared workflow every
  house uses. The watchdog was built for exactly this detection ("can't run on CI"
  was always the extractor, never rung A).
- **Failed jobs' outputs can't be trusted.** The watch job's failure IS its message,
  so `needs.watch.outputs` is empty on exactly the runs that matter — the gate
  re-runs the (anonymous, seconds-cheap) watchdog in the filing job itself rather
  than trying to plumb outputs. This also makes the whole chain idempotent: if the
  extractor lands the wave between watch and gate, the fresh verdict is `current`
  and every agent step skips.
- **GHA runs bash with `-eo pipefail` by default.** A bare
  `json=$(grep '^NP_WATCH ' log | ...)` makes the entire gate step (and job) fail
  whenever the log is a hard-crash without an NP_WATCH line; the shipped file has
  `|| true` on BOTH the watchdog re-run and the grep pipeline. Keep them.
- **Step 0 of the prompt gives the deterministic pipeline its last chance.** Clean-tree
  check first (a failed updater can leave an uncommitted extractor-written row —
  finishing THAT write-up outranks hand-filing; never blend leftovers with the
  hand-entered row in one commit), then `bash .build/newspoll-updater.sh` once: if the
  deterministic chain lands the wave, the agent files nothing.
- **The 3-day value.** Anchored to the 2026-08-28 wave that sat as a candidate for 4
  days and motivated the chain — gives the extractor its Sun×2/Mon/Tue slots plus the
  repair agent before any LLM touches data.
- **matilda-CLI pin sites are now FOUR**: poll-agent.yml, roymorgan-update.yml,
  coverage-check.yml, and newspoll-watch.yml (the file-missing job). Bump together —
  see auto-skill-ci-main-writer-races.

## Testing it (all local, no CI)

- **Escalation, live:** copy `data/polls.json` to /tmp, strip the newest Newspoll row
  from the copy, run `NP_OUT=/tmp/stripped.json node .build/check-newspoll-release.mjs`
  — expect exit 1, `state:"release"`, `escalate:true` for any label ≥3 d old
  (2026-09-05 run: label 2026-08-30, ageDays 5, and the printed figures matched the
  known 2026-08-28 wave: 29/19/30/13/9, ppm 44/35, nets −21/−17).
- **Fresh-release (no escalation):** same stripped canon plus `NP_NOW=<label+2d>` →
  `escalate:false`, still exit 1.
- **Quiet:** real canon → `state:"current"`, exit 0.
- **Gate snippet:** table-test the workflow's exact `node -e` JSON parse against
  `escalate:true`, `current`, `guard` (fired but no escalate flag), and EMPTY input —
  only the first prints `true`.
- **YAML:** no pyyaml on this machine; `ruby -ryaml -e 'YAML.load_file(ARGV[0])'` parses.

## If generalising to other houses

The pattern is portable: a cheap anonymous detector with its own verdict line, a
staleness constant, a gated second job in the SAME standalone workflow, and a separate
filing prompt. Deliberately NOT generalised into poll-agent.yml (the shared reusable
workflow stays untouched); and don't add filer jobs for houses whose extractors CAN run
on CI — their missing-wave failure mode is a parse/discovery bug, which is repair-agent
territory already.

## Cross-refs

- `auto-skill-newspoll-extraction` — the extractor, rung A/B spec, the watchdog's
  original detect-only contract, canonical row conventions the filer must mirror.
- `auto-skill-ci-main-writer-races` — per-workflow queues + the push_main system
  (the filer's prompt-driven push is the CI-agent analogue; pin sites list).
- `auto-skill-auspol-foxhedgehog-hand-entry` — the only other hand-written data path;
  its validate→build→commit pipeline for hand edits is what the prompt mirrors.
- `auto-skill-auspol-pollsjson-schema` — key asymmetry (`pollster` vs `firm`) the
  filer's companions must respect.
