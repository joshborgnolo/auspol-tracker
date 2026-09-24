# auspol-tracker — repo orientation for Matilda

Single-file Australian federal polling tracker. `index.html` (~14.7k lines) is
a GENERATED build artifact — never hand-edit it.

## Layout

- `.build/newtracker/` — the build system:
  - `template.html` — page shell (CSS, copy, `<!--STATIC_SUMMARY-->` /
    `<!--SCRIPTS-->` markers)
  - `gen-data.mjs` — data pipeline: aggregation estimator lives inline
    (~lines 100–300)
  - `build.mjs` — builder; rebuild with `node .build/newtracker/build.mjs`
  - `validate.mjs` — validation: `node .build/newtracker/validate.mjs`
  - `render-card.mjs` — og:share card redraw (needs `puppeteer-core` +
    `CHROME` env)
- `data/polls.json` — canonical poll rows (never hand-edit; extractors write it)
- `.build/extract-*.mjs` + `.build/*-updater.sh` — pollster extractors and
  their scheduled pipelines. GitHub Actions runs them: `poll-agent.yml`
  (reusable) driven by the twelve house caller workflows, Roy Morgan's
  included; `coverage-check.yml` is the gap watchdog whose failure emails a
  missing-poll alert. Local launchd jobs mirror these as backup.
  - Writers queue PER HOUSE (`writers-<house>`), never in one shared group:
    GitHub keeps one pending run per group and cancels the rest, which cost
    29 runs in Sep 2026 under the old `main-writers` group. Cross-house push
    races are `push_main`'s job (`.build/git-push-main.sh`): the rebase
    rebuilds generated files instead of merging them, and a data conflict
    re-runs the wrapper once. `test-push-main.mjs` races two clones through
    it. Every writer — new ones included — pushes through `push_main`.
  - A run that fails because the pollster was down or walled, or that lost
    a push race twice, ends GREEN with a warning (`.build/classify-failure.mjs`);
    `.build/transient-streak.sh` turns it red only after 12h of that, and
    only then does agent-repair see it. Callers grant `actions: read` for the
    streak check — the caller's `permissions:` is the ceiling for
    poll-agent's job (`test-workflows.mjs` pins it).
  - The cron block between `# tune-schedules:begin/end` in each caller is
    GENERATED: `.build/tune-schedules.mjs` measures every house's weekday
    and release hours from the `published` clock times in polls.json and
    rewrites it (`--apply`; `--check` for drift); `schedule-tune.yml` runs
    it after every updater completes and weekly for the DST offset, pushing
    under the `SCHEDULE_TUNER_TOKEN` PAT (GITHUB_TOKEN can't touch workflow
    files; the weekly run warns three weeks before it expires). Never
    hand-edit inside the markers — change the recipe in the script.
  - GitHub's cron ran those blocks 2–5h late at the median in Sep 2026. The
    tuner also writes `.build/dispatch-clock/schedule.json` (the same slots,
    Sydney wall-clock), which the Cloudflare Worker in `.build/dispatch-clock/`
    turns into on-time `workflow_dispatch` runs once deployed (README
    there); the cron blocks stay as the backup.
  - The launchd jobs run in their own clone,
    `~/Library/Application Support/auspol-agents/repo` — never in this
    checkout, whose edits made them refuse 51 of ~148 slots in Sep 2026. Its
    `.build/logs` links here. `bash .build/install-launchd.sh` installs or
    updates the clone, run.sh (tracked as `.build/launchd/run.sh`), the
    shims and the plists; `--check` reports drift.
- `.build/extract-pollbludger.mjs` + `pollbludger-updater.sh` +
  `pollbludger-fallback.yml` — the LAST-RESORT poll agent. Reads
  BludgerTrack's poll-data feed (pollbludger.net …/xml/current.xml) four
  times a day and files any wave missing from `polls[]` for 18h+ as a
  PROVISIONAL row in `data/polls.json`'s `fallbackPolls` array — never into
  `polls[]` (extractors dedupe against it and never overwrite). gen-data
  merges unshadowed rows into the page marked provisional; validate.mjs
  check 12 gates the array; the agent prunes a row once the house's real
  one lands. To keep a feed wave out, list its feed Id in
  `.build/pollbludger-src/ignore.json` with a reason. It also files leader
  SATISFACTION splits (`fallbackApproval`, from the feed's <leaders> table,
  independent of the VI row — a cloud-landed YouGov row has none) for
  non-favourability houses; never preferred-PM. The coverage doctor
  knows about these rows: a witness-listed wave the fallback has on the
  page is class 3 (green, warning + deduped ci-alert issue), not class 2.
