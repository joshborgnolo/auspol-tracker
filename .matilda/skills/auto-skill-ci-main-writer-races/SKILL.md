---
name: ci-main-writer-races
description: auspol-tracker — how the repo keeps GitHub Actions writers from racing origin/main (shipped 2026-09-04, commit ab0df87). Two mechanisms that must be kept together: the shared `main-writers` concurrency group on every push-capable workflow, and .build/git-push-main.sh `push_main()` — the push→rebase→rebuild→amend→push-once retry every wrapper's push site routes through. Adding a new data workflow or wrapper? It MUST join both.
source: auto-skill
extracted_at: '2026-09-04T13:36:12.593Z'
---

# Serialising writers against origin/main (F6)

A single GitHub Pages site served from `main` means every automated job that commits+opens a
push window is a potential lost-update: a second writer (another workflow, the local launchd
backup, a human) can land a commit between a writer's freshness pre-flight and its push, and
the old behaviour was "slot fails, wave sits in a local commit". The fix is two mechanisms that
cover CI↔CI and CI↔launchd/human races respectively. Both were shipped in one commit
(`ab0df87`); treat them as one system.

## 1. The `main-writers` concurrency group (CI↔CI races)

Every push-capable workflow joins ONE shared group:

```yaml
concurrency:
  group: main-writers
  cancel-in-progress: false
```

- `cancel-in-progress: false` is deliberate — writers **queue**, never cancel each other.
- Members as of F6: `roymorgan-update.yml` (workflow level, replacing its own
  `roymorgan-update` group), `poll-agent.yml` **update AND repair jobs** (job level, replacing
  per-house `poll-agent-${{ inputs.house }}` — per-house groups let two houses race main),
  `np-score.yml`, `citation-check.yml` (both workflow level), and `coverage-check.yml`'s
  **repair job only** (its `check`/`thinness` jobs are read-only and stay OUT of the group;
  same logic applies to any future read-only job).
- Joined 2026-09-05 (commit 076c022): `newspoll-watch.yml`'s `file-missing` job (job level)
  — the missing-wave filing agent commits+pushes. Its sibling `watch` job is read-only
  and stays out, mirroring coverage-check's read-only-jobs-stay-out pattern. The filer's
  push goes through its prompt's protocol (HEAD:main, one rebase retry) — the CI-agent
  analogue of push_main; the .build shell-wrapper mechanism doesn't apply to prompt-driven
  agents. See auto-skill-auspol-newspoll-missing-wave-filer.
- Group names are repo-global: a job-level group in one workflow serialises against a
  workflow-level group in another. Repair agents count as writers (they commit+push with
  `contents: write`).
- When adding ANY new workflow that can push: join the group. When adding a job to an existing
  file, ask "can this job's runner hold an unpushed commit?" — yes → join, no → stay out.

## 2. `push_main()` in `.build/git-push-main.sh` (CI↔launchd↔human races)

Concurrency groups can't block the local launchd copies or a human pushing by hand, so every
wrapper's push site retries once instead of failing the slot:

```bash
. "$REPO/.build/git-push-main.sh"   # source AFTER the wrapper defines LOG and log()
...
push_main "$MSG" <exactly the file set the commit was staged from>
```

Contract:

1. `git push origin HEAD:main`; success → done.
2. On rejection: `git pull --rebase origin main` (conflict → `rebase --abort`, fail with the
   commit kept locally).
3. If the file list contains **`index.html`** — that string is the signal — re-run
   `validate.mjs` + `build.mjs` against the merged tree and `git add assets/` (the rebuild can
   rename/delete hashed asset layers, which the explicit file list would miss). A commit without
   index.html (e.g. essential's report-index-only commit) skips the rebuild.
4. `git add <files>` again, `git commit --amend --no-edit`, push ONCE more.
5. A second rejection fails the slot ("commit kept locally"). Extractors are idempotent, so the
   next scheduled run redoes the extraction on the fresh base — nothing is lost.

Conversion rules learned wiring all eight wrappers:

- Preserve each site's existing failure semantics: sites that were
  `git push … || log "FAIL …"` (essential index commit, both skip-confirm commits) stay
  non-fatal log lines; sites that were `if ! git push …; then … exit 1; fi` become
  `if ! push_main …; then exit 1; fi`.
- Conditional pathspecs can't go in a literal call. Essential's main commit does:
  `ESS_FILES=(…); [ -d .build/essential-src ] && ESS_FILES+=(.build/essential-src/);
  push_main "$MSG" "${ESS_FILES[@]}"` (the dir only exists after the first retro-fill, so an
  unconditional pathspec would fail `git add` on a fresh checkout).
- If a wrapper already `git add`s more than its push list before committing (sampleeff's extra
  `git add assets/`), include the extra path in the push_main list too so the amend path
  re-stages it.
- Multi-line log alignment: long file lists wrap with a trailing `\` and a 2-space continuation —
  irrelevant to git, but it's the house style in these wrappers.

## Verifying a conversion

- `grep -n 'git push' .build/*.sh` — the ONLY hits allowed are inside `git-push-main.sh` itself
  and `log "FAIL git push …"` message strings.
- `bash -n` every touched wrapper (no test suite exists for these; syntax check + diff review
  is the bar).
- No pyyaml/yq/js-yaml on this machine, but `ruby -ryaml` IS available and parses workflow
  YAML fine (used to validate the 0c3a2ba permissions fix) — prefer it for assertions;
  otherwise keep hunks tight and minimal (comments are safe anywhere, a `concurrency:`
  block slots between top-level keys) and review `git diff .github/workflows/` in full
  before committing.

## Related

- The F5 injection-hardening (commit `c9d3505`) pinned the repair-agent CLI to
  `@maincode-ai/matilda-code@0.21.4` with a "bump deliberately" comment in poll-agent.yml,
  roymorgan-update.yml **and** (via F6) coverage-check.yml — plus (076c022, 2026-09-05) the
  `file-missing` job in newspoll-watch.yml. A FIFTH site exists and was missed here at
  first: the PR-gated `repair` job in `prediction-refresh.yml` ("bump both together"
  comment at its Install Matilda CLI step, ~:125). That's FIVE pin sites now — when
  bumping the pin, grep `matilda-code@` across .github/workflows/ rather than trusting
  this count. The same commit's UNTRUSTED-CONTENT preamble lives in all 8
  `.build/*-repair-prompt.md` (the filer's `.build/newspoll-file-missing-prompt.md` carries
  its own copy of the clause, but it is a FILING prompt, not one of the repair eight).
- Wrapper anatomy, failure logs, and the launchd side live in the
  **launchd-scheduled-data-pipeline** skill.
