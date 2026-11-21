---
name: auspol-map-vote-type-panel
description: "auspol-tracker /map/ — the 'How votes were cast' block end-to-end (the vt/vt2/vt3 vote-pile lane): the party measure toggle 2PP/Labor/Coalition/Greens/One Nation/Other above Skew/Effect (2026-11-10; vt3 first-preference piles from fpvvt in build_vote_piles.py; buttons palette-coloured by family key 5390b703, 2026-11-12), the VT_ERAS per-election band sets (2016/2019/2022/2025 shipped a0b7aa59, 2026-11-09; v1 chart+Now gate f4d52c49), the vtBandsFor frame gates, the m.res-divs-vs-m.divs read split that keeps Now's figures the election's, producer facts, and the adapt-here pins in test-map-page.mjs"
source: auto-skill
extracted_at: '2026-11-09T07:04:11.827Z'
updated_at: '2026-11-12'
---

# /map/ "How votes were cast" — the vt/vt2/vt3/vts vote-pile lane end to end

CURRENT form (2026-11-10, two landings this day): (1) the party measure
toggle above Skew/Effect — 2PP (default) / ALP / L/NP / GRN / ON / OTH —
re-reads the SAME bands by first preferences (vt3, from the fpvvt
downloads); (2) the SENATE cast lane: "the section changes with the lens"
reaches this panel — the Senate lenses (senate + senpref) read Senate
ballots (vts) with the Senate count's OWN era and a five-button measure
row (no 2PP), never the House figures. Era/band chart form shipped
2026-11-09 as commit a0b7aa59: per-election band sets and AEC-quoted
release labels on every federal frame from 2016 (worked on top of
f4d52c49, whose Now frame had carried the chart alone).

## Two data fields per res-file division

- `vt` — formal votes per pile (written by `build_map_data.py` into res
  files): keys `ord, ppvc, pre, post, abs, prov`. `vt.ppvc` counts FORMAL
  votes at early centres like every other pile (`fix_ppvc` block).
- `vt2` — the pile split of Labor/Coalition votes:
  `{pile: [labor, coalition]}`, keys `day, mob, ppvc, pre, post, abs, prov`
  (ordinary is split by kind of polling place; a pile is absent when empty).
  Producer: `python3 -I .build/map/build_vote_piles.py`, which patches res
  files in place — run it after anything that rewrites a res file
  (geo_build.mjs, handbook_geo.mjs), then `node .build/map/assemble.mjs`;
  test-map-page.mjs fails if a res file comes back without vt2. Sources by
  era: AEC two-party-by-vote-type 2016+, two-candidate-by-vote-type
  2004–2013 (classic Labor-v-Coalition seats only), stats-pack final count
  1996–2001 (classic seats only), none in 1993. Each seat's piles are
  asserted against its final count before writing.
- `vt3` — the first-preference split behind the party toggle (2026-11-10,
  same producer run): `{pile: [alp, lnp, grn, onp, oth]}` for the same
  seven pile keys, `oth` pooling independents with the rest, 2016+ only
  (the fpvvt first-preferences-by-vote-type lane). `fp_piles` joins fpvvt
  to the seat's candidates BY BALLOT POSITION — per row its party code and
  total must equal the res candidate's, and the res file's own bucketing
  stays canonical — splits ordinary by kind of place from the res booths'
  own first preferences (same lane as booth_split), and cross-counts every
  five-wide pile against its vt2 pair's total before writing. A division
  without vt3 leaves a party view's figures null (complete gate), never 0.
- Derive-side: `deriveDiv` (app-1-base.js) carries all four through
  (`vt/vt2/vt3/vts || null` — the vt3/vts halves are pinned); `applyNow`
  nulls a by-election seat's derived `D.vt` AND `D.vts` (a by-election has
  no Senate poll), and storyDiv's `if (d.vt)` gates the whole block, so
  vt2/vt3 need no nulling there.



## THE SENATE CAST LANE (shipped 2026-11-10)

