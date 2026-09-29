---
name: auspol-allpolls-issues-facet
description: auspol-tracker — the All-polls Issues facet (?f=i, shipped as 891d06c 2026-09-29) end-to-end: gen-data issuesOnlyPolls emitter (Ipsos as ISS_ONLY standalone rows, SEC waves riding direction rows), FACET_SCOPE.issues, RdApIssMini rail chart (D.issues.list is an ARRAY — find by id, not key; the TWO-BASIS ownership trap — iss.own is as-printed all-respondent, the pooled monthly series is three-party-renormalised §5i, renderers must renormalise before co-plotting), the decade-long pairfig/csub phone-card anatomy, the ISS_PARTY → ISS_PARTY_META classic-script collision lesson, and the iss-facet/dir-facet probes.
source: auto-skill
extracted_at: '2026-09-29'
---

# All-polls Issues facet — auspol-tracker

The fifth facet tab (letter `i`, sits right after Direction in FACETS — that
order is also the arrow-key walk). User's brief: Ipsos gets rows of its own
(issues are all it polls); SEC Newgate's concerns ride in; VI houses show
issues (and direction) only. Probes: `.matilda/probe/iss-facet.mjs` (35
checks), regression guard `.matilda/probe/dir-facet.mjs` (31).

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

## Phone cards (390px) — anatomy ≠ desktop

- Phone `.rd-ap-card.rd-ap-ciss` > `.rd-ap-c1` (firm link +
  `<b class="rd-ap-pairfig">63</b>` — the top-issue figure) + `.rd-ap-csub`
  divs: "Cost of living <b>63</b>", the 2nd/3rd-issue csub ("2nd Hospitals,
  3rd The economy" labels with the two shares in one trailing `<b>`), then
  "Best on it: <b>Labor</b>, 27". NO picture strip — desktop's
  "2nd and 3rd top issues" cell (`.rd-ap-d2i`, stacked `.rd-ap-dnum`
  figure-over-label entries from the wave's salience row after the top one)
  becomes that csub; the earlier `.rd-ap-ibar` share-bars were retired
  2026-09-29 (user: "replace the share-naming column with 2nd and 3rd top
  issues").
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
  (`:scope > .rd-ap-dnum` — the d2i's own entries also carry that class,
  so scope the desktop row query or the two figure cells and the runner
  entries sum together); phone = pairfig digit test.

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

- `.matilda/probe/iss-facet.mjs` — 35 checks: tab order + `?f=i` deep link,
  42/42 rows (9 Ipsos + 7 SEC + 26 VI-house), 42-of-182 tally on Issues and
  the 163/97/75 sibling-facet tallies, Ipsos never bleeding onto
  2PP/Primary/Leaders/Direction, the 2nd/3rd-issues cell iff the top-issue
  cell is filled (desktop `.rd-ap-d2i` figure-over-label entries, phone
  ^2nd csub — both rungs), Ipsos detail = 11 apd-issrows + "The issues voters
  name" + issues rail (`Asked/…/most capable of managing/usual lean/In
  today's panel`, svg:true) with NO matchup grid/primary chips, SEC detail
  = "Named without prompting" + not-pooled note + no "question forms" in
  rail, Resolve detail = issues rail with Asked | usual lean | In today's
  panel, phone 390px cards, the two-basis pin in §"TWO-BASIS OWNERSHIP"
  above (wave's own dots Σ ≈ 100 after axis-pixel inversion), and the
  x-basis pin 8c in §"X-BASIS" above (dots cx ≈ X(fmid), ≠ X(released)).
- `.matilda/probe/dir-facet.mjs` — 31 checks; its tally derivation reads
  the third array off the live bundle.
- Both probes read `window.AUSPOL` for expected counts — never bake counts
  into assertions. A pageerror on the page (errs1/errs3) is its own check
  line.
