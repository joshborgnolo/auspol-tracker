---
name: auspol-wave-adjudication
description: auspol-tracker — the CI-only LLM wave-adjudication chain (shipped 2026-10-03; hardened 2026-10-10 by commit 236b8a5 before its first production fire). Extractor --adjudicate emits CASES for the judgement calls heuristics punted (RM double-release vs new wave, RM figure-diverging reissue, PB in-grace pending, PB near-canonical mismatch); .build/adjudicate.mjs asks the pinned matilda CLI once with NO tool surface (--exclude-tools shell,write,edit — the job holds a contents:write credential); the extractor re-runs --decisions to file/route. Covers the contract-module pattern incl. the wired caseJson 6 KB emission cap, the ledger's distinct_wave `against:` prune-persistence find, heal_absent's exact allowlist, the wrapper re-run matrix, both extractors' test seams (cwd-swap / env overrides / PATH-stubbed CLI with argv capture), and the 2026-10-10 audit's reusable LLM-in-CI review recipe.
source: auto-skill
extracted_at: '2026-10-03T00:00:00.000Z'
---

# Wave adjudication: LLM routing for the extract-time judgement calls

Built 2026-10-03 from a WIP the user pointed at ("i believe there's a wip on this"). Sibling
machinery to the layout healer (auto-skill-auspol-layout-healer): the healer stands in for
DATA when a guard trips; adjudication answers a ROUTING question the deterministic extractor
refuses to answer alone, live in the run. Scope decisions were the user's: **CI-only**
(MATILDA_API_KEY lives only in Actions secrets; forks, PRs and the laptop launchd copies take
the deterministic path exactly as before) and **heal_absent's allowlist is exactly
tpp_flows + undecided + published + sample**.

## The chain (per run, per house — roymorgan + pollbludger wired)

1. Extractor runs with `--adjudicate`. Key absent → zero behaviour change. Key present → any
   wave hitting a judgement call is NOT filed/punted deterministically; instead a case object
   goes into `status.ambiguous` (and RM holds the wave in `status.held`), and the extractor
   persists an anti-spam `asked` mark to its committed `<house>-src/adjudicated.json` ledger
   so the same case is never re-asked every slot.
2. The wrapper (`roymorgan-updater.sh` / `pollbludger-updater.sh`, adjudication block with a
   `${TMPDIR:-/tmp}/pb-adjudicate-status.$$.json`-style tmp status file) captures the status
   JSON, and if cases exist runs:
   `node .build/adjudicate.mjs --house <roymorgan|pollbludger> --status-file <f> --out
   <house>-src/verdict.json` and logs its `ADJ_STATUS {json}` last line.
