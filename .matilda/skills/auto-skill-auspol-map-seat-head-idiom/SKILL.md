---
name: auspol-map-seat-head-idiom
description: auspol-tracker /map/ — the SEAT and POLLING-PLACE story head blocks in the winner-head figure idiom (born 8ba87b88 2026-11-08, settled across 892b5435 → 24ba5be0 → fad924fd → 76a0882f, 2026-11-08/09): Final count = "… (margin of M · status)" eyebrow + .st-tpp.st-nmup (candidate surnames ABOVE figures, black, 20px swing-font; figures in PARTY colours; .st-pnm party-name row below via pnmOf — full names ≤15 glyphs, KAP/LNP past it) + the retain/gain/win verb tag via SHARED seatTag(d) (by-election overlays read the base holder; polling-place Final count carries it too, on the SEAT-WINNER's figure — st-fg-l vs st-fg-r chosen by whether d.win.fam === local-winner fam, not the block's left) + plain "+x swing" (never a trail); notional 2PP and each polling place's "Final count here" ride the same block (swing figure included); narrating winner-lens dek REMOVED (the polling place's own dek instead reads in Commissioner under the booth family's double rule); informal = national plain ".st-inf" line with "(vs national average y%)" inside — the state-scope HEAD version carries the same contrast; census heads by scope; history chart domain AND heading follow the record's earliest year ("Since 1993") with origin a labelled tick; the separator family is now twin-rule-everywhere (.st-sec base, page.css:457 — the old "1px singles per lens" description was stale) with findings-after-figures riding their own .st-sec.st-findsec junction in the SHARED head() so seat/place findings separate like the state head's closing .st-sep (suppressed there via #story .st-stat + .st-sec.st-findsec, booth via its re-affirm selector; 2026-11-10); the seat Primaries' Others cell is itself the head-row expander (statOthersRows on the seatStatOf payload, same statScopeOf(m).open, 2026-11-10); the TPP basis (axis) fronts the same winner-head 2PP figures block instead of a swung-sentences hed/dek. Probe .matilda/probe/map-seat-head.mjs (~57 checks) drives via __map.goDiv/goBooth/setLens/goAus; oracle formulas mirrored from raw core-<year>.json.
source: auto-skill
extracted_at: '2026-11-08T00:00:00.000Z'
---

# /map/ seat story — head-block idiom (Final count · Primaries)

