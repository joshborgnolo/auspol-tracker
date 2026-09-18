---
name: spectre-extraction
description: auspol-tracker — the Spectre Strategy poll agent (.build/extract-spectre.mjs + updater/plist/workflow/repair-prompt kit, built 2026-09-05 as commit a584829) — Squarespace RSS title-filtered to "Australian Federal Poll{ing,itical} Update" items, report PDF href read STRAIGHT from the RSS description (/s/ direct file, NO Drive hop, article-page .pdf scrape as fallback), pdftotext -layout parse of methodology box (WRAPPED fieldwork line), undecided prose, label-line-then-"NN% ±NN" primaries, TPP + Labor-v-One-Nation prose pairs, six-%-cell approval rows with nets DERIVED app-dis (never the printed NET column), PPM/Hanson-h2h prose that is ABSENT in some waves (Jul 2026); Jul 2025 + Nov 2025 are IMAGE-ONLY legacy waves noted under status.notes (canon hand-entered, NOT errors). Regex lessons hard-won from oracle failures: /i makes [A-Z] match lowercase (name regexes must drop /i and demand a leading capital per word), pdftotext right-column layout parks the Hanson % pair ~90 spaces away (needs a ~300-char window), and summary-prose patterns must match \s+-only or odds-section "x%" parentheticals get captured. Canon verification per matched wave (date within 3d) against polls/ppm/ppmHeadToHead/approval/altTpp; KNOWN_DIVERGENCE whitelist (currently empty). Spectre is a live house with NO pollsterRules entry — no un-stop step, unlike Fox & Hedgehog.
source: auto-skill
extracted_at: '2026-09-05T12:19:05.992Z'
---

# Spectre Strategy extraction (blog-3-1 RSS → report PDF → polls.json)

Built 2026-09-05, commit a584829 (worktree-spectre-kit). Mirrors the Fox &
Hedgehog agent pattern: `node .build/extract-spectre.mjs [--check] [--force]
[--url <pdf-or-article>]`; wrapper `.build/spectre-updater.sh`; launchd
`local.auspol.spectre` (weekly Sat 06:00 — cadence is ~quarterly and the CI
sweep is primary, so no month-end window); GH workflow
`.github/workflows/spectre-update.yml` (cron `'50 20 * * *'` = 06:50 AEST
daily, on `poll-agent.yml`, apt poppler-utils); repair prompt
`.build/spectre-repair-prompt.md`; out-of-repo shim
`~/Library/Application Support/auspol-agents/spectre.sh` (thin run.sh
launcher). Provenance cache `.build/spectre-src/` is committed.

## Source facts (verified 2026-09-05)

- RSS: `https://www.spectrestrategy.com/blog-3-1?format=rss` (Squarespace).
- Candidates are items titled "Australian Federal Politic**al** Update - …"
  or "Australian Federal Poll**ing** Update - …". Everything else (AI-use,
  illicit-tobacco, CIS "Generation Trapped", election-forecast, SMH/AFR
  media items, international archive pieces) is skipped on PURPOSE — a
  healthy run's `status.skipped_items` lists ~11 such titles.
- Apr 2026 + Jul 2026 waves carry the report PDF href INLINE in the RSS
  `<description>`: `spectrestrategy.com/s/Political-Update-…-Spectre-
  Strategy.pdf` — a direct Squarespace file fetch, **no Google Drive hop**
  (contrast F&H's tinyurl→Drive chain). Fallback: scrape the article page
  for a `.pdf` link.
- Jul 2025 + Nov 2025 are **image-only legacy waves** (chart PNGs, no
  linked PDF). Their canon rows are hand-entered; the extractor notes them
  under `status.notes` and moves on. A repair agent must NOT try to make
  them parse.

## PDF parse anchors (the bits that drift between waves)

- Methodology box: n + fieldwork window, with the fieldwork MONTH line
  **wrapping** across a line break — the month regex must tolerate the
  wrap.
- Undecided: prose "12% of voters were undecided before apportionment".
  Parsed for NEW waves; the four canon rows predate the field and are left
  as the house entered them.
- Primaries: a party-label line, then the first `NN% ±NN` after the label
  inside the primaries slice.
- TPP: prose pairs — "Labor leads the Liberal National Coalition 51% to
  49% and One Nation 54% to 46%" (second pair → `altTpp`).
- Approval: six %-cells per figure; **canon nets are DERIVED app−dis, NOT
  the PDF's printed NET column**. Row anchored by surname (index < 40 into
  the approvals block).
- PPM page is **absent in some waves** (Jul 2026 has none) — such a wave
  must contribute NO ppm/ppmHeadToHead rows; absence is not an error.