3. Re-run matrix on the adjudicator's verdict:
   - `applied:true` → extractor re-run WITH `--decisions <verdict-file>` (pb keeps its normal
     `--apply --adjudicate` flags; ledger persistence lives inside pb's APPLY path).
   - `ran:true && !applied` (invalid emission, garbage, poison) → plain re-run, no flag.
   - `ran:false` (no key, no cases) → hold; nothing to re-run for.
   An invalid verdict is a deterministic no-op and the run stays GREEN — adjudication can never
   turn a good run red.

## The contract module — the pattern to keep

`.build/adjudicate-cases.mjs` owns the case shapes, the action enums, the vote constants and
the validators so the contract cannot drift between sides. As of the 236b8a5 hardening the extractors import
the three constants plus `caseJson`; `validateCases` still runs solely inside adjudicate.mjs
and the test, so an extractor's `--decisions` path trusts the file with no contract re-check
(safe in-pipeline: the wrapper only ever hands back adjudicate.mjs's own validated output,
and the extractors' membership checks degrade a malformed verdict to deterministic — this
trust asymmetry is now explicitly documented in MATILDA.md's WAVE ADJUDICATION paragraph):

- Constants: `RM_DOUBLE_DAYS = 4`, `RM_REISSUE_PT = 0.5`, `PB_MISMATCH_PT = 1.0`.
- `validateCases(house, cases, decisions)` — case ids are `<kind>:<discriminator>`; decisions
  must reference known cases, one each, with an action in that kind's RULES table (and the
  field the action `needs` — `file_only`/`never_file` on an RM double need a `slug`).
- `caseJson(c, maxBytes = 6000)` — the evidence-size guard, WIRED by the 236b8a5 hardening:
  every emission site in both extractors builds the case object, calls `caseJson(case_)`, and
  only on a non-null serialisation persists the anti-spam `asked` mark + emits the case (RM
  also holds). On a null (oversized/unserialisable) the site writes a run note saying it is
  "staying deterministic this run" (the plain deterministic path proceeds — a case too big to
  judge must not freeze a wave forever: no `asked` mark, so a cleaner run can try again).
  A JSON.stringify throw also returns null (cyclic guards). The test pins three behaviours:
  a small case serialises, a 6000+char case refuses, an 8000 custom cap accepts. If you add
  an emission site, route it through `caseJson` the same way and extend the run-note.
- Cases and decisions carry EVIDENCE and routing labels only, NEVER poll figures — figures are
  POISON_KEYS in adjudicate.mjs and any key like `alp` in the model's output voids the batch
  (`applied:false`, run stays green). The point: the LLM routes, it can never smuggle a number
  into the data.

## Case kinds and actions

- **roymorgan `double`** (`double:<minDate>:<maxDate>`): two unfiled feed candidates join by
  `dayDiff ≤ RM_DOUBLE_DAYS || windowOverlap` of their field windows — RM's double releases and
  specials sitting on the weekly wave. Actions: `file_both` | `file_only` (slug) — the sibling
  gets a `dup_of` ledger mark so later runs drop it from candidates | `never_file` (slug).
  Only records with BOTH `date` and `dateStart` parse are cluster-eligible
  (`parsed.filter(rec => !rec.existed && rec.r.date && rec.r.dateStart)`).
- **roymorgan `reissue`** (`reissue:<date>`): candidate's wave date already has a polls row but
  parsed figures diverge > RM_REISSUE_PT on the moved-fields set (alp/lnp/grn/onp/ind/tpp_alp).
  Actions: `heal_absent` — fills ONLY fields the row leaves absent, allowlist exactly
  `["tpp_flows","undecided","published","sample"]`, never touches a carried field | `escalate`
  — changes nothing; a genuine figure correction is repair-agent or human work, noted in
  status. Heals mutate rows in memory and surface via the serialisation-diff `changed` check.
- **pollbludger `pending`** (`pending:<feedId>`): an uncovered feed wave inside its 18h grace
  window. Actions: `file_now` (file the provisional row now instead of waiting) | `defer` (stops
  the LLM being re-asked) | `never_file` (machine equivalent of an ignore.json entry).
- **pollbludger `mismatch`** (`mismatch:<feedId>`): feed wave inside the canonical date slack
  of an existing row but primaries diverge > PB_MISMATCH_PT — possible false dedupe. Actions:
  `same_wave` (persists as never_file) | `distinct_wave` (files immediately).

## distinct_wave prune persistence — the substantive find

A fallback row filed by a `distinct_wave` verdict was pruned on the very next run: prune uses
the same canonical-proximity slack the wave was adjudicated against, so the row it was judged
DISTINCT from shadowed it the moment it landed. Fix (extract-pollbludger.mjs): the ledger entry
records `against: <canonical-row.date>` on a distinct_wave filing, and the prune loop keeps the
row while the ONLY canonical rows in slack are that date — but still prunes when a DIFFERENT
canonical date appears (the house's real row landing keeps its kill-switch semantics). The
regression test lands the real row of the adjudicated-against house and asserts prune fires,
while an unrelated `file_now` row survives. If you ever touch the pb prune loop, keep the
`keepBesideAdjudicated` branch ahead of the plain `near.length` prune.

## adjudicate.mjs internals

- CLI probe: single `which matilda` spawn, falling back to
  `npm i -g @maincode-ai/matilda-code@0.21.4` (pinned version). Invocation as of the 236b8a5
  hardening: `matilda -p "$(cat prompt.md)" --output-format text --exclude-tools
  shell,write,edit --max-wall-time 4m --max-tool-calls 12`, ≤5 cases per call — NO `--yolo`.
  `--yolo` auto-approves every tool including shell at host privilege with no sandbox, and
  this runs in poll-agent.yml's `update` job, which holds `contents: write` AND a
  checkout-persisted git credential in .git/config (checkout v5; the workflow comment already
  knows v6 moves it out) — a yolo'd tool call could `git push` to main. The judge's task
  needs zero tools (the test's stub CLI has none), so the bounded read-only recipe from the
  CLI's own headless doc is exact-fit. Keep the 6-line header comment in adjudicate.mjs in
  step if the flags change; agent-repair's standard (read-only token, no git credentials)
  remains the aspiration if this ever graduates to its own job.
- argv pinning: the test's stub CLI appends its argv to the file in `ADJ_STUB_ARGV`; the
  good-verdict block asserts the real spawn never carries `--yolo`, that the excluded set is
  exactly the sorted triplet edit/shell/write, and that both budgets are present. Extend
  those assertions if you add flags.
- Per-house prompt files: `.build/roymorgan-adjudicate-prompt.md`,
  `.build/pollbludger-adjudicate-prompt.md`.
- ALWAYS exit 0; the verdict file is `{house, generated, cases, decisions}` with reasons capped
  at 240 chars; the wrapper's re-run keys off `ADJ_STATUS {json}` (`ran`, `applied`).

## Wrapper/ledger plumbing (the parts that bit)

- LEDGER_FILES = the ledger JSONs + verdict.json that exist AND are dirty/untracked; they join
  the wrapper's FILES array ahead of `"${SITE_FILES[@]}"` — push_main re-stages `"$@"` on its
  rebase rebuild, so the list must be complete (ci-main-writer-races skill).
- Ledger-only path: when the extract reports `changed:false` (and BT/KB refresh flags false),
  a run that only moved ledgers/commits still commits them ("Note pending Poll Bludger fallback
  wave(s) <date>" / "Roy Morgan adjudication ledger <date>") and pushes through push_main with
  LEDGER_FILES; with no ledger dirt at all it exits 0 early.
- poll-agent.yml's updater env passes `MATILDA_API_KEY: ${{ secrets.MATILDA_API_KEY }}` —
  empty on forks/PRs, which is exactly the deterministic-path gate.

## Test seams (test-adjudicate.mjs, ~390 lines, in the npm chain after test-pollbludger)

- **Stubbed CLI**: prepend a tmp `bin/` to PATH containing a node `matilda` stub driven by
  `ADJ_STUB_MODE` (good / garbage / poison / file_only_no_slug). No npm install, no network.
- **pb extractor**: env seams `POLLS_JSON`, `PB_SRC_DIR`, `--xml <fixture>`, `--now <iso>`;
  fixtures are a point-Xml builder + an election canary (34.6/31.8) + 100 filler points.
- **RM extractor — cwd-swap, no env seams needed**: OUT="data/polls.json" and
  SRC_DIR=".build/roymorgan-src" are gitignored RELATIVE constants, so spawn the extractor from
  a tmp cwd containing `data/` and pass `--feed-dir <tmp>` with fixture `feed-page-1.json` +
  `post-<slug>.json` (`{props:{pageProps:{findingData:{postBy:{date,content,findings:{releaseDate}}}}}}`;
  feed entry `{slug,date,release_date:"DD/MM/YYYY",topics:[{name:"Federal Poll"}]}`).
- **RM fixture lead gotcha**: the prose parser's `toValIn` pairs keywords with digits, so a
  synthetic lead like "the Greens on 12%" after "(A% Liberal, B% Nationals)" makes the nat read
  land on the Greens digit and trips the `lib+nat≈lnp` guard. Mirror the REAL release-10363
  lead shape: "The ALP on X% is ahead of One Nation on Y%. The L-NP Coalition primary is Z%
  (A% Liberal, B% Nationals); Greens G% and Independent/Others I%."
- **nearbyRows context window is 21d**: RM double-cluster fixtures need base rows within 21
  days of the cluster (2026-08-30/2026-09-06 for a 2026-09-27 cluster) or the case's
  nearbyRows evidence is empty and assertions mislead.

## Verify recipe

`node .build/test-adjudicate.mjs` (contract table: contract / adjudicate.mjs / pollbludger
extractor / roymorgan extractor); `node .build/test-pollbludger.mjs` regression after ANY
prune-loop touch; `bash -n` both wrappers; key-less live dry-runs of both extractors must be
byte-quiet (`changed:false`, empty ambiguous/held/added). Full npm test exit 0 before
committing. MATILDA.md's Poll Bludger bullet is followed by the WAVE ADJUDICATION paragraph —
keep it in step if the chain changes.

## Audit 2026-10-10 — findings, all FIXED same day pre-first-use (commit 236b8a5)

Read-only review of contract module, judge, both extractors' adjudication paths, both
wrappers, poll-agent.yml and the CLI's own docs; test-adjudicate.mjs green. The chain had
NEVER fired in production (no `<house>-src/adjudicated.json` ledger exists), so all four
findings were fixed pre-first-use — the fixes are described in the sections above; the
original findings remain here as the review trail:

1. **`--yolo` inside a contents:write job was the chain's weak point** (ENABLED the model
   to `git push` to main: poll-agent.yml `update` job has `contents: write`, checkout v5
   persists the token in .git/config, and `GIT_TERMINAL_PROMPT: "0"` only hides prompts).
   FIXED: the spawn now excludes shell/write/edit (see adjudicate.mjs internals above); the
   task provably needs zero tools (the test's stub has none), so full approval was needless.
   Note the injection surface stays small because evidence bundles are structured-only —
   both extractors emit slugs/dates/figures, never pollster prose.
2. **`caseJson` was dead code** — zero call sites. FIXED: wired at every emission site
   (contract-module bullet above).
3. **"ONE module all three sides import" was untrue** — extractors imported only constants.
   FIXED: they now import `caseJson` too, and MATILDA.md documents that adjudicate.mjs owns
   verdict validation — an extractor trusts `--decisions` only because validated verdicts are
   the only kind ever handed to it.
4. **`hoursInWindow: null`** — dead placeholder in the pb mismatch case emission (the sibling
   pending case carries a live `hoursSeen`). FIXED: the field was dropped from the mismatch
   emission (populate-only-if-meaningful won).

### LLM-in-CI review recipe (reusable to the healer / first-contact / LLM readers)

(a) grep every exported guard of a "contract module" for call sites — documented defences
are sometimes dead code; (b) trace the spawned CLI's env plus the workflow job's
`permissions:` AND checkout major version — the exploitable unit is (LLM with tools) ×
(reachable credential); (c) diff the prompt's evidence against what the extractor actually
emits — structured data vs attacker-influenced prose sets the injection surface; (d) run the
pinned test — its stubbed CLI tells you whether the task needs tools at all (if the stub has
none, neither should the real call).
