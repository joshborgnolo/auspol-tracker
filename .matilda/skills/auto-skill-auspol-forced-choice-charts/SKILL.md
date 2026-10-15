---
name: auspol-forced-choice-charts
description: auspol-tracker — the All-polls "Preference flows / forced choice" section (RdForced in rd-allpolls.jsx, fed by gen-data §7db). Shipped across six 2026-10-13 lands (02f35a9 third-chart+region-menu, 5cf9a4b four-mark-kinds rework, 9a187d2 follow-up trio: Farrer crosses REMOVED + the Labor-v-Coalition chart's RedBridge dots region-gated like its twin + a "Flows table" RdTsig fold, effa245 the co chart's DemosAU triangles region-gated too — pref_flows.onp_alp_lnp is national-only, no regional carrier —, da186e0 sibling un-fold of the Flows tables, c95cb65 the 2025 election rings' per-seat-class TPP REPLAY rekey): THREE charts (RedBridge Labor-v-One-Nation, RedBridge Labor-v-Coalition, DemosAU-MRP Coalition-v-One-Nation) drawing FOUR mark kinds — RedBridge wave dots and DemosAU MRP triangles BOTH join the per-cohort monotone lines (inLine = wave||mrp; user call "the MRP readings behave like the Redbridge dots, just differently shaped" → triangles, not diamonds), election rings sit outside every line with dotted lead-ins, 2026 count crosses sit on their election DAYS and join no line. Region menu (All voters/Inner/Outer/Regional) EMPTIES the RedBridge waves (BOTH charts — "Redbridge/accent data is only all voters' data… it should not be in any view other than the All Voters view") and the co chart's DemosAU triangles and crosses on named regions (the standing rule: national-only data appears in NO view but All Voters), rekeys MRP cells via rekeyMrp where a regional carrier exists (demosOn, lnpOn), and swaps election rings to per-AEC-seat-class counted flows (elec2025r), plus the ledger's "…% of the vote" sub-lines to per-seat-class 2025 first-preference shares (elec2025p, 2026-10-15); bys is TWO crosses (SA 2026 + Secret Harbour — Farrer's pair was dropped the same day, those counts measured an independent contest). The "Flows table" fold (a second RdTsig, summary!="Trend-significance table") tabulates the four electorate views per contest from all+regions data and DELIBERATELY ignores the region select. Data payload, rekey contract, mark geometry, prose-copy commitments, test (test-flow-splits.mjs) + headless probe (.matilda/probe/rd-forced-charts.mjs) conventions incl. monotoneXY segment-end parsing, oklch consumer-compare, the Set-precedence trap and the match-folds-by-summary trap.
source: auto-skill
extracted_at: '2026-10-13T04:40:33.960Z'
---

# Forced-choice preference-flow charts (All-polls section)

The section asks RedBridge/Accent's "if forced to choose" splits and
DemosAU's MRP pref_flows, then hangs the 2025-election count and three 2026
counts off the same axes. Renderer: `RdForced` in
`.build/newtracker/assets/rd-allpolls.jsx` (~:4700-5200; section wiring at
~5173-5195). Data: `gen-data.mjs` §7db (~4090-4189) emits
`window.AUSPOL.flowForced` ("FF" below) on the 9f09dca2 asset. CSS: `rd.css`
`.rd-ff-*` / `.rd-fl-*` family. Pinned by `.build/test-flow-splits.mjs` (npm
test chain; runs AFTER a build — the data asset only reflects the dataset
post-build) and probed by `.matilda/probe/rd-forced-charts.mjs` (puppeteer
against `allpolls/index.html`).

## The payload (§7db — every consumer reads FF, never re-derives)

- `FF.vsOn` / `FF.vsCoal` — RedBridge waves read VERBATIM off polls.json's
  `tpp_split_on` (lnp→coal/grn/oth) and `tpp_split` (grn/onp/oth);
  `ym` = fieldwork month (`dateStart || date`). One hand-derived cell:
  June-2026 Coalition split (`estCohort: "coal"`, CLP/LNP/Nat 34 + Liberal
  37 combined → 36.
- `FF.demos` — the DemosAU MRP Labor-v-Coalition carrier. NATIONAL-ONLY:
  `{date, xm, win, n, onp}` per wave off `pref_flows.onp_alp_lnp` — the MRP
  reports never split Labor-v-Coalition by region, so NO regional carrier
  exists (effa245, user-reported: "the demosau mrp triangles in Labor v.
  Coalition chart doesn't seem to move when switching between regions" —
  they had nothing regional to move to). `FF.demosOn` / `FF.lnpOn` — four-
  region carriers (`{all:{…wt:1?}, inner:{…}, outer:{…}, regional:{…}}`
  style; `demosOn` keys lnp→coal renamed) off the same reports' regional
  tables. The MRP readings ride the SAME cohort series as RedBridge's
  waves inside the renderer.
- `FF.elec2025r` — FOUR ring carriers (the TPP-flow re-cut landed after
  this skill's 2026-10-13 extraction; `.build/aec-2025-region-tpp-flows.mjs`
  documents why). `all` = the estimate's own AEC TPP-flow constants
  (grn 88.19 / onp 25.5 / oth 54.55 ALP share), the named regions = the
  script's CLASSIC-seat replays per AEC division class:
  `inner 86.41/33.8/55.68` ("25 of 43"), `outer 79.32/35.34/52.46`
  ("40 of 45"), `regional 76.9/31.46/49.01` ("50 of 62"). Every carrier
  rides 3 May 2025 on the month-index scale (`xm ≈ 2025*12+4+2/31`); the
  national carrier stands unflagged, the named regions carry
  `der/scopeTtl/scopeNote`. `FF.elec2025` (the old single carrier) is
  GONE — test pins `!FF.elec2025`.
- `FF.elec2025p` — the ledger's "…% of the vote" figures on a named region:
  the 2025 election's first-preference share of each seat class's vote
  (null on /vic/ builds where AEC_CLASS is absent). Not a polling figure —
  polling never cuts the vote by region, so the region menus rekey to the
  AEC count. Derivation lives in gen-data (an IIFE after the elec2025r
  replay): every seat sums every candidate's votes (the replay's
  classic-only cut does NOT apply — first preferences are complete in all
  150 seats), lumped alp / lnp (= lp+np+clp+lnp) / grn / onp (from `on`) /
  oth (everything else incl. the `member:*` named independents), buckets
  inner / outer / regional (= provincial + rural) by
  `data/aec-2025-division-class.json`, shares rounded 2dp. Pins:
  `all {alp:34.56, lnp:31.82, grn:12.2, onp:6.4, oth:15.01}` (the AEC's
  published national first prefs exactly), `inner {38.35/27.98/16.5/3.49/
  13.68}`, `outer {39.18/30.13/11.84/6.16/12.69}`,
  `regional {28.64/35.68/9.51/8.58/17.6}`; every row sums to 100 ± 0.05;
- `FF.bys` — TWO `{key,date,xm,coal?,grn?,oth?,label,win,sub,lbl}` crosses:
  `sa2026` 2026-03-21 (33.9/84.8/55.9; `lbl.coal:"Liberal"` — Bonham's
  estimates), `harbour` 29.8/90.0 on 2026-08-29 (Secret Harbour
  early-voting-centre count). FARRER'S PAIR (`farrlib`/`farrnat`) IS GONE
  (dropped 9a187d2, user 2026-10-13: "an independent national contest, not
  anything to do with One Nation" — the counts measured a
  Liberal-v-Nationals contest and One-Nation-INDEPENDENT races, so nothing
  for the One-Nation-preferences axis). `xm` is a PER-DAY month index
  (`y*12 + mo−1 + (dy−1)/dim`), unlike everything else on the axis.

## The region menu contract (the load-bearing user semantics)

`FF_REGIONS = [["", "All voters"], ["inner", …], ["outer", …], ["regional", …]]`;
state `ffReg` rides an `rd-pv-sel`-style select beside the section hed
(`aria-label="DemosAU MRP region"`). On a NAMED region:

- `waves={ffReg ? [] : FF.vsOn}` — RedBridge's national dots VANISH from the
  v-One-Nation chart ("if regional is selected, there are no redbridge
  points visible because they don't apply").
- `waves={ffReg ? [] : FF.vsCoal}` AND `extras={ffReg ? [] : FF.demos}` —
  SAME gate on the v-Coalition chart (waves 9a187d2: "the Redbridge/accent
  data is only all voters' data…"; extras effa245: the MRP's Labor-v-
  Coalition split is national-only, so its triangles also had to drop —
  the standing user rule now applies to EVERY mark kind: national-only
  data appears in no view but All Voters). On a named region that chart
  carries ONLY the election's four-region rings — no dots, no triangles,
  no lines, no lead-ins, no end labels. Gating `extras=[]` removes the
  whole furniture chain for free: `RdForced.groups` (~:4793) includes the
  extras, and the line list, lead-ins, end labels AND the spoken-note
  "Triangles mark…" clause all derive from `lastMrp`/groups — so the
  xnote clause and aria drop the national-only marks with no separate
  copy edit. The All-voters pinned behaviour (one triangle line onp-only,
  one lead-in to the first MRP triangle, one "One Nation" end label,
  the "Triangles mark DemosAU's MRP readings…" spoken clause) is
  untouched and stays probed.
- `bys={ffReg ? [] : (FF.bys || [])}` — the 2026 crosses vanish too
  (national counts).
- `elec={FF.elec2025r[ffReg||"all"]}` — rings swap to the region's counted
  flows.
- Ledger "…% of the vote" sub-lines rekey too (2026-10-15, user: the
  ledger's vote percents "should reflect the view currently selected"):
  `pvOf(pid) = ffReg && PVI[ffReg] ? PVI[ffReg][pid] : PR[pid]` — All
  voters keeps `D.latest.primary` (the national nowcast), a named region
  reads `FF.elec2025p[ffReg][pid]`. The stake line swaps its copy with
  the source ("…X% of the vote in the seats classed inner metro at the
  2025 election, so each 10 points of their preferences moves the
  contest there by Y points.") and ledgerNote gains a footnote clause
  ("* Each group's share of the vote is the 2025 election's over the
  seats classed … — polling never measures a region's vote."). Pinned in
  flows-ledger.mjs's regional + inner blocks.
- MRP extras rekey per `rekeyMrp(ws, reg)`: named region = printed cells;
  All voters = our enrolment-and-vote weighting of the three regions
  (`wt: true` stamped; arias/tips say "all-regions weighting"; the named
  regions must NOT carry that note).
- Keyboard (2026-10-15): the menu cycles on SPACEBAR while `#flow-drift`
  is in view (Space viewport-claim #6 — `spaceReg.current` modulo over
  `FF_REGIONS`, nulled when `FF` is falsy so Vic keeps the scroll day
  job; see auspol-spacebar-viewport-claim), and the section's contest
  tabs walk on hovered ←/→ (see auspol-hover-claims-arrows). Both
  pinned in the desktop block of `.matilda/probe/flows-ledger.mjs`.

## Four mark kinds → four shapes, one join rule

`const inLine = (g) => g.kind === "wave" || g.kind === "mrp";` — the cohort
lines run through `groups.filter(g => inLine(g) && g.d[ck] != null)` sorted
by xm; every built series draws a line (no leftover
"lone triangles get no line" filter — test pins its absence). Marks:
`.rd-ff-dot` RedBridge waves, `.rd-ff-tr` MRP triangles, `.rd-ring.rd-ff-ring`
election rings (dotted lead-in from ring to its cohort's FIRST wave mark —
on the Coalition chart's ON cohort, All voters only, the first mark is the
DemosAU triangle),
`.rd-ff-x` 2026 crosses. Key row mirrors shapes
(`.rd-ff-keydm` triangle clip-path, `.rd-ff-keyx` rotated cross,
`.rd-ff-keyring`, `.rd-ff-keyln`); tooltip swatches shape-match
(`.rd-ff-sw.mrp`, `.rd-ff-sw.byelec`, `.rd-ff-sw elec`). A chart with NO
groups stays unmounted (`!groups.length`); the v-ON chart keeps
`emptyNote: "No election count of this choice"`.

The third chart's title is split-party inked:
`<span className="rd-fl-xb">Coalition</span> v <span className="rd-fl-xo">One Nation</span>`
with `body.rd .rd-fl-xb { color: var(--lnp-text) }` /
`.rd-fl-xo { color: var(--onp-text) }` (rd.css ~:3089).

## The "Flows table" fold (9a187d2 — a SECOND RdTsig in the section)

Mounted directly above the section's existing `summary="Trend-significance
table"` battery: `<RdTsig summary="Flows table" heads={["Flow","All voters",
"Inner metro","Outer metro","Regional"]} sets={flowSets}>` (flowSets compiler
~5099-5150, mount ~5259 in rd-allpolls.jsx). Three sets — "Labor v Coalition",
"Labor v One Nation", "Coalition v One Nation" — each opening with:

1. `"2025 election, as counted"` — elec2025r's four views for the Coalition
   contest; dashes for the ON contests (no counted rows exist).
2. `"The flows this site uses"` — `D.flowTables` (`window.AUSPOL.flowTables`,
   flows.mjs constants: lnp {alp:1,lnp:0,…}, onp {alp:1,lnp:0.30,grn:0.91,
   onp:0,oth:0.55, onBand} — FRACTIONS, the compiler ×100 for display).
3. then the newest RedBridge/Accent wave (national-only — dashes across the
   three named regions) and the newest DemosAU MRP (national on the
   Coalition contest; per-region cells on the ON contests).

The fold DELIBERATELY IGNORES the region select (`ffReg` never reaches its
sets) — it lists all four views at all times; the probe asserts the cells
are byte-identical before/after a `page.select` on the region menu. Its
`.rd-note` mentions "RedBridge/Accent is national-only" and "2026 state
and by-election counts stay on the charts". Flows' section dek + RdFoot
copy moved with these changes (the `auspol-copy-two-homes`-style multiple
homes: dek, foot, aria-label, key footnote).

## Probe-authoring gotchas (each cost a debug cycle 2026-10-13)

- **monotoneXY vertices are SEGMENT ENDS**: the path is `M x y C c1x c1y,
  c2x c2y, x y …` — parse with `/[ML]([\d., ]+)|C([\d., ]+)/g` and take the
  LAST TWO numbers per segment; naively pairing every number overcounts 3×.
- **Shape centres from path data**: triangle path is apex-first (centre =
  apex.y + 5.4); cross path is top-left-first (centre = parsed + 4.2).
- **Never exact-compare render floats to printed figures**:
  `Math.round(v*10)/10` truncates 86.83→86.8 (that's `round(v×10)`, i.e.
  868.3→868→86.8). Use per-cohort tolerance `|got−want| ≤ 0.06` keyed by
  cohort CLASS (`f.erings.find(g => g.cls === CLS[ck])`), not sorted
  number arrays.
- **`new Set(a).concat(b).size` is a precedence trap**: `new X(…)` greedily
  swallows everything up to its closing paren, so `.concat(...).size` lands
  INSIDE the constructor arg — `new Set(arr.concat(...).size)` →
  `new Set(undefined)` → the set survives printing `"[object Set]"` and any
  arithmetic goes NaN. Chain off `(new Set([...spreads...])).size` with ONE
  spread array instead.
- **oklch var tokens break string compare**: Chrome's computed-style
  serialises hand-written `oklch(0.5 0.095 250)` differently from another
  consumer of the same var. Assert party-inked spans by comparing the
  COMPUTED colours of two same-var CONSUMERS (`getComputedStyle(xb).color
  === getComputedStyle(lnp-name).color`), never the raw token string.
- **A mark's kind cannot be read off the wave object**: MRP extras share
  the wave's field shape (no `house` stamp on merged rows). Decide dot-vs-
  triangle by membership: `extOf(FF, q, "").some(w => w.xm === first.xm)`.
- Election-ring tip values carry the % sign: assert an exact `"86.83%"`
  element via `tip.vals.includes(v + "%")`, not `String(v)`.
- **TWO `summary="Trend-significance table"` mounts exist** in rd-allpolls
  (one in the flow-DRIFT section ~4435, one in forced-choice ~5269, with
  "Flows table" between): a mount-order pin must compare `indexOf('Flows
  table')` against `lastIndexOf('Trend-significance table')`, and a probe
  collecting `details.rd-tsig` folds must match each fold BY ITS SUMMARY
  TEXT — first-hit `querySelector` silently picks the wrong chamber.
- **vm-realm arrays fail deepStrictEqual**: `assert.deepEqual` comparing an
  array produced inside `vm.runInNewContext` (test-flow-splits' FF sandbox)
  against a host-realm literal dies on the Array-prototype mismatch —
  identical contents print in both sides of the diff. Spread into the host
  realm first: `[...FF.bys.map(d => d.key)].sort()`.
- **Neighbouring probes (flow-pick) count MENUS**: the forced charts' own
  region select rides the drift section's `.rd-fl-sel` sizing idiom inside
  the same `#flow-drift` section, so any probe scoping `select.rd-fl-sel`
  matches both. flow-pick was re-pointed at
  `select[aria-label="Highlight a pollster"]` (9a187d2) — target the
  aria-label, keep the sizing class out of selectors.

## Verification and land record

Branch `forced-choice-region` in `.worktrees/`: 02f35a9 (third chart +
region menu; a sibling pushed it), 5cf9a4b (the four-mark-kinds rework,
amended once to fix a heredoc-mangled subject — write long commit messages
with write_file + `git commit -F`, NEVER a heredoc inside run_shell_command;
the second attempt leaked `EOF` into the subject). Then 9a187d2 (this
2026-10-13 follow-up trio: co-chart region gate, Farrer crosses out, "Flows
table" fold in, flow-pick re-pointed at the aria-label). Push raced again
(c85af4e hover-furniture + bbfb9f9 demographics facet landed first) →
`git merge origin/main` auto-merged the four tab pages, then REBUILD FIRST
(`node .build/newtracker/build.mjs`) so no auto-merged hunk survives in a
generated artifact, restage the rebuilt pages, amend the merge commit
message (the default "Merge remote-tracking branch…" tells a reviewer
nothing), re-run test-flow-splits + flow-pick + rd-forced-charts + npm test
on the merged tree, `git push origin HEAD:main` → `c85af4e..5cb53ce`.
Green: probe ALL CHECKS PASSED (desktop geometry per chart, region sweep
now national-only on the Coalition chart, lead-ins, tips, the Flows-table
recompute block, phone rung), `.build/test-flow-splits.mjs`, full
`npm test`.

Then effa245 (same 2026-10-13, user-reported "triangles don't move when
switching regions"): **triage a "the mark doesn't move on the region
menu" report by checking the DATA ceiling first — does the measure even
CARRY regional cells** (`pref_flows.onp_alp_lnp` is one national figure
per wave; demosOn/lnpOn carry four) — before attributing it to a renderer
bug. With no regional carrier, removal-on-named-region (not a static
national mark) is the only behaviour consistent with the user's standing
national-only rule; one-line renderer gate + gen-data comment +
test-flow-splits pin + probe region-sweep rewrite (its co block had
pinned the OLD "triangles stand" contract — the probe mirrors the
contract, so it must move WITH a behaviour change; also `extOf` gains a
`reg ? [] :` for co). The whole furniture chain (lines, lead-ins, end
labels, spoken-note clause) is derived from `groups`, so the gate needed
no copy edits; verify by probing the aria on a named region (`!aria.
includes("Triangles mark")`). Rebuilt, test-flow-splits ok, validate
clean, probe 315 checks PASSED, flow-pick + mrp-prefs + full npm test
green, `git push origin HEAD:main` → `5cb53ce..effa245` (no race that
time).

Related: auspol-flow-drift-panel (the §7c/§7d neighbour; §7db of gen-data
follows it), aec-preference-flow-constants (TCP-vs-TPP flow provenance),
auspol-headless-geometry-verify (probe conventions).
