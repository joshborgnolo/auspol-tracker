---
name: auspol-pollsjson-schema
description: auspol-tracker — data/polls.json array schemas bite probes that
  assume one shape: VI polls/direction key the house as `pollster`, ppm /
  approval / ppmHeadToHead key it as `firm`; a python `.get('firm')` filter on
  `polls` silently returns EMPTY and reads as "house stopped publishing".
  Also the date semantics (date = fieldwork END, published can lag days), the
  All-polls display rule (rows = VI-measuring polls only; leadership rides in
  the expanded detail keyed same date+firm), the polls[] `sumNote`/`tppSumNote`
  anomaly fields (validate.mjs excuse; a sumNote row is gated out of gen-data's
  impOk and shows "&mdash;" for implied 2PP in the archive &mdash; the note is
  never rendered on-page), the archive's yearless DD&ndash;DD Mon date column
  that makes a year-old wave paste as current, and the current-era
  "I can't see poll X in All polls" verification ladder.
source: auto-skill
extracted_at: '2026-09-04T01:43:34.977Z'
---

# polls.json schema traps + current-era visibility triage (auspol-tracker)

Worked example (2026-09-04): user says "Newspoll 06-25 isn't in the All-polls
table". First probe filtered `polls` with `p.get('firm') == 'Newspoll'` →
empty → wrongly concluded "Newspoll has no VI waves since May". A later
`p['firm']` crashed with KeyError and exposed the real schema. Data was fine
the whole time (committed in HEAD, built, live); the user was also scanning
June **2025** for a **2026-06-25** wave.

## 1. The key asymmetry (the trap that bit)

`data/polls.json` top-level arrays use DIFFERENT house-name keys:

- `polls` (voting-intention waves) → **`pollster`** — full row shape
  (verified in-session): date, published, dateStart, pollster, client,
  sample, sampleEff, alp, lnp, grn, onp, ind, oth, tpp_alp, tpp_lnp, url,
  releaseUrl, assimilated. NOTE: `tpp_alp/tpp_lnp` may be null on a real row
  (Newspoll 2026-06-25 filed primaries only).
- Optional `samplePending: true` (added 2026-09-09, first use YouGov
  2026-09-08): the wave carries full figures but no
  `sample`/`sampleEff`/`methodUrl` yet — the house's per-wave APC
  methodology PDF wasn't posted at landing. Absent-not-zero (it's a
  TRANSIENT flag, dropped on backfill); validate.mjs rule 5 exempts it via
  a documented `sample-pending` exception and gen-data prices implicit
  n=1200 (`Math.min((p && p.sample) || 1200, SAMPLE_CAP)`) regardless.
- Optional measured-split fields (RedBridge/Accent only, absent-not-zero):
  `tpp_split: {grn, onp, oth}` = the house-printed respondent-allocated
  ALP share of each cohort's preferences on the classic pairing, and
  `tpp_split_on: {lnp, grn, oth}` = the same for its Labor-vs-One-Nation
  head-to-head (parsed from report Table 1's "Labor vs. One Nation"
  sub-block; 5 waves carry it). Never synthesise or round-trip-fill absent
  waves — gen-data §7d's FLOW_ON term mean reads only the published set.
- Optional `sumNote` / `tppSumNote` on a polls[] row: DOCUMENTED sum
  anomalies. `sumNote` = the printed primaries legitimately stray from
  Σ100 — worked example (YouGov "Public Data" wave, field 25–30 Sep
  **2025**, client "—", sample 1329/eff 880): the printed OTH of 14%
  includes 7% undecided, so the primaries sum to 107; the note says so
  verbatim ("Faithful to the release."). validate.mjs check 8 excuses the
  row via `excuse("primary-sum", …, p.sumNote)` (~:76); `tppSumNote` does
  the same for tpp_alp+tpp_lnp≠100 (~:88). CASCADE into the site: a
  sumNote row fails gen-data's `impOk(p)` (~gen-data.mjs:271 — full
  primary set AND no sumNote), so the bundle emits no `alpImp`/`alpOnImp`
  and the All-polls row renders "—" in the implied cells while its
  PUBLISHED 2PP still shows. The note text itself is data-only — no
  renderer surfaces it anywhere on the page, so the dash is unexplained
  to readers and arrives as "why no implied 2pp for …" questions.
- `direction` → also **`pollster`** (gen-data.mjs ~l.824 `d.pollster`).
- `ppm`, `approval`, `ppmHeadToHead` → **`firm`**, shape
  `{date, firm, alb, opp, oppName, han, …}`; approval detail nests
  `detail.{alb,opp,han}.{app,dis}`; ppm carries `extra:[{alb,opp}]` for the
  second (standard better-PM) pairing on a forced-choice row.

### Probe hygiene

- Filter `polls`/`direction` by `['pollster']`, leadership arrays by
  `['firm']`. Use subscript `p['pollster']`, NOT `p.get(...)` — a KeyError
  is a feature; `.get` returning None on every row looks exactly like
  "no matching rows" and silently invents a disappearance.
- After any probe, print `len()` and eyeball a sample row's `keys()` before
  drawing conclusions from an empty result. Counts per house caught the
  error here ("Newspoll 0 waves" was absurd against 17 expected).

