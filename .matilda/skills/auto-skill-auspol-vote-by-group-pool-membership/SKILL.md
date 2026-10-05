---
name: auspol-vote-by-group-pool-membership
description: auspol-tracker — triaging "why is wave X in/out of this Who-votes-for-whom pooled figure" (worked 2026-10-02: user distrusted the Rest-of-Australia ON pool showing 3 YouGovs + 1 Resolve incl. a 18–24 Aug YouGov — all correct). The SPARSE_K six-week window runs on FIELDWORK MIDPOINT vs the newest poll's date (data-time refNow, never wall clock); house membership per set is in demo-groups.mjs MEMBERSHIP comments; weight = group-n × SPARSE_K.weight with a 14-day half-life so edge-of-window waves carry ~1% of the pool. Includes the standalone replication script.
source: auto-skill
extracted_at: '2026-10-02T00:00:00.000Z'
---

# Who-votes pooled figures: why a wave is in or out

## The four facts that answer almost every "is this pool right?" question

1. **Window basis is fieldwork MIDPOINT, not release date and not wall
   clock. ** gen-data.mjs §7g (`demographics` IIFE ~:2639): for each wave,
   `d = ddays(refNow, midMs(pollRow))` where `midMs = (dateStart,date)/2`
   and **`refNow = new Date(LATEST_ISO)` = the NEWEST POLL's `date`** (the
   aggregate clock — deliberate, so a publishing pause freezes aging rather
   than emptying pools). In/out test is `d >= 0 && d <= SPARSE_K.window`.
   A poll released 18–24 Aug with midpoint 21 Aug sits at d=39 against a
   29 Sep clock — inside the six-week window with days to spare. The
   panel's visible copy says only "taken together over the past six
   weeks"; the midpoint-vs-newest-poll clause makes the count always
   explainable (nothing in the hover says why).
2. **SPARSE_K, not the headline weights. ** `SPARSE_K = { window: 42
   (2×HL_WINDOW), half-life 14d, taper after 28d }` (gen-data ~:293,
   comment: "a measure polled about once a week or less… so the same
   estimator still rests on several polls"). SPARSE measures: preferred
   PM, the ON two-candidate split, vote by group, leader NET ratings and
   direction. Don't audit these against HEADLINE_K's three weeks.
3. **House membership per set is a documented short list. ** In
   `demo-groups.mjs` (MEMBERSHIP comment + harmonize()+DEMO_SETS): the
   `state` set's "Rest of Australia" pool is **Resolve (prints the four
   groups) + YouGov from Jun 2026 (SA, WA, ACT/NT/Tas merged at 2025
   formal-vote shares 0.324/0.457/0.219 — a known split, not estimate)**.
   DemosAU and RedBridge publish no state cut; Roy Morgan prints no
   Tas/ACT/NT so only joins the three big states. A Rest-of-Australia
   rug of "3 YouGov + 1 Resolve" is exactly the design, not a bug.
   `location` (Inner/Outer metro, Provincial, Rural) is YouGov+RedBridge;
   DemosAU's Regional/Rural joins only the two metro groups; Resolve has
   no location cut so its education/age/gender waves dominate there while
   its Place coverage is state-only. When the user spots an odd house
   mix, read the MEMBERSHIP block first — the accept/reject reasons are
   written there per house.
4. **Weight collapses at the window edge, so "old" waves are cosmetic. **
   Per group: `rows[set|group|party]` each weighted
   `n·DEMO_SHARE[group]·SPARSE_K.weight(d)` (gen-data ~:2650). Worked
   2026-10-02 (clock 29 Sep): the 18–24 Aug YouGov (d=39, n 1510) carried
   **1.0%** of the Rest-of-Australia weight; dropping all four in/out
   polls recomputed the ON pooled gap as −3.06 vs −3.10 — 0.04 pts. A
   rug dot near the six-week edge is honest provenance with negligible
   grip; the pool effectively rests on the freshest 2–3 waves (that run
   had Resolve 43% and the Sep YGs 19%+37%).

## The rug the user is pointing at

`pd`/`px` arrays (gen-data ~:2701): per set×group, every window wave as
`{f: firm, l: fieldwork label, n: ≈whole-poll n × DEMO_SHARE, r: released}`
plus the wave's reading on the display scale. The `.rd-wv-rug` dots
(auto-skill auspol-vote-by-group-all-voters-anchor has the renderer
contract) are drawn from these — one dot per in-window wave, hover shows
firm/fieldwork/reading. So "the rug shows a 18–24 Aug YouGov" just means
that wave passed test #1.

## Replication script (standalone, run from repo root)

The §7g internals aren't exported, so recompute rather than import:

```js
const fs = require("fs");
const d = JSON.parse(fs.readFileSync("data/polls.json","utf8"));
const demo = JSON.parse(fs.readFileSync("data/demographics.json","utf8"));
const WIN=42, HALF=14, TAPER=28, SHARE={"Rest of Australia":0.23 /*…*/};
const rec=(dd)=>Math.pow(2,-dd/HALF)*(dd<=TAPER?1:0.5*(1+Math.cos(Math.PI*(dd-TAPER)/(WIN-TAPER))));
const ref = Date.parse(d.polls.reduce((m,p)=>p.date>m?p.date:m,"0000")); // newest poll = the clock
// per wave: find poll row by pollster+date (±4d for Resolve — demoPollOf),
// mid=(dateStart+date)/2, dd=(ref-mid)/day; in if 0<=dd<=42.
// weight = n·DEMO_SHARE[group]·rec(dd); group row = harmonize(w)[set][group]
// wave total = w.total if present else normalized poll primaries (demoTotalOf)
```

Full worked version lives in the 2026-10-02 session: it lists each
in-window wave's age, weight share, group reading, wave-total and gap,
then the pooled gap with/without any wave — the two-line diff that
answers "does this wave matter?". KEY numbers from that run (ON, Place,
Rest of Australia, clock 29 Sep 2026): YG 18–24 Aug 1.0%, YG 1–8 Sep
18.9%, Resolve Sep 43.2%, YG 15–21 Sep 36.9%; pooled ON gap −3.06 (−3.10
without the oldest) ⇒ verdict "all correct, edge wave is negligible".

## Related

- auto-skill-auspol-vote-by-group-all-voters-anchor — §7g's anchor/quoting
  rules and rug renderer detail.
- auto-skill-auspol-demographics-hand-entry — adding a wave (Roy Morgan).
- auto-skill-group-trend-proportionality — trend significance machinery
  (§7gb), the other common Who-votes audit.