- `.build/extract-essential-report.mjs` runs a PREFLIGHT before its
  ~10-minute crawl: the REST listings' (id, modified) pairs are hashed into
  `.build/essential-src/site-fingerprint.json` (committed by the wrapper);
  the crawl runs only when that moved, the newest report is under 3 days
  old, or `--force`. A skipped run says `crawl: "skipped"` in its status.
- Wikipedia's federal polling table is read by TWO scripts — `check-coverage`
  (dates only) and `extract-news24` (YouGov's News24-only waves). Its layout
  changed on 2026-09-11 (rowspan data-cell dates; IND+OTH merged into one
  "Others" cell split by an {{efn}} footnote) and both went silently blind
  for twelve days. Both now read either layout, pinned by
  `test-coverage.mjs` and `test-news24-wiki.mjs`; a future change is fixed
  in the parser AND pinned with a new fixture form.
- `news24-update.yml` (2026-09-22) runs the YouGov updater in the cloud —
  Chrome leg off under GITHUB_ACTIONS; the launchd job with Chrome upgrades
  News24-only rows in place later.
- `.github/workflows/agent-repair.yml` — the CENTRAL Matilda repair agent.
  A watched workflow failing on main triggers it (workflow_run); tests,
  site-check, newspoll-watch, citation-check and schedule-tune are
  deliberately unwatched. Three jobs:
  - `gate` maps the workflow to a house prompt (`.build/*-repair-prompt.md`;
    generic `.build/agent-repair-prompt.md` fallback), skips failures that
    are not repair work (coverage-check's heartbeat), and runs the circuit
    breaker `.build/repair-gate.sh` — 3 agent SESSIONS per workflow per 24h,
    counted from runs whose `repair` job actually ran (it used to count the
    ~150 skipped runs a day and stayed shut).
  - `repair` runs headless Matilda with a read-only token and no git
    credentials, and hands its commits over as a git bundle artifact.
  - `publish`, on a fresh runner, applies the gate — forbidden paths
    (`.github/`, manifests, CNAME, the clock, the laptop installer, and the
    repair machinery itself), syntax checks, validate.mjs — then discards
    every generated file the commits carry, rebuilds the site from the
    repaired sources, and pushes through `push_main` (scripts taken from
    main, not the agent's tree). `.build/alert-issue.sh` files deduped
    ci-alert issues when it blocks; `.build/resolve-alerts.sh`
    (coverage-check's daily `alerts` job) closes them once the workflow has
    run green since. This repo blocks Actions from opening PRs, so nothing
    here — nor newspoll-watch's filer, which pushes a `repair/` branch and
    files a review-request issue — can open one.
- Pre-1987 past-cycle leadership lines come from The Bulletin's Morgan
  Gallup column (harvest → extract → assimilate scripts named
  `*-bulletin-gallup.mjs`; CSV `data/bulletin-leader-approval.csv`; rows
  land in `cycleApproval.1972…1983` as firm "Morgan Gallup", the 1984 term
  from Newspoll). The Trove SPA's public client key rotates — re-capture per
  the harvester header when the search API 401s.
- `assets/<hash>.js` — compiled asset layers (regenerated by the build)

## Skills

Domain knowledge lives in `.matilda/skills/auto-skill-*/SKILL.md` — read the
relevant one before touching an area. Most load-bearing:

- `auto-skill-auspol-build-pipeline` — build system map
- `auto-skill-roymorgan-release-extraction` — Roy Morgan extractor internals
- `auto-skill-launchd-scheduled-data-pipeline` — scheduled-job conventions
- `auto-skill-shared-repo-concurrency` — multiple sessions share this repo;
  verify git state before staging/committing

## Rules

1. Never hand-edit `index.html` — edit sources, rebuild, review the diff.
2. Run `node .build/newtracker/validate.mjs` before committing data changes.
3. Never weaken extractor guard checks.
4. Pollster copy/methodology text often lives in 2–4 places that must move
   together — check the relevant skill before editing copy.
