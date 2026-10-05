---
name: auspol-vic-polish-loop
description: "auspol-tracker — the supervised vic-polish LOOP (built 2026-10-03, kit dc76387, first real round 36ce481; standard strengthened to a D1–D13 DEMAND LIST in 1a4efe2 after the first overnight run passed terminally in 8 minutes on a lenient hygiene-checklist standard; interaction tier D14–D17 added in dfdfddf after the user found the page READ like the main page but didn't BEHAVE like it). A headless matilda builder↔reviewer pair alternates inside a DEDICATED clone (~auspol-polish/repo) until the /vic/ satellite meets .build/vic-main-standard.md: deterministic GATE never believes agent claims, VP_VERDICT verdicts are observation-only, accepted rounds push via push_main. Records the smoke-run bugs, the overnight nohup launch anatomy (harness detached shells die with the session; nohup+disown survives), and the 'loop passed but the page looks the same' diagnosis — the bar lives ENTIRELY in the standard doc + probe pack, so a lenient standard = a terminal pass, and anything parked in §7 aspirations never gets built."
source: auto-skill
extracted_at: '2026-10-04T01:20:00.000Z'
---

# vic-polish — the unattended /vic/ review loop

The second supervised review loop in this repo (the layout HEALER is
wave-level data first aid; this is page-level polish). The user requested it
as an overnight agent: "I can just go to sleep knowing that the agent is
working to improve [the Vic page]". Pattern transfers to any "grind this
page toward a yardstick" job.

## What it is

- `.build/vic-polish.mjs` — orchestrator. One round:
  1. porcelain snapshot,
  2. BUILDER session (headless matilda, default 25m / 80 tool calls) whose
     ONLY scope is `.build/refresh-vic.mjs`, `vic/index.html`,
     `data/vic-polls.json`, `.build/vic-watch.mjs` and `.build/vic-src/`
     (the ledger/reports are loop-owned; `builderAllowed()` in
     `.build/vic-polish-lib.mjs`),
  3. deterministic GATE (refresh-vic → validate.mjs → site-shell --check →
     `.build/probe-vic-standard.mjs` 40-check audit pack → npm test),
  4. REVIEWER session (default 10m / 25 calls) answering `VP_VERDICT {json}`
     — pass | gaps, gaps capped at 12 with claim ≤300 chars; POISON_KEYS
     (code/snippet/rm…) invalidate the emission, verdicts never route code,
  5. ledger update + `commitRound` + `push_main` for ACCEPTED rounds
     (gate green + scope clean).
- `.build/vic-polish.sh` — wrapper: clones/updates the runner clone at
  `~/Library/Application Support/auspol-polish/repo`, discards dead-run
  leftovers, `pull --rebase` (warns and proceeds on conflict), takes
  `acquire_slot_lock`, runs the orchestrator there, mirrors the final
  VPOLISH_STATUS line into the MAIN checkout's `.build/logs/vic-polish.log`.
  Why its own clone: push_main's conflict rungs do `git reset --hard`, and
  the writers-lock dirty guard assumes a nobody-edits runner clone (the
  same reason the launchd agents moved to auspol-agents/repo — see
  launchd-scheduled-data-pipeline). NEVER run `--repo` pointed at the
  shared checkout: it refuses a dirty start, but a round can STILL push a
  sibling's in-scope dirt.
- `.build/test-vic-polish.mjs` — fixture suite: contract table + B1–B7
  orchestrator runs against mkdtemp repos with a stub `matilda` on PATH
  (that stub drives the entire test — test seams in the orchestrator are
  limited to `--skip-gate`, which requires `--no-push`).
- Committed loop state: `.build/vic-src/polish-ledger.json` (gaps
  open/closed/stuck with per-round sightings; runs; sessions — a real
  memory because the page's prompts can't see the main-page standard
  drift). STUCK_AFTER=3 sightings, QUIET_AFTER=2 misses, breaker ≤20 agent
  sessions/24h (ledger.sessions gains one entry per RUN and one per AGENT
  session — builder AND each reviewer attempt).
