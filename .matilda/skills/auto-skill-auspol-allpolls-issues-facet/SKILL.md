---
name: auspol-allpolls-issues-facet
description: auspol-tracker — the All-polls Issues facet (?f=i, shipped as 891d06c 2026-09-29) end-to-end: gen-data issuesOnlyPolls emitter (Ipsos as ISS_ONLY standalone rows, SEC waves riding direction rows), FACET_SCOPE.issues, RdApIssMini rail chart (D.issues.list is an ARRAY — find by id, not key; the TWO-BASIS ownership trap — iss.own is as-printed all-respondent, the pooled monthly series is three-party-renormalised §5i, renderers must renormalise before co-plotting), the FINAL phone-card anatomy (3a73407→f4e52b3→1c8ef8b→unranked-col-placeholder 2026-10-03: dots full-width on their own body line again, head-row issfig verdict chip, ONE superscript-ordinal ranking sentence — "Cost of living 1st, housing 2nd, crime 3rd", figures dropped, ISS_SENT_SHORT labels in SENTENCE CASE via sentLab/sentLab1, SEC ", unprompted", and for no-ranking waves the dictated "Issues unranked, but performance on cost of living assessed" line gated on iss.own.col), the ISS_PARTY → ISS_PARTY_META classic-script collision lesson, and the iss-facet/dir-facet probes.
source: auto-skill
extracted_at: '2026-09-29'
---

# All-polls Issues facet — auspol-tracker

The fifth facet tab (letter `i`, sits right after Direction in FACETS — that
order is also the arrow-key walk). User's brief: Ipsos gets rows of its own
(issues are all it polls); SEC Newgate's concerns ride in; VI houses show
issues (and direction) only. Probes: `.matilda/probe/iss-facet.mjs` (39
checks), regression guard `.matilda/probe/dir-facet.mjs` (31).

## The 2026-10-03 row redesign — three dnum cells + ownership dots + rail verdict

User brief: "improve the design of the issues view of the all polls table …
the row heights should be identical to those in the other views." The
offender was the stacked `.rd-ap-d2i` cell (2nd and 3rd issues as
figure-over-label pairs, ~80px of content); since `.rd-ap-row` carries only
`min-height: 58px` (the shared floor across every facet — load-bearing for
the rdPinScroll facet-walk landings, see auspol-allpolls-month-rows), its
rows stood ~80px tall. Shipped (plan-mode, user picked all three
recommended options): the DESKTOP row now mirrors the Direction facet's
grammar exactly:

