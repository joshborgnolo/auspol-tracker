---
name: auspol-layout-healer
description: auspol-tracker — the layout HEALER (shipped afa6fb6, 2026-10-02): LLM first aid for exit-2 guard trips (page fetched fine, anchors gone — the failure class that blinded both Wikipedia readers for 12 days). healer.yml watches roymorgan-update + news24-update; its gate reuses classify-failure.mjs on the failed run's log; the file job re-fetches evidence into gitignored .build/healer-src/evidence/, runs a pinned headless matilda session whose only output is candidate wave JSON, and .build/healer.mjs --accept decides — the house's OWN guard functions (RM_LIB/N24_LIB lib modes), (pollster,date) dedupe, and a faithfulness firewall (every figure verbatim in the fetched text: "V%", "V.0%", comma-sample forms). Trust: repair/healer-<house>-* branch + deduped ci-alert review issue, never main — dual latch (repair-gate breaker + git ls-remote pending branch) — and healer.yml is deliberately NOT in agent-repair's watch list. Pinned by test-healer.mjs; watch list pinned by test-workflows.mjs.
source: auto-skill
extracted_at: '2026-10-02T10:05:58.515Z'
---

# The layout healer (exit-2 first aid, LLM extractor + deterministic acceptance)

Shipped 2026-10-02, commit `afa6fb6` ("Layout healer: LLM first aid for exit-2 guard
trips…") — user call ("go for 1" on the API-agent offers). agent-repair fixes extractor
CODE over hours; the 12-day Wikipedia blindness of Sep 2026 was the DATA gap waiting on
one. The healer stands the wave up in the same slot the parser went blind, on a review
branch, for the two v1 houses (Roy Morgan feed, News24/Wikipedia).

## Components (they name each other — keep in sync)

- **`.github/workflows/healer.yml`** — `workflow_run` on `roymorgan-update` and
  `news24-update` (plus a dispatch form: failed_run_id + house). Top-level
  `permissions: {}`; the `gate` job grants contents/actions read + issues write; the
  `file` job adds contents write and runs in concurrency group `healer-<house>`.
- **`.build/healer.mjs`** — three modes: `--gate --logdir` (prints `HEALER_GATE {json}`
  for the workflow to parse), `--fetch-evidence --house` (re-fetches the source into
  `.build/healer-src/evidence/<house>/` — gitignored), `--accept --house [--out
  --evidence-dir --polls --check]` (exit 2 on malformed JSON or an acceptance defect).
  Library exports for tests: `gateVerdict`, `gateFromDir`, `failLinesOf`,
  `unfaithfulFields`, `acceptRun(house, {outFile, evidenceDir, pollsPath, check, runUrl,
  srcRoot})`.
- **`.build/healer-prompts/<house>.md`** — the agent prompt; its ONLY output is
  `.build/healer-out/<house>.json` `{waves:[…], notes}`. Zero waves is a SUCCESS (notes
  say why). No git, no data writes — the LLM is a pure extractor.
- **`test-healer.mjs`** (in the npm test chain) pins gate classification, the
  faithfulness wall and both houses' acceptance integration against temp trees;
  `test-workflows.mjs` pins healer.yml's watch list (≥2, real names, not itself).

## The gate — reuse the classifier, never classify twice

`gh run view $RUN_ID --log-failed` (fallback `--log`) → `healer.mjs --gate` strips the
log line format (`job\tstep\tISO.mmmZ ` prefixes, ANSI codes, the wrapper's own
`YYYY-MM-DD HH:MM:SS ` stamps — all pinned by fixtures) and hands the FAIL lines to
`classify-failure.mjs`. **Heal ⇔ classify kind === "exit-2"** — transient upstream
outages, push races and dirty-tree refusals are never healer work. Two preventive
latches sit on top: `repair-gate.sh healer-${HOUSE} healer.yml file` (3/24h breaker,
trip files a ci-alert issue), and a `git ls-remote --heads origin
"repair/healer-${HOUSE}-*"` check that refuses to pile a second filing on an
unreviewed branch.

## Acceptance — decide WITHOUT trusting the model

Triple gate, in this order:

1. **The house's OWN guard functions**, imported from the extractor (see the lib-mode
   note below) — never a weakened check, never a copy. This is repo rule 3 ("never
   weaken extractor guard checks") applied to an LLM data path: if the agent's figure
   breaks primaries-Σ or lib+nat≈lnp, the same check that guards the extractor rejects
   it. TEST GOTCHA from ship day: the guard runs BEFORE faithfulness, so a hallucination
   fixture must be Σ-conserving (grn 13.5/onp 12.5, not grn 17) or the assertion sees
   the guard's reason instead of the faithfulness one.
2. **(pollster, date) dedupe** against canon AND within the batch.
3. **The faithfulness firewall**: every percentage must appear verbatim in the evidence
   text as `"V%"` or `"V.0%"`, every sample as `NNN` or `N,NNN` — a bare day-of-month
   ("on 27 September") is NOT evidence for a 27% share. This kills hallucinations that
   would pass the guard's own arithmetic.

Accepted rows are extractor-parity shapes (RM: `client:"—"`, `oth:null`, `lnpSplit`,
Melbourne-converted `published`; N24 wiki rows: no `published` key, conditional url),
sorted-inserted into polls.json, with extractor-parity provenance sidecars plus a
committed `.build/healer-src/<house>-<dates>-proof.json`. N24 sidecars carry
`healer: true`. The workflow then runs the normal validate → `refresh_site` → commit (via
sourced `git-push-main.sh`, staged by SITE_FILES) on `repair/healer-<house>-<run>` and
`alert-issue.sh` files the deduped "Healer filing ready for review" issue.

## Trust model + coexistence

- A merged healer row IS the canonical `polls[]` row — no provisional stamp — which is
  exactly why it waits on a human review and why the filer/newspoll-style commit-to-main
  trust was not copied. The repo blocks Actions from opening PRs; the issue's compare
  link is the review path.
- agent-repair and the healer are complementary (code fix vs data first aid) and may
  overlap: the repaired extractor's pollster+date dedupe makes a double-filing
  impossible. healer.yml is deliberately NOT in agent-repair's watch list — no repairs
  of repairs.
- If a session is adding a third house: extractor lib mode + prompt file + workflow
  matrix/watch entry + test-healer fixtures; the wave scope stays VI rows only (the
  repaired extractor self-heals altTpp/direction/etc. on its next pass).

## Testing + verification recipes (worked on ship day)

- `node .build/test-healer.mjs` — full unit/integration suite, no network.
- Live evidence fetch (read-only network, output gitignored):
  `node .build/healer.mjs --fetch-evidence --house roymorgan` (feed + ≤3 recent
  releases → manifest.json) and `--house news24` (Wikipedia wikitext). Cheap, safe,
  exercises the exact production path.
- **Live dedupe probe** (proves `acceptRun` against REAL canon with zero risk): copy
  `data/polls.json` to `.build/healer-out/workbench/polls.json` (BOGAN mode blocks /tmp
  writes — the gitignored `.build/healer-out/` IS the workbench), fabricate an out JSON
  quoting real figures from the just-fetched evidence for a wave canon already has, run
  `node .build/healer.mjs --accept --house X --out … --evidence-dir
  .build/healer-src/evidence/X --polls .build/healer-out/workbench/polls.json` → expect
  `changed:false` with `<date> already has a <pollster> row`, and
  `git status --porcelain` quiet for canon + sidecars.
- On ship day (2026-10-02) every live RM release and every live Wikipedia YouGov wave
  was already in canon, so only the duplicate path was probeable live — the accept path
  is covered by the test suite's fixtures.

## Implementation notes worth keeping

- **Extractor lib modes** (`RM_LIB` / `N24_LIB`): `export { guardRelease, … }` +
  `if (!process.env.RM_LIB) {` around each extractor's main block lets the healer import
  the guard functions without executing main. Keep main() inside the guard when editing
  the extractor; keep the export list complete for both consumers.
- `acceptRun`'s `srcRoot` (default `".") roots the sidecar/proof writes — tests pass a
  temp root so a crashed test can never litter the real `.build/*-src/`.
- The prompt files encode the house's figure traps in prose (RM: stated-preference vs
  flows vs 2025-election-result 2PP, change-phrase stripping, Sunday date; N24: the three
  wiki cell layouts incl. the {{efn}} IND/OTH split, VI rows only). They mirror the
  extractor skills rather than duplicating guard constants — the guard itself enforces.
- This is the FIFTH matilda-CLI pin site (poll-agent.yml, roymorgan-update.yml,
  coverage-check.yml, newspoll-watch.yml, healer.yml) — bump all together.

## Cross-refs

- `auto-skill-auspol-newspoll-missing-wave-filer` — the trust-pattern sibling (breaker,
  pinned CLI, credential strip, alert-issue, compare link); the filer commits to MAIN by
  prompt, the healer files to a REVIEW BRANCH — different trust classes deliberately.
- `auto-skill-auspol-share-card` — its card-watch and the healer are the two card-watch/
  classify-failure-era watchers; the healer reuses the same classifier library.
- `auto-skill-ci-main-writer-races` — per-workflow queues, repair-gate breaker, the
  `bash git-push-main.sh` no-op trap (healer.yml SOURCES it inside its commit step).
- `auto-skill-roymorgan-release-extraction` / `auto-skill-news24-extraction` — the
  houses' parsers, guards and provenance conventions the healer must parity.
