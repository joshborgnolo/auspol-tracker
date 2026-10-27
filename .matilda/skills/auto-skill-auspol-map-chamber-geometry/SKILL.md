---
name: auspol-map-chamber-geometry
description: "auspol-tracker — the /map/ chamber renderer's TWO geometry idioms and the worked nsw23 chamber redesign (2026-10-27, user-directed across THREE same-day lands: Sydney's Assembly is Victoria's sister — horseshoe about ONE rectangular central table, no Hansard desk/pair, two clerks alone chair at its head; then the floor rebuilt pedantically — NOTHING level with the dais, two straight files of 12+12 per side starting at the table's shoulders, three curved rows of 6/9/6 per side, 92 desks for the floor's 92 seated members exactly; then the plan-fidelity pass febaa202 — NSWB.row2Y0 staggers the outer straight file one pitch speaker-side so its head is LEVEL with the leaders' desks and the inner file protrudes one seat at the rear, sectors[2] [7,83,6]→[33,83,6] so the outer curve's side-most |x| EQUALS the middle row's (170.5 v 169.7, was 208), and ONE landscape officials' box per side under geom.nsw where the House/vic keep three portrait boxes). app-3-chamber.js holds the federal/arc idiom as THREE compact-object ledgers (CHB 151 federal, VCHB 88 vic22, NSWB 92 nsw23) plus the shared geomFor builder (walkways/gangway/SPEAKER_at/lead-bunkering) and per-house furniture branches in drawChamberFurniture (vic22: Hansard pair @ TableW + no mace; nsw23: ONE rectangle table + mace + 2 clerks + NO officers/grooves/Hansard/tier-boxes, a second straight bench across B.row2X, the Serjeant Rsj0 centred (0,242) behind the back row — the parliament's own 'chair separating the benches', per its chamber history + the 2023 plan's Deputy-Serjeant legend item). app-3c-sa.js keeps the rect-floor SAF ledger idiom (ha/lc seated, nswLC fill-the-benches; SAF.nswLA was DELETED same day — the NSW Assembly never touches saFloorOf again). chamberGeom dispatch order is vic-arc ← nsw-arc ← SA-rect ← senate ← House. Test-rooted geometry via @<name>-cells-begin/end markers eval'd by test-map-page.mjs's new Function blocks (sa-cells off app-3c-sa.js, vic-cells AND nsw-cells off app-3-chamber.js) — the blocks also eval standalone via new Function from a one-off node -e when the suite itself is red on foreign WIP; probes pin paint-level contracts (96 nsw chair clusters = 92 members + Speaker + 2 clerks + Serjeant; ZERO outlined-empty desks; 4-vertex rectangle vs the federal T's 8) with the canvas-primitive hook recipe (see auspol-headless-geometry-verify's canvas section). Cross-jurisdiction guard: the NSW Assembly's geometry is NOT a source for seating/census extrapolation (three note homes: .build/map/sa_seating.mjs header, .build/map/vics/README.md, app-3c-sa.js SA_GEOM comment)."
source: auto-skill
extracted_at: '2026-10-27T08:00:00.000Z'
---

# /map/ chamber geometry — two idioms, one dispatch, worked nsw23 redesign

The /map/ page draws a parliament house per frame in `.build/map/app/app-3-chamber.js`
(the House idiom) and `.build/map/app/app-3c-sa.js` (the Adelaide rect-floor idiom),
assembled into `map/map.js` by `node .build/map/assemble.mjs` (see
auspol-map-list-table for the build discipline; auspol-sa-chamber-seating for the
SA seating plans that sit ONTO these geometries; auspol-nsw-seating-census for why
nsw23 has no seating file).

## The two idioms

