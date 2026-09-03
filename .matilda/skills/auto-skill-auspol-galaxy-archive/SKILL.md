---
name: auspol-galaxy-archive
description: auspol-tracker — the Galaxy archive is a RECONSTRUCTION (galaxyresearch.com.au is dead, house absorbed by YouGov 2017), not a mirror like Morgan's. Pipeline: extract-galaxy-archive.mjs (Wayback CDX index + --verify of the transcript; --verify-only runs the gate alone) → galaxy-federal-pre2012.csv (21 hand-curated waves, each citing its page) → assimilate-galaxy-cycle-csv.mjs (18 complete waves into cyclePolls; 3 stay transcript-only, absent-not-zero applied to a whole column) → refresh-galaxy-archive.mjs (archives/galaxy page). Key traps: --verify FETCH failures are transient Wayback 503s (probe the single URL; CHECK rows are the real errors), the verifier searches post BODY only (comments quote numbers everywhere), the assimilator is idempotent and re-dates a same-day second wave to its publication date to satisfy validate check 8, and historical cyclePolls rows never touch index.html — they ship only in the cycle-source sidecar.
source: auto-skill
extracted_at: '2026-09-03T07:12:22.761Z'
---

# Galaxy archive pipeline (auspol-tracker)

Galaxy polled federally 2004→2015, then was absorbed into YouGov (announced
15 Dec 2017); galaxyresearch.com.au is dead and its owner kept nothing. The
archive is therefore a **reconstruction**, not a mirror — contrast
`.build/refresh-morgan-archive.mjs`, which re-fetches a live site. Sources: Wayback captures of the WordPress release posts (2012 on,
114 archived) and of `pubpolls.html`, William Bowe's Poll Bludger write-ups
(his 2007 running table is why that year's ALP/L-NP/2PP record is complete),
the Courier Mail's still-live `media01.couriermail.com.au` **polldetail
PDFs** (Galaxy's own printed trend tables — two 2007 PDFs between them carry
every 2007 wave's Greens/others shares and fieldwork windows, the record
Bowe's table omitted; figures agree with pubpolls.html wherever both
survive), and the GhostWhoVotes mirror of release scans.

## Files and run order

1. `node .build/extract-galaxy-archive.mjs --apply --verify`
   - Rebuilds `data/galaxy-release-index.csv` live from the Internet Archive
     CDX API (re-runs pick up new captures). CDX trap documented in the
     script header: `*` in the url + `matchType` together silently return
     almost nothing.
   - `--verify` re-fetches every row of `data/galaxy-federal-pre2012.csv`
     from the page it cites and looks for the printed 2PP pair. A row that
     no longer matches its source is an ERROR (exit 1), not a warning — the
     CSV is a transcript.
2. `node .build/assimilate-galaxy-cycle-csv.mjs --apply`
   - Merges waves with a COMPLETE row shape (alp/lnp/grn/oth/tpp pair) into
     `cyclePolls`. 18 of 21 qualify; a wave whose Greens share was never
     published stays a transcript row — the repo's absent-not-zero rule
     applied to a whole column. Dry-run by default; re-runs are no-ops
     (dedupe on cycle+date+firm), so it is safe to run as a "did it land?"
     check.
3. `node .build/refresh-galaxy-archive.mjs` — regenerates
   `archives/galaxy/index.html` (21 waves, tracker-carried vs transcript-only
   rendered from the same completeness test the assimilator applies).
4. `node .build/newtracker/build.mjs` — pushes polls.json changes into the
   past-cycles payload.

## `--verify` failure modes (learned 2026-09-03)

- Output lines are `ok` / `CHECK` / `FETCH`. **FETCH ≠ a data problem**: one
  Wayback capture 503'd mid-run and the pass reported `20/21` with exit 1;
  the same capture served fine on retry and the row (2004 final, 48/52 off
  Galaxy's own accuracy table) confirmed. A full re-run of 21 Wayback+Poll
  Bludger fetches just to clear one flaky capture is wasteful — probe the
  single URL directly with a short node `fetch`, strip tags, and test the
  three pair shapes by hand. Re-run the whole `--verify` only when a CHECK
  row appears.
- The verifier searches the post BODY ONLY (Poll Bludger comment threads
  quote poll numbers at each other, so a whole-page search matches "52-48"
  almost anywhere and proves nothing) — headline + `.entry-content` up to
  the comment block, or the whole document for plain Wayback tables.
- Three printed shapes, either direction: prose `52-48`, table row
  `52 48`, or both of `52%`/`48%` present.
- Wayback fetches carry a descriptive UA string; hammering the CDX API +
  21 page fetches in a loop invites the 503s above. A single `sleep 20`
  cleared it.

## Transcript row conventions (`data/galaxy-federal-pre2012.csv`)

- `date_basis` decides the row's date: `fieldwork_end` where a source
  states the window, else `date` (publication/table date, ±1 day against a
  monthly-mean series — accepted, noted in the script header).
- Two waves resolving to ONE date would trip validate.mjs check 8
  (mis-keyed-date signature); the assimilator keeps the later one's
  PUBLICATION date instead (the two 2010-07-17 waves — logged when it
  fires). Choosing between two published facts, never inventing a third.
- A note prefixed `SUSPECT` excludes the row from assimilation outright
  (2009-06-29: Coalition primary printed 30 can't produce a 56-44 2PP).
- When a write-up and the house's own table disagree, the TABLE wins and
  the note records the divergence (the 2004 final: Coalition primary 46 in
  Galaxy's accuracy-table split Lib 41 + Nat 5 vs Bowe's 45 — table used).
- The Courier Mail polldetail vein runs 2007–2008 ONLY (CDX-exhausted):
  media01.couriermail.com.au holds no Galaxy material outside that run, and
  the Telegraph/news.com.au hosts hold none at all. A 2026-09-03 sweep of
  every surviving source (CDX windows around each wave, Bowe's posts,
  Wikipedia's polling tables) found nothing for the three remaining
  transcript-only waves (2004-09-20 primaries, 2009-06-29 Coalition/Greens/
  others, 2010-06-25 primaries — the snap poll had no trend-table PDF at
  all, consistent with 2PP-only reporting). Treat those three as exhausted
  unless a NEW source family appears.
- Dating an UNDATED wave is legitimate when an independent fact pins it:
  Galaxy's accuracy table never printed the 2004 final's date; Bowe's
  4 Oct 2004 post on the next fortnightly wave prints the IDENTICAL 52-48
  and the series' next slot fell after polling day, so the accuracy-table
  row IS the 4 Oct poll. The note states the whole chain; the page renders
  it as a method paragraph.

## Historical-row materialisation — no diff in index.html is NORMAL

cyclePolls rows ship ONLY in the hashed `assets/cycle-source.<hash>.json`
sidecar (fetched by the Past cycles tab alone); the main aggregate covers
the current term. So after adding a historical wave, if the data row
already landed in polls.json before your rebuild, `git status -- index.html
assets/` shows NOTHING — the content-addressed sidecar regenerates
byte-identically. Verify the row by grepping the sidecar for the date, not
by expecting an index.html diff (see also the cycle-source section of
auspol-past-cycles, and check the accuracy panel picks the wave up as
that house's final where it qualifies).

## Shared-tree caution

This repo carries sibling sessions' uncommitted WIP constantly (2026-09-03:
dozens of unrelated modified files). Scope any commit to exactly:
`data/galaxy-federal-pre2012.csv`, `data/polls.json`,
`archives/galaxy/index.html`, plus `data/galaxy-release-index.csv` only when
`--apply` rewrote it — see the git-prestaged-commit-sweep and
shared-repo-session-race skills.