- THREE single-line issue cells (Top / 2nd / 3rd), each a `.rd-ap-dnum`
  (figure `<b>` over a `.rd-ap-sub` issue label). `.rd-ap-d2i` is DELETED
  from rd.css — do not reintroduce a vertically stacked cell; the
  58px-parity probe check will catch it (iss-facet "5b": median
  `.rd-ap-row` height, ≤0.75px spread across issues/twopp/primary/
  leadership/direction). The three cells render inside ONE Fragment slot
  so the row still carries exactly 10 grid children (the ciss template's
  column count, and the fade `:nth-child(n+5)` selector's contract).
- A NEW picture track: the wave's party-OWNERSHIP on its top issue as
  `.rd-ap-dot`s on the shared 0–45 `pdx` scale with 4 `.rd-ap-gl`
  gridlines (0/10/20/30 — b900f23 dropped the 40), drawn straight off
  `RD_AP_PRIM` (rd-allpolls.jsx :149). Dots =
  `iss.own[iss.top]` (or SEC's `iss.bp` fallback), filtered to
  as-printed non-null parties, sorted desc. Head captions DIFFER by
  rung — desktop hrow "Best" vs phone phead "Best on the top issue, %"
  (see the captions section below).
- The Best-on-it verdict MOVED to the right-aligned `.rd-ap-netcell` rail
  position (`.rd-ap-issbest`: party abbrev in its css-var colour + the
  "N on it" sub) — the same slot Direction's Net figure occupies.
- Empty-reading nulls: a best-party-only wave (Resolve's
  party_attributes-only rows) = three dash cells + gridline-only track +
  dash rail; salience-only (Ipsos) = three filled cells + gridline-only
  track + dash rail.
- Basis contract (the TWO-BASIS section below now cuts BOTH ways): the
  ROW dots deliberately plot `iss.own` AS-PRINTED (all-respondent shares
  — the caption says so, and it lines up with the printed wave and the
  "N on it" chip). The OPENED detail's issBestBlock and the rail
  RdApIssMini keep the three-party renormalisation because they co-plot
  against the pooled `monthly` line. Row renderer = raw; detail/rail
  renderer = renormalised. Neither mixes.
- Phone cards mount the desktop track INSIDE THE HEAD ROW — see the
  Phone cards section; d55e614 (same day, phone redesign of this
  redesign) moved `.rd-ap-cpic` off its own body line onto `.rd-ap-c1`'s
  right slot at a fixed 148px, and killed the head-row pairfig that
  reprinted the top-issue share the first csub already names (user call:
  "get rid of that 68, replace it with those party ranking dots"). The
  literal rotate-the-dots-90° ask was geometrically fatal (~1.4px/pt on
  a ~75px card body vs 10px dots; the live wave's ALP/ONP spread is
  1pt), so the strip stays horizontal at ~3.3px/pt — the desktop hpic's
  104px-floor density.
- Grid contract moved: `.rd-ap-ciss` ∈ {10, 9, 7}-col templates at the
  3 breakpoints (rd.css :1975 / :2217 / :2228); the hpic span is the
  9th/8th column, the netcell the last. The `.rd-ap-issbest > b`
  normalisation (15px/600) sits beside `.rd-ap-netcell` (~:2104).
- Geometry re-verified 2026-10-03 AFTER d55e614 (same session the phone
  anatomy settled): `.matilda/probe/iss-head-sweep.mjs` gained a
  caption∩scale-bar check (`cap∩barN`, on `.rd-ap-hbar-bar` rects)
  beside its cap∩tk / cap∩best / dots∩dots checks — zero `cap∩` hits
  across all 24 widths 560–1480, and a phone pass (320/360/390/430/500)
  measures the caption-only phead block at 38px tall, caption 16px,
  bars/ticks ABSENT (the head is pure `.rd-ap-hdir` grammar now). The
  only hits anywhere remain the sanctioned dots∩dots halo (§known
  non-defect). LESSON: a mid-churn tick-padding tweak
  (`padding: 8px 0 0` on the old phone-head clause) was reverted by a
  sibling reset and turned out MOOT — d55e614 deleted the phone-head
  tick ladder it was padding. When an uncommitted edit is lost to a
  reset, re-measure the CURRENT anatomy at HEAD before re-applying:
  the geometry the edit served may no longer exist.

## Grid-template budget underflow (commit 66a078a, the "BEST ON THE TOP ISSUE…" head jumble)

User report: caption, tick labels, Best-on-it head and row values painted
on top of one another on Mac desktop — **Safari AND Chrome alike** (engine-
agnostic CSS maths), phone cards clean. Root cause deserves a general
warning: the `.rd-ap-ciss` templates at all three breakpoints had
ideal-width budgets that SUMMED MORE than the table's inner width
(`min(1152px, 0.9·vw)` ⇒ ≤1117px at ≥1241vw; the desktop template wanted
1296px). Every flexible track was `minmax(0, …)` — ZERO floors — so the
deficit was absorbed by shrinking tracks to nothing: `.rd-ap-hpic` →
232px (tick soup), the Best-on-it `minmax(0,1fr)` → **0px** (its
right-aligned th text painted across the ownership ticks; row verdicts
squashed to a 4px strip). The ≤1240 rung zeroed col9 at ≤1100; the
≤1000 rung collapsed hpic to 24–42px at 780–800. LESSON: any CSS-grid
facet head whose column ideals exceed the container must carry
**content-true minmax floors that sum ≤ the rung's real inner width**,
else starvation renders as text-on-text overlap, not a scroll overflow —
and it is engine-agnostic, so "works in BrowserKit/safari-only" reasoning
is a dead end; verify by measuring inner width vs resolved
`grid-template-columns` (probe: `.matilda/probe/iss-head-budget.mjs`).

The shipped fix (rd.css only, 7+/3−):

- Desktop template floors: `200px 120px 76px 36px minmax(120px,176)
  minmax(104px,136) minmax(104px,136) minmax(168px,336) 72px 40px` —
  floors sum 1040 ≤ 1117px worst-case inner.
- Best-on-it became a FIXED 72px track (content max ~66px: a short party
  abbrev at 15px/600 + "12 on it" 12px sub) — not a flexible greedy one.
- Columns DROP by breakpoint instead of shrinking through zero: 3rd-issue
  hides at ≤1240, 2nd at ≤1000, via `visibility:hidden; overflow:hidden`
  on `:nth-child(7)` / `:nth-child(6)` PLUS a `0` track in the template —
  the established sample-column precedent, and it keeps exactly 10 grid
  children so the fade `:nth-child(n+5)` contract survives intact.
- ≤1000 floors sum 610 ≤ 900. Phone (≤640) rung untouched — cards never
  had the hrow.
- Verified by width sweep 560–1480 (`.matilda/probe/iss-head-sweep.mjs`):
  zero caption/tick/verdict/dots intersections, rows hold 58px, hide
  schedule asserted at 1300/1200/1000/800/761.

The caption half of the same complaint had already shipped in sibling
commit b900f23 (user call: "you can just say 'Best'. and you don't need a
40% line"): both heads read "Best" at that point, ladder 0/10/20/30
(4 ticks), pdx 0–45 scale kept so >30 dots overshoot the final gridline
by design. Check `git log` before "fixing" text a summary says is wrong —
snapshot-era copies of the 307px caption string were already dead code.

## Head captions/labels — THREE strings, final contract 2026-10-03

The phone complaint came first ("it just says best on its own on a line
on my phone. Surely you can add more words there" — 9d2f9a2), then the
user walked the same wish across desktop in two more calls: "instead of
just best on desktop, call it best on it. There is room for on it."
(15dbaed) and "the last two columns are both labeled best on it. I
think call the last column 'Best party'" (label rode 6825d55, probes
pinned f67f598). FINAL strings, all shipped:

- DESKTOP hrow caption (rd-allpolls.jsx :1491) = `"Best on top issue"`
  — walked 15dbaed's `"Best on it"` to the fuller reading so the dots
  column's scale grammar matches the rail's `"Best party"` beside it.
  The 66a078a budget math that starved the hpic to ~196px no longer
  binds: the caption measures ~110px against the column's ~104px
  narrowest template floor under its th; the sweep confirmed no
  caption/tick contact at 560–1480. The phone head takes the fullest
  wording still.
- DESKTOP rail th (:1494) = `th("Best party", "iss.bestv", …)` — the
  right-aligned verdict column got its own distinct name so the last
  two column heads don't both read "Best on it". Sort key and title
  ("The party most voters rate best on that issue") unchanged. Fits:
  scrollWidth 83 ≤ the 82.8px th box at every rung 800–1480 (the
  82.8px-into-72px overflow is pre-existing padding geometry, same as
  "Best on it" had).
- PHONE phead (:1776) stays `"Best on the top issue, %"`, deliberately
  the same terse basis-marked grammar as the phone primary facet's
  `"Primary vote, %"`. Measured 168px at the 12px/600 caps caption font
  (`.rd-ap-cap` ≈ 8px/char) → 104px clear of the track's right edge
  even at 320px. The obvious fuller choice — the pre-b900f23
  "Best on the top issue, % of all respondents" — measures ~307px and
  OVERFLOWS the 320–360 rungs (`0.9·320 − 16 ≈ 272px` of track); that
  is why it lost. `.rd-ap-cap` is `position:absolute; white-space:
  nowrap`: an over-long caption NEVER wraps, NEVER ellipsises — it
  silently paints past the track right edge. A caption change needs a
  right-edge probe (cap rect ≤ hpic rect − 8) at 320/360/390/560/760,
  not just the collision sweep (cap and ticks sit on different bands,
  so the sweep's intersection check cannot see horizontal overflow).
- When a user asks "is the Best column about issue importance?": NO —
  importance (salience) lives ONLY in the Top/2nd/3rd `.rd-ap-dnum`
  cells (% naming each issue most). The dots track and the Best-on-it
  rail are the best-ON-the-top-issue shares, as printed, of all
  respondents (§TWO-BASIS below).
- Probe pinning: iss-facet.mjs pins the two CAPTION strings —
  `headCap:"Best on it"` (desktop, :235) and `phoneHead.cap:
  "Best on the top issue, %"` (:446); it never pinned the rail th text.
  The RAIL th is located by `/Best party/i` regex in the three
  head-geometry probes iss-head-sweep.mjs (:33), iss-head-overlap.mjs
  (:50) and iss-head-safari.mjs (:27) — a rail-label rename touches all
  three at once. A deliberate copy change fails the probes until the
  pinned expectation moves with it. THE PROBE ADD GOTCHA: iss-facet.mjs
  is tracked BUT
  lives under the gitignored `.matilda/probe/` — a batched
  `git add file1 index.html probe` fails the WHOLE add with exit 1
  ("paths are ignored"); stage the probe separately with `git add -f`
  (same force-add precedent as frame-margins.mjs in 7097422).

Known non-defect: the newest SEC Newgate row plots ALP 23 / ONP 22 — dots
1 point apart on the 0–45 scale overlap halos at every width. That is the
`.rd-ap-dot` halo design (dbac426), not collision; a sweep's dot∩dot
check must know it or it flags an everlasting false positive.

## TWO-BASIS OWNERSHIP — iss.own is AS-PRINTED, the pooled series is three-party

The session of 891d06c+ shipped a visible mismatch (user report: "the
current polls dots always seem to be really low relative to the pooled
line", fixed in the follow-up commit). The ownership figures live on TWO
bases at once and every renderer that co-plots them must align them:

- `iss.own` (gen-data :1486 `own: w.issues`, one per poll row) carries the
  pollster's AS-PRINTED shares of ALL respondents — Ipsos col prints
  alp 27 + lnp 22 + onp 18 = 67, the rest are Greens/others/unsure.
- The pooled monthly series `D.issues.list[].monthly` (gen-data §5i
  :2834-2846) renormalises EVERY row to shares of those naming one of the
  three majors first: `named = sh.alp+sh.lnp+sh.onp; s3 = 100*sh[q]/named`
  — so the three line values sum to ~100 (40.3/32.8/26.9 for that wave).
- Plotting iss.own raw against `monthly` puts every dot ~33% low —
  and the "Rated best on" block in rowFor (~:614) rendered the same raw
  shares under the caption "Shares of those naming one of these three, %"
  that was only true of the OTHER basis. BOTH must renormalise in the
  renderer before display; gen-data §5i is the single basis-conversion
  site, display normalisation is NOT the pipeline's job (the raw
  as-printed shares stay reachable for anyone who wants the printed
  surface).
- The renderer-side pattern (now in RdApIssMini :508-512 and the
  issBestBlock ~:616-621):
  `const nm3 = own.alp+own.lnp+own.onp; own3 = nm3>0 ? {…q: own[q]*100/nm3…} : own`
  (guard the >0; a wave with no three-party answers keeps its row).
- Probe pin (iss-facet.mjs check 8b): evaluate the THREE dot cy's (dedupe
  — halo+dot pairs render as two circles at the same cy, so dedupe by cy
  first or you sum to exactly 200) back through the axis-anchor pixel
  scale and assert Σ ≈ 100 ± 2.5. Catches any renderer regression that
  goes back to plotting as-printed shares.

Rule of thumb repeated everywhere it bites: **before co-plotting any
per-wave figure against a pooled auspol series, check the series' basis
comment in gen-data and match it in the renderer** — the pipeline keeps
the raw payload intact deliberately.

## X-BASIS — markers sit at fieldwork MIDPOINT, never at released

(2026-10-05, commit 6d1abe4; user report "the current poll dots always
hang on the right of the chart regardless of their fieldwork dates".)
The x-axis twin of the basis trap above: `released` is a fieldwork's
LAST day on most rows (Ipsos issues: field "2–7 Dec" ↔ released
2025-12-07) and the publish stamp on others, while the pooled monthly
line plots at month-mid (`ym+"-15"`) — so every marker drifted right of
its window (~3 days ≈ 8 svg units at the 7-month scale; Ipsos 5–13 Aug:
released x 431.5 vs mid x 423.1).

- gen-data emits `fmid` (fieldwork-mid ISO) off a new helper `fmidIso`
  (~:231, right after `fwLabel`; UTC half-open average of
  dateStart..date). Emit sites, all `...(d.dateStart ? {fmid:…} : {})`:
  directionPolls :1374, directionOnlyPolls :1434, issuesOnlyPolls :1545,
  and ALL individualPolls :2146 — made unconditional on `dateStart`
  after RdApMini (the 2PP mini, not just dir/iss) proved to need it
  too. The 2 no-dateStart rows fall back to released.
- Consumers take `p.fmid || p.released`: RdApMini :271 (own) and :290
  (sibling past dots), RdApDirMini :409/:425, RdApIssMini :526 (keeps a
  longer `|| p.published || t1` tail). Audit rule for any future
  marker: every `X(rdApDays(p…))` site uses fmid; only month-axis
  labels (`ym+"-01"`) and the monthly line points (`ym+"-15"`) stay
  literal-date-based.
- Probe pin: iss-facet.mjs check 8c opens the newest Ipsos issuesOnly
  row, recomputes the svg X mapping in-page from fmid + t0/t1, and
  asserts the wave's dots share one cx ≈ X(fmid) ±2 svg units and
  ≠ X(released).
- Coverage at ship: 161/163 individual + 9/9 issuesOnly + 75/75
  direction + 10/10 directionOnly rows carry fmid.

Same rule of thumb as y: when co-plotting a per-wave marker against a
pooled monthly series, match the series' TIME basis (mid-window), not
the row's release stamp.

## Row plumbing (gen-data.mjs)

- `ISS_ONLY = new Set(["Ipsos"])` — the sentinel for "issues house with no
  poll or direction rows to join".
- `ISS_BY` map (:1456): `"date|pollster"` → the wave's issues payload,
  built from `data/issues.json` (salience + ownership waves) and
  `data/sec-issues.json` (SEC concerns/best-party banks ride the house's
  direction rows — SEC never gets ISS_ONLY rows of its own).
- `issuesOnlyPolls` IIFE (:1522, shaped like `directionOnlyPolls`):
  Ipsos waves become rows carrying `{ym, x, day, pollster, fym?,
  field/dateLabel, released, sample, sampleEff?, url, client:
  "Self-published", p:{}, appr:{}, chg:null, iss}`. `p:{}/appr:{}` are
  deliberate — nothing downstream may stand VI numbers on them.
- The row's `iss = {sal:[[label,share]…], top:"col"|…, own:{col:{alp,lnp,
  onp,grn,oth,unsure,none},…}, opts:[…], q:"most capable of managing",
  plus:{w, pair, lead, lean}}` (see auspol-issues-panel for pooling).
- Emitted into the bundle (:4483), export list (:4586). Bundle tallies at
  ship: nAll 182 (163 individual + 10 direction-only + 9 issues-only),
  nIssAll 42 (9 Ipsos + 7 SEC + 26 VI-house waves).

## Facet + scope (d1a1d215 asset)

- `FACET_SCOPE.issues` (:4800) = `{ has: (p)=>!!p.iss, label:"With issues
  figures" }`; `defaultScopeFor` (:4819) returns `true` for the facet so the
  scope self-arms — identical contract to Direction (see
  auspol-allpolls-scope-pills).
- Ipsos never bleeds onto other facets: 2PP/Primary/Leaders/Direction
  `has()` gates exclude iss-only rows by construction. The tally
  denominates against the union of all three row arrays — update the delta
  derivation in dir-facet.mjs (`extraRows = directionOnlyPolls +
  issuesOnlyPolls`) whenever a third row class appears.

## The rail chart — RdApIssMini (rd-allpolls.jsx :493-553; wave's-figures
renormalised at :508-512 and the caption/ARIA at :528, :808-811)

- **THE trap that shipped broken and gave an invisible empty box**:
  `D.issues.list` is an ARRAY of `{id, label, imp, own, monthly, dots,…}`
  sorted by salience (gen-data :2903 `ISSUE_SHARED.map(…).filter(…)`);
  the first cut indexed it `list[iss.top]` (`list["col"]`) → `undefined`,
  the component hit its `!item` guard and silently rendered the empty
  fallback `<div ref={box}></div>`. Probes saw rail copy fine but
  `railSvg:false`. Fix: `D.issues.list.find((it) => it.id === iss.top)`.
  When a pooled-series lookup returns nothing, log why — never let the
  empty fallback pass silently through acceptance.
- Empty-fallback guards (both render `<div ref={box}></div>`):
  `!item || !item.monthly || item.monthly.length < 2`, and the
  window-filtered `rows.length < 2`. Window: `iM = D.MONTHS.indexOf(p.ym)`;
  `ms = D.MONTHS.slice(max(0,iM-6), iM+1)` (7-month slice); rows kept when
  `rdApDays(ym+"-15") ∈ [t0,t1]`. The absence of `ym` on a row class would
  poison the whole window (iM=-1 → empty slice → t0 NaN → empty chart)
  — issuesOnly rows carry `ym` off `ymOf(w.date)`, pinned by the probe.
- Draws: three party-share monotone lines (alp/lnp/onp,
  `color-mix(in oklab, …)` tinted) over the monthly pooled series, the
  wave's own figures as ring+dot at `p.fmid || p.released ||
  p.published || t1` (see §"X-BASIS" above — never bare `released`),
  month ticks skipping by
  parity of the window length. Wakes off `iss.own[iss.top]`; a wave with
  no own-reading keying the wave marker must look up the monthly net row
  instead of borrowing the national table.
- Rail construction (RdApDetail issues branch, :799-830): `RdApIssMini`
  only mounts when `D.issues && iss.own && iss.own[iss.top]`; facts keys
  differ by question family — Ipsos: Asked (quote of the wording `iss.q`,
  e.g. "Ipsos's wording: "most capable of managing"") / Between the
  question forms / Ipsos's usual lean / In today's panel. SEC: Asked /
  SEC's usual lean (its any-mentions pool legitimately into OWNERSHIP) /
  In today's panel — but NEVER "Between the question forms" (that's the
  salience pair-lean; SEC's bank can't sit in the salience series, so SEC
  rails never show it). A VI house on the Issues facet gets the same
  issues keys (Asked / its usual lean / In today's panel).

## Phone card FINAL anatomy (3a73407 then f4e52b3 then 1c8ef8b, 2026-10-03) — supersedes the section below

THREE same-day user drives after the anatomy below shipped. 3a73407
("Make the dots span the whole width of the row once again, like in
primary and like in leaders … have the best issue, second best issue and
third best issue on one line") re-restructured the card; f4e52b3
('change it to "Cost of living 1st [with superscript st], housing 2nd
[not affordability - that's not needed], crime 3rd (", unprompted" on
SEC)"' +'"also don't capitalise issue names"') established the sentence;
1c8ef8b ("the first letter of the first issue should be capitalised -
sentence case") settled the casing. FINAL contract:

- The ownership dot strip is BACK on its own full-width BODY line:
  `{ownDots.length > 0 && <div className="rd-ap-cpic">{pic}</div>}` is
  the last child of the card's `body <>`, exactly like Primary/Leaders.
  d55e614's 148px right-slot head-row mount died here; don't revive it.
- The best-party verdict is a HEAD-ROW chip: `right1 =
  <b className="rd-ap-issfig">` (ISS_PARTY_META short code in party
  colour + share, shares `.rd-ap-pairfig`'s 15px/600 rule, the Direction
  facet's "Net +3" pattern) — e.g. SEC "ALP 23"; "rest 43" is a
  legitimate SEC verdict exactly as the desktop rail prints it.
- The THREE best-issue sublines collapsed into ONE sentence div
  `.rd-ap-csub.rd-ap-csub-sent` (~L1718-1734). The `-sent` modifier is
  `display:block` and load-bearing: the shared csub rule is
  `display:flex` built for figure chips and would itemise every JSX
  fragment onto its own line (the sentence measured 4 lines without it).
- Final sentence grammar (f4e52b3→1c8ef8b): "Cost of living 1st,
  housing 2nd, crime 3rd" — ordinals via `ord(n)` emitting `<span>1<sup>st</sup></span>`
  /2nd/3rd, NO parenthesised salience figures (the ordinal itself
  carries the ranking; shares remain quoted in desktop cells and the
  expanded detail rail), SENTENCE CASE via
  `sentLab(l) = ISS_SENT_SHORT[l] || l.toLowerCase()` for labels 2/3
  and `sentLab1(l) = s.charAt(0).toUpperCase() + s.slice(1)` for the
  first label only — f4e52b3 had lowercased sentence-initial too;
  1c8ef8b lifted ONLY the leading letter, everything else stands;
  `", unprompted"` suffix on SEC waves
  (`unprompted = !!(iss && !iss.sal && iss.conc)`).
- Unranked-but-col placeholder (same day; source jsx rode into the
  sibling primary-order commit 4820dda, probe pins + compiled line
  landed with the Asked-line fix in 9aa99cf): Resolve, YouGov and
  DemosAU waves carry an iss payload with ownership
  figures but NO salience/concerns ranking (no `it`, no sentence), so
  the line was empty — user call ('say "Issues unranked, but
  performance on cost of living assessed"') fills it with that
  dictated literal when `!it && iss && iss.own && iss.own.col` (col
  ownership was asked); SEC's pure best-party waves and iss-less
  rows keep no sentence. Probe pins it by verbatim text
  (`txt === "Issues unranked, but performance on cost of living
  assessed"`), counted against the page's own data bundle
  (`exp.unrankedCol`); capsOk passes as written (sentence case). The
  dictated literal wraps to two lines on the phone (38px csub; card
  133.6px at both 360 and 390px — visible as the 133.6 entries in the
  iss-card-height dumps alongside the 118.1 sentence+strip family).
- `ISS_SENT_SHORT = { "Housing affordability": "housing" }` —
  module-level at rd-allpolls.jsx :186 (right after rdApX). The two
  label vocabularies differ (canonical data/issues.json stores
  "Housing", SEC's data/sec-issues.json stores "Housing affordability")
  and only the SENTENCE output was named redundant — desktop cells and
  emissions keep the stored label, so map in the renderer, never edit
  the stored data. Add a future label the user calls redundant to this
  map, not to the data.
- Heights (360px): sentence csub one text line 22.2px; cards 118.1
  (sentence+strip) / 93.9 (strip-only); the 140.3 outlier is
  "economic management" wrapping the sentence to two lines on its card.
  390px renders (post-1c8ef8b, sentence case): SEC "Cost of living 1st,
  housing 2nd, crime 3rd, unprompted" (chip "ALP 23"); RedBridge "Cost
  of living 1st, health 2nd, housing 3rd"; Ipsos "Cost of living 1st,
  housing 2nd, economic management 3rd".
- Probe pinning (iss-facet.mjs, 43 checks since the placeholder and
  9aa99cf's Asked-branch pin): `topFilled` keys on
  `/ 1st/`; ordinal grammar `/, [^,(]+ 2nd/` and `/, [^,(]+ 3rd/`;
  `legacy` flags any relic figure grammar (`/\(\d+\)/` or
  ` top issue | then |Best on it`); `capsOk` (1c8ef8b) asserts EXACTLY
  ONE capital — at position 0 after stripping the ", unprompted" tail
  (`/^[A-Z]/.test(bare) && !/[A-Z]/.test(bare.slice(1))`) — so BOTH
  drift directions fail: all-lowercase (f4e52b3's contract) and Title
  Case. LESSON: the probe's grammar anchors ARE the copy contract —
  after a deliberate sentence-copy change, update the anchor AND its
  check label in the same commit; this session's mid-work false-FAIL
  (40/41) was a stale `/ then /` anchor against the figure-free
  grammar, and 1c8ef8b moved anchors + label with the copy.

## Phone cards (390px) — anatomy ≠ desktop (PREDATES 3a73407/f4e52b3 — superseded by the section above)

- Phone `.rd-ap-card.rd-ap-ciss` > `.rd-ap-c1` (firm link +
  `<b class="rd-ap-pairfig">63</b>` — the top-issue figure) + `.rd-ap-csub`
  divs: "Cost of living <b>63</b>", the 2nd/3rd-issue csub ("2nd Hospitals
  <b>32</b> · 3rd The economy <b>17</b>" — one `.rd-ap-csub`, each figure
  in its own `<b>` beside its issue's name), then "Best on it:
  <b>Labor</b>, 27". Cards whose wave asked the ownership question ALSO
  mount the desktop track's phone rung — `.rd-ap-cpic > .rd-ap-pic`
  (rd.css ~:2273, `height:28px`, the phead's scale head carries its OWN
  caption — the phone string, §captions — + 0–30 ticks; the `> .rd-ap-pic { position:absolute; inset:0;
  min-height:0 }` pin keeps the card's pic from inheriting the phead's
  height floor; each row's pic is a fresh element, so no tk duplication
  issue). Salience-only waves (Ipsos) get NO cpic, best-party-only waves
  get NO csub — both legit. Desktop's stacked `.rd-ap-d2i` cell is dead
  (the 2026-10-03 redesign, §top) — 2nd/3rd ride that one csub on phone
  and their own `.rd-ap-dnum` cells on desktop. The `.rd-ap-ibar`
  share-bars remain retired since 2026-09-29 (user: "replace the
  share-naming column with 2nd and 3rd top issues").
- **No `.rd-ap-dnum` on phone** — that's the DESKTOP figure cell. A probe
  selector `.rd-ap-cfigs .rd-ap-dnum b`/`.rd-ap-dnum b` matches nothing on
  cards (hit twice: first as an unserialisable-return bug, then as a
  false-positive count when loosened to "any csub b" — the "Best on it"
  csub always carries a `<b>` for the best-party name, so a
  fill-iff-contract must key on the pairfig containing a digit, not on csub
  b existing).
- A best-party-only wave (e.g. Resolve's party_attributes-only rows, top
  issue `—`) legitimately has fill-flag false and no 2nd/3rd cell/csub on
  BOTH rungs. Desktop fill flag = the first top-level `.rd-ap-dnum` b
  (`:scope > .rd-ap-dnum` — after the 2026-10-03 redesign every figure
  cell is a TOP-LEVEL row child, so scope the row query regardless);
  phone = pairfig digit test.

## Classic-script global-name uniqueness (ISS_PARTY → ISS_PARTY_META)

The assets are PLAIN classic scripts sharing one global lexical scope: a
top-level `const X` in d1a1d215 must not collide with any `const X` in
a11e1559, 73de0c58, 08b413e7, 9f09dca2, rd-allpolls.jsx, etc. d1a1d215's
own `const ISS_PARTY` collided with a11e1559's PRE-EXISTING `:2580 const
ISS_PARTY` (the Snapshot's string map `{alp:"Labor",…}`) — shipped
SyntaxError "Identifier 'ISS_PARTY' has already been declared" and every
JSX-rendered view fell into the error boundary. Renamed the new one to
`ISS_PARTY_META` everywhere (definition in d1a1d215, the window export,
all rd-allpolls.jsx `window.ISS_PARTY_META` readers and the comment).
Lesson: before adding ANY new top-level identifier to an asset, grep the
identifier bare across `.build/newtracker/assets/` (not just the file
you're editing), and prefer a `<feature>_` prefix for feature-scoped
exports.

## Verify probes

- `.matilda/probe/iss-facet.mjs` — 41 checks since f4e52b3 (the two new
  phone-card sentence checks: superscript-ordinal grammar per §FINAL
  anatomy above + `capsOk` no-uppercase): tab order + `?f=i` deep link,
  42/42 rows (9 Ipsos + 7 SEC + 26 VI-house), 42-of-184 tally on Issues and
  the sibling-facet tallies, Ipsos never bleeding onto
  2PP/Primary/Leaders/Direction, the redesigned row anatomy (§top: exactly
  three top-level `.rd-ap-dnum` cells, a `:scope > .rd-ap-pic` strip with
  2–4 `.rd-ap-dot`s over 4 gridlines iff the wave has an ownership reading,
  the `.rd-ap-netcell` verdict rail, `.rd-ap-d2i` ABSENT, runners imply a
  filled top-issue cell, head names the 0–30 ladder on the 0–45 scale), ROW-HEIGHT PARITY
  across all five facets (median `.rd-ap-row` height, ≤0.75px spread —
  the redesign's acceptance check), Ipsos detail = 11 apd-issrows + "The
  issues voters name" + issues rail (`Asked/…/most capable of managing/
  usual lean/In today's panel`, svg:true) with NO matchup grid/primary
  chips, SEC detail = "Named without prompting" + not-pooled note + no
  "question forms" in rail, Resolve detail = issues rail with Asked |
  usual lean | In today's panel, phone 390px cards (2nd/3rd csub iff top
  filled, ownership iff `.rd-ap-cpic` with 2–4 dots, phead caption +
  4 ticks), the two-basis pin in §"TWO-BASIS OWNERSHIP" above (wave's
  own detail dots Σ ≈ 100 after axis-pixel inversion — the detail
  renormalises; the ROW strip deliberately doesn't), and the x-basis pin
  8c in §"X-BASIS" above (dots cx ≈ X(fmid), ≠ X(released)).
- `.matilda/probe/dir-facet.mjs` — 31 checks; its tally derivation reads
  the third array off the live bundle.
- Both probes read `window.AUSPOL` for expected counts — never bake counts
  into assertions. A pageerror on the page (errs1/errs3) is its own check
  line.
