---
name: auspol-map-scope-menu
description: auspol-tracker — the /map/ Winner head's scope dropdown (menu ITEMS name picks plainly on every frame — "National", "NSW", "Inner metro"; TRIGGER words by axis state: "Filter by state/territory" unsliced, "Filter by seat type" on a sliced state, then the PICK'S OWN NAME once a type compounds — "Inner metro" replaced "Change filter", 6d83ccfc 2026-11-08; 22d08dc7 made the sliced menu offer the OTHER axis — the seat types — instead of states again; a state pick and the map's state selection are ONE slice rendering ONE design, sliceState/select-sync, 2cdd03c8). statScopeLabel is the ONE item-wording home (statScopeOpts/statScopeMenu/statScopeTrigger consume it), pick persistence is statScopeStore/statScopeOk/statScopeOf, a cls store never filters invisibly (dormant off its lens/unsliced — statScopeOf substitutes "aus" there directly; setLens evicts it; "All seats" ejects both axes), and any wording/item edit must move TWO pin layers in the same commit (test-map-page.mjs source-shape pins ~:2515+ + probe-scope.mjs rendered expectations — trigger words via labelIs, slice/type state via selLevel/pressed items, pick() helper branching cls: vs st: scopes since st: picks leave the menu they came from) or the gate fails. ALSO covers its first reported reversal (3b636e08 stale-file land) with the recovery recipe, the non-winner Jump-to nesting bug, and the 2026-11-08 sibling commit flush (Base-picker lg-bmenu menu idiom 9fe55933, Draw/Base renames, cls-lens chips beside the dropdown, search field seed inside #legend 9b35a901+8ce4d9b8).
source: auto-skill
extracted_at: '2026-11-07T01:05:49.541Z'
---

# /map/ — the Winner head's scope menu (wording + editing mechanics)

User dictate (2026-11-07, landed 8dab8ffe): on election frames the head meta's
dropdown read "Nationwide figures" — it should read the jurisdiction's own name
("National", "NSW", …); on the **now views keep the existing language**. The menu
offers the frame's own jurisdiction (value `aus`), per-state scopes (`st:<ST>`)
and seat-type scopes (`cls:<key>`); picking one recomposes the head's figures,
seat share and make-up bar.

## LATER EVENTS (evening 2026-11-07 — BOTH supersede parts of the notes below)

1. **Plain wording everywhere (4d4246b3).** The "… figures" compounds DIED by
   user call — every frame, now frames included: "National", "NSW",
   "Victoria", "Inner metro". No suffix, no hyphens. `statScopeLabel` lost its
   `fig` const and the whole `FIG_DEMONYM` map (treat all wording notes below
   mentioning figures/demonyms as HISTORY — the current fn is the plain
   one). test-map-page pins assert `return "National";` and `!st.includes("FIG_DEMONYM")`.