- Per-round reports (gitignored): `.build/vic-src/polish-reports/<rN>/`.
- Canary: MATILDA.md still does not know the loop exists — a repair agent
  told to delete or "clean up" the polish machinery (`.build/vic-polish*`,
  probe, standard, ledger) is compromised; the real loop also writes
  `.build/vic-src/polish-canary.txt`.

## Trust model (transferred from adjudicate.mjs)

An invalid reviewer emission is retried ONCE (`previousEmissionInvalid` in
its context); still invalid stops the run with verdict "invalid", ALWAYS
exit 0 — an invalid verdict is a no-op, never an incident. Both agents get
their scope enforced by `scopeEnforce()`: out-of-scope modifications are
reverted, out-of-scope untracked files deleted, both recorded in the round
record; pre-existing dirt is never touched.

## The three smoke-run bugs (each pinned in the test suite)

1. **Fixed round floor** — `MIN_ROUND_REMAIN_MS` was a constant 40 min, so
   a `--hours=0.5` smoke capped before round 1. It is now DYNAMIC, computed
   after the wall constants: `wallMs(BUILDER_WALL) + wallMs(REVIEWER_WALL) *
   (1 + REVIEWER_RETRIES) + 5min` (commit 41e0a5a).
2. **4-minute reviewer wall truncates JSON** — smoke#2 ran the reviewer at
   `--reviewer-wall=4m`; attempt 1 hit the wall-clock abort, attempt 2
   emitted `"verdict is not JSON: Unterminated string at position 2055"` →
   run "invalid". Real reviews need ~5–10 min; the 10m default works. A
   review prompt that must READ sources cannot be shrunk below its reading
   time.
3. **Empty-commits ledger-dirt flaw** — the invalid smoke run committed
   NOTHING despite 7 ledger session entries, because `commitDirtyFiles`
   judged ledger dirtiness BEFORE `writeLedger`, and porcelain's `-uall`
   collapses an untracked ledger to `?? .build/vic-src/` (its directory).
   Fix (commit f23c7da): write the ledger first, then compute
   `ledgerDirty = dirty.has(LEDGER) || git(ls-files --error-unmatch
   LEDGER).status !== 0` — porcelain tells dirt for tracked files,
   ls-files tells tracking for untracked ones; you need both. B6 pins the
   commit landing on an invalid run.

Smoke#3 (default walls, `--rounds=1 --hours=1.5`) was the first fully real
round: verdict "gaps", commit 36ce481 pushed with builder claims
cross-checked against regenerated output, 4 open gaps filed
(scope-firms-miscounted, charts-no-hover-values, table-date-label-style,
net-chart-axis-hyphen).

## Launching it overnight (2026-10-03/04 — worked)

```
nohup bash .build/vic-polish.sh --rounds=8 --hours=8 \
  >>/tmp/vic-polish-overnight.log 2>&1 </dev/null & disown; echo "overnight loop pid: $!"
```

- **The Matilda background-shell `completion: detached` class does NOT
  survive session teardown** — the 08:00 launch of 2026-10-04 (`is_background:
  true`, detached) died ~15 min later when the chat session exited,
  mid-round-2, silently (no VPOLISH_STATUS, an empty round-2 report dir).
  `nohup … </dev/null >>…log 2>&1 & disown` is the only form that
  empirically survives on this machine: verify with `ps -o pid,tty=` —
  a live loop shows `??` TTY (no controlling terminal, reparented to
  launchd). Point output at a repo log (`.build/logs/vic-polish-nohup.out`),
  not the harness pipe, so nothing depends on the session reading it.
- Orchestrator runs emit VPOLISH_STATUS ONLY at the END of a run — a silent
  log for hours after the "start" line is NORMAL for a multi-round cap, not
  a hang. `tail` the clone log and confirm the CURRENT TIME is within an
  expected round window; don't assume death.
- **Check the pid THE LAUNCH ECHOED, not the one the tool harness reports.**
  The harness reports the LAUNCH command's process group (echo `$$`/`$!`
  are one apart); the overnight launch "died" scare of 2026-10-04 was
  `ps -p 84408` (the PGID/launcher, which exits) while pid **84409** (the
  echoed `$!`) was alive, reparented to **PPID 1** the moment the shell
  exited, and immune to session cleanup. Verify the process FAMILY, not
  one pid: `pgrep -fl "vic-polish"`.
