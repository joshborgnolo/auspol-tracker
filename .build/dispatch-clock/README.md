# Dispatch clock

A Cloudflare Worker that starts the updater workflows on time.

## Why

GitHub's `schedule` trigger is the only clock the updaters had, and in
September 2026 it ran them 2–5 hours late at the median (a lower bound,
measured against the nearest earlier cron slot). It dropped Roy Morgan's
entire Monday release window on 14 and 21 September. On the 21st, none of
the 17 slots ran inside the window and the late ones arrived 7–8 hours
after their times; the wave landed only because it was dispatched by hand.
A `workflow_dispatch` starts a run within seconds, so this Worker sends one
at each slot.

The workflows keep their cron blocks as the backup. If the Worker stops,
runs are late again, and nothing else breaks. Deployed 2026-09-24; every
slot since has started within a minute.

Two checks read the clock's work back out of GitHub's run list
(`served.mjs`, pinned by `.build/test-dispatch-clock.mjs`):

- **The backup skips itself.** A cron-triggered run of a house workflow
  first asks whether the clock already started every slot of the cron line
  that fired it, in the last day, and whether those runs went green (or are
  still in flight but fresh — a prompt cron must not double its own slot;
  a run stalled in a queue for longer counts as undone). If so, its update
  is skipped: the second run would only fetch the pollster's site again. A
  slot the clock never carries, a failed dispatched run, a cron line still
  on last week's UTC offset or any API error means the update runs.
- **The heartbeat.** coverage-check.yml's heartbeat job counts the table's
  slots in the last 24h that got a dispatched run (within 10 minutes, so a
  retune that nudged a comb doesn't count against it; one run serves one
  slot). Slots before the table's own `generatedAt` stamp aren't judged:
  a retune that adds or moves slots can't report yesterday's
  impossible-to-have-served slots as misses. Under 90% warns;
  under half fails the job, which emails. The likeliest cause is the token
  below expiring.

## How it works

- `schedule.json` is **generated** by `.build/tune-schedules.mjs` (run by
  `schedule-tune.yml`) from the same measured release habits as the cron
  blocks. Times are Australia/Sydney wall-clock, so DST never changes it.
  Its `generatedAt` stamps the slot list's last change — the heartbeat
  scores from it, so a retune doesn't read as a day of misses.
  It also carries `FIXED_SLOTS` from that script: np-score and
  prediction-refresh, the two daily ledgers, whose missed day can't be
  recovered. The clock is their second trigger beside their own cron line,
  which the tuner's weekly pass keeps on the current offset (the
  `tune-fixed` markers in those files).
- Every minute the Worker (`worker.mjs`, logic in `clock.mjs`) fetches the
  table from `main` and dispatches each workflow that has a slot in that
  Sydney minute. A failed table read is retried in the same tick (Cloudflare
  never retries a cron event), and one workflow's error can't take the rest
  of the minute with it.
- Opening the Worker's URL returns the Sydney time and the next twelve
  dispatches. It's read-only and holds no secrets.
- `.build/test-dispatch-clock.mjs` pins the matching logic, the table's
  integrity (every workflow exists and accepts `workflow_dispatch`) and the
  exact API call.

## Deploy (one-off, about 10 minutes)

1. Create a **fine-grained personal access token** at
   github.com → Settings → Developer settings → Fine-grained tokens:
   - Repository access: *Only select repositories* → `auspol-tracker`
   - Permissions: **Actions: Read and write**. Nothing else is needed;
     Metadata: read is added automatically.
   - Expiry: up to a year. Note the date. Nothing reads it in advance; the
     heartbeat goes red within a day of the token failing.
2. In Terminal (quote the path: it has a space in it), run these one at a
   time:

   ```sh
   cd "/Users/joshuaborgnolo/auspol tracker/.build/dispatch-clock"
   npx wrangler login                    # opens the browser: log in (a free account is enough), Allow
   npx wrangler deploy                   # creates the Worker; say yes if it offers a workers.dev subdomain
   npx wrangler secret put GITHUB_TOKEN  # type GITHUB_TOKEN as written: it is the secret's NAME
   ```

   The last command then asks `Enter a secret value:`. Paste the token
   there. Nothing shows as you paste. Press Enter. Never put the token on the
   command line itself, where your shell history keeps it.
3. Check it:
   - Open the `*.workers.dev` URL `wrangler deploy` prints. `next` should
     list the coming slots.
   - At the next slot, the workflow's Actions list shows a
     `workflow_dispatch` run started within a minute of it.
   - `npx wrangler tail` streams the dispatch log.

## Operating notes

- A retune shows up as a diff to `schedule.json` in a
  "Tune poll-agent schedules" commit. The Worker picks it up within about
  10 minutes (raw.githubusercontent.com and the edge both cache for about 5).
- Logs persist: `[observability]` in wrangler.toml turns on Workers Logs, so
  a failed dispatch is still findable when the daily heartbeat fires (plain
  `npx wrangler tail` is live-only).
- To pause the clock: `npx wrangler triggers deploy --crons ""`, or delete
  the Worker. The GitHub cron backup carries on either way.
- The cron blocks no longer need thinning: while the clock works, their
  runs skip themselves in seconds, and when it stops they are the backup
  again with no one having to notice first. Shrinking them to the daily
  sweeps would retire `SCHEDULE_TUNER_TOKEN` (it exists only so the tuner
  can rewrite workflow files), at the cost of that automatic fallback.
