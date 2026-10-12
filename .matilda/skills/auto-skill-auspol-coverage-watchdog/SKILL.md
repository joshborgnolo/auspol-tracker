---
name: auspol-coverage-watchdog
description: auspol-tracker — the coverage-watchdog subsystem end-to-end (check-coverage.mjs witness parse → coverage-doctor.mjs classes 0–4 → coverage-check.yml jobs), the scratch-cwd/--wiki probing recipe for testing witness parser behaviour without touching repo state, and the MRP blind spots found 2026-10-10 and fixed same day in 080e190 (unlinked "(MRP)" firm cells, {{nowrap}} dates, the non-MRP date-union masking).
source: auto-skill
extracted_at: '2026-10-10T02:13:01.066Z'
---

# Coverage watchdog subsystem + verified MRP blind spots

## Architecture map

- `.build/check-coverage.mjs` (~430 lines) — reads only `(pollster, fieldwork-end)` pairs
  from the Wikipedia "Opinion polling for the next Australian federal election"
  wikitext (`?action=raw`, cached to `.build/logs/wiki-polls-cache.txt` on FETCH
  only). Outputs: `COVERAGE_STATUS {json}` + `FIRST_CONTACT {json}` lines, and
  writes `.build/logs/coverage-latest.json` (build.mjs reads it — never clobber
  the real one from a manual run). Exit: 0 current, 1 inconclusive (fetch/parse
  failed, <20 witness waves), 3 actionable (missing wave or overdue house with a
  newer witness wave). `DATE_SLACK_DAYS=3`; `CYCLE_START="2025-05-03"` string
  compare excludes the previous cycle.
- `.build/coverage-doctor.mjs` (~143 lines) — spawns the check in-process (the
  artifact JSON is gitignored so only the doctor sees it), reads
  `data/polls.json`'s `pollsterRules` for `stopped`/`skippedSlots`/
  `skippedMonths` explanations, and classifies: 0 clean | 1 monitoring-outage
  (GREEN by policy) | 2 defect (the ONLY class firing agent-repair; includes
  fallbackPolls-uncovered witness waves) | 3 provisional (wave on the page via
  fallback only → ci-alert issue, stays green) | 4 report-only (house silent,
  witness agrees, no confirmed-skip explanation → never a repair).
- `.github/workflows/coverage-check.yml` — jobs: `check` (doctor + comparators),
  `blind` (transient-streak.sh over class 1 runs; `STREAK_MIN: 2,
  STREAK_HOURS: 40` — with a daily cron that's red on day 2, despite comments in
  the yml header and MATILDA.md saying "third straight day"), `heartbeat`
  (writers-lock probe, 60h automation-commit, dispatch-clock), `thinness`,
  `staleness`, `alerts` (resolve-alerts).
- `fallbackPolls` rows never count as coverage: a covered wave is still reported
  but flagged `provisional: true`, which the doctor routes to class 3.
- Test: `.build/test-coverage.mjs` — fixture convention pins each live-layout
  row FORM (currently only plain-date, linked-firm, rowspan=2 rows). Rule from
  the Sep-2026 blindness: new live table shapes get pinned as new fixture forms.

## Verified defects (2026-10-10 audit) — FIXED same day, commit 080e190

All three verified empirically by the probe recipe below against real
`data/polls.json`. Net effect was: **zero MRP rows on the live witness table
parsed as waves** — the HOUSE `"(MRP)"` variants, `isMrp`, and the "match it
against that variant" comment were dead code, and the five tracked MRP poll
rows got no independent verification. The 080e190 fix landed every item of
the sketch below (plus the doubled ` (MRP) (MRP)` print suffix and the
m|r dedupe key), pinned the three live row forms + the masking case in
test-coverage.mjs tests 11–12, and probed clean against the live cache
(169 witness waves, incl. all 4 listed+tracked MRP waves). Kept here as the
diagnostic record — the row-form notes stay current.

1. `{{nowrap|…}}` date cells — every live MRP row carries one (cache lines
   1142, 2903, 3395…). The date scan's `lastIndexOf("|")` cut leaves
   `29 Apr – 14 May}}`; `endDate`'s `$` anchor rejects it → row silently
   dropped. (Only MRP/secondary-table rows use nowrapped dates today; the main
   2026 VI table uses plain dates, which is why the <20-waves guard doesn't
   trip.)
2. Unlinked `DemosAU (MRP)` / `RedBridge/Accent (MRP)` firm cells (all of them
   on the live table) — `HOUSE[houseKey(firm)]` lookup of `"demosau (mrp)"`
   fails → row falls to the first-contact branch → `isKnownName` substring
   suppression ("demosau" is a HOUSE key) → neither a wave NOR a surfaced name.
3. Linked `[[YouGov]] (MRP)` rows (the one form that parses) — the missing
   check builds `names = [MRP variants].concat([non-MRP variants])` and unions
   both series' dates into `tracked`, so a regular wave within ±3 days swallows
   a missing MRP (~40% of dates for a fortnightly house). Verified: synthetic
   YouGov MRP 2 days before the real 2026-10-06 wave produced no finding; a
   DemosAU-MRP control 6+ days clear correctly fired.
4. Minor: wave dedupe key `${house[0]}|${date}` omits the `mrp` flag (same-day
   regular+MRP rows collapse); `DOCTOR_POLLS` swaps only the doctor's rules
   read, not the in-process check's data read (the test works because it copies
   both scripts into the scratch repo and runs cwd there).

Fix sketch: normalise single-param templates (`{{nowrap|x}}`→`x`) before date
parsing; strip a trailing `(MRP)` before the firm-cell HOUSE lookup and set
`isMrp` from it; scope `tracked` for MRP waves to MRP variants only; add `mrp`
to the dedupe key. Pin each live row form (nowrap date, unlinked MRP cell,
linked MRP cell) in `test-coverage.mjs`.

## Scratch-cwd witness probe (no repo state touched)

check-coverage.mjs reads `data/polls.json` and writes `.build/logs/*` RELATIVE
TO CWD, so run the REPO script from a scratch dir:

```
mkdir -p .matilda/cov-probe/data
ln -sf ../../../data/polls.json .matilda/cov-probe/data/polls.json
cd .matilda/cov-probe && node ../../.build/check-coverage.mjs --wiki wiki.txt --quiet
```

- `--quiet` leaves only the two machine lines on stdout; parse `COVERAGE_STATUS`.
- To see the parser's intermediate lists, copy check-coverage.mjs +
  melbourne-time.mjs into the scratch dir and splice a `console.error` after
  `parseWitness(text)` — never edit the repo file.
- The 50k size floor applies to FETCHED text only, not `--wiki` files.
- Live row shapes to copy for fixtures (from `.build/logs/wiki-polls-cache.txt`):
  single-cell-per-line rows, date cell `| style="text-align: centre;" |
  {{nowrap|29 Apr – 14 May}}`, firm cell `| style="text-align: left;" |
  DemosAU (MRP)<ref …>` (unlinked) or `[[YouGov]] (MRP)` (linked).
- write_file refuses paths outside the workspace (BOGAN mode) — put the scratch
  under `.matilda/` (untracked) and `rm -rf` it afterwards.

## Adjacent skills

- `auspol-first-contact-importer` — the FIRST_CONTACT consumer (gate/pick).
- `auspol-poll-agent-no-show-triage` — uses coverage-check runs as a triage signal.
- `auspol-workflows-fleet-audit` — the CI fleet conventions the yml jobs follow.
