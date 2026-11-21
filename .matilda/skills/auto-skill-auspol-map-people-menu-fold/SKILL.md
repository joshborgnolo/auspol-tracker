---
name: auspol-map-people-menu-fold
description: "auspol-tracker /map/ — folding several People-menu census lanes into ONE menu entry with a second picker (the menu-fold pattern: Household income, Age, Education, Family composition — all 2026-11-11; Immigration folded same day as d068e12a). Worked end-to-end on the Family composition fold (u15/onepar/bigfam): the complete home enumeration across app-1-base/app-2b-draw/app-4-story/app-6-ui, the FAM_NAME const-collision trap (party families already own it — grep before naming your <X>_* consts; map/map.js only throws 'already been declared' at node --check), the URL legacy-alias idiom, and the era-gap clamps. PLUS the fold-with-SUB-LENS mechanics from the Immigration fold (lang/fborn/noncit/anc): folding lanes that carry their own sub-lenses — Ancestry (a select lens with its own peopleExtra entry and S.anc picker) and Born overseas (S.cob country sub-view) — by WIDENING isCob()/isAnc() to their block form instead of touching their inner machinery (the sub-pickers and copy chains keep working under the fold), gating a mode on ancKeys when it has no hasLane slot, keeping the sub-view clauses BEFORE isImm() in the chip/headNote chains, and sweeping the URL param id for collisions (im/iv already taken — imm rides mv). Durable pins live in test-map-page.mjs (a pin block per fold); memo-key obligations are in auspol-map-select-lens-invalidation."
source: auto-skill
extracted_at: '2026-11-11T11:45:00.000Z'
---

# /map/ People-menu fold: group several DM lanes behind one menu entry + picker

Setup: the Census measure menu's People list should group related measures
(under "Family composition": Children under 15, One-parent families, More
than two children — worked 2026-11-11). This is the fourth fold after
income/Age/Education; Education (LENS_EDU, shipped same day) is the
closest template. Copy its shape home-for-home. (The fifth fold,
Immigration d068e12a same day, folded lanes that carry their OWN
sub-lenses — see "Folding sub-lens members" after the contract for that
variant's extra homes.)

## The contract

- DM (the tuple-order list of demo keys) must NOT change — demo rows are
  positional (`DM.indexOf(k)` reads booth/division cells, so folded keys
  keep their own DM ids and data slots). Only the MENU folds: a synthetic
  lens id (LENS_FAM = "fam") joins the DM_MENU fold list, and the picked
  read rides a new S.<x>Mode state (S.famMode, landing on the first read).
- Each folded read keeps its own DM_* dict entries (name/short/verb/range),
  range cap, ramp and DM_TOP story phrases. The fold only changes menu /
  picker / URL shapes — no data or palette work.
 adjust copy per lens via <X>_MODES/NAME/SHORT/NOTE consts beside the fold
  block (edu: EDU_MODES at app-1-base.js; fam: FAMC_*).

## EVERY home, in file order (verify current text before relying — lines drift)

`.build/map/app/app-1-base.js`
1. `const LENS_<X> = "<id>"` beside LENS_INC/AGE/EDU (right after DM).
2. DM_MENU IIFE: on the fold's landing key `if (k === "<landing>") {
   ks.push(LENS_<X>); continue; }` and add the OTHER folded keys to the
   exclusion list (they never appear as standalone menu entries).
3. DM_NAME / DM_SHORT: add the lens-id labels ("Family composition" /
   "Family").
4. `isDemo()` list gains `S.index === LENS_<X>`.
5. Consts block beside EDU_MODES: `<X>MODE_MODES`, `<X>_NAME`,
   `<X>_SHORT`, `<X>_NOTE` + `const is<X> = () => S.index === LENS_<X>;`
   — **NAME COLLISION TRAP**: FAM_NAME was already the party-family dict
   (app-1-base.js ~:186) long before; a redeclared const only bombs at
   `node --check map/map.js` AFTER assembly ("already been declared").
   Grep the prefix across ALL app files before choosing it (FAMC_* was
   the collision-free pick).
6. dmVerb: add `k === LENS_<X> ? DM_VERB[S.<x>Mode]` before the DM_VERB[k]
   fallback.
7. censusWho: the else-branch's key remap
   `k === LENS_EDU ? S.eduMode : k` → chain your
   `k === LENS_<X> ? S.<x>Mode` in (pop/pred key off the unfolded read;
   dmVerb handles the lens id itself via home 6).
8. demoShare / demoAreaShare: `if (is<X>()) return d.demo ?
   d.demo[S.<x>Mode] : null;` (same for booth: `r[DM.indexOf(S.<x>Mode)]`
   — positional, safe since DM is untouched).
9. demoRange: `is<X>() ? DM_RANGE[S.<x>Mode]`; demoRamp: `is<X>() ?
   S.<x>Mode`.
10. State S: `<x>Mode: "<landing>"` with an EDU-style comment.
11. hasLane build: `m.hasLane[LENS_<X>] = m.hasLane.<landingKey>;` — the
    menu entry is gated on the landing read existing on the frame.

`.build/map/app/app-2b-draw.js`
12. readingKey(m): add `S.<x>Mode` after S.eduMode (memo — see
    auspol-map-select-lens-invalidation for the whole key-audit class).
13. areasLane(): `if (is<X>()) return S.<x>Mode;` (AREAS_LANES already
    contains the unfolded demo keys).

`.build/map/app/app-4-story.js`
14. The area-ranking phrase chain gains `is<X>() ? DM_TOP[S.<x>Mode]` before
    DM_TOP[k].

`.build/map/app/app-6-ui.js`
15. Chip label (~:12): `is<X>() ? \`<Lname>: ${<X>_SHORT[S.<x>Mode]}\``
    before isCob()'s fborn branch.