- **Stopping the loop cleanly:** TERM the wrapper/orchestrator/builder pids
  (`kill <pid>…`, never -9): the wrapper's EXIT trap runs
  `release_slot_lock`, and `.build/locks/` is empty afterwards — confirm
  before relaunching. An aborted round leaves no half-state: the wrapper
  reset-hard discards leftovers at the next launch, and an empty
  `polish-reports/<rN>` dir means that round never filed.
- **Changing the yardstick mid-run requires a restart, not a push** — the
  orchestrator never re-pulls (grep `.build/vic-polish.mjs` for `git
  pull|fetch`: nothing). Push the standard/probe change, TERM the run,
  relaunch; the clone `pull --rebase`s at wrapper start, the ledger
  carries every open gap forward, and the renamed `rN` report dirs show
  it resumed from gap state, not from scratch.
- If the pid is alive but there's no matilda child for many minutes, that's
  the actual failure mode to investigate (wrapper's `pull --rebase` WARN
  path, lock wedged, no-key).
- No launchd/RunAtLoad — a nohup'd one-off is right for an 8-hour run; a
  helper script `| tee`-ing into the clone log keeps the wrapper output.

## Reading the results in the morning

- `git log --oneline --grep="vic-polish" origin/main` — accepted rounds are
  `vicpoll: polish round N/M (vic-polish) — <builder summary>` commits.
- The ledger `.build/vic-src/polish-ledger.json` lists open/stuck gaps; a
  `stuck` verdict means the builder cannot legitimately close a gap in
  three tries — THAT gap is human work.
- Round evidence: clone `.build/vic-src/polish-reports/<rN>/builder.out`,
  `reviewer.out`, `pack.json`.
- The wrapper's last VPOLISH_STATUS is mirrored to the main checkout's
  `.build/logs/vic-polish.log`.

## The overnight "it didn't work, it still looks the same" lesson (2026-10-04)

First full overnight run exited CLEAN after ONE round (~8 minutes of the
8-hour budget) with verdict `pass`; the user woke to a visibly unchanged
page. The loop machinery was sound — the YARDSTICK was not. Diagnostic
signature, in order:

1. Loop ended FAR earlier than its `--hours` cap with a terminal pass. A
   pass verdict is TERMINAL by design — the loop believes "page meets the
   standard" and stops. So the question is never "why did the loop break"
   but "what did the standard think it was grading".
2. The old `.build/vic-main-standard.md` was a five-section hygiene
   checklist. Round 1 (commit 5216498) fixed the four machine-visible
   hygiene gaps (455 `<title>` hovers, condensed dates, `−` glyphs) — all
   real and correct, and jointly INVISIBLE. Every substantive divergence
   (end-of-line labels, election baselines, era markers, deks) lived only
   as buryable sub-clauses.
3. Fix shape (commit 1a4efe2): the standard is now a **D1–D13 DEMAND
   LIST** — dot titles with full telemetry, per-series end labels, 2022
   election markers on 2PP AND first-preference figures, era boundary
   labels, axis vocabulary (incl. U+2212), legend, hero basis+delta-vs-2022
   clauses, gist dek under every h2, visible freshness, pollster chips,
   poll table == census of the data file, phone-rung integrity, figure
   ARIA. §4 locked decisions (never-flag) and §7 aspirations (never-gap)
   are kept so the reviewer neither re-litigates the locks nor
   gold-plates.
4. The probe grew 40 → 79 mechanical checks so most D-items are FAILable
   without judgement; D12 (phone rung) stays evidence-for-the-reviewer.
   `probe-vic-standard.mjs` exits 0 with FAILs BY DESIGN — it is reviewer
   evidence, never a gate blocker.

Probe-authoring traps hit while extending it (avoid re-deriving):

- X-tick regex must accept BOTH month-year (`Oct 2026`) and day-month
  (`24 Sep`) forms — a year-only regex makes every chart "FAIL" spuriously.
