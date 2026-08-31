---
name: resolve-monitor-extraction
description: Extract/update the SMH Resolve Political Monitor polling series — 2026 interactive's data.json (values xor-obfuscated parseInt(str,36)^123, scheme detected per-payload) with CryptoJS "sacho" fallback for the frozen-2021 endpoint -> repair-aware keyed merge into data/resolve-political-monitor.csv via .build/extract-resolve-rpm.mjs (exit-code contract, RPM_STATUS json); assimilate VI + preferred-pm + leadership approval into polls.json via .build/assimilate-resolve-vi.mjs.
source: auto-skill
extracted_at: '2026-08-30T10:30:00.000Z'
---

# Resolve Political Monitor extraction (SMH / Nine interactive)

Tracker URL is a paywalled shell; the app is an iframe. **2026 rebuild** (learned the hard way, Aug 2026): SMH moved the interactive to `interactive/2026/political-monitor/site/` but **kept serving the 2021 data.json — frozen at the 2026-07-12 wave.** A dead endpoint that still answers 200 is invisible to status checks; the extractor looked healthy for weeks while going stale. `RPM_STATUS.source_updated` is the tripwire — record and diff it. Refresh: `node .build/extract-resolve-rpm.mjs` from repo root.

Live data URL: `https://www.smh.com.au/interactive/2026/political-monitor/site/data/data.json`. Legacy: `https://www.smh.com.au/interactive/2021/political-monitor/data/data.json` (frozen — keep ONLY to replay pre-2026 history).

## Payload encodings (two generations, one script)

`data.json` is **gzipped JSON** (magic `1f 8b`) despite the extension — sniff bytes, gunzip via `node:zlib`, ignore `Content-Encoding`.

- **2021 generation**: every value and question is a CryptoJS passphrase ciphertext `"!e!<base64>!e!"`, passphrase `sacho` — `base64("Salted__" + salt + ct)`, EVP_BytesToKey MD5 chain → AES-256-CBC (~15 lines of `node:crypto`; never add crypto-js to the repo).
- **2026 generation**: question texts ship **plaintext**; timeseries values ship per-point obfuscated as int part `base36(value XOR 123)` + verbatim decimal tail — decoded by `Ux()` in the site's own bundle. `"2l"` → 93 ^ 123 = 38; `"2l.83"` → 38.83. JS XOR is signed, exactly as upstream. `decrypt()` passes non-`!e!` strings through, so one function handles both generations' questions.
- 2026 also stores **unrounded** values (1–2dp) where 2021 stored ints.
- **Scheme is detected per-PAYLOAD, never per value**: a pure-digit cipher ("31") is a plausible plaintext number, so the rule is all values must agree — all-`!e!` → crypto, all matching `/^-?[0-9a-z]+(\.[0-9]+)?$/i` → xor, anything mixed or unrecognised → throw ("upstream restructure?"). Stop, don't guess.

## Data model (2026 payload: `{updated, sections[13]}`)

Section id → CSV `dataset`: `Q5 primary_vote`, `Q17 pm_performance`, `Q15 opp_leader_performance` (Aug 2022+), `Q19 preferred_pm`, `Q21a party_attributes`, `Q21b party_descriptors`, `Q22 who_will_win`, + `Q25NSW/Q28NSW/Q29VIC/Q32VIC/Q33QLD/Q34QLD` (state primary/preferred-premier). `Q11 well_being_index` is **RETIRED** (in `RETIRED`, not required by the guard — its CSV series stays, ends 2026-07).

Answers carry dimension arrays `states`/`age`/`gender`/`categories` with `{key, timeseries:[{date:"DD/MM/YYYY", value, parties?[]}]}`.

- **Leadership datasets name their answers by POSITION** (`preferred_pm`, `preferred_premier_*` in `LEADER_NAME_DS`): the q# answers-array index zips with each point's `parties[]` array. Slot labels (`answerFirst/answerSecond/answerUndecided`) carry no meaning — Nine re-keys them across waves and leadership changes (proved by the Angus Taylor ↔ Susan Ley / One Nation slot swap, 2026-05-17). `who_will_win` is deliberately NOT name-resolved — its zero-fill defect is keyed by slot name.

## CSV output (`data/resolve-political-monitor.csv`, 10 cols)