16. legendState(): add S.<x>Mode beside S.eduMode.
17. applyOpt(): `else if (k === "<x>v") S.<x>Mode = v;`
18. censusSelects(): the picker block, mirroring eduv:
    ```
    { const <x>Opts = <X>_MODES.filter((k) => !m.hasLane ||
      m.hasLane[k] !== false);
      if (S.index === LENS_<X> && <x>Opts.length > 1)
        out.push(lgMenu("<x>v", <x>Opts.map((k) => [k, <X>_NAME[k]]),
        S.<x>Mode, "<Lname> view")); }
    ```
    (opts.length>1 keeps the picker off single-read frames).
19. headNote chain: `: is<X>() ? <X>_NOTE[S.<x>Mode]` after isEdu's branch.
20. Vintage-hop clamps (the setYear function ~:1146 AND the boot bmc
    function ~:1880 — BOTH): extend the lane-missing fallback to include
    `S.index === LENS_<X>`, and add a mode clamp
    `S.<x>Mode = <X>_MODES.find((k) => b.hasLane[k] !== false) || "<landing>"`.
21. writeURL(): `if (is<X>() && S.<x>Mode !== "<landing>") p.set("<param>",
    S.<x>Mode);` (only off-landing rides the hash; fam uses `fv`).
22. readURL(): legacy-id aliasing — BEFORE the generic DM whitelist, add
    `else if (<X>_MODES.includes(i)) { S.index = LENS_<X>; S.<x>Mode = i; }`
    so old hashes (i=u15 / i=onepar / i=bigfam) land on the new lens with
    their read picked; add LENS_<X> to the whitelist itself; and resolve
    `S.<x>Mode = <X>_MODES.includes(<param>) ? <param> :
    <X>_MODES.includes(i) ? i : "<landing>"`.

## Folding sub-lens members (the Immigration fold, d068e12a)

When a folded member is itself a select lens (Ancestry/Religion-style, with
its own `peopleExtra` menu entry) or carries a sub-view (Born overseas'
S.cob country picker), the fold FLATTENS the menu but keeps the sub-lens
machinery intact. Landing read is the member that keeps every copy chain
self-serving (Immigration lands on `lang` because its fallback note flows
straight from censusWho, no bespoke NOTE needed; pick the compute-free one).