Shipped `8ba87b88` (2026-11-08), refined same-day by `892b5435` (user calls:
plain "Primaries" eyebrow, "Census data" head, 15px candidate names, informal
back to the national plain line, history chart titles its own era). The seat
view used to show a hero-read + margin-bar + verdict paragraph ("Price ahead
◀ …", "Price by 17,862 votes · safe"); it now renders the winner head's own
figure contract inside a plain `.st-sec`, reusing ONE shared spine.

## Module helpers (app-4-story.js, right after `statusOf`, ~:95–175)

- `tone(f)` — `` `style="color:${css(TH.party[f])}"` `` — every figure
  colour in head and seat goes through it now; the old seatStat-local copy
  and the `css(TH.party[…])` inline styles in statBreakdown/list rows are
  GONE (do not re-add).
- `swingFigure(s, side = null)` — one renderer for every `.st-swing` span
  (head's twoSw, statBreakdown's twin, and the seat's "+5.5 swing"); `side`
  overrides the colour family when swing direction isn't alp/lnp-shaped.
  Returns "" for s == null and "No swing" below ±0.05. (A `trail` param
  briefly appended the seat's classification to the swing line — "· safe"
  moved into the eyebrow the same day and the param was removed.)
- `tightFmt(v)` — storyArea's lifted `closeFmt`: margins widen decimals
  until the figure shows (Bradfield '25, 26 votes → "0.01"). Use it for
  seat margin labels; the HEAD's own label keeps plain f1 (2PP margins are
  never hairlines pooled).
- `twoPartyFigures(label, aPct, aFam, aName, bPct, bFam, bName, tag, namesUp = false, parties = null)`
  — the `.st-lab` eyebrow + `.st-tpp` figures + `.st-nm` names row + tag
  chip, in two modes:
  - the HEAD's mode (namesUp=false, byte-parity with the pre-lift inline
    emission — what keeps map-formed-govt.mjs green): party-coloured
    figures, names in ink beneath, dash auto-placed by DOM order;
  - the SEAT's names-above mode (`st-tpp st-nmup`, 6b8e0624): names EMIT
    FIRST (nm-l, nm-r) in the swing font 20px weight-500 BLACK
    (user call — colour was tried and died within the day), followed by
    classed `.fig-l`/`.fig-r` figures WITH the party tone on (the
    black-figure day ended the same day); the `<i>` dash takes explicit
    `grid-area: 2 / 2`, every child placed by grid-area classes in
    page.css. When `parties: [aParty, bParty]` is passed, a THIRD row of
    `.st-pnm` spans emits UNDER the figures in the national block's 12px
    weight-600 style (party-toned) — re-added 2026-11-09 after a day off.
    seatStat's own head two-party block keeps calling the head mode.
- `pnmOf(c)` + `PNM_ABBR` — the party label for that third row:
  `partyName(c.ab, c.pn)` UNCLIPPED where it fits (the boundary IS the
  Lingiari case: "Country Liberal", 15 glyphs, shows full — once rendered
  as "Country Li…" against an easy margin), an official abbreviation past
  it ("Katter's Australian" → KAP, "Liberal National" → LNP, "The
  Nationals" → NAT; "The Nationals" itself rides full inside the boundary;
  the LNP read stays LNP at seat AND place level — the booth call feeds
  through pnmOf like every head label; Longman is the regression probe).
  The gate is `n.length > 15 && PNM_ABBR[n]`; `.st-pnm` max-width is 10em so
  15 glyphs of 12/600 renders unclipped (title attr keeps full always).
- `seatTag(d)` — the shared outcome-verb helper (~:155, right after pnmOf):
  retain / gain / win, with the by-election overlay fallback off
  `d.by.prev.hold` (fam differs → gain, else retain). Both callers:
  seatFinalStat's chip and storyBooth's Final-count chip (same template,
  `<span class="st-fg st-fg-l"><b>${seatTag(D)}</b></span>`).
- `seatStatOf(m, d, py)` — the seat payload: tpp [winPct, 100−winPct],
  per-family fp shares pooled across `d.c` with ≥10-emission downstream,
  per-family changes (cfsw: `byChange` for by-election rows else `c.sw`,
  vote-weighted, null unless EVERY candidate of a family has one), and
  `swing` only when `d.classic && d.tppSw != null` — never lend the
  notional 2PP swing to the final-count block of a non-classic seat
  (Kennedy lesson: its "+0.8 swing" belongs ONLY to the notional block).

## The st-secstat blocks in storyDiv

1. **Final count** — `seatFinalStat(m, d)`. Eyebrow `Final count (margin
   of ${tightFmt(|p.tpp[0]-50|)} · ${statusOf(p.tpp[0])})` — the
   classification sits INSIDE the margin parenthetical since 6b8e0624
   (was briefly a "+x swing · safe" trail on the swing line). Names row:
   the pairNames surnames sit ABOVE the figures (20px/500 BLACK) with
   figures in party colours and the `.st-pnm` party row underneath (see
   helpers). The st-sec's own 4px double border-top (page.css:603) IS the
   separator — the one-day `.st-sep` crowns added 6b8e0624 were removed
   the same morning because they stacked ("duplicate separators", user
   report): never add a separator INSIDE a `.st-sec`. Tag
   `<span class="st-fg st-fg-l"><b>retain|gain|win</b></span>` — the
   whole day's user-driven wording ladder ended at bare VERBS (the
   intermediate "X retains"/"X gains from Y" party-naming pass lasted a
   few hours): `kind === "re" || "held"` → "retain", `kind === "gain"` →
   "gain", else by-election overlay base holder: `byHold.fam !==
   d.win.fam` → "gain" else "retain", anything else → "win"
   (`d.change` is unfiled on by-election rows — the byHold fallback is
   how Farrer reads "gain"). Swing line = plain `swingFigure(p.swing)` —
   "" when nothing swings (Farrer shows NO line, never "safe" alone).
   **The narrating dek is GONE** — seatHedDek's winner-lens standard case
   returns `dek: ""` (user call: "Scrymgour won the final count 58.1–41.9
   against Siebert …" duplicated exactly what the blocks figure); the
   headline stands alone, by-election and switched-member deks with real
   content stay.
2. **Notional two-party** (non-classic seats only) — emits when
   `d.tpp != null && !d.classic`, between Final count and Primaries: the
   SAME st-secstat block, same `st-nmup` variant ("Labor"/"Coalition" —
   via `coalW(1).replace(/^The /,"")` — names above, figures party-toned,
   parties below), eyebrow `Two-party preferred (notional, margin of
   ${tightFmt|…})`, swing `${swingFigure(d.tppSw)}` — NO prose note
   (the old h3+heroPair+"A swing of X points…" section died with it;
   coalW matters on state frames — never hardcode "Coalition").
3. **Primaries** — `seatPrimariesStat(m, d)`. Eyebrow `"Primaries"` PLAIN
   (user call 892b5435 — the "…(Labor and the Coalition share X%)"
   parenthetical and the squeezed-seat "One Nation-led primaries" prefix
   shipped in 8ba87b88 lasted one day; the columns say who). Columns: every
   family ≥10% in head order (alp, lnp, grn, onp, ind, others lump) — with
   TWO seat-level carve-outs the head never needs: (a) an independent ≥10%
   is its OWN column (a seat can be won from outside the majors; the head
   lumps independents into Others); (b) where Labor is missing or <10 (a
   by-election misfire, an independent's seat), the columns sort
   share-descending (Farrer '26: 39.5/29.2/22.2, never Coalition-first by
   family rote with an empty Labor column). The Others share carries a
   0.05 hairline floor — subtraction must not print −0.0 (nsw19
   Murrumbidgee lesson from the head, same rule seatside). **Since
   2026-11-10 the Others cell is itself an EXPANDER, the head row's own
   machinery seatside** (user report on Wannon: "other is not expandable
   like in other views"): `statOthersRows(p, cols)` with the seat's
   `seatStatOf` payload as its A (p.fp/p.fpSw are the same shape), open
   state read off the SAME `statScopeOf(m).open` the head uses (one flag,
   head and seat expanders open together), `.st-othb` when shut with rows
   (`othrows.length &&`), open drops the oth column (`cols.slice(0, -1)`)
   and appends the `.st-othx` fold line inside the same `.st-secstat`
   block; `st-n` keeps the FULL col count so the font doesn't jump,
   change smalls ride the shown cols (`statOthersRows` named rows keep
   their own `small` swings behind `bigness != null`). Pinned in
   test-map-page beside the `statFold` pin. The candidates'
   own rows keep their section BELOW as "The candidates ‹small›by primary
   vote…‹/small›" (user call — was "first preferences" for a morning).
4. **Informal is NOT a head block** — user call same day: it renders the
   national view's own plain line, `<div class="st-inf"><b>Informal
   votes:</b> x%</div>`, with the seat's comparison inside it:
   `…% (vs national average y%)` on federal frames, `…% (vs ${ausW()}
   average y%)` on a state frame (the old copy hard-coded
   `m.areas.AUS.infPct` as "Australia"; a state-frame seat would have been
   wrong, and short out where AUS fails). By-election with no count
   filed: `Informal votes: no count filed for the by-election yet`; the
   turnout note rides after via the shared `byTurnout` fragment. The
   day-one big-figure block and its `.st-ext` comparison styling are DELETED
   — do not resurrect. **The combined informalHTML gained the same
   contrast for AREA views picked to a state** (`(vs national average
   y%)` when `sel.k === "st"` and `m.areas.AUS` alive, user call
   2026-11-09): states scoped on the CLS axis and frame-wide scopes stay
   plain.

## The census section and the story's head wording by scope

Heads on the story's sections name the PROFILE, with the source in the
note beneath:

- a **federal seat**: `<h3>Seat profile from census data</h3>`;
- a **state-frame seat** (nsw23 et al. — user picked this reading on a
  clarifying question since no state-area census section exists):
  `<h3>${STATE_TITLE[stOfYear(m.year)]} view from census data</h3>`;
- a **polling place neighbourhood**: `<h3>Neighbourhood profile from census
  data</h3>` (was "The neighbourhood" + an "ABS census and SEIFA…"
  small — same two-line-straddle disease "The seat" had).
All wear short enough not to wrap on the phone rung — the probe asserts
one-line rendering on the federal seat head.

## The polling-place count blocks (storyBooth)

`storyBooth` renders the same idiom, on its own details:

- **Final count here** — the polling place's LOCAL majority picks the
  left figure and its name (winner-cheque: `lw = ta >= tb ? D.A : D.B`,
  not the seat's overall winner): `twoPartyFigures("Final count here
  (margin of ${tightFmt(|pct-50|)})", pct, lw.fam, surname, 100-pct,
  run.fam, surname, chipHTML, true, [pnmOf(lw), pnmOf(lrun)])` — where
  chipHTML is the seat's outcome tag `<span class="st-fg st-fg-l"><b>${seatTag(D)}</b></span>`
  (fad924fd: the polling place carries the seat-outcome chip — same
  seatTag helper, "retain" for Durack's booths);
- **notional two-party here** (non-classic seats) — `Two-party preferred
  here (notional, margin of …)` same block family (NO tag chip);
- **the swing rides its count block in figure form** (`${swingFigure(swingHere)}`,
  appended inside the same st-secstat; classical case attaches to the
  Final-count-here block, notional case to the notional block): the
  narrating "A two-party swing of … to … here." st-note sentence is GONE.
  One prose remnant survives: `This place wasn't used at the previous
  election, so it has no swing.` stays an st-note when `swingHere == null`
  (there is nothing to format);
- its candidate table head runs ONE small caption: `The candidates
  <small>by primary vote here. Tick = whole seat</small>` — user call
  combining both clauses into the single lighter subtext line after a
  brief two-line `.st-hgc` structure shipped and was removed the same
  morning (the two-line variant's CSS is gone; do NOT restore it — the
  alignment ask was absorbed by merging the clauses). The change smalls
  still compute against `frameBaseY(m.year)` when a prev-fp store exists;
  the "· change on YYYY here" WORDING is gone either way.
- `pnmOf` rules ride here too (the booth's LNP/Labor reads stay LNP at
  seat AND place level — the seat-levels differed for an hour when the
  booth block missed the pnmOf pass).

### The booth's separator family (user call 2026-11-09, fad924fd)

Section separators in the story column are a LENS-scoped family, and the
polling-place story opts out of the family rules into its own:

1. Base rule: `.st-sec { border-top: 1px solid var(--line) }` — singles,
   every non-winner lens;
2. Winner family: `#story[data-lens="winner"] .st-sec { border-top: 4px
   double }` — the head double rule's own junctions — plus the adjacent
   suppressors `.st-stat + .st-sec, .st-dek + .st-sec { border-top: 0 }`
   (the head's closing rule pair makes the first junction already);
3. **Booth override**: `#story[data-view="booth"][data-lens] .st-sec {
   border-top: 4px double var(--line) }` — with the marker set by the
   story render (`el.dataset.view = s.level` beside `el.dataset.lens` in
   the story-write chain ~:1580). The polemic the user hit: on the
   winner page, `.st-dek + .st-sec` suppression zeroed the FIRST junction
   of the booth story (its head emits a dek-line remnant above the first
   section with NO head-close rule above it to pair with), and on any
   other lens the single 1px rule showed — both fixed by this opt-in.
   Specificity note: the override must beat the two suppressor selectors
   (`#story[data-lens="winner"] .st-dek + .st-sec` = id + 2 attrs + 2
   types), which is exactly why `[data-lens]` rides INSIDE its selector
   and the rule sits AFTER them in page.css.