## 2. Date semantics on poll rows

- `date` = **fieldwork END** ("22–25 Jun" files as `2026-06-25`).
- `published` is separate and can lag days (`2026-06-25` wave published
  `2026-06-28T20:00`); `dateStart` = fieldwork start.
- `published` PROVENANCE (commit 6d7959b, "Published was the last day of
  fieldwork wearing another name"): hand-stamped per row off the source
  page's `article:published_time` og meta, stored as **local AEST without
  offset** (`2026-09-13T08:00:00Z` → `"2026-09-13T18:00"`); never assumed
  or derived from `date`. No pipeline script writes it — assimilated
  auto rows land WITHOUT it (see resolve-monitor-extraction for Resolve's
  enrichment gap). Consumers: next-expected-polls' release-date key and
  the archive's sort-by-release both prefer `published` over `date`.
- So a "22–25 June" user citation maps to `date: <YEAR>-06-25`, and a June
  article about it can mean `published` in late June. Also check the YEAR
  the user means — the whole in-session confusion was 2025 vs 2026.
- YEARLESS-DISPLAY TRAP (worked 2026-09-23, the "25–30 Sep" hunt): the
  All-polls archive's date column renders `DD–DD Mon` with NO YEAR, so a
  year-old wave pastes out of the page exactly like a current or upcoming
  one (the Sep-**2025** YouGov sumNote wave read as a future-dated oddity
  on 23 Sep 2026 and was initially mis-triaged as a Next-expected-polls
  projection). When a user-pasted row can't be matched by date in
  polls.json, locate it in the BUILT data bundle by a unique number
  instead: the bundle stores display strings (`field:"25–30 Sep"`, en
  dash), so ISO-date greps like `2026-09-25` miss entirely, while
  `"sample":1329` survives minification verbatim and finds the row (then
  read its `ym`/`released` for the true year).

## 3. What the All-polls archive actually renders

(gen-data.mjs comment ~l.815–821, the `DIR_BY`/leadership keying block):

- Archive row set = `individualPolls` = every `polls` row — i.e. waves that
  **measured voting intention**. No VI → no table row, full stop.
- Leadership readings (ppm/approval/direction) are **keyed onto the
  same-date, same-house VI row** and show only in that row's **expanded
  detail** — never as table columns. A wave with leadership but no VI
  appears only in the monthly leadership series.
- Null-2PP rows still render (console log counts `no 2PP` separately).
- Historical reference CSVs (`data/newspoll-*.csv`, `roymorgan-*.csv`) end
  at 2022 — current-era rows are NEVER there (see
  auspol-historical-csv-qa). Current-era leadership lives ONLY in polls.json.

Lineage fact that caused the 2025 mis-hunt (as of 2026-09-04): the `polls`
array spans 2025-05-03 → 2026-08-31 (157 rows) and Newspoll's series starts
**2025-07-17** — there is no Newspoll wave in June 2025 at all (that month:
Roy Morgan ×3, RedBridge ×1). Re-check before quoting; span will have moved.

## 4. cyclePolls-side objects an importer meets

- `cyclePolls` — keyed term-END year (the 1987 election runs end 1990 → all
  1987–90 rows file under `"1990"`); rows are plain VI rows keyed DATE+firm.
- `cycleApproval` — keyed term-BEGIN year by contrast (don't mix these up).
- `cyclePollBases` — adjudicated primary-sum basis NOTES, written directly
  into polls.json AS DATA. validate.mjs check-8c is presence-only: when a
  bucket's bona-fide rows legitimately stray from Σ100 (e.g. Morgan-era
  printed tables itemising minors inside "oth", or modern multi-mode weeks
  published unrounded — one 2023-08-24 Roy Morgan week sums 105), the note
  `"<year>|<firm>"` is what makes the validator accept it. It is NOT a
  code-side allowlist in validate.mjs.
- validate.mjs's strict gates (KNOWN_POLLSTERS, ASSIMILATED_OK, checks
  1/8a) scan ONLY current-term `polls[]`. Bulk inserts into `cyclePolls`:
  unknown/one-off house names need NO validate.mjs edit — don't
  "pre-emptively" add firms to KNOWN_POLLSTERS for historical-only rows.

## 5. "I can't see poll X in All polls" — current-era ladder (all shell, ~90s)

1. **Canonical row, worktree**: load `data/polls.json`, filter
   `p['pollster']==house and p['date']==d`. Note `tpp` nulls.
2. **Committed?** `git show HEAD:data/polls.json | python3 …` — worktree can
   hold uncommitted/foreign hunks in this shared repo.
3. **Built?** grep `index.html` for the row's URL hash fragment (e.g.
   `3c57c1c5`) — URL literals survive the build.
4. **Live?** `curl -s https://auspoltracker.com/ | grep -c <fragment>`
   (see auspol-live-site-verify for deploy forensics).
5. If all four pass, it IS rendered — redirect the user: correct YEAR and
   month section of All polls; leadership numbers sit in the expanded detail;
   Latest-polls table only covers recent waves, old waves are archive-only.

For the PAST-cycle version of this question (accuracy panel, term-END
keying, cycle-source sidecar) use auspol-missing-poll-triage instead.
