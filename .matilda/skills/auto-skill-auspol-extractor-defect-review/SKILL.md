---
name: auspol-extractor-defect-review
description: Fleet-wide defect-review findings and audit recipe for the per-house poll extractors (.build/extract-*.mjs + assimilators), from the 2026-10-07 review triggered by two News24 defects surfacing on the 6 Oct wave. Records the three recurring silence classes (unmodelled-content drop, stale-reprint acceptance, dead warning channels), the verified per-house defect census (Essential zero-cards, assimilator partial-null rows / dropped re-labelled waves, Resolve dead tripwire, Newspoll no prev-wave equality check, wrapper warn-swallowing), and the detection-layer blind-spot map (thinness = presence-not-freshness; validate Σ conditional on full CORE; wrappers log tail -1). Read before auditing, hardening, or debugging any poll agent or its watchdogs.
source: auto-skill
extracted_at: '2026-10-07T02:20:23.742Z'
---

# Extractor defect review (fleet-wide, 2026-10-07)

Origin: the 6 Oct 2026 News24 wave exposed two live defects (a new 2PP
crosstab embed layout filed as "unmodelled" and silently dropped; a
re-saved PREVIOUS-wave PPM embed filed as fresh). Both were fixed same-day
(commits `60e95bb`, `d0c2b6b`; see the `news24-extraction` skill for the
News24-specific machinery and its own remaining-defect census A1–A7).
This skill records what the follow-up fleet review found everywhere else.

## The three silence classes (these repeat across houses — grep for them)

1. **Unmodelled-content drop**: a parser encounters content it has no
   model for and produces nothing — no error, no note, no problem string.
   Detection surface is nil. (News24 unmodelled embeds was the instance.)
   Audit pattern: find every `null`/`continue` fall-through in classify
   and merge paths and ask "who sees this?"
2. **Stale-reprint acceptance**: a source re-publishes the previous
   wave's exact figures (re-titled embed, duplicate PDF card, Wikipedia
   row re-labelled) and the extractor files them as a new wave. Only
   News24 has a prev-wave staleness check (`n24PrevWave`); NO other house
   compares a candidate wave's figures against the previous committed
   wave. Assimilators actively DROP such duplicates silently (below).
3. **Dead warning channels**: a script detects something worth knowing
   and emits it where nothing consumes it — a warn-and-exit-0, a status
   JSON field no wrapper reads, a note line scrolled past by
   `tail -1` logging. The single model counterexample is
   `secnewgate-updater.sh` (~:68-80), which scans status and promotes
   WARN/pending to a fatal exit 1. Adopting that pattern fleet-wide was
   recommendation 3 of the review.

## Per-house findings (verified 2026-10-07; fix status unknown, re-check)

- **Essential (`.build/extract-essential-report.mjs` ~:510)**: a crawled
  report page yielding ZERO figure cards logs a warning and exits 0. The
  wrapper checks only the exit code ⇒ a report whose card markup changed
  is skipped INDEFINITELY with a green run. With the incremental-crawl
  union merge, the missing page never re-reads unless its `modified`
  moves. Highest-value fleet fix: make zero-cards fatal (or fingerprint-
  gated) the way SEC Newgate promotes WARN.
- **Essential assimilator (`.build/assimilate-essential-vi.mjs`)**:
  - ~:301-313 — primaries are filed with `?? null`, so a partially-parsed
    wave files a polls row with some CORE primaries null. Invisible to
    every watchdog: validate.mjs runs the primary Σ100 check ONLY when
    all CORE parties are non-null; check-poll-thinness inspects
    firm-keyed sections + `published`, never polls-row primaries;
    check-coverage watches Wikipedia dates. A partial-null row looks
    complete everywhere.
  - ~:317-319 (same in `assimilate-resolve-vi.mjs` ~:183-184) — a wave
    whose figures EXACTLY duplicate an existing date's row is silently
    dropped before writing. This is the duplicate-guard working, but it
    means a source that RE-LABELS a previous wave under a new date (the
    stale-reprint class) also vanishes silently — the assimilator
    neither files it nor tells anyone.