Do NOT add `.st-sep` spans inside a `.st-sec` (the stacked-separator
episode when both a section crown span AND the section's own border-top
fired — "duplicate separators", user report; the day-one crowns were
removed the same morning).

**Separator-family correction (observed 2026-11-10)**: the three-step
family above (1px singles in non-winner lenses) no longer matches the
shipped CSS — page.css:457 has `.st-sec { border-top: 4px double
var(--twin) }` as the BASE in every lens, with the code comment "the
junctions' twin rule is .st-sec's base"; the winner-lens override and the
`.st-dek`/`.st-stat` adjacent suppressors described there are gone. What
remains: the base twin rule; `#story .st-stat + .st-sec { border-top: 0 }`
(the head's own closing rule already divides); and the booth re-affirm
`#story[data-view="booth"][data-lens] .st-sec { border-top: 4px double
var(--twin) }` (outranks the suppressor by specificity — needed where a
booth junction sits straight after head figures). When the unification
shipped is unknown from this session — trust the current file.

## The finding junction (`.st-findsec`, 2026-11-10)

A finding that comes AFTER a figures block now draws its own ruled
junction, matching what the area head got from seatStat's closing
`.st-sep` (user report on Richmond: the seat view's "One Nation won 5.4%
of first preferences in Richmond. Across Australia…" line lacked the
separator the state view has). Mechanics:

- `head(title, meta, hed, dek, stat)` (app-4-story.js:76 — the ONE
  renderer the area, seat AND polling-place heads share) wraps a
  non-lead finding in `<div class="st-sec st-findsec">`:
  `` `${stat || ""}${stat && find ? `<div class="st-sec
  st-findsec">${find}</div>` : find}` ``. A lead finding (`st-find-lead`,
  head with no figures) is never wrapped.
