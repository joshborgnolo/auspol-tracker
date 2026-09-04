---
name: auspol-thinness-backfill
description: auspol-tracker — triaging and clearing the check-poll-thinness.mjs watchdog (coverage-check.yml `thinness` job): adjudicate each finding against primary-source methodology PDFs (extraction-gap vs genuine non-ask → backfill vs EXCEPTIONS entry), where to source historical Sky Pulse/YouGov figures when the News24 upgrade gate won't backfill them (europesays.com / miragenews.com full-text mirrors, corroborate via next wave's "previously" chain), the ppm/approval/ppmHeadToHead row shapes, and the RECALIBRATION CASCADE — filling one hole raises the house rate over the 80% threshold and exposes the adjacent hole, so always re-run and expect a second wave of findings.
source: auto-skill
extracted_at: '2026-09-04T00:36:34.280Z'
---

# Thinness watchdog: adjudicate, backfill, expect the cascade

`.build/check-poll-thinness.mjs` asks "the wave landed — did it land with the rows
its house normally carries?" (check-coverage.mjs only asks whether it landed at
all). It runs in the `thinness` job of `coverage-check.yml` (daily 22:30 UTC /
08:30 AEST cron + on push) and goes red via email until cleared.

## Mechanics (env-tunable constants at the top of the file)

- Window 120 days (`PT_WINDOW`), per-wave grace 2 days (`PT_GRACE`),
  `MIN_WAVES=4` before inferring a pattern, expectation threshold
  `EXPECT_RATE=0.8` (`PT_RATE`).
- Sections checked: `ppm`, `approval`, `altTpp`, `ppmHeadToHead` — plus the
  `published` flag, the tell for a YouGov wave that landed Wikipedia-only when
  the News24/Chrome enrichment leg degraded.
- A section is expected of a house only when the house files it on ≥80% of
  in-window waves **since that section's all-history `firstSeen` date** (so a
  house that only recently started filing e.g. altTpp isn't blamed for older
  waves). Rate below 80% → "not this house's habit", never flagged.
- Emits `PT_STATUS {…}` JSON; `fired:false` + exit 0 = clean.
- `EXCEPTIONS = []` at top of file is for waves the house GENUINELY did not
  report — add only after adjudicating against the release; an exception hides
  a real hole exactly as well as it silences a false alarm (says the file's own
  comment).

## Triage: extraction gap or genuine non-ask

Adjudicate against primary sources BEFORE touching data:

- **APC methodology statement PDFs** are the arbiter. Newspoll's methodology
  lists the leader questions (Q4–Q12); the Sky Pulse APC PDF
  (`YouGov_SkyPulse_<dd>_<mm>_<yy>_APC_Methodology_Statement.pdf`) contains the
  PPM question wording ("Which of the following do you think would make the
  best Prime…") when the wave genuinely asked it.
- If the wave asked but our rows are missing → extraction gap → **backfill**.
- If the wave genuinely didn't ask → add to `EXCEPTIONS` with `house/date/
  missing/why`.
- **The extractor will NOT fix historical gaps for you.** extract-news24.mjs's
  upgrade gate (`canUpgrade = client==="News24" && !published && !!news24Url`,
  ~L943) only enriches the latest/new waves; `.build/logs/news24.log` showing
  `news24:{attempted:0,…}` confirms it left the old wave alone. Historical
  backfill is a manual fetch-and-insert job.

## Sourcing historical Sky Pulse / YouGov figures

SkyNews.com.au pieces are paywalled, but free mirrors carry the full release:

- `europesays.com` — full text of the Sky News Pulse / YouGov release
  (leadership section has preferred-PM pairs, the Hanson H2H, satisfaction
  detail). `curl -A <browser UA>` + strip tags works; search by the headline.
- `miragenews.com` — Poll-Bludger-style digest (Adrian Beaumont) of the same
  wave with every figure.
- **Corroborate with the next wave's write-up**: these pieces quote the prior
  wave inline ("led Taylor 44–35, previously 43–38"; "led Hanson 49–40,
  previously 48–41"). Fill wave N, then read wave N+1's "previously" figures
  back against what you inserted — a free self-checking chain that also hands
  you the next wave's missing row.
- The watchdog's hint text points at the same place: "check status.news24 in
  .build/logs/news24.log". A wave with no `published` field and `attempted:0`
  is the degraded-Wikipedia-only landing.

## Row shapes (mirror the existing era's rows exactly)

- `ppm`: `{date, firm, alb, opp, oppName, han, extra}`. Newspoll Hanson-era
  three-way **forced choice** goes at top level (`alb/han/opp`, per the 07-16
  pattern) with the standard two-way better-PM in `extra:[{alb,opp}]`; YouGov
  rows are `han:null, extra:null`.
- `approval`: `{date, firm, alb, opp, oppName, han, detail:{alb:{app,dis},
  opp:{app,dis}, han:{app,dis}}}` — include Hanson only from the wave the house
  first asked her (Newspoll: 06-25).
- `ppmHeadToHead`: `{date, firm, alb, han}` — MULTI-house (Spectre, YouGov,
  DemosAU, Newspoll all file it), not Newspoll-only.
- Do NOT store derived crosstabs. Newspoll 06-25's "Albanese 57–43 among Taylor
  supporters" is a subset breakdown, not the published H2H question (which
  Newspoll only began publishing 08-07) → no ppmHeadToHead row for it.

## The recalibration cascade (the gotcha that defines this job)

Filling one hole changes the RATE the calibration runs on. Worked example from
2026-09-04: YouGov `ppmHeadToHead` stood at 6/8 = 75% < 80% → section not
expected, so 06-16 and 06-30 gaps were invisible to the watchdog. Backfilling
06-16 made it 7/8 = 88% ≥ 80% → expectation switched ON → the 06-30 hole
immediately became a finding. The fix for a finding can manufacture the next
finding in the same house.

- **Always re-run `node .build/check-poll-thinness.mjs` after each backfill
  batch** and budget for a second (or third) round of findings — don't report
  "green" on the strength of the pre-backfill run or a run midway through.
- Cascade math also tells you when a hole CAN'T be flagged: two missing waves
  in an 8-wave window = exactly 75%, just under threshold — a hole can lurk
  under the calibration floor indefinitely. Spot-check dense houses against
  the mirrors occasionally; the watchdog is conservative by design.
- Clear order: JSON.parse the file → insert rows → `validate.mjs` → re-run
  thinness until `fired:false`. Commit data-only via the pathspec drill in
  `shared-repo-session-race` when sibling WIP dirties the build inputs —
  coverage-check reads `data/polls.json` from the repo, so the watchdog clears
  without a site rebuild; the next pipeline build ships the rows to the site.
