---
name: launchd-scheduled-data-pipeline
description: Schedule a repo data-extractor for unattended macOS runs — wrapper shell script that extracts -> validates -> builds -> commits -> pushes, driven by a launchd LaunchAgent with StartCalendarInterval; includes the PATH/git/env gotchas, the ~/Documents TCC exit-126 block, and the idempotent bootout+bootstrap reload pattern (live examples: local.auspol.resolve-rpm for .build/resolve-rpm-updater.sh, local.auspol.roymorgan for .build/roymorgan-updater.sh, local.auspol.essential for .build/essential-updater.sh, local.auspol.demosau for .build/demosau-updater.sh).
source: auto-skill
extracted_at: '2026-08-29T02:40:00.000Z'
---

# Scheduling a data extractor on macOS launchd (auspol-tracker)

Installed by 2026-08-29: **seven** agents — `local.auspol.resolve-rpm`, `local.auspol.roymorgan`,
`local.auspol.essential`, `local.auspol.demosau`, `local.auspol.newspoll`, `local.auspol.redbridge`,
`local.auspol.news24` (YouGov News24 Pulse; extractor `.build/extract-news24.mjs`, wrapper
`.build/news24-updater.sh`, status `N24_STATUS`, commit `Update YouGov News24 Pulse data <date>`;
schedule Wed 06/12/19 + Thu 06 + Sat 06 around the fortnightly ~05:00 AEST Wednesday release; run
logged `changed:false` on install). Its provenance dir `.build/news24-src/` only exists after the
first capture (extractor writes it only on changed:true) — so `git add .build/news24-src` fails
with exit 128 if run manually beforehand, while the wrapper is safe because the add-list only
executes on changed:true.
(each plist copied to `~/Library/LaunchAgents/`; canonical copies in `.build/`, wrappers
`.build/<name>-updater.sh`).
**Before touching extractor automation, remember these jobs exist** — they self-commit
("Update <source> data …" variants) and self-push; an unexplained commit
in the history is probably a schedule, not vandalism. The Roy Morgan agent feeds `data/polls.json`
and commits `.build/roymorgan-src/` provenance JSON alongside — its add-list differs from Resolve's.
The Essential agent feeds `data/essential-report.csv` (the Resolve-compatible 10-column schema),
its status line is `ESSENTIAL_STATUS`, and each run is a full polite re-crawl of
essentialreport.com.au (~15 min) — so its schedule stays sparse. The DemosAU agent feeds
`data/polls.json` from PDF releases on demosau.com (parsed with `pdftotext -layout`; status
`DEMOSAU_STATUS`), caching each PDF's metrics + text to `.build/demosau-src/<slug>.json/.txt` —
routine runs download only the index page and verify every hand-entered row against its PDF
without overwriting (mismatches are warnings in the status, never edits).

Schedules installed: Resolve — Sun/Mon/Tue at 06:00, 19:00, 22:30; Wed–Sat 06:00 only (dense around
Resolve's usual Sunday-evening AEST release window). Roy Morgan — Mon 16:35 + 17:00 + 17:15 +
18:00 + 22:30, Tue 06:00 + 19:00, daily 06:00 sweeps (17:15 slot added 2026-08-31, commit
`e9d88e7`: the 2026-08-31 release's CMS timestamp was 17:00:43, seconds AFTER the 17:00 check, so
the 16:35/17:00 runs saw only the previous wave and a manual `kickstart` was needed — a scheduled
check at HH:00 exactly can lose to a release landing at HH:00:NN; pad with a follow-up slot, don't
move the early ones). Tightened 2026-08-29 from a Mon 19:00 first check:
RM federal-voting releases carry `published` timestamps of Mon ~16:17–16:30 AEST, worst-case CMS
lag to ~17:45 — see "Calibrating the schedule" below). Essential — weekly Monday 05:00 sweep plus
daily 05:00 across the
month-boundary window (days 26–30, 1, 2). Essential Report releases cluster at/after month end
(2026 observed: Apr 26–29, May 1, May 26–27, Jun 1, Jun 30, Jul 27–28). DemosAU — weekly Tuesday
06:00 sweep plus daily 06:00 across the month-end window (days 26–2); the Capital Brief federal
poll lands roughly monthly (2026: Jan 13-21, Apr 9-14, May 15-20, Jun 16-18, Jul 3-8, Aug 18-20)
and federal MRPs occasionally.