- `.st-findsec > .st-find { margin-top: 12px }` — 7px section padding +
  12 = the ~19px the booth's old pattern had under its rule.
- The area head is pixel-unchanged: its figures end in `<h3
  class="st-stat">` whose trailing `.st-sep` already divides, and the
  junction is suppressed by `#story .st-stat + .st-sec { border-top: 0 }`
  plus the scoped `#story .st-stat + .st-sec.st-findsec { margin-top: 0;
  padding-top: 0 }` (the finding's own 12px survives as the only gap).
  Do NOT put the spacing zero on the bare `.st-stat + .st-sec` selector —
  the area body sections straight after the head keep their mt16/pt7.
- The booth head's finding gets its rule from the same wrap through
  `#story[data-view="booth"][data-lens] .st-sec`; consequently page.css's
  old `#story[data-view="booth"][data-lens] .st-find { border-top … }`
  selector was REMOVED (would double the rule) — only `.st-dek` keeps it
  there (the app-3b senate booth head still emits a bare dek). test-map-page
  pins `!css.includes('[data-lens] .st-find {')`.
- Untouched by design: the winner lens's MID-flow verdict (storyDiv
  appends `findingHTML(hed, dek, false)` straight into `figs` between
  Final count and Primaries — user call 2026-11-09 keeps it attached to
  the final count; head() receives "" for it, so no wrap).


