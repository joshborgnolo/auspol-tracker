---
name: auspol-poll-agent-new-house
description: Adding a NEW pollster house to auspol-tracker as a deterministic poll agent end-to-end (worked 2026-10-10, EMRS (Tas), commit c369f1a). The kit has ELEVEN homes — extractor + canon cache, updater wrapper, caller workflow, tune-schedules TARGET (+ the test fixture's scratch-file list, which counts targets), agent-repair watch/prompt, crosstabs weekly backstop, per-house test in the npm-test chain, validate.mjs KNOWN_POLLSTERS comment, MATILDA.md caller-count sentence. Also: declared `window` for houses with no clock-time stamps (Ipsos precedent), the STATUS-last-line contract the crosstabs `tail -1` depends on, and first-day QUIET_DAYS from the real release habit.
source: auto-skill
extracted_at: '2026-10-10T12:00:00.000Z'
---

# Adding a new pollster house as a deterministic poll agent

The kit, in build order (secnewgate 2026-10-05 and emrs 2026-10-10 are the
cleanest recent models — read their files first):

1. **`.build/extract-<house>.mjs`** — discovery fetch → fetch/parse → exit
   code, with `HOUSE_STATUS {json}` as the **LAST line on stdout** and any
   `HOUSE_GUARD` diagnostics on stderr. The crosstabs weekly block captures
   `2>&1` then `tail -1` — STATUS must be the last line of the combined
   stream, GUARD never after it. `--probe` prints the discovery summary for
   poll-agent.yml's `probe` job; `--force` refetches the cache. Export the
   pure parse functions for the test (lib-mode: no fetch when imported).
   The STATUS json carries `stale:[...]` (the crosstabs block greps it) and
   a `guard:true` member when the parse guard tripped (that arm joins
   `UNFINISHED`, never `STALE` — a guard is repair work, not staleness).
2. **Canon cache `.build/<house>-src/`** — machine-read reports land as
   `<ym>.txt` + `<ym>.json` sidecars (url, title, figures, firstSeen,
   published=firstSeen for machine-found waves), committed and TRACKED.
   Every run re-parses the cache and verifies the canon rows inside
   HEAL_DAYS (8) so a hand-correction to polls.json wins immediately;
   KNOWN_DIVERGENCE={} (Spectre convention — an accepted difference is a
   code change, never a silent waiver).
3. **`.build/<house>-updater.sh`** — secnewgate-updater.sh is the mould:
   acquire_slot_lock, dirty-tree refusal, freshness_sync, cache-only commit
   (`[.build/<house>-src]`), then on new figures validate.mjs →
   refresh_site → FILES=(data/polls.json .build/<house>-src SITE_FILES) →
   push_main. STATUS parse failure (no STATUS last line) exits non-zero
   AFTER warnings are flushed.
4. **`.github/workflows/<house>-update.yml`** — poll-agent.yml caller with
   house/wrapper/probe inputs, `apt_packages: poppler-utils` when the
   extractor pdftotext's, perms ceiling `contents: write` + `actions: read`
   (the streak check reads runs — pinned by test-workflows.mjs), a
   workflow_dispatch simulate_failure input, the `# schedule-tune:` opt-out
   comment if the window is declared, the GENERATED
   `# tune-schedules:begin/end` cron block (never hand-edit — run
   `--apply`), and a hand-authored daily full-run line AFTER the end
   marker. Hand-edit the comment `# schedule-tune: weekly only` when the
   declared window makes hour-measurement pointless.
5. **tune-schedules.mjs TARGETS** — if the house has no clock-time
   publication stamps, declare `{ window: ["HH:MM","HH:MM"], mode:
   "weekdays", step: 20 }` with a comment citing the evidence (Ipsos's
   Last-Modified stamps lead; EMRS's wave dates are date-only). NO `sweep`
   property when the caller's hand-authored evening line covers the
   weekend. `--apply`, then `--check` — the results list must name the new
   workflow `=current`.
6. **`test-tune-schedules.mjs` fixture** — its scratch `files` array
   enumerates TARGETS by hand. Adding a target without the fixture entry
   fails its `stale/updated/current` deepEqual (13th file needed for
   EMRS). Land both in the same commit.
7. **agent-repair.yml** — `<house>-update` in the `workflow_run` watch
   list AND the HP case map → `.build/<house>-repair-prompt.md`
   (test-workflows.mjs pins watch-list entries to real workflow names).
   The prompt is Spectre-shaped: pipeline map + STATUS/GUARD exits, NO_AGG
   status if state-only, VERIFY_FIELDS/heal contract, canon figures,
   published=first-seen rule, PDF quirks, the "only touch the extractor"
   constraint and the straight-to-main AUSPOL_PR_GATE note.
8. **`.build/crosstabs-updater.sh`** — weekly backstop block after the
   previous house's: run the extractor with `2>&1`, `tail -1`, log it,
   `STATUS*'"guard":true'*` → UNFINISHED, `STATUS*` → collect `stale`,
   `*` → UNFINISHED. Add `.build/<house>-src` to the porcelain check AND
   the FILES array. Header comment mentions the new house.
9. **`test-<house>.mjs`** — cache-oracle: parseWave over the committed
   cache reproduces CANON exactly; the cache's pathological lines (e.g. a
   typo the parser must kill) pinned PRESENT; every discovery/parse helper
   pinned against synthetic text including the negative cases (excluded
   links, disagreeing dates, prose-mimicking figures). Chained into
   `npm test` in package.json after the previous house's test.
10. **`validate.mjs` KNOWN_POLLSTERS** — the house was already a
    hand-entered member (polls.json rows exist); update the comment to say
    machine-read since <date> and canon-verified per run.
11. **MATILDA.md caller-count sentence** — "driven by N caller workflows".
    Ground-truth it: `grep -rl "uses: ./.github/workflows/poll-agent.yml"
    .github/workflows | wc -l`. The count was already stale for SEC
    Newgate when EMRS landed — write the VERIFIED number, never N+1.
    Houses vs utility jobs (crosstabs, sampleeff, pollbludger-fallback) is
    the sentence's own taxonomy.

Launchd installs are NOT part of the kit — install-launchd.sh's plist list
is hand-maintained and EMRS shipped CI-only; `bash .build/install-launchd.sh
--check` confirming unaffected is a verification step, not an edit.

NO_AGG houses (state-only polls): the row carries no aggregate weight. The
repair prompt, the ALL-polls display and the validate comment all describe
it; no estimator or eligibility change is needed for the filing itself.

QUIET_DAYS comes from the TRUE cadence, not the house's marketing: EMRS's
PDFs say "quarterly" but Feb→Aug 2026 is ~6-monthly → QUIET_DAYS=210 (SEC
Newgate's bi-monthly print said similar and got 100). coverage-watch and
the "no recent poll" verdicts key off it — under-set it and the watchdog
no-shows turn into spam.

## Debugging the parse against a real report

Fetch the PDF, `pdftotext -layout` it, and iterate on the LABELS/anchors
against the raw text — then commit the cache text as the test oracle. The
problems that only show in the real text (EMRS's: prose wrapping onto a
label's baseline; a lone curly apostrophe in "Hanson’s"; chart labels whose
sentence-case forms differ between waves; exec-summary fieldwork lines
contradicting the methodology bullet) are precisely what the fixtures must
pin. If the first-committed cache made a mistake, edit cache + test
together — never weaken the parse to fit a bad cache.

## Verification sequence before commit

validate.mjs → test-<house>.mjs → test-workflows.mjs → test-tune-schedules.mjs
→ tune-schedules --check → `bash -n` both touched wrappers → npm test.
Shared-repo hazard: re-grep every owned file for your edits IMMEDIATELY
before staging (a sibling session silently reverted the tune-schedules
TARGET between turns in this repo); commit explicit paths, never `git add -A`.
