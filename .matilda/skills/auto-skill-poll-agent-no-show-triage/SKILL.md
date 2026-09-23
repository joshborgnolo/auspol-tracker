---
name: poll-agent-no-show-triage
description: auspol-tracker — "the <house> poll was released but the agent did nothing" triage: most no-shows are TIMING gaps, not breakage. Check the CI workflow's recent runs (elapsed anomalies) and coverage-check, diff the source's publish timestamp (RPM_STATUS.source_updated and friends) against the cron schedule, run the extractor's --check locally to prove the feed is readable, read the launchd wrapper log for dirty-tree/lock refusals, then land the wave by hand via the house's normal pipeline (extract -> assimilate -> validate -> build -> commit the explicit files), and consider adding a cheap late-evening cron slot. GitHub cron is UTC; AEST = UTC+10, DST-watch.
source: auto-skill
extracted_at: '2026-09-13T12:12:43.755Z'
---

# Poll-agent no-show triage (worked: Resolve 2026-09-13 wave)

Symptom: "the Resolve agent didn't work — poll got released, nothing happened." Root cause was
NOT a broken extractor: Nine pushed the payload (`source_updated 22:03 AEST Sunday`) *after* the
CI workflow's single 07:00 AEST daily slot, and the launchd backup had been refusing its slots on
the shared-repo dirty tree all week. The wave appeared on the next manual run immediately.

## The 5-probe chain (run before touching an extractor)

1. **Did CI fire and what did it cost?**
   `gh run list --workflow=<house>-update.yml --limit 5` — all-green runs of ~10–25 s are no-op
   sweeps; an anomalous multi-minute run is the repair job or a real extraction (inspect it with
   `gh run view <id>` before believing it). Also `gh run list --workflow=coverage-check.yml --limit 3` —
   the gap watchdog green means the schedule, not coverage, produced the miss.
2. **When did the SOURCE publish vs when does the cron run?** Fetch the data and read the feed's
   own timestamp — for Resolve that's `RPM_STATUS.source_updated` from
   `node .build/extract-resolve-rpm.mjs --check`; `news24`, `spectre`, etc. carry equivalents.
   cron is UTC (`grep cron .github/workflows/<house>-update.yml`); AEST = UTC+10
   (AEST evening 22:03 = 12:03 UTC). A payload that lands after the last cron of the day sits ~10h.
3. **Prove the extractor sees the new wave**: the same `--check` (or real dry-run) prints
   `new_dates` — non-empty with `changed:false`-style no-op exit means the pipeline is healthy and
   only the schedule missed it. If `--check` errors, THAT's the repair case instead (exit-code
   contract per skill; RPM_ERROR / RPM_GUARD).
4. **Why didn't the local backup fire?** `tail -40 .build/logs/<house>.log` — the signatures in
   this repo: `working tree dirty ... refusing to write & commit on a dirty base` (sibling Matilda
   sessions keep the tree dirty; by design), `writers lock lost to a concurrent wrapper`, stale-lock
   reaping lines. The launchd job being quiet is usually etiquette, not death.
   **Multi-house, multi-week silence upgrades this from etiquette to root cause** (worked
   2026-09-23): Essential AND Spectre optional series (national direction) both stalled at
   2026-08-31 while every CI extractor stayed green. The blocker was one dirty TRACKED build
   artifact — a compiled `assets/9f09dca2-*.js` bundle left modified by an earlier session —
   and since every launchd wrapper refuses a dirty tracked base, ONE stray modification muted
   the whole local tier for ~11 days. When several launchd-backed houses go quiet together,
   `git status` FIRST: commit the artifact properly (or revert orphan dirt) and the tier
   resumes on its next slots. Do not mistreat it as per-house extractor breakage.
5. **Environmental hazards**: `df -h .` — a 100%-full disk kills launchd writes and surfaces as
   bizarre git errors (see below). Do this before assuming logic bugs.

## Landing the wave by hand

Run the house's normal pipeline exactly once, from the repo root, per the house skill's recipe.
For every extractor-based house the shape is: `extract-*.mjs` (real run) -> assimilator `--apply`
(DRY-RUN FIRST and eyeball the added rows) -> `node .build/newtracker/validate.mjs` (exit-gated)
-> `node .build/newtracker/build.mjs` -> commit ONLY the explicit files the pipeline owns
(data/polls.json, the house CSV/provenance, index.html, feed.xml, sitemap.xml, robots.txt if
changed) -> push.

Shared-repo push finish, stood up twice in one evening:

```sh
git pull --rebase --autostash origin main && git push origin HEAD:main
# autostash carries sibling sessions' unstaged dirt through the rebase and restores it
git log --oneline -1   # expect your commit atop the new remote head
```

## The disk-full push that "succeeded"

If `git push` prints the remote update line (`ef42963..6b095ff HEAD -> main`) and THEN
`error: update_ref failed ... No space left on device`, the REMOTE accepted the move — the local
`origin/main` ref just couldn't be written. Don't repush blindly; verify and repair:

```sh
git ls-remote origin main                       # confirms the remote head IS your sha
git update-ref refs/remotes/origin/main <sha>   # repairs the stale local ref
df -h .                                          # warn the user: 208Mi free breaks launchd + builds
```

## Closing the gap properly

If the miss was schedule-shaped, add a slot — no-op sweeps are seconds of CI, so density beats
latency. Precedent `f04b452`: `resolve-update.yml` gained `- cron: '0 13 * * *'` (23:00 AEST
daily) after Nine pushed a wave at ~22:00 AEST. Convert times explicitly in a comment
(UTC cron vs AEST/NEST), note the observed publish timestamp that motivated the slot, and remember
the Eastern clock jumps in DST while GitHub's clock doesn't.