## Regex lessons from the oracle failures (do not regress)

Three bugs cost the first `--check` run; all three are regex-shape traps
that re-bite:

1. **`/i` makes `[A-Z]` match lowercase.** The PPM name group
   `[A-Z][a-z…]+` under an `/i` flag ate "Angus Taylor as …", parsing
   `oppName: "as"`. The name part carries NO `i` flag and demands a leading
   capital per word.
2. **pdftotext right-column layout separates label from value by ~90
   spaces.** "Albanese leads Hanson … (44% vs 39%)" needs a
   `[\s\S]{0,300}` window to reach across the column gutter.
3. **Summary-prose alternation must match `\s+`-only**, never `[\s\S]+`,
   or it slides past the target into the odds section and captures
   "x%"-style parenthesised figures from the wrong market.

## Automation contract + canon verification

Exit 0 ok / 1 fetch-parse / 2 guard trip; last stdout line
`SPECTRE_STATUS {json}` with `changed, check, added[], verified[],
mismatches[], notes[], skipped_items[], item_errors[], candidates[]`;
guard trips also print `SPECTRE_GUARD`. `--check` computes + prints but
never writes. Env redirects: `SPECTRE_OUT` (polls.json), `SPECTRE_SRC_DIR`
(provenance). Matched waves (canon date within 3 d) verify EVERY
mechanical figure against polls/ppm/ppmHeadToHead/approval/altTpp canon;
RSS pubDate-vs-hand-entered `published` stays a NOTE, never a rewrite.
`KNOWN_DIVERGENCE` (currently `{}`) is the F&H-style whitelist for a house
re-upload — add entries only with evidence in the house's own document.
New-wave guards (`guardNewWave`) plus a duplicate/retro-wave check.
**Spectre is a live house with NO `pollsterRules` entry** — there is no
stopped-flag un-stop step (differs from F&H; don't port that logic over).

Row shapes mirror the four hand-entered canon waves (2025-07-02,
2025-10-31, 2026-04-08, 2026-07-23): polls
`{date, published(rss→AEST), dateStart, pollster:"Spectre Strategy",
client:"—", sample, undecided, alp,lnp,grn,onp,ind, oth:null, tpp_alp,
tpp_lnp, url(article page)}`; satellite rows ppm / ppmHeadToHead /
approval / altTpp by the same keys. Canon anchors for the oracle:
ppm 2026-04-08 {alb 41, opp 32, Taylor}; ppmHeadToHead {alb 44, han 39};
approval 2026-04-08 {alb −21, opp 3, han 4}; altTpp 2026-04-08 {52},
2026-07-23 {54}.

## Verification recipe

- Offline oracle: `node .build/extract-spectre.mjs --check` → exit 0,
  `changed:false`, `verified` lists the Apr-2026 (2026-04-08) and Jul-2026
  (2026-07-23) waves `matched:true`, `mismatches: []`, notes only the two
  image-only legacy waves, `item_errors: []`.
- E2E replay: copy polls.json to scratch, strip the Spectre wave(s), run
  with `SPECTRE_OUT`/`SPECTRE_SRC_DIR` redirected → re-added rows must
  equal canon field-for-field; rerun gives `changed:false`.
- Kit sanity after any edit: `bash -n` the wrapper, `plutil -lint` the
  plist, and `diff` each kit file against its F&H sibling
  (`foxhedgehog-updater.sh` / `local.auspol.foxhedgehog.plist` /
  `foxhedgehog-update.yml`) — the intended delta is rename + cadence only.

## Replicating this kit for the NEXT house agent

The F&H→Spectre port (all rename+parm edits, verified by diff against the
templates) is the recipe: extractor (fetchBuffer retry/backoff, pdftotext
`-layout`, atomic writes, `_STATUS` JSON last line, exit 0/1/2, committed
provenance cache, `--check`/`--force`/`--url` + env redirects) → updater
wrapper (extract→validate→render-card(best-effort)→build→pathspec-`git
add`→`push_main`) → plist copied from `local.auspol.foxhedgehog.plist`
(cadence fitted to the house; monthly houses keep the month-end daily
window, quarterly houses need only weekly) → GH workflow on
`poll-agent.yml` (cron slot chosen by `grep -h "cron:"
.github/workflows/*.yml | sort | uniq -c` against existing slots; Spectre
took 06:50 AEST, 15 min after F&H's 06:35) → repair prompt
(diagnose→minimal-fix procedure + UNTRUSTED-CONTENT and never-weaken-
guards rules) → `auspol-agents/<house>.sh` shim via run.sh. `poll-agent.yml`'s
`house` input is a free-form display/log string — no allowlist to edit.
