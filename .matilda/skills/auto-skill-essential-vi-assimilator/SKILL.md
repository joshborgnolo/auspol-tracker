---
name: essential-vi-assimilator
description: The Essential VI assimilator (.build/assimilate-essential-vi.mjs) — converts data/essential-report.csv waves into polls.json poll rows + approval/direction series; CSV vocab (Trend visual TOTAL: Approve/Disapprove, dataset-id-keyed approvals because question labels retitle on leadership changes), the Retro-fill self-repair pass, dup-guard tolerances (±2d date / ±10d figures), published/dateStart conventions, the KNOWN_OTHER_APPROVALS warning gate, and the wrapper's two-run trigger model (CSV-change OR report-index drift) with --apply no-op hygiene (notes vs fixes; proof only when touched). Assimilator 62b0179 + wrapper gating 9cf8a9a (2026-09-02).
source: auto-skill
extracted_at: '2026-09-02T00:00:00.000Z'
---

# Essential VI assimilator (data/essential-report.csv → data/polls.json)

`.build/assimilate-essential-vi.mjs` runs **after** the extractor in
`.build/essential-updater.sh` (extract → assimilate `--apply` → validate → render-card
warn-only → build → wrapper commits the full artifact set). Dry-run by default; `--apply`
writes polls.json (via `D.polls[i] = …` indexed replacement, never Object.assign in place)
plus `.build/essential-src/assimilate-vi-proof.json`. Final line
`ASSIMILATE_STATUS {pollster, added, retro, approval, direction, changed}`.

