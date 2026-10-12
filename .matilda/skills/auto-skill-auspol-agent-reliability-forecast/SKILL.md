---
name: auspol-agent-reliability-forecast
description: auspol-tracker — estimating "will the <house> poll agent work without a hitch when tomorrow's wave drops?" Compose the probability from cadence + CI green-rate + the per-job map + wrapper STATUS JSON, with the worked finding that green runs can mean the fix under question was never invoked (clock-skipped update job; N24_STATUS "news24":{"enabled":false}) — and always quote TWO numbers (hitch-free vs on-site-somehow), because the graceful-degradation chain (launchd Chrome, Poll Bludger provisional, coverage watchdog) lifts the second far above the first. (worked 2026-10-06, YouGov/News24 across the fetchWithCookies Akamai-wall fix)
source: auto-skill
extracted_at: '2026-10-06T03:42:31.549Z'
---

# Pre-release reliability forecast for a poll agent (worked 2026-10-06, YouGov/News24)

Question form: "will the <house> agent work when the poll releases tomorrow?" Don't guess —
compose the estimate from five cheap probes. The load-bearing lesson: **a green CI run is not
evidence the code path under question ran at all.**

## 1. Confirm a release is actually DUE, before estimating anything

Read the houses' `published` clock times out of polls.json (one `node -e` over
`d.polls.filter(p => /<house>/i.test(p.pollster))`). YouGov/News24 is metronomic fortnightly
(`…T05:00` Wednesdays); last wave 2026-09-23 ⇒ next due 2026-10-07. Houses with looser cadence
(Essential ~3-weekly, DemosAU ad hoc, RM weekly but slips) make the question conditional: fold a
release-slip probability (~5% for YouGov) in as a separate hatch so "agent" reliability isn't
conflated with pollster scheduling.

## 2. CI green-rate (necessary but NOT sufficient)

`gh run list --workflow=<house>-update.yml --limit 25 --json databaseId,conclusion,createdAt`.
News24: 25/25 green back to 2026-09-29. Treat that only as "nothing is on fire" — see §3.

## 3. Job-map probe: did the update job even run?

Each `news24-update` run is `run / clock` + `run / update`. The clock job SKIPS the update job
when the dispatch-clock already served every slot of its cron line — so a wall of green runs can
contain zero extractions:

    gh api repos/:owner/:repo/actions/runs/<id>/jobs --jq '.jobs[] | "\(.id) \(.name) \(.conclusion)"'

Worked: 2026-10-06T00:50Z run = `clock success / update skipped`; walk back to the run whose
`update` job actually ran (2026-10-05T19:20Z in this case).

## 4. Wrapper STATUS JSON: which subsystems engaged

    gh run view --job <update-job-id> --log | grep -iE 'STATUS|cookie|pulse|wave'

Every house wrapper prints one `<HOUSE>_STATUS {json}` line. Worked finding: the single live
run since the 2026-10-05 `fetchWithCookies` Akamai-wall fix reported
`"news24":{"enabled":false,"attempted":0}` — the News24 enrichment path (the one needing the
cookie jar) never engaged, so a one-day-old wall fix had **zero live exercises** despite
`test-fetch-cookies.mjs` pinning it. Unit tests ± a fixture are not Akamai's production
behaviour; discount any fix younger than its first real-wave exposure. Also read the discovery
channels inside the same JSON (`candidates`, `skipped_existing`, `fallback.checked`, `unparsed`)
— e.g. News24 has three near-independent discovery channels (YouGov global RSS, Pulse topic
scan, Wikipedia fallback) which makes discovery failure genuinely rare.

## 5. Alert state

`gh issue list --label ci-alert --state open` (empty at the time) — open breaker issues or
transient-streak warnings are direct deductions.

## Composing the answer — always quote TWO probabilities

- **P(hitch-free)**: scheduler (dispatch-clock + cron fallback + launchd backup ≈ independently
  redundant), discovery (channels from §4), extraction (discount unexercised fixes; note
  wall-class fixes sit in an arms race — a per-call cookie jar breaks again the day the wall
  moves to JS challenge / signed cookies / TLS fingerprinting), push races (push_main owns
  those). Worked YouGov figure: **~75–80%**.
- **P(on the site within the same window via SOME channel)**: layered degradation —
  launchd laptop job (Chrome fallback on there, off under GITHUB_ACTIONS), Poll Bludger
  provisional row at 18h grace, classify-failure keeping hits green, coverage-check emailing a
  human. Worked: **~95% same day, >99% within 48h**. The gap between the two numbers is the
  headline of the answer — "doesn't need to be infallible" is exactly the system design.

Offer the cheap de-risk when a critical rung is unexercised: run the extractor by hand against
a couple of known live story URLs today (`node .build/extract-news24.mjs --url …`) so first
contact with the new code is a test, not the real release.