- **Resolve (`.build/extract-resolve-rpm.mjs` ~:562)**: emits a
  `source_updated` tripwire field; NO consumer exists. Dead channel.
- **Newspoll (`guardCluster`)**: cross-outlet + Infogram guards exist,
  but no prev-wave figure-equality check — a sole-source reprint of the
  previous wave's numbers would file (class 2).
- **Poll Bludger fallback**: the leaders-canary trips only at count > 0
  in 20 rows; 2 of 20 passes. Threshold tuned to never fire usefully.
- **Roy Morgan / Spectre / DemosAU / RedBridge**: warn-only anchor
  misses, `status.mismatches`, notes, and AFR NOTE lines respectively —
  all emitted, all wrapper-ignored (class 3). DemosAU DOES delete
  `samplePending` on fill (extract-demosau.mjs:832) — the pattern
  News24's upgrade path lacks (its `Object.assign` never deletes).

## Detection-layer blind-spot map (what actually catches what)

| Layer | Checks | Blind to |
|---|---|---|
| `validate.mjs` | schema, Σ100 (only when ALL CORE non-null), flags like `fieldwork-pending` | partial-null rows; stale/fresh correctness |
| `check-poll-thinness.mjs` | per-house presence ratios (ppm/approval/altTpp/ppmHeadToHead/published), ≥80% model, GRACE_DAYS=2, daily 09:30 AEDT | polls-row primaries entirely; freshness (a stale-figure row is "present"); first 2 days after filing |
| `check-coverage.mjs` | Wikipedia table dates (majors) vs polls.json | any house absent from Wikipedia (DemosAU, RedBridge/Accent use plain-text firm cells); content correctness |
| wrappers | exit code, `tail -1` of log | every warning channel above |

Consequences measured in the review:
- The missing News24 altTpp WOULD have been caught by thinness ~3 days
  after filing (all four YouGov presence ratios are 1.00) — the 2-day
  grace was the only blind window.
- A stale/duplicated PPM has detection time ∞: every watchdog checks
  presence, not freshness, and there is no independent leadership
  witness (that's why the owner caught it, not a job).
- Fleet no-show bounds if a house stops filing: majors ~1 day
  (Wikipedia witness); irregular houses effectively unmonitored —
  Spectre ~251 days, Wolf & Smith ~517 days before cadence-based
  suspicion.
- No "green but noteworthy" human channel exists anywhere: notes die in
  per-house logs.

## Ranked recommendations from the review (owner not yet approved)

1. Close the silent-unmodelled class: exit 2 (or a blocking problem) on
   unrecognised content that previously classified; soak-test shape
   gates against every committed fixture.
2. Extend the News24 staleness check to tpp/altTpp, then generalise as
   a `check-poll-staleness.mjs` watchdog beside thinness.
3. Adopt the SEC Newgate wrapper pattern (promote status WARN/pending
   to failure) in every wrapper.
4. Essential zero-cards → fatal; assimilators → reject (or loudly flag)
   partial-null primary rows.
5. News24 hygiene: relax `parseSatisfaction` anchoring, note-protect
   canon on in-place upgrade, walk `canUpgrade` back ~3 waves, delete
   `samplePending` on fill.
6. Later: Poll Bludger leadership witness; grep provenance for stale
   `null` families.

## How to re-run this audit (the method that worked)

- Read ONE house's pipeline end-to-end (extractor → assimilator →
  wrapper → watchdog entries); large files want full reads, greps miss
  the fall-throughs.
- For every `catch`, `?? null`, `continue`, and warn-and-exit-0: trace
  who could ever see it. Classify the finding into the three silence
  classes above.
- Ground every claim with `sed`-style line citations before reporting —
  the review's per-house items above were each verified at the cited
  line range.
- Cross-check detection by asking, for each defect: which watchdog
  fires, and in how many days? Presence ≠ freshness is the recurring
  gap.
- See also: `poll-agent-no-show-triage` (coverage-gap triage),
  `ci-run-failure-triage` (failure classification), `layout-healer`
  (exit-2 data stand-in), `auspol-build-pipeline` (system map).