- `vts` — the Senate first-preference piles, on 2019/2022/2025 res divs:
  `{pile: [alp, lnp, grn, onp, oth]}`, same seven pile keys ("oth" pooling
  independents), written by `.build/map/build_senate_piles.py` (patch
  in place after geo builds + build_vote_piles, then assemble). Sources:
  `.build/aec-flow-src/senate-fpv/div-<y>.csv.gz` (every candidate's votes
  by vote type per division) + `pp-<y>-<ST>.csv.gz` (ordinary by polling
  place) — the Senate never says which place is an early centre, so venue
  types ride the HOUSE res booths' ty: the downloads' PollingPlaceID is
  the same AEC id in both chambers' products (measured 100% of places AND
  votes, all four eras). Buckets are the Senate's canonical ones:
  senate_vote.py's `bucket()` lane, imported after its main()-guard
  refactor (helpers, no regeneration on import), KEYED BY (division,
  candidate) — the VTR's CandidateID repeats across states (2019's Bean
  collision bit the first per-candidate-only join). Producer asserts
  before writing: every res division has its Senate count; every pp id has
  a House counterpart; each candidate's pp ordinary votes add to its
  div-file ordinary votes; per-division family piles == div file totals
  AND == senate-vote-<y>.json's row ([5]+[6] vs oth).
- 2016 IS DELIBERATELY OUT (producer YEARS=(2019,2022,2025); asserted
  `!d.vts` in test-map-page): its pp product misattributes ~176/22,702
  candidates' ordinary votes between tickets (e.g. FFP bp1/bp2 Boothby by
  553/452) — whole-division totals reconcile, per-(division,family)
  reconciliation drifts by tens, and this store's contract is exactness.
  If a Senate cast era for 2016 is ever wanted, the venue lane won't
  carry it (only type-level piles could be trusted).
