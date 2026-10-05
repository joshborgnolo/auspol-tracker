---
name: auspol-first-contact-importer
description: auspol-tracker — the FIRST-CONTACT importer end-to-end (shipped 04f7967, 2026-10-02; user "agent as scaffolding, not permanent infrastructure"): check-coverage.mjs emits FIRST_CONTACT {json} for witness-table pollsters it cannot map (ALWAYS unfiltered, exit code untouched), first-contact.mjs is the seen-file gate (pick ≤3 shell-safe, fire-once), daily first-contact.yml fires ONE credential-free agent session per name on a contact/ branch driven by .build/first-contact-prompt.md (imports all corroborable current-cycle waves, leaves an UNWIRED extract-<house>.mjs prototype + scout report), and a human pins the deterministic kit afterwards. Firm-cell parse anatomy (ref-strip-FIRST then attr-cut), houseKey normaliser, repair-gate matrix-job counting, and the gotchas (TDZ firmCell, credential restore before the attempted-flip push, commented workflow name: key).
source: auto-skill
extracted_at: '2026-10-02T10:49:30.383Z'
---

# First-contact importer (new-pollster agent scaffolding)

Shipped 2026-10-02, commit `04f7967`, user call: when a pollster canon has never
seen appears on the Wikipedia witness table, fire ONE LLM import session
(DemosAU/Spectre-style), then a human pins the deterministic extractor kit —
**agent as scaffolding, not permanent infrastructure**. User-approved parameters:
import ALL corroborable current-cycle waves (all-or-nothing, no partial sets);
the agent leaves a runnable-but-unwired draft `extract-<house>.mjs` + scout
report on the review branch; fire once, human resets (never auto-refire).

Layered design — **detection ≠ emission ≠ firing**:

1. **Detection — `.build/check-coverage.mjs`.** Rows whose firm maps to no HOUSE
   entry used to die silently at the map; a brand-new pollster was invisible to
   the whole pipeline. `parseWitness` now reads the row's FIRM CELL and emits
   survivors as `status.first_contact` + `FIRST_CONTACT {json}` — ALWAYS
   unfiltered (this script never reads the seen file, so the import agent's own
   diagnostic run still shows its house), exit code and witness/missing counts
   untouched. Side effect: previously invisible plain-text houses
   (DemosAU/RedBridge/Fox rows) now resolve as mapped waves — the live count
   ROSE 147→162 and their absence from `missing` confirms canon covers them.
2. **Gate — `.build/first-contact.mjs` + `.build/first-contact-seen.json`.**
   Seen file = valid JSON, ONE entry per line, keys sorted, keyed by
   `houseKey(name)` — the one-line flip lets a review branch merge against a
   main that moved. Verbs: `ignore`/`pending`/`imported`/`attempted` (flip one
   line), `filter` (gate-side suppression), `slug` (branch/extractor slug),
   `pick` (≤3 per run, shell-charset `SAFE_NAME` allowlist — hostile names are
   reported as `unsafe`, never shelled into anything).
3. **Workflow — `.github/workflows/first-contact.yml`** (daily 20:20 +
   dispatch). `gate` job: repair-gate breaker → detect+pick → records fired
   names `pending` and pushes ONLY the seen file via `push_main` (the fire-once
   memory). `contact` job: matrix per name, `max-parallel: 1` (sessions SEQUENTIAL),
   concurrency `first-contact`, 40 min cap; credential-free `contact/<slug>-<runid>`
   branch, pinned matilda-code with `FIRST_CONTACT_HOUSE` + `FIRST_CONTACT_ENTRY`
   env; pushes the branch and files the deduped review ci-alert (Actions can't
   open PRs). Nothing filed → restores git credentials, flips `attempted` on
   main best-effort via push_main, files the attempted ci-alert — NEVER silent.