Newspoll (`local.auspol.newspoll`) and RedBridge (`local.auspol.redbridge`) are both INSTALLED
as of 2026-08-29 — Newspoll with extractor+wrapper commit `8cf633d`, RedBridge later the same
day straight from its repo-prepared plist (`cp` + `bootstrap`, manual wrapper smoke run exit 0,
`changed:false` with all existing waves `verified`). RedBridge schedule: Sun 06:00 plus daily
06:00 across the 28th–4th month-window (monthly AFR release lands on the first-weekend Sunday);
status `RB_STATUS`. Newspoll releases land roughly every
~3 weeks, Sunday evening ~20:00 AEST (canonical `published` values). `.build/newspoll-updater.sh`
mirrors `roymorgan-updater.sh` one-for-one (status `NP_STATUS`; add-list
`data/polls.json .build/newspoll-src/ index.html feed.xml sitemap.xml robots.txt` plus
`assets/auspol-card.png assets/auspol-card.json` since 2026-08-31; commit
`Update Newspoll data <date>`), plist with Sun 19:00 + 22:30, Mon 06:00, Tue 06:00, Thu 06:00.

## Wrapper script pattern (`.build/resolve-rpm-updater.sh`)

One bash file that glues the stages; each stage gates the next so corruption never propagates:

1. **Self-locate, never trust cwd**: launchd runs jobs with cwd `/`, so
   `REPO="$(cd "$(dirname "$0")/.." && pwd)"; cd "$REPO"` at the top. All extractor args stay relative.
2. Run extractor, capture stdout+exit code. Parse the final `<PREFIX>_STATUS {json}` line (`RPM_STATUS`
   for Resolve, `RM_STATUS` for Roy Morgan, `ESSENTIAL_STATUS` for Essential, `DEMOSAU_STATUS` for
   DemosAU) — treats any
   non-zero exit (incl. guard trip exit 2) as abort-before-commit; treat missing status line as failure.
3. `grep -q '"changed":true'` decides whether to proceed — no change just exits 0.
   (Essential and Resolve wrappers have one extra stage here: an
   `.build/assimilate-<source>-vi.mjs --apply` step that turns new CSV waves into
   canonical `data/polls.json` rows — see the polls-json-assimilation skill; its
   `git add` list also carries `data/polls.json` and a provenance dir.)
