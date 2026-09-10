---
name: auspol-pollanalyser-gap-audit
description: auspol-tracker — what poll data d-j-hirst/aus-polling-analyser (aeforecasts.com) holds vs our data/, the inventoried gaps (dense F2F Morgan 1943–2013 ~550 pre-1986 readings, Morning Consult VI 223 rows, extra AGB McNair waves, Quadrant/Saulwick, ~2,100 state polls), the read-only diff procedure, and the 2026-09-11 federal import that CLOSED the federal gaps (bonham-additional-aeforecasts: mirror CSV + assimilator, +374 cyclePolls VI / +373 leadership rows — f366e74). Snapshot audited 2026-09-10.
source: auto-skill
extracted_at: '2026-09-10T00:02:10.206Z'
---

# aus-polling-analyser external data inventory + gap audit

When asked "does repo X have polls we don't" or "backfill series Y from
aeforecasts", this is the map. Snapshot taken 2026-09-10; inventories drift —
re-run the diff (below) before importing.

## The remote repo

`d-j-hirst/aus-polling-analyser` (D.J. Hirst / aeforecasts.com methodology,
C++/Python/Stan, default branch `master`). Its committed poll inputs live in
`analysis/Data/`:

- **`poll-data-fed.csv`** — 3,997 federal polls, 1943-06-01→2026-09-05.
  Schema: `MidDate,Firm,Brand,@TPP,LNP FP,ALP FP,GRN FP,ONP FP,NXT FP,UAP FP,
  DEM FP,DLP FP,OTH FP,GLApp,GLDis,Comments` — missing values are `#N/A`.
  MidDate is fieldwork mid-point, not release date.
- **`poll-data-{nsw,qld,sa,vic,wa}.csv`** — ~2,100 STATE polls (nsw 472, vic
  608, qld 400, wa 319, sa 293). auspol-tracker carries no state polling;
  out of scope unless the product expands.
- **`analysis/Regional/*-polls.csv`** — tiny per-cycle regional/seat files
  (2028fed 37 rows etc.).
- **No committed approvals CSVs** — `approvals.py` computes them from the poll
  rows (GLApp/GLDis columns). Don't look for a leadership-ratings datafile.
- Everything under `analysis/Archived/` (Adjustments/Fundamentals/Outputs) is
  model artefacts, not raw polls. `downloads/` has AEC TCP files (we already
  have those series).

## The gaps we found (remote has, we lack)

**STATUS 2026-09-11: federal VI + leadership gaps IMPORTED (commit f366e74)
via the bonham-additional-aeforecasts pipeline — see the section below the
table. Only ~2,100 state polls remain out of scope.**

| Series | Remote rows | Status after f366e74 |
|---|---|---|
| **F2F Morgan (face-to-face Gallup) 1943–2013** | 1,214 — by decade: 40s:20, 50s:39, 60s:44, **70s:177, 80s:269** | **PARTIAL** — 195 F2F/Morgan VI rows 1987→2016 inserted into cyclePolls; pre-1987 rows CSV-only (user call: no new pre-1990 buckets) |
| **Morning Consult federal VI 2020-03→2026-04** | 223 (222 with leader-approval) | **GL ONLY — VI never existed upstream** (all MC VI cells `#N/A`); ~250 weekly MC pmNet rows 2020-03→2026-04 imported into cycleApproval (2019/2022) + 7 into approval[] |
| **AGB McNair 1992–1996** | 102 (100 w/ approval) | **CLOSED** — 95 VI + ~99 pmNet rows inserted |
| **Quadrant 1988–1998** | 14 | **CLOSED** — 12 inserted (remainder date-merged with existing waves) |
| **Saulwick (Age Poll) 1988–1993** | 8 | **CLOSED** — all 8 inserted |
| Singletons | ARS 1, McCrindle 1, uComms 1, Lonergan 3, AMR 4 | **CLOSED** — ARS 1, McCrindle 1, uComms 1, Lonergan 2, AMR 2 inserted |
| Modern shortfalls | ReachTEL 60, Ipsos 44, SMS Morgan 4, Agenda C 2 | **PARTIAL** — ReachTEL +12, Ipsos +3, +42 modern Roy Morgan weeks (2018→2023, existing-bucket gaps); remaining shortfalls are rows upstream ALSO lacks vs our live coverage, or election rows we already mirror |