- THE SENATE ERAS (VT_ERAS_SEN): 2025 in the USER'S OWN instruction text
  (day+mob "Election night, after House count"; ppvc alone "From Monday,
  5 May" — never on the night; postal with declarations "Over following
  days"); 2019/2022 quoted in the AEC's own count-fortnight terms
  (both chambers shared one counting program, so they mirror the House
  layout but ride Senate evidence, never House labels transplanted):
  2019 — election-night covered every day-cast HoR AND Senate ballot plus
  ">90% of pre-poll votes" (media-releases/2019/05-20), remaining Senate
  pre-poll finished Mon–Tue (.../05-21), postal close-seats Sunday / all
  seats Tuesday (.../05-20a); central Senate scrutiny Tue 21 May is the
  OTHER pipeline, never chart copy. 2022 — the Count Timeline says "First
  preferences were also counted for every Senate ballot paper" on the
  night (media/2022/05-27), postal from Sunday in every division
  (.../05-22, .../05-27). 2016's sequencing is likewise sourced
  (media-releases/2016/07-03e: Senate polling places only election night;
  pre-poll Senate ordinary "may also start on Monday"; postal verification
  Monday, counting from Tuesday) — and 2016's ERA SHIPS in ITS OWN ORDINARY
  SHAPE (user asked "wait can't you do 2016?", 2026-11-10): vts for
  2016 carries one "ord" pile (every ordinary ballot — day, mobile and
  early centres together, never venue-split — national ord ≈81.7%) since
  its pp venue product misattributes ~176/22,702 rows between tickets;
  its era reads bottom "Ordinary votes — Election night, rest from
  Monday", postal "From Tuesday", declarations over days. The aria
  opening-count gate is position-based (ri === bands.length−1), not
  key-based (era shapes differ); .vt-band-ord wears the day's tint.
- LENS SWAP: `senCast = (S.lens === "senate" || "senpref") &&
  vtBandsFor(m.year, true) != null` in storyArea — with a Senate era the
  pool reads d.vts (vtScope's chamber param, pinned literal changed to
  `d[key]`); senLanes && !senCast renders NOTHING (GF-2: no House piles
  masquerading in the Senate lens). storyDiv mirrors the spf gate
  (`!d.by && d.vts && vtBandsFor(M().year, true)`). The measure row is
  `VT_PARTIES_SEN = VT_PARTIES.slice(1)` (no 2PP), its own selection
  `vtSenParty` (default "alp") shared vtRedraw; panel h3 tags the chamber
  (`<N> Senate formal`). Denominators: piles' ballots = Σ five families
  (a Senate ballot IS one first preference), never d.vt.
- test-map-vote-bands: checkSen oracles all five measures over the same
  five pools, pins the era config verbatim, five-buttons+no-2PP chrome,
  and vts-missing nulls; test-map-page pins per-seat vts contracts and
  the 2025 national Senate oracles (formal 15,871,189; ALP/LNP/GRN/ON/OTH
  35.1/29.9/11.7/5.7/17.6; per-pile ALP 35.0/40.4/35.8/32.8/34.9/31.8/32.2
  day..prov; GRN day+mob 13.5/ppvc 10.1/abs 16.6; LNP post 35.0).
- probe: `.matilda/probe/map-vt-senate.mjs` (BASE-servable) — lens swap
  in and out, era labels, five buttons, oracles from served core-2025's
  vts, Bean's seat lane, and 2019's no-era contract.

- 2025 reference oracles (computed this session from res-2025.json):
  national formal 15,490,236; day(ord−ppvc) 40.99%; ppvc 38.56%; pre 3.44%;
  post 13.60%; abs+prov 3.41%. Farrer's 2025 formal: 103,063. National
  primaries from vt3 (pinned in test-map-page.mjs): ALP 34.6 / Coalition
  31.8 / Greens 12.2 / ON 6.4 / other 15.0; Greens 14.2 on the day vs 5.1
  mobile teams / 9.5 postal / 19.4 absentees; ON postal 6.8.

## Renderers — `.build/map/app/app-4-story.js`

- OLD stacked table (`.stack` + `.tbl.vt-tbl`): the tail of `vtBlock` (:882);
  `vtRows` (:774) with thresholds `VT_MOB=0.05, VT_CELL=100, VT_SAY=500,
  VT_LEVEL=0.5` (comment block at :760 explains the "worth saying" rules) and
  the `vtFinding` sentence (like/flat comparisons vs on-the-day).
- NEW band chart (`.st-sec.vt-chart`): `vtBandsBlock` (:1129). The band set
  is PER-ELECTION: `VT_ERAS` (:1030) maps a frame year to its
  `[k, label, pileKeys, time]` rows and `vtBandsFor(y)` (:1060) picks it
  (`"now"` → 2025, otherwise `+y` on the key; null = no chart for that
  frame). `vtBands` (:1103) maps its OWN call, not a module constant —
  `(vtBandsFor(M().year) || []).map(...)`. Four eras shipped:
  - 2025 (3 bands): day+mob "From about 7 pm", ppvc+post "From about 9:30
    pm", pre+abs+prov "Over following days" — quoting the AEC's 30 Apr 2025
    "Federal election counting 101" release (the ONLY year with clock
    times).
  - 2022 (4): post own band "From Sunday"; early centres "On the night, the
    biggest late"; day "On the night".
  - 2019 (4): post "From Tuesday"; early centres "On the night".
  - 2016 (4): post "From Tuesday"; early "On the night, the rest Monday".
  Every era keeps a band keyed "day" — vtBands special-cases THAT KEY
  (`k === "day"` computes formal votes as `ord − ppvc`); renaming the key
  breaks band totals. Postal moved by era because the AEC's statements do:
  counted on the night only in 2025 (~2,000/division), Sunday in 2022,
  Tuesday in 2016/2019 — late band label/timing stays "Over following days"
  everywhere (see auspol-aec-count-timing-statements for the releases; a
  user once restated the 7pm/9:30pm pairing INVERTED — verify there before
  touching labels). Pooled counts before shares; skew mode vs effect mode
  as before; the mode toggle is module-global `vtMode` via `setVtMode` +
  `renderStory(true)`, labels just "Skew"/"Effect" (user call, 3b636e08).
- FRAME GATE: `vtBlock` (:1150) routes to the chart whenever
  `vtBandsFor(M().year)` is non-null — i.e. 2016+ and "now" — else the old
  table. 2013/2010 deliberately keep the table even though `vt` piles
  exist: their `vt2` covers classic-seat pairs only, so Skew/Effect would
  show "unavailable" page-wide (an era lands in VT_ERAS only when
  test-map-page.mjs's per-res pins say every seat's piles split the final
  two). The AREA-level pool is built at storyArea ~:1208-1209:
  `const castScope = vtScope(m, st)` is unconditionally built now, with the
  geography label passed through only in era frames:
  `if (cast.length) h += vtBlock(cast, true, vtBandsFor(m.year) ? castScope.geography : undefined);`
  and `vtScope` (:1180) still follows the Winner head's figures-scope menu
  (`statScopeOf` — states / seat-class pools) or the state scoping.
- THE PARTY TOGGLE (2026-11-10): `VT_PARTIES` (six buttons —
  2PP/Labor/Coalition/Greens/One Nation/Other) rides `vtParty` (default
  `"tpp"`); `VT_WORDS`/`VT_POSS`'s names flesh the heading ("National
  Greens primary skew") and notes ("in the Greens' primary share"). A
  party measure re-reads the band's OWN counts: band's family votes over
  its formal votes, base = the pool's family share of its formal vote —
  skew and cumulative effect carry the same shapes as 2PP (the shared
  cumulative loop never learns the difference: n=v formal, a=family).
  A positive party skew takes that party's `t-<fam>` tone; a negative none
  (2PP keeps vt-alp/vt-lnp — two-way; a primary gap has no single
  counterparty). `setVtParty` shares `setVtMode`'s block-only redraw via
  the factored `vtRedraw(sel)` — scroll-anchored, focus-retained — with
  `[data-vt-party]` click delegation beside `[data-vt-mode]` in
  app-6-ui.js and the spacebar guard widened to
  `"[data-vt-mode],[data-vt-party]"`. The party row is `.vt-modes.vt-parties`
  ABOVE the measure row (`flex-wrap: wrap`, then `.vt-parties + .vt-modes`
  pulls them 6px apart), inheriting the same `.vt-mode` chrome incl. retro.
  `vtLast` keeps the pool across both toggles.
- PARTY-BUTTON COLOURS (user ask 2026-11-12, 5390b703): every non-2PP
  party button wears `class="vt-mode t-<k>"` (2PP stays untoned — two-way
  has no single family), so ALP paints the map's red (rgb(247,49,10)),
  OTH its grey (rgb(154,154,154)), etc. The fill rules live in page.css's
  vt section: `.vt-parties .vt-mode.t-<fam> { color: var(--m-<fam>); }` —
  the palette tokens, and NOT a bare `.t-<fam>`: the bare class alone
  (0-1-0) LOSES to `.vt-mode { color: var(--ink-2); }` (0-1-0, declared
  later), and `.vt-mode:hover` / `.vt-mode[aria-pressed="true"]` (0-2-0)
  would wash the colour back to ink; the three-class selector (0-3-0)
  out-ranks both, so the family colour holds in every state. The Senate
  five-button row gets the colouring free (same JSX line over
  VT_PARTIES_SEN). The vm-suite chrome pins that keyed on exact quoted
  class strings moved with the change: the seven-button count regex
  `/vt-mode"/g` → `/class="vt-mode[ "]/g` (any second class joining a
  button's class list silently drops it from an exact-quote pin), plus a
  toned/untoned pin (`class="vt-mode"` on tpp, `class="vt-mode t-grn"` /
  `t-oth` present). Probe `.matilda/probe/map-vt-party-colours.mjs`
  (BASE-servable) reads each button's computed `color` and asserts equality
  with a scratch element's computed `var(--m-<fam>)`, incl. after a party
  click (pressed) — computed-colour probing, the geometry-verify idiom.
- Seat-level: `storyDiv` (~:1099) `if (d.vt) h += vtBlock([d]);` — so a
  by-election seat shows NO block (its derived vt is null); a normal seat
  gets the frame's chart form with the seat's name as geography.
- Both forms, area scope only, push the note "Postal, absent and declaration
  votes have no place on the map, so balloons and the surface leave them out."
  (the map surface genuinely omits them — also the reason the band note
  exists). CSS homes: `.vt-tbl`/`.stack` rules page.css :469-472 (old),
  `.vt-chart`/`.vt-band*var(--...` rules :477-504 (new, container-unit clamped).

## The m.res-divs-vs-m.divs read split (why Now's block is the election's)

`applyNow` replaces only the DERIVED `m.divs` entry for a by-election seat
(and appends overlay booths to `m.res.booths`); `m.res.divs` stays the base
election's rows, piles and all. The cast block reads `m.res.divs`, so the
Now frame's figures remain the 2025 election's — Farrer's 2025 election-day
103,063 formal included, banner-total 15,490,236 — and storyArea already
declares that with the "The figures below are the 2025 election's." note in
its isNowY block (~:911). Gate a future clone grep on the comment
`(from the results file: "Now" blanks a by-election's piles, and these
figures are the election's)`.

## Pins in test-map-page.mjs (~:120-148, :192-196)

- Data pins per federal res file (1996–2025 loop): `vt.ppvc` equals booth
  `ty===5` formal sums; 2016+ every seat has vt2 adding up to `tpp[0..1]`
  AND vt3 whose five groupings sum to the vt2 pair per pile and to the
  seat's final per-family count overall (`fam` oracle `{alp:0,lnp:1,
  grn:2,onp:3,ind:4,oth:4}` — vt3's "oth" pools independents); pre-2016
  carries neither vt3; nothing in 1993; national oracles lab 2PP
  day/ppvc/post = 58.0/53.0/51.6, piles sum to `agg.AUS.tpp`, plus vt3's
  own headline oracles (national primaries 34.6/31.8/12.2/6.4/15.0, the
  per-pile shares listed above, 15,490,236 formal conserved).
- SOURCE-STRING pins (:192-196) pin the shared one-block contract, the era
  accessor and the era labels VERBATIM — editing any of the five breaks an
  assert; update pins in the same commit (a0b7aa59's own pattern over
  f4d52c49's older literals). Current forms:
  `if (cast.length) h += vtBlock(cast, true, vtBandsFor(m.year) ? castScope.geography : undefined);`
  `if (vtBandsFor(M().year)) return vtBandsBlock(`
  `function vtBandsFor(y) { return VT_ERAS[y === "now" ? 2025 : +y] || null; }`
  plus `"From Tuesday"`/`"From Sunday"` presence (the 2016/2019/2022
  release labels) — note the `castScope = vtScope(m, st)` literal pin is
  unchanged from f4d52c49 and still matches.

## test-map-vote-bands.mjs — the vm-harness assertion suite

`.build/test-map-vote-bands.mjs` evaluates app-4-story.js inside
`vm.createContext`, exposing `vtBandsFor` beside the old
`vtBands/vtScope/vtBlock/statScopeOf` api object. `checkPool(divs, label,
eraBands)` now takes the era's band rows (the caller passes
`api.vtBandsFor(y)`), builds its cumulative-stage oracle from those rows
in counting order instead of a hard-coded pile list, and asserts each
band's skew from re-pooled counts. An era loop (:172) loads
`map/data/core-{2022,2019,2016}.json`, pins each `VT_ERAS` entry against
the in-test `ERA_CFG` mirror, runs checkPool + four-listitem/`vt-band-post`
html assertions, and confirms 2013/2010 fabricated divs still render the
table when their year has no era. The 2026-11-10 party section:
`checkPoolParty(divs, label, eraBands, fi)` re-oracles the same contract on
`vtParty = "<fam>"` (family-count piles over same formal denominators, incl.
the typo-resistant `fams[k][fi]` pool and `n === v` band denominators),
across `[nationwide, NSW, TAS, rural, Bean]` for each of the five measures;
the Greens html block pins the toggle chrome (six labels, party row above
the measure row), the computed day skew AND its `t-grn` tone, and the skew
note's measure name; the tiny-no-vt3 pin locks "no figures without piles
(complete=false), never 0". TWO vm gotchas embedded here: (1) the
context must carry every cross-file constant the story file consults —
the 53e6bb3c `STATE_YEARS`/`STATES`/`CLS`/`FAMS`/`m.areas` stub cascade of
3b636e08, see auspol-map-vm-harness-stubs; (2) assert-era configs by
`JSON.stringify(...) === JSON.stringify(...)`, NOT `assert.deepStrictEqual`
— vm-context arrays carry the context's own prototypes, so
deepStrictEqual fails FALSE on identical structures (caught writing the
ERA_CFG pins). Button/label copy remains unpinned beyond ERA_CFG, so
phrasing edits there are free within an era set.

## Font contract (3b636e08)

On the Winner lens the whole `.vt-chart` section (labels, toggle, notes)
renders Commissioner with the rest of the winner story — see
auspol-map-story-lens-font for the `#story[data-lens="winner"]` hook.
Non-winner renderings (2025 view under another lens, other lenses' stories)
keep the page sans except the bands' own Commissioner figures.

## Verification recipe

`node .build/map/assemble.mjs` → `node .build/test-map-page.mjs` →
`node .build/test-map-vote-bands.mjs`, then `npm test` before pushing.
Headless probes (uncommitted; `.matilda/probe` is gitignored for new
files — modelled on the tracked `map-wa-frames.mjs`: serve repo,
`__map.setYear(y)`, `await __map.Y[y].ready`, read `#story`):
- `.matilda/probe/map-vt-eras.mjs` (a0b7aa59 session) — per-era row counts
  and `vt-time` strings on 2025/2022/2019/2016, chart-vs-table on
  2013/2010, formal totals (15,490,236 / 14,659,042 / 14,253,393 /
  13,541,101).
- `.matilda/probe/map-now-vt.mjs` (f4d52c49) — now≡2025 block text incl.
  Skew/Effect buttons and "15,490,236 formal", `.vt-tbl` absent, Farrer
  null contract, Commissioner font contract. (NOTE: its 2022-table rung
  pre-dates the eras ship; use map-vt-eras.mjs for era coverage.)
- `.matilda/probe/map-vt-parties.mjs` (2026-11-10, party-toggle ship) —
  the live toggle driven end to end: 2PP default + row order, Greens skew
  figures equal to vt3-pooled oracles (computed by the probe FROM the
  served core-2025.json, so the figures can't drift from what's under
  test), Effect's cumulative-primary effects in 2025 band order, back to
  the pinned 2PP national +2.7, and the NSW state pool following
  (goState/goAus). `BASE=<checkout>` serves a worktree.
Shared-checkout caution from the a0b7aa59 run: a sibling session shipped
page.css→map.css mid-session and their own assemble+commit captured THIS
session's still-uncommitted map.js hash into their `map/index.html` ?v
stamp. Before staging, diff the generated neighbours you didn't intend to
ship against HEAD — `git status` on your assembly outputs may show ZERO
diff only because a sibling already committed them with your content.

Related: `auspol-aec-vote-type-mix` (the AEC bucket-derivation analysis the
2025 figures were validated against), `auspol-map-now-frame` (overlay
machinery whose null-contract this lane relies on), `auspol-map-prevfp-lane`
(the sibling raw-booth lane), `auspol-aec-count-timing-statements` (the
source releases for every era's release-time labels, 2010–2025 — re-check
there before editing VT_ERAS copy).