Extra homes on top of the list above (Immigration, the worked d068e12a):

- `isCob()` / `isAnc()` (and friends in app-1-base.js) widen to their block
  form so the sub-view fires under the fold:
  `const isCob = () => (S.index === "fborn" || S.index === LENS_IMM && S.immMode === "fborn") && S.cob != null;`
  — every downstream consumer (demoShare chains, demoRange/demoRamp,
  areasLane, writeURL's `cb=`/`an=`, the story DM_TOP chain's COB_TOP/
  ANC_TOP) then works under the fold with NO further edits.
- `peopleExtra` in censusSelects LOSES the folded select lens's entry
  (`...[m.ancKeys && m.ancKeys.length ? [[LENS_ANC, "Ancestry"]] : []...`
  deleted); its picker line's condition widens the same way:
  `(S.index === LENS_ANC || S.index === LENS_IMM && S.immMode === "anc") && m.ancKeys...`
  (and the cob second-picker line the same for `immMode === "fborn"`). A
  `dmVerb` per-mode clause answers its sub-views:
  `k === LENS_IMM ? (S.immMode === "anc" ? ANCISMS[S.anc] : S.immMode === "fborn" && S.cob != null ? COB_VERB[S.cob] : DM_VERB[S.immMode])`.
- A mode gated on something OTHER than hasLane[mode] (ancestry rides
  m.ancKeys, not a DM slot) needs the key-list clause in THREE places, not
  hasLane's one: the picker filter
  `IMM_MODES.filter((k) => k === "anc" ? !!(m.ancKeys && m.ancKeys.length) : <hasLane test>)`,
  and the two clamps (setYear's AND boot's — touch BOTH) as
  `(S.immMode === "anc" && !b.ancKeys) || (... hasLane[S.immMode] === false)`,
  with the find-fallback sharing the same k === "anc" branch.
- CHAIN PLACEMENT TRAPS: insert `isImm()` AFTER `isCob()` and `isAnc()` in
  every lookup chain so the sub-view wins (chip: cob stays "Born in IND",
  anc stays "Chinese ancestry"; headNote keeps its bespoke ancestry
  parenthetical; demoShare/range/ramp fall through to the cob clause first).
  Insert AFTER the last sub-lens clause but BEFORE the plain-lane fallbacks.
  Imm's own headNote clause reuses the folded lanes' existing copy:
  `isImm() ? NOTE_ARC[S.immMode] || \`Share of ${censusWho(m).phrase}\`` —
  don't build a bespoke IMM_NOTE dict when the working lanes already have
  bespoke notes to inherit (NOTE_ARC.noncit) or the censusWho default.
- URL param collision: grep `p.get("<two-letters>")` BEFORE choosing the
  view param — `im` is the informal lens's view ("exhaust"), `iv` is
  income's, `in` is industry's. Immigration uses `mv`. readURL aliases the
  old standalone lens id TOO (`else if (IMM_MODES.includes(i) || i ===
  LENS_ANC) { S.index = LENS_IMM; S.immMode = ...}`) so `i=anc&an=chinese`
  → lens+mode while `an=` keeps its own home; `S.index = "lang"`/legacy
  plain members ride the same alias so the read lands on the lens, never a
  naked DM index (the year-hop missing-lane clamp's `S.index = "lang"`
  destination must become `{ S.index = LENS_IMM; S.immMode = "lang"; }`).
- Probe shape (`.matilda/imm-lens-probe.mjs`, copy it): beyond the fam
  checks, assert the MEASURE menu itself folded — `#lgmenu-index` labels
  include the lens name but NOT any of the folded members' names — and
  boot a hash carrying the OLD lens id with its sub-view param
  (`#i=anc&an=chinese`) to prove legacy aliasing. Era-gap frame for the
  ancestry clamp: `#y=1996` (no ancKeys in the 1990s prints — the option
  must drop and `mv=anc` must clamp away).
