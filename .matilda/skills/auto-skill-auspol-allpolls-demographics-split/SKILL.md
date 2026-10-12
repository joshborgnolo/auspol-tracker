---
name: auspol-allpolls-demographics-split
description: auspol-tracker — adding a new split-by-group dimension to the All-polls Demographics facet (worked 2026-10-07, income sixth split, commit 0087ceb). Anatomy across EIGHT homes: d1a1d215 DEM_SPLITS def + DEM_BY_URL single-letter code + DEM_BY_ID; rd-allpolls.jsx dek sentence, the radio-vs-pick copy counts and the ctlNarrow right-edge cut which MUST be re-measured when the picker gains a button (five splits+6 tabs fit 1000px, six splits+7 tabs fit 1140px) and pinned by .matilda/probe/ap-split-picker-width.mjs; 73de0c58 keysheet bank 1–N row; crosstab-parse.mjs reader dim/harmonize/demosLabel branches; demographics.mjs prose + _about bullets; gen-data.mjs DEMO_RAW_DIMS; demo-groups.mjs ruled-out ruling; data/demographics.json regen. Income is facet-only by design — per-wave breakdowns show in All-polls, NEVER pooled into §7g Who-votes (household-vs-personal bases never mix; the Vote-by-group anchor stays on quoted primaries). Phone-width follow-up e73c9fa: the sixth word overflowed nowrap on ≤390px phones — picker/radiogroup/.rd-ap-pctl now flex-wrap: wrap; a seventh split must re-probe the phone rungs, not just the desktop cut. 2026-10-10: Other cuts grew five stacked cut FAMILIES (e30ccc6; demPairOf's third famId arg, demFamTables) and its uncoupled table-body branch leaked the fam tables onto every facet on the persistent demSplit state (fix c7922e5: demFams gated on facet === "demographics" — the lesson: context render branches gate on the context, not just the discriminator; probed by .matilda/probe/othercuts-facet-hop.mjs). 2026-10-11: the expanded-poll dem detail table casts every figure VERBATIM — rdApNum, never Math.round (Roy Morgan's printed halves; probe .matilda/probe/dem-half-print.mjs). Same day PM: Roy Morgan's verbatim Capital Cities/Regional/Rural Areas place pair joined the Place split as an alias triple — label-pair additions must ALSO extend rd-allpolls.jsx's RD_AP_DEM_NOUN noun map, and the dem-pair audit probes' `new Function("window", src)` harness proved vacuously green (the bundle assigns window.AUSPOL itself; capture the window) — repaired same day, surfacing 13 pre-existing documented misses. 2026-10-12: a facet HOP into Demographics (the opened poll's "Also in this poll" Demographics line) must re-seat demSplit onto a split the poll can draw — keep the sitting split where it draws the poll, else first drawable; Roy Morgan prints city/country + one-offs and no age cut, so the default Age hop opened a table that excluded Roy Morgan itself (fix c19fb6c, BOTH entry paths — rd-allpolls.jsx lineGo + d1a1d215's focus effect for the Latest-table AP.openPoll trip, which names no split; pinned by .matilda/probe/dem-hop-split.mjs).
source: auto-skill
extracted_at: '2026-10-07T06:27:49.187Z'
updated_at: '2026-10-12'
---

# All-polls Demographics facet — adding a split-by-group dimension

Worked 2026-10-07, commit **0087ceb**: income became the sixth split
(Sex, Age, Education, Geography, Home …, Income). If you add a seventh
split the same homes all move; if you REMOVE one, every N-counted
string and the ctlNarrow cut move back.

## The eight homes

1. **d1a1d215 asset, `DEM_SPLITS`** — one def per split:
   `{ id, label, lo, hi, scope, pairs }`. `pairs` are
   `[hiGroup, loGroup, "pair label"]` triples, one per bracket shape a
   house publishes (income took three: YouGov `$150k+ v <$50k` and
   `$100k+ v <$100k`, Resolve `$125k+ v <$45k`). Keep the
   household-vs-personal comment with the def — bracket bases differ
   per house and that is WHY this split is never pooled.
2. **d1a1d215 `DEM_BY_URL`** — one fresh single-letter code
   (`n: "income"` at ~:3448; letters are consumed in order, check none
   collides with facet codes).
3. **d1a1d215 `DEM_BY_ID`** — inverse map (`income: "n"` at ~:5663).
4. **rd-allpolls.jsx** — the facet dek gains the split's sentence
   (:2838 zone), and every N-counted picker copy moves in lockstep:
   "one of six, so a radio group", "1–6 pick". THEN the **ctlNarrow
   cut** (:1776-1789, the `(max-width: …)` that hands the picker to its
   own strip): re-MEASURE with the new button count and the CURRENT tab
   count — the seventh (Confidence) tab pushed six buttons (412px
   measured picker) past the old 1000px cut on 1001–1150px windows, so
   the cut became 1140px. Update the measured-basis comment (picker px,
   tab count, fit-from px, date).
5. **73de0c58 keysheet bank** (:2070 zone) — the demographics row's
   `keys: ["1–N"]` matches the split count.
6. **`.build/crosstab-parse.mjs`** — reader branches so the new dim
   arrives from source data: ygGroup patterns, `DEMOS_DIM` mapping
   (DemosAU `Income` → `"income"`), `demosLabel` label branch,
   `youGovDims` column-pair dedupe (income pairs needed it — duplicate
   columns across bracket splits would otherwise file the same row
   twice), and the common-groups **harmonizer** folds the houses'
   bracket spellings onto one dim id.
7. **`.build/demographics.mjs`** — facet prose sentence + `_about`
   bullet name the new split (these strings are what make the split's
   basis caveat visible in the Ts&Cs).
8. **`.build/newtracker/gen-data.mjs`** — `DEMO_RAW_DIMS` (~:2694)
   admits the dim id so per-wave breakdowns flow into
   `data/demographics.json` and the built data bundle; and
   **`.build/newtracker/demo-groups.mjs`** (~:34-46) — extend the
   ruled-out ruling paragraph recording WHY the new split stays
   facet-only.

Then regenerate: `node .build/newtracker/build.mjs` (runs validate);
`data/demographics.json` gains the per-wave breakdowns; grep the BUILT
data bundle (`grep -c '"<dim>"' .build/newtracker/assets/9f09dca2-*.js`
— income = 20, one hit per wave × dim id) and the built index.html for
the new def (`id: "income"`).

## Pins

- `.build/test-crosstabs.mjs` — HEADERS, a dated wave's `dims.<dim>`,
  `dupOf` duplicates, `demosLabel`, harmonize — all pinned for income;
  extend for the next split.
- **`.matilda/probe/ap-split-picker-width.mjs`** (headless-Chrome):
  asserts the picker is glued to the tab row ABOVE the ctlNarrow cut
  (1141/1150/1200/1366px) and in its own strip at/below it
  (900/1000/1140px), six buttons ending in Income, zero horizontal
  document overflow; prints the measured picker width so the ctlNarrow
  comment's figure drifts loudly. RE-MEASURE on any button/tab count
  change. `.matilda/probe/*` is covered by the `.matilda/*` gitignore
  but probe files are TRACKED by convention — `git add -f`.

## Phone-width follow-up (2026-10-08, e73c9fa)

The six-word picker broke phones a day later: `.rd-ap-dpick` was
`white-space: nowrap` inline-flex, and six buttons ≈378px overflowed a
350px phone slot by ~8px on every Demographics view — the width pin
above measures only the ≥900px ctlNarrow handoff, so nothing caught it.
Fix (in e73c9fa, shipped with the RdGlide overflowX pairing — see
auto-skill-auspol-mobile-overflow-probe transient class 4):
`flex-wrap: wrap` on `.rd-ap-dpick` (rd.css :2390), its
`[role="radiogroup"]` (:2392) and `.rd-ap-pctl` (:2117); the ≤360px
label-hide media query stands unchanged, comment recalibrated
five→six words.
Adding a SEVENTH split: after the desktop ctlNarrow re-measure, also
probe the phone rungs (360/390/414/430, fast facet walk) — wrap means
the picker is now N-tall on phones rather than N-wide, and the height
perturbs the facet-swap glide.

## Triage: a wave carries the dim but is absent from the split

Row admission is `has: (p) => !!demPairOf(p, demSplit)` on the facet
scope (:5108); `demPairOf` (:3490) requires BOTH endpoints of one
`pairs` triple to be present among the wave's dim keys, matched by
EXACT string equality — no read-time normalisation. A spelling
mismatch silently filters the row (no error anywhere), and the row's
opened DETAIL still renders the dim fine, because detail rendering is
generic over `p.grp.d` while split rows go through the pair gate.
Worked 2026-10-09, commit f86c902: both pooled-Newspoll quarterlies
invisible in Income because their hand-entered NEWSPOLL_DEMO keys say
`<$50k` verbatim where the pair endpoint says `Under $50k` —
hand-entered dims bypass crosstab-parse's `ygGroup` canonicaliser
(YouGov's printed `<$50k` gets mapped, the constants' don't). Full
case + fix + verification chain in
`auspol-demographics-hand-entry` "THIRD INSTANCE". Freshwater's
`$150k or more`/`Under $75k` pair was noted the same day as matching
no income pair endpoint either — outstanding.

### The alias remedy: add a PAIR to an existing split (worked 2026-10-09, 1541bc6)

When a second/third house prints the SAME concept with its own spelling
and the wave is canonical (never hand-enter), don't relabel the data —
add a pair-alias triple to the split's `pairs`. Newspoll (pooled) prints
`No tertiary`, Fox & Hedgehog prints `High School`; both joined the
Education split via two new triples. Only home #1 (d1a1d215 DEM_SPLITS
def) moves: append the triples AFTER the existing ones (demPairOf tries
pairs in order, so established matches are undisturbed) and GENERALISE
`lo`/`hi` only if the endpoint set grows past the old labels
(education's lo "Year 12 or less" → "No tertiary" once the lo end
spanned four instruments). None of the other seven homes moves — no
new letter, no key bank, no reader branch, no prose count.

Two audits pin the class (both gitignored `.matilda/probe/` scratch):
- `.matilda/probe/dem-pair-labels.mjs` — walks `data/demographics.json`,
  flags every wave whose dim keys carry NO complete pair (MISS) or one
  only after casing/dash normalisation (NEAR). Its SPLITS copy is
  hard-coded — extend it alongside the def. 1541bc6 left 41 misses, all
  documented legitimate classes: Resolve/Newspoll/Fox/Roy Morgan/Freshwater
  STATE-only place dims (the facet is metro-v-rural, not geography), RedBridge's
  four-band schooling (Below Year 12 | Year 12 | TAFE or trade | University —
  no lo-end alias added), Freshwater's `18–35/36–53/54+` age bands and
  `Under $75k/$150k or more` income spellings (both outstanding), YouGov
  2026-02-10's top-two income brackets (source deficiency, below).
- `.matilda/probe/dem-live-miss.mjs` — same test against the BUILT
  9f09dca2 bundle's individualPolls with live demGroupsOf replication.
- `.matilda/probe/dem-facet.mjs` (headless) computes expected admission
  counts via `window.demPairOf` at runtime, so pair additions need NO
  probe rewrite — it just passes.

**Source-deficiency verdict before any reader repair (the "repair" that
wasn't):** YouGov 2026-02-10 showed only `$100–149k`/`$150k+` income —
assume reader drop first, but VERIFY AT THE SOURCE: dumping the Infogram
entity (`_/ZmzvfoQcPMj4PREkMRoQ`, single CHART, one 7×23 crosstab sheet)
showed the chart itself never carried low brackets that wave (the
sub-$100k scheme debuted in YouGov's 2026-04-07 chart), so the
exclusion is CORRECT and there is nothing legitimate to hand-enter.
The `dropped` watchdog in demographics.mjs never flags such one-off
disappearances — it requires a series present in TWO consecutive waves
then absent; document single-wave source holes in the pair-labels
audit's legitimate-miss list instead.

## The lo/hi scale-cap contract — and the "combined Other facet" question (assessed 2026-10-09, no change shipped)

`lo`/`hi` on a `DEM_SPLITS` def are **split-level, not per-pair**: they
are the gap scale's end caps, drawn ONCE for the selected split by
`demScale` in rd-allpolls.jsx (~:2491-2492 —
`<b className="rd-ap-scl">◀ {spl.lo}</b>` … `{spl.hi} ▶`) regardless
of which pair any row actually matched. Pairs, by contrast, ARE
per-poll: `demPairOf(p, split)` walks `split.pairs` in order and takes
the FIRST triple whose BOTH endpoints exist in the wave's dim keys, so
heterogeneous house-specific pairs coexist fine inside one split
(income does) — but only because income's caps "Lower income → Higher
income" are directionally true for every pair in its list. **A misc
"Other" split cannot have a single honest pair of caps**: mixing e.g.
EMRS Tasmanian electorates with birth-country would leave every row
under end caps that either lie or say nothing. Making caps pair-aware
is a renderer change in rd-allpolls.jsx + the asset (each pair
carrying its own short caps), not a data edit.

User asked 2026-10-09 "maybe rename \"Birth country\" \"other\" and
make it a combined facet?" (to absorb EMRS (Tas)'s five-electorate
cuts, after the Place facet was ruled out — Place is national
metro↔rural, EMRS's geography is five Tasmanian electorates and its
PDFs print "no notable differences within demographic sub-groups").
SHIPPED same day as the generalisation (EMRS half rejected, see
below):

- **Rename landed label-only** as "Other cuts" ("Birth country" was
  the candidate label discussed): the `id` stayed `country` because
  it feeds `DEM_BY_URL` (`b:`) and the facet-story keys
  (`"demographics|" + sp.id`, rd-allpolls.jsx ~:2210) — an id rename
  migrates URL state and story keys for zero user-visible gain.
- **Scale caps went pair-aware** as designed above: pairs may carry
  `[3]`/`[4]` = the ◀/▶ group names; `demPairOf` threads them out as
  `loCap`/`hiCap`; rd-allpolls computes `demCapLo/demCapHi` once per
  render — pair-caps-mode splits show the shared pair's caps, mixed
  pairs show NO end labels (honesty over decoration), standard splits
  keep split-level lo/hi. The `country` pairs carry the caps they
  always had ("Australia-born"/"Overseas-born"), so the rename was
  pixel-neutral; spl.lo/hi serve only as the empty-view fallback.
- **ctlNarrow re-measured 1240 → 1220** (shorter chip, picker 513 →
  496px; row fits from 1205px, overflow first at 1200): ap-split-picker-
  width.mjs, conf-headline.mjs and dem-facet.mjs re-pinned same day.
- **EMRS's electorate row was ruled OUT on evidence**: Aug 2026's
  SECTION 2 federal section (txt:234+) carries statewide VI only (ALP
  29/ON 26/Lib 17/GRN 15/Ind 13/oth 1) with prose callouts (Clark 28%
  Ind, South 19% Ind) — NO five-electorate charts, so the cut exists
  in exactly one wave (Feb 2026) at eff ≈ 200/cell, a permanently
  single-house row. If EMRS ever prints the electorate table again
  the pair-caps machinery is ready for it.
- The `country` split's comment block documents the odd-cut CONVENTION
  (pairs carry caps; lo/hi fallback-only) — cite it when filing the
  next one-off contrast.

## Other cuts grew into five stacked FAMILIES (e30ccc6, 2026-10-10) — and the facet-leak it shipped (fixed c7922e5 same day)

Next day the split generalised again (user: "you can make another
table … one under the other"): the `country` def's `fams` array stacks
one table per cut FAMILY in the date view — `birth` (Roy Morgan 10341's
seven-month pooled wave), `religion`, `working` (Newspoll pooled +
YouGov weekly, the one family two houses share), `children`, `class`.
A wave draws a row in EVERY family its table covers. Machinery:

- **d1a1d215**: each fam carries `id/lab/sub/pairs`; the split's
  flat `pairs` list = the fams concatenated in order, so every
  no-fam consumer (detail, story, scope admission) is unchanged.
  `demPairOf(p, split, famId)` third arg confines the walk to one
  fam's pairs (`(sp.fams.find(f => f.id === famId) || {pairs:[]}).pairs`).
- **rd-allpolls.jsx**: `demFams`, `demFamTables` (visible rows
  re-grouped per fam, empties dropped), `famHead` (fam's own head
  carries the pair caps `famCapsOf`, the pinned head's demCaps step
  aside), `monthRow(g, famId)` drops the "N polls" count inside a
  fam, `rowFor(p, demFam)` / `rowNav(e, p, demFam)` thread the row's
  fam so the arrow-walk stays inside its row list
  (`demFamRowsOf`/`demFamOffset` index the walk across family
  boundaries). A column sort (not byDate) falls back to the flat
  pair-naming view.

**The bug** (user report hours after it shipped: "once you go on
'other cuts', navigating to the other facets doesn't work, it gets
stuck, refresh fixes it"): `demFams` computed from the SPLIT alone,
and `demSplit` survives a facet hop BY DESIGN (d1a1d215's `onFacet`
resets sort/scope, not the split). The table body's
`{demFamTables ? … : normal rows}` branch then rendered the stacked
fam tables on EVERY facet — franken-tables on 2PP/Primary (fam heads
+ facet figures in a dem-shaped grid), and ZERO rows on Confidence
(its rows pair no demographic cut). Only refresh with a reset URL
recovered the table. **Fix: `demFams = facet === "demographics" &&
…`** — one line; split state still persists, fams re-stack only in
their facet.

**The generalised lesson — gate context render branches on the
context too, not just the discriminator.** The All-polls table's
sub-state (facet, demSplit, sort, scope, basis) persists across hops
by design, so ANY new render branch keyed on the discriminator value
must also test the context it belongs to (`splitPicker`, `demScale`
render sites were already `facet === "demographics"` gated — the new
table-body branch missed it). Audit list when adding one: the
branch's own JSX fork AND every derivation that feeds it
(`demFamRowsOf`/`demFamOffset` degrade fine when null; a stale
non-null does not).

**Debug chain worth replaying:** headless repro FIRST (land
`?f=g&g=b`, snapshot facet tab + `.rd-ap-frow` count + row count,
click every facet tab) — it separated "state stuck" (facet state
switched fine per `aria-pressed`) from "render leak" (fam rows
persisted), pointing at the JSX fork rather than the tab machinery.
False-positive trap: grepping the live DOM for the error boundary's
copy ("hit an error") matches the SCRIPT SOURCE tag carrying that
string — assert on the boundary's mount node, not its text.
Pinned by `.matilda/probe/othercuts-facet-hop.mjs` (16 assertions:
every tab + keyboard walk off Other cuts on desktop and phone, the
UI-pick path too) — run it beside dem-facet.mjs on any fams change.

## Facet hops onto a split the poll can't draw (c19fb6c, 2026-10-12)

User report 2026-10-12: clicking the **Demographics** line of an opened
Roy Morgan poll in "Also in this poll" opened the facet seated on
**Age** — the split demSplit last sat on — and Roy Morgan prints
city/country plus one-off cuts, never an age cut, so the poll the
reader had come from was absent from the very table the line opened.
demSplit survives a facet hop BY DESIGN (the same persistent state as
the Other-cuts leak above — persistence is intentionally preserved);
nothing at the hop re-validated the split against the poll being
carried across.

**Contract now:** keep the sitting split where `demPairOf(p,
demSplit)` is true, else re-seat on the FIRST DEM_SPLITS def that
draws the poll. Two existing sites already followed that rule — the
Who-votes dot trip (this focus effect's `focus.split` branch re-seats
onto a drawable split) and rdLgLines' Demographics-line preview (the
line is labelled by the split it WILL open, Age tried first) — so the
hop now honours the promise the line makes.

**Two entry paths reached the bug, both fixed:**

1. **All-polls in-place** — `lineGo()` in rd-allpolls.jsx tests
   `id === "demographics" && window.demPairOf && !window.demPairOf(p,
   demSplit)` before calling `onFacet(id)`: find the first
   `window.DEM_SPLITS` def with `window.demPairOf(p, x.id)` true and
   `setDemSplit(fit.id)`. `RdApDetail` gained the `setDemSplit` prop
   (destructured from `P` in RdAllPolls, fed from d1a1d215's render
   call at its :5892 — one plumbing rung up from `demSplit` itself).
2. **Latest-table trip** — a Latest-table Demographics line calls
   `AP.openPoll(key, "demographics", from)` (rd-polls.jsx ~:425),
   which names NO split and lands in d1a1d215's focus effect; the
   effect used to re-seat only an explicitly handed `focus.split`.
   Widened to
   `if (focus.split || focus.facet === "demographics")`:
   `const want = focus.split || demSplit;` then
   `setDemSplit(can(want) ? want : DEM_SPLITS.map((s) => s.id).find(can) || want)`
   where `can = (s) => !!(fp && demPairOf(fp, s))` and `fp` is the
   focus poll found in `D.individualPolls` by `pollster + "|" +
   released`. `demSplit` is React state read at render time inside the
   `[focus]` effect — no stale-closure trap there.

**Generalised lesson (the navigation-side half of the persistent-
split contract):** state that survives a view transition must be
RE-VALIDATED against the target view's eligibility predicate AT THE
TRANSITION — persistence preserves intent, eligibility preserves
truth. The Other-cuts fix was the render-side half (gate the fam
tables on their facet); this is the navigation-side half (re-seat on
eligibility). ANY future entry path into the Demographics facet that
carries a poll must run the same
`demPairOf(p, sittingSplit) || re-seat` test.

**Pins:** `.matilda/probe/dem-hop-split.mjs` (headless Chrome +
local http server, 8955; tracked via `git add -f`), 17 checks in
three scenarios — A: a no-age-cut wave (Roy Morgan preferred but
HUNTED from the live bundle via `window.demPairOf`, never a hardcoded
wave) lands Demographics+first-drawable-split (Place for Roy Morgan)
with its row still open and no page errors; B: an age-drawable wave
keeps Age (no gratuitous re-seat — persistence must win when
eligibility passes); C: the literal `AP.openPoll(key, "demographics",
"the probe")` Latest-table trip re-seats too. Same wave-hunt /
no-hardcode discipline as dem-half-print — assertions compute
expectations from `window.demPairOf` at runtime. Run it beside
dem-facet.mjs and othercuts-facet-hop.mjs on any split, fam, or hop
change. The /vic/ pages were regenerated in the same commit
(`npm run build:vic`) — the shared view code must not stay stale on
the sibling jurisdiction.

## The design ruling (income, keep unless the user relitigates it)

New splits arrive **All-polls Demographics facet ONLY**. The §7g
Who-votes-for-whom pooled panels anchor on QUOTED primaries verbatim
and pool waves across houses — a split only joins §7g if every
contributing house asks it on a compatible base. Income fails that:
YouGov's brackets are HOUSEHOLD income, Resolve's are household too but
different brackets, other houses ask personal or nothing — household
and personal bases never mix in one pooled series. Record the ruling
in demo-groups.mjs so the next "why isn't X pooled?" question has a
committed answer; see
`auto-skill-auspol-vote-by-group-all-voters-anchor` for the §7g anchor
contract.

## Push trap that shipped beside it

0087ceb's push ran the full clean-artifact dance through a sibling
session's live mid-dance (staged foreign files, build crash from their
WIP, HEAD moving mid-restore). That material lives in
`auto-skill-auspol-clean-artifact-commit` field notes, sixth case.

## The expanded dem table prints the house's figures VERBATIM (910e613, 2026-10-11)

`demTable` inside `RdApDetail` (rd-allpolls.jsx) is headed "The vote by
group, as ‹house› printed it" — a verbatim contract. Its cast sites
(`v == null ? "—" : Math.round(v)` in `cell()`, same for the
All-voters row's `tv`) rounded Roy Morgan's printed halves: user's
catch 2026-10-11 — NSW One Nation 26.5 showed 27, and the wave's
printed All-voters row 26/22.5/25.5/14.5/11 (= 99.5) displayed as a
101-summing row. Fix: cast both sites through **rdApNum**
(`String(+(+v).toFixed(1))`, the repo's "as the pollster printed it"
formatter — keeps halves as "26.5", drops ".0"), the same precedent as
the issues facet's printed decimals; the demTable block comment now
records the contract.

- **rdApPrimFig is NOT the right formatter here.** Its ½-glyph span
  carries sizing/kerning CSS only under `.rd-ap-pnums`/`.rd-ap-cprim`;
  in demTable's fixed-pixel cells those rules are unscoped and override
  the cell's font metrics. Fixed-layout table cells take rdApNum; the
  pied treatment stays in the cells it was styled for.
- **Shading was already right.** The hi/faded ±5 heat map is computed
  on the unrounded `v`/`tv`, so a display-text-only swap is safe — no
  cell background needs recomputing.
- **Bundle data shape bites:** `p.grp.d` rows are `[label, KOrderedArray]`
  with `K = ["alp","lnp","grn","onp","oth"]` — NOT party-keyed objects,
  and the All-voters row `p.grp.t` is the same K-ordered array. A probe
  mapping bundle figures onto the rendered head order must index
  `v[K.indexOf(h)]`; reading `v[h]` returns undefined everywhere and
  every row compare fails (the first checker run's mistake).
- Pinned by **`.matilda/probe/dem-half-print.mjs`** (headless-Chrome,
  http-server, committed from the worktree via `git add -f`). Its
  assertions are WAVE-AGNOSTIC: it hunts a Roy Morgan row across the
  facet's splits (Place→Gender→Age→Education→Home, Show-all first,
  because which split a printed-half wave covers shifts with the data),
  opens it, asserts every row equals the BUNDLE's figures cast exactly
  as above, plus a non-vacuity check (>0 half figures in the wave's own
  table — the pin must not pass trivially the day Roy Morgan stops
  printing halves). Never copy literal figures from one wave into a
  pin: the first checker's hardcoded 14–27 Sep expectations failed
  because recency sort surfaced the 4–10 May wave first — assert
  against bundle data, not write-time constants.