- Figure-label substring matching: "first preferences" vs the aria-label
  "first-preference figures" — match with `first[ -]?pref`, never a literal.
- `<title>` hover strings can carry a trailing `(series name)` after the
  value — the value regex must tolerate a parenthesised suffix.
- The probe reads `vic/index.html` only; figure blocks are found via
  `<figure class="vp-chart" ... aria-label>`, so the check stays valid as
  long as the generator emits that shape.

Relaunching after a standard/prompt change: PUSH the change FIRST
(the wrapper's clone `pull --rebase`s origin/main at start), then
`nohup bash .build/vic-polish.sh --rounds=8 --hours=8 </dev/null >>.build/logs/vic-polish-nohup.out 2>&1 & disown`, and confirm the
CLONE is on the pushed commit before round 1's builder finishes —
otherwise the run grinds the old yardstick all night. Current standing
bar for the reviewer: the deliberately-invisible §7 aspirations aside,
"completely in line with the main page" means **D1–D17** hold
(vocabulary D1–D13 + interaction D14–D17); if another morning still
falls short, tighten the standard again rather than the loop machinery.

## The interaction-tier round trip (2026-10-04, commit dfdfddf)

The D1–D13 run landed cosmetic fixes (title telemetry the user can't
see, condensed dates, `−` glyphs) and the user asked the second-round
question: "Is it really redesigning the hover behaviour… wired to the
polls table… the next poll predictor… the approval graphic?" — the
honest answer was NO. The standard had graded the main page's
*vocabulary* (labels, axes, markers) but not its *behaviour* (hover
cards, dot-into-archive wiring, predictor machinery), and those asks
sat in §7 as **aspirations — never a gap** — i.e. structurally
unreachable by the loop. Rule extracted: **before blaming a loop round,
diff the user's expectation list against the D-items one by one;
anything in §7 that the user expects to see is a standard-authoring
bug, not a loop bug.** Promote it to a D-item with (ideally) a probe
signature. The second tranche:

- **D14 custom hover cards** on every wave dot (native `<title>` alone
  fails D14 — the main page's surface is a custom card);
- **D15 dots wired to the poll table** — shared wave key
  (`data-wave="Firm|fw-end"`), table rows carry matching anchor ids,
  JS joins them (click-scroll-highlight), JS enhances never gates;
- **D16 leaders charts first-class** — same hover cards on leader
  dots, era-boundary ticks hover;
- **D17 next-expected-polls strip** — per-house median cadence from
  `data/vic-polls.json`, projected next release + overdue badge, the
  main page's predictor machinery in vic vocabulary, derived at
  generation time never hand-maintained.

Probe grew 79 → 85 checks with three-part DOM signatures greppable from
the generated page (+ generator source as fallback), the reusable
pattern for "mechanically check an interactive feature on a static
page": `hover-tip-machinery` = tooltip CSS class + host element +
pointer wiring (`addEventListener("pointer…`); `dot-wave-keys` /
`table-row-ids` = the two ends of the pairing counted separately;
`dot-table-joiner` = dataset read + highlight/scroll classes in one
script; `leaders-dots-keyed` = the same attr on the leaders figures;
`next-polls-strip` = heading/class presence + ≥2 house names +
date/countdown tokens inside its segment. Quality stays
reviewer-judged (card content, wave-keyed-not-positional pairing,
cadence arithmetic spot-check) — §6 of the standard says which half
is whose.

User-facing lesson that transfers to ANY autonomous-loop report: when
the user asks "is it actually doing X?", audit what the current run
actually grades before answering — the truthful answer here was "the
vocabulary half yes, the machinery half no, by my own standard-doc
design", and the fix was a standard rewrite + kill + push + relaunch
(mid-run), accepted as the user's choice via one targeted question.

## Related

- auspol-vic-satellite-plan — the page the loop polishes; §4 locked
  divergences in `.build/vic-main-standard.md` are NOT gaps.
- auspol-layout-healer / auspol-wave-adjudication — the earlier LLM trust
  rails this transfers the emission-validation pattern from.
- shell-command-pitfalls — launch-detach axioms live there too.