`dataset,question_id,question,visual,answer,dimension,key,date,value_pct,parties` — **values unrounded since the 2026 scheme** (the disseminator's tenths are real signal; repeat-rounding wrought quiet damage on the old int CSV).

Keyed merge (not append-only): existing rows → drop corrupt live-Q22 2021 rows → relabel legacy → concat fresh → reconcile net rows (`Net (Coalition - Labor)`, `Net (Good - Poor)`; >1.5pp) over the combined set BEFORE dedupe → dedupe → rewrite. Merge counters, all in `RPM_STATUS`:

- `rep_rounding` (~26,765): committed int vs fresh decimal within ±0.5 → keep the int quietly. NOT a conflict.
- `wiw_restored` (30 on first 2026 run): who_will_win `answerSecond` zero fill from Apr 2026 → restore from the fresh decimal.
- `meta_drift`: value-equal key collisions (same point, different meta) — informational; count changes run-to-run as restorations land (12 → 42 between runs 1 and 2 is expected, not a bug).
- `value_conflicts` + per-dataset `conflictFams`: genuine committed-vs-fresh disagreements — committed wins, printed as samples.

Legacy repairs carried from the 2021 era (all still live): corrupt live-Q22 Apr–Jul 2021 rows dropped on both import paths (Q444 archive authoritative); `leader_performance` → `opp_leader_performance` for pre-2022-08-21 (it tracked Albanese the whole time — verify against published figures, never trust "legacy ≈ pm_performance"); Feb 2026 Ley counterfactual retagged `primary_vote_ley_scenario`; 2024-02-25 LNP 36-vs-37 deliberately mirrors upstream (tracker keeps 37, `LNP_OK` in the backfill script).

**The CSV mirrors Nine's feed, not the rendered site** — a dataset absent from smh.com.au's UI (Q11 wellbeing) still updates; "not on the website" ≠ stale. Question texts are chart titles, not questionnaire wording — don't grep for survey wording; cite Resolve Strategic's notes.

## Char-stream CSV parser: the newline cell-reset (shared-bug pattern, Aug 2026)

The quote-aware parser copied across the repo's .build scripts had its newline branch `row.push(cell); rows.push(row); row = [];` — **missing `cell = ""`**. Effect: each row's last cell is prepended to its successor's first field. Rows after a row whose last column is non-empty get a glued first field — for the Resolve CSV, 61 of 62 `preferred_pm` National waves parsed with `dataset` = `"Scott Morrison; Anthony Albanese; Undecidedpreferred_pm"` and were invisible to `dataset === "preferred_pm"` filters. The burn pattern: pipes that key on EARLY columns survive silently; anything filtered on the first column dies softly. Fixed in `assimilate-resolve-vi.mjs` and `assimilate-essential-vi.mjs` (Essential's CSV always ends in an empty last cell — luck, not safety). `check-resolve-vs-tracker.mjs` and `backfill-resolve-approval.mjs` always had the reset. **Audit any copied char-stream parser for the reset on BOTH the comma and newline branches.**

## Scheduled automation (exit-code contract)

`node .build/extract-resolve-rpm.mjs [--check] [--force] [url-or-file]` — positional arg doubles as fixture file for offline testing (`existsSync` → read file, else fetch).

- **exit 0** ok; final stdout line `RPM_STATUS {json}` (changed, row counts, all merge counters, `source_updated`, `new_dates`). **exit 1** fetch/parse error (`RPM_ERROR msg`, incl. mixed/unrecognised scheme). **exit 2** `RPM_GUARD`: expected section missing, or merge would shrink the committed row set (`--force` after review).
- Idempotent: byte-compare, no write when unchanged; atomic tmp-then-rename. Guard runs before the no-change branch.
- `process.on("unhandledRejection")` does NOT catch top-level evaluation throws (Node 23) — wrap main in try/catch; relative paths only; fabricated fixtures need no encryption (decrypt passthrough).

launchd job `local.auspol.resolve-rpm` drives the wrapper (.build/resolve-rpm-updater.sh): extract → changed-gate → assimilate --apply → validate → build → commit/push; log at `.build/logs/resolve-rpm.log`.

## poll.json assimilation (three sections — `.build/assimilate-resolve-vi.mjs`)

Rewritten Aug 2026 into `VI` / `preferred_pm` / `pm+opp approval`. Conventions (must all be relearned before editing):

- Wave row dated **csvDate − 1 day** (curated rows use fieldwork-end); waves at/before each section's earliest curated row skipped (no backfill); **+/-2-day date-dup** and **+/-10-day figure-dup** skips → re-runs are no-ops, curated rows never duplicated. ppm leader shape: PM must be Albanese + exactly one non-Hanson, non-undecided opposition leader, Hanson optional; anything else skipped LOUDLY (logged), never guessed.
- Rounding: CSV is unrounded; polls.json holds ints — half-up at the boundary. Known delta class: SMH's printed article ints are editorially rounded by Nine and can disagree with half-up by 1 on knife-edge values (curated 2026-08-15 opp approval 40 vs payload 40.86 → curated net 7, auto 8). Auto rows follow the PAYLOAD and carry `assimilated: true` (provenance + validator sample-size exemption).
- Rows get `soft` from `vote_firmness` TOTAL SOFT (±2-day nearest-match); approval rows omit `han`/`fav` (not in the 2026 payload — SMH article embeds only).
- Verified by replay: delete the curated 2026-08-15 rows from a polls.json copy → dry-run regenerates VI 28/23/12/26/7/4 + ppm 32/19/26 (Taylor) EXACTLY, approval −16/8 (curated −16/7, the editorial delta). 2026-08-30 launchd run: dry-run adds 0 against the committed tree.

Read-only cross-check remains `.build/check-resolve-vs-tracker.mjs`; historical repair writer is `.build/backfill-resolve-approval.mjs`; per-row `soft` backfill for pre-assimilation rows is `.build/assimilate-resolve-soft.mjs`. After any writer: `node .build/newtracker/validate.mjs` then `build.mjs`, clean before commit.
