---
name: auspol-past-cycles
description: auspol-tracker — Past-cycles machinery end-to-end (CYC_META → CYCLE_DEFS → 9f09dca2 data asset + root cycle-source.<hash>.json). Adding a historical cycle is ONE CYC_META row + ONE elections row in polls.json; the renderer, accuracy panel, legend and CSV export are fully data-driven — only copy strings hard-coding the count (now "ten"/"since 1996") need parallel edits. Keyed gotchas: src keys cyclePolls by term-END election, appr keys cycleApproval by term-START, ELECTIONS["e"+year] must exist for the lead-anchor, and accuracy rows are labelled by the election being CALLED (c.src), not the term-start year. The CycleChart person-toggles (Hanson '25 `hanCtl`, One Nation) are the ONE non-CYC_META part: they gate on DATA AVAILABILITY, never the cycle chips — Hanson can stand alone with every chip off (a062495). Legend chips name split terms with BOTH officeholders from c.raw.netEras joined "–" ("Rudd–Gillard", 90db0a4); D.cycles items are TRANSFORMED objects — eras/series live under .raw, never top-level. Also covers the historical ribbon (7240d7d): cycBanded ≥3-past-terms gate shared by chart+legend; drawnCycles swap; pctOf quartile stats; TrendChart areas (cyc-band lo/hi fills, class-beats-opacity-attribute theming; fill colour is the --cyc-fill variable = color-mix oklch 50/50 Labor→Coalition purple since ab4de49, one :root definition that follows theme via use-site var resolution); ('Mean of past terms' series with per-point n-of-N-tooltip notes; legend caption .cyc-band-note. Per-term event lines (CYC_EVENTS) follow ONE singled-out term via eventCycle = solo || single-forward-past || sitting-term-fallthrough (5995b8f). Card captions are measure-lead fan descriptions shared across FIVE charts (net/oppnet/ppmm/primary/tpp since a670008): approval cards lead with the literal "Approval minus disapproval" (0929fac — the rename is CAPTION-LEAD-scoped: glossary bodies, the Hanson note and the Latest-table metric link keep "approve minus disapprove" as formula words), the others lead with their own CYC_METRICS sub (ppmm "PM's lead on the preferred-PM question", tpp "Governing-party 2PP" — hyphenated); "<lead>, with a historical fan chart for all|selected previous terms since <firstYear>" where firstYear = min VISIBLE past-term year (front-trims re-anchor the year, only interior gaps flip 'all'→'selected'), outcome-filter clause " that ended in a returned/ousted government" appended last (no comma, 08f2cca); the 'net approval' glossary tap-to-define lives in the CARD TITLE h2 via .hi-term (8b36759, keep the phrase 'net approval' intact in CYC_METRICS titles or the link silently dies); `hidden` is a Set — .size/.has(), never .length; card subs live ONLY in CYC_METRICS (index.html string hits are the compiled bundle, auspol-polling.html is a different legacy page).
source: auto-skill
extracted_at: '2026-09-04T06:57:40.352Z'
---

# Past cycles machinery (auspol-tracker)

Adding a historical term to **Past cycles** requires no renderer changes — the
whole view iterates `CYCLE_DEFS` (chips, lines, end-labels, download CSV,
accuracy panel). The minimal diff is data + copy strings only. Worked example:
shipping the 2007 Rudd term (commit `8c8e15c`, 2026-09-02).

## Data flow

1. `CYC_META` (gen-data.mjs ~:1182) — one row per term:
   `{ year, gov, opp, pm, lead, oppLead, eDate, ePrim, eTpp, src, appr, pmSpl? }`
2. `CYCLE_DEFS` (gen-data.mjs ~:1305) — expands each row into monthly series
   (months 0..N from `eDate`, N ≈ months to next election). Emitted into the
   `9f09dca2` data asset as a single-line JSON array.
3. `cycle-source` export (gen-data.mjs ~:1750-1772) —
   `cycleSource[c.year] = { polls: cyclePolls[c.src], approval: cycleApproval[c.appr] }`;
   build.mjs:526-534 content-hashes this to root `assets/cycle-source.<hash>.json`,
   **deletes the old hash** and writes a fresh one. After any CYC_META or
   polls.json change: stage BOTH the new hash file AND the old hash's deletion
   (plus `.build/newtracker/assets/cycle-source.json`, its dev-side copy).
   The hash ALSO rolls with no data edit of your own when a sibling
   session's uncommitted gen-data.mjs/CYC_META WIP sits in the tree during
   your unrelated rebuild (observed 2026-09-03, commit `ed55a03` — a
   copy-chart.js-only change rolled 21e54581→be7ba726); the renamed
   delete+add must still ride your index.html commit or the live page 404s
   the fetch. Check `git status --short -- assets/` after every rebuild.
   The INVERSE also confuses: adding a row to an EXISTING cycle's
   cyclePolls, when the data edit landed before your rebuild, leaves
   index.html AND assets/ untouched — the content-addressed sidecar
   regenerates byte-identically and cycle rows never travel inside
   index.html anyway. No diff does NOT mean the row didn't materialise;
   grep the sidecar for the date (observed 2026-09-03 materialising the
   Galaxy 2004-10-04 wave, see auspol-galaxy-archive).

## Keying quirks (the mistakes are all here)

- **`src:` = term-END election year** — it indexes `cyclePolls` (polls BETWEEN
  this term's election and the next) AND becomes the accuracy row's label.
  The 2007-term row carries `src: 2010`, not 2007.
- **`appr:` = term-START year** — indexes `cycleApproval` (keyed by opening
  election). The 2007 term carries `appr: 2007`.
- **`year:` = term-start election year**; `ELECTIONS["e"+c.year]` MUST exist in
  polls.json's `elections` table — `eOpp = ELECTIONS["e"+c.year]` anchors the
  opposition primary line at month 0. Adding a cycle whose opening election is
  missing there silently breaks the line; add e.g. `e2007` first.
- 2007-row example: `{ year: 2007, gov: "alp", opp: "lnp", pm: "Rudd → Gillard",
  lead: "Rudd", oppLead: "Nelson → Turnbull → Abbott", eDate: "2007-11-24",
  ePrim: 43.4, eTpp: 52.7, src: 2010, appr: 2007, pmSpl: { iso: "2010-06-24",
  names: ["Rudd","Gillard"] } }`.

## Splicing and eras

- **Both `pmSpl` and `oppSpl` now generalise to N boundaries** (three-leader
  splits shipped 2026-09-03, in commit 5b48543's lineage): pass either a
  single `{ iso: "2010-06-24", names: ["Rudd","Gillard"] }` or
  `{ isos: [d1, d2], names: [A, B, C] }`. eraSeries() (gen-data.mjs:1222)
  reads `const isos = spl.isos || [spl.iso]` (back-compat) and splits the
  term into `names.length` runs. Emitted as `netEras` (PM) / `oppEras`
  (OPP) with per-era `months/vals/obs` grids.
- Spliced rows as of HEAD 96403eb: pmSpl on 1990, 2007, 2010, 2013, 2016;
  oppSpl on 1987, 1993 (3 names), 2001 (3), 2004 (3), 2007 (3 —
  Nelson/Turnbull/Abbott), 2019, 2025. Boundary isos are the actual
  spill/resignation/handover dates; names chronological; the first era's
  `from` is null.
- An UNspliced multi-leader term still pools: the line averages whoever
  holds the office — list all names in `oppLead` ("Nelson → Turnbull →
  Abbott") and no eraSeries machinery engages.
- **Hover/panel series-label fallback is one-sided** (d1a1d215 ~:1028):
  `const leadName = s.name || (isOpp ? c.oppLead : c.lead);` — an UNsplit PM
  line labels runs with the term-opener only (`c.lead`), an UNsplit OPP line
  gets the full `c.oppLead` chain. With eras present the fallback never
  fires, so post-splice BOTH approval charts show per-leader runs on hover
  (2007 OPP → Nelson / Turnbull / Abbott; PM → Rudd / Gillard). A user
  still seeing "PM one name vs OPP chain" after a splice deploy is reading
  the pre-split payload — stale page, see auspol-live-site-verify
  (quote-matching section). Genuine pooled-PM parity fix: use `c.pm`.
- **Emitted JSON key names are lowercased/renamed**: `oppnet`, `oppr`,
  `netEras`, `oppEras` — NOT `oppNet`/`eraSeries`. A verification one-liner
  reading `c.oppNet`/`c.eraSeries` crashes; check `Object.keys(c)` first.
- **Renderers never see CYCLE_DEFS directly**: the 9f09dca2 asset maps the
  raw entries into display objects (`{year, gov, ..., color, span, base,
  end, points, raw}` at asset ~:105-125). Every series — `months`, `net`,
  `oppr`, `han`, `obs`, and `netEras`/`oppEras` — lives under `c.raw`. A
  chip/legend/tooltip wanting era names must reach
  `c.raw.netEras.map(e => e.name)`; the top-level `c.netEras` does NOT
  exist on the display object (that shape is only in the raw gen-data
  emission). Copying a CYC_META-shaped assumption into d1a1d215 is the
  trap; `c.lead`/`c.oppLead`/`c.pm`/`c.year` are the only name fields
  promoted to the top level.
- **Adding a series is a FOUR-extension whitelist** in that same
  `const cycles = CYCLE_DEFS.map(...)` block (source: gen-data.mjs ~:1950,
  emitted verbatim into the asset): a new key must land in ALL of
  `base` (first slot, `c.<k>[0]`), `end` (sparse series like han/onp/ppmm
  reverse-find the last READING: `[...c.<k>].reverse().find(v => v != null)
  ?? null`), `points` (`c.months.map((m, i) => ({x: m, y: c.<k>[i]}))`) and
  `raw` (plus conditional spreads for eras). Miss one and the renderer
  reads `undefined` with no build error.
- **The trap inverts for build verification**: the CYCLE_DEFS array parsed
  from the built asset IS the raw emission — series sit TOP-LEVEL there
  (`c.ppmm`, `c.ppmEras`); `c.raw`/`c.base`/`c.end` exist ONLY on the
  runtime display objects. A probe asserting display-object keys against
  the parsed raw array reports every key ABSENT (false alarm, bit on ppmm
  2026-09-03); assert series on the raw entries and separately confirm the
  map block forwards the key (grep the asset for `ppmm: c.ppmm`).
- Approval `metricOf(firm, "alb")` without a date is safe pre-2010 (no
  favourability-metric rows that far back).

## Accuracy panel

- Rows derive from `CYC_META.filter(c => !c.current && c.src)` (gen-data.mjs
  ~:1256) — a new cycle auto-adds a row, **labelled `year: c.src` = "the
  election being CALLED … not the election that started the term"**. A new
  2007-row appears as `year: 2010` in the output. Searching the emitted
  `accuracy.cycles` for `year: 2007` and concluding "it's missing" is the trap;
  look for `year: 2010` instead.
- Rule: each house's LAST poll with a 2PP in `ACC_WINDOW_DAYS` (14) before the
  result, one per house, `ACC_CANON` maps short names ("Morgan"→"Roy Morgan").
  For the 2010 election: Essential 2010-08-15 (51) vs e2010 tpp_alp 50.1 →
  `err +0.9`; since `7fef6c1` the row is multi-dot (Newspoll 2010-08-19 and
  Morgan's final in-window wave join it — assimilated from the historical
  CSVs, see "CSV assimilation" below).

### Renderer: recency split (commit 0ac1c14, 2026-09-03)

User asked for the panel in two labelled blocks. Shipped entirely renderer-
side (AccuracyPanel in d1a1d215 + two CSS lines in template.html); gen-data's
`accuracy.cycles` is untouched and still emits in CYC_META order (ascending).

- The raw `A.cycles.map(...)` was replaced by
  `const byRecency = [...A.cycles].sort((a, b) => b.year - a.year)` →
  `recent = slice(0, 5)` / `earlier = slice(5)`, mapped as a
  `[label, list][]` array through ONE keyed-`<React.Fragment>` group
  renderer (the asset's established pattern, ~:3307), inserting
  `<div className="acc-group-h">` subheads ("Last five elections",
  "More elections") between groups. **Split is positional, never
  year-keyed** — a new cycle slides in (and pushes the 6th-newest down
  to "More elections") with zero edits here.
- `.acc-rows` is a flex column (`display: flex; flex-direction: column`),
  NOT a grid — subhead divs stretch full width with no `grid-column`
  fixup; each `.acc-row` carries its own inner grid.
- The hover tip's `flip: ri === 0` (first-row-only, "readout would
  otherwise leave the card") kept a GLOBAL index across groups via
  `const ri = (gi ? recent.length : 0) + rj;` — group 2's first row does
  NOT flip; an upward tip overlapping the "More elections" subhead was
  accepted over the alternatives.
- Subhead CSS sits beside `.acc-firms-h` in template.html (same 11px/700/
  `--ink-3` look): `.acc-group-h { margin: 3px 0 6px }` +
  `.acc-group-h.acc-group-more { margin-top: 18px }`.
- **Probe gotcha**: AccuracyPanel renders ONLY in the Past-cycles view —
  on the default page a DOM probe finds 8 `.card`s and NO `.acc-card`.
  Click the "Past cycles" tab (`[...document.querySelectorAll("button,a")]
  .find(b => /past cycles/i.test(b.textContent)).click()`) before
  waiting on `.acc-card .acc-row`.
- Verified by DOM probe (not pixel diff): subhead text/classes, row order
  2025,2022,2019,2016,2013 | 2010,2007,2004,2001,1998,1996,1993, zero
  page errors.

## Hard-coded copy that must move with the count

Adding/removing a cycle means re-counting these strings (all edited together
for the 2007 add):

- `.build/newtracker/assets/d1a1d215-*.js` ~:1420 — accuracy comment
  `"Eight past elections are the one place a poll can be checked"`
- same file — PastCyclesView view-lede: the "Every federal term since
  1987" sentence; since 7240d7d it continues straight into the band
  description ("The past terms stand together as a band…") — grep the
  lede, never trust line numbers
- `template.html` ~:2081 — CSS comment `"so eight elections' worth of error"`
- `gen-data.mjs` ~:1233 — comment `"visible: eight past elections"`

(History: 5→6→7→8 as the 2007, 2004, 2001 terms landed; grep the current
count word rather than trusting these line numbers. Two same-file edits in
d1a1d215 — or anywhere — must be in separate turns; re-affirmed 2026-09-03
on gen-data.mjs. See the same-file-edit-sequencing skill.)

## Verification recipe (post-rebuild)

1. `node .build/newtracker/validate.mjs` clean.
2. Cycle-source: `JSON.parse` root `assets/cycle-source.<hash>.json`, assert
   keys include the new year, poll/approval counts and date spans look right
   (2007: 131 polls + 114 approval, 2007-12-09 → 2010-08-15/19).
3. CYCLE_DEFS: parse from the `9f09dca2` asset per the line-split recipe in
   the build-pipeline skill (the array is one line; `JSON.parse(line.slice(
   indexOf("["), lastIndexOf(";")))`) — assert `arr[0].year`, months.length ≈
   term span (34 for 2007→2010), era splice has real rows on both sides, and
   onp/`oth` grids null where the party didn't exist (2007-10: onp all-null).
4. Accuracy: find the row by `year === <next election>` (see above), check
   `houses[]` firm/date/err.
5. In built `index.html`, grep the copy strings; curly typography is unicode-
   escaped (`\u2019`) in JSX strings there — see auspol-built-html-verification.
5b. **Mid-build race canary**: if the build emits a DIFFERENT
   `cycle-source.<hash>.json` than the one staged at HEAD with no data/CYC_META
   edit of your own, check `git log` FIRST — a sibling session may have shipped
   a data change. If your rebuild regenerates exactly their hash (asset
   content-addressed), `git status` shows it untouched: no collision, commit
   only your own source/asset deltas. Happened 2026-09-02 with 7fef6c1 during
   the 90db0a4 chip work (301b8060 → e1a3074d, sibling's assimilation hash
   reproduced identically by the local rebuild).
6. Committed file list for a cycle add: `data/polls.json`, `gen-data.mjs`,
   `template.html` (if copy touched), `9f09dca2` asset, `cycle-source.json`
   dev copy, d1a1d215 asset (if copy touched), `index.html`, NEW
   `assets/cycle-source.<hash>.json` + deletion of the old hash. Untracked
   probes from other sessions are NOT yours.

## Renderer: person-toggle gates (Hanson '25 / One Nation)

Everything above is CYC_META-driven; the CycleChart's PERSON-toggles are the
exception — hand-wired in the d1a1d215 asset (hash churns; grep `hanCtl` or
`cyc-han`, never the hash):

- **Gate** `const hanCtl = M.han && hanAvail && hanCycle;` (~:996). Since
  commit `a062495` (2026-09-02) it has NO `!hidden.has(hanCycle.year)` clause —
  the user asked that the Hanson '25 tickbox appear even when the
  2025/Albanese/Now chip is off. Rationale (encoded in the code comment):
  Hanson is a person-toggle, not a property of the 2025 chip; no past term
  rated her, so she is the one line allowed to stand alone with every cycle
  chip off.
- **One gate, two effects**: BOTH the tickbox JSX (`<label className="pg-check
  cyc-han"…>Hanson '25</label>`, ~:1197-1207) AND the line-draw condition hang
  off `hanCtl` — editing the gate moves both; there is no tickbox-only switch.
- **Opt-in state**: `showHan` is `useState(false)` (~:1711), lifted to the view
  and passed in with `setHan` alongside `showOnp`/`setShowOnp` — the ONP toggle
  follows the same pattern. Default-off means a gate change never produces
  surprise lines.
- **Rendering facts**: `HAN_COLOR` reuses `PARTIES.onp.color`; the y-domain
  includes Hanson unconditionally (:579 comment "ticking a box should reveal a
  line, not rescale the axis" — do NOT re-add domain gating); her series is
  approval-basis only (`metricBy.hanson !== "fav"`); the footnote line renders
  only under `showHan`.
- Verify in built index.html: `hidden.has(hanCycle` → 0 hits, `cyc-han` still
  present (babel keeps the class string).

## Renderer: chip labels name split terms (commit 90db0a4)

The legend chip renders `{c.year}` + a PM name. Since 90db0a4 the name is
derived per-cycle inside CycleLegend's `cycles.map` (d1a1d215 ~:1278):

```js
const pmNames = c.raw.netEras && c.raw.netEras.length > 1
  ? c.raw.netEras.map((e) => e.name).join("–")
  : c.lead;
```

Split-PM terms render "2007 Rudd–Gillard", "2010 Gillard–Rudd",
"2013 Abbott–Turnbull", "2016 Turnbull–Morrison"; single-PM terms keep
`c.lead`. Note the en dash (`–`), not a hyphen, and it MUST come from
`c.raw.netEras` (see the display-object transform note in "Splicing and
eras") — `eraSeries` supplies officeholders in order, so the join is
chronological for free and a future mid-term PM change automatically
renames its chip with zero copy edits. The other places `{c.lead}` is
read — chip tooltips' `leadName`, the solo label `c.year + " · " +
leadName`, dot-cloud `nameAt()` — are per-READING eras or first-lead
labels and were deliberately NOT changed with this commit; only the
legend chip shows the full pair.

## CSV assimilation (`.build/assimilate-2007-cycle-csv.mjs`, commit 7fef6c1)

Backfills Newspoll + Roy Morgan historical-CSV waves into `cyclePolls.2010`
(the one part of the 2007-cycle add `8c8e15c` deferred). Voting-intention
only — Newspoll's better-PM rows were already in `cycleApproval.2007`, and
Morgan has no archived satisfaction series for the era. Conventions, all
following the essential-vi-assimilator house style:

- **Dry-run by default; `--apply` writes** data/polls.json; re-runs are
  no-ops (dedupe on date+firm against the existing cycle).
- Join keys: Newspoll primary↔2PP on the fieldwork-END date; Morgan
  primary↔2PP on `date|mode`.
- Firm names in cycle rows: `"Newspoll"`, `"Morgan"` (short forms —
  `ACC_CANON` handles the accuracy panel, not the rows).
- Row shape matches the curated cycle rows exactly:
  `{"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}`.
  Newspoll `onp: null` (democrats/one_nation blank in-era); Morgan `< 0.5`
  strings → `onp: null` + zero contribution to `oth` (sum of the six minor
  columns), NEVER coerced to a number.
- `election=1` Morgan rows are skipped (results, not polls); the cycle's
  single `"Election"` marker comes from `D.elections.e2010` instead
  (2010-08-21, 50.1/49.9).
- **ONE Morgan row is deliberately dropped**: 2010-08-21, mode blank — it
  collides date+firm with the labelled phone wave and its provenance can't
  be named apart. The date+firm uniqueness gate in validate.mjs enforces
  this; do not "fix" the drop by re-adding it.
- 2PP comes from the CSV's own alp/coalition pair (canonical, sums to 100),
  NOT polls.json's curated 2013-cycle Morgan rows, which diverge — see the
  curated-vs-CSV quirk in auspol-historical-csv-qa.
- Guards abort the whole write on: any null/NaN share, primary sum outside
  the per-source band (see below), 2PP pair more than 0.6 off 100.
- To backfill ANOTHER era: copy the most recent sibling script, set
  `TERM`/`CYCLE_KEY`/`APPR_KEY`, and re-check the per-source quirks — do
  not generalise in place. Every era so far has differed.

## Per-era quirk differences (the drill generalises, the quirks don't)

2001 drill: `.build/assimilate-2001-cycle-csv.mjs`, commit `dfb7ca6`
(2026-09-03), cloned from `assimilate-2004-cycle-csv.mjs`.
`TERM 2001-11-10..2004-10-09` → `cyclePolls.2004` + `cycleApproval.2001` +
`elections.e2001`.

- **ONP was a REAL party in the 2001 term** (4.3% at the 2001 election) and
  all three houses print it: Morgan's one_nation column is real numbers
  (1.5/2/1 dominate), ACN prints it every wave, Newspoll on 48 of 72 waves.
  When Newspoll's column goes blank (2003 on), printed "others" silently
  absorbs ONP — verified: blank-onp rows still sum to exactly 100 — so
  those rows carry `onp: null` with `oth` passing through as printed. Net:
  this era's `oth` EXCLUDES one_nation — the INVERSE of the 2007 drill
  (ONP spent, everything folded into `oth`). elections.e2001 keeps its
  true 4.3 ONP; the era's election marker comes from e2004 as usual.
- **Guard tolerance is PER-SOURCE, per-era.** In-era Morgan cells are
  0.5-grain across up to nine printed party columns and rows genuinely sum
  98.5–105 (worst 2004-10-08 = 105 as printed; undecided blank and
  lib+nat=coalition verified — the source's own rounding, NOT a parse
  bug). The first dry-run aborted on ~75 Morgan guard failures until
  Morgan joined ACNielsen on the loose band (≤105.5). Newspoll's integer
  cells sum to exactly 100 — it stays strict ≤100.5. When guards fire
  en masse, probe WHY (mirror the row back to the source CSV) rather than
  reflexively loosening — the loosening is only legitimate when the
  source itself prints high.
- **Morgan mode-blank join is safe** this era: in-window dates are unique
  across labelled and blank rows (check with `uniq -d`), so `date|mode`
  matches the 2PP CSV rows.
- **Newspoll leader columns shift per era** — "eraPick" (first non-null
  over the era's opposition columns): 2001 term =
  `kim_beazley, simon_crean, mark_latham`; PM column is `john_howard` the
  whole term. ACN rows carry their own leadership ratings inline (28-col
  acnielsen-polls.csv; header-guard `acn[0][12] === "family_first"`).
- **ACN's 2002 drought** is real (ACN's own note): in-window waves run
  2003-01-14 → 2004-10-07 only. Gaps in dry-run spans are expected.
- **Dropped waves are expected output**: 23 Newspoll waves pre-2002-11
  fell out with "no matching 2PP row" (49 of 72 in-window kept) — the 2PP
  CSV's own coverage limit, not a bug.
- Result: `cyclePolls.2004` = 145 rows (Newspoll 49, Morgan 78, ACNielsen
  17, Election 1; span 2002-01-13 → 2004-10-09), `cycleApproval.2001` =
  88 rows (Newspoll 71, ACNielsen 17; 2001-12-16 → 2004-10-07), 22
  null-onp rows of 145, elections.e2001 (43.0/37.8/5.0/4.3/9.9, 2PP
  51–49). The same session re-affirmed same-file-edit-sequencing on
  gen-data.mjs: the second of two edits in one turn was silently dropped —
  grep after every same-file edit pair, re-apply standalone.

## Per-era quirk differences — 1998 drill

`.build/assimilate-1998-cycle-csv.mjs`, commit `6bb3c7b` (2026-09-03).
`TERM 1998-10-03..2001-11-10` → `cyclePolls.2001` + `cycleApproval.1998` +
`elections.e1998`.

- **Newspoll's 2PP table is essentially empty between 1996 and the 2001
  campaign** — only six in-window waves (2001-10-07 → 2001-11-08) print a
  pair, so the primary↔2PP join keeps just those six of 79. This pattern
  now defines the drill: **Newspoll VI coverage in the 1996-era archive is
  campaign-print-only**, expect most primary rows to drop "no matching 2PP
  row".
- **Morgan tolerance raised 105.5 → 106.5**: 1999-07-04 genuinely prints
  43+47+4.5+3.5+6.5+2 = 106.5 (0.5-grain cells, verified against source).
  Morgan's guard history across drills: 100.5 → 105.5 (2001) → 106.5
  (1998).
- **e1998 is the 2PP-loser election**: Labor won 51.0–49.0 but lost seats —
  `elections.e1998` = lnp 39.2, alp 40.1, grn 1.7, onp 8.4 (ONP peak),
  oth 10.6, tpp_lnp 49.0 / tpp_alp 51.0. tpp_alp > tpp_lnp IS correct.
- ONP printed as real numbers in all three houses all term — `oth` EXCLUDES
  one_nation throughout (as in the 2001 drill).

## Per-era quirk differences — 1996 drill

`.build/assimilate-1996-cycle-csv.mjs`, commit `152ed1b` (2026-09-03).
`TERM 1996-03-02..1998-10-03` → `cyclePolls.1998` + `cycleApproval.1996` +
`elections.e1996`.

- **ONP did not exist for the first ~13 months** (Hanson won Oxley as a
  disendorsed independent; party formed April 1997). All three houses print
  blank one_nation until then (NP first prints 1997-04-06; Morgan to
  1997-04-10), and blank rows still sum exactly 100 — the party simply
  isn't in the universe, nothing folded. Those rows carry `onp: null` (42
  of 114). Post-formation, real onp everywhere.
- **Newspoll 2PP again campaign-only**: five waves (1998-09-06 →
  1998-10-01) kept of 69 in-window primary rows.
- **NEW GUARD: 2PP tolerance must be per-source too.** Morgan's 0.5-grain
  2PP cells print three genuine 101-sum rows this era (45.5+55.5,
  54.5+46.5) — verified against the CSV, print rounding not parse failure.
  The guard is now `> (r.firm === "Morgan" ? 1.0 : 0.6)`; a flat 0.6
  aborts the dry-run on three dates.
- **ACN waves that asked NO leadership questions exist** (four: 1997-04-27,
  1997-05-04, 1997-10-18, 1998-04-19 — pure-blank ratings blocks). The
  script must SKIP those from cycleApproval (push VI, log drop) rather
  than emit an all-null row; the "pmNet OR pmPpm non-null" guard then
  catches anything partial.
- **e1996 = AEC official** (46.9/38.8/1.7, onp 0 — the party didn't exist —
  oth 12.6 folds Democrats' 6.8; 2PP 53.6–46.4). NOT Morgan's archive
  convention, which puts Hanson's independent 0.3 in its one_nation cell
  and prints coalition 47.3.
- Morgan was mild this era (sums ≤104.5): loose primary cap back to 105.
- Result: cyclePolls.1998 = 114 rows (Morgan 74, ACNielsen 34, Newspoll 5,
  Election 1), cycleApproval.1996 = 97 (Newspoll 67, ACNielsen 30).

## Per-era quirk differences — 1993 drill

`.build/assimilate-1993-cycle-csv.mjs`, commit `5e48136` (2026-09-03).
`TERM 1993-03-13..1996-03-02` → `cyclePolls.1996` + `cycleApproval.1993` +
`elections.e1993`. This is the FLOOR of the archives — the 1996-drill
prediction ("will hit source-coverage limits") came true on both
non-Newspoll sources:

- **Morgan and ACNielsen are ABSENT — omit their blocks entirely, don't
  return zero candidates.** Morgan's poll-wave table has NO printed waves
  in the window (first real wave 1996-03-23, post-election; the 1993-03-13
  and 1996-03-02 rows are election=1 markers — useful as the e1993
  cross-check only). ACNielsen's CSV OPENS on the 1996-03-02 election row
  (first real wave 1996-05-05). Newspoll is the only house on file.
- **Newspoll 2PP campaign-only, tightened to the extreme**: six in-window
  rows (1996-01-21 → 1996-02-29), so 71 of 77 primary waves drop "no
  matching 2PP row". The kept campaign window shrinks as drills go
  backwards (six waves here, five in the 1996 drill, six in 1998).
- **NEW GUARD SHAPE: blank GREENS are legitimate.** 1996-01-21 prints
  `1996-01-21,50,40,,8,2,` — sub-threshold greens, blank cell, row still
  sums exactly 100. grn joins onp in the nullable set: OUT of the
  null-check list, `(r.grn ?? 0)` in the sum. First era where a blank
  primary cell isn't onp. The dry-run otherwise aborts "null/NaN share".
- **First THREE-leader term backfilled**: Hewson (spilled 1994-05-23) →
  Downer (resigned 1995-01-30) → Howard. eraPick is a chronological
  three-name list (`john_hewson, alexander_downer, john_howard`); the
  sparse sat/ppm columns partition the window exactly (sat 30+18+29 =
  77/77; ppm 30+14+30 = 74/74 — Keating the PM column throughout).
  CYC_META carries `oppSpl: { isos: ["1994-05-23","1995-01-30"],
  names: ["Hewson","Downer","Howard"] }` — the spill/resignation DATES.
- **e1993 = AEC official, cross-checked against Morgan's election=1
  rows**: lnp 44.3 alp 44.9 grn 1.9 onp 0 (true zero — party didn't
  exist) oth 8.9 (DEM 3.8 + others 5.1), tpp 51.4–48.6 — Labor won the
  2PP while LOSING the primary ("sweetest victory").
- Newspoll-only era keeps the STRICT guards (sum 85–100.5, 2PP ±0.6) —
  no loose band with Morgan/ACN absent. Result: cyclePolls.1996 = 7 rows
  (Newspoll 6 + Election 1, 1996-01-21 → 1996-03-02, 6 null-onp of 7
  fresh), cycleApproval.1993 = 77 rows (1993-03-21 → 1996-02-29,
  3 null-ppm).
- Sequencing radar: a malformed edit anchor on the script DUPLICATED a
  comment block (same-file-edit-sequencing failure mode — grep after
  every same-file edit pair, re-apply standalone).

## PPM (preferred-PM) chart — shipped 2026-09-03

Fourth Past-cycles measure, key `ppmm`, scoped in commit a0b910f's lineage
and built the same day. ONE line per term = PPM margin (pmPpm − oppPpm);
zero reference labelled "even"; pairing-era splices on the UNION of
pmSpl+oppSpl boundaries with "Hawke v Peacock"-style names; leading nulls
stay null (1990 opens mid-term; 1987 is a lone-month stub); the card sits
after the two approval charts.

- **gen-data**: `ppmErasFor`/`ppmPairName`/`splIsos`/`eraNameAt` helpers sit
  after eraSeries (~:1236); CYCLE_DEFS emits `ppmm: align(ppmm)`,
  `obs.ppmm`, plus CONDITIONAL `ppmEras` (omitted when the union splice
  leaves <2 non-empty eras — e.g. 2019's election-week Shorten→Albanese
  boundary has no ppm points on the Shorten side) and `ppmPair` (term-open
  pairing). The 2019 row carries `oppSpl: { iso: "2019-05-27",
  names: ["Shorten", "Albanese"] }` purely so the ppm pairing can name
  itself — approval eras collapse to one and nothing redraws. Whitelist:
  `base.ppmm`/`end.ppmm` (reverse-find last reading, like han/onp),
  `points.ppmm`, `raw.ppmm` + conditional spreads.
- **Renderer** (d1a1d215): def in CYC_METRICS after oppnet with
  `refAbs: 0, refAbsLabel: "even"` and NEW `chgRefLabel: "First reading"`
  — honoured in the refLabel as `(M.chgRefLabel || "Election result")`
  because a margin series has no election-day anchor. The era lookup got a
  third clause at BOTH sites (`|| (M.key === "ppmm" && c.raw.ppmEras)`;
  line runs ~:1040, dot-cloud ~:1110) as the scope predicted, and BOTH
  leadName fallbacks are pairing-aware: `s.name || (M.key === "ppmm" ?
  c.raw.ppmPair : (isOpp ? c.oppLead : c.lead))`. Insight copy treats ppmm
  like net/oppnet (subjParty null); 010109f then narrowed the subject to
  the sitting PM ALONE with peer noun "net preference" (originally
  "PM v OppLead" + "pairing" — read as about the contest, not the officeholder). (The approval-only "Approve minus disapprove" pill
  this once referred to is gone — a670008 moved the measure naming INTO
  the caption lead itself; see the cardSub section below.)
- **Dot-cloud sources**: current term from `individualPolls` —
  `p.ppmSets[0]` (the MAIN published pairing; the Albanese-v-Hanson H2 is
  appended last so sets[0] is safe) with the opponent found as the dynamic
  key among alb/unc/hanson; past terms from `D.cycleSource` approval rows
  (`pmPpm − oppPpm`, NO `metric === "fav"` gate — Freshwater reports
  approval as favourability but its ppm readings stand independently).
- **2022-term backfill**: the ppm hole (pmPpm/oppPpm keys absent, not
  null) was mined from Wikipedia's 2025-election opinion-polling page —
  `.build/extract-2022-ppm-wiki.mjs` (MediaWiki wikitext sectional fetch;
  Resolve date-alias table, Δ+1d publication-Sunday convention) →
  `data/wiki-2025-election-ppm.csv` (128 rows) →
  `.build/assimilate-2022-ppm-wiki.mjs` (dry-run default, `--apply` writes,
  re-run is a no-op) into `cycleApproval.2022` (169 rows incl.
  leadership-only). End-to-end verified per-term (non-null/grid): 1987
  1/33, 1990 21/37, 1993 37/37, 1996 31/32, 1998 37/37, 2001 35/36, 2004
  36/37, 2007 32/34, 2010 36/37, 2013 34/35, 2016 33/35, 2019 35/37,
  2022 34/36, 2025 14/16 (eras "Albanese v Ley | Albanese v Taylor").
- Newspoll better-PM per-term import is FULL (every in-term CSV row lands
  in cycleApproval — spot-verified 1990: 39=39, 2019: 45=45). Per-term
  sparsity is the SOURCE's own: the question simply wasn't asked in those
  windows; don't go hunting for missing import code.

## The historical ribbon (band) — commit 7240d7d (2026-09-03)

Per-term lines were the default until this commit: with things-as-were default
boards (thirteen past terms) the charts read as spaghetti ("weather, not
data"). Now, with ≥3 past terms on the board, per-term lines collapse into a
min–max band with a darker interquartile half and a dotted mean line. All
pieces shipped in 7240d7d, all in d1a1d215 + template.html:

- **ONE gate, two consumers** — module-level
  `cycBanded = (cycles, hidden) => cycles.filter((c) => !hidden.has(c.year)
  && !c.current).length >= 3`, declared just before CycleChart next to
  `pctOf`. CycleChart reads it to draw, CycleLegend to show its caption —
  if the two ever computed the gate individually they would disagree; keep
  the helper shared.
- **`drawnCycles`** (CycleChart, after `shown`):
  `banded ? shown.filter((c) => c.current || lifted.has(c.year) || hi === c.year) : shown` — only
  the sitting term plus any chip-tapped (durable `lifted`) or chip-hovered
  (`hi`) term keep their own lines.
  The line builder flatMaps `drawnCycles` (was `shown` — that one-identifier
  rename is the whole "lines step down" half of the feature). `pastShown` /
  `bandN` stay based on `shown` regardless of `hi`: the band's membership is
  data, published as such. Scatter (`dotsOn`, solo-only) and the Hanson/ONP
  overlays are untouched.
- **`pctOf(sorted, p)`** — rank-based percentile, linear between neighbouring
  ranks (quartile edges of ~eleven terms should not pretend to be integers);
  sits beside `toMonthly`, module level.
- **Band stats** (block after the `built` flatMap, `if (banded)`): pool one
  monthly grid per ROW per term — era-split offices splat their
  `netEras`/`oppEras`/`ppmEras` (each era already carries its own months/
  vals), everything else its single `c.raw[M.key]` row, each row through
  `toMonthly(m, v, c.span)` and chg-adjusted by `cycBase(c, M.key)` when
  `chg`. Eras must never pool as one series back into one term: a handover
  month bucket can hold anchors from two eras (spill mid-bucket), and one
  row per term is the ONLY thing that keeps the average honest there. Per
  month m on CYC_SPINE: collect non-nulls → sort → min/max (outer),
  pctOf(0.25)/pctOf(0.75) (inner), mean. Months with zero contributors are
  SKIPPED (band visibly ends — thinning is drawn, never tapered).
- **The fills use TrendChart's existing `areas` prop** (08b413e7 ~
  :102-106 contract): `{id, color, opacity?, smooth?, edge?, clipX?,
  className?, points:[{x, y0, y1}]}`, rendered BEFORE gridlines and lines,
  i.e. under everything. Ours: `cyc-band-lo` (min–max) + `cyc-band-hi`
  (IQR), `color: "var(--cyc-fill)"` (was `var(--ink)` — recoloured to a
  Labor–Coalition purple in commit ab4de49, 2026-09-03; see "Band colour"
  below), `edge: false` (no dashed outline),
  `className: "cyc-band lo"` / `"cyc-band hi"`. Theming rides on the
  documented mechanism that a CLASS RULE beats the opacity presentation
  ATTRIBUTE (the house-lean `bands` precedent): template.html rules
  `.cyc-band.lo { opacity: .09 }` / `.hi { .17 }`, dark variants `.16`/`.30`.
- **The mean is a regular series pushed into `built`** after the flatMap
  and before the weight sort: id `cyc-band-mean`, label `"Mean of past
  terms"`, `color: "var(--ink-2)"`, width 1.9, weight 0.5 (sorts beneath
  every cycle line, draws under them), opacity 0.85, `dash: "2 3.4"`
  (TrendChart's per-series `dash` STRING, distinct from `dashed:true`→
  "6 6"), `smooth: false` (pointwise means are not a curve), `endCap:
  false`. NO noTip mechanism is needed: TrendChart's tooltip dedupes rows
  BY LABEL (the first series answering for a label answers for all), so a
  unique label gives the mean exactly one readout row.
- **Per-point `note`** — TrendChart renders a point's `note` beside its own
  tooltip row. Each mean point carries `"n of N terms"` (n = contributing
  terms that month, N = `bandN` = `pastShown.length`): the readout announces
  band thinning in place of hiding it. Chosen OVER gating the band below 3
  contributors — gating would falsify the sentence the chart quote-draws.
- **Call site**: `areas={bandAreas || undefined}` on CycleChart's
  TrendChart (~:1360) — bandAreas is `null` when unbanded.
- **Legend caption** (`{banded && …}` inside CycleLegend, after the chip
  row): `div.cyc-band-note` `aria-hidden` with an inline 30×12 SVG key
  mirroring the chart exactly (outer rect fill var(--cyc-fill) opacity
  .07, inner .13, dashed var(--ink-2) line 1.9 "2 3.4" — the dashed mean
  line stays ink-2 both in the key and on the chart) and copy "Past
  terms: mean of the set, middle half and middle 80%". CSS lives with
  the `.cyc-chip` rules in template.html; `.cyc-band-note` MUST keep
  `width: 100%` — the legend row is flex, without it the caption rides
  inline after the last chip instead of wrapping.
- **Band colour — `--cyc-fill` CSS variable** (template.html :root, right
  after the party colours): `color-mix(in oklch, var(--alp) 50%,
  var(--lnp))` — exactly halfway Labor red → Coalition blue in oklch.
  ONE definition serves both themes: var() resolves `--alp`/`--lnp` at
  the USE SITE, so dark mode mixes the lifted party colours with no dark
  override needed. Consumers are exactly two places in d1a1d215: the two
  cyc-band area fills and the two key rects (all four `fill` attributes,
  not the JS `color:` of the mean series — that stays `var(--ink-2)`).
  Hue-tuning is a one-line edit to the mix ratio; a revert to grey is
  swapping `var(--cyc-fill)` back to `var(--ink)` in four spots.
- **Lede + hint copy** (PastCyclesView): the lede's second sentence is now
  "The past terms stand together as a band – outer edge their full spread,
  darker half the middle, dotted line their mean – drawn over the months
  each term was actually in office." and BOTH CANT_HOVER variants end "to
  lift its line out of the band" (was "to hide or restore its line" /
  "to bring its line forward").
- **Insight sentence deliberately untouched** — the insight's per-month
  `avg` pools `c.raw[M.key]` for peers (one series per term) while the
  ribbon pools era rows where spliced; both sit on the same
  toMonthly+cycBase semantics and agree except at handover buckets, where
  the ribbon is the more honest of the two. Keep them conceptually aligned:
  the ribbon exists to draw the sentence.
- **Verify built**: `grep -c "cyc-band" index.html` => 13; `"Mean of past
  terms"` => 1. Caption text is plain ASCII in the compiled bundle.

## `lifted` may NEVER hold the sitting term (bug fixed 2026-09-03)

`hidden` and `lifted` answer different questions: hidden = off the board (out of
the band, the mean and the download), lifted = drawn as its own line OVER the
band. The sitting term has no band to be lifted out of — `drawn = lift ||
c.current` puts it on the chart unconditionally — so it can never legally be in
`lifted`, and two things downstream assume exactly that:

- each chart's "Drawn here" strip offers its ✕ on `lifted.has(c.year)`;
- `dim = !out && !c.current && (hi != null || lifted.size > 0)` (twice: the line
  renderer ~:1209 and the dot renderer ~:1396) dims every term that is not lifted.

Nothing stopped the sitting term's own chip putting it there — `chipClick` →
`lift(year)` had no guard — so one tap on "2025 Albanese" produced **a ✕ on six
charts that removed nothing** (pressing it un-lifted a term that was drawn either
way, so the row did not move: reported as "the ✕ doesn't work") **and dimmed the
whole board** for a lift that had not happened. It also wrote `?l=25`, so the
state was shareable.

Three guards, all in the panel component in `d1a1d215`:

1. `const currentYear = (cycles.find((c) => c.current) || {}).year;` and
   `lift()` returns early for it. This is the root fix.
2. the `lifted` `useState` initialiser deletes `currentYear` from the parsed
   `?l=` — links copied while the bug was live all carry it.
3. the strip's ✕ needs `lifted.has(c.year) && !c.current`, so it can never
   render where pressing it would change nothing.

Tapping the sitting chip is now a no-op, which is what its own aria-label has
always promised ("the sitting term, always drawn"). Removing it is still the ✕
on its legend chip (`toggle`, i.e. off the board) — a different act, and the one
the user reached for when the strip's ✕ failed.

Probe: `.matilda/verify-cycle-lift/probe.mjs` — 12 checks covering the dead ✕,
the stale `?l=`, and both paths that must keep working (a past term still lifts
and its ✕ still returns it to the band; the legend ✕ still clears the sitting
term).

## Per-term event lines (CYC_EVENTS in d1a1d215)

Board of event markers per past-term year, drawn whenever the chart
resolves to ONE forward-drawn past line: the solo board
(`shown.length === 1`) or one past term brought forward of the running
ribbon by itself (lift/hover — shipped 5ae7d35, 2026-09-04; gate
mechanics below). Overlaid with other forward lines an event belongs to
no single line, so it hides; the resting ribbon (zero forward past
lines) lifts nothing. An optional `metrics: [...]` whitelist (e.g.
Shorten→Albanese pins to `oppnet`) narrows a marker to named measures.
Keys must match CYCLE_DEFS years. Leadership-change entries as of 2026-09-03: every pmSpl/oppSpl
boundary in CYCLE_DEFS now has a matching event — 1987 (Howard→Peacock
1989-05-09, oppnet), 1990 (Hawke→Keating 1991-12-20 — swearing-in day;
the ballot was the 19th, pmSpl's iso in gen-data stays 1991-12-19), 1993
(Hewson→Downer 1994-05-23 + Downer→Howard 1995-01-30, both oppnet; both
dates ARE the existing oppSpl isos, no gen-data change needed), 2001
(Beazley→Crean 2001-11-22 + Crean→Latham 2003-12-02, both oppnet), 2004
(Latham→Beazley 2005-01-28 + Beazley→Rudd 2006-12-04, both oppnet),
2007 (Nelson→Turnbull 2008-09-16 + Turnbull→Abbott 2009-12-01, both
oppnet; Rudd→Gillard 2010-06-24, PM event left UNPINNED), plus the
pre-existing 2010 (Gillard→Rudd), 2013 (Abbott→Turnbull), 2016
(Turnbull→Morrison + Shorten→Albanese oppnet) and 2025 (Ley→Taylor).
PM-spill events are unpinned (appear on all measures); opposition-leader
events pin `metrics: ["oppnet"]` — convention from Shorten→Albanese.
Non-leadership events (budgets, crises) also exist under 2010/2013/
2016/2019/2022/2025 and are a separate, unpinned set.

### The events GATE's precise mechanics (5ae7d35, then 5995b8f, 2026-09-04)

In CycleChart (d1a1d215), right after `drawnCycles`:

```js
const solo = shown.length === 1 ? shown[0] : null;
const pastForward = drawnCycles.filter((c) => !c.current);
const eventCycle = solo
  || (pastForward.length === 1
      ? pastForward[0]
      : (pastForward.length === 0
          ? drawnCycles.find((c) => c.current) || null
          : null));
const cycleEvents = eventCycle
  ? (CYC_EVENTS[eventCycle.year] || [])
      .filter((e) => !e.metrics || e.metrics.includes(M.key))
      .map((e) => ({ ...e, x: cycEventMonth(e.date, eventCycle.eDate …) }))
  : [];
… <TrendChart … events={cycleEvents} …>
```

The rule follows the DRAWN lines, not the legend: with a ribbon running,
events display when the chart resolves to ONE singled-out term — a past
term brought forward on its own, or (since 5995b8f) the SITTING term when
nothing is forward. States:

- **Solo board** — every other chip hidden; `solo` fires as before
  (metrics-pinned entries filtered per measure key).
- **Ribbon + exactly one past term forward** (lifted chip-tap or `hi`
  hover preview) — `pastForward.length === 1` fires; the band itself is
  background, not a competing line. Before 5ae7d35 this could never
  happen: the gate was `shown.length === 1`, and with banding needing ≥3
  past terms the two states were structurally mutually exclusive
  (the user's gap report: "when only one line is brought forward (even
  if there's a ribbon) the events should display").
- **Resting ribbon** (zero forward past lines) — 5995b8f: the
  `pastForward.length === 0` clause falls through to the current term,
  so the SITTING term's events show (user report: "ah it works for all
  the series except for 2025 albanese" — the sitting term can never be
  lifted, per the no-lift guard above, so without the fallthrough its
  events never fired). Two clauses above remain structurally
  unreachable for `pastForward.length >= 2`: **two+ past terms
  forward** still yields nothing (`eventCycle` null).

`solo` is retained separately for the tooltip suffix
(`cycleEvents`-independent; the " – \<month\>" suffix on the readout row
stays solo-only by design). Live-probe recipe (also the verification that
the fix deployed): open the live page, click the Past-cycles tab, read
`document.querySelectorAll(".evt-line").length` at rest (0), click ONE
past chip's `.cyc-main` (18 markers for 2019), click a second (0 again).
The event SVG bits (`.evt-hit`/`.evt-line`/`.evt-conn`/`.evt-label`) are
rendered by TrendChart in asset 08b413e7; copy-chart's bake waits on
`.evt-label` (copy-chart.js:328).

## Card captions (cardSub) — five-chart measure-lead fan descriptions (861b428 → 8b36759 → a670008 → 08f2cca → 0929fac, 2026-09-04)

The caption below each fanned card narrates itself in TWO clauses:
`<measure-lead>, with a historical fan chart for {all|selected} previous
terms since {firstYear}` + optional
` that ended in a {returned|ousted} government` (no comma — 08f2cca).
It never names the singled-out term. Lineage: 2ad0b48/2ad…(early same-day)
built approval-only captions naming offices; e5f36a6 scrapped the
subject-following body ("scratch those subtitles") into fan-composition
text; 861b428 moved the glossary link into the caption and made the start
year track the board; 8b36759 reworded to "historical fan chart for
all/selected previous terms" and moved the glossary link into the card
TITLE; a670008 generalised to five charts and added the measure lead-ins;
08f2cca reworded the outcome tail ("…terms since {year} that ended in a
returned government" — attaches the verdict to the terms themselves, not
a comma-spliced relative clause; "an ousted government" when ousted);
0929fac renamed the approval caption lead to "Approval minus disapproval"
(noun pair, matching the other measure leads).

Current form — one `cardSub` IIFE in CycleChart right after `cycleEvents`
(d1a1d215 ~:1210, after the a670008 generalisation):

```js
const fanned = M.key === "net" || M.key === "oppnet"
  || M.key === "ppmm" || M.key === "primary" || M.key === "tpp";
if (!fanned || !banded) return M.sub;
const lead = M.key === "net" || M.key === "oppnet"
  ? "Approval minus disapproval"
  : M.sub;
const firstYear = Math.min(...pastShown.map((c) => c.year));
const gapped = cycles.some((c) => !c.current && c.year >= firstYear
  && hidden.has(c.year));
const cap = lead + ", with a historical fan chart for "
  + (gapped ? "selected" : "all") + " previous terms since " + firstYear;
// + " that ended in a returned/ousted government" when outcomeShown
// is set (08f2cca — "a returned" but "an ousted")
```

Semantics, all probed and shipped:

- **Measure lead**: the approval cards get the LITERAL "Approve minus
  disapprove" because their static subs ("Sitting prime minister" /
  "Sitting opposition leader") name an office, not the measure. The
  ppmm/primary/tpp cards lead with their own sub, which names the
  measure already — so a sub edit there CHANGES THE CAPTION LEAD TOO.
  a670008 shortened ppmm's sub to "PM's lead on the preferred-PM
  question" (from "Sitting prime minister's lead…") and hyphenated tpp's
  to "Governing-party 2PP" (matching the decline charts' governing-party
  compound) — both rewrites happened BECAUSE the sub had become
  caption-facing copy, not just a static descriptor.
- **`firstYear` = min year of VISIBLE non-current terms** (`pastShown`,
  861b428): a front-trim (deselect 1987 → 1989…) simply re-anchors the
  start year ("all previous terms since 1990") and does NOT fire
  "selected".
- **`gapped`** (8b36759): "selected" appears only when a HIDDEN past term
  sits at-or-after firstYear — i.e. a real interior hole in the span.
  Front-trims alone move the year: "all since 1990", because everything
  from 1990 on is on the board. The earlier `hidden.size > 0` test was
  wrong for exactly this reason.
- **Outcome-filter clause is appended LAST and forces "selected"**: the
  returned/ousted filter works by HIDING interior non-matching years, so
  `gapped` is true whenever the filter is active — the caption reads
  "…for selected previous terms since {year}, for terms at the end of
  which the government was returned". Only the clause order is
  load-bearing now (lead → all/selected → year → outcome clause); the
  old "evaluate outcome BEFORE hidden.size" trap is superseded.
- **`!banded` still returns `M.sub` statics** — the fan claims would lie
  on a <3-past-terms board. The empty board lands here too, so probe the
  remove-all state to confirm the STATIC sub text (the strings users
  asked to shorten live there as well).
- **Non-fanned cards (`oppr`, the opposition primary) keep their plain
  static sub always** — extending the fan set is a one-key edit to
  `fanned`, but the user explicitly scopes each card ("add … to
  'First-preference support for the governing party'", "do the same for
  the Government two-party preferred chart").

### The glossary link lives in the card TITLE (8b36759)

The tap-to-define "net approval" link is now composed into the card
title h2 at render time (d1a1d215 ~:1548): for net/oppnet,
`M.title.replace("net approval", "")` renders the office part, then a
`<button className="hi-term" title="What the approval question asks"
onClick={() => window.AP.openTerm?.("approval", M.title)}>net
approval</button>`. Other metrics render their title plain. Two hazards:

- **CYC_METRICS titles must keep the exact phrase "net approval"** —
  "Prime minister net approval" / "Opposition leader net approval". The
  replace is a silent no-op if a title reword drops the phrase: the pill
  disappears with no build error. The CYC_METRICS comment (:536) says
  this; keep it true.
- `.hi-term` (template.html :1187–1194) is `font: inherit; color:
  inherit` with only a `--line-2` underline, so it inherits h2 sizing
  fine — no CSS needed. The OLD hazard (a font-size rule BELOW .hi-term
  shrinking it) does not apply at h2, but never add a sized `.hi-term`
  rule below the base one.
- Pre-8b36759 the link sat INSIDE the caption ("…prime minister net
  approval since 1987" linked phrase), and pre-861b428 it was an
  "Approve minus disapprove" pill outside `{cardSub}` in the same
  `<p className="card-sub">`. Both are gone — a caption-string grep for
  the glossary link will find nothing; check the TITLE JSX.

### Sub copy lives ONLY in CYC_METRICS

"A card-sub string appears in N places" reports are mostly noise: grep
`index.html` for e.g. `Sitting prime minister’s lead` and you hit the
COMPILED bundle (the asset inlined), which the rebuild regenerates — never
edit it. `auspol-polling.html` is a separate LEGACY page with its own
governing-party compounds; its hits don't gate on the CYC_METRICS sub.
Curly-typography rule applies in reverse for probes: the asset keeps
curly `’` (apostrophe in "PM's lead") in SOURCE, but the built bundle
escapes it to `\u2019` — assert subs in the built DOM (probe) or with the
escaped form, never grepping the raw apostrophe in index.html.

### Probe recipe (retired probes: captions-probe2/3/4, then `.matilda/probe.mjs` in the a670008 worktree)

Local static server + puppeteer-core (createRequire on
`~/node_modules/.`, Chrome binary at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`):

1. **Click the Past-cycles tab BEFORE reading cards** — gotcha bitten
   2026-09-04: on the default Snapshot tab, `.card-title`/`.card-sub`
   belong to the Latest-poll cards ("Approve minus disapprove – a
   verdict on the job…"), so a probe that skips the click reports the
   WRONG subs with plausible confidence. Click
   `#tab-cycles` (or the button whose text is exactly "Past cycles"),
   wait ~2.5 s for the cycle-source fetch + render.
2. Match cards by title text ("net approval" for net/oppnet —
   disambiguate on "Opposition" — else exact strings "Preferred prime
   minister", "Government primary vote", "Government two-party
   preferred"); read the sibling `.card-sub`.
3. **Partial selection: the per-chip `.cyc-x` button** on the `.cyc-chip`
   containing `.cyc-year` text == the year (aria-label "Take {label} off
   the board"). Board-level "Show all cycles"/"Remove all cycles" never
   express a partial board. Front-trim = hide the EARLIEST chip; the
   interior-gap state needs a middle chip hidden (e.g. 1990, 1996 with
   1987 already off yields firstYear 1993 + "selected").
4. Outcome filter button: text matches
   `/Show (returned|ousted) governments only/`, toggles between the two.
5. Five ship-verified states: rest (all five cards "…for all previous
   terms since 1987"; oppr static), 1987 off (all "…since 1990", no
   "selected"), gap (all "…for selected previous terms since 1993"),
   returned filter (+"…was returned" clause, since 1987), ousted filter
   (+"…was ousted", since 1993).
6. `createRequire` comes from `node:module`, NOT `node:url` (bitten
   2026-09-04 — the url module has no such export).
7. `new URL(...).pathname` percent-encodes the space in "auspol tracker"
   and 404s every asset — serve from
   `fileURLToPath(new URL("..", import.meta.url))`; mime-map `.woff2` or
   fonts silently 404.
8. DOM clicks need `dispatchEvent(new MouseEvent("click", {bubbles:
   true}))` inside `page.evaluate` — puppeteer's `page.click` targets
   selectors, not the React handler, only when the node is in view.

## State as of 2026-09-03 (commit a0b910f)

Thirteen past cycles — 1987 through 2022 — plus current 2025 (CYCLE_DEFS
length 14; `arr[0].year` 1987; cycleApproval keys `1987,1990,1993,…,2022`)
after the 1987–90/1990–93 ship (911141c; drills cloned as
`.build/assimilate-{1987,1990}-cycle-csv.mjs`). Accuracy panel = twelve
rows, 1993…2025 — 1990 has none (no in-term 2PP on file), so accuracy copy
says "Twelve past elections" while meta chip-count language says "last
thirteen"; the split is intentional. Phone-default: REMOVED (2026-09-03) —
the a0b910f rule that deselected `year < 2010` terms on `useNarrow()` when
no `?c=` was present is gone; every viewport now defaults to every term
visible, and `hidden` only comes from the `?c=` URL param. Morgan guard
history: primary 100.5 → 105 → 106.5; 2PP 0.6 → 1.0 (Morgan only);
null-checked share columns now exclude grn AND onp (sub-threshold blanks
legit). The archive FLOOR for Morgan/ACNielsen is reached — Morgan opens
1996-03-23 and ACNielsen 1996-03-02: Newspoll is the only source for any
drill further back, and its own 2PP table (since 1993) is the binding
constraint.
