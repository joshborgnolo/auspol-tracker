---
name: auspol-past-cycles-summary-rows
description: auspol-tracker — adding a row to the Past-cycles "Every measure N months in" summary table (worked 2026-09-30 THREE times: One Nation onp row, L/NP + ON comb sum row aa72b41, Hanson net-approval han row 17688a9). Pure rd-cycles.jsx edit (no gen-data unless the series doesn't exist): helpers combSeries/seriesOf/cycBaseOf (after RdCycleChart), the Mby alias block + endOfKey/curOf (RdPastCycles), a ROWS entry in position, and the SEC map (↓ jump target). KEY TRICK: row key ≠ metric key — Mby.han = { key:"oppnet", leader:"opp", unit:"" } makes the han row QUOTE the sitting term's own series (curOf reads c.end.han) but rank its strip/average/rank against the oppnet PEER set (rdCycPeers reads past cycles' raw.oppnet), answering "treat it as an opposition leader's measure for the purposes of rank"; Mby.onp = { key:"oppr", leader:"opp", unit:"%" } (e394c49) does the same for ON's primary against past OPPOSITION primaries, since ON's own history starts under 10%. derived-series rows (comb) extend seriesOf/cycBaseOf/endOfKey, never invented per-call. Data already emitted by gen-data: raw.base.end for han/onp (end = last READING on sparse grids), no emitter change needed. Value fmt: unit "%" level = unsigned toFixed(1), change and leaders = rdSgn signed 1dp. Probes that MUST move with any row add: .matilda/probe/cycles-combine-onp.mjs EXPECTED_NAMES exact order (row order, Now figures, strip dot counts, rank text, level AND change mode, 1280+390px) and .matilda/probe/cycles-label-wrap.mjs (row-name one-line, avg/rank non-collision at 390/430/480).
source: auto-skill
extracted_at: '2026-09-30T10:19:09.476Z'
---

# Past-cycles summary-table row surgery (auspol-tracker)

The Past-cycles tab's lower table ("Every measure N months in", `#cyc-summary`,
class `.rd-cs-row`) reads past-term strips, against-average and a rank cell per
measure. Adding a row is renderer-only — **all edits live in
`.build/newtracker/assets/rd-cycles.jsx`** (tabbed-views conventions live in
d1a1d215; the CYC_META-side series assembly is gen-data's, `auspol-past-cycles`).

## The four homes of one row

1. **Helpers (module level, after RdCycleChart, ~:236)** — only for series NOT
   shipped as `raw[key]`:
   ```js
   const combSeries = (c) => c.raw.months.map((_, i) => (
     c.raw.oppr[i] != null && (c.raw.onp || [])[i] != null
       ? +(c.raw.oppr[i] + c.raw.onp[i]).toFixed(2) : null));
   const seriesOf  = (c, key) => (key === "comb" ? combSeries(c) : (c.raw[key] || []));
   const cycBaseOf = (c, key) => (key === "comb" ? cycBase(c,"oppr") + cycBase(c,"onp")
                                                  : cycBase(c, key));
   ```
   `rdCycPeers(M, cycles, hidden, chg, m)` consumes `seriesOf`/`cycBaseOf` for the
   strip dots/average; `rdCycRank(peers, v, fmt)` word-smiths the rank cell
   ("3rd highest of 21", "Middle of 21", "Only X (YYYY) was higher").
2. **Mby alias + figure plumbing (RdPastCycles, ~:308)**:
   ```js
   Mby.onp  = { key: "oppr", leader: "opp", unit: "%" };    // peer key ≠ row key
   Mby.comb = { key: "comb", leader: "opp", unit: "%" };
   Mby.han  = { key: "oppnet", leader: "opp", unit: "" };   // peer key ≠ row key
   const endOfKey = (c, key) => (key === "comb"
     ? (c.end.oppr != null && c.end.onp != null ? +(c.end.oppr + c.end.onp).toFixed(1) : null)
     : c.end[key]);
   const curOf    = (key) => { const v = endOfKey(cur, key);
                               return v == null ? null : (chg ? v - cycBaseOf(cur, key) : v); };
   const peersOf  = (key) => rdCycPeers(Mby[key], cycles, hidden, chg, m);
   const fmtOf    = (key) => (v) => (Mby[key].unit === "%" && !chg ? v.toFixed(1)
                                                                   : rdSgn(v, false));
   ```
   `cycBase(c, key)` = `c.base[key]` else first non-null `c.raw[key]` reading else 0 —
   a sparse series (han) base-anchors on its FIRST READING, never month 0.
   `rdSgn(v, false)` = sign + `Math.abs(v).toFixed(1)` (probe helper `signed` mirrors it).
   onp aliased to oppr in e394c49 (2026-10-01): ON's own history starts under 10%, so
   ranking today's 20%+ against past ON primaries read as a record walkover. The row
   still QUOTES ON's sitting-term series (row key onp — `curOf` reads `c.end.onp`,
   `cycBaseOf` anchors ON's own base; no `endOfKey` branch needed) but
   `peersOf`/`seriesOf`/`cycHolderAt` pool past OPPOSITION primaries, so the strip and
   Previous-high/low now name Howard, Rudd, Gillard, Turnbull, Shorten and Albanese
   (Previous low reads "Albanese, 34.9", not an ON-era low).
3. **ROWS entry** — in position between the neighbouring measures:
   ```js
   { key: "han", name: "Hanson’s net approval", sub: "Pauline Hanson",
     group: "leaders", color: D.PARTIES.onp.color },
   ```
   ROWS.map computes `peers`, `v = curOf(r.key)`, `fmt`, `rank` — nothing per-row to
   hand-fill. `group: "votes"|"leaders"` selects the strip scale band (votes step 10
   level / 20 chg; leaders always 20). `leader: "opp"` on the Mby metric is what makes
   `cycHolderAt` name past OPPOSITION leaders in rank subs ("Only Dutton (2022)…").
4. **SEC map** (~:546) — the ↓ button's scroll target:
   `han: "cyc-leaders"`, `onp/comb: "cyc-primary"` (sections `cyc-tpp`, `cyc-primary`,
   `cyc-leaders`, `final-polls`).

## The row-key/metric-key split (why Mby.han works)

Rows are looked up twice — **current figure** by ROW key (`curOf` reads the sitting
cycle's `c.end[key]`/`cycBaseOf(c,key)`), **past peers / rank** by METRIC key
(`rdCycPeers` reads `Mby[rowKey].key` over `!c.current` cycles). A measure with no
past readings (Hanson — `raw.han` null-pads every past cycle; gen-data
"'no past cycle rated Hanson'" comment) still ranks usefully: alias its Mby entry to
the measure whose peers the user asked for ("treat it as an opposition leader's net
approval **for the purposes of rank**"). Prod value at ship: −5.6 level, −14.6 change,
"Middle of 21".

## Data-side ready-steady (gen-data already emits these — check before emitting)

`const cycles = CYCLE_DEFS.map(...)` (~:4630) ships `base/raw/end` per key; **sparse
series` `end` is the last READING** (`[...c.han].reverse().find(v => v != null) ?? null`)
and `raw.han` null-pads data-less terms. Adding a brand-new gen-data series is the
FOUR-extension whitelist (+ base/end/points/raw) pinned in `auspol-past-cycles`.

## Null rules that must hold when you add a row

- Half-measured months stay null (`comb` sums only where BOTH tracked), so null terms
  drop out of strips via `rdCycPeers`' `hasData` filter rather than zero-padding.
- `curOf` returns null (not NaN) → row shows "—" and rank cell collapses to dash —
  past-term strip may STILL draw peers; harmless and generic.
- `fmtOf` `unit:"%"` level prints unsigned `toFixed(1)` + "%" cell; leaders and all
  change-mode figures print `rdSgn` signed 1dp ("+20.5" / "−5.6").

## Probes that move with any row add (same repo pass, or row names break them)

- `.matilda/probe/cycles-combine-onp.mjs` — `EXPECTED_NAMES` asserts the EXACT row
  order; `readSummary` (name/Now-cell/strip-dot-count/rank-text via `.rd-cs-now`,
  `.rd-cs-dot`, `.rd-cs-rank`); data expectations recomputed per run from
  `window.AP.D.cycles.find(c => c.current)` (`signed` helper = rdSgn). Checks run at
  1280 and 390 px, in level AND change mode (mode toggle clicked via
  `#cyc-summary .rd-tab`). Hanson additions: her strip dot count === the oppnet row's
  (same peer set — the whole point of the alias), and her rank text matches
  `/(Highest|Lowest|Middle) of \d+|(highest|lowest) of \d+/`.
- `.matilda/probe/cycles-label-wrap.mjs` (390/430/480px, text-node Range rects over
  the name's bold) — "Hanson’s net approval" fits one line; re-run on ANY row-name
  change, `.rd-cs-rank` must keep its 4px clearance from the average box.
- `.matilda/probe-cyc-holder-year.mjs` (repo root, port 8952) — holder-name dot
  tooltips from cyc264366 onward; it asserts the onp row's holder set, so it now
  expects ON's 20 dots to resolve to the 15 OPPOSITION holders (same pool as the
  Opposition's-primary row). Run it on any Mby alias change.
- The curves' own end-note overlay probe section asserts the chart series names
  ("One Nation this term", "Combine L/NP and ON") — same file, separate block.

## Shared-repo pre-flight (this feature add ran through it twice)

- A sibling session's uncommitted **rd-panels.jsx** sat in the worktree mid-flight
  FIRST time through — my rebuild of index.html baked their unfinished digit-key
  feature in. Procedure: `git stash push -- .build/newtracker/assets/rd-panels.jsx`,
  rebuild, commit rd-cycles.jsx + index.html ONLY, `git stash pop`. SECOND time the
  stash was a no-op ("No local changes to save") — the sibling had committed
  (`a877a98`) in the interval, so their work entered my build legitimately. **Check
  `git log -- <the file>` and `git status` before re-stashing; the hazard's state
  changes between runs.** See `shared-repo-session-race` and the commit-path-limited
  rule (`git-prestaged-commit-sweep`).

## Related

- `auspol-past-cycles` — CYC_META / CYCLE_DEFS data side, cyc-comb checkbox
  conventions (both-measured months, base = sum of cycBase), the allowed
  handler shape for the opposition chart's tickboxes, cycleSource hash checks.
- `shared-repo-session-race`, `git-prestaged-commit-sweep` — mid-flight hazards.
- `auspol-headless-geometry-verify` — probe style (text-node rects, no PNGs).