**Wrapper triggers (9cf8a9a, 2026-09-02)** — the wrapper runs the assimilator on TWO
extractor signals: `"changed":true` (new CSV wave), OR the extractor's
`^updated .*report-index\.json` line (Essential published the wave's release page —
this happens ~8h AFTER the charts, e.g. wave 01:00 AEST vs record `2026-09-01T23:11Z`).
In the drift branch the wrapper parses `ASSIMILATE_STATUS` "changed": true → same
validate/build/commit tail; false → commits the drifted index alone ("Refresh Essential
report index") so the tree stays clean for the next slot's cleanliness pre-flight. The
releaseUrl-arrives-late pattern is a second timing roll-out — the first wave insert and
the releaseUrl retro-fill land hours apart, never in the same run.

## Two passes (extended 62b0179, 2026-09-02)

1. **Retro-fill** — every `assimilated:true` Essential row is incomplete by construction
   (2PP lands after primaries; `releaseUrl` after Essential publishes the report page —
   they publish charts BEFORE the report page). Each run completes `tpp_alp/tpp_lnp`
   (nearest ±2d 2PP wave), `published`, `dateStart`, `releaseUrl`, then rebuilds the row
   in `POLL_KEY_ORDER`. This is what makes the pipeline self-healing for late data —
   don't insert new rows before retro-filling old ones. A row whose CSV wave vanished
   logs WARNING and is skipped, not deleted.
2. **Insert** — new VI waves (tracker date = csvDate − 1 day; waves at/before the
   earliest Essential row ignored — no pre-curation backfill), plus leader-approval rows
   (nets `app−dis` + `detail:{alb:{app,dis},opp:{app,dis}}`, `oppName`, `han:null`) and
   national-mood rows (`{date,dateStart,pollster,right,wrong,unsure}`), each spliced
   date-sorted with `findIndex`.

## CSV vocab (data/essential-report.csv rows that matter)

- VI: `wavesFor("primary","Primary Vote+")`, 2PP: `wavesFor("2pp","2PP+")`. `ind =
  Independent or Other Party + Undecided` (ToP silently dropped — tracker convention);
  `oth:null`, `sample:null` (Essential never publishes exact n in the CSV; Guardian says
  only "more than 1,000", Flourish footer's "min. n=1,000" is a floor — never invent one).
- **Approvals are keyed by dataset id, NOT question label**: Essential retitles leader
  charts on leadership changes (`approval_of_angus_taylor` question label is still
  "Approval of Sussan Ley / Angus Taylor"). Use the label-indifferent `datasetWaves(ds,
  "Trend")` helper. Approval datasets use visual `Trend`, answers `TOTAL: Approve` /
  `TOTAL: Disapprove` / `Don't know`. `national_mood` (E563) is also visual `Trend`
  with `Right direction`/`Wrong track`/`Unsure` — the default `wavesFor(ds,q)` assumes
  `Overall`, so pass `"Trend"` explicitly.
- `LEADER_APPROVAL` map (`approval_of_anthony_albanese` → alb, `approval_of_angus_taylor`
  → opp) is deliberately explicit: **a leadership change spins up a new dataset id**, and
  the WARNING gate must fire so a human extends the map. `OPP_SURNAME` derives the opp
  surname from the map's opp entry, not a literal.
- The warning gate needs `question_id` in the CSV row mapper — the original mapper
  dropped it, which silently broke the `/^Q\d+$/` test (a column-existing-in-header ≠
  a column-extracted-to-row trap). Gate = standing Q-code × visual Trend/Overall × not in
  `KNOWN_OTHER_APPROVALS` (11 standing non-PM/LO series: hanson, bandt, joyce, dutton,
  morrison, chalmers, minns, perrottet, allan, battin, king_charles). One-off E-code
  policy questions would otherwise flood 14+ WARNINGs.

## Conventions duplicated from curated rows

- `published = csvDate + 1d + "T01:00"` (Guardian 01:00 Sydney embargo stamp);
  `dateStart = date − 5d` (fieldwork window); `client: "The Guardian"`.
- `releaseUrl` resolves from `.build/essential-src/report-index.json` with ±1 day slack
  (WP UTC date vs Sydney wave label). Missing ⇒ logged note, retro-fill fills it later.
- Guardian article `url` is NOT derivable — log "hand-set the Guardian write-up URL".
- Dup guards (all insert passes): skip if existing row within **±2 days**, OR within
  **±10 days with identical figures** (publication→fieldwork gap can exceed the date
  tolerance — csv 2026-01-28 is curated at 2026-01-23). Approval figure-dup compares
  `detail` app/dis verbatim, not just nets.
- 2PP is stored undecided-INCLUSIVE (45+50=95); validator auto-registers the sum≠100
  as a documented Essential exception (pollsterRules `tppIncludesUndecided`).

## No-op hygiene (load-bearing for the wrapper's drift trigger)

An `--apply` run that changes nothing MUST write nothing — the wrapper's pre-flight
(`git diff --quiet`) skips the freshness sync on a dirty tree, so a timestamped rewrite
would wedge every later slot. Two traps fixed in 9cf8a9a: pending items ("releaseUrl
still unavailable", "url still unset — hand-set the Guardian write-up URL") are logged
as **notes**, not `fixes` — they must not count toward `retro`/`touched` (previously they
did: every slot between wave and release-page marked "changed"); and the proof file is
written only `if (APPLY && touched)`. General rule for self-repairing pipelines:
informational "still waiting" markers are output, not state change.

## Lessons from the 2026-09-02 retrofit

- Verifying a freshly built page headlessly: the Latest-table row carries the 2PP
  directly (`Essential 26–31 Aug – 45.0% 50.0%`), so you may NOT need the expanded
  card — clicking a row can return page chrome instead of an expansion DOM. Confirm
  approval/direction waves by grepping inlined scripts (`"right":23,"wrong":59`) instead
  of DOM queries.
- BOGAN mode blocks writes outside the workspace — probe scripts live under the repo
  (`.matilda/verify-essential/probe.mjs`), never /tmp.
- Related knowledge in `essential-report-extraction` (Sucuri bypass, crawl recipe) and
  `auspol-extra-datapoint-pipeline` (adding optional per-poll fields end-to-end).