Nielsen is roughly matched (their 184 1996–2014 vs our acnielsen 157 + 38
cyclePolls Nielsen). Essential/Newspoll/Morgan multi-mode/Resolve/etc. match
or we have more. Their F2F Morgan rows carry NO GLApp/GLDis (pre-Newspoll
approval isn't in their DB either — our trove-leader-approval.csv 1942–85 is
something we hold that they don't).

What we hold that they don't: Trove pre-1985 approval, Resolve question-level
CSV, AGB *mentions* provenance, denser live 2025–26 coverage.

## Our local coverage map (for any gap diff)

Summarise before comparing — schema lives in auto-skill-auspol-pollsjson-schema
/ auto-skill-auspol-historical-csv-qa; the era map as of 2026-09-10:

- `polls.json.polls` — 158 rows, modern era only (2025-05-03→), all live houses
- `polls.json.cyclePolls` — 2,873 rows, 1987-08-23→2025-05-03, keys are
  term-END years (1990..2025); Newspoll 593, Morgan 638 (1998–2016),
  Essential 637, ACNielsen 110, Galaxy 50, ReachTEL 62, Ipsos 43,
  +374 from the aeforecasts import (Morgan+195, AGB McNair+95, Roy Morgan
  +42, Quadrant+12, Saulwick+8, ReachTEL+12, Ipsos+3, singletons+7)
- `polls.json.cycleApproval` — +373 from the import (AGB McNair ~99 pmNet
  rows 1992–95, Morning Consult weekly 2020-03→2026-04, sparse
  Morgan/ReachTEL/Ipsos/Lonergan)
- `polls.json.approval/ppm/direction` — modern only (2022+/2025+); approval[]
  gained 7 Morning Consult pmNet rows 2025-05→2026-04
- `data/*.csv` — newspoll-* (1985→2022-04), roymorgan-* (election rows back
  to 1901 but poll rows only recent-era), acnielsen-polls.csv (1996–2012),
  essential-report.csv (question-level, 2007→), trove-primary-vote.csv (51
  rows 1943–85), galaxy-federal-pre2012.csv (21 rows)

## The bonham-additional-aeforecasts pipeline (shipped f366e74, 2026-09-11)

What exists now:

- `data/bonham-additional-aeforecasts.csv` — verbatim mirror of
  `analysis/Data/poll-data-fed.csv` (3,997 rows + header). Refresh with
  `node .build/refresh-bonham-additional-aeforecasts.mjs`.
- `.build/assimilate-bonham-additional-aeforecasts.mjs` — folds missing rows
  into `data/polls.json`. Idempotent (dry re-run: vi:0 gl:0 changed:false).
  Inserted rows are PLAIN poll/GL rows (no provenance marker in polls.json) —
  the audit trail is `.build/aeforecasts-src/assimilate-proof.json`, the full
  dump of every inserted row with its target location.
- `.build/aeforecasts-src/` — cached upstream CSV + `assimilate-proof.json`.

Adjudications baked into the assimilator (don't relitigate):

- Morgan era-named `Morgan` ≤2016 / `Roy Morgan` ≥2019 per bucket.
- `oth` folded into sums but excluded from wave/clash identity.
- Modern Morgan weeks kept REPORTED-only (no renormalisation); the
  `cyclePollBases` note `"2025|Roy Morgan"` documents Σ≤105 weeks.
- Current-term (`polls[]`) inserts restricted to Morning Consult GL rows
  only — upstream MC VI columns are all `#N/A`, so NO MC voting-intention
  rows exist to import. Don't add MC to pollster extraction rules looking
  for VI; it genuinely isn't there.
- Pre-1987 rows deliberately LEFT csvOnly (user decision: no new pre-1990
  cycle buckets) — they live in the mirror CSV only.
- State polls (~2,100 rows) deliberately out of scope.

Validate gate: `node .build/newtracker/validate.mjs` → 0 errors, 267
documented exceptions (includes the 2025|Roy Morgan Σ-note).

## Re-running the audit (read-only)

1. Enumerate the repo: `curl -s
   "https://api.github.com/repos/d-j-hirst/aus-polling-analyser/git/trees/master?recursive=1"
   -o /tmp/pollanal-tree.json` → filter blobs for csv/json paths.
2. Download candidates: `raw.githubusercontent.com/d-j-hirst/aus-polling-analyser/master/<path>`
   into `/tmp/pollanal/` (keep the working tree clean — /tmp only).
3. Profile per file with a node one-liner: rows, MidDate min/max, per-Firm
   counts, non-`#N/A` GLApp counts.
4. Profile local the same way (polls.json arrays + `data/*.csv` year spans)
   and diff firm × era. Report; never import without user confirmation.

Gotcha: in plan mode the shell is hard-gated — get user approval via the plan
flow before running the curls; web_search cannot enumerate repo file trees
(firecrawl extraction of github.com tree pages fails).