4. **Contract — `.build/first-contact-prompt.md`** (modelled on the Newspoll
   filer's). Corroborate every figure against the house's own publication or
   coverage fetched THIS session (witness `dates`/`refs` are leads, never
   evidence); all-or-nothing wave import; adds the `pollsterRules` site entry +
   check-coverage HOUSE alias (validate and the watchdog must accept the label);
   validate + thinness + build; exactly TWO commits (a. data/polls.json +
   artifacts, b. scaffolding + seen-file `imported` flip via the CLI); UNWIRED
   prototype with a FIRST-CONTACT PROTOTYPE header; scout report in
   `.build/first-contact-reports/`; untrusted-content firewall; aborting with a
   complete report is a SUCCESS.

## The wikitext firm-cell anatomy (why the parser looks like this)

- Firm-cell shapes on the live table: unlinked plain text (DemosAU, RedBridge/
  Accent, Freshwater — the last links its client instead), linked
  `[[Target|Display]]` (Resolve (poll)|Resolve), unlinked-with-external-client-link,
  `{{nbsp}}`+`&` (Fox{{nbsp}}& Hedgehog), and EVENT ROWS (colspan annotations
  with dates but no `%` — excluded by the `/%/` gate).
- **`cellContent`: strip refs BEFORE the attribute cut.** `{{Cite …}}` templates
  inside `<ref>` carry `|param=` pipes; cutting at `lastIndexOf("|")` first
  leaves `language=en-AU}}</ref>` as the "name". Order: strip leading `[!|]` →
  strip `<ref…</ref>` and self-closing → cut at last `|` (before the first `[[`
  when linked). This was the fix for 32 garbage names on first live run.
- **`houseKey()`** normalises both sides of the HOUSE lookup: lowercase →
  `{{…}}`→space → `&`→" and " → collapse whitespace. Plain-text firm names and
  the known-suppression set go through it; NEVER compare raw strings.
- **Known-name suppression is BIDIRECTIONAL substring** over byHouse keys + all
  HOUSE values + all HOUSE keys (each houseKey'd): `k.includes(b) ||
  (k.length≥4 && b.includes(k))`. Emission suppression happens here; seen-file
  suppression must NOT (that's the gate's job).

## Gotchas hit building it (don't re-learn)

- **firmCell TDZ**: computed AFTER a `date<=CYCLE_START` continue at first —
  use-before-init crash on old rows. Compute the firm cell BEFORE the continue.
- **repair-gate.sh counted matrix children as zero**: GHA renames matrix jobs
  `"job (value)"`; an exact-name `jobs[]` filter scored 0 sessions and the
  breaker would never trip for first-contact. Now matches `startswith("job (")`
  and ADDS the child count per run (`count=$((count + ran))`).
- **Attempted-flip push needs credentials restored**: the branch step strips
  `http.*.extraheader`; restore it before the `push_main` call in the
  nothing-filed path or the flip push 401s.
- **Workflow `name:` key** was left commented during scaffolding — an unnamed
  workflow displays as its filename. Check it's set when cloning a YAML.
- **js-yaml validation**: `npm exec --package=js-yaml` fails MODULE_NOT_FOUND on
  this repo's Node; `npm install --prefix "$tmp" js-yaml` + `NODE_PATH=` works.
- **`npm test` is PHONY** ("all") — it always exits 0 through analysis scripts;
  confirm individual `test-*: ok` lines, don't trust the exit code alone.
- **Nine-file commit in the shared tree**: sibling sessions had ~40 unstaged
  files in flight; staged exactly the nine owned paths by NAME, verified
  `git diff --cached --name-only` listed nine before committing (see
  git-prestaged-commit-sweep / shared-repo-session-race).
- **Commit message**: the usual heredoc apostrophe trap recurred (12th time);
  scratch file `.matilda/first-contact-commit-msg.txt` + `git commit -F` + `rm`
  (see shell-command-pitfalls).

## Adjacent contracts

- Modelled on `auspol-newspoll-missing-wave-filer` (signal rides JSON not exit
  codes; commit-nothing is success) and pinned by the same matilda-CLI version.
- The central repair agent must NOT edit this machinery: agent-repair.yml's
  forbidden-paths regex covers `first-contact-(prompt.md|mjs|seen.json)`.
- Test pins live in `.build/test-coverage.mjs` (fixtures 6–10: emission,
  gate-vs-emission suppression split, one-line flip discipline, pick cap).
- Pinning the deterministic kit afterwards (extractor + updater + plist +
  workflow + repair-prompt, Spectre's a584829 shape) is deliberate HUMAN work.