4. `validate.mjs` (exit-gated) → **`render-card.mjs` (BEST-EFFORT, added 2026-08-31 commit
   `2f943b5`)** → `build.mjs` (exit-gated) → `git add <explicit file list>` →
   `git commit -m "Update <thing> data $(date +%F)"` → `git push`. Explicit add-list, never `git add -A`.
   The card redraw is the one stage deliberately NOT exit-gated — on failure the wrapper logs
   `WARN render-card failed; shipping with the previous card` and continues, because headless
   Chrome is flakier than the node steps and a social-preview miss must not block poll data
   (build.mjs's stale-card warning still surfaces it); every poll wrapper's add-list carries
   `assets/auspol-card.png assets/auspol-card.json` so the redrawn card commits with the data.
   Only the seven poll updaters have this stage — `coverage-updater.sh` is a monitor that never
   writes polls.json.
5. Every step appends one line to a gitignored log (` .build/logs/…`, dir added to `.gitignore` in the
   same change set) with a `FAIL <stage>` prefix on failures — the log is the only debugging surface
   for a headless job (see plist stdout/stderr below).

## launchd plist essentials (learned the hard way)

- **`EnvironmentVariables.PATH` is mandatory.** LaunchAgents get a minimal PATH; set
  `PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` or the job silently can't find
  Homebrew `node`. Same PATH also resolves `git` (usr/local) and lets git's
  `credential.helper=!gh auth git-credential` work — `gh` lives in /opt/homebrew/bin.
- **macOS system git is old** (`/usr/local/bin/git` here): no `git branch --show-current`, and
  `git log --follow` on big files can hang for minutes — avoid both in scheduled scripts.
- `ProgramArguments` = `["/bin/bash", "<abs path to wrapper>"]`. Passing the absolute script path
  through `bash` avoids executable-bit/shebang issues under launchd.
- Absolute paths inside the plist can contain spaces (e.g. `4. auspol`) — XML text needs no escaping.
- `StartCalendarInterval` accepts an **array of dicts**; `Weekday` is 0=Sunday (JS convention),
  `Minute` defaults to 0 so omit it except for staggered slots (22,30).
- **Exit 126 "Operation not permitted" on scripts under `~/Documents`**: macOS's Documents-folder
  prompt protection (TCC) can deny launchd execution of any script there even though foreground
  shells run it fine. Tell-tale: `last exit code = 126`, stderr
  `/bin/bash: <wrapper>: Operation not permitted`, and a poll-scoped diagnostic — a trivial script
  in /tmp runs fine under launchd while an identical one in ~/Documents fails. It can appear
  **retroactively**: jobs that worked for months start 126-ing after a sync/policy change, and
  `killall tccd` does not clear it. Fix needs a manual TCC grant and **the entry won't already
  exist**: bash never appears under Files and Folders or Full Disk Access (TCC only lists apps/names
  that prompted; launchd jobs silently deny instead of prompting). Walk the user through adding it:
  System Settings → Privacy & Security → **Full Disk Access** → unlock → **+** → in the picker
  **⌘⇧G**, type `/bin/bash`, Enter → toggle on. (App entries the user *will* see — Matilda,
  Terminal, git, node — are irrelevant; the denied exec is launchd→/bin/bash.) If bash alone
  doesn't clear it, add `/bin/sh` and `/usr/bin/env` the same way. Wait-for-user; do not try
  `tccutil` from the repo side. Only when the grant lands does `launchctl kickstart` go green.
- Always set `StandardOutPath`/`StandardErrorPath` to files inside the gitignored log dir —
  launchd swallows output otherwise, and the wrapper's own log only covers stages it reaches.

## Install / reload (idempotent one-liner)

```sh
cp <repo>/.build/<label>.plist ~/Library/LaunchAgents/ \
  && launchctl bootout "gui/$(id -u)/<label>" 2>/dev/null; \
  launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/<label>.plist \
  && launchctl print "gui/$(id -u)/<label>" | head -5
```
`bootout` on a not-loaded label errors (harmless, swallowed by 2>/dev/null); `bootstrap` is the
modern `load`. Uninstall: `launchctl bootout gui/$(id -u)/<label> && rm ~/Library/LaunchAgents/<label>.plist`.
A transient `srcdir != destdir` alert on the first `cp`+`bootstrap` cleared by `cp`-ing the plist
to a temp filename inside `~/Library/LaunchAgents/` and `mv`-ing it to the final name before
bootstrapping (observed on the Roy Morgan schedule edit, 2026-08-29).

## Calibrating the schedule to the publisher's clock

Slot times should track the source's OBSERVED publish rhythm, not round hours or guesses — the
`published` values already in polls.json / extractor provenance are the evidence base (the Roy
Morgan field-to-published table the user supplied pinpoints Mon ~4:30 pm AEST). Roy Morgan
2026-08-29 edit: first Monday check moved from 19:00 to **16:35**, minutes after the typical
publish timestamp; follow-ups at 17:00 and 18:00 absorb CMS lag (observed to ~17:45 — the
`published` timestamp can precede the visible page by tens of minutes, which is why the first
check isn't AT the earliest observed timestamp), then 22:30 and a next-morning sweep catch
stragglers. Density is easy to justify when check cost is measured, not assumed: `time` one
no-change wrapper run (RM: ~1.6 s wall, 0.2 s CPU) — several same-evening slots are effectively
free. If asked "why wait until X?", the honest answer is publish-cadence/CMS-lag uncertainty —
the fix is another cheap slot, not a later first slot.

## Trigger a job on demand + where the logs actually are (2026-08-31)

- **Manual run**: `launchctl kickstart gui/$(id -u)/local.auspol.<name>` — works now (the
  TCC-126 block is resolved), exercises the installed plist end-to-end, and returns immediately;
  give the job ~30–60 s before checking output. No `RunAtLoad` needed.
- **Don't be fooled by the plist log paths.** Each plist's
  `StandardOutPath`/`StandardErrorPath` point at
  `.build/logs/launchd-<name>-stdout.log` / `-stderr.log`, and those files are **permanently
  0 bytes** — the wrappers redirect their own output internally. The REAL log per agent is
  `.build/logs/<name>.log` (`roymorgan.log`, `redbridge.log`, `newspoll.log`, …), which the
  wrapper appends one timed line per run plus a full validate/build summary on changed runs.
  Answering "did the agent fire?" = `tail -n 40 .build/logs/<name>.log`, not the launchd-* logs.
- **Wrapper layout changed**: the plists' `ProgramArguments` no longer run
  `.build/<name>-updater.sh` directly. They now run
  `"$HOME/Library/Application Support/auspol-agents/<name>.sh"`, a one-line thin launcher that
  `exec`s `run.sh "<name>-updater.sh"` in the same out-of-repo directory (kept outside the repo
  deliberately — see run.sh's header for why). The extract→validate→build→commit→push logic is
  still in the repo's `.build/<name>-updater.sh`; only the launch shim moved. To answer "when does
  agent X run", read the live plist (`plutil -p ~/Library/LaunchAgents/<label>.plist` and map
  every `{Hour, Minute, Weekday}` triple — `Weekday` omitted means "any day at that hour", NOT
  duplicate-missing).

## Smoke test before trusting the schedule

Run the wrapper manually **from a different cwd** (proves self-location + PATH-independent binaries),
then inspect the log tail and the extractor's status line. A no-change run should print
`changed:false` and exit 0 without touching git. Then do one run **via the agent itself** —
`launchctl kickstart gui/$(id -u)/<label>` — which exercises the installed plist's
PATH/stdout-redirect chain that a manual shell run can't prove; tail the wrapper log again to
confirm (a no-change RM run logged `RM_STATUS {"changed":false,"skipped_existing":[…]}`).
While the TCC-126 block is in effect (kickstart unusable), a detached manual run is the next best
proof — launch the wrapper with a setsid redirect so the agent session can't reap it:
`perl -MPOSIX -e 'POSIX::setsid(); open(STDOUT,">","/tmp/wrapper.log"); open(STDERR,">&STDOUT");
exec "/bin/bash","<abs wrapper path>";' &` (this also survived the same macOS change that broke
kickstart). A no-change Essential run printed
`ESSENTIAL_STATUS {"changed":false,…,"failed_pages":0,"failed_flourishes":0,…,"new_dates":[]}`,
logged one timed line to `.build/logs/essential.log`, exited 0, and left git untouched — prove that
by `git status` staying clean and HEAD unmoved. When watching for completion use plain ERE in
pgrep (`pgrep -f 'a|b'`) — a `\|` alternation never matches and makes a healthy run look dead.
Don't forget `chmod +x` the wrapper — tracked executable bit (100755) is what a fresh clone gets.

## User-consent checklist (did this interactively; do the same)

Before installing another scheduled job: (a) how far should it go — extract-only vs
commit vs **commit+push** (user chose commit+push for Resolve); (b) cadence tied to the source's
actual release rhythm, not a generic hourly poll; (c) state plainly that the job will push to GitHub
unsupervised, and hand over the uninstall command when done.

## Threshold for promotion

The extractor being scheduled must already satisfy the automation contract written into
`.build/extract-resolve-rpm.mjs`'s header (exit 0/1/2 semantics, machine-greppable status line,
idempotent no-change skip, guard-before-dry-run-exit) — see the resolve-monitor-extraction skill.
Scheduling a script without a failure protocol is what produces silent repo corruption.