## The tag's CSS + anchoring share the head's machinery

`.st-fg.st-fg-l { right: 100%; }` is a THIRD, POSITIONAL side class — the
seat's winner always sits on the LEFT figure, so family semantics
(alp-left/lnp-right) don't exist here; `anchorGovtTag` left-hung detection
is `st-fg-alp || st-fg-l` and anchors the seat tag's inner face flush to
the st-stat content edge identically (inline px, re-run on rAF/resize/
fonts.ready). `.st-secstat` is just `.st-stat` (flex column centre) inside
`.st-sec`; its `.st-nm` override carries medium weight + 15px (user call —
the head's 12px name rung is too small for actors who ARE the story) +
6.2em max-width ellipsis for long surnames (title attr on the names holds
the full candidate name — twoPartyFigures emits it).

**The polling place's tag follows the seat winner, not the place's winner**
(76a0882f, user-reported 2026-11-09): a polling place whose local leader
differs from the seat's holder still shows `seatTag(D)` — the outcome verb
belongs to the SEAT result — so its chip picks its side by
`D.win.fam === lw.fam ? "st-fg-l" : "st-fg-r"` (lw = the place's local
winner family): Labor-led Durack polling places hang "retain" off
Liberal's figure on the RIGHT (`st-fg-r`), never the leader's column as
the seat-tag-on-left default would. `st-fg.r`'s CSS mirror rule
(`.st-fg.st-fg-r { left: 100%; }`) was PENDING at review time (the class
emits and anchorGovtTag anchors it by name-predicate — it goes through
the RIGHT-hung branch since it is not `st-fg-alp`/`st-fg-l` — but a
fallback CSS rule should still land before any future caller anchors
without JS). The seat-level seatFinalStat keeps `st-fg-l` forever (winner
always left there).

## The Since-〈earliest〉 history chart — domain follows the record

`historyChart(d)` no longer clamps: the domain is the seat-name's own
record (`y0 = Math.min(...years)`), and the heading names it — `<h3>Since
${y0}</h3>` ("Since 1993" for Kennedy, "Since 2010" for Durack; was the
fixed "Since 2004", which lied for both a deep ledger and a young seat —
user call 892b5435, any "extend past x=0" fix belongs HERE, never by
dropping rows). The x ticks are the federal-election years ∩ [y0, y1] PLUS
`y0` itself, so the origin is always labelled. The tick filter must be
`y >= y0 && y <= y1` — an earlier version filtered only `y <= y1` and the
2004/2007 ticks drew at NEGATIVE x under a 2010-origin seat (Durack; the
probe caught it). The pre-2004 rows stay in `d.h` either way —
app-1-base.js's `firstYearOf` reuses the same series for the hed's
"held it since 2013" wording.

## Edge cases the probe pins (use them as contract)

- **The head byte-parity between shared helper and old inline emission**
  — map-formed-govt.mjs stays green untouched after the lift.
- **Durack 2025**: tag "retain"; eyebrow "Final count (margin of
  10.2 · safe)"; surname names ABOVE in black 20px, figures
  party-coloured below; party row "Liberal / Labor" unclipped (fonts
  12px, flush ±0px against figures); swing line "exactly +5.5 swing";
  informal reads `Informal votes: 6.4% (vs national average 5.6%)`;
  census head one line; chart title "Since 2010" with origin tick "’10".