- Tests: the map-page pin block pins all of the above verbatim (imm block
  after the famc block in test-map-page.mjs); censusWho's VM ctx in
  test-map-chart.mjs gains immMode/LENS_IMM (and any LENS_* you see chain'd
  through dmVerb — LENS_IND lives there too as of this run).

## Tests (durable pins — REQUIRED, mirror the edu block)

- `.build/test-map-page.mjs`: one assert block per fold, mirroring the
  Education block verbatim (menu fold line, name tables, landing read,
  demo key + cell, range/ramp, hasLane gate, picker wiring, URL alias in,
  hash out, legend/memo keys, chip, note, both clamps, DM_TOP). It also
  pins the name-collision trap (`!base.includes('const FAM_NAME = { u15:')`).
- `.build/test-map-chart.mjs` censusWho VM-eval block: extend the ctx
  stub with famMode + LENS_<X> (per auspol-map-vm-harness-stubs) and add
  `set({ index: "<x>", <x>Mode: ... })` assertions per read
  ("families that are one-parent families" etc.).
- Watch out: dmVerb's ternary chain references ~ten LENS_* ids — a VM
  ctx missing ANY of them (LENS_IND/INDISMS included, both arrived
  2026-11-11) throws ReferenceError for EVERY call, not only that lens's.

## Verify

1. `node .build/map/assemble.mjs && node --check map/map.js` — the syntax
   check is what catches a duplicate-const collision (it did for FAM_NAME).
2. Headless probe (copy `.matilda/fam-lens-probe.mjs`, port 8983/8984):
   direct `#y=2025&l=seifa&i=<x>` boot lands the lens; the `#lgmenu-<x>v`
   menu lists exactly the folded reads; clicking a
   `[data-lg-val="<x>v:<read>"]` option moves the legend note, S.<x>Mode
   and the hash; a legacy lane hash aliases in; a `draw=chart` swap
   repaints `.ch-plot`/`.ch-hed`; and an era-gap frame (fam: `y=2004`,
   whose census print lacks bigfam) renders opts.length one shorter and
   clamps `fv=bigfam` away at boot. All passed 2026-11-11.
3. No new area-pile or palette work: AREAS_LANES data slots unchanged.

## Sibling-WIP note from this run

test-map-page.mjs aborts mid-file on the sibling's res→core/data restructure
(vote-piles block ~:138), BEFORE the fold pins — verify structurally (a
node --input-type=module assertion pass over part() reads) + the browser
probe, and re-run npm test when the reshape settles.

## The land side of this feature (the partial-sweep live outage)

A sibling wholesale-staged app-1-base mid-feature and origin got a torn
fold (base rename landed, app-6-ui's eight references stale, no re-assemble
— live /map/ died on duplicate `FAM_NAME`); the remediation land
(`6d01d13e`, 2026-11-11: eight app-6-ui renames, the durable pins above,
bundle regen, one rebase past a same-minute sibling land) is documented in
auspol-branch-merge-land-race's "Partial sweep + source-only hotfix"
section. Cross-file renames OF the fold's consts are only landed when every
consumer file and the regenerated bundle carry the new names together.

## Second land note (Immigration, d068e12a, same day)

Landed from a pristine detached worktree at fresh origin/main (the main
checkout was carrying sibling water-toggle / FAMC dirt): the three app
files whose main-tree diffs grep'd pure of foreign tokens were transferred
as diffs (`git diff HEAD -- <PURE-FILES> | git -C <worktree> apply`), the
mixed UI/tests files re-edited over origin content (FAM→FAMC hunks were
already-on-origin). All 18 test-map-* suites green on the land candidate
(the main checkout's vote-piles/test aborts came from its in-flight data,
not origin), full npm test red only on test-redbridge-direction
("no direction section") — classified not-ours by `git log -1 --name-only
HEAD` + the invariant `git diff HEAD~1..HEAD --stat -- <the red lane>`;
a sibling owns its repair. Probe: `.matilda/imm-lens-probe.mjs` all green.
