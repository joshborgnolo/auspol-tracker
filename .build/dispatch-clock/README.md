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
runs are late again, and nothing else breaks.

## How it works

- `schedule.json` is **generated** by `.build/tune-schedules.mjs` (run by
  `schedule-tune.yml`) from the same measured release habits as the cron
  blocks. Times are Australia/Sydney wall-clock, so DST never changes it.
- Every minute the Worker (`worker.mjs`, logic in `clock.mjs`) fetches the
  table from `main` and dispatches each workflow that has a slot in that
  Sydney minute.
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
   - Expiry: up to a year. Note the date, because nothing checks this token.
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
- To pause the clock: `npx wrangler triggers deploy --crons ""`, or delete
  the Worker. The GitHub cron backup carries on either way.
- Once the clock has proven itself over a few release weeks, the cron
  blocks could shrink to their daily sweeps. That would also retire
  `SCHEDULE_TUNER_TOKEN`, which exists only so the tuner can rewrite
  workflow files.