1. **The arc idiom (app-3-chamber.js)** — a compact ledger object per chamber drives
   a shared builder:
   - `CHB` (federal House, 151+Speaker), `VCHB` (vic22, 88+Speaker),
     `NSWB` (nsw23, 92 desks + the Serjeant's cell). CHB/VCHB each carry `leadY`,
     `arm {x, y0, pitch, n}` (the small side arms 90°-clamped to the curve),
     `blockX` (three straight bench blocks), `tierY` (four two-row tiers), `R`
     (five sector radii) — NSWB is the slimmer same-idiom ledger with NO blocks
     or tiers: `leadY`, `arm` (the inner straight file of 12, starting at the
     table's shoulder — the furniture arm-loop paints its bench), `row2X` (the
     outer straight file, painted as a second arm-loop bench when present —
     `B.row2X !== undefined`), `R` (THREE curve radii) and one-sector-per-row
     `sectors` holding 6/9/6 seats per side.
   - `<name>Cells()` turns a ledger into seat cells: `${P}t0` leader desks, `${P}a<i>`
     arm seats, `${P}b<row><j>` blocks (NSW: the outer file `${P}b<i>`), `${P}c<row><sector><i>`
     curved rows — plus the floor's officials stamped with fixed ids (House: `Speaker`,`Clerk`,`DeputyClerk`,
     `Serjeant`,`Hansard1/2`; vic22: same minus Hansard + `President` is absent — it's
     the Speaker too; nsw23: same as vic22's desk set + the Serjeant named `Rsj0`,
     centred (0, 242) backing the curve's back row).
   - `geomFor(cells, serjeantId, B, extra)` computes everything shared: the walkways,
     the gangway, the `SPEAKER_at`/bench bunkering, Harry's row orders, majority-band
     geometry. `extra` carries per-house flavour (`{hansard:true}` for CHB only;
     `{nsw:true}` forks the furniture).
2. **The rect idiom (app-3c-sa.js)** — `SAF` desk ledgers (`ha`, `lc`, `nswLC`):
   hand-placed `straight` row strings + `arcs` curving back rows, parsed by
   `saCells(F)` — the format `SEATED` plans (`map/data/seats-*.json`) address desk-by-
   desk (A1…T4). NSW's Council (`nswLC`) rides this idiom WITHOUT a seating plan
   (fill-the-benches). **SAF.nswLA was deleted 2026-10-27** — the NSW Assembly
   never passes through `saFloorOf` again; it only keeps nsw23's council.

`chamberGeom` dispatch order (the one place to read what a frame draws):
`year vic22 → vicGeom()` → `year nsw23 → nswGeom()` → `saFloorOf(m)` (SA + the NSW
Council) → `senate` → default House `houseGeom()`.

## Per-house furniture forks (drawChamberFurniture)

The House's room furniture is shared, then forked per-house: vic22 adds the Hansard
pair at the table (`TableHW`, `TableW` recessed) and drops the mace; nsw23 keeps the
mace, drops the officers' Triple AND the rear grooves, drops Hansard entirely, and
draws ONE plain rectangle table (the federal table is the T shape — an 8-vertex path).
The mace rides at the table's HEAD, the end away from the Speaker — `const my = -123`
shared by every federal-idiom floor (2026-10-27 user call; NSW's had sat mid-table at
-189 — at Sydney's Assembly the table's head lies away from the Speaker).
Phone label-stack (`labelStack`): hoisted to `y0-50/35/13` with the crossbench label
gated `only clockIn` and the whole band gated on `bandOn` (the centreWide rung).

## The nsw23 redesign, 2026-10-27 (the recipe for a chamber-rethink)

User direction, with ground truth the archived NSW Parliament diagram
(`/tmp/nsw-la-chamber-layout.png`, the R050 capture of the LA page — the live
parliament.nsw.gov.au LA link 404s, the LC page was the user's stand-in reference):
the room resembles Victoria's, EXCEPT the central table is one rectangle (no T head),
no Hansard table at its foot, no members at the table, two clerks alone chair at its
head Speaker-side. **Do not model a state chamber on the FEDERAL House's amidships
Hansard block, and do not model NSW on SA** — read the actual parliament's diagram
first (every chamber's official seat/desk plan is on its parliament's site or the
Wayback Machine; auspol-vic22-map-frame's `.build/map/vics/README.md` records the
capture pattern per chamber).

Moves, in order (first land, committed 79ae5212):
1. Deleted `SAF.nswLA` from app-3c-sa.js + its `saFloorOf` line (nswLC stays); the
   `@sa-cells` markers move down to wrap nswLC's ledger (it ends at the 84-seat
   LC note comment — the genuine `/* @sa-cells-end */` ONLY lands there; a stale
   earlier `*//*` is NOT a marker).
2. New `NSWB` ledger + `nswCells()` in app-3-chamber.js between the vic block and the
   shared machinery, wrapped in `@nsw-cells-begin/end` markers. 93 member desks
   (92 members + the Speaker's own empty — the same `SPEAKER_at` "desks = members+1"
   convention all three arc floors share; NSW's roster is 93 MHAs minus the Speaker =
   92 on the floor) plus the `Rc5c0` Serjeant cell — and NSW's own table officers sit
   OUTSIDE the member rows at `AisleX0`. Leaders pin via the existing
   `LEADERS["nsw23"] = ["Kogarah","Cronulla"]` → `Lt0/Rt0` desks mechanism.
3. `nswGeom()` beside `vicGeom()`; dispatch line ahead of the SA branch.
4. `geom.nsw` furniture forks in drawChamberFurniture (mace not hansard; rectangle
   table; no grooves).
5. Comment/log-ledger homes refreshed in BOTH sources (the app-3-chamber NSW header,
   the app-3c title + nswLC note + SA_GEOM comment) so the "NSW chambers seen"
   wording says Assembly=NSWB/Council=SAF.
6. test-map-page.mjs: the `SAF.nswLA` asserts became `!("nswLA" in SAF)` +
   `@nsw-cells` eval block, mirrored sides, `saFloorOf`'s exact string,
   `nsw23: "Greg Piper"` and `nsw23: "Lake Macquarie"` (SPEAKER-div line) —
   the cell-count pins moved with the floors (94 → 93, see below).
7. Run: `node .build/map/assemble.mjs`, the map test cluster
   (test-map-page / test-map-geo / test-map-senate / test-menu-lines), probes
   `.matilda/probe/map-chamber-nsw.mjs` + `map-chamber-phone.mjs` (its FRAMES
   line `nsw23` 390-driven with Greg Piper).

Second land, same day (the floor rebuilt pedantically): the user read the shipped
horseshoe against the chamber diagram and objected to the rows beside the dais —
the seating-plan JPEG the shape should come from is
`.build/map/src/nsw/nsw-la-seating-plan-wb.jpg` (352×640, Wayback-captured official
LA plan — the live seatchart PDF is bot-walled; .build/ocr-image.swift OCR +
connected-component and fine ASCII renders read its layout: NOTHING level with
the dais, straight files starting at the table's shoulders, curved fan behind).
Moves: NSWB's `blockX`/`tierY` and five-row curve deleted for `arm` (file of 12,
leadY from +1 more desk at its head = the leaders) + `row2X` (a second file of 12)
+ `R:[130,172,214]` with one-sector rows [6, 9, 6] per side — 46/side, 92 desks
for the floor's 92 seated members exactly (the 93rd desk and its empty outline
are GONE). The furniture's tier-box loop became `B.blockX ?? []`-gated and the
arm-loop gained the `B.row2X` twin bench; the Serjeant left the member rows for a
centred (0, 242) cell renamed `Rsj0` (was `Rc5c0` — no longer row-indexed), and
nswGeom must pass `rOut: NSWB.R[2] / CU` because geomFor's `B.R[4]` fallback
index only fits a five-row curve. In the canvas probe the fit-checks are the
chair count (96) and ZERO outlined-empty desks; the NSW phone/band contract is
unchanged. **Third user call, same day**: the straight files sit at the curve
radii they continue — `arm.x` mirrors `R[0]` (130) and `row2X` mirrors `R[1]`
(172), so each file reads as the tail of its curve row. **Fourth user call, same
day** (the CARPET trim, committed after): the chambers' floor substrate sprawled
past the seats — the arc idiom painted a fixed 282-point floor circle (the
House's own, whose back bench ends at 277.5). geomFor now computes `fr` per
ledger = max(back-bench edge `B.R[last]+13.5`, the Serjeant's chair back
`sj.y*CU+11.5`)/CU + 0.15 (the House's own 4.5-point skirt — federal and vic22
keep 282/9.4 EXACTLY; NSW gets 258, ending with its centred Serjeant) and
`geom.box` hugs ±(fr+0.15); drawChamberFurniture reads `geom.fr`; the label
`onFloor` predicates dodge the PAINTED carpet (`geom.fr ?? rOut+0.5`);
`NSWB.walks [116,151,187,151,193,229]` gives NSW's majority line its own walkway
radii (benchPt takes a per-ledger walks table) so the line ends at 229pt on the
carpet, never adrift past the trimmed edge; the SA-idiom floors' southern walls
became content-derived literals = lowest bench + the same skirt transposed
(ha 261→246, lc 258→235, nswLC 328→306 pixels — singles' bench bottoms count as
seats). Pins: test-map-page.mjs derives every SAF floor's wall from its ledger
(skirt relation) and the NSW canvas probe hooks `arc` to pin the floor circle's
radius in table-widths (2.8635 nsw23 vs the 2025 control's 3.1299).
**Fifth land, same day** (the nswLC FLOOR REBUILD to the chamber's own plan):
the user pointed at parliament.nsw.gov.au's official Council layout plan
(Cloudflare-walled live → fetched via Wayback capture 20260715045417, archived
at `.build/map/src/nsw23-lc-plan/chamber-layout-wayback-20260715.jpg`; 2480×3508
CMYK — a model can't read an image, so `.matilda/ascii-img.swift`'s min-pooled
darkest-pixel ASCII renderer + OCR of the legend, `sips -s format png` first)
showed the real room has NO arcs: two straight files of benches per side, eleven
beside ten, far ends aligned; President and clerks as before; the whips flank
the table; the Usher of the Black Rod sits ALONE past the bench ends, centre.
SAF.nswLC became `straight` rows only (`ys` two files a side, 10+11 each
mirrored), `arcs: []`, `gang` + `usher` scalars. Two saGeom NaN traps open on an
arc-free floor (grow this list if you ship another one): (a) the mean
`F.arcs.reduce(...)/F.arcs.length` is 0/0 — fall back `F.gang ?? 0`; (b) the
rowR null-fill loop leaves the LAST element null (nothing ever curves) — seed
rowR from rowX when every entry is null. drawSAFurniture draws the Usher's chair
next to the officers (`SF.usher != null` — a scalar y past the bench ends, never
a member cell in saCells/byId, so the bench-fill and the 42-desk count ignore
it). test-map-page.mjs's southern-wall pin's `bottom(F)` gained the usher's
chair-bottom. The scratch probe that drove it headlessly lives at
`.matilda/probe-scratch-nswlc.mjs` (the data-house buttons render only after
setView("chamber") — click order matters).

## The `@<name>-cells` markers + test eval idiom

Geometry lives in app sources but tests run NODE-side. Convention: wrap the ledger +
cell factory in `/* @<name>-cells-begin */` / `/* @<name>-cells-end */` comments;
`.build/test-map-page.mjs` regex-slices the block out of the SOURCE files and
materialises it with `new Function` (its `jsSA`/`jsVic`/`jsNsw` regexes are
marker-rooted — moving a marker breaks tests with a generic TypeError like
`Cannot read properties of undefined (reading 'straight')`, the tell this session).
`saCells` is shared from app-3c (eval'd alongside), `vicCells`/`nswCells` are
self-contained in app-3-chamber and re-declared once in the test. Three marker homes
now: `@sa-cells` (app-3c-sa.js), `@vic-cells` and `@nsw-cells` (both app-3-chamber.js).

## Paint-level probes (canvas, no DOM)

`.matilda/probe/map-chamber-nsw.mjs` pins the redesign where generic layout probes
can't (a chamber is canvas primitives, zero DOM): 96 nsw23 chair clusters =
92 members + Speaker + 2 clerks + the Serjeant (a drawChair is one rounded body +
backrest at ONE transform — cluster roundRects by their `getTransform()` key, see
auspol-headless-geometry-verify's canvas section); NO desk outlined-empty (the 92
desks seat the floor's 92 members exactly — the first land's spare desk is gone);
the table path is the 4-vertex rectangle while the federal 2025
control keeps its 8-vertex T; "The table" label paints, "Hansard" never does. The
phone-band contract (`labelStack` gaps, in-canvas ink, presiding member named) lives
in `.matilda/probe/map-chamber-phone.mjs`. Both probes force-tracked with
`git add -f` (.matilda is gitignored; see auspol-headless-geometry-verify).

## Cross-jurisdiction guard (three note homes, keep them together)

The NSW Assembly's drawn geometry is a STYLE match to Victoria's real room — it is
NOT evidence for seating plans, census lanes, or desk counts anywhere else. The
"must NOT be extrapolated" wording lives in three homes:
`.build/map/sa_seating.mjs` header, `.build/map/vics/README.md`, and the
`SA_GEOM` dictionary comment in app-3c-sa.js. Each state's OWN parliament documents
are the only source (Victoria's 8 plans incl. Sep 2018–Dec 2022 captchas, SA's
staffmap, the fed seating.ts; NSW proves none exists).
