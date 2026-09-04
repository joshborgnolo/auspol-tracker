---
name: auspol-pollsjson-schema
description: auspol-tracker — data/polls.json array schemas bite probes that
  assume one shape: VI polls/direction key the house as `pollster`, ppm /
  approval / ppmHeadToHead key it as `firm`; a python `.get('firm')` filter on
  `polls` silently returns EMPTY and reads as "house stopped publishing".
  Also the date semantics (date = fieldwork END, published can lag days), the
  All-polls display rule (rows = VI-measuring polls only; leadership rides in
  the expanded detail keyed same date+firm), and the current-era
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
- So a "22–25 June" user citation maps to `date: <YEAR>-06-25`, and a June
  article about it can mean `published` in late June. Also check the YEAR
  the user means — the whole in-session confusion was 2025 vs 2026.

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

## 4. "I can't see poll X in All polls" — current-era ladder (all shell, ~90s)

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