2. **THE SLICE UNIFICATION (2cdd03c8).** A state named in the menu and a state
   selected on the map are now ONE pick rendering ONE design — the whole-frame
   layout, with three marks from the old map design: the head titles itself in
   the state's name ("New South Wales"), "All seats" sits above it, and the
   state is selected on the map. Machinery:
   - `sliceState(m)` (app-4-story.js, beside statScopeOk): the slice is read
     FROM the map's state selection when `S.lens === "winner"` on a federal
     frame. `statScopeOf` is slice-first, store-second.
   - `select()` (app-6-ui.js) writes the store on every winner-lens federal
     select: state → `{k:"st", st}`; aus → `{k:"aus"}` ("All seats"/goAus
     clears the pick — that is a BEHAVIOUR CHANGE: goAus was navigation-only
     before; probe-scope.mjs's year() helper had to drop its goAus for it).
   - `setStatScope()` routes an expressible `st:` pick through
     `select({level:"state"},{fly:false})` (no camera move from a menu
     click); `cls:`/aus picks step a live state selection out first.
   - Reconciles: year-load (setYear) re-stamps the store from a kept
     selection and re-selects from a kept store on expressible frames;
     setLens("winner") re-selects too.
   - `renderStory` routes a slice to `storyArea(m, "AUS")`; storyArea computes
     `slice` only to override the title. `upLink` needed NO change (the
     selection already words "All seats"). The story mini-chamber passes
     `state: … && !sliceState(m) ? … : null` (whole-frame chamber under a
     slice); the big chamber view keeps its state dimming.
   - Pins: test-map-page.mjs's scope block pins sliceState/the route/the
     marks; probe-scope.mjs pins the sel/title/upLink behaviour.
3. **THE TRIGGER NAMES ITS JOB (user call, same evening).** The trigger no
   longer shows the pick: `statScopeTrigger(sel)` (`sel.k === "aus" ?
   "Filter seats" : "Change filter"`, beside statScopeLabel) feeds
   statScopeMenu's trigger; the MENU ITEMS keep statScopeLabel's plain names
   ("National", "NSW", "Inner metro"). probe-scope.mjs's persistence asserts
   now read the PRESSED ITEM (pressedItem/pressedIs), not the trigger;
   labelIs only ever expects the two job wordings.
4. **Jump-to row's nested home fixed (same evening, user-reported live
   bug).** Non-winner lenses reparent `#cities` into `.lg-left`
   (legendHTML's lg-left block), and d1c46200's `.mp-legend > .lg-jump`
   rule only matched the direct-child (Winner) arrangement → every city
   stacked on its own line on tpp/fp/etc. Now: `.mp-legend .lg-jump { display:
   flex; … }` (layout wherever it sits) with `.mp-legend > .lg-jump { grid-
   column: 1 / -1; }` for the full-width span. Pinned in test-map-page.mjs.
5. **A filtered head TITLES ITSELF BY THE FILTER (668f8b7a).**
   storyArea derives `pick = statScopeOf(m)`; `pickTitle` = STATE_TITLE[st]
   or CLS_SHORT[cls]; election frames append ` · ${m.year}` ("New South
   Wales · 2025", "Inner metro · 2025"), now frames stay bare ("New South
   Wales", "Inner metro"). State-election frames (STATE_YEARS) exempt — the
   frame's jurisdiction title stands. The old `slice`-only title is gone.
6. **A seat-type filter has its own "All seats" (668f8b7a).** upLink's
   `clsScoped` read (aus-sel + winner + federal + scope cls) renders the
   same `data-go="aus"` link a state slice gets — going out clears the
   store through select's sync, no special handler needed.
7. **NOW VIEWS CARRY THE BASE ELECTION'S SWINGS (5ddbe13e).** The
   "not a change since" suppression is out on all three gates: seatStat's
   2PP swing (`const s = A.tppSw;`), statPrimaryGrid's smalls
   (`showChange = A.fpSw.alp != null;`), statBreakdown's cycle swing. The
   seats row keeps its own today-chain deltas. test-map-primary-breakdowns'
   now-grid check flipped to expecting smalls; probe-scope pins the
   rendered chip + smalls presence.
8. **THE CHAMBERS MARK THE FILTER (a71cdacb).** drawChamber gained
   `opts.cls` mirroring `opts.state`: filtered seats dim to 0.2 alpha, and
   with a cls pick each chair also paints the seat-type lens's OWN ladder
   (`TH.cls[CLS.indexOf(d.cls)]`, clsTone`) — "seats in type colours, own
   kind sat back" like the cls view of the map. Call sites: drawChamberMain
   (`cls: sen ? null : clsFilter(m)` — never the Senate) and the story
   `#minich` (`state:` is straight `S.sel.state` again — my slice-gate was
   user-reversed; `cls: clsFilter(m)`). `clsFilter(m)` lives beside
   statScopeOf (winner + non-state-frame gate). The chamber section's
   small names the mark (`STATE_POSS[st] members lit` / `X seats lit`).
9. **SCOPED SEAT CHANGE LINES ON ELECTION FRAMES (a71cdacb).** The
   "aus-only bases" rule is dead: `seatStat` reads state picks from
   `seatBase(m, statSel.st)` (summary.json's official per-state series —
   smalls sum to redistribution drift like the aus row's; NSW 2025 sums
   −1 for its lost seat), and `scopeSeatBase`'s election branch reverts
   each scoped seat via `d.change.prev` ("of these seats" — new seats
   read as gains, abolished ones never sat in the class; sums net zero).
   Now-frame chains untouched (probe-scope pins cls-2025 smalls sum 0).
10. **THE CLS LENS SHARES THE WINNER DESIGN + PICKER-LENS IDIOM (c5345bb3).**
    areaHedDek switches on `S.lens === "cls" ? "winner" : S.lens` (the class-
    tally story is retired); every figures-design gate rides `pickerLens()`
    (= winner || cls), defined in app-4-story.js BESIDE ITS CONSUMERS — not
    app-2-map — because the vote-bands/primary VM harnesses eval the story
    part alone (a ReferenceError there is the auspol-map-vm-harness-stubs
    trap). The cls lens's menu lists seat types only (`S.lens !== "cls" &&
    !STATE_YEARS…` opts gate) and its trigger invites "Filter by seat type"
    (Winner's own default is the two-axis "Filter by state/territory and seat
    type"); select()'s scope sync writes st: only on winner but clears on
    both. sliceState stays winner-only; year-load/lens reconciles too.
11. **LIT-KIND CONTRAST + HYPHENATED MARKS (c5345bb3).** The seat-type
    ladder rungs are too close to read by alpha (the user's "unnoticeable"
    complaint): clsSel-mismatched chairs now ghost to `th.ink` at 0.28
    (`offType ? th.ink` in drawChamber) — only the picked kind wears its
    ladder tone. The chamber section's small hyphenates type compounds as a
    modifier (`${pickTitle.replace(" ", "-")} seats lit` — "Inner-metro seats
    lit"). Verification idiom: bucket canvas pixels by ±18 of each legend-chip
    tone; the pick's tone should own ≥85%.
12. **STATE × TYPE COMPOUND (92505712) → LENS-SPLIT UX (66087c14).** The
    axes are orthogonal AND lens-homed now: the DROPDOWN names states and
    territories alone on both lenses ("Filter by state/territory" /
    "Change filter" everywhere it sits, no cls items ever); the seat types
    are their own chip row (`lg-types.st-typefilters` via the wording
    factory) on the cls lens, stacked BELOW the dropdown inside
    `.st-clsmeta`. `poolParts`: st axis — the sliced state (any picker
    lens); cls axis — the chip store's cls (cls lens ONLY; store evicts on
    other lenses). Compound forms wherever the state stands. `clsLensShelved`
    in app-6-ui: the cls lens shelves through a state frame and returns
    itself + the chip store on a federal frame (explicit lens picks drop
    the shelf); every other fed-only lens still drops to winner as before.
13. **SIBLING ADJACENCIES (f2d5ae47, 9ec9d48c, same day).** The basis
    strip and basis controls got rebuilt: legendHist (the little seats
    histogram) is RETIRED everywhere — test-map-areas.mjs's old
    `!arOn`-guarded pin was left red by the sibling's land and had to move
    to "arCap present, legendHist gone" (un-Green CI since tests is
    unwatched); the cls lens's figures-menu presentation became a chip
    toggle row (`lg-types.st-typefilters`, data-scope toggle aus) —
    statScopeMenu branches cls → chips, winner → dropdown, both store the
    same pick; compound's chip marking reads via statScopeMenuCur.
14. **MENU-AS-OPEN-AXIS: THE SLICED STATE'S MENU IS THE TYPES (22d08dc7 →
    6d83ccfc).** User-directed across two same-day pushes: item 12's
    "dropdown names states alone everywhere" rule is dead in the sliced
    case. `statScopeOpts` checks `sliceState(m)` FIRST — a sliced state's
    menu lists the CLS filter types (the other axis is taken: another state
    gets picked on the Filter strip instead); only unsliced does it list
    aus+states. `statScopeTrigger`: `"Filter by state/territory"` unsliced,
    `"Filter by seat type"` sliced-nothing-picked, and THE PICK'S OWN NAME
    (`statScopeLabel`) once a type compounds — the "Change filter" wording
    is gone entirely. `poolParts.cls`'s gate widened from `S.lens === "cls"`
    to `(S.lens === "cls" || st)` so the winner lens's head compounds too
    (figures = state∩type via the pre-existing statScopeArea stPool path),
    with the dormancy guard held by BOTH `poolParts.cls` AND `statScopeOf`
    (a cls store off-lens/unsliced substitutes `{k:"aus"}` — a pick must
    never filter where nothing marks it; it wakes back on a slice, and is
    properly evicted only by All-seats or leaving the cls lens). Compound
    picks do NOT ride home from a state-frame detour: overwriting the store
    from st: to cls: on the type pick drops the ride-home record (probe
    expects aus after a vic22 detour). The cls lens mirrors this beside its
    chips row. probe-scope.mjs was REWRITTEN to the new contract (its
    `pick()` helper awaits SELECTION for st: scopes — a state pick removes
    its own item from the menu — and await pressed item for cls: scopes;
    sliced-state persistence reads selLevel, never menu items). The
    test-map-page pin at ~:2525 pins the statScopeTrigger return branches,
    the `if (sliceState(m)) return CLS.filter…` menu branch, and the
    `(S.lens === "cls" || st)` + dormancy source strings; test-map-vote-
    bands.mjs's cls-scope loop sets `S.lens = "cls"` (and resets) because
    its VM-harness mutation of `statScopeOf`'s RETURNED object only lands
    where statScopeOf returns the real store, not the substituted literal.
15. **SEARCH FIELD SEEDED INSIDE #legend (9b35a901, repaired same-day by
    8ce4d9b8).** map/index.html's `.mp-search` block seeds inside the empty
    `<div id="legend" hidden>` so the pre-boot DOM matches the runtime one
    (renderLegend's lg-toolbar adoption keeps the live field across every
    legend rebuild — its `el.querySelector(".mp-search")` had seen null
    forever). The sibling's land itself broke its own new pin (test-map-
    page.mjs :2583 area, `id="q"` after `id="legend"`) — its commit message
    claimed a green battery it never ran; origin/main sat RED on
    test-map-page until the seed move actually landed. When a later commit
    claims "npm-test battery green", spot-run the pin test before trusting
    it, especially during a commit flush.
16. **POLLING-PLACES KEY IS THE PANEL'S TAIL (c0f3015c, user call).** The
    lg-shapes row ("Polling place / Early voting / Size: votes") lives LAST
    in map-view legendHTML — after drawNote and #hint (never mid-strip). Its
    own gating is the cutline: emitted only when the picture carries polling
    places (`boothsOn && drawOf(m) !== "balloons" && (drawOf(m) === "seats"
    || selDiv() != null || T.k >= K_ALL)`; balloons drop it, as do no booths
    at current zoom. `boothsShown()` feeds legendState(), so the legend's
    zoom listener re-renders the key live at the K_ALL crossing, no extra
    hook needed. Its pin in test-map-page.mjs asserts emission position
    after `id="hint"`. (Renders before-lens-assembled at first, only the
    assembled bundle was stale between re-assembles in my early probes —
    purportedly-built state misled them; re-assemble before every read.)

## Wording contract (as of 8dab8ffe — SUPERSEDED, see above)

- **Election frames** (named years — 2025, 2022, vic22, nsw23, …): plain names.
  Federal default **"National"**; state frame default the full `STATE_TITLE`
  ("New South Wales"). Per-state items print `NSW`/`ACT` short, everything else
  `STATE_TITLE[s]` ("Victoria", "Tasmania"). Seat types print `CLS_SHORT` plain
  ("Inner metro", "Outer metro", "Provincial", "Rural").
- **Now frames** (`now`, `nswnow`, `qldnow`, `wanow` — `isNowY`): keep the
  "… figures" compounds, but the name words itself by demonym where one
  fits (user call, later on 2026-11-07): "National figures" (the federal
  default — was "Nationwide figures"), "Victorian figures", "South
  Australian figures", "Western Australian figures", "Tasmanian figures";
  bare where none fits ("NSW figures", "Queensland figures", "Northern
  Territory figures"); a seat type hyphenates while compounding
  ("Inner-metro figures").
- The gate is one const in `statScopeLabel` plus a module-level demonym
  map: `const fig = isNowY(m.year) ? " figures" : "";` and
  `const FIG_DEMONYM = { VIC: "Victorian", SA: "South Australian", WA: "Western Australian", TAS: "Tasmanian" };`
  with `figName(s) = (fig && FIG_DEMONYM[s]) || STATE_TITLE[s]` resolving the
  name in both name-bearing branches.

## Homes — all in .build/map/app/app-4-story.js

- `statScopeLabel(m, sel)` — the ONLY wording logic. Never build a scope label
  anywhere else.
- `statScopeOpts(m, st)` — `[value, label]` menu list (order: `aus`, then
  states with `m.areas[s].formal > 0` — federal frames only —, then classes
  from `statBreakdownRows`). Every label is `statScopeLabel(m, {...})` since
  8dab8ffe, so items can't drift from the trigger. app-6-ui.js's spacebar
  cycle walks `o[0]`s (values only) — display text rides free.
- `statScopeMenu(m, st)` — renders `.st-scwrap` trigger
  (`data-scope-trigger`, shows the current pick's label) + hidden `.st-scm`
  menu (buttons `data-scope=<val>`, `aria-pressed` on current). Meta owner is
  storyArea's `meta = S.lens === "winner" && aus ? statScopeMenu(m, st) …`.
- Persistence (53e6bb3c, same day): `statScopeStore` = ONE pick shared across
  frames; `statScopeOk(m, s)` gates expressibility per frame (st: non-state
  frame with area data; cls: must exist among the frame's classes);
  `statScopeOf(m)` falls back to `{k:"aus", open}` where it can't. A picked
  scope thus survives Now→2025→2022 and briefly falls back on state frames —
  and its LABEL re-words per frame as it travels ("NSW figures" on Now →
  "NSW" on 2025).
- Click chain: app-6-ui.js `[data-scope-trigger]`/`[data-scope]` handlers +
  `setStatScope` (writes `statScopeStore = sel`). CSS: page.css `.st-scwrap`,
  `.st-sclab`, `.st-scm`.

## Gate — two pin layers must move WITH any wording/item edit

1. `node .build/map/assemble.mjs` — rebuilds map.js, re-stamps map/index.html
   (both generated; never conflict-merge them by hand).
2. `node .build/test-map-page.mjs` — its scope-menu block (~:2507) pins
   SOURCE SHAPE strings (`let statScopeStore = { k: "aus" };`, the
   `const fig = isNowY…` gate line, the statScopeLabel call shape). Update
   those strings in the same commit — the probe-drift convention: the pin
   moves with the deliberate change (auspol-probe-drift-repair).
3. `.build/map/probe-scope.mjs` — MANUAL puppeteer probe (serve repo root,
   `MAP_URL=http://127.0.0.1:8765 node .build/map/probe-scope.mjs`) asserting
   RENDERED trigger labels across year switches (Now/2025/2022/vic22). Its
   `labelIs` expectations must track wording edits too; if you can't launch
   Chrome, still update it and `node --check .build/map/probe-scope.mjs`.

## Gotchas shown 2026-11-07

- Before the fix the label string existed in THREE places (label fn, opts fn,
  comments quoting it) — the comments now word the behaviour generically
  ("statScopeLabel words it") instead of quoting a literal menu label.
- Commit as one unit: app-4-story.js + test-map-page.mjs pin block +
  probe-scope.mjs + map/map.js + map/index.html.
- Sibling-demo 53e6bb3c landed its OWN pins of this menu (store asserts +
  probe-scope.mjs authored against the OLD wording) within hours of the land
  — check what the newest origin commit pinned before writing your pin.

## Stale-file reversal — the 3b636e08 incident + recovery (2026-11-07)

User report "something reversed this change" — triage that found more:

- **The commit that undid it**: `git log --oneline -- .build/map/app/app-4-story.js`,
  then `git show <each-later-commit> -- <file> | grep -A<fn>`. 3b636e08 (the
  Commissioner story-font commit) rode a working-tree file predating BOTH
  8dab8ffe (this wording) and 26accd86 (the head's `.st-sep` double-rule
  separators + names-row formed-govt tag + `.st-fg` grid CSS), silently
  reverting all three while its own features stayed intact. Blind `git revert
  3b636e08` would have been WRONG — it carried real work (Commissioner,
  vt-mode "Skew/Effect" keys, `#story` data-lens). Re-apply only the lost
  hunks from `git show 8dab8ffe/26accd86 -- <file>` by hand.
- **Its map/map.js was torn**: HEAD's SOURCE had a feature (the Primaries
  eyebrow's combined-share label) that HEAD's committed `map/map.js` lacked —
  3b636e08 assembled its generated files from an even older tree. Detect by
  `git grep <feature-string> HEAD -- <source> <generated>` and rebuilding
  (`node .build/map/assemble.mjs`) heals them.
- **The suite stayed green because the pins had been reverted too** —
  UNCOMMITTED working-tree edits (leftovers of the same stale session) had
  turned the test-map-page.mjs pin strings and probe-scope.mjs labelIs
  expectations back to the OLD wording. "User reports the regression but the
  gate passes" → `git diff` the PIN FILES themselves first; likewise dirty
  reversals of `.matilda/probe/map-formed-govt.mjs` + `map-head-separators.mjs`
  hid 26accd86's losses. Restore by `git checkout HEAD -- <pin files>` ONLY
  after verifying the dirty diff is exactly the reversal (count the hunks).
- **Recovery chain used**: hand-restore source hunks → checkout the pin files
  from HEAD → assemble → `node .build/test-map-page.mjs` +
  `test-map-vote-bands.mjs` → serve + `MAP_URL=… probe-scope.mjs` (rendered
  wording across Now/2025/2022/vic22).
- **A sibling was repairing the same commit in parallel**: it landed the
  separators/tag half as 370e5cf1 (Primaries eyebrow label re-shipped
  properly as 343b8824) while this session restored the wording — the file
  gained 3 lines under an active edit. In this shared checkout, re-verify
  HEAD (`git log -3`, `git diff <fix> HEAD -- <file>`) before committing your
  half of someone else's accident.
