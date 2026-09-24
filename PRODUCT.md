# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

General readers following Australian federal politics who want a quick, trustworthy read on "who's ahead" without wading through individual house-to-house poll noise or an aggregator that doesn't show its work.

## Product Purpose

Aggregates every published Australian federal voting-intention poll into one place: searchable, sourced back to the original release, tracked over time, and presented simply and beautifully. Success is a reader trusting the headline number because they can see exactly how it was built and check it against the individual polls behind it.

## Positioning

Most coverage reports one house's release in isolation, or aggregates without showing its work. auspol tracker keeps every individual poll visible and linked to its source, states the sample- and recency-weighted, house-effect-adjusted method behind the headline 2PP in the open, and says plainly when a month-on-month move doesn't clear its own uncertainty interval — a same one-number aggregator can't credibly copy that mechanism without matching the same transparency.

## Operating Context

- Ships as static files, built by `node .build/newtracker/build.mjs` from `data/polls.json`: `index.html` plus the webfonts and the past-cycle source rows it fetches from the same origin. No backend, no framework to install, nothing served from anyone else's host.
- Hosted on GitHub Pages at auspoltracker.com (repo `joshborgnolo/auspol-tracker`).
- Polls arrive automatically. Each pollster has its own updater (`.build/*-updater.sh`: extract, validate, rebuild, commit, push), run on that house's release schedule both as a GitHub Actions workflow and as a launchd job on the maintainer's Mac, whose Chrome session reaches sources the cloud runners can't. `schedule-tune` keeps each schedule on the house's measured release habit. The weekly crosstabs updater fills the vote-by-group and vote-switching tables. If a house's own extractor hasn't landed a wave 18 hours after it appears on Poll Bludger's poll-data feed, a fallback files it as a provisional row, which the real one replaces automatically.
- Watchdogs: a citation sweep over every source link, a coverage check for polls published but not captured, a live-site check, and the test suite. Any failing workflow on main triggers an AI repair agent that diagnoses the failure, reproduces it and proposes a minimal fix behind a deterministic gate.
- A poll can still be added by hand: edit `data/polls.json` following the pollster conventions in `README.md` (e.g. Roy Morgan's respondent-allocated 2PP, Newspoll/Resolve often publishing no headline 2PP, leadership rows keyed to fieldwork end), then rebuild.
- Readers report a wrong figure, a missing poll or a bug on `/feedback/`, a hand-maintained Formspree form. Nothing moves until it has been checked against the pollster's own release.

## Capabilities and Constraints

- Aggregates federal voting intention (primary vote, 2PP), leader approval / preferred PM, and right-direction/wrong-track across pollsters, plus an ALP-v-One Nation 2PP series and past-cycle history.
- The headline 2PP is a nowcast: the last three weeks of polls, weighted by sample size and recency (a poll's weight halves each week and fades out by day 21), each house's lean removed, with a 95% interval. It sets Labor against whichever of the Coalition or One Nation runs it closer, and defaults to the implied basis: the 2PP read off the primary-vote aggregate at a fixed 2025 preference-flow table, with the pollsters' own published figures one switch away. Measures polled about weekly or less use a six-week window.
- The page has four tabs. Snapshot: the headline, primary vote, the latest poll from each house, leader ratings and preferred PM, national direction, next expected polls, the vote by age, gender and education, where One Nation's new voters came from, and the undecided share. Past cycles: the current term against the last twenty elections. All polls: the full poll list plus panels on poll disagreement, house lean and preference-flow drift. Info: the method, a reading guide and sources.
- Satellite pages: `/prediction/` (the government's modelled chance of re-election, read from nineteen completed federal terms and regenerated daily by `.build/refresh-prediction.mjs`), `/atlas/` (margins and swings for every federal electorate since 2004), `/archives/` (the historical Newspoll, AC Nielsen, Morgan and Galaxy records and the Trove poll-mention index), `/preference-flows/` (the two 2PP bases, worked line by line) and `/feedback/`. Plus an RSS feed of new polls (`feed.xml`).
- No seat-by-seat projections: MRP releases are recorded for their national figures only.
- Every poll is individually visible, searchable, sortable, exportable as CSV, and links back to its original published source.
- "Next expected polls" projects each house's next likely release from its own recent publication rhythm; a slot that goes overdue stays marked overdue — in the panel and in the nav-bar countdown, which reads "N days overdue" — until the release is actually recorded, rather than being silently rolled forward onto a guessed date. A house that has stopped publishing is removed by hand (`pollsterRules.stopped`), never inferred from silence.
- The build refuses to produce a page from data that fails validation; known-good pollster oddities are recorded as documented exceptions rather than treated as errors.
- No server, no database, no user accounts — `data/polls.json` is the single source of truth, and `index.html` and `prediction/index.html` are generated artifacts that must never be hand-edited.

## Brand Commitments

Name is "auspol tracker" — plain and descriptive, no separate brand identity beyond its own typography/masthead treatment.

## Evidence on Hand

- `data/polls.json`: the full canonical historical dataset, back through past electoral cycles, with `data/polls.schema.json` documenting every field.
- `assets/auspol-card.png`: the live Open Graph share card, regenerated by hand from the page's own rendered data whenever it drifts.
- `data/demographics.json` and `data/vote-switching.json`: the per-wave crosstab tables behind the vote-by-group and One Nation sources panels.
- `data/prediction-history.json`: every daily read of the re-election model; `data/np-report.md`: the hit-rate record of "Next expected polls".
- `atlas/data/`: AEC division results (2PP by division for every election since 2004, and the 2025 downloads).
- `README.md` documents the build pipeline, pollster conventions, and the 2PP method in detail.

## Product Principles

- Every number stays traceable to its source poll and its exact weighting math — nothing is asserted without a way to check it.
- State uncertainty rather than hide it: a move that doesn't clear the interval is labelled as such, not reported as real.
- The dataset is the single source of truth; the page is always a rebuild away from it, never hand-patched.
- Prefer a documented exception over a silent one: a build that passes validation should mean the data is actually clean.

## Accessibility & Inclusion

No formal accessibility standard has been established for this project.