- **Farrer (now frame, by-election)**: tag "gain"; primaries columns
  share-descending with NO phantom Labor column anywhere; informal
  carries either the honest unfiled variant or a real figure (the runtime
  merges a base figure onto by-election rows when one exists — probe
  either, never a crash); NO swing line under the Final count reads
  (null tppSw), but the NOTIONAL TWO-PARTY block's swing line shows for
  Kennedy ("+0.8 swing") — the user reported Kennedy's swing "missing"
  on this exact confusion).
- **Bradfield**: margin label "margin of 0.01" (tightFmt).
- **Melbourne history**: title "Since 1993", origin label "’93", and min
  polyline/dot/label x = 26 (padL) exactly; notional block is a third
  st-secstat ("Two-party preferred (notional, margin of 24.0)") with
  party names above figures AND the party row below.
- **Lingiari**: party row shows "Country Liberal" full and UNCLIPPED
  (pnmRclip ≤ 0.5 probe reading).
- **Kennedy**: "KAP" — Katter's Australian abbreviates past the
  15-glyph boundary.
- **nsw23 Barwon**: census head "New South Wales view from census data".
- **booth** (the polling place): "Final count here (margin of …)"
  block with 20px surnames, "Neighbourhood profile from census data"
  head, and the candidate h3 with "by primary vote here" as lighter
  small plus "tick = the whole seat" on the caption line flush beneath
  it — no "change on … here" clause.
- Probe harness: drive seats with
  `window.__map.goDiv(M().divs.findIndex(d => d.n === "<seat>"))`,
  booths with `__map.goBooth(M().booth.byDiv[i][j])`; frame switches
  need goto + `page.reload()` (no hashchange listener — same as
  map-formed-govt). Boot-fetch fails intermittently under the python
  server ("Failed to fetch", documented in map-formed-govt.mjs) — rerun
  once before any fix work, it's external proof. The winPct oracle reads
  `core-<year>.json` and takes `Math.max(shareA, 100-shareA)` — `d.tpp[0]`
  is ALWAYS LABOR's tally in the raw json (Durack's A side is 39.8 even
  though Price won), a pre-coffee error that refunds every assertion
  downstream. Mirrors of `statusOf`/`tightFmt` live inline in the probe;
  keep them in byte-sync by duplicating the source lines, not by import.
  The informal oracle pools informal/formal across `j.divs` exactly like
  the app.

Map suites touching the seat story: `test-map-page`, `test-map-draw`,
`test-map-vote-bands`, `test-map-primary-breakdowns`, `test-map-history` —
plus probes `map-seat-head.mjs` (new), `map-formed-govt.mjs`,
`map-informal-line.mjs`. Rebuild: `node .build/map/assemble.mjs`.
